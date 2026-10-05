// src/lib/liuren/interpretation/heavenlyGeneralSiteGrowth.ts
//
// 役割（Phase 4I）:
//   天将の固有五行を、その天将が乗る天盤支の下の地盤支（加臨先）に当てた十二長生（HeavenlyGeneralSiteGrowthState）。
//     入力   … Phase 4H の HeavenlyGeneralPlacementRelations の general・generalElement・siteBranch（計算し直さない）
//     十二長生 … growthStageOf(generalElement, siteBranch)（Phase 3A の六壬の五行生墓法。陰陽一律順行・土は火に従う）
//     大分類   … growthPhaseOf（Phase 3H）
//   天盤支（skyBranch）・天将の所属支（affiliatedBranch）には当てない。SiteState の growthStageAtSite（天盤支の五行）とは別物。
//   旺相休囚死・天盤支での十二長生・日干との関係は求めない。旬空・坐空・吉凶・ROLE・DOMAIN は持たない。

import type { Branch } from "../types";
import type { AnchorResolution } from "./anchorResolver";
import { heavenlyGeneralPlacementRelationsOf, heavenlyGeneralPlacementRelationsOfResolution } from "./heavenlyGeneralPlacement";
import { growthPhaseOf } from "./qiState";
import { growthStageOf } from "./states";
import type { HeavenlyGeneralPlacementRelations, HeavenlyGeneralSiteGrowthState, InterpretationFacts } from "./types";

/** 関係 FACT（Phase 4H）の天将・天将の五行・加臨先から十二長生を求める */
export function siteGrowthFromPlacement(
  p: Pick<HeavenlyGeneralPlacementRelations, "general" | "generalElement" | "siteBranch">,
): HeavenlyGeneralSiteGrowthState {
  const growthStageAtSite = growthStageOf(p.generalElement, p.siteBranch);
  return {
    general: p.general,
    generalElement: p.generalElement,
    siteBranch: p.siteBranch,
    growthStageAtSite,
    growthPhaseAtSite: growthPhaseOf(growthStageAtSite),
  };
}

/** 天盤支 → その支に乗る天将の、加臨先での十二長生 */
export function heavenlyGeneralSiteGrowthStateOf(facts: InterpretationFacts, skyBranch: Branch): HeavenlyGeneralSiteGrowthState {
  return siteGrowthFromPlacement(heavenlyGeneralPlacementRelationsOf(facts, skyBranch));
}

/** 解決済みの anchor → その位置の天将の、加臨先での十二長生。日干・日支そのものは null */
export function heavenlyGeneralSiteGrowthStateOfResolution(facts: InterpretationFacts, r: AnchorResolution): HeavenlyGeneralSiteGrowthState | null {
  const p = heavenlyGeneralPlacementRelationsOfResolution(facts, r);
  return p ? siteGrowthFromPlacement(p) : null;
}
