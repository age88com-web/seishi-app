// src/lib/ziwei/patterns/index.ts
//
// 格局判定（基礎２ 本編33格）の公開窓口。docs/ziwei-basic-spec.md §23.4。
// 作盤・旺衰・四化・三方四正・力量・象意の各モジュールは変更せず、結果を参照するだけ。

export { evaluatePatterns, patternCautions, PATTERN_SOURCE_TEXT, CLASSICAL_REFERENCE_PATTERNS } from "./evaluate";
export type { ClassicalReferencePattern } from "./evaluate";
export { PATTERN_RULES } from "./data";
export { STAR_LUCK, LUCK_SOURCE, isLucky, isMalefic } from "./luck";
export type { LuckClass } from "./luck";
export { viewOf } from "./chartView";
export type * from "./types";
export { PATTERN_MEANINGS, ALL_PATTERN_MEANING_TEXTS, resolvePatternMeaning } from "./meanings";
export type { PatternMeaningItem, PatternMeaningEntry, ResolvedPatternMeaning, MeaningCondition, MeaningScope, FortuneMeaningContext } from "./meanings";
