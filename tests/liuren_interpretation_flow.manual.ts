// tests/liuren_interpretation_flow.manual.ts
//
// 六壬神課 解釈エンジンの三伝FLOW層（src/lib/liuren/interpretation/flow.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_flow.manual.ts
//
//   固定例（三伝の支・空亡・日干支だけを差し替えた FACT で確認）:
//     進茹（寅卯辰・亥子丑）／退茹（辰卯寅・丑子亥）／その他
//     生の連続・剋の連続・三伝→日干の遞生・日干→三伝・日支との関係
//     旺相休囚死（月支あり／なし）・十二長生（日干の五行基準、陰干も逆行しない）
//     空亡（初・中・末・複数）・三伝未確定（transmissions null）
//   720課: 例外なし・既存の関数の結果と一致・FACT と起課結果を書き換えない

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { elementOf } from "../src/lib/liuren/relations";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { growthStageOf, growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import type { InterpretationFacts, TransmissionFlow, TransmissionFact } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const BASE = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));

/** 三伝の支・空亡・日干支だけを差し替えた FACT（流れの規則だけを確かめるため） */
function factsWith(day: string, branches: string, voids: [boolean, boolean, boolean] = [false, false, false]): InterpretationFacts {
  const t = [...branches].map((b, i): TransmissionFact => ({
    ...BASE.transmissions![i], branch: b as Branch, isVoid: voids[i],
  }));
  return {
    ...BASE,
    basic: { ...BASE.basic, dayStem: day[0] as Stem, dayBranch: day[1] as Branch },
    transmissions: [t[0], t[1], t[2]],
  };
}
function flowOf(day: string, branches: string, voids?: [boolean, boolean, boolean], month?: Branch): TransmissionFlow {
  const r = analyzeTransmissionFlow(factsWith(day, branches, voids), month);
  if (r.status !== "determined") throw new Error("三伝確定のはず");
  return r;
}

// ---- 進茹・退茹・その他 ----
const MOVES: [string, TransmissionFlow["movementPattern"]][] = [
  ["寅卯辰", "進茹"], ["亥子丑", "進茹"], ["戌亥子", "進茹"],
  ["辰卯寅", "退茹"], ["丑子亥", "退茹"], ["子亥戌", "退茹"],
  ["寅辰午", "進間"], ["寅辰巳", "その他"], ["寅寅寅", "その他"], ["子丑子", "その他"], ["寅卯巳", "その他"], ["辰卯卯", "その他"],
];
for (const [b, m] of MOVES) {
  const got = flowOf("甲子", b).movementPattern;
  check(`進退 ${b}＝${m}`, got === m, got);
}

