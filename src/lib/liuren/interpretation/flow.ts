// src/lib/liuren/interpretation/flow.ts
//
// 役割:
//   三伝（初伝 → 中伝 → 末伝）を1つの流れとして、構造だけを取り出す（FLOW層）。
//   吉凶・占目別の意味は付けない。旺衰・十二長生を数値化しない。
//
//   支の進退   … 十二支順に一支ずつ進む＝進茹、退く＝退茹（子と亥の境界は循環）。退間などは判定しない
//   五行の関係 … relationBetween（Phase 2）で 初→中・中→末、各伝→日干・各伝→日支
//   生剋の連続 … 同じ向きの generates / overcomes の連鎖（三伝遞生日干、日干から三伝へ流れる など）
//   旺相休囚死 … 月支（calendar.monthBranch）を渡したときだけ。月将は使わない
//   十二長生   … 日干基準の五行生墓法（growthStageOfStem。陰干も逆行しない）
//   空亡       … facts.transmissions の isVoid を位置ごとに並べるだけ
//
// 三伝未確定（facts.transmissions = null）では解析せず、status: "undetermined" を返す。

import { BRANCHES } from "../constants";
import { elementOf } from "../relations";
import type { Branch, Stem } from "../types";
import { relationBetween } from "./relations";
import { growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type {
  ChainFlow, InterpretationFacts, MovementPattern, RelationFact, StructuralRelation,
  TransmissionFlowResult, TransmissionPosition, Triple,
} from "./types";

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

function mapTriple<A, B>(t: Triple<A>, f: (a: A) => B): Triple<B> {
  return { initial: f(t.initial), middle: f(t.middle), final: f(t.final) };
}

function movementOf(t: Triple<Branch>): MovementPattern {
  const step = (a: Branch, b: Branch) => (BRANCHES.indexOf(b) - BRANCHES.indexOf(a) + 12) % 12;
  const s1 = step(t.initial, t.middle);
  const s2 = step(t.middle, t.final);
  if (s1 === 1 && s2 === 1) return "進茹";
  if (s1 === 11 && s2 === 11) return "退茹";
  return "その他";
}

/** kind の向きの関係が連鎖しているか（from → to が kind であること） */
function chainOf(
  kind: Extract<StructuralRelation, "generates" | "overcomes">,
  t: Triple<Branch>, dayStem: Stem, dayBranch: Branch,
): ChainFlow {
  const has = (from: Stem | Branch, to: Stem | Branch) => relationBetween(from, to).relations.includes(kind);
  const among = has(t.initial, t.middle) && has(t.middle, t.final);
  return {
    amongTransmissions: among,
    transmissionsToDayStem: among && has(t.final, dayStem),
    dayStemToTransmissions: among && has(dayStem, t.initial),
    transmissionsToDayBranch: among && has(t.final, dayBranch),
    dayBranchToTransmissions: among && has(dayBranch, t.initial),
  };
}

/**
 * 三伝の流れ。monthBranch は月令の月支（日時入力の calendar.monthBranch）。
 * 渡さなければ旺相休囚死は null（未評価）。
 */
export function analyzeTransmissionFlow(facts: InterpretationFacts, monthBranch?: Branch | null): TransmissionFlowResult {
  const ts = facts.transmissions;
  if (!ts) return { status: "undetermined", reason: "三伝未確定のため流れを解析しない" };

  const { dayStem, dayBranch } = facts.basic;
  const branches: Triple<Branch> = { initial: ts[0].branch, middle: ts[1].branch, final: ts[2].branch };
  const voids: Triple<boolean> = { initial: ts[0].isVoid, middle: ts[1].isVoid, final: ts[2].isVoid };
  const growthStages = mapTriple(branches, (b) => growthStageOfStem(dayStem, b));
  const positionsOf = (pred: (p: TransmissionPosition) => boolean) => POSITIONS.filter(pred);

  let seasonalStrength = null;
  if (monthBranch) {
    const rulingElement = rulingElementOfMonth(monthBranch);
    const s = mapTriple(branches, (b) => seasonalStrengthOf(elementOf(b), rulingElement));
    seasonalStrength = {
      ...s, monthBranch, rulingElement,
      changed: !(s.initial === s.middle && s.middle === s.final),
    };
  }

  const toDay = (target: Stem | Branch): Triple<RelationFact> => mapTriple(branches, (b) => relationBetween(b, target));

  return {
    status: "determined",
    branches,
    movementPattern: movementOf(branches),
    branchRelations: {
      initialToMiddle: relationBetween(branches.initial, branches.middle),
      middleToFinal: relationBetween(branches.middle, branches.final),
    },
    relationsToDayStem: toDay(dayStem),
    relationsToDayBranch: toDay(dayBranch),
    generationFlow: chainOf("generates", branches, dayStem, dayBranch),
    overcomingFlow: chainOf("overcomes", branches, dayStem, dayBranch),
    seasonalStrength,
    growthStages,
    keyGrowthStages: {
      長生: positionsOf((p) => growthStages[p] === "長生"),
      帝旺: positionsOf((p) => growthStages[p] === "帝旺"),
      墓: positionsOf((p) => growthStages[p] === "墓"),
      絶: positionsOf((p) => growthStages[p] === "絶"),
    },
    voidStages: { ...voids, positions: positionsOf((p) => voids[p]) },
  };
}
