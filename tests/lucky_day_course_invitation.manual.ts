// tests/lucky_day_course_invitation.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）の擇日入門通信講座の案内
//   （src/lib/luckyDay/courseInvitation.ts、ユーザー指示 2026-10-20）の表示判定。
//   ・ID 2（月額）・ID 3（年額）: 表示
//   ・ID 4・5（講座会員）・無料会員・未ログイン: 非表示
//   ・active===false のときは levelId が何であっても非表示
//   ・リンク先URL
//
// 実行:
//   npx tsx tests/lucky_day_course_invitation.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { LUCKY_DAY_COURSE_URL, shouldShowCourseInvitation } from "../src/lib/luckyDay/courseInvitation";
import type { TakujitsuMemberStatus } from "../src/lib/luckyDay/auth/member";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean): void {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL: ${label}`);
  }
}

function status(over: Partial<TakujitsuMemberStatus>): TakujitsuMemberStatus {
  return { authenticated: true, active: true, levelId: null, userId: 10, ...over };
}

check("ID 2（月額）は表示", shouldShowCourseInvitation(status({ levelId: 2 })) === true);
check("ID 3（年額）は表示", shouldShowCourseInvitation(status({ levelId: 3 })) === true);
check("ID 4（講座 通常版）は非表示", shouldShowCourseInvitation(status({ levelId: 4 })) === false);
check("ID 5（講座 DVD版）は非表示", shouldShowCourseInvitation(status({ levelId: 5 })) === false);
check(
  "無料会員（ログイン済み・active=false）は非表示",
  shouldShowCourseInvitation(status({ active: false, levelId: null })) === false,
);
check(
  "未ログインは非表示",
  shouldShowCourseInvitation({ authenticated: false, active: false, levelId: null, userId: null }) === false,
);
// 型上は起こらない組み合わせだが、active=false なら levelId を見ても表示しない
check(
  "active=false かつ levelId=2 は非表示",
  shouldShowCourseInvitation(status({ active: false, levelId: 2 })) === false,
);
check(
  "active=false かつ levelId=3 は非表示",
  shouldShowCourseInvitation(status({ active: false, levelId: 3 })) === false,
);
check("リンク先URL", LUCKY_DAY_COURSE_URL === "https://fengshui.jp/luckyday-selection-course");

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) process.exit(1);
