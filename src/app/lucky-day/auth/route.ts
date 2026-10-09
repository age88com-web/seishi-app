// src/app/lucky-day/auth/route.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の会員ログイン・コールバック。
//   WordPress（https://fengshui.jp/?takujitsu_app_login=1）でのログイン後、
//   ここへ ?code=... 付きでリダイレクトされてくる。
//
// 処理（ユーザー指示どおりの6ステップ）:
//   1. code の形式確認（64文字、英数字・-_のみ）
//   2. WordPress /exchange へ送信
//   3. user_id 取得
//   4. /membership/{user_id} でPMPro状態確認（ログイン成立の確認・サーバー
//      ログ用。セッション自体には保存しない＝以後は毎回
//      getCurrentTakujitsuMember() がWordPressへ問い合わせて確認する）
//   5. Next.jsセッションcookie発行
//   6. /lucky-day へリダイレクト
//
// 重要（セキュリティ、ユーザー指示）:
//   ・code の値を画面に表示しない・ログに出さない（wordpress.ts側も同様）。
//   ・エラー時は理由を問わず /lucky-day へ静かに戻す（秘密情報もcodeも
//     画面に出さない）。
//   ・最終的なリダイレクト先URLに code を残さない（/lucky-day への
//     リダイレクトはクエリなし）。
//   ・有料会員でなくても本人認証自体は成立させてよいが、fullAccessは
//     与えない（levelId/activeはセッションに保存しないため、これは
//     自動的に満たされる）。
//
// 既存の専門家向け認証（src/lib/auth/、/api/auth/login等）・判定エンジン・
// 擇日ロジックには一切触れない。

import { NextResponse } from "next/server";
import { buildPublicUrl } from "@/lib/auth/requestOrigin";
import { exchangeAuthCode, getMembershipStatus, isValidAuthCode } from "@/lib/luckyDay/auth/wordpress";
import { createMemberSessionToken, TAKUJITSU_MEMBER_SESSION_COOKIE, TAKUJITSU_MEMBER_SESSION_TTL_MS } from "@/lib/luckyDay/auth/session";

export const runtime = "nodejs";

function redirectToLuckyDay(req: Request): NextResponse {
  return NextResponse.redirect(buildPublicUrl("/lucky-day", req));
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // 1. code の形式確認（不正な形式・欠落は理由を出さずそのまま /lucky-day へ）。
  if (!isValidAuthCode(code)) {
    return redirectToLuckyDay(req);
  }

  // 2〜3. WordPress /exchange で user_id に交換する。
  let exchanged: { userId: number } | null;
  try {
    exchanged = await exchangeAuthCode(code);
  } catch (e) {
    console.error("[lucky-day auth] unexpected error during exchange:", e instanceof Error ? e.message : "unknown");
    return redirectToLuckyDay(req);
  }
  if (!exchanged) {
    return redirectToLuckyDay(req);
  }

  // 4. 会員状態を確認する（ログイン成立時点の疎通確認。結果はセッションへ
  //    保存しない。失敗しても本人認証自体は成立させる＝ここでは中断しない）。
  try {
    await getMembershipStatus(exchanged.userId);
  } catch (e) {
    console.error(
      "[lucky-day auth] membership check failed during login (auth still proceeds):",
      e instanceof Error ? e.message : "unknown",
    );
  }

  // 5. Next.js独自の署名済みセッションを発行する。
  const token = createMemberSessionToken(exchanged.userId);

  // 6. code を含まないURLへリダイレクトする。
  const res = redirectToLuckyDay(req);
  res.cookies.set({
    name: TAKUJITSU_MEMBER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/lucky-day",
    maxAge: Math.floor(TAKUJITSU_MEMBER_SESSION_TTL_MS / 1000),
  });
  return res;
}
