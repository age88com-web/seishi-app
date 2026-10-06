// src/lib/takujitsu/monthly/buildMonthlySchedule.ts
//
// 役割:
//   月間行動予定（/takujitsu「月間行動予定」タブ）の表示用データを組み立てる。
//   既存エンジンの出力を「どの欄に・どの記号で載せるか」に振り分けるだけで、
//   擇日判定・神殺・resolution・用事判定・方位・時家の判定は一切持たない。
//
// 使う既存関数（いずれも変更していない）:
//   ・calculateTakujitsuFull()   … 1日分の暦・神殺・resolution・用事判定（各日 12:00）
//   ・getJikaEntry()             … 時家720表
//   ・classifyJikaTerm()         … 時家の吉神／凶神の分類（page.tsx から移動したもの）
//   ・calculateDailyDirections() … 日盤の吉凶方位
//   ・calculate()（暦）          … 期間最終日の翌日の日干支（最後の23:00行）
//
// 仕様根拠（人間側で確定済み）:
//   docs/monthly-action-schedule-pdf-spec.md §12（日曜〜土曜の週、前月・翌月の日を含める）
//   docs/monthly-action-schedule-engine-mapping.md
//     §5.5（OR 条件）・§5.6（謝土は判定不能）・§7（good/mixed/neutral/bad の載せ方）・
//     §8（特殊表示）・§9（時間帯の記号・勿用・13行）・§10（吉方・凶方）
//   docs/monthly-action-schedule-strong-kyojin-2025-04.md §7（強い凶神の候補）

import { calculate as calculateCalendar } from "@/lib/calendar";
import { calculateTakujitsuFull } from "../full";
import type { ActivityVerdict } from "../activity/types";
import { getJikaEntry } from "../jika";
import { classifyJikaTerm } from "../jika/hourClassification";
import { calculateDailyDirections } from "../dailyDirections";
import { MONTHLY_ACTIVITY_ITEMS } from "./monthlyActivities";
import type { MonthlyActivityItem } from "./monthlyActivities";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 各日の計算基準時刻（searchTakujitsuDays の既定値と同じ。子初23:00の境界をまたがない）。 */
export const MONTHLY_BASE_HOUR = 12;

/**
 * 「何事も宜しからず」の判断材料とする強い凶神（諸事に強く凶作用を及ぼすもの）。
 * docs/monthly-action-schedule-strong-kyojin-2025-04.md §7 の候補のうち、
 * 現行エンジンで成立を検出できるもの。
 *   ・餘事皆忌型（ActivityProfile で negativeMode:"all_except"）の10神
 *     （月殺は 2026-10-06 監修訂正で忌が賓客・動土・栽種の3用事だけになったため除外）
 *   ・原典で「諸事不宜」の無禄（人間側の採用決定。成立判定は既存）
 * 晦日・日月蝕（「諸事不宜」「諸事皆忌」として採用済み）は、現行エンジンに
 * 成立判定が無いため検出できない（新しい判定は作らない）。
 */
export const STRONG_KYOJIN_NAMES: readonly string[] = [
  "月破", "死神", "劫殺", "災殺", "月刑", "月厭", "四廢", "上朔", "四離", "四絶",
  "無禄",
];

/** 強い凶神が「成立している」とみなす resolution の状態（cancelled・reduced・pending は含めない）。 */
const STRONG_KYOJIN_EFFECTIVE_STATUSES: ReadonlySet<string> = new Set(["active", "aggravated"]);

/**
 * 凶用事欄に個別に列挙する件数の上限（表示上の省略のための値。擇日判定ではない）。
 * これを超える日は、この件数までを表示し、残りを「その他すべて凶」とまとめる。
 * 2026-09-27 人間側決定「通常日は凶用事を少なくとも7〜8件程度は確認できるようにする。
 * 8件以上ある場合は、まず8件程度を表示する」により8件とした。
 */
export const BAD_LIST_DISPLAY_LIMIT = 8;

/** 時間行（最初の23:00＝当日の子時、最後の23:00＝翌日の子時）。 */
const HOUR_ROWS: readonly { label: string; branch: string; nextDay: boolean }[] = [
  { label: "23:00", branch: "子", nextDay: false },
  { label: "1:00", branch: "丑", nextDay: false },
  { label: "3:00", branch: "寅", nextDay: false },
  { label: "5:00", branch: "卯", nextDay: false },
  { label: "7:00", branch: "辰", nextDay: false },
  { label: "9:00", branch: "巳", nextDay: false },
  { label: "11:00", branch: "午", nextDay: false },
  { label: "13:00", branch: "未", nextDay: false },
  { label: "15:00", branch: "申", nextDay: false },
  { label: "17:00", branch: "酉", nextDay: false },
  { label: "19:00", branch: "戌", nextDay: false },
  { label: "21:00", branch: "亥", nextDay: false },
  { label: "23:00", branch: "子", nextDay: true },
];

