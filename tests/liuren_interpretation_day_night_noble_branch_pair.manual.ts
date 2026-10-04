// tests/liuren_interpretation_day_night_noble_branch_pair.manual.ts
//
// 六壬神課 Phase 4F（日干の昼貴人支・夜貴人支の対）のテスト。
// 実行: npx tsx tests/liuren_interpretation_day_night_noble_branch_pair.manual.ts
//
//   1. 720課・占時12支（8,640課）すべてで generals.nobleBranches（昼・夜）がある。
//      採用された側（nobleBranch）は 昼占なら day・夜占なら night と同じ。noblePosition は採用された側の下の地盤支のまま
//   2. 天将盤そのもの（昼夜・貴人支・位置・順逆・各支の天将）は、nobleBranches を除けば Phase 4E までと同じ
//      （起課の配置を、nobleBranches を使わずに講座 p8・p9 の手順で組み直したものと一致）
//   3. 解釈層の DayNightNobleBranchPairState: 昼・夜・採用された側（Phase 4E の FACT のまま）へ到達できる
//   4. 日干10干の対が Phase 4E の実測（昼・夜それぞれ別の盤から求めた値）と一致する
//   5. Phase 4D・4E の13文を、対の FACT で再監査（A 採用側だけ・B 昼夜両方・C 採用されなかった側・D 支の指定なし）
//      Phase 4E で表せなかった11文が、必要な貴人支へ到達できる
//   6. 解釈層に昼夜貴人表がない・簾幕貴人などの規則がない・十二天将の貴人や人物の貴人と混ぜていない・ROLE・DOMAIN・吉凶がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { DAY_BRANCHES, FORWARD_POSITIONS, GENERALS } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { dayNightNobleBranchStateOf } from "../src/lib/liuren/interpretation/dayNightNobleBranch";
import { dayNightNobleBranchPairStateOf, dayNightNobleBranchPeriodsOf } from "../src/lib/liuren/interpretation/dayNightNobleBranchPair";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

/** Phase 4E までの GeneralsLayout と同じ形か（nobleBranches を除いた天将盤を、採用された貴人支から講座 p9 の手順で組み直して比べる） */
function layoutUnchanged(chart: ReturnType<typeof calculateLiuren>): boolean {
  const g = chart.generals;
  const { nobleBranches, ...rest } = g;
  const dayOrNight = DAY_BRANCHES.includes(chart.input.divinationBranch) ? "昼" : "夜";
  const pos = chart.plate.earthUnder[g.nobleBranch];
  const direction = FORWARD_POSITIONS.includes(pos) ? "順" : "逆";
  const on = {} as Record<Branch, HeavenlyGeneral>;
  GENERALS.forEach((name, i) => {
    const earth = BRANCHES[(BRANCHES.indexOf(pos) + (direction === "順" ? i : -i) + 120) % 12];
    on[chart.plate.heavenOn[earth]] = name;
  });
  return Object.keys(rest).join() === "dayOrNight,nobleBranch,noblePosition,direction,generalOn" &&
    rest.dayOrNight === dayOrNight && rest.noblePosition === pos && rest.direction === direction &&
    BRANCHES.every((b) => rest.generalOn[b] === on[b]) && nobleBranches !== undefined;
}

function audit(dayStem: Stem, dayBranch: Branch, divinationBranch: Branch, monthGeneral: Branch) {
  const tag = `${dayStem}${dayBranch} ${monthGeneral}将${divinationBranch}時`;
  const chart = calculateLiuren({ dayStem, dayBranch, divinationBranch, monthGeneral });
  const g = chart.generals;
  const facts = buildInterpretationFacts(chart);
  const before = JSON.stringify(facts);
  const pair = dayNightNobleBranchPairStateOf(facts);
  const selected = dayNightNobleBranchStateOf(facts);
  // 1. 対がある・採用された側が対の該当する側と同じ
  const hasPair = !!g.nobleBranches && BRANCHES.includes(g.nobleBranches.day) && BRANCHES.includes(g.nobleBranches.night) && g.nobleBranches.day !== g.nobleBranches.night;
  if (!hasPair) check(`${tag} 昼夜の対`, false, JSON.stringify(g.nobleBranches));
  const selectedOk = g.dayOrNight === "昼" ? g.nobleBranch === g.nobleBranches.day : g.nobleBranch === g.nobleBranches.night;
  if (!selectedOk) check(`${tag} 採用された側＝対の該当する側`, false);
  if (g.noblePosition !== chart.plate.earthUnder[g.nobleBranch]) check(`${tag} noblePosition は採用された側の下`, false);
  // 2. 天将盤は従来どおり
  if (!layoutUnchanged(chart)) check(`${tag} 天将盤が従来どおり`, false);
  if (heavenlyGeneralStateOf(facts, g.nobleBranch).general !== "貴人") check(`${tag} 採用された貴人支に十二天将の貴人`, false);
  // 3. 解釈層の FACT
  const ok3 = pair.kind === "dayNightNobleBranchPair" && Object.keys(pair).join() === "kind,dayBranch,nightBranch,selected" &&
    pair.dayBranch === g.nobleBranches.day && pair.nightBranch === g.nobleBranches.night &&
    JSON.stringify(pair.selected) === JSON.stringify(selected) &&
    Object.keys(selected).join() === "kind,branch,period" && selected.branch === g.nobleBranch &&
    (selected.period === "day" ? pair.dayBranch : pair.nightBranch) === selected.branch;
  if (!ok3) check(`${tag} 対の FACT`, false, JSON.stringify(pair));
  const periods = BRANCHES.map((b) => dayNightNobleBranchPeriodsOf(facts, b).join("")).filter(Boolean);
  if (periods.sort().join() !== "day,night") check(`${tag} 昼・夜それぞれ1支だけに当たる`, false, periods.join());
  if (JSON.stringify(facts) !== before) check(`${tag} FACT 不変`, false);
  return { g, pair };
}

