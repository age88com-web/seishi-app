// tests/liuren_interpretation_xing_nian_rules.manual.ts
//
// 六壬神課 Phase 5O（行年の盤上の位置 xingNianPlacement.ts と、行年を使う DOMAIN 規則）のテスト。
// 実行: npx tsx tests/liuren_interpretation_xing_nian_rules.manual.ts
//
//   1. 盤上の位置: 地盤の行年（上神・その天将・上神の旬空・上神の課伝）と天盤の行年（加わる地盤・乗る天将・坐空・課伝）を facts と照合
//   2. 人物との対応: DOMAIN が指定した人物（行人・病人・財を求める人）の入力だけを使い、問う人の行年で代用しない。
//      入力なし・重複・女性・性別なし・数え年なしは求めない
//   3. 規則: 行人2（行年加孟仲季・行年上神が三伝。年臨三四は最終監査で保留）・疾病2（行年入三合墓・白虎が旺相で行年を剋す）・売買2（行年上神が青龍を剋す・
//      太歳上神が行年を剋す）が、原文の条件（「加」＝天盤の行年が加わる地盤・「行年上」＝上神・「克行年」＝行年の支）と720課で完全に一致
//   4. 古典の例: 『断案２』の原文の行年上神（例32・例43・例50・例51・例55）を placement で照合し、例43 の「行年ともに白虎」の天将も照合
//   5. IdentityLink・InterpretationPerson・ContextBranchSource は変えない。同じ入力で同じ結果。要約に医学的・断定的な語を出さない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { BRANCH_ELEMENT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { maleXingNianOf } from "../src/lib/liuren/interpretation/xingNian";
import { resolveXingNianPlacement, xingNianPlacementOf } from "../src/lib/liuren/interpretation/xingNianPlacement";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { rulingElementOfMonth, seasonalStrengthOf } from "../src/lib/liuren/interpretation/states";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";
import { evaluateTravelerDomain } from "../src/lib/liuren/interpretation/travelerDomain";
import { evaluateIllnessDomain } from "../src/lib/liuren/interpretation/illnessDomain";
import { evaluateWealthDomain } from "../src/lib/liuren/interpretation/wealthDomain";
import type { DomainResult } from "../src/lib/liuren/interpretation/domainResult";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
type F = ReturnType<typeof factsOf>;
const reading = (r: DomainResult, key: string) => r.readings.find((x) => x.key === key) ?? null;
const overcomes = (a: Branch, b: Branch) => relationBetween(a, b).relations.includes("overcomes");
const riding = (f: F, g: string) => (BRANCHES as readonly Branch[]).find((b) => f.generals.generalOn[b] === g)!;
const male = (personId: string, reckonedAge: number) => ({ personId, sex: "male" as const, reckonedAge });
const MENG = ["寅", "巳", "申", "亥"], ZHONG = ["子", "卯", "午", "酉"];
const TOMB: Record<string, string> = { 寅: "戌", 午: "戌", 戌: "戌", 申: "辰", 子: "辰", 辰: "辰", 巳: "丑", 酉: "丑", 丑: "丑", 亥: "未", 卯: "未", 未: "未" };

