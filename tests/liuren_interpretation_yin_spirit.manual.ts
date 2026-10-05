// tests/liuren_interpretation_yin_spirit.manual.ts
//
// 六壬神課 Phase 4J（四課の上神の陰神 YinSpiritState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_yin_spirit.manual.ts
//
//   1. 資料の用例（『六壬断案２』）で、陰神＝上神を地盤の位置としてその上に来る天盤支（plate.heavenOn[上神]）になること
//      例32-3・例55-3（必須）と、例33・36・39・50 の陰神の文。天将盤が別方式の例は、支（天地盤）だけを照合し天将は照合しない
//   2. 720課・占時12支 8,640課で、陰神の支＝plate.heavenOn[上神]、天将＝generalOn（Phase 4B）。天地盤は一対一
//   3. 四課の構造と同じ写像（一課の陰神＝二課の上神、三課の陰神＝四課の上神）。支差は天地盤の差（offset）。伏吟は同じ支、返吟は冲の支
//   4. 五行・六親・SiteState・固有属性・関係・十二長生・制約・意味づけ・ROLE・DOMAIN を持たない。三伝・干上の API はない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { CHONG } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { lessonYinSpiritStateOf, lessonYinSpiritStatesOf } from "../src/lib/liuren/interpretation/yinSpirit";
import * as yinSpiritModule from "../src/lib/liuren/interpretation/yinSpirit";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));

// ---- 1. 資料の用例 ----
type Usage = {
  id: string; day: string; jiang: Branch; shi: Branch; board: "match" | "mismatch";
  lesson: 1 | 2 | 3 | 4; source: Branch; yin: Branch;
  /** 本文に書かれた天将（基準の支・陰神の支）。天将盤が一致する例だけエンジンと照合する */
  sourceGeneral?: HeavenlyGeneral; yinGeneral?: HeavenlyGeneral;
  text: string;
};
const USAGES: Usage[] = [
  { id: "32-3", day: "戊申", jiang: "巳", shi: "卯", board: "match", lesson: 3, source: "戌", yin: "子", sourceGeneral: "玄武", yinGeneral: "天后",
    text: "宅上の戌は玄武…四課が発用であり、これは玄武の陰神である（三課上神 戌〔玄武〕の陰神＝四課上神 子）" },
  { id: "55-3", day: "戊申", jiang: "酉", shi: "申", board: "match", lesson: 3, source: "酉", yin: "戌", sourceGeneral: "太常", yinGeneral: "玄武",
    text: "酉が太常で衣服、その上神戌が玄武で汚れ（三課上神 酉〔太常〕の上＝四課上神 戌〔玄武〕）" },
  { id: "33-5", day: "壬午", jiang: "辰", shi: "申", board: "mismatch", lesson: 1, source: "未", yin: "卯", yinGeneral: "朱雀",
    text: "未の陰神は卯で朱雀（一課上神 未の陰神＝二課上神 卯。断案の盤では朱雀）" },
  { id: "36", day: "庚戌", jiang: "亥", shi: "酉", board: "mismatch", lesson: 3, source: "子", yin: "寅",
    text: "子の陰神は寅（三課上神 子の陰神＝四課上神 寅）" },
  { id: "36b", day: "庚戌", jiang: "亥", shi: "酉", board: "mismatch", lesson: 4, source: "寅", yin: "辰",
    text: "寅の陰神は辰（四課上神 寅の陰神＝辰。三伝の末伝）" },
  { id: "50", day: "戊寅", jiang: "申", shi: "未", board: "match", lesson: 3, source: "卯", yin: "辰",
    text: "支上神（卯）…その陰神発用は辰（三課上神 卯の陰神＝四課上神 辰＝初伝）" },
];
const usageLines: string[] = [];
for (const u of USAGES) {
  const f = factsOf(u.day, u.jiang, u.shi);
  const y = lessonYinSpiritStateOf(f, u.lesson);
  check(`${u.id} 支: lesson${u.lesson} 上神 ${u.source} の陰神は ${u.yin}`, y.sourceBranch === u.source && y.yinSpiritBranch === u.yin, JSON.stringify(y));
  if (u.board === "match") {
    if (u.yinGeneral) check(`${u.id} 天将: 陰神 ${u.yin} の天将は ${u.yinGeneral}`, y.yinSpiritGeneral === u.yinGeneral, y.yinSpiritGeneral);
    if (u.sourceGeneral) check(`${u.id} 天将: 基準 ${u.source} の天将は ${u.sourceGeneral}`, heavenlyGeneralStateOf(f, u.source).general === u.sourceGeneral);
  }
  usageLines.push(`${u.id}（天将盤 ${u.board === "match" ? "一致" : "不一致"}）: lesson${u.lesson} ${y.sourceBranch} → 陰神 ${y.yinSpiritBranch} 天将 ${y.yinSpiritGeneral}${u.board === "mismatch" && u.yinGeneral ? `（断案の盤では ${u.yinGeneral}。照合しない）` : ""} ／ ${u.text}`);
}
{
  // 例39-6「四課は青龍であり寅（日支）の陰神」: 日支の陰神＝四課の上神（日支の上神〔三課〕の、さらに上）
  const f = factsOf("壬寅", "子", "寅");
  const y3 = lessonYinSpiritStateOf(f, 3);
  check("39-6 日支寅の陰神＝四課上神（三課上神の陰神と同じ支）", f.lessons[2].lower === "寅" && y3.yinSpiritBranch === f.lessons[3].upper);
  usageLines.push(`39-6（天将盤 不一致）: 日支 寅 → 三課上神 ${f.lessons[2].upper} → 陰神（四課上神） ${y3.yinSpiritBranch} ／ 「四課は青龍であり寅の陰神」＝日支の陰神は四課（上神の上神）`);
}

