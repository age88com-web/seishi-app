// tests/takujitsu_kyoushin_group5_unit.manual.ts
//
// 目的:
//   擇日「日家凶神」第5グループ（四離・四絶・八節日・土王用事・氣往亡）を
//   （土王用事は 2026-10-24 正式仕様の期間判定。doyo.ts の日単位区分・瞬間判定も検証する）
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

import { resolveKyoushinGroup5, resolveDoyoAt, resolveDoyoDayStatus } from "../src/lib/takujitsu";
import { calculate as calculateCalendar } from "../src/lib/calendar";
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
check("四離：冬至(12/22)当日は前日条件を満たさない（八節日は二至二分・冬至の種類も成立）", d(2023, 12, 22), ["八節日", "八節日（二至二分）", "八節日（冬至）"]);
check("四離：冬至(12/22)の翌日は対象外", d(2023, 12, 23), []);

// ---- 26）四絶：四立（立春・立夏・立秋・立冬）の一日前 ----
// 2024-02-03 は冬土用（2024-01-17〜立春 2024-02-04）の最終日でもあるため土王用事も成立する。
check("四絶：立春(2/4)の前日（冬土用最終日のため土王用事も成立）", d(2024, 2, 3), ["四絶", "土王用事"]);
// 2024-02-04 は立春（17:27 JST）まで冬土用の土用明け日のため、日単位では土王用事も成立する。
check("四絶：立春(2/4)当日は前日条件を満たさない（土用明け日のため土王用事も成立）", d(2024, 2, 4), ["八節日", "土王用事"]);
// 2024-02-05 は四絶ではないが、小寒(2024-01-06)+30日と一致するため氣往亡は成立する
// （CalendarEngineの実際の節気日付から確認済みの別項目との偶然の重なりであり、バグではない）。
check("四絶：立春(2/4)の翌日は四絶ではない（別項目の氣往亡のみ）", d(2024, 2, 5), ["氣往亡"]);

// ---- 30）八節日：二至二分・四立の当日 ----
// 2024-08-07 は立秋（09:09 JST）まで夏土用の土用明け日のため、日単位では土王用事も成立する。
check("八節日：立秋(8/7)当日（土用明け日のため土王用事も成立）", d(2024, 8, 7), ["八節日", "土王用事"]);
check("八節日：立秋(8/7)の前日は八節日ではなく四絶（夏土用最終日のため土王用事も成立）", d(2024, 8, 6), ["四絶", "土王用事"]);
check("八節日：立秋(8/7)の翌日は対象外", d(2024, 8, 8), []);

// ---- 31）土王用事（土用）：土用入り〜次の四立の期間（太陽黄経基準） ----
// 2026-10-24 正式仕様: 旧「四立の18日前の1日」判定は廃止。
// 土用入り＝太陽黄経297°/27°/117°/207°、土用明け＝次の四立（315°/45°/135°/225°）。
// 日単位では、その日の一部でも土用なら成立する（土用入り日・土用中・土用明け日＝四立日）。
// 2024年夏: 土用入り 2024-07-19 13:17 JST（117°）、立秋 2024-08-07 09:09 JST。
// 旧方式（立秋の18日前＝7/20）とは1日ずれていた年。
check("土王用事：2024夏 土用入りの前日(7/18)は対象外", d(2024, 7, 18), []);
check("土王用事：2024夏 土用入り当日(7/19、黄経117°)", d(2024, 7, 19), ["土王用事"]);
check("土王用事：2024夏 土用中(7/20)", d(2024, 7, 20), ["土王用事"]);
check("土王用事：2024夏 土用中(7/21、旧方式では対象外)", d(2024, 7, 21), ["土王用事"]);
check("土王用事：2024夏 土用中(7/31)", d(2024, 7, 31), ["土王用事"]);
// 2024-08-06 は立秋の前日＝四絶。土用最終日でもあるため土王用事も成立する。
check("土王用事：2024夏 土用最終日(8/6、四絶と重なる)", d(2024, 8, 6), ["四絶", "土王用事"]);

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
check("氣往亡：啓蟄+15日(3/20)は対象外だが春分当日のため八節日（二至二分）が成立", d(2024, 3, 20), [
  "八節日",
  "八節日（二至二分）",
]);
check("氣往亡：立秋(8/7)+9日(8/16)", d(2024, 8, 16), ["氣往亡"]);
check("氣往亡：白露(9/7)+18日(9/25)", d(2024, 9, 25), ["氣往亡"]);
check("氣往亡：白露+17日(9/24)は対象外", d(2024, 9, 24), []);
check("氣往亡：白露+19日(9/26)は対象外", d(2024, 9, 26), []);

// ---- 日付境界（子初23:00の日柱切替と混同していないことの確認） ----
// 同じ暦日（2024-02-03＝四絶）を hour=0:01 と hour=23:59 で問い合わせても
// 結果が変わらないこと（日柱の23:00切替の影響を受けていないこと）を確認する。
check("境界：四絶の日を0:01で問い合わせても同じ", d(2024, 2, 3, 0, 1), ["四絶", "土王用事"]);
check("境界：四絶の日を23:59で問い合わせても同じ", d(2024, 2, 3, 23, 59), ["四絶", "土王用事"]);
check("境界：立春当日を0:01で問い合わせても八節日（＋土用明け日の土王用事）", d(2024, 2, 4, 0, 1), ["八節日", "土王用事"]);
check("境界：立春当日を23:59で問い合わせても八節日（＋土用明け日の土王用事）", d(2024, 2, 4, 23, 59), ["八節日", "土王用事"]);

