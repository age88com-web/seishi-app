// tests/takujitsu_kichijin_group5_unit.manual.ts
//
// 目的:
//   擇日「日家吉神」第5グループのうち、docs/source/擇日実例.pdf に一度も
//   出現しない区分B（枝德・兵吉・大明）を、擇日テキスト.pdf
//   p.17-18の表・記述に基づくロジック単体テストとして検証する。
//
//   枝德は十二建除の執日（jianchu.ts、既存実装。変更なし）。
//   兵吉は月令ごとの固定4地支列挙（p.17）。
//   大明は月令に関係ない固定日干支列挙（p.18）。神在・七聖は監修判断により不採用
//   （2026-10-06。excludedShinsatsu.ts）のため、成立しないことだけを確認する。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group5_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { resolveKichijinGroup5 } from "../src/lib/takujitsu";
import { resolveJianchu } from "../src/lib/takujitsu/jianchu";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI60: string[] = [];
for (let i = 0; i < 60; i++) GANZHI60.push(STEMS[i % 10] + BRANCHES[i % 12]);

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, actualHas: boolean, expectedHas: boolean, context: string) {
  if (actualHas === expectedHas) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${label}] ${context}: 期待=${expectedHas} 実測=${actualHas}`);
  }
}

// ── 枝德（p.17）：十二建除の執日。全12月支×60干支を網羅的に確認 ──
for (const monthBranch of BRANCHES) {
  for (const ganzhi of GANZHI60) {
    const dayStem = ganzhi[0];
    const dayBranch = ganzhi[1];
    const isZhiRi = resolveJianchu({ monthBranch, dayBranch }).name === "執";
    const result = resolveKichijinGroup5({ yearStem: "甲", monthBranch, dayStem, dayBranch });
    check("枝德", result.kichijin.includes("枝德"), isZhiRi, `monthBranch=${monthBranch} 日干支=${ganzhi}`);
  }
}

// ── 兵吉（p.17）：月令ごとの固定4地支列挙。全12月支×12地支を網羅的に確認 ──
const BINGJI: Record<string, string[]> = {
  寅: ["子", "丑", "寅", "卯"],
  卯: ["亥", "子", "丑", "寅"],
  辰: ["戌", "亥", "子", "丑"],
  巳: ["酉", "戌", "亥", "子"],
  午: ["申", "酉", "戌", "亥"],
  未: ["未", "申", "酉", "戌"],
  申: ["午", "未", "申", "酉"],
  酉: ["巳", "午", "未", "申"],
  戌: ["辰", "巳", "午", "未"],
  亥: ["卯", "辰", "巳", "午"],
  子: ["寅", "卯", "辰", "巳"],
  丑: ["丑", "寅", "卯", "辰"],
};
for (const monthBranch of BRANCHES) {
  for (const dayBranch of BRANCHES) {
    const expected = BINGJI[monthBranch].includes(dayBranch);
    const result = resolveKichijinGroup5({ yearStem: "甲", monthBranch, dayStem: "甲", dayBranch });
    check("兵吉", result.kichijin.includes("兵吉"), expected, `monthBranch=${monthBranch} dayBranch=${dayBranch}`);
  }
}

// ── 大明（p.18）：月令に関係ない固定日干支列挙。60干支すべてを確認 ──
// 神在・七聖（同じ p.18）は監修判断により不採用のため、どの干支でも出力されないことを確認する。
const DAMING = new Set([
  "辛未", "壬申", "癸酉", "己卯", "壬午", "甲申", "壬寅", "甲辰", "丙午", "己酉", "庚戌", "丙辰", "己未", "庚申", "辛酉",
]);

const DUMMY_MONTH_BRANCH = "辰"; // 大明は monthBranch を使わないためダミーで十分
for (const ganzhi of GANZHI60) {
  const dayStem = ganzhi[0];
  const dayBranch = ganzhi[1];
  const result = resolveKichijinGroup5({ yearStem: "甲", monthBranch: DUMMY_MONTH_BRANCH, dayStem, dayBranch });
  check("大明", result.kichijin.includes("大明"), DAMING.has(ganzhi), `日干支=${ganzhi}`);
  check("神在（不採用）", result.kichijin.includes("神在"), false, `日干支=${ganzhi}`);
  check("七聖（不採用）", result.kichijin.includes("七聖"), false, `日干支=${ganzhi}`);
}

check("DAMING.size", DAMING.size === 15, true, "p.18の原文どおり15件");

console.log("[区分B] ロジック単体テスト（第5グループ：枝德・兵吉・大明。神在・七聖は不採用）");
console.log("根拠: docs/source/擇日テキスト.pdf p.17-18（実例PDFに0件のため単体テストのみで検証）\n");
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
