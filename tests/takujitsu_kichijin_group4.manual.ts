// tests/takujitsu_kichijin_group4.manual.ts
//
// 目的:
//   擇日「日家吉神」のうち第1〜3グループ未実装だった残りの神殺（第4
//   グループ）について、docs/source/擇日実例.pdf の吉凶神煞一覧表に
//   出現するもの（区分A）を全件照合する回帰テスト。
//
//   対象: 月恩・寶日・義日・専日・要安・玉宇・金堂・啓安・普護・福生・
//   聖心・益後・續世・五富・天倉・陽徳・陰徳・六儀・驛馬・天馬・青龍・
//   明堂・金匱・寶光・玉堂・司命・解神・臨日・兵福
//
//   天瑞・天福・天貴・催官は実例PDFに一度も出現しないため区分Bとし、
//   tests/takujitsu_kichijin_group4_unit.manual.ts で個別に検証する。
//
// 検証データ:
//   tests/fixtures/takujitsu_kichijin_group4.json
//   ── docs/source/擇日実例.pdf（吉凶神煞一覧表）から機械的に転記した
//      「検証専用 fixture」。仕様ではない。擇日ロジックの逆算・変更には
//      使わない。生成手順は tests/fixtures/gen_takujitsu_kichijin_group4.py
//      参照（寶日/義日/専日は【吉神】欄ではなく各行冒頭の分類文字
//      「義/伐/専/寶/制」から判定。フォントの文字化けにより分類文字が
//      抽出できない行が27件あり、それらの行は寶日/義日/専日の比較対象
//      から自然に除外される）。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group4.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。
//   不一致時は「対象日相当・monthBranch（月令=月建）・dayStem/dayBranch
//   （日令=日辰）・期待神殺・実測神殺」を一覧表示する。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveKichijinGroup4 } from "../src/lib/takujitsu";

// 既知の差異として切り分け済みの行（擇日テキストp.9-10/11/13-15の表・原本画像で
// 確認済み。いずれも擇日実例.pdf側のこの1行だけの孤立した事象で、同じ
// monthBranch・dayBranchを共有する他の日干支では期待どおり一致している）。
// monthBranch:干支 をキーにする。
const EXCLUDED_MISMATCHES: Record<string, string> = {
  "卯:壬戌": "金匱と金堂：擇日テキストp.11の金堂表では卯月の金堂は戌（甲戌・丙戌・戊戌・庚戌は実際に金堂で一致）だが、実例PDFのこの1行（壬戌）だけ原本画像で「金匱」と印字されている（文字化けではなく実際の印字を確認済み）。同じ戌日の他4干支と異なる孤立した1行の差異。",
  "辰:甲申": "六儀と金匱：擇日テキストp.14の六儀表では辰月の六儀は寅（丙寅・戊寅・庚寅・壬寅・甲寅は一致）、p.15の金匱表では辰月の金匱は申（他の申日と一致するはず）だが、実例PDFのこの1行（甲申）だけ「六儀」が掲載され「金匱」が欠落している。同じ辰月内で王日欠落・三合掲載などの既知の不整合（第2・第3グループで報告済み）と同じ領域の孤立した事象。",
  "酉:甲申": "天馬：擇日テキストp.15の天馬表では酉月の天馬は申（壬申・丙申・戊申・庚申は実際に天馬で一致）だが、実例PDFのこの1行（甲申）だけ天馬が欠落している。同じ申日の他4干支と異なる孤立した1行の差異。",
};

interface FixtureRow {
  monthLabel: string;
  monthBranch: string;
  ganzhi: string;
  dayStem: string;
  dayBranch: string;
  expectedKichijin: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "takujitsu_kichijin_group4.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  _meta: unknown;
  rows: FixtureRow[];
};
const rows = fixture.rows;

// この fixture は区分Aの29神殺（月恩〜兵福）だけを対象とする。
// 天瑞・天福・天貴・催官（区分B）はこの fixture・比較対象には含まれない。
const CATEGORY_A = new Set([
  "月恩", "寶日", "義日", "専日",
  "要安", "玉宇", "金堂", "啓安", "普護", "福生", "聖心", "益後", "續世",
  "五富", "天倉", "陽徳", "陰徳", "六儀", "驛馬", "天馬",
  "青龍", "明堂", "金匱", "寶光", "玉堂", "司命", "解神", "臨日", "兵福",
]);

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
  const result = resolveKichijinGroup4({
    yearStem: "甲", // 第4グループの区分A項目はいずれも yearStem を使わない
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

console.log("[区分A] 実例PDF照合テスト（第4グループ：月恩〜兵福の29神殺）");
console.log("検証データ: tests/fixtures/takujitsu_kichijin_group4.json（擇日実例.pdf からの機械転記・検証専用）\n");

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
