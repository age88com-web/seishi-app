// tests/liuren_interpretation_day_night_noble_branch.manual.ts
//
// 六壬神課 Phase 4E（日干の昼夜貴人支 DayNightNobleBranchState）のテスト。
// 実行: npx tsx tests/liuren_interpretation_day_night_noble_branch.manual.ts
//
//   1. 720課（占時子＝夜占）で、貴人支＝generals.nobleBranch、昼夜＝generals.dayOrNight、その天盤支に十二天将の貴人が乗る
//   2. 占時12支（8,640課）で昼占・夜占それぞれ同じことを確認し、日干別の昼・夜の貴人支を実測する（新しい表は作らない）
//   3. 十二天将の貴人（Phase 4B）とは別の FACT（型・関数・値の出どころ）。日干・日支そのものの FACT は変わらない
//   4. Phase 4D で「昼夜貴人支」と分類した13文の再監査（採用された側の貴人支と一致するか、採用されなかった側を指すか）
//   5. 人物の貴人2文は取り込まない。ROLE・吉凶・DOMAIN・RoleMatcher に入れていない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { dayNightNobleBranchStateOf, isDayNightNobleBranch } from "../src/lib/liuren/interpretation/dayNightNobleBranch";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

function audit(dayStem: Stem, dayBranch: Branch, divinationBranch: Branch, monthGeneral: Branch) {
  const tag = `${dayStem}${dayBranch} ${monthGeneral}将${divinationBranch}時`;
  const chart = calculateLiuren({ dayStem, dayBranch, divinationBranch, monthGeneral });
  const facts = buildInterpretationFacts(chart);
  const before = JSON.stringify(facts);
  const s = dayNightNobleBranchStateOf(facts);
  const ok =
    s.kind === "dayNightNobleBranch" &&
    Object.keys(s).join() === "kind,branch,period" &&
    s.branch === chart.generals.nobleBranch &&
    s.period === (chart.generals.dayOrNight === "昼" ? "day" : "night") &&
    // 貴人支の天盤支に、十二天将の貴人が乗る（天将盤との一致）
    chart.generals.generalOn[s.branch] === "貴人" &&
    heavenlyGeneralStateOf(facts, s.branch).general === "貴人" &&
    // 貴人の位置（地盤）は貴人支の下
    chart.generals.noblePosition === chart.plate.earthUnder[s.branch] &&
    // 照合関数は12支のうち貴人支だけ true
    BRANCHES.filter((b) => isDayNightNobleBranch(facts, b)).join() === s.branch;
  if (!ok) check(`${tag} 貴人支`, false, JSON.stringify(s));
  if (JSON.stringify(facts) !== before) check(`${tag} FACT 不変`, false);
  return { s, facts };
}

// ---- 1. 720課（占時子） ----
let n720 = 0;
const period720: Record<string, number> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const { s } = audit(STEMS[i % 10], BRANCHES[i % 12], "子", BRANCHES[o]);
  n720 += 1; inc(period720, s.period);
}
check("720課すべてで貴人支を取得（占時子＝夜占）", n720 === 720 && period720.night === 720, JSON.stringify(period720));

// ---- 2. 占時12支（昼占・夜占） ----
const periodAll: Record<string, number> = {};
const table: Record<string, Record<"day" | "night", Set<Branch>>> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const { s } = audit(STEMS[i % 10], BRANCHES[i % 12], shi, BRANCHES[o]);
  inc(periodAll, s.period);
  const stem = STEMS[i % 10];
  table[stem] ??= { day: new Set(), night: new Set() };
  table[stem][s.period].add(s.branch);
}
check("8,640課: 昼占4,320・夜占4,320", periodAll.day === 4320 && periodAll.night === 4320, JSON.stringify(periodAll));
check("日干ごとに昼・夜の貴人支はそれぞれ1支（日支・月将・占時によらない）", STEMS.every((st) => table[st].day.size === 1 && table[st].night.size === 1));
const dayOf = (st: Stem) => [...table[st].day][0];
const nightOf = (st: Stem) => [...table[st].night][0];

// ---- 3. 十二天将の貴人との分離 ----
{
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "子" }));
  const s = dayNightNobleBranchStateOf(facts) as unknown as Record<string, unknown>;
  check("DayNightNobleBranchState は天将名（general）を持たない", !("general" in s) && !("skyBranch" in s));
  const ctx = anchorResolutionContextOf(facts);
  check("DayBranchState・四課に昼夜貴人支の項目を足していない", !JSON.stringify(ctx).includes("dayNightNoble"));
  const src = readFileSync("src/lib/liuren/interpretation/dayNightNobleBranch.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["NOBLE_DAY", "NOBLE_NIGHT", "DAY_BRANCHES", "divinationBranch", "InterpretationContext", "domain", "role", "authority", "support",
    "good", "auspicious", "supportive", "effective", "吉", "凶", "GENERALS"].filter((w) => src.includes(w));
  check("dayNightNobleBranch.ts に昼夜貴人表・昼夜の再判定・ROLE・DOMAIN・吉凶が出てこない", hit.length === 0, hit.join(","));
  const roleRules = readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8");
  check("RoleMatcher に貴人支の matcher を足していない", !/dayNightNoble|nobleBranch/.test(roleRules));
}

