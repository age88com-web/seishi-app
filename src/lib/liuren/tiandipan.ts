// src/lib/liuren/tiandipan.ts
//
// 役割:
//   天地盤（講座 p8）。占時の地盤支の上に月将を置き、十二支を順行に布局する。
//
//   差分 = 月将 − 占時（mod 12）
//   地盤支 b の天盤支 = b + 差分
//   例（講座 p6・p8）: 月将子・占時酉 → 差分 3、地盤子の上は卯。

import { BRANCHES } from "./constants";
import { shiftBranch } from "./relations";
import type { Branch, HeavenEarthPlate } from "./types";

export function buildPlate(monthGeneral: Branch, divinationBranch: Branch): HeavenEarthPlate {
  const offset = (((BRANCHES.indexOf(monthGeneral) - BRANCHES.indexOf(divinationBranch)) % 12) + 12) % 12;
  const heavenOn = {} as Record<Branch, Branch>;
  const earthUnder = {} as Record<Branch, Branch>;
  for (const b of BRANCHES) {
    const h = shiftBranch(b, offset);
    heavenOn[b] = h;
    earthUnder[h] = b;
  }
  return { offset, heavenOn, earthUnder };
}
