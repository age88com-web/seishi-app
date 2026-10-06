// tests/takujitsu_source_corrections_unit.manual.ts
//
// 目的:
//   src/lib/takujitsu/shinsatsu/sourceCorrections.ts（原文値と採用値の台帳）の各項目について、
//   コードの判定が台帳の「採用値」どおりになっていることを確認する。
//   台帳に載っていない修正をコードに入れたり、台帳の採用値とコードが食い違ったりするのを防ぐ。
//   台帳の全項目に対応するチェックがあることも確認する。
//
// 実行:
//   npx tsx tests/takujitsu_source_corrections_unit.manual.ts

import {
  resolveKichijinGroup4,
  resolveKichijinGroup5,
  resolveKyoushinGroup6,
} from "../src/lib/takujitsu";
import type { ShinsatsuInput } from "../src/lib/takujitsu";
import { SOURCE_CORRECTIONS } from "../src/lib/takujitsu/shinsatsu/sourceCorrections";

let pass = 0;
let fail = 0;
const failures: string[] = [];

const BASE: ShinsatsuInput = { yearStem: "甲", yearBranch: "子", monthBranch: "寅", dayStem: "甲", dayBranch: "子" };
const gz = (g: string) => ({ dayStem: g[0], dayBranch: g[1] });

const has = (r: { kichijin: string[]; kyojin: string[] }, name: string) =>
  r.kichijin.includes(name) || r.kyojin.includes(name);

/** 台帳ID → 採用値どおりなら true を返すチェック。 */
const CHECKS: Record<string, () => boolean> = {
  "fujiang-4-bingxu": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "巳", ...gz("丙戌") }), "不將"),
  "fujiang-4-jiaxu": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "巳", ...gz("甲戌") }), "不將"),
  "fujiang-4-wuxu": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "巳", ...gz("戊戌") }), "不將"),
  "fujiang-5-guiwei": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "午", ...gz("癸未") }), "不將"),
  "fujiang-6-yiwei": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "未", ...gz("乙未") }), "不將"),
  "fujiang-7-yiwei": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "申", ...gz("乙未") }), "不將"),
  "fujiang-8-guiwei": () => has(resolveKichijinGroup5({ ...BASE, monthBranch: "酉", ...gz("癸未") }), "不將"),
  "qisheng-yiwei": () => has(resolveKichijinGroup5({ ...BASE, ...gz("乙未") }), "七聖"),
  "jingui-si": () => has(resolveKichijinGroup4({ ...BASE, monthBranch: "巳", ...gz("甲戌") }), "金匱"),
  "jingui-hai": () => has(resolveKichijinGroup4({ ...BASE, monthBranch: "亥", ...gz("甲戌") }), "金匱"),
  "siming-shen": () => has(resolveKichijinGroup4({ ...BASE, monthBranch: "申", ...gz("甲戌") }), "司命"),
  "fudanri-you": () => has(resolveKyoushinGroup6({ ...BASE, ...gz("乙酉"), lodge28: "觜" }), "伏斷日"),
  "tianfu-jisi-dup": () => has(resolveKichijinGroup4({ ...BASE, ...gz("己巳") }), "天福"),
  "tiankong-mao-row6": () =>
    // 卯年: 十二月は地空「4,12,20,28」／天空「8,16,24」の行、十月は地空「6,14,22,30」の行
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "卯", lunarMonth: 12, lunarDay: 4 }), "地空") &&
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "卯", lunarMonth: 12, lunarDay: 8 }), "天空") &&
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "卯", lunarMonth: 10, lunarDay: 6 }), "地空"),
  "shenzai-gengwu": () =>
    // 原文の「庚戊」を保持しているので、庚戌の日は神在にならない
    !has(resolveKichijinGroup5({ ...BASE, ...gz("庚戌") }), "神在"),
  "bingxiao-wajie-chouwei-10": () =>
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "丑", lunarMonth: 10, lunarDay: 1 }), "冰消瓦解") &&
    !has(resolveKyoushinGroup6({ ...BASE, yearBranch: "丑", lunarMonth: 10, lunarDay: 3 }), "冰消瓦解"),
  "bingxiao-wajie-maoyou-2": () =>
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "卯", lunarMonth: 2, lunarDay: 1 }), "冰消瓦解") &&
    !has(resolveKyoushinGroup6({ ...BASE, yearBranch: "卯", lunarMonth: 2, lunarDay: 3 }), "冰消瓦解"),
  "xiawu-yang-39": () =>
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "子", lunarMonth: 3, lunarDay: 23 }), "下兀") &&
    !has(resolveKyoushinGroup6({ ...BASE, yearBranch: "子", lunarMonth: 3, lunarDay: 28 }), "下兀"),
  "xiawu-yin-612": () =>
    has(resolveKyoushinGroup6({ ...BASE, yearBranch: "丑", lunarMonth: 6, lunarDay: 29 }), "下兀") &&
    !has(resolveKyoushinGroup6({ ...BASE, yearBranch: "丑", lunarMonth: 6, lunarDay: 28 }), "下兀"),
  "wenru-wenchu-3": () =>
    has(resolveKyoushinGroup6({ ...BASE, lunarMonth: 3, lunarDay: 3 }), "瘟入") &&
    has(resolveKyoushinGroup6({ ...BASE, lunarMonth: 3, lunarDay: 4 }), "瘟出"),
  "changxing-9": () =>
    has(resolveKyoushinGroup6({ ...BASE, lunarMonth: 9, lunarDay: 4 }), "長星") &&
    !has(resolveKyoushinGroup6({ ...BASE, lunarMonth: 9, lunarDay: 3 }), "長星"),
};

console.log("[台帳] 原文値と採用値（src/lib/takujitsu/shinsatsu/sourceCorrections.ts）\n");

for (const c of SOURCE_CORRECTIONS) {
  const fn = CHECKS[c.id];
  if (!fn) {
    fail += 1;
    failures.push(`  [${c.id}] 台帳の項目に対応するチェックが無い`);
    continue;
  }
  if (fn()) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  [${c.id}] ${c.shinsatsu} ${c.location}: コードが採用値「${c.adoptedValue}」どおりでない`);
  }
}
for (const id of Object.keys(CHECKS)) {
  if (!SOURCE_CORRECTIONS.some((c) => c.id === id)) {
    fail += 1;
    failures.push(`  [${id}] チェックはあるが台帳に項目が無い`);
  }
}
const ids = SOURCE_CORRECTIONS.map((c) => c.id);
if (new Set(ids).size !== ids.length) {
  fail += 1;
  failures.push("  台帳に重複したIDがある");
}

console.log(`一致: ${pass} / ${SOURCE_CORRECTIONS.length}`);
if (fail > 0) {
  console.log("\n--- 不一致 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`\n${pass} / ${SOURCE_CORRECTIONS.length} PASS`);
process.exit(0);
