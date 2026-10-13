// src/lib/shichusuimei/kakkyoku/branchState.ts
//
// 地支関係と化の判定（KD13・KD14 の確定ロジック）。秀山式内格力量判定法（elementForce.ts・KD27）と
// 化格の月支関係（hehua.ts）が使う共通処理。
//
//   地支関係の優先: 三合＝三会 ＞ 半合＝半会 ＞ 六合 ＞ 冲
//     三合・三会: 命式内でそろえば成立（隣接不要）
//     半合（旺支を含む）・半会: 隣接のみ。月支は三合でのみ化す
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

/** ある柱の地支に掛かる地支関係を全件返す（化格の月支関係表示用。優先順位で下位を消さない） */
export function branchRelationsOf(p: Pillars, pillar: PillarKey): { kind: RelationKind; branches: readonly Branch[] }[] {
  return (collectRelations(p).get(pillar) ?? []).map(({ kind, branches }) => ({ kind, branches }));
}

/** 各地支の関係と化（三合・三会・半合・半会で化す。月支は三合のときだけ） */
export function branchStates(p: Pillars): BranchState[] {
  const slots = slotsOf(p);
  const rel = collectRelations(p);
  return slots.map((s): BranchState => {
    const list = rel.get(s.pillar)!;
    const notes: string[] = [];
    let transformedTo: Element | null = null;
    const top = list.length ? Math.max(...list.map((x) => x.level)) : -1;
    if (top >= 2) {
      // 化: 月支は三合のときだけ
      const canTransform = list.filter((x) => x.level === top && (s.pillar !== "月" || x.kind === "三合"));
      const els = [...new Set(canTransform.map((x) => x.element!))];
      if (els.length === 1) transformedTo = els[0];
      else if (els.length > 1) notes.push(`化五行が複数（${els.join("・")}）のため化さない`);
    }
    return { pillar: s.pillar, branch: s.branch, relations: list.map((x) => x.label), transformedTo, notes };
  });
}
