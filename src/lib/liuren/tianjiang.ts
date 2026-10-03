// src/lib/liuren/tianjiang.ts
//
// 役割:
//   十二天将の配置（講座 p8・p9）。
//     1. 昼夜: 占時が卯〜申なら昼、酉〜寅なら夜（p8）
//     2. 貴人支: 日干の昼貴人／夜貴人（p8 の表）
//     3. 貴人の位置: 天盤の貴人支の下の地盤支（p9）
//     4. 位置が亥子丑寅卯辰なら順布、巳午未申酉戌なら逆布（p9）
//     5. 位置から地盤を順または逆に進み、貴蛇雀合陳龍空虎常武陰后を天盤支に載せる
//
// 未確定（講座内の矛盾）:
//   講座の例題⑤（辛卯日・未時）の回答は、p8 の規則（昼＝辛の昼貴人寅）では
//   再現できない。p42 はユーザー訂正（亥刻・夜貴人子・順行）で p8 と整合する。
//   本実装は p8 の規則に従う。

import { BRANCHES, NOBLE_DAY, NOBLE_NIGHT, DAY_BRANCHES, FORWARD_POSITIONS, GENERALS } from "./constants";
import { shiftBranch } from "./relations";
import type { Stem, Branch, GeneralsLayout, HeavenEarthPlate, HeavenlyGeneral } from "./types";

export function placeGenerals(dayStem: Stem, divinationBranch: Branch, plate: HeavenEarthPlate): GeneralsLayout {
  const dayOrNight = DAY_BRANCHES.includes(divinationBranch) ? "昼" : "夜";
  const nobleBranch = dayOrNight === "昼" ? NOBLE_DAY[dayStem] : NOBLE_NIGHT[dayStem];
  const noblePosition = plate.earthUnder[nobleBranch];
  const direction = FORWARD_POSITIONS.includes(noblePosition) ? "順" : "逆";
  const step = direction === "順" ? 1 : -1;

  const generalOn = {} as Record<Branch, HeavenlyGeneral>;
  GENERALS.forEach((g, i) => {
    const earth = shiftBranch(noblePosition, step * i);
    generalOn[plate.heavenOn[earth]] = g;
  });
  // 全12支に1将ずつ載ることの確認（配置ロジックの不変条件）
  if (BRANCHES.some((b) => !generalOn[b])) {
    throw new Error("十二天将の配置に欠けがあります");
  }
  return { dayOrNight, nobleBranch, noblePosition, direction, generalOn };
}
