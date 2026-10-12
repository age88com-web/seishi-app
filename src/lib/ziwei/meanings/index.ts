// src/lib/ziwei/meanings/index.ts
//
// 紫微斗数の象意データベース（資料由来）。docs/ziwei-basic-spec.md §21。
// 星・宮・四化・星×宮・組み合わせ・テーマの単位の検索（store.ts）と、宮クリック時の象意コンテキスト（context.ts）。
// 作盤エンジン（chart.ts など）には接続しない。要約・解釈・吉凶判定はしない。
// データの再生成: python3 scripts/ziwei/extract_meanings.py

export {
  STAR_MEANINGS,
  PALACE_MEANINGS,
  TRANSFORMATION_MEANINGS,
  STAR_PALACE_MEANINGS,
  COMBINATION_MEANINGS,
  THEME_MEANINGS,
  MEANINGS_META,
  getStarMeanings,
  getPalaceMeanings,
  getTransformationMeanings,
  getStarPalaceMeanings,
  getCombinationMeanings,
  getThemeMeanings,
} from "./store";
/** 宮クリック時の象意コンテキスト（§21.9）の入口 */
export { buildPalaceMeaningContext } from "./context";
/** AI 入力用に選別した象意コンテキスト（§21.10）の入口 */
export { buildAiMeaningContext, AI_DETAIL_LEVELS } from "./aiContext";
export type { AiSelectionOptions } from "./aiContext";
/** アプリ内・資料ベースの宮別解釈（AI を使わない決定論的な文章生成。§21.12） */
export { buildRuleBasedInterpretation, themeOf, INTERPRETATION_THEMES, ALLOWED_PREFIXES } from "./ruleInterpretation";
export type {
  RuleBasedInterpretation,
  InterpretationSection,
  InterpretationSentence,
  InterpretationTheme,
} from "./ruleInterpretation";
/** 力量の条件付きの文の判定（§22.6） */
export {
  evaluatePowerCondition,
  specFor,
  CONDITION_SPECS,
  PALACE_POWER_RULES,
  STAR_POWER_RULES,
} from "./powerCondition";
export type { ConditionTerm, PowerConditionSpec, ConditionResult, PowerTest } from "./powerCondition";
/** 前後の文がないと意味が通らない文の判定と前後の文（§21.10） */
export {
  sentenceDependency,
  opensWithConnective,
  previousInSection,
  nextInSection,
  PREVIOUS_DEPENDENT_OPENERS,
} from "./sentenceContext";
export type { SentenceDependency } from "./sentenceContext";
export type * from "./types";