// ---- 1. 盤上の位置 ----
{
  let ok = true, n = 0, seatedOnly = 0, upperVoidOnly = 0;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    for (let age = 1; age <= 12; age++) {
      const p = xingNianPlacementOf(f, "A", maleXingNianOf(age)), b = p.branch, up = f.plate.heavenOn[b], v = f.xun.voidBranches; n += 1;
      const ls = (x: Branch) => f.lessons.filter((l) => l.upper === x).map((l) => l.index).join("");
      const ts = (x: Branch) => f.transmissions!.map((t, k) => (t.branch === x ? ["initial", "middle", "final"][k] : "")).filter(Boolean).join("");
      if (p.upper !== up || p.upperGeneral !== f.generals.generalOn[up] || p.upperIsVoid !== v.includes(up) || p.upperLessons.join("") !== ls(up) || p.upperTransmissions.join("") !== ts(up) ||
        p.skyEarth !== f.plate.earthUnder[b] || p.skyGeneral !== f.generals.generalOn[b] || p.skySeatedOnVoid !== v.includes(f.plate.earthUnder[b]) ||
        p.isVoid !== v.includes(b) || p.lessons.join("") !== ls(b) || p.transmissions.join("") !== ts(b)) ok = false;
      if (!p.isVoid && p.skySeatedOnVoid) seatedOnly += 1;
      if (!p.isVoid && p.upperIsVoid) upperVoidOnly += 1;
    }
  }
  check(`720課×数え1〜12（${n}件）で、地盤の行年（上神・天将・旬空・課伝）と天盤の行年（加わる地盤・天将・坐空・課伝）が facts と一致`, ok);
  check("行年の支の旬空・天盤の行年の坐空・行年上神の旬空を別々に持つ（行年が旬空でなくても坐空・上神が旬空の盤がある）", seatedOnly > 0 && upperVoidOnly > 0);
}

// ---- 2. 人物との対応 ----
{
  const f = factsOf("甲子", "卯");
  const base = { domain: "traveler", persons: [{ id: "Q" }, { id: "T" }], subjectPersonId: "Q", travelerPersonId: "T" } as unknown as InterpretationContext;
  const r = (ctx: object, id: string | undefined) => resolveXingNianPlacement(f, { ...base, ...ctx } as InterpretationContext, id);
  const reason = (x: ReturnType<typeof r>) => (x.status === "unresolved" ? x.reason : "resolved");
  check("人物 ID がなければ求めない", reason(r({}, undefined)) === "personIdMissing");
  check("その人物の入力がなければ求めない（他の人物の入力を使わない）", reason(r({ xingNianInputs: [male("Q", 40)] }, "T")) === "inputMissing");
  check("同じ人物の入力が重複していれば求めない", reason(r({ xingNianInputs: [male("T", 40), male("T", 41)] }, "T")) === "duplicateInput");
  check("女性・性別なし・数え年なしは求めない", reason(r({ xingNianInputs: [{ personId: "T", sex: "female", reckonedAge: 40 }] }, "T")) === "sexUnsupported" &&
    reason(r({ xingNianInputs: [{ personId: "T", reckonedAge: 40 }] }, "T")) === "sexMissing" && reason(r({ xingNianInputs: [{ personId: "T", sex: "male" }] }, "T")) === "reckonedAgeMissing");
  check("persons にない人物の入力は求めない", reason(r({ xingNianInputs: [male("Z", 40)] }, "Z")) === "personNotFound");
  // 行人 DOMAIN: 問う人（Q）の行年だけがあっても行年の規則は出さない
  let subjOnly = true;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch);
    const t = evaluateTravelerDomain(g, { ...base, subtype: "return", xingNianInputs: [male("Q", (i % 12) + 1)] } as InterpretationContext, "寅");
    if (t.readings.some((x) => x.key.startsWith("xingNian")) || !t.missing.some((m) => m.key === "xingNian" && m.detail.includes("問う人の行年は使わない"))) subjOnly = false;
  }
  check("行人: 問う人の行年を行人の行年として代用しない（行年の規則を出さず、不足に書く）", subjOnly);
}

