// tests/liuren_interpretation_pregnancy_domain.manual.ts
//
// 六壬神課 Phase 5I（妊娠・出産 evaluatePregnancyDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_pregnancy_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』孕産章第八の古典占験5例と『六壬心鏡』産育門の越王の例を、四課・三伝・天将・母体と胎児の類神・
//      妊娠と出産の規則・原典の占断・結果に分けて確認する（三伝が一致しても占断の一致とはしない。結果の医学的な正しさは扱わない）。
//      同じ書の句をそのまま使う占断・規則の出典の例は、独立した検証と呼ばない。
//      『六壬大全』の損孕格・互胎格の日の一覧（規則の出典そのもの）で、胎神の取り方を確認する
//   2. 占的: 妊娠の兆候・妊娠中の経過・出産は別の規則表。未指定は不足を返す
//   3. 胎・出産の進行・母子・男女を別の topic に持ち、男女は吉凶に入れない
//   4. 人物: 当事者（pregnantPersonId）と問う人を分け、胎児を人物として持たない。胎神が決まらない日（戊己）は推測しない
//   5. 子孫だけで妊娠としない。旬空と坐空を分ける。goal で読みを変えない。相反する読みを併記する
//   6. 医学的な判定・確率・日時を出さない。720課で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { PREGNANCY_DOMAIN_RULES, evaluatePregnancyDomain, pregnantRelationOf } from "../src/lib/liuren/interpretation/pregnancyDomain";
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
type F = ReturnType<typeof factsOf>;
const seq = (f: F) => f.transmissions!.map((t) => t.branch).join("");
const lessons = (f: F) => f.lessons.map((l) => `${l.upper}${l.index === 1 ? f.basic.dayStem : l.lowerBranch}`).join(" ");
const gens = (f: F) => f.transmissions!.map((t) => f.generals.generalOn[t.branch]).join("・");
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
type Sub = "conception" | "maintain" | "delivery";
const ev = (f: F, sub: Sub, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluatePregnancyDomain(f, { domain: sub === "delivery" ? "childbirth" : "pregnancy", subtype: sub, ...extra } as InterpretationContext, month);
const keysOf = (sub: string) => new Set(PREGNANCY_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes(sub)).map((x) => x.reading.key));
const CON_KEYS = keysOf("conception"), MAI_KEYS = keysOf("maintain"), DEL_KEYS = keysOf("delivery");
const topicOf = (k: string) => PREGNANCY_DOMAIN_RULES.find((x) => x.reading.key === k)!.reading.topic!;
const days720 = (pred: (f: F) => boolean) => { const out = new Set<string>(); for (let i = 0; i < 60; i++) for (const j of BRANCHES) { const d = `${STEMS[i % 10]}${BRANCHES[i % 12]}`; if (pred(factsOf(d, j as Branch, "子"))) out.add(d); } return [...out].sort().join(","); };

// ---- 1. 実占例 ----
type Case = { name: string; day: string; shi: Branch; jiang: Branch; month: Branch; lessons: string; seq: string; seqMatch: boolean; gens: string | null;
  symbols: string; sourceVerdict: string; outcome: string; found: string[]; verdict: string };
