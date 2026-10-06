// src/lib/takujitsu/resolution/resolve.ts
//
// 役割:
//   RESOLUTION_RULES（rules.ts）を使って、occurrence detection の結果
//   （ShinsatsuResult）から ResolvedShinsatsuResult を計算する。
//
// 設計原則（重要）:
//   ・raw（入力）は一切書き換えない。返り値の raw フィールドは入力その
//     ものを保持する（凶神が解除されても raw.kyojin から削除しない）。
//   ・同じ対象に複数のルールが成立した場合:
//     - 成立した非pendingルールの kind がすべて同じなら、その kind を
//       採用する（appliedRules に全ルールを記録する）。
//     - 異なる kind が競合したら（例：cancelとaggravateが同時に成立）、
//       本文に優先順位の記載が無いため勝手に優先順位を作らず、
//       status を "pending" とする
//       （docs/takujitsu_resolution_rules.md「優先順位」節）。
//     - pending なルールは、条件が成立していても status に反映しない
//       （appliedRules には pending:true として記録するだけ）。
//   ・対象ルールが1つも無い、またはすべて条件不成立の場合は "active"。

import type { ShinsatsuResult } from "../types";
import { RESOLUTION_RULES } from "./rules";
import type {
  AppliedRuleRecord,
  RelationKind,
  RequiresGroup,
  ResolutionRule,
  ResolutionStatus,
  ResolvedShinsatsuEntry,
  ResolvedShinsatsuResult,
} from "./types";

function isGroupSatisfied(present: ReadonlySet<string>, group: RequiresGroup): boolean {
  if (group.mode === "all") {
    return group.names.every((n) => present.has(n));
  }
  return group.names.some((n) => present.has(n));
}

function isRuleConditionMet(present: ReadonlySet<string>, rule: ResolutionRule): boolean {
  if (rule.requires.length === 0) return false;
  if (rule.combine === "all") {
    return rule.requires.every((g) => isGroupSatisfied(present, g));
  }
  return rule.requires.some((g) => isGroupSatisfied(present, g));
}

function statusForKind(kind: RelationKind): ResolutionStatus {
  if (kind === "cancel") return "cancelled";
  if (kind === "aggravate") return "aggravated";
  return "reduced";
}

function resolveEntry(
  name: string,
  present: ReadonlySet<string>,
  rules: readonly ResolutionRule[],
): ResolvedShinsatsuEntry {
  const appliedRules: AppliedRuleRecord[] = [];
  const confirmedKinds = new Set<RelationKind>();

  for (const rule of rules) {
    if (!rule.targets.includes(name)) continue;
    if (!isRuleConditionMet(present, rule)) continue;

    appliedRules.push({ ruleId: rule.id, kind: rule.kind, pending: rule.pending, note: rule.note });
    if (!rule.pending) confirmedKinds.add(rule.kind);
  }

  if (appliedRules.length === 0) {
    return { name, status: "active" };
  }

  if (confirmedKinds.size === 0) {
    // 条件が成立したルールはあるが、すべて pending のため効力は発生しない。
    return { name, status: "active", appliedRules };
  }

  if (confirmedKinds.size > 1) {
    // 異なる種類の効力が競合。本文に優先順位の記載が無いため決め打ちしない。
    return {
      name,
      status: "pending",
      reason: "複数の確定ルールが競合し、優先順位が本文から確定できないため",
      appliedRules,
    };
  }

  const kind = [...confirmedKinds][0];
  const confirmedRecords = appliedRules.filter((r) => !r.pending);
  const primary = confirmedRecords[0];

  return {
    name,
    status: statusForKind(kind),
    ruleId: confirmedRecords.length === 1 ? primary.ruleId : undefined,
    reason: primary.note,
    note: confirmedRecords.length > 1 ? "複数の確定ルールが同じ効力で成立" : undefined,
    appliedRules,
  };
}

/**
 * occurrence detection の結果（raw）を受け取り、解除・相殺・増悪ルールを
 * 適用した結果を返す。raw は変更しない。
 */
export function resolve(
  raw: ShinsatsuResult,
  rules: readonly ResolutionRule[] = RESOLUTION_RULES,
): ResolvedShinsatsuResult {
  const present = new Set<string>([...raw.kichijin, ...raw.kyojin]);

  return {
    raw,
    kichijin: raw.kichijin.map((name) => resolveEntry(name, present, rules)),
    kyojin: raw.kyojin.map((name) => resolveEntry(name, present, rules)),
  };
}
