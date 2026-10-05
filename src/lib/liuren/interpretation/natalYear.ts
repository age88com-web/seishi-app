// src/lib/liuren/interpretation/natalYear.ts
//
// 役割（Phase 4L-2）:
//   本命・年命（NatalYearState）＝人物の生年干支（『六壬神課講座』p59「年命（生まれ年の干支）」）。
//   『六壬断案２』では本命・年命・命を同じ生年の属性として使うため、1つの FACT にする。
//   人物側の解釈入力で、起課（四課・三伝・天地盤・天将盤）には影響しない。太歳（Phase 4L-1・時間側）とは別。
//     入力 … 生年の干と支を明示的に受け取る（生年月日からの換算はしない。年境界・性別・年齢は持たない）
//     検証 … 六十干支にない組は例外（起課エンジンの日干支と同じ規則: 干と支の陰陽〔偶奇〕が同じ）
//   上神・天将・六親・十二長生・空亡・驛馬は持たない。必要なら branch を既存の関数（plate.heavenOn・Phase 4B・4K・yimaOf）に渡す。
//   問占者1人に固定した状態にはしない（人物ごとに別の値を作れる）。行年・ROLE・DOMAIN・吉凶は持たない。

import { BRANCHES, STEMS } from "../constants";
import type { Branch, Stem } from "../types";
import type { NatalYearState } from "./types";

/** 明示された生年干支 → 本命・年命 */
export function natalYearStateOf(stem: Stem, branch: Branch): NatalYearState {
  if ((STEMS.indexOf(stem) - BRANCHES.indexOf(branch)) % 2 !== 0) {
    throw new Error(`六十干支にない組み合わせです: ${stem}${branch}`);
  }
  return { kind: "natalYear", stem, branch };
}
