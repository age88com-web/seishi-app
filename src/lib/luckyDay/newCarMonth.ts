// src/lib/luckyDay/newCarMonth.ts
//
// 役割:
//   「新車購入・納車の吉日」月間一覧の1か月分を組み立てる（サーバー側から呼ぶ純粋な処理）。
//   各日は既存の calculateTakujitsuFull()（12:00・Asia/Tokyo、DayDetailCard と同じ基準）で
//   計算し、newCarJudgment.ts で判定する。
//
// 無料/有料（既存仕様の再利用）:
//   日ごとに既存の isDateAllowedForDetail()（無料＝今日〜今日+30日、有料＝全日）で判定し、
//   許可されない日は計算自体を行わず locked として返す（判定データをクライアントへ渡さない）。
//   この機能独自の課金設定は持たない。

import { calculateTakujitsuFull } from "@/lib/takujitsu";
import { isDateAllowedForDetail } from "./accessControl";
import { formatIso, weekdayOfIso } from "./today";
import { judgeNewCarDay } from "./newCarJudgment";
import type { NewCarDayJudgment } from "./newCarJudgment";

export type NewCarMonthDay =
  | { dateIso: string; weekday: number; locked: false; judgment: NewCarDayJudgment }
  | { dateIso: string; weekday: number; locked: true };

export interface NewCarMonth {
  year: number;
  month: number;
  days: NewCarMonthDay[];
  /** 無料版の範囲外で表示できない日が1日以上あるか。 */
  hasLockedDays: boolean;
}

/** 月間一覧で受け付ける年の範囲（入力検証用）。 */
export const NEW_CAR_MIN_YEAR = 1901;
export const NEW_CAR_MAX_YEAR = 2099;

export function isValidNewCarYearMonth(year: unknown, month: unknown): year is number {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    (year as number) >= NEW_CAR_MIN_YEAR &&
    (year as number) <= NEW_CAR_MAX_YEAR &&
    (month as number) >= 1 &&
    (month as number) <= 12
  );
}

/** 暦月の日数（閏年を含む）。 */
export function daysInMonthOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 年月を delta か月ずらす（前月・翌月の切替用）。 */
export function shiftYearMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function buildNewCarMonth(year: number, month: number, todayIso: string, isPaid: boolean): NewCarMonth {
  const days: NewCarMonthDay[] = [];
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
    days.push({ dateIso, weekday, locked: false, judgment: judgeNewCarDay(dateIso, weekday, result) });
  }
  return { year, month, days, hasLockedDays };
}
