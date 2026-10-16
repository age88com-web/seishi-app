// src/lib/liuren/interpretation/illnessDomain.ts
//
// 役割（Phase 5E）:
//   疾病・健康（illness）の DOMAIN 判断。伝統的な六壬の象意として、古典がこの盤の配置をどう読むかを並べる。
//   医学的な診断・予後・治療の判断としては出さない（要約の先頭と末尾に明示する）。
//
//   規則の出典（原文・注・講座・古典占験を citation の layer と locator で分ける。増補占例など現代の例は規則の出典にしない）:
//     『御定六壬直指』疾病（ZZ）・『大六壬指南』疾病章第九（ZN。歌訣＝原文、割注＝注、占験＝古典の実例）・
//     『六壬心鏡』巻七 疾病門（XJ。本歌＝原文、郇注・引『入式』＝注）・『六壬大全』鬼墓課（DQ）・『六壬神課講座』p61・p63・p64・p66（KZ）
//
//   人物（古典の一般的な見方と、特定人物の本命を分ける）:
//     日（日干）＝病人、辰（日支）＝病（『直指』「以日為人，辰為病」）。これは盤上の一般的な見方で、病人の本命・類神とは別。
//     他の古典の規則にこの対応を当てはめるのは、その規則が日・辰・白虎などを直接いうときだけ。
//     病人の本命・年命は context.patientPersonId の人物からだけ取る（問う人の本命を病人の本命として使わない）。
//     代理の問い（病人が問う人と別）の類神は context.targetSymbol で指定する（自動では決めない）。
//
//   向き: favoring＝古典が回復の方向に読むもの、hindering＝古典が病勢の方向に読むもの。goal で向きを反転しない。
//   古典の「死」「必死」「不治」は citation の原文にだけ残し、読みの label・detected・要約には書かない（死亡・余命を予告しない）。
//   医・薬・鍼灸・方角の避病・祭祀など、古典の処方・医療行為は扱わない。
//
//   扱わないもの（不足・保留として出す）: 資料に定義のない神煞（死神・死気・生気・天医・地医・喪門・弔客・病符など）、
//   行年、初めて病んだ日（病日）、愈期・凶期、新病・旧病の区別、鬼祟、症状の細目（支ごと・天将ごとの症状）、
//   『心鏡』の六般入墓のうち鬼入墓・日干入墓・支入墓（本歌が特定の干の例だけで、他の干への一般化が資料にない）、
//   坐空（疾病の資料に坐空を空亡に当てる根拠がない）。
//
//   土の長生・墓: エンジンの確定仕様（土は火に従い墓＝戌）は変えない。『指南』は土を辰・申の系統で見る（占験六・占験八）ので、
//   『指南』を出典とし日干の墓・長生を使う規則（自墓伝生）は土日（戊・己）に判断せず、不足に出す。
//   『指南』の収魂（玄乘日墓）は、エンジンの天将の配置では土日以外に成立せず、土日は日墓の方式が違うので、規則にせず保留する。
//   日徳・日禄の発用: 『直指』の吉「发用而不空亡」と凶「发用及加年命而俱值空亡」だけで読む。『指南』占験七（禄馬の発用・
//   病人見驛馬）は条件が違う（驛馬・中伝空絶・玄胎）ので、この規則の凶の説としては使わない（驛馬の規則は未対応）。

