// tests/liuren_interpretation_qi_state.manual.ts
//
// 六壬神課 解釈エンジン Phase 3H（気勢状態の分類）のテスト。
// 実行: npx tsx tests/liuren_interpretation_qi_state.manual.ts
//
//   1. 十二長生12段階 → GrowthPhase（絶は terminal ではなく renewingBoundary）
//   2. 各伝の growthStage・growthPhase・seasonalStrength・isVoid が既存 FLOW と一致。月支なしは null
//   3. 大分類の遷移と境目（A〜F）。飛び越し・逆向き・同じ大分類は boundary=null
//   4. 既存の stateFlow・FLOW を書き換えない
//   5. 720課×月支12 の監査: growthPhase × 旺相休囚死 の全組合せ、重要な交差8種の件数と実課例、
//      720課の growthPhase 三伝配列の上位20

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { growthPhaseOf, qiStatesOf } from "../src/lib/liuren/interpretation/qiState";
import { stateTransitionsOf } from "../src/lib/liuren/interpretation/stateFlow";
import { GROWTH_STAGES } from "../src/lib/liuren/interpretation/states";
import type {
  GrowthPhase, GrowthStage, InterpretationFacts, SeasonalStrength, TransmissionFact, TransmissionFlow, TransmissionPosition,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

// ---- 1. 分類 ----
const EXPECTED: Record<GrowthStage, GrowthPhase> = {
  胎: "emerging", 養: "emerging",
  長生: "growing", 沐浴: "growing", 冠帯: "growing", 臨官: "growing",
  帝旺: "peak", 衰: "declining", 病: "declining",
  死: "terminal", 墓: "terminal", 絶: "renewingBoundary",
};
for (const s of GROWTH_STAGES) check(`分類 ${s}＝${EXPECTED[s]}`, growthPhaseOf(s) === EXPECTED[s], growthPhaseOf(s));
check("絶は terminal ではない", growthPhaseOf("絶") === "renewingBoundary" && growthPhaseOf("絶") !== "terminal");

// ---- 三伝を差し替えた FLOW ----
const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
function flowOf(day: string, branches: string, month?: Branch, voids: [boolean, boolean, boolean] = [false, false, false]): TransmissionFlow {
  const t = [...branches].map((b, i): TransmissionFact => ({ ...BASE.transmissions![i], branch: b as Branch, isVoid: voids[i] }));
  const facts: InterpretationFacts = {
    ...BASE, basic: { ...BASE.basic, dayStem: day[0] as Stem, dayBranch: day[1] as Branch }, transmissions: [t[0], t[1], t[2]],
  };
  const r = analyzeTransmissionFlow(facts, month);
  if (r.status !== "determined") throw new Error("確定のはず");
  return r;
}
const phases = (f: TransmissionFlow) => {
  const q = qiStatesOf(f);
  return `${q.qiStates.initial.growthPhase}→${q.qiStates.middle.growthPhase}→${q.qiStates.final.growthPhase}`;
};
const boundaries = (f: TransmissionFlow) => qiStatesOf(f).phaseTransitions.map((t) => t.boundary ?? "null").join(",");

// ---- 2. 各伝の状態 ----
{
  // 甲日・卯月（木旺）: 未＝墓・旺衰は土＝死、申＝絶・金＝囚、酉＝胎・金＝囚。中伝を空亡にする
  const f = flowOf("甲子", "未申酉", "卯", [false, true, false]);
  const q = qiStatesOf(f).qiStates;
  check("初伝 未＝墓・terminal・死", q.initial.position === "initial" && q.initial.branch === "未" && q.initial.growthStage === "墓" &&
    q.initial.growthPhase === "terminal" && q.initial.seasonalStrength === "死" && !q.initial.isVoid, JSON.stringify(q.initial));
  check("中伝 申＝絶・renewingBoundary・囚・空亡", q.middle.growthStage === "絶" && q.middle.growthPhase === "renewingBoundary" &&
    q.middle.seasonalStrength === "囚" && q.middle.isVoid, JSON.stringify(q.middle));
  check("末伝 酉＝胎・emerging・囚", q.final.growthStage === "胎" && q.final.growthPhase === "emerging" && q.final.seasonalStrength === "囚",
    JSON.stringify(q.final));
  const n = qiStatesOf(flowOf("甲子", "未申酉")).qiStates;
  check("月支なし → seasonalStrength null（十二長生はある）",
    n.initial.seasonalStrength === null && n.middle.seasonalStrength === null && n.final.seasonalStrength === null && n.initial.growthStage === "墓");
  // 陰干も逆行しない
  check("乙日も甲日と同じ分類", phases(flowOf("乙丑", "未申酉")) === phases(flowOf("甲子", "未申酉")));
}

// ---- 3. 遷移と境目 ----
const CASES: [string, string, string, string][] = [
  // [日, 三伝, 大分類の並び, 境目]
  ["甲子", "寅卯辰", "growing→peak→declining", "growingToPeak,peakToDeclining"],           // 臨官・帝旺・衰
  ["甲子", "未申酉", "terminal→renewingBoundary→emerging", "terminalToRenewing,renewingToEmerging"], // 墓・絶・胎
  ["甲子", "巳午未", "declining→terminal→terminal", "decliningToTerminal,null"],          // 病・死・墓
  ["甲子", "戌亥子", "emerging→growing→growing", "emergingToGrowing,null"],               // 養・長生・沐浴
  ["甲子", "亥卯未", "growing→peak→terminal", "growingToPeak,null"],                      // 長生・帝旺・墓（飛び越し）
  ["甲子", "辰卯寅", "declining→peak→growing", "null,null"],                              // 逆向きは境目にしない
  ["甲子", "子子子", "growing→growing→growing", "null,null"],
];
for (const [day, b, p, bd] of CASES) {
  const f = flowOf(day, b);
  check(`遷移 ${day} ${b}＝${p}`, phases(f) === p, phases(f));
  check(`境目 ${day} ${b}＝${bd}`, boundaries(f) === bd, boundaries(f));
}
{
  const [t1, t2] = qiStatesOf(flowOf("甲子", "子子丑")).phaseTransitions;
  check("同じ大分類は changed=false", !t1.changed && t1.fromPosition === "initial" && t1.toPosition === "middle" &&
    !t2.changed && t2.fromPosition === "middle" && t2.toPosition === "final");
}

// ---- 4・5. 720課×月支12 ----
const PHASES: GrowthPhase[] = ["emerging", "growing", "peak", "declining", "terminal", "renewingBoundary"];
const STRENGTHS: SeasonalStrength[] = ["旺", "相", "休", "囚", "死"];
const matrix: Record<string, number> = {};
for (const p of PHASES) for (const s of STRENGTHS) matrix[`${p}×${s}`] = 0;
const CROSSES = ["terminal×旺", "terminal×相", "emerging×囚", "emerging×死", "declining×旺", "growing×死", "renewingBoundary×旺", "renewingBoundary×死"];
const examples: Record<string, string[]> = Object.fromEntries(CROSSES.map((c) => [c, []]));
const exampleDays: Record<string, Set<string>> = Object.fromEntries(CROSSES.map((c) => [c, new Set<string>()]));
const sequences: Record<string, number> = {};
const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const POS_LABEL = { initial: "初伝", middle: "中伝", final: "末伝" };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
    for (let m = 0; m < 12; m++) {
      const month = BRANCHES[m];
      const flow = analyzeTransmissionFlow(facts, month);
      if (flow.status !== "determined") {
        check(`${day}+${o} 確定`, false);
        continue;
      }
      const before = JSON.stringify(flow) + JSON.stringify(stateTransitionsOf(flow));
      const q = qiStatesOf(flow);
      check(`${day}+${o} 月${month} FLOW・stateFlow 不変`, JSON.stringify(flow) + JSON.stringify(stateTransitionsOf(flow)) === before);
      for (const p of POS) {
        const s = q.qiStates[p];
        if (m === 0) {
          check(`${day}+${o} ${p} 既存と一致`, s.branch === flow.branches[p] && s.growthStage === flow.growthStages[p] &&
            s.growthPhase === growthPhaseOf(flow.growthStages[p]) && s.isVoid === flow.voidStages[p]);
        }
        check(`${day}+${o} 月${month} ${p} 旺衰`, s.seasonalStrength === flow.seasonalStrength![p]);
        const key = `${s.growthPhase}×${s.seasonalStrength}`;
        matrix[key] += 1;
        if (key in examples && examples[key].length < 3 && !exampleDays[key].has(day)) {
          exampleDays[key].add(day);
          const ts = `${flow.branches.initial}${flow.branches.middle}${flow.branches.final}`;
          examples[key].push(`${day}日 月${month} | 三伝 ${ts} | ${POS_LABEL[p]} ${s.branch} | ${s.growthStage}・${s.growthPhase}・${s.seasonalStrength}`);
        }
      }
      if (m === 0) {
        const k = `${q.qiStates.initial.growthPhase}→${q.qiStates.middle.growthPhase}→${q.qiStates.final.growthPhase}`;
        sequences[k] = (sequences[k] ?? 0) + 1;
      }
    }
  }
}
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("組合せの合計＝720×12×3", total(matrix) === 720 * 12 * 3, String(total(matrix)));
check("三伝配列の合計＝720", total(sequences) === 720, String(total(sequences)));

console.log("720課×月支12 growthPhase × 旺相休囚死（各伝で数える）:");
for (const p of PHASES) console.log(`  ${p}: ${STRENGTHS.map((s) => `${s}${matrix[`${p}×${s}`]}`).join(" ")}`);
console.log("重要な交差:");
for (const c of CROSSES) {
  console.log(`  ${c}: ${matrix[c]}`);
  for (const e of examples[c]) console.log(`      ${e}`);
}
console.log(`720課 growthPhase 三伝配列（${Object.keys(sequences).length}種）上位20:`);
for (const [k, v] of Object.entries(sequences).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${k}: ${v}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
