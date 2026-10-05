// tests/liuren_interpretation_context_branch.manual.ts
//
// 六壬神課 Phase 4N（盤外の支 ContextBranchSource と resolveContextBranch）のテスト。
// 実行: npx tsx tests/liuren_interpretation_context_branch.manual.ts
//
//   1. personNatalYear（personId で指定）・taiSui（CONTEXT の taiSui）を出典つきで解決する
//      人物がいない・本命がない・太歳がないを区別する。人物 ID の重複は Phase 4M と同じく例外
//   2. 同じ支でも出典（人物の本命・太歳、別の人物）を区別できる。subjectPersonId・counterpartyPersonId から自動で選ばない
//   3. 解決した支を既存の関数に渡せる（Phase 4K・上神・Phase 4B・十二長生・驛馬）
//   4. 既存の CONTEXT と互換。BoardAnchor・resolveAnchor・AnchorResolutionContext・起課 FACT に混ぜていない
//   5. 盤外の支・太歳を変えても、起課結果・解釈 FACT・ROLE の照合が変わらない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf, resolveAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { derivedBranchDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";
import { growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { yimaOf } from "../src/lib/liuren/interpretation/markers";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { SEMANTIC_ROLE_RULES, roleRuleMatches } from "../src/lib/liuren/interpretation/roleRules";
import { resolveContextBranch } from "../src/lib/liuren/interpretation/contextBranch";
import type { ContextBranchResolution, ContextBranchSource, InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const resolved = (r: ReturnType<typeof resolveContextBranch>): ContextBranchResolution | null => (r.status === "resolved" ? r : null);

const A = { id: "A", natalYear: natalYearStateOf("己", "未") };
const B = { id: "B", natalYear: natalYearStateOf("己", "未") }; // A と同じ本命
const N = { id: "N" };
const taiSui = taiSuiStateOf("未"); // 本命と同じ支
const ctx: InterpretationContext = { domain: "exam", persons: [A, B, N], subjectPersonId: "A", counterpartyPersonId: "B", taiSui };
const srcA: ContextBranchSource = { kind: "personNatalYear", personId: "A" };
const srcB: ContextBranchSource = { kind: "personNatalYear", personId: "B" };
const srcT: ContextBranchSource = { kind: "taiSui" };

// ---- 1. 解決 ----
{
  const r = resolveContextBranch(ctx, srcA);
  check("personNatalYear: 人物 A の本命の支 未（出典つき・生年干は持たない）",
    r.status === "resolved" && r.branch === "未" && r.source === srcA && Object.keys(r).join() === "status,source,branch");
  check("存在しない人物は personNotFound", JSON.stringify(resolveContextBranch(ctx, { kind: "personNatalYear", personId: "X" })) ===
    JSON.stringify({ status: "unresolved", source: { kind: "personNatalYear", personId: "X" }, reason: "personNotFound" }));
  const n = resolveContextBranch(ctx, { kind: "personNatalYear", personId: "N" });
  check("本命のない人物は natalYearMissing（人物がいない場合と区別）", n.status === "unresolved" && n.reason === "natalYearMissing");
  const t = resolveContextBranch(ctx, srcT);
  check("taiSui: CONTEXT の太歳の支 未（TaiSuiState をそのまま読む）", t.status === "resolved" && t.branch === ctx.taiSui!.branch);
  const tn = resolveContextBranch({ domain: "exam" }, srcT);
  check("太歳のない CONTEXT は taiSuiMissing", tn.status === "unresolved" && tn.reason === "taiSuiMissing");
  check("人物のいない CONTEXT で personNatalYear は personNotFound", resolveContextBranch({ domain: "exam" }, srcA).status === "unresolved");
  let threw = false;
  try { resolveContextBranch({ domain: "exam", persons: [A, { id: "A" }] }, srcA); } catch { threw = true; }
  check("人物 ID が重複していれば例外（Phase 4M の findInterpretationPerson と同じ）", threw);
}

// ---- 2. 出典の区別・自動選択なし ----
{
  const ra = resolved(resolveContextBranch(ctx, srcA))!;
  const rb = resolved(resolveContextBranch(ctx, srcB))!;
  const rt = resolved(resolveContextBranch(ctx, srcT))!;
  check("本命と太歳が同じ支（未）でも出典で区別できる", ra.branch === rt.branch && ra.source.kind !== rt.source.kind);
  check("同じ本命の支の別人物も personId で区別できる", ra.branch === rb.branch && JSON.stringify(ra.source) !== JSON.stringify(rb.source));
  // subjectPersonId・counterpartyPersonId を入れ替えても、指定した personId の解決は変わらない（resolver は自動で選ばない）
  const swapped: InterpretationContext = { ...ctx, subjectPersonId: "B", counterpartyPersonId: "A" };
  const none: InterpretationContext = { ...ctx, subjectPersonId: undefined, counterpartyPersonId: undefined };
  check("subjectPersonId から出典を自動で選ばない（入れ替え・削除しても結果は同じ）",
    [swapped, none].every((c) => JSON.stringify(resolveContextBranch(c, srcA)) === JSON.stringify(resolveContextBranch(ctx, srcA))));
  check("subjectPersonId の人物の出典は、呼び出し側が personId を指定して作る",
    resolved(resolveContextBranch(ctx, { kind: "personNatalYear", personId: ctx.subjectPersonId! }))?.branch === "未");
  check("counterpartyPersonId の人物の出典も同じく呼び出し側が作る",
    resolved(resolveContextBranch(ctx, { kind: "personNatalYear", personId: ctx.counterpartyPersonId! }))?.source.kind === "personNatalYear");
  check("太歳は persons に入れていない", !(ctx.persons ?? []).some((p) => "taiSui" in p));
}

// ---- 3. 既存の関数へ ----
{
  // 例44 庚辰日 子将酉時（本命 未）
  const f = buildInterpretationFacts(calculateLiuren({ dayStem: "庚", dayBranch: "辰", divinationBranch: "酉", monthGeneral: "子" }));
  const r = resolved(resolveContextBranch(ctx, srcA))!;
  check("Phase 4K に渡せる（庚から見て未は父母）", derivedBranchDayStemStateOf(f, r.branch).sixRelation === "父母");
  check("上神: plate.heavenOn[未]＝戌", f.plate.heavenOn[r.branch] === "戌");
  check("天将: Phase 4B で 未 は貴人", heavenlyGeneralStateOf(f, r.branch).general === "貴人");
  check("十二長生: 庚の未は冠帯", growthStageOfStem("庚", r.branch) === "冠帯");
  check("驛馬（人物の本命の支）: yimaOf(未)＝巳", yimaOf(r.branch) === "巳");
  // 例52 丁丑日 午将辰時（太歳 酉）
  const f52 = buildInterpretationFacts(calculateLiuren({ dayStem: "丁", dayBranch: "丑", divinationBranch: "辰", monthGeneral: "午" }));
  const t52 = resolved(resolveContextBranch({ domain: "work", taiSui: taiSuiStateOf("酉") }, srcT))!;
  check("例52 太歳 酉: 一課上神と一致・天将 朱雀・上 亥", t52.branch === f52.lessons[0].upper && heavenlyGeneralStateOf(f52, t52.branch).general === "朱雀" && f52.plate.heavenOn[t52.branch] === "亥");
}

// ---- 4. 互換・型の分離 ----
{
  const legacy: InterpretationContext = { domain: "house", subtype: "moving", subjectAnchor: { kind: "lesson", index: 1 } };
  check("既存の CONTEXT（人物・太歳なし）はそのまま使える", legacy.persons === undefined && legacy.taiSui === undefined && resolveContextBranch(legacy, srcT).status === "unresolved");
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const roles = strip("src/lib/liuren/interpretation/roles.ts");
  const boardAnchor = roles.split("export type BoardAnchor =")[1].split(";\n")[0];
  check("BoardAnchor に盤外の出典（本命・太歳）を足していない", !/natal|taiSui|person/i.test(boardAnchor));
  check("AnchorResolver（resolveAnchor・AnchorResolutionContext）を変更していない", !/contextBranch|ContextBranch|taiSui|natalYear|person/i.test(strip("src/lib/liuren/interpretation/anchorResolver.ts")));
  check("起課エンジン・InterpretationFacts に盤外の支・太歳を入れていない",
    !/ContextBranch|taiSui|TaiSui/.test(strip("src/lib/liuren/types.ts") + strip("src/lib/liuren/liurenEngine.ts") + strip("src/lib/liuren/interpretation/facts.ts") +
      readFileSync("src/lib/liuren/interpretation/types.ts", "utf8").split("export interface InterpretationFacts")[1].split("\n}")[0]));
  const src = roles.split("export type ContextBranchSource =")[1].split(";")[0];
  check("ContextBranchSource に行年・subject 専用の種類がない", !/xingNian|行年|subjectNatal|counterpartyNatal/.test(src));
  check("InterpretationContext に年・暦の値を直接持たない", !/yearBranch|calendar|year:/.test(roles.split("export interface InterpretationContext")[1].split("\n}")[0]));
  const code = strip("src/lib/liuren/interpretation/contextBranch.ts");
  const hit = ["subjectPersonId", "counterpartyPersonId", "heavenOn", "general", "sixRelation", "growth", "yima", "stem", "SemanticRole", "domain ===", "persons.find", "persons.filter", "吉", "凶"]
    .filter((w) => code.includes(w));
  check("contextBranch.ts に自動選択・他の FACT・生年干・ROLE・DOMAIN・独自の人物探索がない", hit.length === 0, hit.join(","));
  check("RoleEvidence・RoleMatcher を変更していない", !/ContextBranch|personNatalYear/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")) &&
    !/ContextBranch/.test(roles.split("export type RoleEvidenceKind")[1] ?? ""));
}

// ---- 5. 起課・解釈 FACT・ROLE の照合が変わらない ----
{
  const variants: InterpretationContext[] = [
    { domain: "marriage" },
    { domain: "marriage", taiSui: taiSuiStateOf("子") },
    { domain: "marriage", persons: [A, N], subjectPersonId: "A", taiSui: taiSuiStateOf("午") },
  ];
  let charts = 0, changed = 0, roleDiff = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
    const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
    const chart = calculateLiuren(input);
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    charts += 1;
    for (const v of variants) for (const s of [srcA, srcT]) void resolveContextBranch(v, s);
    if (shi === "子") {
      const actx = anchorResolutionContextOf(facts);
      const ctxBefore = JSON.stringify(actx);
      for (const rule of SEMANTIC_ROLE_RULES) {
        const r = resolveAnchor(rule.source, actx)!;
        if (new Set(variants.map((v) => roleRuleMatches(rule, v, r, facts))).size !== 1) roleDiff += 1;
      }
      if (JSON.stringify(actx) !== ctxBefore) changed += 1;
    }
    if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
  }
  check("8,640課で、盤外の支・太歳を変えても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);
  check("720課で、太歳・人物を変えても本番 registry の ROLE 照合は同じ（ROLE を自動で付けない）", roleDiff === 0, String(roleDiff));
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
