// src/lib/liuren/interpretation/dayStemFlow.ts
//
// 役割:
//   三伝（初→中→末）の各伝が日干に対してどう作用し、どんな状態にあるかを、同じ構造で並べる（集約層）。
//   新しい占術計算はしない。値はすべて既存の関数から転記する:
//     日干との関係 … analyzeTransmissionFlow の relationsToDayStem（relationBetween(伝, 日干)）
//     六親         … facts.transmissions の relation
//     日禄・日徳・旬丁・驛馬 … dayMarkersOf の三伝への出現
//     空亡・十二長生・GrowthPhase・旺相休囚死 … qiStatesOf（当月の月令だけ。将来月は含めない）
//     坐空・空亡の構造 … voidStructure.ts（Phase 3M-C）
//     季節内の進気・退気 … transmissionSeasonalDirection（区間の FACT のまま）
//     支の移動     … analyzeTransmissionFlow の movementPattern（三伝全体の FLOW のまま）
//   宜進・宜退・好転・悪化・吉凶・score は持たない。三伝未確定なら null。

import { elementOf } from "../relations";
import type { Branch } from "../types";
import { analyzeTransmissionFlow } from "./flow";
import { dayMarkersOf } from "./markers";
import { qiStatesOf } from "./qiState";
import { transmissionSeasonalDirection } from "./seasonalDirection";
import { isSeatedOnVoid, transmissionVoidStructureOf } from "./voidStructure";
import type {
  BranchMarker, InterpretationFacts, RelationFact, TransmissionDayStemFlow, TransmissionDayStemState,
  TransmissionPosition, TransmissionToDayStemRelation,
} from "./types";

/** relationBetween(伝, 日干) の五行関係 → 伝から見た日干への作用（五行の関係はちょうど1つ） */
export function transmissionToDayStemRelation(r: RelationFact): TransmissionToDayStemRelation {
  const has = (x: RelationFact["relations"][number]) => r.relations.includes(x);
  if (has("generates")) return "transmissionGeneratesDayStem";
  if (has("sameElement")) return "sameElement";
  if (has("generatedBy")) return "dayStemGeneratesTransmission";
  if (has("overcomes")) return "transmissionOvercomesDayStem";
  if (has("overcomeBy")) return "dayStemOvercomesTransmission";
  throw new Error(`五行の関係がありません: ${r.from}→${r.to}`);
}

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

const appearsAt = (m: BranchMarker, p: TransmissionPosition) => (m.transmissions ?? []).some((t) => t.position === p);

/** 三伝と日干の作用関係の流れ。monthBranch は月令の月支（なければ旺相休囚死は null）。三伝未確定なら null */
export function transmissionDayStemFlowOf(facts: InterpretationFacts, monthBranch?: Branch | null): TransmissionDayStemFlow | null {
  const flow = analyzeTransmissionFlow(facts, monthBranch);
  const direction = transmissionSeasonalDirection(facts);
  const voidStructure = transmissionVoidStructureOf(facts);
  if (flow.status !== "determined" || !direction || !facts.transmissions || !voidStructure) return null;
  const qi = qiStatesOf(flow).qiStates;
  const markers = dayMarkersOf(facts);
  const ts = facts.transmissions;

  const stateAt = (p: TransmissionPosition, i: number): TransmissionDayStemState => ({
    position: p,
    branch: flow.branches[p],
    element: elementOf(flow.branches[p]),
    relationToDayStem: transmissionToDayStemRelation(flow.relationsToDayStem[p]),
    sixRelation: ts[i].relation,
    isDaySalary: appearsAt(markers.daySalary, p),
    isDayVirtue: appearsAt(markers.dayVirtue, p),
    isXunDing: appearsAt(markers.xunDing, p),
    isYima: appearsAt(markers.yima, p),
    isVoid: qi[p].isVoid,
    isSeatedOnVoid: isSeatedOnVoid(facts, flow.branches[p]),
    growthStage: qi[p].growthStage,
    growthPhase: qi[p].growthPhase,
    seasonalStrength: qi[p].seasonalStrength,
  });
  const [initial, middle, final] = POSITIONS.map(stateAt);
  return {
    states: { initial, middle, final },
    voidStructure,
    initialToMiddle: direction.initialToMiddle,
    middleToFinal: direction.middleToFinal,
    movementPattern: flow.movementPattern,
  };
}
