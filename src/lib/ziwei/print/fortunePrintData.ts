// src/lib/ziwei/print/fortunePrintData.ts
//
// /ziwei の解釈印刷のうち、運命指数・大限・小限の部分のデータ（docs/ziwei-basic-spec.md §25）。
// 既存の関数（buildYearFortuneIndexSeries・buildFortuneContextFor・buildFortunePalaceContext・
// buildFortuneStarMeaningContext・buildFortuneTransformationContext・selectionFromDate・xiaoxianAt）の結果を
// 印刷の並びに集めるだけ。大限・小限・流年指数の計算方法は変えない。新しい解釈文は作らない。
//   大限 … 既存の大限表（chart.dayun.periods）の全大限。各大限について、大限の宮（大限上の命宮）を
//          画面で「大限を選んで宮をクリック」したときと同じ行運星曜象意・大限四化・喜忌、その大限の行運格局（成立のみ）。
//   小限 … 全年齢の小限の宮（位置）。解釈文は鑑定日の小限（画面の行運欄と同じ年齢）の1年分だけ
//          （小限上の命宮について、画面と同じ行運星曜象意・小限四化・喜忌・年運上の作用）。

import type { Branch, CivilDate, PalaceName, Stem, ZiweiChart } from "../types";
import { xiaoxianAt } from "../xiaoxian";
import { calculateChartPower } from "../power";
import type { PowerGrade } from "../power";
import {
  buildFortuneContextFor,
  buildFortunePalaceContext,
  buildYearFortuneIndexSeries,
  minorAgeOptions,
  parseAppraisalDate,
  selectionFromDate,
  todayInJapan,
} from "../fortune";
import type { FortunePatternResult, LimitXijiResult, LiunianEffect, YearFortuneIndex } from "../fortune";
import { buildFortuneStarMeaningContext } from "../meanings/fortune";
import type { FortunePalaceStarInterpretation } from "../meanings/fortune";
import { buildFortuneTransformationContext } from "../meanings/fortune-transformations";
import type { FortuneTransformationSection } from "../meanings/fortune-transformations";

export interface PrintMajorLimit {
  startAge: number;
  endAge: number;
  branch: Branch;
  stem: Stem;
  natalPalace: PalaceName;
  /** 大限の宮の運命指数（本命盤） */
  index: number;
  grade: PowerGrade;
  /** 大限の宮の行運星曜象意（画面の FortuneStarPanel と同じ） */
  star: FortunePalaceStarInterpretation | null;
  hua: FortuneTransformationSection | null;
  xiji: LimitXijiResult | null;
  /** この大限の行運格局（成立のみ。画面の行運欄と同じ） */
  patterns: FortunePatternResult[];
}

export interface PrintMinorRow {
  branch: Branch;
  palace: PalaceName;
  ages: number[];
}

export interface PrintCurrentMinor {
  appraisalDate: string;
  age: number;
  branch: Branch;
  natalPalace: PalaceName;
  star: FortunePalaceStarInterpretation | null;
  hua: FortuneTransformationSection | null;
  xiji: LimitXijiResult | null;
  effects: LiunianEffect[];
}

export interface ZiweiFortunePrintData {
  /** 流年指数の推移（画面のグラフと同じ系列） */
  yearIndexSeries: YearFortuneIndex[];
  majors: PrintMajorLimit[];
  minorTable: PrintMinorRow[];
  /** 鑑定日の小限（鑑定日が不正・出生前なら null） */
  currentMinor: PrintCurrentMinor | null;
}

export function buildZiweiFortunePrintData(chart: ZiweiChart, appraisalDate: string): ZiweiFortunePrintData {
  const power = calculateChartPower(chart);
  const date: CivilDate | null = parseAppraisalDate(appraisalDate);
  // 太歳（鑑定日だけで決まる）は大限の解釈に使わないが、既存関数の入力として鑑定日が要る
  const dateForLimits: CivilDate = date ?? parseAppraisalDate(todayInJapan())!;

  const majors = chart.dayun.periods.map((p): PrintMajorLimit => {
    const f = buildFortuneContextFor(chart, dateForLimits, { majorStartAge: p.startAge, minorAge: null });
    const ml = f.majorLimit!;
    const ctx = buildFortunePalaceContext(chart, { appraisalDate: dateForLimits, majorStartAge: p.startAge, minorAge: null }, ml.palaceBranch);
    return {
      startAge: p.startAge,
      endAge: p.endAge,
      branch: ml.palaceBranch,
      stem: ml.palaceStem,
      natalPalace: ml.palaceName,
      index: power.byBranch[ml.palaceBranch].index,
      grade: power.byBranch[ml.palaceBranch].grade,
      star: buildFortuneStarMeaningContext(chart, ctx).major,
      hua: buildFortuneTransformationContext(ctx).major,
      xiji: ctx.fortune.majorXiji,
      patterns: f.majorPatterns.filter((x) => x.status === "confirmed"),
    };
  });

  const ages = minorAgeOptions(chart);
  const minorTable = chart.palaces.map((pl): PrintMinorRow => ({
    branch: pl.branch,
    palace: pl.name,
    ages: ages.filter((a) => xiaoxianAt(chart.xiaoxian, a) === pl.branch),
  }));

  let currentMinor: PrintCurrentMinor | null = null;
  if (date) {
    const sel = selectionFromDate(chart, appraisalDate);
    if (sel.minorAge !== null) {
      const f = buildFortuneContextFor(chart, date, { majorStartAge: sel.majorStartAge, minorAge: sel.minorAge });
      if (f.minorLimit) {
        const ctx = buildFortunePalaceContext(chart, { appraisalDate: date, majorStartAge: sel.majorStartAge, minorAge: sel.minorAge }, f.minorLimit.palaceBranch);
        currentMinor = {
          appraisalDate,
          age: sel.minorAge,
          branch: f.minorLimit.palaceBranch,
          natalPalace: f.minorLimit.palaceName,
          star: buildFortuneStarMeaningContext(chart, ctx).minor,
          hua: buildFortuneTransformationContext(ctx).minor,
          xiji: ctx.fortune.minorXiji,
          effects: ctx.liunianEffects,
        };
      }
    }
  }

  return { yearIndexSeries: buildYearFortuneIndexSeries(chart, power), majors, minorTable, currentMinor };
}
