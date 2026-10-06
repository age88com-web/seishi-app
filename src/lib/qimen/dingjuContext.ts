// src/lib/qimen/dingjuContext.ts
//
// 役割:
//   奇門遁甲「超神・接気・置閏」— CalendarEngine が返す天文学上の節気と、
//   奇門遁甲の定局に使う節気（定局用節気）を分離して求める。
//   定局用節気が決まった後の 陰陽遁 / 三元 / 局数 は既存の resolveDingju() に委ねる。
//
//     CalendarEngine（実際の節気・節入り時刻・干支）   ← 変更しない
//       ↓
//     resolveDingjuContext()（本ファイル: 正授・超神・接気・置閏）
//       ↓ effectiveSolarTerm
//     resolveDingju()（dingju.ts）                      ← 変更しない
//       ↓ { dun, yuan, ju }
//     地盤以降の排盤（1080局テストの範囲）             ← 変更しない
//
// 仕様の出典:
//   講義資料 p16「超神接気」・p17「置閏法」（docs/source/奇門遁甲講義案N.pdf）と、
//   ユーザー確定仕様（2026-10-06 提示「超神節気・置閏」）。
//     ・奇門遁甲は 二十四節気 × 三元 × 五日（360日）を一年とする。
//     ・符頭 = 上元の始まる日（甲子・甲午・己卯・己酉）。
//     ・正授: 符頭と節気が同じ日 / 超神: 符頭が節気より前 / 接気: 符頭が節気より後
//       （置閏の結果、符頭が二至の後になる状態も接気）。
//     ・置閏は夏至の前・冬至の前でのみ行い、必ず15日（三元）を入れる。
//       夏至の前 = 芒種の三元を繰り返す（陽六局・陽三局・陽九局 各5日）
//       冬至の前 = 大雪の三元を繰り返す（陰四局・陰七局・陰一局 各5日）
//       ※冬至側は局配列のみ資料で確定。具体的な年月日例は資料に無い。
//
// 本プロジェクトの実装規則（ユーザー確定 2026-10-06）:
//   ・置閏の閾値: 二至当日を差日数に含めず、符頭が二至の 9日以上前 にある場合に置閏する。
//     （1975年: 6/17→6/22 は5日 → 置閏なし / 1976年: 6/11→6/21 は10日 → 置閏）
//   ・日の境は 23:00。節入り時刻が 23:00 以降なら翌日の日干支の日として扱う
//     （CalendarEngine の既存の 23:00 切替をそのまま使う）。
//
// 判定方法（遡り探索を行わない局所判定）:
//   二至 S の節入り日の日干支の 60干支番号を i とすると、r = i mod 15 は
//   直前の上元符頭から S までの日数。
//     r < 9  → S の上元符頭 = S − r 日（r = 0 正授 / r > 0 超神）
//     r ≥ 9  → S の上元符頭 = S + (15 − r) 日（接気）
//   二至の上元符頭どうしの間隔は 180日（12節気×15日）か 195日（＋置閏15日）になる。
//   195日のとき、次の二至の上元符頭の直前15日が置閏期間になる。
//   この判定は「前の二至の上元符頭 + 180日 を候補とし、候補が二至の 9日以上前なら
//   15日を閏として入れる」を逐次適用した結果と一致する
//   （tests/qimen_dingju_context.manual.ts で 1974年正授からの逐次適用と照合）。
//   そのため、正授の起点を何年も遡って探す必要はない。

import { calculate as calculateCalendar, SOLAR_TERMS, DEFAULT_TIMEZONE } from "../calendar";
import type { CalendarInput, CalendarResult } from "../calendar";
import type { Stem, Branch } from "../eto";
import { STEMS, BRANCHES } from "../eto";
import { resolveDingju } from "./dingju";
import type { Dun, Yuan } from "./dingju";

export type QimenSeasonRelation = "正授" | "超神" | "接気";
export type Solstice = "夏至" | "冬至";

/** 置閏の閾値（日）。二至当日を含めない差日数がこれ以上なら置閏する。 */
export const LEAP_THRESHOLD_DAYS = 9;

