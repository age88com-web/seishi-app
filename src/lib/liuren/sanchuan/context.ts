// src/lib/liuren/sanchuan/context.ts
//
// 役割:
//   三伝の各判定関数が共有する入力（四課・天地盤・日干支）と、
//   初伝選択の途中結果の型。

import { isYangStem } from "../constants";
import { controls } from "../relations";
import type {
  Stem, Branch, FourLessons, HeavenEarthPlate, Lesson, DecisionStep,
  InitialTransmissionOrigin, SanchuanMethod, ShehaiCandidateTrace,
} from "../types";

export interface SanchuanContext {
  dayStem: Stem;
  dayBranch: Branch;
  lessons: FourLessons;
  plate: HeavenEarthPlate;
  /** 干上神（一課の上神） */
  ganUpper: Branch;
  /** 支上神（三課の上神） */
  zhiUpper: Branch;
  yangDay: boolean;
}

export function makeContext(
  dayStem: Stem, dayBranch: Branch, lessons: FourLessons, plate: HeavenEarthPlate,
): SanchuanContext {
  return {
    dayStem, dayBranch, lessons, plate,
    ganUpper: lessons[0].upper,
    zhiUpper: lessons[2].upper,
    yangDay: isYangStem(dayStem),
  };
}

/** 下賊（下が上を剋す）。一課の下は日干そのものの五行で見る（講座 p12） */
export function isZei(l: Lesson): boolean {
  return controls(l.lower, l.upper);
}

/** 上剋（上が下を剋す） */
export function isKe(l: Lesson): boolean {
  return controls(l.upper, l.lower);
}

/**
 * 候補の課（初伝として選んだ上神をもつもの）から発用元を作る（Phase 3Z）。
 * 選択処理が既に持っている候補の課を渡すだけで、初伝の決め方には関係しない。
 */
export function originFromLessons(lessons: readonly Lesson[], branch: Branch, method: SanchuanMethod): InitialTransmissionOrigin {
  const indexes = lessons.map((l) => l.index);
  return indexes.length === 1
    ? { kind: "uniqueLesson", lesson: indexes[0], branch, method }
    : { kind: "ambiguousLessons", lessons: indexes, branch, method };
}

export function lessonLabel(l: Lesson): string {
  return `${l.index}課 ${l.upper}/${l.lower}`;
}

/** 賊剋から初伝を選んだ結果（重審・元首・比用・涉害で共通） */
export type InitialSelection =
  | {
      ok: true;
      initial: Branch;
      method: Extract<SanchuanMethod, "重審" | "元首" | "比用" | "涉害">;
      pattern: string | null;
      steps: DecisionStep[];
      shehai?: ShehaiCandidateTrace[];
      /** 初伝を選んだ地点で記録した発用元（Phase 3Z） */
      origin: InitialTransmissionOrigin;
    }
  | {
      ok: false;
      method: SanchuanMethod;
      reason: string;
      steps: DecisionStep[];
    };
