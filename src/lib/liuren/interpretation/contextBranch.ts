// src/lib/liuren/interpretation/contextBranch.ts
//
// 役割（Phase 4N）:
//   盤外の支（ContextBranchSource）を CONTEXT から解決する純粋関数。BoardAnchor の resolveAnchor（Phase 3W）とは別の resolver。
//     personNatalYear … persons から人物を探し（Phase 4M の findInterpretationPerson。ID が重複していれば例外）、natalYear.branch
//     taiSui          … context.taiSui.branch（TaiSuiState を作り直さない）
//   解決できないときは理由つきで返す（personNotFound・natalYearMissing・taiSuiMissing）。
//   subjectPersonId・counterpartyPersonId から出典を自動で選ばない。支から上神・天将・六親などは求めない（既存の関数に branch を渡す）。
//   ROLE・DOMAIN・吉凶は持たない。起課の FACT には触れない。

import { findInterpretationPerson } from "./personContext";
import type { ContextBranchResolution, ContextBranchSource, ContextBranchUnresolved, InterpretationContext } from "./roles";

/** 盤外の支の出典 → 支（出典つき）。解決できなければ理由つき */
export function resolveContextBranch(
  context: InterpretationContext, source: ContextBranchSource,
): ContextBranchResolution | ContextBranchUnresolved {
  switch (source.kind) {
    case "personNatalYear": {
      const person = findInterpretationPerson(context, source.personId);
      if (!person) return { status: "unresolved", source, reason: "personNotFound" };
      if (!person.natalYear) return { status: "unresolved", source, reason: "natalYearMissing" };
      return { status: "resolved", source, branch: person.natalYear.branch };
    }
    case "taiSui":
      if (!context.taiSui) return { status: "unresolved", source, reason: "taiSuiMissing" };
      return { status: "resolved", source, branch: context.taiSui.branch };
  }
}
