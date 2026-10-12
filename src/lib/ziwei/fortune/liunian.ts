// src/lib/ziwei/fortune/liunian.ts
//
// 流年（＝小限）の年運ルール。docs/ziwei-basic-spec.md §32。
// 基礎２ S33 羊陀夾忌格の、流年がこの宮に巡り三方四正に流年化忌が重なる年についての記述。
//   流年 ＝ 小限（S41「生まれ年（数え年）での小限を、流年として判断する」）。太歳宮ではない。
//   流年化忌 ＝ 小限四化の化忌（S33・S40・S41 を合わせた資料内の読み。definitionStatus: source_inference。2026-10-01 ユーザー確定）
//   三方四正 ＝ 三合2宮＋対宮（本宮は「流年がこの宮に巡り」で別に指定されているので含めない）
//   この宮 ＝ 羊陀夾忌の成立宮（禄存の宮）。対宮（affectedPalaces）に小限が巡っただけでは成立としない。
//   本命の羊陀夾忌・大限で成立した羊陀夾忌の両方を候補として評価し、origin を残す（特例は作らない）。
// 表示文は資料の意味（その年は波乱の多い年回りになる）を書き直した独自文章だけ（§35）。

import { evaluatePatterns } from "../patterns/evaluate";
import type { PatternResult } from "../patterns/types";
import { sanfangSizheng } from "../sanfang";
import type { Branch, ZiweiChart } from "../types";
import type { FortunePatternResult } from "./patterns";
import type { LayeredTransformation, LimitTransformations } from "./types";

/** 本命格局（条件一致したもの）。本命盤は変わらないので命盤ごとに1回だけ判定する */
const NATAL_PATTERN_CACHE = new WeakMap<ZiweiChart, PatternResult[]>();
export function natalMatchedPatterns(chart: ZiweiChart): PatternResult[] {
  let v = NATAL_PATTERN_CACHE.get(chart);
  if (!v) {
    v = evaluatePatterns(chart).patterns.filter((p) => p.conditionMatched === true);
    NATAL_PATTERN_CACHE.set(chart, v);
  }
  return v;
}

/** 「流年」「流年化忌」の読み（資料内の複数記述から確定した読み） */
export const LIUNIAN_DEFINITION = {
  flowYear: {
    meaning: "小限" as const,
    definitionStatus: "source_inference" as const,
    evidence: "基礎２ S41（数え年の小限を流年として判断するという記述）",
  },
  flowYearJi: {
    meaning: "小限四化の化忌" as const,
    origin: "minor" as const,
    definitionStatus: "source_inference" as const,
    evidence: "単独の定義文はない。S33（流年化忌）・S40（大限、小限で各宮の天干ごとの四化星）・S41（流年＝小限）を合わせた資料内の読み",
  },
  sanfangSizheng: "三合2宮＋対宮（本宮を含めない。本宮は「流年がこの宮に巡り」で別に指定）",
  confirmedAt: "2026-10-01 ユーザー確定",
} as const;

export const YANGTUO_LIUNIAN_SOURCE = {
  source: "紫微斗数基礎２",
  page: "S33",
  heading: "羊陀夾忌格",
  /** 記述の要約（原文は持たない） */
  summary: "羊陀夾忌の宮に流年が巡り、その三方四正に流年の化忌が重なると、その年は波乱の多い年回りになる",
} as const;

export const YANGTUO_LIUNIAN_TEXT = "その年は浮き沈みが激しく、変動や思いがけない出来事が重なりやすい年回りと読みます。";

export interface YangtuoLiunianCandidate {
  rule: "yangtuo-jiaji-liunian-jihua";
  /** 羊陀夾忌の成立宮（禄存の宮） */
  branch: Branch;
  /** どの層の羊陀夾忌か */
  origin: "natal" | "major";
  /** 条件2: 小限宮がこの宮 */
  minorArrives: boolean;
  /** 条件3: この宮の三合2宮＋対宮にある小限化忌 */
  minorJiInSanfang: LayeredTransformation[];
  /** 本宮の小限化忌（条件には使わない。記録） */
  minorJiInSelf: LayeredTransformation[];
  met: boolean;
  detail: string;
}

export interface LiunianEffect {
  type: "negative";
  rule: "yangtuo-jiaji-liunian-jihua";
  branch: Branch;
  origins: ("natal" | "major")[];
  /** 表示文（資料の文） */
  text: string;
}

export interface LiunianContext {
  /** 流年＝小限（数え年）。小限がなければ null */
  minorLimit: { branch: Branch; age: number } | null;
  definition: typeof LIUNIAN_DEFINITION;
  candidates: YangtuoLiunianCandidate[];
  /** 成立したものだけ */
  effects: LiunianEffect[];
}

export function evaluateLiunian(
  chart: ZiweiChart,
  input: { minorLimit: LimitTransformations | null; majorPatterns: FortunePatternResult[]; transformationsByBranch: Record<Branch, LayeredTransformation[]> },
): LiunianContext {
  const sources: { branch: Branch; origin: "natal" | "major" }[] = [];
  for (const p of natalMatchedPatterns(chart).filter((x) => x.id === "K2-32")) for (const m of p.matchedPalaces) sources.push({ branch: m.branch, origin: "natal" });
  for (const p of input.majorPatterns.filter((x) => x.id === "K2-32" && x.conditionMatched)) for (const m of p.matchedPalaces) sources.push({ branch: m.branch, origin: "major" });

  const minorBranch = input.minorLimit?.palaceBranch ?? null;
  const isMinorJi = (t: LayeredTransformation) => t.origin === "minor" && t.kind === "化忌星";
  const candidates = sources.map((s): YangtuoLiunianCandidate => {
    const sf = sanfangSizheng(s.branch);
    const ring = [...sf.trines, sf.opposite];
    const minorArrives = minorBranch === s.branch;
    const minorJiInSanfang = ring.flatMap((b) => input.transformationsByBranch[b].filter(isMinorJi));
    const minorJiInSelf = input.transformationsByBranch[s.branch].filter(isMinorJi);
    const met = minorArrives && minorJiInSanfang.length > 0;
    return {
      rule: "yangtuo-jiaji-liunian-jihua",
      branch: s.branch,
      origin: s.origin,
      minorArrives,
      minorJiInSanfang,
      minorJiInSelf,
      met,
      detail: !input.minorLimit
        ? "小限なし"
        : !minorArrives
          ? `小限宮（${minorBranch}）は羊陀夾忌の宮（${s.branch}）ではない`
          : minorJiInSanfang.length === 0
            ? `羊陀夾忌の宮（${s.branch}）の三合宮・対宮に小限化忌がない${minorJiInSelf.length ? "（本宮の小限化忌は条件に含めない）" : ""}`
            : `羊陀夾忌の宮（${s.branch}）に小限が巡り、${minorJiInSanfang.map((t) => `${t.branch}の${t.star}`).join("・")}に小限化忌`,
    };
  });
  const effects: LiunianEffect[] = [];
  for (const c of candidates.filter((x) => x.met)) {
    const e = effects.find((x) => x.branch === c.branch);
    if (e) e.origins.push(c.origin);
    else effects.push({ type: "negative", rule: c.rule, branch: c.branch, origins: [c.origin], text: YANGTUO_LIUNIAN_TEXT });
  }
  return {
    minorLimit: input.minorLimit ? { branch: input.minorLimit.palaceBranch, age: input.minorLimit.age! } : null,
    definition: LIUNIAN_DEFINITION,
    candidates,
    effects,
  };
}
