// tests/liuren_interpretation_combinations.manual.ts
//
// 六壬神課 解釈エンジン Phase 3C（六合・破・害・三合・退間・五行墓庫への入墓）のテスト。
// 実行: npx tsx tests/liuren_interpretation_combinations.manual.ts
//
//   1. 六合・破・害: 6組ずつ・正逆両方向・それ以外の支の組では成り立たない・干には付かない
//   2. 複合: 寅亥・巳申＝combines＋breaks（巳申は刑・剋も）。複数の関係が失われない
//   3. 三合: 4局 × 6通りの並び・2支だけ・重複・別局の混在
//   4. 退間: −2・−2（12通りの起点）。+2・+2（進間）は「その他」。進茹・退茹は従来どおり
//   5. 五行墓庫への入墓: 5五行 × 12支。十二長生の墓とは別の関数・別の結果型
//   6. 三伝FLOW: threeHarmony・初→中 の relationBetween に六合・破・害が含まれる
//   7. 720課の監査: 進茹・退茹・退間・その他・完全三合局の件数（起課結果は書き換えない）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Element, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { relationBetween, threeHarmonyOf } from "../src/lib/liuren/interpretation/relations";
import { elementInTombOf, growthStageOf, isElementInTomb } from "../src/lib/liuren/interpretation/states";
import type {
  InterpretationFacts, StructuralRelation, TransmissionFact, TransmissionFlow,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const has = (a: Branch | Stem, b: Branch | Stem, r: StructuralRelation) => relationBetween(a, b).relations.includes(r);
const sorted = (xs: readonly string[]) => [...xs].sort().join(",");

// ---- 1. 六合・破・害 ----
const TABLES: [StructuralRelation, string[]][] = [
  ["combines", ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"]],
  ["breaks", ["子酉", "卯午", "丑辰", "未戌", "寅亥", "巳申"]],
  ["harms", ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]],
];
for (const [kind, pairs] of TABLES) {
  for (const p of pairs) {
    const [a, b] = [...p] as Branch[];
    check(`${kind} ${a}→${b}`, has(a, b, kind));
    check(`${kind} ${b}→${a}`, has(b, a, kind));
  }
  // 144通りの支の組で、ちょうど表の6組×2方向だけに付く
  const hits: string[] = [];
  for (const a of BRANCHES) for (const b of BRANCHES) if (has(a, b, kind)) hits.push(`${a}${b}`);
  const expected = pairs.flatMap((p) => [p, [...p].reverse().join("")]);
  check(`${kind} は表の組だけ`, sorted(hits) === sorted(expected), hits.join(" "));
}
check("干には六合を付けない（甲己）", !has("甲", "己", "combines"));
check("干と支には付けない（甲・亥）", !has("甲", "亥", "combines") && !has("甲", "亥", "breaks"));

// ---- 2. 複合 ----
const COMPOUND: [Branch, Branch, StructuralRelation[]][] = [
  ["寅", "亥", ["generatedBy", "combines", "breaks"]],          // 水生木・寅亥合・寅亥破
  ["亥", "寅", ["generates", "combines", "breaks"]],
  ["巳", "申", ["overcomes", "punishes", "combines", "breaks"]], // 火剋金・巳刑申・巳申合・巳申破
  ["申", "巳", ["overcomeBy", "punishedBy", "combines", "breaks"]],
  ["寅", "巳", ["generates", "punishes", "harms"]],              // 刑と害
  ["子", "未", ["overcomeBy", "harms"]],                         // 土剋水・子未害
  ["子", "酉", ["generatedBy", "breaks"]],                       // 金生水・子酉破
  ["卯", "午", ["generates", "breaks"]],
  ["丑", "戌", ["sameElement", "punishes"]],                     // 刑だけ（六合・破・害なし）
  ["子", "午", ["overcomes", "clashes"]],
];
for (const [a, b, rs] of COMPOUND) {
  const got = relationBetween(a, b).relations;
  check(`複合 ${a}→${b}`, sorted(got) === sorted(rs), `${got.join(",")} / ${rs.join(",")}`);
}

// ---- 3. 三合 ----
const GROUPS: [string, Element][] = [["亥卯未", "木"], ["寅午戌", "火"], ["巳酉丑", "金"], ["申子辰", "水"]];
const perms = (s: string): string[] => {
  const [a, b, c] = [...s];
  return [a + b + c, a + c + b, b + a + c, b + c + a, c + a + b, c + b + a];
};
for (const [g, el] of GROUPS) {
  for (const p of perms(g)) {
    const t = [...p] as [Branch, Branch, Branch];
    const r = threeHarmonyOf(t);
    check(`三合 ${p}＝${el}局`, r.complete && r.element === el && r.branches.join("") === p, JSON.stringify(r));
  }
}
for (const p of ["亥卯卯", "亥卯辰", "寅午子", "未未未", "亥亥卯", "申子午"]) {
  const r = threeHarmonyOf([...p] as [Branch, Branch, Branch]);
  check(`三合でない ${p}`, !r.complete && !("element" in r), JSON.stringify(r));
}

// ---- 三伝の FACT を差し替えるための土台 ----
const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
function flowOf(branches: string): TransmissionFlow {
  const t = [...branches].map((b, i): TransmissionFact => ({ ...BASE.transmissions![i], branch: b as Branch }));
  const facts: InterpretationFacts = { ...BASE, transmissions: [t[0], t[1], t[2]] };
  const r = analyzeTransmissionFlow(facts);
  if (r.status !== "determined") throw new Error("三伝確定のはず");
  return r;
}

// ---- 4. 退間 ----
for (const b of ["亥酉未", "酉未巳", "未巳卯", "巳卯丑", "卯丑亥", "丑亥酉", "戌申午", "午辰寅", "寅子戌", "子戌申", "申午辰", "辰寅子"]) {
  const got = flowOf(b).movementPattern;
  check(`退間 ${b}`, got === "退間", got);
}
for (const b of ["子寅辰", "亥丑卯", "戌子寅"]) {
  const got = flowOf(b).movementPattern;
  check(`+2・+2（進間は未判定）${b}＝その他`, got === "その他", got);
}
for (const b of ["亥酉申", "亥戌申", "子戌酉"]) {
  const got = flowOf(b).movementPattern;
  check(`−2 が続かない ${b}＝その他`, got === "その他", got);
}
for (const [b, m] of [["寅卯辰", "進茹"], ["亥子丑", "進茹"], ["辰卯寅", "退茹"], ["丑子亥", "退茹"]] as const) {
  const got = flowOf(b).movementPattern;
  check(`従来の判定 ${b}＝${m}`, got === m, got);
}

// ---- 5. 五行墓庫への入墓 ----
const TOMB: Record<Element, Branch> = { 木: "未", 火: "戌", 土: "戌", 金: "丑", 水: "辰" };
for (const el of Object.keys(TOMB) as Element[]) {
  for (const b of BRANCHES) {
    const expected = TOMB[el] === b;
    const fact = elementInTombOf(el, b);
    check(`入墓 ${el}＋${b}＝${expected}`, isElementInTomb(el, b) === expected && fact.inTomb === expected &&
      fact.kind === "elementInTomb" && fact.tombBranch === TOMB[el] && fact.element === el && fact.branch === b, JSON.stringify(fact));
    // 十二長生の墓は別の関数で、段階名（文字列）を返す。五行生墓法では同じ支に当たる
    const stage = growthStageOf(el, b);
    check(`十二長生 ${el}${b} は文字列で、墓の支は墓庫と一致`, typeof stage === "string" && (stage === "墓") === expected, stage);
  }
}
check("入墓の結果はオブジェクト・十二長生の墓は文字列（型が別）",
  typeof elementInTombOf("木", "未") === "object" && growthStageOf("木", "未") === "墓");

// ---- 6. 三伝FLOW ----
{
  const f = flowOf("亥卯未");
  check("FLOW 三合 亥卯未＝木局", f.threeHarmony.complete && f.threeHarmony.element === "木", JSON.stringify(f.threeHarmony));
  check("FLOW 三合でない 寅卯辰", !flowOf("寅卯辰").threeHarmony.complete);
  const g = flowOf("寅亥申");
  check("FLOW 初→中 寅亥＝combines＋breaks", sorted(g.branchRelations.initialToMiddle.relations) === sorted(["generatedBy", "combines", "breaks"]),
    g.branchRelations.initialToMiddle.relations.join(","));
  check("FLOW 中→末 亥申＝harms", g.branchRelations.middleToFinal.relations.includes("harms"), g.branchRelations.middleToFinal.relations.join(","));
}

// ---- 7. 720課の監査 ----
const moves: Record<string, number> = { 進茹: 0, 退茹: 0, 退間: 0, その他: 0 };
const harmony: Record<string, number> = { 木: 0, 火: 0, 金: 0, 水: 0 };
let complete = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const r = analyzeTransmissionFlow(buildInterpretationFacts(chart));
    if (r.status !== "determined") {
      check(`${STEMS[i % 10]}${BRANCHES[i % 12]}+${o} 確定`, false);
      continue;
    }
    moves[r.movementPattern] += 1;
    if (r.threeHarmony.complete) {
      complete += 1;
      harmony[r.threeHarmony.element] += 1;
    }
    check(`${STEMS[i % 10]}${BRANCHES[i % 12]}+${o} 不変`, JSON.stringify(chart) === before);
  }
}
check("720課 進退の合計", moves.進茹 + moves.退茹 + moves.退間 + moves.その他 === 720, JSON.stringify(moves));

console.log(`720課 進退: ${JSON.stringify(moves)}`);
console.log(`720課 完全三合局: ${complete}（${JSON.stringify(harmony)}）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
