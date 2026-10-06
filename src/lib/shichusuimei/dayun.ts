// src/lib/shichusuimei/dayun.ts
//
// 大運（p28・p29、D11・D12・D17・D22・D23・D25・D26・D27）。
//
//   順逆   … 年干が陽: 男＝順行・女＝逆行 / 年干が陰: 男＝逆行・女＝順行
//   大運   … 月柱から六十甲子を1つずつ進める（逆行は戻す）。第1大運は月柱の次（前）
//   立運   … 順行＝次の節入り日−出生日、逆行＝出生日−前の節入り日（日付の差。D27）
//             日付は現地標準時（国内は日本標準時、海外は出生地の標準時。D17）
//             日数÷3 を四捨五入（D11・D26）。0 なら出生時から第1大運（D22・D25）
//   年齢   … 数え年。立運年齢から10年ごと（D23）
//
// 前後の節入りの瞬間は共通暦エンジンの findSolarTermCrossing で取る（D12）。

import { findSolarTermCrossing, SOLAR_TERMS } from "../calendar";
import { STEMS, BRANCHES } from "../eto";
import type { Daiun, DaiunDirection, DaiunPeriod, Meishiki, Pillar, Sex, Stem } from "./types";
import { STEM_YINYANG } from "./data";

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
export const DEFAULT_DAIUN_COUNT = 10;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 六十甲子の番号（甲子＝0） */
export function sexagenaryIndex(p: Pillar): number {
  const s = STEMS.indexOf(p.stem);
  const b = BRANCHES.indexOf(p.branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  throw new Error(`invalid pillar ${p.stem}${p.branch}`);
}

export function sexagenaryPillar(index: number): Pillar {
  const i = mod(index, 60);
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12] };
}

export function daiunDirection(yearStem: Stem, sex: Sex): DaiunDirection {
  const yang = STEM_YINYANG[yearStem] === "陽";
  return yang === (sex === "M") ? "forward" : "backward";
}

/** 第1大運から count 本の大運干支 */
export function daiunPillars(monthPillar: Pillar, direction: DaiunDirection, count: number): Pillar[] {
  const base = sexagenaryIndex(monthPillar);
  const step = direction === "forward" ? 1 : -1;
  return Array.from({ length: count }, (_, i) => sexagenaryPillar(base + step * (i + 1)));
}

function standardDateOf(instant: Date, standardOffsetMinutes: number): { year: number; month: number; day: number } {
  const d = new Date(instant.getTime() + standardOffsetMinutes * MS_PER_MINUTE);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dayNumber(d: { year: number; month: number; day: number }): number {
  return Date.UTC(d.year, d.month - 1, d.day) / MS_PER_DAY;
}

function formatDate(d: { year: number; month: number; day: number }): string {
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** 出生の瞬間の前の節と次の節（節入りの瞬間、UTC） */
export function surroundingJie(birthUtc: Date, sunLongitude: number): {
  prev: { name: string; instant: Date };
  next: { name: string; instant: Date };
} {
  const ordinal = Math.floor(mod(sunLongitude - 315, 360) / 30); // 0＝寅月（立春〜）
  const prevLon = mod(315 + 30 * ordinal, 360);
  const nextLon = mod(prevLon + 30, 360);
  const prevInstant = findSolarTermCrossing(birthUtc, prevLon);
  // 前の節から45日後より前で最も近い nextLon 通過＝次の節（節の間隔は約30日）
  const nextInstant = findSolarTermCrossing(new Date(prevInstant.getTime() + 45 * MS_PER_DAY), nextLon);
  const nameOf = (lon: number) => {
    const def = SOLAR_TERMS.find((t) => t.longitude === lon);
    if (!def) throw new Error(`solar term not found for longitude ${lon}`);
    return def.name;
  };
  return {
    prev: { name: nameOf(prevLon), instant: prevInstant },
    next: { name: nameOf(nextLon), instant: nextInstant },
  };
}

export function calculateDaiun(meishiki: Meishiki, sex: Sex, count: number = DEFAULT_DAIUN_COUNT): Daiun {
  const direction = daiunDirection(meishiki.pillars.年.stem, sex);
  const { prev, next } = surroundingJie(meishiki.birthUtc, meishiki.sunLongitude);
  const jie = direction === "forward" ? next : prev;
  const jieDate = standardDateOf(jie.instant, meishiki.standardOffsetMinutes);
  const birthDay = dayNumber(meishiki.birthStandardDate);
  const days = direction === "forward" ? dayNumber(jieDate) - birthDay : birthDay - dayNumber(jieDate);
  const startAge = Math.round(days / 3);

  const periods: DaiunPeriod[] = daiunPillars(meishiki.pillars.月, direction, count).map((pillar, index) => ({
    index,
    pillar,
    ageFrom: startAge + 10 * index,
    ageTo: startAge + 10 * index + 9,
  }));

  return {
    direction,
    jie: { name: jie.name, utc: jie.instant.toISOString(), standardDate: formatDate(jieDate) },
    days,
    startAge,
    periods,
  };
}
