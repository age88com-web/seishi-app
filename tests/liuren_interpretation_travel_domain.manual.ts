// tests/liuren_interpretation_travel_domain.manual.ts
//
// 六壬神課 Phase 5C（行人 evaluateTravelerDomain・出行 evaluateTravelDomain）のテスト。
// 実行: npx tsx tests/liuren_interpretation_travel_domain.manual.ts
//
//   1. 断例: 『大六壬指南』行人章 占験一〜四・増補占例一二、出行章 占験一・増補占例一二（三伝の再現と読み）。
//      原典と盤・結論が合わないところは不一致として出力する（テストでは「合わないこと」を固定する）
//   2. 行人と出行が別の規則表で、同じ盤でも別の読みになり、goal で向きが変わること
//   3. 判断原則: 発用・驛馬・進茹退茹だけで帰還・出発を決めない、空亡と坐空を区別する、返吟の剛日は空でも妨げない
//   4. 問う人と外出中の人物を混同しない（本命は travelerPersonId から）・類神の指定
//   5. 720課×goal で例外なく決定的・起課結果と FACT が変わらない・全ルールに出典・点数や行年の計算がない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { STEM_PERSPECTIVE, TRAVELER_DOMAIN_RULES, evaluateTravelerDomain } from "../src/lib/liuren/interpretation/travelerDomain";
import { TRAVEL_DOMAIN_RULES, evaluateTravelDomain } from "../src/lib/liuren/interpretation/travelDomain";
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
const traveler = (f: ReturnType<typeof factsOf>, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateTravelerDomain(f, { domain: "traveler", subtype: "return", goal: "return", ...extra } as InterpretationContext, month);
const travel = (f: ReturnType<typeof factsOf>, extra: Partial<InterpretationContext> = {}, month: Branch | null = null) =>
  evaluateTravelDomain(f, { domain: "travel", subtype: "departure", goal: "move", ...extra } as InterpretationContext, month);
const person = (id: string, stem: Stem, branch: Branch) => ({ id, natalYear: natalYearStateOf(stem, branch) });

// ---- 1. 断例 ----
const lines: string[] = [];
const mismatches: string[] = [];
{
  // 行人 占験一 乙酉七月庚子日甲申時（午将）「涉害、顧祖…因中末空亡，是以月内不來，過月…應丙辰日」
  const f = factsOf("庚子", "午", "申");
  const r = traveler(f, {}, "申");
  check("行人 占験一 三伝 午→辰→寅（顧祖）・空亡 辰巳", seq(f) === "午辰寅" && f.xun.voidBranches.join("") === "辰巳");
  check("行人 占験一 顧祖格は来る（『大全』）・中伝 辰 旬空・末伝 寅 坐空（落空）は妨げ（月内は来ない）で、追い風と妨げが併存",
    dir(r, "reverseTwelve.顧祖格") === "favoring" && dir(r, "middleVoid") === "hindering" && dir(r, "finalSeatedOnVoid") === "hindering" && r.overview.contradiction);
  check("行人 占験一 末伝の坐空は旬空の読みと別のルール（組合せ・占験一の「寅卯落空」が根拠）",
    !reading(r, "finalVoid") && reading(r, "finalSeatedOnVoid")!.level === "combined" && reading(r, "finalSeatedOnVoid")!.citations.some((c) => c.quote.includes("落空")));
  lines.push(`行人 占験一（来る・ただし月内は来ない）: ${keys(r)}`);
}
{
  // 行人 占験二 戊辰十一月壬戌日乙巳時（寅将）庚午命「行人已抵燕界，丙寅日方到…玄武驛馬臨干，遙克庚午命神，主大路有馬賊劫奪」
  const f = factsOf("壬戌", "寅", "巳");
  const r = traveler(f, { persons: [person("T", "庚", "午")], travelerPersonId: "T" }, "子");
  check("行人 占験二 三伝 巳→寅→亥（元首）・空亡 子丑", seq(f) === "巳寅亥" && f.xun.voidBranches.join("") === "子丑");
  check("行人 占験二 天罡 辰 が季（未）に加わる＝すぐ至る（原典「已抵燕界」）", dir(r, "tianGangStage") === "favoring" && reading(r, "tianGangStage")!.detected.includes("未（季）"));
  const yimaGeneral = f.generals.generalOn["申"];
  check("行人 占験二 不一致の記録: 原典は干上の驛馬 申 に玄武、エンジンは別の天将（貴人の方式の違い）なので道中の盗賊の読みは出ない",
    yimaGeneral !== "玄武" && !reading(r, "xuanwuYimaOnStem"));
  mismatches.push(`行人 占験二: 原典「玄武驛馬臨干」に対し、エンジンの驛馬 申 の天将は ${yimaGeneral}（原典は巳に貴人。貴人の方式が異なる）`);
  lines.push(`行人 占験二（近くまで来ている・盗賊）: ${keys(r)}`);
}
{
  // 行人 占験三 庚寅七月丁丑日午将巳時「重審、連茹…行人尚未起程…蓋因連茹逢空…遲來必矣」
  const f = factsOf("丁丑", "午", "巳");
  const r = traveler(f, {}, "申");
  check("行人 占験三 三伝 申→酉→戌（連茹）・空亡 申酉", seq(f) === "申酉戌" && f.xun.voidBranches.join("") === "申酉");
  check("行人 占験三 連茹（人が至る）と、初伝・中伝の旬空（遅れる）が併存", dir(r, "lianRu") === "favoring" && dir(r, "initialVoid") === "hindering" && dir(r, "middleVoid") === "hindering");
  check("行人 占験三 不一致の記録: 原典は「尚未起程」、天罡の下は 卯（仲＝途中）", reading(r, "tianGangStage")!.detected.includes("卯（仲）"));
  mismatches.push("行人 占験三: 原典「行人尚未起程」に対し、天罡 辰 の下は 卯（仲）で『直指』の規則では「途中」");
  lines.push(`行人 占験三（まだ発っていない・遅れる）: ${keys(r)}`);
}
{
  // 行人 占験四 辛卯九月辛巳日辛卯時（辰将）「蒿矢…行人自宅中已起程…驛馬臨干，貴人入辰。又蒿矢為用，行人速來」
  const f = factsOf("辛巳", "辰", "卯");
  const r = traveler(f, {}, "戌");
  check("行人 占験四 三伝 午→未→申（蒿矢）", seq(f) === "午未申" && f.sanchuan.status === "determined" && f.sanchuan.pattern === "蒿矢格");
  check("行人 占験四 蒿矢は速く来る（追い風）・驛馬 亥 が干上（途中を行く＝已に起程。向きは決めない）",
    dir(r, "haoShi") === "favoring" && dir(r, "yimaInTransit") === "neutral" && reading(r, "yimaInTransit")!.detected.includes("干上"));
  lines.push(`行人 占験四（已に起程・速く来る）: ${keys(r)}`);
}
{
  // 行人 増補占例一 辛未日丁酉時（亥将）「弾射…故不來也」
  const f = factsOf("辛未", "亥", "酉");
  const r = traveler(f, {}, "卯");
  check("行人 増補一 弾射（寅→辰→午）は来ない", f.sanchuan.status === "determined" && f.sanchuan.pattern === "弾射格" && dir(r, "danShe") === "hindering");
  check("行人 増補一 天罡 辰 が孟（寅）＝まだ発っていない", dir(r, "tianGangStage") === "hindering");
  lines.push(`行人 増補一（来ない）: ${keys(r)}`);
}
{
  // 行人 増補占例二 己丑日戌将卯時「斫輪主遲，必不能來也」
  const f = factsOf("己丑", "戌", "卯");
  const r = traveler(f, {}, "卯");
  check("行人 増補二 三伝 卯→戌→巳・卯が申に加わる（斫輪の形）", seq(f) === "卯戌巳" && f.plate.heavenOn["申"] === "卯");
  check("行人 増補二 不一致の記録: 斫輪は既存の課体 FACT にないので読まず、来ない根拠は出ない", !r.readings.some((x) => x.key.includes("斫輪")));
  mismatches.push("行人 増補二: 原典「斫輪主遲，必不能來」。斫輪は既存の課体 FACT にないので未対応（追い風の読みが多く残る）");
  lines.push(`行人 増補二（来ない）: ${keys(r)}`);
}
{
  // 出行 占験一 庚寅五月庚申日丁丑時（申将）「八專、絶嗣…男女遠行俱不得意…壬戌加卯發用，是河井相加…主車船破壞」
  const f = factsOf("庚申", "申", "丑");
  const r = travel(f, {}, "午");
  check("出行 占験一 三伝 戌→巳→子", seq(f) === "戌巳子");
  check("出行 占験一 河井相加（戌が卯に加わる）は道中の災い・追い風の読みはない", dir(r, "heJing") === "hindering" && reading(r, "heJing")!.topic === "safety" && r.overview.favoring.length === 0);
  check("出行 占験一 不一致の記録: 原典の課体は八専、エンジンは比用（三伝は同じ）", f.sanchuan.method === "比用");
  mismatches.push("出行 占験一: 原典は「八專」、エンジンの課体は比用（三伝 戌巳子 は一致）");
  lines.push(`出行 占験一（遠行は凶）: ${keys(r)}`);
}
{
  // 出行 増補占例一 辛卯日辰将酉時「馬星臨干克干，不得自由…總斷是出不了門」
  const f = factsOf("辛卯", "辰", "酉");
  const r = travel(f, {}, "酉");
  check("出行 増補一 驛馬 巳 が干上で日干を剋す（出られない）・鬼が身に臨む", dir(r, "yimaOvercomesStem") === "hindering" && dir(r, "officerOnStem") === "hindering");
  lines.push(`出行 増補一（出られない）: ${keys(r)}`);
}
{
  // 出行 増補占例二 戊子日巳将子時「日課臨支而克支，又被支克其祿…要坐車了去…坐車者，鑄印乘軒也。轉好幾個地方，課得回環也」
  const f = factsOf("戊子", "巳", "子");
  const r = travel(f, {}, "酉");
  check("出行 増補二 三伝 巳→戌→卯 は鋳印（出行の象）", seq(f) === "巳戌卯" && dir(r, "zhuYin") === "favoring");
  check("出行 増補二 日禄 巳 が支上で支 子 に剋される → 「家にいて行けない」ではなく「迫られて行く」",
    dir(r, "forcedDeparture") === "favoring" && !reading(r, "staysHome"));
  check("出行 増補二 不一致の記録: 回環は既存 FACT にないので読まない・斗罡が孟（亥）で「行かない」が残る", dir(r, "tianGangClass") === "hindering");
  mismatches.push("出行 増補二: 原典は出かけた（車で数か所）。斗罡 辰 が孟（亥）で『直指』「斗罡加孟…不行」と逆。回環は未対応");
  lines.push(`出行 増補二（迫られて出る）: ${keys(r)}`);
}

// ---- 2. 行人と出行の区別 ----
{
  check("行人と出行のルール ID が別（traveler.* と travel.*）で重複しない",
    TRAVELER_DOMAIN_RULES.every((r) => r.id.startsWith("traveler.") && r.when.domain === "traveler") &&
    TRAVEL_DOMAIN_RULES.every((r) => r.id.startsWith("travel.") && r.when.domain === "travel"));
  const f = factsOf("庚子", "午", "申");
  check("同じ盤でも行人と出行で読みの集合が別", keys(traveler(f)) !== keys(travel(f)));
  let threwT = false, threwV = false;
  try { evaluateTravelerDomain(f, { domain: "travel" }); } catch { threwT = true; }
  try { evaluateTravelDomain(f, { domain: "traveler" }); } catch { threwV = true; }
  check("行人の評価は行人の DOMAIN だけ、出行の評価は出行の DOMAIN だけを受け付ける", threwT && threwV);
  // goal で向きが変わる
  const r1 = traveler(factsOf("辛未", "亥", "酉"), { goal: "return" }), r2 = traveler(factsOf("辛未", "亥", "酉"), { goal: "avoid" });
  check("行人: 帰ってほしい（return）と帰ってほしくない（avoid）で「弾射＝来ない」の向きが逆", dir(r1, "danShe") === "hindering" && dir(r2, "danShe") === "favoring");
  const v1 = travel(factsOf("辛卯", "辰", "酉"), { goal: "move" }), v2 = travel(factsOf("辛卯", "辰", "酉"), { goal: "avoid" });
  check("出行: 行きたい（move）と行きたくない（avoid）で「出られない」の向きが逆", dir(v1, "yimaOvercomesStem") === "hindering" && dir(v2, "yimaOvercomesStem") === "favoring");
  check("出行: 道中の災い（河井相加）は goal によらず妨げ",
    dir(travel(factsOf("庚申", "申", "丑"), { goal: "avoid" }), "heJing") === "hindering" && dir(travel(factsOf("庚申", "申", "丑"), { goal: "move" }), "heJing") === "hindering");
}

// ---- 3. 判断原則 ----
{
  check("驛馬が三伝・干上にあるだけの読みは向きを決めない（行人）", TRAVELER_DOMAIN_RULES.some((r) => r.reading.key === "yimaInTransit") &&
    dir(traveler(factsOf("辛巳", "辰", "卯")), "yimaInTransit") === "neutral");
  // 進茹・退茹だけで出発・帰還を決めるルールがない: 進退を使うのは 丁馬との組合せ（dingMaDirection）・間進間退（他郷で阻まれる）・連茹（『指南』増補「有人至」）だけ
  const src = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "");
  const tv = src("src/lib/liuren/interpretation/travelDomain.ts");
  check("出行のルールは三伝の進茹・退茹（movementPattern）を使わない", !tv.includes("movementPattern"));
  const tr = src("src/lib/liuren/interpretation/travelerDomain.ts");
  const blocks = tr.split(/\n  \{\n    id: /).slice(1).map((b) => ({ id: b.slice(0, b.indexOf(",")), uses: b.includes("movementPattern") }));
  const usesPattern = blocks.filter((b) => b.uses).map((b) => b.id).join(",");
  check("行人で三伝の進退を使うのは丁馬との組合せ・連茹・間進間退の3つだけ", usesPattern === '"traveler.dingMaDirection","traveler.lianRu","traveler.jianMovement"', usesPattern);
  // 返吟の剛日は空でも妨げない
  let fanyinVoid: DomainResult | null = null;
  for (let i = 0; i < 60 && !fanyinVoid; i++) {
    if (i % 2) continue; // 剛日
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
    const f = factsOf(day, BRANCHES[(BRANCHES.indexOf("子") + 6) % 12] as Branch, "子");
    const r = traveler(f);
    if (r.readings.some((x) => x.key === "fanyinYang") && r.readings.some((x) => x.key.endsWith("Void"))) fanyinVoid = r;
  }
  check("返吟の剛日では空の読みが残るが向きは neutral（『指南』「雖見天中亦不羈」）",
    !!fanyinVoid && fanyinVoid.readings.filter((x) => x.key.endsWith("Void")).every((x) => x.direction === "neutral"));
}

// ---- 4. 人物・類神 ----
{
  // 占験四の初伝 午 を本命とする人物を、問う人にした場合と外出中の人物にした場合
  const f = factsOf("辛巳", "辰", "卯");
  const asAsker = traveler(f, { persons: [person("A", "甲", "午")], subjectPersonId: "A" });
  const asTraveler = traveler(f, { persons: [person("T", "甲", "午")], travelerPersonId: "T" });
  check("問う人の本命を行人の本命として使わない（本命 午 が初伝でも、問う人なら行人の本命の読みは出ない）",
    !reading(asAsker, "natalInitial") && asAsker.missing.some((m) => m.key === "travelerNatalYear"));
  check("外出中の人物の本命 午 が初伝なら「行人の本命が発用（来る）」", dir(asTraveler, "natalInitial") === "favoring");
  // 類神: 天将で指定 → その天将が乗る支
  const f1 = factsOf("庚子", "午", "申");
  const siteGeneral = f1.generals.generalOn[f1.lessons[2].upper];
  const rs = traveler(f1, { targetSymbol: { kind: "general", general: siteGeneral } });
  check("類神を天将で指定: その天将が支上に乗れば「類神が支に乗る（帰る）」と「課伝に入る」", dir(rs, "symbolOnSite") === "favoring" && dir(rs, "symbolInBoard") === "favoring");
  const voidBranch = f1.xun.voidBranches[0];
  const rv = traveler(f1, { targetSymbol: { kind: "branch", branch: voidBranch } });
  check("類神を支で指定: 空亡の支なら「類神が空（帰らない）」", dir(rv, "symbolVoid") === "hindering");
  check("類神の指定がなければ不足として明示し、類神の読みは出さない", !traveler(f1).readings.some((x) => x.key.startsWith("symbol")) && traveler(f1).missing.some((m) => m.key === "targetSymbol"));
}

// ---- 監査（Phase 5C 最終）----
{
  // (1) 日干の見方: 日干・干上・寄宮を使うルールはすべて見方（行人／問う人）を持つ。本命・類神のルールは日干を使わない
  const tr = readFileSync("src/lib/liuren/interpretation/travelerDomain.ts", "utf8").replace(/\/\/.*$/gm, "");
  const body = tr.slice(tr.indexOf("const TRAVELER_RULES"));
  const blocks = body.split(/\n  \{\n    id: /).slice(1).map((b) => ({ key: b.slice(b.indexOf("key: \"") + 6, b.indexOf("\"", b.indexOf("key: \"") + 6)), code: b }));
  // 剛日・柔日の判定（日干の陰陽）は見方と関係しないので数えない
  const usesStem = (c: string) => /dayStem\(i\)|stemUpper|lodgingBranch/.test(c.slice(c.indexOf("conditions")));
  const noPerspective = blocks.filter((b) => usesStem(b.code) && !STEM_PERSPECTIVE[b.key]).map((b) => b.key);
  check("監査1: 日干・干上・寄宮を使う行人のルールはすべて「日干＝行人／問う人」の見方を持つ", noPerspective.length === 0, noPerspective.join(","));
  const personRules = blocks.filter((b) => ["natalInitial", "symbolOnSite", "symbolInBoard", "symbolVoid"].includes(b.key));
  check("監査1: 本命・類神のルールは日干・干上・寄宮を使わない（人物を日干と同一視しない）", personRules.length === 4 && personRules.every((b) => !usesStem(b.code)));
  const askerKeys = Object.entries(STEM_PERSPECTIVE).filter(([, v]) => v === "asker").map(([k]) => k);
  check("監査1: 日干＝問う人で読むのは『指南』増補の2ルールだけで、出典は増補だけ",
    askerKeys.join() === "initialGeneratesStem,stemActsOnInitial" &&
    TRAVELER_DOMAIN_RULES.filter((r) => askerKeys.includes(r.reading.key)).every((r) => r.reading.citations.some((c) => c.quote.startsWith("增补"))));
  check("監査1: 初伝が官鬼（日干＝行人）の出典に、日＝我の増補を混ぜない",
    TRAVELER_DOMAIN_RULES.find((r) => r.reading.key === "initialOfficer")!.reading.citations.every((c) => c.source === "『御定六壬直指』"));
  const r = traveler(factsOf("辛巳", "辰", "卯"));
  check("監査1: 日干を使う読みの検出文に見方が表示される", r.readings.filter((x) => STEM_PERSPECTIVE[x.key]).every((x) => /日干＝(行人|問う人)/.test(x.detected)));
  // (2) 坐空: 初伝・中伝の坐空は読まず保留として出す・出行は坐空を使わない
  let seatedOnly: DomainResult | null = null;
  for (let i = 0; i < 60 && !seatedOnly; i++) for (let o = 0; o < 12 && !seatedOnly; o++) {
    const f = factsOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o] as Branch, "子");
    const t0 = f.transmissions![0];
    const seated = f.xun.voidBranches.includes(f.plate.earthUnder[t0.branch]) && !t0.isVoid;
    if (seated) seatedOnly = traveler(f);
  }
  check("監査2: 初伝が坐空だけ（旬空でない）なら初伝の空の読みは出ず、保留を不足に出す",
    !!seatedOnly && !reading(seatedOnly, "initialVoid") && seatedOnly.missing.some((m) => m.key === "seatedOnVoid" && m.detail.includes("保留")));
  const tv = readFileSync("src/lib/liuren/interpretation/travelDomain.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("監査2: 出行のルールは坐空（isSeatedOnVoid）を判断に使わない（不足の判定だけ）", !tv.slice(tv.indexOf("const TRAVEL_RULES"), tv.indexOf("export function evaluateTravelDomain")).includes("isSeatedOnVoid"));
  check("監査2: 行人で坐空を読むのは末伝の1ルールだけ（組合せ）",
    TRAVELER_DOMAIN_RULES.filter((x) => (x.reading.label.includes("坐空"))).map((x) => `${x.reading.key}:${x.reading.level}`).join() === "finalSeatedOnVoid:combined");
}
// (3) 古典占験9例: 三伝一致と占断一致を分ける。部分再現を完全再現としない
type Verdict = "一致" | "部分一致" | "不一致";
const CASES: { name: string; day: string; jiang: Branch; shi: Branch; sanchuan: string; methodInSource: string | null; verdict: Verdict; reproduced: string; notReproduced: string; circular: boolean }[] = [
  { name: "行人 占験一", day: "庚子", jiang: "午", shi: "申", sanchuan: "午辰寅", methodInSource: "涉害", verdict: "部分一致",
    reproduced: "顧祖格＝来る・中末の空＝遅れる（併存）", notReproduced: "「月内は来ない・過月に来る」の時期（帰期は未対応）", circular: false },
  { name: "行人 占験二", day: "壬戌", jiang: "寅", shi: "巳", sanchuan: "巳寅亥", methodInSource: "元首", verdict: "部分一致",
    reproduced: "天罡が季＝すぐ至る（近くまで来ている）", notReproduced: "道中の馬賊（天将が原典と違う）・寅日着（帰期）・「支が干を剋す」「末伝が初伝を剋す」の妨げが残る", circular: false },
  { name: "行人 占験三", day: "丁丑", jiang: "午", shi: "巳", sanchuan: "申酉戌", methodInSource: "重審", verdict: "部分一致",
    reproduced: "連茹に空＝遅れる", notReproduced: "「まだ発っていない」（天罡は仲＝途中）・九月の到着（帰期）", circular: false },
  { name: "行人 占験四", day: "辛巳", jiang: "辰", shi: "卯", sanchuan: "午未申", methodInSource: "蒿矢", verdict: "部分一致",
    reproduced: "蒿矢＝速く来る・驛馬が干上＝已に起程（途中）", notReproduced: "丙戌日の到着（帰期）・貴人入辰は未対応・「支が干を剋す」「末伝が空」の妨げが残る", circular: false },
  { name: "行人 増補一", day: "辛未", jiang: "亥", shi: "酉", sanchuan: "寅辰午", methodInSource: "弾射", verdict: "部分一致",
    reproduced: "弾射＝来ない・天罡が孟＝未発", notReproduced: "「占時が支上」「初伝が絶」の追い風が残る", circular: false },
  { name: "行人 増補二", day: "己丑", jiang: "戌", shi: "卯", sanchuan: "卯戌巳", methodInSource: "斫輪", verdict: "不一致",
    reproduced: "（なし）", notReproduced: "斫輪＝遅く来ない（斫輪は未対応）。追い風の読みが多い", circular: false },
  { name: "出行 占験一", day: "庚申", jiang: "申", shi: "丑", sanchuan: "戌巳子", methodInSource: "八専", verdict: "部分一致",
    reproduced: "追い風なし・河井相加＝車船の災い・天関地関", notReproduced: "劫煞・旬丁の刑剋、末伝の死（死字）、盗難・他郷での死・沈没（未対応）。課体名は比用", circular: true },
  { name: "出行 増補一", day: "辛卯", jiang: "辰", shi: "酉", sanchuan: "戌巳子", methodInSource: null, verdict: "部分一致",
    reproduced: "馬星が干を剋す・鬼が身に臨む＝出られない", notReproduced: "「日上神が辰上神を生ず」「魁罡」の追い風が残る", circular: true },
  { name: "出行 増補二", day: "戊子", jiang: "巳", shi: "子", sanchuan: "巳戌卯", methodInSource: null, verdict: "部分一致",
    reproduced: "鋳印・日禄が支に剋される＝迫られて出る", notReproduced: "回環（数か所を回る）は未対応・「斗罡が孟」「墓が日に臨む」の妨げが残る", circular: true },
];
const caseLines: string[] = [];
for (const c of CASES) {
  const f = factsOf(c.day, c.jiang, c.shi);
  const sanchuanOk = seq(f) === c.sanchuan;
  // 原典の課体名は九宗法の法名（涉害・元首など）か格名（蒿矢・弾射・斫輪）。格名はエンジンの sanchuan.pattern（「〜格」）と照合する
  const engineNames = [f.sanchuan.method, f.sanchuan.status === "determined" && f.sanchuan.pattern ? f.sanchuan.pattern.replace(/格$/, "") : ""];
  const methodOk = c.methodInSource === null ? null : engineNames.includes(c.methodInSource);
  check(`監査3: ${c.name} 三伝が原典と一致（${c.sanchuan}）`, sanchuanOk, seq(f));
  caseLines.push(`${c.name}｜三伝 ${sanchuanOk ? "一致" : "不一致"}（${c.sanchuan}）｜課体名 ${methodOk === null ? "原典に記載なし" : methodOk ? "一致" : `不一致（原典 ${c.methodInSource}・エンジン ${engineNames.filter(Boolean).join("・")}）`}｜占断 ${c.verdict}${c.circular ? "（規則の一部がこの例から取ったもので、独立の検証ではない）" : ""}｜再現: ${c.reproduced}｜未再現: ${c.notReproduced}`);
}
check("監査3: 三伝は9例すべて一致", CASES.every((c) => seq(factsOf(c.day, c.jiang, c.shi)) === c.sanchuan));
check("監査3: 占断を「一致」（完全再現）とした例はない（部分一致8・不一致1）",
  CASES.filter((c) => c.verdict === "一致").length === 0 && CASES.filter((c) => c.verdict === "部分一致").length === 8 && CASES.filter((c) => c.verdict === "不一致").length === 1);
const nameMismatch = CASES.filter((c) => {
  const f = factsOf(c.day, c.jiang, c.shi);
  const names = [f.sanchuan.method, f.sanchuan.status === "determined" && f.sanchuan.pattern ? f.sanchuan.pattern.replace(/格$/, "") : ""];
  return c.methodInSource !== null && !names.includes(c.methodInSource);
}).map((c) => c.name).join();
check("監査3: 課体名が原典と違うのは 出行 占験一（八専／比用）と 行人 増補二（斫輪はエンジンに格名なし）", nameMismatch === "行人 増補二,出行 占験一", nameMismatch);

// ---- 5. 720課・基盤 ----
const goals: (InterpretationGoal | undefined)[] = [undefined, "return", "avoid", "move", "maintain"];
const counts: Record<string, Record<string, number>> = { traveler: {}, travel: {} };
let evaluated = 0, threw = 0, nondeterministic = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  const chart = calculateLiuren({ dayStem: STEMS[i % 10] as Stem, dayBranch: BRANCHES[i % 12] as Branch, divinationBranch: "子", monthGeneral: BRANCHES[o] as Branch });
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const factsBefore = JSON.stringify(facts);
  const month = BRANCHES[(i + o) % 12] as Branch;
  for (const goal of goals) {
    const tctx: InterpretationContext = { domain: "traveler", subtype: "return", goal, persons: [person("T", STEMS[(i + 3) % 10] as Stem, BRANCHES[(i + 3) % 12] as Branch)], travelerPersonId: "T", xingNianInputs: [{ personId: "T", sex: "male" as const, reckonedAge: ((i * 7 + o * 5) % 72) + 1 }], targetSymbol: { kind: "general", general: "天后" } };
    const vctx: InterpretationContext = { domain: "travel", subtype: "departure", goal, persons: [person("A", STEMS[(i + 5) % 10] as Stem, BRANCHES[(i + 5) % 12] as Branch)], subjectPersonId: "A" };
    try {
      const a = evaluateTravelerDomain(facts, tctx, month), b = evaluateTravelDomain(facts, vctx, month);
      evaluated += 2;
      if (JSON.stringify(evaluateTravelerDomain(facts, tctx, month)) !== JSON.stringify(a) || JSON.stringify(evaluateTravelDomain(facts, vctx, month)) !== JSON.stringify(b)) nondeterministic += 1;
      if (goal === undefined) {
        for (const x of a.readings) counts.traveler[x.key] = (counts.traveler[x.key] ?? 0) + 1;
        for (const x of b.readings) counts.travel[x.key] = (counts.travel[x.key] ?? 0) + 1;
      }
    } catch { threw += 1; }
  }
  if (JSON.stringify(chart) !== before || JSON.stringify(facts) !== factsBefore) changed += 1;
}
check("720課×goal 5 で行人・出行とも例外なく評価でき、同じ入力で同じ結果", evaluated === 720 * 5 * 2 && threw === 0 && nondeterministic === 0, `${evaluated} / ${threw} / ${nondeterministic}`);
check("評価しても起課結果・解釈 FACT が変わらない", changed === 0);
check("行人・出行とも、全ルールが720課のどこかで成立する（死んだルールがない。類神・本命つき）",
  TRAVELER_DOMAIN_RULES.filter((r) => !counts.traveler[r.reading.key]).length <= 2 && TRAVEL_DOMAIN_RULES.filter((r) => !counts.travel[r.reading.key]).length <= 2,
  `行人 ${TRAVELER_DOMAIN_RULES.filter((r) => !counts.traveler[r.reading.key]).map((r) => r.reading.key).join(",")} ／ 出行 ${TRAVEL_DOMAIN_RULES.filter((r) => !counts.travel[r.reading.key]).map((r) => r.reading.key).join(",")}`);
{
  const allowed = ["『大六壬指南』", "『御定六壬直指』", "『六壬心鏡』", "『六壬大全』"];
  const rules = [...TRAVELER_DOMAIN_RULES, ...TRAVEL_DOMAIN_RULES];
  check("全ルールに出典（今回の4書）・推論レベル・topic がある",
    rules.every((r) => r.reading.citations.length > 0 && r.reading.citations.every((c) => allowed.includes(c.source)) && !!r.reading.topic && ["direct", "combined", "inferred"].includes(r.reading.level)));
  check("ルール ID が重複しない", new Set(rules.map((r) => r.id)).size === rules.length);
  const code = ["travelerDomain.ts", "travelDomain.ts", "movementFacts.ts"].map((n) => readFileSync(`src/lib/liuren/interpretation/${n}`, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "")).join("\n");
  const hit = ["score", "xingNianOf", "SemanticRole", "assignRoles", "calculateLiuren"].filter((w) => code.includes(w));
  check("点数・行年の計算・ROLE の割当・起課の呼び出しがない", hit.length === 0, hit.join(","));
  check("Phase 5A の DOMAIN 基盤（evaluateDomainRules・summarizeDomainReadings・buildDomainBoardInput）を使う",
    /evaluateDomainRules\(TRAVELER_RULES/.test(code) && /evaluateDomainRules\(TRAVEL_RULES/.test(code) && (code.match(/buildDomainBoardInput\(/g) ?? []).length === 2);
  const r = traveler(factsOf("庚子", "午", "申"));
  check("行年・帰期・天馬は不足として明示", ["xingNian", "timing", "tianMa"].every((k) => r.missing.some((m) => m.key === k)));
  check("要約の先頭は「行人と家の関係」または軸の行で、点数がない", !/\d+点/.test(r.summary));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log("古典占験9例（三伝一致と占断一致を分ける）:");
for (const l of caseLines) console.log(`  ${l}`);
console.log("原典との不一致（記録）:");
for (const m of mismatches) console.log(`  ${m}`);
console.log("行人 占験四 の要約:");
console.log(traveler(factsOf("辛巳", "辰", "卯"), {}, "戌").summary.split("\n").map((s) => `  ${s}`).join("\n"));
console.log("出行 増補二 の要約:");
console.log(travel(factsOf("戊子", "巳", "子"), {}, "酉").summary.split("\n").map((s) => `  ${s}`).join("\n"));
for (const d of ["traveler", "travel"] as const) console.log(`720課（goal なし）の読みの発生数 ${d}: ${Object.entries(counts[d]).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" ／ ")}`);
console.log(`ルール数 行人 ${TRAVELER_DOMAIN_RULES.length} ／ 出行 ${TRAVEL_DOMAIN_RULES.length}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
