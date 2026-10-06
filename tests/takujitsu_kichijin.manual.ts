// tests/takujitsu_kichijin.manual.ts
//
// 目的:
//   [区分A: 実例PDF照合テスト] 「月令（月建）＋日辰（日干支）」の組み合わせ
//   だけで決まる神殺（天徳・月徳・天徳合・月徳合・天赦）を、
//   docs/source/擇日実例.pdf の吉凶神煞一覧表と全件照合する回帰テスト。
//
//   年干・季節区分・方位など、月令＋日辰以外の条件を使う神殺（歳徳・歳徳合）
//   は、この一覧表に出ていないというだけの理由で不正解扱いにしない。
//   それらは対象外とし、tests/takujitsu_kichijin_unit.manual.ts
//   （区分B: ロジック単体テスト）で個別に検証する。
//
// 検証データ:
//   tests/fixtures/takujitsu_kichijin.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・変更には
//      使わない。生成手順は tests/fixtures/gen_takujitsu_kichijin.py 参照。
//
//   まだ未実装の吉神・凶神（天恩・月空以降）は比較対象から除外する
//   （resolveKichijin() の実測値から、区分Aの5神殺＋歳徳・歳徳合以外は
//   もともと出力されない。歳徳・歳徳合はこのテストでは常に比較対象外）。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。
//   不一致時は「対象日相当・yearStem/yearBranch・monthBranch（月令＝月建）・
//   dayStem/dayBranch（日令＝日辰）・期待神殺・実測神殺」を一覧表示する。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKichijin } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKichijin: string[];
  manuallyFixed?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kichijin.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

// 区分A（月令＋日辰だけで決まる神殺）のみを対象にする。
// 歳徳・歳徳合は年干を使うため区分Bであり、この実例PDF照合からは常に除外する
// （実例PDFに出ていないことを理由に不正解扱いしない）。
const CATEGORY_A = new Set(["天徳", "月徳", "天徳合", "月徳合", "天赦"]);

// 歳徳・歳徳合の判定には年干が要るが、区分Aだけに絞って比較するため
// どの年干を渡しても結果は変わらない。ダミー年干として便宜上 "甲" を渡す。
const DUMMY_YEAR_STEM = "甲";

interface Mismatch {
  monthLabel: string;
  yearStem: string;
  yearBranch: string;
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
  const result = resolveKichijin({
    yearStem: DUMMY_YEAR_STEM,
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  const actual = result.kichijin.filter((n) => CATEGORY_A.has(n)).sort();
  const expected = [...row.expectedKichijin].sort();

  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    mismatches.push({
      monthLabel: row.monthLabel,
      // この fixture（擇日実例.pdf 一覧表）は年非依存（歳徳・歳徳合が
      // 出現しないのと同じ理由）のため、対象日・yearStem/yearBranch に
      // 相当する具体値はもともと存在しない。ダミー年干とその旨を明記する。
      yearStem: `${DUMMY_YEAR_STEM}（この一覧表は年非依存のためダミー値）`,
      yearBranch: "N/A（この一覧表に年支は無い）",
      monthBranch: row.monthBranch,
      dayStem: row.dayStem,
      dayBranch: row.dayBranch,
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
    });
  }
}

console.log("[区分A] 実例PDF照合テスト（月令＋日辰だけで決まる神殺）");
console.log("検証データ: tests/fixtures/takujitsu_kichijin.json（擇日実例.pdf からの機械転記・検証専用）");
console.log("照合: 天徳 / 月徳 / 天徳合 / 月徳合 / 天赦\n");

console.log(`完全一致: ${pass} / ${rows.length}`);
console.log(`不一致:   ${fail} / ${rows.length}`);

if (fail > 0) {
  console.log("\n--- 不一致明細（対象日相当／yearStem・yearBranch／monthBranch(月令=月建)／dayStem・dayBranch(日令=日辰)／期待神殺／実測神殺）---");
  for (const m of mismatches) {
    console.log(
      `  対象=${m.monthLabel}(monthBranch=${m.monthBranch}) ${m.dayStem}${m.dayBranch} | ` +
        `yearStem=${m.yearStem} yearBranch=${m.yearBranch} | ` +
        `dayStem=${m.dayStem} dayBranch=${m.dayBranch} | ` +
        `期待=${m.expected} | 実測=${m.actual}`,
    );
  }
  console.log(`\n${fail} / ${rows.length} FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${rows.length} PASS`);
process.exit(0);
