// src/lib/calendar/solarTerm.ts
//
// 役割:
//   太陽黄経から二十四節気を判定し、節入り日時を求める。
//   - sunLongitude       : 対象時刻の太陽黄経（度, 0..360）
//   - solarTerm          : 対象時刻が属する節気の名称
//   - solarTermDateTime  : solarTerm の節入り日時（UTC の ISO 8601 文字列）
//
// 実装方針（docs/02）:
//   - 固定日付は一切使わない。太陽黄経が 15° 刻みの境界
//     （立春 315° 〜 大寒 300°）に達した時刻を節入りとする。
//   - 太陽黄経は astro.ts の sunLonDeg(d: Date) を利用し再実装しない。
//   - 節入り時刻は二分法で数値的に求める（太陽黄経は単調増加のため一意）。
//
// docs: 02_共通暦エンジン要件 / 03_共通暦エンジン設計

import { sunLonDeg } from "../astro";
import { SOLAR_TERMS } from "./types";

const MS_PER_DAY = 86_400_000;

export interface SolarTermResult {
  /** 対象時刻の太陽黄経（度, 0..360） */
  sunLongitude: number;
  /** 対象時刻が属する節気の名称 */
  solarTerm: string;
  /** solarTerm の節入り日時（UTC の ISO 8601 文字列） */
  solarTermDateTime: string;
}

function norm360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

/**
 * 太陽黄経 lon と境界 boundary の差を (-180, 180] の符号付き角度で返す。
 * boundary を跨ぐ前は負、跨いだ後は正になる。
 */
function signedDelta(lon: number, boundary: number): number {
  return ((lon - boundary + 540) % 360) - 180;
}

/**
 * before 以前で最も近い、「太陽黄経が targetLongitude に達した瞬間」を
 * 二分法で求める（UTC）。
 */
export function findSolarTermCrossing(before: Date, targetLongitude: number): Date {
  const hiStart = before.getTime();
  let loMs = hiStart - 30 * MS_PER_DAY;
  let hiMs = hiStart;

  // 下限で必ず「境界前（負）」になるまで遡る（通常は不要。安全策）。
  let guard = 0;
  while (
    signedDelta(sunLonDeg(new Date(loMs)), targetLongitude) >= 0 &&
    guard < 6
  ) {
    loMs -= 20 * MS_PER_DAY;
    guard += 1;
  }

  // 二分法：g<0 なら crossing はまだ先、g>=0 なら crossing は手前。
  for (let i = 0; i < 60; i += 1) {
    const midMs = (loMs + hiMs) / 2;
    const g = signedDelta(sunLonDeg(new Date(midMs)), targetLongitude);
    if (g < 0) {
      loMs = midMs;
    } else {
      hiMs = midMs;
    }
    if (hiMs - loMs < 1) break; // 1ms 精度
  }

  return new Date(Math.round((loMs + hiMs) / 2));
}

/**
 * 対象時刻（UTC）が属する節気と、その節入り日時を返す。
 */
export function resolveSolarTerm(utc: Date): SolarTermResult {
  const lon = norm360(sunLonDeg(utc));
  const boundary = Math.floor(lon / 15) * 15; // 0, 15, ..., 345

  const def = SOLAR_TERMS.find((t) => t.longitude === boundary);
  if (!def) {
    throw new Error(`solar term not found for longitude ${lon}`);
  }

  const instant = findSolarTermCrossing(utc, def.longitude);

  return {
    sunLongitude: lon,
    solarTerm: def.name,
    solarTermDateTime: instant.toISOString(),
  };
}
