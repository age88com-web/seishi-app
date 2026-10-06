// tests/takujitsu_kyoushin_group5_unit.manual.ts
//
// 目的:
//   擇日「日家凶神」第5グループ（四離・四絶・八節日・土王用事・氣往亡）を
//   区分B（擇日テキストの規定そのものを期待値とした単体テスト）で検証する。
//   docs/source/擇日実例.pdf にはこの5項目がいずれも一度も出現しない
//   （grep 済み、0件）ため、fixture照合は行わない。
//
// 節気の節入り暦日について:
//   テスト中の「2024-02-04が立春」等の具体的な暦日は、擇日テキストにも
//   実例PDFにも書かれていない。これは一般知識からの決め打ちではなく、
//   既に検証済み・凍結済みの CalendarEngine 自身（calculate() の
//   solarTerm/solarTermDateTime）を使って求めた値であり、
//   tests/fixtures/find_solar_term_dates.ts で機械的に特定した
//   （本テストが検証したいのは「節気の天文計算が正しいか」ではなく、
//   「その節気を基準にした前日・N日後の判定＝kyoushinGroup5.ts 側の
//   日付演算が正しいか」であるため、節気の日付自体はCalendarEngineを
//   信頼して基準値として使ってよい）。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group5_unit.manual.ts

import { resolveKyoushinGroup5 } from "../src/lib/takujitsu";
import type { CalendarInput } from "../src/lib/calendar";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function d(year: number, month: number, day: number, hour = 12, minute = 0): CalendarInput {
  return { year, month, day, hour, minute };
}

function check(label: string, input: CalendarInput, expectedKyojin: string[]) {
  const actual = [...resolveKyoushinGroup5(input).kyojin].sort();
  const expected = [...expectedKyojin].sort();
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(
      `  [${label}] 対象=${input.year}-${input.month}-${input.day} ${input.hour}:${String(input.minute).padStart(2, "0")} ` +
        `期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`,
    );
  }
}

// CalendarEngine（凍結済み・検証済み）自身から特定した節気の節入り暦日
// （tests/fixtures/find_solar_term_dates.ts の出力）。
// 冬至 2023-12-22／立春 2024-02-04／啓蟄 2024-03-05／春分 2024-03-20／
// 立秋 2024-08-07／白露 2024-09-07／小寒 2024-01-06

console.log("[区分B] ロジック単体テスト（第5グループ：四離・四絶・八節日・土王用事・氣往亡）");
console.log(
  "根拠: docs/source/擇日テキスト.pdf p.25-26・p.30・p.31（実例PDFに0件のため単体テストのみで検証）\n",
);

// ---- 26）四離：二至二分（冬至・夏至・春分・秋分）の一日前 ----
check("四離：冬至(12/22)の前日", d(2023, 12, 21), ["四離"]);
check("四離：冬至(12/22)当日は前日条件を満たさない", d(2023, 12, 22), ["八節日"]);
check("四離：冬至(12/22)の翌日は対象外", d(2023, 12, 23), []);

// ---- 26）四絶：四立（立春・立夏・立秋・立冬）の一日前 ----
check("四絶：立春(2/4)の前日", d(2024, 2, 3), ["四絶"]);
check("四絶：立春(2/4)当日は前日条件を満たさない", d(2024, 2, 4), ["八節日"]);
// 2024-02-05 は四絶ではないが、小寒(2024-01-06)+30日と一致するため氣往亡は成立する
// （CalendarEngineの実際の節気日付から確認済みの別項目との偶然の重なりであり、バグではない）。
check("四絶：立春(2/4)の翌日は四絶ではない（別項目の氣往亡のみ）", d(2024, 2, 5), ["氣往亡"]);

// ---- 30）八節日：二至二分・四立の当日 ----
check("八節日：立秋(8/7)当日", d(2024, 8, 7), ["八節日"]);
check("八節日：立秋(8/7)の前日は八節日ではなく四絶", d(2024, 8, 6), ["四絶"]);
check("八節日：立秋(8/7)の翌日は対象外", d(2024, 8, 8), []);

// ---- 31）土王用事（土用）：四立の18日前 ----
// 立秋=2024-08-07 なので、その18日前は 2024-07-20。
check("土王用事：立秋(8/7)の18日前(7/20)", d(2024, 7, 20), ["土王用事"]);
check("土王用事：17日前(7/21)は対象外", d(2024, 7, 21), []);
check("土王用事：19日前(7/19)は対象外", d(2024, 7, 19), []);

// ---- 氣往亡：節気ごとの固定日数後 ----
// 立春(2/4)+7日=2/11、啓蟄(3/5)+14日=3/19、立秋(8/7)+9日=8/16、白露(9/7)+18日=9/25
check("氣往亡：立春(2/4)+7日(2/11)", d(2024, 2, 11), ["氣往亡"]);
check("氣往亡：立春+6日(2/10)は対象外", d(2024, 2, 10), []);
check("氣往亡：立春+8日(2/12)は対象外", d(2024, 2, 12), []);
// 2024-03-19 は啓蟄+14日の氣往亡成立日だが、翌3/20が春分（中気）でも
// あるため四離（二至二分の前日）も同時に成立する（両方成立して正しい）。
check("氣往亡：啓蟄(3/5)+14日(3/19)（春分前日でもあるため四離も成立）", d(2024, 3, 19), [
  "四離",
  "氣往亡",
]);
check("氣往亡：啓蟄+13日(3/18)は対象外", d(2024, 3, 18), []);
// 2024-03-20は啓蟄+15日には該当しないが、春分（中気）当日そのものなので八節日が成立する。
check("氣往亡：啓蟄+15日(3/20)は対象外だが春分当日のため八節日が成立", d(2024, 3, 20), [
  "八節日",
]);
check("氣往亡：立秋(8/7)+9日(8/16)", d(2024, 8, 16), ["氣往亡"]);
check("氣往亡：白露(9/7)+18日(9/25)", d(2024, 9, 25), ["氣往亡"]);
check("氣往亡：白露+17日(9/24)は対象外", d(2024, 9, 24), []);
check("氣往亡：白露+19日(9/26)は対象外", d(2024, 9, 26), []);

// ---- 日付境界（子初23:00の日柱切替と混同していないことの確認） ----
// 同じ暦日（2024-02-03＝四絶）を hour=0:01 と hour=23:59 で問い合わせても
// 結果が変わらないこと（日柱の23:00切替の影響を受けていないこと）を確認する。
check("境界：四絶の日を0:01で問い合わせても同じ", d(2024, 2, 3, 0, 1), ["四絶"]);
check("境界：四絶の日を23:59で問い合わせても同じ", d(2024, 2, 3, 23, 59), ["四絶"]);
check("境界：立春当日を0:01で問い合わせても八節日", d(2024, 2, 4, 0, 1), ["八節日"]);
check("境界：立春当日を23:59で問い合わせても八節日", d(2024, 2, 4, 23, 59), ["八節日"]);

console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
