// src/lib/luckyDay/auth/wordpress.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の会員認証（WordPress + Paid
//   Memberships Pro）用の WordPress REST API クライアント。サーバー専用
//   モジュール（"server-only" を先頭でimportし、Client Componentから
//   誤ってimportされた場合はビルド時にエラーになるようにする）。
//
// 重要（ユーザー指示、2026-09-19）:
//   ・Application Password（TAKUJITSU_WP_APP_PASSWORD）・その他の秘密値は
//     ソースコードに直接書かず、環境変数からのみ読む。ログにも出さない。
//   ・通信失敗・不正レスポンス時は「有料会員として扱わない」方向に倒す
//     （fail-safe）。ただし原因調査のため、秘密情報を含まないログは出す
//     （ステータスコード等のみ。code・Authorizationヘッダーの値は出さない）。
//   ・既存の専門家向け認証（src/lib/auth/）・判定エンジンとは完全に独立。
//
// 唯一の入力（このモジュールが信頼する情報源）:
//   WordPress側の2つのAPI（exchange・membership）のレスポンスのみ。
//   クライアントから渡された user_id 等は一切信用しない
//   （exchangeAuthCode() が返す userId だけを、以後の呼び出しに使う）。

import "server-only";

/**
 * 一時コードの形式チェック。
 * WordPress側仕様（2026-09-19確認）: `bin2hex(random_bytes(32))` で生成し、
 * `/exchange` でも `^[a-f0-9]{64}$` で検証している。Next.js側もこれと
 * 完全に一致させる（64文字・小文字16進数のみ。大文字・g-z・記号は不可）。
 */
export function isValidAuthCode(code: unknown): code is string {
  return typeof code === "string" && /^[a-f0-9]{64}$/.test(code);
}

function requireWordPressUrl(): string {
  const url = process.env.WORDPRESS_URL;
  if (!url || url.trim() === "") {
    throw new Error("WORDPRESS_URL が設定されていません。");
  }
  return url.replace(/\/+$/, "");
}

function basicAuthHeader(): string {
  const user = process.env.TAKUJITSU_WP_USER;
  const appPassword = process.env.TAKUJITSU_WP_APP_PASSWORD;
  if (!user || !appPassword) {
    throw new Error("TAKUJITSU_WP_USER / TAKUJITSU_WP_APP_PASSWORD が設定されていません。");
  }
  // Application Password自体はここでも一切ログに出さない。
  return "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");
}

export interface ExchangeAuthCodeResult {
  userId: number;
}

function isValidExchangeResponse(v: unknown): v is { valid: true; user_id: number } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    r.valid === true &&
    typeof r.user_id === "number" &&
    Number.isInteger(r.user_id) &&
    r.user_id > 0
  );
}

/**
 * WordPress側の一時コードを user_id に交換する。
 * POST {WORDPRESS_URL}/wp-json/takujitsu/v1/exchange
 *
 * 失敗（HTTPエラー・タイムアウト・不正なレスポンス形状）の場合は null を返す。
 * code の値自体はログに出さない。
 */
