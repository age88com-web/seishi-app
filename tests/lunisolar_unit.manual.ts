// tests/lunisolar_unit.manual.ts
//
// 目的:
//   src/lib/calendar/lunisolar.ts（農暦・太陰太陽暦）を、一次資料と照合する。
//
//   朔（新月）の瞬間: 国立天文台暦計算室「暦要項」2026年版
//     https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou263.html
//     （中央標準時 JST で記載。取得日: 2026-09-08）
//   農暦月・農暦日・閏月: 香港天文台 Gregorian-Lunar Calendar Conversion Table
//     https://www.hko.gov.hk/en/gts/time/calendar/text/files/T{year}e.txt
//     （2020・2023・2025・2026年版。取得日: 2026-09-08）
//
//   一次資料との不一致は、ロジックを勝手に合わせず「FAIL」として
//   そのまま報告する（本テストの目的そのものが不一致の検出）。
//
// 実行:
//   npx tsx tests/lunisolar_unit.manual.ts

import { calculate } from "../src/lib/calendar";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function checkClose(label: string, actualMs: number, expectedMs: number, toleranceMs: number) {
  const diff = Math.abs(actualMs - expectedMs);
  if (diff <= toleranceMs) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(
      `  [${label}] 差=${(diff / 60000).toFixed(1)}分 実測=${new Date(actualMs).toISOString()} 期待=${new Date(expectedMs).toISOString()}`,
    );
  }
}

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`);
  }
}

// ============================================================
// 1. 朔の瞬間: 国立天文台 暦要項2026 との照合（JST記載値→UTC変換）
// ============================================================
// JST（UTC+9固定、日本は夏時間なし）の年月日時分から UTC ミリ秒を作るヘルパ。
function jstToUtcMs(y: number, m: number, d: number, h: number, min: number): number {
  return Date.UTC(y, m - 1, d, h - 9, min);
}

const NAOJ_2026_NEW_MOONS: [number, number, number, number][] = [
  // [month, day, hour, minute] は JST。年は2026固定。
  [1, 19, 4, 52],
  [2, 17, 21, 1],
  [3, 19, 10, 23],
  [4, 17, 20, 52],
  [5, 17, 5, 1],
  [6, 15, 11, 54],
  [7, 14, 18, 44],
  [8, 13, 2, 37],
  [9, 11, 12, 27],
  [10, 11, 0, 50],
  [11, 9, 16, 2],
  [12, 9, 9, 52],
];

console.log("=== 1. 朔の瞬間（国立天文台 暦要項2026 との照合） ===");
for (const [m, d, h, min] of NAOJ_2026_NEW_MOONS) {
  const expectedMs = jstToUtcMs(2026, m, d, h, min);
  // 23:59 に問い合わせる（朔が同日夜遅くに発生する月もあるため、それより
  // 早い時刻だとその日の朔がまだ発生していない扱いになり、前月の朔が
  // 返って誤って FAIL してしまう。23:59 ならその日のうちのどの時刻の
  // 朔でも確実に過ぎている）。
  const r = calculate({ year: 2026, month: m, day: d, hour: 23, minute: 59, timezone: "Asia/Tokyo" });
  const actualMs = new Date(r.newMoonTime as string).getTime();
  checkClose(`朔 2026/${m}/${d}`, actualMs, expectedMs, 5 * 60_000); // 許容5分
}

// ============================================================
// 2. 農暦月・農暦日・閏月: 香港天文台 Conversion Table との照合
//    HKO の日付は香港時間（Asia/Hong_Kong, UTC+8）基準。
// ============================================================
interface HkoRow {
  year: number;
  month: number;
  day: number;
  lunarMonth: number;
  isLeap: boolean;
}

// 各月の「農暦1日」に相当する日（HKOテーブルより）。閏月は同じ月番号が
// 連続して現れる2回目のほう（isLeap: true）。
const HKO_ROWS: HkoRow[] = [
  // --- 2020年（閏四月：4月23日始まりの4月の次に、5月23日始まりのもう1つの4月＝閏四月） ---
  { year: 2020, month: 1, day: 25, lunarMonth: 1, isLeap: false },
  { year: 2020, month: 2, day: 23, lunarMonth: 2, isLeap: false },
  { year: 2020, month: 3, day: 24, lunarMonth: 3, isLeap: false },
  { year: 2020, month: 4, day: 23, lunarMonth: 4, isLeap: false },
  { year: 2020, month: 5, day: 23, lunarMonth: 4, isLeap: true },
  { year: 2020, month: 6, day: 21, lunarMonth: 5, isLeap: false },
  { year: 2020, month: 7, day: 21, lunarMonth: 6, isLeap: false },
  { year: 2020, month: 8, day: 19, lunarMonth: 7, isLeap: false },
  { year: 2020, month: 9, day: 17, lunarMonth: 8, isLeap: false },
  { year: 2020, month: 10, day: 17, lunarMonth: 9, isLeap: false },
  { year: 2020, month: 11, day: 15, lunarMonth: 10, isLeap: false },
  { year: 2020, month: 12, day: 15, lunarMonth: 11, isLeap: false },
  // --- 2023年（閏二月：2月20日始まりの2月の次に、3月22日始まりのもう1つの2月＝閏二月） ---
  { year: 2023, month: 1, day: 22, lunarMonth: 1, isLeap: false },
  { year: 2023, month: 2, day: 20, lunarMonth: 2, isLeap: false },
  { year: 2023, month: 3, day: 22, lunarMonth: 2, isLeap: true },
  { year: 2023, month: 4, day: 20, lunarMonth: 3, isLeap: false },
  { year: 2023, month: 5, day: 19, lunarMonth: 4, isLeap: false },
  { year: 2023, month: 6, day: 18, lunarMonth: 5, isLeap: false },
  { year: 2023, month: 7, day: 18, lunarMonth: 6, isLeap: false },
  { year: 2023, month: 8, day: 16, lunarMonth: 7, isLeap: false },
  { year: 2023, month: 9, day: 15, lunarMonth: 8, isLeap: false },
  { year: 2023, month: 10, day: 15, lunarMonth: 9, isLeap: false },
  { year: 2023, month: 11, day: 13, lunarMonth: 10, isLeap: false },
  { year: 2023, month: 12, day: 13, lunarMonth: 11, isLeap: false },
  // --- 2025年（閏六月：6月25日始まりの6月の次に、7月25日始まりのもう1つの6月＝閏六月） ---
  { year: 2025, month: 1, day: 29, lunarMonth: 1, isLeap: false },
  { year: 2025, month: 2, day: 28, lunarMonth: 2, isLeap: false },
  { year: 2025, month: 3, day: 29, lunarMonth: 3, isLeap: false },
  { year: 2025, month: 4, day: 28, lunarMonth: 4, isLeap: false },
  { year: 2025, month: 5, day: 27, lunarMonth: 5, isLeap: false },
  { year: 2025, month: 6, day: 25, lunarMonth: 6, isLeap: false },
  { year: 2025, month: 7, day: 25, lunarMonth: 6, isLeap: true },
  { year: 2025, month: 8, day: 23, lunarMonth: 7, isLeap: false },
  { year: 2025, month: 9, day: 22, lunarMonth: 8, isLeap: false },
  { year: 2025, month: 10, day: 21, lunarMonth: 9, isLeap: false },
  { year: 2025, month: 11, day: 20, lunarMonth: 10, isLeap: false },
  { year: 2025, month: 12, day: 20, lunarMonth: 11, isLeap: false },
  // --- 2026年（閏月なし） ---
  { year: 2026, month: 1, day: 19, lunarMonth: 12, isLeap: false },
  { year: 2026, month: 2, day: 17, lunarMonth: 1, isLeap: false },
  { year: 2026, month: 3, day: 19, lunarMonth: 2, isLeap: false },
  { year: 2026, month: 4, day: 17, lunarMonth: 3, isLeap: false },
  { year: 2026, month: 5, day: 17, lunarMonth: 4, isLeap: false },
  { year: 2026, month: 6, day: 15, lunarMonth: 5, isLeap: false },
  { year: 2026, month: 7, day: 14, lunarMonth: 6, isLeap: false },
  { year: 2026, month: 8, day: 13, lunarMonth: 7, isLeap: false },
  { year: 2026, month: 9, day: 11, lunarMonth: 8, isLeap: false },
  { year: 2026, month: 10, day: 10, lunarMonth: 9, isLeap: false },
  { year: 2026, month: 11, day: 9, lunarMonth: 10, isLeap: false },
  { year: 2026, month: 12, day: 9, lunarMonth: 11, isLeap: false },
];

console.log("\n=== 2. 農暦月・農暦日(=1)・閏月（香港天文台 換算表との照合） ===");
for (const row of HKO_ROWS) {
  // 23:59 に問い合わせる（理由は上記1.と同じ。HKOは日付のみで時刻を
  // 示さないため、その日のどの時刻の朔でも確実に過ぎている時刻を使う）。
  const r = calculate({
    year: row.year,
    month: row.month,
    day: row.day,
    hour: 23,
    minute: 59,
    timezone: "Asia/Hong_Kong",
  });
  const label = `${row.year}/${row.month}/${row.day}`;
  check(`${label} lunarMonth`, r.lunarMonth, row.lunarMonth);
  check(`${label} isLeapMonth`, r.isLeapMonth, row.isLeap);
  check(`${label} lunarDay`, r.lunarDay, 1);
}

console.log(`\n完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);
if (fail > 0) {
  console.log("\n--- 不一致明細（一次資料との差異。ロジックは変更せずそのまま報告） ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