import { BRANCH_ELEMENT, ELEMENT_CONTROLS, ELEMENT_GENERATES, STEM_ELEMENT } from "../constants";
import type { Branch, Element, HeavenlyGeneral } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainResult, DomainRule } from "./domainResult";
import { resolveContextBranch } from "./contextBranch";
import { dayVirtueOf, daySalaryOf, yimaOf } from "./markers";
import { monthlySpiritSummaryLines, spiritFact } from "./monthlySpiritReadings";
import { XING_NIAN_REASON_TEXT, resolveXingNianPlacement } from "./xingNianPlacement";
import type { XingNianPlacement } from "./xingNianPlacement";
import { relationBetween } from "./relations";
import type { InterpretationContext } from "./roles";
import { elementTombOf, growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type { InterpretationFacts, SeasonalStrength, StructuralRelation, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput {
  month: Branch | null;
  /** 病人の本命の支（patientPersonId の人物。なければ null） */
  patientNatal: Branch | null;
  /** 類神の天盤支（targetSymbol。なければ null） */
  symbol: { label: string; branch: Branch } | null;
  /** 病人（patientPersonId）の行年の位置（Phase 5O。求められなければ null） */
  xingNian?: XingNianPlacement | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const ZZ = (quote: string): DomainCitation => ({ source: "『御定六壬直指』", locator: "疾病", layer: "原文", quote });
const ZN = (layer: "原文" | "注", quote: string, locator = "疾病章第九"): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻七 疾病門", layer, quote });
const DQ = (quote: string): DomainCitation => ({ source: "『六壬大全』", locator: "鬼墓課", layer: "原文", quote });
const KZ = (locator: string, quote: string): DomainCitation => ({ source: "『六壬神課講座』", locator, layer: "講座", quote });
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り（既存 FACT の参照） ----
const stemUpper = (i: Input) => i.facts.lessons[0].upper;
const siteUpper = (i: Input) => i.facts.lessons[2].upper;
const dayStem = (i: Input) => i.facts.basic.dayStem;
const dayBranch = (i: Input) => i.facts.basic.dayBranch;
const t = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
const relOf = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => relationBetween(a, b).relations;
const has = (rs: readonly StructuralRelation[], ...ks: StructuralRelation[]) => ks.some((k) => rs.includes(k));
const overcomes = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => has(relOf(a, b), "overcomes");
const general = (i: Input, b: Branch): HeavenlyGeneral => i.facts.generals.generalOn[b];
/** その天将が乗る天盤支 */
const riding = (i: Input, g: HeavenlyGeneral): Branch => (Object.keys(i.facts.generals.generalOn) as Branch[]).find((b) => i.facts.generals.generalOn[b] === g)!;
const tiger = (i: Input) => riding(i, "白虎");
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);
const under = (i: Input, b: Branch) => i.facts.plate.earthUnder[b];
const on = (i: Input, b: Branch) => i.facts.plate.heavenOn[b];
const el = (b: Branch): Element => BRANCH_ELEMENT[b];
/** 日墓（日干の五行の墓庫の支。土は火に従い戌） */
const dayTomb = (i: Input) => elementTombOf(STEM_ELEMENT[dayStem(i)]).branch;
/**
 * 土日（戊・己）。『指南』は土の長生・墓を水と同じに置く（占験六「戊日玄墓发用」は発用 辰、占験八の注「以土长生于申」）。
 * エンジンの確定仕様（土は火に従い墓＝戌）とは違うので、『指南』を出典とし日干の墓・長生を使う規則は土日に判断しない。
 */
const earthDay = (i: Input) => STEM_ELEMENT[dayStem(i)] === "土";
const seasonal = (i: Input, e: Element): SeasonalStrength | null => (i.month ? seasonalStrengthOf(e, rulingElementOfMonth(i.month)) : null);
const strong = (s: SeasonalStrength | null) => s === "旺" || s === "相";
/** 日干を剋す五行（官鬼の五行） */
const ghostElement = (i: Input): Element => (Object.keys(ELEMENT_CONTROLS) as Element[]).find((e) => ELEMENT_CONTROLS[e] === STEM_ELEMENT[dayStem(i)])!;
/** 三合局の墓（寅午戌＝戌・申子辰＝辰・巳酉丑＝丑・亥卯未＝未） */
const TRIAD_TOMB: Record<Branch, Branch> = { 寅: "戌", 午: "戌", 戌: "戌", 申: "辰", 子: "辰", 辰: "辰", 巳: "丑", 酉: "丑", 丑: "丑", 亥: "未", 卯: "未", 未: "未" };
/** 季節（月支から）→ 浴盆の支（『心鏡』注「浴盆，春辰夏未秋戌冬丑」） */
const BATH: Record<Branch, Branch> = { 寅: "辰", 卯: "辰", 辰: "辰", 巳: "未", 午: "未", 未: "未", 申: "戌", 酉: "戌", 戌: "戌", 亥: "丑", 子: "丑", 丑: "丑" };
const ORGAN: Record<Element, string> = { 水: "腎", 火: "心", 木: "肝", 金: "肺", 土: "脾胃" };

// ---- 向き（回復の方向／病勢の方向。goal では反転しない） ----
const recovery = (note?: string) => () => ({ direction: "favoring" as DomainDirection, ...(note ? { note } : {}) });
const illness = (note?: string) => () => ({ direction: "hindering" as DomainDirection, ...(note ? { note } : {}) });
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
/** 『直指』の凶の条文は発用と年命の両方の空亡をいう（「或」ではなく「及…俱」）。片方だけでは凶とも吉ともしない */
const VS_BOTH = "『直指』の凶の条文「日德日禄发用及加年命而俱值空亡」は発用と年命の両方の空亡をいうので、片方だけでは凶としない（吉の条件「发用而不空亡」も満たさない）";
const isVS = (i: Input, b: Branch) => b === dayVirtueOf(dayStem(i)) || b === daySalaryOf(dayStem(i));
const natalVirtueSalaryVoid = (i: Input) => i.patientNatal !== null && isVS(i, on(i, i.patientNatal)) && isVoid(i, on(i, i.patientNatal));
const initialVirtueSalaryVoid = (i: Input) => { const p = i.comparison.path.initial; return (p.isDayVirtue || p.isDaySalary) && p.isVoid; };
const MITIGATE = "凶の作用を減ずるという意味で、積極的な吉ではない（講座 p66）";

const ILLNESS_RULES: readonly Rule[] = [
  // ===== 人（日）と病（辰）の関係（relation） =====
  {
    id: "illness.stemUpperOvercomesBranch", when: { domain: "illness" },
    reading: { axis: "relation", topic: "relation", key: "stemUpperOvercomesBranch", label: "日上が辰を剋す（人が病に勝つ形）", level: "direct",
      citations: [ZZ("以日为人，辰为病，日上克辰吉，辰上克日凶"), KZ("p61", "病気占の場合は、日支が剋されるのが必ず悪いともいえない")] },
    conditions: (i) => overcomes(stemUpper(i), dayBranch(i)) ? { detected: `干上 ${stemUpper(i)} が日支 ${dayBranch(i)}（病）を剋す`, evidence: [ev("relation", "干上→日支 剋")] } : null,
    assess: recovery(),
  },
  {
    id: "illness.siteUpperOvercomesStem", when: { domain: "illness" },
    reading: { axis: "relation", topic: "relation", key: "siteUpperOvercomesStem", label: "辰上が日を剋す（病が人に勝つ形）", level: "direct",
      citations: [ZZ("以日为人，辰为病，日上克辰吉，辰上克日凶")] },
    conditions: (i) => overcomes(siteUpper(i), dayStem(i)) ? { detected: `支上 ${siteUpper(i)} が日干 ${dayStem(i)}（病人）を剋す`, evidence: [ev("relation", "支上→日干 剋")] } : null,
    assess: illness(),
  },
  {
    id: "illness.stemOvercomesBranch", when: { domain: "illness" },
    reading: { axis: "relation", topic: "relation", key: "stemOvercomesBranch", label: "日が辰を剋す（人が病を剋す・治りやすい）", level: "direct",
      citations: [XJ("注", "日克辰为人克病，易愈")] },
    conditions: (i) => overcomes(dayStem(i), dayBranch(i)) ? { detected: `日干 ${dayStem(i)} が日支 ${dayBranch(i)} を剋す`, evidence: [ev("relation", "日干→日支 剋")] } : null,
    assess: recovery(),
  },
  {
    id: "illness.branchOvercomesStem", when: { domain: "illness" },
    reading: { axis: "relation", topic: "relation", key: "branchOvercomesStem", label: "辰が日を剋す（病が人を剋す形。それだけでは決め手にならない）", level: "combined",
      citations: [XJ("注", "辰克日乘白虎为病克人"), KZ("p61", "日支が日干を剋すのは凶意がないわけではないが、必ずしもそれだけが決め手にはならない")] },
    conditions: (i) => overcomes(dayBranch(i), dayStem(i)) ? { detected: `日支 ${dayBranch(i)} が日干 ${dayStem(i)} を剋す`, evidence: [ev("relation", "日支→日干 剋")] } : null,
    assess: illness("講座 p61 は、これだけで判断しないとする"),
  },
  {
    id: "illness.tigerAtBranchOvercomesStem", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "relation", key: "tigerAtBranchOvercomesStem", label: "白虎が辰に臨んで日を剋す／辰が白虎となって日を剋す", level: "direct",
      citations: [ZZ("白虎临辰克日，或辰作白虎克日者"), ZZ("此皆凶占也")] },
    conditions: (i) => {
      const a = general(i, siteUpper(i)) === "白虎" && overcomes(siteUpper(i), dayStem(i));
      const b = general(i, dayBranch(i)) === "白虎" && overcomes(dayBranch(i), dayStem(i));
      if (!a && !b) return null;
      return { detected: [a ? `支上 ${siteUpper(i)} に白虎が乗り日干 ${dayStem(i)} を剋す` : "", b ? `天盤の日支 ${dayBranch(i)} に白虎が乗り日干 ${dayStem(i)} を剋す` : ""].filter(Boolean).join("・"), evidence: [ev("tiger", tiger(i))] };
    },
    assess: illness(),
  },
  {
    id: "illness.branchStrengthened", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "relation", key: "branchStrengthened", label: "支上が日支を生ず（病の側が強められる）", level: "combined",
      citations: [KZ("p61", "むしろ、日支や支上神が強められるのは、病状が悪化する可能性が高くなる。ただし、これもその他の条件をよく比較しなければいけない")] },
    conditions: (i) => has(relOf(siteUpper(i), dayBranch(i)), "generates") ? { detected: `支上 ${siteUpper(i)} が日支 ${dayBranch(i)}（病）を生ず`, evidence: [ev("relation", "支上→日支 生")] } : null,
    assess: illness("講座 p61 は、他の条件とよく比べるとする"),
  },
  // ===== 白虎（病神） =====
  {
    id: "illness.tigerGeneratesStem", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "tigerGeneratesStem", label: "白虎の乗神と日が相生（治る方向）", level: "direct",
      citations: [XJ("原文", "占病如何辨死生？先推白虎与谁并"), XJ("注", "详视白虎所乘之神，与日相生则愈"), ZZ("白虎乘神生日，或日生白虎乘神与白虎作日之德神者"), ZZ("此皆吉占也")] },
    conditions: (i) => {
      const b = tiger(i), e = el(b), s = STEM_ELEMENT[dayStem(i)];
      const gen = ELEMENT_GENERATES[e] === s ? `白虎の乗る ${b}（${e}）が日干 ${dayStem(i)}（${s}）を生ず` : ELEMENT_GENERATES[s] === e ? `日干 ${dayStem(i)}（${s}）が白虎の乗る ${b}（${e}）を生ず` : "";
      const virtue = b === dayVirtueOf(dayStem(i)) ? `白虎の乗る ${b} が日徳` : "";
      return gen || virtue ? { detected: [gen, virtue].filter(Boolean).join("・"), evidence: [ev("tiger", b)] } : null;
    },
    assess: recovery(),
  },
  {
    id: "illness.tigerSameAsStem", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "tiger", key: "tigerSameAsStem", label: "白虎の乗神が日と同類（治りが遅い）", level: "direct",
      citations: [XJ("原文", "干同虎类久淹疲"), XJ("注", "与日同类痊迟")] },
    conditions: (i) => el(tiger(i)) === STEM_ELEMENT[dayStem(i)] ? { detected: `白虎の乗る ${tiger(i)} が日干 ${dayStem(i)} と同じ${el(tiger(i))}`, evidence: [ev("tiger", tiger(i))] } : null,
    assess: illness("長引く方向の読みで、重さの判断ではない"),
  },
  {
    id: "illness.tigerOvercomesStem", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tiger", key: "tigerOvercomesStem", label: "白虎の乗神が日を剋す（治りにくい）", level: "direct",
      citations: [XJ("原文", "假令今日干居水，土神为虎病难醒"), XJ("注", "克日者难痊")] },
    conditions: (i) => overcomes(tiger(i), dayStem(i)) ? { detected: `白虎の乗る ${tiger(i)} が日干 ${dayStem(i)} を剋す`, evidence: [ev("tiger", tiger(i))] } : null,
    assess: illness("白虎があるだけで重いとはしない。救い（虎を制する神・虎の空亡など）と併せて読む"),
  },
  {
    id: "illness.tigerControlled", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "tigerControlled", label: "干上・支上・病人の年命上の神が白虎を制す（救神）", level: "direct",
      citations: [XJ("原文", "今日救神同克虎…当知减退必无疑"), XJ("注", "若日辰年命上神克制白虎者，其病即愈也"), XJ("注", "日干上神克白虎者病愈。支上神克白虎亦愈"), ZZ("白虎乘神克日干，而干上神反克白虎者")] },
    conditions: (i) => {
      const b = tiger(i);
      const hits = [
        overcomes(stemUpper(i), b) ? `干上 ${stemUpper(i)}` : "",
        overcomes(siteUpper(i), b) ? `支上 ${siteUpper(i)}` : "",
        i.patientNatal && overcomes(on(i, i.patientNatal), b) ? `病人の年命 ${i.patientNatal} の上の ${on(i, i.patientNatal)}` : "",
      ].filter(Boolean);
      return hits.length ? { detected: `${hits.join("・")}が白虎の乗る ${b} を剋す`, evidence: [ev("tiger", b)] } : null;
    },
    assess: recovery(),
  },
  {
    id: "illness.tigerAttacksIllness", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "tigerAttacksIllness", label: "白虎の乗神が日支と支上を剋す（虎が病の側に向かう）", level: "direct",
      citations: [ZZ("白虎乘神克日之支与支之上神者"), ZZ("此皆吉占也")] },
    conditions: (i) => overcomes(tiger(i), dayBranch(i)) && overcomes(tiger(i), siteUpper(i))
      ? { detected: `白虎の乗る ${tiger(i)} が日支 ${dayBranch(i)} と支上 ${siteUpper(i)} を剋す`, evidence: [ev("tiger", tiger(i))] } : null,
    assess: recovery(),
  },
  {
    id: "illness.tigerYinControls", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "tigerYinControls", label: "白虎の陰神が白虎を制す", level: "direct",
      citations: [ZZ("白虎克日而虎之阴神能制虎者"), XJ("注", "白虎阴神自克白虎所居神，病者必不死")] },
    conditions: (i) => overcomes(on(i, tiger(i)), tiger(i))
      ? { detected: `白虎の乗る ${tiger(i)} の上（陰神）${on(i, tiger(i))} が ${tiger(i)} を剋す${overcomes(tiger(i), dayStem(i)) ? "（白虎は日干を剋している）" : ""}`, evidence: [ev("tiger.yin", on(i, tiger(i)))] } : null,
    assess: recovery(),
  },
  {
    id: "illness.tigerVoid", when: { domain: "illness" },
    reading: { axis: "actualization", topic: "tiger", key: "tigerVoid", label: "白虎の乗神が旬空（凶意が軽くなる）", level: "direct",
      citations: [XJ("原文", "虎落空亡及有德，与日相生不损人"), XJ("注", "白虎不乘旺相，又落空亡、三合、六合，与日相生，不为凶也"), KZ("p63", "凶将があっても、空亡や地を得ていないと凶意は軽減される")] },
    conditions: (i) => isVoid(i, tiger(i)) ? { detected: `白虎の乗る ${tiger(i)} が旬空`, evidence: [ev("void", tiger(i))] } : null,
    assess: recovery(MITIGATE),
  },
  {
    id: "illness.tigerTombOnWu", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "tigerTombOnWu", label: "白虎が墓となっても午に加わる", level: "direct",
      citations: [ZZ("白虎虽作墓而加午上者"), ZZ("此皆吉占也")] },
    conditions: (i) => tiger(i) === dayTomb(i) && under(i, tiger(i)) === "午"
      ? { detected: `白虎の乗る ${tiger(i)} は日墓で、地盤 午 に加わる`, evidence: [ev("tiger", tiger(i))] } : null,
    assess: recovery(),
  },
  {
    id: "illness.nobleControlsTiger", when: { domain: "illness" },
    reading: { axis: "support", topic: "tiger", key: "nobleControlsTiger", label: "白虎が日を剋し、旺相の貴人が日辰の上で虎を制す", level: "direct",
      citations: [XJ("原文", "天乙所乘皆旺相，伤其虎鬼不成迍。假令白虎来伤日，天乙宜临日与辰"), XJ("注", "白虎作鬼遥克干，天乙乘旺神立在日辰上反制白虎，必愈也")] },
    conditions: (i) => {
      const n = riding(i, "貴人"), b = tiger(i);
      if (!i.month || !overcomes(b, dayStem(i)) || !(n === stemUpper(i) || n === siteUpper(i)) || !overcomes(n, b) || !strong(seasonal(i, el(n)))) return null;
      return { detected: `白虎の乗る ${b} が日干を剋すが、${n === stemUpper(i) ? "干上" : "支上"} ${n} の貴人（${seasonal(i, el(n))}）が ${b} を剋す`, evidence: [ev("noble", n), ev("tiger", b)] };
    },
    assess: recovery(),
  },
  {
    id: "illness.tigerGhostYima", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tiger", key: "tigerGhostYima", label: "白虎の乗神が官鬼で驛馬（虎鬼が馬に乗る）", level: "combined",
      citations: [ZN("原文", "须防虎鬼驾马恶")] },
    conditions: (i) => el(tiger(i)) === ghostElement(i) && tiger(i) === yimaOf(dayBranch(i))
      ? { detected: `白虎の乗る ${tiger(i)} が官鬼で、日支の驛馬`, evidence: [ev("tiger", tiger(i)), ev("yima", tiger(i))] } : null,
    assess: illness(),
  },
  {
    id: "illness.tigerHeadTail", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "course", key: "tigerHeadTail", label: "初伝に白虎・末伝に螣蛇（重くても軽くなる）／末伝に青龍（凶が吉に変わる）", level: "direct",
      citations: [ZN("原文", "虎头蛇尾重还轻，龙末虎初凶变吉")] },
    conditions: (i) => {
      if (general(i, t(i, "initial").branch) !== "白虎") return null;
      const f = general(i, t(i, "final").branch);
      return f === "螣蛇" ? { detected: `初伝 ${t(i, "initial").branch} に白虎、末伝 ${t(i, "final").branch} に螣蛇（重くても軽くなる）`, evidence: [ev("generals", "白虎→螣蛇")] }
        : f === "青龍" ? { detected: `初伝 ${t(i, "initial").branch} に白虎、末伝 ${t(i, "final").branch} に青龍（凶が吉に変わる）`, evidence: [ev("generals", "白虎→青龍")] } : null;
    },
    assess: recovery(),
  },
  // ===== 墓（病の滞り） =====
  {
    id: "illness.initialIsStemTomb", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tomb", key: "initialIsStemTomb", label: "初伝が日干の墓（事が進まない。病占では特に重く見る）", level: "direct",
      citations: [KZ("p64", "初伝が墓の場合は事が進みません。病占の場合はとくに凶。"), XJ("原文", "次看六般来入墓，细推端的自分明。火日用神怕见戌"), DQ("凡人占鬼入传，及传墓不吉，非官讼，必疾病")] },
    conditions: (i) => t(i, "initial").growthStage === "墓" ? { detected: `初伝 ${t(i, "initial").branch} が日干 ${dayStem(i)} の墓`, evidence: [ev("initial.growthStage", "墓")] } : null,
    assess: illness(),
  },
  {
    id: "illness.stemUpperIsTomb", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tomb", key: "stemUpperIsTomb", label: "日墓が干上を覆う（魂入墓・墓神覆日）", level: "combined",
      citations: [XJ("原文", "恶见天魁覆丙丁"), XJ("注", "若丙丁日戌加丙丁之上者，为魂入墓也"), DQ("或甲日，未加寅，为墓神覆日，主人口灾晦")] },
    conditions: (i) => stemUpper(i) === dayTomb(i) ? { detected: `干上 ${stemUpper(i)} が日干 ${dayStem(i)} の墓`, evidence: [ev("lesson1.upper", stemUpper(i))] } : null,
    assess: illness(),
  },
  {
    id: "illness.initialOnOwnTomb", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tomb", key: "initialOnOwnTomb", label: "用神入墓（初伝が自分の墓の上に加わる）", level: "direct",
      citations: [XJ("注", "用加地盘墓上为用神入墓，行年上见墓神为行年入墓，及日干入墓，皆凶象也")] },
    conditions: (i) => {
      const b = t(i, "initial").branch, tomb = elementTombOf(el(b)).branch;
      return under(i, b) === tomb ? { detected: `初伝 ${b}（${el(b)}）が地盤の墓 ${tomb} に加わる`, evidence: [ev("initial.earth", tomb)] } : null;
    },
    assess: illness(),
  },
  {
    id: "illness.ghostTombInitial", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tomb", key: "ghostTombInitial", label: "日鬼と墓神を兼ねる初伝が無気（鬼墓。病占で大いに忌む）", level: "direct",
      citations: [DQ("日鬼墓神俱发用，无气，占病大忌")] },
    conditions: (i) => {
      const p = t(i, "initial"), s = seasonal(i, el(p.branch));
      return p.sixRelation === "官鬼" && p.growthStage === "墓" && s !== null && !strong(s)
        ? { detected: `初伝 ${p.branch} が官鬼で日干の墓、月令に対して無気（${s === "死" ? "旺相でない" : s}）`, evidence: [ev("initial", `${p.sixRelation}・墓`)] } : null;
    },
    assess: illness(),
  },
  // ===== 月建の神煞（Phase 5L） =====
  {
    id: "illness.ghostTombOnStemShengQi", when: { domain: "illness" },
    reading: { axis: "support", topic: "tomb", key: "ghostTombOnStemShengQi", label: "鬼墓（日鬼で日干の墓）が日に臨んで生気となる（凶を変じて吉）", level: "direct",
      citations: [DQ("或鬼墓临日作生气，或自墓传生，或鬼墓有克制冲破，变凶为吉。病者生"), DQ("如壬申日丑时午将，壬日属水，以辰为墓，又为日鬼加日，发用为鬼墓")] },
    conditions: (i) => {
      const sp = i.monthlySpirits?.shengQi, b = stemUpper(i);
      return sp && b === sp.branch && overcomes(b, dayStem(i)) && growthStageOfStem(dayStem(i), b) === "墓"
        ? { detected: `干上 ${b} が日干 ${dayStem(i)} の官鬼で墓、しかも生気（月支 ${sp.monthBranch}）`, evidence: [ev(spiritFact("shengQi"), sp.branch), ev("lesson1.upper", `${b}（官鬼・墓）`)] } : null;
    },
    assess: recovery("古典の読み（「變凶為吉。病者生」）で、回復の保証ではない"),
  },
  // ===== 行年（Phase 5O。病人＝patientPersonId の行年だけを使う） =====
  {
    id: "illness.xingNianIntoTriadTomb", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "natal", key: "xingNianIntoTriadTomb", label: "病人の行年が三合の墓に加わる（行年入墓。治りにくい）", level: "direct",
      citations: [XJ("原文", "行年三合梦魂惊"), XJ("注", "凡人年在午，或在寅，若胜光功曹加戌，谓之三合行年入墓，皆主难痊之象")] },
    // 「加戌」なので、行年の支を天盤として、それが加わる地盤（skyEarth）が行年の三合局の墓かを見る。墓の支そのものの行年（戌加戌など）は原文の例にないので読まない
    conditions: (i) => {
      const x = i.xingNian;
      if (!x) return null;
      const tomb = TRIAD_TOMB[x.branch];
      return x.branch !== tomb && x.skyEarth === tomb ? { detected: `病人の行年 ${x.branch}（数え${x.state.reckonedAge}）が三合の墓 ${tomb} に加わる`, evidence: [ev("xingNian.skyEarth", `${x.branch}加${tomb}`)] } : null;
    },
    assess: illness("古典の象意で、治る・治らないの医学的な予測ではない"),
  },
  {
    id: "illness.tigerOvercomesXingNian", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "tiger", key: "tigerOvercomesXingNian", label: "白虎の乗神が旺相で、病人の行年を剋す（古典は重く読む）", level: "direct",
      citations: [XJ("原文", "白虎所乘兼旺相，逢克行年必命倾")] },
    // 「克行年」なので、行年の支そのものを剋すかを見る（『入式』の「克行年上神」とは別の句）
    conditions: (i) => {
      const x = i.xingNian, b = tiger(i), s = seasonal(i, el(b));
      return x && s && strong(s) && overcomes(b, x.branch)
        ? { detected: `白虎の乗神 ${b} が月令に${s}で、病人の行年 ${x.branch} を剋す`, evidence: [ev("tiger", b), ev("xingNian", x.branch)] } : null;
    },
    assess: illness("古典の象意で、病状や予後の医学的な判定ではない"),
  },
  {
    id: "illness.tombToGrowth", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "course", key: "tombToGrowth", label: "墓から長生へ伝わる（危うくても安らぐ）／長生から墓へ伝わる（憂いが多い）", level: "combined",
      citations: [ZN("原文", "自墓传生危即安，初生末墓多忧事"), DQ("或鬼墓临日作生气，或自墓传生，或鬼墓有克制冲破，变凶为吉。病者生")] },
    conditions: (i) => {
      if (earthDay(i)) return null;
      const a = t(i, "initial").growthStage, b = t(i, "final").growthStage;
      return a === "墓" && b === "長生" ? { detected: `初伝 ${t(i, "initial").branch} が日干の墓、末伝 ${t(i, "final").branch} が長生（墓から生へ）`, evidence: [ev("growthStage", "墓→長生")] }
        : a === "長生" && b === "墓" ? { detected: `初伝 ${t(i, "initial").branch} が日干の長生、末伝 ${t(i, "final").branch} が墓（生から墓へ）`, evidence: [ev("growthStage", "長生→墓")] } : null;
    },
    assess: (i) => (t(i, "initial").growthStage === "墓" ? { direction: "favoring" } : { direction: "hindering" }),
  },
  {
    id: "illness.tombIntoTomb", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "course", key: "tombIntoTomb", label: "伝墓入墓（明から暗に入る。一歩ごとに深まる形）", level: "direct",
      citations: [DQ("若寅加酉，已加子，申加夘，亥加午，为用，乃传墓入墓，自明投暗。如人下井，一脚深于一脚，健人必病")] },
    conditions: (i) => {
      const b = t(i, "initial").branch, u = under(i, b);
      return ({ 寅: "酉", 巳: "子", 申: "卯", 亥: "午" } as Partial<Record<Branch, Branch>>)[b] === u ? { detected: `初伝 ${b} が地盤 ${u} に加わる`, evidence: [ev("initial.earth", u)] } : null;
    },
    assess: illness(),
  },
  {
    id: "illness.tombOnGrowth", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "course", key: "tombOnGrowth", label: "用墓加長生（癒えてもまた起こる形）", level: "direct",
      citations: [DQ("或未加亥，戌加寅，丑加已，辰加申。用墓加长生，旧事再发，讼断了又论，病痊了又作")] },
    conditions: (i) => {
      const b = t(i, "initial").branch, u = under(i, b);
      return ({ 未: "亥", 戌: "寅", 丑: "巳", 辰: "申" } as Partial<Record<Branch, Branch>>)[b] === u ? { detected: `初伝 ${b} が地盤 ${u} に加わる`, evidence: [ev("initial.earth", u)] } : null;
    },
    assess: illness("繰り返す形で、重さの判断ではない"),
  },
  // ===== 日徳・日禄 =====
  {
    id: "illness.virtueSalaryInitial", when: { domain: "illness" },
    reading: { axis: "actualization", topic: "virtue", key: "virtueSalaryInitial", label: "日徳・日禄の発用（空亡でなければ吉。空亡で病人の年命の上の日徳・日禄も空亡なら凶）", level: "direct",
      citations: [ZZ("日德日禄发用而不空亡者"), ZZ("日德日禄发用及加年命而俱值空亡者")] },
    conditions: (i) => {
      const p = t(i, "initial"), kinds = [p.isDayVirtue ? "日徳" : "", p.isDaySalary ? "日禄" : ""].filter(Boolean).join("・");
      const natal = p.isVoid && natalVirtueSalaryVoid(i) ? `。病人の年命 ${i.patientNatal} の上の ${on(i, i.patientNatal!)} も日徳・日禄で旬空` : "";
      return kinds ? { detected: `初伝 ${p.branch} が${kinds}${p.isVoid ? "で旬空" : "（旬空でない）"}${natal}`, evidence: [ev("initial.marker", kinds)] } : null;
    },
    assess: (i) => (!t(i, "initial").isVoid ? { direction: "favoring" }
      : natalVirtueSalaryVoid(i) ? { direction: "hindering" }
      : { direction: "neutral", note: VS_BOTH }),
  },
  {
    id: "illness.virtueSalaryOnNatalVoid", when: { domain: "illness" },
    reading: { axis: "actualization", topic: "natal", key: "virtueSalaryOnNatalVoid", label: "病人の年命の上の日徳・日禄が旬空（発用側は満たさない）", level: "combined",
      citations: [ZZ("日德日禄发用及加年命而俱值空亡者")] },
    conditions: (i) => {
      if (!natalVirtueSalaryVoid(i) || initialVirtueSalaryVoid(i)) return null; // 両方そろう場合は virtueSalaryInitial で読む
      const b = on(i, i.patientNatal!);
      return { detected: `病人の年命 ${i.patientNatal} の上の ${b} が日徳・日禄で旬空（発用の日徳・日禄は旬空でない、または発用していない）`, evidence: [ev("patientNatal", i.patientNatal!)] };
    },
    assess: neutral(VS_BOTH),
  },
  {
    id: "illness.salaryOnJue", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "virtue", key: "salaryOnJue", label: "日禄が絶地に臨む", level: "direct",
      citations: [ZN("原文", "德丧禄绝最为凶"), ZN("注", "日禄临绝地（日禄午加亥为绝地）", "疾病章第九 占験四")] },
    conditions: (i) => {
      const s = daySalaryOf(dayStem(i)), u = under(i, s);
      return growthStageOfStem(dayStem(i), u) === "絶" ? { detected: `日禄 ${s} が地盤 ${u}（日干の絶）に加わる`, evidence: [ev("daySalary.earth", u)] } : null;
    },
    assess: illness(),
  },
  // ===== 救い（子孫・鬼の空亡） =====
  {
    id: "illness.childrenPresent", when: { domain: "illness" },
    reading: { axis: "support", topic: "rescue", key: "childrenPresent", label: "福徳（子孫）が干上・三伝に臨む（厄を解く）", level: "combined",
      citations: [ZN("原文", "福德（子孙爻）加临名解厄")] },
    conditions: (i) => {
      const ps = [i.comparison.standing.sixRelation === "子孫" ? `干上 ${stemUpper(i)}` : "", ...TRANSMISSIONS.map((p) => (t(i, p).sixRelation === "子孫" ? `${LABEL[p]} ${t(i, p).branch}` : ""))].filter(Boolean);
      return ps.length ? { detected: `${ps.join("・")}が子孫`, evidence: [ev("sixRelation", "子孫")] } : null;
    },
    assess: recovery("「加臨」の位置は資料に明記がないので、干上・三伝で見る"),
  },
  {
    id: "illness.childrenControlTiger", when: { domain: "illness" },
    reading: { axis: "support", topic: "rescue", key: "childrenControlTiger", label: "三伝が鬼を制し虎を剋す（重くても救いがある）", level: "combined",
      citations: [XJ("注", "三传制鬼克虎，病虽重有救")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => t(i, p).sixRelation === "子孫" && overcomes(t(i, p).branch, tiger(i)));
      return ps.length ? { detected: `${ps.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")}（子孫）が官鬼を制し、白虎の乗る ${tiger(i)} を剋す`, evidence: [ev("sixRelation", "子孫"), ev("tiger", tiger(i))] } : null;
    },
    assess: recovery(),
  },
  {
    id: "illness.ghostVoid", when: { domain: "illness" },
    reading: { axis: "actualization", topic: "rescue", key: "ghostVoid", label: "日干を剋す神が旬空（日干を傷める力が減る）", level: "direct",
      citations: [KZ("p66", "病占などで日干を剋する神に空亡がついている場合は、日干を傷める力を減じることになり、その空亡自体は吉の作用をする。（ただし積極的な吉作用ではなくあくまで凶作用をなくすという意味）")] },
    conditions: (i) => {
      const pts = [{ n: "干上", b: stemUpper(i) }, { n: "支上", b: siteUpper(i) }, ...TRANSMISSIONS.map((p) => ({ n: LABEL[p], b: t(i, p).branch }))]
        .filter((x) => overcomes(x.b, dayStem(i)) && isVoid(i, x.b));
      return pts.length ? { detected: `日干 ${dayStem(i)} を剋す ${pts.map((x) => `${x.n} ${x.b}`).join("・")}が旬空`, evidence: [ev("void", pts.map((x) => x.b).join(","))] } : null;
    },
    assess: recovery(MITIGATE),
  },
  {
    id: "illness.ghostInTransmissions", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "rescue", key: "ghostInTransmissions", label: "伝が鬼の郷に入る（抜けにくい）", level: "direct",
      citations: [XJ("注", "占病切忌传入鬼乡。如甲乙日占传见申酉，或临申酉之乡，谓之传临绝地")] },
    conditions: (i) => {
      const g = ghostElement(i);
      const ps = TRANSMISSIONS.filter((p) => el(t(i, p).branch) === g || el(under(i, t(i, p).branch)) === g);
      return ps.length ? { detected: `${ps.map((p) => `${LABEL[p]} ${t(i, p).branch}${el(t(i, p).branch) === g ? "（官鬼）" : `（地盤 ${under(i, t(i, p).branch)} が官鬼）`}`).join("・")}`, evidence: [ev("ghost", g)] } : null;
    },
    assess: illness("官鬼があるだけで重いとはしない。鬼の空亡・子孫の制などと併せて読む"),
  },
  // ===== 病人の年命（patientPersonId の人物だけ） =====
  {
    id: "illness.nobleOnNatal", when: { domain: "illness" },
    reading: { axis: "support", topic: "natal", key: "nobleOnNatal", label: "病人の年命の上に貴人", level: "combined",
      citations: [ZN("原文", "贵医年命病全安")] },
    conditions: (i) => i.patientNatal && general(i, on(i, i.patientNatal)) === "貴人"
      ? { detected: `病人の年命 ${i.patientNatal} の上の ${on(i, i.patientNatal)} に貴人（「医」は資料に定義がないので見ない）`, evidence: [ev("patientNatal", i.patientNatal)] } : null,
    assess: recovery(),
  },
  {
    id: "illness.dragonYimaOnNatal", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "natal", key: "dragonYimaOnNatal", label: "青龍が日馬に乗って病人の年命に加わる", level: "direct",
      citations: [ZZ("青龙乘日马与元武乘浴盆煞加命上者"), ZZ("此皆凶占也")] },
    conditions: (i) => {
      if (!i.patientNatal) return null;
      const b = on(i, i.patientNatal);
      return b === yimaOf(dayBranch(i)) && general(i, b) === "青龍" ? { detected: `日支の驛馬 ${b} に青龍が乗り、病人の年命 ${i.patientNatal} に加わる`, evidence: [ev("patientNatal", i.patientNatal)] } : null;
    },
    assess: illness(),
  },
  {
    id: "illness.bathWater", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "omen", key: "bathWater", label: "玄武が浴盆に乗る（浴盆に水あり）", level: "direct",
      citations: [XJ("原文", "浴盆加季四时终"), XJ("注", "浴盆，春辰夏未秋戌冬丑。元武乘浴盆为浴盘见水，大凶"), ZN("原文", "浴盆（神煞）有水还须忌")] },
    conditions: (i) => {
      if (!i.month) return null;
      const b = BATH[i.month];
      return general(i, b) === "玄武" ? { detected: `浴盆 ${b}（月支 ${i.month}）に玄武が乗る${i.patientNatal && on(i, i.patientNatal) === b ? `。病人の年命 ${i.patientNatal} に加わる（『直指』「元武乘浴盆煞加命上」）` : ""}`, evidence: [ev("bath", b)] } : null;
    },
    assess: illness(),
  },
  // ===== 天門・特定の配置 =====
  {
    id: "illness.heKuiOnTianMen", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "omen", key: "heKuiOnTianMen", label: "河魁が天門（亥）に加わる", level: "direct",
      citations: [ZN("原文", "天门魁忌贵登佳")] },
    conditions: (i) => under(i, "戌") === "亥" ? { detected: "河魁 戌 が地盤 亥（天門）に加わる", evidence: [ev("plate", "戌加亥")] } : null,
    assess: illness(),
  },
  {
    id: "illness.nobleOnTianMen", when: { domain: "illness" },
    reading: { axis: "opportunity", topic: "omen", key: "nobleOnTianMen", label: "貴人が天門（亥）に登る", level: "direct",
      citations: [ZN("原文", "天门魁忌贵登佳")] },
    conditions: (i) => under(i, riding(i, "貴人")) === "亥" ? { detected: `貴人の乗る ${riding(i, "貴人")} が地盤 亥（天門）に加わる`, evidence: [ev("noble", riding(i, "貴人"))] } : null,
    assess: recovery(),
  },
  {
    id: "illness.ziOnSi", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "omen", key: "ziOnSi", label: "子が巳に臨む（古典が最も重く見る配置の一つ）", level: "direct",
      citations: [ZN("原文", "卯加戌逆主风搐，子临巳位定死亡")] },
    conditions: (i) => under(i, "子") === "巳" ? { detected: "天盤 子 が地盤 巳 に加わる", evidence: [ev("plate", "子加巳")] } : null,
    assess: illness("古典の表現は強いが、実際の予後を示すものではない"),
  },
  {
    id: "illness.gengShenOnMao", when: { domain: "illness" },
    reading: { axis: "obstruction", topic: "omen", key: "gengShenOnMao", label: "庚日に申が卯に加わる（身尸入棺。古典が最も重く見る配置の一つ）", level: "direct",
      citations: [ZN("原文", "身尸入棺亡可断（庚日申加卯）")] },
    conditions: (i) => dayStem(i) === "庚" && under(i, "申") === "卯" ? { detected: "庚日で、天盤 申 が地盤 卯 に加わる", evidence: [ev("plate", "申加卯")] } : null,
    assess: illness("古典の表現は強いが、実際の予後を示すものではない"),
  },
  {
    id: "illness.retreatInterval", when: { domain: "illness" },
    reading: { axis: "trajectory", topic: "course", key: "retreatInterval", label: "逆間伝（治りが遅い）", level: "direct",
      citations: [ZN("原文", "逆间迟痊倒拔蛇（空连茹死格，逆间传难愈）")] },
    conditions: (i) => i.comparison.movementPattern === "退間" ? { detected: `三伝 ${t(i, "initial").branch}→${t(i, "middle").branch}→${t(i, "final").branch} が一位を隔てて退く`, evidence: [ev("movementPattern", "退間")] } : null,
    assess: illness("長引く方向の読みで、重さの判断ではない"),
  },
  {
    id: "illness.stemStrong", when: { domain: "illness" },
    reading: { axis: "support", topic: "person", key: "stemStrong", label: "日干が旺相で気がある（病は軽い）", level: "direct",
      citations: [XJ("注", "日干量相有气者，其病轻")] },
    conditions: (i) => {
      const s = seasonal(i, STEM_ELEMENT[dayStem(i)]);
      return strong(s) ? { detected: `日干 ${dayStem(i)} が月令に対して${s}`, evidence: [ev("seasonal", s!)] } : null;
    },
    assess: recovery(),
  },
  {
    id: "illness.symbolVoid", when: { domain: "illness" },
    reading: { axis: "actualization", topic: "symbol", key: "symbolVoid", label: "人のために占って類神が旬空", level: "direct",
      citations: [ZZ("为人占病而类神空亡者"), ZZ("此皆凶占也")] },
    conditions: (i) => i.symbol && isVoid(i, i.symbol.branch) ? { detected: `類神 ${i.symbol.label}（${i.symbol.branch}）が旬空`, evidence: [ev("targetSymbol", i.symbol.branch)] } : null,
    assess: illness(),
  },
  // ===== 古典の象意（参考） =====
  {
    id: "illness.classicalOrgan", when: { domain: "illness" },
    reading: { axis: "relation", topic: "symbolism", key: "classicalOrgan", label: "辰上神の五行（古典が病の所在にあてる臓腑）", level: "direct",
      citations: [ZZ("以辰上神为所受之病症。如亥子水也，属肾，巳午火属心，寅卯木属肝，申酉金属肺，辰戌丑未土属脾胃")] },
    conditions: (i) => ({ detected: `支上 ${siteUpper(i)}（${el(siteUpper(i))}）を、古典は「${ORGAN[el(siteUpper(i))]}」にあてる`, evidence: [ev("lesson3.upper", siteUpper(i))] }),
    assess: neutral("古典の象意で、医学的な部位・病名の判断ではない"),
  },
];

