// src/lib/ziwei/meanings/fortune-transformations/types.ts
//
// 行運四化象意（大限四化・小限四化の象意）の型。docs/ziwei-basic-spec.md §30。

import type { Branch, PalaceName, PlacedStar, TransformationKind } from "../../types";

export type TransformationType = "化禄" | "化権" | "化科" | "化忌";

/**
 * 文の出どころの種類
 *   fortune-explicit       … 資料が大限・小限（行運）について明示した四化の文
 *   generic-transformation … 四化そのものの一般的な象意（行運・本命を問わない星の定義）
 */
export type TransformationSourceScope = "fortune-explicit" | "generic-transformation";

export interface TransformationSourceRef {
  source: string;
  /** 印刷ページ（入門）またはスライド番号（基礎２） */
  page: string;
  section: string;
  /** stars.json などの既存データの ID（ある場合） */
  sourceId?: string;
}

export interface TransformationText {
  /** 表示する文（資料の意味の範囲で書き直した独自文章。§35） */
  text: string;
  sourceScope: TransformationSourceScope;
  sourceRef: TransformationSourceRef;
  /** 画面に出すか（false は資料として保持するだけ） */
  display: boolean;
  note?: string;
}

/** 行運についての明示文（適用する行運と条件つき） */
export interface FortuneTransformationText extends TransformationText {
  sourceScope: "fortune-explicit";
  /** 資料が明示した行運だけ（大限・小限を共通にする記述がなければ共通にしない） */
  appliesTo: ("major" | "minor")[];
  /** natalMing … クリックした宮が本命（天盤）の命宮 */
  condition: { kind: "natalMing"; phrase: string } | null;
}

export interface TransformationMeaning {
  type: TransformationType;
  star: TransformationKind;
  /** 一般象意（大限・小限で共通に参照する） */
  coreMeanings: TransformationText[];
  /** 行運の明示文 */
  fortuneTexts: FortuneTransformationText[];
  /** 本命命宮専用の人物解釈など、行運に流用しない文（記録だけ） */
  excludedSourceIds: string[];
}

/** 監査で見つけた行運の四化の文のうち、このレイヤーで使わないもの（記録） */
export interface ExcludedFortuneText {
  /** 資料の記述の要約（原文は持たない） */
  text: string;
  sourceRef: TransformationSourceRef;
  /** pattern … 行運格局の層、xiji … 四化と宮の喜忌（S36・S40）、example … 命盤例の記述、taisei … 太歳、calculation … 計算法 */
  reason: "pattern" | "xiji" | "example" | "taisei" | "calculation";
  note: string;
}

export interface EvaluatedTransformationMeaning {
  origin: "major" | "minor";
  /** 四化の付いた星 */
  star: PlacedStar;
  type: TransformationType;
  /** 盤面と同じ表記（大禄・小忌 など） */
  label: string;
  /** 表示する一般象意 */
  coreMeanings: string[];
  /** 表示する行運明示文（条件が成立したものだけ） */
  fortuneTexts: string[];
}

export interface FortuneTransformationSection {
  origin: "major" | "minor";
  branch: Branch;
  natalPalace: PalaceName;
  items: EvaluatedTransformationMeaning[];
}
