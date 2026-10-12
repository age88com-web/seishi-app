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
import { resolveGanzhi, civilJdn } from "./eto";
import { resolveShukuYo, toDailyTwentyEightMansion } from "./shukuYo";
import type { DailyTwentyEightMansion, Lodge28, SevenLuminary, Yuan } from "./shukuYo";
import { DEFAULT_SHUKU28_EPOCH_JDN } from "./shukuYoAnchor";
import { resolveLunisolar } from "./lunisolar";
import { DEFAULT_TIMEZONE } from "./types";

/**
 * 入力日時から共通暦情報を計算して返す。
 * timezone 未指定時は julian.ts 側で "Asia/Tokyo" が補完される。
 *
 * 処理の流れ:
 *   1. 入力を受け取る
 *   2. julian.ts     … 壁時計時刻を UTC へ正規化し JD / ΔT を得る
 *   3. solarTerm.ts  … UTC から太陽黄経・節気・節入り日時を得る
 *   4. eto.ts        … 節入り境界で年月日時の干支を得る
 *   5. shukuYo.ts    … 二十八宿暦（宿値日）を得る（epochJdn 未指定時は
 *                       shukuYoAnchor.ts の検証済みアンカーを既定値とする）
 *   6. lunisolar.ts  … 農暦（lunarMonth・lunarDay・isLeapMonth 等）を得る
 *   7. CalendarResult を組み立てて返す
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

  // 5. shukuYo.ts（二十八宿暦・宿値日）。epochJdn 未指定時は
  //    shukuYoAnchor.ts の検証済みアンカー（2025-12-21＝虚）を既定値として
  //    常に計算する（日境界は日柱と同じ civilJdn を使う）。
  const epochJdn = input.epochJdn ?? DEFAULT_SHUKU28_EPOCH_JDN;
  const shukuJdn = civilJdn(input.year, input.month, input.day, input.hour);
  const shukuYo = resolveShukuYo(shukuJdn - epochJdn);
  const shukuYoFields: Pick<
    CalendarResult,
    "lodge28" | "shukuYo" | "lodgeIndex" | "minorCycleDay" | "majorCycleDay" | "yuan"
  > = {
    lodge28: shukuYo.lodge,
    shukuYo: shukuYo.shukuYo,
    lodgeIndex: shukuYo.lodgeIndex,
    minorCycleDay: shukuYo.minorCycleDay,
    majorCycleDay: shukuYo.majorCycleDay,
    yuan: shukuYo.yuan,
  };

  // 6. lunisolar.ts（農暦）。epochJdn と違い、未指定でも常に計算する
  //    （lunisolarConfig は「どう計算するか」の設定であり、
  //    「計算するかどうか」のスイッチではない）。
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const lunisolar = resolveLunisolar(utcDate, timezone, input.lunisolarConfig);

  // 7. CalendarResult 組み立て
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

    ...shukuYoFields,

    lunarMonth: lunisolar.lunarMonth,
    isLeapMonth: lunisolar.isLeapMonth,
    lunarDay: lunisolar.lunarDay,
    newMoonTime: lunisolar.newMoonTime,
    nextNewMoonTime: lunisolar.nextNewMoonTime,
  };
}

/**
 * 二十八宿暦（宿値日）だけを DailyTwentyEightMansion 形状で返す便利関数。
 * calculate() を呼んで宿値日フィールドを並べ替えるだけで、計算は増やさない。
 */
export function calculateDailyTwentyEightMansion(input: CalendarInput): DailyTwentyEightMansion {
  const result = calculate(input);
  return toDailyTwentyEightMansion({
    lodge: result.lodge28 as Lodge28,
    shukuYo: result.shukuYo as SevenLuminary,
    lodgeIndex: result.lodgeIndex as number,
    minorCycleDay: result.minorCycleDay as number,
    majorCycleDay: result.majorCycleDay as number,
    yuan: result.yuan as Yuan,
  });
}
