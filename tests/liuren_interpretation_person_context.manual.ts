// tests/liuren_interpretation_person_context.manual.ts
//
// 六壬神課 Phase 4M（人物入力 InterpretationPerson と、InterpretationContext の persons・subjectPersonId・counterpartyPersonId）のテスト。
// 実行: npx tsx tests/liuren_interpretation_person_context.manual.ts
//
//   1. 1人（本命あり・なし）、2人（別の本命・同じ本命）を独立して保持できる。本命は Phase 4L-2 の NatalYearState をそのまま持つ
//   2. subjectPersonId・counterpartyPersonId の参照、重複 ID・参照切れの検出（黙って後勝ちにしない）
//   3. 既存の CONTEXT（人物なし）とそのまま互換。盤上の起点 subjectAnchor・counterpartyAnchor は別の項目のまま
//   4. 本命の支を既存の関数に渡せる（Phase 4K・上神・Phase 4B・十二長生・驛馬）。太歳とは別に保持できる
//   5. 例44（己未生）と、同じ課を占う別の人物（例45 の年命は資料にないので、別の有効な干支を試験用に使う）
//   6. 人物入力を変えても起課結果・解釈 FACT・ROLE の照合が変わらない。起課 FACT に人物を入れていない

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
import { findInterpretationPerson, validateInterpretationPersons } from "../src/lib/liuren/interpretation/personContext";
import type { InterpretationContext, InterpretationPerson } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const issuesOf = (c: InterpretationContext) => validateInterpretationPersons(c).issues.map((i) => `${i.kind}:${i.id}`).join(",");

// ---- 1. 人物の保持 ----
const a: InterpretationPerson = { id: "A", natalYear: natalYearStateOf("己", "未") };
const noNatal: InterpretationPerson = { id: "N" };
{
  const c1: InterpretationContext = { domain: "exam", persons: [a], subjectPersonId: "A" };
  check("1人・本命あり: 保持でき、整合に問題なし", validateInterpretationPersons(c1).ok && findInterpretationPerson(c1, "A")?.natalYear?.branch === "未");
  const c2: InterpretationContext = { domain: "exam", persons: [noNatal], subjectPersonId: "N" };
  check("1人・本命なし: 保持でき、natalYear は省ける", validateInterpretationPersons(c2).ok && findInterpretationPerson(c2, "N")?.natalYear === undefined);
  const b: InterpretationPerson = { id: "B", natalYear: natalYearStateOf("甲", "子") };
  const c3: InterpretationContext = { domain: "marriage", persons: [a, b], subjectPersonId: "A", counterpartyPersonId: "B" };
  check("2人・別の本命: それぞれ独立して保持", validateInterpretationPersons(c3).ok &&
    findInterpretationPerson(c3, "A")?.natalYear?.branch === "未" && findInterpretationPerson(c3, "B")?.natalYear?.branch === "子");
  const twin: InterpretationPerson = { id: "A2", natalYear: natalYearStateOf("己", "未") };
  const c4: InterpretationContext = { domain: "work", persons: [a, twin] };
  check("2人・同じ本命: ID で別の人物として保持", validateInterpretationPersons(c4).ok &&
    findInterpretationPerson(c4, "A") !== findInterpretationPerson(c4, "A2") && JSON.stringify(a.natalYear) === JSON.stringify(twin.natalYear));
  check("本命は Phase 4L-2 の NatalYearState をそのまま持つ（kind・stem・branch）", Object.keys(a.natalYear!).join() === "kind,stem,branch" && a.natalYear!.kind === "natalYear");
  check("人物の項目は id・natalYear だけ（実名・生年月日・性別・年齢・行年・ROLE・別名を持たない）", Object.keys(a).join() === "id,natalYear");
}

// ---- 2. 参照・重複・参照切れ ----
{
  const dup: InterpretationContext = { domain: "work", persons: [a, { id: "A", natalYear: natalYearStateOf("甲", "子") }], subjectPersonId: "A" };
  check("重複 ID を検出（1件として報告）", issuesOf(dup) === "duplicatePersonId:A");
  let threw = false;
  try { findInterpretationPerson(dup, "A"); } catch { threw = true; }
  check("重複 ID の人物を探すと例外（黙って後勝ちにしない）", threw);
  check("subjectPersonId の参照切れを検出", issuesOf({ domain: "work", persons: [a], subjectPersonId: "X" }) === "missingSubjectPerson:X");
  check("counterpartyPersonId の参照切れを検出", issuesOf({ domain: "marriage", persons: [a], counterpartyPersonId: "Y" }) === "missingCounterpartyPerson:Y");
  check("persons がないのに ID を指定すると参照切れ", issuesOf({ domain: "work", subjectPersonId: "A", counterpartyPersonId: "B" }) === "missingSubjectPerson:A,missingCounterpartyPerson:B");
  check("見つからない ID は null", findInterpretationPerson({ domain: "work", persons: [a] }, "Z") === null);
}

// ---- 3. 既存 CONTEXT との互換 ----
{
  const legacy: InterpretationContext = { domain: "house", subtype: "moving" };
  check("人物なしの既存 CONTEXT はそのまま有効", validateInterpretationPersons(legacy).ok && findInterpretationPerson(legacy, "A") === null);
  const both: InterpretationContext = { domain: "marriage", subjectAnchor: { kind: "lesson", index: 1 }, counterpartyAnchor: { kind: "lesson", index: 3 }, persons: [a], subjectPersonId: "A" };
  check("盤上の起点（subjectAnchor・counterpartyAnchor）は人物 ID と別の項目のまま",
    both.subjectAnchor?.kind === "lesson" && both.counterpartyAnchor?.kind === "lesson" && typeof both.subjectPersonId === "string");
}

