// tests/liuren_interpretation_marriage_domain.manual.ts
//
// 六壬神課 Phase 5D（婚姻・男女関係 evaluateMarriageDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_marriage_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』婚姻章 占験一（古典）・増補占例一二（現代の注解者の例）を、三伝一致・天将一致・占断一致に分けて確認する
//   2. 人物と類神: 原典の男女（日・青龍＝男、支・天后＝女）で読み、問う人の側（subjectSide）は添え書きだけ。
//      男女別の規則は subjectSide がなければ判断しない。問う人・相手の人物 ID から類神を決めない
//   3. 問いの区別: proposal（成立）と married（維持・離別）で規則が別。dating・reunion・general は判断せず不足を返す。goal で向きが変わる
//   4. 空亡は旬空だけで読み、坐空は保留として出す
//   5. 720課×subtype×goal で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数や ROLE の割当がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { MARRIAGE_DOMAIN_RULES, MARRIAGE_SIDE, evaluateMarriageDomain } from "../src/lib/liuren/interpretation/marriageDomain";
import { SEMANTIC_ROLE_RULES } from "../src/lib/liuren/interpretation/roleRules";
import { evaluateCareerDomain } from "../src/lib/liuren/interpretation/careerDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { InterpretationContext, InterpretationGoal } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
const seq = (f: ReturnType<typeof factsOf>) => f.transmissions!.map((t) => t.branch).join("");
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const dir = (r: DomainResult, key: string) => reading(r, key)?.direction ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
const marriage = (f: ReturnType<typeof factsOf>, extra: Partial<InterpretationContext>, month: Branch | null = null) =>
  evaluateMarriageDomain(f, { domain: "marriage", ...extra } as InterpretationContext, month);

// ---- 1. 実占例 ----
const caseLines: string[] = [];
{
  // 占験一 己丑五月癸酉日辛酉時（申将）「續弦婚姻成否，蒿矢、退茹，戌亥空…斷曰：占婚必成，成後必有訟。蓋因干支上下相合…支上神又生干上神（支上申生干上子），女願與男連姻」
  const f = factsOf("癸酉", "申", "酉");
  const r = marriage(f, { subtype: "proposal", goal: "acquire", subjectSide: "male" }, "午");
  check("占験一 三伝 未→午→巳（蒿矢・退茹）・空亡 戌亥", seq(f) === "未午巳" && f.sanchuan.status === "determined" && f.sanchuan.pattern === "蒿矢格" && f.xun.voidBranches.join("") === "戌亥");
  check("占験一 支上 申 が干上 子 を生ず（女側が縁を望む）は追い風（原典の判断の根拠と一致）",
    dir(r, "uppersHarmony") === "favoring" && reading(r, "uppersHarmony")!.detected.includes("支上（女側）が干上（男側）を生ず"));
  const sourceGenerals = { 子: "青龍", 午: "天后", 巳: "貴人" } as const;
  const diff = (Object.keys(sourceGenerals) as (keyof typeof sourceGenerals)[]).filter((b) => f.generals.generalOn[b] !== sourceGenerals[b]);
  check("占験一 不一致の記録: 天将が原典と違う（原典 子＝青龍・午＝天后・巳＝貴人）ので、青龍・天后を使う規則は原典と別の支で判定される", diff.length === 3, diff.join(""));
  check("占験一 不一致の記録: 斗罡 辰 が孟（巳）で「礼を尽くしても空しい」が残る（原典は成婚）", dir(r, "tianGang") === "hindering");
  check("占験一 追い風と妨げが併存し、成立を断定しない", r.overview.contradiction);
  caseLines.push(`占験一（古典）｜三伝 一致（未午巳）｜天将 不一致（原典 子青龍・午天后・巳貴人／エンジン ${["子", "午", "巳"].map((b) => `${b}${f.generals.generalOn[b as Branch]}`).join("・")}。原因は未確定・起課は変更しない）｜占断 部分一致：干上支上の生（女が縁を望む）は再現。成婚・訴訟（遁干の暗鬼）は再現しない。斗罡が孟の妨げが残る｜${keys(r)}`);
}
{
  // 増補占例一（現代）戊寅年戌将戊戌日辰時「問與其女友關係如何…返吟課又得回環…三傳皆空不成之象」原典の三伝 亥巳亥
  const f = factsOf("戊戌", "戌", "辰");
  const r = marriage(f, { subtype: "dating" }, "戌");
  check("増補一 不一致の記録: 原典の三伝 亥→巳→亥 に対し、エンジンは " + seq(f), seq(f) !== "亥巳亥" && f.sanchuan.method === "返吟");
  check("増補一 交際（dating）は古典の婚姻門に規則がないので未対応（読みなし・不足を明示）", r.readings.length === 0 && r.missing.some((m) => m.key === "subtype" && m.detail.includes("未対応")));
  caseLines.push(`増補一（現代）｜三伝 不一致（原典 亥巳亥／エンジン ${seq(f)}）｜占断 対象外：交際は未対応`);
}
{
  // 増補占例二（現代）戊寅年未月壬申日申時未将「日辰之上兩鬼相刑…發用空鬼克日，斷其已離」
  const f = factsOf("壬申", "未", "申");
  const r = marriage(f, { subtype: "married", goal: "maintain" }, "未");
  check("増補二 三伝 戌→酉→申", seq(f) === "戌酉申");
  check("増補二 干上 戌 と支上 未 が刑（原典「日辰之上兩鬼相刑」）・発用の官鬼 戌 が旬空（「發用空鬼」）は妨げ",
    dir(r, "uppersDiscord") === "hindering" && reading(r, "uppersDiscord")!.detected.includes("刑") && dir(r, "officerVoidMarried") === "hindering");
  check("増補二 維持を望む問いでは追い風がない・離れたい問い（separate）では同じ読みが追い風に逆転",
    r.overview.favoring.length === 0 && dir(marriage(f, { subtype: "married", goal: "separate" }, "未"), "uppersDiscord") === "favoring");
  check("増補二 「離れる兆し」で、実際の離別（原典「已離」）は断定しない（注記）",
    reading(marriage(f, { subtype: "married", goal: "separate" }, "未"), "uppersDiscord")!.directionNote!.includes("実際の離別を示すものではない"));
  caseLines.push(`増補二（現代）｜三伝 一致（戌酉申）｜天将 一部不一致（原典 酉太常・申玄武／エンジン 酉${f.generals.generalOn["酉"]}・申${f.generals.generalOn["申"]}）｜占断 部分一致：離れる兆し（干上支上の刑・発用の空鬼）は再現。已に離れたこと・大病は再現しない｜${keys(r)}`);
}

