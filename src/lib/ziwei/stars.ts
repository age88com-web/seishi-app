// src/lib/ziwei/stars.ts
//
// 宮に配置する30星（§8 十四主星・§9 時系・§10 月系・§11.1 年干系・§12 年支系）。
// 規則式は仕様書のもの（表7・表8・表9・表11 と全セル一致を tests/ziwei_phase1.manual.ts で確認）。
// 年干系（表10）は規則式がないため表のまま引く。

import type { Branch, HourStar, MainStar, MonthStar, PlacedStar, Stem, YearBranchStar, YearStemStar } from "./types";
import { YEAR_STEM_STAR_TABLE, branchAt, branchIndex, stemIndex } from "./data";

/** §8 十四主星。紫微星系は紫微から、天府星系は天府（＝辰−紫微）から。 */
export function mainStarsOf(ziwei: Branch): Record<MainStar, Branch> {
  const z = branchIndex(ziwei);
  const f = 4 - z; // 天府星
  return {
    紫微星: branchAt(z),
    天機星: branchAt(z - 1),
    太陽星: branchAt(z - 3),
    武曲星: branchAt(z - 4),
    天同星: branchAt(z - 5),
    廉貞星: branchAt(z - 8),
    天府星: branchAt(f),
    太陰星: branchAt(f + 1),
    貪狼星: branchAt(f + 2),
    巨門星: branchAt(f + 3),
    天相星: branchAt(f + 4),
    天梁星: branchAt(f + 5),
    七殺星: branchAt(f + 6),
    破軍星: branchAt(f + 10),
  };
}

/** §9.2 火星・鈴星の子時の宮（生年支の三合グループ別）。以後、生時支に応じて順行。 */
const FIRE_BELL_START: readonly { members: string; fire: number; bell: number }[] = [
  { members: "寅午戌", fire: 1, bell: 3 }, // 火 丑・鈴 卯
  { members: "申子辰", fire: 2, bell: 10 }, // 火 寅・鈴 戌
  { members: "巳酉丑", fire: 3, bell: 10 }, // 火 卯・鈴 戌
  { members: "亥卯未", fire: 9, bell: 10 }, // 火 酉・鈴 戌
];

/** §9 時系諸星（文昌・文曲・天空・地劫は生時支のみ、火星・鈴星は生年支＋生時支）。 */
export function hourStarsOf(hourBranch: Branch, yearBranch: Branch): Record<HourStar, Branch> {
  const h = branchIndex(hourBranch);
  const group = FIRE_BELL_START.find((g) => g.members.includes(yearBranch));
  if (group === undefined) throw new Error(`火星・鈴星: 生年支 ${yearBranch} の三合グループが見つかりません`);
  return {
    文昌星: branchAt(10 - h),
    文曲星: branchAt(4 + h),
    天空星: branchAt(11 - h),
    地劫星: branchAt(11 + h),
    火星: branchAt(group.fire + h),
    鈴星: branchAt(group.bell + h),
  };
}

/** §10 天馬星は 申・巳・寅・亥 の4ヶ月周期。 */
const TENMA_CYCLE: readonly Branch[] = ["申", "巳", "寅", "亥"];

/** §10 月系諸星（生月は閏月のみなし後の月）。 */
export function monthStarsOf(birthMonth: number): Record<MonthStar, Branch> {
  const m = birthMonth - 1;
  return {
    左輔星: branchAt(4 + m),
    右弼星: branchAt(10 - m),
    天姚星: branchAt(1 + m),
    天馬星: TENMA_CYCLE[m % 4],
  };
}

/** §11.1 年干系諸星（表10）。 */
export function yearStemStarsOf(yearStem: Stem): Record<YearStemStar, Branch> {
  const i = stemIndex(yearStem);
  const out = {} as Record<YearStemStar, Branch>;
  for (const star of Object.keys(YEAR_STEM_STAR_TABLE) as YearStemStar[]) {
    out[star] = YEAR_STEM_STAR_TABLE[star][i] as Branch;
  }
  return out;
}

/** §12 年支系諸星。紅鸞星 = 卯 − 年支。 */
export function yearBranchStarsOf(yearBranch: Branch): Record<YearBranchStar, Branch> {
  return { 紅鸞星: branchAt(3 - branchIndex(yearBranch)) };
}

/** 30星すべての宮。 */
export function placeStars(input: {
  ziwei: Branch;
  hourBranch: Branch;
  birthMonth: number;
  yearStem: Stem;
  yearBranch: Branch;
}): Record<PlacedStar, Branch> {
  return {
    ...mainStarsOf(input.ziwei),
    ...hourStarsOf(input.hourBranch, input.yearBranch),
    ...monthStarsOf(input.birthMonth),
    ...yearStemStarsOf(input.yearStem),
    ...yearBranchStarsOf(input.yearBranch),
  };
}
