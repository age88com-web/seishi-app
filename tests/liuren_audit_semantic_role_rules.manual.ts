// tests/liuren_audit_semantic_role_rules.manual.ts
//
// 六壬神課 Phase 3X: Semantic Role Rule 基盤の監査（監査専用。ROLE の一括割り当てはしない）。
// 実行: npx tsx tests/liuren_audit_semantic_role_rules.manual.ts
//
//   1. registry の監査: ID の重複なし・ROLE/DOMAIN/subtype が既存の型・出典と確認状態がある・未確認候補が混ざっていない
//   2. 全ルールの source が 720課すべてで resolveAnchor（Phase 3W）により解決でき、CONTEXT に応じて照合できる
//   3. 試験（断案2 例54: 官鬼 AND 長生）・病（講座 p66: 日干を剋す神）を宣言的 matcher で表せるか。求財（講座 p62）の不足
//   4. 照合が制約（旬空・坐空）や地点どうしの生剋に依存しないこと
//   原典未確認・一般化に根拠が足りない候補は candidateRules としてこのファイルにだけ置く（本番の registry には入れない）。

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { SEMANTIC_ROLE_RULES, roleRuleMatches, roleRuleScopeOf } from "../src/lib/liuren/interpretation/roleRules";
import type { RuleSource, SemanticRoleRule } from "../src/lib/liuren/interpretation/roleRules";
import type { InterpretationContext, SemanticRole, SemanticRoleAssignment } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const ROLES: SemanticRole[] = ["self", "counterparty", "target", "resource", "authority", "document", "movement", "origin", "destination", "environment", "obstacle", "support", "process", "outcome"];
const SUBTYPES: Record<string, string[]> = {
  wealth: ["general"], work: ["employment", "jobChange", "promotion", "transfer", "currentWork", "resignation", "independence"],
  exam: ["general"], house: ["residence", "moving"], marriage: ["general"], travel: ["departure"], traveler: ["return"],
  lostItem: ["general"], theft: ["general"], litigation: ["general"], illness: ["general"], pregnancy: ["maintain"],
  childbirth: ["delivery"], missingPerson: ["general"], weather: ["general"],
};

// ---- 候補（本番の registry には入れない） ----
const CANDIDATE = (sourceLabel: string, locator: string, note: string): RuleSource =>
  ({ sourceType: "caseRecord", sourceLabel, locator, note, verification: "unverifiedCandidate" });
const candidateRules: SemanticRoleRule[] = [
  {
    // 断案2 例54 は末伝巳の1例だけ。位置と条件の一般化に根拠が足りないため候補にとどめる
    id: "candidate.exam.final.officerGrowth.authority", when: { domain: "exam" }, source: { kind: "position", position: "final" },
    matchers: [{ kind: "sixRelation", value: "官鬼" }, { kind: "growthStage", value: "長生" }], role: "authority", confidence: "combined",
    evidence: [{ kind: "classicalRule", detail: "官星学堂、故に科甲", source: CANDIDATE("『六壬断案２』", "例54", "1例からの一般化") }],
  },
  {
    // 講座 p66「病占などで日干を剋する神」。位置の指定がないため、ここでは初伝を例に置く（どの位置でもよい、という量化は未対応）
    id: "candidate.illness.initial.overcomesDayStem.obstacle", when: { domain: "illness" }, source: { kind: "position", position: "initial" },
    matchers: [{ kind: "relationToDayStem", value: "transmissionOvercomesDayStem" }], role: "obstacle", confidence: "combined",
    evidence: [{ kind: "classicalRule", detail: "病占などで日干を剋する神", source: { sourceType: "courseMaterial", sourceLabel: "『六壬神課講座』", locator: "p66", note: "位置の指定なし", verification: "unverifiedCandidate" } }],
  },
  // Phase 3T で原典未確認とした DOMAIN（出行・行人・失物・盗難・訴訟・妊娠・出産）は、ルールにせず対応表の候補のまま
];

// ---- 1. registry の監査 ----
const ids = SEMANTIC_ROLE_RULES.map((r) => r.id);
check("Rule ID の重複なし", new Set(ids).size === ids.length, ids.join(","));
check("ROLE はすべて既存の SemanticRole", SEMANTIC_ROLE_RULES.every((r) => ROLES.includes(r.role)));
check("DOMAIN・subtype は既存の型の値", SEMANTIC_ROLE_RULES.every((r) => r.when.domain === undefined ||
  (r.when.domain in SUBTYPES && (r.when.subtype === undefined || SUBTYPES[r.when.domain].includes(r.when.subtype as string)))));
check("全ルールに出典と確認状態がある", SEMANTIC_ROLE_RULES.every((r) => r.evidence.length > 0 &&
  r.evidence.every((e) => e.source.sourceLabel && e.source.locator && e.source.verification)));
check("本番 registry に未確認候補が混ざっていない", SEMANTIC_ROLE_RULES.every((r) => r.evidence.every((e) => e.source.verification !== "unverifiedCandidate")));
check("候補の ID は registry と重ならない", candidateRules.every((c) => !ids.includes(c.id)));
check("講座のルールは「原典確認済み」と表示しない", SEMANTIC_ROLE_RULES.every((r) => r.evidence.every((e) =>
  e.source.sourceType !== "courseMaterial" || e.source.verification === "projectSourceVerified")));
{
  const src = readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8").replace(/\/\/.*$/gm, "");
  const hit = ["good", "bad", "favorable", "success", "failure", "effective", "constraints", "internalRelations", "吉", "凶"].filter((w) => src.includes(w));
  check("roleRules.ts のコードに評価語・制約・地点どうしの関係が出てこない", hit.length === 0, hit.join(","));
}

