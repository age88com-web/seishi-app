// tests/takujitsu_kichijin_group5.manual.ts
//
// 目的:
//   擇日「日家吉神」第5グループ（不將・吉期・天巫・福徳・時陰・天醫・
//   天喜・生氣・時陽）の9神殺を、docs/source/擇日実例.pdf の
//   吉凶神煞一覧表と全件照合する回帰テスト。
//
//   吉期・天巫・福徳・時陰・天醫・天喜・生氣・時陽は十二建除
//   （src/lib/takujitsu/jianchu.ts、既存実装。変更なし）の
//   除日・満日・定日・成日・開日と対応する。
//
// 検証データ:
//   tests/fixtures/takujitsu_kichijin_group5.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・変更には
//      使わない。生成手順は tests/fixtures/gen_takujitsu_kichijin_group5.py
//      参照。
//
// 既知の差異（推測でロジックを合わせず、切り分けて記録する）:
//   九月(戌)庚寅: 擇日テキストの十二建除の式（jianchu.ts）では
//   monthBranch=戌・dayBranch=寅 は「定」に当たり時陰が期待されるが、
//   実例PDFのこの1行だけ「時陰」が欠落し、代わりに「開」日の語である
//   「時陽」が印字されている（実例PDF内のこの1行だけの孤立した不整合。
//   第2〜4グループで既に報告済みの三月(辰)戊寅などと同種の事象）。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group5.manual.ts
//
// 終了コード: 除外分を除く719行が全一致なら 0、1件でも不一致なら 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKichijinGroup5 } from "../src/lib/takujitsu";

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKichijin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kichijin_group5.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

const CATEGORY_A = new Set([
  "不將", "吉期", "天巫", "福徳", "時陰", "天醫", "天喜", "生氣", "時陽",
]);

const EXCLUDED_MISMATCHES: Record<string, string> = {
  "戌:庚寅": "時陰と時陽：十二建除の式ではこの日は「定」で時陰が期待されるが、実例PDFのこの1行だけ時陰が欠落し「開」日の語である時陽が印字されている（孤立した1行の差異）",
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
  const result = resolveKichijinGroup5({
    yearStem: "甲", // 第5グループの区分A項目はいずれも yearStem を使わない
    monthBranch: row.monthBranch,
    dayStem: row.dayStem,
    dayBranch: row.dayBranch,
  });
  const actual = result.kichijin.filter((n) => CATEGORY_A.has(n)).sort();
  const expected = [...row.expectedKichijin].sort();

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

console.log("[区分A] 実例PDF照合テスト（第5グループ：不將・吉期・天巫・福徳・時陰・天醫・天喜・生氣・時陽）");
console.log("検証データ: tests/fixtures/takujitsu_kichijin_group5.json（擇日実例.pdf からの機械転記・検証専用）\n");

console.log(`完全一致（既知差異を除く）: ${pass} / ${rows.length - excluded.length}`);
console.log(`不一致（未診断・要調査）:   ${fail} / ${rows.length - excluded.length}`);
console.log(`既知の差異（除外・別枠報告）: ${excluded.length} 件`);

if (excluded.length > 0) {
  console.log("\n--- 既知の差異明細（対象日相当／期待神殺／実測神殺／理由）---");
  for (const e of excluded) {
    console.log(
      `  対象=${e.monthLabel}(monthBranch=${e.monthBranch}) ${e.dayStem}${e.dayBranch} | ` +
        `期待=${e.expected} | 実測=${e.actual} | 理由=${e.reason}`,
    );
  }
}

if (fail > 0) {
  console.log("\n--- 未診断の不一致明細（対象日相当／monthBranch(月令=月建)／dayStem・dayBranch(日令=日辰)／期待神殺／実測神殺）---");
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
