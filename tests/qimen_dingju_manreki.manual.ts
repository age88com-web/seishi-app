// tests/qimen_dingju_manreki.manual.ts
//
// 目的:
//   奇門遁甲「定局」（src/lib/qimen/dingju.ts）が、天文学的な節入り瞬間ではなく
//   符頭の15日連続系列＋二至（冬至・夏至）の置閏判定で「今有効な節気パターン」を
//   決めていること、およびその結果が奇門遁甲万年暦.xlsx（2018〜2020年）の
//   実データと一致することを固定する回帰テスト。
//
// 検証データ:
//   tests/fixtures/qimen_dingju_manreki.json
//   ── docs/source/奇門遁甲万年暦.xlsx から機械的に転記した「検証専用 fixture」。
//      仕様ではない。production コード（dingju.ts）は Excel を実行時に一切
//      参照しない（Excel非依存）。生成手順は tests/fixtures/gen_qimen_dingju.py
//      と qimen_dingju_manreki.json の _meta を参照。
//
// 構成:
//   1. REPRESENTATIVE_CASES … 2018年大雪の置閏3日間・冬至上元開始・
//      Excel一致の代表5日・PDF優先で確定した2018-11-23 の、固定の明示アサーション。
//   2. fixture 全件（245件）の一括回帰（dun・ju の一致のみを見る。
//      fixture は label から dun・ju しか読み取れないため）。
//
// 実行:
//   npx tsx tests/qimen_dingju_manreki.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveDingju } from "../src/lib/qimen/dingju";
import type { Stem, Branch } from "../src/lib/eto";

const here = dirname(fileURLToPath(import.meta.url));

let failures = 0;

// ---------------------------------------------------------------------------
// 1. 代表テスト（固定アサーション）
// ---------------------------------------------------------------------------

interface RepresentativeCase {
  label: string;
  year: number;
  month: number;
  day: number;
  dayStem: Stem;
  dayBranch: Branch;
  expected: {
    dun: "陽遁" | "陰遁";
    ju: number;
    effectiveTerm: string;
    isLeapRepeat: boolean;
  };
}

const REPRESENTATIVE_CASES: RepresentativeCase[] = [
  {
    label: "2018-12-13 大雪置閏開始（陰4・上元）",
    year: 2018, month: 12, day: 13, dayStem: "己", dayBranch: "卯",
    expected: { dun: "陰遁", ju: 4, effectiveTerm: "大雪", isLeapRepeat: true },
  },
  {
    label: "2018-12-18 大雪置閏中元（陰7）",
    year: 2018, month: 12, day: 18, dayStem: "甲", dayBranch: "申",
    expected: { dun: "陰遁", ju: 7, effectiveTerm: "大雪", isLeapRepeat: true },
  },
  {
    label: "2018-12-23 大雪置閏下元（陰1）",
    year: 2018, month: 12, day: 23, dayStem: "己", dayBranch: "丑",
    expected: { dun: "陰遁", ju: 1, effectiveTerm: "大雪", isLeapRepeat: true },
  },
  {
    label: "2018-12-28 冬至上元開始（陽1）",
    year: 2018, month: 12, day: 28, dayStem: "甲", dayBranch: "午",
    expected: { dun: "陽遁", ju: 1, effectiveTerm: "冬至", isLeapRepeat: false },
  },
  {
    // dayStem/dayBranch は既存（変更していない）CalendarEngine.calculate() の実出力。
    // 期待値は results.json（奇門遁甲万年暦.xlsx 監査済みの節気境界データ）に基づき、
    // 「この日はどのブロックに属するか」を ganzhiIndex の差から手計算で独立検算済み
    // （このファイル自体のコメントで検算は再現しない。監査レポート参照）。
    label: "2019-01-06 Excel万年暦と一致（小寒節入り当日・冬至上元の継続中）",
    year: 2019, month: 1, day: 6, dayStem: "癸", dayBranch: "卯",
    expected: { dun: "陽遁", ju: 7, effectiveTerm: "冬至", isLeapRepeat: false },
  },
  {
    label: "2019-02-04 Excel万年暦と一致（立春節入り当日・大寒上元の継続中）",
    year: 2019, month: 2, day: 4, dayStem: "壬", dayBranch: "申",
    expected: { dun: "陽遁", ju: 9, effectiveTerm: "大寒", isLeapRepeat: false },
  },
  {
    label: "2019-06-22 Excel万年暦と一致（夏至節入り当日・芒種上元の継続中）",
    year: 2019, month: 6, day: 22, dayStem: "庚", dayBranch: "寅",
    expected: { dun: "陽遁", ju: 9, effectiveTerm: "芒種", isLeapRepeat: false },
  },
  {
    label: "2019-09-08 Excel万年暦と一致（白露節入り当日・処暑上元の継続中）",
    year: 2019, month: 9, day: 8, dayStem: "戊", dayBranch: "申",
    expected: { dun: "陰遁", ju: 7, effectiveTerm: "処暑", isLeapRepeat: false },
  },
  {
    label: "2020-02-04 Excel万年暦と一致（立春節入り当日・大寒上元の継続中）",
    year: 2020, month: 2, day: 4, dayStem: "丁", dayBranch: "丑",
    expected: { dun: "陽遁", ju: 6, effectiveTerm: "大寒", isLeapRepeat: false },
  },
  {
    label: "2018-11-23 局数.pdf優先（Excel記載の陰3ではなく陰2が正）",
    year: 2018, month: 11, day: 23, dayStem: "己", dayBranch: "未",
    expected: { dun: "陰遁", ju: 2, effectiveTerm: "小雪", isLeapRepeat: false },
  },
];

