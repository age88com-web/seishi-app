// src/lib/ziwei/meanings/ruleInterpretation.ts
//
// アプリ内・資料ベースの宮別解釈（AI を使わない決定論的な文章生成）。docs/ziwei-basic-spec.md §21.12。
// 入口: buildRuleBasedInterpretation(ctx, { detailLevel })。ctx は buildPalaceMeaningContext() の結果。
//
// 方針:
//   - 使う文は buildAiMeaningContext() が選別した資料（A・B）だけ。表示文はデータの独自文章（§35。資料の意味の範囲で
//     書き直したもの）をそのまま使い、ここでは書き換えない。
//     参考（一部一致・条件未判定）・needs_review は本文に入れない（referenceOnly・reviewItems に保持）。
//   - 文章は固定の組み立てルールだけで作る（乱数・AI・外部サービスなし。同じ入力なら同じ文章）。
//     資料の文に付け足してよいのは、次の固定の前置きだけ（意味を足さない）:
//       「また、」… 同じテーマの2つ目以降のまとまり・同じ星の2文目以降（文頭が接続語で始まる文には付けない）
//       「一方で、」… 短所・注意のテーマの最初の文
//       「{星名}については、」… 星のまとまりの最初の文に星名が無いとき（どの星の記述かを示すため）
//       「{宮名}は、」… 宮そのものの意味の文に宮名が無いとき
//   - テーマは資料データにある分類（カテゴリ・タグ・資料の種類）だけで決める。分類できないものは「その他」。
//   - 同じテーマの中は星ごとのまとまりにし、まとまりの中は資料の並び順（同じ星の文が続くので、主語の無い
//     補足文も元の星の記述として読める）。
//   - 前文依存の文（context）は前文の直後に置く。前文が採用されていなければ補助文として前文も載せる
//     （補助文は主文の理解のためで、独立した象意として数えない）。前文が要確認なら、主文を本文に入れない。
//   - 力量の条件付きの文（§22.6）: 条件が成立した文だけを本文に使う（選別は aiContext）。前文が条件付きなら、
//     前文の条件が成立したときだけ前文（補助文）と主文を一緒に使う。不成立・判定不能なら両方とも本文に入れない。
//   - 文字数の目安（brief 200〜300・standard 500〜800・detailed 1000〜1500）: A はすべて使う（目安を超えても削らない）。
//     B は目安の上限を超えない範囲で、優先順位の順に足す。資料が少なければ短くてよい。資料外の文で埋めない。
//     目安の判定は原文の文字数（凍結メタデータ sourceLength）で数える（表示文を書き直しても選ばれる文は変わらない）。
//   - 前置きの判定（接続語で始まるか・星名・宮名を含むか）も原文の凍結メタデータ（opener・mentionsStars・
//     mentionsPalaces）で行う（§35）。
//   - 各文に「判断根拠」（対象の星・宮・旺衰・力量の条件・同宮・加会・四化から作る短い説明）を付ける。資料の原文は出さない。

import { buildAiMeaningContext } from "./aiContext";
import { AI_SUMMARY_LENGTH } from "./aiSummary";
import { COMBINATION_MEANINGS, PALACE_MEANINGS, STAR_MEANINGS, STAR_PALACE_MEANINGS, TRANSFORMATION_MEANINGS } from "./store";
import type {
  AiDetailLevel,
  AiMeaning,
  AiMeaningContext,
  AiConditionExcluded,
  AiReferenceMeaning,
  AiReviewItem,
  MeaningBase,
  PalaceMeaningContext,
  PowerConditionEvaluation,
  SourceRef,
  ZiweiStarName,
} from "./types";

/** テーマ（表示順）。資料データの分類から決まるものだけ */
export const INTERPRETATION_THEMES = [
  "この宮が表すもの",
  "星の性質",
  "性格・人物像",
  "能力・仕事",
  "財",
  "対人関係",
  "家族・親族",
  "健康",
  "容貌・態度",
  "星の組み合わせ（同宮）",
  "三方四正（加会）",
  "四化",
  "短所・注意",
  "その他",
] as const;
export type InterpretationTheme = (typeof INTERPRETATION_THEMES)[number];

