// src/lib/ziwei/meanings/advanced/types.ts
//
// 応用編・144命宮配置解釈の型。docs/ziwei-basic-spec.md §24。

import type { Branch, MainStar, PlacedStar, TransformationKind } from "../../types";

/** 条件の関係（命宮を基準に見る） */
export type AdvancedRelation = "加会" | "会照" | "会う" | "同宮";

export type AdvancedCondition =
  /** 吉星・凶星（入門 p.15 の分類。§23.4 確定1・4） */
  | { kind: "starGroup"; group: "吉星" | "凶星"; relation: AdvancedRelation; negate: boolean; phrase: string }
  /** 特定の星・四化（mode: all＝列挙の全部、any＝いずれか） */
  | { kind: "stars"; stars: (PlacedStar | TransformationKind)[]; mode: "all" | "any"; relation: AdvancedRelation; phrase: string }
  /** 資料・仕様書に定義がないため判定しない（禄星・桃花の星・貴人・昼夜・補佐 など） */
  | { kind: "pending"; term: string; phrase: string; reason: string }
  /** 時期の条件（悪い流年 など）。出生命盤だけでは決まらないため判定しない */
  | { kind: "temporal"; phrase: string; reason: string };

export interface AdvancedSentence {
  /** OUYOU-001-P1-S1 のような ID */
  id: string;
  /** 資料の通し番号.段落.文（開発確認用） */
  sourceKey: string;
  /** 資料の文（書き換えない） */
  text: string;
  /** 男女別の文（null は男女共通） */
  gender: "female" | "male" | null;
  /** 条件（すべて満たすと成立）。空なら無条件 */
  conditions: AdvancedCondition[];
  /** 条件付きの文を受ける後続文なら、そのまとまりの先頭の文の ID（conditionalBlock） */
  blockOf: string | null;
}

export interface AdvancedParagraph {
  id: string;
  /** 資料の段落（文をつなげたもの） */
  text: string;
  sentences: AdvancedSentence[];
}

export interface AdvancedItem {
  id: string;
  ziweiBranch: Branch;
  mingBranch: Branch;
  /** 見出しに書かれた命宮の支（ブロック内の並びと違う項目がある） */
  headingBranch: Branch;
  headingBranchMismatch: boolean;
  heading: string;
  noMainStar: boolean;
  displayedMainStars: MainStar[];
  borrowedStars: MainStar[];
  borrowNote: string | null;
  sourceSection: string;
  sourceOrder: number;
  /** 資料の見出しの番号（照合には使わない） */
  sourceNumber: number;
  /** 資料の見出しを訂正した記録（OUYOU-003: 元の見出し「命宮は卯で破軍星」→ 寅） */
  sourceCorrection: { originalHeading: string; correctedHeading: string; correctedBranch: Branch; reason: string } | null;
  paragraphs: AdvancedParagraph[];
  /** 本文の格局・配置名と基礎２の格局（§23）の関係。判定は統合しない */
  sourceRelations: { sentenceId: string; phrase: string; patternId: string; patternName: string; note: string }[];
}

export type ConditionResult = "met" | "notMet" | "pending";

export interface EvaluatedSentence {
  id: string;
  text: string;
  /** 表示するか */
  shown: boolean;
  /** 表示しない理由（男女・条件不成立・条件未判定） */
  hiddenReason: "gender" | "notMet" | "pending" | null;
  /** 条件の判定（自分の条件。後続文は先頭の文の判定を使う） */
  conditionResults: { condition: AdvancedCondition; result: ConditionResult; detail: string }[];
  result: ConditionResult | "unconditional";
  blockOf: string | null;
  gender: "female" | "male" | null;
}

/** 配置の照合（見出し ↔ 既存の作盤エンジン） */
export interface StructureCheck {
  status: "match" | "mismatch" | "needs_review";
  engineMainStars: MainStar[];
  engineNoMainStar: boolean;
  engineBorrowed: MainStar[];
  notes: string[];
}

export interface AdvancedInterpretation {
  item: AdvancedItem;
  structure: StructureCheck;
  /** 表示する段落（表示する文だけ。資料の文をそのままつなげる） */
  paragraphs: { id: string; text: string; sentenceIds: string[] }[];
  /** すべての文の判定（開発確認用） */
  sentences: EvaluatedSentence[];
  counts: { sentences: number; shown: number; hiddenGender: number; hiddenNotMet: number; pending: number };
  source: string;
}