export const MONTHLY_HOUR_LABELS: readonly string[] = HOUR_ROWS.map((r) => r.label);

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

/** 時間帯の表示記号。「用いてもよい」は勿用マス（§9.2 の確定表示）。 */
export type MonthlyHourSymbol = "◎" | "○" | "△" | "▽" | "▼" | "用いてもよい";

export interface MonthlyHourCell {
  label: string;
  hourBranch: string;
  /** その時辰の日干支（最後の23:00行は翌日の日干支）。 */
  dayGanzhi: string;
  hourGanzhi: string;
  /** 分類が「吉」の語の件数。 */
  kichi: number;
  /** 分類が「凶」の語の件数。 */
  kyo: number;
  isMuyo: boolean;
  symbol: MonthlyHourSymbol;
}

export interface MonthlyActivityResult {
  item: MonthlyActivityItem;
  /** 表示用事としての結果。判定不能（謝土）は null。 */
  verdict: ActivityVerdict | null;
  /** activityId ごとの既存 verdict（OR 条件の確認用）。 */
  idVerdicts: { activityId: string; verdict: ActivityVerdict }[];
}

export interface MonthlyDirection {
  name: "喜神" | "財神" | "太歳遊方" | "五鬼";
  /** 方位（原文表記のまま）。太歳遊方の休止日は null。 */
  direction: string | null;
}

export interface MonthlyDay {
  iso: string;
  year: number;
  month: number;
  day: number;
  /** 0=日 … 6=土 */
  weekday: number;
  /** 対象月の日か（前月・翌月の日は false）。 */
  inTargetMonth: boolean;
  dayGanzhi: string;
  buildingDay: string;
  shuku28: string | null;

  /** 表示用事すべての結果（表示順）。 */
  activities: MonthlyActivityResult[];
  /** 吉用事欄: good。 */
  good: MonthlyActivityResult[];
  /**
   * mixed（吉凶混在）。2026-09-27 人間側決定により月間行動予定には表示しない。
   * 既存エンジンの判定として保持し、確認用の表示にだけ使う。
   */
  mixed: MonthlyActivityResult[];
  /** 凶用事欄: bad。 */
  bad: MonthlyActivityResult[];
  /** 既存エンジンで判定できない用事（謝土）。月間行動予定には表示しない（確認・テスト用に保持）。 */
  unjudgeable: MonthlyActivityResult[];

  /** 「何事も宜しからず」の表示判断に使った事実。 */
  nanigoto: {
    show: boolean;
    /** 成立している強い凶神（resolution の状態つき）。 */
    strongKyojin: { name: string; status: string }[];
    /** 主要用事のうち good のもの（瑕疵のない主要な吉）。 */
    mainGood: string[];
  };
  /** 凶用事が BAD_LIST_DISPLAY_LIMIT 件を超え、超えた分を「その他すべて凶」とまとめるか（表示上の省略）。 */
  badAbbreviated: boolean;

  goodDirections: MonthlyDirection[];
  badDirections: MonthlyDirection[];

  hours: MonthlyHourCell[];
}

export interface MonthlySchedule {
  year: number;
  month: number;
  timezone: string;
  /** 日曜始まりの週（各7日）。 */
  weeks: MonthlyDay[][];
}

// ---------------------------------------------------------------------------
// 日付範囲
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC の Date から YYYY-MM-DD。 */
function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * 対象月の1日を含む週の日曜日から、末日を含む週の土曜日までの日付（UTC 0時の Date）。
 * 4〜6週（28〜42日）になる。
 */
export function monthlyDateRange(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const end = new Date(last.getTime() + (6 - last.getUTCDay()) * 86_400_000);
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) days.push(new Date(t));
  return days;
}

// ---------------------------------------------------------------------------
// 集約
// ---------------------------------------------------------------------------

/**
 * 表示用事としての結果。単独 id はその verdict をそのまま使う。
 * OR 条件（§5.5）: どれか1つでも成立すれば表示用事が成立するため、
 * good の id があれば good、無ければ mixed の id があれば mixed（月間表では非表示）、
 * 無ければ bad の id があれば bad、すべて neutral なら neutral とする。
 * 複数 id の結果が異なることを理由に mixed へ変えることはしない。
 */
export function aggregateOrVerdict(verdicts: readonly ActivityVerdict[]): ActivityVerdict {
  if (verdicts.includes("good")) return "good";
  if (verdicts.includes("mixed")) return "mixed";
  if (verdicts.includes("bad")) return "bad";
  return "neutral";
}

/** 時家の件数から表示記号を決める（§9.2。単純な件数比較のみ）。 */
export function hourSymbol(kichi: number, kyo: number, isMuyo: boolean): MonthlyHourSymbol {
  if (isMuyo) return "用いてもよい";
  if (kichi > 0 && kyo === 0) return "◎";
  if (kichi === 0 && kyo > 0) return "▼";
  if (kichi > kyo) return "○";
  if (kichi < kyo) return "▽";
  return "△";
}

