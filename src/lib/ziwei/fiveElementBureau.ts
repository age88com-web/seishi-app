// src/lib/ziwei/fiveElementBureau.ts
//
// §6 五行局（表5）・§7 紫微星（表6）。どちらも表のまま引く。

import type { Branch, Bureau, Stem } from "./types";
import { BUREAUS, BUREAU_TABLE, branchIndex, stemIndex, ziweiTableLookup } from "./data";

/** §6 生年干（陰暦年の干）と命宮支から五行局。 */
export function fiveElementBureauOf(yearStem: Stem, mingPalace: Branch): Bureau {
  const name = BUREAU_TABLE[stemIndex(yearStem) % 5][Math.floor(branchIndex(mingPalace) / 2)];
  return BUREAUS[name];
}

/** §7 五行局と陰暦生日から紫微星の宮。 */
export function ziweiStarOf(bureau: Bureau, lunarDay: number): Branch {
  return ziweiTableLookup(bureau.name, lunarDay);
}
