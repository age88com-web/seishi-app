// src/lib/ziwei/meanings/context.ts
//
// 宮をクリックしたときに、その宮に関係する資料由来の象意だけを1つの構造体にまとめる。
// docs/ziwei-basic-spec.md §21.9。入口は buildPalaceMeaningContext(chart, branch) だけ。
//
// 方針:
//   - 象意データ（data/*.json）の文と出典をそのまま使う。言い換え・要約・補完・吉凶判定はしない。
//   - 星名は象意データ側で作盤エンジンの星名（PlacedStar・四化）に正規化済み（資料の「羊星」「敬羊星」も擎羊星）。
//   - 組み合わせは入門の「命宮における判断」の節の文（全件 palace: 命宮）なので、命宮をクリックしたときだけ使う。
//     節の対象星が本宮にあり、文に列挙された相手の星が1つ以上、同宮なら本宮に、加会なら対宮・三合宮に
//     ある文だけを取り出す（加会＝対宮または三合宮にあること。基礎編 S16）。列挙された相手の一部だけが
//     そろう場合は partialMatch として区別する（全員そろう意味か、いずれかの意味かは原文による）。
//   - 旺衰別の象意・星×四化の象意は資料にないため常に空（§21.6）。

import type {
  Branch,
  PalaceName,
  PlacedStar,
  TransformationKind,
  ZiweiChart,
} from "../types";
import { MAIN_STARS } from "../data";
import { starStrengthOf } from "../strength";
import { sanfangSizheng } from "../sanfang";
import { calculateChartPower } from "../power";
import type { PowerSnapshot } from "./powerCondition";
import {
  COMBINATION_MEANINGS,
  MEANINGS_META,
  STAR_MEANINGS,
  TRANSFORMATION_MEANINGS,
  getPalaceMeanings,
  getStarPalaceMeanings,
} from "./store";
import type {
  CombinationMeaning,
  ContextCombination,
  ContextMeaning,
  ContextPalaceSummary,
  ContextStar,
  ContextStarRef,
  MeaningBase,
  MeaningReview,
  PalaceMeaningContext,
  SanfangRole,
  SourceRef,
  ZiweiStarName,
} from "./types";

const MAIN_SET = new Set<PlacedStar>(MAIN_STARS);

/** entryId → 資料差異 */
const REVIEW_BY_ID = new Map<string, MeaningReview>();
for (const d of MEANINGS_META.sourceDifferences) {
  for (const id of d.entryIds)
    REVIEW_BY_ID.set(id, { status: d.status, topic: d.topic, note: d.note });
}
const SHEN_PALACE_REVIEW = MEANINGS_META.sourceDifferences.find(
  (d) => d.topic === "身宮",
);

/** 組み合わせデータにも同じ文がある星・四化の記述（盤面の星がそろうときだけ組み合わせとして出す） */
const COMBINATION_TEXTS = new Set(COMBINATION_MEANINGS.map((c) => c.textKey));

function toContextMeaning(
  e: MeaningBase & { category?: string },
): ContextMeaning {
  const out: ContextMeaning = {
    id: e.id,
    text: e.text,
    ref: e.ref,
    textKey: e.textKey,
    opener: e.opener,
    continuesToNext: e.continuesToNext,
    mentionsStars: e.mentionsStars,
    mentionsPalaces: e.mentionsPalaces,
    sourceLength: e.sourceLength,
  };
  if (e.category !== undefined) out.category = e.category;
  if (e.tags && e.tags.length > 0) out.tags = e.tags;
  if (e.condition) out.condition = e.condition;
  if (e.note) out.note = e.note;
  const review = REVIEW_BY_ID.get(e.id);
  if (review) out.review = review;
  return out;
}

/**
 * 重複の整理。同じ ID は1件にする。同じ資料の同じ文が別ファイルにも収録されている場合は1件にまとめ、
 * まとめた ID を mergedIds に残す。資料差異が same の組も1件にまとめる。
 * 出典（資料）が違う文は、wording_difference・additional・needs_review を含めてすべて残す。
 */
function dedupe(items: ContextMeaning[]): ContextMeaning[] {
  const out: ContextMeaning[] = [];
  const byKey = new Map<string, ContextMeaning>();
  for (const item of items) {
    const sameTopic =
      item.review?.status === "same" ? `same|${item.review.topic}` : null;
    const keys = [
      `id|${item.id}`,
      `text|${item.textKey}`,
      ...(sameTopic ? [sameTopic] : []),
    ];
    const hit = keys.map((k) => byKey.get(k)).find((x) => x !== undefined);
    if (hit) {
      if (hit.id !== item.id && !(hit.mergedIds ?? []).includes(item.id))
        hit.mergedIds = [...(hit.mergedIds ?? []), item.id];
      continue;
    }
    const copy = { ...item };
    out.push(copy);
    for (const k of keys) byKey.set(k, copy);
  }
  return out;
}

