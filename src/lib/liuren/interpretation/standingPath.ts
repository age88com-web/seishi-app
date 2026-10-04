// src/lib/liuren/interpretation/standingPath.ts
//
// 役割:
//   干上に留まる側（standing＝日干上神・一課上神）と、三伝へ進む側（path＝初伝→中伝→末伝）を並べる比較用の中立 FACT。
//   古典の宜進・宜退は「干上に留まる場合」と「三伝へ進む場合」を比べるため、その材料だけを揃える。
//   宜進・宜退・評価・score は持たない。
//
//   standing の各値は既存の関数から求める（三伝の各伝と同じ項目・同じ規則）:
//     日干との関係 … relationBetween(上神, 日干) → transmissionToDayStemRelation（向きは「上神 → 日干」）
//     六親         … facts.lessons[0].relation
//     日禄・日徳・旬丁・驛馬 … dayMarkersOf の四課（一課）への出現
//     空亡         … facts.xun.voidBranches
//     坐空         … isSeatedOnVoid（上神が加わる地盤支＝日干の寄宮支が旬空。Phase 3M-C）
//     十二長生・GrowthPhase … growthStageOfStem（五行生墓法）・growthPhaseOf
//     旺相休囚死   … seasonalStrengthOf(上神の五行, rulingElementOfMonth(月支))。月支がなければ null
//   path は transmissionDayStemFlowOf（Phase 3K）の結果をそのまま持つ。

import { elementOf } from "../relations";
import type { Branch } from "../types";
import { transmissionDayStemFlowOf, transmissionToDayStemRelation } from "./dayStemFlow";
import { dayMarkersOf } from "./markers";
import { growthPhaseOf } from "./qiState";
import { relationBetween } from "./relations";
import { growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "./states";
import { isSeatedOnVoid } from "./voidStructure";
import type { BranchMarker, DayStemStandingState, InterpretationFacts, StandingAndTransmissionPath } from "./types";

/**
 * 四課の上神（一課〜四課のどれか）の状態。干上（一課上神）と二課〜四課の上神で共通に使う（Phase 3U）。
 * 項目と規則は三伝の各伝（Phase 3K）と同じ。
 */
export function lessonUpperStateOf(facts: InterpretationFacts, index: 1 | 2 | 3 | 4, monthBranch?: Branch | null): DayStemStandingState {
  const { dayStem } = facts.basic;
  const lesson = facts.lessons[index - 1];
  const branch = lesson.upper;
  const element = elementOf(branch);
  const markers = dayMarkersOf(facts);
  const onLesson = (m: BranchMarker) => m.lessons.some((l) => l.index === index);
  const growthStage = growthStageOfStem(dayStem, branch);
  return {
    branch,
    element,
    relationToDayStem: transmissionToDayStemRelation(relationBetween(branch, dayStem)),
    sixRelation: lesson.relation,
    isDaySalary: onLesson(markers.daySalary),
    isDayVirtue: onLesson(markers.dayVirtue),
    isXunDing: onLesson(markers.xunDing),
    isYima: onLesson(markers.yima),
    isVoid: facts.xun.voidBranches.includes(branch),
    isSeatedOnVoid: isSeatedOnVoid(facts, branch),
    growthStage,
    growthPhase: growthPhaseOf(growthStage),
    seasonalStrength: monthBranch ? seasonalStrengthOf(element, rulingElementOfMonth(monthBranch)) : null,
  };
}

/** 日干上神（一課上神）の状態 */
export function dayStemStandingOf(facts: InterpretationFacts, monthBranch?: Branch | null): DayStemStandingState {
  return lessonUpperStateOf(facts, 1, monthBranch);
}

/** 干上（standing）と三伝の経路（path）。三伝未確定なら path は null */
export function standingAndTransmissionPathOf(facts: InterpretationFacts, monthBranch?: Branch | null): StandingAndTransmissionPath {
  return {
    standing: dayStemStandingOf(facts, monthBranch),
    path: transmissionDayStemFlowOf(facts, monthBranch),
  };
}
