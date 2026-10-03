// src/lib/liuren/interpretation/states.ts
//
// 役割:
//   解釈で使う基礎状態（旺相休囚死・十二長生・五行墓庫）を返す純粋関数。入力 → 状態 だけを返し、吉凶は判断しない。
//   五行・三合局の表は起課エンジン（constants.ts）のものを使う。
//
// 旺相休囚死（ユーザー指定の規則、2026-10-03）:
//   月令の五行を旺とし、月令が生ずる五行＝相、月令を生ずる五行＝休、月令を剋す五行＝囚、月令が剋す五行＝死。
//   月令（rulingElementOfMonth）: 寅卯＝木、巳午＝火、申酉＝金、亥子＝水、辰未戌丑＝土（四季土旺。月令単位）。
//   四季に寄旺する十八日単位の判定はしない（別Phase）。
//   月令の取得元は日時入力の calendar.monthBranch（節月）。月将（chart.input.monthGeneral）は使わない。
//
// 十二長生（growthStageOf）＝ 六壬の五行生墓法（『六壬粹言』五行十干生墓第四。ユーザー確定 2026-10-03）:
//   十干を五行に直してから求める。陰陽を分けず、五行ごとに一律順行（十干別の陽順陰逆は子平の方法で採らない）。
//   長生の支は講座 p54 の三合局（SANHE）の「生」: 木＝亥、火＝寅、金＝巳、水＝申。
//   土は火に従う（『六壬粹言』土墓従火第五）: 寅＝長生 … 戌＝墓。
//
// 五行墓庫（elementTombOf）:
//   三合局（SANHE）の「墓」: 木＝未、火＝戌、金＝丑、水＝辰。土は火に従い戌。
//   十二長生の「墓」（GrowthStage）とは別の概念。入墓の吉凶は判断しない。
//   isElementInTomb / elementInTombOf … ある五行がその墓庫の支に臨んでいるか（五行墓庫への入墓。Phase 3C）。
//   十二長生の墓（growthStageOf(...) === "墓"）とは別の関数・別の結果型（kind: "elementInTomb"）。

import { BRANCHES, BRANCH_ELEMENT, ELEMENT_CONTROLS, ELEMENT_GENERATES, SANHE, STEM_ELEMENT } from "../constants";
import type { Stem, Branch, Element } from "../types";
import type { ElementInTombFact, ElementTomb, GrowthStage, SeasonalStrength } from "./types";

/** 対象五行の旺相休囚死（ruling＝月令の五行） */
export function seasonalStrengthOf(target: Element, ruling: Element): SeasonalStrength {
  if (target === ruling) return "旺";
  if (ELEMENT_GENERATES[ruling] === target) return "相";
  if (ELEMENT_GENERATES[target] === ruling) return "休";
  if (ELEMENT_CONTROLS[target] === ruling) return "囚";
  return "死"; // 残るのは ELEMENT_CONTROLS[ruling] === target のみ
}

/** 月支 → 月令の五行（講座 p5 の方合の四季＋四季月の土旺） */
const RULING_ELEMENT_OF_MONTH: Record<Branch, Element> = {
  寅: "木", 卯: "木", 辰: "土",
  巳: "火", 午: "火", 未: "土",
  申: "金", 酉: "金", 戌: "土",
  亥: "水", 子: "水", 丑: "土",
};

/** 月支（calendar.monthBranch）→ 月令の五行 */
export function rulingElementOfMonth(monthBranch: Branch): Element {
  return RULING_ELEMENT_OF_MONTH[monthBranch];
}

/** 十二長生の順（長生から順行） */
export const GROWTH_STAGES: readonly GrowthStage[] = [
  "長生", "沐浴", "冠帯", "臨官", "帝旺", "衰", "病", "死", "墓", "絶", "胎", "養",
];

/** 五行生墓法で見る三合局（土は火に従う） */
function sanheOf(element: Element): readonly [Branch, Branch, Branch] {
  const basis: Element = element === "土" ? "火" : element;
  const group = SANHE.find((g) => BRANCH_ELEMENT[g[1]] === basis);
  if (!group) throw new Error(`三合局が見つかりません: ${element}`);
  return group;
}

/** 五行と支 → 十二長生（五行生墓法。陰陽を分けず一律順行） */
export function growthStageOf(element: Element, branch: Branch): GrowthStage {
  const start = sanheOf(element)[0];
  const k = (BRANCHES.indexOf(branch) - BRANCHES.indexOf(start) + 12) % 12;
  return GROWTH_STAGES[k];
}

/** 十干と支 → 十二長生。十干を五行に直してから growthStageOf で求める（陰干も逆行しない） */
export function growthStageOfStem(stem: Stem, branch: Branch): GrowthStage {
  return growthStageOf(STEM_ELEMENT[stem], branch);
}

/** 五行の墓庫（三合局の墓。土は火に従う） */
export function elementTombOf(element: Element): ElementTomb {
  return { kind: "elementTomb", element, branch: sanheOf(element)[2] };
}

/** その五行が、その五行墓庫の支に臨んでいるか（五行墓庫への入墓） */
export function isElementInTomb(element: Element, branch: Branch): boolean {
  return elementTombOf(element).branch === branch;
}

/** 五行墓庫への入墓の事実（十二長生の墓とは別の結果型） */
export function elementInTombOf(element: Element, branch: Branch): ElementInTombFact {
  const tombBranch = elementTombOf(element).branch;
  return { kind: "elementInTomb", element, branch, tombBranch, inTomb: tombBranch === branch };
}