// 四課は「上神＋下（一課は日干）」で、原典の課式の上段・下段を右から読んだもの。gens は原典の三伝の天将（原典と一致しないものも原典の値を書く）
const CASES: Case[] = [
  { name: "占験一（田妃の六甲）", day: "癸丑", shi: "酉", jiang: "卯", month: "亥", lessons: "未癸 丑未 未丑 丑未", seq: "未丑未", seqMatch: true, gens: "太常・朱雀・太常",
    symbols: "胎神 午（原典「胎神夾克無氣」と同じ支）", sourceVerdict: "男子の祥だが生まれて育ち難く、卯年に応ず（純陰返陽・支上と支が比。胎神が夾克され無気）", outcome: "第六子を生み、卯年に没",
    found: ["taiGroundBad", "harmChildXJ", "transmissionsOvercome", "siteAndInitialHarm"],
    verdict: "部分一致：胎神が地盤に剋される・子を害する形（『心鏡』注・『直指』）は原典の「育ち難い」に合う。原典の「夾克」は天将も見るが、規則は地盤だけを見る。男女は『直指』の干上（女）と『心鏡』の発用（男）が食い違い、原典の根拠（純陰返陽）とも別" },
  { name: "占験二（傅氏の六甲）", day: "辛卯", shi: "戌", jiang: "戌", month: "辰", lessons: "戌辛 戌戌 卯卯 卯卯", seq: "卯子午", seqMatch: false, gens: null,
    symbols: "胎神 卯（原典の割注「金胎在卯」と一致）", sourceVerdict: "双胎で二男、八月戌日辰時に生まれ母子清吉（月建が重なり胎神が旺気）", outcome: "原典に記載なし（不明）",
    found: ["taiGroundGood", "sexStemUpper"],
    verdict: "部分一致：胎神が旺の地（帝旺・比和）は原典の「胎神乘旺氣」に合い、干上 戌 が陽（男）は原典の男に合う。双胎・産日は扱わない。三伝は原典が伏吟の卯子卯、エンジンが卯子午で一致しない（起課は変更しない）" },
  { name: "占験三（馮氏の六甲）", day: "乙酉", shi: "酉", jiang: "酉", month: "巳", lessons: "辰乙 辰辰 酉酉 酉酉", seq: "辰酉卯", seqMatch: true, gens: "勾陳・天后・青龍",
    symbols: "日干の胎神 酉（原典「酉為日之胎鬼」と一致）・日支の胎神 卯（原典「卯作支之胎神」と一致）", sourceVerdict: "双胎で一男一女、男は生き女は死ぬ", outcome: "原典に記載なし（不明）",
    found: ["taiGroundGood", "taiGroundBad"],
    verdict: "判断材料が限られる：胎神 酉 が地盤 酉 に落ち、比和・帝旺（吉）と自刑（凶）が同時に出る（相殺しない）。双胎・男女別の生死は扱わない" },
  { name: "占験四（回子の生育）", day: "辛丑", shi: "亥", jiang: "戌", month: "卯", lessons: "酉辛 申酉 子丑 亥子", seq: "子亥戌", seqMatch: true, gens: "太陰・玄武・太常",
    symbols: "原典は胎神を挙げない（不明）。天后（母）は原典では地盤に剋される", sourceVerdict: "難産で子母とも亡ぶ（河魁が亥を渡り阻隔・天獄・干上の虎の遁鬼・天后が剋される）", outcome: "子が出ないうちに母が亡くなった",
    found: ["kuiCrossesGate", "nobleAndTransmissions", "lianru", "stemUpperGeneratesSite", "taiGroundBad"],
    verdict: "部分一致：魁度天門・貴人と三伝の逆・退茹・干上が支上を生ず（難）は原典の難産に合う。ただし魁度天門は原典の占断が規則と同じ書の句を使うので独立した検証ではない。三伝の子孫（易い）・太常（驚恐なし）は反対の読みで併記する。天将が一致しないので、原典の天后が剋される形は再現しない" },
  { name: "占験五（戴氏の来意）", day: "癸卯", shi: "午", jiang: "申", month: "巳", lessons: "卯癸 巳卯 巳卯 未巳", seq: "未酉亥", seqMatch: true, gens: "朱雀・勾陳・天空",
    symbols: "胎神 午（占時。原典「時為日之胎神」と一致）", sourceVerdict: "六甲の占で男。支が干に加わり俯いて子を見るので生まれるのは順利、四課不備で月が足りず六月に生まれる", outcome: "一々断のとおり",
    found: ["incomplete", "branchOnStem", "motherChildSafe"],
    verdict: "部分一致：四課不備（月が足りない）・支臨干位（順利）は原典と同じだが、どちらも同じ書（『指南』）の句なので独立した検証ではない。日辰の相生（安）は原典の判断に合う。干上が支上を生ず・間伝は反対の読みで併記。天罡が孟（古典は難）は参考として本文に残し、向きに入れない。男女は規則（女）と原典（干上の卯＝震の長男）が合わない" },
];
const caseLines: string[] = [];
let gensMatched = 0;
for (const c of CASES) {
  const f = factsOf(c.day, c.jiang, c.shi);
  const m = ev(f, "maintain", {}, c.month), d = ev(f, "delivery", {}, c.month);
  check(`${c.name} 四課 ${c.lessons}（原典と一致）`, lessons(f) === c.lessons, lessons(f));
  check(`${c.name} 三伝 ${c.seq}${c.seqMatch ? "（原典と一致）" : "（エンジンの値。原典と不一致を記録）"}`, seq(f) === c.seq, seq(f));
  for (const k of c.found) check(`${c.name} 規則 ${k} を検出`, !!reading(m, k) || !!reading(d, k), keys(d));
  const g = c.gens !== null && gens(f) === c.gens;
  if (g) gensMatched += 1;
  caseLines.push(`${c.name} ${c.day}日 ${c.shi}時 ${c.jiang}将 月${c.month}｜四課 一致｜三伝 ${c.seqMatch ? "一致" : "不一致（原典 卯子卯／エンジン 卯子午）"}｜天将 ${g ? "一致" : `不一致（エンジン ${gens(f)}${c.gens ? `／原典 ${c.gens}` : ""}。原因は未確定・起課は変更しない）`}｜類神 ${c.symbols}｜原典 ${c.sourceVerdict}｜結果 ${c.outcome}｜${c.verdict}｜出産 ${keys(d)}`);
}
check("三伝は5例中4例一致（占験二の伏吟は不一致）、天将は占験一・五の2例だけ一致", CASES.filter((c) => c.seqMatch).length === 4 && gensMatched === 2);
{
  // 『心鏡』産育門の越王の例（原文の句の出典。独立した検証ではない）: 四月辛巳日子時、胜光が克下 → 男
  const f = factsOf("辛巳", "申", "子");
  const r = ev(f, "maintain", {}, "巳");
  check("『心鏡』越王の例（四月辛巳日子時 申将）: 発用 午 が上剋下で、古典は男とする（原典の判断・結果と同じ。規則の出典の例）", reading(r, "sexInitialZeike")?.detected.includes("男とする") === true && seq(f)[0] === "午");
  caseLines.push("『心鏡』越王の例（四月辛巳日子時 申将）｜発用 午 が第一課の上剋下で、古典は男とする（原典の判断と結果は男）。規則の出典の例で、独立した検証ではない");
  // 『大全』の日の一覧（規則の出典そのもの）
  const loss = days720((x) => !!reading(ev(x, "maintain"), "voidTaiMaintain"));
  check("『大全』損孕格の日の一覧のうち、土の日（戊午・己未）を除く8日（甲戌・乙亥・丙辰・丁巳・庚戌・辛亥・壬辰・癸巳）が720課と一致",
    loss === ["甲戌", "乙亥", "丙辰", "丁巳", "庚戌", "辛亥", "壬辰", "癸巳"].sort().join(","), loss);
  const mutual = days720((x) => !!reading(ev(x, "conception"), "mutualTai"));
  check("『大全』互胎格: 土を含まない日（甲申・庚寅）は一致。甲寅・庚申（干の寄宮と支が同じ）は原典の一覧にない。土の日は原典の中で胎神が子（乙丑・癸未）と午（丁丑）に分かれる",
    mutual === ["甲申", "庚寅", "甲寅", "庚申"].sort().join(","), mutual);
  caseLines.push(`『大全』損孕格・互胎格の日の一覧｜損孕格 土の日以外の8日が一致／互胎格 甲申・庚寅が一致（エンジンは甲寅・庚申も出す）。土の日は原典の中で胎神の取り方が分かれる`);
}

