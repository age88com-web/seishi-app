// src/lib/ziwei/meanings/fortune-transformations/index.ts
//
// 行運四化象意（大限四化・小限四化の象意）。docs/ziwei-basic-spec.md §30。

export { TRANSFORMATION_MEANINGS, EXCLUDED_FORTUNE_TEXTS, TRANSFORMATION_TYPES } from "./data";
export { transformationMeaningOf, buildFortuneTransformationSection, buildFortuneTransformationContext } from "./interpretation";
export type * from "./types";
