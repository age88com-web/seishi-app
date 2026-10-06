// src/lib/shichusuimei/kakkyoku/strength.ts
//
// 強弱判定（補助）。
//   三得（得令50・得勢30・得地20）の成否 → 強弱の類型（§9.2）
//   強弱用の力量バランス（KD1：天干1・年日時支2〜3・月支6）→ 党多（KD10）→ 得勢
//   補正要因は加減点にせず、根拠として並べる（§8）
// 三得の割合・力量・党多の割合は互いに足し合わせない。内格の点数とも別体系。

import type { Element, PillarKey } from "../types";
import { STEM_ELEMENT } from "../data";
import { zokanOf } from "../zokan";
import { detectRelations } from "../relations";
import type {
  ForceBalance,
  ForceRange,
  PercentRange,
  Pillars,
  SantokuItem,
  StrengthAssessment,
  StrengthClass,
  StrengthLeaning,
  ToutaAssessment,
  ToutaLevel,
  Tristate,
} from "./types";
import {
  BRANCH_ELEMENT,
  ELEMENTS,
  adjacentPairs,
  completeSango,
  completeSankai,
  generates,
  hangoElement,
  hankaiElement,
  inElementOf,
  otherQiStems,
  slotsOf,
} from "./common";

// ---------------------------------------------------------------------------
// 力量バランス（KD1）と党多（KD10）
// ---------------------------------------------------------------------------

const OTHER_BRANCH: ForceRange = { min: 2, max: 3 };
const MONTH_BRANCH = 6;

interface ForceEntry {
  position: string;
  element: Element;
  kind: "stem" | "branch";
  isDayStem: boolean;
  force: ForceRange;
}

function forceEntries(p: Pillars): ForceEntry[] {
  return slotsOf(p).flatMap((s): ForceEntry[] => [
    { position: `${s.pillar}干`, element: STEM_ELEMENT[s.stem], kind: "stem", isDayStem: s.pillar === "日", force: { min: 1, max: 1 } },
    {
      position: `${s.pillar}支`,
      element: BRANCH_ELEMENT[s.branch],
      kind: "branch",
      isDayStem: false,
      force: s.pillar === "月" ? { min: MONTH_BRANCH, max: MONTH_BRANCH } : OTHER_BRANCH,
    },
  ]);
}

export function forceBalanceOf(p: Pillars): ForceBalance {
  const entries = forceEntries(p);
  const byElement = Object.fromEntries(ELEMENTS.map((e) => [e, { min: 0, max: 0 }])) as Record<Element, ForceRange>;
  for (const x of entries) {
    byElement[x.element].min += x.force.min;
    byElement[x.element].max += x.force.max;
  }
  return {
    weights: { stem: 1, yearDayHourBranch: OTHER_BRANCH, monthBranch: 6 },
    byElement,
    breakdown: entries.map(({ position, element, force }) => ({ position, element, force })),
  };
}

/**
 * 対象の五行群の割合の幅（§22.2）。
 * min: 対象側の地支を2・他を3、日干自身は対象に数えない（FB-U2）
 * max: 対象側の地支を3・他を2、日干自身を対象に数える
 */
function shareOf(entries: ForceEntry[], target: Element[]): PercentRange {
  const calc = (favor: boolean): number => {
    let num = 0;
    let den = 0;
    for (const x of entries) {
      const inTarget = target.includes(x.element);
      const w = x.force.min === x.force.max ? x.force.min : inTarget === favor ? x.force.max : x.force.min;
      den += w;
      if (inTarget && (favor || !x.isDayStem)) num += w;
    }
    return den === 0 ? 0 : (num / den) * 100;
  };
  return { minPercent: calc(false), maxPercent: calc(true) };
}

