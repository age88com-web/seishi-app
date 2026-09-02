// src/lib/types.ts
//
// プロジェクト共通の軽量型のみを置く。ロジック・データは持たない。

/**
 * 天体・感受点の1点。黄経は 0〜360 度。
 * ChartSVG / kakkyoku_engine が共有する。
 */
export type BodyPoint = {
  id: string;
  label: string;
  lonDeg: number; // 0-360
};
