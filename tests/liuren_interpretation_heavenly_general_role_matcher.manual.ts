// tests/liuren_interpretation_heavenly_general_role_matcher.manual.ts
//
// 六壬神課 Phase 4C（RoleMatcher の heavenlyGeneral）のテスト。
// 実行: npx tsx tests/liuren_interpretation_heavenly_general_role_matcher.manual.ts
//
//   1. 720課×10 anchor: 日干・日支そのものは常に false（日干の解決が持つ standing を代わりに使わない）。
//      他の8位置は12天将すべてで「matcher の結果＝Phase 4B の FACT の天将か」（実際の天将だけ true、他の11天将は false）
//   2. 同じ天盤支なら同じ結果（例: 三課上神＝初伝）。旬空・坐空の制約があっても false にならない
//   3. 既存 matcher との AND（官鬼 AND 長生 AND 青龍 の型が書ける・各条件が効く）。matcherCount が1増える
//   4. 古典例（『六壬断案２』例35・41・43・48・54）の技術監査。天将盤の方式が違う8例（例30・33・34・36・38・40・42・56）は使わない
//   5. 照合の前後で FACT・AnchorResolutionContext・ルールが変わらない。matcher は CONTEXT を見ない（when 側だけ）
//   6. 本番 registry に天将を使うルールを追加していない

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { GENERALS } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOfResolution } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { SEMANTIC_ROLE_RULES, roleRuleMatches, roleRuleScopeOf } from "../src/lib/liuren/interpretation/roleRules";
import type { RoleMatcher, SemanticRoleRule } from "../src/lib/liuren/interpretation/roleRules";
import type { BoardAnchor, InterpretationContext } from "../src/lib/liuren/interpretation/roles";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";
import type { AnchorResolutionContext } from "../src/lib/liuren/interpretation/anchorResolver";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

const ANCHORS: [string, BoardAnchor][] = [
  ["dayStem", { kind: "dayStem" }], ["dayBranch", { kind: "dayBranch" }],
  ["lesson1", { kind: "lesson", index: 1 }], ["lesson2", { kind: "lesson", index: 2 }],
  ["lesson3", { kind: "lesson", index: 3 }], ["lesson4", { kind: "lesson", index: 4 }],
  ["standing", { kind: "position", position: "standing" }], ["initial", { kind: "position", position: "initial" }],
  ["middle", { kind: "position", position: "middle" }], ["final", { kind: "position", position: "final" }],
];
const anchorOf = (name: string) => ANCHORS.find(([n]) => n === name)![1];
const CTX: InterpretationContext = { domain: "wealth" };

/** 監査用のルール（registry には入れない） */
const ruleOf = (source: BoardAnchor, matchers: RoleMatcher[], when: SemanticRoleRule["when"] = {}): SemanticRoleRule =>
  ({ id: "audit.heavenlyGeneral", when, source, matchers, role: "process", confidence: "direct", evidence: [] });
const generalRule = (source: BoardAnchor, value: HeavenlyGeneral) => ruleOf(source, [{ kind: "heavenlyGeneral", value }]);

function matches(name: string, value: HeavenlyGeneral, facts: InterpretationFacts, ctx: AnchorResolutionContext): boolean {
  const a = anchorOf(name);
  return roleRuleMatches(generalRule(a, value), CTX, resolveAnchor(a, ctx)!, facts);
}

