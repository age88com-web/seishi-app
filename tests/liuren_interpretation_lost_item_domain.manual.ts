// tests/liuren_interpretation_lost_item_domain.manual.ts
//
// 六壬神課 Phase 5H（失物・盗難 evaluateLostItemDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_lost_item_domain.manual.ts
//
//   1. 実占例: 『大六壬指南』六畜章 占験一（失馬。失物・盗難の古典占験で取得できたのはこの1例）を、四課・三伝・天将・物の類神・
//      盗人の類神・所在・発見と回収・結果に分けて確認する（三伝が一致しても占断の一致とはしない）。
//      所在の規則（「地盤為方向」）はこの例の割注から取ったので、独立した検証と呼ばない。
//      『六壬心鏡』郇注・『六壬大全』の規則の例（出典そのもの）は、玄武・盗神の位置が出典の盤と同じかの確認
//   2. 占的: 失物・盗難・回収は別の規則表。回収は遺失か盗難か（lossCause）がなければ判断しない。未指定は不足を返す
//   3. 発見・捕獲・回収を別の段階として持ち、読み替えない
//   4. 人物: 所有者（ownerPersonId）と問う人を分ける。盗人を人物として持たない。物の類神は targetSymbol だけ
//   5. 玄武だけで盗難としない。兆候は向きを決めない。方位は資料の表があるもの（盗神）だけ
//   6. 相反する規則を相殺せず併記する。goal で読みも向きも変えない
//   7. 720課×占的×人物 で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { LOST_ITEM_DOMAIN_RULES, THIEF_GOD_DIRECTIONS, evaluateLostItemDomain, ownerRelationOf } from "../src/lib/liuren/interpretation/lostItemDomain";
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
const keys = (r: DomainResult) => r.readings.map((x) => `${x.key}:${x.direction}`).join(" ");
const lost = (f: F, subtype: DomainSubtype<"lostItem">, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateLostItemDomain(f, { domain: "lostItem", subtype, ...extra } as InterpretationContext, month);
const xuanOf = (f: F) => BRANCHES.find((b) => f.generals.generalOn[b as Branch] === "玄武") as Branch;
const keysOf = (sub: string) => new Set(LOST_ITEM_DOMAIN_RULES.filter((x) => x.when.subtypes?.includes(sub)).map((x) => x.reading.key));
const LP_KEYS = keysOf("lostProperty"), TH_KEYS = keysOf("theft"), RM_KEYS = keysOf("recovery:misplaced"), RS_KEYS = keysOf("recovery:stolen");
const SIGN_TOPICS = ["lossSign", "theftSign"], NEUTRAL_TOPICS = ["lossSign", "theftSign", "location", "movement", "relation"];
const sym = (b: Branch): Partial<InterpretationContext> => ({ targetSymbol: { kind: "branch", branch: b } });

// ---- 1. 実占例 ----
const caseLines: string[] = [];
{
  // 『指南』六畜章 占験一: 庚寅十月 癸卯日 庚申時、失馬の方向と得る日。知一・斫輪。原典「此以驛馬為馬」「陰神為形状，地盤為方向」
  const f = factsOf("癸卯", "卯", "申");
  const ctx = { ...sym("巳"), persons: [{ id: "Q" }], subjectPersonId: "Q", ownerPersonId: "Q" };
  const r = lost(f, "lostProperty", ctx, "亥"), rr = lost(f, "recovery", { ...ctx, lossCause: "misplaced" }, "亥");
  check("失馬 四課 申癸 卯申 戌卯 巳戌（原典と一致）", lessons(f) === "申癸 卯申 戌卯 巳戌", lessons(f));
  check("失馬 三伝 卯戌巳（原典と一致）", seq(f) === "卯戌巳", seq(f));
  check("失馬 三伝の天将 朱雀・白虎・貴人（原典と一致）", gens(f) === "朱雀・白虎・貴人", gens(f));
  check("失馬 物の類神 巳（原典「此以驛馬為馬」の驛馬。末伝）は旬空", f.transmissions![2].branch === "巳" && f.xun.voidBranches.includes("巳"));
  check("失馬 類神の地盤 戌（原典「馬居戌地故知在西北」と同じ地盤）を出し、方位の語には換算しない",
    !!reading(r, "symbolGround") && reading(r, "symbolGround")!.detected.includes("戌") && !/西北|西|北|東|东|南/.test(reading(r, "symbolGround")!.detected));
  check("失馬 『直指』の「類神所臨之地」は類神が旬空なので出さず、「不落空亡」が旬空か坐空か確定しないことを不足に出す（原典は空でも地盤で方向を取り、出旬で得た）",
    !reading(r, "symbolLocation") && r.missing.some((m) => m.key === "symbolVoid"));
  check("失馬 『指南』の「地盤為方向」は『直指』の規則と別の規則で、類神の空亡によらず出す", reading(r, "symbolGround")!.ruleId !== "lostItem.symbolLocation" && reading(r, "symbolGround")!.citations.every((c) => c.source === "『大六壬指南』"));
  check("失馬 発見の読みは相反する2つを併記（第四課 巳 が第一課 申 を剋す＝見える／第二課 卯 が第三課 戌 を剋す＝見えない）",
    reading(r, "lesson4OvercomesLesson1")?.direction === "favoring" && reading(r, "lesson2OvercomesLesson3")?.direction === "hindering" && r.overview.contradiction);
  check("失馬 回収（遺失）でも同じ発見の読みを出し、回収の段階は断定しない", keys(rr) === "lesson4OvercomesLesson1:favoring lesson2OvercomesLesson3:hindering" && rr.summary.includes("・回収の可能性: この盤では資料に根拠のある読みがない"));
  caseLines.push(`『指南』六畜章 占験一（失馬） 癸卯日 申時 卯将 月亥｜四課 一致｜三伝 一致（卯戌巳）｜天将 一致（朱雀・白虎・貴人）｜物の類神 巳（驛馬。原典の指定どおり targetSymbol で与える）・一致｜盗人の類神 不明（原典は盗難としない）｜所在 原典「西北山岗」（地盤 戌）＝エンジンの類神の地盤 戌（方位の語は出さない。規則の出典がこの例の割注なので独立した検証ではない）。『直指』の「類神所臨之地」は類神が旬空のため出さない（「不落空亡」が旬空か坐空か確定しない）｜発見 原典「三日必獲」＝第四課が第一課を剋す（見える）は合い、第二課が第三課を剋す（見えない）は合わない（相殺せず併記）｜回収 原典は出旬の乙巳日に得る（時期の算法は扱わない）｜結果 三日後に寻得｜${keys(r)}`);

  // 『心鏡』郇注の例（規則の出典そのもの）
  const e1 = factsOf("甲子", "辰", "酉");
  check("『心鏡』郇注の例（八月甲子日酉時）: 天罡（辰）が玄武・登明（亥）が盗神", xuanOf(e1) === "辰" && e1.plate.heavenOn["辰"] === "亥" && lost(e1, "theft").readings.some((x) => x.key === "theftRoles" && x.detected.includes("陰神 亥")));
  const e2 = factsOf("乙亥", "酉", "子");
  check("『心鏡』郇注の例（三月乙亥日子時。太乙が申に加わり玄武）: 巳が申に加わる盤だが、エンジンの玄武は酉（天将不一致。起課は変更しない）", e2.plate.earthUnder["巳"] === "申" && xuanOf(e2) === "酉");
  caseLines.push("『心鏡』郇注の例一（八月甲子日酉時 辰将）｜玄武 辰・盗神 亥 が原典と一致（規則の例で、独立した検証ではない）");
  caseLines.push("『心鏡』郇注の例二（三月乙亥日子時 酉将）｜原典の玄武 巳（太乙加申）／エンジンの玄武 酉。天将不一致（原因は未確定）");
  const e3 = BRANCHES.map((j) => factsOf("辛亥", j as Branch, "戌")).find((x) => seq(x) === "丑寅卯")!;
  check("『大全』太陽照武の例（辛亥日戌時 三伝丑寅卯）: 原典は初伝 丑 に玄武、エンジンは玄武 酉（天将不一致）", !!e3 && xuanOf(e3) === "酉" && e3.generals.generalOn["丑"] !== "玄武");
  caseLines.push("『大全』卷九の例（辛亥日戌時 三伝丑寅卯）｜原典は初伝 丑 に玄武・夜で賊を獲難い／エンジンの玄武は酉（天将不一致。原因は未確定）。太陽照武は玄武の位置が確定しないので規則にしない");
}

// ---- 2. 占的 ----
{
  const f = factsOf("癸卯", "卯", "申");
  const lp = lost(f, "lostProperty", sym("巳"), "亥"), th = lost(f, "theft", sym("巳"), "亥");
  check("失物・盗難は別の規則表（他の占的の規則を出さない）", lp.readings.every((x) => LP_KEYS.has(x.key)) && th.readings.every((x) => TH_KEYS.has(x.key)));
  const chapterOf = (k: string) => LOST_ITEM_DOMAIN_RULES.find((x) => x.reading.key === k)!.reading.citations.map((c) => c.locator).join();
  check("『直指』遺失の規則は盗難に、『直指』盗賊の規則は失物に当てはめない",
    [...TH_KEYS].every((k) => !chapterOf(k).includes("遺失")) && [...LP_KEYS].every((k) => !chapterOf(k).includes("盗賊") && !chapterOf(k).includes("賊盗章") || ["lostNotStolen", "ghostDrainXuanwu"].includes(k)));
  check("盗難の捕獲（capture）の規則は失物の規則表にない", LOST_ITEM_DOMAIN_RULES.filter((x) => x.reading.topic === "capture").every((x) => !x.when.subtypes!.includes("lostProperty") && !x.when.subtypes!.includes("recovery:misplaced")));
  const rNone = lost(f, "recovery", sym("巳"), "亥");
  check("回収は遺失か盗難か（lossCause）がなければ判断しない", rNone.readings.length === 0 && rNone.missing.some((m) => m.key === "lossCause"));
  check("回収（遺失）は遺失の規則表、回収（盗難）は盗難の規則表だけ",
    lost(f, "recovery", { ...sym("巳"), lossCause: "misplaced" }, "亥").readings.every((x) => RM_KEYS.has(x.key)) &&
    lost(f, "recovery", { ...sym("巳"), lossCause: "stolen" }, "亥").readings.every((x) => RS_KEYS.has(x.key)) &&
    [...RM_KEYS].every((k) => !RS_KEYS.has(k) || k === "symbolOnGrowth"));
  const g = lost(f, "general");
  check("占的が未指定なら判断せず不足を返す", g.readings.length === 0 && g.missing.some((m) => m.key === "subtype"));
  let threwTheft = false;
  try { evaluateLostItemDomain(f, { domain: "theft", subtype: "general" } as InterpretationContext); } catch { threwTheft = true; }
  const rolesSrc = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8");
  check("盗難は lostItem の subtype に限り、既存の domain theft は扱わない（theft の subtype は general のまま）", threwTheft && /\n\s*theft: "general";/.test(rolesSrc));
  let noSwitch = true;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const ff = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子");
    const r = lost(ff, "lostProperty", sym(BRANCHES[(i + 5) % 12] as Branch), "寅");
    if (r.readings.some((x) => x.topic === "theftSign") && r.readings.some((x) => !LP_KEYS.has(x.key))) noSwitch = false;
  }
  check("失物で盗難の兆候が出ても、盗難の規則に切り替えない", noSwitch);
}

