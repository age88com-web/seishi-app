// src/lib/ziwei/meanings/store.ts
//
// 象意データ（data/*.json）の読み込みと、星・宮・四化・星×宮・組み合わせ・テーマ単位の検索。
// docs/ziwei-basic-spec.md §21。公開窓口は index.ts。

import type { PalaceName } from "../types";
import starsData from "./data/stars.json";
import palacesData from "./data/palaces.json";
import transformationsData from "./data/transformations.json";
import starPalaceData from "./data/starPalace.json";
import combinationsData from "./data/combinations.json";
import themesData from "./data/themes.json";
import metaData from "./data/meta.json";
import type {
  CombinationMeaning,
  MeaningsMeta,
  PalaceMeaning,
  StarMeaning,
  StarMeaningCategory,
  StarPalaceMeaning,
  ThemeMeaning,
  ThemeName,
  TransformationMeaning,
  ZiweiStarName,
} from "./types";

export const STAR_MEANINGS = starsData as StarMeaning[];
export const PALACE_MEANINGS = palacesData as PalaceMeaning[];
export const TRANSFORMATION_MEANINGS = transformationsData as TransformationMeaning[];
export const STAR_PALACE_MEANINGS = starPalaceData as StarPalaceMeaning[];
export const COMBINATION_MEANINGS = combinationsData as CombinationMeaning[];
export const THEME_MEANINGS = themesData as ThemeMeaning[];
export const MEANINGS_META = metaData as MeaningsMeta;

/** 星の象意（命宮・イメージ・大限小限など）。palace を指定すると命宮の記述などに絞る */
export function getStarMeanings(
  star: ZiweiStarName,
  opts: { category?: StarMeaningCategory; palace?: PalaceName | null } = {},
): StarMeaning[] {
  return [...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS].filter(
    (e) =>
      e.stars.includes(star) &&
      (opts.category === undefined || e.category === opts.category) &&
      (opts.palace === undefined || (e.palace ?? null) === opts.palace),
  );
}

/** 宮そのものの意味（何を見る宮か・注意点） */
export function getPalaceMeanings(palace: PalaceName | "身宮"): PalaceMeaning[] {
  return PALACE_MEANINGS.filter((e) => e.palace === palace);
}

/** 四化の象意 */
export function getTransformationMeanings(kind: ZiweiStarName): TransformationMeaning[] {
  return TRANSFORMATION_MEANINGS.filter((e) => e.stars.includes(kind));
}

/** 星が宮に入ったときの資料の記述（命宮は getStarMeanings(star, { palace: "命宮" })） */
export function getStarPalaceMeanings(star: ZiweiStarName, palace: PalaceName): StarPalaceMeaning[] {
  return STAR_PALACE_MEANINGS.filter((e) => e.stars.includes(star) && e.palace === palace);
}

/** 指定した星をすべて含む、資料に明記された組み合わせ */
export function getCombinationMeanings(stars: ZiweiStarName[]): CombinationMeaning[] {
  return COMBINATION_MEANINGS.filter((e) => stars.every((s) => e.stars.includes(s)));
}

export function getThemeMeanings(theme: ThemeName): ThemeMeaning[] {
  return THEME_MEANINGS.filter((e) => e.theme === theme);
}