// ---- 2. 占的 ----
{
  const f = factsOf("癸卯", "申", "午");
  const c = ev(f, "conception", {}, "巳"), m = ev(f, "maintain", {}, "巳"), d = ev(f, "delivery", {}, "巳");
  check("妊娠の兆候・妊娠中の経過・出産は別の規則表（他の占的の規則を出さない）",
    c.readings.every((x) => CON_KEYS.has(x.key)) && m.readings.every((x) => MAI_KEYS.has(x.key)) && d.readings.every((x) => DEL_KEYS.has(x.key)));
  check("妊娠の兆候の規則表は兆候（sign）だけで、出産の進行・母子・男女を含まない", [...CON_KEYS].every((k) => topicOf(k) === "sign"));
  check("妊娠中の経過には出産の進行・母子の規則を含まない", [...MAI_KEYS].every((k) => !["progress", "motherChild"].includes(topicOf(k))));
  check("出産の進行（progress）と母子（motherChild）は別の topic", [...DEL_KEYS].some((k) => topicOf(k) === "progress") && [...DEL_KEYS].some((k) => topicOf(k) === "motherChild"));
  for (const [dom, sub] of [["pregnancy", "general"], ["childbirth", "general"], ["pregnancy", "delivery"], ["childbirth", "maintain"]] as const) {
    const r = evaluatePregnancyDomain(f, { domain: dom, subtype: sub } as InterpretationContext);
    check(`${dom}・${sub} は判断せず不足を返す`, r.readings.length === 0 && r.missing.some((x) => x.key === "subtype"));
  }
}

