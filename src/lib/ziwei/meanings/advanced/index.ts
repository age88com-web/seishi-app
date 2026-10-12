// src/lib/ziwei/meanings/advanced/index.ts
//
// 応用編・144命宮配置解釈（独立レイヤー。基礎の象意DB・資料ベース解釈とは混ぜない）。docs/ziwei-basic-spec.md §24。

export { ADVANCED_ITEMS, ADVANCED_SOURCE_META, ADVANCED_SOURCE_LABEL, getAdvancedItem } from "./data";
export { getAdvancedInterpretation, evaluateAdvancedInterpretation, checkStructure } from "./evaluate";
export { evaluateCondition, combine } from "./conditions";
export type * from "./types";
