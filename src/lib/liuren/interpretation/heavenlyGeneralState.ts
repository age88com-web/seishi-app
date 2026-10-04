// src/lib/liuren/interpretation/heavenlyGeneralState.ts
//
// 役割（Phase 4B）:
//   どの天盤支に、どの天将が乗っているか（HeavenlyGeneralPositionState）。位置だけの中立 FACT で、
//   吉凶・固定の象意・ROLE・DOMAIN は持たない。
//     天将 … 起課エンジンの天将盤 facts.generals.generalOn[skyBranch] を読むだけ（貴人の決め方・十二天将の順・順逆は複製しない）
//   SiteState（Phase 4A）には混ぜない。旬空・坐空（actualization の制約）も変えない。
//   日干そのもの・日支そのもの（天盤の上神ではない）には付けない（干上は一課上神、支上は三課上神として付く）。
//
//   位置ごとの取得は同じ heavenlyGeneralStateOf を使う:
//     干上 … 一課上神 ／ 三伝 … 各伝の支 ／ 四課 … 各課の上神
//   BoardAnchor からは resolveAnchor の結果（AnchorResolution）を heavenlyGeneralStateOfResolution に渡す（Resolver 本体は変えない）。

import type { Branch } from "../types";
import type { AnchorResolution } from "./anchorResolver";
import type { HeavenlyGeneralPositionState, InterpretationFacts, Triple } from "./types";

/** 天盤支 → その支に乗る天将 */
export function heavenlyGeneralStateOf(facts: InterpretationFacts, skyBranch: Branch): HeavenlyGeneralPositionState {
  return { skyBranch, general: facts.generals.generalOn[skyBranch] };
}

/** 干上（一課上神） */
export function standingHeavenlyGeneralStateOf(facts: InterpretationFacts): HeavenlyGeneralPositionState {
  return heavenlyGeneralStateOf(facts, facts.lessons[0].upper);
}

/** 四課の上神 */
export function lessonUpperHeavenlyGeneralStateOf(facts: InterpretationFacts, index: 1 | 2 | 3 | 4): HeavenlyGeneralPositionState {
  return heavenlyGeneralStateOf(facts, facts.lessons[index - 1].upper);
}

/** 三伝の各伝。三伝未確定なら null */
export function transmissionHeavenlyGeneralStatesOf(facts: InterpretationFacts): Triple<HeavenlyGeneralPositionState> | null {
  const ts = facts.transmissions;
  if (!ts) return null;
  return {
    initial: heavenlyGeneralStateOf(facts, ts[0].branch),
    middle: heavenlyGeneralStateOf(facts, ts[1].branch),
    final: heavenlyGeneralStateOf(facts, ts[2].branch),
  };
}

/**
 * 解決済みの anchor → その天盤支の天将。
 * lesson は上神、position（干上・三伝）はその支。日干そのもの・日支そのものは null
 * （dayStem の解決が持つ standing は干上であって日干の天将ではないので、ここでは使わない）。
 */
export function heavenlyGeneralStateOfResolution(facts: InterpretationFacts, r: AnchorResolution): HeavenlyGeneralPositionState | null {
  switch (r.kind) {
    case "lesson": return heavenlyGeneralStateOf(facts, r.source.upper.branch);
    case "path": return heavenlyGeneralStateOf(facts, r.source.branch);
    case "dayStem": case "dayBranch": return null;
  }
}
