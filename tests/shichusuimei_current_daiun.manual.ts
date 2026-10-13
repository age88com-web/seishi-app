// tests/shichusuimei_current_daiun.manual.ts
//
// 四柱推命 現在大運の判定（MeishikiParts の currentKazoeAge・currentDaiunIndex）の確認。
// 実行: npx tsx tests/shichusuimei_current_daiun.manual.ts
//
// 数え年の切替は立春（共通暦エンジン findSolarTermCrossing の太陽黄経315°の瞬間）。
// 立春の1分前と1分後で数え年が1つ変わること、それで現在大運が切り替わる境界を確認する。
// 大運の期間（ageFrom〜ageTo）は既存エンジンの値をそのまま使う。

import { calculateShichusuimei } from "../src/lib/shichusuimei";
import { findSolarTermCrossing } from "../src/lib/calendar";
import { currentDaiunIndex, currentKazoeAge } from "../src/app/shichusuimei/MeishikiParts";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : `  ${detail}`}`);
}

const MIN = 60_000;
const risshun = (year: number) => findSolarTermCrossing(new Date(Date.UTC(year, 2, 1)), 315);

// 1980-05-15 12:00 東京・男（順行・立運7歳: 7〜16, 17〜26, …, 47〜56, 57〜66 …）
const r = calculateShichusuimei({
  birth: { year: 1980, month: 5, day: 15, hour: 12, minute: 0 },
  place: { timeZone: "Asia/Tokyo", p22Name: "東京" },
  sex: "M",
});
const range = (i: number | null) => (i === null ? "なし" : `${r.daiun.periods[i].ageFrom}〜${r.daiun.periods[i].ageTo}`);
console.log(`立運${r.daiun.startAge}歳 大運: ${r.daiun.periods.map((p) => `${p.ageFrom}〜${p.ageTo}`).join(" ")}`);

for (const year of [2026, 2030, 2036]) {
  const t = risshun(year);
  const before = new Date(t.getTime() - MIN);
  const after = new Date(t.getTime() + MIN);
  const a0 = currentKazoeAge(r, before);
  const a1 = currentKazoeAge(r, after);
  console.log(`${year}年立春 ${t.toISOString()}  直前: 数え${a0}歳 ${range(currentDaiunIndex(r, before))}  直後: 数え${a1}歳 ${range(currentDaiunIndex(r, after))}`);
  check(`${year} 立春直前は前年扱い（${year}−1980）`, a0 === year - 1980, `got ${a0}`);
  check(`${year} 立春直後は ${year}−1980+1`, a1 === year - 1980 + 1, `got ${a1}`);
}

// 元日〜立春前は前年扱い（1月1日で切り替えない）
check("2026-01-01 は数え46歳（前年扱い）", currentKazoeAge(r, new Date(2026, 0, 1, 12)) === 46);

// 境界: 2026年立春で 数え46歳（37〜46）→ 47歳（47〜56）、2036年立春で 56歳（47〜56）→ 57歳（57〜66）
const t26 = risshun(2026);
check("2026 立春直前は 37〜46", range(currentDaiunIndex(r, new Date(t26.getTime() - MIN))) === "37〜46");
check("2026 立春直後は 47〜56", range(currentDaiunIndex(r, new Date(t26.getTime() + MIN))) === "47〜56");
const t36 = risshun(2036);
check("2036 立春直前は 47〜56", range(currentDaiunIndex(r, new Date(t36.getTime() - MIN))) === "47〜56");
check("2036 立春直後は 57〜66", range(currentDaiunIndex(r, new Date(t36.getTime() + MIN))) === "57〜66");

// 立春の日付が固定の2月4日でないこと（共通暦エンジンの節入り）
console.log(`立春(JST): ${[2021, 2025, 2026].map((y) => new Date(risshun(y).getTime() + 9 * 3600_000).toISOString().slice(0, 16)).join(" / ")}`);

console.log(`\n合計: PASS ${pass} / FAIL ${fail}`);
if (fail > 0) process.exit(1);