// ---- 3. 発見・捕獲・回収 ----
{
  const topic = (k: string) => LOST_ITEM_DOMAIN_RULES.find((x) => x.reading.key === k)!.reading.topic;
  check("発見（見える／見えない・探せる）と回収（戻る・失われない）は別の topic", ["lesson4OvercomesLesson1", "lesson2OvercomesLesson3", "stemTaiyin"].every((k) => topic(k) === "discovery") &&
    ["symbolOnStemBranch", "nobleControls", "symbolOnGrowth", "middleLoot", "wealthVoid"].every((k) => topic(k) === "recovery"));
  check("盗人を捕える読み（capture）を回収（recovery）に読み替えない", ["xuanCatchable", "skyNet", "gouVsThiefGod", "transmissionsOldMethod", "transmissionsRuShi"].every((k) => topic(k) === "capture"));
  const f = factsOf("癸卯", "卯", "申");
  const s = lost(f, "theft", {}, "亥").summary;
  check("盗難の要約は捕獲と回収を別の行に書く", s.includes("・盗人を捕える古典の読み（物が戻ることとは別）:") && s.includes("・回収の可能性:"));
  const l = lost(f, "lostProperty", sym("巳"), "亥").summary;
  check("失物の要約は兆候・所在・第三者・発見・回収・判断できない事項を分ける",
    ["・紛失・盗難に関する兆候:", "・物の所在・移動:", "・第三者の関与:", "・発見の可能性:", "・回収の可能性:", "・判断できない事項:"].every((x) => l.includes(x)));
}

