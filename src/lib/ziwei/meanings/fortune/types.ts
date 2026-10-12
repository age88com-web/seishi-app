// src/lib/ziwei/meanings/fortune/types.ts
//
// 大限・小限における星曜の象意（行運星曜象意）の型。docs/ziwei-basic-spec.md §29。

import type { PowerGrade } from "../../power";
import type { Branch, PalaceName, PlacedStar } from "../../types";

/**
 * 文の条件（文頭の語句だけで決める）
 *   palacePowerStrong … 「（巡る）宮の力量（が）強ければ」: 巡る宮の運命指数が 最強・強
 *   palacePowerWeak   … 「（巡る）宮の力量（が）弱ければ」「巡る宮の力量弱くても」: 巡る宮の運命指数が 弱・最弱
 *   starOrPalaceWeak  … 「太陰星の力量弱いか巡る宮の力量弱ければ」: 星の力量の弱さ OR 宮の力量の弱さ。
 *                       星の力量の弱さは宮の力量に読み替えない（資料に数値の定義がない星は未判定）
 * 「平」の宮では強・弱どちらの文も出さない。
 */
export type FortuneStarCondition =
  | { kind: "palacePowerStrong"; phrase: string }
  | { kind: "palacePowerWeak"; phrase: string }
  | { kind: "starOrPalaceWeak"; star: PlacedStar; phrase: string };

export interface FortuneStarLine {
  /** FS-天機-2 のような ID */
  id: string;
  /** 表示する文（象意データ K-ST-DX の独自文章。資料の意味の範囲で書き直したもの。§35） */
  text: string;
  /** null は無条件（基本の象意）。条件は原文から判定したもの */
  condition: FortuneStarCondition | null;
  /** 基礎編の文の ID（原文はアプリ用データに持たない） */
  sourceId: string;
  /** 入門の同じ文の ID（対応付けだけ） */
  parallelId: string;
}

export interface FortuneStarItem {
  /** FS-天機・FS-文昌文曲 など */
  id: string;
  /** 資料の見出し（群は「文昌、文曲星」のように1つ） */
  heading: string;
  /** 対象の星（作盤エンジンの星名） */
  stars: PlacedStar[];
  /** 群（文昌・文曲／右弼・左輔／火星・鈴星・擎羊・陀羅）。群の全員に共通の文 */
  isGroup: boolean;
  sourceOrder: number;
  lines: FortuneStarLine[];
}

export type FortuneLineResult = "unconditional" | "met" | "notMet" | "pending";

export interface EvaluatedFortuneLine {
  id: string;
  text: string;
  condition: FortuneStarCondition | null;
  result: FortuneLineResult;
  /** 表示するか（無条件と成立だけ） */
  shown: boolean;
  /** 判定の根拠（例: 宮の運命指数 9.2（強）） */
  detail: string;
}

export interface FortuneStarMeaning {
  item: FortuneStarItem;
  /** この宮にいる、この項目の星（群は居る星だけ） */
  presentStars: PlacedStar[];
  /** 表示名（群は居る星を「・」でつなぐ） */
  label: string;
  lines: EvaluatedFortuneLine[];
}

/** 大限上・小限上の1つの宮の行運星曜象意 */
export interface FortunePalaceStarInterpretation {
  limitType: "major" | "minor";
  /** 宮の支（物理的な宮） */
  branch: Branch;
  natalPalace: PalaceName;
  /** 行運十二宮での名前（大限上の○宮・小限上の○宮） */
  fortunePalace: PalaceName;
  /** 大限: [開始, 終了]、小限: [数え年, 数え年] */
  ageRange: [number, number];
  /** この宮の星（本命盤の星。行運で星は動かない） */
  stars: PlacedStar[];
  /** 巡る宮の力量（本命盤の運命指数） */
  palacePower: { index: number; grade: PowerGrade };
  meanings: FortuneStarMeaning[];
  /** 行運星曜象意の記載がない星 */
  starsWithoutMeaning: PlacedStar[];
}