// ---- 1〜3. 720課と占時12支 ----
let n720 = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) { audit(STEMS[i % 10], BRANCHES[i % 12], "子", BRANCHES[o]); n720 += 1; }
check("720課を監査", n720 === 720);
const period: Record<string, number> = {};
const pairsByStem: Record<string, Set<string>> = {};
const measured: Record<string, { day: Set<Branch>; night: Set<Branch> }> = {};
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const stem = STEMS[i % 10];
  const { g, pair } = audit(stem, BRANCHES[i % 12], shi, BRANCHES[o]);
  inc(period, g.dayOrNight);
  (pairsByStem[stem] ??= new Set()).add(`${pair.dayBranch}${pair.nightBranch}`);
  measured[stem] ??= { day: new Set(), night: new Set() };
  // Phase 4E の実測と同じ方法: 採用された側だけを、昼占・夜占の盤から別々に集める
  measured[stem][pair.selected.period].add(pair.selected.branch);
}
check("8,640課: 昼占4,320・夜占4,320", period.昼 === 4320 && period.夜 === 4320, JSON.stringify(period));

// ---- 4. 日干10干の対 ----
// Phase 4E の実測結果（ユーザー提示）。照合のためだけに使い、解釈層には置かない
const PHASE4E: Record<Stem, [Branch, Branch]> = {
  甲: ["未", "丑"], 乙: ["申", "子"], 丙: ["酉", "亥"], 丁: ["亥", "酉"], 戊: ["丑", "未"],
  己: ["子", "申"], 庚: ["丑", "未"], 辛: ["寅", "午"], 壬: ["卯", "巳"], 癸: ["巳", "卯"],
};
for (const st of STEMS) {
  const pairs = [...pairsByStem[st]];
  const [d, n] = PHASE4E[st as Stem];
  check(`${st}: 対は1組で昼${d}・夜${n}`, pairs.length === 1 && pairs[0] === `${d}${n}`, pairs.join());
  check(`${st}: 対は採用された側の実測（昼占の盤・夜占の盤）と同じ`, [...measured[st].day].join() === d && [...measured[st].night].join() === n);
}