// ---- 4. 人物 ----
{
  check("所有者と問う人を区別する（本人・代理・未指定）",
    ownerRelationOf({ domain: "lostItem", subjectPersonId: "A", ownerPersonId: "A" }) === "self" &&
    ownerRelationOf({ domain: "lostItem", subjectPersonId: "A", ownerPersonId: "B" }) === "proxy" && ownerRelationOf({ domain: "lostItem", subjectPersonId: "A" }) === "unknown");
  const f = factsOf("癸卯", "卯", "申");
  check("代理の問いを要約に書き、所有者の違いで読みを変えない",
    lost(f, "lostProperty", { ...sym("巳"), persons: [{ id: "A" }, { id: "B" }], subjectPersonId: "A", ownerPersonId: "B" }, "亥").summary.includes("代理の問い") &&
    keys(lost(f, "lostProperty", { ...sym("巳"), persons: [{ id: "A" }, { id: "B" }], subjectPersonId: "A", ownerPersonId: "B" }, "亥")) === keys(lost(f, "lostProperty", sym("巳"), "亥")));
  const roles = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8");
  check("盗人を人物 ID として持たない（Context に盗人の人物の項目がない）", !/thief\w*PersonId|suspect\w*Id|culprit/i.test(roles));
  check("要約に、盤上の盗人の類神と実在の人物を分け、推定しないことを書く", lost(f, "theft", {}, "亥").summary.includes("実在の人物を盗人と推定しません"));
  let noSymbol = true;
  for (let i = 0; i < 60; i++) {
    const ff = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[i % 12] as Branch, "子");
    const r = lost(ff, "lostProperty", {}, "寅");
    if (r.readings.some((x) => ["symbolLocation", "symbolGround", "symbolWithXuanwu", "symbolOnStemBranch", "symbolOnGrowth"].includes(x.key)) || !r.missing.some((m) => m.key === "targetSymbol")) noSymbol = false;
    if (reading(r, "nobleControls") && reading(r, "nobleControls")!.detected.includes("類神")) noSymbol = false;
  }
  check("物の類神が指定されなければ、類神の読みを出さず不足に出す（推測しない）", noSymbol);
  check("天将で類神を指定すると、その天将が乗る支で読む", reading(lost(f, "lostProperty", { targetSymbol: { kind: "general", general: "貴人" } }, "亥"), "symbolGround")!.detected.includes("貴人（巳）"));
}