export function assessTouta(p: Pillars, label: string, target: Element[]): ToutaAssessment {
  const entries = forceEntries(p);
  const share = shareOf(entries, target);
  const others = ELEMENTS.filter((e) => !target.includes(e)).map((e) => ({ element: e, share: shareOf(entries, [e]) }));
  let level: ToutaLevel = "borderline";
  if (share.minPercent >= 50 && others.every((o) => o.share.maxPercent <= 10)) level = "touta";
  else if (share.maxPercent < 30 || others.some((o) => o.share.minPercent > 20)) level = "notTouta";
  return { target: { label, elements: target }, share, others, level };
}

// ---------------------------------------------------------------------------
// 三得（§13）
// ---------------------------------------------------------------------------

function tokureiOf(p: Pillars, dayEl: Element): SantokuItem {
  const monthEl = BRANCH_ELEMENT[p.月.branch];
  const evidence = [`月支${p.月.branch}の本気の五行 ${monthEl}・日干の五行 ${dayEl}`];
  if (monthEl === dayEl) return { value: "yes", indexPercent: 50, evidence };
  if (generates(monthEl, dayEl)) {
    return { value: "undetermined", indexPercent: 50, evidence, undeterminedReason: "月支の本気が印（得令に印を含むか未確定：N2）" };
  }
  return { value: "no", indexPercent: 50, evidence };
}

function tokuseiOf(touta: ToutaAssessment): SantokuItem {
  const r = touta.share;
  const evidence = [`比劫＋印 ${r.minPercent.toFixed(0)}〜${r.maxPercent.toFixed(0)}%（強弱用の力量）`];
  if (touta.level === "touta") return { value: "yes", indexPercent: 30, evidence };
  if (touta.level === "notTouta") return { value: "no", indexPercent: 30, evidence };
  return { value: "undetermined", indexPercent: 30, evidence, undeterminedReason: "党多の境界" };
}

function tokuchiOf(p: Pillars, dayEl: Element): SantokuItem {
  const slots = slotsOf(p);
  const rootsIn = (k: PillarKey) => zokanOf(p[k]!.branch).stems.some((s) => STEM_ELEMENT[s] === dayEl);
  const otherRoots = slots.filter((s) => s.pillar !== "月" && rootsIn(s.pillar)).map((s) => `${s.pillar}支${s.branch}`);
  const evidence = otherRoots.length ? [`根: ${otherRoots.join("・")}`] : [];
  if (otherRoots.length) return { value: "yes", indexPercent: 20, evidence };
  if (rootsIn("月")) {
    return { value: "undetermined", indexPercent: 20, evidence: [`根: 月支${p.月.branch}のみ`], undeterminedReason: "月支にだけ根（「他の地支」の範囲が未確定：N4）" };
  }
  return { value: "no", indexPercent: 20, evidence: ["根なし"] };
}

/** 三得の組み合わせ → 類型（§9.2） */
function classOf(rei: boolean, sei: boolean, chi: boolean): { cls: StrengthClass; index: number } {
  const index = (rei ? 50 : 0) + (sei ? 30 : 0) + (chi ? 20 : 0);
  if (rei && sei && chi) return { cls: "過強", index };
  if (rei && (sei || chi)) return { cls: "中強", index };
  if (index === 50) return { cls: "境界", index };
  if (!rei && sei && !chi) return { cls: "中弱", index };
  // 得地のみ（20%）は弱側（KD15）
  if (!rei && !sei && chi) return { cls: "弱（得地のみ）", index };
  return { cls: "過弱", index };
}

function expand(v: Tristate): boolean[] {
  return v === "yes" ? [true] : v === "no" ? [false] : [true, false];
}

const STRONG: readonly StrengthClass[] = ["過強", "中強"];
const WEAK: readonly StrengthClass[] = ["中弱", "弱（得地のみ）", "過弱"];

function leaningOf(classes: StrengthClass[]): StrengthLeaning {
  if (classes.every((c) => STRONG.includes(c))) return "身強寄り";
  if (classes.every((c) => WEAK.includes(c))) return "身弱寄り";
  return "要術者判断";
}

// ---------------------------------------------------------------------------
// 強弱の判定
// ---------------------------------------------------------------------------

