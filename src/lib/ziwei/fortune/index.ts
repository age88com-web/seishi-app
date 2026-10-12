// src/lib/ziwei/fortune/index.ts
//
// 行運四化（大限四化・小限四化）の独立レイヤー。docs/ziwei-basic-spec.md §26。
// 生年四化・本命格局・力量・印刷は変更しない。鑑定日の行運コンテキスト（§27）: 太歳宮・行運十二宮・行運格局（3格）。解釈文は次工程。

export {
  majorLimitTransformations,
  minorLimitTransformations,
  natalTransformations,
  transformationsForStem,
  transformationLayersByBranch,
  kazoeAgeOn,
} from "./limitTransformations";
export { STEM_XIJI, STEM_XIJI_SOURCE, LIMIT_TYPES_SOURCE } from "./xiji";
export { palaceStemOf, palaceStemsOf } from "../palaceStems";
export { fortunePalaceMap, fortunePalaceNameOf } from "./palaceMap";
export type { FortunePalaceEntry } from "./palaceMap";
export { taiseiOf, TAISEI_YEAR_BOUNDARY } from "./taisei";
export { buildTaiseiInfluence, taiseiRelationOf, TAISEI_RELATION_LABEL } from "./taiseiInfluence";
export type { TaiseiInfluence, TaiseiInfluenceInput, TaiseiOverlap, TaiseiPalaceContents, TaiseiPalaceRef, TaiseiRelation } from "./taiseiInfluence";
export { evaluateLiunian, natalMatchedPatterns, LIUNIAN_DEFINITION, YANGTUO_LIUNIAN_SOURCE, YANGTUO_LIUNIAN_TEXT } from "./liunian";
export type { LiunianContext, LiunianEffect, YangtuoLiunianCandidate } from "./liunian";
export { calcYearFortuneIndex, buildYearFortuneIndexSeries, YEAR_INDEX_FORMULA } from "./yearIndex";
export type { YearFortuneIndex, YearIndexStatus } from "./yearIndex";
export { evaluateLimitXiji, fortuneTypeOf, XIJI_RULES, XIJI_SOURCE, FORTUNE_TYPE_SOURCE, FORTUNE_TYPE_READINGS } from "./xijiEvaluate";
export type { LimitXijiResult, XijiRule, FortuneType, FortuneTypeReading, FortuneTypeResult } from "./xijiEvaluate";
export type { TaiseiContext } from "./taisei";
export { evaluateFortunePatterns } from "./patterns";
export type { FortunePatternResult, FortunePalaceRef, FormationBasis } from "./patterns";
export { buildFortuneContext, buildFortuneContextFor, buildFortunePalaceContext, parseAppraisalDate, todayInJapan } from "./context";
export { selectionFromDate, withMajor, withMinor, minorAgeOptions } from "./selection";
export type { FortuneSelection } from "./selection";
export type { FortuneContext, FortunePalaceContext, MajorLimitStatus } from "./context";
export type * from "./types";
