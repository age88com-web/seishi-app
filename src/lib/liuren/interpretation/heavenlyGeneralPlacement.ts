// src/lib/liuren/interpretation/heavenlyGeneralPlacement.ts
//
// 役割（Phase 4H）:
//   天将の固有属性（Phase 4G）と、その天将が乗る天盤支（Phase 4B）・その下の地盤支（Phase 4A の siteBranch）との関係。
//     五行の関係 … 支の五行 → 天将の五行 の向き（skyToGeneral・siteToGeneral）。逆向きは reverseElementRelation で求め、保存しない
//                  relationBetween は干支どうしの関数なので使わず、起課エンジンの五行表（ELEMENT_GENERATES・ELEMENT_CONTROLS）で
//                  五行どうしの関係を求める
//     支の一致   … 天盤支・地盤支が天将の所属支と同じか（boolean だけ。入廟・本家などの意味は付けない）
//   天将五行の十二長生・旺相休囚死、所属干と日干の関係は求めない。旬空・坐空・吉凶・ROLE・DOMAIN は持たない。

import { ELEMENT_CONTROLS, ELEMENT_GENERATES } from "../constants";
import { elementOf } from "../relations";
import type { Branch, Element } from "../types";
import type { AnchorResolution } from "./anchorResolver";
import { intrinsicAttributesOfPosition } from "./heavenlyGeneralAttributes";
import { heavenlyGeneralStateOf, heavenlyGeneralStateOfResolution } from "./heavenlyGeneralState";
import { siteStateOf } from "./siteState";
import type { ElementRelation, HeavenlyGeneralPlacementRelations, HeavenlyGeneralPositionState, InterpretationFacts, SiteState } from "./types";

/** 五行 → 五行 の関係（from から見た向き） */
export function elementRelationBetweenElements(from: Element, to: Element): ElementRelation {
  if (from === to) return "sameElement";
  if (ELEMENT_GENERATES[from] === to) return "generates";
  if (ELEMENT_GENERATES[to] === from) return "generatedBy";
  if (ELEMENT_CONTROLS[from] === to) return "overcomes";
  return "overcomeBy"; // 残るのは ELEMENT_CONTROLS[to] === from のみ
}

/** 関係の向きを逆にする（A → B の関係から B → A の関係） */
export function reverseElementRelation(r: ElementRelation): ElementRelation {
  switch (r) {
    case "generates": return "generatedBy";
    case "generatedBy": return "generates";
    case "overcomes": return "overcomeBy";
    case "overcomeBy": return "overcomes";
    case "sameElement": return "sameElement";
  }
}

/** 位置の天将（Phase 4B）と、同じ天盤支の SiteState（Phase 4A）から関係を作る */
export function placementRelationsFrom(position: HeavenlyGeneralPositionState, site: SiteState): HeavenlyGeneralPlacementRelations {
  if (position.skyBranch !== site.skyBranch) {
    throw new Error(`天盤支が一致しません: ${position.skyBranch} / ${site.skyBranch}`);
  }
  const attr = intrinsicAttributesOfPosition(position);
  const siteElement = elementOf(site.siteBranch);
  return {
    general: position.general,
    generalElement: attr.element,
    affiliatedBranch: attr.affiliatedBranch,
    skyBranch: site.skyBranch,
    skyElement: site.skyElement,
    skyToGeneral: elementRelationBetweenElements(site.skyElement, attr.element),
    siteBranch: site.siteBranch,
    siteElement,
    siteToGeneral: elementRelationBetweenElements(siteElement, attr.element),
    skyBranchMatchesAffiliatedBranch: site.skyBranch === attr.affiliatedBranch,
    siteBranchMatchesAffiliatedBranch: site.siteBranch === attr.affiliatedBranch,
  };
}

/** 天盤支 → その支に乗る天将の関係 */
export function heavenlyGeneralPlacementRelationsOf(facts: InterpretationFacts, skyBranch: Branch): HeavenlyGeneralPlacementRelations {
  return placementRelationsFrom(heavenlyGeneralStateOf(facts, skyBranch), siteStateOf(facts, skyBranch));
}

/** 解決済みの anchor → その位置の天将の関係。日干・日支そのものは null */
export function heavenlyGeneralPlacementRelationsOfResolution(
  facts: InterpretationFacts, r: AnchorResolution,
): HeavenlyGeneralPlacementRelations | null {
  const position = heavenlyGeneralStateOfResolution(facts, r);
  return position ? placementRelationsFrom(position, siteStateOf(facts, position.skyBranch)) : null;
}