function starRefsIn(chart: ZiweiChart, branch: Branch): ContextStarRef[] {
  const palace = chart.palaces.find((p) => p.branch === branch)!;
  return palace.stars.map((name) => ({
    name,
    strength: starStrengthOf(name, branch),
    transformations: chart.transformations
      .filter((t) => t.star === name)
      .map((t) => t.kind),
  }));
}

function palaceSummary(
  chart: ZiweiChart,
  branch: Branch,
  role: SanfangRole,
): ContextPalaceSummary {
  const palace = chart.palaces.find((p) => p.branch === branch)!;
  return { role, name: palace.name, branch, stars: starRefsIn(chart, branch) };
}

/** 宮にある星と四化の名前（四化は付いている星の宮にあるものとして扱う） */
function namesIn(summary: ContextPalaceSummary): ZiweiStarName[] {
  return summary.stars.flatMap((s) => [
    s.name as ZiweiStarName,
    ...s.transformations,
  ]);
}

function starMeaningsFor(
  star: PlacedStar,
  palace: PalaceName,
): Pick<ContextStar, "baseMeanings" | "palaceMeanings"> {
  const own = STAR_MEANINGS.filter((e) => e.stars.includes(star));
  const baseMeanings = own.filter(
    (e) =>
      e.category === "image" ||
      (e.category === "basic" && (e.palace ?? null) === null),
  );
  // この宮の記述。命宮は「命宮における判断」、他の宮は星×宮（星の節の本文にある他宮の記述も含む）。
  // 組み合わせデータにも同じ文がある記述は、相手の星がそろうときだけ組み合わせとして出す。
  const inPalace = own.filter(
    (e) =>
      e.palace === palace &&
      !COMBINATION_TEXTS.has(e.textKey),
  );
  const starPalace =
    palace === "命宮" ? [] : getStarPalaceMeanings(star, palace);
  return {
    baseMeanings: dedupe(baseMeanings.map(toContextMeaning)),
    palaceMeanings: dedupe([...inPalace, ...starPalace].map(toContextMeaning)),
  };
}

function transformationMeaningsFor(
  kind: TransformationKind,
  palace: PalaceName,
): ContextMeaning[] {
  const list = TRANSFORMATION_MEANINGS.filter(
    (e) =>
      e.stars.includes(kind) &&
      ((e.palace ?? null) === null || e.palace === palace) &&
      !COMBINATION_TEXTS.has(e.textKey),
  );
  return dedupe(list.map(toContextMeaning));
}

function matchCombination(
  c: CombinationMeaning,
  self: ContextPalaceSummary,
  partnersBy: { summary: ContextPalaceSummary; allowed: boolean }[],
): ContextCombination | null {
  const selfNames = namesIn(self);
  const matchedSubjects = c.subjectStars.filter((s) => selfNames.includes(s));
  if (matchedSubjects.length === 0) return null;
  const matchedPartners: ContextCombination["matchedPartners"] = [];
  for (const star of c.withStars) {
    for (const { summary, allowed } of partnersBy) {
      if (allowed && namesIn(summary).includes(star))
        matchedPartners.push({
          star,
          role: summary.role,
          branch: summary.branch,
        });
    }
  }
  if (matchedPartners.length === 0) return null;
  const found = new Set(matchedPartners.map((p) => p.star));
  const unmatchedPartners = c.withStars.filter((s) => !found.has(s));
  const unmatchedSubjects = c.subjectStars.filter(
    (s) => !matchedSubjects.includes(s),
  );
  // full: 文に列挙された対象星・相手の星がすべて盤面の所定の位置にある
  const full = unmatchedSubjects.length === 0 && unmatchedPartners.length === 0;
  return {
    meaning: toContextMeaning(c),
    relation: c.relation,
    subjectStars: c.subjectStars,
    withStars: c.withStars,
    matchedSubjects,
    unmatchedSubjects,
    matchedPartners,
    unmatchedPartners,
    matchStatus: full ? "full" : "partial",
    partialMatch: !full,
  };
}

/**
 * クリックした宮の象意コンテキスト。chart は calculateZiweiChart() の結果、branch は宮の地支。
 * 返り値は資料由来の文と出典だけで構成され、そのまま表示・AI への受け渡しに使える。
 */
