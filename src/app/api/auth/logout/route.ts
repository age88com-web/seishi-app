// src/app/api/auth/logout/route.ts
//
// 役割:
//   ログアウト。Cookie削除だけでなく、DBのsessionsレコード自体を削除する
//   （でないと、古いCookie値を保存されていた場合に再送で通ってしまう）。
//   状態変更（セッション破棄）を伴うため POST 限定（CSRF対策）。

import { NextResponse } from "next/server";
import { logout, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { buildPublicUrl, isTrustedOrigin } from "@/lib/auth/requestOrigin";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF対策: login/route.ts と同じ考え方（Nginx配下でのスキーム不一致を
  // resolvePublicOrigin() で吸収する。req.url そのものは使わない）。
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = parseCookie(cookieHeader, SESSION_COOKIE_NAME);

  logout(sessionId);

  const res = NextResponse.redirect(buildPublicUrl("/login", req), { status: 303 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

function parseCookie(header: string, name: string): string | undefined {
  const parts = header.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
