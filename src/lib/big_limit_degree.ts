// src/lib/big_limit_degree.ts
// 七政四餘：大限の限度・限宿・限度主（第2限以降のみ）
// 根拠（『張果星宗』）：
//  - 定行限度法：各宮を担当年数で均等に進む（相貌10年＝1年3度、官禄15年＝1年2度 …）→ 年間進行量 = 30 / 担当年数
//  - 度數所在・陽刃の入出（例：卯は「入尾二出氐一」）：限は宿度の減る向きに進む
// 現行座標系では大限は 戌→亥→子… と黄経の減る向きに宮を移るため、宮の入口＝宮の上端（黄経の大きい側）、
// 出口＝下端。限度の黄経 = 宮の上端 − 経過年数 × 年間進行量。
// 第1限（命宮）の宮内進行は原典で未確定のため計算しない。年齢は既存の対象年齢をそのまま使う（年齢体系は未確定のまま）。

import { getCurrentBigLimit, type Branch } from "./big_limit";
import { branchFromLon } from "./branch_from_lon";
import { lonToMansionDeg } from "./mansions28";
import { getMansionDegreeLord } from "./qizheng_interpretations";

export type BigLimitDegree =
  | {
      available: true;
      targetAge: number;
      limitOrder: number;       // 第n限（2〜12）
      branch: Branch;
      palaceName: string;
      startAge: number;
      endAge: number;
      elapsedYears: number;
      degreesPerYear: number;
      progressedDegree: number; // 宮の入口からの進行度（0〜30）
      longitude: number;        // 限度の黄経
      mansion: string;          // 限宿
      mansionDegree: number;    // 宿内度（既存 lonToMansionDeg の degInMansion）
      degreeLord: { groupName: string; star: string } | null; // 限度主
    }
  | { available: false; reason: "no_target_age" | "out_of_range" | "other_limit" | "first_limit_unconfirmed" | "mansion_lookup_failed" };

/** 現行座標系での当宮の黄経範囲の下端（branchFromLon と同じ割り付け）。命度宿（lib/ming_mansion.ts）でも同じものを使う */
export function palaceLowLon(branch: string): number | null {
  for (let k = 0; k < 12; k++) if (branchFromLon(k * 30 + 15) === branch) return k * 30;
  return null;
}

const norm360 = (x: number) => ((x % 360) + 360) % 360;

/**
 * 対象年齢の大限が clickedBranch のとき、その限度を返す。
 * 区間判定は getCurrentBigLimit（startAge 以上 endAge 未満）をそのまま使う。
 */
export function getBigLimitDegree(args: {
  mingBranch: Branch;
  mingDegree: number;
  targetAge: number | null | undefined;
  clickedBranch: string;
}): BigLimitDegree {
  if (args.targetAge == null) return { available: false, reason: "no_target_age" };
  const sp = getCurrentBigLimit(args.mingBranch, args.mingDegree, args.targetAge);
  if (!sp) return { available: false, reason: "out_of_range" };
  if (sp.branch !== args.clickedBranch) return { available: false, reason: "other_limit" };
  if (sp.order === 0) return { available: false, reason: "first_limit_unconfirmed" };
  const low = palaceLowLon(sp.branch);
  if (low == null) return { available: false, reason: "out_of_range" };

  const years = sp.endAge - sp.startAge; // 既存の大限年数（LIMIT_YEARS）と同じ
  const degreesPerYear = 30 / years;
  const elapsedYears = args.targetAge - sp.startAge;
  const progressedDegree = elapsedYears * degreesPerYear;
  const longitude = norm360(low + 30 - progressedDegree);
  const m = lonToMansionDeg(longitude);
  // 既存 lonToMansionDeg が該当宿を見つけられず保険値（角0）を返した場合は出さない
  // （現行では壁宿 352〜360° がこれに当たる。宿計算そのものはここでは直さない）
  if (!m || ((longitude - m.startLonDeg) % 360 + 360) % 360 >= m.mansion.widthDeg + 1e-9) {
    return { available: false, reason: "mansion_lookup_failed" };
  }
  const mansion = m.mansion.label;
  return {
    available: true,
    targetAge: args.targetAge,
    limitOrder: sp.order + 1,
    branch: sp.branch,
    palaceName: sp.palaceName,
    startAge: sp.startAge,
    endAge: sp.endAge,
    elapsedYears,
    degreesPerYear,
    progressedDegree,
    longitude,
    mansion,
    mansionDegree: m.degInMansion,
    degreeLord: getMansionDegreeLord(mansion),
  };
}
