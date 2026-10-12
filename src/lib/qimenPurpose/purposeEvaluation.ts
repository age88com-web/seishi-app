// src/lib/qimenPurpose/purposeEvaluation.ts
//
// 役割:
//   用途評価レイヤー本体。用途データベース（qimenMeaning/purposeMeaning.ts）
//   と、将来の検索エンジン（qimenSearch/）の間に置く中間層で、用途ごとに
//   格局／八門／九星／八神／三奇六儀を関連付けられる構造を提供する。
//   今回は「格局」のみ登録し、他の4区分は空配列のまま確保する。
//
// 独立性・変更禁止事項の遵守:
//   qimenMeaning/purposeMeaning.ts の PURPOSE_FORMATS を読むだけで、
//   その中身（資料転記データ）は一切書き換えない。排盤ロジック・格局判定
//   （src/lib/qimen/）・検索ロジック（src/lib/qimenSearch/）にも一切
//   依存しない・変更しない。この中間層自体もまだどこからも呼ばれない
//   （検索への組み込みは今回行わない）。
//
// エイリアス展開について:
//   kaku には purposeMeaning.ts の formats をそのまま転記する（「日奇得使」
//   「龍虎風雲遁」等の資料表記のまま）。kakuAliases.ts の展開は検索時にだけ
//   呼び出し側が使う想定で、ここでは展開しない。

import { PURPOSE_FORMATS } from "@/lib/qimenMeaning";
import type { PurposeEvaluation } from "./types";

/**
 * 用途評価データ一覧。kaku は purposeMeaning.ts の formats を転記したもの
 * （エイリアス未展開）。baMen/jiuXing/baShen/sanQiLiuYi は今回未登録のため
 * 常に空配列。
 */
export const PURPOSE_EVALUATIONS: readonly PurposeEvaluation[] = PURPOSE_FORMATS.map((p) => ({
  purpose: p.purpose,
  kaku: [...p.formats],
  baMen: [],
  jiuXing: [],
  baShen: [],
  sanQiLiuYi: [],
}));

/** 用途名から用途評価データを引く。データが無ければ undefined。 */
export function lookupPurposeEvaluation(purpose: string): PurposeEvaluation | undefined {
  return PURPOSE_EVALUATIONS.find((e) => e.purpose === purpose);
}
