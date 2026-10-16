// tests/liuren_interpretation_wealth_domain.manual.ts
//
// 六壬神課 Phase 5F（求財・財物 evaluateWealthDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_wealth_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』求財章の増補課例2件（現代の注解者の例。古典占験ではない）を、四課・三伝・天将・財の類神・
//      検出した規則・原典の占断・記録された結果に分けて確認する（三伝が一致しても占断の一致とはしない）。
//      『六壬大全』の「財受夾克」の例（規則の出典そのもの）は、規則が出典の盤で成立するかの確認で、独立した検証とは呼ばない
//   2. 占的: 求財・売買・索債は別の規則表。貸借・保持・未指定は判断せず不足を返す
//   3. 段階: 財の象意・機会・取得・保持・取引の成立・物の貴賤・利益を分け、象意だけで取得としない
//   4. 人物: 財を求める人の本命は wealthSeekerPersonId からだけ取る。売買の側（tradeSide）・物の類神（targetSymbol）は推測しない。
//      売る側と買う側で向きが逆になる読みは、読みを変えずに向きだけを変える
//   5. 空亡は旬空だけで読み、坐空は保留。金額・成立日を出さない
//   6. 720課×占的×側で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数がない・他の DOMAIN が変わらない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { WEALTH_DOMAIN_RULES, evaluateWealthDomain, seekerRelationOf } from "../src/lib/liuren/interpretation/wealthDomain";
import { evaluateCareerDomain } from "../src/lib/liuren/interpretation/careerDomain";
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
type F = ReturnType<typeof factsOf>;
const seq = (f: F) => f.transmissions!.map((t) => t.branch).join("");
const lessons = (f: F) => f.lessons.map((l) => `${l.upper}${l.index === 1 ? f.basic.dayStem : l.lowerBranch}`).join(" ");
const gens = (f: F) => f.transmissions!.map((t) => f.generals.generalOn[t.branch]).join("・");
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const dir = (r: DomainResult, key: string) => reading(r, key)?.direction ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
const wealth = (f: F, subtype: DomainSubtype<"wealth">, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateWealthDomain(f, { domain: "wealth", subtype, ...extra } as InterpretationContext, month);
const SEEK_KEYS = new Set(WEALTH_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes("seekingWealth")).map((x) => x.reading.key));
const TRADE_KEYS = new Set(WEALTH_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes("trading")).map((x) => x.reading.key));
const DEBT_KEYS = new Set(WEALTH_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes("debtCollection")).map((x) => x.reading.key));

// ---- 1. 実占例 ----
// 四課は「上神＋下（一課は日干）」で、原典の課式の上段・下段を右から読んだもの
type Case = { name: string; day: string; shi: Branch; jiang: Branch; month: Branch; lessons: string; seq: string; gens: string; wealth: string;
  question: string; sourceVerdict: string; outcome: string; found: string[]; verdict: string; proxy?: boolean };
