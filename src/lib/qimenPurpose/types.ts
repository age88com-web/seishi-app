// src/lib/qimenPurpose/types.ts
//
// 役割:
//   用途評価レイヤーの型定義。用途データベース（qimenMeaning/purposeMeaning.ts）
//   と、将来の検索エンジン（qimenSearch/）の間に置く中間層のデータ構造。
//
//   用途ごとに 格局／八門／九星／八神／三奇六儀 の5区分を関連付けられる
//   構造にしてあるが、今回は「格局」のみ登録する。他の4区分は将来の
//   拡張用に空配列で確保してあるだけで、値は入れない。
//
//   検索エンジンへは今回組み込まない（この型・データはまだどこからも
//   呼ばれない、独立した中間層）。

export interface PurposeEvaluation {
  /** 用途名（qimenMeaning/purposeMeaning.ts の purpose と同じ文字列）。 */
  purpose: string;
  /** 格局。purposeMeaning.ts の formats を転記しただけで、エイリアスは未展開。 */
  kaku: string[];
  /** 八門。今回は未登録のため常に空配列。 */
  baMen: string[];
  /** 九星。今回は未登録のため常に空配列。 */
  jiuXing: string[];
  /** 八神。今回は未登録のため常に空配列。 */
  baShen: string[];
  /** 三奇・六儀。今回は未登録のため常に空配列。 */
  sanQiLiuYi: string[];
}
