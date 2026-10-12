// src/app/api/auth/login/route.ts
//
// 役割:
//   ログイン処理本体。/login のフォームから通常のPOST（application/x-www-form-urlencoded）
//   で呼ばれる。JSも使えるが必須ではない設計（テスト用ツールとしての単純さを優先）。
//
// 重要:
//   このRoute自体は src/proxy.ts の認証チェック対象から明示的に除外されている
//   （未ログイン状態で呼べなければログインできなくなるため）。

import { NextResponse } from "next/server";
import { login, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/safeRedirect";
import { checkRateLimit, rateLimitKeyFor, recordFailedAttempt, recordSuccessfulAttempt } from "@/lib/auth/rateLimit";
import { buildPublicUrl, isTrustedOrigin } from "@/lib/auth/requestOrigin";

export const runtime = "nodejs";

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function redirectToLogin(req: Request, params: Record<string, string>): NextResponse {
  const url = buildPublicUrl("/login", req);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF対策: Originが自サイト（公開Origin）以外からのPOSTは拒否する
  // （Nginxリバースプロキシ配下でも正しく判定できるよう、X-Forwarded-Proto/Host
  //  を考慮した resolvePublicOrigin() で比較する。req.url そのものは使わない）。
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirectToLogin(req, { error: "invalid_request" });
  }

  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));

  if (!email || !password) {
    return redirectToLogin(req, { error: "invalid_credentials", next });
  }

  const ip = getClientIp(req);
  const rateLimitKey = rateLimitKeyFor(ip, email);
  const rl = checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    return redirectToLogin(req, { error: "rate_limited", next });
  }

  const result = login(email, password);

  if (!result.ok) {
    recordFailedAttempt(rateLimitKey);
    return redirectToLogin(req, { error: result.reason, next });
  }

  recordSuccessfulAttempt(rateLimitKey);

  const res = NextResponse.redirect(buildPublicUrl(next, req), { status: 303 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: result.sessionId,
    httpOnly: true,
    // "__Host-" プレフィックスは Secure 属性の付与をブラウザ側で必須としているため、
    // 環境を問わず常に true にする（本番はHTTPSで自然に有効。ローカル開発は
    // http://localhost を「secureなコンテキスト」として扱うブラウザの例外により、
    // Secure Cookie でも動作する。実機ブラウザで確認済み — 詳細は実装報告参照）。
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
  });
  return res;
}