// ---- 3. 規則 ----
{
  let travOk = true, illOk = true, wealthOk = true;
  const seen: Record<string, number> = {};
  const bump = (k: string, on: boolean) => { if (on) seen[k] = (seen[k] ?? 0) + 1; };
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    const mb = BRANCHES[(i + o) % 12] as Branch, age = ((i * 7 + o * 5) % 72) + 1, ts = BRANCHES[(i + o * 7) % 12] as Branch;
    const p = xingNianPlacementOf(f, "P", maleXingNianOf(age));
    // 行人
    const t = evaluateTravelerDomain(f, { domain: "traveler", subtype: "return", persons: [{ id: "P" }], travelerPersonId: "P", xingNianInputs: [male("P", age)] } as unknown as InterpretationContext, mb);
    const sky = reading(t, "xingNianSkyEarth"), upT = reading(t, "xingNianUpperInTransmissions");
    const cls = MENG.includes(p.skyEarth) ? "孟" : ZHONG.includes(p.skyEarth) ? "仲" : "季";
    if (!sky || (sky.direction === "favoring") !== (cls === "孟") || !sky.detected.includes(`（${cls}）`)) travOk = false;
    if (reading(t, "xingNianInLessons")) travOk = false;
    if (!!upT !== (p.upperTransmissions.length > 0)) travOk = false;
    bump("行人 加孟", cls === "孟"); bump("行人 上神が三伝", !!upT);
    // 行年上神が初伝でも発用元が一つの課に決まらない（ambiguousLessons・derived）盤: 入三傳としては成立し、「支上の二課から発用」とは書かない
    const origin = f.sanchuan.status === "determined" ? f.sanchuan.initialOrigin : null;
    if (upT && p.upperTransmissions.includes("initial") && origin && origin.kind !== "uniqueLesson" && origin.kind !== "ruleLesson") { bump("行人 上神が初伝・発用元未確定", true); if (upT.detected.includes("支上の二課から発用")) travOk = false; }
    if (upT && p.upperTransmissions.includes("initial") && origin && (origin.kind === "uniqueLesson" || origin.kind === "ruleLesson")) { bump("行人 上神が初伝・発用元確定", true); if (upT.detected.includes("支上の二課から発用") !== (origin.lesson >= 3)) travOk = false; }
    // 疾病
    const il = evaluateIllnessDomain(f, { domain: "illness", persons: [{ id: "P" }], patientPersonId: "P", xingNianInputs: [male("P", age)] } as unknown as InterpretationContext, mb);
    const tomb = p.branch !== TOMB[p.branch] && p.skyEarth === TOMB[p.branch];
    if (!!reading(il, "xingNianIntoTriadTomb") !== tomb) illOk = false;
    const tg = riding(f, "白虎"), s = seasonalStrengthOf(BRANCH_ELEMENT[tg], rulingElementOfMonth(mb));
    const tig = (s === "旺" || s === "相") && overcomes(tg, p.branch);
    if (!!reading(il, "tigerOvercomesXingNian") !== tig) illOk = false;
    bump("疾病 入三合墓", tomb); bump("疾病 白虎剋行年", tig);
    // 売買
    const w = evaluateWealthDomain(f, { domain: "wealth", subtype: "trading", persons: [{ id: "P" }], wealthSeekerPersonId: "P", taiSui: taiSuiStateOf(ts), xingNianInputs: [male("P", age)] } as unknown as InterpretationContext, mb);
    const dragon = overcomes(p.upper, riding(f, "青龍")), sui = overcomes(f.plate.heavenOn[ts], p.branch);
    if (!!reading(w, "xingNianUpperOvercomesDragon") !== dragon || !!reading(w, "taiSuiUpperOvercomesXingNian") !== sui) wealthOk = false;
    const ws = evaluateWealthDomain(f, { domain: "wealth", subtype: "seekingWealth", persons: [{ id: "P" }], wealthSeekerPersonId: "P", taiSui: taiSuiStateOf(ts), xingNianInputs: [male("P", age)] } as unknown as InterpretationContext, mb);
    if (reading(ws, "xingNianUpperOvercomesDragon") || reading(ws, "taiSuiUpperOvercomesXingNian")) wealthOk = false;
    bump("売買 上神制青龍", dragon); bump("売買 太歳上神剋行年", sui);
  }
  check("行人: 行年加孟仲季（天盤の行年が加わる地盤）・行年上神が三伝、の条件と完全に一致。年臨三四は出さない（保留）。発用元が一つの課に決まらない盤では「支上の二課から発用」と書かず、入三傳として成立する", travOk);
  check("疾病: 行年入三合墓（天盤の行年が三合の墓に加わる。墓の支そのものは除く）・白虎の乗神が旺相で行年の支を剋す、の条件と完全に一致", illOk);
  check("売買: 行年上神が青龍の乗神を剋す・太歳の上神が行年の支を剋す、の条件と完全に一致し、求財（seekingWealth）には出さない", wealthOk);
  check("各規則が720課のどこかで成立し、行年上神が初伝で発用元が決まる盤・決まらない盤の両方がある", ["行人 加孟", "行人 上神が三伝", "行人 上神が初伝・発用元未確定", "行人 上神が初伝・発用元確定", "疾病 入三合墓", "疾病 白虎剋行年", "売買 上神制青龍", "売買 太歳上神剋行年"].every((k) => (seen[k] ?? 0) > 0), JSON.stringify(seen));
  // 売買: 太歳がなければ太歳を使う規則は出さない
  let noTai = true;
  for (let i = 0; i < 60; i++) for (const j of BRANCHES) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, j as Branch);
    const w = evaluateWealthDomain(g, { domain: "wealth", subtype: "trading", persons: [{ id: "P" }], wealthSeekerPersonId: "P", xingNianInputs: [male("P", (i % 60) + 1)] } as unknown as InterpretationContext, "寅");
    if (reading(w, "taiSuiUpperOvercomesXingNian") || !w.missing.some((m) => m.key === "taiSuiForXingNian")) noTai = false;
  }
  check("売買: 太歳がなければ「太歳上神克行年」を出さず、不足に書く", noTai);
  // 人物の取り違え: 行人の入力だけでは疾病・売買の行年の規則を出さない（各 DOMAIN の人物 ID の入力だけを使う）
  const g0 = factsOf("甲子", "卯");
  const mixed = { persons: [{ id: "T" }, { id: "P" }], travelerPersonId: "T", patientPersonId: "P", wealthSeekerPersonId: "P", xingNianInputs: [male("T", 40)] };
  const il0 = evaluateIllnessDomain(g0, { domain: "illness", ...mixed } as unknown as InterpretationContext, "寅");
  const w0 = evaluateWealthDomain(g0, { domain: "wealth", subtype: "trading", ...mixed } as unknown as InterpretationContext, "寅");
  check("travelerPersonId の入力を patientPersonId・wealthSeekerPersonId の行年に使わない", il0.missing.some((m) => m.key === "xingNian" && m.detail.includes("入力")) && w0.missing.some((m) => m.key === "xingNian" && m.detail.includes("入力")));
  // 行年がなければ規則は出さない
  const f = factsOf("甲子", "卯");
  const none = evaluateIllnessDomain(f, { domain: "illness", persons: [{ id: "P" }], patientPersonId: "P" } as unknown as InterpretationContext, "寅");
  check("病人の行年の入力がなければ行年の規則を出さず、不足に理由を書く", !none.readings.some((x) => x.key.includes("XingNian") || x.key.startsWith("xingNian")) && none.missing.some((m) => m.key === "xingNian" && m.detail.includes("性別・数え年")));
}

