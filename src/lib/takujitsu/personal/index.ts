// src/lib/takujitsu/personal/index.ts
//
// 役割:
//   年命による個人判定（personalResult）の入口。既存 CalendarEngine の
//   calculate() をそのまま使って年命（yearStem/yearBranch）を確定し、
//   honmeisatsu.ts の純関数に委譲する薄い層。
//   新しい干支計算・新しい暦補正ロジックは一切持たない。
//
// 出生時刻の扱い（既存 calculate() のみを使う。正午固定などの独断補正はしない）:
//   - 出生時刻あり: そのまま calculate() に渡して年命を確定する。
//   - 出生時刻なし: 出生日の 00:00 と 23:59 で calculate() を実行し、
//     yearStem/yearBranch が一致するか確認する。
//       一致する   … 立春の瞬間をその日は跨がないため、時刻に関係なく年命が
//                     一意に確定する（その年命を採用）。
//       一致しない … 立春前後で年命が変わり得るため、年命を勝手に決定しない
//                     （status: "undetermined"。clear/avoid のどちらにもしない）。
//
// personalResult は activityResult（good/neutral/mixed/bad）に一切影響しない。
// 既存 CalendarEngine（src/lib/calendar/）・擇日109活動判定・神殺・resolution・
// 十二建除・宿値日28宿・時家720・日方位・七政四餘は変更していない。

import { calculate } from "@/lib/calendar";
import { evaluatePersonalHonmeisatsu } from "./honmeisatsu";
import type { PersonalBirthInput, PersonalTakujitsuResult } from "./types";

export type {
  PersonalAvoidReason,
  PersonalAvoidType,
  PersonalBirthInput,
  PersonalTakujitsuResult,
  PersonalTakujitsuStatus,
} from "./types";
export { evaluatePersonalHonmeisatsu } from "./honmeisatsu";

/** 出生日の年命が一意に確定できたか（立春前後の検出結果）。 */
export type BirthYearGanzhi =
  | { status: "determined"; yearStem: string; yearBranch: string }
  | { status: "undetermined" };

/**
 * 出生日時から年命（年干支）を確定する。calculate() を1回（時刻あり）
 * または2回（時刻なし・立春境界の検出用）呼ぶだけで、新しい暦計算はしない。
 */
export function resolveBirthYearGanzhi(birth: PersonalBirthInput): BirthYearGanzhi {
  if (birth.hour !== undefined && birth.minute !== undefined) {
    const cal = calculate({
      year: birth.year,
      month: birth.month,
      day: birth.day,
      hour: birth.hour,
      minute: birth.minute,
      timezone: birth.timezone,
    });
    return { status: "determined", yearStem: cal.yearStem, yearBranch: cal.yearBranch };
  }

  const start = calculate({
    year: birth.year, month: birth.month, day: birth.day,
    hour: 0, minute: 0, timezone: birth.timezone,
  });
  const end = calculate({
    year: birth.year, month: birth.month, day: birth.day,
    hour: 23, minute: 59, timezone: birth.timezone,
  });

  if (start.yearStem === end.yearStem && start.yearBranch === end.yearBranch) {
    return { status: "determined", yearStem: start.yearStem, yearBranch: start.yearBranch };
  }
  return { status: "undetermined" };
}

/**
 * 確定済みの年命と候補日の日支から personalResult を求める。
 * yearGanzhi が undetermined の場合は honmeisatsu.ts を呼ばず、
 * そのまま status: "undetermined"（reasons: []）を返す。
 */
export function evaluatePersonalForDay(
  yearGanzhi: BirthYearGanzhi,
  dayBranch: string,
): PersonalTakujitsuResult {
  if (yearGanzhi.status === "undetermined") {
    return { status: "undetermined", reasons: [] };
  }
  const { status, reasons } = evaluatePersonalHonmeisatsu(
    yearGanzhi.yearStem,
    yearGanzhi.yearBranch,
    dayBranch,
  );
  return { status, reasons };
}

/**
 * 出生日時と候補日の日支から personalResult を求める単発呼び出し用の便宜関数。
 * UI（複数候補日をまとめて表示する画面）では resolveBirthYearGanzhi() を1回だけ呼び、
 * evaluatePersonalForDay() を日ごとに呼ぶ方が calculate() の呼び出し回数を抑えられる。
 */
export function evaluatePersonalForBirth(
  birth: PersonalBirthInput,
  dayBranch: string,
): PersonalTakujitsuResult {
  return evaluatePersonalForDay(resolveBirthYearGanzhi(birth), dayBranch);
}
