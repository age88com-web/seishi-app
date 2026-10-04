// src/lib/liuren/interpretation/heavenlyGeneralAttributes.ts
//
// 役割（Phase 4G）:
//   十二天将の固有属性（HeavenlyGeneralIntrinsicAttributes）。『六壬神課講座』p56「十二天将象意」表の
//   「所属干支」列（例: 貴人＝己丑土）を、干・支・五行に分けてそのまま転記した静的データ。
//   盤（日干・日支・月将・占時・昼夜・順逆）によらない。
//   天将が今乗っている天盤支（Phase 4B）、その下の地盤支（Phase 4A の siteBranch）とは別のもの。
//   p56 の「象意」列（象意語・色・数）は入れない。天将の五行と日干・支・地盤支の生剋は求めない（relationBetween も使わない）。
//   吉凶・ROLE・DOMAIN は持たない。

import type { Branch, Element, HeavenlyGeneral, Stem } from "../types";
import type { AnchorResolution } from "./anchorResolver";
import { heavenlyGeneralStateOfResolution } from "./heavenlyGeneralState";
import type { HeavenlyGeneralIntrinsicAttributes, HeavenlyGeneralPositionState, InterpretationFacts } from "./types";

/** 講座 p56「所属干支」列（干・支・五行の順。表の表記どおり） */
const AFFILIATION: Record<HeavenlyGeneral, readonly [Stem, Branch, Element]> = {
  貴人: ["己", "丑", "土"],
  螣蛇: ["丁", "巳", "火"],
  朱雀: ["丙", "午", "火"],
  六合: ["乙", "卯", "木"],
  勾陳: ["戊", "辰", "土"],
  青龍: ["甲", "寅", "木"],
  天空: ["戊", "戌", "土"],
  白虎: ["庚", "申", "金"],
  太常: ["己", "未", "土"],
  玄武: ["癸", "亥", "水"],
  太陰: ["辛", "酉", "金"],
  天后: ["壬", "子", "水"],
};

/** 天将 → 固有属性 */
export function heavenlyGeneralIntrinsicAttributesOf(general: HeavenlyGeneral): HeavenlyGeneralIntrinsicAttributes {
  const [affiliatedStem, affiliatedBranch, element] = AFFILIATION[general];
  return { general, affiliatedStem, affiliatedBranch, element };
}

/** Phase 4B の位置 FACT（どの天盤支にどの天将がいるか）→ その天将の固有属性 */
export function intrinsicAttributesOfPosition(state: HeavenlyGeneralPositionState): HeavenlyGeneralIntrinsicAttributes {
  return heavenlyGeneralIntrinsicAttributesOf(state.general);
}

/** 解決済みの anchor → その位置の天将（Phase 4B）→ 固有属性。日干・日支そのものは null */
export function heavenlyGeneralIntrinsicAttributesOfResolution(
  facts: InterpretationFacts, r: AnchorResolution,
): HeavenlyGeneralIntrinsicAttributes | null {
  const state = heavenlyGeneralStateOfResolution(facts, r);
  return state ? intrinsicAttributesOfPosition(state) : null;
}
