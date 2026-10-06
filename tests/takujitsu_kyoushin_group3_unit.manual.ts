// tests/takujitsu_kyoushin_group3_unit.manual.ts
//
// 目的:
//   擇日「日家凶神」第3グループのうち、docs/source/擇日実例.pdf に一度も
//   出現しない区分B（兵禁）を、擇日テキスト.pdf p.24の表に基づく
//   ロジック単体テストとして検証する。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group3_unit.manual.ts

import { resolveKyoushinGroup3 } from "../src/lib/takujitsu";

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] 期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`);
  }
}

// docs/source/擇日テキスト.pdf p.24（PyMuPDF座標抽出で確認済み）
const BINGJIN: Record<string, string> = {
  寅: "寅", 卯: "子", 辰: "戌", 巳: "申", 午: "午", 未: "辰",
  申: "寅", 酉: "子", 戌: "戌", 亥: "申", 子: "午", 丑: "辰",
};

for (const monthBranch of BRANCHES) {
  for (const dayBranch of BRANCHES) {
    const expected = BINGJIN[monthBranch] === dayBranch;
    const result = resolveKyoushinGroup3({ yearStem: "甲", monthBranch, dayStem: "甲", dayBranch });
    check("兵禁", result.kyojin.includes("兵禁"), expected);
  }
}

console.log("[区分B] ロジック単体テスト（第3グループ：兵禁）");
console.log("根拠: docs/source/擇日テキスト.pdf p.24（実例PDFに0件のため単体テストのみで検証）\n");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