/** 置閏で繰り返す節気と、その三元の局（講義 p17）。 */
export const LEAP_RULES: Record<Solstice, { repeatedTerm: string; dun: Dun; ju: [number, number, number] }> = {
  夏至: { repeatedTerm: "芒種", dun: "陽遁", ju: [6, 3, 9] },
  冬至: { repeatedTerm: "大雪", dun: "陰遁", ju: [4, 7, 1] },
};

export interface QimenLeapAdjustment {
  /** 置閏の対象となった二至 */
  solstice: Solstice;
  /** 繰り返す節気（芒種 / 大雪） */
  repeatedTerm: string;
  /** 置閏期間（15日）の初日・最終日（YYYY-MM-DD） */
  startDate: string;
  endDate: string;
}

export interface QimenDingjuContext {
  // ---- 天文上の値（CalendarEngine の値をそのまま写す） ----
  actualSolarTerm: string;
  actualSolarTermDateTime: string;
  actualDun: Dun;

  // ---- 定局上の値 ----
  effectiveSolarTerm: string;
  effectiveDun: Dun;
  effectiveYuan: Yuan;
  effectiveJu: number;

  // ---- 実際の節気と符頭の関係 ----
  /** 実際の節気の節入り日と、その節気の定局上の上元符頭との関係 */
  relation: QimenSeasonRelation;
  /** 符頭→節入り日の日数（節入り日を含めない）。超神は正、接気は負、正授は 0 */
  relationDays: number;
  /** 実際の節気の節入り日（YYYY-MM-DD、23:00 境界適用後） */
  actualSolarTermDate: string;
  /** 実際の節気に対応する定局上の上元符頭の日（YYYY-MM-DD） */
  futouDate: string;

  // ---- 置閏 ----
  /** 対象日が置閏期間（15日）に入っているか */
  isLeapAdjustment: boolean;
  leap: QimenLeapAdjustment | null;
}

/** 二至1回分の定局情報（テスト・検証用に公開）。 */
export interface SolsticeAnchor {
  solstice: Solstice;
  /** 節入り時刻（UTC ISO） */
  dateTime: string;
  /** 節入り日の日番号（UTC 1970-01-01 = 0 の暦日番号、23:00 境界適用後） */
  daySerial: number;
  /** 節入り日の日干支の 60干支番号（甲子 = 0） */
  ganzhiIndex: number;
  /** 定局上の上元符頭の日番号 */
  shangYuanSerial: number;
  relation: QimenSeasonRelation;
  /** 符頭→節入り日の日数（超神は正、接気は負） */
  relationDays: number;
}

const MS_PER_DAY = 86_400_000;
const TERM_NAMES = SOLAR_TERMS.map((t) => t.name);

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function ganzhiIndex(stem: Stem, branch: Branch): number {
  const s = STEMS.indexOf(stem);
  const b = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  throw new Error(`invalid ganzhi combination: ${stem}${branch}`);
}

/** 壁時計の年月日・時から、23:00 境界を適用した暦日番号を返す（CalendarEngine と同じ規則）。 */
function daySerial(year: number, month: number, day: number, hour: number): number {
  const base = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
  return hour >= 23 ? base + 1 : base;
}

function formatSerial(serial: number): string {
  return new Date(serial * MS_PER_DAY).toISOString().slice(0, 10);
}

interface WallClock {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
}

/** UTC の瞬間を timeZone の壁時計に変換する。 */
function toWallClock(instant: Date, timeZone: string): WallClock {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  if (map.hour === 24) map.hour = 0;
  return { year: map.year, month: map.month, day: map.day, hour: map.hour, minute: map.minute, second: map.second };
}

/** UTC の瞬間を、23:00 境界を適用した暦日番号に変換する。 */
function instantToDaySerial(iso: string, timeZone: string): number {
  const w = toWallClock(new Date(iso), timeZone);
  return daySerial(w.year, w.month, w.day, w.hour);
}

const anchorCache = new Map<string, SolsticeAnchor>();

/**
 * 指定年の夏至 / 冬至について、節入り日と定局上の上元符頭を求める。
 * 節入り時刻・日干支はすべて CalendarEngine の公開 API から得る。
 */
