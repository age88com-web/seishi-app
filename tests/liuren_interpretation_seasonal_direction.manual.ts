// tests/liuren_interpretation_seasonal_direction.manual.ts
//
// 六壬神課 解釈エンジン Phase 3J（季節内の進気・退気）のテスト。
// 実行: npx tsx tests/liuren_interpretation_seasonal_direction.manual.ts
//
//   1. 十二支×十二支＝144組の完全走査: advancing 4組・retreating 4組・none 136組。五行・季節は8組だけ
//   2. 指定例（8組・土支・同支・境界の none）
//   3. 三伝2区間への適用（亥子丑・子亥戌・丑子亥）、三伝未確定は null
//   4. 既存の FACT・FLOW（movementPattern・growthStage・seasonalStrength など）を書き換えない
//   5. 720課の監査: 区間別・合計の件数、movementPattern とのクロス集計、進茹以外の advancing・退茹以外の retreating の例

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import {
  seasonalBranchDirectionBetween, transmissionSeasonalDirection,
} from "../src/lib/liuren/interpretation/seasonalDirection";
import type { InterpretationFacts, SeasonalBranchDirection, TransmissionFact } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

// ---- 1. 144組 ----
const EXPECTED: Record<string, [SeasonalBranchDirection, string, string]> = {
  寅卯: ["advancing", "木", "spring"], 卯寅: ["retreating", "木", "spring"],
  巳午: ["advancing", "火", "summer"], 午巳: ["retreating", "火", "summer"],
  申酉: ["advancing", "金", "autumn"], 酉申: ["retreating", "金", "autumn"],
  亥子: ["advancing", "水", "winter"], 子亥: ["retreating", "水", "winter"],
};
const tally: Record<SeasonalBranchDirection, number> = { advancing: 0, retreating: 0, none: 0 };
for (const a of BRANCHES) {
  for (const b of BRANCHES) {
    const f = seasonalBranchDirectionBetween(a, b);
    tally[f.direction] += 1;
    const e = EXPECTED[a + b];
    const ok = f.from === a && f.to === b && (e
      ? f.direction === e[0] && f.element === e[1] && f.season === e[2]
      : f.direction === "none" && f.element === null && f.season === null);
    check(`144組 ${a}→${b}`, ok, JSON.stringify(f));
  }
}
check("144組 advancing 4・retreating 4・none 136", tally.advancing === 4 && tally.retreating === 4 && tally.none === 136, JSON.stringify(tally));

// ---- 2. 指定例 ----
const CASES: [Branch, Branch, SeasonalBranchDirection][] = [
  ["寅", "卯", "advancing"], ["卯", "寅", "retreating"], ["巳", "午", "advancing"], ["午", "巳", "retreating"],
  ["申", "酉", "advancing"], ["酉", "申", "retreating"], ["亥", "子", "advancing"], ["子", "亥", "retreating"],
  ["辰", "巳", "none"], ["丑", "寅", "none"], ["子", "丑", "none"], ["戌", "亥", "none"],
  ["寅", "寅", "none"], ["卯", "卯", "none"],
];
for (const [a, b, d] of CASES) check(`指定例 ${a}→${b}＝${d}`, seasonalBranchDirectionBetween(a, b).direction === d);
// 土支は前後どちらにあっても none（土の進神規則は持たない）
for (const s of ["辰", "未", "戌", "丑"] as Branch[]) {
  check(`土支 ${s} は進退にならない`, BRANCHES.every((x) =>
    seasonalBranchDirectionBetween(s, x).direction === "none" && seasonalBranchDirectionBetween(x, s).direction === "none"));
}
// 同支はすべて none
check("同支は none", BRANCHES.every((x) => seasonalBranchDirectionBetween(x, x).direction === "none"));

// ---- 3. 三伝 ----
const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
function withTransmissions(b: string): InterpretationFacts {
  const t = [...b].map((x, i): TransmissionFact => ({ ...BASE.transmissions![i], branch: x as Branch }));
  return { ...BASE, transmissions: [t[0], t[1], t[2]] };
}
const dirs = (b: string) => {
  const r = transmissionSeasonalDirection(withTransmissions(b))!;
  return `${r.initialToMiddle.direction},${r.middleToFinal.direction}`;
};
check("亥→子→丑（進茹）＝advancing,none", dirs("亥子丑") === "advancing,none", dirs("亥子丑"));
check("子→亥→戌（退茹）＝retreating,none", dirs("子亥戌") === "retreating,none", dirs("子亥戌"));
check("丑→子→亥（退茹）＝none,retreating", dirs("丑子亥") === "none,retreating", dirs("丑子亥"));
check("寅→卯→寅＝advancing,retreating", dirs("寅卯寅") === "advancing,retreating", dirs("寅卯寅"));
{
  const r = transmissionSeasonalDirection(withTransmissions("亥子丑"))!;
  check("区間の支を保持", r.initialToMiddle.from === "亥" && r.initialToMiddle.to === "子" && r.middleToFinal.from === "子" &&
    r.middleToFinal.to === "丑" && r.initialToMiddle.element === "水" && r.initialToMiddle.season === "winter");
}
check("三伝未確定 → null", transmissionSeasonalDirection({ ...BASE, transmissions: null }) === null);

