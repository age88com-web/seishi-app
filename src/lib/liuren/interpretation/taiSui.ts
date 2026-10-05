// src/lib/liuren/interpretation/taiSui.ts
//
// 役割（Phase 4L-1）:
//   太歳（TaiSuiState）＝占年の年支（『六壬神課講座』p65「初伝が太歳（年支）の場合は…」）。
//   解釈時に参照する時間側の FACT で、起課（四課・三伝・天地盤・天将盤）には影響しない。
//     入力 … 年支を明示的に受け取る。src/lib/calendar の年干支は使わない（六壬の太歳の年境界は資料で未確認のため）
//   年干・上神・陰神・天将・六親などは持たない。必要なら太歳の支を既存の関数（plate.heavenOn・Phase 4B・4K）に渡して求める。
//   未来の年の太歳（年の加算）は求めない。本命・年命・行年（人物側の FACT）とは別。ROLE・DOMAIN・吉凶は持たない。

import type { Branch } from "../types";
import type { TaiSuiState } from "./types";

/** 明示された年支 → 太歳 */
export function taiSuiStateOf(yearBranch: Branch): TaiSuiState {
  return { kind: "taiSui", branch: yearBranch };
}
