// tests/lucky_day_access_control.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）の無料/有料「入力可能範囲」判定
//   （src/lib/luckyDay/accessControl.ts）の単体テスト。
//
//   このファイルは src/lib/luckyDay/actions.ts（Server Action。
//   getDayDetailAction/searchDaysAction）が実際のアクセス許可判定に
//   使っているのと同じ純粋関数（isDateAllowedForDetail/
//   isSearchRangeAllowed）を直接検証する。
//
//   actions.ts 自体・getCurrentTakujitsuMember()（src/lib/luckyDay/
//   auth/member.ts）は next/headers の cookies() を呼ぶため、Next.jsの
//   リクエストスコープ外（このtsx単体実行環境）では呼び出せない
//   （tests/lucky_day_member_auth.manual.ts と同じ制約）。そのため、
//   実際にサーバー側で使われる判定ロジックそのもの（accessControl.ts）を
//   直接テストすることで、日付/期間の許可・拒否が仕様どおりであることを
//   保証する。
//
//   既存の専門家向け認証・判定エンジン・擇日ロジックは一切変更・参照
//   しない、独立したテスト。
//
// 実行:
//   npx tsx tests/lucky_day_access_control.manual.ts
//
//   （accessControl.ts は "server-only" を import していないため、
//   tests/lucky_day_member_auth.manual.ts と異なり
//   --conditions=react-server は不要）。
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import {
  FREE_DAYS_AHEAD,
  getFreeMaxDateIso,
  isDateAllowedForDetail,
  isDirectionAllowed,
  isSearchRangeAllowed,
} from "../src/lib/luckyDay/accessControl";
import { addDaysToIso } from "../src/lib/luckyDay/today";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

const TODAY = "2026-09-19";
const YESTERDAY = addDaysToIso(TODAY, -1);
const TOMORROW = addDaysToIso(TODAY, 1);
const FREE_MAX = getFreeMaxDateIso(TODAY); // today + 30日
const PAST_FAR = addDaysToIso(TODAY, -400);
const FUTURE_FAR = addDaysToIso(TODAY, 400);

check("FREE_DAYS_AHEADは30", FREE_DAYS_AHEAD === 30);
check("getFreeMaxDateIso(今日) = 今日+30日", FREE_MAX === addDaysToIso(TODAY, 30));

// -------------------------------------------------------------------------
// isDateAllowedForDetail
// -------------------------------------------------------------------------
// 有料会員: 常に許可（過去日・遠い未来日を含む）。
check("有料: 今日は許可", isDateAllowedForDetail(TODAY, TODAY, true));
check("有料: 遠い過去日も許可", isDateAllowedForDetail(PAST_FAR, TODAY, true));
check("有料: 遠い未来日も許可", isDateAllowedForDetail(FUTURE_FAR, TODAY, true));
check("有料: 昨日も許可", isDateAllowedForDetail(YESTERDAY, TODAY, true));

// 無料/未ログイン: 今日〜今日+30日（両端含む）のみ許可。
check("無料: 今日は許可", isDateAllowedForDetail(TODAY, TODAY, false));
check("無料: 明日は許可", isDateAllowedForDetail(TOMORROW, TODAY, false));
check("無料: 今日+30日（境界）は許可", isDateAllowedForDetail(FREE_MAX, TODAY, false));
check("無料: 今日+31日は不許可", !isDateAllowedForDetail(addDaysToIso(TODAY, 31), TODAY, false));
check("無料: 昨日（過去日）は不許可", !isDateAllowedForDetail(YESTERDAY, TODAY, false));
check("無料: 遠い過去日は不許可", !isDateAllowedForDetail(PAST_FAR, TODAY, false));
check("無料: 遠い未来日は不許可", !isDateAllowedForDetail(FUTURE_FAR, TODAY, false));

// -------------------------------------------------------------------------
// isDirectionAllowed（2026-09-19仕様修正: 無料ユーザーは「今日」の吉凶方位
// だけ許可。30日以内の検索結果から開いた今日以外の日は不許可）。
// -------------------------------------------------------------------------
check("有料: 今日の吉凶方位は許可", isDirectionAllowed(TODAY, TODAY, true));
check("有料: 今日以外（未来）の吉凶方位も許可", isDirectionAllowed(TOMORROW, TODAY, true));
check("有料: 今日以外（過去）の吉凶方位も許可", isDirectionAllowed(YESTERDAY, TODAY, true));
check("有料: 遠い未来日の吉凶方位も許可", isDirectionAllowed(FUTURE_FAR, TODAY, true));
check("無料: 今日の吉凶方位は許可", isDirectionAllowed(TODAY, TODAY, false));
check("無料: 明日（30日以内の未来日）の吉凶方位は不許可", !isDirectionAllowed(TOMORROW, TODAY, false));
check("無料: 今日+30日（30日以内の境界）の吉凶方位も不許可", !isDirectionAllowed(FREE_MAX, TODAY, false));
check("無料: 昨日の吉凶方位は不許可", !isDirectionAllowed(YESTERDAY, TODAY, false));
// isDateAllowedForDetail（詳細表示自体）と isDirectionAllowed（吉凶方位）は
// 別判定であることの確認: 無料ユーザーが30日以内の未来日を見る場合、
// 詳細表示は許可されるが吉凶方位は許可されない、という組み合わせが起きる。
check(
  "無料: 30日以内の未来日は詳細表示は許可・吉凶方位は不許可（別判定であることの確認）",
  isDateAllowedForDetail(TOMORROW, TODAY, false) && !isDirectionAllowed(TOMORROW, TODAY, false),
);