// ---- 5. 玄武・兆候・方位 ----
{
  let xuanOnly = false, signNeutral = true, dirOnlyTable = true, theftDirSeen = false;
  const DIR = /[东東西南北]方|正北|西北|东南|西南|北方|南方|东方|西方|近东|近西|靠北/;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const lp = lost(f, "lostProperty", sym(BRANCHES[(i + o) % 12] as Branch), "寅"), th = lost(f, "theft", {}, "寅");
    const xb = xuanOf(f);
    const inBoard = [...f.lessons.map((l) => l.upper), ...f.transmissions!.map((t) => t.branch)].includes(xb);
    if (inBoard && !lp.readings.some((x) => x.topic === "theftSign")) xuanOnly = true;
    for (const x of [...lp.readings, ...th.readings]) if (NEUTRAL_TOPICS.includes(x.topic!) && x.direction !== "neutral") signNeutral = false;
    for (const x of lp.readings) if (DIR.test(x.detected)) dirOnlyTable = false;
    for (const x of th.readings) if (DIR.test(x.detected)) {
      if (!["thiefGodDirectionZZ", "thiefGodDirectionXJ"].includes(x.key)) dirOnlyTable = false;
      theftDirSeen = true;
    }
  }
  check("玄武が課伝にあっても盗難の兆候を出さない盤がある（玄武だけで盗難としない）", xuanOnly);
  check("兆候・所在・移動・役割の読みは向きを決めない（盗難の兆候を所有者への不利とせず、事実も認定しない）", signNeutral);
  check("方位の語は、資料に支と方位の対応表がある盗神の規則だけで出す（類神・玄武の地盤は支のまま）", dirOnlyTable && theftDirSeen);
  check("盗神の方位表は『直指』と『心鏡』で別々に持つ（食い違う支：丑・寅・未・酉・戌）",
    (["丑", "寅", "未", "酉", "戌"] as Branch[]).every((b) => THIEF_GOD_DIRECTIONS.zhiZhi[b] !== THIEF_GOD_DIRECTIONS.xinJing[b]));
  check("『直指』の方位は盗神の天地盤が比和のとき、『心鏡』の方位は相生のときだけ出す", (() => {
    for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
      const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子"), r = lost(f, "theft");
      const g = f.plate.heavenOn[xuanOf(f)], u = f.plate.earthUnder[g];
      const same = ["寅卯", "巳午", "申酉", "亥子", "辰戌丑未"].some((s) => s.includes(g) && s.includes(u));
      if (!!reading(r, "thiefGodDirectionZZ") !== same) return false;
    }
    return true;
  })());
}

