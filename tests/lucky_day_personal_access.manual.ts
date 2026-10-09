// tests/lucky_day_personal_access.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）「生年月日による個人忌日判定」の
//   有料会員限定アクセス制御（src/lib/luckyDay/personalJudgment.ts）の
//   単体テスト。
//
//   個人忌日判定ロジック自体（相冲・三殺・三刑・箭刃、本命殺.csvを基準
//   とした対応表、立春境界のundetermined判定）は
//   src/lib/takujitsu/personal/（既存・テスト済み・
//   tests/takujitsu_personal_honmeisatsu_unit.manual.tsで既に328/328確認
//   済み）を一切変更せずそのまま使う。ここではその上に被せた
//   「有料会員（isPaid）でなければ既存エンジンを呼ばない」というゲート
//   （computePersonalResultForDay）が正しく機能することだけを検証する。
//
//   実際のServer Action（getDayDetailAction/searchDaysAction、"use server"）
//   は next/headers の cookies() を呼ぶ getCurrentTakujitsuMember() に
//   依存するため、この単体実行環境（プレーンなtsx）からは呼び出せない
//   （tests/lucky_day_access_control.manual.tsと同じ制約）。そのため、
//   Server Actionが実際に呼んでいるゲート関数
//   computePersonalResultForDay(isPaid, birth, dayBranch) 自身を、
//   isPaid（= src/lib/luckyDay/auth/member.ts の
//   getCurrentTakujitsuMember() が返す TakujitsuMemberStatus.active。
//   levelId 2〜5のときだけtrueになる、という判定自体は
//   tests/lucky_day_member_auth.manual.ts で別途検証済み）を直接与えて
//   検証する。
//
// 実行:
//   npx tsx tests/lucky_day_personal_access.manual.ts
//   （personalJudgment.ts は "server-only" を import しないため、
//   tests/lucky_day_access_control.manual.ts と同様
//   --conditions=react-server は不要）。
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { computePersonalResultForDay, isValidLuckyDayBirthInput } from "../src/lib/luckyDay/personalJudgment";
import { evaluatePersonalHonmeisatsu, resolveBirthYearGanzhi } from "../src/lib/takujitsu/personal";
import { calculate } from "../src/lib/calendar";
import { getTodayInTokyo, addDaysToIso, parseIsoDate } from "../src/lib/luckyDay/today";

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

const ALL_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 通常日（立春から離れた日付）の生年月日。年命が一意に確定することを前提にする。
const BIRTH = { year: 1990, month: 6, day: 15 };
const ganzhi = resolveBirthYearGanzhi(BIRTH);
check("テスト用生年月日の年命が確定できる（前提条件）", ganzhi.status === "determined");

