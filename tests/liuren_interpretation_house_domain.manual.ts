// tests/liuren_interpretation_house_domain.manual.ts
//
// 六壬神課 Phase 5B（家宅の DOMAIN 判断 evaluateHouseDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_house_domain.manual.ts
//
//   1. 断例: 『六壬断案２』例42・32・41、『六壬断案』例21（支来干上）・23・16・5（干来支上）・4（贅婿課・太歳が宅に入る）・
//      3・11（三伝を通した生の流れ）・9（支上が空・中伝に長生）・18・20 を、読み（topic・軸・向き・推論レベル）と要約まで確認
//   2. 合成した比較: 干支の生剋の向き（宅→人・人→宅の生・剋、比和）・支来干上／干来支上の有無・本命の有無とつながり・
//      発用の空・goal（maintain・move・release）で、一つの固定の吉凶に落ちないこと
//   3. 720課×subtype×goal で例外がなく決定的。読みの発生数を出す。8,640課で起課結果・解釈 FACT が変わらない
//   4. Phase 5A の DOMAIN 基盤をそのまま使い、風水・点数・行年の計算・ROLE の割当がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { HOUSE_DOMAIN_RULES, evaluateHouseDomain } from "../src/lib/liuren/interpretation/houseDomain";
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
const person = (stem: Stem, branch: Branch) => ({ persons: [{ id: "A", natalYear: natalYearStateOf(stem, branch) }], subjectPersonId: "A" });
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
const house = (f: ReturnType<typeof factsOf>, extra: Partial<InterpretationContext> = {}) =>
  evaluateHouseDomain(f, { domain: "house", subtype: "residence", ...extra } as InterpretationContext);