const CASES: Case[] = [
  { name: "増補占例一（現代）", day: "甲戌", shi: "亥", jiang: "未", month: "未", lessons: "戌甲 午戌 午戌 寅午", seq: "戌午寅", gens: "六合・天后・白虎", wealth: "初伝 戌（原典「財甲戌」）",
    question: "兄の代わりに、購入した貨物で利を得られるか（代理の問い）", proxy: true,
    sourceVerdict: "「干財傳助號還魂」で必ず利を得る。ただし初財が夾克に遭うので損傷がある・六合が財を剋して仲介者も取る",
    outcome: "五千元で成交、工商所と仲介者に八百余元を払い、実得は四千元余り",
    found: ["wealthInitialOrFinal", "wealthOnStemOrSite", "pinchedAcquire", "pinchedRetention"],
    verdict: "部分一致：財の発用・財が干に臨む（得やすい）と、夾克（費える）は原典の判断・結果（成交したが一部を失う）に対応する。ただし『大全』卷九の「終不可得」（夾克）は、成交した結果と対応しない。注解者の「初財遭夾克」と規則（『大全』の夾克）は同じ概念なので、独立した検証ではない。還魂（干財傳助）は資料で条件が確定しないので保留" },
  { name: "増補占例二（現代）", day: "乙巳", shi: "巳", jiang: "午", month: "未", lessons: "巳乙 午巳 午巳 未午", seq: "未申酉", gens: "白虎・太常・玄武", wealth: "初伝 未（原典「財未」）",
    question: "近頃の財運（本人の問い）",
    sourceVerdict: "発用の財に白虎（銭財だが驚き憂え奔走）。五月に大財、六月は財が来て去る、七月に末伝の鬼に玄武で大きく破財",
    outcome: "五月に大きく得た。六月は飲み食い。七月に妻の異動のため四千元を使ったが成らなかった",
    found: ["wealthInitialOrFinal", "wealthFromLesson34", "tombAsWealth"],
    verdict: "部分一致：財の発用（得やすい）・四課からの発用で財（講座 p62）は、原典の「大財」・結果（五月に得た）に対応する。墓神作財（『直指』）は原典の判断にない。原典の破財（末伝の鬼に玄武）は『指南』の「玄武防失」の位置が確定しないので保留で、保持の段階は読みがない。月ごとの時期は扱わない" },
];
const caseLines: string[] = [];
for (const c of CASES) {
  const f = factsOf(c.day, c.jiang, c.shi);
  const ctx: Partial<InterpretationContext> = c.proxy
    ? { persons: [{ id: "Q" }, { id: "B" }], subjectPersonId: "Q", wealthSeekerPersonId: "B" }
    : { persons: [{ id: "Q" }], subjectPersonId: "Q", wealthSeekerPersonId: "Q" };
  const r = wealth(f, "seekingWealth", ctx, c.month);
  check(`${c.name} 四課 ${c.lessons}（原典と一致）`, lessons(f) === c.lessons, lessons(f));
  check(`${c.name} 三伝 ${c.seq}（原典と一致）`, seq(f) === c.seq, seq(f));
  check(`${c.name} 財の類神（初伝が妻財）が原典と一致`, f.transmissions![0].relation === "妻財");
  for (const k of c.found) check(`${c.name} 規則 ${k} を検出`, !!reading(r, k), keys(r));
  const gMatch = gens(f) === c.gens;
  caseLines.push(`${c.name} ${c.day}日 ${c.shi}時 ${c.jiang}将｜問い ${c.question}｜四課 一致（${lessons(f)}）｜三伝 一致（${seq(f)}）｜天将 ${gMatch ? "一致" : `不一致（原典 ${c.gens}／エンジン ${gens(f)}。原因は未確定・起課は変更しない）`}｜財の類神 ${c.wealth}・一致｜原典 ${c.sourceVerdict}｜結果 ${c.outcome}｜${c.verdict}｜${keys(r)}`);
}
{
  const g = (n: number) => { const c = CASES[n]; return gens(factsOf(c.day, c.jiang, c.shi)) === c.gens; };
  check("天将の一致・不一致を記録: 増補例一・二とも不一致（例一は初伝の六合だけ一致）", !g(0) && !g(1) && factsOf("甲戌", "未", "亥").generals.generalOn["戌"] === "六合");
  const r1 = wealth(factsOf("甲戌", "未", "亥"), "seekingWealth", { persons: [{ id: "Q" }, { id: "B" }], subjectPersonId: "Q", wealthSeekerPersonId: "B" }, "未");
  check("増補例一 代理の問いを要約に書き、取得と保持の段階を分けて出す", r1.summary.includes("代理の問い") && /・実際に得るか: .*ともに剋す/.test(r1.summary) && /・得た財を保てるか: .*夾克/.test(r1.summary));
  // 『大全』の夾克の例（規則の出典そのもの。独立した検証ではない）
  const gm = factsOf("壬戌", "子", "巳");
  check("『大全』鬼墓課の例（壬戌日 巳時 子将）: 初伝 午 が地盤 亥 に加わり夾克（天将は原典 天后・エンジン 玄武で、どちらも水）",
    seq(gm)[0] === "午" && gm.plate.earthUnder["午"] === "亥" && gm.generals.generalOn["午"] === "玄武" && !!reading(wealth(gm, "seekingWealth", {}, "丑"), "pinchedRetention"));
  let ok9 = true;
  for (const sh of BRANCHES) { const f = factsOf("甲子", BRANCHES[(BRANCHES.indexOf(sh) + 2) % 12] as Branch, sh as Branch); ok9 &&= f.generals.generalOn["辰"] === "六合" && !!reading(wealth(f, "seekingWealth", {}, "寅"), "pinchedAcquire"); }
  check("『大全』卷九の例（甲子日 辰加寅）: 昼夜とも辰に六合が乗り、どの時でも夾克が成立（原典「晝夜天將皆是六合」）", ok9);
}

