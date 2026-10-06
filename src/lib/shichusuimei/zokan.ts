// src/lib/shichusuimei/zokan.ts
//
// 蔵干（p114、D18）と、四柱ごとの天干・蔵干の通変星（D16）。

import type { Branch, Meishiki, Pillar, PillarDetail, ShichusuimeiResult, Stem, ZokanEntry } from "./types";
import { ZOKAN } from "./data";
import { tsuhenOf } from "./tsuhensei";

export function zokanOf(branch: Branch): ZokanEntry {
  return ZOKAN[branch];
}

export function pillarDetail(pillar: Pillar, dayStem: Stem, isDayMaster: boolean): PillarDetail {
  const entry = zokanOf(pillar.branch);
  return {
    pillar,
    stemTsuhen: tsuhenOf(dayStem, pillar.stem),
    isDayMaster,
    zokan: entry.stems.map((stem) => ({ stem, tsuhen: tsuhenOf(dayStem, stem) })),
    zokanRoles: entry.roles,
  };
}

export function meishikiDetails(m: Meishiki): ShichusuimeiResult["details"] {
  const dayStem = m.pillars.日.stem;
  return {
    時: m.pillars.時 ? pillarDetail(m.pillars.時, dayStem, false) : null,
    日: pillarDetail(m.pillars.日, dayStem, true),
    月: pillarDetail(m.pillars.月, dayStem, false),
    年: pillarDetail(m.pillars.年, dayStem, false),
  };
}
