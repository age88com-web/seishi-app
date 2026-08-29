// src/lib/calendar/eto.ts
//
// 役割:
//   節入り時刻を境界とした干支計算（共通暦エンジン用の新規実装）。
//   - 年干支: 立春（太陽黄経 315°）の節入り時刻を境界に判定
//   - 月干支・月支: 各「節」の節入り時刻（＝太陽黄経）を境界に判定（五虎遁）
//   - 日干支: Julian Day（JDN）を基準に判定。日の切替は子初 23:00
//   - 時干支: 日干と時支から判定（五鼠遁）
//
// 既存 src/lib/eto.ts との関係:
//   既存 eto.ts（固定日付による簡易判定）は変更しない。
//   干支名テーブル STEMS / BRANCHES と型 Stem / Branch は既存ファイルから再利用する。
//   節入り時刻の逆算は solarTerm.ts の findSolarTermCrossing を利用（再実装しない）。
//
// docs: 02_共通暦エンジン要件 / 03_共通暦エンジン設計

import * as Astronomy from "astronomy-engine";
import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch } from "../eto";
import { findSolarTermCrossing } from "./solarTerm";

export type { Stem, Branch };
export { STEMS, BRANCHES };

/** J2000.0 のユリウス日 */
const JD_J2000 = 2451545.0;

/**
 * 日干支の JDN → 六十干支インデックス補正値。
 * 甲子 = 0 とし、既存 eto.ts の確定アンカー「1984-02-02 = 丙寅(=2)」で較正。
 * dayIndex = mod(JDN + DAY_PILLAR_JDN_OFFSET, 60)
 */
const DAY_PILLAR_JDN_OFFSET = 49;

/** BRANCHES 上の寅の位置（子=0, 丑=1, 寅=2, …） */
const BRANCH_INDEX_TIGER = 2;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export interface GanzhiInput {
  /** 出生の瞬間（UTC）。年干支の立春境界判定に使用 */
  utc: Date;
  /** resolveSolarTerm が返す太陽黄経（度, 0..360）。月干支・月支に使用 */
  sunLongitude: number;
  /** タイムゾーン適用後の現地壁時計 */
  localYear: number;
  /** 1-12 */
  localMonth: number;
  localDay: number;
  /** 0-23 */
  localHour: number;
}

export interface GanzhiResult {
  yearStem: Stem;
  yearBranch: Branch;
  monthStem: Stem;
  monthBranch: Branch;
  dayStem: Stem;
  dayBranch: Branch;
  hourStem: Stem;
  hourBranch: Branch;
}

/** 指定グレゴリオ年の立春（太陽黄経 315°）の瞬間（UTC）。 */
function lichunInstant(gregorianYear: number): Date {
  // 3/1 以前で最も近い 315° 通過＝その年の立春。
  return findSolarTermCrossing(new Date(Date.UTC(gregorianYear, 2, 1)), 315);
}

/** 太陽黄経から節月序数（0＝寅月 立春〜 … 11＝丑月 小寒〜）。 */
function solarMonthOrdinal(sunLongitude: number): number {
  return Math.floor(mod(sunLongitude - 315, 360) / 30);
}

/** 現地暦日（子初 23:00 ルール適用後）の JDN。 */
function civilJdn(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  let cy = year;
  let cm = month;
  let cd = day;
  if (hour >= 23) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cy = next.getUTCFullYear();
    cm = next.getUTCMonth() + 1;
    cd = next.getUTCDate();
  }
  const noon = new Date(Date.UTC(cy, cm - 1, cd, 12));
  const jd = Astronomy.MakeTime(noon).ut + JD_J2000;
  return Math.round(jd);
}

/**
 * 節入り時刻を境界とした年月日時の干支を算出する。
 */
export function resolveGanzhi(input: GanzhiInput): GanzhiResult {
  const { utc, sunLongitude, localYear, localMonth, localDay, localHour } = input;

  // ---- 年干支（立春境界） ----
  const lichun = lichunInstant(localYear);
  const solarYear =
    utc.getTime() >= lichun.getTime() ? localYear : localYear - 1;
  const yearCycle = mod(solarYear - 1984, 60); // 1984 = 甲子
  const yearStemIndex = yearCycle % 10;
  const yearStem = STEMS[yearStemIndex];
  const yearBranch = BRANCHES[yearCycle % 12];

  // ---- 月干支・月支（節入り境界＝太陽黄経） ----
  const monthOrdinal = solarMonthOrdinal(sunLongitude); // 0=寅 … 11=丑
  const monthBranch = BRANCHES[(monthOrdinal + BRANCH_INDEX_TIGER) % 12];
  // 五虎遁: 寅月の月干 = (年干%5)*2 + 2、以降 1 ずつ加算
  const monthStemIndex = mod((yearStemIndex % 5) * 2 + 2 + monthOrdinal, 10);
  const monthStem = STEMS[monthStemIndex];

  // ---- 日干支（JDN 基準・子初 23:00） ----
  const jdn = civilJdn(localYear, localMonth, localDay, localHour);
  const dayCycle = mod(jdn + DAY_PILLAR_JDN_OFFSET, 60);
  const dayStemIndex = dayCycle % 10;
  const dayStem = STEMS[dayStemIndex];
  const dayBranch = BRANCHES[dayCycle % 12];

  // ---- 時干支（五鼠遁） ----
  const hourBranchIndex = Math.floor((localHour + 1) / 2) % 12; // 23,0時=子
  const hourBranch = BRANCHES[hourBranchIndex];
  // 五鼠遁: 子時の時干 = (日干%5)*2、時支ごとに 1 ずつ加算
  const hourStemIndex = mod((dayStemIndex % 5) * 2 + hourBranchIndex, 10);
  const hourStem = STEMS[hourStemIndex];

  return {
    yearStem,
    yearBranch,
    monthStem,
    monthBranch,
    dayStem,
    dayBranch,
    hourStem,
    hourBranch,
  };
}
