// src/lib/liuren/interpretation/travelerDomain.ts
//
// 役割（Phase 5C）:
//   行人（traveler。外出中の人が帰るか）の DOMAIN 判断。
//   基本は『御定六壬直指』行人「以干為行客以支為宅」・『六壬心鏡』行人門 注引『入式』「以日干為行人，以支為宅」
//   （干＝行人、支＝家）。問う人（subjectPersonId）と外出中の人物（travelerPersonId）は分けて持つ。
//   読みは topic で分ける: relation（行人と家）・return（帰還の動き）・movement（いまの動きの段階）・obstacle（帰還の妨げ）・safety（道中の災い）。
//   ルールは『大六壬指南』行人章第十一・『御定六壬直指』行人・『六壬心鏡』行人門・『六壬大全』逆十二格の原文と注に条件が書かれたものだけ。
//   発用・驛馬・進茹退茹だけで帰還を決めない（資料が条件を組み合わせている場合はその組合せのまま）。
//   帰期（到着の日・月）、行年、遊神・戯神は扱わない（不足として出す）。
//   二馬（Phase 5L）: 原文が「二馬」という句（『入式』「二馬入傳…馬若臨支」・『直指』「二馬臨支」「虎乘二馬」「二馬空亡」）は、
//     驛馬（markers・日支基準）と天馬（monthlySpirits・月建基準。『大六壬指南』仕宦章 割注「二馬者…驛馬…天馬」）を別々に見て、
//     当たった馬を detected に分けて書く。驛馬だけをいう句（郇注「凡驛馬在傳」・「罡乘日馬」）に天馬は加えない。月支がなければ天馬は見ない。
//
//   資料どうしの食い違い（実装しない）:
//     - 末伝が日干の墓: 『直指』は「歸者」、『心鏡』注「一云…末傳空亡墓絶者，不來」→ 向きが逆なので読まない
//     - 伏吟: 『心鏡』注引『入式』「占得伏吟未歸」と『指南』「剛日伏吟丁馬見，立刻遊人到草堂」→ 剛日＋丁馬だけを読む
//     - 末伝が日干の絶: 『心鏡』注に「不來」（一云）と「即有來意，亦不可必」の両方 → 向きを決めない

