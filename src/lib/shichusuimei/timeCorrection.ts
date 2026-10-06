// src/lib/shichusuimei/timeCorrection.ts
//
// 出生時刻の地方真太陽時補正（D7・D8・D9・D15・D28・D29）。
//
//   1. 出生地の現地法定時刻を受け取る
//   2. 出生の瞬間（UTC）から、その日時の法定オフセット（サマータイム込み）を得る
//      （UTC 変換は共通暦エンジン calculate() が Intl.DateTimeFormat + IANA ID で行う）
//   3. サマータイム分（法定オフセット − 標準時オフセット）を戻して現地標準時にする
//   4. 標準子午線と出生地経度の差による地域時差を加える
//   5. p23 の均時差を加える
//   6. 地方真太陽時を得る
//
// 標準時オフセットは Asia/Tokyo なら日本標準時 +540 分。それ以外は入力で明示する
// （Intl からは標準時とサマータイムを確実に分離できないため推定しない）。
// 地方真太陽時は時支と 23:00 の日替わりにだけ使う。年柱・月柱には使わない（D10）。

import type { BirthPlace, RegionalDiffSource, TimeCorrection } from "./types";
import {
  P22_REGIONAL_DIFF_AS_PRINTED,
  P22_EXCLUDED_FROM_CALCULATION,
  P23_EQUATION_OF_TIME,
  JST_OFFSET_MINUTES,
  JAPAN_TIME_ZONE,
} from "./data";

const MS_PER_MINUTE = 60_000;

/** 年月日時分秒（壁時計）。Date.UTC の数値として扱う */
export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function wallClockToMs(w: WallClock): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

export function msToWallClock(ms: number): WallClock {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export function formatWallClock(w: WallClock): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${p(w.year, 4)}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}:${p(w.second)}`;
}

/** 現地標準時の UTC オフセット（分）。Asia/Tokyo 以外は明示が必要（D29） */
export function resolveStandardOffsetMinutes(place: BirthPlace): number {
  if (place.standardOffsetMinutes !== undefined) return place.standardOffsetMinutes;
  if (place.timeZone === JAPAN_TIME_ZONE) return JST_OFFSET_MINUTES;
  throw new Error(
    `standardOffsetMinutes is required for time zone ${place.timeZone} (D29: 海外出生は標準時オフセットを明示する)`,
  );
}

/**
 * 地域時差（分）。明示指定 → p22 の地名（日本標準時のみ・金沢を除く）→ 経度 の順。
 * 経度からは（経度 − 標準子午線）× 4 分（D7・D8）。丸めない。
 */
export function resolveRegionalDiff(
  place: BirthPlace,
  standardOffsetMinutes: number,
): { minutes: number; source: RegionalDiffSource } {
  if (place.regionalDiffMinutes !== undefined) {
    return { minutes: place.regionalDiffMinutes, source: "explicit" };
  }
  if (
    place.p22Name !== undefined &&
    standardOffsetMinutes === JST_OFFSET_MINUTES &&
    !P22_EXCLUDED_FROM_CALCULATION.includes(place.p22Name) &&
    Object.hasOwn(P22_REGIONAL_DIFF_AS_PRINTED, place.p22Name)
  ) {
    return { minutes: P22_REGIONAL_DIFF_AS_PRINTED[place.p22Name], source: "p22" };
  }
  if (place.longitude !== undefined) {
    const meridian = standardOffsetMinutes / 4;
    return { minutes: (place.longitude - meridian) * 4, source: "longitude" };
  }
  throw new Error(
    `regional time difference is undetermined: give regionalDiffMinutes, a p22 place name, or longitude` +
      (place.p22Name !== undefined ? ` (p22Name "${place.p22Name}" is not usable)` : ""),
  );
}

/** p23 の均時差（分）。month 1-12, day 1-31 */
export function equationOfTimeMinutes(month: number, day: number): number {
  const row = P23_EQUATION_OF_TIME[month];
  const v = row?.[day - 1];
  if (v === undefined) throw new Error(`no p23 equation of time for ${month}/${day}`);
  return v;
}

/**
 * 現地法定時刻と出生の瞬間（UTC）から地方真太陽時を求める。
 * 均時差は現地標準時の月日で p23 を引く。
 */
export function toLocalApparentSolarTime(
  legal: WallClock,
  utc: Date,
  place: BirthPlace,
): { correction: TimeCorrection; solarTime: WallClock; standardLocal: WallClock } {
  const legalMs = wallClockToMs(legal);
  const legalOffsetMinutes = Math.round((legalMs - utc.getTime()) / MS_PER_MINUTE);
  const standardOffsetMinutes = resolveStandardOffsetMinutes(place);
  const dstMinutes = legalOffsetMinutes - standardOffsetMinutes;
  if (dstMinutes < 0) {
    throw new Error(
      `legal offset ${legalOffsetMinutes}min is behind standard offset ${standardOffsetMinutes}min (${place.timeZone})`,
    );
  }

  const standardMs = utc.getTime() + standardOffsetMinutes * MS_PER_MINUTE;
  const standardLocal = msToWallClock(standardMs);

  const regional = resolveRegionalDiff(place, standardOffsetMinutes);
  const eot = equationOfTimeMinutes(standardLocal.month, standardLocal.day);
  const solarMs = standardMs + (regional.minutes + eot) * MS_PER_MINUTE;
  const solarTime = msToWallClock(solarMs);

  return {
    standardLocal,
    solarTime,
    correction: {
      utc: utc.toISOString(),
      legalOffsetMinutes,
      standardOffsetMinutes,
      dstMinutes,
      standardMeridian: standardOffsetMinutes / 4,
      standardLocal: formatWallClock(standardLocal),
      regionalDiffMinutes: regional.minutes,
      regionalDiffSource: regional.source,
      equationOfTimeMinutes: eot,
      localApparentSolarTime: formatWallClock(solarTime),
      dayChangedAt23: solarTime.hour >= 23,
    },
  };
}
