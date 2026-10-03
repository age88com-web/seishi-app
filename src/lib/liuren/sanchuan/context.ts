// src/lib/liuren/sanchuan/context.ts
//
// 役割:
//   三伝の各判定関数が共有する入力（四課・天地盤・日干支）と、
//   初伝選択の途中結果の型。

import { isYangStem } from "../constants";
import { controls } from "../relations";
import type {
  Stem, Branch, FourLessons, HeavenEarthPlate, Lesson, DecisionStep,
  SanchuanMethod, ShehaiCandidateTrace,
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
    }
  | {
      ok: false;
      method: SanchuanMethod;
      reason: string;
      steps: DecisionStep[];
    };
