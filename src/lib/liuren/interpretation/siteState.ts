// src/lib/liuren/interpretation/siteState.ts
//
// 役割（Phase 4A）:
//   天盤支が乗る地盤位置での状態（SiteState）。中立 FACT で、ROLE・DOMAIN・吉凶・強弱は持たない。
//     siteBranch        … facts.plate.earthUnder[skyBranch]（天盤配置は計算し直さない。坐空 isSeatedOnVoid と同じ地盤支）
//     growthStageAtSite … 天盤支自身の五行を siteBranch に当てた十二長生（growthStageOf。六壬の五行生墓法）
//                         既存の growthStage（日干の五行で天盤支を見る）とは別物。地盤支の五行は基準にしない
//     structural        … relationBetween(skyBranch, siteBranch)（新しい関係計算はしない）
//   旺相休囚死は五行と月令で決まり地盤支で変わらないため、site 版は持たない。
//   旬空・坐空（actualization の制約）には混ぜない。日干そのもの・日支そのもの（天盤の上神ではない）には付けない。
//
//   位置ごとの取得は同じ siteStateOf を使う:
//     干上 … 一課上神 ／ 三伝 … 各伝の支 ／ 四課 … 各課の上神
//   BoardAnchor からは resolveAnchor の結果（AnchorResolution）を siteStateOfResolution に渡す（Resolver 本体は変えない）。

import type { Branch } from "../types";
import { BRANCH_ELEMENT } from "../constants";
import type { AnchorResolution } from "./anchorResolver";
import { growthPhaseOf } from "./qiState";
import { relationBetween } from "./relations";
import { elementRelationOf } from "./standingPathComparison";
import { growthStageOf } from "./states";
import type { InterpretationFacts, SiteState, Triple } from "./types";

/** 天盤支 → 地盤位置での状態 */
export function siteStateOf(facts: InterpretationFacts, skyBranch: Branch): SiteState {
  const siteBranch = facts.plate.earthUnder[skyBranch];
  const skyElement = BRANCH_ELEMENT[skyBranch];
  const growthStageAtSite = growthStageOf(skyElement, siteBranch);
  const structural = relationBetween(skyBranch, siteBranch);
  return {
    skyBranch, siteBranch, skyElement,
    growthStageAtSite, growthPhaseAtSite: growthPhaseOf(growthStageAtSite),
    relation: elementRelationOf(structural), structural,
  };
}

/** 干上（一課上神） */
export function standingSiteStateOf(facts: InterpretationFacts): SiteState {
  return siteStateOf(facts, facts.lessons[0].upper);
}

/** 三伝の各伝。三伝未確定なら null */
export function transmissionSiteStatesOf(facts: InterpretationFacts): Triple<SiteState> | null {
  const ts = facts.transmissions;
  if (!ts) return null;
  return { initial: siteStateOf(facts, ts[0].branch), middle: siteStateOf(facts, ts[1].branch), final: siteStateOf(facts, ts[2].branch) };
}

/** 四課の上神 */
export function lessonUpperSiteStateOf(facts: InterpretationFacts, index: 1 | 2 | 3 | 4): SiteState {
  return siteStateOf(facts, facts.lessons[index - 1].upper);
}

/**
 * 解決済みの anchor → その天盤支の SiteState。
 * lesson は上神、position（干上・三伝）はその支。日干そのもの・日支そのものは天盤の上神ではないので null。
 */
export function siteStateOfResolution(facts: InterpretationFacts, r: AnchorResolution): SiteState | null {
  switch (r.kind) {
    case "lesson": return siteStateOf(facts, r.source.upper.branch);
    case "path": return siteStateOf(facts, r.source.branch);
    case "dayStem": case "dayBranch": return null;
  }
}