/** 資料の文に付けてよい前置き（固定）。{star}・{palace} は星名・宮名 */
export const ALLOWED_PREFIXES = ["また、", "一方で、", "{star}については、", "{palace}は、"] as const;

/** 文頭がこれで始まる文には「また、」を重ねない */
const CONNECTIVE_OPENERS = [
  "また", "いずれにせよ", "そのため", "したがって", "しかし", "この場合", "このように", "前述のように", "これにより",
  "一方で", "さらに", "ただし", "と言っても", "ですから", "それゆえ", "そこで", "なお", "とはいえ", "ところが", "そして",
];

export interface InterpretationSentence {
  /** 表示する文（前置き＋データの表示文） */
  text: string;
  /** 付けた前置き（無ければ空文字）。ALLOWED_PREFIXES のどれかに星名・宮名を入れたものを連ねたもの */
  prefix: string;
  /** 判断根拠（対象の星・宮・旺衰・力量の条件などから作った説明。資料の原文ではない） */
  basis: string;
  /** 文字数の目安に使う長さ（前置き＋原文の文字数。凍結メタデータ） */
  budgetLength: number;
  /** この文の根拠の元データ ID（必ず1つ以上） */
  sourceIds: string[];
  /** 根拠の資料の出典（資料名・ページ・見出し） */
  ref: SourceRef;
  /** primary … 解釈の本文、context … 直後の主文を理解するための前文（独立した象意ではない） */
  role: "primary" | "context";
  rank: "A" | "B" | null;
  /** 主文に付随する前後の文の ID（主文のとき） */
  contextIds?: string[];
}

export interface InterpretationSection {
  theme: InterpretationTheme;
  text: string;
  sentences: InterpretationSentence[];
  sourceIds: string[];
  /** 節の判断根拠（文の判断根拠を重複なく並べたもの） */
  basis: string[];
}

export interface RuleBasedInterpretation {
  palace: AiMeaningContext["palace"];
  detailLevel: AiDetailLevel;
  sections: InterpretationSection[];
  /** 節の文章を空行でつないだもの */
  fullText: string;
  /** 本文に入れなかった採用資料と理由（前文が条件付きなど） */
  excluded: { id: string; reason: string }[];
  /** 力量の条件が不成立で本文から外した文（前文の不成立で一緒に外した主文を含む） */
  conditionExcluded: AiConditionExcluded[];
  /** AI 用選別の参考（一部一致・条件未判定）。本文には使わない */
  referenceOnly: AiReferenceMeaning[];
  /** 要確認（needs_review）。本文には使わない */
  reviewItems: AiReviewItem[];
  /** 本文で使った資料の出典（重複なし） */
  sources: SourceRef[];
  counts: {
    /** 空白を除いた本文の文字数 */
    charCount: number;
    /** 文字数の目安の判定に使った長さ（前置き＋原文の文字数。§35） */
    budgetCharCount: number;
    lengthTarget: readonly [number, number];
    /** 本文の根拠として使った元データ ID（主文・補助文） */
    usedSourceIds: number;
    primarySentences: number;
    contextSentences: number;
    rankA: number;
    rankB: number;
    /** この宮の力量の条件付きの文の判定件数（aiContext と同じ） */
    powerConditions: { met: number; notMet: number; undetermined: number };
    /** 本文に入った、力量の条件が成立した文（主文・前文）の ID */
    conditionMetInBody: string[];
  };
}

/** 元データ（タグ・カテゴリ・条件の参照用） */
const ENTRY_BY_ID = new Map<string, MeaningBase & { category?: string; tags?: string[] }>(
  [...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS, ...PALACE_MEANINGS, ...STAR_PALACE_MEANINGS, ...COMBINATION_MEANINGS].map((e) => [
    e.id,
    e,
  ]),
);