// ---- 4. Phase 4D の13文 ----
// side: adopted＝本文の支が採用された側の貴人支、other＝採用されなかった側（起課結果にないので FACT では表せない）、none＝支の指定なし
type Side = "adopted" | "other" | "none";
const SENTENCES: [id: string, day: string, jiang: Branch, shi: Branch, branches: Branch[], expected: Side[], gist: string][] = [
  ["47-5", "丙寅", "亥", "申", ["亥"], ["other"], "簾幕貴人（天将盤が別方式の例）"],
  ["47-6", "丙寅", "亥", "申", ["亥"], ["other"], "中伝亥は空亡だが月将で簾幕貴人（天将盤が別方式の例）"],
  ["49-2", "己卯", "午", "丑", ["子", "申"], ["other", "adopted"], "身宅みな貴人（子・申）"],
  ["49-3", "己卯", "午", "丑", ["申"], ["adopted"], "申は空亡で夜貴人となり宅にある"],
  ["51-1", "癸亥", "未", "巳", ["卯", "巳"], ["other", "adopted"], "太陰が卯に乗じて幕貴、日貴（巳）は末伝"],
  ["51-2", "癸亥", "未", "巳", ["卯", "巳"], ["other", "adopted"], "昼夜貴人が年命辰をはさむ"],
  ["51-3", "癸亥", "未", "巳", ["卯", "巳"], ["other", "adopted"], "昼夜貴人が一課二課と中伝末伝"],
  ["52-1", "丁丑", "午", "辰", ["亥", "酉"], ["adopted", "other"], "満局みな貴人"],
  ["52-4", "丁丑", "午", "辰", ["亥", "酉"], ["adopted", "other"], "三伝日上ともに貴人"],
  ["52-5", "丁丑", "午", "辰", ["酉"], ["other"], "酉が日上に加わり、それに貴人を加える"],
  ["52-6", "丁丑", "午", "辰", ["亥", "酉"], ["adopted", "other"], "一課二課ともに昼夜貴人"],
  ["52-7", "丁丑", "午", "辰", ["酉"], ["other"], "干上は空亡で貴人は落空"],
  ["52-9", "丁丑", "午", "辰", [], [], "貴人が多くても貴とはいえない"],
];
check("Phase 4D の昼夜貴人支の文は13文", SENTENCES.length === 13);
const sideCount: Record<string, number> = {};
const lines: string[] = [];
for (const [id, day, jiang, shi, branches, expected, gist] of SENTENCES) {
  const stem = day[0] as Stem;
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
  const s = dayNightNobleBranchStateOf(facts);
  const sides: Side[] = branches.map((b) => (b === s.branch ? "adopted" : b === (s.period === "day" ? nightOf(stem) : dayOf(stem)) ? "other" : "none"));
  check(`${id} 本文の支（${branches.join("・") || "なし"}）の分類`, sides.join() === expected.join(), `${sides.join()} / ${expected.join()}`);
  if (!branches.length) inc(sideCount, "支の指定なし");
  else inc(sideCount, sides.includes("other") ? (sides.includes("adopted") ? "昼夜両方（採用側のみ FACT で表せる）" : "採用されなかった側だけ") : "採用された側だけ");
  lines.push(`${id} ${day}日 ${jiang}将${shi}時: FACT ${s.branch}（${s.period}） ／ 本文 ${branches.join("・") || "なし"} → ${sides.join("・") || "-"} ／ ${gist}`);
}

// ---- 5. 人物の貴人は取り込まない ----
check("人物の貴人（例40-1・40-6）は照合対象に入れていない", !SENTENCES.some(([id]) => id.startsWith("40-")));

console.log(`720課: ${JSON.stringify(period720)} ／ 占時12支 8,640課: ${JSON.stringify(periodAll)}`);
console.log(`日干別の昼貴人支（実測）: ${STEMS.map((st) => `${st}${dayOf(st)}`).join(" ")}`);
console.log(`日干別の夜貴人支（実測）: ${STEMS.map((st) => `${st}${nightOf(st)}`).join(" ")}`);
console.log("Phase 4D の13文:");
for (const l of lines) console.log(`  ${l}`);
console.log(`分類: ${JSON.stringify(sideCount)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
