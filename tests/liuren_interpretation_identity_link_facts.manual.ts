// tests/liuren_interpretation_identity_link_facts.manual.ts
//
// 六壬神課 Phase 4S（IdentityLink のつながり先の既存 FACT を参照する resolveIdentityLinkFacts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_identity_link_facts.manual.ts
//
//   1. 720課×3出典の全つながりで、位置の FACT が resolveAnchor の既存の状態そのもの（同じオブジェクト）で、
//      日干関係・六親（Phase 4K）・天将（Phase 4B。天盤支の位置だけ）・十二長生・旬空・坐空・標識が既存 FACT と一致
//   2. 位置の種類ごと（日支・四課上神・四課下神・干上・三伝）に、持つ FACT が違う（地盤側の位置に天将・坐空を作らない）
//   3. 同じ支でも位置が違えば結果に位置の違いが残る。元のつながり（出典・派生）に辿れる
//   4. 『六壬断案２』例42・44・52・53・54
//   5. IdentityLink・既存の状態の型を変えない。新しい判断（有効・無効・吉凶）・驛馬・ROLE・DOMAIN を持たない。8,640課で起課結果が変わらない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import type { AnchorResolutionContext } from "../src/lib/liuren/interpretation/anchorResolver";
import { growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { isSeatedOnVoid } from "../src/lib/liuren/interpretation/voidStructure";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { derivedBranchDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";
import { collectIdentityLinks } from "../src/lib/liuren/interpretation/identityLink";
import type { IdentityLink } from "../src/lib/liuren/interpretation/identityLink";
import { resolveIdentityLinkFacts } from "../src/lib/liuren/interpretation/identityLinkFacts";
import type { IdentityLinkFacts } from "../src/lib/liuren/interpretation/identityLinkFacts";
import type { ContextBranchSource, InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const ctxOf = (day: string, jiang: Branch, shi: Branch) =>
  anchorResolutionContextOf(buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang })));
const person = (id: string, stem: Stem, branch: Branch) => ({ id, natalYear: natalYearStateOf(stem, branch) });
const P = (personId: string): ContextBranchSource => ({ kind: "personNatalYear", personId });
const T: ContextBranchSource = { kind: "taiSui" };
const anchorName = (l: IdentityLink) => l.anchor.kind === "lesson" ? `lesson${l.anchor.index}.${l.anchor.part}` : l.anchor.kind === "position" ? l.anchor.position : l.anchor.kind;
const find = (fs: (IdentityLinkFacts | null)[], src: ContextBranchSource, d: string, anchor: string) =>
  fs.find((f) => f && JSON.stringify(f.link.source.source) === JSON.stringify(src) && f.link.source.derivation === d && anchorName(f.link) === anchor) ?? null;
/** つながり先の位置の FACT から、比べやすい値を取り出す（監査用） */
function positionValues(f: IdentityLinkFacts) {
  const p = f.position;
  switch (p.kind) {
    case "dayBranch": return { branch: p.state.branch, rel: p.state.relationToDayStem, six: p.state.sixRelation, growth: p.state.growthStage, isVoid: p.state.isDayXunVoid, seated: undefined };
    case "lessonUpper": return { branch: p.state.branch, rel: p.state.relationToDayStem, six: p.state.sixRelation, growth: p.state.growthStage, isVoid: p.state.isVoid, seated: p.state.isSeatedOnVoid };
    case "lessonLower": return { branch: p.lesson.lower as Branch, rel: undefined, six: undefined, growth: undefined, isVoid: undefined, seated: undefined };
    case "path": return { branch: p.state.branch, rel: p.state.relationToDayStem, six: p.state.sixRelation, growth: p.state.growthStage, isVoid: p.state.source.isVoid, seated: p.state.source.isSeatedOnVoid };
  }
}

