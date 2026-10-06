// tests/takujitsu_kyoushin_group4_unit.manual.ts
//
// 目的:
//   擇日「日家凶神」第4グループのうち、docs/source/擇日実例.pdf に一度も
//   出現しない区分B（無禄）を、擇日テキスト.pdf p.28の表に基づく
//   ロジック単体テストとして検証する。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group4_unit.manual.ts

import { resolveKyoushinGroup4 } from "../src/lib/takujitsu";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
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

// docs/source/擇日テキスト.pdf p.28（PyMuPDF座標抽出で確認済み）
const WULU: Record<string, string> = {
  甲: "辰", 乙: "巳", 丙: "申", 丁: "亥", 戊: "戌",
  己: "丑", 庚: "辰", 辛: "巳", 壬: "申", 癸: "亥",
};

const DUMMY_MONTH_BRANCH = "辰"; // 無禄は monthBranch を使わないためダミーで十分
for (const dayStem of STEMS) {
  for (const dayBranch of BRANCHES) {
    const expected = WULU[dayStem] === dayBranch;
    const result = resolveKyoushinGroup4({ yearStem: "甲", monthBranch: DUMMY_MONTH_BRANCH, dayStem, dayBranch });
    check("無禄", result.kyojin.includes("無禄"), expected);
  }
}

console.log("[区分B] ロジック単体テスト（第4グループ：無禄）");
console.log("根拠: docs/source/擇日テキスト.pdf p.28（実例PDFに0件のため単体テストのみで検証）\n");
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
