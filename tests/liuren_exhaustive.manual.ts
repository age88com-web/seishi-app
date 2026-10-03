// tests/liuren_exhaustive.manual.ts
//
// 六壬神課 起課エンジンの全件・確定仕様テスト。
// 実行: npx tsx tests/liuren_exhaustive.manual.ts
//
//   1. 60日干支 × 天盤差 0〜11 = 720件がすべてエラーなく三伝まで確定すること（未確定0）
//   2. 伏吟60件がすべて確定し、三伝がすべて同じ支になる例がないこと
//   3. 確定実装仕様（2026-09-25 ユーザー確認済み）で決まる課の三伝と課体
//      - 伏吟の乙日6件（不虞格・初伝自刑）、子卯互刑3件
//      - 別責7件（陽日の干合表、陰日の三合循環）
//      - 比用で陰陽一致候補0件 → 涉害法 の7件（涉害③は講座 p21 の距離規則）
//      - 返吟で涉害を使う課（甲子・庚午・甲午・庚子の7局）
//   4. 『六壬断案2』例37（癸酉日・巳将・申時）の三伝 午→卯→子

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, LiurenChart, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";

let fail = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (ok) console.log(`  ok   ${label}: ${detail}`);
  else { fail += 1; console.log(`  FAIL ${label}: ${detail}`); }
}

function chart(day: string, offset: number): LiurenChart {
  // 占時を子に固定し、月将で天盤差を作る
  return calculateLiuren({
    dayStem: day[0] as Stem, dayBranch: day[1] as Branch,
    divinationBranch: "子", monthGeneral: BRANCHES[offset],
  });
}

function summary(c: LiurenChart): string {
  const s = c.sanchuan;
  return s.status === "determined"
    ? `${s.method}${s.pattern ? "・" + s.pattern : ""} ${s.initial}${s.middle}${s.final}`
    : `未確定（${s.method}）: ${s.reason}`;
}

// ---- 1. 720件 ----
console.log("== 720件 ==");
{
  let errors = 0;
  const undetermined: string[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    for (let off = 0; off < 12; off += 1) {
      try {
        const c = chart(day, off);
        if (c.sanchuan.status !== "determined") undetermined.push(`${day}+${off}`);
      } catch (e) {
        errors += 1;
        console.log(`  ERROR ${day}+${off}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  check("計算エラー", errors === 0, `${errors}件`);
  check("未確定", undetermined.length === 0, `${undetermined.length}件 ${undetermined.join(" ")}`);
}

// ---- 2. 伏吟60件 ----
console.log("== 伏吟60件 ==");
{
  let determinedCount = 0;
  const allSame: string[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const s = chart(day, 0).sanchuan;
    if (s.status === "determined") {
      determinedCount += 1;
      if (s.initial === s.middle && s.middle === s.final) allSame.push(day);
    }
  }
  check("伏吟の確定", determinedCount === 60, `${determinedCount}/60`);
  check("三伝がすべて同じ支になる伏吟", allSame.length === 0, `${allSame.length}件 ${allSame.join(" ")}`);
}

// ---- 3. 確定実装仕様で決まる課 ----
const CASES: readonly [string, number, string, string][] = [
  // 伏吟の乙日（不虞格・初伝自刑 → 中伝は支上神）
  ["乙丑", 0, "伏吟・不虞格（初伝自刑）", "辰丑戌"],
  ["乙亥", 0, "伏吟・不虞格（初伝自刑）", "辰亥巳"],
  ["乙酉", 0, "伏吟・不虞格（初伝自刑）", "辰酉卯"],
  ["乙未", 0, "伏吟・不虞格（初伝自刑）", "辰未丑"],
  ["乙巳", 0, "伏吟・不虞格（初伝自刑）", "辰巳申"],
  ["乙卯", 0, "伏吟・不虞格（初伝自刑）", "辰卯子"],
  // 伏吟の子卯互刑（末伝＝中伝の冲）
  ["丁卯", 0, "伏吟・自信格", "卯子午"],
  ["己卯", 0, "伏吟・自信格", "卯子午"],
  ["辛卯", 0, "伏吟・自信格", "卯子午"],
  // 別責
  ["丙辰", 1, "別責", "亥午午"],
  ["戊辰", 1, "別責", "寅午午"],
  ["辛未", 3, "別責", "亥丑丑"],
  ["辛未", 9, "別責", "亥未未"],
  ["辛丑", 3, "別責", "巳丑丑"],
  ["辛丑", 9, "別責", "巳未未"],
  ["丁酉", 10, "別責", "丑巳巳"],
  ["辛酉", 11, "別責", "丑酉酉"],
  // 比用で陰陽一致候補0件 → 涉害法
  ["丁卯", 1, "涉害・察微格", "辰巳午"],
  ["癸酉", 9, "涉害・察微格", "午卯子"],
  ["壬子", 8, "涉害・見機格", "未卯亥"],
  ["乙卯", 7, "涉害・涉害課", "午丑申"],
  ["壬戌", 8, "涉害・見機格", "未卯亥"],
  // 涉害③は講座 p21 の距離規則（同支＝12）。『七百二十課式便覧表』の戊辰7局・戊戌7局と一致
  ["戊辰", 6, "返吟・無依格", "巳亥巳"],
  ["戊戌", 6, "返吟・無依格", "巳亥巳"],
  // 涉害③の距離規則で決まる講座 E09（戊辰6局）
  ["戊辰", 7, "涉害・綴瑕格", "子未寅"],
  // 返吟で涉害を使う課（①深浅で決まる。七百二十課式便覧表と一致）
  ["甲子", 6, "返吟・無依格", "寅申寅"],
  ["庚午", 6, "返吟・無依格", "寅申寅"],
  ["甲午", 6, "返吟・無依格", "寅申寅"],
  ["庚子", 6, "返吟・無依格", "寅申寅"],
];
console.log("== 確定実装仕様 ==");
for (const [day, off, name, sanchuan] of CASES) {
  const got = summary(chart(day, off));
  const want = `${name} ${sanchuan}`;
  check(`${day}+${off}`, got === want, `${got}${got === want ? "" : `（期待 ${want}）`}`);
}

// ---- 4. 断案2 例37 ----
console.log("== 六壬断案2 例37 ==");
{
  const c = calculateLiuren({ dayStem: "癸", dayBranch: "酉", divinationBranch: "申", monthGeneral: "巳" });
  const s = c.sanchuan;
  const got = s.status === "determined" ? `${s.initial}${s.middle}${s.final}` : "未確定";
  check("癸酉日 巳将 申時", got === "午卯子", `三伝 ${got}（断案 午卯子）`);
}

if (fail > 0) {
  console.log(`FAIL: ${fail}`);
  process.exit(1);
}
console.log("ALL PASS");