// ---- 1・2. 720課 ----
const kinds: Record<string, number> = {};
let linksTotal = 0, mismatch = 0, charts = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  charts += 1;
  if (shi === "子") {
    const facts = buildInterpretationFacts(chart);
    const ctx: AnchorResolutionContext = anchorResolutionContextOf(facts, BRANCHES[(i + o) % 12]); // 旺衰も入る月支つき
    const ctxBefore = JSON.stringify(ctx);
    const context: InterpretationContext = {
      domain: "work", persons: [person("A", STEMS[(i + 3) % 10], BRANCHES[(i + 3) % 12]), person("B", STEMS[o % 10], BRANCHES[o % 12])],
      taiSui: taiSuiStateOf(BRANCHES[(i + o) % 12]),
    };
    const { links } = collectIdentityLinks(ctx, context, [P("A"), P("B"), T]);
    for (const link of links) {
      linksTotal += 1;
      const before1 = JSON.stringify(link);
      const f = resolveIdentityLinkFacts(ctx, link);
      if (!f) { mismatch += 1; continue; }
      inc(kinds, f.position.kind);
      const r = resolveAnchor(link.anchor.kind === "lesson" ? { kind: "lesson", index: link.anchor.index } : link.anchor, ctx)!;
      const v = positionValues(f);
      const d = derivedBranchDayStemStateOf(facts, link.branch);
      const sky = f.position.kind === "lessonUpper" || f.position.kind === "path";
      const sameObject =
        (f.position.kind === "dayBranch" && r.kind === "dayBranch" && f.position.state === r.source) ||
        (f.position.kind === "path" && r.kind === "path" && f.position.state === r.source) ||
        (f.position.kind === "lessonUpper" && r.kind === "lesson" && f.position.lesson === r.source && f.position.state === r.source.upper) ||
        (f.position.kind === "lessonLower" && r.kind === "lesson" && f.position.lesson === r.source);
      const ok = sameObject && f.link === link && JSON.stringify(link) === before1 &&
        v.branch === link.branch &&
        JSON.stringify(f.dayStemRelation) === JSON.stringify(d) &&
        (v.rel === undefined || (v.rel === d.relationToDayStem && v.six === d.sixRelation)) &&
        (v.growth === undefined || v.growth === growthStageOfStem(facts.basic.dayStem, link.branch)) &&
        (v.isVoid === undefined || v.isVoid === facts.xun.voidBranches.includes(link.branch)) &&
        (v.seated === undefined || v.seated === isSeatedOnVoid(facts, link.branch)) &&
        (sky ? f.heavenlyGeneral?.general === facts.generals.generalOn[link.branch] && f.heavenlyGeneral.skyBranch === link.branch : f.heavenlyGeneral === null) &&
        (f.position.kind !== "dayBranch" || (v.seated === undefined && f.heavenlyGeneral === null)) &&
        (f.position.kind !== "path" || (f.position.state.source.seasonalStrength !== null && f.position.state.source.seasonalStrength !== undefined));
      if (!ok) mismatch += 1;
    }
    if (JSON.stringify(ctx) !== ctxBefore) changed += 1;
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
}
function inc(o: Record<string, number>, k: string) { o[k] = (o[k] ?? 0) + 1; }
check("720課×3出典の全つながりで、位置の FACT が既存の状態そのもので、日干関係・六親・十二長生・旬空・坐空・天将・旺衰が既存 FACT と一致", linksTotal > 0 && mismatch === 0, `${linksTotal} / ${mismatch}`);
check("位置の種類は 日支・四課上神・四課下神・干上と三伝 の4種がすべて現れる", Object.keys(kinds).sort().join() === "dayBranch,lessonLower,lessonUpper,path", JSON.stringify(kinds));
check("8,640課で参照しても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);

// ---- 3・4. 断例・同じ支の別の位置 ----
const lines: string[] = [];
const factsAll = (ctx: AnchorResolutionContext, context: InterpretationContext, sources: ContextBranchSource[]) =>
  collectIdentityLinks(ctx, context, sources).links.map((l) => resolveIdentityLinkFacts(ctx, l));
{
  // 例42 甲寅日 未将寅時（辛未生）: 本命 未 heavenOn → 初伝 子
  const fs = factsAll(ctxOf("甲寅", "未", "寅"), { domain: "house", persons: [person("A", "辛", "未")] }, [P("A")]);
  const f = find(fs, P("A"), "heavenOn", "initial");
  const v = f && positionValues(f);
  check("例42 本命 未 heavenOn → 初伝 子: 六親 父母・十二長生 沐浴・旬空", !!v && v.branch === "子" && f!.dayStemRelation.sixRelation === "父母" && v.growth === "沐浴" && v.isVoid === true);
  lines.push(`例42 本命 未 heavenOn→初伝: 子 ${f?.dayStemRelation.sixRelation} ${v?.growth} 旬空 ${v?.isVoid} 天将 ${f?.heavenlyGeneral?.general}`);
  // 同じ支 子 が二課上神・四課上神・初伝にある: 位置の違いが残る
  const sameBranch = fs.filter((x) => x && x.link.branch === "子" && x.link.source.derivation === "heavenOn");
  check("例42 同じ支 子 の別の位置（二課上神・四課上神・初伝）は、位置の種類・元の状態が別", sameBranch.length === 3 && new Set(sameBranch.map((x) => anchorName(x!.link))).size === 3 &&
    sameBranch.filter((x) => x!.position.kind === "lessonUpper").length === 2 && sameBranch.filter((x) => x!.position.kind === "path").length === 1);
}
{
  // 例44 庚辰日 子将酉時（己未生）
  const fs = factsAll(ctxOf("庚辰", "子", "酉"), { domain: "exam", persons: [person("A", "己", "未")] }, [P("A")]);
  const on = find(fs, P("A"), "heavenOn", "lesson4.upper");
  const self = find(fs, P("A"), "self", "lesson3.upper");
  check("例44 本命 未 heavenOn → 四課上神 戌: 六親 父母", on?.link.branch === "戌" && on.dayStemRelation.sixRelation === "父母");
  check("例44 本命 未 self → 三課上神 未: 天将 貴人", self?.heavenlyGeneral?.general === "貴人");
  const lower = find(fs, P("A"), "self", "lesson4.lower");
  check("例44 本命 未 self → 四課下神 未 は地盤側の位置なので天将・天盤側の状態を持たない", lower?.position.kind === "lessonLower" && lower.heavenlyGeneral === null);
  lines.push(`例44 heavenOn→四課上神: 戌 ${on?.dayStemRelation.sixRelation} ／ self→三課上神: 未 ${self?.heavenlyGeneral?.general}`);
}
{
  // 例52 丁丑日 午将辰時（太歳 酉）
  const fs = factsAll(ctxOf("丁丑", "午", "辰"), { domain: "work", taiSui: taiSuiStateOf("酉") }, [T]);
  const self = find(fs, T, "self", "standing");
  const on = fs.filter((x) => x && x.link.source.derivation === "heavenOn");
  check("例52 太歳 酉 self → 干上 酉: 天将 朱雀", self?.heavenlyGeneral?.general === "朱雀");
  check("例52 太歳 酉 heavenOn → 亥（二課上神・中伝）: 六親 官鬼", on.length === 2 && on.every((x) => x!.dayStemRelation.sixRelation === "官鬼"));
  lines.push(`例52 self→干上: 酉 ${self?.heavenlyGeneral?.general} ／ heavenOn→${on.map((x) => anchorName(x!.link)).join("・")}: 亥 ${on[0]?.dayStemRelation.sixRelation}`);
}
{
  // 例53 丙子日 卯将丑時（戊辰生）
  const fs = factsAll(ctxOf("丙子", "卯", "丑"), { domain: "work", persons: [person("A", "戊", "辰")] }, [P("A")]);
  const f = find(fs, P("A"), "self", "initial");
  check("例53 年命 辰 self → 初伝 辰: 六親 子孫（つながりと六親は別の構造のまま）", f?.dayStemRelation.sixRelation === "子孫" && !("sixRelation" in f.link));
  lines.push(`例53 self→初伝: 辰 ${f?.dayStemRelation.sixRelation}`);
}
{
  // 例54 庚辰日 子将子時（丁巳生）: 年命 巳 は末伝 巳 とつながる
  const fs = factsAll(ctxOf("庚辰", "子", "子"), { domain: "exam", persons: [person("A", "丁", "巳")] }, [P("A")]);
  const f = find(fs, P("A"), "self", "final");
  const v = f && positionValues(f);
  check("例54 年命 巳 self → 末伝 巳: 官鬼・長生", f?.dayStemRelation.sixRelation === "官鬼" && v?.growth === "長生");
  lines.push(`例54 self→末伝: 巳 ${f?.dayStemRelation.sixRelation} ${v?.growth}`);
}
{
  // 出典の保持: 同じ本命の A・B、本命と太歳は結果から元のつながりに辿れる
  const ctx = ctxOf("庚辰", "子", "酉");
  const fs = factsAll(ctx, { domain: "exam", persons: [person("A", "己", "未"), person("B", "己", "未")], taiSui: taiSuiStateOf("未") }, [P("A"), P("B"), T]);
  const sources = new Set(fs.map((x) => JSON.stringify(x!.link.source.source)));
  check("結果から元のつながり（人物 A・B・太歳）に辿れる", sources.size === 3);
}

// ---- 5. 型・コード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/identityLinkFacts.ts");
  const hit = ["yima", "effective", "ineffective", "important", "activated", "good", "bad", "SemanticRole", "domain ===", "timing", "行年",
    "growthStageOf(", "relationBetween", "voidBranches", "earthUnder", "heavenOn["].filter((w) => code.includes(w));
  check("identityLinkFacts.ts に驛馬・判断・ROLE・DOMAIN・時期・行年・独自の計算がない", hit.length === 0, hit.join(","));
  check("既存の状態の型を作り直していない（新しい型は union と結果の2つだけ）", (code.match(/export (interface|type) /g) ?? []).length === 2);
  const id = strip("src/lib/liuren/interpretation/identityLink.ts");
  check("IdentityLink の型を変更していない", (id.split("export interface IdentityLink {")[1].split("}")[0].match(/^\s*(\w+)\??:/gm) ?? []).map((s) => s.trim().replace(/[?:]/g, "")).join() === "source,anchor,baseBranch,branch");
  check("RoleMatcher・RoleEvidence を変更していない", !/IdentityLink/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8") + readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8")));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`720課のつながり ${linksTotal}件 ／ 位置の種類 ${JSON.stringify(kinds)}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
