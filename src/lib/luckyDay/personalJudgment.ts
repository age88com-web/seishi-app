// src/lib/luckyDay/personalJudgment.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）有料会員向け「生年月日による個人忌日
//   判定」の橋渡し層。
//
// 重要（ユーザー指示、2026-09-20。個人忌日判定ロジック自体は作らない）:
//   相冲・三殺・三刑・箭刃の判定、本命殺.csvを基準とした対応表、出生時刻
//   不明時の立春境界検出（undetermined）は、既存・テスト済みの
//   src/lib/takujitsu/personal/（evaluatePersonalForBirth 等）をそのまま
//   使う。ここでは新しい判定・新しい暦計算・新しい対応表を一切作らない。
//   このファイルが行うのは以下の2点だけ:
//     1. /lucky-day専用の入力形式（LuckyDayBirthInput、生年月日のみ。
//        出生時刻・性別は収集しない＝既存ロジックが必須としていないため）
//        のバリデーション。
//     2. 有料会員判定に応じたアクセス制御（無料/未ログインの場合は
//        evaluatePersonalForBirth() 自体を呼ばず、常に null を返す）。
//
// 重要（セキュリティ、ユーザー指示 2026-09-20）:
//   isPaid は呼び出し側（src/lib/luckyDay/actions.ts、"use server"）が
//   getCurrentTakujitsuMember() を毎回呼び直して確定した値をそのまま渡す。
//   ここでは isPaid の値を信頼するだけで levelId の再判定はしない
//   （levelId∈{2,3,4,5}の判定は src/lib/luckyDay/auth/member.ts の
//   isPaidLevelId() 1箇所のみで行う、という既存方針を踏襲する）。
//   無料ユーザーがDevTools等から生年月日を直接送っても、isPaid===false の
//   間は evaluatePersonalForBirth() 自体を呼ばない＝個人忌日判定結果を
//   一切返さない（吉凶方位の isDirectionAllowed と同じ考え方）。
//
// このファイルは "server-only" を import しない（session.ts/wordpress.ts/
// member.ts と異なり cookies()・fetch を一切使わない純粋関数のため）。
// ただし src/lib/luckyDay/index.ts からは意図的に re-export しない
// （Client Componentからこのファイルの実処理を直接importできる状態には
// しない。実際の呼び出しは src/lib/luckyDay/actions.ts、"use server" 経由
// のみに限定する）。

import { evaluatePersonalForBirth } from "@/lib/takujitsu/personal";
import type { PersonalTakujitsuResult } from "@/lib/takujitsu/personal";
import { getTodayInTokyo } from "./today";

/** /lucky-day専用の生年月日入力（年月日のみ）。 */
export interface LuckyDayBirthInput {
  year: number;
  month: number;
  day: number;
}

const MIN_BIRTH_YEAR = 1900;
const MAX_BIRTH_YEAR = 2100;

/**
 * クライアントから受け取った値が正しい形の生年月日かを検証する。
 * 生年月日なので、今日（Asia/Tokyo）より未来の日付は無効とする
 * （ユーザー指示、2026-09-20：カレンダー入力UIの`max`属性はあくまで
 * ブラウザ側の補助にすぎず、実際の拒否はここ＝Server Action側で行う）。
 */
export function isValidLuckyDayBirthInput(v: unknown): v is LuckyDayBirthInput {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (
    typeof r.year !== "number" ||
    !Number.isInteger(r.year) ||
    r.year < MIN_BIRTH_YEAR ||
    r.year > MAX_BIRTH_YEAR
  ) {
    return false;
  }
  if (typeof r.month !== "number" || !Number.isInteger(r.month) || r.month < 1 || r.month > 12) {
    return false;
  }
  if (typeof r.day !== "number" || !Number.isInteger(r.day) || r.day < 1 || r.day > 31) {
    return false;
  }
  const birthIso = `${String(r.year).padStart(4, "0")}-${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`;
  if (birthIso > getTodayInTokyo().iso) {
    return false;
  }
  return true;
}

/**
 * 有料会員（isPaid）かつ有効な生年月日が指定されている場合だけ、既存の
 * 個人忌日判定（evaluatePersonalForBirth、src/lib/takujitsu/personal、
 * 無変更）を実行する。
 *
 * isPaid===false、または birth が未指定/不正な場合は、既存エンジンを一切
 * 呼ばずに null を返す（＝計算そのものを行わない。無料ユーザーが
 * DevTools等から有効な生年月日を直接送っても、この関数の外側では
 * 個人忌日判定結果を取得できない）。
 */
export function computePersonalResultForDay(
  isPaid: boolean,
  birth: LuckyDayBirthInput | null | undefined,
  dayBranch: string,
): PersonalTakujitsuResult | null {
  if (!isPaid) return null;
  if (!birth) return null;
  try {
    return evaluatePersonalForBirth(
      { year: birth.year, month: birth.month, day: birth.day, timezone: "Asia/Tokyo" },
      dayBranch,
    );
  } catch {
    // calculate()に暦として無効な年月日（例: 2月30日）が渡された場合も、
    // 検索・日付詳細本体を失敗させず、個人判定だけを「未計算」として扱う。
    return null;
  }
}
