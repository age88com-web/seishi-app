// tests/takujitsu_lunar_day_tables_fixed_unit.manual.ts
//
// 目的:
//   擇日テキスト.pdf に条件ごとの日数・値が一覧で明記されている表について、
//   表の記載値（原文値）をそのまま正式採用値とすることを全セルで固定する（監修確定 2026-10-06）。
//   他の行との規則性・等差・対称性が崩れているセルも、表の記載どおりを期待値とする。
//
//   期待値は、コードの表を写したものではなく、擇日テキスト.pdf のページから直接書き起こした:
//     ・39）上兀・下兀       印刷 p.37（陽年・陰年で列の並びが異なる1つの表）
//     ・41）瘟入・瘟出       印刷 p.38
//     ・42）冰消瓦解         印刷 p.39
//     ・47）天空・地空       印刷 p.42（年の地支8グループ × 8行。卯年の列の1行は「四月・十月・二月」）
//
//   月の基準（監修確定）:
//     ・瘟入・瘟出、冰消瓦解 … 見出し「月令」により節月（monthBranch。正月＝寅 … 十二月＝丑）
//     ・上兀・下兀、天空・地空 … 月の明記なしのため監修保留で、従来どおり農暦月（lunarMonth）
//   日はいずれも農暦日（lunarDay 1〜30）。各条件の全日（1〜30）について、表の日だけ成立し
//   それ以外の日は成立しないことを確認する。
//
// 実行:
//   npx tsx tests/takujitsu_lunar_day_tables_fixed_unit.manual.ts

import { resolveKyoushinGroup6 } from "../src/lib/takujitsu";
import type { ShinsatsuInput } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

const BASE: ShinsatsuInput = { yearStem: "甲", yearBranch: "子", monthBranch: "寅", dayStem: "甲", dayBranch: "子" };
const SETSU = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"]; // 正月〜十二月
const MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

/** 1つの条件について、lunarDay 1〜30 の全日で「表の日だけ成立」を確認する。 */
function checkAllDays(label: string, input: ShinsatsuInput, name: string, expectedDays: readonly number[]) {
  for (let lunarDay = 1; lunarDay <= 30; lunarDay += 1) {
    const actual = resolveKyoushinGroup6({ ...input, lunarDay }).kyojin.includes(name);
    const expected = expectedDays.includes(lunarDay);
    if (actual === expected) pass += 1;
    else {
      fail += 1;
      failures.push(`  [${label} ${name} lunarDay=${lunarDay}] 期待=${expected ? "成立" : "不成立"} 実測=${actual ? "成立" : "不成立"}`);
    }
  }
}

// ---- 39）上兀・下兀（p.37）----
// 表の列（左から）: 陽年＝赤口(下兀)・速喜・留速(上兀)・大安・空亡・小吉
//                   陰年＝大安・空亡・小吉・赤口(下兀)・速喜・留速(上兀)
// 行: 正・七月／二・八月／三・九月／四・十月／五・十一月／六・十二月
const JOUKOTSU_TABLE: number[][][] = [
  // [列1, 列2, 列3, 列4, 列5, 列6]
  [[6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25]],
  [[5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30]],
  [[4, 10, 16, 22, 23], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29]],
  [[3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28]],
  [[2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27]],
  [[1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 29], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26]],
];
// 陽年・陰年は年支で判定（子寅辰午申戌＝陽年）。各陰陽から代表の年支を2つずつ使う。
for (const [yearBranch, younen] of [["子", true], ["午", true], ["丑", false], ["亥", false]] as const) {
  for (let lunarMonth = 1; lunarMonth <= 12; lunarMonth += 1) {
    const row = JOUKOTSU_TABLE[(lunarMonth - 1) % 6];
    const gekotsu = younen ? row[0] : row[3];
    const joukotsu = younen ? row[2] : row[5];
    const input = { ...BASE, yearBranch, lunarMonth };
    const label = `${younen ? "陽年" : "陰年"}(${yearBranch}) 農暦${MONTH_NAMES[lunarMonth - 1]}月`;
    checkAllDays(label, input, "下兀", gekotsu);
    checkAllDays(label, input, "上兀", joukotsu);
  }
}

// ---- 41）瘟入・瘟出（p.38、見出し「月令」→ 節月）----
const ONNYUU = [6, 5, 3, 25, 24, 23, 20, 27, 17, 13, 12, 11];
const ONSHUTSU = [9, 8, 4, 28, 27, 26, 23, 30, 20, 16, 15, 14];
for (let mi = 0; mi < 12; mi += 1) {
  const input = { ...BASE, monthBranch: SETSU[mi] };
  const label = `${MONTH_NAMES[mi]}月（節月${SETSU[mi]}）`;
  checkAllDays(label, input, "瘟入", [ONNYUU[mi]]);
  checkAllDays(label, input, "瘟出", [ONSHUTSU[mi]]);
}

