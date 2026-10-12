// src/lib/ziwei/fortune/palaceMap.ts
//
// 行運十二宮。ある宮を命宮として十二宮を配置し直したときの宮名（大限命宮・大限夫妻宮 など）。
// docs/ziwei-basic-spec.md §27.4。本命の十二宮配置（arrangePalaces: 命宮から逆行に兄弟→夫妻→…→父母）をそのまま使う。
// 例: 基礎２ S38 の戊辰の大限「大限夫妻宮（父母宮）」… 大限命宮 辰 → 大限夫妻宮 寅（本命の父母宮）。

import { arrangePalaces } from "../palaces";
import type { Branch, PalaceName, ZiweiChart } from "../types";

export interface FortunePalaceEntry {
  branch: Branch;
  /** 行運の宮名（基準宮＝命宮として配置し直した名） */
  fortunePalace: PalaceName;
  /** 本命盤の宮名 */
  natalPalace: PalaceName;
}

/** 基準宮（大限宮・小限宮）を命宮として十二宮を配置し直す（命宮から順に12件） */
export function fortunePalaceMap(chart: ZiweiChart, baseBranch: Branch): FortunePalaceEntry[] {
  return arrangePalaces(baseBranch).map((p) => ({
    branch: p.branch,
    fortunePalace: p.name,
    natalPalace: chart.palaces.find((x) => x.branch === p.branch)!.name,
  }));
}

/** 行運十二宮で、ある支の宮名 */
export function fortunePalaceNameOf(map: readonly FortunePalaceEntry[], branch: Branch): PalaceName {
  return map.find((e) => e.branch === branch)!.fortunePalace;
}
