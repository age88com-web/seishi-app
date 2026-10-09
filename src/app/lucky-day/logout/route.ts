// src/app/lucky-day/logout/route.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用のログアウト。
//   Next.js側の takujitsu_member_session だけを削除する（cookie値を空・
//   maxAge:0にして即時失効させる）。
//
// 重要（ユーザー指示）:
//   ・専門家版の既存ログイン状態（__Host-session）には一切触れない。
//   ・WordPress本体のログインcookieも削除しない
//     （そもそも本アプリはWordPressのcookieを共有していない）。
//   ・状態変更を伴うため POST 限定（既存の /api/auth/logout と同じ方針）。

import { NextResponse } from "next/server";
import { buildPublicUrl, isTrustedOrigin } from "@/lib/auth/requestOrigin";
import { TAKUJITSU_MEMBER_SESSION_COOKIE } from "@/lib/luckyDay/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF対策: 既存の /api/auth/logout と同じ考え方（公開Originとの比較）。
  if (!isTrustedOrigin(req)) {
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  const res = NextResponse.redirect(buildPublicUrl("/lucky-day", req), { status: 303 });
  res.cookies.set({
    name: TAKUJITSU_MEMBER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/lucky-day",
    maxAge: 0,
  });
  return res;
}