// ---- 4. 古典の例（『断案２』原文の行年上神と天将） ----
const lines: string[] = [];
{
  const C: { name: string; day: string; jiang: Branch; shi: Branch; age: number; upper: Branch; general?: string }[] = [
    { name: "例32（74歳）「行年上巳」", day: "戊申", jiang: "巳", shi: "卯", age: 74, upper: "巳" },
    { name: "例43（42歳）「行年ともに白虎」", day: "丁丑", jiang: "午", shi: "未", age: 42, upper: "午", general: "白虎" },
    { name: "例50（来年46歳）「行年亥上には子」", day: "戊寅", jiang: "申", shi: "未", age: 46, upper: "子" },
    { name: "例50（49歳）「寅上に卯」", day: "戊寅", jiang: "申", shi: "未", age: 49, upper: "卯" },
    { name: "例51（41歳）「行年午上に申」", day: "癸亥", jiang: "未", shi: "巳", age: 41, upper: "申" },
    { name: "例55（30歳）「行年の上は申」", day: "戊申", jiang: "酉", shi: "申", age: 30, upper: "申" },
  ];
  let upperOk = true;
  for (const c of C) {
    const p = xingNianPlacementOf(factsOf(c.day, c.jiang, c.shi), "A", maleXingNianOf(c.age));
    if (p.upper !== c.upper) upperOk = false;
    lines.push(`『断案２』${c.name}｜行年 ${p.branch}｜行年上神 ${p.upper}（原典 ${c.upper}）｜行年上の天将 ${p.upperGeneral}${c.general ? `（原典 ${c.general}・${p.upperGeneral === c.general ? "一致" : "不一致。原因は未確定・起課は変更しない"}）` : "（原典に記載なし）"}`);
  }
  check("『断案２』の原文6か所の行年上神が placement と一致（行年の盤上参照の検証。7規則の独立した占験検証ではない）", upperOk);
  const p43 = xingNianPlacementOf(factsOf("丁丑", "午", "未"), "A", maleXingNianOf(42));
  lines.push(`例43 の天将は ${p43.upperGeneral === "白虎" ? "一致" : "不一致"}（エンジン ${p43.upperGeneral}）。原典は課の天将も白虎とする`);
  lines.push("不一致の記録（Phase 5N から変えない）: 『断案２』例46「45、6歳…子丑」（算法では戌・亥）、『指南』仕宦章 占験十一の注解（周延儒）");
  check("例46・周延儒の不一致は算法を変えずに残す（例46 の45・46歳は戌・亥）", maleXingNianOf(45).branch === "戌" && maleXingNianOf(46).branch === "亥");
}