// ---- 2. 占的 ----
{
  const f = factsOf("甲戌", "未", "亥");
  const s = wealth(f, "seekingWealth", {}, "未"), tr = wealth(f, "trading", {}, "未"), d = wealth(f, "debtCollection", {}, "未");
  check("求財・売買・索債は別の規則表（他の占的の規則を出さない）",
    s.readings.every((x) => SEEK_KEYS.has(x.key)) && tr.readings.every((x) => TRADE_KEYS.has(x.key)) && d.readings.every((x) => DEBT_KEYS.has(x.key)));
  check("求財・売買・索債の規則の key が重ならない（艱難は占的ごとに出典が違う別のルール）",
    [...SEEK_KEYS].filter((k) => TRADE_KEYS.has(k) || DEBT_KEYS.has(k)).every((k) => k === "hardship") && [...TRADE_KEYS].filter((k) => DEBT_KEYS.has(k)).every((k) => k === "hardship"));
  for (const sub of ["general", "lending", "borrowing", "keeping"] as const) {
    const r = wealth(f, sub, {}, "未");
    check(`${sub} は判断せず不足を返す`, r.readings.length === 0 && r.missing.some((m) => m.key === "subtype"));
  }
  check("借りる占（假借門）は行年が未実装のため未対応と書く", wealth(f, "borrowing").missing.some((m) => m.detail.includes("行年")));
  check("売買の古典の役割（日＝己・辰＝他人・発用＝物）は売買だけで示し、求財・索債には当てはめない",
    !!reading(tr, "tradeRoles") && !reading(s, "tradeRoles") && !reading(d, "tradeRoles"));
  check("索債の主客は保留として不足に出す", d.missing.some((m) => m.key === "hostGuest"));
}

// ---- 3. 段階 ----
{
  let symbolOnly = false, allWealthSeen = false, allWealthHin = true, symbolNeutral = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const r = wealth(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子"), "seekingWealth", {}, "寅");
    const sym = reading(r, "wealthSymbol");
    if (sym && sym.direction !== "neutral") symbolNeutral = false;
    if (sym && !r.readings.some((x) => x.topic === "acquisition")) symbolOnly = true;
    if (reading(r, "allWealth")) { allWealthSeen = true; if (dir(r, "allWealth") !== "hindering") allWealthHin = false; }
  }
  check("財の象意（妻財）は向きを決めない（象意だけで得るとしない）", symbolNeutral);
  check("財の象意があっても取得の段階の読みがない盤があり、その要約は取得を断定しない", symbolOnly);
  check("三伝がすべて財なら、財の多さと反対に妨げ（『直指』「以財化鬼」）", allWealthSeen && allWealthHin);
  const r = wealth(factsOf("甲戌", "未", "亥"), "seekingWealth", {}, "未");
  check("求財の要約に段階（象意・機会・取得・保持）を分けて書く", ["・財の象意:", "・財を得る機会:", "・実際に得るか:", "・得た財を保てるか:"].every((x) => r.summary.includes(x)));
  const t = wealth(factsOf("甲戌", "未", "亥"), "trading", {}, "未");
  check("売買の要約に段階（取引の成立・物の貴賤・利益）を分けて書く", ["・取引の成立:", "・物の貴賤", "・利益:"].every((x) => t.summary.includes(x)));
  check("求財の段階には売買の段階を書かない", !r.summary.includes("・取引の成立:") && !t.summary.includes("・実際に得るか:"));
}

