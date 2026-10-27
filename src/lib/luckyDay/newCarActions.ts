"use server";

// src/lib/luckyDay/newCarActions.ts
//
// 役割:
//   「新車購入・納車の吉日」月間一覧の Server Action。
//   会員状態はクライアントから受け取らず、既存の getCurrentTakujitsuMember() を
//   サーバー側で呼び直して判定する（actions.ts の他の Server Action と同じ方式）。
//   日ごとの表示可否は buildNewCarMonth() 内で既存の isDateAllowedForDetail() が判定する。

import { getCurrentTakujitsuMember } from "./auth/member";
import { getTodayInTokyo } from "./today";
import { buildNewCarMonth, isValidNewCarYearMonth } from "./newCarMonth";
import type { NewCarMonth } from "./newCarMonth";

export type NewCarMonthActionResult =
  | { ok: true; data: NewCarMonth }
  | { ok: false; reason: "invalid_input" | "calc_error" };

export async function getNewCarMonthAction(year: number, month: number): Promise<NewCarMonthActionResult> {
  if (!isValidNewCarYearMonth(year, month)) {
    return { ok: false, reason: "invalid_input" };
  }
  const member = await getCurrentTakujitsuMember();
  const today = getTodayInTokyo();
  try {
    return { ok: true, data: buildNewCarMonth(year, month, today.iso, member.active) };
  } catch {
    return { ok: false, reason: "calc_error" };
  }
}
