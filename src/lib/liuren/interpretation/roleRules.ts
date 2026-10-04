// src/lib/liuren/interpretation/roleRules.ts
//
// 役割（Phase 3X）:
//   「どの問占条件なら、どの盤上 FACT を、どの SemanticRole として読むか」を、出典つきのルールとして登録する器。
//   ルール（知識）と割り当て（特定の盤・CONTEXT に当てはめた結果。SemanticRoleAssignment）は別の型にする。
//   ルールは ROLE を決めるだけで、吉凶・成否・時期・宜進退・作用の強弱は持たない。
//   旬空などの制約（Phase 3S）や地点どうしの生剋（Phase 3R）をルールの条件にはしない（ROLE の存在と分けたまま）。
//
//   ルールの source は BoardAnchor（Phase 3T）で、resolveAnchor（Phase 3W）にそのまま渡せる。
//   FACT の条件（matcher）は小さな宣言的ユニオンで、AND だけ（OR・NOT・入れ子の式は持たない。任意コードも埋め込まない）。
//   割り当てをまとめて行う applySemanticRoleRules はまだ実装しない（1ルールの照合 roleRuleMatches だけ）。
//   本番の registry には、プロジェクト資料で読み方を確認できたルールだけを入れる（原典未確認の候補は入れない）。

import type { AnchorResolution } from "./anchorResolver";
import type {
  BoardAnchor, DomainSubtype, InterpretationContext, InterpretationDomain, InterpretationGoal, RoleConfidence,
  RoleEvidenceKind, SemanticRole,
} from "./roles";
import type { SixRelation } from "../types";
import type { GrowthStage, TransmissionToDayStemRelation } from "./types";

/** 出典の種類 */
export type RuleSourceType =
  | "classicalText"    // 古典の原文
  | "commentary"       // 古典への註
  | "courseMaterial"   // 講座資料（『六壬神課講座』）
  | "caseRecord"       // 実例集（『六壬断案』『六壬断案２』）
  | "projectResearch"; // このプロジェクトでの調査・確定仕様

/** 出典の確認状態 */
export type RuleVerification =
  | "originalVerified"      // 古典の原文で確認済み
  | "projectSourceVerified" // プロジェクト内の資料（講座・断案など）で確認済み。原文は未照合
  | "unverifiedCandidate";  // まだ候補（本番の registry には入れない）

export interface RuleSource {
  sourceType: RuleSourceType;
  /** 資料名（例: 『六壬神課講座』） */
  sourceLabel: string;
  /** 資料内の位置（例: "p67"） */
  locator: string;
  note?: string;
  verification: RuleVerification;
}

/** ルールが ROLE を付ける根拠（RoleEvidence に変換できる形） */
export interface RuleEvidence {
  kind: RoleEvidenceKind;
  detail: string;
  source: RuleSource;
}

/** source の FACT に対する条件（宣言的な小さいユニオン。複数あれば AND） */
export type RoleMatcher =
  | { kind: "sixRelation"; value: SixRelation }
  | { kind: "relationToDayStem"; value: TransmissionToDayStemRelation }
  | { kind: "growthStage"; value: GrowthStage }
  | { kind: "marker"; marker: "daySalary" | "dayVirtue" | "xunDing" | "yima" };

/** 問占条件（domain を省くと全般。subtype・goal は必要なルールだけ） */
export interface RoleRuleCondition<D extends InterpretationDomain = InterpretationDomain> {
  domain?: D;
  subtype?: DomainSubtype<D>;
  goal?: InterpretationGoal;
}

export interface SemanticRoleRule {
  /** 安定した ID（例: "house.moving.lesson1.origin"） */
  id: string;
  when: RoleRuleCondition;
  source: BoardAnchor;
  matchers?: readonly RoleMatcher[];
  role: SemanticRole;
  /** このルールから割り当てを作るときの確からしさの区分 */
  confidence: RoleConfidence;
  evidence: readonly RuleEvidence[];
}

/**
 * ルールの適用範囲（競合したときの比較の材料。勝敗の判定はまだしない）。
 * general（全般）< domain < subtype の順に狭い。goal の指定があるかどうかは別に持つ。
 */
export function roleRuleScopeOf(rule: SemanticRoleRule): { level: "general" | "domain" | "subtype"; hasGoal: boolean; matcherCount: number } {
  const level = rule.when.subtype ? "subtype" : rule.when.domain ? "domain" : "general";
  return { level, hasGoal: rule.when.goal !== undefined, matcherCount: rule.matchers?.length ?? 0 };
}

/** 解決した anchor の、matcher で見る値（日干そのものは六親などを持たないので対象外） */
function matchTarget(r: AnchorResolution) {
  switch (r.kind) {
    case "dayStem": return null;
    case "dayBranch": return { sixRelation: r.source.sixRelation, relationToDayStem: r.source.relationToDayStem, growthStage: r.source.growthStage, markers: r.source.markers };
    case "lesson": return {
      sixRelation: r.source.upper.sixRelation, relationToDayStem: r.source.upper.relationToDayStem, growthStage: r.source.upper.growthStage,
      markers: { daySalary: r.source.upper.isDaySalary, dayVirtue: r.source.upper.isDayVirtue, xunDing: r.source.upper.isXunDing, yima: r.source.upper.isYima },
    };
    case "path": return { sixRelation: r.source.sixRelation, relationToDayStem: r.source.relationToDayStem, growthStage: r.source.growthStage, markers: r.source.markers };
  }
}

