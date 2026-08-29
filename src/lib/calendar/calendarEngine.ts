// src/lib/calendar/calendarEngine.ts
//
// 役割:
//   共通暦エンジン CalendarEngine の本体。
//   calculate() は julian → solarTerm → eto の各処理を統合し、
//   CalendarResult を返すだけの薄い調整層。
//
// 行わない処理（docs/05）:
//   排盤 / 神殺判定 / 格局判定 / 八門・九星・八神配置 / SVG 描画 / PDF 生成。
//
// docs: 03_共通暦エンジン設計 / 05_CalendarEngine_API

import type { CalendarInput, CalendarResult } from "./types";
import { toJulian } from "./julian";
import { resolveSolarTerm } from "./solarTerm";
import { resolveGanzhi } from "./eto";

/**
 * 入力日時から共通暦情報を計算して返す。
 * timezone 未指定時は julian.ts 側で "Asia/Tokyo" が補完される。
 *
 * 処理の流れ:
 *   1. 入力を受け取る
 *   2. julian.ts     … 壁時計時刻を UTC へ正規化し JD / ΔT を得る
 *   3. solarTerm.ts  … UTC から太陽黄経・節気・節入り日時を得る
 *   4. eto.ts        … 節入り境界で年月日時の干支を得る
 *   5. CalendarResult を組み立てて返す
 *
 * 本関数は上記の統合のみを担い、新しい暦計算ロジックは持たない。
 */
export function calculate(input: CalendarInput): CalendarResult {
  // 2. julian.ts
  const { utc, utcDate, julianDay, deltaT } = toJulian(input);

  // 3. solarTerm.ts
  const { sunLongitude, solarTerm, solarTermDateTime } =
    resolveSolarTerm(utcDate);

  // 4. eto.ts（現地壁時計はそのまま入力値を渡す）
  //
  // TODO(将来拡張): timezone が "Asia/Tokyo" 以外になった場合、
  //   入力値（input.year/month/day/hour）ではなく、
  //   timezone 変換後の現地壁時計（localYear / localMonth / localDay / localHour）を
  //   resolveGanzhi() に渡すこと。
  //   現状は入力＝現地壁時計という前提のため入力値をそのまま使用している。
  //   （今回は動作変更なし）
  const ganzhi = resolveGanzhi({
    utc: utcDate,
    sunLongitude,
    localYear: input.year,
    localMonth: input.month,
    localDay: input.day,
    localHour: input.hour,
  });

  // 5. CalendarResult 組み立て
  return {
    utc,
    julianDay,
    deltaT,

    sunLongitude,
    solarTerm,
    solarTermDateTime,

    yearStem: ganzhi.yearStem,
    yearBranch: ganzhi.yearBranch,

    monthStem: ganzhi.monthStem,
    monthBranch: ganzhi.monthBranch,

    dayStem: ganzhi.dayStem,
    dayBranch: ganzhi.dayBranch,

    hourStem: ganzhi.hourStem,
    hourBranch: ganzhi.hourBranch,
  };
}
