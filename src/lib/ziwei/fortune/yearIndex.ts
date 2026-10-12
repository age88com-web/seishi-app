// src/lib/ziwei/fortune/yearIndex.ts
//
// 流年指数（入門 p.100「運勢グラフ」）。docs/ziwei-basic-spec.md §34。
//   「大限の及ぼす影響が小限の２倍であると見て、（大限運命指数×２＋小限運命指数）により流年指数を算出し、表にし、
//    グラフを描くと、その人の一生の運勢の推移を一目で見ることができます。」
//   大限運命指数 … その年齢が属する大限（既存の大限表）の宮の、本命盤の運命指数（calculateChartPower）
//   小限運命指数 … その年齢の小限の宮（既存の小限）の、本命盤の運命指数
//   係数・補正は資料の式のまま（大限2・小限1）。大限四化・小限四化・行運格局・太歳・S40 喜忌・S33 の作用は数値に入れない。
//   大限開始前・大限表の範囲外は資料に代わりの式がないので null（小限だけで補わない）。
//   吉凶の区切りは資料にないので作らない（運命指数は「めやす」。入門 p.100）。
// 運命指数は小数1桁の値なので、0.1 単位の整数で計算して最後に戻す（途中で丸めない）。

import { calculateChartPower } from "../power";
import type { ChartPower } from "../power";
import { dayunAt } from "../dayun";
import { xiaoxianAt } from "../xiaoxian";
import type { Branch, PalaceName, ZiweiChart } from "../types";

export const YEAR_INDEX_FORMULA = { majorCoefficient: 2, minorCoefficient: 1, text: "大限運命指数×２＋小限運命指数" } as const;

export type YearIndexStatus = "ok" | "beforeFirstMajor" | "afterLastMajor" | "invalidAge";

export interface YearFortuneIndex {
  /** 数え年 */
  age: number;
  status: YearIndexStatus;
  /** その年齢が属する大限（選択中の大限ではなく、年齢から求める） */
  major: { branch: Branch; palace: PalaceName; startAge: number; endAge: number; destinyIndex: number } | null;
  minor: { branch: Branch; palace: PalaceName; destinyIndex: number } | null;
  /** 流年指数（計算できなければ null） */
  yearIndex: number | null;
}

const tenths = (v: number) => Math.round(v * 10);

/** 1年分の流年指数 */
export function calcYearFortuneIndex(chart: ZiweiChart, age: number, power: ChartPower = calculateChartPower(chart)): YearFortuneIndex {
  if (!Number.isInteger(age) || age < 1) return { age, status: "invalidAge", major: null, minor: null, yearIndex: null };
  const periods = chart.dayun.periods;
  const mb = xiaoxianAt(chart.xiaoxian, age);
  const minor = { branch: mb, palace: chart.palaces.find((p) => p.branch === mb)!.name, destinyIndex: power.byBranch[mb].index };
  const p = dayunAt(chart.dayun, age);
  if (!p) {
    const status: YearIndexStatus = age < periods[0].startAge ? "beforeFirstMajor" : "afterLastMajor";
    return { age, status, major: null, minor: status === "beforeFirstMajor" ? minor : null, yearIndex: null };
  }
  const major = { branch: p.branch, palace: chart.palaces.find((x) => x.branch === p.branch)!.name, startAge: p.startAge, endAge: p.endAge, destinyIndex: power.byBranch[p.branch].index };
  const t = tenths(major.destinyIndex) * YEAR_INDEX_FORMULA.majorCoefficient + tenths(minor.destinyIndex) * YEAR_INDEX_FORMULA.minorCoefficient;
  return { age, status: "ok", major, minor, yearIndex: t / 10 };
}

/** 全年齢（数え1歳〜既存の大限表の最後の年齢）の流年指数。計算できない年齢は yearIndex: null */
export function buildYearFortuneIndexSeries(chart: ZiweiChart, power: ChartPower = calculateChartPower(chart)): YearFortuneIndex[] {
  const last = chart.dayun.periods[chart.dayun.periods.length - 1].endAge;
  return Array.from({ length: last }, (_, i) => calcYearFortuneIndex(chart, i + 1, power));
}
