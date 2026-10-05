// tests/liuren_interpretation_career_domain.manual.ts
//
// 六壬神課 Phase 5A（仕事・昇進・試験の DOMAIN 判断 evaluateCareerDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_career_domain.manual.ts
//
//   1. 追加した最小の FACT: 三伝が通り過ぎる支（transmissionPassageOf）・支の両隣（flankingBranchesOf）を全盤で監査
//   2. 『六壬断案２』例43・51・52・53・54 を DOMAIN の結果（読み・向き・軸・推論レベル・要約）まで確認
//   3. 合成した比較: 官鬼が空・空でない／本命あり・なし／太歳あり・なし／文試・武試／仕事・試験／goal で、
//      結論が固定されず、追い風と妨げが両方残り、不足 FACT が明示されること
//   4. 全 work subtype・exam subtype を 720課で評価でき、起課結果・解釈 FACT が変わらない
//   5. ルールに出典・推論レベルがある。点数・固定の吉凶表・行年・UI がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { standingPathComparisonOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { transmissionPassageOf } from "../src/lib/liuren/interpretation/transmissionPassage";
import { flankingBranchesOf, isFlankedBy } from "../src/lib/liuren/interpretation/branchAdjacency";
import { CAREER_DOMAIN_RULES, evaluateCareerDomain } from "../src/lib/liuren/interpretation/careerDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { DomainSubtype, InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const person = (stem: Stem, branch: Branch) => ({ persons: [{ id: "A", natalYear: natalYearStateOf(stem, branch) }], subjectPersonId: "A" });
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");

// ---- 1. 追加した最小の FACT ----
{
  let linear = 0, mismatch = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o], "子");
    const c = standingPathComparisonOf(f);
    if (!c) continue;
    const t = { initial: c.path.initial.branch, middle: c.path.middle.branch, final: c.path.final.branch };
    const p = transmissionPassageOf(t, c.movementPattern);
    const expected = { 進茹: [0, "forward"], 退茹: [0, "reverse"], 進間: [1, "forward"], 退間: [1, "reverse"] }[c.movementPattern as string] as [number, string] | undefined;
    if (!expected) { if (p !== null) mismatch += 1; continue; }
    linear += 1;
    const ok = p !== null && p.direction === expected[1] && p.steps.every((s) => s.passed.length === expected[0]) &&
      p.steps[0].from === t.initial && p.steps[0].to === t.middle && p.steps[1].to === t.final &&
      (expected[0] === 0 || p.steps.every((s) => s.passed[0] === BRANCHES[(BRANCHES.indexOf(s.from) + (p.direction === "forward" ? 1 : 11)) % 12]));
    if (!ok) mismatch += 1;
  }
  check("720課: 通り過ぎる支は movementPattern どおり（進茹・退茹は0支、進間・退間は間の1支、他は null）", linear > 0 && mismatch === 0, `${linear} / ${mismatch}`);
  check("支の両隣は十二支の一つ前・一つ後（12支）", BRANCHES.every((b, k) => flankingBranchesOf(b).join() === `${BRANCHES[(k + 11) % 12]},${BRANCHES[(k + 1) % 12]}`));
  check("辰は卯・巳にはさまれる（例51 の昼夜貴人支）", isFlankedBy("辰", "巳", "卯") && !isFlankedBy("辰", "卯", "午"));
}

