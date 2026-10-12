// src/lib/ziwei/xiaoxian.ts
//
// §14 小限（年運。数え年）。
//   数え1歳の宮: 寅午戌→辰、申子辰→戌、巳酉丑→未、亥卯未→丑（生年支の三合グループ）
//   男性は1歳ごとに順行、女性は逆行（生年干の陰陽は関係しない）。

import type { Branch, Sex, Xiaoxian } from "./types";
import { branchAt, branchIndex } from "./data";

const XIAOXIAN_START: readonly { members: string; start: Branch }[] = [
  { members: "寅午戌", start: "辰" },
  { members: "申子辰", start: "戌" },
  { members: "巳酉丑", start: "未" },
  { members: "亥卯未", start: "丑" },
];

export function xiaoxianOf(yearBranch: Branch, sex: Sex): Xiaoxian {
  const group = XIAOXIAN_START.find((g) => g.members.includes(yearBranch));
  if (group === undefined) throw new Error(`小限: 生年支 ${yearBranch} の三合グループが見つかりません`);
  return { startBranch: group.start, direction: sex === "male" ? "順行" : "逆行" };
}

/** 数え年 age（1以上の整数）の小限の宮。 */
export function xiaoxianAt(xiaoxian: Xiaoxian, age: number): Branch {
  if (!Number.isInteger(age) || age < 1) throw new RangeError(`小限: 数え年は1以上の整数（${age}）`);
  const s = branchIndex(xiaoxian.startBranch);
  return branchAt(xiaoxian.direction === "順行" ? s + (age - 1) : s - (age - 1));
}
