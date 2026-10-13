// src/lib/shichusuimei/kakkyoku/elementForce.ts
//
// 秀山式内格力量判定法（監修確定 KD27。仕様 §39）。四柱推命の内格強弱の正式方式。
// 画面の内格強弱・印刷・resolveEffectiveStrength・解釈入力はこの結果を使う。
//
//   季節: 五季の旺相休囚死（辰戌丑未は月全体を土旺）。係数 旺1.5・相1.25・休1.0・囚0.75・死0.5 を地支の基礎点にだけ掛ける
//   地支: 月支5・他2。その支自身の五行（化した支は化後の五行）に1回だけ加える。蔵干は基礎点に足さない
//   天干: 1本1.0（日干も数える）。季節係数は掛けない。通根で 根なし×1.0・1根×1.25・2根以上×1.5、
//         月支に通根すれば2根相当（×1.5）。根＝天干と同じ五行の蔵干を持つ地支（自柱を含む。印は数えない）。
//         化した地支も根は元の蔵干で見る（化後の五行を新しい蔵干とみなさない：KD27-U2）
//   五行力量: 季節補正後の地支力量＋通根補正後の天干力量を、五行ごとに命式全体で1回だけ集計
//   判定: 扶助率＝(比劫＋印)÷総力量。55%以上 身強・45%以下 身弱・その間 境界
//   KD21: 月刃格・建禄格が成立すれば、格局表（四柱推命格局.pdf）どおり日主強として最終判定を身強にする（点数も保持）。
//         格局候補（gaikaku.ts）と同じ monthPatternOf を使う（KD27-U4）
//   合・会: 既存の確定ロジック（KD13・KD14）で化が成立した地支だけ化後の五行で数える。六合・冲の減衰（旧 ×1/2）は使わない
//   境界（45%超〜55%未満）: 自動で身強・身弱へ振り分けない。得令・得勢・得地・党多・三合・三会・合・冲剋を
//         補助判断材料として持つだけで、数値係数にはしない（KD27-U3）

import { STEM_ELEMENT } from "../data";
import { zokanOf } from "../zokan";
import { detectRelations } from "../relations";
import type { Element, PillarKey } from "../types";
import type {
  ElementForceBranch,
  ElementForceResult,
  ElementForceStem,
  InnerJudgment,
  Pillars,
  RootLevel,
  SeasonalState,
  StrengthAssessment,
} from "./types";
import { BRANCH_ELEMENT, ELEMENTS, inElementOf, monthPatternOf, slotsOf } from "./common";
import { branchStates } from "./branchState";

/** 月支 → 月令の五行（五季。辰戌丑未は月全体を土旺：KD27-1） */
const RULING_ELEMENT: Record<string, Element> = {
  寅: "木", 卯: "木",
  巳: "火", 午: "火",
  申: "金", 酉: "金",
  亥: "水", 子: "水",
  辰: "土", 戌: "土", 丑: "土", 未: "土",
};

/** 月令ごとの旺相休囚死（KD27-1 の表をそのまま持つ） */
const SEASONAL_TABLE: Record<Element, Record<Element, SeasonalState>> = {
  木: { 木: "旺", 火: "相", 水: "休", 金: "囚", 土: "死" },
  火: { 火: "旺", 土: "相", 木: "休", 水: "囚", 金: "死" },
  金: { 金: "旺", 水: "相", 土: "休", 火: "囚", 木: "死" },
  水: { 水: "旺", 木: "相", 金: "休", 土: "囚", 火: "死" },
  土: { 土: "旺", 金: "相", 火: "休", 木: "囚", 水: "死" },
};

const SEASONAL_COEFFICIENT: Record<SeasonalState, number> = { 旺: 1.5, 相: 1.25, 休: 1.0, 囚: 0.75, 死: 0.5 };

const STEM_BASE = 1.0;
const BRANCH_BASE = 2.0;
const MONTH_BRANCH_BASE = 5.0;

const ROOT_MULTIPLIER: Record<RootLevel, number> = { none: 1.0, one: 1.25, twoOrMore: 1.5, month: 1.5 };

/** 扶助率の判定（KD27-6）。ちょうど55%は身強、ちょうど45%は身弱 */
export function judgeSupportRatio(supporting: number, total: number): InnerJudgment {
  // 浮動小数の誤差で境界ちょうどを取り違えないよう、比率ではなく積で比べる
  const EPS = 1e-9;
  if (supporting * 100 >= 55 * total - EPS) return "身強";
  if (supporting * 100 <= 45 * total + EPS) return "身弱";
  return "境界";
}

function rootLevelOf(roots: PillarKey[]): RootLevel {
  if (roots.includes("月")) return "month";
  if (roots.length >= 2) return "twoOrMore";
  return roots.length === 1 ? "one" : "none";
}