export function assessStrength(p: Pillars): StrengthAssessment {
  const dayStem = p.日.stem;
  const dayEl = STEM_ELEMENT[dayStem];
  const inEl = inElementOf(dayEl);
  const touta = assessTouta(p, "日干の比劫＋印", [dayEl, inEl]);
  const tokurei = tokureiOf(p, dayEl);
  const tokusei = tokuseiOf(touta);
  const tokuchi = tokuchiOf(p, dayEl);

  const combos: { cls: StrengthClass; index: number }[] = [];
  for (const r of expand(tokurei.value)) for (const s of expand(tokusei.value)) for (const c of expand(tokuchi.value)) combos.push(classOf(r, s, c));
  const classificationCandidates = [...new Set(combos.map((x) => x.cls))];
  const indexes = combos.map((x) => x.index);

  // 日干五行の透干・通根（三p34）
  const slots = slotsOf(p);
  const inStems = slots.some((s) => s.pillar !== "日" && STEM_ELEMENT[s.stem] === dayEl);
  const inBranches = slots.some((s) => zokanOf(s.branch).stems.some((z) => STEM_ELEMENT[z] === dayEl));
  const rootStrength = inBranches ? (inStems ? "最強" : "強") : inStems ? "弱" : "なし";

  // 補正要因（§8）。数値化しない
  const weakeningFactors: string[] = [];
  const reviewNotes: string[] = [];
  const relations = detectRelations(p);
  for (const r of relations) {
    if (!r.members.some((m) => m.pillar === "月" && m.part === "支")) continue;
    const label = r.members.map((m) => `${m.pillar}支${m.value}`).join("・");
    if (r.type === "冲") weakeningFactors.push(`月支が冲を受ける（${label}）`);
    if (r.type === "支合") reviewNotes.push(`月支が六合（${label}）：弱まっている場合あり`);
  }
  const branches = slots.map((s) => s.branch);
  for (const g of completeSango(branches)) {
    if (!g.group.includes(p.月.branch)) continue;
    reviewNotes.push(`月支を含む三合（${g.kyoku}）${g.element === dayEl ? "：日干と同じ五行" : ""}`);
  }
  for (const g of completeSankai(branches)) {
    if (!g.group.includes(p.月.branch)) continue;
    reviewNotes.push(`月支を含む三会（${g.group.join("")}・${g.element}）${g.element === dayEl ? "：日干と同じ五行" : ""}`);
  }
  for (const [a, b] of adjacentPairs(p)) {
    if (a !== "月" && b !== "月") continue;
    const other = p[a === "月" ? b : a]!.branch;
    const hango = hangoElement(p.月.branch, other);
    if (hango) reviewNotes.push(`月支の半合（${p.月.branch}${other}・${hango}）${hango === dayEl ? "：日干と同じ五行" : ""}`);
    const hankai = hankaiElement(p.月.branch, other);
    if (hankai) reviewNotes.push(`月支の半会（${p.月.branch}${other}・${hankai}）${hankai === dayEl ? "：日干と同じ五行" : ""}`);
  }
  if (tokurei.value === "no" && otherQiStems(p.月.branch).some((s) => STEM_ELEMENT[s] === dayEl)) {
    reviewNotes.push(`失令だが月支${p.月.branch}の本気以外の蔵干に日干と同じ五行`);
  }
  if (classificationCandidates.includes("境界")) reviewNotes.push("50%ライン：歳運で破格となりやすい");

  return {
    dayMaster: { stem: dayStem, element: dayEl },
    tokurei,
    tokusei,
    tokuchi,
    indexPercent: new Set(indexes).size === 1 ? indexes[0] : null,
    indexRange: [Math.min(...indexes), Math.max(...indexes)],
    classification: classificationCandidates.length === 1 ? classificationCandidates[0] : null,
    classificationCandidates,
    leaning: leaningOf(classificationCandidates),
    touta,
    forceBalance: forceBalanceOf(p),
    rootStrength,
    strengtheningFactors: [],
    weakeningFactors,
    reviewNotes,
  };
}
