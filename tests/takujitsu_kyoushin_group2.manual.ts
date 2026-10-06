// tests/takujitsu_kyoushin_group2.manual.ts
//
// 目的:
//   擇日「日家凶神」第2グループ（月破・劫殺・災殺・月殺・月刑）の5凶神を、
//   docs/source/擇日実例.pdf の吉凶神煞一覧表の【凶神】欄と全件照合する
//   回帰テスト。
//
// 検証データ:
//   tests/fixtures/takujitsu_kyoushin_group2.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表・【凶神】欄）から機械的に
//      転記した「検証専用 fixture」。仕様ではない。生成手順は
//      tests/fixtures/gen_takujitsu_kyoushin_group2.py 参照。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group2.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKyoushinGroup2 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKyojin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kyoushin_group2.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

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
  const result = resolveKyoushinGroup2({
    yearStem: "甲", // 第2グループはいずれも yearStem を使わない
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  const actual = [...result.kyojin].sort();
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

console.log("[区分A] 実例PDF照合テスト（凶神第2グループ：月破・劫殺・災殺・月殺・月刑）");
console.log("検証データ: tests/fixtures/takujitsu_kyoushin_group2.json（擇日実例.pdf からの機械転記・検証専用）\n");

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

console.log(`\n${pass} / ${rows.length} PASS`);
process.exit(0);