/** 病人の本命（patientPersonId の人物だけ。問う人の本命は使わない） */
function patientNatalOf(context: InterpretationContext, missing: DomainMissingFact[]): Branch | null {
  if (context.patientPersonId === undefined) {
    missing.push({ key: "patientNatalYear", detail: "病人（patientPersonId）が指定されていないので、病人の年命の読みは省略（問う人の本命を病人の本命としては使わない。問う人本人が病人なら patientPersonId に同じ ID を入れる）" });
    return null;
  }
  const r = resolveContextBranch(context, { kind: "personNatalYear", personId: context.patientPersonId });
  if (r.status === "resolved") return r.branch;
  missing.push({ key: "patientNatalYear", detail: `病人の本命がない（${r.reason}）ので、病人の年命の読みは省略` });
  return null;
}

/** 類神の天盤支（天将はその天将が乗る支） */
function symbolOf(facts: InterpretationFacts, context: InterpretationContext): Input["symbol"] {
  const s = context.targetSymbol;
  if (!s) return null;
  if (s.kind === "branch") return { label: s.branch, branch: s.branch };
  const b = (Object.keys(facts.generals.generalOn) as Branch[]).find((x) => facts.generals.generalOn[x] === s.general)!;
  return { label: s.general, branch: b };
}

/** 問う人と病人の関係（要約の先頭に書く） */
export function patientRelationOf(context: InterpretationContext): "self" | "proxy" | "unknown" {
  if (context.patientPersonId === undefined || context.subjectPersonId === undefined) return "unknown";
  return context.patientPersonId === context.subjectPersonId ? "self" : "proxy";
}