// ---- 2. 断例 ----
const lines: string[] = [];
{
  // 例53 丙子日 卯将丑時 占昇遷（戊辰生）
  const r = evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", ...person("戊", "辰") });
  check("例53 登三天（辰午申）は機会の追い風（原文「本来は昇遷の象」）", reading(r, "dengSanTian")?.direction === "favoring" && reading(r, "dengSanTian")?.level === "direct");
  check("例53 関（日支 子）を過ぎない・日干の寄宮 巳 を通り過ぎる・子孫から登って身で止まる・年命が初伝 が流れの妨げ",
    ["gateNotPassed", "passesDayStem", "climbFromChild", "natalAtInitial"].every((k) => reading(r, k)?.direction === "hindering" && reading(r, k)?.axis === "trajectory"));
  check("例53 「初伝＝年命」（IDENTITY）と「辰＝子孫」（六親）は別の読み", reading(r, "natalAtInitial")?.evidence.some((e) => e.fact === "identityLink") === true &&
    reading(r, "climbFromChild")?.evidence.some((e) => e.fact === "sixRelation") === true);
  check("例53 末伝 申 が旬空（しりすぼみ）", reading(r, "finalEmpty")?.direction === "hindering");
  check("例53 追い風と妨げが両方残る（contradiction）", r.overview.contradiction && r.overview.favoring.length === 1);
  check("例53 要約に盤の値（辰・午・申・巳・子）が入る", ["辰", "午", "申", "巳", "子"].every((b) => r.summary.includes(b)) && r.summary.includes("昇進"));
  lines.push(`例53: ${keys(r)}`);
}
{
  // 例52 丁丑日 午将辰時 占前程（己酉年 太歳 酉）
  const r = evaluateCareerDomain(factsOf("丁丑", "午", "辰"), { domain: "work", subtype: "promotion", ...person("甲", "戌"), taiSui: taiSuiStateOf("酉") });
  check("例52 日上に太歳＋朱雀（上申書）は向きを決めない読み", reading(r, "taiSuiPetition")?.direction === "neutral" && reading(r, "taiSuiPetition")?.level === "direct");
  check("例52 官鬼の日貴 亥 が太歳に加わる は妨げ（原文「その書がでたらめ」）", reading(r, "officerNobleOverTaiSui")?.direction === "hindering" && reading(r, "officerNobleOverTaiSui")?.axis === "obstruction");
  check("例52 太歳を authority などの ROLE にしていない（読みは太歳と朱雀・日貴・官鬼の組合せ）", !r.readings.some((x) => /authority|ROLE/.test(JSON.stringify(x))));
  check("例52 干上と初伝が空・官星が坐空 は実現性の妨げ（官星は存在するまま）", reading(r, "bodyAndInitialEmpty")?.direction === "hindering" && reading(r, "officerEmpty")?.direction === "hindering" && reading(r, "officerInTransmissions") !== null);
  check("例52 課伝ともに貴人は、干上が空なので妨げ（貴多きは貴とせず）", reading(r, "nobleAbundance")?.direction === "hindering");
  lines.push(`例52: ${keys(r)}`);
}
{
  // 例51 癸亥日 未将巳時 占科試（戊辰生）
  const r = evaluateCareerDomain(factsOf("癸亥", "未", "巳"), { domain: "exam", subtype: "civil", ...person("戊", "辰") });
  check("例51 昼夜貴人（卯・巳）が年命 辰 をはさむ は後押し（原文「故に必ず及第する」）", reading(r, "natalFlankedByNobles")?.direction === "favoring" && reading(r, "natalFlankedByNobles")?.level === "direct");
  check("例51 発用（初伝 丑）の空亡は試験では向きを決めない（訳注）", reading(r, "initialEmpty")?.direction === "neutral");
  check("例51 日貴が末伝（先に暗く後に明るい）・課伝ともに昼夜貴人 は追い風", reading(r, "dayNobleAtFinal")?.direction === "favoring" && reading(r, "nobleAbundance")?.direction === "favoring");
  check("例51 妨げの読みはない（原文は必ず及第）", r.overview.hindering.length === 0);
  check("例51 行年の読み（行年午上に申）は不足として明示", r.missing.some((m) => m.key === "xingNian"));
  lines.push(`例51: ${keys(r)}`);
}
{
  // 例54 庚辰日 子将子時 占武試（丁巳生）: 文試・武試で向きが変わる
  const f = factsOf("庚辰", "子", "子");
  const mil = evaluateCareerDomain(f, { domain: "exam", subtype: "military", ...person("丁", "巳"), taiSui: taiSuiStateOf("申") });
  const civ = evaluateCareerDomain(f, { domain: "exam", subtype: "civil", ...person("丁", "巳"), taiSui: taiSuiStateOf("申") });
  check("例54 武試: 金（申酉）空亡・太常が入伝しない・虚禄 は妨げ（原文）", ["metalVoid", "taiChangAbsent", "emptySalary"].every((k) => reading(mil, k)?.direction === "hindering"));
  check("例54 官星学堂（末伝 巳＝官鬼・長生）・年命が学堂・朱雀・青龍入廟: 文試は追い風、武試は向きを決めない",
    ["officerStudyHall", "natalOnStudyHall", "suzakuWriting", "qinglongTemple"].every((k) => reading(civ, k)?.direction === "favoring" && reading(mil, k)?.direction === "neutral"));
  check("例54 同じ FACT でも文試・武試で向きが変わる（金の空亡: 武試は妨げ・文試は向きを決めない）", reading(mil, "metalVoid")?.direction === "hindering" && reading(civ, "metalVoid")?.direction === "neutral");
  check("例54 太常の入伝は武試だけの条件", reading(mil, "taiChangAbsent") !== null && reading(civ, "taiChangAbsent") === null);
  check("例54 武試は妨げが多く、文試は追い風が多い", mil.overview.hindering.length > mil.overview.favoring.length && civ.overview.favoring.length > civ.overview.hindering.length);
  lines.push(`例54 武試: ${keys(mil)}`);
  lines.push(`例54 文試: ${keys(civ)}`);
}
{
  // 例43 丁丑日 午将未時 占前程（丁卯生）: 行年の読みは不足、現在の FACT で表せる部分だけ
  const r = evaluateCareerDomain(factsOf("丁丑", "午", "未"), { domain: "work", subtype: "promotion", ...person("丁", "卯") });
  check("例43 日禄扶身（干上 午）は後押し（原文）", reading(r, "salaryOnStanding")?.direction === "favoring" && reading(r, "salaryOnStanding")?.level === "direct");
  check("例43 貴人登天門（亥に貴人）は後押し（訳注）", reading(r, "nobleAtHeavenGate")?.direction === "favoring");
  check("例43 官星（初伝 子・中伝 亥）が三伝に出る", reading(r, "officerInTransmissions")?.detected.includes("子") === true);
  check("例43 「行年ともに白虎」は行年が未実装なので不足として明示", r.missing.some((m) => m.key === "xingNian" && m.detail.includes("例43")));
  check("例43 妨げの読みはない（原文は高位に合格）", r.overview.hindering.length === 0);
  lines.push(`例43: ${keys(r)}`);
}