// ---- 2. 人物と類神 ----
{
  // 男女の側を持つ読みが出る盤を探す（天后が日干を剋す＝男側に関わる）
  let f = factsOf("癸酉", "申", "酉");
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    if (reading(marriage(g, { subtype: "proposal" }), "empressOvercomesStemProposal")) { f = g; i = 60; break; }
  }
  const male = marriage(f, { subtype: "proposal", subjectSide: "male" }, "午"), female = marriage(f, { subtype: "proposal", subjectSide: "female" }, "午"), none = marriage(f, { subtype: "proposal" }, "午");
  check("問う人の側を変えても、男女の読み（向き）は変わらず、添え書きだけが変わる（天后が日干を剋す＝男側に関わる）",
    keys(male) === keys(female) && reading(male, "empressOvercomesStemProposal")!.detected.includes("この側＝問う人") && reading(female, "empressOvercomesStemProposal")!.detected.includes("この側＝相手"));
  check("問う人の側がなければ添え書きがなく、男女別の規則を判断しない旨を不足に出す",
    !reading(none, "empressOvercomesStemProposal")!.detected.includes("この側") && none.missing.some((m) => m.key === "subjectSide"));
  check("監査: 青龍と天后の乗神は720課すべてで冲（天将の並びが固定）なので、龍后どうしの規則は保留として不足に出す",
    (() => { for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) { const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
      const on = (x: string) => (Object.keys(g.generals.generalOn) as Branch[]).find((b) => g.generals.generalOn[b] === x)!;
      if ((BRANCHES.indexOf(on("青龍")) - BRANCHES.indexOf(on("天后")) + 12) % 12 !== 6) return false; } return true; })() &&
    none.missing.some((m) => m.key === "dragonEmpress") && !MARRIAGE_DOMAIN_RULES.some((r) => /dragon(Helps|Overcomes)Empress|empress(Helps|Overcomes)Dragon|dragonEmpressDiscord|matchmaker$/.test(r.reading.key)));
  // 男女別の規則（夫が占えば財・妻が占えば鬼）は subjectSide がなければ720課のどこでも出ない
  let sideless = 0, withSide = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    if (reading(marriage(g, { subtype: "proposal" }), "wealthOrOfficerVoidProposal")) sideless += 1;
    if (reading(marriage(g, { subtype: "proposal", subjectSide: "male" }), "wealthOrOfficerVoidProposal") || reading(marriage(g, { subtype: "proposal", subjectSide: "female" }), "wealthOrOfficerVoidProposal")) withSide += 1;
  }
  check("男女別の規則は subjectSide がなければ出ず（類神を推測で置き換えない）、あれば出る", sideless === 0 && withSide > 0, `${sideless}/${withSide}`);
  // 人物の ID（問う人・相手の本命）は類神に使わない
  const withPersons = marriage(f, { subtype: "proposal", subjectSide: "male", persons: [{ id: "A", natalYear: natalYearStateOf("甲", "子") }, { id: "B", natalYear: natalYearStateOf("乙", "丑") }], subjectPersonId: "A", counterpartyPersonId: "B" }, "午");
  check("問う人・相手の人物（本命）を指定しても読みは変わらない（本命の規則は未対応）", keys(withPersons) === keys(male) && withPersons.missing.some((m) => m.key === "natalYear"));
  const code = readFileSync("src/lib/liuren/interpretation/marriageDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("婚姻の判断は ROLE（roleRules）・subjectPersonId・counterpartyPersonId を使わない",
    !/roleRules|assignRoles|SemanticRole|subjectPersonId|counterpartyPersonId/.test(code));
  // 婚姻 ROLE は講座 p62 の新郎側・新婦側（問う人・相手に固定しない）
  const mRules = SEMANTIC_ROLE_RULES.filter((r) => r.when.domain === "marriage");
  const roleOf = (index: number) => mRules.filter((r) => r.source.kind === "lesson" && r.source.index === index).map((r) => r.role).join(",");
  check("婚姻 ROLE: 一課＝groomSide・三課＝brideSide・二課四課＝environment、self・counterparty は付けない",
    roleOf(1) === "groomSide" && roleOf(3) === "brideSide" && roleOf(2) === "environment" && roleOf(4) === "environment" &&
    mRules.every((r) => r.role !== "self" && r.role !== "counterparty"), mRules.map((r) => `${r.id}:${r.role}`).join(" "));
  check("新郎側・新婦側の ROLE を使うのは婚姻のルールだけ",
    SEMANTIC_ROLE_RULES.filter((r) => r.role === "groomSide" || r.role === "brideSide").every((r) => r.when.domain === "marriage"));
  check("男女の側を持つルールは、すべて実在するルール", Object.keys(MARRIAGE_SIDE).every((k) => MARRIAGE_DOMAIN_RULES.some((r) => r.reading.key === k)));
}

