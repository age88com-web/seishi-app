// src/lib/liuren/interpretation/derivedBranchDayStem.ts
//
// 役割（Phase 4K）:
//   任意の支と日干の関係（DerivedBranchDayStemState）。陰神（Phase 4J）・上神・将来の行年など、
//   盤上の関係から得た支にもそのまま使う共通 FACT（陰神専用のロジックは持たない）。
//     五行     … elementOf（起課エンジンの五行表）
//     日干     … facts.basic.dayStem
//     日干関係 … transmissionToDayStemRelation(relationBetween(支, 日干))（Phase 3K・3L・3V と同じ計算）
//     六親     … 起課エンジンの sixRelation(日干, 支)（三伝・四課・日支と同じ関数）
//   十二長生・旺相休囚死・日禄などの標識・旬空・坐空・天将・SiteState・吉凶・ROLE・DOMAIN は持たない。

import { elementOf, sixRelation } from "../relations";
import type { Branch } from "../types";
import { transmissionToDayStemRelation } from "./dayStemFlow";
import { relationBetween } from "./relations";
import type { DerivedBranchDayStemState, InterpretationFacts, YinSpiritState } from "./types";

/** 任意の支 → 日干との関係 */
export function derivedBranchDayStemStateOf(facts: InterpretationFacts, branch: Branch): DerivedBranchDayStemState {
  const dayStem = facts.basic.dayStem;
  return {
    branch,
    element: elementOf(branch),
    relationToDayStem: transmissionToDayStemRelation(relationBetween(branch, dayStem)),
    sixRelation: sixRelation(dayStem, branch),
  };
}

/** 陰神（Phase 4J）の支 → 日干との関係（YinSpiritState は変えずに別の FACT として返す） */
export function yinSpiritDayStemStateOf(facts: InterpretationFacts, yinSpirit: YinSpiritState): DerivedBranchDayStemState {
  return derivedBranchDayStemStateOf(facts, yinSpirit.yinSpiritBranch);
}