export async function exchangeAuthCode(code: string): Promise<ExchangeAuthCodeResult | null> {
  let res: Response;
  try {
    res = await fetch(`${requireWordPressUrl()}/wp-json/takujitsu/v1/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(),
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[lucky-day auth] exchange request failed:", e instanceof Error ? e.message : "unknown error");
    return null;
  }

  if (!res.ok) {
    console.error(`[lucky-day auth] exchange returned HTTP ${res.status}`);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[lucky-day auth] exchange response was not valid JSON");
    return null;
  }

  if (!isValidExchangeResponse(data)) {
    console.error("[lucky-day auth] exchange response had an unexpected shape");
    return null;
  }

  return { userId: data.user_id };
}

export interface MembershipStatus {
  active: boolean;
  levelId: number | null;
}

const MEMBERSHIP_FALLBACK: MembershipStatus = { active: false, levelId: null };

function isValidMembershipResponse(v: unknown): v is { active: boolean; level_id: number | null } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.active !== "boolean") return false;
  if (r.level_id !== null && typeof r.level_id !== "number") return false;
  return true;
}

/**
 * WordPress（PMPro）側の会員状態を取得する。
 * GET {WORDPRESS_URL}/wp-json/takujitsu/v1/membership/{userId}
 *
 * 通信失敗・不正レスポンスの場合は必ず「有料会員として扱わない」
 * { active: false, levelId: null } を返す（fail-safe。fullAccessへは倒さない）。
 * ID 2〜5 のみを有料会員として扱う、という最終判断は呼び出し側
 * （getCurrentTakujitsuMember()）が行う。ここではWordPressの生の値を
 * 型だけ検証してそのまま返す。
 */
export async function getMembershipStatus(userId: number): Promise<MembershipStatus> {
  if (!Number.isInteger(userId) || userId <= 0) return MEMBERSHIP_FALLBACK;

  let res: Response;
  try {
    res = await fetch(`${requireWordPressUrl()}/wp-json/takujitsu/v1/membership/${userId}`, {
      method: "GET",
      headers: { Authorization: basicAuthHeader() },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[lucky-day auth] membership request failed:", e instanceof Error ? e.message : "unknown error");
    return MEMBERSHIP_FALLBACK;
  }

  if (!res.ok) {
    console.error(`[lucky-day auth] membership check returned HTTP ${res.status}`);
    return MEMBERSHIP_FALLBACK;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[lucky-day auth] membership response was not valid JSON");
    return MEMBERSHIP_FALLBACK;
  }

  if (!isValidMembershipResponse(data)) {
    console.error("[lucky-day auth] membership response had an unexpected shape");
    return MEMBERSHIP_FALLBACK;
  }

  return { active: data.active, levelId: data.level_id };
}

// ---------------------------------------------------------------------------
// 会員専用 質問サポート（2026-09-20実装。src/lib/luckyDay/actions.ts の
// getSupportStatusAction/submitSupportQuestionActionから呼ばれる）。
//
// 重要:
//   ・月3回の残り回数・上限判定はここでは一切行わない。WordPress側
//     （PMPro levelId 2/3の再確認＋Asia/Tokyo基準の月次カウント・原子的な
//     二重送信防止）が唯一の正であり、ここはそのAPIを呼ぶだけの薄い層。
//   ・質問本文・会員メールアドレスは絶対にログへ出さない
//     （既存のexchangeAuthCode/getMembershipStatusと同じ規約）。
//   ・user_id はここでも呼び出し側（getCurrentTakujitsuMember()由来）を
//     そのまま信頼するだけで、クライアント入力を受け取らない
//     （既存のgetMembershipStatus(userId)と同じ信頼モデル）。
// ---------------------------------------------------------------------------

export interface SupportStatus {
  used: number;
  limit: number;
  remaining: number;
  /** "YYYY-MM"。WordPress側がAsia/Tokyo基準で算出した当月。 */
  month: string;
}

function isValidSupportStatusResponse(
  v: unknown,
): v is { used: number; limit: number; remaining: number; month: string } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.used === "number" &&
    Number.isInteger(r.used) &&
    r.used >= 0 &&
    typeof r.limit === "number" &&
    Number.isInteger(r.limit) &&
    r.limit > 0 &&
    typeof r.remaining === "number" &&
    Number.isInteger(r.remaining) &&
    r.remaining >= 0 &&
    typeof r.month === "string" &&
    /^\d{4}-\d{2}$/.test(r.month)
  );
}

/**
 * 会員専用 質問サポートの当月利用状況を取得する（読み取り専用、副作用なし）。
 * GET {WORDPRESS_URL}/wp-json/takujitsu/v1/support-status/{userId}
 *
 * 通信失敗・不正レスポンスの場合は null を返す（呼び出し側はエラー表示に
 * すること。「0/3として扱う」等の楽観的なフォールバックはしない）。
 */
export async function getSupportStatus(userId: number): Promise<SupportStatus | null> {
  if (!Number.isInteger(userId) || userId <= 0) return null;

  let res: Response;
  try {
    res = await fetch(`${requireWordPressUrl()}/wp-json/takujitsu/v1/support-status/${userId}`, {
      method: "GET",
      headers: { Authorization: basicAuthHeader() },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[lucky-day support] status request failed:", e instanceof Error ? e.message : "unknown error");
    return null;
  }

  if (!res.ok) {
    console.error(`[lucky-day support] status check returned HTTP ${res.status}`);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[lucky-day support] status response was not valid JSON");
    return null;
  }

  if (!isValidSupportStatusResponse(data)) {
    console.error("[lucky-day support] status response had an unexpected shape");
    return null;
  }

  return { used: data.used, limit: data.limit, remaining: data.remaining, month: data.month };
}

/** 質問送信時に添付できる参考情報（質問回数には影響しない）。 */
export interface SupportQuestionContext {
  dateIso?: string;
  categoryLabel?: string;
  purposeLabel?: string;
}

export type SubmitSupportQuestionResult =
  | { ok: true; used: number; limit: number; remaining: number }
  | {
      ok: false;
      reason: "not_allowed" | "limit_reached" | "mail_failed" | "invalid_input" | "duplicate" | "network_error";
    };

function isValidSubmitSuccessResponse(
  v: unknown,
): v is { ok: true; used: number; limit: number; remaining: number } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    r.ok === true &&
    typeof r.used === "number" &&
    Number.isInteger(r.used) &&
    typeof r.limit === "number" &&
    Number.isInteger(r.limit) &&
    typeof r.remaining === "number" &&
    Number.isInteger(r.remaining)
  );
}

const SUBMIT_ERROR_REASONS = ["not_allowed", "limit_reached", "mail_failed", "invalid_input", "duplicate"] as const;

function isValidSubmitErrorResponse(
  v: unknown,
): v is { ok: false; reason: (typeof SUBMIT_ERROR_REASONS)[number] } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.ok === false && typeof r.reason === "string" && (SUBMIT_ERROR_REASONS as readonly string[]).includes(r.reason);
}

/**
 * 会員専用 質問サポートの質問を送信する。
 * POST {WORDPRESS_URL}/wp-json/takujitsu/v1/support-question
 *
 * 月3回の上限判定・二重送信防止・PMPro会員の再確認・メール送信は
 * すべてWordPress側で行う（このNext.js関数は結果を中継するだけ）。
 * idempotencyKeyは呼び出し側（Server Action）が生成したものをそのまま
 * 転送する（Next.js側では生成しない＝同一クライアント操作からの
 * リトライで必ず同じ値になることを呼び出し側が保証する）。
 *
 * 質問本文（questionText）はここでもログに一切出さない。
 */
export async function submitSupportQuestion(
  userId: number,
  idempotencyKey: string,
  questionText: string,
  context?: SupportQuestionContext,
): Promise<SubmitSupportQuestionResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, reason: "invalid_input" };
  }

  let res: Response;
  try {
    res = await fetch(`${requireWordPressUrl()}/wp-json/takujitsu/v1/support-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(),
      },
      body: JSON.stringify({
        user_id: userId,
        idempotency_key: idempotencyKey,
        question_text: questionText,
        context: context ?? null,
      }),
      cache: "no-store",
    });
  } catch (e) {
    console.error(
      "[lucky-day support] question submit request failed:",
      e instanceof Error ? e.message : "unknown error",
    );
    return { ok: false, reason: "network_error" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.error("[lucky-day support] question submit response was not valid JSON");
    return { ok: false, reason: "network_error" };
  }

  if (res.ok && isValidSubmitSuccessResponse(data)) {
    return { ok: true, used: data.used, limit: data.limit, remaining: data.remaining };
  }
  if (!res.ok && isValidSubmitErrorResponse(data)) {
    return { ok: false, reason: data.reason };
  }

  console.error(`[lucky-day support] question submit returned unexpected HTTP ${res.status} or response shape`);
  return { ok: false, reason: "network_error" };
}
