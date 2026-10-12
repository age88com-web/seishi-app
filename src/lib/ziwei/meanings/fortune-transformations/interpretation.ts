// src/lib/ziwei/meanings/fortune-transformations/interpretation.ts
//
// 宮クリック用の行運四化象意（docs/ziwei-basic-spec.md §30）。
// クリックした物理的な宮について、buildFortunePalaceContext の transformations（transformationLayersByBranch の層のまま）から
// 大限四化・小限四化だけを取り出し、共通の四化象意データを引く（再計算しない）。
// 本命四化は扱わない。宮の力量・星曜象意の条件・行運格局・太歳・喜忌には影響させない。

import type { FortunePalaceContext } from "../../fortune/context";
import type { TransformationKind } from "../../types";
import { TRANSFORMATION_MEANINGS } from "./data";
import type { EvaluatedTransformationMeaning, FortuneTransformationSection, TransformationMeaning, TransformationType } from "./types";

const TYPE_OF: Readonly<Record<TransformationKind, TransformationType>> = { 化禄星: "化禄", 化権星: "化権", 化科星: "化科", 化忌星: "化忌" };
const ORDER: readonly TransformationType[] = ["化禄", "化権", "化科", "化忌"];

/** 四化の種類の象意データ（大限・小限で共通） */
export function transformationMeaningOf(kind: TransformationKind): TransformationMeaning {
  return TRANSFORMATION_MEANINGS[TYPE_OF[kind]];
}

/** その宮に付いた、指定した層（大限・小限）の四化の象意。なければ null（欄を出さない） */
export function buildFortuneTransformationSection(ctx: FortunePalaceContext, origin: "major" | "minor"): FortuneTransformationSection | null {
  const layer = origin === "major" ? ctx.fortune.majorLimit : ctx.fortune.minorLimit;
  if (!layer) return null;
  const ts = ctx.transformations.filter((t) => t.origin === origin);
  if (ts.length === 0) return null;
  const items = ts
    .map((t): EvaluatedTransformationMeaning => {
      const m = transformationMeaningOf(t.kind);
      return {
        origin,
        star: t.star,
        type: m.type,
        label: `${origin === "major" ? "大" : "小"}${m.type.slice(1)}`,
        coreMeanings: m.coreMeanings.filter((c) => c.display).map((c) => c.text),
        fortuneTexts: m.fortuneTexts
          .filter((f) => f.display && f.appliesTo.includes(origin) && (!f.condition || (f.condition.kind === "natalMing" && ctx.natalPalace === "命宮")))
          .map((f) => f.text),
      };
    })
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  return { origin, branch: ctx.branch, natalPalace: ctx.natalPalace, items };
}

/** 宮クリック用: 大限四化・小限四化（統合しない） */
export function buildFortuneTransformationContext(ctx: FortunePalaceContext) {
  return { major: buildFortuneTransformationSection(ctx, "major"), minor: buildFortuneTransformationSection(ctx, "minor") };
}