// ---- 42）冰消瓦解（p.39、見出し「月令」→ 節月）----
const s6 = (k: number) => [k, k + 6, k + 12, k + 18, k + 24];
const HYOUSHOUGAKAI: Record<string, number[][]> = {
  // 正〜十二月
  子午: [s6(1), s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5), s6(4), s6(3), s6(2)],
  丑未: [s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5), s6(4), [1, 9, 15, 21, 27], s6(2), s6(1)],
  寅申: [s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6)],
  卯酉: [s6(4), [1, 9, 15, 21, 27], s6(2), s6(1), s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5)],
  辰戌: [s6(3), s6(2), s6(1), s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5), s6(4)],
  巳亥: [s6(2), s6(1), s6(6), s6(5), s6(4), s6(3), s6(2), s6(1), s6(6), s6(5), s6(4), s6(3)],
};
for (const [group, rows] of Object.entries(HYOUSHOUGAKAI)) {
  for (const yearBranch of group) {
    for (let mi = 0; mi < 12; mi += 1) {
      const input = { ...BASE, yearBranch, monthBranch: SETSU[mi] };
      checkAllDays(`${yearBranch}年 ${MONTH_NAMES[mi]}月（節月${SETSU[mi]}）`, input, "冰消瓦解", rows[mi]);
    }
  }
}

// ---- 47）天空・地空（p.42、月の明記なし → 農暦月。監修保留）----
// 8行それぞれの（地空の日, 天空の日）と、年の地支グループごとにその行に印字された月。
const TENKUU_ROWS: { chikuu: number[]; tenkuu: number[]; months: Record<string, number[]> }[] = [
  { chikuu: [1, 9, 17, 25], tenkuu: [5, 13, 21, 29], months: { 戌亥: [2, 10], 酉: [3, 11], 未申: [4, 12], 午: [5], 辰巳: [6], 卯: [7], 丑寅: [8], 子: [1, 9] } },
  { chikuu: [8, 16, 24], tenkuu: [4, 12, 20, 28], months: { 戌亥: [3, 11], 酉: [4, 12], 未申: [5], 午: [6], 辰巳: [7], 卯: [8], 丑寅: [1, 9], 子: [2, 10] } },
  { chikuu: [7, 15, 23], tenkuu: [3, 11, 19, 27], months: { 戌亥: [4, 12], 酉: [5], 未申: [6], 午: [7], 辰巳: [8], 卯: [1, 9], 丑寅: [2, 10], 子: [3, 11] } },
  { chikuu: [6, 14, 22, 30], tenkuu: [2, 10, 18, 26], months: { 戌亥: [5], 酉: [6], 未申: [7], 午: [8], 辰巳: [1, 9], 卯: [2, 10], 丑寅: [3, 11], 子: [4, 12] } },
  { chikuu: [5, 13, 21, 29], tenkuu: [1, 9, 17, 25], months: { 戌亥: [6], 酉: [7], 未申: [8], 午: [1, 9], 辰巳: [2, 10], 卯: [3, 11], 丑寅: [4, 12], 子: [5] } },
  // 卯年の列は原文の印字どおり「四月・十月・二月」（十二月はどの行にも無い）
  { chikuu: [4, 12, 20, 28], tenkuu: [8, 16, 24], months: { 戌亥: [7], 酉: [8], 未申: [1, 9], 午: [2, 10], 辰巳: [3, 11], 卯: [4, 10, 2], 丑寅: [5], 子: [6] } },
  { chikuu: [3, 11, 19, 27], tenkuu: [7, 15, 23], months: { 戌亥: [8], 酉: [1, 9], 未申: [2, 10], 午: [3, 11], 辰巳: [4, 12], 卯: [5], 丑寅: [6], 子: [7] } },
  { chikuu: [2, 10, 18, 26], tenkuu: [6, 14, 22, 30], months: { 戌亥: [1, 9], 酉: [2, 10], 未申: [3, 11], 午: [4, 12], 辰巳: [5], 卯: [6], 丑寅: [7], 子: [8] } },
];
for (const group of ["戌亥", "酉", "未申", "午", "辰巳", "卯", "丑寅", "子"]) {
  for (const yearBranch of group) {
    for (let lunarMonth = 1; lunarMonth <= 12; lunarMonth += 1) {
      const rows = TENKUU_ROWS.filter((r) => r.months[group].includes(lunarMonth));
      const chikuu = [...new Set(rows.flatMap((r) => r.chikuu))];
      const tenkuu = [...new Set(rows.flatMap((r) => r.tenkuu))];
      const input = { ...BASE, yearBranch, lunarMonth };
      const label = `${yearBranch}年 農暦${MONTH_NAMES[lunarMonth - 1]}月`;
      checkAllDays(label, input, "地空", chikuu);
      checkAllDays(label, input, "天空", tenkuu);
    }
  }
}

console.log("[固定] 擇日テキストの一覧表の記載値を正式採用値として全セル固定（上兀下兀・瘟入瘟出・冰消瓦解・天空地空）");
console.log(`一致: ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log("\n--- 不一致 ---");
  for (const f of failures.slice(0, 50)) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
