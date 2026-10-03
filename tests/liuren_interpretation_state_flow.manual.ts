// tests/liuren_interpretation_state_flow.manual.ts
//
// 六壬神課 解釈エンジン Phase 3G（気勢の遷移: 十二長生・旺相休囚死）のテスト。
// 実行: npx tsx tests/liuren_interpretation_state_flow.manual.ts
//
//   1. 十二長生 12×12 の forwardSteps / backwardSteps（循環境界 墓→絶・絶→胎・胎→養・養→長生 を含む）
//   2. 三伝の遷移が TransmissionFlow.growthStages と一致し、陰干も逆行しない
//   3. 旺相休囚死の遷移が seasonalStrength と一致。月支なしでは seasonalTransitions = null
//   4. 遷移の検索（findGrowthTransitions）
//   5. movementPattern・generationFlow など既存の FLOW を書き換えない
//   6. 720課の監査: 十二長生で連続順行・連続逆行する三伝、旺相休囚死の変化の分布（720課 × 月支12）
//      五行生墓法では十二長生の段数が支の差と常に等しい（連続順行＝進茹・連続逆行＝退茹）ことも確認する

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { GROWTH_STAGES } from "../src/lib/liuren/interpretation/states";
import { findGrowthTransitions, growthSteps, stateTransitionsOf } from "../src/lib/liuren/interpretation/stateFlow";
import type {
  GrowthStage, InterpretationFacts, StateTransitions, TransmissionFact, TransmissionFlow,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

// ---- 1. 段数 ----
const ORDER = "長生 沐浴 冠帯 臨官 帝旺 衰 病 死 墓 絶 胎 養".split(" ") as GrowthStage[];
check("循環順は GROWTH_STAGES と同じ", GROWTH_STAGES.join() === ORDER.join());
for (let a = 0; a < 12; a++) {
  for (let b = 0; b < 12; b++) {
    const st = growthSteps(ORDER[a], ORDER[b]);
    const f = (b - a + 12) % 12;
    const back = (a - b + 12) % 12;
    check(`段数 ${ORDER[a]}→${ORDER[b]}`, st.forwardSteps === f && st.backwardSteps === back &&
      (f === 0 ? back === 0 : f + back === 12), JSON.stringify(st));
  }
}
const BOUNDARY: [GrowthStage, GrowthStage][] = [["墓", "絶"], ["絶", "胎"], ["胎", "養"], ["養", "長生"], ["長生", "沐浴"]];
for (const [a, b] of BOUNDARY) {
  const st = growthSteps(a, b);
  check(`境界 ${a}→${b}＝順1・逆11`, st.forwardSteps === 1 && st.backwardSteps === 11, JSON.stringify(st));
  const rev = growthSteps(b, a);
  check(`境界 ${b}→${a}＝順11・逆1`, rev.forwardSteps === 11 && rev.backwardSteps === 1, JSON.stringify(rev));
}
check("同じ段階＝0・0", growthSteps("墓", "墓").forwardSteps === 0 && growthSteps("墓", "墓").backwardSteps === 0);
check("長生→墓＝順8・逆4（近い方に潰さない）", growthSteps("長生", "墓").forwardSteps === 8 && growthSteps("長生", "墓").backwardSteps === 4);

// ---- 三伝を差し替えた FLOW ----
const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
function flowOf(day: string, branches: string, month?: Branch): TransmissionFlow {
  const t = [...branches].map((b, i): TransmissionFact => ({ ...BASE.transmissions![i], branch: b as Branch }));
  const facts: InterpretationFacts = {
    ...BASE, basic: { ...BASE.basic, dayStem: day[0] as Stem, dayBranch: day[1] as Branch }, transmissions: [t[0], t[1], t[2]],
  };
  const r = analyzeTransmissionFlow(facts, month);
  if (r.status !== "determined") throw new Error("確定のはず");
  return r;
}
const seq = (st: StateTransitions) => `${st.growthSequence.initial}→${st.growthSequence.middle}→${st.growthSequence.final}`;

// ---- 2. 十二長生の遷移 ----
{
  // 甲日（木）: 未＝墓・申＝絶・酉＝胎
  const st = stateTransitionsOf(flowOf("甲子", "未申酉"));
  check("甲日 未申酉＝墓→絶→胎", seq(st) === "墓→絶→胎", seq(st));
  const [t1, t2] = st.growthTransitions;
  check("初→中 墓→絶 順1", t1.fromPosition === "initial" && t1.toPosition === "middle" && t1.from === "墓" && t1.to === "絶" &&
    t1.forwardSteps === 1 && t1.backwardSteps === 11);
  check("中→末 絶→胎 順1", t2.fromPosition === "middle" && t2.toPosition === "final" && t2.forwardSteps === 1);
  // 陰干も逆行しない（乙日も甲日と同じ並び）
  check("乙日 未申酉＝墓→絶→胎（陰干逆行なし）", seq(stateTransitionsOf(flowOf("乙丑", "未申酉"))) === "墓→絶→胎");
  // 癸日（水）: 酉＝沐浴・申＝長生・未＝養 は逆に1段ずつ
  const r = stateTransitionsOf(flowOf("癸酉", "酉申未"));
  check("癸日 酉申未＝沐浴→長生→養（逆1・逆1）", seq(r) === "沐浴→長生→養" &&
    r.growthTransitions.every((t) => t.backwardSteps === 1 && t.forwardSteps === 11), seq(r));
}

// ---- 3. 旺相休囚死 ----
{
  const f = flowOf("甲子", "寅巳辰", "卯"); // 木旺: 寅旺・巳相・辰死
  const st = stateTransitionsOf(f);
  check("旺衰の並び＝seasonalStrength", st.seasonalSequence !== null && f.seasonalStrength !== null &&
    st.seasonalSequence.initial === f.seasonalStrength.initial && st.seasonalSequence.middle === f.seasonalStrength.middle &&
    st.seasonalSequence.final === f.seasonalStrength.final, JSON.stringify(st.seasonalSequence));
  const [a, b] = st.seasonalTransitions!;
  check("旺→相・相→死", a.from === "旺" && a.to === "相" && a.changed && a.fromPosition === "initial" &&
    b.from === "相" && b.to === "死" && b.changed && b.toPosition === "final", JSON.stringify(st.seasonalTransitions));
  const same = stateTransitionsOf(flowOf("甲子", "申酉申", "酉"));
  check("旺→旺・旺→旺 は changed=false", same.seasonalTransitions!.every((t) => !t.changed && t.from === "旺"));
  const none = stateTransitionsOf(flowOf("甲子", "寅巳辰"));
  check("月支なし → seasonalSequence・seasonalTransitions null、十二長生はある",
    none.seasonalSequence === null && none.seasonalTransitions === null && none.growthTransitions.length === 2);
}

// ---- 4. 検索 ----
{
  const st = stateTransitionsOf(flowOf("甲子", "未申酉"));
  check("墓・絶 → 胎・養・長生", findGrowthTransitions(st, ["墓", "絶"], ["胎", "養", "長生"]).map((t) => `${t.from}${t.to}`).join() === "絶胎");
  check("墓 → 絶", findGrowthTransitions(st, ["墓"], ["絶"]).length === 1);
  check("帝旺 → 衰 はなし", findGrowthTransitions(st, ["帝旺"], ["衰"]).length === 0);
  const gen = stateTransitionsOf(flowOf("甲子", "亥未亥")); // 長生→墓→長生
  check("生→墓・墓→生", findGrowthTransitions(gen, ["長生"], ["墓"]).length === 1 && findGrowthTransitions(gen, ["墓"], ["長生"]).length === 1);
}

// ---- 5・6. 720課 ----
const forward: Record<string, number> = {};
const backward: Record<string, number> = {};
const seasonal = { 全部同じ: 0, 初中同じ末変化: 0, 初変化中末同じ: 0, 初末同じ中変化: 0, 三伝すべて異なる: 0 };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    for (let m = 0; m < 12; m++) {
      const flow = analyzeTransmissionFlow(facts, BRANCHES[m]);
      if (flow.status !== "determined") {
        check(`${tag} 確定`, false);
        continue;
      }
      const before = JSON.stringify(flow);
      const st = stateTransitionsOf(flow);
      if (m === 0) {
        check(`${tag} FLOW 不変（movementPattern・generationFlow など）`, JSON.stringify(flow) === before);
        check(`${tag} 十二長生の並び`, st.growthSequence.initial === flow.growthStages.initial &&
          st.growthSequence.middle === flow.growthStages.middle && st.growthSequence.final === flow.growthStages.final);
        const [a, b] = st.growthTransitions;
        // 五行生墓法では起点が日干の五行で固定・一律順行のため、十二長生の順の段数＝支の順の差になる
        const step = (x: Branch, y: Branch) => (BRANCHES.indexOf(y) - BRANCHES.indexOf(x) + 12) % 12;
        check(`${tag} 十二長生の段数＝支の差`, a.forwardSteps === step(flow.branches.initial, flow.branches.middle) &&
          b.forwardSteps === step(flow.branches.middle, flow.branches.final));
        if ((a.forwardSteps === 1 && b.forwardSteps === 1) !== (flow.movementPattern === "進茹")) check(`${tag} 連続順行＝進茹`, false);
        if ((a.backwardSteps === 1 && b.backwardSteps === 1) !== (flow.movementPattern === "退茹")) check(`${tag} 連続逆行＝退茹`, false);
        if (a.forwardSteps === 1 && b.forwardSteps === 1) forward[seq(st)] = (forward[seq(st)] ?? 0) + 1;
        if (a.backwardSteps === 1 && b.backwardSteps === 1) backward[seq(st)] = (backward[seq(st)] ?? 0) + 1;
      }
      const s = st.seasonalSequence!;
      check(`${tag} 月${BRANCHES[m]} 旺衰`, s.initial === flow.seasonalStrength!.initial && s.final === flow.seasonalStrength!.final);
      if (s.initial === s.middle && s.middle === s.final) seasonal.全部同じ += 1;
      else if (s.initial === s.middle) seasonal.初中同じ末変化 += 1;
      else if (s.middle === s.final) seasonal.初変化中末同じ += 1;
      else if (s.initial === s.final) seasonal.初末同じ中変化 += 1;
      else seasonal.三伝すべて異なる += 1;
    }
  }
}
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
check("旺衰の分布の合計＝720×12", total(seasonal) === 8640, JSON.stringify(seasonal));

console.log(`720課 十二長生 連続順行（順1・順1）: ${total(forward)}件`);
for (const [k, v] of top(forward, 12)) console.log(`    ${k}: ${v}`);
console.log(`720課 十二長生 連続逆行（逆1・逆1）: ${total(backward)}件（${Object.keys(backward).length}種）`);
for (const [k, v] of top(backward, 10)) console.log(`    ${k}: ${v}`);
console.log(`720課×月支12 旺相休囚死の変化: ${JSON.stringify(seasonal)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
