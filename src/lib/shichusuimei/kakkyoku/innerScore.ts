// src/lib/shichusuimei/kakkyoku/innerScore.ts
//
// 普通格局（内格）専用の補助点数（KD12・KD13。仕様 §25）。
// 内格に回った命式だけで計算する。身強・身弱や格名を決める点数ではない。
// 三得・強弱用の力量・党多の割合・運の合化用の力量とは別体系（合算・比較しない）。
//
//   基本点: 同五行 本気4・本気以外2／地支が天干を生じる 本気2・本気以外1
//   月支: 基本点×1.5（坐支加点の前）
//   坐支: 本気が同五行 +1／生じる +0.5（化した地支は化後の本気で判定）
//   地支関係の優先: 三合＝三会 ＞ 半合＝半会 ＞ 六合 ＞ 冲
//     三合・三会: 命式内でそろえば成立（隣接不要）。化五行を本気として通常点、本気以外は1/3
//     半合（旺支を含む）・半会: 隣接のみ。月支は三合でのみ化す
//     六合・冲: 隣接のみ。1/2（両側なら重ねる。坐支加点も対象）
//   隣接天干: 相生 生じられる+2・生じる−2／冲剋（干合の組以外の相剋）両方−2／同五行0。負数も保持

import { STEM_ELEMENT, SHIGO, CHU, KANGO } from "../data";
import type { Branch, Element, PillarKey, Stem } from "../types";
import type { BranchState, InnerPatternScore, Pillars } from "./types";
import {
  BRANCH_ELEMENT,
  ELEMENTS,
  adjacentPairs,
  completeSango,
  completeSankai,
  controls,
  generates,
  hangoElement,
  hankaiElement,
  inElementOf,
  mainQiStem,
  otherQiStems,
  slotsOf,
} from "./common";

