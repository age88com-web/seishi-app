// src/lib/luckyDay/accessControl.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の無料/有料「入力可能範囲」の
//   純粋関数（副作用・秘密情報なし）。
//
// 重要（ユーザー指示、2026-09-19）:
//   ・無料版と有料版で擇日判定ロジックを分岐させない。同じ
//     calculateTakujitsuFull()/searchTakujitsuDays()（既存エンジン、
//     一切変更しない）を使い、「入力可能範囲」「検索期間」「表示可能な
//     導線」だけを会員状態によって制御する。
//   ・有料会員判定は既存仕様どおり、getCurrentTakujitsuMember() が返す
//     active（＝ active===true かつ levelId∈{2,3,4,5} の場合だけtrue。
//     src/lib/luckyDay/auth/member.ts で既に確定済みの唯一の判定）を
//     そのまま使う。ここでは levelId を再判定しない。
//
// このファイルは "server-only" ではない（意図的）:
//   Client Component側のUIヒント（日付inputのmin/max属性、クイック
//   ボタンの無効化表示など）にも、Server Action側（src/lib/luckyDay/
//   actions.ts）の実際のアクセス許可判定にも、同じロジックを使うため。
//   ただし実際のセキュリティ境界はServer Action側（サーバーでのみ実行され、
//   クライアント操作で回避できない）であり、ここでの利用はあくまで
//   「同じ判定式を二重管理しない」ための共有にすぎない。UIヒントを
//   改ざんされても、Server Action側が独立に同じ判定を再実行するため
//   突破できない。

import { addDaysToIso, diffDaysInclusive } from "./today";
import { TAKUJITSU_SEARCH_MAX_DAYS } from "@/lib/takujitsu";

/** 無料ユーザーが利用できる、今日から何日先までか（ユーザー指示：「今日から30日先まで」）。 */
export const FREE_DAYS_AHEAD = 30;

/** 無料ユーザーが利用できる最終日（今日 + FREE_DAYS_AHEAD）を返す。 */
export function getFreeMaxDateIso(todayIso: string): string {
  return addDaysToIso(todayIso, FREE_DAYS_AHEAD);
}

/**
 * 指定日の詳細（DayDetailCard＝暦・63/109活動など、吉凶方位を除く一式）を
 * 表示してよいか。
 *   有料会員（isPaid===true）: 常に許可（過去日も含む）。
 *   無料/未ログイン: 今日〜今日+30日（両端含む）のみ許可。
 * ユーザー指示（2026-09-19）: 無料ユーザーでも、30日以内の検索結果から
 * 開いた日の擇日判定・詳細暦等は表示してよい（吉凶方位だけは別途
 * isDirectionAllowed() で判定する）。
 */
export function isDateAllowedForDetail(dateIso: string, todayIso: string, isPaid: boolean): boolean {
  if (isPaid) return true;
  return dateIso >= todayIso && dateIso <= getFreeMaxDateIso(todayIso);
}

/**
 * 指定日の「吉凶方位」（八方位盤）を表示してよいか。
 *   有料会員（isPaid===true）: 常に許可（isDateAllowedForDetailと同じ）。
 *   無料/未ログイン: 今日そのものだけ許可（今日以外は、30日以内の検索
 *     結果から開いた日であっても不許可）。
 * ユーザー指示（2026-09-19、仕様修正）:
 *   「無料ユーザーが30日以内の検索結果の日付を開いた場合、吉凶方位も
 *   表示する」実装は誤り。正しくは「今日の吉凶方位は無料、今日以外は
 *   （検索結果から開いた日であっても）有料会員限定」。
 *   dailyDirections等の方位計算ロジック自体は一切変更しない
 *   （ここは「その日の方位データを見せてよいか」だけを判定する）。
 */
export function isDirectionAllowed(dateIso: string, todayIso: string, isPaid: boolean): boolean {
  if (isPaid) return true;
  return dateIso === todayIso;
}

export interface SearchRangeCheck {
  allowed: boolean;
  reason?: "invalid_range" | "past_start" | "too_far_ahead" | "range_too_long";
}

/**
 * 「目的から吉日を探す」の検索期間が許可されるか。
 *   有料会員: 既存の最大366日制限のみ（過去日・366日以内なら自由）。
 *   無料/未ログイン: 開始日は今日以降、終了日は今日+30日まで
 *     （＝今日を含めて未来方向のみ、30日以内）。
 */
export function isSearchRangeAllowed(
  from: string,
  to: string,
  todayIso: string,
  isPaid: boolean,
): SearchRangeCheck {
  if (to < from) {
    return { allowed: false, reason: "invalid_range" };
  }
  if (diffDaysInclusive(from, to) > TAKUJITSU_SEARCH_MAX_DAYS) {
    return { allowed: false, reason: "range_too_long" };
  }
  if (isPaid) {
    return { allowed: true };
  }
  if (from < todayIso) {
    return { allowed: false, reason: "past_start" };
  }
  if (to > getFreeMaxDateIso(todayIso)) {
    return { allowed: false, reason: "too_far_ahead" };
  }
  return { allowed: true };
}