// ---- 3. 男女・兆候・向き ----
{
  let sexNeutral = true, signNeutral = true, sexInOverview = false, ziSunOnly = false;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const c = ev(f, "conception", {}, "寅"), d = ev(f, "delivery", {}, "寅"), m = ev(f, "maintain", {}, "寅");
    for (const r of [m, d]) for (const x of r.readings) if (x.topic === "sex" && x.direction !== "neutral") sexNeutral = false;
    for (const r of [m, d]) if ([...r.overview.favoring, ...r.overview.hindering].some((x) => x.topic === "sex")) sexInOverview = true;
    for (const x of c.readings) if (x.direction !== "neutral") signNeutral = false;
    if (f.transmissions!.some((t) => t.relation === "子孫") && c.readings.length === 0) ziSunOnly = true;
  }
  check("胎児の男女の読みは向きを決めず、吉凶（追い風・妨げ）に入れない", sexNeutral && !sexInOverview);
  check("妊娠の兆候は向きを決めない（妊娠の有無を判定しない）", signNeutral);
  check("三伝に子孫があっても妊娠の兆候を出さない盤がある（子孫だけで妊娠としない）", ziSunOnly);
  check("妊娠の兆候の規則は子孫を条件にしない", ![...CON_KEYS].some((k) => PREGNANCY_DOMAIN_RULES.find((x) => x.reading.key === k)!.reading.label.includes("子孫")));
  const r = ev(factsOf("癸丑", "卯", "酉"), "delivery", {}, "亥");
  check("男女の説が食い違えば「判断が相反する事項」に書き、相殺しない", r.summary.includes("男女の説が出典ごとに食い違う") && r.readings.filter((x) => x.topic === "sex").length >= 2);
  const r3 = ev(factsOf("乙酉", "酉", "酉"), "maintain", {}, "巳");
  check("同じ胎神に吉（比和・帝旺）と凶（自刑）の読みが同時に出れば併記する", !!reading(r3, "taiGroundGood") && !!reading(r3, "taiGroundBad") && r3.summary.includes("胎に関する象意で追い風と妨げが併存"));
  check("『心鏡』注（干上・支上が相手の干支を傷つける）と『大全』全傷格（干支がそれぞれ上神に剋される）は傷の定義が違うので別の規則で併記",
    topicOf("harmChildXJ") === "motherChild" && topicOf("bothHurtDQ") === "motherChild" && !!reading(ev(factsOf("癸丑", "卯", "酉"), "delivery", {}, "亥"), "harmChildXJ") && !!reading(ev(factsOf("癸丑", "卯", "酉"), "delivery", {}, "亥"), "bothHurtDQ"));
}

