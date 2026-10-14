// tests/liuren_interpretation_litigation_domain.manual.ts
//
// 六壬神課 Phase 5G（訴訟・争い evaluateLitigationDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_litigation_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』占訟章の古典占験13例（一〜六・十五〜二十一。取得した版の本文は占験六の次が十五）を、四課・三伝・天将・主客・
//      検出した規則・原典の占断・記録された結果に分けて確認する（三伝が一致しても占断の一致とはしない）。
//      規則の出典になった占例（占験三・十七の割注）と、規則の句をそのまま使う占断（占験二十）は独立した検証と呼ばない。
//      『六壬大全』の例（規則の出典そのもの）は、規則が出典の盤で成立するかの確認
//   2. 占的: 訴訟・当事者間の争い・和解は別の規則表。未指定は判断せず不足を返す。争いには官府・主客の輸贏の規則を当てはめない
//   3. 人物: 古典の主客（先後・尊卑）は litigationStanding からだけ取り、原告・被告（legalPosition）から決めない。
//      主客で向きが分かれる読みは、立場がなければ向きを決めない
//   4. goal: 発生・激化・長期化・収束は goal（avoid・reconcile・release）のときだけ向きを決め、読みそのものは変えない
//   5. 官鬼だけで訴訟の発生・敗訴としない。旬空だけで読み、坐空は保留。判決結果・勝訴の見込み・賠償額・判決日を出さない
//   6. 720課×占的×立場×goal で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { LITIGATION_DOMAIN_RULES, evaluateLitigationDomain, litigantRelationOf } from "../src/lib/liuren/interpretation/litigationDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { DomainSubtype, InterpretationContext, InterpretationGoal } from "../src/lib/liuren/interpretation/roles";

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
const lit = (f: F, subtype: DomainSubtype<"litigation">, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateLitigationDomain(f, { domain: "litigation", subtype, ...extra } as InterpretationContext, month);
const keysOf = (sub: string) => new Set(LITIGATION_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes(sub)).map((x) => x.reading.key));
const LIT_KEYS = keysOf("litigation"), DIS_KEYS = keysOf("dispute"), SET_KEYS = keysOf("settlement");
// 原文が日・客・主を名指す規則（ZN＝主客を先後だけで決める『指南』、XJ＝先後・尊卑で決める『心鏡』）
const ZN_PARTY = ["stemUpperGhost", "initialOvercomesStem", "initialOvercomesBranch", "crossOvercome", "zhuGouOvercomeStem", "zhuGouGenerateStem", "gouTigerOvercomeStem", "taiSuiNoble"];
const XJ_PARTY = ["restDeath", "gouOvercomes", "dayOvercomesGou", "gouYinNoble"];
const PARTY_KEYS = [...ZN_PARTY, ...XJ_PARTY];
// 六親は日干から見るが、原文が主客を示さない規則
const NO_PARTY_KEYS = ["childrenControlGhost", "finalGeneratesInitialGhost", "tigerGhostHorse", "diKe"];
const PROCESS_KEYS = ["zhuInGou", "zhuOvercomesTaiSui", "gouOvercomesBoth", "bothOvercomeGou", "ghostIn34", "innerWar", "binZhu", "headTail", "tombOnGrowth", "jiYin"];
const GUEST: Partial<InterpretationContext> = { litigationStanding: { precedence: "initiator" } };
const HOST: Partial<InterpretationContext> = { litigationStanding: { precedence: "respondent" } };

// ---- 1. 実占例（『指南』占訟章の古典占験） ----
type Case = { name: string; day: string; shi: Branch; jiang: Branch; month: Branch; year: Branch; lessons: string; seq: string; gens: string | null;
  question: string; sourceVerdict: string; outcome: string; found: string[]; verdict: string };
