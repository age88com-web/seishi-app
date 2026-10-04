// src/lib/liuren/interpretation/dayNightNobleBranchPair.ts
//
// 役割（Phase 4F）:
//   日干の昼貴人支・夜貴人支の対（DayNightNobleBranchPairState）。
//     dayBranch・nightBranch … 起課エンジンの generals.nobleBranches（placeGenerals が同じ表から残したメタデータ）
//     selected              … 天将盤で採用された側（Phase 4E の dayNightNobleBranchStateOf。変更しない）
//   昼夜貴人表は複製しない。占時の昼夜で片方を捨てない。反対側の貴人支に名前（簾幕貴人など）を付けない。
//   十二天将の貴人・人物の貴人とは別。ROLE・吉凶・DOMAIN は持たない。

import type { Branch } from "../types";
import { dayNightNobleBranchStateOf } from "./dayNightNobleBranch";
import type { DayNightNobleBranchPairState, InterpretationFacts } from "./types";

/** 昼貴人支・夜貴人支の対と、採用された側 */
export function dayNightNobleBranchPairStateOf(facts: InterpretationFacts): DayNightNobleBranchPairState {
  return {
    kind: "dayNightNobleBranchPair",
    dayBranch: facts.generals.nobleBranches.day,
    nightBranch: facts.generals.nobleBranches.night,
    selected: dayNightNobleBranchStateOf(facts),
  };
}

/** 天盤支が、昼・夜どちらの貴人支と同じか（どちらでもなければ空。採用された側かどうかは問わない） */
export function dayNightNobleBranchPeriodsOf(facts: InterpretationFacts, skyBranch: Branch): ("day" | "night")[] {
  const { day, night } = facts.generals.nobleBranches;
  return [...(day === skyBranch ? ["day" as const] : []), ...(night === skyBranch ? ["night" as const] : [])];
}
