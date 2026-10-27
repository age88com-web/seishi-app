// src/app/lucky-day/car/page.tsx
//
// 役割:
//   「新車購入・納車の吉日」の専用ページ（/lucky-day/car）。Server Component。
//   /lucky-day/page.tsx と同じく会員状態を取得して Client Component へ渡すだけ。
//   月間一覧の判定・無料/有料の制限は Server Action（getNewCarMonthAction）が
//   会員状態をサーバー側で取り直して行うため、このページ経由で制限は迂回できない。

import type { Metadata } from "next";
import { getCurrentTakujitsuMember, isDevPaidMemberOverrideEnabled } from "@/lib/luckyDay/auth/member";
import CarPageClient from "./CarPageClient";

export const metadata: Metadata = {
  title: "新車購入・納車の吉日｜伝統風水師 秀山",
};

export default async function LuckyDayCarPage() {
  const memberStatus = await getCurrentTakujitsuMember();
  return <CarPageClient memberStatus={memberStatus} devModeActive={isDevPaidMemberOverrideEnabled()} />;
}
