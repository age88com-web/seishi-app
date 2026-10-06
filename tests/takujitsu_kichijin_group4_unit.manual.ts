// tests/takujitsu_kichijin_group4_unit.manual.ts
//
// 目的:
//   擇日「日家吉神」第4グループのうち、docs/source/擇日実例.pdf に一度も
//   出現しない区分B（天瑞・天福・天貴・催官）を、擇日テキスト.pdf p.18の
//   表・記述に基づくロジック単体テストとして全件検証する。
//
//   天瑞・天福は固定日干支列挙（monthBranch を使わない）。
//   天貴・催官は季節区分（monthBranch→季節）＋dayStem で決まる。
//   いずれも実例PDFの一覧表と照合できないため、区分Aの回帰テスト
//   （tests/takujitsu_kichijin_group4.manual.ts）とは別に、表の値を
//   そのまま網羅的に確認する。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group4_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { resolveKichijinGroup4 } from "../src/lib/takujitsu";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI60: string[] = [];
for (let i = 0; i < 60; i++) {
  GANZHI60.push(STEMS[i % 10] + BRANCHES[i % 12]);
}

const DUMMY_MONTH_BRANCH = "辰"; // 天瑞・天福は monthBranch を使わないためダミーで十分

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

// ── 天瑞・天福（p.18）：固定日干支列挙。60干支すべてを網羅的に確認 ──
const TIANRUI_GANZHI = ["戊寅", "己卯", "庚寅", "辛巳", "壬子"];
const TIANFU_GANZHI = ["乙巳", "己巳", "己亥", "庚子", "庚寅", "辛丑", "辛卯", "壬辰", "癸巳"];

for (const ganzhi of GANZHI60) {
  const dayStem = ganzhi[0];
  const dayBranch = ganzhi[1];
  const result = resolveKichijinGroup4({
    yearStem: "甲",
    monthBranch: DUMMY_MONTH_BRANCH,
    dayStem,
    dayBranch,
  });
  check("天瑞", result.kichijin.includes("天瑞"), TIANRUI_GANZHI.includes(ganzhi), `日干支=${ganzhi}`);
  check("天福", result.kichijin.includes("天福"), TIANFU_GANZHI.includes(ganzhi), `日干支=${ganzhi}`);
}

// ── 天貴・催官（p.18）：季節（monthBranch）×天干。全12月支×10天干を網羅的に確認 ──
// 春(寅卯辰)‥天貴(甲) 催官(乙) / 夏(巳午未)‥天貴(丙丁) 催官(丁) /
// 秋(申酉戌)‥天貴(庚辛) 催官(辛) / 冬(亥子丑)‥天貴(壬癸) 催官(癸)
const SEASON_MONTH_BRANCHES: Record<string, string[]> = {
  春: ["寅", "卯", "辰"],
  夏: ["巳", "午", "未"],
  秋: ["申", "酉", "戌"],
  冬: ["亥", "子", "丑"],
};
const TIANGUI_BY_SEASON: Record<string, string[]> = { 春: ["甲"], 夏: ["丙", "丁"], 秋: ["庚", "辛"], 冬: ["壬", "癸"] };
const CUIGUAN_BY_SEASON: Record<string, string> = { 春: "乙", 夏: "丁", 秋: "辛", 冬: "癸" };

for (const [season, monthBranches] of Object.entries(SEASON_MONTH_BRANCHES)) {
  for (const monthBranch of monthBranches) {
    for (const dayStem of STEMS) {
      const result = resolveKichijinGroup4({
        yearStem: "甲",
        monthBranch,
        dayStem,
        dayBranch: "子", // 天貴・催官は dayBranch を使わないためダミーで十分
      });
      check(
        "天貴",
        result.kichijin.includes("天貴"),
        TIANGUI_BY_SEASON[season].includes(dayStem),
        `季節=${season} monthBranch=${monthBranch} 日干=${dayStem}`,
      );
      check(
        "催官",
        result.kichijin.includes("催官"),
        CUIGUAN_BY_SEASON[season] === dayStem,
        `季節=${season} monthBranch=${monthBranch} 日干=${dayStem}`,
      );
    }
  }
}

console.log("[区分B] ロジック単体テスト（第4グループ：天瑞・天福・天貴・催官）");
console.log("根拠: docs/source/擇日テキスト.pdf p.18（実例PDFに0件のため単体テストのみで検証）\n");
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
