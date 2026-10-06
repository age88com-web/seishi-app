// src/lib/clients/requestUser.ts
//
// 顧客API用: リクエストのセッションCookieからログイン中の user_id を求める。
// src/proxy.ts の認証ゲートと同じ validateSessionId() を使う（認証処理そのものは変更しない）。
//
// ローカル開発専用の認証バイパス（proxy.ts と同じ条件）:
//   `next dev`（NODE_ENV==="development"）かつ .env.local で SEISHI_DEV_AUTH_BYPASS="true" の場合だけ、
//   セッションを見ずに開発用 user_id = 1 を返す（ローカルの顧客データは user_id=1 に紐づく）。
//   `next build` / `next start` では NODE_ENV は常に "production" になるため、本番では成立しない。
//   clients.user_id は users(id) への外部キーなので、開発DBに id=1 のユーザーが必要。

import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionId } from "../auth/session";

const DEV_BYPASS_USER_ID = 1;

function isDevAuthBypass(): boolean {
  return process.env.NODE_ENV === "development" && process.env.SEISHI_DEV_AUTH_BYPASS === "true";
}

export function getRequestUserId(req: NextRequest): number | null {
  if (isDevAuthBypass()) return DEV_BYPASS_USER_ID;

  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return validateSessionId(sessionId)?.userId ?? null;
}