if (ganzhi.status === "determined") {
  // 既存 evaluatePersonalHonmeisatsu()（無変更・テスト済み）から、実際に
  // 「avoid」になる日支と「clear」になる日支を機械的に見つける
  // （特定の年支・日支の組み合わせをハードコードで仮定しない）。
  const avoidBranch = ALL_BRANCHES.find(
    (b) => evaluatePersonalHonmeisatsu(ganzhi.yearStem, ganzhi.yearBranch, b).status === "avoid",
  );
  const clearBranch = ALL_BRANCHES.find(
    (b) => evaluatePersonalHonmeisatsu(ganzhi.yearStem, ganzhi.yearBranch, b).status === "clear",
  );
  check("該当する日支（avoid）が見つかる（前提条件）", avoidBranch !== undefined);
  check("該当しない日支（clear）が見つかる（前提条件）", clearBranch !== undefined);

  // ---------------------------------------------------------------------
  // 1〜4. 会員状態別の個人判定可否。
  // computePersonalResultForDay() はisPaid（boolean）だけを見るため、
  // 「未ログイン」と「ログイン済み非有料」はどちらもactive=falseであり、
  // このゲート関数の入力としては区別されない（既存
  // accessControl.ts（isDateAllowedForDetail等）と同じ設計方針）。
  // 「未ログインか、ログイン済みだが無料か」という区別自体は
  // getCurrentTakujitsuMember()（tests/lucky_day_member_auth.manual.tsで
  // 別途検証済み）の責務であり、ここでは isPaid=false の場合に一貫して
  // 個人判定が行われないことを確認する。
  // ---------------------------------------------------------------------
  if (avoidBranch) {
    check(
      "1. 未ログイン相当（isPaid=false） → 個人判定不可(null)",
      computePersonalResultForDay(false, BIRTH, avoidBranch) === null,
    );
    check(
      "2. ログイン済み非有料相当（isPaid=false） → 個人判定不可(null)",
      computePersonalResultForDay(false, BIRTH, avoidBranch) === null,
    );
    check(
      "3. level ID 2の会員相当（isPaid=true） → 個人判定可（null以外）",
      computePersonalResultForDay(true, BIRTH, avoidBranch) !== null,
    );
    check(
      "4. level ID 3の会員相当（isPaid=true） → 個人判定可（null以外）",
      computePersonalResultForDay(true, BIRTH, avoidBranch) !== null,
    );
  }

  // ---------------------------------------------------------------------
  // 5. 生年月日未入力 → 通常検索は従来どおり動く。
  // computePersonalResultForDay()自体は「個人判定部分」だけの関数のため、
  // ここでは「birth未指定でも例外を投げずnullを返す」ことを確認する
  // （actions.ts側では、この関数がnullを返しても data 本体
  // ＝calculateTakujitsuFull()/searchTakujitsuDays()の呼び出し・結果には
  // 一切影響しない構造になっている）。
  // ---------------------------------------------------------------------
  check(
    "5. 生年月日未入力(undefined)・有料 → 個人判定はnull（例外を投げない）",
    computePersonalResultForDay(true, undefined, avoidBranch ?? "子") === null,
  );
  check(
    "5. 生年月日未入力(null)・有料 → 個人判定はnull（例外を投げない）",
    computePersonalResultForDay(true, null, avoidBranch ?? "子") === null,
  );

  // ---------------------------------------------------------------------
  // 6. 正常な生年月日 → 個人判定が返る
  // ---------------------------------------------------------------------
  if (avoidBranch) {
    const result = computePersonalResultForDay(true, BIRTH, avoidBranch);
    check("6. 正常な生年月日＋有料 → 個人判定結果が返る（null以外）", result !== null);
  }

  // ---------------------------------------------------------------------
  // 7. 個人忌日該当日 → 理由が返る（既存の名称・型のまま）
  // ---------------------------------------------------------------------
  if (avoidBranch) {
    const result = computePersonalResultForDay(true, BIRTH, avoidBranch);
    const expected = evaluatePersonalHonmeisatsu(ganzhi.yearStem, ganzhi.yearBranch, avoidBranch);
    check("7. 該当日 → status=avoid", result?.status === "avoid");
    check("7. 該当日 → reasonsが1件以上", (result?.reasons.length ?? 0) > 0);
    check(
      "7. 該当日 → reasonsの内容が既存evaluatePersonalHonmeisatsu()と完全一致（既存名称を変更していない）",
      JSON.stringify(result?.reasons) === JSON.stringify(expected.reasons),
    );
  }

  // ---------------------------------------------------------------------
  // 8. 非該当日 → 非該当として扱える
  // ---------------------------------------------------------------------
  if (clearBranch) {
    const result = computePersonalResultForDay(true, BIRTH, clearBranch);
    check("8. 非該当日 → status=clear", result?.status === "clear");
    check("8. 非該当日 → reasonsは空配列", (result?.reasons.length ?? -1) === 0);
  }
}

// ---------------------------------------------------------------------------
// 9. 判定不能（立春境界） → 「問題なし」（＝clear）に変換されない。
// tests/takujitsu_personal_honmeisatsu_unit.manual.ts と同じ方法で、実データ
// から立春の瞬間を跨ぐ日を検出する（日付を決め打ちにしない）。
// ---------------------------------------------------------------------------
{
  function findLichunBoundaryDate(year: number): { year: number; month: number; day: number } | null {
    for (let d = 1; d <= 6; d++) {
      const start = calculate({ year, month: 2, day: d, hour: 0, minute: 0 });
      const end = calculate({ year, month: 2, day: d, hour: 23, minute: 59 });
      if (start.yearStem !== end.yearStem || start.yearBranch !== end.yearBranch) {
        return { year, month: 2, day: d };
      }
    }
    return null;
  }
  const boundary = findLichunBoundaryDate(1990) ?? findLichunBoundaryDate(1991) ?? findLichunBoundaryDate(1992);
  check("立春の瞬間を跨ぐ日を実データから検出できた（前提条件）", boundary !== null);
  if (boundary) {
    const result = computePersonalResultForDay(true, boundary, "午");
    check("9. 判定不能日＋有料 → status=undetermined（nullではない＝計算は実行された）", result?.status === "undetermined");
    check("9. 判定不能日 → reasonsは空配列", (result?.reasons.length ?? -1) === 0);
    check("9. 判定不能日 → statusが「clear」（実質「問題なし」）に変換されていない", result?.status !== "clear");
  }
}