// ---- 五行の流れ ----
{
  // 寅木→巳火→辰土 は生の連続。辰土→庚金 で三伝が日干を遞生、辰土→申金 で日支も遞生
  const f = flowOf("庚申", "寅巳辰");
  check("生の連続 寅→巳→辰", f.generationFlow.amongTransmissions);
  check("三伝→日干 遞生（辰→庚）", f.generationFlow.transmissionsToDayStem);
  check("三伝→日支 遞生（辰→申）", f.generationFlow.transmissionsToDayBranch);
  check("日干→三伝 ではない（庚は寅を生じない）", !f.generationFlow.dayStemToTransmissions);
  check("初→中 generates", f.branchRelations.initialToMiddle.relations.includes("generates"));
  check("中→末 generates", f.branchRelations.middleToFinal.relations.includes("generates"));
  check("末→日干 generates", f.relationsToDayStem.final.relations.includes("generates"));
  check("初→日干 overcomeBy（庚金が寅木を剋す）", f.relationsToDayStem.initial.relations.includes("overcomeBy"));
  check("剋の連続ではない", !f.overcomingFlow.amongTransmissions);
}
{
  // 壬水→寅木→巳火→辰土。日干・日支（子水）から三伝へ生が流れる
  const f = flowOf("壬子", "寅巳辰");
  check("日干→三伝（壬→寅→巳→辰）", f.generationFlow.dayStemToTransmissions);
  check("日支→三伝（子→寅→巳→辰）", f.generationFlow.dayBranchToTransmissions);
  check("三伝→日干 ではない（辰土は壬水を剋す）", !f.generationFlow.transmissionsToDayStem);
  check("末→日干 overcomes", f.relationsToDayStem.final.relations.includes("overcomes"));
  check("初→日支 generatedBy（子が寅を生ず）", f.relationsToDayBranch.initial.relations.includes("generatedBy"));
}
{
  // 子水→午火→申金 は剋の連続。申金→甲木 も剋
  const f = flowOf("甲寅", "子午申");
  check("剋の連続 子→午→申", f.overcomingFlow.amongTransmissions);
  check("三伝→日干 遞剋（申→甲）", f.overcomingFlow.transmissionsToDayStem);
  check("三伝→日支 遞剋（申→寅）", f.overcomingFlow.transmissionsToDayBranch);
  check("初→中 に冲も残る（子午冲）", f.branchRelations.initialToMiddle.relations.includes("clashes"));
  check("生の連続ではない", !f.generationFlow.amongTransmissions);
}
{
  // 日干→三伝の剋の連続: 庚金→寅木→辰土→子水
  const f = flowOf("庚午", "寅辰子");
  check("日干→三伝 剋（庚→寅→辰→子）", f.overcomingFlow.dayStemToTransmissions && f.overcomingFlow.amongTransmissions);
  check("日支→三伝 剋ではない（午火は寅木を剋さない）", !f.overcomingFlow.dayBranchToTransmissions);
}
{
  // 連続しない例: 生→剋
  const f = flowOf("甲子", "寅巳酉");
  check("生→剋 は連続でない", !f.generationFlow.amongTransmissions && !f.overcomingFlow.amongTransmissions);
}

// ---- 旺相休囚死 ----
{
  const spring = flowOf("甲子", "寅巳辰", undefined, "卯").seasonalStrength;
  check("卯月（木旺）寅旺・巳相・辰死", spring !== null && spring.initial === "旺" && spring.middle === "相" &&
    spring.final === "死" && spring.rulingElement === "木" && spring.monthBranch === "卯" && spring.changed, JSON.stringify(spring));
  const doyo = flowOf("甲子", "寅巳辰", undefined, "未").seasonalStrength;
  check("未月（土旺）寅囚・巳休・辰旺", doyo !== null && doyo.initial === "囚" && doyo.middle === "休" &&
    doyo.final === "旺" && doyo.rulingElement === "土", JSON.stringify(doyo));
  const same = flowOf("甲子", "申酉申", undefined, "酉").seasonalStrength;
  check("酉月 申酉申 すべて旺・changed=false", same !== null && same.initial === "旺" && same.middle === "旺" &&
    same.final === "旺" && !same.changed, JSON.stringify(same));
  check("月支なし → 未評価（null）", flowOf("甲子", "寅巳辰").seasonalStrength === null);
  check("月支 null → 未評価（null）", analyzeTransmissionFlow(factsWith("甲子", "寅巳辰"), null).status === "determined" &&
    (analyzeTransmissionFlow(factsWith("甲子", "寅巳辰"), null) as TransmissionFlow).seasonalStrength === null);
}

// ---- 十二長生 ----
{
  const a = flowOf("甲子", "亥子丑").growthStages;
  const b = flowOf("乙丑", "亥子丑").growthStages;
  check("甲日 亥子丑＝長生沐浴冠帯", a.initial === "長生" && a.middle === "沐浴" && a.final === "冠帯", JSON.stringify(a));
  check("乙日も同じ（陰干逆行でない）", JSON.stringify(a) === JSON.stringify(b), JSON.stringify(b));
  const c = flowOf("癸卯", "申卯辰").growthStages;
  check("癸日 申＝長生・卯＝死・辰＝墓（水の五行生墓法）", c.initial === "長生" && c.middle === "死" && c.final === "墓", JSON.stringify(c));
  const d = flowOf("己巳", "寅午戌").growthStages;
  check("己日（土は火に従う）寅午戌＝長生帝旺墓", d.initial === "長生" && d.middle === "帝旺" && d.final === "墓", JSON.stringify(d));
  const k = flowOf("甲子", "亥卯未").keyGrowthStages;
  check("甲日 亥卯未 の位置", k.長生.join() === "initial" && k.帝旺.join() === "middle" && k.墓.join() === "final" && k.絶.length === 0,
    JSON.stringify(k));
  const k2 = flowOf("甲子", "申申申").keyGrowthStages;
  check("甲日 申申申＝絶が3位置", k2.絶.join() === "initial,middle,final" && k2.長生.length === 0, JSON.stringify(k2));
}

