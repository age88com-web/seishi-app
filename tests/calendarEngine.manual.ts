// tests/calendarEngine.manual.ts
//
// CalendarEngine.calculate() の手動確認スクリプト。
// 実行: npx tsx tests/calendarEngine.manual.ts
//
// テスト用フレームワーク未導入のため、簡易 assert で検証する。

import { calculate } from "../src/lib/calendar";

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}: ${String(actual)}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: got ${String(actual)}, want ${String(expected)}`);
  }
}

// --- ケース1: 1984-02-02 12:00 JST（既存 eto.ts のアンカー日 = 日干支 丙寅）---
{
  console.log("case1: 1984-02-02 12:00 JST");
  const r = calculate({
    year: 1984, month: 2, day: 2, hour: 12, minute: 0, timezone: "Asia/Tokyo",
  });
  console.log(JSON.stringify(r, null, 2));
  check("dayStem", r.dayStem, "丙");
  check("dayBranch", r.dayBranch, "寅");
  // 2/2 は立春（2/4頃）前のため、年干支は前年 1983 = 癸亥。
  check("yearStem", r.yearStem, "癸");
  check("yearBranch", r.yearBranch, "亥");
  check("utc", r.utc, "1984-02-02T03:00:00.000Z");
}

// --- ケース1b: 1984-02-10 12:00 JST（立春後 = 甲子年）---
{
  console.log("case1b: 1984-02-10 12:00 JST（立春後）");
  const r = calculate({
    year: 1984, month: 2, day: 10, hour: 12, minute: 0, timezone: "Asia/Tokyo",
  });
  check("yearStem", r.yearStem, "甲");
  check("yearBranch", r.yearBranch, "子");
  check("solarTerm", r.solarTerm, "立春");
}

// --- ケース2: timezone 省略時は Asia/Tokyo ---
{
  console.log("case2: timezone 省略 == Asia/Tokyo");
  const a = calculate({ year: 2026, month: 8, day: 29, hour: 9, minute: 0 });
  const b = calculate({ year: 2026, month: 8, day: 29, hour: 9, minute: 0, timezone: "Asia/Tokyo" });
  check("utc 一致", a.utc, b.utc);
  check("solarTerm 一致", a.solarTerm, b.solarTerm);
}

// --- ケース3: 出力フィールドの存在と型 ---
{
  console.log("case3: 出力フィールド");
  const r = calculate({ year: 2000, month: 1, day: 1, hour: 0, minute: 0, timezone: "UTC" });
  console.log(JSON.stringify(r, null, 2));
  check("julianDay ~ 2451544.5", Math.abs(r.julianDay - 2451544.5) < 1e-6, true);
  check("deltaT is number", typeof r.deltaT, "number");
  check("sunLongitude 範囲", r.sunLongitude >= 0 && r.sunLongitude < 360, true);
  check("solarTermDateTime is ISO", /Z$/.test(r.solarTermDateTime), true);
}

// --- 節入り時刻（太陽の視黄経。2026-10-06 修正前は幾何学的黄経で一律約8.3分早かった）---
{
  console.log("節入り時刻（視黄経）");
  const jst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  const at = (y: number, m: number, d: number, h: number, mi: number) =>
    calculate({ year: y, month: m, day: d, hour: h, minute: mi, timezone: "Asia/Tokyo" });
  // 公表値（UTC）: 2024 春分 3/20 03:06・夏至 6/20 20:51・秋分 9/22 12:44・冬至 12/21 09:20
  check("2024 春分", jst(at(2024, 3, 21, 0, 0).solarTermDateTime), "2024-03-20 12:06");
  check("2024 夏至", jst(at(2024, 6, 22, 0, 0).solarTermDateTime), "2024-06-21 05:50");
  check("2024 秋分", jst(at(2024, 9, 23, 0, 0).solarTermDateTime), "2024-09-22 21:43");
  check("2024 冬至", jst(at(2024, 12, 22, 0, 0).solarTermDateTime), "2024-12-21 18:20");
  // 2025 立春は 2/3 23:10 JST。節入りの前後で年・月干支が切り替わる
  check("2025 立春", jst(at(2025, 2, 4, 12, 0).solarTermDateTime), "2025-02-03 23:10");
  const b = at(2025, 2, 3, 23, 5), a = at(2025, 2, 3, 23, 12);
  check("2025-02-03 23:05 年月", `${b.yearStem}${b.yearBranch}${b.monthStem}${b.monthBranch}`, "甲辰丁丑");
  check("2025-02-03 23:12 年月", `${a.yearStem}${a.yearBranch}${a.monthStem}${a.monthBranch}`, "乙巳戊寅");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