// ---- 1. 断例 ----
const lines: string[] = [];
{
  // 断案2 例42 甲寅日 未将寅時 占宅（辛未生）
  const f = factsOf("甲寅", "未", "寅");
  const r = house(f, { goal: "maintain", ...person("辛", "未") });
  check("例42 本命 未 が干上で甲の墓（天網自裏）は人の妨げ（原文）", reading(r, "natalTombAtStanding")?.direction === "hindering" && reading(r, "natalTombAtStanding")?.level === "direct" && reading(r, "natalTombAtStanding")?.topic === "person");
  check("例42 本命上（子）が発用で旬空・中伝 巳 坐空は、星運不利の妨げ（原文「きっと星運は不利」。空を追い風にしない）",
    reading(r, "natalUpperInitialEmpty")?.direction === "hindering" && reading(r, "natalUpperInitialEmpty")?.detected.includes("中伝 巳") === true);
  check("例42 干上 未 は日干の墓（遅滞）も別の読みで残る", reading(r, "stemUpperTomb")?.direction === "hindering");
  check("例42 発用 子 と支上 未 の六害（訳注「家族の体調不良」）", reading(r, "initialHarmsSiteUpper")?.citations.some((c) => c.locator === "例42") === true);
  check("例42 住み続ける（maintain）では天網自裏は妨げで、追い風の読みはない", r.overview.favoring.length === 0 && r.overview.hindering.length >= 3);
  const moveR = house(f, { goal: "move", ...person("辛", "未") });
  check("例42 離れる（move）でも天網自裏を追い風にしない（引越しで凶を免れたのは事後経過）、空の妨げは残る",
    reading(moveR, "natalTombAtStanding")?.direction === "neutral" && reading(moveR, "natalUpperInitialEmpty")?.direction === "hindering" && moveR.overview.favoring.length === 0);
  check("例42 「干支上神は空亡」（訳注）は盤と不一致: 干上・支上 未 は空ではなく、干支上神ともに空の読みは出ない",
    !reading(r, "bothUppersEmpty") && reading(r, "stemUpperTomb")?.detected.includes("未") === true);
  lines.push(`断案2 例42（move）: ${keys(moveR)}`);
  const noNatal = house(f, { goal: "maintain" });
  check("例42 本命なし: 本命の読みは出ないが、干上の墓などの家宅判断は返す", !reading(noNatal, "natalTombAtStanding") && !reading(noNatal, "natalUpperInitialEmpty") &&
    !!reading(noNatal, "stemUpperTomb") && noNatal.missing.some((m) => m.key === "natalYear"));
  const otherNatal = house(f, { goal: "maintain", ...person("甲", "子") });
  check("例42 本命が干上とつながらない人物（甲子生）では、天網自裏の読みは出ない", !reading(otherNatal, "natalTombAtStanding"));
  lines.push(`断案2 例42: ${keys(r)}`);
}
{
  // 断案2 例32 戊申日 巳将卯時 占家宅
  const r = house(factsOf("戊申", "巳", "卯"));
  check("例32 宅上 戌 の兄弟・玄武は「家族」の読み（家そのものの読みと分ける）", reading(r, "siteUpperSiblingXuanwu")?.topic === "family" && reading(r, "siteUpperSiblingXuanwu")?.direction === "hindering");
  check("例32 財庫 辰 が末伝で坐空は「財」の読み（原文「財はもはやない」）", reading(r, "wealthVaultEmpty")?.topic === "wealth" && reading(r, "wealthVaultEmpty")?.detected.includes("辰") === true);
  check("例32 身の上（干上 未）に親族・天空は「家族」の妨げ（訳注「親族が徐々に減る」）", reading(r, "standingSiblingTianKong")?.topic === "family" && reading(r, "standingSiblingTianKong")?.direction === "hindering");
  check("例32 宅上 戌 玄武の陰神 子（四課）が発用は「家族」の妨げ（原文「子孫が賊」）", reading(r, "initialXuanwuShadow")?.topic === "family" && reading(r, "initialXuanwuShadow")?.detected.includes("子") === true);
  check("例32 家族・財の読みは要約で家そのものの読みと混ざらない（人と宅の関係の行は干支の生剋だけ）", r.summary.split("\n")[0].startsWith("人と宅の関係:") && !r.summary.split("\n")[0].includes("玄武"));
  check("例32 行年（「行年上には破敗」）は不足として明示", r.missing.some((m) => m.key === "xingNian" && m.detail.includes("例32")));
  lines.push(`断案2 例32: ${keys(r)}`);
}
{
  const r = house(factsOf("戊申", "未", "酉"));
  check("例41 日上神 卯 が日干を剋し、支上 午 が日支 申 を剋す", reading(r, "stemUpperOvercomesStem")?.direction === "hindering" && reading(r, "siteUpperOvercomesBranch")?.direction === "hindering");
  lines.push(`断案2 例41: ${keys(r)}`);
}
{
  // 断案 例21 乙酉日 申将卯時「支が干に加わり、上門乱首課…支が干を剋し…凶課」
  const r = house(factsOf("乙酉", "申", "卯"));
  check("断案 例21 支来干上（日支 酉 が干上）は構造の読み（向きは決めない）", reading(r, "branchComesToStem")?.direction === "neutral" && reading(r, "branchComesToStem")?.topic === "relation");
  check("断案 例21 宅が人を剋す（酉金→乙木）は妨げ（原文「凶課」）", reading(r, "houseOvercomesPerson")?.direction === "hindering");
  check("断案 例21 要約の先頭に「人と宅の関係」", r.summary.startsWith("人と宅の関係:") && r.summary.includes("酉"));
  lines.push(`断案 例21: ${keys(r)}`);
}
{
  // 断案 例23 乙未日 戌将丑時「人が来て宅に就く、まさに新宅の課」/ 例5 辛巳日「日干は日支上にある」
  const moving = evaluateHouseDomain(factsOf("乙未", "戌", "丑"), { domain: "house", subtype: "moving" });
  const residence = house(factsOf("乙未", "戌", "丑"), { goal: "maintain" });
  check("断案 例23 干来支上（寄宮 辰 が支上）: 転居（新宅）では追い風、今の住居では向きを決めない",
    reading(moving, "stemComesToBranch")?.direction === "favoring" && reading(residence, "stemComesToBranch")?.direction === "neutral");
  check("断案 例5 も干来支上（寄宮 戌 が支上）", !!reading(house(factsOf("辛巳", "辰", "亥")), "stemComesToBranch"));
  lines.push(`断案 例23（moving）: ${keys(moving)}`);
}
{
  // 断案 例16 戊子日 戌将巳時「宅上が発用であり、日上が中伝…宅に多くの人が居られず出る」
  const f = factsOf("戊子", "戌", "巳");
  const maintain = house(f, { goal: "maintain" }), release = house(f, { goal: "release" });
  check("断案 例16 同じ構造（宅上発用・日上中伝）でも、住み続けたい（maintain）は妨げ・離れたい（release）は追い風",
    reading(maintain, "personLeaves")?.direction === "hindering" && reading(release, "personLeaves")?.direction === "favoring");
  check("断案 例16 人が宅を剋す（宅は人を剋さない）は構造の読み", reading(maintain, "personOvercomesHouse")?.direction === "neutral" && !reading(maintain, "houseOvercomesPerson"));
  lines.push(`断案 例16（maintain）: ${keys(maintain)}`);
  lines.push(`断案 例16（release）: ${keys(release)}`);
}
{
  // 断案 例4 辛卯日 子将未時 戊申年「この課は干が支を制する。贅婿課…太歳が宅に入り宅を剋する」
  const f = factsOf("辛卯", "子", "未");
  const r = house(f, { taiSui: taiSuiStateOf("申") });
  check("断案 例4 干が支を制す（贅婿課）・太歳 申 が宅上にあり日支を剋す", !!reading(r, "personOvercomesHouse") && reading(r, "taiSuiEntersHouse")?.direction === "hindering");
  check("断案 例4 太歳なしなら太歳の読みは出ず、他の読みは返す", !reading(house(f), "taiSuiEntersHouse") && !!reading(house(f), "personOvercomesHouse"));
  lines.push(`断案 例4: ${keys(r)}`);
}
{
  const r3 = house(factsOf("庚寅", "辰", "未"));
  check("断案 例3 日干→末伝→日支 の生: 家に利（house・追い風）と人に利なし（person・妨げ）を別の読みで持つ",
    reading(r3, "flowToHouse.house")?.direction === "favoring" && reading(r3, "flowToHouse.person")?.direction === "hindering" &&
    reading(r3, "flowToHouse.house")?.topic === "house" && reading(r3, "flowToHouse.person")?.topic === "person");
  const r11 = house(factsOf("癸丑", "巳", "丑"));
  check("断案 例11 三伝の金局: 人が興る（person・追い風）と宅が狭い（house・妨げ）", reading(r11, "flowToPerson.person")?.direction === "favoring" && reading(r11, "flowToPerson.house")?.direction === "hindering");
  const r9 = evaluateHouseDomain(factsOf("庚寅", "寅", "酉"), { domain: "house", subtype: "moving" });
  check("断案 例9 支上 未 が空（宅が得られていない）は新宅の妨げ・中伝 巳 の長生は新宅の追い風",
    reading(r9, "siteUpperEmpty")?.direction === "hindering" && reading(r9, "middleLongLife")?.direction === "favoring");
  const r18 = house(factsOf("癸巳", "戌", "未"));
  check("断案 例18 日上 辰 が墓（遅滞）・宅上 申 が長生で宅と合", reading(r18, "stemUpperTomb")?.direction === "hindering" &&
    reading(r18, "siteUpperLongLife")?.direction === "favoring" && reading(r18, "siteUpperCombinesBranch")?.direction === "favoring");
  const r20 = house(factsOf("辛卯", "午", "辰"));
  check("断案 例20 日上 子 が盗気・宅上から発して中末伝が空", reading(r20, "stemUpperDrains")?.direction === "hindering" && reading(r20, "siteFirstThenEmpty")?.direction === "hindering");
  lines.push(`断案 例3: ${keys(r3)}`, `断案 例11: ${keys(r11)}`, `断案 例9（moving）: ${keys(r9)}`, `断案 例18: ${keys(r18)}`, `断案 例20: ${keys(r20)}`);
}