// ---- 空亡 ----
const VOIDS: [string, [boolean, boolean, boolean], string][] = [
  ["初伝空", [true, false, false], "initial"],
  ["中伝空", [false, true, false], "middle"],
  ["末伝空", [false, false, true], "final"],
  ["初末空", [true, false, true], "initial,final"],
  ["全伝空", [true, true, true], "initial,middle,final"],
  ["空亡なし", [false, false, false], ""],
];
for (const [label, v, pos] of VOIDS) {
  const s = flowOf("甲子", "寅卯辰", v).voidStages;
  check(`空亡 ${label}`, s.initial === v[0] && s.middle === v[1] && s.final === v[2] && s.positions.join() === pos, JSON.stringify(s));
}

// ---- 三伝未確定 ----
{
  let error = "";
  let r: ReturnType<typeof analyzeTransmissionFlow> | null = null;
  try {
    r = analyzeTransmissionFlow({ ...BASE, transmissions: null }, "卯");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  check("未確定 例外なし", r !== null, error);
  check("未確定 status=undetermined", r?.status === "undetermined" && r.reason.length > 0, JSON.stringify(r));
}

// ---- 720課 ----
const counts: Record<string, number> = { 進茹: 0, 退茹: 0, 進間: 0, 退間: 0, その他: 0 };
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const facts = buildInterpretationFacts(chart);
    const tag = `${chart.input.dayStem}${chart.input.dayBranch}+${o}`;
    const before = JSON.stringify(chart) + JSON.stringify(facts);
    const month = BRANCHES[(i + o) % 12];
    let r: ReturnType<typeof analyzeTransmissionFlow>;
    try {
      r = analyzeTransmissionFlow(facts, month);
    } catch (e) {
      check(`${tag} 例外なし`, false, String(e));
      continue;
    }
    if (r.status !== "determined") {
      check(`${tag} 確定`, false);
      continue;
    }
    counts[r.movementPattern] += 1;
    const ts = facts.transmissions!;
    check(`${tag} 支`, r.branches.initial === ts[0].branch && r.branches.middle === ts[1].branch && r.branches.final === ts[2].branch);
    check(`${tag} 空亡`, r.voidStages.initial === ts[0].isVoid && r.voidStages.middle === ts[1].isVoid && r.voidStages.final === ts[2].isVoid);
    check(`${tag} 初→中`, JSON.stringify(r.branchRelations.initialToMiddle) === JSON.stringify(relationBetween(ts[0].branch, ts[1].branch)));
    check(`${tag} 末→日干`, JSON.stringify(r.relationsToDayStem.final) === JSON.stringify(relationBetween(ts[2].branch, chart.input.dayStem)));
    check(`${tag} 十二長生`, r.growthStages.initial === growthStageOfStem(chart.input.dayStem, ts[0].branch) &&
      r.growthStages.final === growthStageOf(elementOf(chart.input.dayStem), ts[2].branch));
    check(`${tag} 旺衰あり`, r.seasonalStrength !== null && r.seasonalStrength.monthBranch === month);
    check(`${tag} 不変`, JSON.stringify(chart) + JSON.stringify(facts) === before);
  }
}
check("720課に進茹がある", counts.進茹 > 0, JSON.stringify(counts));
check("720課に退茹がある", counts.退茹 > 0, JSON.stringify(counts));
check("720課の合計", counts.進茹 + counts.退茹 + counts.進間 + counts.退間 + counts.その他 === 720, JSON.stringify(counts));

console.log(`720課の進退: ${JSON.stringify(counts)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