// ---- 4. 人物 ----
{
  let found: { f: F; natal: Branch } | null = null;
  for (let i = 0; i < 60 && !found; i++) for (let o = 0; o < 12 && !found; o++) for (const nb of BRANCHES) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const P = { id: "P", natalYear: natalYearStateOf(BRANCHES.indexOf(nb) % 2 === 0 ? "甲" : "乙", nb as Branch) };
    if (reading(wealth(f, "seekingWealth", { persons: [P], wealthSeekerPersonId: "P" }), "wealthGodOnNatal")) { found = { f, natal: nb as Branch }; break; }
  }
  check("財神（青龍）が財を求める人の本命に臨む盤がある", !!found);
  if (found) {
    const P = { id: "P", natalYear: natalYearStateOf(BRANCHES.indexOf(found.natal) % 2 === 0 ? "甲" : "乙", found.natal) };
    const Q = { id: "Q", natalYear: P.natalYear };
    check("財を求める人の本命は wealthSeekerPersonId からだけ取る（問う人の本命は使わない）",
      !!reading(wealth(found.f, "seekingWealth", { persons: [P], wealthSeekerPersonId: "P" }), "wealthGodOnNatal") &&
      !reading(wealth(found.f, "seekingWealth", { persons: [Q], subjectPersonId: "Q" }), "wealthGodOnNatal"));
    check("財を求める人がなければ本命の読みを省き、不足に出す（部分判断は返す）",
      wealth(found.f, "seekingWealth", { persons: [Q], subjectPersonId: "Q" }).missing.some((m) => m.key === "seekerNatalYear") &&
      wealth(found.f, "seekingWealth", { persons: [Q], subjectPersonId: "Q" }).readings.length > 0);
  }
  check("本人の問い・代理の問い・未指定を区別する",
    seekerRelationOf({ domain: "wealth", subjectPersonId: "A", wealthSeekerPersonId: "A" }) === "self" &&
    seekerRelationOf({ domain: "wealth", subjectPersonId: "A", wealthSeekerPersonId: "B" }) === "proxy" && seekerRelationOf({ domain: "wealth", subjectPersonId: "A" }) === "unknown");
  // 売る側・買う側
  let priceBoard: F | null = null;
  for (let i = 0; i < 60 && !priceBoard; i++) { const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, "子", "子"); if (reading(wealth(f, "trading", {}, "寅"), "tradePrice")) priceBoard = f; }
  check("干支の旺相・囚死（物の貴賤）が出る盤がある", !!priceBoard);
  if (priceBoard) {
    const n = reading(wealth(priceBoard, "trading", {}, "寅"), "tradePrice")!, s = reading(wealth(priceBoard, "trading", { tradeSide: "seller" }, "寅"), "tradePrice")!, b = reading(wealth(priceBoard, "trading", { tradeSide: "buyer" }, "寅"), "tradePrice")!;
    check("物の貴賤は売る側と買う側で向きが逆、側が未指定なら向きを決めない", n.direction === "neutral" && s.direction !== b.direction && s.direction !== "neutral" && b.direction !== "neutral");
    check("側によって読み（label・detected・出典）は変えない", n.label === s.label && s.label === b.label && n.detected === s.detected && s.detected === b.detected && JSON.stringify(s.citations) === JSON.stringify(b.citations));
    check("側が未指定なら推測せず不足に出す", wealth(priceBoard, "trading", {}, "寅").missing.some((m) => m.key === "tradeSide"));
  }
  const f = factsOf("甲戌", "未", "亥");
  check("物の類神は targetSymbol で指定したときだけ読む（自動で決めない）",
    !wealth(f, "trading", {}, "未").readings.some((x) => x.key.startsWith("symbol") || x.key === "buyerSymbolRelation") &&
    wealth(f, "trading", {}, "未").missing.some((m) => m.key === "targetSymbol") &&
    wealth(f, "trading", { targetSymbol: { kind: "branch", branch: "戌" } }, "未").readings.some((x) => x.key === "symbolInTransmissions"));
  check("買う物の類神の読みは、買う側の問いでなければ向きを決めない",
    (() => { for (const b of BRANCHES) { const r = wealth(f, "trading", { targetSymbol: { kind: "branch", branch: b as Branch } }, "未"); const x = reading(r, "buyerSymbolRelation"); if (x && x.direction !== "neutral") return false; } return true; })());
}