const HEAD = "【古典の読み】以下は、六壬の古典がこの盤の配置をどう読むかの整理です。古典の一般的な見方として、日干＝病人、日支＝病で読みます（『御定六壬直指』「以日為人，辰為病」。病人の本命・類神とは別の見方）。";
const TAIL = "【注意】実際の病状・診断・予後は、この占断からは確定できません。古典の象意は医学的な事実ではありません。医学的な判断や治療の代わりに使わず、医療機関の判断に従ってください。";

/** 疾病・健康の DOMAIN 判断 */
export function evaluateIllnessDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "illness") throw new Error(`疾病以外の DOMAIN です: ${context.domain}`);
  const subject = "病勢と回復";
  const lead = [{ topic: "relation", label: "人（日）と病（辰）の関係" }];
  const rel = patientRelationOf(context);
  const who = rel === "self" ? "問う人本人が病人" : rel === "proxy" ? "代理の問い（病人は問う人と別の人物）" : context.patientPersonId !== undefined ? "病人を指定" : "病人が問う人本人かどうかは未指定";
  const wrap = (r: DomainResult): DomainResult => ({ ...r, summary: [HEAD, `人物: ${who}。`, r.summary, TAIL].join("\n") });
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  // 問う人の本命は病人の読みに使わない（buildDomainBoardInput の不足は問う人のもの）
  const own = missing.filter((x) => x.key !== "natalYear" && x.key !== "taiSui");
  if (!input) return wrap(summarizeDomainReadings("illness", context.subtype, context.goal, [], missing, subject, lead));
  const patientNatal = patientNatalOf(context, own);
  const symbol = symbolOf(facts, context);
  if (rel === "proxy" && !symbol) own.push({ key: "targetSymbol", detail: "代理の問いで類神（targetSymbol）が指定されていないので、『直指』「為人占病而類神空亡」は判断しない（類神は自動では決めない）" });
  if (!monthBranch) own.push({ key: "monthBranch", detail: "月支がないので、旺相を使う読み（日干の旺相・鬼墓の無気・貴人が虎を制す）と浴盆は判断しない" });
  if (context.goal && context.goal !== "recover") own.push({ key: "goal", detail: `goal（${context.goal}）は向きに使わない。疾病の読みは、古典が回復の方向に読むか病勢の方向に読むかで示す` });
  own.push(
    { key: "shensha", detail: "天医・地医・喪門・弔客などの神煞を使う規則は未対応（浴盆は Phase 5E から読む。病符は Phase 5M で FACT にしたが、『指南』疾病章の病符の句は見る条件が書かれていないので読まない）" },
    { key: "sickDay", detail: "病日（初めて病んだ日）を使う規則は未対応" },
    { key: "xingNianUnresolved", detail: "行年の句のうち、『入式』「行年上見墓神為行年入墓」（墓神が誰の墓か）、白虎・月の神煞と行年を組む句（神煞の組合せ）、『大全』墓門開格「並人行年」（位置）は確定しないので読まない。醫神（男女の行年）は医療の処置なので扱わない" },
    { key: "timing", detail: "回復や悪化の時期（愈期・凶期）は扱わない" },
    { key: "medical", detail: "古典の医・薬などの処置・避病の方角・祭祀、鬼祟、症状の細目は扱わない" },
    { key: "xuanOnTomb", detail: "『指南』の収魂（玄乘日墓）は保留。原典の例（占験六）は戊日の墓を辰とするが、エンジンの土の墓は戌（確定仕様）で、土日以外ではエンジンの天将の配置上この形が出ない" },
    { key: "tombKinds", detail: "『心鏡』の六般入墓のうち、鬼入墓・日干入墓・支入墓は本歌が特定の干の例だけで一般化が資料にないので保留" },
  );
  if (STEM_ELEMENT[facts.basic.dayStem] === "土") own.push({ key: "earthStageSystem", detail: "土日。『指南』は土の長生・墓を辰・申の系統で見る（占験六・占験八）が、エンジンは土の墓＝戌（確定仕様）なので、『指南』を出典とする墓・長生の規則（自墓伝生）は判断しない" });
  const seated = TRANSMISSIONS.filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length) own.push({ key: "seatedOnVoid", detail: `${seated.map((p) => LABEL[p]).join("・")}が坐空。疾病の資料には坐空を空亡に当てる根拠がないので読まない（保留）` });
  const xr = resolveXingNianPlacement(facts, context, context.patientPersonId);
  if (xr.status === "unresolved") own.push({ key: "xingNian", detail: `病人の行年は求めない（${XING_NIAN_REASON_TEXT[xr.reason]}）ので、行年の読みは判断しない。問う人の行年は使わない` });
  const full: Input = { ...input, month: monthBranch ?? null, patientNatal, symbol, xingNian: xr.status === "resolved" ? xr.placement : null };
  const readings = evaluateDomainRules(ILLNESS_RULES, full, "illness", context.subtype, context.goal);
  const r = summarizeDomainReadings("illness", context.subtype, context.goal, readings, own, subject, lead);
  return wrap({ ...r, summary: [r.summary, ...monthlySpiritSummaryLines(readings, input.monthlySpirits, monthBranch, ILLNESS_SPIRIT_UNRESOLVED)].join("\n") });
}
/** 疾病で神煞を使うが判断しない句（Phase 5L） */
const ILLNESS_SPIRIT_UNRESOLVED = [
  "『指南』「沉疴之際看生龍（龍乘生氣）」は沈痾（重い・久しい病）のときに看るという条件で、問いの入力からその場合を区別できないので読まない",
  // 要約に「死」の字を出さない（Phase 5E の方針）ので、句は引かずに内容で書く
  "『直指』の年命と墓にかかわる吉凶の句（年命が墓に入り四課に生気がある、など）は「年命」が本命だけか行年と本命か、「入墓」が何に入るのかが確定しないので読まない",
  "『直指』の白虎と月の神煞二つを組む凶の句は、二つの神煞の両方が要るか一方か、救解がないことの範囲が確定しないので読まない",
  "『心鏡』の白虎・月の神煞と行年を組む句は、行年が未実装なので読まない",
];

/** 監査用: ルールの一覧 */
export const ILLNESS_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = ILLNESS_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