import { ELEMENT_CONTROLS, STEM_ELEMENT } from "../constants";
import type { Branch } from "../types";
import { resolveContextBranch } from "./contextBranch";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainResult, DomainRule } from "./domainResult";
import { heavenlyGeneralIntrinsicAttributesOf } from "./heavenlyGeneralAttributes";
import { monthlySpiritSummaryLines, spiritFact } from "./monthlySpiritReadings";
import { XING_NIAN_REASON_TEXT, resolveXingNianPlacement } from "./xingNianPlacement";
import type { XingNianPlacement } from "./xingNianPlacement";
import { initialOriginOf } from "./initialTransmissionOrigin";
import { branchElement, movementFactsOf } from "./movementFacts";
import type { MovementFacts } from "./movementFacts";
import { relationBetween, threeHarmonyOf } from "./relations";
import type { InterpretationContext, InterpretationGoal } from "./roles";
import { elementTombOf } from "./states";
import type { HeavenlyGeneral } from "../types";
import type { InterpretationFacts, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput {
  m: MovementFacts;
  /** 外出中の人物の本命の支（なければ null） */
  travelerNatal: Branch | null;
  /** 類神の天盤支（指定がなければ null） */
  symbol: { label: string; branch: Branch } | null;
  /** 行人（travelerPersonId）の行年の位置（Phase 5O。求められなければ null） */
  xingNian?: XingNianPlacement | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const ZN = (locator: string, layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const ZZ = (quote: string): DomainCitation => ({ source: "『御定六壬直指』", locator: "行人", layer: "原文", quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻七 行人門", layer, quote });
const DQ = (quote: string): DomainCitation => ({ source: "『六壬大全』", locator: "逆十二格", layer: "原文", quote });
const ZN_X = "行人章第十一";
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り ----
const dayStem = (i: Input) => i.facts.basic.dayStem;
const path = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
const overcomes = (a: Branch, b: Branch) => relationBetween(a, b).relations.includes("overcomes");
/** 返吟の剛日は空でも妨げない（『指南』「返吟四絶人必至（剛日…），雖見天中亦不羈」） */
const fanyinYang = (i: Input) => i.m.method === "返吟" && i.m.isYangDay;
const MENG_B: readonly Branch[] = ["寅", "巳", "申", "亥"], ZHONG_B: readonly Branch[] = ["子", "卯", "午", "酉"];
/** 二馬（驛馬・天馬）。天馬は月支がなければ入れない（推測しない） */
interface Horse { name: "驛馬" | "天馬"; fact: string; branch: Branch; isVoid: boolean; atStemUpper: boolean; atSiteUpper: boolean; transmissions: readonly TransmissionPosition[]; general: HeavenlyGeneral }
const horses = (i: Input): Horse[] => {
  const y = i.m.yima, tm = i.monthlySpirits?.tianMa;
  return [
    { name: "驛馬", fact: "yima", branch: y.branch, isVoid: y.isVoid, atStemUpper: y.atStemUpper, atSiteUpper: y.atSiteUpper, transmissions: y.transmissions, general: y.general },
    ...(tm ? [{ name: "天馬" as const, fact: spiritFact("tianMa"), branch: tm.branch, isVoid: tm.isVoid, atStemUpper: tm.lessons.some((l) => l.index === 1),
      atSiteUpper: tm.lessons.some((l) => l.index === 3), transmissions: (tm.transmissions ?? []).map((x) => x.position), general: tm.general }] : []),
  ];
};
/** 当たった馬の detected・evidence（馬ごとに分けて書く） */
const horseHit = (hs: Horse[], text: (h: Horse) => string) =>
  hs.length ? { detected: hs.map(text).join("・"), evidence: hs.map((h) => ev(h.fact, `${h.name} ${h.branch}`)) } : null;
/** 丁馬（旬丁・驛馬）が三伝にある */
const dingMaInTransmissions = (i: Input) => i.m.xunDing.transmissions.length > 0 || i.m.yima.transmissions.length > 0;

// ---- 向き（帰ってほしいか） ----
/** 行人が帰ることを望まない問い */
const notWanted = (goal: InterpretationGoal | undefined) => goal === "avoid" || goal === "separate" || goal === "release";
const returns = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  notWanted(goal) ? { direction: "hindering", note: "帰ることを望まない問いでは逆向き" } : { direction: "favoring" };
const notReturns = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  notWanted(goal) ? { direction: "favoring", note: "帰ることを望まない問いでは逆向き" } : { direction: "hindering" };
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
const harm = () => ({ direction: "hindering" as DomainDirection, note: "道中の災いは問いの目的によらない" });
/** 空の妨げ（返吟の剛日なら向きを決めない） */
const voidBlocks = (i: Input, s: string | undefined, g: InterpretationGoal | undefined) =>
  fanyinYang(i) ? { direction: "neutral" as DomainDirection, note: "返吟の剛日は空でも妨げない（『指南』「雖見天中亦不羈」）" } : notReturns(i, s, g);

/**
 * 日干（干・干上・寄宮）を使うルールが、日干を誰として読んでいるか（出典の見方。Phase 5C 監査）。
 *   traveler … 日干＝行人（『直指』「以干為行客」・『入式』「以日干為行人」・『指南』歌「干若克支離彼方」）
 *   asker    … 日干＝問う人（『指南』増補「我克他生他，都是我想他來也」）
 * 本命・類神で特定した人物を日干と同一視するルールはない（本命は travelerNatal、類神は symbol だけで見る）。
 */
export const STEM_PERSPECTIVE: Readonly<Record<string, "traveler" | "asker">> = {
  stemOvercomesBranch: "traveler", branchOvercomesStem: "traveler", stemBranchSame: "traveler", stemBranchDiscord: "traveler", mutualOverlay: "traveler",
  siteToStem: "traveler", stemToSite: "traveler", finalAtDayBranch: "traveler", divinationOnStemSite: "traveler",
  tombCoversStemOrSite: "traveler", tianGangOnStemOrSite: "traveler", initialJue: "traveler", initialOfficer: "traveler", finalJue: "traveler",
  yimaInTransit: "traveler", xuanwuYimaOnStem: "traveler",
  initialGeneratesStem: "asker", stemActsOnInitial: "asker",
};
const PERSPECTIVE_TEXT = { traveler: "（日干＝行人の見方）", asker: "（日干＝問う人の見方。『指南』増補）" } as const;

const TRAVELER_RULES: readonly Rule[] = [
  // ===== 行人と家（relation） =====
  {
    id: "traveler.stemOvercomesBranch", when: { domain: "traveler" },
    reading: { axis: "relation", topic: "relation", key: "stemOvercomesBranch", label: "干が支を剋す（行人が彼の地を離れる）", level: "direct",
      citations: [ZN(ZN_X, "原文", "干若克支离彼方"), XJ("注", "《入式》…干克支则归")] },
    conditions: (i) => relationBetween(dayStem(i), i.m.dayBranch).relations.includes("overcomes")
      ? { detected: `日干 ${dayStem(i)}（${STEM_ELEMENT[dayStem(i)]}）が日支 ${i.m.dayBranch}（${branchElement(i.m.dayBranch)}）を剋す`, evidence: [ev("relation", "日干→日支 剋")] } : null,
    assess: returns,
  },
  {
    id: "traveler.branchOvercomesStem", when: { domain: "traveler" },
    reading: { axis: "relation", topic: "relation", key: "branchOvercomesStem", label: "支が干を剋す（帰らない）", level: "direct",
      citations: [ZN(ZN_X, "原文", "反此卜归归未得"), XJ("注", "《入式》…支克干未归"), ZZ("辰克曰…皆以不归断之")] },
    conditions: (i) => relationBetween(i.m.dayBranch, dayStem(i)).relations.includes("overcomes")
      ? { detected: `日支 ${i.m.dayBranch}（${branchElement(i.m.dayBranch)}）が日干 ${dayStem(i)}（${STEM_ELEMENT[dayStem(i)]}）を剋す`, evidence: [ev("relation", "日支→日干 剋")] } : null,
    assess: notReturns,
  },
  {
    id: "traveler.stemBranchSame", when: { domain: "traveler" },
    reading: { axis: "relation", topic: "relation", key: "stemBranchSame", label: "干支が比和（帰る）", level: "direct",
      citations: [ZZ("以干为行客以支为宅，彼此比和则归")] },
    conditions: (i) => relationBetween(dayStem(i), i.m.dayBranch).relations.includes("sameElement")
      ? { detected: `日干 ${dayStem(i)} と日支 ${i.m.dayBranch} が同じ五行（${branchElement(i.m.dayBranch)}）`, evidence: [ev("relation", "比和")] } : null,
    assess: returns,
  },
  {
    id: "traveler.stemBranchDiscord", when: { domain: "traveler" },
    reading: { axis: "relation", topic: "relation", key: "stemBranchDiscord", label: "干（寄宮）と支が刑冲破害（帰らない）", level: "combined",
      citations: [ZZ("刑冲破害则不归")] },
    conditions: (i) => {
      const rel = relationBetween(i.m.lodgingBranch, i.m.dayBranch).relations;
      const hit = (["punishes", "punishedBy", "clashes", "breaks", "harms"] as const).filter((r) => rel.includes(r));
      if (!hit.length) return null;
      const name = { punishes: "刑", punishedBy: "刑", clashes: "冲", breaks: "破", harms: "害" } as const;
      return { detected: `日干の寄宮 ${i.m.lodgingBranch} と日支 ${i.m.dayBranch} が${[...new Set(hit.map((r) => name[r]))].join("・")}（干は寄宮で見る）`, evidence: [ev("relation", hit.join(","))] };
    },
    assess: notReturns,
  },
  {
    id: "traveler.mutualOverlay", when: { domain: "traveler" },
    reading: { axis: "relation", topic: "relation", key: "mutualOverlay", label: "干支互臨（遅れずに来る）", level: "direct",
      citations: [ZN(ZN_X, "原文", "干支互临又何延")] },
    conditions: (i) => i.m.stemUpper === i.m.dayBranch && i.m.siteUpper === i.m.lodgingBranch
      ? { detected: `干上が日支 ${i.m.dayBranch}、支上が日干の寄宮 ${i.m.lodgingBranch}（干支が互いに臨む）`, evidence: [ev("lesson1.upper", i.m.stemUpper), ev("lesson3.upper", i.m.siteUpper)] } : null,
    assess: returns,
  },
  // ===== 帰還の動き（return） =====
  ...([
    ["siteToStem", "支上から干上へ伝わる（人は来る）", "支上传干人固来", (i: Input) => i.m.transmissions.initial === i.m.siteUpper && i.m.transmissions.final === i.m.stemUpper, "初伝が支上", "末伝が干上"],
    ["stemToSite", "干上から支上へ伝わる（人は来る）", "干传支上亦同测", (i: Input) => i.m.transmissions.initial === i.m.stemUpper && i.m.transmissions.final === i.m.siteUpper, "初伝が干上", "末伝が支上"],
  ] as const).map(([key, label, quote, cond, a, b]): Rule => ({
    id: `traveler.${key}`, when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key, label, level: "direct", citations: [ZN(ZN_X, "原文", quote)] },
    conditions: (i) => cond(i) ? { detected: `${a} ${i.m.transmissions.initial}、${b} ${i.m.transmissions.final}`, evidence: [ev("initial", i.m.transmissions.initial), ev("final", i.m.transmissions.final)] } : null,
    assess: returns,
  })),
  {
    id: "traveler.finalAtDayBranch", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "finalAtDayBranch", label: "末伝（行人の足）が日支に至る", level: "direct",
      citations: [ZN(ZN_X, "原文", "更求末足即末传抵辰日"), ZZ("或初传是日而末传是辰…此皆归者也")] },
    conditions: (i) => i.m.transmissions.final === i.m.dayBranch
      ? { detected: `末伝が日支 ${i.m.dayBranch}${i.m.transmissions.initial === i.m.lodgingBranch ? `（初伝も日干の寄宮 ${i.m.lodgingBranch}）` : ""}`, evidence: [ev("final", i.m.dayBranch)] } : null,
    assess: returns,
  },
  {
    id: "traveler.initialBeforeBranch", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialBeforeBranch", label: "発用が日支の前（来る）", level: "combined",
      citations: [XJ("注", "《入式》…若用神在今日支前，则来；在今日支后不来。如子日丑寅为前，戌亥为后"), ZN(ZN_X, "原文", "发用前于本日支")] },
    conditions: (i) => [1, 2].includes(i.m.initialOffsetFromDayBranch)
      ? { detected: `発用 ${i.m.transmissions.initial} が日支 ${i.m.dayBranch} の${i.m.initialOffsetFromDayBranch}つ前`, evidence: [ev("initialOffset", String(i.m.initialOffsetFromDayBranch))] } : null,
    assess: returns,
  },
  {
    id: "traveler.initialBehindBranch", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialBehindBranch", label: "発用が日支の後（旅先にとどまり動かない）", level: "combined",
      citations: [XJ("注", "《入式》…在今日支后不来。如子日丑寅为前，戌亥为后"), ZN(ZN_X, "原文", "若还发用居他处，旅次盘桓未动移")] },
    conditions: (i) => [-1, -2].includes(i.m.initialOffsetFromDayBranch)
      ? { detected: `発用 ${i.m.transmissions.initial} が日支 ${i.m.dayBranch} の${-i.m.initialOffsetFromDayBranch}つ後`, evidence: [ev("initialOffset", String(i.m.initialOffsetFromDayBranch))] } : null,
    assess: notReturns,
  },
  {
    id: "traveler.initialOvercomesFinal", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialOvercomesFinal", label: "初伝が末伝を剋す（人はすでに帰途）", level: "direct",
      citations: [ZN(ZN_X, "原文", "初克末兮人已还")] },
    conditions: (i) => overcomes(i.m.transmissions.initial, i.m.transmissions.final)
      ? { detected: `初伝 ${i.m.transmissions.initial} が末伝 ${i.m.transmissions.final} を剋す`, evidence: [ev("relation", "初伝→末伝 剋")] } : null,
    assess: returns,
  },
  {
    id: "traveler.finalOvercomesInitial", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "finalOvercomesInitial", label: "末伝が初伝を剋す（まだ発っていない）", level: "direct",
      citations: [ZN(ZN_X, "原文", "末克初兮车未驾")] },
    conditions: (i) => overcomes(i.m.transmissions.final, i.m.transmissions.initial)
      ? { detected: `末伝 ${i.m.transmissions.final} が初伝 ${i.m.transmissions.initial} を剋す`, evidence: [ev("relation", "末伝→初伝 剋")] } : null,
    assess: notReturns,
  },
  {
    id: "traveler.dingMaDirection", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "dingMaDirection", label: "丁馬が三伝にあり、三伝が退く（来る向き）／進む（去る向き）", level: "combined",
      citations: [ZN(ZN_X, "原文", "游煞丁马行不停，退则来兮进则去"), ZN(ZN_X, "注", "顺则游，逆则归，自然之理也")] },
    conditions: (i) => {
      if (!dingMaInTransmissions(i) || i.m.movementPattern === "その他") return null;
      const back = i.m.movementPattern === "退茹" || i.m.movementPattern === "退間";
      return { detected: `${i.m.yima.transmissions.length ? `驛馬 ${i.m.yima.branch}` : `旬丁 ${i.m.xunDing.branch}`}が三伝にあり、三伝は${i.m.movementPattern}（${back ? "退く＝来る向き" : "進む＝去る向き"}）`,
        evidence: [ev("movementPattern", i.m.movementPattern), ev("dingMa", "三伝")] };
    },
    assess: (i, s, g) => (i.m.movementPattern === "退茹" || i.m.movementPattern === "退間" ? returns(i, s, g) : notReturns(i, s, g)),
  },
  {
    id: "traveler.lianRu", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "lianRu", label: "連茹（人が続いて至る）", level: "direct",
      citations: [ZN(ZN_X, "注", "增补…连茹鳞次有人至…连茹必连续有人到也")] },
    conditions: (i) => i.m.movementPattern === "進茹" || i.m.movementPattern === "退茹"
      ? { detected: `三伝が${i.m.movementPattern}（${i.m.transmissions.initial}→${i.m.transmissions.middle}→${i.m.transmissions.final}）`, evidence: [ev("movementPattern", i.m.movementPattern)] } : null,
    assess: returns,
  },
  {
    id: "traveler.finalOnMaoYou", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "finalOnMaoYou", label: "末伝（行人の足）が卯酉に臨む（至る）", level: "direct",
      citations: [XJ("注", "末传为行人足，临卯酉主至也"), XJ("注", "一云…末传临卯酉为来")] },
    conditions: (i) => i.m.transmissionEarth.final === "卯" || i.m.transmissionEarth.final === "酉"
      ? { detected: `末伝 ${i.m.transmissions.final} が地盤 ${i.m.transmissionEarth.final} に臨む`, evidence: [ev("final.earth", i.m.transmissionEarth.final)] } : null,
    assess: returns,
  },
  {
    id: "traveler.divinationOnStemSite", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "divinationOnStemSite", label: "占時が干上・支上にある（来る）", level: "direct",
      citations: [XJ("注", "《入式》…时归日辰上来")] },
    conditions: (i) => i.m.divinationBranch === i.m.stemUpper || i.m.divinationBranch === i.m.siteUpper
      ? { detected: `占時 ${i.m.divinationBranch} が${i.m.divinationBranch === i.m.stemUpper ? "干上" : "支上"}にある`, evidence: [ev("divinationBranch", i.m.divinationBranch)] } : null,
    assess: returns,
  },
  // 『御定六壬直指』行人「出久而疑其不歸者…此皆歸者也」の列挙（条件がはっきりしたものだけ）
  {
    id: "traveler.tombCoversStemOrSite", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "tombCoversStemOrSite", label: "墓が干・支を覆う（帰る）", level: "direct",
      citations: [ZZ("视四课内或墓覆干，或墓覆支…此皆归者也")] },
    conditions: (i) => {
      const stemTomb = elementTombOf(STEM_ELEMENT[dayStem(i)]).branch, siteTomb = elementTombOf(branchElement(i.m.dayBranch)).branch;
      const hits = [i.m.stemUpper === stemTomb ? `干上 ${stemTomb} が日干の墓` : "", i.m.siteUpper === siteTomb ? `支上 ${siteTomb} が日支の墓` : ""].filter(Boolean);
      return hits.length ? { detected: hits.join("、"), evidence: [ev("elementTomb", hits.join(","))] } : null;
    },
    assess: returns,
  },
  {
    id: "traveler.tianGangOnStemOrSite", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "tianGangOnStemOrSite", label: "日辰の上に天罡（帰る）", level: "direct",
      citations: [ZZ("或日辰上见天罡…此皆归者也")] },
    conditions: (i) => i.m.tianGang.atStemUpper || i.m.tianGang.atSiteUpper
      ? { detected: `天罡 辰 が${i.m.tianGang.atStemUpper ? "干上" : "支上"}にある`, evidence: [ev("tianGang", i.m.tianGang.atStemUpper ? "干上" : "支上")] } : null,
    assess: returns,
  },
  {
    id: "traveler.initialJue", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialJue", label: "初伝が日干の絶神（帰る）", level: "direct",
      citations: [ZZ("或初传是日之绝神…此皆归者也")] },
    conditions: (i) => path(i, "initial").growthStage === "絶"
      ? { detected: `初伝 ${i.m.transmissions.initial} が日干 ${dayStem(i)} の絶`, evidence: [ev("initial.growthStage", "絶")] } : null,
    assess: returns,
  },
  {
    id: "traveler.initialOfficer", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialOfficer", label: "初伝が官鬼（日干を剋す。帰る）", level: "direct",
      citations: [ZZ("或为日之官鬼…此皆归者也")] },
    conditions: (i) => path(i, "initial").sixRelation === "官鬼"
      ? { detected: `初伝 ${i.m.transmissions.initial} が官鬼（日干 ${dayStem(i)} を剋す）`, evidence: [ev("initial.sixRelation", "官鬼")] } : null,
    assess: returns,
  },
  {
    id: "traveler.initialGeneratesStem", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "initialGeneratesStem", label: "初伝が日干（問う人）を生ず（至る）", level: "direct",
      citations: [ZN(ZN_X, "注", "增补：若问行人来与否…生日为至")] },
    conditions: (i) => path(i, "initial").relationToDayStem === "transmissionGeneratesDayStem"
      ? { detected: `初伝 ${i.m.transmissions.initial} が日干 ${dayStem(i)} を生ず`, evidence: [ev("initial.relationToDayStem", "生")] } : null,
    assess: returns,
  },
  {
    id: "traveler.stemActsOnInitial", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "stemActsOnInitial", label: "日干（問う人）が初伝を生ず・剋す（こちらが思うだけで来ない）", level: "direct",
      citations: [ZN(ZN_X, "注", "增补：…日生日克空心有…我克他生他，都是我想他来也"), ZZ("若日克初传…皆以不归断之")] },
    conditions: (i) => {
      const r = path(i, "initial").relationToDayStem;
      if (r !== "dayStemGeneratesTransmission" && r !== "dayStemOvercomesTransmission") return null;
      return { detected: `日干 ${dayStem(i)} が初伝 ${i.m.transmissions.initial} を${r === "dayStemGeneratesTransmission" ? "生ず" : "剋す"}`, evidence: [ev("initial.relationToDayStem", r)] };
    },
    assess: notReturns,
  },
  {
    id: "traveler.finalJue", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "finalJue", label: "末伝が日干の絶（来る意はあるが確かでない）", level: "direct",
      citations: [XJ("注", "若末传是今日干之绝神，即有来意，亦不可必也"), XJ("注", "一云…如末传空亡墓绝者，不来也")] },
    conditions: (i) => path(i, "final").growthStage === "絶"
      ? { detected: `末伝 ${i.m.transmissions.final} が日干 ${dayStem(i)} の絶`, evidence: [ev("final.growthStage", "絶")] } : null,
    assess: neutral("『心鏡』の注に「来意あり、必ずではない」と「来ない」（一云）の両方があり、向きを決めない"),
  },
  // 本命（外出中の人物）
  {
    id: "traveler.natalInitial", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "natalInitial", label: "行人の本命が発用（来る）", level: "direct",
      citations: [XJ("注", "《入式》…本命及进上发用来")] },
    conditions: (i) => i.travelerNatal && i.m.transmissions.initial === i.travelerNatal
      ? { detected: `外出中の人物の本命 ${i.travelerNatal} が初伝`, evidence: [ev("travelerNatal", i.travelerNatal)] } : null,
    assess: returns,
  },
  // 類神
  {
    id: "traveler.symbolOnSite", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "symbolOnSite", label: "類神が支に乗る（帰る）", level: "direct",
      citations: [ZZ("或类神乘支…此皆归者也")] },
    conditions: (i) => i.symbol && i.symbol.branch === i.m.siteUpper
      ? { detected: `類神（${i.symbol.label}）${i.symbol.branch} が支上にある`, evidence: [ev("targetSymbol", i.symbol.branch)] } : null,
    assess: returns,
  },
  {
    id: "traveler.symbolInBoard", when: { domain: "traveler" },
    reading: { axis: "opportunity", topic: "return", key: "symbolInBoard", label: "類神が課伝に入る（至る）", level: "direct",
      citations: [XJ("原文", "此类悉皆求限至，课中逢类更无疑"), ZN(ZN_X, "原文", "所占若入课传中，逐其类兮天盘探")] },
    conditions: (i) => {
      if (!i.symbol) return null;
      const b = i.symbol.branch;
      const where = [...i.facts.lessons.filter((l) => l.upper === b).map((l) => `${l.index}課`), ...TRANSMISSIONS.filter((p) => i.m.transmissions[p] === b).map((p) => LABEL[p])];
      return where.length ? { detected: `類神（${i.symbol.label}）${b} が${where.join("・")}にある`, evidence: [ev("targetSymbol", where.join(","))] } : null;
    },
    assess: returns,
  },
  // ===== いまの動きの段階（movement） =====
  {
    id: "traveler.tianGangStage", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "movement", key: "tianGangStage", label: "天罡の下の地盤（孟＝未発・仲＝途中・季＝すぐ至る）", level: "direct",
      citations: [ZZ("视天罡之下神加孟，未发，加仲半路，加季即至"), ZN(ZN_X, "原文", "孟迟仲中罡季速"), XJ("注", "天罡加季门前待")] },
    conditions: (i) => {
      const c = i.m.tianGang.earthClass;
      return { detected: `天罡 辰 が地盤 ${i.m.tianGang.earth}（${c}）に加わる（${c === "孟" ? "まだ発っていない" : c === "仲" ? "途中にいる" : "すぐ至る"}）`, evidence: [ev("tianGang.earth", `${i.m.tianGang.earth}（${c}）`)] };
    },
    assess: (i, s, g) => (i.m.tianGang.earthClass === "季" ? returns(i, s, g) : i.m.tianGang.earthClass === "孟" ? notReturns(i, s, g)
      : { direction: "neutral", note: "途中にいる（着くかは他の要素による）" }),
  },
  {
    id: "traveler.yimaInTransit", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "movement", key: "yimaInTransit", label: "二馬（驛馬・天馬）が三伝・干上にある（途中を行く）", level: "direct",
      citations: [XJ("注", "《入式》…若二马入传，或临日干，则在中途行"), XJ("注", "凡驿马在传，主在中途行")] },
    // 驛馬は『入式』・郇注の両方、天馬は『入式』の「二馬」だけによる
    conditions: (i) => horseHit(horses(i).filter((h) => h.transmissions.length || h.atStemUpper),
      (h) => `${h.name} ${h.branch} が${[...h.transmissions.map((p) => LABEL[p]), ...(h.atStemUpper ? ["干上"] : [])].join("・")}にある${h.name === "天馬" ? "（『入式』の「二馬」による）" : ""}`),
    assess: neutral("移動の途中にあることを示すだけで、帰着は決めない"),
  },
  {
    id: "traveler.yimaAtSite", when: { domain: "traveler" },
    reading: { axis: "actualization", topic: "return", key: "yimaAtSite", label: "二馬（驛馬・天馬）が支に臨む（到る）", level: "direct",
      citations: [XJ("注", "《入式》…马若临支则到"), ZZ("或二马临支…此皆归者也")] },
    conditions: (i) => horseHit(horses(i).filter((h) => h.atSiteUpper), (h) => `${h.name} ${h.branch} が支上にある`),
    assess: returns,
  },
  {
    id: "traveler.tigerOnYima", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "tigerOnYima", label: "白虎が二馬（驛馬・天馬）に乗る（帰る）", level: "direct",
      citations: [ZZ("或虎乘二马，此皆归者也")] },
    conditions: (i) => horseHit(horses(i).filter((h) => h.general === "白虎"), (h) => `${h.name} ${h.branch} に白虎が乗る`),
    assess: returns,
  },
  {
    id: "traveler.fuyinYangDingMa", when: { domain: "traveler" },
    reading: { axis: "actualization", topic: "return", key: "fuyinYangDingMa", label: "剛日の伏吟に丁馬（すぐ着く）", level: "direct",
      citations: [ZN(ZN_X, "原文", "刚日伏吟丁马见，立刻游人到草堂")] },
    conditions: (i) => i.m.method === "伏吟" && i.m.isYangDay && (i.m.xunDing.lessons.length || i.m.xunDing.transmissions.length || i.m.yima.lessons.length || i.m.yima.transmissions.length)
      ? { detected: `剛日（${i.facts.basic.dayStem}）の伏吟で、丁馬（旬丁 ${i.m.xunDing.branch}・驛馬 ${i.m.yima.branch}）が課伝にある`, evidence: [ev("method", "伏吟"), ev("dingMa", "課伝")] } : null,
    assess: returns,
  },
  {
    id: "traveler.fanyinYang", when: { domain: "traveler" },
    reading: { axis: "actualization", topic: "return", key: "fanyinYang", label: "剛日の返吟（必ず至る。空でも妨げない）", level: "direct",
      citations: [ZN(ZN_X, "原文", "返吟四绝人必至（刚日为四绝体，柔日不是），虽见天中亦不羁")] },
    conditions: (i) => fanyinYang(i) ? { detected: `剛日（${i.facts.basic.dayStem}）の返吟`, evidence: [ev("method", "返吟")] } : null,
    assess: returns,
  },
  // 逆十二格（三伝の並び）
  ...([
    ["悖戻格", "戌申午", "占行人，未至", false],
    ["凝陽格", "申午辰", "行人来迟", false],
    ["顧祖格", "午辰寅", "自午传寅，子回顾母，有复旧庐之象…占贼去，行人来", true],
    ["渉疑格", "辰寅子", "占事，进退不决，行人未来，欲出不出", false],
    ["時遁格", "亥酉未", "占行人不来，出行不出", false],
  ] as const).map(([name, seq, quote, comes]): Rule => ({
    id: `traveler.reverseTwelve.${name}`, when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: `reverseTwelve.${name}`, label: `逆十二格・${name}（${comes ? "行人来る" : "行人来ない・遅い"}）`, level: "direct",
      citations: [DQ(`${seq}为${name}…${quote}`)] },
    conditions: (i) => i.m.reverseTwelve === name ? { detected: `三伝 ${seq.split("").join("→")} は${name}`, evidence: [ev("reverseTwelve", name)] } : null,
    assess: comes ? returns : notReturns,
  })),
  // 課体（『指南』の占験・増補の判断）
  {
    id: "traveler.haoShi", when: { domain: "traveler" },
    reading: { axis: "actualization", topic: "return", key: "haoShi", label: "蒿矢が発用（行人は速く来る）", level: "direct",
      citations: [ZN(`${ZN_X} 占験四`, "原文", "驿马临干，贵人入辰。又蒿矢为用，行人速来，故知其起程")] },
    conditions: (i) => i.m.pattern === "蒿矢格" ? { detected: "課体が蒿矢", evidence: [ev("pattern", "蒿矢格")] } : null,
    assess: returns,
  },
  {
    id: "traveler.danShe", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "return", key: "danShe", label: "弾射（こちらが人を謀る課で、人は来ない）", level: "direct",
      citations: [ZN(`${ZN_X} 増補占例一`, "注", "弹射课为己谋人，非人谋己，故不来也")] },
    conditions: (i) => i.m.pattern === "弾射格" ? { detected: "課体が弾射", evidence: [ev("pattern", "弾射格")] } : null,
    assess: notReturns,
  },
  // ===== 帰還の妨げ（obstacle） =====
  // 空は旬空（空亡・天中）で読む。坐空（『指南』の割注でいう「落空」）を古典の「空陷」の「陷」に当てる根拠は資料にないので、
  // 初伝・中伝の坐空は読まない（不足に出す）。末伝の坐空だけは、行人 占験一で「中末空亡」とし割注に「寅卯落空」とある（末伝 寅 は落空）
  // ことを根拠に、組合せとして読む。
  ...([
    ["initial", "initialVoid", "初伝が旬空（阻みがある・帰らない）", [ZN(ZN_X, "原文", "初传若是逢空陷，有阻还当逐类推"), ZZ("或初传空亡…皆以不归断之")]],
    ["middle", "middleVoid", "中伝が旬空（道中で阻まれる）", [ZN(ZN_X, "原文", "中传空亡途路阻")]],
    ["final", "finalVoid", "末伝が旬空（近くまで来て滞る）", [ZN(ZN_X, "原文", "末遇天中邻近滞"), XJ("注", "一云…如末传空亡墓绝者，不来也")]],
  ] as const).map(([p, key, label, citations]): Rule => ({
    id: `traveler.${key}`, when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key, label, level: "direct", citations },
    conditions: (i) => path(i, p).isVoid ? { detected: `${LABEL[p]} ${path(i, p).branch} が旬空`, evidence: [ev(`${p}.isVoid`, "旬空")] } : null,
    assess: voidBlocks,
  })),
  {
    id: "traveler.finalSeatedOnVoid", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "finalSeatedOnVoid", label: "末伝が坐空（落空。近くまで来て滞る）", level: "combined",
      citations: [ZN(`${ZN_X} 占験一`, "原文", "辰巳空，寅卯落空"), ZN(`${ZN_X} 占験一`, "原文", "盖因中末空亡，是以月内不来")] },
    conditions: (i) => !path(i, "final").isVoid && path(i, "final").isSeatedOnVoid
      ? { detected: `末伝 ${i.m.transmissions.final} が坐空（地盤 ${i.m.transmissionEarth.final} が旬空。『指南』の「落空」）`, evidence: [ev("final.isSeatedOnVoid", "坐空")] } : null,
    assess: voidBlocks,
  },
  {
    id: "traveler.yimaVoid", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "yimaVoid", label: "二馬（驛馬・天馬）が空（帰らない）", level: "direct",
      citations: [ZZ("二马空亡…皆以不归断之")] },
    // 空は旬空だけ（坐空は読まない）。二馬の一方だけが空でも、空の馬を書いて読む（驛馬だけのときの読みと同じ扱い）
    conditions: (i) => horseHit(horses(i).filter((h) => h.isVoid), (h) => `${h.name} ${h.branch} が旬空`),
    assess: voidBlocks,
  },
  {
    id: "traveler.symbolVoid", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "symbolVoid", label: "類神が空（帰らない）", level: "direct",
      citations: [ZZ("类神空亡…皆以不归断之")] },
    conditions: (i) => i.symbol && i.facts.xun.voidBranches.includes(i.symbol.branch)
      ? { detected: `類神（${i.symbol.label}）${i.symbol.branch} が旬空`, evidence: [ev("targetSymbol.isVoid", "旬空")] } : null,
    assess: voidBlocks,
  },
  {
    id: "traveler.jianMovement", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "jianMovement", label: "間進・間退（他郷で阻まれる）", level: "direct",
      citations: [ZN(ZN_X, "原文", "间进间退两课名，他乡阻隔分明白")] },
    conditions: (i) => i.m.movementPattern === "進間" || i.m.movementPattern === "退間"
      ? { detected: `三伝が${i.m.movementPattern}（${i.m.transmissions.initial}→${i.m.transmissions.middle}→${i.m.transmissions.final}）`, evidence: [ev("movementPattern", i.m.movementPattern)] } : null,
    assess: notReturns,
  },
  {
    id: "traveler.harmonyAway", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "harmonyAway", label: "三伝が三合（他郷に心が留まる）", level: "combined",
      citations: [ZN(ZN_X, "原文", "传将若合三六中，眷恋他乡资斧丰")] },
    conditions: (i) => {
      const h = threeHarmonyOf([i.m.transmissions.initial, i.m.transmissions.middle, i.m.transmissions.final]);
      return h.complete ? { detected: `三伝が${h.element}の三合局（六合は未対応）`, evidence: [ev("threeHarmony", `${h.element}局`)] } : null;
    },
    assess: notReturns,
  },
  {
    id: "traveler.guanGe", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "obstacle", key: "guanGe", label: "魁罡が卯酉子午に加わる（関隔。道中の行人は帰れない）", level: "direct",
      citations: [ZN(ZN_X, "原文", "卯酉为隔子午关，魁罡加处事多艰。津梁风雨时时阻，中路行人未得还"), ZN(ZN_X, "注", "魁罡临卯子为天关…临酉午为地格")] },
    conditions: (i) => {
      const hits = [i.m.tianGang, i.m.heKui].filter((x) => x.earthClass === "仲").map((x) => `${x.branch === "辰" ? "天罡" : "河魁"} ${x.branch} が地盤 ${x.earth}`);
      return hits.length ? { detected: `${hits.join("、")}に加わる`, evidence: [ev("guanGe", hits.join(","))] } : null;
    },
    assess: notReturns,
  },
  // ===== 行年（Phase 5O。行人＝travelerPersonId の行年だけを使う） =====
  {
    id: "traveler.xingNianSkyEarth", when: { domain: "traveler" },
    reading: { axis: "trajectory", topic: "safety", key: "xingNianSkyEarth", label: "行人の行年が加わる地盤が孟（他郷で吉）／仲（災い）／季（凶）", level: "direct",
      citations: [ZN(ZN_X, "原文", "行年加孟他乡吉，加仲为灾临季凶"), XJ("注", "又看行年临孟，则生")] },
    // 「加」なので、行年の支を天盤として、それが加わる地盤（skyEarth）を見る
    conditions: (i) => {
      const x = i.xingNian;
      if (!x) return null;
      const c = MENG_B.includes(x.skyEarth) ? "孟" : ZHONG_B.includes(x.skyEarth) ? "仲" : "季";
      return { detected: `行人の行年 ${x.branch}（数え${x.state.reckonedAge}）が地盤 ${x.skyEarth}（${c}）に加わる（${c === "孟" ? "古典は他郷で吉とする" : c === "仲" ? "古典は災いとする" : "古典は凶とする"}）`, evidence: [ev("xingNian.skyEarth", `${x.branch}加${x.skyEarth}`)] };
    },
    assess: (i) => (MENG_B.includes(i.xingNian!.skyEarth) ? { direction: "favoring", note: "道中・他郷での安否の古典の読みで、問いの目的によらない" } : harm()),
  },
  {
    id: "traveler.xingNianUpperInTransmissions", when: { domain: "traveler" },
    reading: { axis: "actualization", topic: "return", key: "xingNianUpperInTransmissions", label: "行人の行年上神が支上の二課から発用、または三伝に入る（必ず来る）", level: "direct",
      citations: [XJ("注", "又看行年上所得之神，若在支上二课发用，或入三传者，必来之象")] },
    // 「行年上所得之神」なので、地盤の行年の上に加わる天盤の支（upper）を見る
    conditions: (i) => {
      const x = i.xingNian;
      if (!x || !x.upperTransmissions.length) return null;
      // 「入三傳」は発用元によらず成立する。「支上二課發用」は発用元が一つの課に決まる（uniqueLesson・ruleLesson）ときだけ添え、初伝の支から推測しない
      const o = initialOriginOf(i.facts), fromBranch = x.upperTransmissions.includes("initial") && !!o && (o.kind === "uniqueLesson" || o.kind === "ruleLesson") && o.lesson >= 3;
      return { detected: `行人の行年 ${x.branch} の上神 ${x.upper} が${x.upperTransmissions.map((p) => LABEL[p]).join("・")}にある${fromBranch ? "（支上の二課から発用）" : ""}`, evidence: [ev("xingNian.upper", x.upper)] };
    },
    assess: returns,
  },
  // ===== 道中の災い（safety） =====
  {
    id: "traveler.xuanwuYimaOnStem", when: { domain: "traveler" },
    reading: { axis: "obstruction", topic: "safety", key: "xuanwuYimaOnStem", label: "玄武が驛馬に乗って干に臨み、命を剋す（道中の盗賊）", level: "combined",
      citations: [ZN(`${ZN_X} 占験二`, "原文", "玄武驿马临干，遥克庚午命神，主大路有马贼劫夺之应")] },
    conditions: (i) => {
      if (!i.travelerNatal || i.m.yima.general !== "玄武" || !i.m.yima.atStemUpper) return null;
      const el = heavenlyGeneralIntrinsicAttributesOf("玄武").element;
      if (ELEMENT_CONTROLS[el] !== branchElement(i.travelerNatal)) return null;
      return { detected: `驛馬 ${i.m.yima.branch} に玄武（${el}）が乗って干上にあり、行人の本命 ${i.travelerNatal}（${branchElement(i.travelerNatal)}）を剋す`, evidence: [ev("yima", "干上・玄武"), ev("travelerNatal", i.travelerNatal)] };
    },
    assess: harm,
  },
];