function hourCell(label: string, branch: string, dayGanzhi: string): MonthlyHourCell {
  const entry = getJikaEntry(dayGanzhi, branch);
  if (!entry) throw new Error(`時家720表に存在しない組み合わせです: ${dayGanzhi}/${branch}`);
  const kichi = entry.normalizedTerms.filter((t) => classifyJikaTerm(t) === "吉").length;
  const kyo = entry.normalizedTerms.filter((t) => classifyJikaTerm(t) === "凶").length;
  return {
    label,
    hourBranch: branch,
    dayGanzhi,
    hourGanzhi: entry.hourGanzhi,
    kichi,
    kyo,
    isMuyo: entry.isMuyo,
    symbol: hourSymbol(kichi, kyo, entry.isMuyo),
  };
}

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

/**
 * 月間行動予定の表示用データを作る。
 * @param year 対象年
 * @param month 対象月（1〜12）
 * @param timezone 既定 "Asia/Tokyo"
 */
export function buildMonthlySchedule(year: number, month: number, timezone = "Asia/Tokyo"): MonthlySchedule {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("年・月を正しく指定してください");
  }
  const dates = monthlyDateRange(year, month);

  // 各日の既存エンジン結果（1日1回）。
  const fulls = dates.map((d) =>
    calculateTakujitsuFull({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: MONTHLY_BASE_HOUR,
      minute: 0,
      timezone,
    }),
  );

  // 期間最終日の翌日の日干支（最後の23:00行＝翌日の子時）。
  const after = new Date(dates[dates.length - 1].getTime() + 86_400_000);
  const afterCal = calculateCalendar({
    year: after.getUTCFullYear(),
    month: after.getUTCMonth() + 1,
    day: after.getUTCDate(),
    hour: MONTHLY_BASE_HOUR,
    minute: 0,
    timezone,
  });
  const ganzhiOf = (i: number): string =>
    i < fulls.length
      ? fulls[i].calendar.dayStem + fulls[i].calendar.dayBranch
      : afterCal.dayStem + afterCal.dayBranch;

  const strongSet = new Set(STRONG_KYOJIN_NAMES);

  const days: MonthlyDay[] = dates.map((d, i) => {
    const full = fulls[i];
    const verdictOf = new Map<string, ActivityVerdict>(
      full.activities.evaluations.map((e) => [e.activityId, e.verdict]),
    );
    // evaluations に無い用事は neutral（searchTakujitsuDays と同じ扱い）。
    const v = (id: string): ActivityVerdict => verdictOf.get(id) ?? "neutral";

    const activities: MonthlyActivityResult[] = MONTHLY_ACTIVITY_ITEMS.map((item) => {
      if (!item.judgeable) return { item, verdict: null, idVerdicts: [] };
      const idVerdicts = item.activityIds.map((activityId) => ({ activityId, verdict: v(activityId) }));
      return { item, verdict: aggregateOrVerdict(idVerdicts.map((x) => x.verdict)), idVerdicts };
    });

    const good = activities.filter((a) => a.verdict === "good");
    const mixed = activities.filter((a) => a.verdict === "mixed");
    const bad = activities.filter((a) => a.verdict === "bad");
    const unjudgeable = activities.filter((a) => a.verdict === null);

    const strongKyojin = full.resolution.kyojin
      .filter((k) => strongSet.has(k.name) && STRONG_KYOJIN_EFFECTIVE_STATUSES.has(k.status))
      .map((k) => ({ name: k.name, status: k.status }));
    const mainGood = good.filter((a) => a.item.main).map((a) => a.item.label);
    const showNanigoto = strongKyojin.length > 0 && mainGood.length === 0;

    const dayGanzhi = ganzhiOf(i);
    const dirs = calculateDailyDirections(dayGanzhi);

    const hours = HOUR_ROWS.map((r) => hourCell(r.label, r.branch, r.nextDay ? ganzhiOf(i + 1) : dayGanzhi));

    return {
      iso: isoOf(d),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      inTargetMonth: d.getUTCMonth() + 1 === month,
      dayGanzhi,
      buildingDay: full.buildingDay.name,
      shuku28: full.shuku28 ? full.shuku28.lodge : null,
      activities,
      good,
      mixed,
      bad,
      unjudgeable,
      nanigoto: { show: showNanigoto, strongKyojin, mainGood },
      badAbbreviated: bad.length > BAD_LIST_DISPLAY_LIMIT,
      goodDirections: [
        { name: "喜神", direction: dirs.xishen },
        { name: "財神", direction: dirs.caishen },
      ],
      badDirections: [
        { name: "太歳遊方", direction: dirs.taisui },
        { name: "五鬼", direction: dirs.wugui },
      ],
      hours,
    };
  });

  const weeks: MonthlyDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { year, month, timezone, weeks };
}