// ---- 2・3. 全盤 ----
const diffDist: Record<string, number> = {};
let charts = 0, n720 = 0, fuyin = 0, fanyin = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] });
  const facts = buildInterpretationFacts(chart);
  const before = JSON.stringify(facts);
  const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]} ${BRANCHES[o]}将${shi}時`;
  charts += 1;
  if (shi === "子") n720 += 1;
  // 天地盤の一対一
  const heavens = BRANCHES.map((b) => facts.plate.heavenOn[b]);
  if (new Set(heavens).size !== 12 || !BRANCHES.every((b) => facts.plate.earthUnder[facts.plate.heavenOn[b]] === b)) check(`${tag} 天地盤の一対一`, false);
  const ys = lessonYinSpiritStatesOf(facts);
  for (const y of ys) {
    const ok = Object.keys(y).join() === "lessonIndex,sourceBranch,yinSpiritBranch,yinSpiritGeneral" &&
      y.sourceBranch === facts.lessons[y.lessonIndex - 1].upper &&
      y.yinSpiritBranch === facts.plate.heavenOn[y.sourceBranch] &&
      facts.plate.earthUnder[y.yinSpiritBranch] === y.sourceBranch &&
      y.yinSpiritGeneral === facts.generals.generalOn[y.yinSpiritBranch] &&
      y.yinSpiritGeneral === heavenlyGeneralStateOf(facts, y.yinSpiritBranch).general &&
      JSON.stringify(y) === JSON.stringify(lessonYinSpiritStateOf(facts, y.lessonIndex));
    if (!ok) check(`${tag} lesson${y.lessonIndex}`, false, JSON.stringify(y));
    const d = (BRANCHES.indexOf(y.yinSpiritBranch) - BRANCHES.indexOf(y.sourceBranch) + 12) % 12;
    if (d !== facts.plate.offset) check(`${tag} 支差＝天地盤の差`, false);
    if (shi === "子") inc(diffDist, String(d));
  }
  // 四課の構造と同じ写像
  if (ys[0].yinSpiritBranch !== facts.lessons[1].upper || ys[2].yinSpiritBranch !== facts.lessons[3].upper) check(`${tag} 一課・三課の陰神＝二課・四課の上神`, false);
  if (facts.lessons[1].lowerBranch !== ys[0].sourceBranch || facts.lessons[3].lowerBranch !== ys[2].sourceBranch) check(`${tag} 二課・四課の地盤＝一課・三課の上神`, false);
  // 伏吟・返吟
  if (facts.plate.offset === 0) { fuyin += 1; if (!ys.every((y) => y.yinSpiritBranch === y.sourceBranch)) check(`${tag} 伏吟は同じ支`, false); }
  if (facts.plate.offset === 6) { fanyin += 1; if (!ys.every((y) => y.yinSpiritBranch === CHONG[y.sourceBranch])) check(`${tag} 返吟は冲の支`, false); }
  if (JSON.stringify(facts) !== before) check(`${tag} FACT 不変`, false);
}
check("720課・8,640課を監査", n720 === 720 && charts === 8640);
check("伏吟（天地盤の差0）の課で陰神は基準の支と同じ", fuyin === 720, String(fuyin));
check("返吟（天地盤の差6）の課で陰神は基準の支の冲", fanyin === 720, String(fanyin));
check("720課×4課の支差は天地盤の差ごとに240ずつ", Object.values(diffDist).length === 12 && Object.values(diffDist).every((v) => v === 240), JSON.stringify(diffDist));

// ---- 4. 公開 API・コード ----
{
  check("公開 API は四課の陰神だけ（三伝・干上の関数はない）", Object.keys(yinSpiritModule).sort().join() === "lessonYinSpiritStateOf,lessonYinSpiritStatesOf", Object.keys(yinSpiritModule).join());
  const code = readFileSync("src/lib/liuren/interpretation/yinSpirit.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["elementOf", "ELEMENT", "sixRelation", "relation", "siteState", "Intrinsic", "Placement", "growth", "constraints", "isVoid",
    "buildPlate", "shiftBranch", "offset", "role", "domain", "InterpretationContext", "汚れ", "衣服", "吉", "凶"].filter((w) => code.includes(w));
  check("yinSpirit.ts に五行・六親・他の FACT・天地盤の再計算・意味づけ・ROLE・DOMAIN がない", hit.length === 0, hit.join(","));
  check("RoleMatcher を変更していない", !/yinSpirit|YinSpirit/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}
{
  // 支と天将は別の項目: 天将盤が違っても（同じ天地盤・別の占時）陰神の支は同じで、天将だけが変わることがある
  const a = factsOf("戊申", "巳", "卯"); // 天地盤の差 2（例32）
  const b = buildInterpretationFacts(calculateLiuren({ dayStem: "戊", dayBranch: "申", divinationBranch: "酉", monthGeneral: "亥" })); // 同じ差 2・昼夜が違う
  const ya = lessonYinSpiritStateOf(a, 3), yb = lessonYinSpiritStateOf(b, 3);
  check("同じ天地盤の差なら陰神の支は同じで、天将は天将盤に従う（支と天将は別の項目）",
    a.plate.offset === b.plate.offset && ya.yinSpiritBranch === yb.yinSpiritBranch && ya.yinSpiritGeneral === a.generals.generalOn[ya.yinSpiritBranch] && yb.yinSpiritGeneral === b.generals.generalOn[yb.yinSpiritBranch]);
}

console.log("資料の用例:");
for (const l of usageLines) console.log(`  ${l}`);
console.log(`720課×4課の支差（陰神 − 基準）: ${JSON.stringify(diffDist)}`);
console.log(`伏吟 ${fuyin}課 ／ 返吟 ${fanyin}課（8,640課中）`);
const f32 = factsOf("戊申", "巳", "卯");
const f55 = factsOf("戊申", "酉", "申");
const show = (f: InterpretationFacts) => lessonYinSpiritStatesOf(f).map((y) => `lesson${y.lessonIndex} ${y.sourceBranch}→${y.yinSpiritBranch}（${y.yinSpiritGeneral}）`).join(" ");
console.log(`例32 四課の陰神: ${show(f32)}`);
console.log(`例55 四課の陰神: ${show(f55)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
