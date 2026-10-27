"use server";

// src/lib/luckyDay/travelActions.ts
//
// 役割:
//   「海外旅行・観光の吉日」月間一覧の Server Action（newCarActions.ts と同じ方式）。
//   会員状態はクライアントから受け取らず、既存の getCurrentTakujitsuMember() を
//   サーバー側で呼び直して判定する。日ごとの表示可否は buildTravelMonth() 内で
//   既存の isDateAllowedForDetail() が判定する。
//   生年月日（birth）は actions.ts と同じく isValidLuckyDayBirthInput() で検証し、
//   不正・未指定なら個人判定なしで続行する。個人判定は有料会員のときだけ行われる。

import { getCurrentTakujitsuMember } from "./auth/member";
import { getTodayInTokyo } from "./today";
import { isValidNewCarYearMonth } from "./newCarMonth";
import { buildTravelMonth } from "./travelMonth";
import { isValidLuckyDayBirthInput } from "./personalJudgment";
import type { TravelMonth } from "./travelMonth";

export type TravelMonthActionResult =
  | { ok: true; data: TravelMonth }
  | { ok: false; reason: "invalid_input" | "calc_error" };

export async function getTravelMonthAction(year: number, month: number, birth?: unknown): Promise<TravelMonthActionResult> {
  if (!isValidNewCarYearMonth(year, month)) {
    return { ok: false, reason: "invalid_input" };
  }
  const member = await getCurrentTakujitsuMember();
  const today = getTodayInTokyo();
  try {
    const validBirth = birth != null && isValidLuckyDayBirthInput(birth) ? birth : null;
    return { ok: true, data: buildTravelMonth(year, month, today.iso, member.active, validBirth) };
  } catch {
    return { ok: false, reason: "calc_error" };
  }
}
