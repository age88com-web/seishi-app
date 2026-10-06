// src/lib/takujitsu/full.ts
//
// 役割:
//   擇日UI（src/app/takujitsu/）向けの統合 wrapper。
//   ・calculateTakujitsuFull(input): 1日分の
//       暦 / 吉神・凶神(raw) / resolution / 十二建除 / 二十八宿 / 用途判定
//     をまとめて返す。
//   ・searchTakujitsuDays(params): 期間内の各日について、指定した1用途の
//     ActivityEvaluation（既存 evaluateActivities の結果）を取り出して返す
//     ＝「目的から良い日を探す」検索。
//
// 重要（擇日UI 第1〜3フェーズの制約）:
//   - CalendarEngine（src/lib/calendar/）には擇日判定を一切混ぜない。
//   - occurrence / resolution rules / 十二建除ロジック / 二十八宿ロジック /
//     ActivityProfile / 月破抑制 / 六黄道COMPOSITE のロジックは無変更。
//   - **期間検索は独自の吉凶判定を一切持たない**。各日について既存の
//     evaluateActivities() を呼び、その verdict（good/bad/mixed/neutral）を
//     そのまま使う。神殺の数によるランキング・独自スコアは作らない。
//   - 二重 Calendar 計算の解消：calculateTakujitsu(input, calendar) に
//     既計算の CalendarResult を渡し、1日あたり CalendarEngine 1回にする
//     （calculateCalendar は純粋関数なので結果は同一。ロジック不変）。

import { calculate as calculateCalendar } from "@/lib/calendar";
import type { CalendarInput, CalendarResult } from "@/lib/calendar";

import { calculateTakujitsu } from "./index";
import type { TakujitsuResult } from "./index";
import { evaluateActivities } from "./activity";
import type { ActivityEvaluationResult, ActivityEvaluation, ActivitySuppression, ActivityVerdict } from "./activity";

// ---------------------------------------------------------------------------
// 1日分
// ---------------------------------------------------------------------------
export interface TakujitsuFullResult {
  calendar: CalendarResult;
  shinsatsu: TakujitsuResult["shinsatsu"];
  buildingDay: TakujitsuResult["buildingDay"];
  shuku28: TakujitsuResult["shuku28"];
  resolution: TakujitsuResult["resolution"];
  activities: ActivityEvaluationResult;
}

/** 暦情報から用途判定までを一括計算する（1日分）。 */
export function calculateTakujitsuFull(input: CalendarInput): TakujitsuFullResult {
  const calendar = calculateCalendar(input);
  const tk = calculateTakujitsu(input, calendar); // 既計算の calendar を渡して二重計算を回避
  const activities = evaluateActivities({
    resolution: tk.resolution,
    buildingDay: tk.buildingDay,
    shuku28: tk.shuku28,
    solarTerm: calendar.solarTerm,
  });
  return {
    calendar,
    shinsatsu: tk.shinsatsu,
    buildingDay: tk.buildingDay,
    shuku28: tk.shuku28,
    resolution: tk.resolution,
    activities,
  };
}

// ---------------------------------------------------------------------------
// 期間検索（目的から良い日を探す）
// ---------------------------------------------------------------------------
/** 検索の1日分の結果。 */
export interface TakujitsuSearchDay {
  year: number;
  month: number;
  day: number;
  /** 曜日（0=日 … 6=土）。表示用。日柱判定とは無関係。 */
  weekday: number;
  dayStem: string;
  dayBranch: string;
  /** 十二建除の名称。 */
  buildingDay: string;
  /** 二十八宿の宿名。算出できない場合は null。 */
  shuku28: string | null;
  /**
   * その用途のその日の評価。evaluateActivities() の結果に該当 activityId が
   * 無い場合は null（＝どの神殺・十二建除・二十八宿もその用途に言及しない日）。
   */
  evaluation: ActivityEvaluation | null;
  /** evaluation?.verdict ?? "neutral"。UI 表示・フィルタ用。 */
  verdict: ActivityVerdict;
  /** その用途に関わる suppression（「月破により徳神失力」等）だけを抜き出したもの。 */
  suppressions: ActivitySuppression[];
}

