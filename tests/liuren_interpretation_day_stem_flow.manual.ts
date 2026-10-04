// tests/liuren_interpretation_day_stem_flow.manual.ts
//
// 六壬神課 解釈エンジン Phase 3K（三伝と日干の作用関係の集約 FACT）のテスト。
// 実行: npx tsx tests/liuren_interpretation_day_stem_flow.manual.ts
//
//   1. 720課×月支12 で、各値が既存の FACT・FLOW・MARKER・STATE と一致（支・五行・relationBetween・六親・
//      日禄・日徳・旬丁・驛馬・空亡・十二長生・GrowthPhase・旺相休囚死・季節内の進気退気・movementPattern）
//   2. 三伝未確定は null。月支なしでは旺相休囚死が null
//   3. GrowthPhase の三伝配列が Phase 3H の集計（102種・最多 growing→terminal→growing 31）を再現
//   4. 720課の監査（日干との関係・標識・空亡・旺相休囚死の並び・クロス監査A〜F・進気退気・進茹退茹）

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { analyzeTransmissionFlow } from "../src/lib/liuren/interpretation/flow";
import { dayMarkersOf } from "../src/lib/liuren/interpretation/markers";
import { qiStatesOf } from "../src/lib/liuren/interpretation/qiState";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { transmissionSeasonalDirection } from "../src/lib/liuren/interpretation/seasonalDirection";
import { transmissionDayStemFlowOf } from "../src/lib/liuren/interpretation/dayStemFlow";
import type {
  InterpretationFacts, TransmissionDayStemFlow, TransmissionPosition, TransmissionToDayStemRelation,
} from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const SHORT: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "伝生干", sameElement: "比和", dayStemGeneratesTransmission: "干生伝",
  transmissionOvercomesDayStem: "伝剋干", dayStemOvercomesTransmission: "干剋伝",
};
// relationBetween(伝, 日干) の五行関係 → 期待する作用（向きの確認）
const FROM_RELATION: [string, TransmissionToDayStemRelation][] = [
  ["generates", "transmissionGeneratesDayStem"], ["sameElement", "sameElement"], ["generatedBy", "dayStemGeneratesTransmission"],
  ["overcomes", "transmissionOvercomesDayStem"], ["overcomeBy", "dayStemOvercomesTransmission"],
];
// 六親（日干基準）と作用の対応（講座 p55 の六親の定義と同じ向き）
const SIX_OF: Record<TransmissionToDayStemRelation, string> = {
  transmissionGeneratesDayStem: "父母", sameElement: "兄弟", dayStemGeneratesTransmission: "子孫",
  transmissionOvercomesDayStem: "官鬼", dayStemOvercomesTransmission: "妻財",
};
const POS: TransmissionPosition[] = ["initial", "middle", "final"];
const POS_LABEL = { initial: "初伝", middle: "中伝", final: "末伝" } as const;
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

// ---- 2. 三伝未確定・月支なし ----
{
  const base = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
  check("三伝未確定 → null", transmissionDayStemFlowOf({ ...base, transmissions: null }, "寅") === null);
  const f = transmissionDayStemFlowOf(base)!;
  check("月支なし → 旺相休囚死 null", POS.every((p) => f.states[p].seasonalStrength === null));
}