// ---- 5. Phase 4D・4E の13文 ----
type Cls = "A" | "B" | "C" | "D";
const SENTENCES: [id: string, day: string, jiang: Branch, shi: Branch, branches: Branch[], phase4e: "表せた" | "表せない" | "支なし", gist: string][] = [
  ["47-5", "丙寅", "亥", "申", ["亥"], "表せない", "簾幕貴人（天将盤が別方式の例）"],
  ["47-6", "丙寅", "亥", "申", ["亥"], "表せない", "中伝亥は空亡だが月将で簾幕貴人（天将盤が別方式の例）"],
  ["49-2", "己卯", "午", "丑", ["子", "申"], "表せない", "身宅みな貴人（子・申）"],
  ["49-3", "己卯", "午", "丑", ["申"], "表せた", "申は空亡で夜貴人となり宅にある"],
  ["51-1", "癸亥", "未", "巳", ["卯", "巳"], "表せない", "太陰が卯に乗じて幕貴、日貴（巳）は末伝"],
  ["51-2", "癸亥", "未", "巳", ["卯", "巳"], "表せない", "昼夜貴人が年命辰をはさむ"],
  ["51-3", "癸亥", "未", "巳", ["卯", "巳"], "表せない", "昼夜貴人が一課二課と中伝末伝"],
  ["52-1", "丁丑", "午", "辰", ["亥", "酉"], "表せない", "満局みな貴人"],
  ["52-4", "丁丑", "午", "辰", ["亥", "酉"], "表せない", "三伝日上ともに貴人"],
  ["52-5", "丁丑", "午", "辰", ["酉"], "表せない", "酉が日上に加わり、それに貴人を加える"],
  ["52-6", "丁丑", "午", "辰", ["亥", "酉"], "表せない", "一課二課ともに昼夜貴人"],
  ["52-7", "丁丑", "午", "辰", ["酉"], "表せない", "干上は空亡で貴人は落空"],
  ["52-9", "丁丑", "午", "辰", [], "支なし", "貴人が多くても貴とはいえない"],
];
const EXPECTED: Record<string, Cls> = {
  "47-5": "C", "47-6": "C", "49-2": "B", "49-3": "A", "51-1": "B", "51-2": "B", "51-3": "B",
  "52-1": "B", "52-4": "B", "52-5": "C", "52-6": "B", "52-7": "C", "52-9": "D",
};
const clsCount: Record<string, number> = {};
const lines: string[] = [];
let reachable = 0;
for (const [id, day, jiang, shi, branches, phase4e, gist] of SENTENCES) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
  const pair = dayNightNobleBranchPairStateOf(facts);
  const isSelected = (b: Branch) => b === pair.selected.branch;
  const inPair = (b: Branch) => b === pair.dayBranch || b === pair.nightBranch;
  let cls: Cls;
  if (!branches.length) cls = "D";
  else if (branches.length === 2 && branches.every(inPair) && branches[0] !== branches[1]) cls = "B";
  else if (branches.every(isSelected)) cls = "A";
  else cls = "C";
  check(`${id} の分類 ${EXPECTED[id]}`, cls === EXPECTED[id], cls);
  // 本文の支はすべて対のどちらかに到達できる
  const allReached = branches.every(inPair);
  check(`${id} 本文の貴人支（${branches.join("・") || "なし"}）へ対の FACT で到達できる`, allReached);
  if (phase4e === "表せない" && allReached) reachable += 1;
  inc(clsCount, cls);
  const where = branches.map((b) => `${b}=${dayNightNobleBranchPeriodsOf(facts, b).join("")}${isSelected(b) ? "（採用）" : ""}`).join("・");
  lines.push(`${id} ${day}日 ${jiang}将${shi}時: 対 昼${pair.dayBranch}・夜${pair.nightBranch} 採用 ${pair.selected.branch}（${pair.selected.period}） ／ 本文 ${where || "なし"} → ${cls} ／ ${gist}`);
}
check("Phase 4E で表せなかった11文がすべて到達できる", reachable === 11, String(reachable));
check("人物の貴人（例40-1・40-6）は入れていない", !SENTENCES.some(([id]) => id.startsWith("40-")));

// ---- 6. 解釈層のコード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const src = strip("src/lib/liuren/interpretation/dayNightNobleBranchPair.ts");
  const hit = ["NOBLE_DAY", "NOBLE_NIGHT", "DAY_BRANCHES", "divinationBranch", "簾幕", "幕貴", "generalOn", "HeavenlyGeneral",
    "InterpretationContext", "domain", "role", "authority", "support", "good", "auspicious", "effective", "吉", "凶"].filter((w) => src.includes(w));
  check("dayNightNobleBranchPair.ts に昼夜貴人表・昼夜判定・簾幕貴人・天将・ROLE・DOMAIN・吉凶が出てこない", hit.length === 0, hit.join(","));
  const interp = ["dayNightNobleBranch.ts", "dayNightNobleBranchPair.ts", "heavenlyGeneralState.ts", "roleRules.ts", "facts.ts"]
    .map((f) => strip(`src/lib/liuren/interpretation/${f}`)).join("\n");
  check("解釈層に NOBLE_DAY・NOBLE_NIGHT の複製・参照がない", !/NOBLE_DAY|NOBLE_NIGHT/.test(interp));
  const p4e = readFileSync("src/lib/liuren/interpretation/dayNightNobleBranch.ts", "utf8");
  check("Phase 4E の FACT（dayNightNobleBranch.ts）は nobleBranches を使っていない（採用された側のまま）", !p4e.includes("nobleBranches"));
  check("RoleMatcher に貴人支の matcher を足していない", !/nobleBranch|dayNightNoble/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
  check("十二天将の FACT（heavenlyGeneralState.ts）に貴人支を混ぜていない", !/noble/i.test(strip("src/lib/liuren/interpretation/heavenlyGeneralState.ts")));
}

console.log(`占時12支: ${JSON.stringify(period)}`);
console.log(`日干の対（起課メタデータ）: ${STEMS.map((st) => `${st} 昼${[...pairsByStem[st]][0][0]}・夜${[...pairsByStem[st]][0][1]}`).join(" ")}`);
console.log("13文の再監査:");
for (const l of lines) console.log(`  ${l}`);
console.log(`分類: ${JSON.stringify(clsCount)} ／ Phase 4E で表せなかった文のうち到達できたもの: ${reachable}/11`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
