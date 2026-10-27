// src/app/lucky-day/travel/page.tsx
//
// 役割:
//   「海外旅行・観光の吉日」の専用ページ（/lucky-day/travel）。Server Component。
//   /lucky-day/car/page.tsx と同じく会員状態を取得して Client Component へ渡すだけ。
//   月間一覧の判定・無料/有料の制限は Server Action（getTravelMonthAction）が
//   会員状態をサーバー側で取り直して行うため、このページ経由で制限は迂回できない。

import type { Metadata } from "next";
import { getCurrentTakujitsuMember, isDevPaidMemberOverrideEnabled } from "@/lib/luckyDay/auth/member";
import TravelPageClient from "./TravelPageClient";

export const metadata: Metadata = {
  title: "海外旅行・観光の吉日｜伝統風水師 秀山",
};

export default async function LuckyDayTravelPage() {
  const memberStatus = await getCurrentTakujitsuMember();
  return <TravelPageClient memberStatus={memberStatus} devModeActive={isDevPaidMemberOverrideEnabled()} />;
}
