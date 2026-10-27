"use client";

// src/app/lucky-day/car/CarPageClient.tsx
//
// 役割:
//   /lucky-day/car の画面。既存の NewCarMonthlyCard（月間一覧）をそのまま置き、
//   見出し・説明文・トップへ戻るリンクを付ける。スタイル・会員表示・有料案内は
//   /lucky-day と同じもの（LuckyDayClient.tsx）を使う。

import { useMemo } from "react";
import Link from "next/link";
import { getTodayInTokyo, getFreeMaxDateIso, FREE_DAYS_AHEAD } from "@/lib/luckyDay";
import type { TakujitsuMemberStatus } from "@/lib/luckyDay/auth/member";
import NewCarMonthlyCard from "../NewCarMonthlyCard";
import { LUCKY_DAY_CSS, MemberStatusBar, PaywallNotice } from "../LuckyDayClient";

export default function CarPageClient({
  memberStatus,
  devModeActive = false,
}: {
  memberStatus: TakujitsuMemberStatus;
  /** 開発専用オーバーライドの表示用（/lucky-day と同じ。セキュリティ境界ではない）。 */
  devModeActive?: boolean;
}) {
  const today = useMemo(() => getTodayInTokyo(), []);
  const isPaid = memberStatus.active;

  return (
    <main className="ld-page ld-subpage">
      <style>{LUCKY_DAY_CSS + CAR_PAGE_CSS}</style>
      {devModeActive && <div className="ld-dev-banner">開発モード：有料会員</div>}

      <Link href="/lucky-day" className="ld-back-btn ld-subpage-back">
        ← 吉日暦トップへ戻る
      </Link>

      <header className="ld-hero">
        <h1 className="ld-hero-title">新車購入・納車の吉日</h1>
        <p className="ld-hero-lead">新車購入の吉日は、購入契約を結ぶ日にもご利用いただけます。</p>
      </header>

      <MemberStatusBar memberStatus={memberStatus} />

      <NewCarMonthlyCard
        todayIso={today.iso}
        freeMaxDateIso={getFreeMaxDateIso(today.iso)}
        isPaid={isPaid}
        paywall={
          <PaywallNotice
            memberStatus={memberStatus}
            message={`無料版で表示できるのは今日から${FREE_DAYS_AHEAD}日先までです。ほかの日は有料会員でご覧いただけます。`}
          />
        }
      />

      <Link href="/lucky-day" className="ld-back-btn ld-subpage-back">
        ← 吉日暦トップへ戻る
      </Link>
    </main>
  );
}

const CAR_PAGE_CSS = `
.ld-subpage-back { display: inline-block; margin: 0 0 12px; text-decoration: none; }
@media (min-width: 900px) {
  .ld-subpage { max-width: 760px; }
}
`;
