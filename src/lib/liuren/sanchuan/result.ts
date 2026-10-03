// src/lib/liuren/sanchuan/result.ts
//
// 役割:
//   三伝の結果オブジェクトを組み立てる共通処理。

import type {
  Branch, DecisionStep, EvidenceLevel, SanchuanDetermined, SanchuanMethod,
  SanchuanUndetermined, ShehaiCandidateTrace,
} from "../types";
import type { SanchuanContext } from "./context";

export function determined(args: {
  method: SanchuanMethod;
  pattern: string | null;
  initial: Branch;
  middle: Branch;
  final: Branch;
  middleFinalEvidence?: EvidenceLevel;
  steps: DecisionStep[];
  shehai?: ShehaiCandidateTrace[];
}): SanchuanDetermined {
  const r: SanchuanDetermined = {
    status: "determined",
    method: args.method,
    pattern: args.pattern,
    initial: args.initial,
    middle: args.middle,
    final: args.final,
    middleFinalEvidence: args.middleFinalEvidence ?? "textbook",
    trace: args.steps,
  };
  if (args.shehai) r.shehai = args.shehai;
  return r;
}

export function undetermined(method: SanchuanMethod, reason: string, steps: DecisionStep[]): SanchuanUndetermined {
  return { status: "undetermined", method, reason, trace: steps };
}

/**
 * 中伝＝初伝の上神、末伝＝中伝の上神（講座 p11「初伝之上中伝取、中伝之上末伝居」）。
 * 賊剋法・比用法・涉害法で使う（涉害の中末は確定仕様で賊剋法と同じ）。
 */
export function upperChain(ctx: SanchuanContext, initial: Branch): { middle: Branch; final: Branch } {
  const middle = ctx.plate.heavenOn[initial];
  return { middle, final: ctx.plate.heavenOn[middle] };
}
