// src/lib/takujitsu/activity/index.ts
//
// 役割:
//   用途判定フェーズの用事辞書（ActivityDefinition）の公開窓口。
//   用途判定engine（次フェーズ）は本ファイルからのみ import する。
//   吉神・凶神・十二建除・二十八宿のoccurrence detection（既存・変更なし）
//   とは独立したモジュール。

export type { ActivityDefinition } from "./types";
export { ACTIVITY_DEFINITIONS, ACTIVITY_BY_ID, getActivityDefinition } from "./activityDefinitions";

export type {
  ActivitySourceType,
  ActivityProfile,
  ResolutionStatusLike,
  ActivitySource,
  ActivityVerdict,
  ActivityEvaluation,
  UnresolvedActivityRestriction,
  ActivitySuppression,
  ActivityEvaluationResult,
} from "./types";
export { ACTIVITY_PROFILES, getActivityProfile } from "./activityProfiles";
export { evaluateActivities, computeVerdict } from "./evaluateActivities";
export type { EvaluateActivitiesInput } from "./evaluateActivities";

export { HONGSHI_NOTES, getHongshiNotesFor } from "./hongshiNotes";
export type { HongshiNote } from "./hongshiNotes";
