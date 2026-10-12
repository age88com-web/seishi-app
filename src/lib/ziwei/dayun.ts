// src/lib/ziwei/dayun.ts
//
// §13 大限（10年運。数え年）。
//   陽干（甲丙戊庚壬）の男＝陽男、女＝陽女。陰干の男＝陰男、女＝陰女。
//   陽男・陰女は順行、陰男・陽女は逆行。命宮が 局数〜局数+9 歳、1宮進むごとに +10 歳。
// 規則式は仕様書のもの（表14 と全120セル一致を tests/ziwei_phase1.manual.ts で確認）。
//
// 範囲（§18 U8）: 資料の表14にある 局数〜局数+119 歳だけを扱う。
// 数え1歳〜局数−1 歳と、局数+120 歳以上は未対応（dayunAt は null を返す。推測で延長しない）。

import type { Branch, Bureau, Dayun, DayunPeriod, Sex, Stem } from "./types";
import { PALACE_NAMES, branchAt, branchIndex, stemIndex } from "./data";

export function dayunOf(input: { yearStem: Stem; sex: Sex; bureau: Bureau; mingPalace: Branch }): Dayun {
  const yang = stemIndex(input.yearStem) % 2 === 0;
  const male = input.sex === "male";
  const yinYang = yang ? (male ? "陽男" : "陽女") : male ? "陰男" : "陰女";
  const forward = (yang && male) || (!yang && !male);
  const m = branchIndex(input.mingPalace);
  const n = input.bureau.number;

  const periods: DayunPeriod[] = [];
  for (let step = 0; step < 12; step += 1) {
    // 順行は支の順（命宮→父母宮→福徳宮…）、逆行は支の逆順（命宮→兄弟宮→夫妻宮…）
    const branch = branchAt(forward ? m + step : m - step);
    const k = ((m - branchIndex(branch)) % 12 + 12) % 12; // 十二宮順の番号（命=0 … 父母=11）
    periods.push({ palace: PALACE_NAMES[k], branch, startAge: n + 10 * step, endAge: n + 10 * step + 9 });
  }
  return { yinYang, direction: forward ? "順行" : "逆行", periods };
}

/** 数え年 age の大限。資料の表の範囲外（§18 U8）は null。 */
export function dayunAt(dayun: Dayun, age: number): DayunPeriod | null {
  return dayun.periods.find((p) => age >= p.startAge && age <= p.endAge) ?? null;
}
