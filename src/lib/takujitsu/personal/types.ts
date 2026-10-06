// src/lib/takujitsu/personal/types.ts
//
// 役割:
//   年命（人物の生年干支）による個人判定の入出力型。
//   既存の擇日109活動判定（activityResult = good/neutral/mixed/bad）とは
//   完全に独立した別概念。personalResult は activityResult を一切書き換えない。
//
// 唯一の仕様根拠:
//   秀山確認済み「本命殺.csv」（tests/fixtures/honmeisatsu.csv に検証用として保管）。
//   一般的な命理・擇日知識による補完・別流派規則での置き換えは禁止。

/** 本命殺4種。 */
export type PersonalAvoidType = "相冲" | "三殺" | "三刑" | "箭刃";

/** 成立した本命殺1件分の根拠。将来、表示説明を足す場合はここに任意フィールドを追加する。 */
export interface PersonalAvoidReason {
  type: PersonalAvoidType;
  yearStem: string;
  yearBranch: string;
  dayBranch: string;
}

/**
 * personalResult の状態。
 * - clear        : 4種いずれにも該当しない
 * - avoid        : 1種以上該当する（reasons に列挙）
 * - undetermined : 出生時刻が未入力かつ立春の瞬間を跨ぐ日のため、年命が一意に
 *                  確定できない（吉でも凶でもない＝判定保留。activityResult には影響しない）
 */
export type PersonalTakujitsuStatus = "clear" | "avoid" | "undetermined";

export interface PersonalTakujitsuResult {
  status: PersonalTakujitsuStatus;
  /** status が "avoid" の時のみ1件以上。それ以外は空配列。 */
  reasons: PersonalAvoidReason[];
}

/**
 * 出生日時の入力。
 * hour・minute の両方が揃っていない場合は「出生時刻不明」として扱う
 * （どちらか一方だけの入力は不明として扱い、勝手に補完しない）。
 */
export interface PersonalBirthInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  timezone?: string;
}
