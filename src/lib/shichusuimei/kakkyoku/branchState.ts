// src/lib/shichusuimei/kakkyoku/branchState.ts
//
// 地支関係と化の判定（KD13・KD14 の確定ロジック）。秀山式内格力量判定法（elementForce.ts・KD27）と
// 化格の月支関係（hehua.ts）が使う共通処理。
//
//   地支関係の優先: 三合＝三会 ＞ 半合＝半会 ＞ 六合 ＞ 冲
//     三合・三会: 命式内でそろえば成立（隣接不要）
//     半合: 三合局の旺支（子午卯酉）を含む2支で、隣接している場合だけ化す（申辰・亥未・寅戌・巳丑は旺支を欠くので半合にしない）。
//           月支も例外にせず、旺支を含む隣接の半合なら化す（KD13-12。2026-10-14 監修確定）。
//           争合・双合: 半合の成立は隣接で見るが、安定性は命式全体で見る。半合の一方と同じ支が命式の別の位置にもあり、
//           同じ相手を取り合うときは化さない。競合する支は隣接していなくてよい（例: 年支申・月支申・日支子 → 子を2つの申が取り合う。KD13-13）
//     半会: 隣接のみ。月支は半会・三会では化さない（現行のまま）
//     六合・冲: 隣接のみ。関係として記録するだけで、力量の減衰には使わない（KD27-8）

import { SHIGO, CHU } from "../data";
import type { Branch, Element, PillarKey } from "../types";
import type { BranchState, Pillars } from "./types";
import { adjacentPairs, completeSango, completeSankai, hangoElement, hankaiElement, slotsOf } from "./common";

function isPair(table: readonly (readonly [Branch, Branch])[], a: Branch, b: Branch): boolean {
  return table.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

interface Level {
  level: number; // 3: 三合・三会 / 2: 半合・半会 / 1: 六合 / 0: 冲
  label: string;
  /** 化五行（六合・冲・争合の半合は null で、化には使わない） */
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
  // 争合（KD13-13）: 半合の一方と同じ支が、半合の2支以外の位置（隣接は問わない）にもある
  const duplicatedElsewhere = (a: PillarKey, b: PillarKey) =>
    slots.some((x) => x.pillar !== a && x.pillar !== b && (x.branch === p[a]!.branch || x.branch === p[b]!.branch));
  for (const [a, b] of adjacentPairs(p)) {
    const ba = p[a]!.branch;
    const bb = p[b]!.branch;
    const push = (x: Level) => {
      rel.get(a)!.push(x);
      rel.get(b)!.push(x);
    };
    const hg = hangoElement(ba, bb);
    if (hg) {
      const contested = duplicatedElsewhere(a, b);
      push({ level: 2, label: `半合${ba}${bb}${contested ? "（争合）" : ""}`, element: contested ? null : hg, kind: "半合", branches: [ba, bb] });
    }
    const hk = hankaiElement(ba, bb);
    if (hk) push({ level: 2, label: `半会${ba}${bb}`, element: hk, kind: "半会", branches: [ba, bb] });
    if (isPair(SHIGO, ba, bb)) push({ level: 1, label: `六合${ba}${bb}`, element: null, kind: "六合", branches: [ba, bb] });
    if (isPair(CHU, ba, bb)) push({ level: 0, label: `冲${ba}${bb}`, element: null, kind: "冲", branches: [ba, bb] });
  }
  return rel;
}

/** ある柱の地支に掛かる地支関係を全件返す（化格の月支関係表示用。優先順位で下位を消さない） */
export function branchRelationsOf(p: Pillars, pillar: PillarKey): { kind: RelationKind; branches: readonly Branch[] }[] {
  return (collectRelations(p).get(pillar) ?? []).map(({ kind, branches }) => ({ kind, branches }));
}

/** 各地支の関係と化（三合・三会・半合・半会で化す。月支は三合・半合のときだけ：KD13-12） */
export function branchStates(p: Pillars): BranchState[] {
  const slots = slotsOf(p);
  const rel = collectRelations(p);
  return slots.map((s): BranchState => {
    const list = rel.get(s.pillar)!;
    const notes: string[] = [];
    let transformedTo: Element | null = null;
    const top = list.length ? Math.max(...list.map((x) => x.level)) : -1;
    if (top >= 2) {
      // 化: 月支は三合・半合（旺支を含む隣接の2支）のときだけ。半会・三会では化さない（KD13-12）
      //   三合: 月支は三合だけを見る（従来どおり）
      //   半合: 他の地支と同じく同じ段階の関係（半会を含む）で化五行が1つに決まり、それが半合の五行のときだけ化す
      const sameLevel = list.filter((x) => x.level === top && x.element !== null); // 争合の半合は化に使わない
      const canTransform = s.pillar !== "月" ? sameLevel : top === 3 ? sameLevel.filter((x) => x.kind === "三合") : sameLevel;
      const els = [...new Set(canTransform.map((x) => x.element!))];
      const monthOk = s.pillar !== "月" || top === 3 || sameLevel.some((x) => x.kind === "半合" && x.element === els[0]);
      if (els.length === 1 && monthOk) transformedTo = els[0];
      else if (els.length > 1) notes.push(`化五行が複数（${els.join("・")}）のため化さない`);
      const contested = list.filter((x) => x.level === top && x.kind === "半合" && x.element === null).map((x) => x.label);
      if (contested.length && transformedTo === null) notes.push(`${contested.join("・")}は争合のため化さない（KD13-13）`);
    }
    return { pillar: s.pillar, branch: s.branch, relations: list.map((x) => x.label), transformedTo, notes };
  });
}