// ---- 4b. 最終監査（夾克の取得と保持・以財化鬼・売買の側・進退） ----
{
  const rule = (k: string) => WEALTH_DOMAIN_RULES.find((x) => x.reading.key === k)!;
  const acq = rule("pinchedAcquire").reading, ret = rule("pinchedRetention").reading;
  check("夾克: 取得（卷九「終不可得」）と保持（卷八・鬼墓課「財不由己費用」）は別の段階・別の出典",
    acq.topic === "acquisition" && ret.topic === "retention" &&
    acq.citations.every((c) => c.quote.includes("终不可得")) && ret.citations.every((c) => c.quote.includes("不由")) &&
    acq.citations.length === 1 && !acq.label.includes("用をなさない"));
  check("夾克: 意味の確定しない卷十「而無用」は取得の出典にしない", !JSON.stringify(acq.citations).includes("无用"));
  let pinchedBoth = true, pinchedSeen = false, allWealthOnlyThree = true, sideSame = true, sideOnlyMoney = true, moveOk = true, movePartial = true;
  const MONEY = new Set(["tradePrice", "tradeStockpile", "buyerSymbolRelation"]);
  const step = (a: string, b: string) => (BRANCHES.indexOf(b as Branch) - BRANCHES.indexOf(a as Branch) + 12) % 12;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const r = wealth(f, "seekingWealth", {}, "寅");
    const a = reading(r, "pinchedAcquire"), b = reading(r, "pinchedRetention");
    if (a || b) { pinchedSeen = true; if (!a || !b || a.directionNote === b.directionNote) pinchedBoth = false; }
    const nWealth = f.transmissions!.filter((x) => x.relation === "妻財").length;
    if (!!reading(r, "allWealth") !== (nWealth === 3)) allWealthOnlyThree = false;
    const sym = { kind: "branch" as const, branch: BRANCHES[(i + o) % 12] as Branch };
    const rb = wealth(f, "trading", { tradeSide: "buyer", targetSymbol: sym }, "寅"), rs = wealth(f, "trading", { tradeSide: "seller", targetSymbol: sym }, "寅");
    if (rb.readings.map((x) => `${x.key}|${x.label}|${x.detected.replace(/買う側の問いなので貨物|売る側の問いなので主顧（買い手）/, "")}`).join() !==
        rs.readings.map((x) => `${x.key}|${x.label}|${x.detected.replace(/買う側の問いなので貨物|売る側の問いなので主顧（買い手）/, "")}`).join()) sideSame = false;
    for (const x of rb.readings) { const y = reading(rs, x.key)!; if (x.direction !== y.direction && !MONEY.has(x.key)) sideOnlyMoney = false; }
    const [p0, p1, p2] = seq(f).split("");
    const d1 = step(p0, p1), d2 = step(p1, p2);
    const pat = d1 === 1 && d2 === 1 ? "進茹" : d1 === 2 && d2 === 2 ? "進間" : d1 === 11 && d2 === 11 ? "退茹" : d1 === 10 && d2 === 10 ? "退間" : "";
    const mv = reading(rb, "tradeMovement");
    if ((pat === "進茹" || pat === "退間") !== !!mv) moveOk = false;
    if (mv && mv.direction !== (pat === "進茹" ? "favoring" : "hindering")) moveOk = false;
    if (!rb.missing.some((m) => m.key === "movementPartial")) movePartial = false;
  }
  check("夾克: 取得と保持の読みは同じ盤で別々に出し、注記で互いを区別する", pinchedSeen && pinchedBoth);
  check("以財化鬼: 三伝の3つがすべて妻財のときだけ（2つ以下には広げない）", allWealthOnlyThree);
  check("売買の側: 買う側・売る側で読みの種類・label・detected は同じ（発用＝貨物／主顧の役割表示を除く）", sideSame);
  check("売買の側: 向きが側で変わるのは金銭・財物の移動に関わる読み（物の貴賤・積貨・買う物）だけ。成立・品質・障害は同じ向き", sideOnlyMoney);
  check("進退: 進茹（伝進当行）・退間（間退止）だけを読み、進間・退茹は読まない", moveOk);
  check("進退: 部分実装であることを label と不足に明記する", rule("tradeMovement").reading.label.includes("部分実装") && movePartial);
}