/** 外出中の人物の本命 */
function travelerNatalOf(context: InterpretationContext, missing: DomainMissingFact[]): Branch | null {
  if (context.travelerPersonId === undefined) {
    missing.push({ key: "travelerNatalYear", detail: "外出中の人物（travelerPersonId）の本命がないので、行人の本命の読みは省略" });
    return null;
  }
  const r = resolveContextBranch(context, { kind: "personNatalYear", personId: context.travelerPersonId });
  if (r.status === "resolved") return r.branch;
  missing.push({ key: "travelerNatalYear", detail: `外出中の人物の本命がない（${r.reason}）ので、行人の本命の読みは省略` });
  return null;
}

/** 類神の天盤支（天将はその天将が乗る支） */
function symbolOf(facts: InterpretationFacts, context: InterpretationContext, missing: DomainMissingFact[]): Input["symbol"] {
  const s = context.targetSymbol;
  if (!s) {
    missing.push({ key: "targetSymbol", detail: "類神が指定されていないので、類神の読み（『直指』「類神乘支」「類神空亡」・『心鏡』「課中逢類」）は省略" });
    return null;
  }
  if (s.kind === "branch") return { label: s.branch, branch: s.branch };
  const b = (Object.keys(facts.generals.generalOn) as Branch[]).find((x) => facts.generals.generalOn[x] === s.general)!;
  return { label: s.general, branch: b };
}