// ---- 3. 問いの区別・goal ----
{
  const f = factsOf("壬申", "未", "申");
  for (const sub of ["dating", "reunion", "general"] as const) {
    const r = marriage(f, { subtype: sub });
    check(`${sub} は判断せず、不足（subtype）を返す`, r.readings.length === 0 && r.missing.some((m) => m.key === "subtype"));
  }
  check("subtype 未指定も判断しない", marriage(f, {}).readings.length === 0);
  const proposalOnly = MARRIAGE_DOMAIN_RULES.filter((r) => r.when.subtypes?.length === 1 && r.when.subtypes[0] === "proposal").length;
  const marriedOnly = MARRIAGE_DOMAIN_RULES.filter((r) => r.when.subtypes?.length === 1 && r.when.subtypes[0] === "married").length;
  check("成立（proposal）だけ・維持（married）だけのルールがそれぞれある（同じ吉凶規則にしない）", proposalOnly > 0 && marriedOnly > 0, `${proposalOnly}/${marriedOnly}`);
  check("全ルールが proposal か married に限られる（dating・reunion に規則を流用しない）",
    MARRIAGE_DOMAIN_RULES.every((r) => (r.when.subtypes ?? []).length > 0 && r.when.subtypes!.every((s) => s === "proposal" || s === "married")));
  // 同じ盤で 天后が干を剋す: 縁談では「男が娶ろうとしない」、夫婦では「夫が早く亡くなる兆し」（『心鏡』と『指南』で問いが違う）
  let both: [DomainResult, DomainResult] | null = null;
  for (let i = 0; i < 60 && !both; i++) for (let o = 0; o < 12 && !both; o++) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const a = marriage(g, { subtype: "proposal" }), b = marriage(g, { subtype: "married" });
    if (reading(a, "empressOvercomesStemProposal") && reading(b, "empressOvercomesStemMarried")) both = [a, b];
  }
  check("同じ条件（天后が干を剋す）でも、縁談と夫婦で別の読み（出典も別）", !!both &&
    reading(both[0], "empressOvercomesStemProposal")!.citations[0].source === "『六壬心鏡』" && reading(both[1], "empressOvercomesStemMarried")!.citations[0].source === "『大六壬指南』");
  const neutralKeys = MARRIAGE_DOMAIN_RULES.filter((r) => ["stemComesToSite", "yinOverYang", "jiaoTongYiNu", "preMaritalTie"].includes(r.reading.key)).length;
  check("形だけの読み（どちらの家に入るか・誰が誘うか・先に通じる）は向きを決めない", neutralKeys === 4);
}

