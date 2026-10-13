// src/lib/ming_degree.ts
// 七政四餘：アプリ全体で共通に使う命度（宮内度数 0〜30）
// - 通常（命宮方式＝新法「ASC＝命度」）：画面表示している ASC 基準の命度（ASC 黄経を命宮の宮内度数へ落とした値）
// - 古典（命宮方式＝古典「月将＋時支」。旧表記「古法」）：既存 calcMingDegreeFromSunLon（太陽の宮内度数）
// 命度を必要とする箇所（表示・命度宿・大限・限度・流年の大限判定・年齢選択・印刷）は、この関数の値だけを使う。
// 計算式そのもの（ASC・太陽黄経・calcMingDegreeFromSunLon）は変更しない。

import { calcMingDegreeFromSunLon } from "./big_limit";

export type MingMode = "handen" | "getsu";

// 命宮の開始黄経（page.tsx の従来の命度表示と同じ並び：寅=0, 卯=30, …）
const BRANCH_START_ORDER = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
// 0..30 正規化（従来の page.tsx の式そのまま。浮動小数点でも従来の表示値と完全一致させる）
function norm30(x: number): number {
  x = x % 30;
  return x < 0 ? x + 30 : x;
}

/** ASC 基準の命度（従来の画面表示「命度」と同じ式） */
export function ascMingDegree(ascLon: number, mingBranch: string): number {
  const i = BRANCH_START_ORDER.indexOf(mingBranch);
  return norm30(ascLon - (i >= 0 ? i * 30 : 0));
}

/** 現在の命宮方式に応じた命度（通常＝ASC 基準、古典＝calcMingDegreeFromSunLon） */
export function mingDegreeForMode(mode: MingMode, args: { ascLon: number; sunLon: number; mingBranch: string }): number {
  return mode === "handen" ? ascMingDegree(args.ascLon, args.mingBranch) : calcMingDegreeFromSunLon(args.sunLon);
}
