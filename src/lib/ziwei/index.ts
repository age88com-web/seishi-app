// src/lib/ziwei/index.ts
//
// 紫微斗数 Phase 1（作盤計算）の公開窓口。
// 正本: docs/ziwei-basic-spec.md
// 範囲: 出生時刻補正・作盤日・固定UTC+8基準の陰暦・閏月の前半後半・年干支・命宮・身宮・十二宮・
//       五行局・紫微星・34星（十四主星・時系・月系・年干系・四化・年支系）・大限・小限。
// 旺衰（廟旺利陥）は星名＋地支の参照のみ（strength.ts。作盤には使わない）。
// 範囲外: 吉凶判断・宮や星の解釈・流年判断・命盤B（基礎編S19）のみの項目（U11〜U13）・UI・印刷。
// 出生地は日本国内のみ（§2.7 旧U18）。大限は資料の表14の範囲だけ（§18 U8）。

export { calculateZiweiChart } from "./chart";
export { correctBirthTime, isSummerTime, longitudeOffsetSeconds, JST_MERIDIAN_DEGREES } from "./timeCorrection";
export {
  LUNAR_TIME_ZONE,
  resolveChartDate,
  lunarDateOf,
  judgeLeapHalf,
  birthMonthOf,
  yearGanzhi,
  kazoeAge,
} from "./lunisolar";
export { hourBranchOf, mingPalaceOf, shenPalaceOf, arrangePalaces } from "./palaces";
export { fiveElementBureauOf, ziweiStarOf } from "./fiveElementBureau";
export { mainStarsOf, hourStarsOf, monthStarsOf, yearStemStarsOf, yearBranchStarsOf, placeStars } from "./stars";
export { transformationsOf } from "./transformations";
export { dayunOf, dayunAt } from "./dayun";
export { xiaoxianOf, xiaoxianAt } from "./xiaoxian";
export { sanfangSizheng } from "./sanfang";
export type { Sanfang } from "./sanfang";
export { STAR_STRENGTH, STAR_STRENGTHS, STRENGTH_SHORT, SOURCE_STRENGTH_CHAR, starStrengthOf } from "./strength";
/** 星の力量・宮の運命指数（§22。旺衰とは別の規則） */
export {
  POWER_TABLE,
  POWER_TABLE_NYUMON,
  POWER_TABLE_KISO,
  POWER_STARS,
  POWER_IGNORED_STARS,
  POWER_SOURCE_REFS,
  POWER_GRADES,
  POWER_GRADE_KISO_LABEL,
  isPowerStar,
  starPowerOf,
  powerGradeOf,
  calculateChartPower,
} from "./power";
export type { PowerStar, PowerGrade, StarPowerEntry, PalacePower, ChartPower, PowerSourceRef } from "./power";
export {
  TABLE2_OFFSET_SECONDS,
  TABLE2_PLACES,
  SUMMER_TIME_PERIODS,
  PALACE_NAMES,
  MAIN_STARS,
  PLACED_STARS,
  TRANSFORMATION_KINDS,
  YEAR_STEM_STAR_TABLE,
  BUREAU_TABLE,
  BUREAUS,
  ziweiTableLookup,
  transformationTarget,
} from "./data";
export type * from "./types";
