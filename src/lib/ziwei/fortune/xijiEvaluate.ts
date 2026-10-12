// src/lib/ziwei/fortune/xijiEvaluate.ts
//
// 四化星と宮の喜忌（基礎２ S40）を大限・小限それぞれに当てる。docs/ziwei-basic-spec.md §33。
//   S40「大限、小限で各宮の天干ごとの四化星の喜忌」→ 対象は大限・小限だけ（太歳には当てない）。
//   干は行運の宮の天干（大限の干・小限の干）。大限と小限は別々に評価し、互いの干を使わない。
//   四化はその行運の層だけ（大限→大限四化、小限→小限四化）。生年四化は混ぜない。
//   三方四正は共通定義（三合2宮＋対宮。sanfangSizheng）。
//   己は資料に行がない → needs_review（補わない）。
// 行運のタイプ（S36「三方四正に『殺破狼』七殺・破軍・貧狼 または『機月同梁』天機、太陰、天同、天梁」）:
//   既存の星配置で検証すると、本宮を含めるか・星が全部そろうか1つでよいかの読みで結果が変わり、
//   どの読みでも S36 の「2つのタイプに大別」「交互に巡る」を全配置で再現できない（§33.2）。
//   → fortuneType は needs_review。殺破狼・機月同梁を条件にする干（甲乙戊庚辛癸）は断定しない。

import { sanfangSizheng } from "../sanfang";
import type { Branch, PlacedStar, Stem, TransformationKind, ZiweiChart } from "../types";
import type { FortunePatternResult } from "./patterns";
import type { LayeredTransformation, LimitTransformations } from "./types";

export type FortuneType = "shapolang" | "jiyuetongliang" | "needs_review";

const SHAPOLANG: readonly PlacedStar[] = ["七殺星", "破軍星", "貪狼星"];
const JIYUETONGLIANG: readonly PlacedStar[] = ["天機星", "太陰星", "天同星", "天梁星"];

/** S36 の読み（本宮を含むか × 星が全部か1つ以上か） */
export type FortuneTypeReading = "withSelf_all" | "withSelf_any" | "withoutSelf_all" | "withoutSelf_any";
export const FORTUNE_TYPE_READINGS: readonly FortuneTypeReading[] = ["withSelf_all", "withSelf_any", "withoutSelf_all", "withoutSelf_any"];

export interface FortuneTypeResult {
  /** 資料から一意に決まらないため needs_review（読みを確定したときだけ shapolang・jiyuetongliang） */
  type: FortuneType;
  basis: "needs_review" | FortuneTypeReading;
  /** 各読みでの結果（none ＝ どちらでもない、both ＝ 両方） */
  readings: Record<FortuneTypeReading, "shapolang" | "jiyuetongliang" | "none" | "both">;
  /** 宮の数（本宮を含む・含まない）での殺破狼・機月同梁の星 */
  stars: { withSelf: { shapolang: PlacedStar[]; jiyuetongliang: PlacedStar[] }; withoutSelf: { shapolang: PlacedStar[]; jiyuetongliang: PlacedStar[] } };
}

export const FORTUNE_TYPE_SOURCE = {
  source: "紫微斗数基礎２",
  page: "S36",
  summary: "三方四正に殺破狼（七殺・破軍・貪狼）か機月同梁（天機・太陰・天同・天梁）があるかで行運を二つのタイプに分ける記述",
  status: "needs_review" as const,
  reason:
    "既存の全配置（紫微12位置×12宮＝144）で、本宮を含め全部そろう読み: 殺破狼36・機月同梁18・どちらでもない90／本宮を含め1つ以上: 殺破狼72・機月同梁70・どちらでもない2／本宮を含めない読みでは殺破狼3星はそろわない。どの読みでも「2つのタイプに大別」を再現できない",
};