// ---- 4・5. 720課 ----
const D: SeasonalBranchDirection[] = ["advancing", "retreating", "none"];
const zero = () => ({ advancing: 0, retreating: 0, none: 0 });
const seg = { initialToMiddle: zero(), middleToFinal: zero(), 合計: zero() };
const MOVES = ["進茹", "退茹", "進間", "退間", "その他"];
const cross: Record<string, { initialToMiddle: Record<SeasonalBranchDirection, number>; middleToFinal: Record<SeasonalBranchDirection, number>; 課数: number }> =
  Object.fromEntries(MOVES.map((m) => [m, { initialToMiddle: zero(), middleToFinal: zero(), 課数: 0 }]));
const advNotJinru: string[] = [];
const retNotTuiru: string[] = [];
const advNotJinruByMove: Record<string, number> = {};
const retNotTuiruByMove: Record<string, number> = {};
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const month = BRANCHES[(i + o) % 12];
    const flowBefore = JSON.stringify(analyzeTransmissionFlow(facts, month));
    const r = transmissionSeasonalDirection(facts)!;
    const flow = analyzeTransmissionFlow(facts, month);
    check(`${day}+${o} FLOW 不変（movementPattern・growthStage・seasonalStrength）`, JSON.stringify(flow) === flowBefore);
    check(`${day}+${o} 起課結果不変`, JSON.stringify(chart) === before);
    if (flow.status !== "determined") {
      check(`${day}+${o} 確定`, false);
      continue;
    }
    // 月支に依らない（12か月で同じ）
    check(`${day}+${o} 月支に依らない`, JSON.stringify(transmissionSeasonalDirection(facts)) === JSON.stringify(r));
    const ts = facts.transmissions!.map((t) => t.branch).join("");
    const m = flow.movementPattern;
    cross[m].課数 += 1;
    for (const k of ["initialToMiddle", "middleToFinal"] as const) {
      const d = r[k].direction;
      seg[k][d] += 1;
      seg.合計[d] += 1;
      cross[m][k][d] += 1;
      check(`${day}+${o} ${k} 支から直接`, d === seasonalBranchDirectionBetween(r[k].from, r[k].to).direction);
    }
    const hasAdv = r.initialToMiddle.direction === "advancing" || r.middleToFinal.direction === "advancing";
    const hasRet = r.initialToMiddle.direction === "retreating" || r.middleToFinal.direction === "retreating";
    if (hasAdv && m !== "進茹") {
      advNotJinruByMove[m] = (advNotJinruByMove[m] ?? 0) + 1;
      if (advNotJinru.length < 6) advNotJinru.push(`${day}日 天盤差${o} 三伝 ${ts}（${m}）: ${r.initialToMiddle.direction} / ${r.middleToFinal.direction}`);
    }
    if (hasRet && m !== "退茹") {
      retNotTuiruByMove[m] = (retNotTuiruByMove[m] ?? 0) + 1;
      if (retNotTuiru.length < 6) retNotTuiru.push(`${day}日 天盤差${o} 三伝 ${ts}（${m}）: ${r.initialToMiddle.direction} / ${r.middleToFinal.direction}`);
    }
  }
}
check("区間ごとの合計＝720", D.reduce((a, d) => a + seg.initialToMiddle[d], 0) === 720 && D.reduce((a, d) => a + seg.middleToFinal[d], 0) === 720);

const fmt = (o: Record<SeasonalBranchDirection, number>) => D.map((d) => `${d} ${o[d]}`).join(" / ");
console.log(`720課 initialToMiddle: ${fmt(seg.initialToMiddle)}`);
console.log(`720課 middleToFinal:   ${fmt(seg.middleToFinal)}`);
console.log(`720課 2区間合計:       ${fmt(seg.合計)}`);
console.log("movementPattern とのクロス集計:");
for (const m of MOVES) {
  console.log(`  ${m}（${cross[m].課数}課） 初→中: ${fmt(cross[m].initialToMiddle)} ｜ 中→末: ${fmt(cross[m].middleToFinal)}`);
}
console.log(`advancing を含むが進茹でない課: ${JSON.stringify(advNotJinruByMove)}`);
for (const x of advNotJinru) console.log(`    ${x}`);
console.log(`retreating を含むが退茹でない課: ${JSON.stringify(retNotTuiruByMove)}`);
for (const x of retNotTuiru) console.log(`    ${x}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
