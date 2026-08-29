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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
