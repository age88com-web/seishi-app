// src/lib/liuren/interpretation/standingPathComparison.ts
//
// 役割:
//   干上（現在地）と三伝（経路）を、干上→初伝→中伝→末伝 の4段階で同じ軸に並べる比較 FACT（Phase 3P）。
//   値はすべて DirectionEvidence（Phase 3N。中身は Phase 3K・3L・3M-C）を参照するだけで、新しい計算はしない。
//   宜進・宜退・宜守、実効性（空亡が禄・旺を無効にする等）、評価語（improving など）は持たない。
//   「実の旺禄」のように複数の条件を1つの boolean にまとめない（禄・帝旺・空亡・関係を別々に並べる）。

import type { Branch } from "../types";
import { directionEvidenceOf } from "./directionEvidence";
import type {
  ComparisonPosition, ComparisonStep, DayStemStandingState, DirectionEvidence, InterpretationFacts,
  StandingPathComparison, TransmissionDayStemState, TransmissionPosition, ValueChange,
} from "./types";

type StageState = DayStemStandingState | TransmissionDayStemState;

const change = <T>(from: T, to: T): ValueChange<T> => ({ from, to, changed: from !== to });

function stepOf(fromPosition: ComparisonPosition, a: StageState, toPosition: TransmissionPosition, b: TransmissionDayStemState): ComparisonStep {
  return {
    fromPosition,
    toPosition,
    relationToDayStem: change(a.relationToDayStem, b.relationToDayStem),
    sixRelation: change(a.sixRelation, b.sixRelation),
    growthStage: change(a.growthStage, b.growthStage),
    growthPhase: change(a.growthPhase, b.growthPhase),
    dayXunVoid: change(a.isVoid, b.isVoid),
    seatedOnVoid: change(a.isSeatedOnVoid, b.isSeatedOnVoid),
    daySalary: change(a.isDaySalary, b.isDaySalary),
    dayVirtue: change(a.isDayVirtue, b.isDayVirtue),
  };
}

/** DirectionEvidence → 干上と三伝の比較 */
export function standingPathComparisonFrom(e: DirectionEvidence): StandingPathComparison {
  const s = e.standing;
  const p = e.path.states;
  const stages: [ComparisonPosition, StageState][] = [["standing", s], ["initial", p.initial], ["middle", p.middle], ["final", p.final]];
  const where = (f: (x: StageState) => boolean) => stages.filter(([, x]) => f(x)).map(([pos]) => pos);
  const seq = <T>(f: (x: StageState) => T) => ({ standing: f(s), initial: f(p.initial), middle: f(p.middle), final: f(p.final) });
  return {
    movementDirection: e.movementDirection,
    movementPattern: e.movementPattern,
    standing: s,
    path: p,
    transitions: {
      standingToInitial: stepOf("standing", s, "initial", p.initial),
      initialToMiddle: stepOf("initial", p.initial, "middle", p.middle),
      middleToFinal: stepOf("middle", p.middle, "final", p.final),
    },
    sequences: {
      relationToDayStem: seq((x) => x.relationToDayStem),
      sixRelation: seq((x) => x.sixRelation),
      growthStage: seq((x) => x.growthStage),
    },
    markerPositions: {
      daySalary: where((x) => x.isDaySalary),
      dayVirtue: where((x) => x.isDayVirtue),
      xunDing: where((x) => x.isXunDing),
      yima: where((x) => x.isYima),
    },
    voidPositions: {
      dayXunVoid: where((x) => x.isVoid),
      seatedOnVoid: where((x) => x.isSeatedOnVoid),
    },
  };
}

/** 干上と三伝の比較。monthBranch は月令の月支（旺相休囚死は Phase 3K・3L の各状態に入る）。三伝未確定なら null */
export function standingPathComparisonOf(facts: InterpretationFacts, monthBranch?: Branch | null): StandingPathComparison | null {
  const e = directionEvidenceOf(facts, monthBranch);
  return e ? standingPathComparisonFrom(e) : null;
}
