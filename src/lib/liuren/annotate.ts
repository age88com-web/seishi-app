// src/lib/liuren/annotate.ts
//
// 役割:
//   三伝の各伝に付加情報を付ける（講座 p44）。
//     遁干: 日干支の旬で、その支に当たる干。空亡の支は遁干なし
//     空亡: 日干支の旬で干が当たらない2支
//     天将: その支（天盤）に乗る天将
//     六親: 日干からみた六親（p55）
//
// 未確定（講座に説明なし）:
//   講座の表は空亡に「○」、一部に「・」を付けるが、「・」の意味は説明がない
//   （例題①では空亡でない酉にも「・」）。本実装は「・」を再現せず、
//   空亡なら hiddenStem = null・isVoid = true とする。

import { sixRelation } from "./relations";
import type { Stem, Branch, GeneralsLayout, TransmissionDetail } from "./types";

export function annotateTransmission(
  branch: Branch,
  dayStem: Stem,
  xun: { voidBranches: readonly [Branch, Branch]; hiddenStemOf: (b: Branch) => Stem | null },
  generals: GeneralsLayout,
): TransmissionDetail {
  const isVoid = xun.voidBranches.includes(branch);
  return {
    branch,
    hiddenStem: isVoid ? null : xun.hiddenStemOf(branch),
    isVoid,
    general: generals.generalOn[branch],
    relation: sixRelation(dayStem, branch),
  };
}
