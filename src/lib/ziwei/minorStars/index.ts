// src/lib/ziwei/minorStars/index.ts
//
// 紫微斗数の新規諸星（既存34星以外）。正本: 紫微諸星.pdf・紫微諸星１.pdf・表9 時系諸星表（追加画像）。
// docs/ziwei-basic-spec.md §37。本命盤の表示と基本象意だけに使い、力量（運命指数）・格局判定には入れない。

export * from "./types";
export { MINOR_STARS, MINOR_STAR_BY_ID, IMPLEMENTED_MINOR_STARS, minorStarDef, findMinorStarsByName } from "./master";
export {
  calculateMinorStars,
  hourMinorStarsOf,
  monthMinorStarsOf,
  dayMinorStarsOf,
  stemMinorStarsOf,
  branchMinorStarsOf,
  shangShiOf,
  jiekongOf,
  xunkongOf,
  changshengOf,
  boshiOf,
  mingShenZhuOf,
  isForwardYinYang,
} from "./place";
export { MINOR_STAR_MEANINGS, MINOR_STAR_MEANING_BY_ID } from "./meanings";
export type { MinorStarMeaning } from "./meanings";
export { EXISTING_STAR_META, existingStarInventory } from "./existingStars";
export type { ExistingStarMeta, ExistingStarInventoryRow } from "./existingStars";
