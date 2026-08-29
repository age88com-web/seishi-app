// src/lib/calendar/julian.ts
//
// 役割:
//   時刻の正規化と暦の基礎数値を担当する。
//   - 入力（IANA timezone の壁時計時刻）→ UTC（Date / ISO 8601 文字列）
//   - UTC → Julian Day
//   - ΔT（TT − UT、秒）
//
// 実装方針:
//   - timezone 変換は Intl.DateTimeFormat のみを使用（新規依存なし）。
//   - Julian Day / ΔT は astronomy-engine の AstroTime から取得し再実装しない。
//     JD  = AstroTime.ut + 2451545.0
//     ΔT  = (AstroTime.tt − AstroTime.ut) × 86400  [秒]
//   - astro.ts は変更しない。JD 計算は astronomy-engine に委ねるため import 不要。
//   - 太陽黄経など他の天文計算が必要な箇所は utcDate を渡して astro.ts を利用する。
//
// docs: 03_共通暦エンジン設計 / 05_CalendarEngine_API

import * as Astronomy from "astronomy-engine";
import type { CalendarInput } from "./types";
import { DEFAULT_TIMEZONE } from "./types";

export interface JulianResult {
  /** UTC の ISO 8601 文字列（例: 2026-08-28T07:30:00.000Z） */
  utc: string;
  /** UTC の Date（他の天文計算へそのまま渡せる） */
  utcDate: Date;
  /** ユリウス日（UT） */
  julianDay: number;
  /** ΔT（TT − UT、秒） */
  deltaT: number;
}

/** J2000.0 のユリウス日 */
const JD_J2000 = 2451545.0;

/**
 * 指定 timezone が Intl で解決可能か検証する。
 * 不正な場合は明示的なエラーを投げる。
 */
function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`invalid IANA timezone: ${timeZone}`);
  }
}

/**
 * ある瞬間 instant を timeZone で表したときのオフセット（ミリ秒）を返す。
 * local = utc + offset の関係。
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }

  // 一部エンジンは深夜 0 時を "24" と返すため補正する。
  if (map.hour === 24) map.hour = 0;

  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );

  return asUTC - instant.getTime();
}

/**
 * timeZone の壁時計時刻（year..second）を UTC の Date へ変換する。
 * DST 境界を跨ぐケースに対応するためオフセットを一度補正する。
 */
function zonedWallClockToUTC(input: Required<Pick<
  CalendarInput,
  "year" | "month" | "day" | "hour" | "minute"
>> & { second: number }, timeZone: string): Date {
  const naiveMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
  );

  const offset1 = timeZoneOffsetMs(new Date(naiveMs), timeZone);
  let utcMs = naiveMs - offset1;

  const offset2 = timeZoneOffsetMs(new Date(utcMs), timeZone);
  if (offset2 !== offset1) {
    utcMs = naiveMs - offset2;
  }

  return new Date(utcMs);
}

/**
 * 入力日時（timezone の壁時計時刻）を UTC に正規化し、
 * Julian Day と ΔT を返す。timezone 未指定時は "Asia/Tokyo"。
 */
export function toJulian(input: CalendarInput): JulianResult {
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  assertValidTimeZone(timeZone);

  const utcDate = zonedWallClockToUTC(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute,
      second: input.second ?? 0,
    },
    timeZone,
  );

  const astroTime = Astronomy.MakeTime(utcDate);
  const julianDay = astroTime.ut + JD_J2000;
  const deltaT = (astroTime.tt - astroTime.ut) * 86400;

  return {
    utc: utcDate.toISOString(),
    utcDate,
    julianDay,
    deltaT,
  };
}
