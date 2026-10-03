// src/lib/liuren/interpretation/stateFlow.ts
//
// 役割:
//   三伝（初→中→末）で、十二長生と旺相休囚死の状態がどう遷移するかを取り出す（STATE FLOW）。
//   入力は analyzeTransmissionFlow の結果（TransmissionFlow）で、growthStages・seasonalStrength をそのまま使う。
//   進気・退気・吉凶は判断しない。旺衰を数値化しない。十二長生の領域（生旺側・衰墓側など）の境界も決めない。
//
//   十二長生 … 五行生墓法の循環順（states.ts の GROWTH_STAGES）で、順に進んだ段数と逆に戻った段数を両方持つ
//   旺相休囚死 … 状態の並びと、変化したかどうかだけ。月支がなければ null（TransmissionFlow と同じ）
//
// 支の移動（movementPattern）・五行の生剋（generationFlow / overcomingFlow）は flow.ts のまま変えない。

import { GROWTH_STAGES } from "./states";
import type {
  GrowthStage, GrowthTransition, SeasonalStrength, SeasonalTransition, StateTransitions,
  TransmissionFlow, Triple,
} from "./types";

/** 十二長生の循環で from から to まで順に進んだ段数と、逆に戻った段数 */
export function growthSteps(from: GrowthStage, to: GrowthStage): { forwardSteps: number; backwardSteps: number } {
  const forwardSteps = (GROWTH_STAGES.indexOf(to) - GROWTH_STAGES.indexOf(from) + 12) % 12;
  return { forwardSteps, backwardSteps: (12 - forwardSteps) % 12 };
}

function growthTransition(
  fromPosition: "initial" | "middle", toPosition: "middle" | "final", from: GrowthStage, to: GrowthStage,
): GrowthTransition {
  return { fromPosition, toPosition, from, to, ...growthSteps(from, to) };
}

function seasonalTransition(
  fromPosition: "initial" | "middle", toPosition: "middle" | "final", from: SeasonalStrength, to: SeasonalStrength,
): SeasonalTransition {
  return { fromPosition, toPosition, from, to, changed: from !== to };
}

/** 三伝の気勢の遷移（TransmissionFlow を読むだけで書き換えない） */
export function stateTransitionsOf(flow: TransmissionFlow): StateTransitions {
  const g = flow.growthStages;
  const growthSequence: Triple<GrowthStage> = { initial: g.initial, middle: g.middle, final: g.final };
  const s = flow.seasonalStrength;
  const seasonalSequence: Triple<SeasonalStrength> | null = s ? { initial: s.initial, middle: s.middle, final: s.final } : null;
  return {
    growthSequence,
    growthTransitions: [
      growthTransition("initial", "middle", g.initial, g.middle),
      growthTransition("middle", "final", g.middle, g.final),
    ],
    seasonalSequence,
    seasonalTransitions: seasonalSequence
      ? [
          seasonalTransition("initial", "middle", seasonalSequence.initial, seasonalSequence.middle),
          seasonalTransition("middle", "final", seasonalSequence.middle, seasonalSequence.final),
        ]
      : null,
  };
}

/**
 * 十二長生の遷移のうち、from が fromStages のどれか、to が toStages のどれかであるもの（古典照合用の検索）。
 * 生旺側・墓絶側などの領域は呼び出し側が段階の集合で渡す（ここでは境界を決めない）。
 */
export function findGrowthTransitions(
  st: StateTransitions, fromStages: readonly GrowthStage[], toStages: readonly GrowthStage[],
): GrowthTransition[] {
  return st.growthTransitions.filter((t) => fromStages.includes(t.from) && toStages.includes(t.to));
}
