// src/lib/auth/requestOrigin.ts
//
// 役割:
//   Nginx等のリバースプロキシ配下で、ブラウザから見た「本当のOrigin」
//   （スキーム＋ホスト）を、X-Forwarded-Proto / X-Forwarded-Host / Host ヘッダーから
//   組み立てる。
//
// 背景（本番で invalid origin になっていた原因）:
//   本番構成は 「ブラウザ(HTTPS) → Nginx → proxy_pass http://127.0.0.1:3000 → Next.js」。
//   Next.js が実際に受け取る接続は常にプレーンHTTPのため、
//   route handler内で `new URL(req.url).origin` を使うと
//   スキームが "http:" のまま（例: "http://app.fengshui.jp"）になる。
//   一方ブラウザが送るOriginヘッダーは実際のページのスキーム
//   （例: "https://app.fengshui.jp"）であり、両者が一致せず
//   「Originが正規なのにinvalid origin」と誤判定していた。
//   これはCSRFチェック（Origin比較）だけでなく、req.url を基準にした
//   redirect先URLの構築にも同じ影響がある（本番でhttpのままリダイレクトしてしまう）。
//   この1ファイルで両方の計算を一本化して修正する。
//
// 信頼境界（重要・変更しないこと）:
//   X-Forwarded-Proto / X-Forwarded-Host は、Next.js(127.0.0.1:3000)へ直接到達できる
//   経路がNginxだけである（インターネットへ直接公開していない）という前提のもとで
//   信頼している。Next.jsを直接インターネットへ公開する構成に変える場合は
//   この前提が崩れるため要見直し（クライアントがこれらのヘッダーを偽装できてしまう）。

function firstValue(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  return first || null;
}

/** ブラウザから見た公開スキーム＋ホスト（例: "https://app.fengshui.jp"）を求める。 */
export function resolvePublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = firstValue(req.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  const host =
    firstValue(req.headers.get("x-forwarded-host")) ??
    firstValue(req.headers.get("host")) ??
    url.host;
  return `${proto}://${host}`;
}

/** "/"始まりの相対パスを、公開Originを基準にした絶対URLへ変換する（redirect先の構築用）。 */
export function buildPublicUrl(path: string, req: Request): URL {
  return new URL(path, resolvePublicOrigin(req));
}

/**
 * CSRF対策: Originヘッダーが自サイト（公開Origin）と一致するかを確認する。
 * Originヘッダー自体が無いリクエストは許可する
 * （ブラウザは通常クロスオリジンPOSTに必ずOriginを付与するため、
 *  無いことをもって偽装とはみなさない一般的な方針。この方針自体は変更しない）。
 */
export function isTrustedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === resolvePublicOrigin(req);
}
