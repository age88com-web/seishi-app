// src/lib/ziwei/lunisolar.ts
//
// 作盤日と陰暦（§2.1・§2.2・§2.4・§2.5・§2.8）。
//
// 処理順（§2.8 確定仕様）:
//   補正済み時刻 → 23:00 以上なら作盤日（西暦）を翌日に進める → 作盤日を固定UTC+8基準の陰暦へ変換
//   → 閏月の場合のみ前半・後半を判定
//
// 陰暦そのもの（朔・中気・閏月）は共通暦エンジン resolveLunisolar() に固定UTC+8（Etc/GMT-8）を
// 渡して得る。Asia/Shanghai は使わない（歴史上の夏時間を含むため。§2.1）。
// 共通エンジンにない陰暦年（旧正月で切り替わる年）と月の日数は、その戻り値から求める。

import { resolveLunisolar } from "../calendar";
import type { Branch, CivilDate, LeapHalf, LunarDate, Stem, WallClock } from "./types";
import { STEMS, BRANCHES } from "./data";

/** §2.1 陰暦の基準（固定 UTC+8）。 */
export const LUNAR_TIME_ZONE = "Etc/GMT-8";
const UTC8_OFFSET_MS = 8 * 3_600_000;
const MS_PER_DAY = 86_400_000;

const SECONDS_23H = 23 * 3600;
const SECONDS_11H = 11 * 3600;

export function secondsOfDay(w: WallClock): number {
  return w.hour * 3600 + w.minute * 60 + w.second;
}

/**
 * §2.5・§2.8 手順4〜5: 補正済み時刻の日付。23:00 以上（23:00 ちょうどを含む。旧U6）なら翌日。
 */
export function resolveChartDate(corrected: WallClock): { chartDate: CivilDate; advancedAt23: boolean } {
  const advancedAt23 = secondsOfDay(corrected) >= SECONDS_23H;
  const d = new Date(Date.UTC(corrected.year, corrected.month - 1, corrected.day + (advancedAt23 ? 1 : 0)));
  return {
    chartDate: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    advancedAt23,
  };
}

/** 瞬間を固定UTC+8の暦日の通し番号にする。 */
function utc8DayNumber(instant: Date): number {
  return Math.floor((instant.getTime() + UTC8_OFFSET_MS) / MS_PER_DAY);
}

/** 陰暦年から年干支（1984＝甲子）。 */
export function yearGanzhi(lunarYear: number): { stem: Stem; branch: Branch } {
  const i = (((lunarYear - 1984) % 60) + 60) % 60;
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12] };
}

/**
 * §2.8 手順6〜7: 西暦の日付（作盤日）を、同じ日付の固定UTC+8の暦日の陰暦に変換する。
 *
 * 陰暦年は旧正月で切り替わる（§2.2）。陰暦の1月は新暦1〜2月に始まり、11月・12月（閏を含む）は
 * 新暦11月〜翌2月にあたるため、新暦1〜2月にある11月・12月だけ前年の陰暦年に属する。
 */
export function lunarDateOf(date: CivilDate): LunarDate {
  // その日付の UTC+8 正午（暦日の中ほど）を問い合わせる。
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day, 12) - UTC8_OFFSET_MS);
  const r = resolveLunisolar(instant, LUNAR_TIME_ZONE);

  const monthLength = utc8DayNumber(new Date(r.nextNewMoonTime)) - utc8DayNumber(new Date(r.newMoonTime));
  if (monthLength !== 29 && monthLength !== 30) {
    throw new Error(`陰暦月の日数が29/30ではありません（${monthLength}日）: ${date.year}/${date.month}/${date.day}`);
  }

  const lunarYear = r.lunarMonth >= 11 && date.month <= 2 ? date.year - 1 : date.year;
  const { stem, branch } = yearGanzhi(lunarYear);
  return {
    lunarYear,
    yearStem: stem,
    yearBranch: branch,
    month: r.lunarMonth,
    isLeapMonth: r.isLeapMonth,
    day: r.lunarDay,
    monthLength,
  };
}

/**
 * §2.4 閏月の前半・後半（§2.8 手順8）。閏月でなければ null。
 *
 * - 陰暦日 < 15 → 前半、> 15 → 後半
 * - 陰暦日 = 15:
 *   - 23時の日替わりで作盤日が進んだ出生は「15日に入った直後」（旧U17）→ 前半
 *   - それ以外は補正済み時刻を境界（30日の月 23:00、29日の月 11:00）と比べ、
 *     時刻 < 境界 → 前半、時刻 ≥ 境界 → 後半（旧U4）
 */
export function judgeLeapHalf(lunar: LunarDate, corrected: WallClock, advancedAt23: boolean): LeapHalf | null {
  if (!lunar.isLeapMonth) return null;
  if (lunar.day < 15) return "前半";
  if (lunar.day > 15) return "後半";
  if (advancedAt23) return "前半";
  const boundary = lunar.monthLength === 30 ? SECONDS_23H : SECONDS_11H;
  return secondsOfDay(corrected) < boundary ? "前半" : "後半";
}

/**
 * 作盤に使う生月（§2.4）。閏月の前半は本月、後半は後月。日は変えない。
 * 閏12月の後半は「後月」が翌年1月となり、年の扱いが資料に記載されていないため未対応とする。
 */
export function birthMonthOf(lunar: LunarDate, leapHalf: LeapHalf | null): number {
  if (leapHalf === null || leapHalf === "前半") return lunar.month;
  if (lunar.month === 12) {
    throw new Error("閏12月の後半生まれは、後月（翌年1月）とする際の年の扱いが資料にないため未対応です。");
  }
  return lunar.month + 1;
}

/**
 * §14.3 数え年: 対象日の陰暦年 − 生まれの陰暦年 + 1（旧正月ごとに加算）。
 * 対象日も固定UTC+8基準の陰暦で年を決める（§2.1）。
 */
export function kazoeAge(birthLunarYear: number, target: CivilDate): number {
  return lunarDateOf(target).lunarYear - birthLunarYear + 1;
}
