// src/lib/ziwei/timeCorrection.ts
//
// §2.7 出生時刻の補正（日本国内の出生のみ。旧U18）。
//   補正済み時刻 ＝ 出生地の法定時刻 − サマータイム分（該当する場合 1時間）＋ 出生地の時差
//   出生地の時差 ＝（出生地の経度 − 135°）× 4分（秒まで。2026-10-02 仕様変更: 表2「主要都市時差表」の一般化）
//   表2の地点名で指定した場合は表2の時差をそのまま使う（資料の命盤例・早見表の回帰テスト用）。
// 均時差は使わない（旧U3）。四柱推命の地方真太陽時・七政四餘の時刻補正は流用しない。

import type { Table2Place, TimeCorrection, WallClock, ZiweiBirthPlace } from "./types";
import { SUMMER_TIME_PERIODS, TABLE2_OFFSET_SECONDS } from "./data";

const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 3_600_000;

/** 壁時計の値を Date.UTC の数値として扱う（タイムゾーン変換はしない）。 */
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

/** 法定時刻の日付が入門 p.12 のサマータイム期間（両端の日を含む）に入るか。 */
export function isSummerTime(legal: WallClock): boolean {
  const key = legal.year * 10000 + legal.month * 100 + legal.day;
  return SUMMER_TIME_PERIODS.some(({ from, to }) => {
    const f = from[0] * 10000 + from[1] * 100 + from[2];
    const t = to[0] * 10000 + to[1] * 100 + to[2];
    return key >= f && key <= t;
  });
}

/** 日本標準時の基準子午線（東経135°） */
export const JST_MERIDIAN_DEGREES = 135;
/** 経度1°あたりの時差（秒）＝ 4分 */
const SECONDS_PER_DEGREE = 240;

/** 経度から地点の時差（秒）を求める: (経度 − 135) × 4分。秒単位に四捨五入する */
export function longitudeOffsetSeconds(longitude: number): number {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError(`経度が不正です: ${longitude}`);
  }
  // -0 を 0 にそろえる
  return Math.round((longitude - JST_MERIDIAN_DEGREES) * SECONDS_PER_DEGREE) || 0;
}

function resolvePlace(place: ZiweiBirthPlace): Pick<TimeCorrection, "place" | "longitude" | "placeOffsetSeconds"> {
  if (typeof place === "object") {
    return { place: place.name, longitude: place.longitude, placeOffsetSeconds: longitudeOffsetSeconds(place.longitude) };
  }
  const placeOffsetSeconds = TABLE2_OFFSET_SECONDS[place as Table2Place];
  if (placeOffsetSeconds === undefined) {
    throw new RangeError(`表2にない地点: ${place}（経度で指定する。§2.7）`);
  }
  return { place, longitude: null, placeOffsetSeconds };
}

export function correctBirthTime(legal: WallClock, birthPlace: ZiweiBirthPlace): TimeCorrection {
  const { place, longitude, placeOffsetSeconds } = resolvePlace(birthPlace);
  const summerTimeApplied = isSummerTime(legal);
  const ms = wallClockToMs(legal) - (summerTimeApplied ? MS_PER_HOUR : 0) + placeOffsetSeconds * MS_PER_SECOND;
  return { legal, summerTimeApplied, place, longitude, placeOffsetSeconds, corrected: msToWallClock(ms) };
}
