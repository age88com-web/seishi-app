// src/app/lucky-day/layout.tsx
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用の
//   ① ブラウザタブのページタイトル（metadata.title）
//   ② Google Analytics 4 計測
//   ③ Microsoft Clarity 計測
//   を設定する。
//
//   fengshui.jp（WordPress）が既に使用している GA4 プロパティと同じ
//   測定ID（G-QJTBLF194P）を app.fengshui.jp 側でも使用する
//   （ユーザー指示: 「同じGA4プロパティを使用します」）。
//
// 重要（スコープ）:
//   ルートレイアウト（src/app/layout.tsx、title:"七政四餘"）は変更して
//   いない。このネストレイアウトは /lucky-day 配下の page.tsx にのみ
//   適用され、/takujitsu・/qimen・七政四餘トップ等の既存ページには
//   一切影響しない（Next.js App Router のネストレイアウトは、対象
//   ルート配下の page.tsx がレンダリングされる場合にのみ適用される。
//   /lucky-day/auth・/lucky-day/logout は Route Handler であり React を
//   描画しないため、このレイアウト自体が適用される場面がない）。
//   擇日判定ロジック・会員認証（WordPress + PMPro）・決済処理・
//   既存UIは一切変更していない。
//
// ページタイトルについて（2026-09-19追加）:
//   Next.js App Router の metadata API（`export const metadata`）を
//   このネストレイアウトで宣言すると、/lucky-day 配下では
//   ルートレイアウトの title（"七政四餘"）を上書きし、
//   "擇日・吉日検索｜伝統風水師 秀山" が適用される。他のルート
//   （/takujitsu・/qimen・/）は引き続きルートレイアウトの title を
//   継承するため影響しない。
//
// 実装方法（Next.js公式ドキュメント推奨のパターン、GA4）:
//   next/script の Script コンポーネントで gtag.js を読み込む。
//   strategy="afterInteractive" は、初期表示（LCP等）をブロックせず、
//   ページがハイドレーションされた直後に実行する設定で、Next.jsが
//   アナリティクス系スクリプトに推奨している値。
//   gtag('config', ...) 呼び出しにより、ページビュー・参照元
//   （document.referrer）・ユーザー数はgtag.js標準の自動計測機能で
//   GA4へ送信される。
//
// GA4 の補強（ユーザー指示、2026-10-20）:
//   初期化スクリプトは src/lib/luckyDay/analytics.ts の buildGa4InitScript()。
//   page_location からパスと utm_* 等以外のクエリを除き、cookie_domain・
//   cookie_flags を fengshui.jp 側の設定にそろえる（_ga Cookie を共有して
//   本サイトとセッションを継続する）。page_view は config の1回だけ。
//   4種類のカスタムイベント（takujitsu_app_open・takujitsu_date_search・
//   takujitsu_plan_click・takujitsu_course_click）は LuckyDayClient.tsx から
//   sendTakujitsuEvent() で送る（イベント名のみ、パラメータなし）。
//
// Microsoft Clarity について（2026-09-23追加）:
//   fengshui.jp（WordPress）側と同じ Clarity プロジェクト
//   （Project ID: t0b0tddop1）を使用する。Clarity公式のトラッキング
//   コードを、GA4と同じく next/script（strategy="afterInteractive"）の
//   インラインスクリプトとして読み込む。ルートレイアウトには追加して
//   いないため、計測対象は /lucky-day 配下のみ。

// 測定IDについて:
//   GA4測定ID自体は秘密情報ではない（ページのHTML/JSに常に露出する
//   公開情報）ため、環境変数化はせずこのファイルに直接記載している。

import type { Metadata } from "next";
import Script from "next/script";
import { buildGa4InitScript, GA4_MEASUREMENT_ID } from "@/lib/luckyDay/analytics";

const CLARITY_PROJECT_ID = "t0b0tddop1";

export const metadata: Metadata = {
  title: "擇日・吉日検索｜伝統風水師 秀山",
};

export default function LuckyDayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {buildGa4InitScript()}
      </Script>
      <Script id="clarity-init" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
        `}
      </Script>
      {children}
    </>
  );
}
