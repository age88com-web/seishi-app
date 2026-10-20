// src/lib/luckyDay/courseInvitation.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の月額・年額会員に、擇日入門通信講座を
//   案内するかどうかの表示判定（ユーザー指示、2026-10-20）。表示のみ。
//
// 表示条件（会員レベルIDで判定、表示名は使わない）:
//   ・ID 2（月額）・ID 3（年額）: 表示
//   ・ID 4（講座 通常版）・ID 5（講座 DVD版）: 非表示（受講済みのため）
//   ・無料会員・未ログイン: 非表示
//
// 判定材料:
//   memberStatus は page.tsx（Server Component）が getCurrentTakujitsuMember()
//   （src/lib/luckyDay/auth/member.ts）で確定した値をそのまま使う。
//   levelId は active===true のときだけ 2〜5 が入り、それ以外は null。
//   URLパラメータ・ブラウザ側の値では判定しない。

import type { TakujitsuMemberStatus } from "./auth/member";

export const LUCKY_DAY_COURSE_URL = "https://fengshui.jp/luckyday-selection-course";

export function shouldShowCourseInvitation(memberStatus: TakujitsuMemberStatus): boolean {
  return memberStatus.active && (memberStatus.levelId === 2 || memberStatus.levelId === 3);
}
