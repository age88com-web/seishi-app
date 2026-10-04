// src/lib/liuren/interpretation/dayNightNobleBranch.ts
//
// 役割（Phase 4E）:
//   日干の昼夜貴人支（DayNightNobleBranchState）。十二天将の「貴人」（Phase 4B の HeavenlyGeneralPositionState）とは別の FACT。
//     branch … 起課エンジンが採用した貴人支 facts.generals.nobleBranch
//     period … 起課エンジンが採用した昼夜区分 facts.generals.dayOrNight（占時から判定し直さない）
//   昼夜貴人表（日干 → 昼・夜の貴人支）は複製しない。採用しなかった側の貴人支は起課結果にないので扱わない。
//   ROLE・吉凶・DOMAIN は持たない。BoardAnchor にも加えない（盤上の支が貴人支と同じかを照合する関数だけ）。

import type { Branch } from "../types";
import type { DayNightNobleBranchState, InterpretationFacts } from "./types";

/** 起課エンジンが採用した昼夜貴人支 */
export function dayNightNobleBranchStateOf(facts: InterpretationFacts): DayNightNobleBranchState {
  return {
    kind: "dayNightNobleBranch",
    branch: facts.generals.nobleBranch,
    period: facts.generals.dayOrNight === "昼" ? "day" : "night",
  };
}

/** 天盤支（干上・四課上神・三伝の支など）が、採用された昼夜貴人支と同じか */
export function isDayNightNobleBranch(facts: InterpretationFacts, skyBranch: Branch): boolean {
  return facts.generals.nobleBranch === skyBranch;
}
