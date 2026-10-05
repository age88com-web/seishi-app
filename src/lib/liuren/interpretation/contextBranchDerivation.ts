// src/lib/liuren/interpretation/contextBranchDerivation.ts
//
// 役割（Phase 4P）:
//   盤外の支（Phase 4N の ContextBranchSource）から、天地盤の上で一段だけ動いた支を、出典つきで求める。
//     self       … 盤外の支そのもの
//     heavenOn   … その支を地盤の位置として、その上の天盤支（facts.plate.heavenOn[支]）
//     earthUnder … その支を天盤支として、その下の地盤支（facts.plate.earthUnder[支]）
//   盤外の支は Phase 4N の resolveContextBranch で解決し、解決できなければその理由をそのまま持つ。
//   一段だけで、続けてたどる関数は作らない。驛馬・天将・十二長生は派生の種類にしない（支を既存の関数に渡す）。
//   陰神・上神などの資料用語は使わない（盤の操作名だけ）。ROLE・DOMAIN・吉凶は持たない。
//   盤上の支との比較（compareBoardDerivedContextBranch）は、Phase 4O の盤側の読み取り（boardBranchOf）を使う。

import type { Branch } from "../types";
import type { AnchorResolutionContext, RelationAnchor } from "./anchorResolver";
import { boardBranchOf } from "./boardContextBranch";
import type { BoardBranchUnavailableReason } from "./boardContextBranch";
import { resolveContextBranch } from "./contextBranch";
import type { ContextBranchSource, ContextBranchUnresolved, InterpretationContext } from "./roles";
import type { InterpretationFacts } from "./types";

/** 盤外の支からの一段の動き（天地盤の写像の名前どおり） */
export type ContextBranchDerivation = "self" | "heavenOn" | "earthUnder";

export interface DerivedContextBranchSource {
  source: ContextBranchSource;
  derivation: ContextBranchDerivation;
}

export interface DerivedContextBranchResolution {
  status: "resolved";
  source: DerivedContextBranchSource;
  /** 盤外の支（動かす前） */
  baseBranch: Branch;
  /** 動かした後の支 */
  branch: Branch;
}

export interface DerivedContextBranchUnresolved {
  status: "unresolved";
  source: DerivedContextBranchSource;
  /** 盤外の支が解決できない理由（Phase 4N） */
  reason: ContextBranchUnresolved["reason"];
}

/** 盤外の支 → 一段動かした支（出典つき） */
export function resolveDerivedContextBranch(
  facts: InterpretationFacts, context: InterpretationContext, source: DerivedContextBranchSource,
): DerivedContextBranchResolution | DerivedContextBranchUnresolved {
  const base = resolveContextBranch(context, source.source);
  if (base.status === "unresolved") return { status: "unresolved", source, reason: base.reason };
  const branch =
    source.derivation === "heavenOn" ? facts.plate.heavenOn[base.branch]
    : source.derivation === "earthUnder" ? facts.plate.earthUnder[base.branch]
    : base.branch;
  return { status: "resolved", source, baseBranch: base.branch, branch };
}

export type BoardDerivedContextBranchComparison =
  | {
    status: "compared";
    anchor: RelationAnchor;
    source: DerivedContextBranchSource;
    boardBranch: Branch;
    /** 盤外の支（動かす前） */
    baseBranch: Branch;
    /** 動かした後の支（boardBranch と比べる支） */
    contextBranch: Branch;
    matches: boolean;
  }
  | {
    status: "unresolved";
    anchor: RelationAnchor;
    source: DerivedContextBranchSource;
    boardReason?: BoardBranchUnavailableReason;
    contextReason?: ContextBranchUnresolved["reason"];
  };

/** 盤上の支（Phase 4O と同じ読み取り）と、盤外の支を一段動かした支を比べる */
export function compareBoardDerivedContextBranch(
  anchor: RelationAnchor, source: DerivedContextBranchSource, ctx: AnchorResolutionContext, context: InterpretationContext,
): BoardDerivedContextBranchComparison {
  const board = boardBranchOf(anchor, ctx);
  const derived = resolveDerivedContextBranch(ctx.facts, context, source);
  if ("reason" in board || derived.status === "unresolved") {
    return {
      status: "unresolved", anchor, source,
      ...("reason" in board ? { boardReason: board.reason } : {}),
      ...(derived.status === "unresolved" ? { contextReason: derived.reason } : {}),
    };
  }
  return {
    status: "compared", anchor, source, boardBranch: board.branch, baseBranch: derived.baseBranch,
    contextBranch: derived.branch, matches: board.branch === derived.branch,
  };
}