// ---- 3. 合成した比較 ----
{
  // 官鬼が三伝にあって空・空でない盤を720課から探す
  let empty: DomainResult | null = null, solid: DomainResult | null = null;
  for (let i = 0; i < 60 && !(empty && solid); i++) for (let o = 0; o < 12; o++) {
    const r = evaluateCareerDomain(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o], "子"), { domain: "work", subtype: "promotion" });
    if (reading(r, "officerInTransmissions")) {
      if (reading(r, "officerEmpty") && !empty) empty = r;
      if (!reading(r, "officerEmpty") && !solid) solid = r;
    }
  }
  check("官鬼が空: 存在（機会）は残し、実現性に妨げを足す", !!empty && reading(empty, "officerInTransmissions")?.direction === "favoring" && reading(empty, "officerEmpty")?.direction === "hindering");
  check("官鬼が空でない: 実現性の妨げはない", !!solid && reading(solid, "officerEmpty") === null);
}
{
  const f = factsOf("丙子", "卯", "丑");
  const withNatal = evaluateCareerDomain(f, { domain: "work", subtype: "promotion", ...person("戊", "辰") });
  const noNatal = evaluateCareerDomain(f, { domain: "work", subtype: "promotion" });
  check("本命なし: 年命の読みは出ないが、他の判断（登三天・通り過ぎ・末伝空）は返す", reading(noNatal, "natalAtInitial") === null &&
    ["dengSanTian", "passesDayStem", "finalEmpty"].every((k) => reading(noNatal, k) !== null) && noNatal.missing.some((m) => m.key === "natalYear"));
  check("本命あり・なし で年命の読みだけが違う", withNatal.readings.length === noNatal.readings.length + 1);
  const noPerson = evaluateCareerDomain(f, { domain: "work", subtype: "promotion", persons: [{ id: "A" }], subjectPersonId: "A" });
  check("人物はいるが本命がない: natalYearMissing を不足として明示", noPerson.missing.some((m) => m.key === "natalYear" && m.detail.includes("natalYearMissing")));
}
{
  const f = factsOf("丁丑", "午", "辰");
  const withTaiSui = evaluateCareerDomain(f, { domain: "work", subtype: "promotion", taiSui: taiSuiStateOf("酉") });
  const noTaiSui = evaluateCareerDomain(f, { domain: "work", subtype: "promotion" });
  check("太歳なし: 太歳の読みは出ないが、他の判断は返し、不足として明示",
    reading(noTaiSui, "taiSuiPetition") === null && reading(noTaiSui, "officerNobleOverTaiSui") === null && noTaiSui.readings.length > 0 &&
    noTaiSui.missing.some((m) => m.key === "taiSui") && reading(withTaiSui, "officerNobleOverTaiSui") !== null);
  const exam = evaluateCareerDomain(f, { domain: "exam", subtype: "general" });
  check("同じ盤で 仕事は空亡を妨げ・試験は向きを決めない（官星の空）", reading(noTaiSui, "officerEmpty")?.direction === "hindering" && reading(exam, "officerEmpty")?.direction === "neutral");
  const release = evaluateCareerDomain(f, { domain: "work", subtype: "resignation", goal: "release" });
  check("goal が離れること（release）なら、官星が三伝に出ることを追い風にしない", reading(release, "officerInTransmissions")?.direction === "neutral");
}

