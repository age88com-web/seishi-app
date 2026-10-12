// src/lib/qimenAiMaterials/fortuneClass.ts
//
// 役割:
//   剋應の fortuneRaw（資料の吉凶表記）を「吉方向」「注意」「どちらでもない」に振り分ける
//   機械規則の唯一の定義。固定プロンプト（generationPrompt.ts）の説明文と
//   文章構成（generationPlan.ts）の振り分けは、どちらもここを参照する。
//
// 規則:
//   fortuneRaw を「・」で区切った語がすべて FAVORABLE_FORTUNE_WORDS に含まれれば favorable、
//   すべて CAUTION_FORTUNE_WORDS に含まれれば caution、それ以外（null・混在・一覧外の語）は
//   unclassified。本文は読まない。

/** 剋應の fortuneRaw を「吉方向」とみなす語。 */
export const FAVORABLE_FORTUNE_WORDS = ["吉", "大吉", "吉利", "大利"] as const;
/** 剋應の fortuneRaw を「注意」とみなす語。 */
export const CAUTION_FORTUNE_WORDS = ["凶", "大凶", "小凶", "不吉"] as const;

export type KokuoFortuneClass = "favorable" | "caution" | "unclassified";

function allIn(words: string[], list: readonly string[]): boolean {
  return words.length > 0 && words.every((w) => list.includes(w));
}

/** 剋應の fortuneRaw を機械規則で振り分ける。 */
export function classifyKokuoFortune(fortuneRaw: string | null): KokuoFortuneClass {
  if (fortuneRaw === null || fortuneRaw === "") return "unclassified";
  const words = fortuneRaw.split("・");
  if (allIn(words, FAVORABLE_FORTUNE_WORDS)) return "favorable";
  if (allIn(words, CAUTION_FORTUNE_WORDS)) return "caution";
  return "unclassified";
}