/** 資料データの分類からテーマを決める（無ければ「その他」） */
export function themeOf(m: Pick<AiMeaning, "id" | "kind" | "category">): InterpretationTheme {
  if (m.kind === "palace") return "この宮が表すもの";
  if (m.kind === "starBase") return "星の性質";
  if (m.kind === "combination") return "星の組み合わせ（同宮）";
  if (m.kind === "jiahui") return "三方四正（加会）";
  if (m.kind === "transformation") return "四化";
  const tags = ENTRY_BY_ID.get(m.id)?.tags ?? [];
  const category = m.category ?? ENTRY_BY_ID.get(m.id)?.category;
  if (tags.includes("weakness") || tags.includes("caution")) return "短所・注意";
  if (category === "appearance" || tags.includes("appearance")) return "容貌・態度";
  if (category === "career" || tags.includes("career")) return "能力・仕事";
  if (tags.includes("wealth")) return "財";
  if (tags.includes("relationship")) return "対人関係";
  if (tags.includes("family")) return "家族・親族";
  if (tags.includes("health")) return "健康";
  if (category === "basic" || tags.includes("personality")) return "性格・人物像";
  return "その他";
}

/** 原文の書き出しが接続語か（凍結メタデータ） */
const startsWithConnective = (m: { opener: string | null }) => m.opener !== null && CONNECTIVE_OPENERS.includes(m.opener);
/** 原文が星を名指ししているか（「文昌星・文曲星」「羊星・陀羅星」のような節名の並記も含む。凍結メタデータ） */
const namesStar = (m: { mentionsStars: ZiweiStarName[] }, star: ZiweiStarName) => m.mentionsStars.includes(star);
/** 表示文が接続語で始まるか（表示の前置き用） */
const textStartsWithConnective = (t: string) => [...CONNECTIVE_OPENERS, "ただ", "一方"].some((w) => t.startsWith(w));
/** 表示文が星を名指ししているか（表示の前置き用） */
// 表示文が別の宮・星を名指ししている（「命宮の様子を軸に…」「太陰星は…」）。宮名の前置きを重ねない
const textHasOwnSubject = (t: string) => /[一-龥]宮|星/.test(t);
const textNamesStar = (t: string, star: ZiweiStarName) => t.includes(star) || (star === "擎羊星" && t.includes("羊星"));

const ROLE_LABEL: Record<string, string> = { 本宮: "同じ宮", 対宮: "対宮", 三合: "三合宮" };
const KIND_BASIS: Record<AiMeaning["kind"], string> = {
  palace: "宮そのものの意味",
  starBase: "星の基本的な性質",
  starPalace: "星がこの宮に入ったときの意味",
  combination: "同じ宮にある星の組み合わせの意味",
  transformation: "四化の意味",
  jiahui: "三方四正から加会する星の組み合わせの意味",
};

/** 力量の条件の成立内容（判定に使った数値だけ。資料の文言は使わない） */
function conditionBasis(ev: PowerConditionEvaluation | undefined): string {
  if (!ev || ev.result !== "met") return "";
  const parts = ev.terms
    .filter((t) => t.result === "met")
    .map((t) => {
      if (t.term.kind === "palacePower") {
        const want = t.term.test === "strong" ? "強い" : t.term.test === "weak" ? "弱い" : "弱くない";
        return `命宮の力量が「${want}」場合に当たる（${t.detail.replace(/→.*$/, "").trim()}）`;
      }
      if (t.term.kind === "starPower") return `${t.term.star}の力量の条件に当たる（${t.detail.replace(/→.*$/, "").trim()}）`;
      return "";
    })
    .filter(Boolean);
  return parts.length ? `${parts.join("。")}ため、その場合の解釈を反映しています。` : "";
}

interface Unit {
  /** まとまりの星（星×宮・基本象意）。宮の意味・組み合わせ・加会・四化は null */
  star: ZiweiStarName | null;
  items: AiMeaning[];
}

