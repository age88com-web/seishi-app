// tests/takujitsu_kichijin_group6_unit.manual.ts
//
// 目的:
//   擇日「日家吉神」のうち農暦月番号（lunarMonth）が必要なため保留していた
//   天願・季分（第6グループ）のロジック単体テスト。
//
//   擇日実例.pdf は月令（月建＝節月）で構成された一覧表であり、農暦月
//   （朔・中気ベース）とは別の暦であるため照合対象にできない
//   （区分B・実例PDFに0件）。docs/source/擇日テキスト.pdf p.7・p.20の
//   表そのものを検算データとして使う。
//
//   最重要の確認事項: 判定キーが CalendarResult.lunarMonth（農暦月）で
//   あり、monthBranch（月令＝月建）ではないこと。monthBranch と lunarMonth が
//   食い違うケースをあえて作り、lunarMonth 側に従うことを確認する。
//
// 実行:
//   npx tsx tests/takujitsu_kichijin_group6_unit.manual.ts

import { resolveKichijinGroup6 } from "../src/lib/takujitsu/shinsatsu/kichijinGroup6";

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

// docs/source/擇日テキスト.pdf p.7・p.20（PyMuPDF座標抽出で確認済み）
const TIANYUAN: Record<number, string> = {
  1: "甲午", 2: "甲戌", 3: "乙酉", 4: "丙子", 5: "丁丑", 6: "戊午",
  7: "甲寅", 8: "丙辰", 9: "辛卯", 10: "戊辰", 11: "甲子", 12: "癸未",
};
const JIFEN: Record<number, string[]> = {
  1: ["壬午", "戊子", "丙午", "壬子", "辛未", "己未", "乙卯", "癸卯"],
  2: ["戊寅", "乙未", "癸丑"],
  3: ["戊子", "壬寅", "甲寅", "丁卯", "己卯", "庚午"],
  4: ["乙卯", "己卯", "丁卯", "辛卯", "癸卯"],
  5: ["乙丑", "丁丑", "己丑", "辛丑", "癸丑"],
  6: ["己卯", "戊寅", "庚辰", "己未"],
  7: ["丙子", "壬子", "丙辰", "己未"],
  8: ["乙丑", "丁丑", "己丑", "癸丑", "己巳"],
  9: ["己卯", "己巳", "丙午", "己未"],
  10: ["丁卯", "辛未", "戊辰", "丁未", "乙卯"],
  11: ["戊辰", "甲辰", "丙辰"],
  12: ["戊寅", "壬寅", "甲寅", "戊辰", "己巳", "癸巳", "乙巳"],
};

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI60: string[] = [];
for (let i = 0; i < 60; i++) GANZHI60.push(STEMS[i % 10] + BRANCHES[i % 12]);

// ── 1. 天願: 全12ヶ月×60干支を網羅（テキストp.7の表と完全一致すること） ──
for (let lm = 1; lm <= 12; lm++) {
  for (const ganzhi of GANZHI60) {
    const dayStem = ganzhi[0];
    const dayBranch = ganzhi[1];
    const expected = TIANYUAN[lm] === ganzhi;
    // monthBranch には lunarMonth とはわざと無関係な値（辰固定）を渡す。
    // もし実装が誤って monthBranch を判定キーに使っていれば、この網羅テストは
    // 全滅するはずである。
    const result = resolveKichijinGroup6({
      yearStem: "甲",
      monthBranch: "辰",
      dayStem,
      dayBranch,
      lunarMonth: lm,
    });
    check(`天願 lunarMonth=${lm} ${ganzhi}`, result.kichijin.includes("天願"), expected, );
  }
}

// ── 2. 季分: 全12ヶ月×60干支を網羅（テキストp.20の表と完全一致すること） ──
for (let lm = 1; lm <= 12; lm++) {
  for (const ganzhi of GANZHI60) {
    const dayStem = ganzhi[0];
    const dayBranch = ganzhi[1];
    const expected = JIFEN[lm].includes(ganzhi);
    const result = resolveKichijinGroup6({
      yearStem: "甲",
      monthBranch: "辰",
      dayStem,
      dayBranch,
      lunarMonth: lm,
    });
    check(`季分 lunarMonth=${lm} ${ganzhi}`, result.kichijin.includes("季分"), expected);
  }
}

// ── 3. monthBranch と lunarMonth が食い違う場合、lunarMonth 側に従うこと ──
// 天願 lunarMonth=1 は「甲午」。monthBranch を「寅」（新暦・節月ベースなら
// 正月に相当し得る値）にしても、lunarMonth=1 が優先されて判定は変わらない
// ことを確認する。
{
  const r1 = resolveKichijinGroup6({
    yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: "午", lunarMonth: 1,
  });
  check("monthBranch=寅・lunarMonth=1・甲午 → 天願", r1.kichijin.includes("天願"), true);

  // 同じ日干支・同じ lunarMonth=1 のまま、monthBranch だけ全く違う値（戌）に
  // しても結果が変わらないこと（=判定が monthBranch を見ていない証拠）。
  const r2 = resolveKichijinGroup6({
    yearStem: "甲", monthBranch: "戌", dayStem: "甲", dayBranch: "午", lunarMonth: 1,
  });
  check("monthBranch=戌・lunarMonth=1・甲午 → 天願（monthBranchを変えても不変）", r2.kichijin.includes("天願"), true);

  // 逆に、monthBranch=寅（天願lunarMonth=1と同じ節月イメージ）のまま
  // lunarMonth だけ 2 に変えると、天願は成立しなくなること
  // （lunarMonth=2の天願は「甲戌」であり「甲午」ではないため）。
  const r3 = resolveKichijinGroup6({
    yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: "午", lunarMonth: 2,
  });
  check("monthBranch=寅・lunarMonth=2・甲午 → 天願不成立（lunarMonthが変われば結果も変わる）", r3.kichijin.includes("天願"), false);
}

// ── 4. lunarMonth 未指定時は何も判定しない（未確定の値を仮決めしない） ──
{
  const r = resolveKichijinGroup6({
    yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: "午",
  });
  check("lunarMonth未指定 → 天願・季分とも判定しない", r.kichijin, []);
}

console.log("[区分B] ロジック単体テスト（第6グループ：天願・季分）");
console.log("根拠: docs/source/擇日テキスト.pdf p.7・p.20（実例PDFは節月ベースのため照合対象外。単体テストのみで検証）\n");
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