// ---- 4. 全 subtype・起課の不変 ----
{
  const subtypes: [InterpretationContext["domain"], DomainSubtype | undefined][] = [
    ...(["currentWork", "employment", "jobChange", "promotion", "transfer", "resignation", "independence"] as const).map((s) => ["work", s] as [InterpretationContext["domain"], DomainSubtype]),
    ["exam", "general"], ["exam", "civil"], ["exam", "military"], ["exam", undefined], ["work", undefined],
  ];
  let evaluated = 0, failed = 0, changed = 0, emptySummary = 0;
  const summaries = new Set<string>();
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子" as Branch, monthGeneral: BRANCHES[o] };
    const chart = calculateLiuren(input);
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    const factsBefore = JSON.stringify(facts);
    for (const [domain, subtype] of subtypes) {
      try {
        const r = evaluateCareerDomain(facts, { domain, subtype, ...person(STEMS[(i + 2) % 10], BRANCHES[(i + 2) % 12]), taiSui: taiSuiStateOf(BRANCHES[o]) } as InterpretationContext);
        evaluated += 1;
        if (!r.summary) emptySummary += 1;
        summaries.add(r.summary);
      } catch { failed += 1; }
    }
    if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
  }
  check("720課×全 work subtype・exam subtype を例外なく評価できる", failed === 0 && evaluated === 720 * subtypes.length, `${evaluated} / ${failed}`);
  check("要約は空でなく、盤ごとに変わる（固定の文ではない）", emptySummary === 0 && summaries.size > 1000, String(summaries.size));
  check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
  let threw = false;
  try { evaluateCareerDomain(factsOf("甲子", "子", "子"), { domain: "marriage" }); } catch { threw = true; }
  check("仕事・試験以外の DOMAIN は受け付けない", threw);
}

// ---- 5. ルール・コード ----
{
  check("全ルールに出典と推論レベルがある", CAREER_DOMAIN_RULES.every((r) => r.reading.citations.length > 0 && ["direct", "combined", "inferred"].includes(r.reading.level)));
  check("ルール ID が重複しない", new Set(CAREER_DOMAIN_RULES.map((r) => r.id)).size === CAREER_DOMAIN_RULES.length);
  const code = ["careerDomain.ts", "domainResult.ts", "transmissionPassage.ts", "branchAdjacency.ts"].map((p) => readFileSync(`src/lib/liuren/interpretation/${p}`, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "")).join("\n");
  const hit = ["score", "points", "必ず昇進", "必ず落第", "xingNianOf", "SemanticRole", "assignRoles"].filter((w) => code.includes(w));
  check("点数・断定・行年の計算・ROLE の割当がない", hit.length === 0, hit.join(","));
  check("起課エンジン・UI を変えていない（DOMAIN は interpretation だけ）", !/careerDomain|evaluateCareerDomain/.test(readFileSync("src/lib/liuren/liurenEngine.ts", "utf8") + readFileSync("src/app/liuren/page.tsx", "utf8")));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log("例53 の要約:");
console.log(evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", ...person("戊", "辰") }).summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`ルール数 ${CAREER_DOMAIN_RULES.length}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
