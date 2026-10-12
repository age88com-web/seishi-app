// src/proxy.ts
//
// 役割:
//   認証ゲート本体。Next.js 16.1.1 では middleware.ts は非推奨で、
//   src/proxy.ts が正しい実装位置（node_modules/next のビルドコードを直接確認して
//   確定した。旧middleware.tsとの同時併存はビルドエラーになる）。
//
// 方式: default-deny（フェイルクローズ）。
//   config.matcher の否定先読みで「/login・/api/auth/login・/api/auth/logout・
//   Next.js内部アセット」だけを明示的に除外し、それ以外の全パスを保護対象にする。
//   将来routeが追加されても、matcherへの追加を忘れた場合は「保護される側」に
//   倒れる（うっかり公開してしまう事故を構造的に防ぐ）。
//
// DBアクセスについて（実装時に実機検証した結果）:
//   proxy.ts は Next.js 16.1.1 のビルドコード上、ファイル名が "proxy" であることを
//   理由に明示的に runtime: 'nodejs' として扱われる
//   （node_modules/next/dist/build/index.js の `isProxyFile(page)` 判定を確認済み）。
//   実際に better-sqlite3 を直接 import して `next build` / `next start` を実行し、
//   本物のセッションをDBに対して検証できることを確認済み（実装報告 Q 参照）。
//   そのため、ここでDBセッション検証まで一段で完結させている
//   （Cookie存在チェックのみの軽量ゲート＋ページ側の二段検証、という構成は
//   不要と判断した）。

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionId } from "@/lib/auth/session";
import { buildPublicUrl } from "@/lib/auth/requestOrigin";

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ローカル開発専用の認証バイパス。`next dev`（NODE_ENV==="development"）かつ
  // .env.local で SEISHI_DEV_AUTH_BYPASS="true" を指定した場合だけ有効。
  // `next build` / `next start` では NODE_ENV は常に "production" になるため、
  // 本番（VPS）では成立しない。.env.production 等には絶対に追加しないこと。
  if (
    process.env.NODE_ENV === "development" &&
    process.env.SEISHI_DEV_AUTH_BYPASS === "true"
  ) {
    return NextResponse.next();
  }

  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  // 未ログイン・期限切れ・disabled・改ざん/無効session、いずれも validateSessionId が
  // null を返し、下の同じリダイレクト経路に合流する（分岐は1箇所だけ）。
  const auth = sessionId ? validateSessionId(sessionId) : null;

  if (auth) {
    return NextResponse.next();
  }

  // API Route: ブラウザ向けHTMLリダイレクトではなく401 JSONを返す
  // （curl等での直接叩きに対して、ログイン画面のHTMLを返しても意味がないため）。
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 重要: req.nextUrl.clone() は使わない。Next.js を 127.0.0.1:3000 のみで
  // listen させている構成では、nextUrl のホスト解決がサーバー自身の bind
  // アドレス（localhost:3000）にフォールバックすることがあり、Nginx配下の
  // 公開Origin（https://app.fengshui.jp）と食い違って
  // ERR_SSL_PROTOCOL_ERROR 等を起こす（今回の実機不具合の原因）。
  // login/route.ts・logout/route.ts と同じ buildPublicUrl()（X-Forwarded-Proto /
  // X-Forwarded-Host / Host ヘッダーを考慮）を再利用し、公開Originだけを基準に
  // リダイレクト先を組み立てる。
  const url = buildPublicUrl("/login", req);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 除外（公開）するのは以下だけ。それ以外は全て保護対象（default-deny）。
  //   - /_next/static/*, /_next/image/* … Next.js内部アセット（無いと/loginも描画できない）
  //   - /login                          … ログインページ本体
  //   - /api/auth/login, /api/auth/logout … ログイン/ログアウトの送信先
  //   - /lucky-day, /lucky-day/*        … 一般向け擇日サービス（2026-09-18、ユーザー指示で公開）。
  //     `lucky-day(?:/.*)?$` は「/lucky-day」自身、またはその直後が「/」で
  //     始まる配下パスだけにパス境界を限定する（`(?:/.*)?` は「続きが無い」
  //     か「/」以降が続くかの二択）。これにより /lucky-day-xxx・/lucky-days
  //     のような紛らわしい別ルート名は境界が一致せず除外されない
  //     （＝引き続き認証対象のまま）。/takujitsu・/qimen・七政四餘・既存API
  //     はこの除外に含めない（今回は変更しない）。/api/* も対象外のまま
  //     （一般版の公開APIが必要になった場合は別途個別に追加する）。
  matcher: [
    "/((?!_next/static/|_next/image/|favicon\\.ico$|login$|lucky-day(?:/.*)?$|api/auth/login$|api/auth/logout$).*)",
  ],
};
