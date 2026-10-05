// src/lib/liuren/interpretation/branchAdjacency.ts
//
// 役割（Phase 5A で追加した最小の中立 FACT）:
//   支の両隣（十二支の順で一つ前・一つ後）。天地盤は十二支の順を保ったまま回すだけなので、
//   天盤で支 b の両隣に来る天盤支も、常に b の一つ前・一つ後の支になる。
//   『六壬断案２』例51「寅上辰は年命であり、昼夜貴人がこれをはさむ」（原文）の「はさむ」を表すためのもの。
//   意味・吉凶は持たない。

import { shiftBranch } from "../relations";
import type { Branch } from "../types";

/** 支の両隣（一つ前・一つ後） */
export function flankingBranchesOf(branch: Branch): readonly [Branch, Branch] {
  return [shiftBranch(branch, -1), shiftBranch(branch, 1)];
}

/** 支が、2つの支に両側からはさまれているか（順不同） */
export function isFlankedBy(branch: Branch, a: Branch, b: Branch): boolean {
  const [prev, next] = flankingBranchesOf(branch);
  return (prev === a && next === b) || (prev === b && next === a);
}