// ---------------------------------------------------------------------------
// 10. 無料ユーザーがServer Actionへ生年月日を直接送っても個人判定結果を
//     返さない（＝isPaid===falseの間はbirthの値に関わらず必ずnull）。
//     actions.ts自体はcookies()依存で単体実行できないため、Server Actionが
//     実際に呼んでいるゲート関数そのものに、有効な生年月日を渡した状態で
//     直接検証する（＝クライアントが生年月日を偽装/直接送信してきた状況の
//     模擬）。
// ---------------------------------------------------------------------------
{
  const validBirth = { year: 2000, month: 1, day: 1 };
  check("isValidLuckyDayBirthInputは正常な値をvalidと判定する（前提条件）", isValidLuckyDayBirthInput(validBirth));
  check(
    "10. 無料ユーザー(isPaid=false)が有効な生年月日を送っても個人判定結果を取得できない(null)",
    computePersonalResultForDay(false, validBirth, "子") === null,
  );
  check(
    "10. isPaid=false は、相冲・三殺・三刑・箭刃いずれの日支に対してもnullを返す（総当たり確認）",
    ALL_BRANCHES.every((b) => computePersonalResultForDay(false, validBirth, b) === null),
  );
}

// ---------------------------------------------------------------------------
// isValidLuckyDayBirthInput 自体の形式チェック（不正値の拒否）。
// ---------------------------------------------------------------------------
check("正常な生年月日はvalid", isValidLuckyDayBirthInput({ year: 2000, month: 1, day: 1 }));
check("不正な年（範囲外・過去すぎる）は無効", !isValidLuckyDayBirthInput({ year: 1800, month: 1, day: 1 }));
check("不正な年（範囲外・未来すぎる）は無効", !isValidLuckyDayBirthInput({ year: 2200, month: 1, day: 1 }));
check("不正な月（0）は無効", !isValidLuckyDayBirthInput({ year: 2000, month: 0, day: 1 }));
check("不正な月（13）は無効", !isValidLuckyDayBirthInput({ year: 2000, month: 13, day: 1 }));
check("不正な日（0）は無効", !isValidLuckyDayBirthInput({ year: 2000, month: 1, day: 0 }));
check("不正な日（32）は無効", !isValidLuckyDayBirthInput({ year: 2000, month: 1, day: 32 }));
check("小数の年は無効", !isValidLuckyDayBirthInput({ year: 2000.5, month: 1, day: 1 }));
check("文字列の年は無効", !isValidLuckyDayBirthInput({ year: "2000", month: 1, day: 1 }));
check("nullは無効", !isValidLuckyDayBirthInput(null));
check("undefinedは無効", !isValidLuckyDayBirthInput(undefined));
check("配列は無効", !isValidLuckyDayBirthInput([2000, 1, 1]));
check("フィールド欠落は無効", !isValidLuckyDayBirthInput({ year: 2000, month: 1 }));

// ---------------------------------------------------------------------------
// 生年月日として未来日は無効（ユーザー指示、2026-09-20：カレンダー入力UIの
// max属性はブラウザ側の補助にすぎず、実際の拒否はServer Action側で行う）。
// 「今日」を決め打ちにせず、getTodayInTokyo()から動的に境界日を算出する。
// ---------------------------------------------------------------------------
{
  const today = getTodayInTokyo();
  const tomorrow = parseIsoDate(addDaysToIso(today.iso, 1));
  const farFuture = parseIsoDate(addDaysToIso(today.iso, 3650));

  check("今日の日付はvalid（境界値）", isValidLuckyDayBirthInput({ year: today.year, month: today.month, day: today.day }));
  check("明日の日付は無効（未来日）", !isValidLuckyDayBirthInput(tomorrow));
  check("遠い未来の日付は無効", !isValidLuckyDayBirthInput(farFuture));
}

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
