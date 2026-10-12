// src/lib/ziwei/fortune/limitTransformations.ts
//
// 行運四化（大限四化・小限四化）。docs/ziwei-basic-spec.md §26。
//   基礎２ S37「生年干より十二宮の天干を五虎遁から求める」「分析する大限の天干より四化星を求める」、
//   S40「大限、小限で各宮の天干ごとの四化星の喜忌」。
//   大限四化: 大限が巡る宮 → その宮の天干 → その天干の四化
//   小限四化: 小限が巡る宮 → その宮の天干 → その天干の四化
// 既存のものを使う: 大限（dayun.periods・dayunAt）、小限（chart.xiaoxian・xiaoxianAt）、数え年（kazoeAge）、
//   宮干（palaceStemOf）、四化表（transformationTarget＝入門 表10。基礎２ S37 の差は変更しない）。
// 四化は本命盤の星に付く（星を動かさない）。生年四化（chart.transformations）は変更しない。
// 太歳宮・行運の格局・吉凶判定は次工程（ここでは扱わない）。

import { TRANSFORMATION_KINDS, transformationTarget } from "../data";
import { dayunAt } from "../dayun";
import { kazoeAge } from "../lunisolar";
import { palaceStemOf } from "../palaceStems";
import { xiaoxianAt } from "../xiaoxian";
import type { Branch, CivilDate, DayunPeriod, Stem, ZiweiChart } from "../types";
import type { LayeredTransformation, LimitTransformations, MajorLimitInput, TransformationOrigin } from "./types";

const palaceNameOf = (chart: ZiweiChart, b: Branch) => chart.palaces.find((p) => p.branch === b)!.name;

/** 天干の四化（4つ）を、星がある本命盤の宮に付ける */
export function transformationsForStem(chart: ZiweiChart, stem: Stem, origin: TransformationOrigin): LayeredTransformation[] {
  return TRANSFORMATION_KINDS.map((kind) => {
    const star = transformationTarget(kind, stem);
    const branch = chart.starPositions[star];
    return { origin, kind, star, branch, palace: palaceNameOf(chart, branch) };
  });
}

/** 生年四化（chart.transformations をそのまま層に載せる。変更しない） */
export function natalTransformations(chart: ZiweiChart): LayeredTransformation[] {
  return chart.transformations.map((t) => ({ origin: "natal", kind: t.kind, star: t.star, branch: t.branch, palace: palaceNameOf(chart, t.branch) }));
}

/** 大限四化。対象の大限は既存の大限（chart.dayun.periods の1つ）か、数え年（dayunAt。表の範囲外は null） */
export function majorLimitTransformations(chart: ZiweiChart, input: MajorLimitInput): LimitTransformations | null {
  const period: DayunPeriod | null = "period" in input ? input.period : dayunAt(chart.dayun, input.age);
  if (!period) return null;
  const stem = palaceStemOf(chart.yearStem, period.branch);
  return {
    limitType: "major",
    ageRange: [period.startAge, period.endAge],
    age: null,
    palaceBranch: period.branch,
    palaceName: palaceNameOf(chart, period.branch),
    palaceStem: stem,
    transformations: transformationsForStem(chart, stem, "major"),
  };
}

/** 小限四化。数え年（1以上の整数）から既存の小限の宮（xiaoxianAt）を引く */
export function minorLimitTransformations(chart: ZiweiChart, age: number): LimitTransformations {
  const branch = xiaoxianAt(chart.xiaoxian, age);
  const stem = palaceStemOf(chart.yearStem, branch);
  return {
    limitType: "minor",
    ageRange: null,
    age,
    palaceBranch: branch,
    palaceName: palaceNameOf(chart, branch),
    palaceStem: stem,
    transformations: transformationsForStem(chart, stem, "minor"),
  };
}

/**
 * 日付（西暦）の数え年。既存の kazoeAge（陰暦の年が変わる旧正月で1歳加算。§2.1）を使う。
 * 西暦年だけでは旧正月の前後で数え年が2つになり得るため、日付で指定する。
 */
export function kazoeAgeOn(chart: ZiweiChart, date: CivilDate): number {
  return kazoeAge(chart.lunar.lunarYear, date);
}

/** 宮ごとの四化の層（生年・大限・小限を統合せずに並べる。sanfangSizheng の宮の支でそのまま引ける） */
export function transformationLayersByBranch(
  chart: ZiweiChart,
  layers: { major?: LimitTransformations | null; minor?: LimitTransformations | null } = {},
): Record<Branch, LayeredTransformation[]> {
  const all = [...natalTransformations(chart), ...(layers.major?.transformations ?? []), ...(layers.minor?.transformations ?? [])];
  const out = Object.fromEntries(chart.palaces.map((p) => [p.branch, [] as LayeredTransformation[]])) as Record<Branch, LayeredTransformation[]>;
  for (const t of all) out[t.branch].push(t);
  return out;
}
