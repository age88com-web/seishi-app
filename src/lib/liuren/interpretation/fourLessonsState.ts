// src/lib/liuren/interpretation/fourLessonsState.ts
//
// 役割（Phase 3U）:
//   一課〜四課を、三伝と同じ解像度で参照できるようにする中立 FACT。ROLE・DOMAIN・吉凶は持たない。
//   四課そのものは facts.lessons（起課エンジン）をそのまま使い、計算し直さない。
//     上神の状態 … lessonUpperStateOf（干上 dayStemStandingOf と同じ関数。一課は干上と完全に同じ値になる）
//     制約       … constraintsOf（Phase 3S と同じ規則: 旬空・坐空）
//     下神→上神 … relationBetween(下神, 上神)。一課の下神は日干（干）のまま扱い、支に変換しない
//     上神どうし … relationBetween の順方向6組（Phase 3R と同じ考え方）
//   四課と三伝の関係（12組）は保存しない。必要なときに lessonToTransmissionRelation で求める（重複を避ける）。

import type { Branch } from "../types";
import { constraintsOf } from "./actualization";
import { relationBetween } from "./relations";
import { elementRelationOf } from "./standingPathComparison";
import { lessonUpperStateOf } from "./standingPath";
import type {
  FourLessonInternalRelation, FourLessonState, FourLessonsState, InterpretationFacts, LessonPosition,
  PathInternalRelation, TransmissionDayStemState,
} from "./types";

const POSITIONS: readonly LessonPosition[] = ["lesson1", "lesson2", "lesson3", "lesson4"];

function lessonState(facts: InterpretationFacts, index: 1 | 2 | 3 | 4, monthBranch?: Branch | null): FourLessonState {
  const l = facts.lessons[index - 1];
  const upper = lessonUpperStateOf(facts, index, monthBranch);
  const structural = relationBetween(l.lower, l.upper);
  return {
    position: POSITIONS[index - 1],
    index,
    lower: l.lower,
    lowerBranch: l.lowerBranch,
    upper,
    constraints: constraintsOf(upper),
    lowerToUpper: { from: l.lower, to: l.upper, relation: elementRelationOf(structural), structural, zeike: l.zeike },
  };
}

/** 四課の状態（月支は旺相休囚死にだけ使う） */
export function fourLessonsStateOf(facts: InterpretationFacts, monthBranch?: Branch | null): FourLessonsState {
  const lessons = [
    lessonState(facts, 1, monthBranch), lessonState(facts, 2, monthBranch),
    lessonState(facts, 3, monthBranch), lessonState(facts, 4, monthBranch),
  ] as const;
  const internalRelations: FourLessonInternalRelation[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = lessons[i].upper.branch;
      const b = lessons[j].upper.branch;
      const structural = relationBetween(a, b);
      internalRelations.push({
        fromPosition: lessons[i].position, toPosition: lessons[j].position,
        fromBranch: a, toBranch: b, relation: elementRelationOf(structural), structural,
      });
    }
  }
  return { lessons, internalRelations };
}

/** 四課の上神 → 三伝の1伝 の関係（保存せず、必要なときに relationBetween で求める） */
export function lessonToTransmissionRelation(
  lesson: FourLessonState, transmission: TransmissionDayStemState,
): Pick<PathInternalRelation, "fromBranch" | "toBranch" | "relation" | "structural"> {
  const structural = relationBetween(lesson.upper.branch, transmission.branch);
  return { fromBranch: lesson.upper.branch, toBranch: transmission.branch, relation: elementRelationOf(structural), structural };
}