export function buildRuleBasedInterpretation(
  ctx: PalaceMeaningContext,
  options: { detailLevel?: AiDetailLevel } = {},
): RuleBasedInterpretation {
  const detailLevel = options.detailLevel ?? "standard";
  const ai = buildAiMeaningContext(ctx, { detailLevel });
  const lengthTarget = AI_SUMMARY_LENGTH[detailLevel];
  const palaceName = ai.palace.name;

  const keyById = new Map(ai.keyMeanings.map((m) => [m.id, m]));
  const ctxById = new Map(ai.contextSentences.map((s) => [s.id, s]));
  const excluded: RuleBasedInterpretation["excluded"] = [];

  // 判断根拠（盤面の構造と、条件の判定に使った数値から作る）
  const starInfo = new Map(ai.stars.map((s) => [s.name as ZiweiStarName, s]));
  const comboById = new Map(ai.fullMatchCombinations.map((c) => [c.meaning.id, c]));
  const starLabel = (name: ZiweiStarName) => {
    const s = starInfo.get(name);
    return s?.strength ? `${name}（旺衰「${s.strength}」）` : name;
  };
  const basisOf = (m: AiMeaning): string => {
    const where = `${palaceName}（${ai.palace.branch}）`;
    let head: string;
    if (m.kind === "palace") head = `${where}が表す事柄を見る解釈です。`;
    else if (m.kind === "starBase") head = `${m.stars.map(starLabel).join("・")}が${where}にあるため、${KIND_BASIS.starBase}を反映しています。`;
    else if (m.kind === "starPalace") head = `${m.stars.map(starLabel).join("・")}が${where}に入っているため、${KIND_BASIS.starPalace}を反映しています。`;
    else if (m.kind === "transformation") {
      const holders = ai.stars.filter((s) => s.transformations.some((k) => m.stars.includes(k)));
      const hua = m.stars.filter((x) => x.startsWith("化")).join("・");
      head = `${holders.length ? `${holders.map((s) => s.name).join("・")}に` : `${where}に`}${hua}が付いているため、${KIND_BASIS.transformation}を反映しています。`;
    } else {
      const c = comboById.get(m.id);
      const partners = c
        ? c.matchedPartners.map((x) => `${x.star}（${ROLE_LABEL[x.role] ?? x.role}・${x.branch}）`).join("・")
        : m.stars.join("・");
      head =
        m.kind === "combination"
          ? `${where}で${c ? c.subjectStars.filter((x) => m.stars.includes(x)).join("・") : ""}と${partners}が同宮しているため、${KIND_BASIS.combination}を反映しています。`
          : `${where}の三方四正で${partners}が加会しているため、${KIND_BASIS.jiahui}を反映しています。`;
    }
    return `${head}${conditionBasis(m.conditionEvaluation)}`;
  };

  // 前文依存の文: 前文が本文に使えない（条件付き・要確認・未保持）なら本文に入れない
  const usable = (m: AiMeaning): boolean => {
    for (const id of m.context?.previous ?? []) {
      if (keyById.has(id)) continue;
      const c = ctxById.get(id);
      if (!c) return (excluded.push({ id: m.id, reason: `前文 ${id} を保持していない` }), false);
      if (c.condition && c.conditionEvaluation?.result !== "met")
        return (excluded.push({ id: m.id, reason: `前文 ${id} の条件（${c.condition}）が成立していない` }), false);
      if (c.review?.status === "needs_review") return (excluded.push({ id: m.id, reason: `前文 ${id} が要確認` }), false);
    }
    return true;
  };

  // 文章の組み立て（採用する資料の集合から、テーマ別の節を作る）
  const assemble = (selected: AiMeaning[]): InterpretationSection[] => {
    const selectedIds = new Set(selected.map((m) => m.id));

    // テーマ → 星ごとのまとまり（前文依存の文は前文と同じまとまりへ）
    const starOrder = ai.stars.map((s) => s.name as ZiweiStarName);
    const unitsByTheme = new Map<InterpretationTheme, Unit[]>();
    const themeOfSelected = new Map<string, InterpretationTheme>();
    const orderIndex = (id: string) => {
      const [prefix, num] = [id.replace(/[0-9]+$/, ""), Number(id.match(/[0-9]+$/)?.[0] ?? 0)];
      return `${prefix}${String(num).padStart(8, "0")}`;
    };
    const sortedSelected = [...selected].sort((a, b) => (orderIndex(a.id) < orderIndex(b.id) ? -1 : orderIndex(a.id) > orderIndex(b.id) ? 1 : 0));
    for (const m of sortedSelected) {
      const prevInBody = (m.context?.previous ?? []).filter((id) => selectedIds.has(id)).pop();
      const theme = prevInBody ? (themeOfSelected.get(prevInBody) ?? themeOf(m)) : themeOf(m);
      themeOfSelected.set(m.id, theme);
      const star = m.kind === "starPalace" || m.kind === "starBase" ? (m.stars[0] ?? null) : null;
      const units = unitsByTheme.get(theme) ?? [];
      let unit = units.find((u) => u.star === star && star !== null);
      if (!unit) {
        unit = { star, items: [] };
        units.push(unit);
      }
      unit.items.push(m);
      unitsByTheme.set(theme, units);
    }

    // 文の組み立て
    const sections: InterpretationSection[] = [];
    for (const theme of INTERPRETATION_THEMES) {
      const units = unitsByTheme.get(theme);
      if (!units || units.length === 0) continue;
      units.sort((a, b) => {
        const ia = a.star ? starOrder.indexOf(a.star) : -1;
        const ib = b.star ? starOrder.indexOf(b.star) : -1;
        return ia - ib;
      });
      const sentences: InterpretationSentence[] = [];
      // 表示文が空の文（資料の「イメージ」の物語部分など、技法上の意味を持たない文。§35.6）は表示しない。
      // 選ばれる文・文字数の目安は変えず、表示の前置きは「表示される文」の並びで決める
      let shownUnitsBefore = 0;
      units.forEach((unit, ui) => {
        let shownInUnit = 0;
        unit.items.forEach((m, ii) => {
          // 前文（採用されていない補助文）を先に
          for (const id of m.context?.previous ?? []) {
            if (selectedIds.has(id)) continue;
            const c = ctxById.get(id);
            if (!c) continue;
            sentences.push({
              text: c.text,
              prefix: "",
              basis: c.text ? `直後の文の前提となる文です。${conditionBasis(c.conditionEvaluation)}` : "",
              budgetLength: c.sourceLength,
              sourceIds: [id],
              ref: c.ref,
              role: "context",
              rank: null,
            });
          }
          const body = m.text;
          const firstOfSection = ui === 0 && ii === 0;
          // 文字数の目安に使う前置き（原文の凍結メタデータで決める。選ばれる文を変えないため。§35）
          let budgetPrefix = "";
          if (theme === "短所・注意" && firstOfSection) budgetPrefix += "一方で、";
          else if (ui > 0 && ii === 0 && !startsWithConnective(m)) budgetPrefix += "また、";
          if (ii === 0 && unit.star && !namesStar(m, unit.star)) budgetPrefix += `${unit.star}については、`;
          if (m.kind === "palace" && !m.mentionsPalaces.includes(palaceName)) budgetPrefix += `${palaceName}は、`;
          // 表示する前置き（表示文そのもので決める。§35.6）
          //   「また、」「一方で、」… 表示文が接続語で始まるときは付けない。「また、」は別の星の話へ移るときだけ
          //   （宮そのものの説明が続く節では、文ごとに「また、」を重ねない）
          //   「{星名}については、」… 表示文が星を名指ししていないときだけ
          //   「{宮名}は、」… 表示文に宮名がなく、接続語で始まらず、別の宮・星を主語にしておらず、ほかの前置きもないときだけ
          const textOpens = textStartsWithConnective(body);
          let prefix = "";
          if (body) {
            const firstShownOfSection = shownUnitsBefore === 0 && shownInUnit === 0;
            if (theme === "短所・注意" && firstShownOfSection) prefix += textOpens ? "" : "一方で、";
            else if (shownUnitsBefore > 0 && shownInUnit === 0 && unit.star && !textOpens) prefix += "また、";
            if (shownInUnit === 0 && unit.star && !textNamesStar(body, unit.star)) prefix += `${unit.star}については、`;
            if (m.kind === "palace" && !body.includes(palaceName) && !textOpens && !textHasOwnSubject(body) && prefix === "") prefix += `${palaceName}は、`;
            shownInUnit += 1;
          }
          sentences.push({
            text: `${prefix}${body}`,
            prefix,
            basis: body ? basisOf(m) : "",
            budgetLength: budgetPrefix.length + m.sourceLength,
            sourceIds: [m.id],
            ref: m.ref,
            role: "primary",
            rank: m.rank,
            ...(m.context ? { contextIds: [...m.context.previous, ...m.context.next] } : {}),
          });
        });
        if (shownInUnit > 0) shownUnitsBefore += 1;
      });
      sections.push({
        theme,
        text: sentences.map((s) => s.text).join(""),
        sentences,
        sourceIds: [...new Set(sentences.flatMap((s) => s.sourceIds))],
        basis: [...new Set(sentences.map((s) => s.basis).filter((b) => b.length > 0))],
      });
    }
    return sections;
  };
  // 文字数の目安の判定は原文の文字数で数える（表示文を書き直しても選ばれる文は変わらない。§35）
  const charCountOf = (secs: InterpretationSection[]) => secs.flatMap((x) => x.sentences).reduce((n, x) => n + x.budgetLength, 0);

  // A はすべて使う（目安を超えても削らない）。B は、組み立てた本文が目安の上限を超えない範囲で優先順位の順に足す
  const selected: AiMeaning[] = [];
  for (const m of ai.keyMeanings.filter((x) => x.rank === "A")) {
    if (selected.includes(m) || !usable(m)) continue;
    // 前文が採用文（B など）で未選択なら、前文も一緒に本文へ（後続文だけを出さない）
    for (const id of m.context?.previous ?? []) {
      const p = keyById.get(id);
      if (p && !selected.includes(p) && usable(p)) selected.push(p);
    }
    selected.push(m);
  }
  for (const m of ai.keyMeanings.filter((x) => x.rank === "B")) {
    if (selected.includes(m)) continue;
    // 前文依存の B は、前文（採用文）が本文に入っているときだけ
    if ((m.context?.previous ?? []).some((id) => keyById.has(id) && !selected.some((x) => x.id === id))) continue;
    if (!usable(m)) {
      continue;
    }
    if (charCountOf(assemble([...selected, m])) > lengthTarget[1]) continue;
    selected.push(m);
  }
  const sections = assemble(selected);

  const usedIds = [...new Set(sections.flatMap((s) => s.sourceIds))];
  const refById = new Map<string, SourceRef>([
    ...ai.keyMeanings.map((m): [string, SourceRef] => [m.id, m.ref]),
    ...ai.contextSentences.map((s): [string, SourceRef] => [s.id, s.ref]),
  ]);
  const sourceKey = (r: SourceRef) => `${r.source}|${r.pdfPage}|${r.section}`;
  const sources = [...new Map(usedIds.map((id) => refById.get(id)!).map((r) => [sourceKey(r), r])).values()];
  const fullText = sections
    .map((s) => s.text)
    .filter((t) => t.length > 0)
    .join("\n\n");
  const all = sections.flatMap((s) => s.sentences);

  return {
    palace: ai.palace,
    detailLevel,
    sections,
    fullText,
    excluded,
    conditionExcluded: ai.conditionExcluded,
    referenceOnly: ai.referenceOnly,
    reviewItems: ai.reviewItems,
    sources,
    counts: {
      charCount: fullText.replace(/\s/g, "").length,
      budgetCharCount: charCountOf(sections),
      lengthTarget,
      usedSourceIds: usedIds.length,
      primarySentences: all.filter((s) => s.role === "primary").length,
      contextSentences: all.filter((s) => s.role === "context").length,
      rankA: all.filter((s) => s.rank === "A").length,
      rankB: all.filter((s) => s.rank === "B").length,
      powerConditions: ai.counts.powerConditions,
      conditionMetInBody: all
        .filter((s) => (s.role === "primary" ? keyById.get(s.sourceIds[0])?.conditionEvaluation : ctxById.get(s.sourceIds[0])?.conditionEvaluation)?.result === "met")
        .map((s) => s.sourceIds[0]),
    },
  };
}
