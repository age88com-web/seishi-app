// src/lib/ziwei/meanings/aiContext.ts
//
// 宮クリック時の全件コンテキスト（buildPalaceMeaningContext）から、AI へ渡す象意を選ぶ層。
// docs/ziwei-basic-spec.md §21.10。入口は buildAiMeaningContext(ctx, { detailLevel })。
//
// 方針:
//   - 資料の構造（どのデータ・どの節・どのカテゴリ／タグの文か、主星か副星か、条件の有無、資料差異の区分）だけで選ぶ。
//     一般知識で重要度を決めない。資料にない分類を作らない。要約・言い換え・解釈・吉凶判断はしない。
//   - ランク:
//       A（必ず渡す・件数上限で削らない）: 本宮の星×宮（資料上の分類ごとの代表。命宮以外は全件）、主星の基本象意の先頭、
//         完全一致の同宮の組み合わせ、本宮の四化（この宮の記述）
//       B（詳しさに応じてできるだけ渡す）: 主星の星×宮の追加、主星の基本象意の追加、副星の基本象意、三方四正で
//         完全一致した加会、宮そのものの象意、四化の宮に依らない記述
//       C（参考）: 一部一致の組み合わせ・条件未判定の文（referenceOnly）、needs_review（reviewItems）、
//         同内容の重複（代表の alsoIn）
//   - 力量の条件付きの文（§22.6）: 条件成立 → 通常の候補、不成立 → conditionExcluded、判定不能 → referenceOnly。
//     前文（文脈文）が条件付きなら主文も同じ扱い（前文が成立したときだけ前文と一緒に採用。後続文だけを出さない）。
//   - detailLevel ごとの採用件数の目安: brief 10〜20、standard 20〜35、detailed 30〜50。A は目安を超えても削らない。
//   - 出典（資料名・ページ・見出し・元データ ID）は必ず残す。

import { MEANINGS_META, TRANSFORMATION_MEANINGS } from "./store";
import { previousInSection, sentenceDependency } from "./sentenceContext";
import { evaluatePowerCondition } from "./powerCondition";
import type {
  AiCombination,
  AiConditionExcluded,
  AiContextSentence,
  AiDetailLevel,
  AiMeaning,
  AiMeaningContext,
  AiMeaningKind,
  AiMeaningPriority,
  AiMeaningRank,
  AiReferenceMeaning,
  AiReviewItem,
  ContextCombination,
  PowerConditionEvaluation,
  ContextMeaning,
  ContextStar,
  MeaningReview,
  PalaceMeaningContext,
  SourceRef,
  ZiweiStarName,
} from "./types";

/** entryId → 資料差異（文脈文にも付ける） */
const REVIEW_BY_ID = new Map<string, MeaningReview>();
for (const d of MEANINGS_META.sourceDifferences) {
  for (const id of d.entryIds) REVIEW_BY_ID.set(id, { status: d.status, topic: d.topic, note: d.note });
}

export interface AiSelectionOptions {
  /** 詳しさ（既定 standard） */
  detailLevel?: AiDetailLevel;
}

/** detailLevel ごとの採用件数の目安 [下限, 上限]。B は上限まで足す。A は上限を超えても削らない */
export const AI_DETAIL_LEVELS: Readonly<Record<AiDetailLevel, readonly [number, number]>> = {
  brief: [10, 20],
  standard: [20, 35],
  detailed: [30, 50],
};

/**
 * 「その他の星曜との配合」（combination）の文は、相手の星と組になった文の続きであることがあり、
 * 相手の星を抜きにすると誤読につながるため選別の候補にしない（全件コンテキストには残る。条件付きの文は参考へ）。
 */
const EXCLUDED_STAR_PALACE_CATEGORIES = ["combination"];

/** 資料上の分類（カテゴリ → タグ）の並び。命宮の星×宮の代表選びと、追加分の巡回順に使う */
const CATEGORY_ORDER = ["basic", "career", "appearance"];

/** 文が属する資料上の分類（カテゴリとタグ）。資料にない分類は作らない */
function facetsOf(m: ContextMeaning): string[] {
  return [...(m.category ? [`category:${m.category}`] : []), ...(m.tags ?? []).map((t) => `tag:${t}`)];
}