export interface TakujitsuSearchResult {
  activityId: string;
  from: { year: number; month: number; day: number };
  to: { year: number; month: number; day: number };
  /** 日単位検索の計算基準時刻（既定 12:00）。時刻擇定は別フェーズ。 */
  baseTime: { hour: number; minute: number };
  /** 期間内の全日（verdict 別の絞り込みは呼び出し側＝UI が行う）。日付昇順。 */
  days: TakujitsuSearchDay[];
}

export interface TakujitsuSearchParams {
  /** ActivityDefinition の id。 */
  activityId: string;
  /** 開始日 "YYYY-MM-DD"。 */
  from: string;
  /** 終了日 "YYYY-MM-DD"（含む）。 */
  to: string;
  timezone?: string;
  /** 日単位検索の基準時刻（時）。既定 12。子初23:00 の日柱境界を跨がない値にすること。 */
  baseHour?: number;
  /** 同（分）。既定 0。 */
  baseMinute?: number;
}

/** 検索期間の上限（日）。 */
export const TAKUJITSU_SEARCH_MAX_DAYS = 366;

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/**
 * 期間内の各日について、指定した1用途の既存 verdict を取り出す。
 * **独自の吉凶ロジックは持たない**（各日 evaluateActivities() を1回呼ぶだけ）。
 */
export function searchTakujitsuDays(params: TakujitsuSearchParams): TakujitsuSearchResult {
  const from = parseYmd(params.from);
  const to = parseYmd(params.to);
  if (!from || !to) throw new Error("開始日・終了日は YYYY-MM-DD 形式で入力してください");

  const start = new Date(Date.UTC(from.y, from.m - 1, from.d));
  const end = new Date(Date.UTC(to.y, to.m - 1, to.d));
  if (start.getTime() > end.getTime()) throw new Error("開始日が終了日より後になっています");

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount > TAKUJITSU_SEARCH_MAX_DAYS) {
    throw new Error(`検索期間は最大 ${TAKUJITSU_SEARCH_MAX_DAYS} 日です（指定は ${dayCount} 日）`);
  }

  const hour = params.baseHour ?? 12;
  const minute = params.baseMinute ?? 0;
  const timezone = params.timezone || "Asia/Tokyo";
  const days: TakujitsuSearchDay[] = [];

  for (let i = 0; i < dayCount; i++) {
    const dt = new Date(start.getTime() + i * 86_400_000);
    const y = dt.getUTCFullYear();
    const mo = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();

    const input: CalendarInput = { year: y, month: mo, day: d, hour, minute, timezone };
    const calendar = calculateCalendar(input); // 1日1回だけ
    const tk = calculateTakujitsu(input, calendar);
    const ev = evaluateActivities({
      resolution: tk.resolution,
      buildingDay: tk.buildingDay,
      shuku28: tk.shuku28,
      solarTerm: calendar.solarTerm,
    });

    const evaluation = ev.evaluations.find((e) => e.activityId === params.activityId) ?? null;
    const suppressions = ev.suppressions.filter((s) => s.activityIds.includes(params.activityId));

    days.push({
      year: y,
      month: mo,
      day: d,
      weekday: new Date(y, mo - 1, d).getDay(),
      dayStem: calendar.dayStem,
      dayBranch: calendar.dayBranch,
      buildingDay: tk.buildingDay.name,
      shuku28: tk.shuku28 ? tk.shuku28.lodge : null,
      evaluation,
      verdict: evaluation?.verdict ?? "neutral",
      suppressions,
    });
  }

  return {
    activityId: params.activityId,
    from: { year: from.y, month: from.m, day: from.d },
    to: { year: to.y, month: to.m, day: to.d },
    baseTime: { hour, minute },
    days,
  };
}
