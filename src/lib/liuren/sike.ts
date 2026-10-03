// src/lib/liuren/sike.ts
//
// 役割:
//   四課（講座 p6・p7・p45）。
//     一課: 日干の寄宮支を地盤として、その天盤支（干上神）
//     二課: 一課上神を地盤として、その天盤支
//     三課: 日支を地盤として、その天盤支（支上神）
//     四課: 三課上神を地盤として、その天盤支

import { JIGONG } from "./constants";
import type { Stem, Branch, FourLessons, HeavenEarthPlate } from "./types";

export function buildFourLessons(dayStem: Stem, dayBranch: Branch, plate: HeavenEarthPlate): FourLessons {
  const on = plate.heavenOn;
  const jigong = JIGONG[dayStem];
  const u1 = on[jigong];
  const u2 = on[u1];
  const u3 = on[dayBranch];
  const u4 = on[u3];
  return [
    { index: 1, upper: u1, lower: dayStem, lowerBranch: jigong },
    { index: 2, upper: u2, lower: u1, lowerBranch: u1 },
    { index: 3, upper: u3, lower: dayBranch, lowerBranch: dayBranch },
    { index: 4, upper: u4, lower: u3, lowerBranch: u3 },
  ];
}