export function calculateElementForce(p: Pillars, referenceOnly: boolean, strength?: StrengthAssessment): ElementForceResult {
  const slots = slotsOf(p);
  const monthBranch = p.月.branch;
  const rulingElement = RULING_ELEMENT[monthBranch];
  const seasonal = Object.fromEntries(
    ELEMENTS.map((e) => {
      const state = SEASONAL_TABLE[rulingElement][e];
      return [e, { state, coefficient: SEASONAL_COEFFICIENT[state] }];
    }),
  ) as ElementForceResult["seasonal"];

  // 地支: 化した支（既存の確定ロジック）は化後の五行。六合・冲の減衰は使わない
  const states = branchStates(p);
  const branches = states.map((st): ElementForceBranch => {
    const element = st.transformedTo ?? BRANCH_ELEMENT[st.branch];
    const base = st.pillar === "月" ? MONTH_BRANCH_BASE : BRANCH_BASE;
    const { state, coefficient } = seasonal[element];
    return {
      pillar: st.pillar,
      branch: st.branch,
      element,
      originalElement: st.transformedTo && st.transformedTo !== BRANCH_ELEMENT[st.branch] ? BRANCH_ELEMENT[st.branch] : null,
      base,
      seasonal: state,
      coefficient,
      force: base * coefficient,
    };
  });

  // 天干: 根は蔵干（p106）に天干と同じ五行の干を持つ地支
  const stems = slots.map((s): ElementForceStem => {
    const element = STEM_ELEMENT[s.stem];
    const roots = slots.filter((b) => zokanOf(b.branch).stems.some((z) => STEM_ELEMENT[z] === element)).map((b) => b.pillar);
    const rootLevel = rootLevelOf(roots);
    const multiplier = ROOT_MULTIPLIER[rootLevel];
    return { pillar: s.pillar, stem: s.stem, element, roots, rootLevel, multiplier, force: STEM_BASE * multiplier };
  });

  const byElement = Object.fromEntries(
    ELEMENTS.map((e) => {
      const branch = branches.filter((b) => b.element === e).reduce((sum, b) => sum + b.force, 0);
      const stem = stems.filter((s) => s.element === e).reduce((sum, s) => sum + s.force, 0);
      return [e, { branch, stem, total: branch + stem }];
    }),
  ) as ElementForceResult["byElement"];

  const dayEl = STEM_ELEMENT[p.日.stem];
  const supportEls = [dayEl, inElementOf(dayEl)];
  const weakEls = ELEMENTS.filter((e) => !supportEls.includes(e));
  const sum = (els: Element[]) => els.reduce((acc, e) => acc + byElement[e].total, 0);
  const supporting = sum(supportEls);
  const weakening = sum(weakEls);
  const totalPoints = supporting + weakening;
  const scoreJudgment = judgeSupportRatio(supporting, totalPoints);

  // KD21: 月支の本気だけで判定（KD21-3）。化の有無にかかわらず本気で見る。格局候補と同じ関数
  const monthPattern = monthPatternOf(p)?.name ?? null;
  const finalJudgment: InnerJudgment = monthPattern ? "身強" : scoreJudgment;

  // 境界帯の補助判断材料（表示・保持だけ。数値係数にはしない：KD27-U3）
  const borderlineMaterials: string[] = [];
  if (scoreJudgment === "境界") {
    if (strength) {
      const mark = { yes: "あり", no: "なし", undetermined: "未確定" } as const;
      borderlineMaterials.push(`得令: ${mark[strength.tokurei.value]}`);
      borderlineMaterials.push(`得勢: ${mark[strength.tokusei.value]}`);
      borderlineMaterials.push(`得地: ${mark[strength.tokuchi.value]}`);
      borderlineMaterials.push(`党多: ${{ touta: "党多", notTouta: "党多ではない", borderline: "境界" }[strength.touta.level]}`);
    }
    // 三合・三会・半合・半会（KD13・KD14）
    const seen = new Set<string>();
    for (const st of states) {
      for (const r of st.relations) {
        if (!/^(三合|三会|半合|半会)/.test(r) || seen.has(r)) continue;
        seen.add(r);
        borderlineMaterials.push(`会合: ${r}`);
      }
    }
    // 干合・支合・冲・刑など（Phase 1 の関係検出）
    for (const r of detectRelations(p)) {
      if (r.type === "三合") continue; // 上の会合で出す
      borderlineMaterials.push(`${r.type}: ${r.members.map((m) => `${m.pillar}${m.part}${m.value}`).join("・")}`);
    }
  }

  return {
    system: "element-force",
    monthBranch,
    rulingElement,
    seasonal,
    branches,
    stems,
    byElement,
    supportingSide: { elements: supportEls, points: supporting },
    weakeningSide: { elements: weakEls, points: weakening },
    totalPoints,
    supportRatioPercent: totalPoints === 0 ? 0 : (supporting / totalPoints) * 100,
    scoreJudgment,
    monthPattern,
    finalJudgment,
    finalSource: monthPattern ? "monthPattern" : "score",
    borderlineMaterials,
    referenceOnly,
  };
}
