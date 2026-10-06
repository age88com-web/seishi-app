// tests/takujitsu_kyoushin_group1.manual.ts
//
// 目的:
//   擇日「日家凶神」第1グループ（小時＝月建・死神・死気＝定日・血支＝閉日）
//   の4凶神を、docs/source/擇日実例.pdf の吉凶神煞一覧表の【凶神】欄と
//   全件照合する回帰テスト。
//
// 検証データ:
//   tests/fixtures/takujitsu_kyoushin_group1.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表・【凶神】欄）から機械的に
//      転記した「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・
//      変更には使わない。生成手順は
//      tests/fixtures/gen_takujitsu_kyoushin_group1.py 参照。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group1.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKyoushinGroup1 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKyojin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kyoushin_group1.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

/** fixture（gen_takujitsu_kyoushin_group1.py の TARGET_NAMES）が抽出している凶神。 */
const FIXTURE_TARGETS = ["小時", "死神", "死気", "血支"];

interface Mismatch {
  monthLabel: string;
  monthBranch: string;
  dayStem: string;
  dayBranch: string;
  expected: string;
  actual: string;
}

const mismatches: Mismatch[] = [];
let pass = 0;
let fail = 0;

for (const row of rows) {
  const result = resolveKyoushinGroup1({
    yearStem: "甲", // 第1グループはいずれも yearStem を使わない
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  // fixture が擇日実例.pdf から抽出しているのは小時・死神・死気・血支の4項目だけなので、
  // 実測もこの4項目に絞って照合する（天狗は fixture の対象外。下の別枠で本文と照合する）。
  const actual = result.kyojin.filter((n) => FIXTURE_TARGETS.includes(n)).sort();
  const expected = [...row.expectedKyojin].sort();

  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    mismatches.push({
      monthLabel: row.monthLabel,
      monthBranch: row.monthBranch,
      dayStem: row.dayStem,
      dayBranch: row.dayBranch,
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
    });
  }
}

console.log("[区分A] 実例PDF照合テスト（凶神第1グループ：小時・死神・死気・血支）");
console.log("検証データ: tests/fixtures/takujitsu_kyoushin_group1.json（擇日実例.pdf からの機械転記・検証専用）\n");

console.log(`完全一致: ${pass} / ${rows.length}`);
console.log(`不一致:   ${fail} / ${rows.length}`);

if (fail > 0) {
  console.log("\n--- 不一致明細（対象日相当／monthBranch(月令=月建)／dayStem・dayBranch(日令=日辰)／期待凶神／実測凶神）---");
  for (const m of mismatches) {
    console.log(
      `  対象=${m.monthLabel}(monthBranch=${m.monthBranch}) ${m.dayStem}${m.dayBranch} | ` +
        `期待=${m.expected} | 実測=${m.actual}`,
    );
  }
  console.log(`\n${fail} / ${rows.length} FAIL`);
  process.exit(1);
}

// ---- 天狗（満日）：擇日テキスト p.22 本文「戊の日の満日のみ」。擇日実例.pdf とは食い違う（別枠） ----
// 本文どおり、十二建除が満で日干が戊の日にだけ成立する。60干支×12月で6日。
// 擇日実例.pdf の【凶神】欄では天狗は申月の満日（甲戌・丙戌・戊戌・庚戌・壬戌）の5行にだけ現れ、
// 本文の規則と重なるのは申月戊戌の1行のみ（擇日テキスト優先。仕様差異として記録）。
const TENGU_EXPECTED = ["寅:戊辰", "辰:戊午", "午:戊申", "申:戊戌", "戌:戊子", "子:戊寅"];
const tenguActual: string[] = [];
for (const row of rows) {
  const r = resolveKyoushinGroup1({ yearStem: "甲", monthBranch: row.monthBranch, dayStem: row.dayStem, dayBranch: row.dayBranch });
  if (r.kyojin.includes("天狗")) tenguActual.push(`${row.monthBranch}:${row.dayStem}${row.dayBranch}`);
}
const tenguOk = JSON.stringify([...tenguActual].sort()) === JSON.stringify([...TENGU_EXPECTED].sort());
console.log(`\n[区分B] 天狗（本文 p.22「戊の日の満日のみ」）: ${tenguOk ? "一致" : "不一致"} 実測=${JSON.stringify(tenguActual)}`);
if (!tenguOk) {
  console.log(`\n天狗 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${rows.length} PASS`);
process.exit(0);