function isPair(table: readonly (readonly [Branch, Branch])[], a: Branch, b: Branch): boolean {
  return table.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

interface Level {
  level: number; // 3: 三合・三会 / 2: 半合・半会 / 1: 六合 / 0: 冲
  label: string;
  element: Element | null;
  kind: RelationKind;
  branches: readonly Branch[];
}

export type RelationKind = "三合" | "三会" | "半合" | "半会" | "六合" | "冲";

/** 各地支に掛かる地支関係（優先順位で間引かない全件） */
function collectRelations(p: Pillars): Map<PillarKey, Level[]> {
  const slots = slotsOf(p);
  const branches = slots.map((s) => s.branch);
  const rel = new Map<PillarKey, Level[]>(slots.map((s) => [s.pillar, []]));

  for (const g of completeSango(branches)) {
    for (const s of slots) if (g.group.includes(s.branch)) rel.get(s.pillar)!.push({ level: 3, label: `三合${g.kyoku}`, element: g.element, kind: "三合", branches: g.group });
  }
  for (const g of completeSankai(branches)) {
    for (const s of slots) if (g.group.includes(s.branch)) rel.get(s.pillar)!.push({ level: 3, label: `三会${g.group.join("")}`, element: g.element, kind: "三会", branches: g.group });
  }
  for (const [a, b] of adjacentPairs(p)) {
    const ba = p[a]!.branch;
    const bb = p[b]!.branch;
    const push = (x: Level) => {
      rel.get(a)!.push(x);
      rel.get(b)!.push(x);
    };
    const hg = hangoElement(ba, bb);
    if (hg) push({ level: 2, label: `半合${ba}${bb}`, element: hg, kind: "半合", branches: [ba, bb] });
    const hk = hankaiElement(ba, bb);
    if (hk) push({ level: 2, label: `半会${ba}${bb}`, element: hk, kind: "半会", branches: [ba, bb] });
    if (isPair(SHIGO, ba, bb)) push({ level: 1, label: `六合${ba}${bb}`, element: null, kind: "六合", branches: [ba, bb] });
    if (isPair(CHU, ba, bb)) push({ level: 0, label: `冲${ba}${bb}`, element: null, kind: "冲", branches: [ba, bb] });
  }
  return rel;
}

/** ある柱の地支に掛かる地支関係を全件返す（化格の月支関係表示用。内格点数の優先順位で下位を消さない） */
export function branchRelationsOf(p: Pillars, pillar: PillarKey): { kind: RelationKind; branches: readonly Branch[] }[] {
  return (collectRelations(p).get(pillar) ?? []).map(({ kind, branches }) => ({ kind, branches }));
}

export function branchStates(p: Pillars): BranchState[] {
  const slots = slotsOf(p);
  const rel = collectRelations(p);
  return slots.map((s): BranchState => {
    const list = rel.get(s.pillar)!;
    const notes: string[] = [];
    let transformedTo: Element | null = null;
    let decay = 1;
    const top = list.length ? Math.max(...list.map((x) => x.level)) : -1;
    if (top >= 2) {
      // 化: 月支は三合のときだけ
      const canTransform = list.filter((x) => x.level === top && (s.pillar !== "月" || x.kind === "三合"));
      const els = [...new Set(canTransform.map((x) => x.element!))];
      if (els.length === 1) transformedTo = els[0];
      else if (els.length > 1) notes.push(`化五行が複数（${els.join("・")}）のため化さない`);
    } else if (top === 1) {
      decay = 0.5 ** list.filter((x) => x.level === 1).length;
    } else if (top === 0) {
      decay = 0.5 ** list.filter((x) => x.level === 0).length;
    }
    return { pillar: s.pillar, branch: s.branch, relations: list.map((x) => x.label), transformedTo, decay, notes };
  });
}

/** 地支1つから対象五行 T が受ける点（坐支を含む。減衰後） */
function branchPoints(state: BranchState, target: Element, sittingStem: Stem | null): number {
  const month = state.pillar === "月" ? 1.5 : 1;
  const items: { el: Element; main: boolean; factor: number }[] = [];
  if (state.transformedTo) {
    items.push({ el: state.transformedTo, main: true, factor: 1 });
    for (const s of otherQiStems(state.branch)) items.push({ el: STEM_ELEMENT[s], main: false, factor: 1 / 3 });
  } else {
    items.push({ el: STEM_ELEMENT[mainQiStem(state.branch)], main: true, factor: 1 });
    for (const s of otherQiStems(state.branch)) items.push({ el: STEM_ELEMENT[s], main: false, factor: 1 });
  }
  let pts = 0;
  for (const it of items) {
    const base = it.el === target ? (it.main ? 4 : 2) : generates(it.el, target) ? (it.main ? 2 : 1) : 0;
    pts += base * it.factor * month;
  }
  if (sittingStem) {
    const mainEl = state.transformedTo ?? BRANCH_ELEMENT[state.branch];
    const t = STEM_ELEMENT[sittingStem];
    if (mainEl === t) pts += 1;
    else if (generates(mainEl, t)) pts += 0.5;
  }
  return pts * state.decay;
}

function isKango(a: Stem, b: Stem): boolean {
  return KANGO.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function calculateInnerScore(p: Pillars, referenceOnly: boolean): InnerPatternScore {
  const slots = slotsOf(p);
  const states = branchStates(p);

  // 隣接天干
  const adjacent = new Map<PillarKey, number>(slots.map((s) => [s.pillar, 0]));
  for (const [a, b] of adjacentPairs(p)) {
    const sa = p[a]!.stem;
    const sb = p[b]!.stem;
    const ea = STEM_ELEMENT[sa];
    const eb = STEM_ELEMENT[sb];
    if (generates(ea, eb)) {
      adjacent.set(a, adjacent.get(a)! - 2);
      adjacent.set(b, adjacent.get(b)! + 2);
    } else if (generates(eb, ea)) {
      adjacent.set(b, adjacent.get(b)! - 2);
      adjacent.set(a, adjacent.get(a)! + 2);
    } else if ((controls(ea, eb) || controls(eb, ea)) && !isKango(sa, sb)) {
      adjacent.set(a, adjacent.get(a)! - 2);
      adjacent.set(b, adjacent.get(b)! - 2);
    }
  }

  const byStem = slots.map((s) => {
    const el = STEM_ELEMENT[s.stem];
    const fromBranches = states.reduce((sum, st) => sum + branchPoints(st, el, st.pillar === s.pillar ? s.stem : null), 0);
    const adj = adjacent.get(s.pillar)!;
    return { pillar: s.pillar, stem: s.stem, total: fromBranches + adj, fromBranches, adjacent: adj };
  });

  // 五行別: その五行の天干の点の合計。天干に出ていない五行は地支から受ける点（坐支・隣接天干なし）
  const branchOnlyEls = new Set<Element>(
    states.flatMap((st) => [
      ...(st.transformedTo ? [st.transformedTo] : [BRANCH_ELEMENT[st.branch]]),
      ...otherQiStems(st.branch).map((s) => STEM_ELEMENT[s]),
    ]),
  );
  const byElement = Object.fromEntries(
    ELEMENTS.map((e) => {
      const stems = byStem.filter((x) => STEM_ELEMENT[x.stem] === e);
      if (stems.length) return [e, stems.reduce((sum, x) => sum + x.total, 0)];
      if (branchOnlyEls.has(e)) return [e, states.reduce((sum, st) => sum + branchPoints(st, e, null), 0)];
      return [e, 0];
    }),
  ) as Record<Element, number>;

  const dayEl = STEM_ELEMENT[p.日.stem];
  const supportEls = [dayEl, inElementOf(dayEl)];
  const weakEls = ELEMENTS.filter((e) => !supportEls.includes(e));
  const sum = (els: Element[]) => els.reduce((s, e) => s + byElement[e], 0);

  // 内格補助の判定軸（KD17）: 日干単独点ではなく、比劫＋印 対 食傷＋財＋官
  const sup = sum(supportEls);
  const weak = sum(weakEls);
  const judgment = sup > weak ? "身強" : sup < weak ? "身弱" : "境界";

  // 比劫・印の配置（根拠表示）
  const goshinOf = (e: Element) => (e === dayEl ? "比劫" : "印");
  const helps: string[] = [];
  for (const s of slots) {
    const st = states.find((x) => x.pillar === s.pillar)!;
    const stemEl = STEM_ELEMENT[s.stem];
    const brEl = st.transformedTo ?? BRANCH_ELEMENT[s.branch];
    const stemHelp = supportEls.includes(stemEl) && s.pillar !== "日";
    const brHelp = supportEls.includes(brEl);
    const decay = st.decay < 1 ? ` ※${st.relations.filter((r) => !r.startsWith("三") && !r.startsWith("半")).join("・")}で×${st.decay}` : "";
    const via = st.transformedTo && st.transformedTo !== BRANCH_ELEMENT[s.branch] ? `（${st.relations.join("・")}で${st.transformedTo}）` : "";
    if (stemHelp && brHelp && stemEl === brEl) {
      helps.push(`${s.pillar}柱 ${s.stem}${s.branch}＝${stemEl}（${goshinOf(stemEl)}）${decay}`);
      continue;
    }
    if (stemHelp) helps.push(`${s.pillar}干 ${s.stem}＝${stemEl}（${goshinOf(stemEl)}）`);
    if (brHelp) helps.push(`${s.pillar}支 ${s.branch}＝${brEl}（${goshinOf(brEl)}）${via}${decay}`);
  }
  // 比劫・印の五行の三合・三会・半合・半会（月支は三合でのみ化す）
  const seen = new Set<string>();
  for (const st of states) {
    for (const rel of st.relations) {
      if (!/^(三合|三会|半合|半会)/.test(rel) || seen.has(rel)) continue;
      const el = supportEls.find((e) => rel.includes(`${e}局`) || states.some((x) => x.relations.includes(rel) && x.transformedTo === e));
      if (!el) continue;
      seen.add(rel);
      const month = states.find((x) => x.pillar === "月" && x.relations.includes(rel));
      const label = /^(半合|半会)/.test(rel) ? `${rel.slice(2)}${rel.slice(0, 2)}（${el}）` : rel;
      helps.push(`${label}による${el}の助け${month && !rel.startsWith("三合") ? "（月支は化さない）" : ""}`);
    }
  }

  return {
    system: "inner-pattern-scoring",
    judgment,
    helps,
    dayMaster: { stem: p.日.stem, points: byStem.find((x) => x.pillar === "日")!.total },
    supportingSide: { elements: supportEls, points: sum(supportEls) },
    weakeningSide: { elements: weakEls, points: sum(weakEls) },
    byElement,
    byStem,
    branchStates: states,
    assumptions: [
      "各天干は命式の全地支から点を受ける（IS-U2）",
      "天干に出ていない五行は、地支から受ける点（坐支・隣接天干なし）で集計",
      "上位の地支関係（三合・三会・半合・半会）が成立した地支には六合・冲の減衰をかけない。六合があれば冲は使わない",
    ],
    referenceOnly,
  };
}