/** 行運の宮のタイプ（既存の星配置と sanfangSizheng だけを使う）。reading を渡したときだけ確定する */
export function fortuneTypeOf(chart: ZiweiChart, branch: Branch, reading: FortuneTypeReading | null = null): FortuneTypeResult {
  const sf = sanfangSizheng(branch);
  const ring = [sf.opposite, ...sf.trines];
  const pos = (s: PlacedStar) => chart.starPositions[s];
  const pick = (stars: readonly PlacedStar[], area: Branch[]) => stars.filter((s) => area.includes(pos(s)));
  const withSelf = { shapolang: pick(SHAPOLANG, [branch, ...ring]), jiyuetongliang: pick(JIYUETONGLIANG, [branch, ...ring]) };
  const withoutSelf = { shapolang: pick(SHAPOLANG, ring), jiyuetongliang: pick(JIYUETONGLIANG, ring) };
  const judge = (x: typeof withSelf, all: boolean) => {
    const s = all ? x.shapolang.length === SHAPOLANG.length : x.shapolang.length > 0;
    const j = all ? x.jiyuetongliang.length === JIYUETONGLIANG.length : x.jiyuetongliang.length > 0;
    return s && j ? "both" : s ? "shapolang" : j ? "jiyuetongliang" : "none";
  };
  const readings = {
    withSelf_all: judge(withSelf, true),
    withSelf_any: judge(withSelf, false),
    withoutSelf_all: judge(withoutSelf, true),
    withoutSelf_any: judge(withoutSelf, false),
  } as const;
  let type: FortuneType = "needs_review";
  if (reading) {
    const r = readings[reading];
    type = r === "shapolang" || r === "jiyuetongliang" ? r : "needs_review";
  }
  return { type, basis: reading ?? "needs_review", readings, stars: { withSelf, withoutSelf } };
}

type CheckFn = (c: { ring: Branch[]; layer: LayeredTransformation[]; patterns: FortunePatternResult[] }) => { ok: boolean; detail: string };

export interface XijiRule {
  stem: Stem;
  /** 資料の記述の要約（原文は持たない。§35） */
  summary: string;
  /** 表示する文（資料の意味の範囲で書き直した独自文章。§35） */
  displayText: string;
  /**
   * typeConditional … 行運のタイプが requiredType のときだけ（喜・忌・不利）
   * statement       … 資料の状態の記述（丙・丁・壬）。総合評価は付けない
   */
  kind: "typeConditional" | "statement";
  requiredType: "shapolang" | "jiyuetongliang" | null;
  /** 資料の語（喜ぶ・忌む・不利・半吉半凶）。statement で語がなければ null */
  judgement: "喜ぶ" | "忌む" | "不利" | "半吉半凶" | null;
  /** 括弧内などの、行運四化で確かめられる資料の条件 */
  condition: { text: string; check: CheckFn } | null;
}

const has = (layer: LayeredTransformation[], kind: TransformationKind, star?: PlacedStar) => layer.filter((t) => t.kind === kind && (!star || t.star === star));
const inRing = (ts: LayeredTransformation[], ring: Branch[]) => ts.filter((t) => ring.includes(t.branch));
const fmt = (ts: LayeredTransformation[]) => ts.map((t) => `${t.star.replace(/星$/, "")}${t.kind.slice(1, 2)}（${t.branch}）`).join("・") || "なし";

