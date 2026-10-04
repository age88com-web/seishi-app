// src/lib/liuren/interpretation/dayBranchState.ts
//
// 役割（Phase 3V）:
//   日支そのもの（三課の下神＝地盤支。三課の上神ではない）の状態を中立 FACT として持つ。ROLE・DOMAIN・吉凶は持たない。
//   日支を相手・宅・被告などと固定しない（ROLE は Phase 3T 側で、CONTEXT によって割り当てる）。
//   値はすべて既存の関数から取る:
//     日支 … facts.basic.dayBranch（干支は計算し直さない）
//     日干との関係 … relationBetween(日支, 日干) → transmissionToDayStemRelation
//     六親 … 起課エンジンの sixRelation(日干, 日支)
//     十二長生・GrowthPhase … growthStageOfStem・growthPhaseOf
//     旺相休囚死 … seasonalStrengthOf(日支の五行, rulingElementOfMonth(月支))。月支がなければ null
//     標識 … dayMarkersOf の各標識の支と一致するか
//     旬空 … facts.xun.voidBranches（日支は自分の旬の空亡にならないはずだが、特別扱いせず既存の値を使う）
//   坐空は付けない（坐空は天盤の上神がどの地盤支に坐しているかの FACT で、日支そのものには当てはまらない）。
//   日支から四課上神・三伝への関係は保存せず、必要なときに dayBranchRelationTo で求める。

import { elementOf, sixRelation } from "../relations";
import type { Branch } from "../types";
import { transmissionToDayStemRelation } from "./dayStemFlow";
import { dayMarkersOf } from "./markers";
import { growthPhaseOf } from "./qiState";
import { relationBetween } from "./relations";
import { elementRelationOf } from "./standingPathComparison";
import { growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type { DayBranchConstraint, DayBranchState, ElementRelation, InterpretationFacts, RelationFact } from "./types";

const APPLICABLE: readonly DayBranchConstraint[] = ["dayXunVoid"];

/** 日支そのものの状態 */
export function dayBranchStateOf(facts: InterpretationFacts, monthBranch?: Branch | null): DayBranchState {
  const { dayStem, dayBranch: branch } = facts.basic;
  const element = elementOf(branch);
  const markers = dayMarkersOf(facts);
  const growthStage = growthStageOfStem(dayStem, branch);
  const isDayXunVoid = facts.xun.voidBranches.includes(branch);
  return {
    anchor: "dayBranch",
    branch,
    element,
    relationToDayStem: transmissionToDayStemRelation(relationBetween(branch, dayStem)),
    sixRelation: sixRelation(dayStem, branch),
    growthStage,
    growthPhase: growthPhaseOf(growthStage),
    seasonalStrength: monthBranch ? seasonalStrengthOf(element, rulingElementOfMonth(monthBranch)) : null,
    markers: {
      daySalary: markers.daySalary.branch === branch,
      dayVirtue: markers.dayVirtue.branch === branch,
      xunDing: markers.xunDing.branch === branch,
      yima: markers.yima.branch === branch,
    },
    isDayXunVoid,
    applicableConstraints: APPLICABLE,
    constraints: APPLICABLE.filter((c) => c === "dayXunVoid" && isDayXunVoid),
  };
}

/** 日支 → 任意の支 の関係（四課上神・三伝など。保存せず必要なときに求める） */
export function dayBranchRelationTo(state: DayBranchState, to: Branch): { from: Branch; to: Branch; relation: ElementRelation; structural: RelationFact } {
  const structural = relationBetween(state.branch, to);
  return { from: state.branch, to, relation: elementRelationOf(structural), structural };
}