// ---- 2. 合成した比較 ----
const RELATION_KEYS = ["houseOvercomesPerson", "personOvercomesHouse", "personGeneratesHouse", "houseGeneratesPerson", "personHouseSame"];
const relationSeen: Record<string, number> = {};
let relationExclusive = true, withBranchToStem = 0, withoutBranchToStem = 0, withStemToBranch = 0, withoutStemToBranch = 0;
const goals: (InterpretationGoal | undefined)[] = [undefined, "maintain", "move", "release", "acquire"];
const counts: Record<string, number> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const input = { dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子" as Branch, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  for (const subtype of ["residence", "moving"] as const) for (const goal of goals) {
    const ctx: InterpretationContext = { domain: "house", subtype, goal, ...person(STEMS[(i + 5) % 10], BRANCHES[(i + 5) % 12]), taiSui: taiSuiStateOf(BRANCHES[(i + o) % 12]) };
    try {
      const r = evaluateHouseDomain(facts, ctx);
      evaluated += 1;
      if (JSON.stringify(evaluateHouseDomain(facts, ctx)) !== JSON.stringify(r)) nondeterministic += 1;
      if (subtype === "residence" && goal === undefined) {
        for (const x of r.readings) counts[x.key] = (counts[x.key] ?? 0) + 1;
        const rel = RELATION_KEYS.filter((k) => reading(r, k));
        if (rel.length !== 1) relationExclusive = false;
        for (const k of rel) relationSeen[k] = (relationSeen[k] ?? 0) + 1;
        if (reading(r, "branchComesToStem")) withBranchToStem += 1; else withoutBranchToStem += 1;
        if (reading(r, "stemComesToBranch")) withStemToBranch += 1; else withoutStemToBranch += 1;
      }
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("干支の生剋（宅→人の剋・人→宅の剋・人→宅の生・宅→人の生・比和）は各課で必ず1つで、5種類すべてが現れる",
  relationExclusive && RELATION_KEYS.every((k) => (relationSeen[k] ?? 0) > 0), JSON.stringify(relationSeen));
check("支来干上・干来支上 は ある課・ない課 の両方がある", withBranchToStem > 0 && withoutBranchToStem > 0 && withStemToBranch > 0 && withoutStemToBranch > 0,
  `${withBranchToStem}/${withoutBranchToStem} ${withStemToBranch}/${withoutStemToBranch}`);
check("宅が人を剋すは妨げ・他の生剋は向きを決めない（固定の吉凶にしない）",
  HOUSE_DOMAIN_RULES.filter((r) => RELATION_KEYS.includes(r.reading.key)).every((r) => r.reading.key === "houseOvercomesPerson" ? r.reading.axis === "obstruction" : r.reading.axis === "relation"));
{
  // 発用の空・非空: 本命の上が初伝でつながる課から、初伝が空の課と空でない課を探す
  let empty: DomainResult | null = null, solid: DomainResult | null = null;
  for (let i = 0; i < 60 && !(empty && solid); i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o], "子");
    const natal = f.plate.earthUnder[f.transmissions![0].branch]; // その支の上が初伝になる本命
    const stem = STEMS.find((s) => (STEMS.indexOf(s) - BRANCHES.indexOf(natal)) % 2 === 0)!;
    const r = house(f, person(stem as Stem, natal));
    const isVoid = f.transmissions![0].isVoid;
    if (isVoid && !empty) empty = r;
    if (!isVoid && !solid && !r.readings.some((x) => x.key === "natalUpperInitialEmpty")) solid = r;
  }
  check("本命上が発用: 初伝が空なら「凶意が実現しにくい」の読み、空でなければその読みは出ない", !!reading(empty!, "natalUpperInitialEmpty") && !!solid && !reading(solid, "natalUpperInitialEmpty"));
}
{
  // goal: 同じ盤（断案 例16）で maintain・move・release の向き
  const f = factsOf("戊子", "戌", "巳");
  const dirs = (["maintain", "move", "release"] as const).map((g) => reading(house(f, { goal: g }), "personLeaves")?.direction);
  check("goal maintain・move・release で「人が宅から出る流れ」の向きが変わる（妨げ・追い風・追い風）", dirs.join() === "hindering,favoring,favoring", dirs.join());
}
check("720課×subtype 2×goal 5 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 2 * 5 && threw === 0 && nondeterministic === 0, `${evaluated} / ${threw} / ${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
{
  let threwOther = false;
  try { evaluateHouseDomain(factsOf("甲子", "子", "子"), { domain: "work" }); } catch { threwOther = true; }
  check("家宅以外の DOMAIN は受け付けない", threwOther);
}

// ---- 4. 基盤・コード ----
{
  check("全ルールに出典と推論レベル・topic がある", HOUSE_DOMAIN_RULES.every((r) => r.reading.citations.length > 0 && !!r.reading.topic && ["direct", "combined", "inferred"].includes(r.reading.level)));
  check("ルール ID が重複しない", new Set(HOUSE_DOMAIN_RULES.map((r) => r.id)).size === HOUSE_DOMAIN_RULES.length);
  const code = readFileSync("src/lib/liuren/interpretation/houseDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["坐向", "玄空", "飛星", "巒頭", "水法", "道路", "score", "xingNianOf", "SemanticRole", "assignRoles", "evaluateDomainRules = "].filter((w) => code.includes(w));
  check("houseDomain.ts に風水・点数・行年の計算・ROLE の割当・独自の DOMAIN 基盤がない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤（evaluateDomainRules・summarizeDomainReadings・buildDomainBoardInput）を使う",
    /evaluateDomainRules\(HOUSE_RULES/.test(code) && /summarizeDomainReadings\(/.test(code) && /buildDomainBoardInput\(/.test(code));
  // 仕事・試験の結果は Phase 5A と同じ（共通部分の切り出しで変わらない）
  const r53 = evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", ...person("戊", "辰") });
  check("仕事・試験の判断は変わらない（例53 の読み）", r53.readings.map((x) => x.key).join() === "finalEmpty,dengSanTian,gateNotPassed,passesDayStem,climbFromChild,natalAtInitial");
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log("断案2 例42 の要約:");
console.log(house(factsOf("甲寅", "未", "寅"), { goal: "maintain", ...person("辛", "未") }).summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（residence・goal なし）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" ／ ")}`);
console.log(`干支の生剋: ${JSON.stringify(relationSeen)} ／ 支来干上 ${withBranchToStem} ／ 干来支上 ${withStemToBranch}`);
console.log(`ルール数 ${HOUSE_DOMAIN_RULES.length}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