export function resolveSolsticeAnchor(
  year: number,
  solstice: Solstice,
  timeZone: string = DEFAULT_TIMEZONE,
): SolsticeAnchor {
  const key = `${year}:${solstice}:${timeZone}`;
  const cached = anchorCache.get(key);
  if (cached) return cached;

  // 6/30 は夏至〜小暑前、12/31 は冬至〜小寒前に必ず入る。
  const probe = calculateCalendar({
    year, month: solstice === "夏至" ? 6 : 12, day: solstice === "夏至" ? 30 : 31,
    hour: 12, minute: 0, timezone: timeZone,
  });
  if (probe.solarTerm !== solstice) {
    throw new Error(`${year}年の${solstice}を特定できません（${probe.solarTerm}）`);
  }

  // 節入り時刻の壁時計で日干支を得る（「節気の切り替わる日の干支」p16。23:00 境界は CalendarEngine に従う）。
  const w = toWallClock(new Date(probe.solarTermDateTime), timeZone);
  const atTerm = calculateCalendar({ ...w, timezone: timeZone });
  const serial = daySerial(w.year, w.month, w.day, w.hour);
  const idx = ganzhiIndex(atTerm.dayStem as Stem, atTerm.dayBranch as Branch);

  const r = idx % 15; // 直前の上元符頭から節入り日までの日数
  const shangYuanSerial = r >= LEAP_THRESHOLD_DAYS ? serial - r + 15 : serial - r;
  const relationDays = serial - shangYuanSerial;

  const anchor: SolsticeAnchor = {
    solstice,
    dateTime: probe.solarTermDateTime,
    daySerial: serial,
    ganzhiIndex: idx,
    shangYuanSerial,
    relation: relationOf(relationDays),
    relationDays,
  };
  anchorCache.set(key, anchor);
  return anchor;
}

function relationOf(days: number): QimenSeasonRelation {
  if (days === 0) return "正授";
  return days > 0 ? "超神" : "接気";
}

/** 二至から数えて k 番目（0 = 二至自身）の節気名。 */
function termFrom(solstice: Solstice, k: number): string {
  return TERM_NAMES[mod(TERM_NAMES.indexOf(solstice) + k, 24)];
}

/** 対象年の前後の二至（前年冬至・当年夏至・当年冬至・翌年夏至）。上元符頭の昇順。 */
function surroundingAnchors(year: number, timeZone: string): SolsticeAnchor[] {
  return [
    resolveSolsticeAnchor(year - 1, "夏至", timeZone),
    resolveSolsticeAnchor(year - 1, "冬至", timeZone),
    resolveSolsticeAnchor(year, "夏至", timeZone),
    resolveSolsticeAnchor(year, "冬至", timeZone),
    resolveSolsticeAnchor(year + 1, "夏至", timeZone),
  ];
}

interface Season {
  anchor: SolsticeAnchor;
  next: SolsticeAnchor;
  hasLeap: boolean;
}

/** 日番号 serial を含む「二至の上元符頭 〜 次の二至の上元符頭」の区間を返す。 */
function seasonContaining(serial: number, anchors: SolsticeAnchor[]): Season {
  for (let i = anchors.length - 2; i >= 0; i -= 1) {
    const anchor = anchors[i];
    const next = anchors[i + 1];
    if (anchor.shangYuanSerial <= serial && serial < next.shangYuanSerial) {
      const gap = next.shangYuanSerial - anchor.shangYuanSerial;
      if (gap !== 180 && gap !== 195) {
        throw new Error(
          `二至の上元符頭の間隔が不正です: ${formatSerial(anchor.shangYuanSerial)}→${formatSerial(next.shangYuanSerial)} (${gap}日)`,
        );
      }
      return { anchor, next, hasLeap: gap === 195 };
    }
  }
  throw new Error(`定局の区間を特定できません: ${formatSerial(serial)}`);
}

/**
 * 奇門遁甲の定局コンテキスト: 実際の節気（CalendarEngine）と、
 * 超神・接気・置閏を反映した定局用の 節気 / 陰陽遁 / 三元 / 局数 を返す。
 */
