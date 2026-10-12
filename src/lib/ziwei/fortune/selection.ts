// src/lib/ziwei/fortune/selection.ts
//
// 行運の選択状態（鑑定日・選択中の大限・選択中の小限）。docs/ziwei-basic-spec.md §28。
// 3つは別の状態として持つ:
//   鑑定日を変える → その日の大限・小限（数え年）に同期する（その日の行運状態へ戻る）
//   大限を選ぶ     → 大限だけ変える。選択中の小限がその大限の範囲内なら維持、範囲外なら大限の開始年齢へ
//   小限を選ぶ     → 小限だけ変える。その数え年を含む大限が今の大限と違えば、大限もその大限へ切り替える
//   どの操作でも鑑定日は変えない。太歳宮は鑑定日だけで決まる（小限の年齢から西暦の日付は一意に決まらないため）。
// 大限は既存の大限（chart.dayun.periods）の開始年齢で識別し、範囲は既存の表のまま（§18 U8）。

import { dayunAt } from "../dayun";
import type { ZiweiChart } from "../types";
import { kazoeAgeOn } from "./limitTransformations";
import { parseAppraisalDate } from "./context";

export interface FortuneSelection {
  /** 鑑定日（"YYYY-MM-DD"） */
  appraisalDate: string;
  /** 選択中の大限（chart.dayun.periods の開始年齢）。大限開始前・範囲外は null */
  majorStartAge: number | null;
  /** 選択中の小限の数え年。出生前は null */
  minorAge: number | null;
}

/** 小限の選択肢（数え1歳〜既存の大限表の最後の年齢） */
export function minorAgeOptions(chart: ZiweiChart): number[] {
  const last = chart.dayun.periods[chart.dayun.periods.length - 1].endAge;
  return Array.from({ length: last }, (_, i) => i + 1);
}

/** 鑑定日に同期（その日の数え年の大限・小限） */
export function selectionFromDate(chart: ZiweiChart, appraisalDate: string): FortuneSelection {
  const d = parseAppraisalDate(appraisalDate);
  if (!d) return { appraisalDate, majorStartAge: null, minorAge: null };
  const age = kazoeAgeOn(chart, d);
  if (age < 1) return { appraisalDate, majorStartAge: null, minorAge: null };
  return { appraisalDate, majorStartAge: dayunAt(chart.dayun, age)?.startAge ?? null, minorAge: age };
}

/** 大限を選ぶ（鑑定日は変えない） */
export function withMajor(chart: ZiweiChart, sel: FortuneSelection, startAge: number): FortuneSelection {
  const p = chart.dayun.periods.find((x) => x.startAge === startAge);
  if (!p) return sel;
  const keep = sel.minorAge !== null && sel.minorAge >= p.startAge && sel.minorAge <= p.endAge;
  return { ...sel, majorStartAge: p.startAge, minorAge: keep ? sel.minorAge : p.startAge };
}

/** 小限を選ぶ（鑑定日は変えない）。その年齢を含む大限へ合わせる（大限開始前なら大限なし） */
export function withMinor(chart: ZiweiChart, sel: FortuneSelection, age: number): FortuneSelection {
  if (!minorAgeOptions(chart).includes(age)) return sel;
  const p = dayunAt(chart.dayun, age);
  return { ...sel, minorAge: age, majorStartAge: p ? p.startAge : null };
}
