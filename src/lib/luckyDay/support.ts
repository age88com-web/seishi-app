// src/lib/luckyDay/support.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）「会員専用 質問サポート」の入力
//   バリデーション（純粋関数、副作用なし）。
//
// 重要（ユーザー指示、2026-09-20）:
//   月3回の上限判定・二重送信防止（idempotency keyの原子的な照合）・
//   PMPro会員（levelId 2/3）の再確認・メール送信は一切ここでは行わない。
//   これらはすべてWordPress側（src/lib/luckyDay/auth/wordpress.ts が
//   呼ぶREST API）が唯一の正であり、このファイルは「明らかに不正な形の
//   入力をWordPressへ送る前にはじく」ための薄いゲート層にすぎない
//   （src/lib/luckyDay/personalJudgment.ts と同じ設計方針）。
//
// このファイルは "server-only" を import しない（cookies()・fetchを
// 使わない純粋関数のため、テストからも直接呼べる）。
// src/lib/luckyDay/index.ts からは意図的に re-export しない
// （Client Componentから直接importできる状態にはしない。実際の呼び出しは
// src/lib/luckyDay/actions.ts、"use server" 経由のみに限定する）。

export const SUPPORT_QUESTION_MIN_LENGTH = 1;
export const SUPPORT_QUESTION_MAX_LENGTH = 2000;

// タブ・改行以外の制御文字は禁止する（ログ改ざん・メールヘッダー注入の
// typicalな手口を機械的に排除する。意味的な内容チェックはしない）。
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

/**
 * 質問本文の形式チェック（文字数範囲・禁止制御文字のみ）。
 * 「個別擇日の相談ではないか」等の意味的な妥当性は判定しない
 * （案内文で伝えるだけで、機械的にはブロックしない）。
 */
export function isValidSupportQuestionText(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  if (trimmed.length < SUPPORT_QUESTION_MIN_LENGTH || trimmed.length > SUPPORT_QUESTION_MAX_LENGTH) return false;
  if (CONTROL_CHAR_PATTERN.test(v)) return false;
  return true;
}

// クライアント（ブラウザ）が crypto.randomUUID() 等で生成する冪等キーの
// 形式チェック。長さと文字種だけを見る（UUID形式を強制はしない）。
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{8,100}$/;

/** 冪等キー（二重送信防止用）の形式チェック。 */
export function isValidIdempotencyKey(v: unknown): v is string {
  return typeof v === "string" && IDEMPOTENCY_KEY_PATTERN.test(v);
}

const CONTEXT_LABEL_MAX_LENGTH = 100;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 質問送信時に添付できる「参考情報」（質問回数には一切影響しない）。 */
export interface SupportQuestionContextInput {
  dateIso?: string;
  categoryLabel?: string;
  purposeLabel?: string;
}

/**
 * 参考情報の形式チェック。未指定（null/undefined）は許容する
 * （参考情報がない通常画面からも質問できる、というユーザー指示）。
 * 各フィールドが不正な場合は例外にせず、そのフィールドだけを除外する
 * （参考情報は補助情報にすぎないため、部分的に不正でも質問送信自体は
 * 継続できるようにする）。全フィールドが不正/空ならnullを返す。
 */
export function sanitizeSupportQuestionContext(v: unknown): SupportQuestionContextInput | null {
  if (v == null || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;

  const result: SupportQuestionContextInput = {};
  if (typeof r.dateIso === "string" && ISO_DATE_PATTERN.test(r.dateIso)) {
    result.dateIso = r.dateIso;
  }
  if (
    typeof r.categoryLabel === "string" &&
    r.categoryLabel.trim().length > 0 &&
    r.categoryLabel.length <= CONTEXT_LABEL_MAX_LENGTH
  ) {
    result.categoryLabel = r.categoryLabel.trim();
  }
  if (
    typeof r.purposeLabel === "string" &&
    r.purposeLabel.trim().length > 0 &&
    r.purposeLabel.length <= CONTEXT_LABEL_MAX_LENGTH
  ) {
    result.purposeLabel = r.purposeLabel.trim();
  }
  return Object.keys(result).length > 0 ? result : null;
}