// ---- 4. 人物・類神 ----
{
  check("当事者と問う人を区別する（本人・代理・未指定）",
    pregnantRelationOf({ domain: "pregnancy", subjectPersonId: "A", pregnantPersonId: "A" }) === "self" &&
    pregnantRelationOf({ domain: "pregnancy", subjectPersonId: "A", pregnantPersonId: "B" }) === "proxy" && pregnantRelationOf({ domain: "pregnancy", subjectPersonId: "A" }) === "unknown");
  const f = factsOf("癸卯", "申", "午");
  const p = ev(f, "delivery", { persons: [{ id: "A" }, { id: "B" }], subjectPersonId: "A", pregnantPersonId: "B" }, "巳");
  check("代理の問いを要約に書き、人物の違いで読みを変えない", p.summary.includes("代理の問い") && keys(p) === keys(ev(f, "delivery", {}, "巳")));
  const roles = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8");
  check("胎児を人物 ID として持たない", !/fetus\w*Id|child\w*PersonId|baby/i.test(roles));
  const TAI = ["mutualTai", "bellyOnTai", "taiGroundGood", "taiGroundBad", "voidTaiMaintain", "voidTaiDelivery"];
  let earthOk = true, earthSeen = false;
  for (const d of ["戊子", "己丑", "戊午", "己未"]) for (const j of BRANCHES) {
    const ff = factsOf(d, j as Branch, "子");
    for (const sub of ["conception", "maintain", "delivery"] as const) {
      const r = ev(ff, sub, {}, "寅");
      earthSeen = true;
      if (r.readings.some((x) => TAI.includes(x.key)) || !r.missing.some((x) => x.key === "taiEarth")) earthOk = false;
    }
  }
  check("戊己日は胎神が資料で決まらないので、胎神の規則を出さず不足に出す（推測しない）", earthSeen && earthOk);
  let seatedOnly = false, seatedOk = true;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const ff = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子");
    const tai = (["酉", "子", "卯", "午"] as Branch[]).find((b) => ({ 甲: "酉", 乙: "酉", 丙: "子", 丁: "子", 庚: "卯", 辛: "卯", 壬: "午", 癸: "午" } as Record<string, string>)[STEMS[i % 10]] === b);
    if (!tai) continue;
    const seated = !ff.xun.voidBranches.includes(tai) && ff.xun.voidBranches.includes(ff.plate.earthUnder[tai]);
    if (seated && ff.plate.earthUnder[tai] && relationOvercome(ff.plate.earthUnder[tai], tai)) { seatedOnly = true; if (reading(ev(ff, "maintain"), "voidTaiMaintain")) seatedOk = false; }
  }
  check("損孕格の「胎神作空」は旬空で見て、坐空（地盤が空）だけでは出さない", seatedOnly && seatedOk);
  // 胎神の算出（五行生墓法の胎）: 木＝酉・火＝子・金＝卯・水＝午。戊己は二説で出さない
  const TAI_OF: Record<string, string> = { 甲: "酉", 乙: "酉", 丙: "子", 丁: "子", 庚: "卯", 辛: "卯", 壬: "午", 癸: "午" };
  let taiOk = true;
  for (let i = 0; i < 60; i++) {
    const d = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, x = reading(ev(factsOf(d, "子", "子"), "maintain"), "roles")!.detected;
    const want = TAI_OF[d[0]];
    if (want ? !x.includes(`胎神は ${want}（日干の五行の胎）`) : !x.includes("胎神は戊己日のため資料の二説")) taiOk = false;
  }
  check("胎神は日干の五行の胎（木＝酉・火＝子・金＝卯・水＝午、陰陽一律）で、戊己日は二説として出さない", taiOk);
  // 日支が土なら日支の胎神が決まらず、互胎格を出さずに不足に出す
  let branchEarthOk = true, branchEarthSeen = false;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const d = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, earthBranch = ["丑", "辰", "未", "戌"].includes(d[1]);
    const r = ev(factsOf(d, j as Branch, "子"), "conception");
    const flagged = r.missing.some((x) => x.key === "taiEarthBranch");
    if (earthBranch) { branchEarthSeen = true; if (reading(r, "mutualTai") || !flagged) branchEarthOk = false; } else if (flagged) branchEarthOk = false;
  }
  check("日支が土の日は日支の胎神が決まらないので、互胎格を出さず不足に出す", branchEarthSeen && branchEarthOk);
  const rr = reading(ev(factsOf("癸卯", "申", "午"), "delivery"), "roles")!;
  check("類神は出典ごとに示し、問う人・当事者・胎児と混同しない（参考で向きなし）",
    rr.direction === "neutral" && rr.detected.includes("『直指』『心鏡』は日干") && rr.detected.includes("『直指』『指南』『大全』は天后") && rr.detected.includes("各規則はその出典の類神だけで読む") && /問う人・当事者・胎児とは別/.test(rr.directionNote ?? ""));
}
function relationOvercome(a: Branch, b: Branch): boolean {
  const E: Record<string, string> = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
  const C: Record<string, string> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
  return C[E[a]] === E[b];
}

