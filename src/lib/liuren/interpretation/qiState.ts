// src/lib/liuren/interpretation/qiState.ts
//
// 役割:
//   三伝の各伝の気勢の状態（十二長生の段階・その大分類・旺相休囚死・空亡）を並べ、
//   大分類（GrowthPhase）の遷移と段階の境目を取り出す。
//   十二長生と旺相休囚死は別の軸のまま持ち、合成・数値化しない。進気・退気・吉凶は判断しない。
//
//   大分類（ユーザー指定 2026-10-03。内部構造名で古典語ではない）:
//     胎・養＝emerging / 長生・沐浴・冠帯・臨官＝growing / 帝旺＝peak / 衰・病＝declining
//     死・墓＝terminal / 絶＝renewingBoundary（『六壬指南』「死生互換之交・人鬼轉關之路」。terminal に入れない）
//   『六壬指南』「衰墓總同退斷」「胎生進氣無虞」の検証用。衰墓・胎生を2支に固定せず、段階ごとに分類する。
//
// 入力は analyzeTransmissionFlow の結果（TransmissionFlow）。stateFlow.ts（Phase 3G）は変えない。

import type {
  GrowthPhase, GrowthPhaseBoundary, GrowthPhaseTransition, GrowthStage, QiStates,
  TransmissionFlow, TransmissionPosition, TransmissionQiState,
} from "./types";

const PHASE_OF: Record<GrowthStage, GrowthPhase> = {
  胎: "emerging", 養: "emerging",
  長生: "growing", 沐浴: "growing", 冠帯: "growing", 臨官: "growing",
  帝旺: "peak",
  衰: "declining", 病: "declining",
  死: "terminal", 墓: "terminal",
  絶: "renewingBoundary",
};

/** 十二長生の段階 → 大分類 */
export function growthPhaseOf(stage: GrowthStage): GrowthPhase {
  return PHASE_OF[stage];
}

/** 隣り合う大分類への変化（from → to → 境目の名前） */
const BOUNDARIES: readonly [GrowthPhase, GrowthPhase, GrowthPhaseBoundary][] = [
  ["peak", "declining", "peakToDeclining"],
  ["declining", "terminal", "decliningToTerminal"],
  ["terminal", "renewingBoundary", "terminalToRenewing"],
  ["renewingBoundary", "emerging", "renewingToEmerging"],
  ["emerging", "growing", "emergingToGrowing"],
  ["growing", "peak", "growingToPeak"],
];

function phaseTransition(
  fromPosition: "initial" | "middle", toPosition: "middle" | "final", from: GrowthPhase, to: GrowthPhase,
): GrowthPhaseTransition {
  const b = BOUNDARIES.find(([f, t]) => f === from && t === to);
  return { fromPosition, toPosition, from, to, changed: from !== to, boundary: b ? b[2] : null };
}

/** 三伝の気勢の状態（TransmissionFlow を読むだけで書き換えない） */
export function qiStatesOf(flow: TransmissionFlow): QiStates {
  const stateAt = (position: TransmissionPosition): TransmissionQiState => ({
    position,
    branch: flow.branches[position],
    growthStage: flow.growthStages[position],
    growthPhase: growthPhaseOf(flow.growthStages[position]),
    seasonalStrength: flow.seasonalStrength ? flow.seasonalStrength[position] : null,
    isVoid: flow.voidStages[position],
  });
  const qiStates = { initial: stateAt("initial"), middle: stateAt("middle"), final: stateAt("final") };
  return {
    qiStates,
    phaseTransitions: [
      phaseTransition("initial", "middle", qiStates.initial.growthPhase, qiStates.middle.growthPhase),
      phaseTransition("middle", "final", qiStates.middle.growthPhase, qiStates.final.growthPhase),
    ],
  };
}
