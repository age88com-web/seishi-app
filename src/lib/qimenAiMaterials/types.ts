// src/lib/qimenAiMaterials/types.ts
//
// 役割:
//   AI 入力専用データ（serializeQimenAiInput の戻り値）の型定義。
//   値は qimenMaterials（buildQimenPalaceMaterials）の出力を分類し直して ID を付けただけで、
//   要約・言い換え・補完・吉凶の変更は行わない。
//
// 追跡性:
//   全項目に一意の id と materialPath（buildQimenPalaceMaterials の出力内の位置）を持たせ、
//   将来の文章のどの記述がどの入力材料に基づくかを後から辿れるようにする。

import type { MaterialSource } from "@/lib/qimenMaterials";

/** 材料の由来の種別。 */
export type AiMaterialOrigin = "排盤計算結果" | "既存データ";

interface AiItemBase {
  /** 同一出力内で一意の ID（例: KOKUO-001） */
  id: string;
  /** buildQimenPalaceMaterials の出力内の位置（例: kokuo.sankiTokyu[0]） */
  materialPath: string;
  origin: AiMaterialOrigin;
  /** 既存データが持つ出典（無ければ null。新しく作らない） */
  source: MaterialSource | null;
}

/** A. 盤の事実（排盤計算結果の値そのもの）。 */
export interface AiChartFact extends AiItemBase {
  label: string;
  value: string | number | boolean;
}

/** B. 単体象意（その宮の要素の既存象意データそのもの）。 */
export interface AiSingleMeaning extends AiItemBase {
  role: "八門" | "九星" | "八神" | "天盤干" | "地盤干";
  element: string;
  kind: string;
  content: unknown;
}

/** C. 成立している剋應（既存検索の結果そのもの）。 */
export interface AiKokuo extends AiItemBase {
  /** 剋應の種類（qimenMaterials の dataset 名） */
  kokuoType: string;
  /** KokuoEntry.id（元データの id）。九星値時剋應の星別総論は元データに id が無いため null */
  entryId: string | null;
  key: Record<string, string>;
  name: string | null;
  mode: "静應" | "動應" | null;
  sourceTradition: string | null;
  fortuneRaw: string | null;
  /** 判断本文（元データの body から独立したルビ行だけを除いたもの。ruby.ts 参照） */
  body: string;
  /** body から除いたルビ行（元の文字列のまま）。元の本文は materialPath から辿れる */
  rubyLinesRemoved: string[];
  /** 元データの付属項目のうち、判断本文と別フィールドで保存されているもの（値そのまま） */
  details: Record<string, unknown>;
  /** 元データで本文と別フィールドに分けて保存されている注記（値そのまま。無ければ null） */
  notes: string | null;
}

/** D/E. 成立している格局。 */
export interface AiKaku extends AiItemBase {
  category: "吉格" | "凶格";
  name: string;
  scope: "palace" | "whole_chart" | "scope判定不能";
  palaces: number[];
  detail: string | null;
  /** 判定コードが持つ象意文（原文のまま） */
  judgeMeaning: string;
  /** 象意DBの同名格局の象意（原文のまま。無ければ null） */
  meaningDb: string[] | null;
  /** qimenMaterials の sources（判定コード・象意DB）そのまま */
  sources: MaterialSource[];
}

/** F. 伏吟・反吟の資料由来吉凶文（既存判定と紐付いたものだけ）。 */
export interface AiFuYinFanYin extends AiItemBase {
  kind: "伏吟" | "反吟";
  judgeName: string;
  judgeDetail: string;
  linkedSubtypes: { name: string; description: string[] }[];
  fortuneHeading: string;
  fortuneText: string[];
}

/** 参照表（旺衰など）。現在の状態を示すものではない。 */
export interface AiReferenceTable extends AiItemBase {
  role: string;
  element: string;
  kind: string;
  content: unknown;
  /** qimenMaterials の note（例: 現在の段階は判定していない）そのまま */
  note: string | null;
}

/** 主要判断材料から外したもの。AI の判断材料として使わない。 */
export interface AiExcluded extends AiItemBase {
  kind: "分類未確定の注記" | "紐付けなかった伏吟反吟" | "取得しなかった項目";
  item: string;
  reason: string;
  /** 元データの値（分類未確定の注記のみ。値そのまま） */
  content: Record<string, string> | null;
  /** qimenMaterials 内で同じ内容を重ねて持っていたため1件にまとめた他の位置（無ければ空） */
  duplicateMaterialPaths: string[];
}

export interface QimenAiInput {
  schemaVersion: 1;
  palaceNumber: number;
  /** A */
  chartFacts: AiChartFact[];
  /** B */
  singleMeanings: AiSingleMeaning[];
  /** C */
  kokuo: AiKokuo[];
  /** D */
  palaceKaku: AiKaku[];
  /** E */
  wholeChartKaku: AiKaku[];
  /** 吉格で palaces が空（既存コードに意味の定義が無い）のもの */
  unknownScopeKaku: AiKaku[];
  /** F */
  fuYinFanYin: AiFuYinFanYin[];
  referenceTables: AiReferenceTable[];
  excluded: AiExcluded[];
}
