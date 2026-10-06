// tests/takujitsu_kyoushin_group3.manual.ts
//
// 目的:
//   擇日「日家凶神」第3グループ（月害・大煞・土符・歸忌・往亡・天賊・
//   九焦・大時・天吏・遊禍・九空）の11凶神を、docs/source/擇日実例.pdf の
//   吉凶神煞一覧表の【凶神】欄と全件照合する回帰テスト。
//   兵禁は実例PDFに一度も出現しないため tests/takujitsu_kyoushin_group3_unit.manual.ts
//   で別途検証する。
//
// 検証データ:
//   tests/fixtures/takujitsu_kyoushin_group3.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表・【凶神】欄）から機械的に
//      転記した「検証専用 fixture」。仕様ではない。生成手順は
//      tests/fixtures/gen_takujitsu_kyoushin_group3.py 参照。
//
// 既知の差異（推測でロジックを合わせず、切り分けて記録する）:
//   五月(午)辛卯: 往亡がこの1行だけ実例PDFに掲載されていない
//     （他の11ヶ月・全パターンでは往亡は完全一致）。
//   五月(午)戊寅: 歸忌がこの1行だけ実例PDFに掲載されていない
//     （「蹄忌」の異体字も含めて確認済み）。
//   二月(卯)丁巳・三月(辰)甲午: 大煞がこの2行だけ実例PDFで判読困難な
//     文字列（「大黒」「大敦州」等）になっており、大煞・大殺いずれの
//     表記としても確認できない。
//   いずれも同じ領域・同種の孤立した不整合であり（既存グループでも
//     複数回報告済みのパターン）、擇日テキストの表自体は座標抽出で
//     再確認済みのため、ロジックは変更せずそのまま除外して報告する。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group3.manual.ts
//
// 終了コード: 除外分を除く716行が全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKyoushinGroup3 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKyojin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kyoushin_group3.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

const EXCLUDED_MISMATCHES: Record<string, string> = {
  "午:辛卯": "往亡：擇日テキストp.25の表では午月の往亡は卯日だが、実例PDFのこの1行だけ往亡が欠落している（他11ヶ月・全パターンは完全一致する孤立した1行の差異）",
  "午:戊寅": "歸忌：擇日テキストp.25の表では午月（仲月）の歸忌は寅日だが、実例PDFのこの1行だけ歸忌（異体字「蹄忌」も含む）が欠落している（孤立した1行の差異）",
  "卯:丁巳": "大煞：擇日テキストp.24の表では卯月の大煞は巳日だが、実例PDFのこの1行は判読困難な文字列になっており大煞・大殺いずれの表記としても確認できない",
  "辰:甲午": "大煞：擇日テキストp.24の表では辰月の大煞は午日だが、実例PDFのこの1行は判読困難な文字列になっており大煞・大殺いずれの表記としても確認できない",
};

interface Mismatch {
  monthLabel: string;
  monthBranch: string;
  dayStem: string;
  dayBranch: string;
  expected: string;
  actual: string;
}

const mismatches: Mismatch[] = [];
const excluded: (Mismatch & { reason: string })[] = [];
let pass = 0;
let fail = 0;

for (const row of rows) {
  const result = resolveKyoushinGroup3({
    yearStem: "甲", // 第3グループはいずれも yearStem を使わない
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  const actual = result.kyojin.filter((n) => n !== "兵禁").sort();
  const expected = [...row.expectedKyojin].sort();

  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
    continue;
  }

  const key = `${row.monthBranch}:${row.dayStem}${row.dayBranch}`;
  const reason = EXCLUDED_MISMATCHES[key];
  const record: Mismatch = {
    monthLabel: row.monthLabel,
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  };

  if (reason) {
    excluded.push({ ...record, reason });
  } else {
    fail += 1;
    mismatches.push(record);
  }
}

console.log("[区分A] 実例PDF照合テスト（凶神第3グループ：月害・大煞・土符・歸忌・往亡・天賊・九焦・大時・天吏・遊禍・九空）");
console.log("検証データ: tests/fixtures/takujitsu_kyoushin_group3.json（擇日実例.pdf からの機械転記・検証専用）\n");

console.log(`完全一致（既知差異を除く）: ${pass} / ${rows.length - excluded.length}`);
console.log(`不一致（未診断・要調査）:   ${fail} / ${rows.length - excluded.length}`);
console.log(`既知の差異（除外・別枠報告）: ${excluded.length} 件`);

if (excluded.length > 0) {
  console.log("\n--- 既知の差異明細（対象日相当／期待凶神／実測凶神／理由）---");
  for (const e of excluded) {
    console.log(
      `  対象=${e.monthLabel}(monthBranch=${e.monthBranch}) ${e.dayStem}${e.dayBranch} | ` +
        `期待=${e.expected} | 実測=${e.actual} | 理由=${e.reason}`,
    );
  }
}

if (fail > 0) {
  console.log("\n--- 未診断の不一致明細（対象日相当／monthBranch(月令=月建)／dayStem・dayBranch(日令=日辰)／期待凶神／実測凶神）---");
  for (const m of mismatches) {
    console.log(
      `  対象=${m.monthLabel}(monthBranch=${m.monthBranch}) ${m.dayStem}${m.dayBranch} | ` +
        `期待=${m.expected} | 実測=${m.actual}`,
    );
  }
  console.log(`\n${fail} 件の未診断の不一致 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${rows.length - excluded.length} PASS（既知の差異 ${excluded.length} 件は別枠）`);
process.exit(0);