// ---- 6. 相反・goal ----
{
  let both = false;
  for (let i = 0; i < 60 && !both; i++) for (const j of BRANCHES) {
    const r = lost(factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子"), "theft", {}, "寅");
    const a = reading(r, "transmissionsOldMethod"), b = reading(r, "transmissionsRuShi");
    if (a && b && a.direction !== b.direction) { both = true; break; }
  }
  check("『直指』の旧法（初＝贓・中＝賊・末＝吏）と『入式』（初＝賊・中＝贓・末＝捕人）で向きが逆の盤があり、相殺せず併記する", both);
  let same = true;
  const goals: (InterpretationGoal | undefined)[] = ["discover", "recover"];
  for (let i = 0; i < 60; i++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[(i * 7) % 12] as Branch, "子");
    for (const sub of ["lostProperty", "theft"] as const) {
      const base = keys(lost(f, sub, sym("酉"), "寅"));
      for (const g of goals) if (keys(lost(f, sub, { ...sym("酉"), goal: g }, "寅")) !== base) same = false;
    }
  }
  check("goal（discover・recover）で読みも向きも変えない", same);
  check("失物に使わない goal は不足に出す", lost(factsOf("癸卯", "卯", "申"), "lostProperty", { goal: "reconcile" }, "亥").missing.some((m) => m.key === "goal"));
}

