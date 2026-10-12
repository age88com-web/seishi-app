// src/lib/ziwei/patterns/types.ts
//
// 格局判定（基礎２ 本編33格）の型。docs/ziwei-basic-spec.md §23.4。

import type { Branch, PalaceName } from "../types";
import type { ResolvedPatternMeaning } from "./meanings";

/** 最終状態。confirmed … 条件一致・破格なし・資料上の問題なし、not_applicable … 不成立（破格を含む）、needs_review … 条件一致だが資料に問題が残る／判定できない */
export type PatternStatus = "confirmed" | "not_applicable" | "needs_review";

/** 資料上の状態。needs_review は、機械的に条件が一致しても成立と断定しない */
export type SourceStatus = "verified" | "needs_review";

export type SourceIssueKind =
  | "sourceConflict" // 資料の命例・図と本文条件が合わない
  | "sourceDifference" // 資料間の差（四化表・天馬・全書 など）
  | "ambiguity" // 条件の語が未定義で、判定に読みを含む
  | "notation"; // 原文表記の揺れ・誤記（判定には影響しない）

export interface SourceIssue {
  kind: SourceIssueKind;
  note: string;
  /** true なら sourceStatus を needs_review にする（成立と断定しない） */
  blocking: boolean;
}

export interface PatternSourceRef {
  source: "紫微斗数基礎２" | "紫微斗数入門" | "紫微斗数基礎編";
  /** 基礎２・基礎編はスライド番号、入門は印刷ページ */
  page: string;
  heading: string;
}

/** 成立条件の1項目の確認結果（null は判定できない） */
export interface PatternCheck {
  text: string;
  result: boolean | null;
  detail: string;
}

/** 破格（資料が「破格」「成立しない」と書く条件） */
export interface BreakCheck {
  /** 資料の文 */
  text: string;
  result: "broken" | "clear" | "undetermined";
  detail: string;
}

/** 注意（資料が「破格しやすい」など確定でない形で書く条件）。破格と別に持つ */
export interface WarningCheck {
  text: string;
  result: "applies" | "clear" | "undetermined";
  detail: string;
}

/**
 * 補足（資料が「〜を喜ぶ」と書く、成立条件ではない吉意）。成立・状態を変えず、点数化もしない。
 * applies … 該当する、clear … 該当しない
 */
export interface EnhancementCheck {
  text: string;
  result: "applies" | "clear";
  detail: string;
}

/** 条件を満たした基準宮（宮指定なしの格局は12宮を走査した結果） */
export interface MatchedPalace {
  branch: Branch;
  palace: PalaceName;
}

export interface PatternResult {
  id: string;
  number: number;
  /** 表示名（canonicalName） */
  name: string;
  sourceName: string;
  aliases: { name: string; source: string }[];
  /** 成立条件に一致したか（null は判定できない） */
  conditionMatched: boolean | null;
  status: PatternStatus;
  sourceStatus: SourceStatus;
  matchedPalaces: MatchedPalace[];
  /** 成立した宮とは別に格の影響が及ぶ宮（成立判定はしない。羊陀夾忌の対宮など） */
  affectedPalaces: (MatchedPalace & { from: Branch; note: string })[];
  /** 成立根拠（一致した条件の説明） */
  reasons: string[];
  /** 成立条件の各項目 */
  checks: PatternCheck[];
  breakConditions: BreakCheck[];
  warningConditions: WarningCheck[];
  /** 補足（成立条件ではない吉意。§37.5） */
  enhancementConditions: EnhancementCheck[];
  sourceIssues: SourceIssue[];
  /** 表示する象意（base＋条件が成立した conditional。性別で出し分け済み。§36） */
  meanings: string[];
  /** 象意の内訳（base・conditional・pending〔表示しない〕） */
  meaning: ResolvedPatternMeaning;
  /** 象意の中の条件についての注記（成立条件ではない。原文は持たない） */
  meaningConditions: { note: string }[];
  sourceRefs: PatternSourceRef[];
}

export interface ChartPatterns {
  /** 33格すべての判定結果（開発確認用。番号順） */
  patterns: PatternResult[];
  confirmed: PatternResult[];
  /** 条件一致・要確認 */
  matchedNeedsReview: PatternResult[];
  /** 判定できない（条件一致か不明） */
  undetermined: PatternResult[];
  notes: string[];
}