export function buildPalaceMeaningContext(
  chart: ZiweiChart,
  branch: Branch,
): PalaceMeaningContext {
  const palace = chart.palaces.find((p) => p.branch === branch);
  if (!palace) throw new RangeError(`宮が見つかりません: ${branch}`);

  const sf = sanfangSizheng(branch);
  const self = palaceSummary(chart, branch, "本宮");
  const opposite = palaceSummary(chart, sf.opposite, "対宮");
  const trines: [ContextPalaceSummary, ContextPalaceSummary] = [
    palaceSummary(chart, sf.trines[0], "三合"),
    palaceSummary(chart, sf.trines[1], "三合"),
  ];

  const stars: ContextStar[] = self.stars.map((s) => ({
    ...s,
    isMain: MAIN_SET.has(s.name),
    ...starMeaningsFor(s.name, palace.name),
    strengthMeanings: [],
    transformationMeanings: s.transformations.map((kind) => ({
      kind,
      meanings: transformationMeaningsFor(kind, palace.name),
    })),
    starTransformationMeanings: [],
  }));

  // 組み合わせ（入門「命宮における判断」の文だけ。命宮のときに限る）
  const samePalaceCombinations: ContextCombination[] = [];
  const relatedMeanings: ContextCombination[] = [];
  if (palace.name === "命宮") {
    for (const c of COMBINATION_MEANINGS) {
      if ((c.palace ?? null) !== null && c.palace !== palace.name) continue;
      const allowJiahui = c.relation !== "同宮"; // 「同宮・加会」
      const same = matchCombination(c, self, [
        { summary: self, allowed: true },
      ]);
      if (same) {
        // 同宮で1つ以上そろう文。加会の相手も盤面にあれば併記する
        if (allowJiahui) {
          const all = matchCombination(c, self, [
            { summary: self, allowed: true },
            { summary: opposite, allowed: true },
            { summary: trines[0], allowed: true },
            { summary: trines[1], allowed: true },
          ])!;
          samePalaceCombinations.push(all);
        } else {
          samePalaceCombinations.push(same);
        }
        continue;
      }
      if (!allowJiahui) continue;
      const jiahui = matchCombination(c, self, [
        { summary: opposite, allowed: true },
        { summary: trines[0], allowed: true },
        { summary: trines[1], allowed: true },
      ]);
      if (jiahui) relatedMeanings.push(jiahui);
    }
  }

  const palaceMeanings = dedupe(
    getPalaceMeanings(palace.name).map(toContextMeaning),
  );
  const shenPalaceMeanings = palace.isShenPalace
    ? dedupe(getPalaceMeanings("身宮").map(toContextMeaning))
    : [];

  const reviewNotes: MeaningReview[] = [];
  if (palace.isShenPalace && SHEN_PALACE_REVIEW) {
    reviewNotes.push({
      status: SHEN_PALACE_REVIEW.status,
      topic: SHEN_PALACE_REVIEW.topic,
      note: SHEN_PALACE_REVIEW.note,
    });
  }

  const all: ContextMeaning[] = [
    ...palaceMeanings,
    ...shenPalaceMeanings,
    ...stars.flatMap((s) => [
      ...s.baseMeanings,
      ...s.palaceMeanings,
      ...s.transformationMeanings.flatMap((t) => t.meanings),
    ]),
    ...samePalaceCombinations.map((c) => c.meaning),
    ...relatedMeanings.map((c) => c.meaning),
  ];
  for (const m of all) {
    if (
      m.review &&
      m.review.status === "needs_review" &&
      !reviewNotes.some((r) => r.topic === m.review!.topic)
    ) {
      reviewNotes.push(m.review);
    }
  }
  const sourceKey = (r: SourceRef) => `${r.source}|${r.pdfPage}|${r.section}`;
  const sources = [
    ...new Map(all.map((m) => [sourceKey(m.ref), m.ref])).values(),
  ];

  const notes = [
    "旺衰による象意の違いは資料に記述がないため、strengthMeanings は空（§21.6）。",
    "星×四化（特定の星に四化が付いたとき）の象意は資料に記述がないため、starTransformationMeanings は空（§21.6）。",
  ];
  if (palace.name !== "命宮") {
    notes.push(
      "組み合わせの記述は入門「命宮における判断」の文だけのため、命宮以外では組み合わせを取得しない。",
    );
  }

  return {
    palace: { name: palace.name, branch, isShenPalace: palace.isShenPalace },
    palaceMeanings,
    shenPalaceMeanings,
    stars,
    samePalaceCombinations,
    sanfang: { self, opposite, trines },
    relatedMeanings,
    reviewNotes,
    notes,
    sources,
    power: powerSnapshotOf(chart, branch),
  };
}

/** 条件付きの文の判定に使う力量（§22）。命宮の運命指数と、盤面の星（四化を除く）の力量 */
function powerSnapshotOf(chart: ZiweiChart, branch: Branch): PowerSnapshot & { palace: ReturnType<typeof calculateChartPower>["palaces"][number] } {
  const power = calculateChartPower(chart);
  const ming = power.byBranch[chart.mingPalace];
  const starPower: PowerSnapshot["starPower"] = {};
  for (const p of power.palaces) {
    for (const e of p.stars) if (!e.attachedTo) starPower[e.star] = { branch: e.branch, power: e.finalPower };
  }
  return {
    mingPalace: { branch: ming.branch, index: ming.index, grade: ming.grade },
    starPower,
    palace: power.byBranch[branch],
  };
}