// ---- 7. 720課・基盤 ----
const SUBS = ["lostProperty", "theft", "recovery"] as const;
const FORBIDDEN = /[0-9０-９一二三四五六七八九十百]+\s*(里|人|日以内|日後|日に|km|キロ|メートル)|犯人は|盗んだのは/;
const counts: Record<string, number> = {};
const boards: Record<string, Set<number>> = {};
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0, forbidden = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  const ctxs: InterpretationContext[] = [];
  for (const subtype of SUBS) for (const m of [0, 1, 2]) ctxs.push({ domain: "lostItem", subtype,
    ...(m >= 1 ? { persons: [{ id: "P" }, { id: "Q" }], subjectPersonId: "P", ownerPersonId: m === 1 ? "P" : "Q", lossCause: m === 1 ? "misplaced" : "stolen",
      targetSymbol: m === 1 ? { kind: "branch", branch: BRANCHES[(i + 2 * o) % 12] as Branch } : { kind: "general", general: "太常" }, goal: m === 1 ? "discover" : "recover" } : {}) });
  for (const ctx of ctxs) for (const mb of [month, null]) {
    try {
      const r = evaluateLostItemDomain(facts, ctx, mb);
      evaluated += 1;
      if (JSON.stringify(evaluateLostItemDomain(facts, ctx, mb)) !== JSON.stringify(r)) nondeterministic += 1;
      if (FORBIDDEN.test(r.summary.replace(/[「『][^」』]*[」』]/g, ""))) forbidden += 1;
      if (mb) for (const x of r.readings) { counts[x.ruleId] = (counts[x.ruleId] ?? 0) + 1; (boards[x.ruleId] ??= new Set()).add(i * 12 + o); }
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×占的3×人物・原因・類神3×月支有無 を例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 3 * 3 * 2 && threw === 0 && nondeterministic === 0, `${evaluated}/${threw}/${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("要約に里数・人数・日付・犯人の断定を出さない", forbidden === 0, `${forbidden}`);
{
  let voidOk = true, groundIndep = false, refNeutral = true;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch, "子");
    for (const b of BRANCHES as readonly Branch[]) {
      if (b !== BRANCHES[(i + BRANCHES.indexOf(j)) % 12]) continue;
      const r = lost(f, "lostProperty", sym(b), "寅");
      const fall = f.xun.voidBranches.includes(b) || f.xun.voidBranches.includes(f.plate.earthUnder[b]);
      if (fall && (reading(r, "symbolLocation") || !r.missing.some((m) => m.key === "symbolVoid"))) voidOk = false;
      if (fall && reading(r, "symbolGround")) groundIndep = true;
    }
    for (const x of lost(f, "theft").readings) if (["theftRoles", "xuanwuGround", "generalsDirection"].includes(x.key) && (x.direction !== "neutral" || !x.directionNote!.startsWith("参考") || !/古典は|類神/.test(x.detected))) refNeutral = false;
  }
  check("類神が旬空・坐空なら『直指』の所在は出さず不足に出し、『指南』の地盤の読みは別に出す", voidOk && groundIndep);
  check("どの盤でも出る役割・玄武の地盤・順逆は参考（向きなし）で、盗人の存在を断定しない書き方", refNeutral);
  check("盗難の要約に、盗難を前提にした古典の読みで事実を確かめるものではないことを書く", lost(factsOf("癸卯", "卯", "申"), "theft", {}, "亥").summary.includes("盗難の事実を確かめるものではない"));
  check("位置が確定しない太陽照武・旬丁の遠去は規則にせず不足に出す", !LOST_ITEM_DOMAIN_RULES.some((x) => ["sunOnXuanwu", "xuanFar"].includes(x.reading.key)) &&
    lost(factsOf("癸卯", "卯", "申"), "theft", {}, "亥").missing.some((m) => m.detail.includes("太陽照武")));
}
{
  const code = readFileSync("src/lib/liuren/interpretation/lostItemDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const rules = code.slice(code.indexOf("const LOST_ITEM_RULES"), code.indexOf("export function ownerRelationOf"));
  check("失物のルールは坐空を使わない（旬空だけ）", !rules.includes("isSeatedOnVoid"));
  const dead = LOST_ITEM_DOMAIN_RULES.filter((x) => !counts[x.id]).map((x) => x.id);
  check("全ルールが720課のどこかで成立する（死んだルールがない）", dead.length === 0, dead.join(","));
  const ALWAYS = ["theftRoles", "xuanwuGround", "generalsDirection", "gouVsThiefGod", "symbolGround"];
  const always = LOST_ITEM_DOMAIN_RULES.filter((x) => !ALWAYS.includes(x.reading.key) && (boards[x.id]?.size ?? 0) >= 720).map((x) => x.id);
  check("役割・位置・順逆・勾陳と盗神の全場合（資料が全場合を定める）以外に、すべての盤で成立するルールがない", always.length === 0, always.join(","));
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』"];
  check("全ルールに出典・推論レベル・topic・占的（subtypes）がある",
    LOST_ITEM_DOMAIN_RULES.every((x) => x.reading.citations.length > 0 && x.reading.citations.every((c) => allowed.includes(c.source) && (c.layer === "原文" || c.layer === "注")) && !!x.reading.topic && !!x.when.subtypes?.length && ["direct", "combined", "inferred"].includes(x.reading.level)));
  check("古典占験の割注から取った引用は占験の番号を出典に書く", LOST_ITEM_DOMAIN_RULES.every((x) => x.reading.citations.every((c) => c.quote !== "阴神为形状，地盘为方向" || c.locator.endsWith("占験一"))));
  check("ルール ID が重複しない", new Set(LOST_ITEM_DOMAIN_RULES.map((x) => x.id)).size === LOST_ITEM_DOMAIN_RULES.length);
  const hit = ["score", "xingNianOf", "calculateLiuren"].filter((w) => code.includes(w));
  check("点数・行年の計算・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤を使う", /evaluateDomainRules\(LOST_ITEM_RULES/.test(code) && /buildDomainBoardInput\(/.test(code) && /summarizeDomainReadings\(/.test(code));
  const f = factsOf("癸卯", "卯", "申");
  check("要約は古典の象意の解釈で、盗難の事実や人物の責任を示さないことを書く", lost(f, "theft", {}, "亥").summary.includes("盗難の事実や人物の責任を示すものではありません"));
  check("行年・本命を使う読みと、盗人の人相・人数・里数は不足として出す", lost(f, "theft", {}, "亥").missing.some((m) => m.key === "xingNian") && lost(f, "theft", {}, "亥").missing.some((m) => m.key === "noPersonImage"));
}

console.log("実占例・規則の例（四課・三伝・天将・物の類神・盗人の類神・所在・発見と回収・結果を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("失馬（失物・類神 巳・月 亥）の要約:");
console.log(lost(factsOf("癸卯", "卯", "申"), "lostProperty", sym("巳"), "亥").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log("同じ盤を盗難として見た要約:");
console.log(lost(factsOf("癸卯", "卯", "申"), "theft", {}, "亥").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log(`720課（月支あり）の読みの発生数: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace("lostItem.", "")} ${v}`).join(" ／ ")}`);
console.log(`ルール数 ${LOST_ITEM_DOMAIN_RULES.length}（失物 ${LP_KEYS.size}・盗難 ${TH_KEYS.size}・回収（遺失）${RM_KEYS.size}・回収（盗難）${RS_KEYS.size}。重複あり）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