// ---- 1・2・5. 720課 ----
let evaluated = 0, positive = 0, falsePositive = 0, falseNegative = 0, dayFalse = 0, sameBranch = 0, voidTrue = 0, standingNotUsed = 0;
const trueDist: Record<string, number> = {};
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const facts = buildInterpretationFacts(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
    const ctx = anchorResolutionContextOf(facts);
    const before = JSON.stringify(ctx) + JSON.stringify(facts);
    const result: Record<string, HeavenlyGeneral[]> = {};
    for (const [name, a] of ANCHORS) {
      const r = resolveAnchor(a, ctx)!;
      const fact = heavenlyGeneralStateOfResolution(facts, r);
      result[name] = [];
      for (const g of GENERALS) {
        const rule = generalRule(a, g);
        const ruleBefore = JSON.stringify(rule);
        const m = roleRuleMatches(rule, CTX, r, facts);
        evaluated += 1;
        if (JSON.stringify(rule) !== ruleBefore) check(`${tag} ${name} ルール不変`, false);
        if (m) result[name].push(g);
        if (name === "dayStem" || name === "dayBranch") {
          if (m) check(`${tag} ${name} ${g} は false`, false); else dayFalse += 1;
          continue;
        }
        const expected = fact!.general === g;
        if (m && expected) { positive += 1; inc(trueDist, name); }
        if (m && !expected) falsePositive += 1;
        if (!m && expected) falseNegative += 1;
        // 制約（旬空・坐空）があっても天将の matcher は当てはまる
        if (m && r.constraints.length) voidTrue += 1;
      }
    }
    // 日干の解決が持つ standing（干上）の天将でも、日干の matcher は当てはまらない
    const ds = resolveAnchor({ kind: "dayStem" }, ctx);
    if (ds?.kind === "dayStem" && ds.standing && !matches("dayStem", facts.generals.generalOn[ds.standing.branch], facts, ctx)) standingNotUsed += 1;
    // 同じ天盤支なら同じ結果
    const sky: Record<string, Branch> = {
      lesson1: facts.lessons[0].upper, lesson2: facts.lessons[1].upper, lesson3: facts.lessons[2].upper, lesson4: facts.lessons[3].upper,
      standing: facts.lessons[0].upper, initial: facts.transmissions![0].branch, middle: facts.transmissions![1].branch, final: facts.transmissions![2].branch,
    };
    const names = Object.keys(sky);
    for (const x of names) for (const y of names) {
      if (x < y && sky[x] === sky[y]) {
        if (result[x].join() !== result[y].join()) check(`${tag} 同じ支 ${x}・${y}`, false);
        else if (x === "lesson3" && y === "initial" || x === "initial" && y === "lesson3") sameBranch += 1;
      }
    }
    if (JSON.stringify(ctx) + JSON.stringify(facts) !== before) check(`${tag} FACT・CONTEXT 不変`, false);
  }
}
check("720課×10 anchor×12天将を照合", evaluated === 720 * 10 * 12, String(evaluated));
check("日干・日支は 2×720×12 件すべて false", dayFalse === 2 * 720 * 12, String(dayFalse));
check("日干の解決が持つ standing の天将でも日干の matcher は false（720課）", standingNotUsed === 720, String(standingNotUsed));
check("8位置×720課 で true はちょうど1天将（Phase 4B の FACT）", positive === 8 * 720 && falseNegative === 0, `${positive} / 取りこぼし ${falseNegative}`);
check("実際の天将以外の11天将はすべて false", falsePositive === 0, String(falsePositive));
check("旬空・坐空の制約がある位置でも true になる", voidTrue > 0, String(voidTrue));

// ---- 3. AND と matcherCount ----
{
  // 例54 庚辰日 子将子時 末伝巳＝官鬼・長生・朱雀（Phase 3X の候補と同じ盤）
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "庚", dayBranch: "辰", divinationBranch: "子", monthGeneral: "子" }));
  const ctx = anchorResolutionContextOf(facts);
  const fin = resolveAnchor(anchorOf("final"), ctx)!;
  const base: RoleMatcher[] = [{ kind: "sixRelation", value: "官鬼" }, { kind: "growthStage", value: "長生" }];
  const typed = ruleOf(anchorOf("final"), [...base, { kind: "heavenlyGeneral", value: "青龍" }]); // 官鬼 AND 長生 AND 青龍 が型として書ける
  const withSuzaku = ruleOf(anchorOf("final"), [...base, { kind: "heavenlyGeneral", value: "朱雀" }]);
  const wrongRel = ruleOf(anchorOf("final"), [{ kind: "sixRelation", value: "妻財" }, { kind: "growthStage", value: "長生" }, { kind: "heavenlyGeneral", value: "朱雀" }]);
  check("AND: 官鬼 AND 長生 AND 朱雀 は末伝巳で true", roleRuleMatches(withSuzaku, CTX, fin, facts));
  check("AND: 天将が違えば false（官鬼 AND 長生 AND 青龍）", !roleRuleMatches(typed, CTX, fin, facts));
  check("AND: 天将が合っても他の条件が違えば false（妻財 AND 長生 AND 朱雀）", !roleRuleMatches(wrongRel, CTX, fin, facts));
  check("AND の順を変えても同じ", roleRuleMatches(ruleOf(anchorOf("final"), [{ kind: "heavenlyGeneral", value: "朱雀" }, ...base]), CTX, fin, facts));
  check("matcherCount: 天将の matcher を1つ足すと1増える", roleRuleScopeOf(withSuzaku).matcherCount === roleRuleScopeOf(ruleOf(anchorOf("final"), base)).matcherCount + 1);
  check("matcherCount 以外の範囲（level・hasGoal）は変わらない",
    JSON.stringify({ ...roleRuleScopeOf(withSuzaku), matcherCount: 0 }) === JSON.stringify({ ...roleRuleScopeOf(ruleOf(anchorOf("final"), base)), matcherCount: 0 }));
  // CONTEXT は when 側だけで見る（matcher 自体は domain・subtype・goal を見ない）
  const contexts: InterpretationContext[] = [{ domain: "wealth" }, { domain: "exam" }, { domain: "house", subtype: "moving" }, { domain: "marriage", goal: "acquire" }];
  check("when がなければ、どの CONTEXT でも同じ結果", contexts.every((c) => roleRuleMatches(withSuzaku, c, fin, facts)));
  const examOnly = ruleOf(anchorOf("final"), [{ kind: "heavenlyGeneral", value: "朱雀" }], { domain: "exam" });
  check("when.domain の判定は既存どおり（exam で true・wealth で false）", roleRuleMatches(examOnly, { domain: "exam" }, fin, facts) && !roleRuleMatches(examOnly, { domain: "wealth" }, fin, facts));
  // facts を渡さずに天将の matcher を照合するとエラー（黙って false にしない）。既存 matcher は従来どおり facts なしで動く
  let threw = false;
  try { roleRuleMatches(withSuzaku, CTX, fin); } catch { threw = true; }
  check("facts なしの天将 matcher はエラー", threw);
  check("既存 matcher は facts なしでも従来どおり", roleRuleMatches(ruleOf(anchorOf("final"), base), CTX, fin));
}

