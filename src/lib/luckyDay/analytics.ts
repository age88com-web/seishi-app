// src/lib/luckyDay/analytics.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の GA4 計測（ユーザー指示、2026-10-20）。
//   ① layout.tsx が読み込む gtag 初期化スクリプト（buildGa4InitScript）
//   ② 4種類のカスタムイベント送信（sendTakujitsuEvent）
//   GA4 を読み込むのは src/app/lucky-day/layout.tsx だけで、ルートレイアウト・
//   他の占術アプリには計測を追加しない。
//
// 個人情報（GA4へ送らないもの）:
//   氏名・メールアドレス・生年月日・会員ID/WordPressユーザーID・検索条件の
//   詳細・認証トークン・会員レベル/課金状態。カスタムイベントは
//   イベント名だけを送り、パラメータは付けない。
//   ページURLは、パスと広告計測用のパラメータ（utm_* 等、
//   GA4_ALLOWED_QUERY_PARAMS）だけを残して送る（page_location を 'set'
//   で上書きするため、自動計測イベントにも同じURLが使われる）。
//
// 本サイトとのセッション継続:
//   fengshui.jp（WordPress）の gtag 設定と同じ cookie_domain・cookie_flags に
//   そろえ、_ga Cookie（.fengshui.jp）を共有する。サブドメイン間は
//   同じCookieを読むため、クロスドメインのリンカー（_gl）は使わない。
//
// page_view:
//   gtag('config') が送る1回だけ。/lucky-day は1画面のアプリで、
//   画面内で URL を変える遷移（router.push・history.pushState）は無い。
//   独自の page_view 送信はしない（二重送信を避けるため）。

export const GA4_MEASUREMENT_ID = "G-QJTBLF194P";

/** page_location に残してよいクエリパラメータ（広告・キャンペーン計測用のみ）。 */
export const GA4_ALLOWED_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

export type TakujitsuEventName =
  | "takujitsu_app_open"
  | "takujitsu_date_search"
  | "takujitsu_plan_click"
  | "takujitsu_course_click";

/**
 * gtag 初期化スクリプト（インライン）。
 * page_location は「origin＋パス＋許可したパラメータだけ」に置き換えてから config する。
 */
export function buildGa4InitScript(): string {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
(function(){
  var allowed = ${JSON.stringify(GA4_ALLOWED_QUERY_PARAMS)};
  var src = new URL(window.location.href);
  var kept = new URLSearchParams();
  allowed.forEach(function(k){ var v = src.searchParams.get(k); if (v !== null) kept.set(k, v); });
  var q = kept.toString();
  gtag('set', { page_location: src.origin + src.pathname + (q ? '?' + q : '') });
})();
gtag('config', '${GA4_MEASUREMENT_ID}', { cookie_domain: 'fengshui.jp', cookie_flags: 'samesite=none;secure' });
`;
}

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/**
 * カスタムイベントを送る（イベント名のみ、パラメータなし）。
 * 初期化スクリプト（afterInteractive）より先に呼ばれた場合だけ、短い間隔で再試行する。
 */
export function sendTakujitsuEvent(name: TakujitsuEventName, attempt = 0): void {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;
  if (typeof w.gtag === "function") {
    w.gtag("event", name);
    return;
  }
  if (attempt < 20) window.setTimeout(() => sendTakujitsuEvent(name, attempt + 1), 250);
}
