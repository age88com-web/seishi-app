// src/lib/ziwei/transformations.ts
//
// §11.2 四化（化禄・化権・化科・化忌）。生年干で対象の星が決まり、その星の宮に付く。

import type { Branch, PlacedStar, Stem, Transformation } from "./types";
import { TRANSFORMATION_KINDS, transformationTarget } from "./data";

export function transformationsOf(yearStem: Stem, starPositions: Record<PlacedStar, Branch>): Transformation[] {
  return TRANSFORMATION_KINDS.map((kind) => {
    const star = transformationTarget(kind, yearStem);
    return { kind, star, branch: starPositions[star] };
  });
}
