// src/lib/qimenPurpose/index.ts
//
// 役割:
//   用途評価レイヤーの公開窓口。用途データベース（qimenMeaning）と将来の
//   検索エンジン（qimenSearch）の間に置く中間層で、今回はまだどちらにも
//   組み込まれていない（検索ロジックは一切変更していない）。

export type { PurposeEvaluation } from "./types";
export { PURPOSE_EVALUATIONS, lookupPurposeEvaluation } from "./purposeEvaluation";
export { resolveKakuAlias, resolveKakuAliases } from "./kakuAliases";
