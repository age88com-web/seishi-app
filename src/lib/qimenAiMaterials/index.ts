// src/lib/qimenAiMaterials/index.ts
//
// 役割:
//   AI 入力専用データ層の公開窓口。qimenMaterials の出力を分類し直し、各材料に一意の ID を
//   付けるだけ（要約・言い換え・AI接続はしない）。

export { serializeQimenAiInput, AI_ID_PREFIX } from "./serialize";
export { buildQimenGenerationView, findQimenAiItem } from "./generationView";
export { classifyKokuoFortune, FAVORABLE_FORTUNE_WORDS, CAUTION_FORTUNE_WORDS } from "./fortuneClass";
export type { KokuoFortuneClass } from "./fortuneClass";
export { buildQimenGenerationPlan, SECTION1_FACT_LABELS, PLAN_SECTION_TITLES } from "./generationPlan";
export type {
  PlanEstablishedItem,
  PlanFactItem,
  PlanFuYinFanYinItem,
  PlanKakuItem,
  PlanKokuoItem,
  PlanSingleMeaningItem,
  QimenGenerationPlan,
} from "./generationPlan";
export {
  buildQimenGenerationPrompt,
  listGenerationPlanIds,
  GENERATION_PROMPT_INSTRUCTIONS,
  PROMPT_DELIMITERS,
} from "./generationPrompt";
export type {
  GenerationFact,
  GenerationFuYinFanYin,
  GenerationKaku,
  GenerationKokuo,
  GenerationSingleMeaning,
  QimenGenerationView,
} from "./generationView";
export type {
  AiChartFact,
  AiExcluded,
  AiFuYinFanYin,
  AiKaku,
  AiKokuo,
  AiMaterialOrigin,
  AiReferenceTable,
  AiSingleMeaning,
  QimenAiInput,
} from "./types";
export { toDisplayText, PDF_FULL_LINE_WIDTH } from "./displayText";
export type { DisplayText } from "./displayText";
export {
  buildConfirmedMaterials,
  kokuoCombination,
  kakuMeaningMatch,
  UNCLASSIFIED_TITLE,
  NO_FORTUNE_LABEL,
} from "./confirmedMaterials";
export type {
  ConfirmedFact,
  ConfirmedHeader,
  ConfirmedItem,
  ConfirmedKakuMeaning,
  ConfirmedLine,
  ConfirmedMaterials,
  ConfirmedSingle,
  ConfirmedSourceText,
} from "./confirmedMaterials";
export {
  buildSynthesisInput,
  requiredSynthesisIds,
  optionalSynthesisIds,
  SYNTHESIS_SECTION_LABELS,
  SYNTHESIS_FACT_LABELS,
} from "./synthesisInput";
export type {
  QimenSynthesisInput,
  SynthesisEstablished,
  SynthesisInputOptions,
  SynthesisSingle,
  SynthesisSectionKey,
} from "./synthesisInput";
export {
  buildSynthesisPrompt,
  synthesisPromptInstructions,
  synthesisMaterials,
  SYNTHESIS_PROMPT_DELIMITERS,
} from "./synthesisPrompt";
export { validateSynthesis, SYNTHESIS_BANNED_PHRASES, SYNTHESIS_SUMMARY_PHRASES } from "./synthesisValidation";
export type { SynthesisValidation } from "./synthesisValidation";
export { buildInterpretationOutput } from "./interpretationOutput";
export type { AiSynthesis, QimenInterpretationOutput, SynthesisRunResult } from "./interpretationOutput";
export { buildJudgmentDisplay, JUDGMENT_GROUP_TITLES } from "./judgmentDisplay";
export type {
  JudgmentGroup,
  JudgmentGroupKey,
  JudgmentItem,
  JudgmentPlacementBasis,
  QimenJudgmentDisplay,
} from "./judgmentDisplay";
export { buildJudgmentSummary, renderJudgmentSummaryText, joinNames } from "./judgmentSummary";
export type { JudgmentSummary, JudgmentSummaryEntry, JudgmentSummaryText } from "./judgmentSummary";
