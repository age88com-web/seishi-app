// src/lib/liuren/interpretation/actualization.ts
//
// 役割（Phase 3S）:
//   この層は「その象意が存在するか」ではなく、
//   「その象意が現実化・作用するときに古典上考慮される制約 FACT が付いているか」を持つ。
//   制約があるから作用しない、とはしない。有効・無効・虚実・吉凶・宜進退・score は持たない。
//   問う内容（DOMAIN）によって同じ制約が吉にも凶にもなり得るため、ここでは評価しない。
//
//   入力は StandingPathComparison（Phase 3P・3R）だけで、起課 FACT から再計算しない。
//     制約     … 各地点の isVoid → "dayXunVoid"、isSeatedOnVoid → "seatedOnVoid"（元の FACT は source に残す）
//     存在する FACT … 日干との関係・六親・十二長生・GrowthPhase・日禄・日徳・旬丁・驛馬
//     地点どうしの関係 … internalRelations.all（Phase 3R）の両端の制約を並べるだけ

import type { Branch } from "../types";
import { standingPathComparisonOf } from "./standingPathComparison";
import type {
  ActualizationConstraint, ComparisonPosition, DayStemStandingState, InterpretationFacts, PositionActualizationState,
  StandingPathActualization, StandingPathComparison, TransmissionDayStemState,
} from "./types";

/** 1地点の制約（既存の isVoid・isSeatedOnVoid を並べるだけ） */
export function constraintsOf(s: DayStemStandingState | TransmissionDayStemState): ActualizationConstraint[] {
  const out: ActualizationConstraint[] = [];
  if (s.isVoid) out.push("dayXunVoid");
  if (s.isSeatedOnVoid) out.push("seatedOnVoid");
  return out;
}

function positionState(position: ComparisonPosition, s: DayStemStandingState | TransmissionDayStemState): PositionActualizationState {
  return {
    position,
    branch: s.branch,
    constraints: constraintsOf(s),
    relationToDayStem: s.relationToDayStem,
    sixRelation: s.sixRelation,
    growthStage: s.growthStage,
    growthPhase: s.growthPhase,
    markers: { daySalary: s.isDaySalary, dayVirtue: s.isDayVirtue, xunDing: s.isXunDing, yima: s.isYima },
    source: s,
  };
}

/** StandingPathComparison → 各地点の存在する FACT と制約 */
export function standingPathActualizationFrom(c: StandingPathComparison): StandingPathActualization {
  const states = [
    positionState("standing", c.standing),
    positionState("initial", c.path.initial),
    positionState("middle", c.path.middle),
    positionState("final", c.path.final),
  ] as const;
  const at = (p: ComparisonPosition) => states.find((s) => s.position === p)!;
  return {
    states,
    internalRelations: c.internalRelations.all.map((relation) => ({
      relation,
      fromConstraints: at(relation.fromPosition).constraints,
      toConstraints: at(relation.toPosition).constraints,
    })),
  };
}

/** 各地点の存在する FACT と制約。三伝未確定なら null */
export function standingPathActualizationOf(facts: InterpretationFacts, monthBranch?: Branch | null): StandingPathActualization | null {
  const c = standingPathComparisonOf(facts, monthBranch);
  return c ? standingPathActualizationFrom(c) : null;
}
