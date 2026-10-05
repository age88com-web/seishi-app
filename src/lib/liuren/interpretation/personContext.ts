// src/lib/liuren/interpretation/personContext.ts
//
// 役割（Phase 4M）:
//   InterpretationContext の人物入力（persons・subjectPersonId・counterpartyPersonId）の整合を確かめる純粋関数。
//     確かめること … 人物 ID の重複、subjectPersonId・counterpartyPersonId が persons にない（参照切れ）
//   人物を探すときは、ID が重複していれば例外（黙って後勝ちにしない）、見つからなければ null。
//   人物に ROLE を付けない。本命の支から上神・天将・六親などは求めない（既存の関数に person.natalYear.branch を渡す）。
//   起課の FACT（LiurenChart・InterpretationFacts）には触れない。

import type { InterpretationContext, InterpretationPerson, PersonContextId } from "./roles";

export type PersonContextIssue =
  | { kind: "duplicatePersonId"; id: PersonContextId }
  | { kind: "missingSubjectPerson"; id: PersonContextId }
  | { kind: "missingCounterpartyPerson"; id: PersonContextId };

/** 人物入力の整合（問題がなければ issues は空） */
export function validateInterpretationPersons(context: InterpretationContext): { ok: boolean; issues: readonly PersonContextIssue[] } {
  const persons = context.persons ?? [];
  const issues: PersonContextIssue[] = [];
  const seen = new Set<PersonContextId>();
  const reported = new Set<PersonContextId>();
  for (const p of persons) {
    if (seen.has(p.id) && !reported.has(p.id)) {
      issues.push({ kind: "duplicatePersonId", id: p.id });
      reported.add(p.id);
    }
    seen.add(p.id);
  }
  if (context.subjectPersonId !== undefined && !seen.has(context.subjectPersonId)) {
    issues.push({ kind: "missingSubjectPerson", id: context.subjectPersonId });
  }
  if (context.counterpartyPersonId !== undefined && !seen.has(context.counterpartyPersonId)) {
    issues.push({ kind: "missingCounterpartyPerson", id: context.counterpartyPersonId });
  }
  return { ok: issues.length === 0, issues };
}

/** ID の人物（なければ null。同じ ID が複数あれば例外） */
export function findInterpretationPerson(context: InterpretationContext, id: PersonContextId): InterpretationPerson | null {
  const found = (context.persons ?? []).filter((p) => p.id === id);
  if (found.length > 1) throw new Error(`人物 ID が重複しています: ${id}`);
  return found[0] ?? null;
}