// 四課は「上神＋下（一課は日干）」で、原典の課式の上段・下段を右から読んだもの。天将は原典の三伝の天将（gens＝null は原典と一致しないことを記録）
const CASES: Case[] = [
  { name: "占験一", day: "丙辰", shi: "午", jiang: "酉", month: "巳", year: "未", lessons: "申丙 亥申 未辰 戌未", seq: "申亥寅", gens: "六合・貴人・玄武",
    question: "刑部の獄にある人（第三者）の生死・出獄", sourceVerdict: "大吉。月徳の発用・絶処逢生・皇恩で、日を指して出獄するが謫戍は免れない", outcome: "赦の内に入り、後に要職を歴任",
    found: [], verdict: "判断材料なし：原典の根拠（月徳・絶処逢生・皇恩）は神煞・長生で未対応。官鬼の象意のほかに検出した規則がない" },
  { name: "占験二", day: "乙未", shi: "卯", jiang: "戌", month: "辰", year: "子", lessons: "亥乙 午亥 寅未 酉寅", seq: "午丑申", gens: "天空・天后・勾陳",
    question: "逮捕され重辟が定まった人の吉凶（本人の依頼）", sourceVerdict: "恩宥に遇い、再び重用される（皇恩・天赦・太歳貴人が日を生ず）", outcome: "熱審で謫戍に減じ、後に功を立てて復職",
    found: ["childrenControlGhost", "zhuGouGenerateStem", "zhuOvercomesTaiSui"],
    verdict: "部分一致：子孫制鬼（救い）・朱勾生日（昭雪）は原典の吉の方向に合う。朱雀が太歳を剋す読みは原典の判断にない。原典の根拠の太歳貴人は天将が一致しないので検出しない" },
  { name: "占験三", day: "己酉", shi: "卯", jiang: "戌", month: "辰", year: "子", lessons: "寅己 酉寅 辰酉 亥辰", seq: "亥午丑", gens: "螣蛇・天空・天后",
    question: "逮捕された人の出獄", sourceVerdict: "今は難を脱せない（発用の驛馬が墓に坐し、朱雀が歳君を犯す）。四月に出獄", outcome: "三月の上疏は駁され、四月に出獄",
    found: ["stemUpperGhost", "zhuOvercomesTaiSui"],
    verdict: "部分一致：朱雀が太歳を剋す読みは原典の根拠と同じだが、この規則の方法（朱雀の乗神で見る）の出典が本例なので独立した検証ではない。驛馬坐墓・出獄の時期は未対応" },
  { name: "占験四", day: "甲午", shi: "午", jiang: "巳", month: "申", year: "午", lessons: "丑甲 子丑 巳午 辰巳", seq: "子亥戌", gens: "天后・太陰・玄武",
    question: "来客（科第の人）の事情", sourceVerdict: "朝廷の事に連累して罪を得るが、恩赦があり大咎はない（貴人が干に剋され、歳破が発用し、課伝が退茹）", outcome: "失城で逮問され、北京陥落で出獄",
    found: ["initialOvercomesBranch"], verdict: "部分一致：発用が日支を剋す（主の輸）は出るが、当事者の主客が原典にないので向きを決めない。日干は月令に死だが、「自逢休墓死」の死は旺相休囚死か十二長生かが確定しないので読まない。原典の根拠（貴人被干克・歳破・退茹・后陰の恩赦）は規則にない" },
  { name: "占験五", day: "癸亥", shi: "辰", jiang: "酉", month: "巳", year: "酉", lessons: "午癸 亥午 辰亥 酉辰", seq: "午亥辰", gens: "螣蛇・天空・天后",
    question: "弾劾された首輔の進退（代理の問い）", sourceVerdict: "必ず位を去る（傳將遞克・德不勝刑・貴禄財馬が空陷）。後に復起の象", outcome: "六月に辞任が許され帰郷。後に復入閣し、賜死",
    found: ["crossOvercome", "zhuGouOvercomeStem", "zhuGouGenerateStem", "binZhu"],
    verdict: "部分一致：支上が日干を剋す（客に不利）・朱雀が日干を剋す（訴えを興すべきでない）は原典の凶に合うが、勾陳が日干を生ず読みも同時に出る（相殺しない）。原典の根拠（傳將遞克は天将を含む・德刑・空陷）は規則にない" },
  { name: "占験六", day: "乙未", shi: "卯", jiang: "戌", month: "卯", year: "子", lessons: "亥乙 午亥 寅未 酉寅", seq: "午丑申", gens: "天空・天后・勾陳",
    question: "重辟が定まった人の吉凶", sourceVerdict: "六月に赦に遇い凶が吉に転ずる（長生臨身・天赦・太歳貴人の恩星）", outcome: "六月の熱審で謫戍に減じ、後に参将に昇る",
    found: ["childrenControlGhost", "zhuGouGenerateStem"],
    verdict: "部分一致：子孫制鬼・朱勾生日は原典の吉に合う。天赦・太歳貴人は未対応・天将不一致" },
  { name: "占験十五", day: "戊午", shi: "酉", jiang: "酉", month: "巳", year: "未", lessons: "巳戊 巳巳 午午 午午", seq: "巳申寅", gens: "朱雀・天后・青龍",
    question: "朝官の進退（代理の問い）", sourceVerdict: "台諫に備えるべきだが、好い旨を得て帰郷する（傳將互克・伏吟丁馬。朱雀が日徳日禄で日を生ず）", outcome: "人の言により請うて去る",
    found: ["zhuGouGenerateStem", "zhuGouOvercomeStem", "gouOvercomes", "diKe", "binZhu"],
    verdict: "部分一致：朱雀の乗神 巳 が日干を生ず（原典の「朱雀德禄生日」と同じ位置）は好旨に合い、三伝遞克は原典の「傳將互克」に近い。勾陳が日干を剋す読み（客の敗）も同時に出る" },
  { name: "占験十六", day: "乙酉", shi: "巳", jiang: "戌", month: "卯", year: "子", lessons: "酉乙 寅酉 寅酉 未寅", seq: "未子巳", gens: "青龍・貴人・白虎",
    question: "重辟が定まった巡撫の吉凶", sourceVerdict: "必ず赦に遇い六月に出獄の兆し（皇恩・天赦・中伝の太歳が貴人で日を生ず）。謫戍は免れない", outcome: "熱審で謫戍に減ず",
    found: ["stemUpperGhost", "zhuGouGenerateStem", "venue", "innerWar"],
    verdict: "部分一致：中伝の太歳（朝廷に関わる）は原典と同じ位置。太歳貴人は天将が一致しないので検出しない。干上の官鬼（客に不利）・三伝内戦は原典の判断にない" },
  { name: "占験十七", day: "丁未", shi: "未", jiang: "辰", month: "申", year: "未", lessons: "辰丁 丑辰 辰未 丑辰", seq: "亥辰辰", gens: "貴人・青龍・青龍",
    question: "逮捕されて京に送られる人の吉凶", sourceVerdict: "必ず辯雪し、京に着く前に公訟が休む（月将の青龍が干支に臨む・勾陳が日を生ず・官鬼が空陥）", outcome: "（周延儒は賜死、本人は自ら帰る）",
    found: ["zhuGouGenerateStem", "childrenControlGhost", "initialOvercomesStem"],
    verdict: "部分一致：勾陳の乗神 卯 が日干を生ず（昭雪）は原典の根拠と同じだが、規則の方法（乗神で見る）の出典が本例の割注なので独立した検証ではない。発用が日を剋す（客の輸）も同時に出る。官鬼の空陥は落空（坐空）で、保留" },
  { name: "占験十八", day: "甲子", shi: "巳", jiang: "申", month: "午", year: "丑", lessons: "巳甲 申巳 卯子 午卯", seq: "申亥寅", gens: "青龍・朱雀・天后",
    question: "人の吉凶（代理の問い）", sourceVerdict: "公訟で拘系されるが、勾陰が日を生ずので辯雪できる。後に顕要の位", outcome: "下獄の後に救われ、後に大宗伯",
    found: ["initialOvercomesStem", "zhuGouGenerateStem", "restDeath"],
    verdict: "部分一致：発用が日を剋す（客の輸）は拘系に、勾陳の乗神が日干を生ず（昭雪）は辯雪に合う。ただし天将が一致せず、原典の「勾陰生日」が指す位置（勾陳の陰神か、勾陳と太陰か）も資料で確定しないので、エンジンの勾陳（亥）が原典と同じ位置とはいえない" },
  { name: "占験十九", day: "丁亥", shi: "辰", jiang: "巳", month: "申", year: "丑", lessons: "申丁 酉申 子亥 丑子", seq: "申酉戌", gens: "六合・朱雀・螣蛇",
    question: "逮問された人の事（代理の問い）", sourceVerdict: "訟を占えば最も凶で救いがない（皇詔が坐空・蛇虎二墓・劫殺・年上の勾刃）", outcome: "廷杖を受け、二人が枷で死ぬ",
    found: ["crossOvercome", "gouOvercomes"],
    verdict: "部分一致：支上が日干を剋す（客に不利）は凶に合うが、勾陳が日支を剋す（主の敗）も出る。原典の根拠（坐空・二墓・劫殺・年上）は未対応" },
  { name: "占験二十", day: "癸未", shi: "辰", jiang: "丑", month: "子", year: "丑", lessons: "戌癸 未戌 辰未 丑辰", seq: "戌未辰", gens: "白虎・太陰・螣蛇",
    question: "参劾され逮問された人が難を脱する日", sourceVerdict: "最も辯雪し難いが、後は虎頭蛇尾（蛇虎・鬼賊・太歳が日を剋す。支上の皇恩・命の天赦）", outcome: "新年に謫戍の旨が下る",
    found: ["stemUpperGhost", "initialOvercomesStem", "gouTigerOvercomeStem", "ghostIn34", "tigerHeadSnakeTail"],
    verdict: "一致：干上の官鬼・発用が日を剋す・勾虎が日を剋す・三四課の官鬼は「最も辯雪し難い」に、虎頭蛇尾は後の結果（死罪でなく謫戍）に合う。ただし虎頭蛇尾は原典の占断が規則と同じ句を使うので、独立した検証ではない" },
  { name: "占験二十一", day: "癸亥", shi: "午", jiang: "酉", month: "巳", year: "未", lessons: "辰癸 未辰 寅亥 巳寅", seq: "辰未戌", gens: "天后・朱雀・青龍",
    question: "戊寅命の人の吉凶（代理の問い）", sourceVerdict: "課象は凶だが畏れない（三伝が純官鬼・関墓が日を覆う。兩貴が身を拱し、丁馬貴德が命に居る）", outcome: "上疏で救われ、死を減じて謫戍",
    found: ["stemUpperGhost", "initialOvercomesStem", "initialOvercomesBranch", "zhuGouOvercomeStem", "zhuGouGenerateStem", "venue"],
    verdict: "部分一致：干上の官鬼・発用が日を剋す・朱雀が日干を剋すは原典の「課象は凶」に合い、勾陳が日干を生ず読みは救いの方向。原典の救い（兩貴拱身・丁馬貴德）は未対応" },
];
const caseLines: string[] = [];
let gensMatched = 0;
for (const c of CASES) {
  const f = factsOf(c.day, c.jiang, c.shi);
  const r = lit(f, "litigation", { taiSui: taiSuiStateOf(c.year) }, c.month);
  check(`${c.name} 四課 ${c.lessons}（原典と一致）`, lessons(f) === c.lessons, lessons(f));
  check(`${c.name} 三伝 ${c.seq}（原典と一致）`, seq(f) === c.seq, seq(f));
  for (const k of c.found) check(`${c.name} 規則 ${k} を検出`, !!reading(r, k), keys(r));
  const gMatch = gens(f) === c.gens;
  if (gMatch) gensMatched += 1;
  caseLines.push(`${c.name} ${c.day}日 ${c.shi}時 ${c.jiang}将 月${c.month} 歳${c.year}｜問い ${c.question}｜四課 一致｜三伝 一致（${seq(f)}）｜天将 ${gMatch ? "一致" : `不一致（原典 ${c.gens}／エンジン ${gens(f)}。原因は未確定・起課は変更しない）`}｜主客 原典は示さない（官に問われる側の占で、相手方の当事者がいない）｜原典 ${c.sourceVerdict}｜結果 ${c.outcome}｜${c.verdict}｜${keys(r)}`);
}
check("三伝は13例すべて原典と一致、天将は7例（三・五・十五・十七・十九・二十・二十一）だけ一致", gensMatched === 7 &&
  ["占験三", "占験五", "占験十五", "占験十七", "占験十九", "占験二十", "占験二十一"].every((n) => { const c = CASES.find((x) => x.name === n)!; return gens(factsOf(c.day, c.jiang, c.shi)) === c.gens; }));
{
  // 『大全』の例（規則の出典そのもの。独立した検証ではない）
  const days = (pred: (f: F) => boolean) => { const out = new Set<string>(); for (let i = 0; i < 60; i++) for (const j of BRANCHES) { const d = `${STEMS[i % 10]}${BRANCHES[i % 12]}`; if (pred(factsOf(d, j as Branch, "子"))) out.add(d); } return [...out].sort().join(","); };
  const tailHead = (f: F) => { const h = f.xun.xunHead[1] as Branch, tl = BRANCHES[(BRANCHES.indexOf(h) + 9) % 12]; return [f.lessons[0].upper, f.lessons[2].upper, h, tl]; };
  check("『大全』首尾相見「干上有旬尾，支上有旬首…惟乙未、辛丑、丙申、壬寅、戊申五日有之」が720課と一致",
    days((f) => { const [s, z, h, tl] = tailHead(f); return s === tl && z === h; }) === ["乙未", "辛丑", "丙申", "壬寅", "戊申"].sort().join(","));
  check("『大全』首尾相見「干上有旬首，支上有旬尾。惟乙丑、辛未、丙寅、戊寅、壬申五日有之」が720課と一致",
    days((f) => { const [s, z, h, tl] = tailHead(f); return s === h && z === tl; }) === ["乙丑", "辛未", "丙寅", "戊寅", "壬申"].sort().join(","));
  let both = false; for (const j of BRANCHES) { const f = factsOf("丁亥", j as Branch, "子"); if (f.lessons[0].upper === "子" && f.lessons[2].upper === "辰") both = !!reading(lit(f, "litigation"), "bothHurt"); }
  check("『大全』彼此全傷の例（丁亥日。干上の水が丁を剋し、支上の辰が亥を剋す）で成立", both);
  const dk = (d: string, s: string) => BRANCHES.some((j) => { const f = factsOf(d, j as Branch, "子"); return seq(f) === s && !!reading(lit(f, "dispute"), "diKe"); });
  check("『大全』殃咎課の遞克の例（己巳日 三伝巳申寅・丙子日 三伝子未寅）で成立", dk("己巳", "巳申寅") && dk("丙子", "子未寅"));
  check("『大全』尋死格の例（丙午日 三伝卯寅丑）は末伝 丑 が父母でなく、条件「三傳生日，皆空」と合わない（保留の根拠）",
    BRANCHES.some((j) => { const f = factsOf("丙午", j as Branch, "子"); return seq(f) === "卯寅丑" && f.transmissions![2].relation !== "父母"; }) && !LITIGATION_DOMAIN_RULES.some((x) => x.reading.key === "seekDeath"));
  check("『大全』凝陽格の三伝申午辰は720課に現れない（規則にしない根拠）", !(() => { for (let i = 0; i < 60; i++) for (const j of BRANCHES) if (seq(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子")) === "申午辰") return true; return false; })());
  check("『大全』三伝内戦の例（癸酉日）で成立する課がある", BRANCHES.some((j) => !!reading(lit(factsOf("癸酉", j as Branch, "子"), "dispute"), "innerWar")));
}

// ---- 2. 占的 ----
{
  const f = factsOf("癸未", "丑", "辰");
  const l = lit(f, "litigation", {}, "子"), d = lit(f, "dispute", {}, "子"), s = lit(f, "settlement", {}, "子");
  check("訴訟・争い・和解は別の規則表（他の占的の規則を出さない）",
    l.readings.every((x) => LIT_KEYS.has(x.key)) && d.readings.every((x) => DIS_KEYS.has(x.key)) && s.readings.every((x) => SET_KEYS.has(x.key)));
  check("当事者間の争いには主客の輸贏・官府・勾陳朱雀・太歳の規則を当てはめない（「凡占」「諸占」の規則だけ）",
    [...DIS_KEYS].sort().join() === ["binZhu", "bothHurt", "diKe", "innerWar"].sort().join() && d.missing.some((m) => m.key === "disputeScope"));
  check("和解の規則は収束・長期化・関係の読みだけ",
    LITIGATION_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes("settlement")).every((x) => ["settlement", "prolong", "relation"].includes(x.reading.topic!)) && s.missing.some((m) => m.key === "settlementScope"));
  const g = lit(f, "general", {}, "子");
  check("占的が未指定なら判断せず不足を返す", g.readings.length === 0 && g.missing.some((m) => m.key === "subtype"));
  check("拘禁・出獄・刑罰の種類は占的として扱わず不足に出す", l.missing.some((m) => m.key === "detention"));
}

// ---- 3. 人物・主客 ----
{
  let verdictFlip = true, advNeutral = true, noStandingNeutral = true, rankSame = true, legalSame = true, labelsSame = true, seenVerdict = false, seenAdv = false;
  let rankOnlyZn = true, conflictOk = true, noPartyNeutral = true, noPartySeen = false;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const n = lit(f, "litigation", {}, "寅"), g = lit(f, "litigation", GUEST, "寅"), h = lit(f, "litigation", HOST, "寅");
    const sr = lit(f, "litigation", { litigationStanding: { rank: "senior" } }, "寅");
    const both = lit(f, "litigation", { litigationStanding: { precedence: "initiator", rank: "senior" } }, "寅");
    const conflict = lit(f, "litigation", { litigationStanding: { precedence: "initiator", rank: "junior" } }, "寅");
    for (const x of sr.readings) {
      if (ZN_PARTY.includes(x.key) && x.direction !== "neutral" && !x.directionNote?.includes("主客の双方")) rankOnlyZn = false;
      if (XJ_PARTY.includes(x.key) && x.direction !== dir(g, x.key)) rankSame = false;
    }
    if (keys(both) !== keys(g)) rankSame = false;
    for (const x of conflict.readings) {
      if (XJ_PARTY.includes(x.key) && x.direction !== "neutral" && !x.directionNote?.includes("主客の双方")) conflictOk = false;
      if (ZN_PARTY.includes(x.key) && x.direction !== dir(g, x.key)) conflictOk = false;
    }
    for (const r of [n, g, h, sr]) for (const x of r.readings) if (NO_PARTY_KEYS.includes(x.key)) { noPartySeen = true; if (x.direction !== "neutral") noPartyNeutral = false; }
    const pl = lit(f, "litigation", { ...GUEST, legalPosition: "defendant" }, "寅");
    if (keys(pl) !== keys(g)) legalSame = false;
    if (g.readings.map((x) => `${x.key}${x.label}${x.detected}`).join() !== h.readings.map((x) => `${x.key}${x.label}${x.detected}`).join()) labelsSame = false;
    for (const x of n.readings) if (PARTY_KEYS.includes(x.key) && x.direction !== "neutral" && !x.directionNote?.includes("主客の双方")) noStandingNeutral = false;
    for (const k of ["initialOvercomesStem", "initialOvercomesBranch", "gouOvercomes", "dayOvercomesGou"]) {
      const a = dir(g, k), b = dir(h, k);
      if (a === null) continue;
      const party = reading(g, k)!.detected;
      if (party.includes("日干・日支の両方")) continue;
      seenVerdict = true;
      if (!(a !== "neutral" && b !== "neutral" && a !== b)) verdictFlip = false;
    }
    for (const k of ["stemUpperGhost", "zhuGouOvercomeStem", "gouYinNoble"]) {
      if (dir(g, k) === null) continue;
      seenAdv = true;
      if (dir(g, k) === "neutral" || dir(h, k) !== "neutral") advNeutral = false;
    }
  }
  check("主客の立場がなければ、主客で向きが分かれる読みは向きを決めない（日干・日支の両方に及ぶものは双方の読み）", noStandingNeutral);
  check("勝敗（輸贏）の読みは、当事者が客か主かで向きが逆", seenVerdict && verdictFlip);
  check("客についての優劣の読みは、当事者が客なら向きを決め、主なら（相手側の読みとして）向きを決めない", seenAdv && advNeutral);
  check("尊卑の「尊」は、『心鏡』の規則では先後の「先に動いた側」と同じ客（日）として読む（両方が一致すれば同じ結果）", rankSame);
  check("尊卑だけでは、主客を先後だけで決める『指南』の規則の向きを決めない", rankOnlyZn);
  check("先後と尊卑が食い違えば、『心鏡』の規則は一方を優先せず向きを決めず、『指南』の規則は先後で読む", conflictOk);
  check("六親は日干から見るが原文が主客を示さない規則（子孫制鬼・末生初鬼・虎鬼乗馬・三伝遞克）は、立場があっても向きを決めない", noPartySeen && noPartyNeutral);
  {
    const ff = factsOf("癸未", "丑", "辰");
    check("先後と尊卑が食い違うことを不足に出し、要約に両方の立場を書く",
      lit(ff, "litigation", { litigationStanding: { precedence: "initiator", rank: "junior" } }, "子").missing.some((m) => m.key === "standingConflict") &&
      lit(ff, "litigation", { litigationStanding: { precedence: "initiator", rank: "junior" } }, "子").summary.includes("先後の方式で客・日") &&
      lit(ff, "litigation", { litigationStanding: { precedence: "initiator", rank: "junior" } }, "子").summary.includes("尊卑の方式で主・辰"));
    check("尊卑だけのときは、『指南』の規則に先後がないことを不足に出す", lit(ff, "litigation", { litigationStanding: { rank: "senior" } }, "子").missing.some((m) => m.key === "litigationStanding" && m.detail.includes("先後")));
  }
  check("現実の原告・被告（legalPosition）は読みにも向きにも使わない", legalSame);
  check("立場によって読み（key・label・detected）は変えない", labelsSame);
  const f = factsOf("癸未", "丑", "辰");
  check("要約に、原告・被告を古典の主客に対応させないことと、官府・仲裁者を固定しないことを書く",
    lit(f, "litigation", { ...GUEST, legalPosition: "plaintiff" }, "子").summary.includes("現実の立場は原告（古典の主客には対応させない）") &&
    lit(f, "litigation", {}, "子").summary.includes("官府・仲裁者は盤上の特定の位置に固定しない"));
  check("立場がなければ不足に出す（原告・被告から自動で決めない）",
    lit(f, "litigation", { legalPosition: "plaintiff" }, "子").missing.some((m) => m.key === "litigationStanding"));
  check("本人の問い・代理の問い・未指定を区別する",
    litigantRelationOf({ domain: "litigation", subjectPersonId: "A", litigantPersonId: "A" }) === "self" &&
    litigantRelationOf({ domain: "litigation", subjectPersonId: "A", litigantPersonId: "B" }) === "proxy" && litigantRelationOf({ domain: "litigation", subjectPersonId: "A" }) === "unknown");
  check("代理の問いを要約に書く", lit(f, "litigation", { persons: [{ id: "A" }, { id: "B" }], subjectPersonId: "A", litigantPersonId: "B" }, "子").summary.includes("代理の問い"));
  check("双方に及ぶ読み（彼此全傷・貴人の空亡）は立場によらず同じ向き",
    (() => { for (let i = 0; i < 60; i++) for (const j of BRANCHES) { const ff = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子");
      for (const k of ["bothHurt", "voidNoble"]) { const a = dir(lit(ff, "litigation"), k); if (a && (a !== "hindering" || dir(lit(ff, "litigation", GUEST), k) !== a || dir(lit(ff, "litigation", HOST), k) !== a)) return false; } } return true; })());
}

// ---- 4. goal ----
{
  let procNeutral = true, procDir = true, same = true, seen = 0;
  const goals: InterpretationGoal[] = ["avoid", "reconcile", "release"];
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 2) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const base = lit(f, "litigation", {}, "寅"), acq = lit(f, "litigation", { goal: "acquire" }, "寅");
    for (const x of [...base.readings, ...acq.readings]) if (PROCESS_KEYS.includes(x.key) && x.direction !== "neutral" && !(x.key === "ghostIn34")) procNeutral = false;
    for (const gl of goals) {
      const r = lit(f, "litigation", { goal: gl }, "寅");
      if (r.readings.map((x) => `${x.key}${x.detected}`).join() !== base.readings.map((x) => `${x.key}${x.detected}`).join()) same = false;
      for (const x of r.readings) if (PROCESS_KEYS.includes(x.key)) {
        seen += 1;
        const want = x.key === "bothOvercomeGou" ? "favoring" : "hindering";
        if (x.direction !== want && !(x.key === "ghostIn34" && x.direction === "neutral")) procDir = false;
      }
    }
  }
  check("発生・激化・長期化・収束は、goal がない・acquire なら向きを決めない（勝敗と別）", procNeutral);
  check("goal（avoid・reconcile・release）では、激化・長期化は妨げ、両和は追い風", seen > 0 && procDir);
  check("goal で読み（key・detected）は変えない", same);
  check("訴訟に使わない goal は不足に出す", lit(factsOf("癸未", "丑", "辰"), "litigation", { goal: "discover" }, "子").missing.some((m) => m.key === "goal"));
}

// ---- 5. 象意・空亡・出力 ----
{
  let symbolNeutral = true, symbolOnly = false;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const r = lit(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子"), "litigation", GUEST, "寅");
    const s = reading(r, "ghostSymbol");
    if (s && s.direction !== "neutral") symbolNeutral = false;
    if (s && !r.readings.some((x) => ["outbreak", "verdict"].includes(x.topic!))) symbolOnly = true;
  }
  check("官鬼の象意は向きを決めない（官鬼だけで訴訟の発生・敗訴としない）", symbolNeutral);
  check("官鬼があっても発生・勝敗の読みがない盤があり、その要約は断定しない", symbolOnly);
  const code = readFileSync("src/lib/liuren/interpretation/litigationDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const rules = code.slice(code.indexOf("const LITIGATION_RULES"), code.indexOf("export function litigantRelationOf"));
  check("訴訟のルールは坐空を使わない（旬空だけ）", !rules.includes("isSeatedOnVoid"));
  const r = lit(factsOf("癸未", "丑", "辰"), "litigation", {}, "子");
  check("要約は古典の読みと現実の法律上の判断を分け、法的助言の代わりにしない",
    r.summary.startsWith("【古典の読み】") && r.summary.includes("現実の法律上の判断ではなく") && r.summary.includes("弁護士などの専門家"));
  check("訴訟の要約に段階（発生・激化・優劣・勝敗・進展・和解・損失・長期化）を分けて書く",
    ["・争いが生じる兆候:", "・激化:", "・当事者間の優劣:", "・勝敗に関する古典的判断:", "・訴訟の進展・官府:", "・和解・収束:", "・争いによる損失:", "・長期化・停滞:"].every((x) => r.summary.includes(x)));
}

// ---- 6. 720課・基盤 ----
const SUBS = ["litigation", "dispute", "settlement"] as const;
const FORBIDDEN = /勝訴率|勝つ確率|[0-9０-９]+\s*(%|％|円|元|割)|賠償額は|判決日は|判決は[^。]*日|懲役|罰金/;
const counts: Record<string, number> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0, forbidden = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  const ctxs: InterpretationContext[] = [];
  for (const subtype of SUBS) for (const m of [0, 1, 2]) ctxs.push({ domain: "litigation", subtype,
    ...(m >= 1 ? { persons: [{ id: "P" }, { id: "Q" }], subjectPersonId: "P", litigantPersonId: m === 1 ? "P" : "Q", counterpartyPersonId: "Q",
      litigationStanding: m === 1 ? { precedence: "initiator" } : { precedence: "initiator", rank: "junior" }, goal: m === 1 ? "acquire" : "reconcile",
      taiSui: taiSuiStateOf(BRANCHES[(i * 7 + o) % 12] as Branch) } : {}) });
  for (const ctx of ctxs) for (const mb of [month, null]) {
    try {
      const r = evaluateLitigationDomain(facts, ctx, mb);
      evaluated += 1;
      if (JSON.stringify(evaluateLitigationDomain(facts, ctx, mb)) !== JSON.stringify(r)) nondeterministic += 1;
      if (FORBIDDEN.test(r.summary.replace(/[「『][^」』]*[」』]/g, ""))) forbidden += 1;
      if (mb) for (const x of r.readings) counts[x.ruleId] = (counts[x.ruleId] ?? 0) + 1;
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×占的3×人物・立場・goal 3×月支有無 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 3 * 3 * 2 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("要約に勝訴の確率・金額・判決日・刑罰を出さない", forbidden === 0, `${forbidden}`);
{
  const f = factsOf("癸未", "丑", "辰");
  check("月支がなければ旺相休囚の読みは出さず、不足に出す",
    lit(f, "litigation").readings.every((x) => !["restDeath", "gouTigerWeak"].includes(x.key)) && lit(f, "litigation").missing.some((m) => m.key === "monthBranch"));
  check("太歳がなければ太歳の読みは出さず、不足に出す",
    lit(f, "litigation", {}, "子").readings.every((x) => !["zhuOvercomesTaiSui", "taiSuiNoble"].includes(x.key)) && lit(f, "litigation", {}, "子").missing.some((m) => m.key === "taiSui"));
  const dead = LITIGATION_DOMAIN_RULES.filter((x) => !counts[x.id]).map((x) => x.id);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const always = LITIGATION_DOMAIN_RULES.filter((x) => x.reading.key !== "roles" && (counts[x.id] ?? 0) >= 720 * 3).map((x) => x.id);
  check("役割の対応以外に、すべての盤で成立するルールがない", always.length === 0, always.join(","));
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』", "『六壬神課講座』"];
  check("全ルールに出典・推論レベル・topic・占的（subtypes）がある",
    LITIGATION_DOMAIN_RULES.every((x) => x.reading.citations.length > 0 && x.reading.citations.every((c) => allowed.includes(c.source)) && !!x.reading.topic && !!x.when.subtypes?.length && ["direct", "combined", "inferred"].includes(x.reading.level)));
  check("講座の引用は layer＝講座、漢籍は原文・注で区別する",
    LITIGATION_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => (c.source === "『六壬神課講座』") === (c.layer === "講座") && (c.source === "『六壬神課講座』" || c.layer === "原文" || c.layer === "注"))));
  check("古典占験から取った引用は占験の番号を出典に書く", LITIGATION_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => !["勾乘卯生日干丁", "赤鸟犯岁君", "朱雀戌克太岁子也"].includes(c.quote) || /占験(三|十七)$/.test(c.locator))));
  check("ルール ID が重複しない", new Set(LITIGATION_DOMAIN_RULES.map((x) => x.id)).size === LITIGATION_DOMAIN_RULES.length);
  const hit = ["score", "xingNianOf", "calculateLiuren"].filter((w) => code0().includes(w));
  check("点数・行年の計算・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤を使う", /evaluateDomainRules\(LITIGATION_RULES/.test(code0()) && /buildDomainBoardInput\(/.test(code0()) && /summarizeDomainReadings\(/.test(code0()));
}
function code0(): string { return readFileSync("src/lib/liuren/interpretation/litigationDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, ""); }

console.log("実占例（四課・三伝・天将・主客・検出した規則・占断・結果を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("占験二十（訴訟・当事者が客・月 子・歳 丑）の要約:");
console.log(lit(factsOf("癸未", "丑", "辰"), "litigation", { ...GUEST, taiSui: taiSuiStateOf("丑") }, "子").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log("同じ盤を和解（goal reconcile）で見た要約:");
console.log(lit(factsOf("癸未", "丑", "辰"), "settlement", { goal: "reconcile" }, "子").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（月支あり）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace("litigation.", "")} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${LITIGATION_DOMAIN_RULES.length}（訴訟 ${LIT_KEYS.size}・争い ${DIS_KEYS.size}・和解 ${SET_KEYS.size}。重複あり）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