// ---- 4. 古典例（技術監査） ----
type Classic = [id: string, day: string, jiang: Branch, shi: Branch, anchor: string, branch: Branch, general: HeavenlyGeneral];
const CLASSICS: Classic[] = [
  ["例35", "丁卯", "子", "卯", "initial", "子", "螣蛇"], ["例35", "丁卯", "子", "卯", "final", "午", "白虎"],
  ["例41", "戊申", "未", "酉", "initial", "丑", "天空"], ["例41", "戊申", "未", "酉", "lesson3", "午", "螣蛇"],
  ["例43", "丁丑", "午", "未", "initial", "子", "螣蛇"], ["例43", "丁丑", "午", "未", "lesson3", "子", "螣蛇"],
  ["例48", "庚戌", "亥", "辰", "initial", "戌", "六合"], ["例48", "庚戌", "亥", "辰", "middle", "巳", "太常"],
  ["例54", "庚辰", "子", "子", "middle", "寅", "青龍"], ["例54", "庚辰", "子", "子", "final", "巳", "朱雀"],
];
const EXCLUDED = ["例30", "例33", "例34", "例36", "例38", "例40", "例42", "例56"];
check("天将盤の方式が違う8例を古典例に使っていない", CLASSICS.every((c) => !EXCLUDED.includes(c[0])));
const classicLines: string[] = [];
for (const [id, day, jiang, shi, name, branch, general] of CLASSICS) {
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
  const ctx = anchorResolutionContextOf(facts);
  const r = resolveAnchor(anchorOf(name), ctx)!;
  const sky = r.kind === "lesson" ? r.source.upper.branch : r.kind === "path" ? r.source.branch : null;
  const ok = matches(name, general, facts, ctx);
  const others = GENERALS.filter((g) => g !== general && matches(name, g, facts, ctx));
  check(`断案2 ${id} ${name} ${branch}＋${general} が true（他の11天将は false）`, sky === branch && ok && others.length === 0, `${sky} ${others.join(",")}`);
  classicLines.push(`${id} ${day}日 ${jiang}将${shi}時 ${name}（${sky}）+ ${general}: ${ok}`);
}

// ---- 6. registry ----
check("本番 registry に天将の matcher を使うルールがない", SEMANTIC_ROLE_RULES.every((r) => !r.matchers?.some((m) => m.kind === "heavenlyGeneral")));
check("本番 registry の件数は Phase 3X のまま（12件）", SEMANTIC_ROLE_RULES.length === 12, String(SEMANTIC_ROLE_RULES.length));

console.log(`照合 ${evaluated}件（720課×10 anchor×12天将）: true ${positive}（位置別 ${JSON.stringify(trueDist)}）・誤陽性 ${falsePositive}・取りこぼし ${falseNegative}・日干/日支 false ${dayFalse}`);
console.log(`三課上神＝初伝 の課で同じ結果: ${sameBranch} ／ 制約のある位置で true: ${voidTrue}`);
console.log("古典例:");
for (const l of classicLines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