console.log("=== 代表テスト（固定アサーション） ===\n");
for (const c of REPRESENTATIVE_CASES) {
  const result = resolveDingju({
    localYear: c.year, localMonth: c.month, localDay: c.day, localHour: 12,
    dayStem: c.dayStem, dayBranch: c.dayBranch,
  });
  const ok =
    result.dun === c.expected.dun &&
    result.ju === c.expected.ju &&
    result.effectiveTerm === c.expected.effectiveTerm &&
    result.isLeapRepeat === c.expected.isLeapRepeat;
  if (ok) {
    console.log(`PASS  ${c.label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${c.label}`);
    console.log(`      expected: ${JSON.stringify(c.expected)}`);
    console.log(`      actual:   dun=${result.dun} ju=${result.ju} effectiveTerm=${result.effectiveTerm} isLeapRepeat=${result.isLeapRepeat}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Excel全件回帰（dun・ju の一致のみ）
// ---------------------------------------------------------------------------

interface FixtureRow {
  year: number;
  month: number;
  day: number;
  dayStem: string;
  dayBranch: string;
  expectedDun: "陽遁" | "陰遁";
  expectedJu: number;
  leap: boolean;
  note?: string;
}

const fixturePath = join(here, "fixtures", "qimen_dingju_manreki.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};

console.log(`\n=== Excel全件回帰（検証可能 ${fixture.rows.length} 件） ===\n`);

let match = 0;
const mismatches: Array<{ row: FixtureRow; actualDun: string; actualJu: number }> = [];

for (const row of fixture.rows) {
  const result = resolveDingju({
    localYear: row.year, localMonth: row.month, localDay: row.day, localHour: 12,
    dayStem: row.dayStem as Stem, dayBranch: row.dayBranch as Branch,
  });
  if (result.dun === row.expectedDun && result.ju === row.expectedJu) {
    match += 1;
  } else {
    mismatches.push({ row, actualDun: result.dun, actualJu: result.ju });
  }
}

console.log(`検証可能件数: ${fixture.rows.length}`);
console.log(`一致件数:     ${match}`);
console.log(`不一致件数:   ${mismatches.length}`);
console.log(`一致率:       ${(match / fixture.rows.length * 100).toFixed(2)}%`);

if (mismatches.length > 0) {
  console.log("\n--- 不一致 ---");
  for (const m of mismatches) {
    console.log(
      `${m.row.year}-${String(m.row.month).padStart(2, "0")}-${String(m.row.day).padStart(2, "0")} ` +
      `(${m.row.dayStem}${m.row.dayBranch}) expected=${m.row.expectedDun}${m.row.expectedJu} actual=${m.actualDun}${m.actualJu}`,
    );
  }
  failures += mismatches.length;
}

console.log("\n=== 結果 ===");
if (failures === 0) {
  console.log("ALL PASS");
  process.exit(0);
} else {
  console.log(`FAIL: ${failures} 件の不一致`);
  process.exit(1);
}
