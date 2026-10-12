// src/lib/ziwei/branchRelations.ts
//
// 十二支の関係（格局の破格判定で使う）。docs/ziwei-basic-spec.md §23.5。
//   冲 … 対宮（6支先。基礎編 S16「対冲にある宮」）。sanfangSizheng の opposite をそのまま使う
//   破 … 子⇔酉・丑⇔辰・寅⇔亥・卯⇔午・巳⇔申・未⇔戌（2026-10-01 ユーザー提示の関係表をそのまま転記。
//        プロジェクト内に再利用できる破の表がなかったため）

import type { Branch } from "./types";
import { sanfangSizheng } from "./sanfang";

const PO_PAIRS: readonly [Branch, Branch][] = [
  ["子", "酉"],
  ["丑", "辰"],
  ["寅", "亥"],
  ["卯", "午"],
  ["巳", "申"],
  ["未", "戌"],
];

/** 破: 支 → 破の支 */
export const BRANCH_PO: Readonly<Record<Branch, Branch>> = Object.fromEntries(
  PO_PAIRS.flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ]),
) as Record<Branch, Branch>;

export const BRANCH_PO_SOURCE = "2026-10-01 ユーザー提示（子⇔酉・丑⇔辰・寅⇔亥・卯⇔午・巳⇔申・未⇔戌）";

/** 冲: 支 → 冲の支（対宮） */
export function chongOf(b: Branch): Branch {
  return sanfangSizheng(b).opposite;
}

export function poOf(b: Branch): Branch {
  return BRANCH_PO[b];
}
