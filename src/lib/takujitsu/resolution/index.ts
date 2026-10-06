// src/lib/takujitsu/resolution/index.ts
//
// 役割:
//   擇日「神殺解除・相殺・増悪」レイヤーの公開窓口。
//   occurrence detection（吉神Group1〜6・凶神Group1〜6）とは完全に分離した
//   独立モジュールであり、呼び出し側は本ファイルからのみ import する。

export { resolve } from "./resolve";
export { RESOLUTION_RULES, DEHE_GROUP, SHAGAN_GROUP } from "./rules";
export type {
  ResolutionStatus,
  RelationKind,
  RequiresGroup,
  ResolutionRule,
  AppliedRuleRecord,
  ResolvedShinsatsuEntry,
  ResolvedShinsatsuResult,
} from "./types";