const RULES: readonly XijiRule[] = [
  ...(["甲", "乙"] as Stem[]).map(
    (stem): XijiRule => ({
      stem,
      summary: "殺破狼を喜ぶ。三方四正に化科・化権・化禄があり、化忌はない",
      displayText: "行運が殺破狼のときは吉と見ます。三方四正には化禄・化権・化科がそろい、化忌は入りません。",
      kind: "typeConditional",
      requiredType: "shapolang",
      judgement: "喜ぶ",
      condition: {
        text: "三方四正に化禄・化権・化科がそろい、化忌がない",
        check: ({ ring, layer }) => {
          const lqk = (["化禄星", "化権星", "化科星"] as TransformationKind[]).map((k) => inRing(has(layer, k), ring));
          const ji = inRing(has(layer, "化忌星"), ring);
          return { ok: lqk.every((x) => x.length > 0) && ji.length === 0, detail: `三方四正の禄権科: ${fmt(lqk.flat())}／化忌: ${fmt(ji)}` };
        },
      },
    }),
  ),
  {
    stem: "丙",
    summary: "三方四正に必ず廉貞の化忌が会照する",
    displayText: "三方四正へ廉貞の化忌が必ず会照してくる干です。",
    kind: "statement",
    requiredType: null,
    judgement: null,
    condition: {
      text: "三方四正に廉貞の化忌",
      check: ({ ring, layer }) => {
        const x = inRing(has(layer, "化忌星", "廉貞星"), ring);
        return { ok: x.length > 0, detail: `三方四正の廉貞化忌: ${fmt(x)}` };
      },
    },
  },
  {
    stem: "丁",
    summary: "吉凶が半々。天相が刑忌夾印を形成する",
    displayText: "吉と凶が半々に表れます（天相が刑忌夾印の形になるため）。",
    kind: "statement",
    requiredType: null,
    judgement: "半吉半凶",
    condition: {
      text: "天相が刑忌夾印の形になる",
      check: ({ patterns }) => {
        const p = patterns.find((x) => x.id === "K2-33");
        const ok = !!p && p.conditionMatched && !!p.formationBasis?.limitAlone;
        return { ok, detail: ok ? `刑忌夾印（この行運の化忌で成立。天相の宮 ${p!.matchedPalaces.map((m) => m.branch).join("・")}）` : "この行運の化忌で刑忌夾印が成立しない" };
      },
    },
  },
  {
    stem: "戊",
    summary: "殺破狼を喜ぶ。貪狼の化禄が三方四正に会照する（原文の表記は貧狼）",
    displayText: "行運が殺破狼のときは吉と見ます（貪狼の化禄が三方四正に会照するため）。",
    kind: "typeConditional",
    requiredType: "shapolang",
    judgement: "喜ぶ",
    condition: {
      text: "三方四正に貪狼の化禄",
      check: ({ ring, layer }) => {
        const x = inRing(has(layer, "化禄星", "貪狼星"), ring);
        return { ok: x.length > 0, detail: `三方四正の貪狼化禄: ${fmt(x)}` };
      },
    },
  },
  {
    stem: "庚",
    summary: "機月同梁が不利。天同に化忌",
    displayText: "行運が機月同梁のときは不利と見ます（天同に化忌が付くため）。",
    kind: "typeConditional",
    requiredType: "jiyuetongliang",
    judgement: "不利",
    condition: {
      text: "天同に化忌",
      check: ({ layer }) => {
        const x = has(layer, "化忌星", "天同星");
        return { ok: x.length > 0, detail: `天同化忌: ${fmt(x)}` };
      },
    },
  },
  { stem: "辛", summary: "機月同梁を喜ぶ", displayText: "行運が機月同梁のときは吉と見ます。", kind: "typeConditional", requiredType: "jiyuetongliang", judgement: "喜ぶ", condition: null },
  {
    stem: "壬",
    summary: "紫微に化権、武曲に化忌。血を見る災いにはならない",
    displayText: "紫微に化権、武曲に化忌が付きますが、血を見るような災いにはならないとされます。",
    kind: "statement",
    requiredType: null,
    judgement: null,
    condition: {
      text: "紫微に化権、武曲に化忌",
      check: ({ layer }) => {
        const q = has(layer, "化権星", "紫微星");
        const j = has(layer, "化忌星", "武曲星");
        return { ok: q.length > 0 && j.length > 0, detail: `紫微化権: ${fmt(q)}／武曲化忌: ${fmt(j)}` };
      },
    },
  },
  {
    stem: "癸",
    summary: "殺破狼を忌む。貪狼に化忌（原文の表記は殺破郎・貧狼）",
    displayText: "行運が殺破狼のときは凶と見ます（貪狼に化忌が付くため）。",
    kind: "typeConditional",
    requiredType: "shapolang",
    judgement: "忌む",
    condition: {
      text: "貪狼に化忌",
      check: ({ layer }) => {
        const x = has(layer, "化忌星", "貪狼星");
        return { ok: x.length > 0, detail: `貪狼化忌: ${fmt(x)}` };
      },
    },
  },
];