// ---- 2〜4. 720課 ----
const CONTEXTS: InterpretationContext[] = [
  { domain: "house", subtype: "residence" }, { domain: "house", subtype: "moving" }, { domain: "marriage" }, { domain: "wealth" },
];
const matchedCount: Record<string, number> = Object.fromEntries([...SEMANTIC_ROLE_RULES, ...candidateRules].map((r) => [r.id, 0]));
let resolved = 0;
let exam54 = false;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
    const ctx = anchorResolutionContextOf(facts);
    const before = JSON.stringify(ctx);
    for (const rule of [...SEMANTIC_ROLE_RULES, ...candidateRules]) {
      const r = resolveAnchor(rule.source, ctx);
      if (!r) {
        check(`${rule.id} ${STEMS[i % 10]}${BRANCHES[i % 12]}+${o} 解決`, false);
        continue;
      }
      if (SEMANTIC_ROLE_RULES.includes(rule)) resolved += 1;
      // CONTEXT の照合: domain・subtype が合うときだけ（matcher がなければ盤によらず当てはまる）
      const own: InterpretationContext = { domain: rule.when.domain ?? "wealth", subtype: rule.when.subtype, goal: rule.when.goal };
      const m = roleRuleMatches(rule, own, r);
      if (m) matchedCount[rule.id] += 1;
      if (!rule.matchers?.length && !m) check(`${rule.id} 自分の CONTEXT で当てはまる`, false);
      for (const c of CONTEXTS) {
        const expected = (rule.when.domain === undefined || rule.when.domain === c.domain) && (rule.when.subtype === undefined || rule.when.subtype === c.subtype);
        if (!rule.matchers?.length && roleRuleMatches(rule, c, r) !== expected) check(`${rule.id} CONTEXT ${c.domain}/${c.subtype} の照合`, false);
      }
    }
    if (JSON.stringify(ctx) !== before) check(`${STEMS[i % 10]}${BRANCHES[i % 12]}+${o} FACT 不変`, false);
  }
}
check("registry の全ルールの source が720課で解決", resolved === SEMANTIC_ROLE_RULES.length * 720, String(resolved));
{
  // 試験: 例54（庚辰日 子将子時）の末伝巳は 官鬼 AND 長生 に当てはまる
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "庚", dayBranch: "辰", divinationBranch: "子", monthGeneral: "子" }));
  const ctx = anchorResolutionContextOf(facts);
  const rule = candidateRules[0];
  exam54 = roleRuleMatches(rule, { domain: "exam" }, resolveAnchor(rule.source, ctx)!);
  check("試験 例54 末伝巳＝官鬼 AND 長生 を宣言的 matcher で表せる", exam54 && !roleRuleMatches(rule, { domain: "work" }, resolveAnchor(rule.source, ctx)!));
  // 照合は制約に依存しない: 乙卯日 天盤差11 の初伝丑（旬空）でも、条件が合えば当てはまる
  const f2 = buildInterpretationFacts(calculateLiuren({ dayStem: "乙", dayBranch: "卯", divinationBranch: "子", monthGeneral: BRANCHES[11] }));
  const c2 = anchorResolutionContextOf(f2);
  const ini = resolveAnchor({ kind: "position", position: "initial" }, c2)!;
  const voidRule: SemanticRoleRule = { id: "audit.voidIndependent", when: {}, source: { kind: "position", position: "initial" },
    matchers: [{ kind: "sixRelation", value: "妻財" }], role: "target", confidence: "direct", evidence: [] };
  check("旬空の初伝丑（妻財）にも matcher は当てはまる（制約で ROLE を消さない）", ini.constraints.includes("dayXunVoid") && roleRuleMatches(voidRule, { domain: "wealth" }, ini));
  // ルールから割り当てへ（型の確認だけ。一括適用はしない）
  const toAssignment = (r: SemanticRoleRule): SemanticRoleAssignment => ({
    role: r.role, source: r.source, confidence: r.confidence,
    evidence: r.evidence.map((e) => ({ kind: e.kind, detail: e.detail, citation: `${e.source.sourceLabel} ${e.source.locator}` })),
  });
  check("ルールの根拠を RoleEvidence に変換できる", toAssignment(SEMANTIC_ROLE_RULES[0]).evidence[0].citation === "『六壬神課講座』 p63・p64");
}

console.log(`本番 registry（${SEMANTIC_ROLE_RULES.length}件）:`);
for (const r of SEMANTIC_ROLE_RULES) {
  const s = roleRuleScopeOf(r);
  const src = r.source.kind === "lesson" ? `lesson${r.source.index}` : r.source.kind === "position" ? r.source.position : r.source.kind;
  console.log(`  ${r.id}: ${src} → ${r.role}（${r.confidence}・範囲 ${s.level}） 出典 ${r.evidence.map((e) => `${e.source.sourceLabel}${e.source.locator}［${e.source.verification}］`).join(" ")}`);
}
console.log(`候補（registry 外・${candidateRules.length}件）:`);
for (const r of candidateRules) console.log(`  ${r.id}: matcher ${r.matchers?.map((m) => `${m.kind}=${"value" in m ? m.value : m.marker}`).join(" AND ")} → ${r.role} ／ 720課で当てはまる課 ${matchedCount[r.id]}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