// ---- 土用の日単位区分と瞬間判定：土用入り・四立の時刻境界 ----
// 期待値の時刻は CalendarEngine と同じ太陽視黄経から求めたもの（分単位で照合）。
function jstMinute(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
}
function checkValue(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`);
  }
}
function statusOf(year: number, month: number, day: number) {
  const st = resolveDoyoDayStatus(d(year, month, day));
  const p = st.period;
  return { kind: st.kind, period: p ? { season: p.season, start: jstMinute(p.start), end: jstMinute(p.end), endTerm: p.endTerm } : null };
}

// 2026年秋土用: 土用入り 2026-10-20 18:13 JST（207°）、立冬 2026-11-07 18:52 JST（225°）。
const AUTUMN_2026 = { season: "秋", start: "2026-10-20 18:13", end: "2026-11-07 18:52", endTerm: "立冬" };
checkValue("日区分：2026-10-19 は土用外", statusOf(2026, 10, 19), { kind: "土用外", period: null });
checkValue("日区分：2026-10-20 は土用入り日（18:13から土用）", statusOf(2026, 10, 20), { kind: "土用入り日", period: AUTUMN_2026 });
checkValue("日区分：2026-10-21 は土用中", statusOf(2026, 10, 21), { kind: "土用中", period: AUTUMN_2026 });
checkValue("日区分：2026-10-23 は土用中", statusOf(2026, 10, 23), { kind: "土用中", period: AUTUMN_2026 });
checkValue("日区分：2026-10-24 は土用中", statusOf(2026, 10, 24), { kind: "土用中", period: AUTUMN_2026 });
checkValue("日区分：2026-11-06 は土用中", statusOf(2026, 11, 6), { kind: "土用中", period: AUTUMN_2026 });
checkValue("日区分：2026-11-07 は土用明け日（立冬18:52まで土用）", statusOf(2026, 11, 7), { kind: "土用明け日", period: AUTUMN_2026 });
checkValue("日区分：2026-11-08 は土用外", statusOf(2026, 11, 8), { kind: "土用外", period: null });

// 時刻を指定しない日単位の土王用事：その日の一部でも土用なら成立する。
check("土王用事：2026-10-20 土用入り日", d(2026, 10, 20), ["土王用事"]);
check("土王用事：2026-10-23", d(2026, 10, 23), ["土王用事"]);
check("土王用事：2026-10-24", d(2026, 10, 24), ["土王用事"]);
check("土王用事：2026-11-06（四絶と重なる）", d(2026, 11, 6), ["四絶", "土王用事"]);
// 11/07 は八節日（日単位の神殺）と土用明け日（18:52まで土用）の両方。八節日の日付処理には寄せない。
check("土王用事：2026-11-07 立冬日は八節日＋土王用事", d(2026, 11, 7), ["八節日", "土王用事"]);
// 入力の時刻は日単位判定に影響しない（立冬後の21:00で問い合わせても日単位では成立）。
check("土王用事：2026-11-07 を21:00で問い合わせても日単位では成立", d(2026, 11, 7, 21, 0), ["八節日", "土王用事"]);
check("土王用事：2026-11-08 は対象外", d(2026, 11, 8), []);

// 瞬間単位（時刻を指定する機能用）：境界は [土用入り, 四立)。
function atJst(iso: string): boolean {
  return (
    resolveDoyoAt({
      year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)),
      hour: Number(iso.slice(11, 13)), minute: Number(iso.slice(14, 16)), second: 0,
    }) !== null
  );
}
checkValue("瞬間：2026-10-20 09:00（午前）は土用外", atJst("2026-10-20T09:00"), false);
checkValue("瞬間：2026-10-20 18:12 は土用入り前", atJst("2026-10-20T18:12"), false);
checkValue("瞬間：2026-10-20 18:14 は土用中", atJst("2026-10-20T18:14"), true);
checkValue("瞬間：2026-10-21 12:00 は土用中", atJst("2026-10-21T12:00"), true);
checkValue("瞬間：2026-11-06 23:59 は土用中", atJst("2026-11-06T23:59"), true);
checkValue("瞬間：2026-11-07 09:00（立冬前）は土用中", atJst("2026-11-07T09:00"), true);
checkValue("瞬間：2026-11-07 18:51 は土用中", atJst("2026-11-07T18:51"), true);
checkValue("瞬間：2026-11-07 18:53（立冬後）は土用外", atJst("2026-11-07T18:53"), false);

// 旧「18日前」方式と1日ずれていた年（黄経基準の土用入り日が土用入り日になること）。
const SHIFTED: { label: string; before: [number, number, number]; first: [number, number, number]; start: string; end: string }[] = [
  { label: "2024夏", before: [2024, 7, 18], first: [2024, 7, 19], start: "2024-07-19 13:17", end: "2024-08-07 09:09" },
  { label: "2025冬", before: [2025, 1, 16], first: [2025, 1, 17], start: "2025-01-17 06:15", end: "2025-02-03 23:10" },
  { label: "2025夏", before: [2025, 7, 18], first: [2025, 7, 19], start: "2025-07-19 19:05", end: "2025-08-07 14:51" },
];
for (const c of SHIFTED) {
  checkValue(`${c.label}：土用入り前日は土用外`, statusOf(...c.before).kind, "土用外");
  const st = statusOf(...c.first);
  checkValue(`${c.label}：黄経基準の土用入り日`, { kind: st.kind, start: st.period?.start, end: st.period?.end }, { kind: "土用入り日", start: c.start, end: c.end });
}
// 2025冬は旧方式の土王用事日（2025-01-16）が土用入り前日だった。
check("2025冬：旧方式の土王用事日(1/16)は対象外", d(2025, 1, 16), []);

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
