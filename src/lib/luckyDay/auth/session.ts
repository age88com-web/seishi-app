// src/lib/luckyDay/auth/session.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用の、Next.js独自の署名済み
//   セッション（HMAC-SHA256、Node標準cryptoのみ使用）。
//
// 重要（ユーザー指示、2026-09-19）:
//   ・WordPressのCookieをサブドメイン間で共有する方式にはしない。
//   ・セッションに保存するのは { userId, issuedAt, expiresAt } の3つだけ。
//     PMProのactive/level_idは保存しない（会員状態は常にWordPressを正とし、
//     getCurrentTakujitsuMember() が都度WordPressへ問い合わせて確認する）。
//   ・TAKUJITSU_SESSION_SECRET は環境変数からのみ読み、ソースに書かない。
//   ・既存の専門家向けセッション（src/lib/auth/session.ts、Cookie名
//     "__Host-session"、DBセッション方式）とは完全に独立した別モジュール
//     であり、一切参照・変更しない。
//
// トークン形式:
//   "<payloadのbase64url>.<HMAC-SHA256署名のbase64url>"
//   JWTライブラリは使わず、Node標準cryptoで自己完結させる（ユーザー指示
//   「HMAC-SHA256等、Node標準cryptoを使った十分安全な方式で可」）。
//   署名検証は timingSafeEqual による定数時間比較で行う。

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie名（ユーザー指示の例をそのまま採用）。 */
export const TAKUJITSU_MEMBER_SESSION_COOKIE = "takujitsu_member_session";

/** セッション有効期間（まず24時間程度、というユーザー指示どおり）。 */
export const TAKUJITSU_MEMBER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface TakujitsuMemberSessionPayload {
  userId: number;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.TAKUJITSU_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "TAKUJITSU_SESSION_SECRET が設定されていないか短すぎます。十分に長いランダム値を環境変数に設定してください。",
    );
  }
  return secret;
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function isValidPayloadShape(v: unknown): v is TakujitsuMemberSessionPayload {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.userId === "number" && Number.isInteger(r.userId) && r.userId > 0 &&
    typeof r.issuedAt === "number" &&
    typeof r.expiresAt === "number"
  );
}

/**
 * userId から署名済みセッショントークンを新規発行する。
 * issuedAt/expiresAt はこの関数が現在時刻から自動的に設定する
 * （呼び出し側が任意の有効期限を指定することはできない）。
 */
export function createMemberSessionToken(userId: number): string {
  const now = Date.now();
  const payload: TakujitsuMemberSessionPayload = {
    userId,
    issuedAt: now,
    expiresAt: now + TAKUJITSU_MEMBER_SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(payloadB64, getSecret());
  return `${payloadB64}.${signature}`;
}

/**
 * セッショントークンを検証する。改ざん・期限切れ・形式不正のいずれかで
 * あれば null を返す（フェイルクローズ。理由は区別して返さない＝
 * どの理由であっても呼び出し側は「未認証」として扱う）。
 */
export function verifyMemberSessionToken(token: string | undefined | null): TakujitsuMemberSessionPayload | null {
  if (!token) return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // TAKUJITSU_SESSION_SECRET 未設定時も例外を投げず「未認証」に倒す
    // （/lucky-day 自体は環境変数未設定でも動き続ける）。
    return null;
  }

  const expectedSignature = signPayload(payloadB64, secret);
  const providedBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expectedSignature, "base64url");
  if (providedBuf.length === 0 || providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isValidPayloadShape(parsed)) return null;
  if (parsed.expiresAt <= Date.now()) return null;

  return parsed;
}