export function resolveDingjuContext(
  calendar: CalendarResult,
  input: CalendarInput,
): QimenDingjuContext {
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  const dayStem = calendar.dayStem as Stem;
  const dayBranch = calendar.dayBranch as Branch;

  // 対象日の日番号（CalendarEngine と同じく入力壁時計に 23:00 境界を適用）
  const serial = daySerial(input.year, input.month, input.day, input.hour);
  const anchors = surroundingAnchors(input.year, timeZone);

  // ---- 定局用節気 ----
  const season = seasonContaining(serial, anchors);
  const offset = serial - season.anchor.shangYuanSerial;
  const k = Math.floor(offset / 15);
  const isLeapAdjustment = k === 12;
  if (k > 12 || (isLeapAdjustment && !season.hasLeap)) {
    throw new Error(`定局の節気位置が不正です: ${formatSerial(serial)} (k=${k})`);
  }
  // 置閏期間（k = 12）は、二至の直前の節気（芒種 / 大雪 = 11番目）を繰り返す。
  const effectiveSolarTerm = termFrom(season.anchor.solstice, isLeapAdjustment ? 11 : k);

  const effective = resolveDingju({ solarTerm: effectiveSolarTerm, dayStem, dayBranch });

  // 三元は日干支の符頭で決まる。上元符頭からの位置と一致しなければ不整合。
  const expectedYuan: Yuan = (["上元", "中元", "下元"] as const)[Math.floor((offset % 15) / 5)];
  if (effective.yuan !== expectedYuan) {
    throw new Error(`三元が上元符頭の位置と一致しません: ${effective.yuan} / ${expectedYuan}`);
  }

  // 置閏期間（次の二至の上元符頭の直前15日）。局が講義の局配列と一致することも確認する。
  let leap: QimenLeapAdjustment | null = null;
  if (isLeapAdjustment) {
    const leapSolstice = season.next.solstice;
    const rule = LEAP_RULES[leapSolstice];
    const yuanIndex = Math.floor((offset % 15) / 5);
    if (effectiveSolarTerm !== rule.repeatedTerm || effective.dun !== rule.dun || effective.ju !== rule.ju[yuanIndex]) {
      throw new Error(`置閏期間の局が講義の局配列と一致しません: ${effectiveSolarTerm} ${effective.dun}${effective.ju}局`);
    }
    const start = season.anchor.shangYuanSerial + 180;
    leap = {
      solstice: leapSolstice,
      repeatedTerm: rule.repeatedTerm,
      startDate: formatSerial(start),
      endDate: formatSerial(start + 14),
    };
  }

  // ---- 実際の節気と符頭の関係 ----
  const actualSolarTerm = calendar.solarTerm;
  const actualTermSerial = instantToDaySerial(calendar.solarTermDateTime, timeZone);
  // 実際の節気を統べる二至 = 節入り日が実際の節気の節入り日以前で最も近い二至
  const governing = [...anchors].reverse().find((a) => a.daySerial <= actualTermSerial);
  if (!governing) {
    throw new Error(`実際の節気に対応する二至を特定できません: ${actualSolarTerm}`);
  }
  const position = mod(TERM_NAMES.indexOf(actualSolarTerm) - TERM_NAMES.indexOf(governing.solstice), 24);
  const futouSerial = governing.shangYuanSerial + 15 * position;
  const relationDays = actualTermSerial - futouSerial;

  const actualDun = resolveDingju({ solarTerm: actualSolarTerm, dayStem, dayBranch }).dun;

  return {
    actualSolarTerm,
    actualSolarTermDateTime: calendar.solarTermDateTime,
    actualDun,
    effectiveSolarTerm,
    effectiveDun: effective.dun,
    effectiveYuan: effective.yuan,
    effectiveJu: effective.ju,
    relation: relationOf(relationDays),
    relationDays,
    actualSolarTermDate: formatSerial(actualTermSerial),
    futouDate: formatSerial(futouSerial),
    isLeapAdjustment,
    leap,
  };
}
