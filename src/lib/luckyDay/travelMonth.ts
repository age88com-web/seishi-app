// src/lib/luckyDay/travelMonth.ts
//
// 役割:
//   「海外旅行・観光の吉日」月間一覧の1か月分を組み立てる（サーバー側から呼ぶ純粋な処理）。
//   新車の月間一覧（newCarMonth.ts）と同じく、各日は既存の calculateTakujitsuFull()
//   （12:00・Asia/Tokyo）で計算し、travelJudgment.ts で判定する。
//
// 無料/有料（既存仕様の再利用）:
//   日ごとに既存の isDateAllowedForDetail()（無料＝今日〜今日+30日、有料＝全日）で判定し、
//   許可されない日は計算自体を行わず locked として返す（判定データをクライアントへ渡さない）。
//   この機能独自の課金設定は持たない。
//
// 個人の忌日（2026-10-27）:
//   birth が渡されたときだけ、表示できる日について既存の computePersonalResultForDay()
//   （有料会員でなければ計算せず null）で個人判定を付ける。一般の旅行判定は変えない。

import { calculateTakujitsuFull } from "@/lib/takujitsu";
import { isDateAllowedForDetail } from "./accessControl";
import { formatIso, weekdayOfIso } from "./today";
import { daysInMonthOf } from "./newCarMonth";
import { judgeTravelDay } from "./travelJudgment";
import type { TravelDayJudgment } from "./travelJudgment";
import { computePersonalResultForDay } from "./personalJudgment";
import type { LuckyDayBirthInput } from "./personalJudgment";
import type { PersonalTakujitsuResult } from "@/lib/takujitsu/personal";

export type TravelMonthDay =
  | {
      dateIso: string;
      weekday: number;
      locked: false;
      judgment: TravelDayJudgment;
      /** 個人の忌日判定。null＝判定していない（生年月日なし・無料/未ログイン）。 */
      personal: PersonalTakujitsuResult | null;
    }
  | { dateIso: string; weekday: number; locked: true };

export interface TravelMonth {
  year: number;
  month: number;
  days: TravelMonthDay[];
  /** 無料版の範囲外で表示できない日が1日以上あるか。 */
  hasLockedDays: boolean;
}

export function buildTravelMonth(
  year: number,
  month: number,
  todayIso: string,
  isPaid: boolean,
  birth: LuckyDayBirthInput | null = null,
): TravelMonth {
  const days: TravelMonthDay[] = [];
  let hasLockedDays = false;
  const n = daysInMonthOf(year, month);
  for (let day = 1; day <= n; day++) {
    const dateIso = formatIso(year, month, day);
    const weekday = weekdayOfIso(dateIso);
    if (!isDateAllowedForDetail(dateIso, todayIso, isPaid)) {
      hasLockedDays = true;
      days.push({ dateIso, weekday, locked: true });
      continue;
    }
    const result = calculateTakujitsuFull({ year, month, day, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    days.push({
      dateIso,
      weekday,
      locked: false,
      judgment: judgeTravelDay(dateIso, weekday, result),
      personal: computePersonalResultForDay(isPaid, birth, result.calendar.dayBranch),
    });
  }
  return { year, month, days, hasLockedDays };
}
