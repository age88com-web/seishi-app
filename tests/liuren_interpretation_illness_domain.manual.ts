// tests/liuren_interpretation_illness_domain.manual.ts
//
// 六壬神課 Phase 5E（疾病・健康 evaluateIllnessDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_illness_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』疾病章 占験一〜八（古典）・増補課例（現代の注解者の例）を、
//      三伝一致・天将一致・病人の類神・検出した規則・占断一致に分けて確認する（三伝が一致しても占断の一致とはしない）
//   2. 病人の Identity: 日＝病人・辰＝病は盤上の一般的な見方。病人の本命は patientPersonId の人物からだけ取り、
//      問う人の本命を使わない。本人の問い・代理の問いを区別し、代理の問いの類神は targetSymbol で指定する
//   3. 安全な出力: 要約は「古典の読み」と「実際の病状・診断・予後は確定できない」を分け、死亡・余命・治療指示を書かない
//   4. 空亡は旬空だけで読み、坐空は保留。空亡による作用の減少（凶意の軽減）と象意の不存在を区別する
//   5. 720課×goal で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数がない・他の DOMAIN が変わらない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { ILLNESS_DOMAIN_RULES, evaluateIllnessDomain, patientRelationOf } from "../src/lib/liuren/interpretation/illnessDomain";
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
const gens = (f: ReturnType<typeof factsOf>) => f.transmissions!.map((t) => f.generals.generalOn[t.branch]).join("・");
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const dir = (r: DomainResult, key: string) => reading(r, key)?.direction ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
const ill = (f: ReturnType<typeof factsOf>, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateIllnessDomain(f, { domain: "illness", ...extra } as InterpretationContext, month);

// ---- 1. 実占例 ----
// 月将は原典に書かれていないので、原典の三伝が出る月将を720課から求めた（月は原典の月）。天将は原典の三伝の天将と比べる
type Case = { name: string; day: string; shi: Branch; jiang: Branch; month: Branch; seq: string; gens: string; sourceVerdict: string;
  found: string[]; verdict: string; symbol?: string };
const CASES: Case[] = [
  { name: "占験一（古典）", day: "丁亥", shi: "丑", jiang: "午", month: "戌", seq: "巳戌卯", gens: "天空・螣蛇・太常", sourceVerdict: "鑄印。占病不吉（原典は重い判断）",
    found: ["tombIntoTomb"], verdict: "部分一致：病勢側の読み（伝墓入墓・辰が日を剋す）は出るが、原典の根拠（鑄印）は課体の規則が資料にないので再現しない。白虎と日干の相生など回復側の読みも残る" },
  { name: "占験二（古典）", day: "己酉", shi: "辰", jiang: "未", month: "未", seq: "卯午酉", gens: "玄武・天空・六合", sourceVerdict: "当年は妨げなし。ただし医神が日を剋し、木火が虎鬼で体から抜けない",
    found: ["ghostVoid", "ghostInTransmissions"], verdict: "部分一致：発用の官鬼 卯 が旬空（当面は妨げなし）と、伝が鬼の郷に入る（抜けにくい）が併存。医神・数年後の判断は再現しない" },
  { name: "占験三（古典）", day: "己亥", shi: "巳", jiang: "子", month: "寅", seq: "午丑申", gens: "天空・天后・勾陳", sourceVerdict: "目今は憂いなし。ただし禄が絶地に臨み、子巳が相加わる（重い判断）",
    found: ["salaryOnJue", "ziOnSi"], verdict: "部分一致：原典の根拠のうち「禄臨絶地」「子巳相加」を検出し、回復側の読み（白虎の空亡・陰神が虎を制すなど）も残る。「馬入墓郷」「卯臨申」・時期は再現しない" },
  { name: "占験四（古典）", day: "丁未", shi: "卯", jiang: "戌", month: "卯", seq: "酉辰亥", gens: "太陰・青龍・貴人", sourceVerdict: "生気がない（重い判断）。日禄が絶地・驛馬が墓郷・行年・子巳相加・三伝死墓絶",
    found: ["salaryOnJue", "ziOnSi"], verdict: "部分一致：「日禄臨絶地」「子巳相加」を検出。驛馬投墓郷・行年・三伝死墓絶・症状・時期は再現しない" },
  { name: "占験五（古典）", day: "辛亥", shi: "午", jiang: "卯", month: "亥", seq: "巳寅亥", gens: "螣蛇・勾陳・白虎", sourceVerdict: "目今は子が鬼を制して妨げなし。来年初夏を憂う。夫が妻を占って財が空",
    found: ["childrenPresent"], symbol: "寅", verdict: "部分一致：子孫（末伝 亥）が鬼を制す読みは再現。「禄臨絶地」は再現しない（エンジンの日禄 酉 は絶地にない）。妻の類神は原典が財（寅・旬空）で見る。類神の指定は天将・支だけなので、支 寅 を指定したときだけ類神の空亡を検出する" },
  { name: "占験六（古典）", day: "戊申", shi: "未", jiang: "亥", month: "寅", seq: "辰申子", gens: "玄武・青龍・螣蛇", sourceVerdict: "目今は憂いなし。ただし長引く。戊日に玄武の墓が発用（収魂殺）",
    found: [], verdict: "不一致：原典は戊日の墓を辰とする（土の墓＝辰）が、エンジンは土の墓＝戌（確定仕様）。『指南』の収魂は土日に判断せず不足に出す（戌で代用しない）。回復側の読み（支上が白虎を制す・子孫）だけが出る" },
  { name: "占験七（古典）", day: "庚戌", shi: "午", jiang: "午", month: "酉", seq: "申寅巳", gens: "白虎・螣蛇・勾陳", sourceVerdict: "占病に不利（重い判断）。禄馬が発用し、中伝は空絶の郷、末伝 巳 が日を剋す",
    found: ["ghostInTransmissions", "virtueSalaryInitial"], verdict: "部分一致：末伝の官鬼（伝が鬼の郷に入る）は再現。原典の根拠は、申が日禄であり日支の驛馬でもある発用（「病人見驛馬，乃神気出遊象」）・中伝の空絶・玄胎で、驛馬の規則は未対応なので再現しない。『直指』の日徳日禄の発用（空亡でない＝吉）は条件が別の規則として検出され、占験七とは吉凶両説にしない" },
  { name: "占験八（古典）", day: "乙未", shi: "巳", jiang: "午", month: "酉", seq: "酉戌亥", gens: "玄武・太陰・天后", sourceVerdict: "治らない（重い判断）。干支が互いに絶気に乗り、二馬が身宅に臨む",
    found: ["siteUpperOvercomesStem"], verdict: "部分一致：支上 申（乙の絶）が日干を剋す読みは出る。干支互乗絶気・二馬・身が卯に加わる・時期は再現しない" },
  { name: "増補課例（現代）", day: "壬申", shi: "亥", jiang: "酉", month: "巳", seq: "午辰寅", gens: "玄武・天后・螣蛇", sourceVerdict: "宅敗人衰。中伝が墓・末伝が脱、顧祖・退間で不吉。白虎は金神に乗る",
    found: ["retreatInterval"], verdict: "部分一致：退間（逆間伝）は再現。原典は壬日の墓を辰（中伝）とするが、ルールの日墓は辰で同じ。白虎は原典が金神、エンジンは 戌（土）に乗り不一致" },
];
const caseLines: string[] = [];
for (const c of CASES) {
  const f = factsOf(c.day, c.jiang, c.shi);
  const r = ill(f, c.symbol ? { targetSymbol: { kind: "branch", branch: c.symbol as Branch }, persons: [{ id: "Q" }, { id: "P" }], subjectPersonId: "Q", patientPersonId: "P" } : {}, c.month);
  check(`${c.name} 三伝 ${c.seq}（原典と一致）`, seq(f) === c.seq, seq(f));
  for (const k of c.found) check(`${c.name} 規則 ${k} を検出`, !!reading(r, k), keys(r));
  const gMatch = gens(f) === c.gens;
  caseLines.push(`${c.name} ${c.day}日 ${c.shi}時 ${c.jiang}将｜三伝 一致（${seq(f)}）｜天将 ${gMatch ? "一致" : `不一致（原典 ${c.gens}／エンジン ${gens(f)}。原因は未確定・起課は変更しない）`}｜原典 ${c.sourceVerdict}｜${c.verdict}｜${keys(r)}`);
}
{
  const g = (n: number) => { const c = CASES[n]; return gens(factsOf(c.day, c.jiang, c.shi)) === c.gens; };
  check("天将の一致・不一致を記録: 占験二・三・四・六・七は一致、占験一・五・八・増補は不一致", [1, 2, 3, 5, 6].every(g) && [0, 4, 7, 8].every((n) => !g(n)));
  // 占験六: 原典の土の墓（辰）とエンジンの土の墓（戌）の違い
  const c6 = factsOf("戊申", "亥", "未");
  check("占験六 不一致の記録: 発用 辰 に玄武が乗るが、エンジンの戊の日墓は戌。収魂は規則にせず保留とし、土の墓の方式の違いを不足に出す（確定仕様は変えない）",
    c6.generals.generalOn["辰"] === "玄武" && !ILLNESS_DOMAIN_RULES.some((x) => x.reading.key === "xuanOnTomb") &&
    ["xuanOnTomb", "earthStageSystem"].every((k) => ill(c6, {}, "寅").missing.some((m) => m.key === k)));
  {
    // 土日（戊・己）には『指南』の墓・長生の規則（自墓伝生）を出さない（エンジンの戌を『指南』の日墓として使わない）
    let bad = false;
    for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
      const stem = STEMS[i % 10], earth = stem === "戊" || stem === "己";
      const r = ill(factsOf(`${stem}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子"), {}, "寅");
      bad ||= earth ? !!reading(r, "tombToGrowth") || !r.missing.some((m) => m.key === "earthStageSystem") : r.missing.some((m) => m.key === "earthStageSystem");
    }
    check("土日は『指南』の墓・長生の規則（自墓伝生）を判断せず不足に出す。土日以外には不足を出さない", !bad);
    check("規則の引用に占験六（戊日・辰の墓）を使わない", ILLNESS_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => !(c.locator ?? "").includes("占験六"))));
  }
  // 占験七: 『直指』の日徳日禄の発用（空亡でない＝吉）と、占験七の禄馬（驛馬）の発用は条件が別。吉凶両説にしない
  const r7 = ill(factsOf("庚戌", "午", "午"), {}, "酉");
  check("占験七 『直指』の日徳日禄の発用（旬空でない）は吉として検出し、末伝の官鬼（病勢側）と併存する", dir(r7, "virtueSalaryInitial") === "favoring" && dir(r7, "ghostInTransmissions") === "hindering" && r7.overview.contradiction);
  check("日徳日禄の規則の出典は『直指』だけ（占験七の禄馬・驛馬を凶の説として混ぜない）",
    ILLNESS_DOMAIN_RULES.filter((x) => x.reading.key.startsWith("virtueSalary")).every((x) => x.reading.citations.every((c) => c.source === "『御定六壬直指』")));
  // 占験五: 類神（妻）を指定しなければ類神の空亡は判断しない
  const c5 = factsOf("辛亥", "卯", "午");
  check("占験五 代理の問いで類神を指定しなければ類神の空亡は判断せず、不足に出す",
    !reading(ill(c5, { persons: [{ id: "Q" }, { id: "P" }], subjectPersonId: "Q", patientPersonId: "P" }, "亥"), "symbolVoid") &&
    ill(c5, { persons: [{ id: "Q" }, { id: "P" }], subjectPersonId: "Q", patientPersonId: "P" }, "亥").missing.some((m) => m.key === "targetSymbol"));
  check("占験三 原典の「目今無慮」と重い判断の根拠が併存し、一方に決めない", ill(factsOf("己亥", "子", "巳"), {}, "寅").overview.contradiction);
}

// ---- 2. 病人の Identity ----
{
  const f = factsOf("己亥", "子", "巳");
  const A = { id: "A", natalYear: natalYearStateOf("甲", "子") }, B = { id: "B", natalYear: natalYearStateOf("乙", "丑") };
  const selfAsk = ill(f, { persons: [A], subjectPersonId: "A", patientPersonId: "A" }, "寅");
  const proxy = ill(f, { persons: [A, B], subjectPersonId: "A", patientPersonId: "B" }, "寅");
  const askerOnly = ill(f, { persons: [A], subjectPersonId: "A" }, "寅");
  check("本人の問い・代理の問い・未指定を区別する", patientRelationOf({ domain: "illness", subjectPersonId: "A", patientPersonId: "A" }) === "self" &&
    patientRelationOf({ domain: "illness", subjectPersonId: "A", patientPersonId: "B" }) === "proxy" && patientRelationOf({ domain: "illness", subjectPersonId: "A" }) === "unknown");
  check("要約に人物の関係を書く", selfAsk.summary.includes("問う人本人が病人") && proxy.summary.includes("代理の問い") && askerOnly.summary.includes("未指定"));
  check("病人が未指定なら、問う人の本命を病人の本命として使わない（年命の読みなし・不足に明示）",
    askerOnly.readings.every((r) => !r.detected.includes("年命")) && askerOnly.missing.some((m) => m.key === "patientNatalYear" && m.detail.includes("問う人の本命を病人の本命としては使わない")));
  // 年命の読みが出る盤で、病人の本命だけが使われることを確かめる
  let found: { f: ReturnType<typeof factsOf>; natal: Branch } | null = null;
  for (let i = 0; i < 60 && !found; i++) for (let o = 0; o < 12 && !found; o++) for (const nb of BRANCHES as readonly string[]) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const P = { id: "P", natalYear: natalYearStateOf(STEMS[BRANCHES.indexOf(nb as Branch) % 10] as Stem, nb as Branch) };
    if (reading(ill(g, { persons: [P], patientPersonId: "P" }), "nobleOnNatal")) { found = { f: g, natal: nb as Branch }; break; }
  }
  check("病人の年命の読みが出る盤がある", !!found);
  if (found) {
    const P = { id: "P", natalYear: natalYearStateOf(STEMS[BRANCHES.indexOf(found.natal) % 10] as Stem, found.natal) };
    const Q = { id: "Q", natalYear: natalYearStateOf(STEMS[BRANCHES.indexOf(found.natal) % 10] as Stem, found.natal) };
    const asPatient = ill(found.f, { persons: [P], patientPersonId: "P" });
    const asAsker = ill(found.f, { persons: [Q], subjectPersonId: "Q" });
    check("同じ本命でも、病人として指定したときだけ年命の読みが出る（問う人の本命では出ない）", !!reading(asPatient, "nobleOnNatal") && !reading(asAsker, "nobleOnNatal"));
  }
  const code = readFileSync("src/lib/liuren/interpretation/illnessDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("疾病の判断は問う人の本命（subjectNatalBranch・subjectLinks）・ROLE を使わない",
    !/subjectNatalBranch|subjectLinks|roleRules|SemanticRole|counterpartyPersonId/.test(code));
  check("日＝病人・辰＝病は盤上の一般的な見方で、病人の本命・類神と別であることを要約の先頭に書く",
    selfAsk.summary.split("\n")[0].includes("日干＝病人、日支＝病") && selfAsk.summary.split("\n")[0].includes("病人の本命・類神とは別"));
  check("本命がなくても部分判断を返す", askerOnly.readings.length > 0);
}

// ---- 3. 安全な出力 ----
const FORBIDDEN = /死|余命|不治|助からない|亡くな|寿命|服薬|投薬|処方|鍼|灸|手術|治療すべき|受診不要/;
{
  const r = ill(factsOf("己亥", "子", "巳"), {}, "寅");
  const lines = r.summary.split("\n");
  check("要約の先頭は「古典の読み」、末尾は「実際の病状・診断・予後は確定できない」と医療の代わりにしない旨",
    lines[0].startsWith("【古典の読み】") && lines[lines.length - 1].includes("実際の病状・診断・予後は、この占断からは確定できません") && lines[lines.length - 1].includes("医学的な判断や治療の代わりに使わず"));
  check("古典の象意（臓腑）は向きを決めず、医学的な部位の判断ではないと注記",
    dir(r, "classicalOrgan") === "neutral" && reading(r, "classicalOrgan")!.directionNote!.includes("医学的な部位・病名の判断ではない"));
  check("ルールの label に死亡・余命・治療の語がない（古典の「死」は citation の原文にだけ残る）",
    ILLNESS_DOMAIN_RULES.every((x) => !FORBIDDEN.test(x.reading.label)) && ILLNESS_DOMAIN_RULES.some((x) => x.reading.citations.some((c) => c.quote.includes("死"))));
  check("白虎・官鬼があるだけで重いとはしない旨を向きの注記に持つ",
    ILLNESS_DOMAIN_RULES.filter((x) => ["tigerOvercomesStem", "ghostInTransmissions"].includes(x.reading.key)).length === 2 &&
    (() => { for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) { const g = ill(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子"));
      const a = reading(g, "tigerOvercomesStem"); if (a) return a.directionNote!.includes("白虎があるだけで重いとはしない"); } return false; })());
  check("古典の医・薬・鍼灸・祭祀のルールがない（扱わない旨を不足に出す）",
    !ILLNESS_DOMAIN_RULES.some((x) => /医|薬|丸散|针|鍼|灸|祭|祟/.test(x.reading.label)) && r.missing.some((m) => m.key === "medical"));
}

// ---- 4. 空亡 ----
{
  const code = readFileSync("src/lib/liuren/interpretation/illnessDomain.ts", "utf8");
  const rules = code.slice(code.indexOf("const ILLNESS_RULES"), code.indexOf("function patientNatalOf"));
  check("疾病のルールは坐空を使わない（旬空だけ）", !rules.includes("isSeatedOnVoid"));
  let seatedShown = false;
  for (let i = 0; i < 60 && !seatedShown; i++) for (let o = 0; o < 12 && !seatedShown; o++)
    seatedShown = ill(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子")).missing.some((m) => m.key === "seatedOnVoid");
  check("坐空がある盤は保留として不足に出す", seatedShown);
  check("空亡による凶意の軽減（白虎の空亡・日干を剋す神の空亡）は「積極的な吉ではない」と注記し、作用の減少として扱う",
    ["tigerVoid", "ghostVoid"].every((k) => ILLNESS_DOMAIN_RULES.find((x) => x.reading.key === k)!.reading.axis === "actualization") &&
    dir(ill(factsOf("己亥", "子", "巳"), {}, "寅"), "tigerVoid") === "favoring" && reading(ill(factsOf("己亥", "子", "巳"), {}, "寅"), "tigerVoid")!.directionNote!.includes("積極的な吉ではない"));
  {
    // 『直指』吉「日德日禄发用而不空亡」・凶「日德日禄发用及加年命而俱值空亡」（発用と年命の両方）
    let fav = false, voidOnly = true, bothHin = false, bothSeen = false, natalOnly = true;
    for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
      const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
      const d = dir(ill(f), "virtueSalaryInitial");
      if (d === "favoring") fav = true;
      if (d === "hindering") voidOnly = false;
      if (d === "neutral") {
        const natal = f.plate.earthUnder[ill(f).readings.find((x) => x.key === "virtueSalaryInitial")!.detected.match(/初伝 (.)/)![1] as Branch];
        const r = ill(f, { persons: [{ id: "P", natalYear: natalYearStateOf(BRANCHES.indexOf(natal) % 2 === 0 ? "甲" : "乙", natal) }], patientPersonId: "P" });
        bothSeen = true; bothHin ||= dir(r, "virtueSalaryInitial") === "hindering";
        if (reading(r, "virtueSalaryOnNatalVoid")) natalOnly = false;
      }
    }
    check("日徳日禄の発用は、旬空でなければ吉。発用だけが旬空なら凶としない（neutral）。病人の年命の上も旬空なら凶（『直指』の「俱」）",
      fav && voidOnly && bothSeen && bothHin && natalOnly);
  }
}

// ---- 5. 720課・基盤 ----
const goals: (InterpretationGoal | undefined)[] = [undefined, "recover", "maintain", "avoid"];
const counts: Record<string, number> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0, unsafe = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  const nb = BRANCHES[(i * 5 + o) % 12] as Branch;
  const P = { id: "P", natalYear: natalYearStateOf(STEMS[(i + o) % 10] as Stem, nb) };
  const ctxs: InterpretationContext[] = [];
  for (const goal of goals) for (const m of [0, 1, 2]) ctxs.push({ domain: "illness", goal,
    ...(m >= 1 ? { persons: [P, { id: "Q" }], patientPersonId: "P", subjectPersonId: m === 1 ? "P" : "Q", xingNianInputs: [{ personId: "P", sex: "male" as const, reckonedAge: ((i * 7 + o * 5) % 72) + 1 }] } : {}),
    ...(m === 2 ? { targetSymbol: { kind: "general", general: "天后" } } : {}) });
  for (const ctx of ctxs) for (const mb of [month, null]) {
    try {
      const r = evaluateIllnessDomain(facts, ctx, mb);
      evaluated += 1;
      if (JSON.stringify(evaluateIllnessDomain(facts, ctx, mb)) !== JSON.stringify(r)) nondeterministic += 1;
      if (FORBIDDEN.test(r.summary)) unsafe += 1;
      if (ctx.goal === undefined && mb) for (const x of r.readings) counts[x.key] = (counts[x.key] ?? 0) + 1;
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×goal 4×人物3×月支有無 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 4 * 3 * 2 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("720課のすべての要約に死亡・余命・治療指示の語がない", unsafe === 0, `${unsafe}`);
{
  const r = ill(factsOf("己亥", "子", "巳"), { goal: "avoid" }, "寅"), r0 = ill(factsOf("己亥", "子", "巳"), {}, "寅");
  check("goal で向きを反転しない（不足に明示）", keys(r) === keys(r0) && r.missing.some((m) => m.key === "goal"));
  check("月支がなければ旺相を使う読みは出さず、不足に出す",
    ill(factsOf("己亥", "子", "巳")).readings.every((x) => !["stemStrong", "ghostTombInitial", "nobleControlsTiger", "bathWater"].includes(x.key)) && ill(factsOf("己亥", "子", "巳")).missing.some((m) => m.key === "monthBranch"));
  const dead = ILLNESS_DOMAIN_RULES.filter((x) => !counts[x.reading.key]).map((x) => x.reading.key);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const always = ILLNESS_DOMAIN_RULES.filter((x) => x.reading.key !== "classicalOrgan" && (counts[x.reading.key] ?? 0) >= 720 * 3).map((x) => x.reading.key);
  check("象意（臓腑）以外に、すべての盤で成立するルールがない", always.length === 0, always.join(","));
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』", "『六壬神課講座』"];
  check("全ルールに出典（取得した4書と講座）・推論レベル・topic がある",
    ILLNESS_DOMAIN_RULES.every((x) => x.reading.citations.length > 0 && x.reading.citations.every((c) => allowed.includes(c.source)) && !!x.reading.topic && ["direct", "combined", "inferred"].includes(x.reading.level)));
  check("講座の引用は layer＝講座、漢籍は原文・注で区別する",
    ILLNESS_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => (c.source === "『六壬神課講座』") === (c.layer === "講座") && (c.source === "『六壬神課講座』" || c.layer === "原文" || c.layer === "注"))));
  check("ルール ID が重複しない", new Set(ILLNESS_DOMAIN_RULES.map((x) => x.id)).size === ILLNESS_DOMAIN_RULES.length);
  check("増補（現代の注解者の例）を規則の出典にしない", ILLNESS_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => !c.locator.includes("増補"))));
  const code = readFileSync("src/lib/liuren/interpretation/illnessDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["score", "xingNianOf", "calculateLiuren"].filter((w) => code.includes(w));
  check("点数・行年の計算・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤を使う", /evaluateDomainRules\(ILLNESS_RULES/.test(code) && /buildDomainBoardInput\(/.test(code) && /summarizeDomainReadings\(/.test(code));
  const r53 = evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", persons: [{ id: "A", natalYear: natalYearStateOf("戊", "辰") }], subjectPersonId: "A" });
  check("仕事・試験の判断は変わらない（例53 の読み）", r53.readings.map((x) => x.key).join() === "finalEmpty,dengSanTian,gateNotPassed,passesDayStem,climbFromChild,natalAtInitial");
}

console.log("実占例（三伝・天将・検出した規則・占断を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("占験三（月支 寅）の要約:");
console.log(ill(factsOf("己亥", "子", "巳"), {}, "寅").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（goal なし・人物3通り・月支あり）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${ILLNESS_DOMAIN_RULES.length}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