/** 行人の DOMAIN 判断 */
export function evaluateTravelerDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "traveler") throw new Error(`行人以外の DOMAIN です: ${context.domain}`);
  const subject = "行人の帰還";
  const lead = [{ topic: "relation", label: "行人と家の関係（干＝行人・支＝家。『直指』『入式』の見方）" }];
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  if (!input) return summarizeDomainReadings("traveler", context.subtype, context.goal, [], missing, subject, lead);
  // 問う人の本命は行人の読みに使わない（buildDomainBoardInput の不足は問う人のもの）
  const own = missing.filter((x) => x.key !== "natalYear");
  const travelerNatal = travelerNatalOf(context, own);
  const symbol = symbolOf(facts, context, own);
  own.push(
    { key: "timing", detail: "帰期（到着の日・月。天罡・遊神・戯神・子午上神・将軍など）は未対応" },
    { key: "youShen", detail: "遊神・戯神は資料の表が食い違う（冬＝辰／戌）ので未対応" },
  );
  if (!input.monthlySpirits) own.push({ key: "tianMa", detail: "月支がないので天馬は求めない（二馬は驛馬だけで見る）" });
  const xr = resolveXingNianPlacement(facts, context, context.travelerPersonId);
  if (xr.status === "unresolved") own.push({ key: "xingNian", detail: `行人の行年は求めない（${XING_NIAN_REASON_TEXT[xr.reason]}）ので、行年の読み（『指南』「行年加孟他郷吉」・『心鏡』「行年上所得之神…必來」）は判断しない。問う人の行年は使わない` });
  own.push({ key: "xingNianUnresolved", detail: "行年の句のうち、所在・方角・道里（『心鏡』「以行年臨處為所往之方」）は方針で出さず、「天干行年遇陷空」（陷空の定義）・「行年囚死，又被方上神刑克」（方上神の位置）は見る位置が確定しないので読まない。『指南』「年臨三四來期速，日之二課到時遲」（割注「行人行年居辰二課」）は、行年の支が三・四課の上神か下神か、天盤の行年が加わる位置かが確定しないので読まない" });
  const full: Input = { ...input, m: movementFactsOf(input), travelerNatal, symbol, xingNian: xr.status === "resolved" ? xr.placement : null };
  const readings = evaluateDomainRules(TRAVELER_RULES, full, "traveler", context.subtype, context.goal)
    .map((r) => (STEM_PERSPECTIVE[r.key] ? { ...r, detected: `${r.detected}${PERSPECTIVE_TEXT[STEM_PERSPECTIVE[r.key]]}` } : r));
  const seated = (["initial", "middle"] as const).filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length) own.push({ key: "seatedOnVoid", detail: `${seated.map((p) => `${LABEL[p]} ${input.comparison.path[p].branch}`).join("・")}が坐空。古典の「空陷」の「陷」に坐空を当てる根拠が不十分なので、初伝・中伝の坐空は読まない（保留）` });
  const r = summarizeDomainReadings("traveler", context.subtype, context.goal, readings, own, subject, lead);
  return { ...r, summary: [r.summary, ...monthlySpiritSummaryLines(readings, input.monthlySpirits, monthBranch, TRAVELER_SPIRIT_UNRESOLVED)].join("\n") };
}
const TRAVELER_SPIRIT_UNRESOLVED = ["驛馬だけをいう句（郇注「凡驛馬在傳」・「罡乘日馬」）には天馬を加えない", "『直指』「天罡二馬之墓」「馬臨長生入墓」は Phase 5C から規則にしていない（今回の対象外）"];

/** 監査用: ルールの一覧 */
export const TRAVELER_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = TRAVELER_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
