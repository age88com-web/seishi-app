// src/lib/liuren/interpretation/branchPlacement.ts
//
// 役割（Phase 5Q）:
//   ある支が盤のどこにあるか（BranchPlacement）。神煞・課体・吉凶・DOMAIN の判断は持たない。
//   神煞（A：神煞そのもの＝支）と課体（C：成立条件）の間の「B：盤上の位置」を、天盤・地盤の両方から見て一つにまとめる。
//
//   既存の位置の構造（変えない。ここの値は同じ式で、テストで一致を確かめる）:
//     markers.ts（branchMarker）・monthlySpirits.ts・secondarySpirits.ts … 支そのものの旬空・天盤の支が加わる地盤・乗る天将・四課上神・三伝
//     xingNianPlacement.ts … 上の項目に加えて、地盤の位置としての上神（行年上神）と坐空
//   ここでは型（LessonOccurrence・TransmissionOccurrence）と項目名をそれらに合わせ、足りなかった項目だけを足す:
//     地盤の位置として … その上に加わる天盤の支（heavenOn）・それに乗る天将・それが旬空か
//     坐空            … 天盤の支が加わる地盤が旬空か（支そのものの旬空 isVoid とは別）
//     四課の下        … その支を地盤支（lowerBranch。一課は日干の寄宮）とする四課
//
//   原典の「X上」「X に加わる」「X を履む」などがどの項目に当たるかは、規則ごとに原典で決める（ここでは決めない）。

import type { Branch, HeavenlyGeneral } from "../types";
import type { InterpretationFacts, LessonOccurrence, TransmissionOccurrence, TransmissionPosition } from "./types";

export interface BranchPlacement {
  branch: Branch;
  /** 支そのものが占日の旬空か（facts.xun.voidBranches） */
  isVoid: boolean;
  // ---- 天盤の支として ----
  /** 天盤のこの支が加わる地盤支（plate.earthUnder） */
  earthUnder: Branch;
  /** 天盤のこの支に乗る天将（generals.generalOn） */
  general: HeavenlyGeneral;
  /** 坐空: 天盤のこの支が加わる地盤支が旬空か */
  seatedOnVoid: boolean;
  // ---- 地盤の位置として ----
  /** 地盤のこの支の上に加わる天盤の支（plate.heavenOn） */
  heavenOn: Branch;
  /** その天盤の支に乗る天将 */
  heavenOnGeneral: HeavenlyGeneral;
  /** その天盤の支が旬空か */
  heavenOnIsVoid: boolean;
  // ---- 四課・三伝 ----
  /** この支を上神とする四課（重複課はすべて。1＝干上・3＝支上） */
  lessons: readonly LessonOccurrence[];
  /** この支を地盤支とする四課（一課は日干の寄宮） */
  lowerLessons: readonly (1 | 2 | 3 | 4)[];
  /** この支である三伝の位置。三伝未確定なら null */
  transmissions: readonly TransmissionOccurrence[] | null;
}

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 支の盤上の位置（起課結果を読むだけ） */
export function branchPlacementOf(facts: InterpretationFacts, branch: Branch): BranchPlacement {
  const v = facts.xun.voidBranches, isVoid = v.includes(branch), ts = facts.transmissions;
  const earthUnder = facts.plate.earthUnder[branch], heavenOn = facts.plate.heavenOn[branch];
  return {
    branch, isVoid,
    earthUnder, general: facts.generals.generalOn[branch], seatedOnVoid: v.includes(earthUnder),
    heavenOn, heavenOnGeneral: facts.generals.generalOn[heavenOn], heavenOnIsVoid: v.includes(heavenOn),
    lessons: facts.lessons.filter((l) => l.upper === branch).map((l) => ({ index: l.index, isVoid })),
    lowerLessons: facts.lessons.filter((l) => l.lowerBranch === branch).map((l) => l.index),
    transmissions: ts ? POSITIONS.flatMap((position, i) => (ts[i].branch === branch ? [{ position, isVoid: ts[i].isVoid }] : [])) : null,
  };
}
