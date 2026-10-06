// src/lib/shichusuimei/index.ts
//
// 四柱推命 Phase 1 基礎計算エンジンの公開窓口。
// 正本: docs/shichusuimei-basic-spec.md（確定仕様 D1〜D29）
// 範囲: 命式4柱・地方真太陽時補正・大運（通変星・蔵干・神煞・命式との干支関係）・蔵干・通変星・神煞13種・干支関係の存在検出。
// 範囲外: 空亡・命宮・胎元・強弱・格局・用神・吉凶判断・UI。

import type { ShichusuimeiInput, ShichusuimeiResult } from "./types";
import { calculateMeishiki } from "./chart";
import { calculateDaiun, DEFAULT_DAIUN_COUNT } from "./dayun";
import { meishikiDetails } from "./zokan";
import { judgeShinsatsu } from "./shinsatsu";
import { detectRelations } from "./relations";
import { daiunDetails } from "./daiunDetail";

export function calculateShichusuimei(input: ShichusuimeiInput): ShichusuimeiResult {
  const meishiki = calculateMeishiki(input.birth, input.place);
  const daiun = calculateDaiun(meishiki, input.sex, input.daiunCount ?? DEFAULT_DAIUN_COUNT);
  const shinsatsu = judgeShinsatsu({ pillars: meishiki.pillars, luck: daiun.periods.map((p) => p.pillar) });
  return {
    meishiki,
    details: meishikiDetails(meishiki),
    daiun,
    daiunDetails: daiunDetails(meishiki, daiun, shinsatsu),
    shinsatsu,
    relations: detectRelations(meishiki.pillars),
  };
}

export { calculateMeishiki } from "./chart";
export {
  calculateDaiun,
  daiunDirection,
  daiunPillars,
  surroundingJie,
  sexagenaryIndex,
  sexagenaryPillar,
  DEFAULT_DAIUN_COUNT,
} from "./dayun";
export {
  toLocalApparentSolarTime,
  resolveRegionalDiff,
  resolveStandardOffsetMinutes,
  equationOfTimeMinutes,
} from "./timeCorrection";
export { zokanOf, pillarDetail, meishikiDetails } from "./zokan";
export { tsuhenOf, goshinOfElement } from "./tsuhensei";
export { judgeShinsatsu } from "./shinsatsu";
export type { ShinsatsuInput } from "./shinsatsu";
export { detectRelations, detectLuckRelations } from "./relations";
export { daiunDetails } from "./daiunDetail";
export {
  SANSATSU_DIRECTION_ONLY,
  STEM_ELEMENT,
  STEM_YINYANG,
  P22_REGIONAL_DIFF_AS_PRINTED,
  P22_EXCLUDED_FROM_CALCULATION,
} from "./data";
export type * from "./types";