// ---- 1・3・4. 720課 ----
const relByPos: Record<TransmissionPosition, Record<string, number>> = { initial: {}, middle: {}, final: {} };
const relSeq: Record<string, number> = {};
const sameRel = { 三伝すべて同じ: 0, 初中だけ同じ: 0, 中末だけ同じ: 0, 三伝すべて異なる: 0, 初末だけ同じ: 0 };
type MarkerKey = "isDaySalary" | "isDayVirtue" | "isXunDing" | "isYima" | "isVoid";
const MARKERS: [MarkerKey, string][] = [["isDaySalary", "日禄"], ["isDayVirtue", "日徳"], ["isXunDing", "旬丁"], ["isYima", "驛馬"], ["isVoid", "空亡"]];
const markerPos: Record<string, Record<string, number>> = Object.fromEntries(MARKERS.map(([, l]) => [l, { initial: 0, middle: 0, final: 0, 課数: 0 }]));
const voidPattern = { 空亡なし: 0, 初伝のみ: 0, 中伝のみ: 0, 末伝のみ: 0, 複数伝: 0 };
const phaseSeq: Record<string, number> = {};
const phaseSeqQi: Record<string, number> = {};
const seasonalSeq: Record<string, number> = {};
const crossDefs: [string, (f: TransmissionDayStemFlow) => boolean][] = [
  ["A 初伝 伝剋干 → 中末に 伝生干", (f) => f.states.initial.relationToDayStem === "transmissionOvercomesDayStem" &&
    [f.states.middle, f.states.final].some((s) => s.relationToDayStem === "transmissionGeneratesDayStem")],
  ["B 初伝 干生伝 → 中末に 伝生干", (f) => f.states.initial.relationToDayStem === "dayStemGeneratesTransmission" &&
    [f.states.middle, f.states.final].some((s) => s.relationToDayStem === "transmissionGeneratesDayStem")],
  ["C 初伝 伝剋干 → 中末に 日禄", (f) => f.states.initial.relationToDayStem === "transmissionOvercomesDayStem" &&
    [f.states.middle, f.states.final].some((s) => s.isDaySalary)],
  ["D 初伝 干生伝 → 中末に 日禄", (f) => f.states.initial.relationToDayStem === "dayStemGeneratesTransmission" &&
    [f.states.middle, f.states.final].some((s) => s.isDaySalary)],
  ["E 初伝 空亡 → 中末に 非空亡", (f) => f.states.initial.isVoid && [f.states.middle, f.states.final].some((s) => !s.isVoid)],
  ["F 初伝 非空亡 → 中末に 空亡", (f) => !f.states.initial.isVoid && [f.states.middle, f.states.final].some((s) => s.isVoid)],
];
const cross: Record<string, { count: number; examples: string[] }> = Object.fromEntries(crossDefs.map(([k]) => [k, { count: 0, examples: [] }]));
const dirTrans: Record<string, Record<string, Record<string, number>>> = {
  advancing: { initialToMiddle: {}, middleToFinal: {} }, retreating: { initialToMiddle: {}, middleToFinal: {} },
};
const moveSeq: Record<string, Record<string, number>> = { 進茹: {}, 退茹: {} };
const moveCount: Record<string, number> = { 進茹: 0, 退茹: 0 };