/** 宮の一般象意: 何を見る宮か（target）→ 判断時の注意（caution）→ 力量の見方（strengthRule） */
const PALACE_CATEGORY_ORDER = ["target", "caution", "strengthRule"];

function transformationPalaceOf(id: string): string | null {
  return TRANSFORMATION_MEANINGS.find((e) => e.id === id)?.palace ?? null;
}

/** 複数の列を先頭から1件ずつ交互に並べる */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i += 1) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

interface Candidate {
  m: ContextMeaning;
  priority: AiMeaningPriority;
  kind: AiMeaningKind;
  stars: ZiweiStarName[];
  facet?: string;
  combination?: ContextCombination;
}

export function buildAiMeaningContext(ctx: PalaceMeaningContext, options: AiSelectionOptions = {}): AiMeaningContext {
  const detailLevel = options.detailLevel ?? "standard";
  const targetRange = AI_DETAIL_LEVELS[detailLevel];

  const keyMeanings: AiMeaning[] = [];
  const referenceOnly: AiReferenceMeaning[] = [];
  const reviewByTopic = new Map<string, AiReviewItem>();
  const usedIds = new Set<string>();
  const byText = new Map<string, AiMeaning>(); // 同じ資料の同じ文
  const byTopic = new Map<string, AiMeaning>(); // same・wording_difference の論点
  const fullMatchCombinations: AiCombination[] = [];
  let mergedCount = 0;

  const addReview = (m: ContextMeaning) => {
    const r = m.review!;
    const item = reviewByTopic.get(r.topic) ?? { topic: r.topic, status: r.status, note: r.note, meanings: [] };
    if (!item.meanings.some((x) => x.id === m.id)) item.meanings.push({ id: m.id, text: m.text, ref: m.ref });
    reviewByTopic.set(r.topic, item);
  };
  const conditionExcluded: AiConditionExcluded[] = [];
  const evaluations = new Map<string, PowerConditionEvaluation>();
  const evaluate = (m: { id: string; condition?: string }): PowerConditionEvaluation | null => {
    if (!m.condition) return null;
    const cached = evaluations.get(m.id);
    if (cached) return cached;
    const ev = evaluatePowerCondition(m, ctx.power)!;
    evaluations.set(m.id, ev);
    return ev;
  };
  const addConditional = (m: ContextMeaning, stars: ZiweiStarName[], ev: PowerConditionEvaluation, reason?: string) => {
    if (referenceOnly.some((x) => x.id === m.id)) return;
    referenceOnly.push({
      id: m.id,
      status: "参考・条件未判定",
      reason: reason ?? `文中の条件（${m.condition}）を判定できないため、通常の材料に含めない。${ev.reason}`,
      stars,
      text: m.text,
      ref: m.ref,
      ...(m.condition ? { condition: m.condition } : {}),
      conditionEvaluation: ev,
    });
  };
  const addNotMet = (m: { id: string; text: string; ref: SourceRef; condition?: string }, ev: PowerConditionEvaluation, reason?: string) => {
    if (conditionExcluded.some((x) => x.id === m.id)) return;
    conditionExcluded.push({
      id: m.id,
      text: m.text,
      ref: m.ref,
      condition: m.condition ?? ev.condition,
      reason: reason ?? ev.reason,
      conditionEvaluation: ev,
    });
  };
  /** 条件付きの文の仕分け。成立なら判定結果を返し、不成立・判定不能なら振り分けて null */
  const routeConditional = (m: ContextMeaning, stars: ZiweiStarName[]): PowerConditionEvaluation | null | false => {
    const ev = evaluate(m);
    if (!ev) return null;
    if (ev.result === "met") return ev;
    if (ev.result === "notMet") addNotMet(m, ev);
    else addConditional(m, stars, ev);
    return false;
  };
  const addPartial = (c: ContextCombination) => {
    if (referenceOnly.some((x) => x.id === c.meaning.id)) return;
    referenceOnly.push({
      id: c.meaning.id,
      status: "参考・条件未充足",
      reason: "資料の文に列挙された星の一部だけが盤面にある。組み合わせが成立しているとは扱わない",
      stars: [...c.subjectStars, ...c.withStars],
      text: c.meaning.text,
      ref: c.meaning.ref,
      ...(c.meaning.condition ? { condition: c.meaning.condition } : {}),
      matchedStars: [...c.matchedSubjects, ...c.matchedPartners.map((p) => p.star)],
      unmatchedStars: [...c.unmatchedSubjects, ...c.unmatchedPartners],
    });
  };

  /** 資料差異 same・wording_difference の論点（同じ内容で言い回しだけ違う）。それ以外は null */
  const sameContentTopic = (m: ContextMeaning): string | null =>
    m.review && (m.review.status === "same" || m.review.status === "wording_difference") ? m.review.topic : null;

  /**
   * 同じ内容の重複なら代表の alsoIn に出典を残してまとめ、true を返す（文は統合しない）。
   * 重複とみなすのは、同じ資料の同じ文（別ファイルへの二重収録）と、同じ論点（same・wording_difference）の
   * 別資料の文だけ。同じ資料の別の文（長所と短所、性格と仕事など）は、似ていても別の内容として扱う。
   */
  const mergeIfDuplicate = (m: ContextMeaning): boolean => {
    const byTextRep = byText.get(m.textKey);
    const topic = sameContentTopic(m);
    const byTopicRep = topic ? byTopic.get(topic) : undefined;
    const rep = byTextRep ?? (byTopicRep && byTopicRep.ref.source !== m.ref.source ? byTopicRep : undefined);
    if (!rep) return false;
    if (rep.id !== m.id && !(rep.alsoIn ?? []).some((x) => x.id === m.id)) {
      rep.alsoIn = [...(rep.alsoIn ?? []), { id: m.id, ref: m.ref, ...(m.review ? { review: m.review } : {}) }];
      mergedCount += 1;
    }
    usedIds.add(m.id);
    return true;
  };

  /**
   * 候補を仕分ける。条件付き → 参考（C）、needs_review → reviewItems（C）、同内容の重複 → 代表の alsoIn（C）。
   * それ以外で record が true なら keyMeanings に rank で採用する。採用したら true。
   */
  const take = (c: Candidate, rank: AiMeaningRank, record = true): boolean => {
    const { m } = c;
    if (usedIds.has(m.id)) return false;
    if (m.review?.status === "needs_review") {
      addReview(m);
      return false;
    }
    const blocking = m.condition ? null : blockingPrevious(m);
    if (blocking) {
      routeBlocked(m, c.stars, blocking);
      usedIds.add(m.id);
      return false;
    }
    const ev = routeConditional(m, c.stars);
    if (ev === false) {
      usedIds.add(m.id);
      return false;
    }
    if (mergeIfDuplicate(m)) return false;
    if (!record) return false;
    const topic = sameContentTopic(m);
    const item: AiMeaning = {
      id: m.id,
      rank,
      ...(c.facet ? { facet: c.facet } : {}),
      priority: c.priority,
      kind: c.kind,
      stars: c.stars,
      text: m.text,
      ref: m.ref,
      textKey: m.textKey,
      opener: m.opener,
      continuesToNext: m.continuesToNext,
      mentionsStars: m.mentionsStars,
      mentionsPalaces: m.mentionsPalaces,
      sourceLength: m.sourceLength,
      ...(m.category ? { category: m.category } : {}),
      ...(m.review ? { review: m.review } : {}),
      ...(ev ? { conditionEvaluation: ev } : {}),
    };
    keyMeanings.push(item);
    usedIds.add(m.id);
    byText.set(m.textKey, item);
    if (topic && !byTopic.has(topic)) byTopic.set(topic, item);
    if (c.combination) {
      fullMatchCombinations.push({
        meaning: item,
        relation: c.combination.relation,
        subjectStars: c.combination.subjectStars,
        withStars: c.combination.withStars,
        matchedPartners: c.combination.matchedPartners,
        matchStatus: "full",
      });
    }
    return true;
  };

  /** 前文（接続語で受ける直前の文）が力量の条件付きで、条件が成立していない文（代表に選ばない） */
  const blockingPrevious = (m: ContextMeaning): { id: string; ev: PowerConditionEvaluation } | null => {
    for (const p of sentenceDependency(m)?.previous ?? []) {
      const ev = evaluate(p);
      if (ev && ev.result !== "met") return { id: p.id, ev };
    }
    return null;
  };
  const blockedByPrevious = (m: ContextMeaning): boolean => blockingPrevious(m) !== null;
  /** 前文の条件が成立していない主文を、前文と同じ扱い（不成立 → 除外、判定不能 → 参考）にする */
  const routeBlocked = (m: ContextMeaning, stars: ZiweiStarName[], b: { id: string; ev: PowerConditionEvaluation }) => {
    const why = `前文 ${b.id} の力量の条件が${b.ev.result === "notMet" ? "不成立" : "判定不能"}のため、前文と一緒に本文から外す（${b.ev.reason}）`;
    if (b.ev.result === "notMet") addNotMet(m, b.ev, why);
    else addConditional(m, stars, b.ev, why);
  };

  // ---------------------------------------------------------------------------
  // 候補の仕分け（星ごと）
  // ---------------------------------------------------------------------------

  const starCandidates = (s: ContextStar) => {
    const stars = [s.name] as ZiweiStarName[];
    const palaceItems = s.palaceMeanings.filter((m) => !EXCLUDED_STAR_PALACE_CATEGORIES.includes(m.category ?? ""));
    const excludedItems = s.palaceMeanings.filter((m) => EXCLUDED_STAR_PALACE_CATEGORIES.includes(m.category ?? ""));
    const hasCategory = palaceItems.some((m) => m.category !== undefined);

    // A: 星×宮。カテゴリのある記述（命宮）は、資料上の分類（カテゴリ・タグ）ごとに条件のない最初の文を代表に。
    //    カテゴリのない記述（命宮以外の星×宮）は全件。
    const aStarPalace: Candidate[] = [];
    const bStarPalace: Candidate[] = [];
    if (hasCategory) {
      const usable = palaceItems.filter((m) => !m.condition && m.review?.status !== "needs_review" && !blockedByPrevious(m));
      const facetOrder = [
        ...CATEGORY_ORDER.map((c) => `category:${c}`),
        ...[...new Set(usable.flatMap((m) => (m.tags ?? []).map((t) => `tag:${t}`)))],
        ...[...new Set(usable.flatMap((m) => (m.category ? [`category:${m.category}`] : [])))],
      ].filter((f, i, arr) => arr.indexOf(f) === i);
      const chosen = new Set<string>();
      for (const f of facetOrder) {
        if ([...chosen].some((id) => facetsOf(usable.find((m) => m.id === id)!).includes(f))) continue; // この分類は代表済み
        const rep = usable.find((m) => facetsOf(m).includes(f) && !chosen.has(m.id));
        if (!rep) continue;
        chosen.add(rep.id);
        aStarPalace.push({ m: rep, priority: 1, kind: "starPalace", stars, facet: f });
      }
      // B: 残りの星×宮を、カテゴリを巡る順（性格・能力職業・容貌…に偏らない）で
      const rest = palaceItems.filter((m) => !chosen.has(m.id));
      const byCategory = [
        ...CATEGORY_ORDER.map((c) => rest.filter((m) => m.category === c)),
        rest.filter((m) => !CATEGORY_ORDER.includes(m.category ?? "")),
      ];
      for (const m of interleave(byCategory)) bStarPalace.push({ m, priority: 1, kind: "starPalace", stars });
    } else {
      for (const m of palaceItems) aStarPalace.push({ m, priority: 1, kind: "starPalace", stars });
    }

    // 基本象意: 主星は先頭を A、残りを B。副星はすべて B（先頭から）
    const base = s.baseMeanings.map((m): Candidate => ({ m, priority: 2, kind: "starBase", stars }));
    const aBase = s.isMain ? base.slice(0, 1) : [];
    const bBase = s.isMain ? base.slice(1) : base;

    // 四化: この宮の記述を A、宮に依らない記述を B
    const aHua: Candidate[] = [];
    const bHua: Candidate[] = [];
    for (const t of s.transformationMeanings) {
      for (const m of t.meanings) {
        const c: Candidate = { m, priority: 4, kind: "transformation", stars: [t.kind, s.name] };
        (transformationPalaceOf(m.id) === ctx.palace.name ? aHua : bHua).push(c);
      }
    }
    return { aStarPalace, bStarPalace, aBase, bBase, aHua, bHua, excludedItems };
  };

  const perStar = ctx.stars.map((s) => ({ s, ...starCandidates(s) }));

  // 組み合わせ: 完全一致だけ候補。一部一致は参考（C）
  const comboCandidates = (list: ContextCombination[], priority: AiMeaningPriority, kind: AiMeaningKind): Candidate[] => {
    const out: Candidate[] = [];
    for (const c of list) {
      if (c.matchStatus !== "full") addPartial(c);
      else out.push({ m: c.meaning, priority, kind, stars: [...c.subjectStars, ...c.withStars], combination: c });
    }
    return out;
  };
  const sameCombos = comboCandidates(ctx.samePalaceCombinations, 3, "combination");
  const jiahuiCombos = comboCandidates(ctx.relatedMeanings, 5, "jiahui");

  const palaceItems = PALACE_CATEGORY_ORDER.flatMap((cat) => ctx.palaceMeanings.filter((m) => m.category === cat)).map(
    (m): Candidate => ({ m, priority: 6, kind: "palace", stars: [] }),
  );

  // ---------------------------------------------------------------------------
  // A: 必ず渡す（件数上限で削らない）
  // ---------------------------------------------------------------------------
  for (const p of perStar) for (const c of p.aStarPalace) take(c, "A");
  for (const p of perStar) for (const c of p.aBase) take(c, "A");
  for (const c of sameCombos) take(c, "A");
  for (const p of perStar) for (const c of p.aHua) take(c, "A");
  // 本宮に星がない宮は、宮そのものの象意がその宮の判断に直接関係する資料記述になるため先頭1件を A
  if (ctx.stars.length === 0 && palaceItems.length > 0) {
    const first = palaceItems.find((c) => !c.m.condition && c.m.review?.status !== "needs_review");
    if (first) take(first, "A");
  }

  // ---------------------------------------------------------------------------
  // B: 上限まで足す。種類が偏らないよう、加会 → 宮の象意1件 → 副星の基本象意 → 各星の星×宮の追加を星ごとに交互 →
  //    主星の基本象意の追加 → 宮の象意の残り → 四化の宮に依らない記述 → 副星の基本象意の追加 の順
  // ---------------------------------------------------------------------------
  const subBaseFirst = perStar.filter((p) => !p.s.isMain).flatMap((p) => p.bBase.slice(0, 1));
  const subBaseRest = perStar.filter((p) => !p.s.isMain).flatMap((p) => p.bBase.slice(1));
  const bOrder: Candidate[] = [
    ...jiahuiCombos,
    ...palaceItems.slice(0, 1),
    ...subBaseFirst,
    ...interleave(perStar.map((p) => p.bStarPalace)),
    ...interleave(perStar.filter((p) => p.s.isMain).map((p) => p.bBase)),
    ...palaceItems.slice(1),
    ...perStar.flatMap((p) => p.bHua),
    ...subBaseRest,
  ];
  const cap = targetRange[1];
  for (const c of bOrder) {
    // 上限に達した後も、条件付き・要確認・同内容の重複は失わないよう参考・要確認・alsoIn へ回す
    take(c, "B", keyMeanings.length < cap);
  }
  // 選別の候補にしない配合の文でも、条件付き・要確認の文は失わない
  for (const p of perStar) {
    for (const m of p.excludedItems) {
      if (usedIds.has(m.id)) continue;
      if (m.review?.status === "needs_review") addReview(m);
      else if (m.condition) routeConditional(m, [p.s.name]);
    }
  }

  // ---------------------------------------------------------------------------
  // 文脈: 前の文（または次の文）がないと意味が通らない主文に、同じ資料・同じ節の前後の文を付ける。
  //   採用件数の上限とは別枠（上限のために文脈だけが落ちることはない）。文は結合・書き換えしない。
  //   同じ文は contextSentences に1回だけ持ち、複数の主文から参照する。keyMeanings にある文は重ねない。
  // ---------------------------------------------------------------------------
  // 前文依存（接続語）に加え、力量の条件付きの文で前の文を受ける語句（refersBack）があるものは直前の文を前文にする
  const dependencyOf = (m: AiMeaning) => {
    const dep = sentenceDependency(m);
    if (dep || !m.conditionEvaluation?.refersBack) return dep;
    const prev = previousInSection(m);
    return prev ? { previous: [prev], next: [], reason: `本文が「${m.conditionEvaluation.refersBack}」で直前の文を受ける` } : null;
  };
  // 前文が力量の条件付きなら、前文の条件が成立したときだけ主文を残す（不成立 → 除外、判定不能 → 参考）。
  // 前文が採用済み（keyMeanings）なら成立済み。後続文だけが本文に出ることを防ぐ
  for (let changed = true; changed; ) {
    changed = false;
    const ids = new Set(keyMeanings.map((m) => m.id));
    for (const m of [...keyMeanings]) {
      const dep = dependencyOf(m);
      for (const s of dep?.previous ?? []) {
        if (ids.has(s.id)) continue;
        const ev = evaluate(s);
        if (!ev || ev.result === "met") continue;
        const why = `前文 ${s.id} の力量の条件が${ev.result === "notMet" ? "不成立" : "判定不能"}のため、前文と一緒に本文から外す（${ev.reason}）`;
        const cm = { ...m, text: m.text };
        if (ev.result === "notMet") addNotMet(cm, ev, why);
        else addConditional(cm as ContextMeaning, m.stars, ev, why);
        keyMeanings.splice(keyMeanings.indexOf(m), 1);
        const ci = fullMatchCombinations.findIndex((c) => c.meaning.id === m.id);
        if (ci >= 0) fullMatchCombinations.splice(ci, 1);
        changed = true;
        break;
      }
    }
  }

  const keyIds = new Set(keyMeanings.map((m) => m.id));
  const contextById = new Map<string, AiContextSentence>();
  let meaningsWithContextCount = 0;
  for (const m of keyMeanings) {
    const dep = dependencyOf(m);
    if (!dep) continue;
    meaningsWithContextCount += 1;
    for (const s of [...dep.previous, ...dep.next]) {
      if (keyIds.has(s.id)) continue;
      const entry: AiContextSentence = contextById.get(s.id) ?? {
        id: s.id,
        text: s.text ?? "",
        ref: s.ref,
        textKey: s.textKey,
        opener: s.opener,
        continuesToNext: s.continuesToNext,
        mentionsStars: s.mentionsStars,
        mentionsPalaces: s.mentionsPalaces,
        sourceLength: s.sourceLength,
        ...(s.condition ? { condition: s.condition, conditionEvaluation: evaluate(s)! } : {}),
        ...(REVIEW_BY_ID.has(s.id) ? { review: REVIEW_BY_ID.get(s.id) } : {}),
        referencedBy: [],
      };
      if (!entry.referencedBy.includes(m.id)) entry.referencedBy.push(m.id);
      contextById.set(s.id, entry);
    }
    m.context = { previous: dep.previous.map((s) => s.id), next: dep.next.map((s) => s.id), reason: dep.reason };
  }
  const contextSentences = [...contextById.values()];

  // 身宮などの needs_review（全件コンテキストの reviewNotes）。身宮の意味は一本化せずそのまま載せる
  for (const r of ctx.reviewNotes) {
    const item = reviewByTopic.get(r.topic) ?? { topic: r.topic, status: r.status, note: r.note, meanings: [] };
    if (r.topic === "身宮") {
      for (const m of ctx.shenPalaceMeanings) {
        if (!item.meanings.some((x) => x.id === m.id)) item.meanings.push({ id: m.id, text: m.text, ref: m.ref });
      }
    }
    reviewByTopic.set(r.topic, item);
  }
  const reviewItems = [...reviewByTopic.values()];

  // 件数
  const allIds = new Set<string>([
    ...ctx.palaceMeanings.map((m) => m.id),
    ...ctx.shenPalaceMeanings.map((m) => m.id),
    ...ctx.stars.flatMap((s) => [
      ...s.baseMeanings.map((m) => m.id),
      ...s.palaceMeanings.map((m) => m.id),
      ...s.transformationMeanings.flatMap((t) => t.meanings.map((m) => m.id)),
    ]),
    ...ctx.samePalaceCombinations.map((c) => c.meaning.id),
    ...ctx.relatedMeanings.map((c) => c.meaning.id),
  ]);
  const sourceMeaningCount = allIds.size;
  const rankRank = { A: 0, B: 1 } as const;
  const sorted = [...keyMeanings].sort((a, b) => rankRank[a.rank] - rankRank[b.rank] || a.priority - b.priority);
  const rankA = keyMeanings.filter((m) => m.rank === "A").length;
  const rankB = keyMeanings.length - rankA;
  const rankC = referenceOnly.length + reviewItems.reduce((n, r) => n + r.meanings.length, 0) + mergedCount;

  const sourceKey = (r: SourceRef) => `${r.source}|${r.pdfPage}|${r.section}`;
  const refs: SourceRef[] = [
    ...keyMeanings.flatMap((m) => [m.ref, ...(m.alsoIn ?? []).map((x) => x.ref)]),
    ...contextSentences.map((s) => s.ref),
    ...reviewItems.flatMap((r) => r.meanings.map((m) => m.ref)),
  ];
  const sources = [...new Map(refs.map((r) => [sourceKey(r), r])).values()];

  return {
    palace: ctx.palace,
    detailLevel,
    keyMeanings: sorted,
    stars: ctx.stars.map((s) => ({
      name: s.name,
      strength: s.strength,
      transformations: s.transformations,
      isMain: s.isMain,
      selectedMeaningIds: sorted
        .filter((m) => (m.kind === "starPalace" || m.kind === "starBase" || m.kind === "transformation") && m.stars.includes(s.name))
        .map((m) => m.id),
    })),
    fullMatchCombinations,
    sanfangSizheng: ctx.sanfang,
    reviewItems,
    referenceOnly,
    conditionExcluded,
    contextSentences,
    counts: {
      attachedContextCount: contextSentences.length,
      meaningsWithContextCount,
      rank: { A: rankA, B: rankB, C: rankC },
      targetRange: [targetRange[0], targetRange[1]],
      sourceMeaningCount,
      selectedMeaningCount: keyMeanings.length,
      mergedCount,
      referenceCount: referenceOnly.length,
      powerConditions: {
        met: [...evaluations.values()].filter((e) => e.result === "met").length,
        notMet: [...evaluations.values()].filter((e) => e.result === "notMet").length,
        undetermined: [...evaluations.values()].filter((e) => e.result === "undetermined").length,
      },
      omittedCount: sourceMeaningCount - keyMeanings.length,
    },
    notes: [
      ...ctx.notes,
      `detailLevel: ${detailLevel}（採用件数の目安 ${targetRange[0]}〜${targetRange[1]} 件。A は目安を超えても削らない）。`,
      "組み合わせは完全一致（matchStatus: full）だけを採用。一部一致は referenceOnly（参考・条件未充足）で、成立しているとは扱わない。",
      "力量の条件付きの文は命宮の運命指数・星の力量で判定する（§22.6）。成立 → 通常の候補、不成立 → conditionExcluded、判定不能（資料に基準がない・力量以外の条件がある）→ referenceOnly（参考・条件未判定）。",
      "資料にない内容を補完しない。keyMeanings の文と出典だけを根拠にする。",
      "前の文（次の文）を受ける主文には、同じ資料・同じ節の前後の文を context で付ける（contextSentences。採用件数とは別枠。文は結合しない）。",
    ],
    sources,
  };
}