// ---- 5. 空亡・出力 ----
{
  const code = readFileSync("src/lib/liuren/interpretation/wealthDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const rules = code.slice(code.indexOf("const WEALTH_RULES"), code.indexOf("function seekerNatalOf"));
  check("財物のルールは坐空を使わない（旬空だけ）", !rules.includes("isSeatedOnVoid"));
  let seatedShown = false;
  for (let i = 0; i < 60 && !seatedShown; i++) for (let o = 0; o < 12 && !seatedShown; o++)
    seatedShown = wealth(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子"), "seekingWealth").missing.some((m) => m.key === "seatedOnVoid");
  check("坐空がある盤は保留として不足に出す", seatedShown);
}

// ---- 6. 720課・基盤 ----
const SUBS = ["seekingWealth", "trading", "debtCollection"] as const;
const AMOUNT = /[0-9０-９一二三四五六七八九十百千万]+\s*(元|円|%|％|割)|成立日|日に成立|利益率|回収額は/;
const counts: Record<string, number> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0, amount = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  const nb = BRANCHES[(i * 5 + o) % 12] as Branch;
  const P = { id: "P", natalYear: natalYearStateOf(BRANCHES.indexOf(nb) % 2 === 0 ? "甲" : "乙", nb) };
  const ctxs: InterpretationContext[] = [];
  for (const subtype of SUBS) for (const m of [0, 1, 2]) ctxs.push({ domain: "wealth", subtype,
    ...(m >= 1 ? { persons: [P, { id: "Q" }], wealthSeekerPersonId: "P", subjectPersonId: m === 1 ? "P" : "Q", tradeSide: m === 1 ? "buyer" : "seller", xingNianInputs: [{ personId: "P", sex: "male" as const, reckonedAge: ((i * 7 + o * 5) % 72) + 1 }], taiSui: taiSuiStateOf(BRANCHES[(i + o * 7) % 12] as Branch) } : {}),
    ...(m >= 1 ? { targetSymbol: { kind: "branch", branch: BRANCHES[(i + 2 * o + m) % 12] as Branch } } : {}) });
  for (const ctx of ctxs) for (const mb of [month, null]) {
    try {
      const r = evaluateWealthDomain(facts, ctx, mb);
      evaluated += 1;
      if (JSON.stringify(evaluateWealthDomain(facts, ctx, mb)) !== JSON.stringify(r)) nondeterministic += 1;
      if (AMOUNT.test(r.summary.split("\n").filter((l) => !l.startsWith("【注意】")).join("\n").replace(/[「『][^」』]*[」』]/g, ""))) amount += 1;
      if (mb) for (const x of r.readings) counts[x.ruleId] = (counts[x.ruleId] ?? 0) + 1;
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×占的3×人物・側3×月支有無 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 3 * 3 * 2 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("要約に金額・利益率・回収額・成立日を出さない", amount === 0, `${amount}`);
{
  const f = factsOf("甲戌", "未", "亥");
  check("goal で向きを反転しない（不足に明示）", keys(wealth(f, "seekingWealth", { goal: "avoid" }, "未")) === keys(wealth(f, "seekingWealth", {}, "未")) && wealth(f, "seekingWealth", { goal: "avoid" }, "未").missing.some((m) => m.key === "goal"));
  check("月支がなければ旺相を使う読みは出さず、不足に出す",
    SUBS.every((s) => wealth(f, s).readings.every((x) => !["siblingsStrong", "tradePrice", "tradeStockpile"].includes(x.key)) && wealth(f, s).missing.some((m) => m.key === "monthBranch")));
  const dead = WEALTH_DOMAIN_RULES.filter((x) => !counts[x.id]).map((x) => x.id);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const always = WEALTH_DOMAIN_RULES.filter((x) => !["dragonInBoard", "tradeRoles"].includes(x.reading.key) && (counts[x.id] ?? 0) >= 720 * 3).map((x) => x.id);
  check("役割・類神の有無（課伝に入る／入らない）以外に、すべての盤で成立するルールがない", always.length === 0, always.join(","));
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』", "『六壬神課講座』"];
  check("全ルールに出典・推論レベル・topic・占的（subtypes）がある",
    WEALTH_DOMAIN_RULES.every((x) => x.reading.citations.length > 0 && x.reading.citations.every((c) => allowed.includes(c.source)) && !!x.reading.topic && !!x.when.subtypes?.length && ["direct", "combined", "inferred"].includes(x.reading.level)));
  check("講座の引用は layer＝講座、漢籍は原文・注で区別する",
    WEALTH_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => (c.source === "『六壬神課講座』") === (c.layer === "講座") && (c.source === "『六壬神課講座』" || c.layer === "原文" || c.layer === "注"))));
  check("ルール ID が重複しない", new Set(WEALTH_DOMAIN_RULES.map((x) => x.id)).size === WEALTH_DOMAIN_RULES.length);
  check("増補（現代の注解者の例）を規則の出典にしない", WEALTH_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => !c.locator.includes("増補"))));
  const code = readFileSync("src/lib/liuren/interpretation/wealthDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["score", "xingNianOf", "calculateLiuren"].filter((w) => code.includes(w));
  check("点数・行年の計算・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤を使う", /evaluateDomainRules\(WEALTH_RULES/.test(code) && /buildDomainBoardInput\(/.test(code) && /summarizeDomainReadings\(/.test(code));
  const r53 = evaluateCareerDomain(factsOf("丙子", "卯", "丑"), { domain: "work", subtype: "promotion", persons: [{ id: "A", natalYear: natalYearStateOf("戊", "辰") }], subjectPersonId: "A" });
  check("仕事・試験の判断は変わらない（例53 の読み）", r53.readings.map((x) => x.key).join() === "finalEmpty,dengSanTian,gateNotPassed,passesDayStem,climbFromChild,natalAtInitial");
}

console.log("実占例（四課・三伝・天将・財の類神・検出した規則・占断・結果を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("増補占例一（求財・代理の問い・月支 未）の要約:");
console.log(wealth(factsOf("甲戌", "未", "亥"), "seekingWealth", { persons: [{ id: "Q" }, { id: "B" }], subjectPersonId: "Q", wealthSeekerPersonId: "B" }, "未").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log("同じ盤を売買（売る側・類神 戌）で見た要約:");
console.log(wealth(factsOf("甲戌", "未", "亥"), "trading", { tradeSide: "seller", targetSymbol: { kind: "branch", branch: "戌" } }, "未").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（月支あり）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace("wealth.", "")} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${WEALTH_DOMAIN_RULES.length}（求財 ${SEEK_KEYS.size}・売買 ${TRADE_KEYS.size}・索債 ${DEBT_KEYS.size}）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