// ---- 4・5. 本命の支を既存の関数へ・例44 ----
{
  // 例44 庚辰日 子将酉時（何秀才 己未生）。同じ課を占う別の人物は、試験用の干支（例45 の年命ではない）
  const f = buildInterpretationFacts(calculateLiuren({ dayStem: "庚", dayBranch: "辰", divinationBranch: "酉", monthGeneral: "子" }));
  const other: InterpretationPerson = { id: "other", natalYear: natalYearStateOf("丙", "寅") };
  const ctx: InterpretationContext = { domain: "exam", persons: [a, other], subjectPersonId: "A" };
  const pa = findInterpretationPerson(ctx, "A")!.natalYear!;
  const po = findInterpretationPerson(ctx, "other")!.natalYear!;
  check("例44 Person A の本命 未: 天将 貴人（Phase 4B）・上 戌（plate.heavenOn）", heavenlyGeneralStateOf(f, pa.branch).general === "貴人" && f.plate.heavenOn[pa.branch] === "戌");
  check("例44 Person A の本命 未: 庚から見て父母（Phase 4K）・庚の冠帯（十二長生）・驛馬 巳（yimaOf）",
    derivedBranchDayStemStateOf(f, pa.branch).sixRelation === "父母" && growthStageOfStem("庚", pa.branch) === "冠帯" && yimaOf(pa.branch) === "巳");
  check("同じ盤で別の人物（試験用 丙寅）は別の本命の支として独立に扱える", po.branch === "寅" && heavenlyGeneralStateOf(f, po.branch).general !== heavenlyGeneralStateOf(f, pa.branch).general);
  console.log(`例44: A 本命 ${pa.stem}${pa.branch} 天将 ${heavenlyGeneralStateOf(f, pa.branch).general} 上 ${f.plate.heavenOn[pa.branch]} 六親 ${derivedBranchDayStemStateOf(f, pa.branch).sixRelation} ／ 別の人物（試験用） ${po.stem}${po.branch} 天将 ${heavenlyGeneralStateOf(f, po.branch).general}`);
  // 太歳とは別: 本命の支と同じ支の太歳を与えても、人物側と時間側に別々に持つ
  const t = taiSuiStateOf(pa.branch);
  check("本命の支と同じ太歳でも、人物属性と時間属性として別々に持つ（Person に太歳の項目はない）",
    t.branch === pa.branch && !("taiSui" in findInterpretationPerson(ctx, "A")!) && !("taiSui" in ctx));
}

// ---- 6. 起課・解釈 FACT・ROLE の照合が変わらない ----
{
  const variants: InterpretationContext[] = [
    { domain: "marriage" },
    { domain: "marriage", persons: [a], subjectPersonId: "A" },
    { domain: "marriage", persons: [a, noNatal, { id: "B", natalYear: natalYearStateOf("甲", "子") }], subjectPersonId: "A", counterpartyPersonId: "B" },
    { domain: "marriage", persons: [], counterpartyPersonId: "Q" },
  ];
  let charts = 0, changed = 0, roleDiff = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
    const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: shi, monthGeneral: BRANCHES[o] };
    const chart = calculateLiuren(input);
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    charts += 1;
    if (shi === "子") {
      const ctx = anchorResolutionContextOf(facts);
      const ctxBefore = JSON.stringify(ctx);
      for (const rule of SEMANTIC_ROLE_RULES) {
        const r = resolveAnchor(rule.source, ctx)!;
        const results = variants.map((v) => roleRuleMatches(rule, v, r, facts));
        if (new Set(results).size !== 1) roleDiff += 1;
      }
      if (JSON.stringify(ctx) !== ctxBefore) changed += 1;
    }
    for (const v of variants) void validateInterpretationPersons(v);
    if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
  }
  check("8,640課で、人物入力を変えても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);
  check("720課で、人物入力を変えても本番 registry の ROLE 照合の結果は同じ（ROLE を自動で付けない）", roleDiff === 0, String(roleDiff));
}
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("起課エンジン・InterpretationFacts に人物を入れていない",
    !/persons|PersonContext|InterpretationPerson|natalYear/.test(strip("src/lib/liuren/types.ts") + strip("src/lib/liuren/liurenEngine.ts") + strip("src/lib/liuren/interpretation/facts.ts") +
      readFileSync("src/lib/liuren/interpretation/types.ts", "utf8").split("export interface InterpretationFacts")[1].split("\n}")[0]));
  const person = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8").split("export interface InterpretationPerson")[1].split("}")[0].replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("InterpretationPerson に name・birthDate・gender・age・行年・ROLE・別名・太歳の項目がない",
    !/name|birth|gender|sex|age|xingNian|role|benMing|nianMing|ming|taiSui/i.test(person.replace(/natalYear/g, "")));
  const code = strip("src/lib/liuren/interpretation/personContext.ts");
  const hit = ["heavenOn", "general", "sixRelation", "growth", "yima", "role:", "SemanticRole", "domain ===", "class ", "save", "repository"].filter((w) => code.includes(w));
  check("personContext.ts に盤の計算・ROLE・DOMAIN・永続化がない", hit.length === 0, hit.join(","));
  check("RoleMatcher を変更していない", !/person|Person/.test(readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8")));
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