// ---- 5. 既存構造・決定性・要約 ----
{
  const roles = readFileSync("src/lib/liuren/interpretation/roles.ts", "utf8");
  const person = roles.split("export interface InterpretationPerson")[1].split("}")[0];
  const src = roles.split("export type ContextBranchSource")[1].split(";")[0];
  check("InterpretationPerson・ContextBranchSource は変えない（行年の入力は InterpretationContext.xingNianInputs）", !/sex|reckonedAge|xingNian/.test(person) && !/xingNian/i.test(src) && roles.includes("xingNianInputs?: readonly XingNianInput[]"));
  const il = readFileSync("src/lib/liuren/interpretation/identityLink.ts", "utf8") + readFileSync("src/lib/liuren/interpretation/contextBranch.ts", "utf8");
  check("IdentityLink・contextBranch は行年を扱わない（行年専用の参照結果は xingNianPlacement）", !/xingNian/i.test(il));
  const f = factsOf("癸卯", "申", "午");
  const ctx = { domain: "illness", persons: [{ id: "P", natalYear: natalYearStateOf("丙", "申") }], patientPersonId: "P", xingNianInputs: [male("P", 40)] } as unknown as InterpretationContext;
  const before = JSON.stringify(ctx);
  const a = evaluateIllnessDomain(f, ctx, "巳"), b = evaluateIllnessDomain(f, ctx, "巳");
  check("同じ入力で同じ結果・CONTEXT を書き換えない", JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(ctx) === before);
  let unsafe = 0;
  const FORBID = /死|余命|不治|助からない|亡くな|必ず治|治ります|治りません/;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) {
    const g = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch);
    const r = evaluateIllnessDomain(g, { ...ctx, xingNianInputs: [male("P", ((i + o) % 60) + 1)] } as InterpretationContext, BRANCHES[(i + o) % 12] as Branch);
    if (FORBID.test(r.summary)) unsafe += 1;
  }
  check("疾病の要約に死亡・余命・治る／治らないの断定を出さない（行年の規則を含む）", unsafe === 0, `${unsafe}`);
}

console.log("古典の例（行年上神・天将）:");
for (const l of lines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