/**
 * 1つのルールが、1つの CONTEXT と、そのルールの source を解決した結果に当てはまるか（監査用の小さな純粋関数）。
 * 四課は上神で見る。制約（旬空・坐空）や地点どうしの生剋は見ない。
 */
export function roleRuleMatches(rule: SemanticRoleRule, context: InterpretationContext, resolution: AnchorResolution): boolean {
  const w = rule.when;
  if (w.domain !== undefined && w.domain !== context.domain) return false;
  if (w.subtype !== undefined && w.subtype !== context.subtype) return false;
  if (w.goal !== undefined && w.goal !== context.goal) return false;
  if (!rule.matchers?.length) return true;
  const t = matchTarget(resolution);
  if (!t) return false;
  return rule.matchers.every((m) => {
    switch (m.kind) {
      case "sixRelation": return t.sixRelation === m.value;
      case "relationToDayStem": return t.relationToDayStem === m.value;
      case "growthStage": return t.growthStage === m.value;
      case "marker": return t.markers[m.marker];
    }
  });
}

// ---- 本番の registry（プロジェクト資料で読み方を確認できたルールだけ） ----

const KOZA = (locator: string, note?: string): RuleSource => ({
  sourceType: "courseMaterial", sourceLabel: "『六壬神課講座』", locator, note, verification: "projectSourceVerified",
});

export const SEMANTIC_ROLE_RULES: readonly SemanticRoleRule[] = [
  // 全般
  {
    id: "general.initial.process", when: {}, source: { kind: "position", position: "initial" }, role: "process", confidence: "direct",
    evidence: [{ kind: "boardPosition", detail: "初伝＝発用（物事の発端）", source: KOZA("p63・p64", "発用の見方") }],
  },
  {
    id: "general.final.outcome", when: {}, source: { kind: "position", position: "final" }, role: "outcome", confidence: "direct",
    evidence: [{ kind: "boardPosition", detail: "末伝＝帰計門（事件の終結の結果）", source: KOZA("p59", "占断八門 帰計門") }],
  },
  // 家宅（住む）
  {
    id: "house.residence.dayStem.self", when: { domain: "house", subtype: "residence" }, source: { kind: "dayStem" }, role: "self", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "日干を住んでいる人とする", source: KOZA("p67", "六壬で風水をみる") }],
  },
  {
    id: "house.residence.lesson1.self", when: { domain: "house", subtype: "residence" }, source: { kind: "lesson", index: 1 }, role: "self", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "住む人の表象は一課", source: KOZA("p67") }],
  },
  {
    id: "house.residence.dayBranch.target", when: { domain: "house", subtype: "residence" }, source: { kind: "dayBranch" }, role: "target", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "日支を家とする", source: KOZA("p67") }],
  },
  {
    id: "house.residence.lesson3.target", when: { domain: "house", subtype: "residence" }, source: { kind: "lesson", index: 3 }, role: "target", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "家の表象は三課", source: KOZA("p67") }],
  },
  // 家宅（転居）
  {
    id: "house.moving.lesson1.origin", when: { domain: "house", subtype: "moving" }, source: { kind: "lesson", index: 1 }, role: "origin", confidence: "combined",
    evidence: [
      { kind: "classicalRule", detail: "引越しでは日上神（一課）を旧宅とする", source: KOZA("p67", "転居の場合") },
      { kind: "context", detail: "subtype=moving", source: KOZA("p67") },
    ],
  },
  {
    id: "house.moving.lesson3.destination", when: { domain: "house", subtype: "moving" }, source: { kind: "lesson", index: 3 }, role: "destination", confidence: "combined",
    evidence: [
      { kind: "classicalRule", detail: "引越しでは支上神（三課）を新宅とする", source: KOZA("p67", "転居の場合") },
      { kind: "context", detail: "subtype=moving", source: KOZA("p67") },
    ],
  },
  // 婚姻
  {
    id: "marriage.lesson1.self", when: { domain: "marriage" }, source: { kind: "lesson", index: 1 }, role: "self", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "結婚占いでは一課は新郎", source: KOZA("p62", "四課の見方") }],
  },
  {
    id: "marriage.lesson3.counterparty", when: { domain: "marriage" }, source: { kind: "lesson", index: 3 }, role: "counterparty", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "結婚占いでは三課は新婦", source: KOZA("p62") }],
  },
  {
    id: "marriage.lesson2.environment", when: { domain: "marriage" }, source: { kind: "lesson", index: 2 }, role: "environment", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "二課と四課はそれぞれの家族", source: KOZA("p62") }],
  },
  {
    id: "marriage.lesson4.environment", when: { domain: "marriage" }, source: { kind: "lesson", index: 4 }, role: "environment", confidence: "direct",
    evidence: [{ kind: "classicalRule", detail: "二課と四課はそれぞれの家族", source: KOZA("p62") }],
  },
];