export const XIJI_RULES: Readonly<Partial<Record<Stem, XijiRule>>> = Object.fromEntries(RULES.map((r) => [r.stem, r]));
export const XIJI_SOURCE = { source: "紫微斗数基礎２", page: "S40", heading: "四化星と宮の喜忌", appliesTo: ["major", "minor"] as const, missingStems: ["己"] as Stem[] };

export interface LimitXijiResult {
  origin: "major" | "minor";
  stem: Stem;
  branch: Branch;
  rule: XijiRule | null;
  fortuneType: FortuneTypeResult;
  conditionCheck: { text: string; ok: boolean; detail: string } | null;
  /**
   * applies       … 資料の条件がすべて確認できた（表示する）
   * notApplicable … 行運のタイプが違う・状態の記述が成り立たない
   * needs_review  … 己（資料に行がない）・行運のタイプが未確定・括弧内の条件が資料と合わない
   */
  status: "applies" | "notApplicable" | "needs_review";
  reason: string;
  /** 表示文（applies のときだけ） */
  displayText: string | null;
}

/** 1つの行運（大限または小限）の喜忌。四化はその行運の層だけ、格局はその行運の格局だけ */
export function evaluateLimitXiji(
  chart: ZiweiChart,
  limit: LimitTransformations,
  limitPatterns: FortunePatternResult[],
  options: { fortuneTypeReading?: FortuneTypeReading | null } = {},
): LimitXijiResult {
  const origin = limit.limitType;
  const branch = limit.palaceBranch;
  const stem = limit.palaceStem;
  const fortuneType = fortuneTypeOf(chart, branch, options.fortuneTypeReading ?? null);
  const rule = XIJI_RULES[stem] ?? null;
  const base = { origin, stem, branch, rule, fortuneType };
  if (!rule) return { ...base, conditionCheck: null, status: "needs_review", reason: `${stem}は資料（S40）に記載がない`, displayText: null };
  const sf = sanfangSizheng(branch);
  const layer = limit.transformations.filter((t) => t.origin === origin);
  const patterns = limitPatterns.filter((p) => p.origin === origin);
  const c = rule.condition ? rule.condition.check({ ring: [sf.opposite, ...sf.trines], layer, patterns }) : null;
  const conditionCheck = rule.condition && c ? { text: rule.condition.text, ok: c.ok, detail: c.detail } : null;

  if (rule.kind === "statement") {
    if (conditionCheck && !conditionCheck.ok) return { ...base, conditionCheck, status: "needs_review", reason: `資料の記述「${conditionCheck.text}」がこの行運で確認できない`, displayText: null };
    return { ...base, conditionCheck, status: "applies", reason: "資料の記述を確認", displayText: rule.displayText };
  }
  if (fortuneType.type === "needs_review") return { ...base, conditionCheck, status: "needs_review", reason: "行運のタイプ（殺破狼・機月同梁）が資料から一意に決まらない", displayText: null };
  if (fortuneType.type !== rule.requiredType) return { ...base, conditionCheck, status: "notApplicable", reason: `行運のタイプが${fortuneType.type === "shapolang" ? "殺破狼" : "機月同梁"}`, displayText: null };
  if (conditionCheck && !conditionCheck.ok) return { ...base, conditionCheck, status: "needs_review", reason: `括弧内の条件「${conditionCheck.text}」がこの行運の四化で確認できない`, displayText: null };
  return { ...base, conditionCheck, status: "applies", reason: "行運のタイプと資料の条件を確認", displayText: rule.displayText };
}
