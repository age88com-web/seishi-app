// src/lib/liuren/interpretation/yinSpirit.ts
//
// 役割（Phase 4J）:
//   四課の上神の陰神（YinSpiritState）。
//     陰神の支 … 上神を地盤の位置として、その上に来る天盤支 facts.plate.heavenOn[上神]
//                （起課エンジンの四課〔sike.ts〕と同じ写像。二課の上神は一課上神の陰神、四課の上神は三課上神の陰神になる）
//     天将     … 陰神の支に乗る天将（Phase 4B の heavenlyGeneralStateOf。天将盤は計算し直さない）
//   天地盤は計算し直さない（plate.heavenOn は地盤支→天盤支の写像として起課結果にある）。
//   一段だけ求める（陰神の陰神はたどらない）。三伝・干上の陰神は資料の用例がないため公開しない。
//   五行・六親・SiteState・天将の固有属性・関係・十二長生・旬空・坐空・意味づけ・ROLE・DOMAIN は持たない。

import type { Branch } from "../types";
import { heavenlyGeneralStateOf } from "./heavenlyGeneralState";
import type { InterpretationFacts, YinSpiritState } from "./types";

/** 支を地盤の位置として、その上に来る天盤支 */
function skyBranchOver(facts: InterpretationFacts, earthBranch: Branch): Branch {
  return facts.plate.heavenOn[earthBranch];
}

/** 四課の上神の陰神 */
export function lessonYinSpiritStateOf(facts: InterpretationFacts, lessonIndex: 1 | 2 | 3 | 4): YinSpiritState {
  const sourceBranch = facts.lessons[lessonIndex - 1].upper;
  const yinSpiritBranch = skyBranchOver(facts, sourceBranch);
  return { lessonIndex, sourceBranch, yinSpiritBranch, yinSpiritGeneral: heavenlyGeneralStateOf(facts, yinSpiritBranch).general };
}

/** 一課〜四課の陰神 */
export function lessonYinSpiritStatesOf(facts: InterpretationFacts): readonly [YinSpiritState, YinSpiritState, YinSpiritState, YinSpiritState] {
  return [lessonYinSpiritStateOf(facts, 1), lessonYinSpiritStateOf(facts, 2), lessonYinSpiritStateOf(facts, 3), lessonYinSpiritStateOf(facts, 4)];
}