// ---- 5. goal ----
{
  let same = true;
  const goals: (InterpretationGoal | undefined)[] = ["acquire", "maintain", "avoid", "discover"];
  for (let i = 0; i < 60; i++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[(i * 5) % 12] as Branch, "子");
    for (const sub of ["conception", "maintain", "delivery"] as const) {
      const base = keys(ev(f, sub, {}, "寅"));
      for (const g of goals) if (keys(ev(f, sub, { goal: g }, "寅")) !== base) same = false;
    }
  }
  check("goal で読みも向きも変えない（不足に明示）", same && ev(factsOf("癸卯", "申", "午"), "delivery", { goal: "avoid" }, "巳").missing.some((m) => m.key === "goal"));
}

// ---- 6. 720課・基盤 ----
const SUBS: Sub[] = ["conception", "maintain", "delivery"];
const FORBIDDEN = /[0-9０-９]+\s*(%|％|週|ヶ月|か月|日以内|時に)|妊娠しています|妊娠していません|流産します|死産します|安全です|危険です|男の子です|女の子です/;
const counts: Record<string, number> = {};
const boards: Record<string, Set<number>> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0, forbidden = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  for (const sub of SUBS) for (const m of [0, 1]) for (const mb of [month, null]) {
    const ctx = { domain: sub === "delivery" ? "childbirth" : "pregnancy", subtype: sub,
      ...(m ? { persons: [{ id: "P" }, { id: "Q" }], subjectPersonId: "P", pregnantPersonId: "Q", goal: "maintain" } : {}) } as InterpretationContext;
    try {
      const r = evaluatePregnancyDomain(facts, ctx, mb);
      evaluated += 1;
      if (JSON.stringify(evaluatePregnancyDomain(facts, ctx, mb)) !== JSON.stringify(r)) nondeterministic += 1;
      if (FORBIDDEN.test(r.summary.replace(/[「『][^」』]*[」』]/g, ""))) forbidden += 1;
      if (mb) for (const x of r.readings) { counts[x.ruleId] = (counts[x.ruleId] ?? 0) + 1; (boards[x.ruleId] ??= new Set()).add(i * 12 + o); }
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×占的3×人物2×月支有無 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 3 * 2 * 2 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("要約に医学的な判定・確率・日時を出さない", forbidden === 0, `${forbidden}`);
{
  const dead = PREGNANCY_DOMAIN_RULES.filter((x) => !counts[x.id]).map((x) => x.id);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const ALWAYS = ["roles", "sexStemUpper", "gangSeason"];
  const always = PREGNANCY_DOMAIN_RULES.filter((x) => !ALWAYS.includes(x.reading.key) && (boards[x.id]?.size ?? 0) >= 720).map((x) => x.id);
  check("類神の対応・干上の陰陽・天罡の孟仲季（資料が全場合を定める）以外に、すべての盤で成立するルールがない", always.length === 0, always.join(","));
  let alwaysNeutral = true, guarded = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    for (const sub of SUBS) for (const x of ev(f, sub, {}, "寅").readings) {
      if (ALWAYS.includes(x.key) && x.direction !== "neutral") alwaysNeutral = false;
      if (x.direction !== "neutral" && !/保証|判定|予測|状態を示さない/.test(x.directionNote ?? "")) guarded = false;
    }
  }
  check("どの盤でも成立する規則（類神・干上の陰陽・天罡の孟仲季）は向きを決めない（古典の判断は本文に残す）", alwaysNeutral &&
    ["孟。古典はまだ生まれず", "仲。古典は近い", "季。古典は既に生まれ"].every((w) => PREGNANCY_DOMAIN_RULES.some((x) => x.reading.key === "gangSeason") && readFileSync("src/lib/liuren/interpretation/pregnancyDomain.ts", "utf8").includes(w)));
  check("向きのある読みはすべて、医学的な判定・予測・安全の保証ではないことを注記する", guarded);
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』"];
  check("全ルールに出典・推論レベル・topic・占的（subtypes）がある",
    PREGNANCY_DOMAIN_RULES.every((x) => x.reading.citations.length > 0 && x.reading.citations.every((c) => allowed.includes(c.source) && (c.layer === "原文" || c.layer === "注")) && !!x.reading.topic && !!x.when.subtypes?.length && ["direct", "combined", "inferred"].includes(x.reading.level)));
  check("古典占験の割注から取った引用は占験の番号を出典に書く", PREGNANCY_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => c.quote !== "以金胎在卯故也" || c.locator.endsWith("占験二"))));
  check("ルール ID が重複しない", new Set(PREGNANCY_DOMAIN_RULES.map((x) => x.id)).size === PREGNANCY_DOMAIN_RULES.length);
  const code = readFileSync("src/lib/liuren/interpretation/pregnancyDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const hit = ["score", "xingNianOf", "calculateLiuren", "isSeatedOnVoid"].filter((w) => code.includes(w));
  check("点数・行年の計算・起課の呼び出し・坐空の FACT の参照がない（坐空は腹空格の「或落空」だけで地盤の旬空として見る）", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤を使う", /evaluateDomainRules\(PREGNANCY_RULES/.test(code) && /buildDomainBoardInput\(/.test(code) && /summarizeDomainReadings\(/.test(code));
  const s = ev(factsOf("癸卯", "申", "午"), "delivery", {}, "巳").summary;
  check("要約は古典の象意と医学的な判定を分け、医療専門職での確認を書く", s.startsWith("【古典の読み】") && s.includes("出産の安全性を判定するものではありません") && s.includes("医療専門職"));
  check("出産の要約は類神・胎・出産の進行・母子・男女・相反・判断できない事項を分ける",
    ["・古典の類神:", "・胎に関する象意:", "・出産の進行に関する象意:", "・母子に関する古典的象意:", "・胎児の男女に関する古典の説（判定ではない）:", "・判断が相反する事項:", "・判断できない事項:"].every((x) => s.includes(x)));
  check("神煞・行年・時期・胎位は不足に出す", ["shenSha", "noTiming", "presentation"].every((k) => ev(factsOf("癸卯", "申", "午"), "delivery", {}, "巳").missing.some((m) => m.key === k)));
}

console.log("実占例・規則の例（四課・三伝・天将・類神・規則・占断・結果を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("占験五（出産・月 巳）の要約:");
console.log(ev(factsOf("癸卯", "申", "午"), "delivery", {}, "巳").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（月支あり）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace("pregnancy.", "")} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${PREGNANCY_DOMAIN_RULES.length}（兆候 ${CON_KEYS.size}・経過 ${MAI_KEYS.size}・出産 ${DEL_KEYS.size}。重複あり）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