// ---- 4. 空亡 ----
{
  const code = readFileSync("src/lib/liuren/interpretation/marriageDomain.ts", "utf8");
  const rules = code.slice(code.indexOf("const MARRIAGE_RULES"), code.indexOf("export function evaluateMarriageDomain"));
  check("婚姻のルールは坐空を使わない（旬空だけ）", !rules.includes("isSeatedOnVoid"));
  check("坐空がある盤は保留として不足に出す", marriage(factsOf("壬申", "未", "申"), { subtype: "married" }, "未").missing.some((m) => m.key === "seatedOnVoid"));
}

// ---- 5. 720課・基盤 ----
const goals: (InterpretationGoal | undefined)[] = [undefined, "acquire", "maintain", "separate", "avoid"];
const counts: Record<string, number> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  for (const subtype of ["proposal", "married", "dating", "reunion", "general"] as const) for (const goal of goals) for (const side of [undefined, "male", "female"] as const) {
    const ctx: InterpretationContext = { domain: "marriage", subtype, goal, subjectSide: side };
    try {
      const r = evaluateMarriageDomain(facts, ctx, month);
      evaluated += 1;
      if (JSON.stringify(evaluateMarriageDomain(facts, ctx, month)) !== JSON.stringify(r)) nondeterministic += 1;
      if (goal === undefined && side === "male") for (const x of r.readings) counts[`${subtype}.${x.key}`] = (counts[`${subtype}.${x.key}`] ?? 0) + 1;
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×subtype 5×goal 5×側 3 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 5 * 5 * 3 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
{
  const dead = MARRIAGE_DOMAIN_RULES.filter((r) => !r.when.subtypes!.some((s) => counts[`${s}.${r.reading.key}`])).map((r) => r.reading.key);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』"];
  check("全ルールに出典（取得した3書）・推論レベル・topic がある",
    MARRIAGE_DOMAIN_RULES.every((r) => r.reading.citations.length > 0 && r.reading.citations.every((c) => allowed.includes(c.source)) && !!r.reading.topic && ["direct", "combined", "inferred"].includes(r.reading.level)));
  check("ルール ID が重複しない", new Set(MARRIAGE_DOMAIN_RULES.map((r) => r.id)).size === MARRIAGE_DOMAIN_RULES.length);
  check("増補（現代の注解者の補談）を規則の出典にしない", MARRIAGE_DOMAIN_RULES.every((r) => r.reading.citations.every((c) => !c.quote.includes("补谈") && !c.locator.includes("増補"))));
  const code = readFileSync("src/lib/liuren/interpretation/marriageDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["score", "xingNianOf", "calculateLiuren"].filter((w) => code.includes(w));
  check("点数・行年の計算・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤と既存 FACT（flow・patterns）を使う",
    /evaluateDomainRules\(MARRIAGE_RULES/.test(code) && /buildDomainBoardInput\(/.test(code) && /analyzeTransmissionFlow\(/.test(code) && /detectClassicalPatterns\(/.test(code));
  const r53 = evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", persons: [{ id: "A", natalYear: natalYearStateOf("戊", "辰") }], subjectPersonId: "A" });
  check("仕事・試験の判断は変わらない（例53 の読み）", r53.readings.map((x) => x.key).join() === "finalEmpty,dengSanTian,gateNotPassed,passesDayStem,climbFromChild,natalAtInitial");
}

console.log("実占例（三伝一致・天将一致・占断一致を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("占験一（縁談・男側が問う）の要約:");
console.log(marriage(factsOf("癸酉", "申", "酉"), { subtype: "proposal", goal: "acquire", subjectSide: "male" }, "午").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（goal なし・男側）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${MARRIAGE_DOMAIN_RULES.length}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