for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const tag = `${day}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts: InterpretationFacts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    const markers = dayMarkersOf(facts);
    const direction = transmissionSeasonalDirection(facts)!;
    for (let m = 0; m < 12; m++) {
      const month = BRANCHES[m] as Branch;
      const f = transmissionDayStemFlowOf(facts, month);
      const flow = analyzeTransmissionFlow(facts, month);
      if (!f || flow.status !== "determined") {
        check(`${tag} 確定`, false);
        continue;
      }
      const qi = qiStatesOf(flow).qiStates;
      for (const [k, p] of POS.entries()) {
        const s = f.states[p];
        const rb = relationBetween(s.branch, facts.basic.dayStem);
        const expectedRel = FROM_RELATION.find(([r]) => rb.relations.includes(r as never))![1];
        const at = (mk: typeof markers.yima) => (mk.transmissions ?? []).some((t) => t.position === p);
        const ok = s.position === p && s.branch === facts.transmissions![k].branch && s.element === BRANCH_ELEMENT[s.branch] &&
          s.relationToDayStem === expectedRel && s.sixRelation === facts.transmissions![k].relation &&
          SIX_OF[s.relationToDayStem] === s.sixRelation &&
          s.isDaySalary === at(markers.daySalary) && s.isDayVirtue === at(markers.dayVirtue) &&
          s.isXunDing === at(markers.xunDing) && s.isYima === at(markers.yima) &&
          s.isVoid === facts.transmissions![k].isVoid && s.growthStage === flow.growthStages[p] &&
          s.growthPhase === qi[p].growthPhase && s.seasonalStrength === flow.seasonalStrength![p];
        if (!ok) check(`${tag} 月${month} ${p} 既存と一致`, false, JSON.stringify(s));
      }
      const segOk = JSON.stringify(f.initialToMiddle) === JSON.stringify(direction.initialToMiddle) &&
        JSON.stringify(f.middleToFinal) === JSON.stringify(direction.middleToFinal) && f.movementPattern === flow.movementPattern;
      if (!segOk) check(`${tag} 月${month} 区間・movementPattern`, false);
      inc(seasonalSeq, POS.map((p) => f.states[p].seasonalStrength).join("→"));

      if (m !== 0) continue;
      // ここから月支に依らない集計（720課）
      const st = f.states;
      const rs = POS.map((p) => SHORT[st[p].relationToDayStem]);
      for (const p of POS) inc(relByPos[p], SHORT[st[p].relationToDayStem]);
      inc(relSeq, rs.join(" → "));
      if (rs[0] === rs[1] && rs[1] === rs[2]) sameRel.三伝すべて同じ += 1;
      else if (rs[0] === rs[1]) sameRel.初中だけ同じ += 1;
      else if (rs[1] === rs[2]) sameRel.中末だけ同じ += 1;
      else if (rs[0] === rs[2]) sameRel.初末だけ同じ += 1;
      else sameRel.三伝すべて異なる += 1;
      for (const [key, label] of MARKERS) {
        for (const p of POS) if (st[p][key]) markerPos[label][p] += 1;
        if (POS.some((p) => st[p][key])) markerPos[label].課数 += 1;
      }
      const vs = POS.filter((p) => st[p].isVoid);
      if (vs.length === 0) voidPattern.空亡なし += 1;
      else if (vs.length > 1) voidPattern.複数伝 += 1;
      else voidPattern[`${POS_LABEL[vs[0]]}のみ` as "初伝のみ"] += 1;
      inc(phaseSeq, POS.map((p) => st[p].growthPhase).join("→"));
      inc(phaseSeqQi, POS.map((p) => qi[p].growthPhase).join("→"));
      const ts = POS.map((p) => st[p].branch).join("");
      for (const [k, pred] of crossDefs) {
        if (pred(f)) {
          cross[k].count += 1;
          if (cross[k].examples.length < 3) {
            cross[k].examples.push(`${day}日 天盤差${o} 三伝${ts} | ${rs.join("・")} | 日禄${POS.map((p) => (st[p].isDaySalary ? "○" : "－")).join("")} 空亡${POS.map((p) => (st[p].isVoid ? "○" : "－")).join("")}`);
          }
        }
      }
      for (const [seg, a, b] of [["initialToMiddle", 0, 1], ["middleToFinal", 1, 2]] as const) {
        const d = f[seg].direction;
        if (d !== "none") inc(dirTrans[d][seg], `${rs[a]} → ${rs[b]}`);
      }
      if (f.movementPattern === "進茹" || f.movementPattern === "退茹") {
        moveCount[f.movementPattern] += 1;
        inc(moveSeq[f.movementPattern], rs.join(" → "));
      }
    }
    check(`${tag} 起課結果・FACT 不変`, JSON.stringify(chart) === before && JSON.stringify(facts) === factsBefore);
  }
}
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
check("relation 位置別の合計＝720", POS.every((p) => total(relByPos[p]) === 720));
check("同一関係の分類（排他）の合計＝720", total(sameRel) === 720, JSON.stringify(sameRel));
check("空亡パターンの合計＝720", total(voidPattern) === 720);
check("GrowthPhase 三伝配列＝qiStates から数えた値", JSON.stringify(top(phaseSeq, 200)) === JSON.stringify(top(phaseSeqQi, 200)));
check("GrowthPhase 三伝配列＝Phase 3H（102種・最多 growing→terminal→growing 31）",
  Object.keys(phaseSeq).length === 102 && phaseSeq["growing→terminal→growing"] === 31 && top(phaseSeq, 1)[0][0] === "growing→terminal→growing",
  `${Object.keys(phaseSeq).length}種 ${JSON.stringify(top(phaseSeq, 1))}`);
check("旺相休囚死の並びの合計＝720×12", total(seasonalSeq) === 8640);

const show = (o: Record<string, number>) => top(o, 99).map(([k, v]) => `${k} ${v}`).join(" / ");
for (const p of POS) console.log(`${POS_LABEL[p]} relationToDayStem: ${show(relByPos[p])}`);
console.log(`三伝 relation 配列: ${Object.keys(relSeq).length}種 上位20:`);
for (const [k, v] of top(relSeq, 20)) console.log(`  ${k}: ${v}`);
console.log(`同一関係: ${JSON.stringify(sameRel)}`);
for (const [, l] of MARKERS) console.log(`${l}: 初伝${markerPos[l].initial} 中伝${markerPos[l].middle} 末伝${markerPos[l].final} | 含む課数 ${markerPos[l].課数}`);
console.log(`空亡パターン: ${JSON.stringify(voidPattern)}`);
console.log(`GrowthPhase 三伝配列: ${Object.keys(phaseSeq).length}種 最多 ${JSON.stringify(top(phaseSeq, 1))}`);
console.log(`旺相休囚死 三伝配列（720課×月支12）: ${Object.keys(seasonalSeq).length}種 上位20:`);
for (const [k, v] of top(seasonalSeq, 20)) console.log(`  ${k}: ${v}`);
console.log("クロス監査:");
for (const [k] of crossDefs) {
  console.log(`  ${k}: ${cross[k].count}`);
  for (const e of cross[k].examples) console.log(`      ${e}`);
}
for (const d of ["advancing", "retreating"]) {
  for (const seg of ["initialToMiddle", "middleToFinal"]) console.log(`${d} ${seg}: ${show(dirTrans[d][seg]) || "なし"}`);
}
for (const mv of ["進茹", "退茹"]) {
  console.log(`${mv}（${moveCount[mv]}課） relation 配列 ${Object.keys(moveSeq[mv]).length}種: ${show(moveSeq[mv])}`);
}
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
