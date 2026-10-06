// src/lib/shichusuimei/kakkyoku/decision.ts
//
// 術者の最終格局・最終強弱（KD19・KD20。仕様 §30・§31）。
//   ① エンジン判定（KakkyokuResult.candidates / enginePattern）
//   ② 内格補助（KakkyokuResult.innerScore）
//   ③ 術者最終判断（PractitionerDecision）
// を別データとして持つ。将来の象意生成では ③ を最優先する。
//   格局: 術者最終格局 ＞ エンジン判定／強弱: 術者最終強弱 ＞ 内格補助 ＞ 三得類型

import type { Pillars, KakkyokuResult, CandidateStatus, InnerJudgment, StrengthClass } from "./types";

/** 最終格局の選択肢（既存仕様に出てくる名称のみ） */
export const FINAL_PATTERN_OPTIONS = [
  "内格",
  "建禄格",
  "月刃格",
  "一行得気格",
  "従旺格",
  "従強格",
  "従格",
  "従財格",
  "従殺格",
  "従児格",
  "両神成象格",
  "化格",
  "その他",
] as const;

export type FinalPatternOption = (typeof FINAL_PATTERN_OPTIONS)[number];

/** 最終強弱の選択肢（KD20） */
export const FINAL_STRENGTH_OPTIONS = ["身強", "身弱", "境界", "保留"] as const;
export type FinalStrengthOption = (typeof FINAL_STRENGTH_OPTIONS)[number];

export interface PractitionerDecision {
  /** 未選択は null */
  finalPattern: FinalPatternOption | null;
  /** 術者の最終強弱（未選択は null）。格局とは別に確定する（KD20） */
  finalStrength: FinalStrengthOption | null;
  /** 「その他」のときの自由入力 */
  otherText: string;
  /** 表示用の名称（例: 一行得気格（潤下格））。空なら finalPattern（その他は otherText） */
  finalPatternLabel: string;
  note: string;
}

export const EMPTY_DECISION: PractitionerDecision = { finalPattern: null, finalStrength: null, otherText: "", finalPatternLabel: "", note: "" };

/** 術者が指定した最終格局の表示名。未入力なら null */
export function finalPatternLabelOf(d: PractitionerDecision): string | null {
  if (!d.finalPattern) return null;
  if (d.finalPatternLabel.trim()) return d.finalPatternLabel.trim();
  if (d.finalPattern === "その他") return d.otherText.trim() || null;
  return d.finalPattern;
}

export interface EffectivePattern {
  /** practitioner … 術者の最終判断を採用／engine … 術者未入力のためエンジン判定を参考／none … どちらもない */
  source: "practitioner" | "engine" | "none";
  name: string | null;
  engineStatus?: CandidateStatus;
}

/** 象意生成で使う格局: 術者最終判断 ＞ エンジン判定 */
export function resolveEffectivePattern(k: KakkyokuResult, d: PractitionerDecision): EffectivePattern {
  const label = finalPatternLabelOf(d);
  if (label) return { source: "practitioner", name: label };
  if (k.enginePattern) return { source: "engine", name: k.enginePattern.name, engineStatus: k.enginePattern.status };
  return { source: "none", name: null };
}

export interface EffectiveStrength {
  /** practitioner … 術者の最終強弱／innerScore … 内格補助の判定／santoku … 三得の類型（内格補助がない場合の参考） */
  source: "practitioner" | "innerScore" | "santoku";
  value: string | null;
  /** 術者が「保留」を選んだ場合 true（値は内格補助から採る） */
  practitionerDeferred?: boolean;
}

/** 三得の類型が強側か弱側か（材料としての表示用） */
export function santokuSideOf(classes: StrengthClass[]): "強側" | "弱側" | "境界" | "強弱いずれもありうる" {
  const strong = classes.some((c) => c === "過強" || c === "中強");
  const weak = classes.some((c) => c === "中弱" || c === "弱（得地のみ）" || c === "過弱");
  if (classes.includes("境界") || (strong && weak)) return strong || weak ? "強弱いずれもありうる" : "境界";
  return strong ? "強側" : weak ? "弱側" : "境界";
}

/** 象意生成で使う強弱: 術者最終強弱 ＞ 内格補助 ＞ 三得類型（KD20）。「保留」は術者未確定として内格補助へ */
export function resolveEffectiveStrength(k: KakkyokuResult, d: PractitionerDecision): EffectiveStrength {
  if (d.finalStrength && d.finalStrength !== "保留") return { source: "practitioner", value: d.finalStrength };
  const deferred = d.finalStrength === "保留" ? { practitionerDeferred: true } : {};
  if (k.innerScore) return { source: "innerScore", value: k.innerScore.judgment, ...deferred };
  return { source: "santoku", value: santokuSideOf(k.strength.classificationCandidates), ...deferred };
}

/** 将来 AI 等へ渡す命式データ（各層を別々に持つ） */
export interface InterpretationInput {
  pillars: Pillars;
  strength: KakkyokuResult["strength"];
  engine: {
    pattern: KakkyokuResult["enginePattern"];
    candidates: KakkyokuResult["candidates"];
    hehua: KakkyokuResult["hehua"];
  };
  innerPattern: { judgment: InnerJudgment; supporting: number; weakening: number; helps: string[] };
  practitionerDecision: PractitionerDecision;
  /** 象意生成で最優先される格局（術者の最終判断。未入力ならエンジン判定を参考） */
  finalPattern: EffectivePattern;
  /** 象意生成で使う強弱（術者最終強弱 ＞ 内格補助 ＞ 三得類型） */
  finalStrength: EffectiveStrength;
  referenceOnly: boolean;
}

export function buildInterpretationInput(pillars: Pillars, k: KakkyokuResult, d: PractitionerDecision): InterpretationInput {
  return {
    pillars,
    strength: k.strength,
    engine: { pattern: k.enginePattern, candidates: k.candidates.filter((c) => c.uiVisible), hehua: k.hehua },
    innerPattern: {
      judgment: k.innerScore.judgment,
      supporting: k.innerScore.supportingSide.points,
      weakening: k.innerScore.weakeningSide.points,
      helps: k.innerScore.helps,
    },
    practitionerDecision: { ...d },
    finalPattern: resolveEffectivePattern(k, d),
    finalStrength: resolveEffectiveStrength(k, d),
    referenceOnly: k.referenceOnly,
  };
}
