"use client";

// src/app/lucky-day/travel/TravelPageClient.tsx
//
// 役割:
//   /lucky-day/travel の画面。TravelMonthlyCard（月間一覧）を置き、
//   見出し・説明文・トップへ戻るリンクを付ける（/lucky-day/car の CarPageClient と同じ構成）。
//   スタイル・会員表示・有料案内は /lucky-day と同じもの（LuckyDayClient.tsx）を使う。
//
// 個人の忌日（2026-10-27）:
//   /lucky-day と同じ PersonalBirthInputCard を有料会員にだけ表示する（無料/未ログインには出さない
//   ＝トップと同じ仕様）。生年月日はこのページの state に持つだけで保存しない（トップと同じく
//   ページを開くたびに入力する方式。トップとの共有の仕組みは既存に無いため作らない）。

import { useMemo, useState } from "react";
import Link from "next/link";
import { getTodayInTokyo, getFreeMaxDateIso, FREE_DAYS_AHEAD, parseIsoDate } from "@/lib/luckyDay";
import type { TakujitsuMemberStatus } from "@/lib/luckyDay/auth/member";
import type { LuckyDayBirthInput } from "@/lib/luckyDay/personalJudgment";
import TravelMonthlyCard from "../TravelMonthlyCard";
import { LUCKY_DAY_CSS, MemberStatusBar, PaywallNotice, PersonalBirthInputCard } from "../LuckyDayClient";

export default function TravelPageClient({
  memberStatus,
  devModeActive = false,
}: {
  memberStatus: TakujitsuMemberStatus;
  /** 開発専用オーバーライドの表示用（/lucky-day と同じ。セキュリティ境界ではない）。 */
  devModeActive?: boolean;
}) {
  const today = useMemo(() => getTodayInTokyo(), []);
  const isPaid = memberStatus.active;

  // 生年月日（"YYYY-MM-DD"、未入力は空文字）。/lucky-day の LuckyDayClient と同じ扱い。
  const [birthIso, setBirthIso] = useState("");
  const birthInput: LuckyDayBirthInput | null = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthIso)) return null;
    const { year, month, day } = parseIsoDate(birthIso);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    return { year, month, day };
  }, [birthIso]);

  return (
    <main className="ld-page ld-subpage">
      <style>{LUCKY_DAY_CSS + TRAVEL_PAGE_CSS}</style>
      {devModeActive && <div className="ld-dev-banner">開発モード：有料会員</div>}

      <Link href="/lucky-day" className="ld-back-btn ld-subpage-back">
        ← 吉日暦トップへ戻る
      </Link>

      <header className="ld-hero">
        <h1 className="ld-hero-title">海外旅行・観光の吉日</h1>
        <p className="ld-hero-lead">
          海外旅行や遠方への旅行を始めるのに適した日を調べられます。吉日は旅行の出発日を基準としています。
        </p>
      </header>

      <MemberStatusBar memberStatus={memberStatus} />

      {isPaid && (
        <PersonalBirthInputCard
          memberStatus={memberStatus}
          birthIso={birthIso}
          onChangeBirthIso={setBirthIso}
          title="個人の忌日を除外する"
          allowClear
        />
      )}

      <TravelMonthlyCard
        todayIso={today.iso}
        freeMaxDateIso={getFreeMaxDateIso(today.iso)}
        isPaid={isPaid}
        birth={isPaid ? birthInput : null}
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

const TRAVEL_PAGE_CSS = `
.ld-subpage-back { display: inline-block; margin: 0 0 12px; text-decoration: none; }
@media (min-width: 900px) {
  .ld-subpage { max-width: 760px; }
}
`;
