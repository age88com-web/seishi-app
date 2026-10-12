// src/lib/ziwei/fortune/types.ts
//
// 行運四化（大限四化・小限四化）の型。docs/ziwei-basic-spec.md §26。

import type { Branch, DayunPeriod, PalaceName, PlacedStar, Stem, TransformationKind } from "../types";

/** 四化の層。生年（本命）・大限・小限は別の層として持ち、統合しない */
export type TransformationOrigin = "natal" | "major" | "minor";

/** 本命盤の星に付く四化1つ（星は動かさない。その星がある本命盤の宮に付く） */
export interface LayeredTransformation {
  origin: TransformationOrigin;
  kind: TransformationKind;
  star: PlacedStar;
  /** 四化の付いた星がある本命盤の宮 */
  branch: Branch;
  palace: PalaceName;
}

export interface LimitTransformations {
  limitType: "major" | "minor";
  /** 大限の年齢範囲（数え年） */
  ageRange: [number, number] | null;
  /** 小限の数え年 */
  age: number | null;
  /** 行運が巡る宮（本命盤の宮） */
  palaceBranch: Branch;
  palaceName: PalaceName;
  /** その宮の天干（五虎遁。palaceStemOf） */
  palaceStem: Stem;
  /** 化禄・化権・化科・化忌の4つ（既存の四化表 transformationTarget） */
  transformations: LayeredTransformation[];
}

export type MajorLimitInput = { period: DayunPeriod } | { age: number };