// -------------------------------------------------------------------------
// isSearchRangeAllowed
// -------------------------------------------------------------------------
// 有料会員: 366日以内なら過去日・未来日とも自由。
{
  const r = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 300), TODAY, true);
  check("有料: 300日先までの検索は許可", r.allowed);
}
{
  // PAST_FARは今日の400日前のため、PAST_FAR〜今日は401日間（inclusive）となり
  // 366日上限を超える。有料会員でも366日上限自体は変わらないため不許可。
  const r = isSearchRangeAllowed(PAST_FAR, TODAY, TODAY, true);
  check("有料でも366日を超える過去日検索は不許可（range_too_long）", !r.allowed && r.reason === "range_too_long");
}
{
  // 366日以内の過去日検索は有料会員なら許可される（無料では不許可）。
  const nearPast = addDaysToIso(TODAY, -100);
  const paidResult = isSearchRangeAllowed(nearPast, TODAY, TODAY, true);
  const freeResult = isSearchRangeAllowed(nearPast, TODAY, TODAY, false);
  check("有料: 366日以内の過去日検索は許可", paidResult.allowed);
  check("無料: 過去日検索は不許可（past_start）", !freeResult.allowed && freeResult.reason === "past_start");
}
{
  const r = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 367), TODAY, true);
  check("有料でも367日は不許可（range_too_long）", !r.allowed && r.reason === "range_too_long");
}
{
  // diffDaysInclusive は両端を含めて数えるため、366日間（inclusive）の
  // 終了日は開始日+365日（例: 1/1〜1/1が1日間、1/1〜1/2が2日間）。
  const r = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 365), TODAY, true);
  check("有料: ちょうど366日間（境界）は許可", r.allowed);
}

// 無料/未ログイン: 開始日は今日以降、終了日は今日+30日まで。
{
  const r = isSearchRangeAllowed(TODAY, FREE_MAX, TODAY, false);
  check("無料: 今日〜今日+30日（境界いっぱい）は許可", r.allowed);
}
{
  const r = isSearchRangeAllowed(TOMORROW, FREE_MAX, TODAY, false);
  check("無料: 明日〜今日+30日も許可", r.allowed);
}
{
  const r = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 31), TODAY, false);
  check("無料: 終了日が今日+31日は不許可（too_far_ahead）", !r.allowed && r.reason === "too_far_ahead");
}
{
  const r = isSearchRangeAllowed(YESTERDAY, addDaysToIso(TODAY, 5), TODAY, false);
  check("無料: 開始日が過去日は不許可（past_start）", !r.allowed && r.reason === "past_start");
}
{
  const r = isSearchRangeAllowed(addDaysToIso(TODAY, 5), TODAY, TODAY, false);
  check("開始日>終了日は不許可（invalid_range、無料/有料共通）", !r.allowed && r.reason === "invalid_range");
}
{
  const r = isSearchRangeAllowed(addDaysToIso(TODAY, 5), TODAY, TODAY, true);
  check("開始日>終了日は有料でも不許可（invalid_range）", !r.allowed && r.reason === "invalid_range");
}
{
  // 3日間・1週間クイックボタン相当（無料でも常に許可されるはずの範囲）。
  const threeDays = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 2), TODAY, false);
  const oneWeek = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 6), TODAY, false);
  check("無料: 3日間クイック相当は許可", threeDays.allowed);
  check("無料: 1週間クイック相当は許可", oneWeek.allowed);
}
{
  // 1ヶ月・3ヶ月クイックボタン相当（無料では不許可になるはずの範囲）。
  const oneMonth = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 31), TODAY, false); // addMonthsToIso(TODAY,1)相当がtoday+31日目安
  const threeMonths = isSearchRangeAllowed(TODAY, addDaysToIso(TODAY, 90), TODAY, false);
  check("無料: 1ヶ月相当（30日超）は不許可", !oneMonth.allowed);
  check("無料: 3ヶ月相当は不許可", !threeMonths.allowed);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
