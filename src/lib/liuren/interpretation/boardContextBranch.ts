// src/lib/liuren/interpretation/boardContextBranch.ts
//
// 役割（Phase 4O）:
//   盤上の支（Phase 3W の anchor を resolveAnchor で解決した支）と、盤外の支（Phase 4N の resolveContextBranch で解決した支）が
//   同じかどうか（BoardContextBranchComparison）。一致しない場合も matches: false として返し、比べられない場合は理由つきで返す。
//     盤側の入力 … Phase 3W の RelationAnchor（四課は上神・下神を明示する。課全体を勝手に上神へ置き換えない）
//       dayStem        → 干なので支と比べられない（boardReason: dayStemIsStem。干を支に変換しない）
//       dayBranch      → 日支（DayBranchState.branch）
//       lesson upper   → その課の上神
//       lesson lower   → その課の下神（一課の下神は日干そのもの＝干なので lessonLowerIsStem）
//       position       → 干上・三伝の支（三伝未確定で解決できなければ positionUnavailable）
//     盤外の入力 … ContextBranchSource（personNatalYear・taiSui）。解決できなければ Phase 4N の理由をそのまま持つ
//   支の一致だけを持つ。上神（本命の上など）・天将・六親・十二長生・空亡は求めない。ROLE・DOMAIN・吉凶は持たない。

import type { Branch } from "../types";
import { resolveAnchor } from "./anchorResolver";
import type { AnchorResolutionContext, RelationAnchor } from "./anchorResolver";
import { resolveContextBranch } from "./contextBranch";
import type { BoardAnchor, ContextBranchSource, ContextBranchUnresolved, InterpretationContext } from "./roles";

/** 盤側で支が得られない理由 */
export type BoardBranchUnavailableReason = "dayStemIsStem" | "lessonLowerIsStem" | "positionUnavailable";

export type BoardContextBranchComparison =
  | {
    status: "compared";
    anchor: RelationAnchor;
    source: ContextBranchSource;
    boardBranch: Branch;
    contextBranch: Branch;
    matches: boolean;
  }
  | {
    status: "unresolved";
    anchor: RelationAnchor;
    source: ContextBranchSource;
    /** 盤側で支が得られない理由（得られたなら省く） */
    boardReason?: BoardBranchUnavailableReason;
    /** 盤外側で支が得られない理由（Phase 4N。得られたなら省く） */
    contextReason?: ContextBranchUnresolved["reason"];
  };

/** RelationAnchor → resolveAnchor に渡す BoardAnchor（四課の part を外すだけ） */
function boardAnchorOf(a: RelationAnchor): BoardAnchor {
  return a.kind === "lesson" ? { kind: "lesson", index: a.index } : a;
}

/** 盤側の支（resolveAnchor の結果から読むだけ。Phase 4P の派生した支との比較でも使う） */
export function boardBranchOf(a: RelationAnchor, ctx: AnchorResolutionContext): { branch: Branch } | { reason: BoardBranchUnavailableReason } {
  const r = resolveAnchor(boardAnchorOf(a), ctx);
  if (!r) return { reason: "positionUnavailable" };
  switch (r.kind) {
    case "dayStem": return { reason: "dayStemIsStem" };
    case "dayBranch": return { branch: r.source.branch };
    case "path": return { branch: r.source.branch };
    case "lesson": {
      if (a.kind !== "lesson" || a.part === "upper") return { branch: r.source.upper.branch };
      return r.source.index === 1 ? { reason: "lessonLowerIsStem" } : { branch: r.source.lower as Branch };
    }
  }
}

/** 盤上の支と盤外の支を比べる */
export function compareBoardContextBranch(
  anchor: RelationAnchor, source: ContextBranchSource, ctx: AnchorResolutionContext, context: InterpretationContext,
): BoardContextBranchComparison {
  const board = boardBranchOf(anchor, ctx);
  const outside = resolveContextBranch(context, source);
  if ("reason" in board || outside.status === "unresolved") {
    return {
      status: "unresolved", anchor, source,
      ...("reason" in board ? { boardReason: board.reason } : {}),
      ...(outside.status === "unresolved" ? { contextReason: outside.reason } : {}),
    };
  }
  return { status: "compared", anchor, source, boardBranch: board.branch, contextBranch: outside.branch, matches: board.branch === outside.branch };
}
