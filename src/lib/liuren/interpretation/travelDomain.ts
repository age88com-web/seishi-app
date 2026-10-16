// src/lib/liuren/interpretation/travelDomain.ts
//
// 役割（Phase 5C）:
//   出行（travel。自分が出かける）の DOMAIN 判断。行人（travelerDomain.ts）とは別の規則表。
//   基本は『御定六壬直指』出行「以日為人，以辰為所行之地」（日＝人、辰＝行き先）。
//   読みは topic で分ける: relation（人と行き先）・departure（出発できるか）・journey（道中が進むか）・arrival（行き先で得るか）・safety（道中の災い）。
//   ルールは『大六壬指南』出行章第十・『御定六壬直指』出行・『六壬心鏡』行人門の「定行止及水陸路安危」・『六壬大全』逆十二格の
//   原文と注に条件が書かれたものだけ。驛馬・発用だけで出発を決めない。
//   行年、時期、往亡・天車などの神煞、水路／陸路の選び方は扱わない（不足として出す）。
//
//   資料どうしの食い違い（実装しない）:
//     - 日干が支に臨む: 『直指』「日臨支…必行」と『指南』補談「日課歸支…皆在家不能行之象」→ 向きが逆なので読まない
//   電子テキストの誤字とみたもの（推論レベルを combined にする）:
//     - 『直指』「日上狂相」→ 旺相（後の「日上休囚…不行」と対）・「伏今無丁馬」→ 伏吟

import { STEM_ELEMENT } from "../constants";
import type { Branch } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import { monthlySpiritSummaryLines } from "./monthlySpiritReadings";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainResult, DomainRule } from "./domainResult";
import { daySalaryOf } from "./markers";
import { movementFactsOf } from "./movementFacts";
import type { MovementFacts } from "./movementFacts";
import { relationBetween } from "./relations";
import type { InterpretationContext, InterpretationGoal } from "./roles";
import { elementTombOf } from "./states";
import type { InterpretationFacts, SeasonalStrength, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput { m: MovementFacts }
type Rule = DomainRule<Input>;

const ZN = (locator: string, layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const ZZ = (quote: string): DomainCitation => ({ source: "『御定六壬直指』", locator: "出行", layer: "原文", quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻七 行人門（定行止及水陸路安危）", layer, quote });
const DQ = (quote: string): DomainCitation => ({ source: "『六壬大全』", locator: "逆十二格", layer: "原文", quote });
const ZN_C = "出行章第十";
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

const dayStem = (i: Input) => i.facts.basic.dayStem;
const path = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
/** 空は旬空で読む。坐空を「空」「空陷」に当てる根拠は出行の資料にないので使わない（Phase 5C 監査） */
const isEmpty = (s: { isVoid: boolean }) => s.isVoid;
const voidText = (s: { isVoid: boolean }) => (s.isVoid ? "旬空" : "空でない");
const rel = (a: Branch, b: Branch) => relationBetween(a, b).relations;
const strong = (s: SeasonalStrength | null) => s === "旺" || s === "相";
const weak = (s: SeasonalStrength | null) => s === "休" || s === "囚" || s === "死";
const salaryAtSite = (i: Input) => i.m.siteUpper === daySalaryOf(dayStem(i));
const salaryOvercomeBySite = (i: Input) => rel(i.m.dayBranch, daySalaryOf(dayStem(i))).includes("overcomes");
const dingMaInBoard = (i: Input) => [i.m.xunDing, i.m.yima].some((x) => x.lessons.length > 0 || x.transmissions.length > 0);

// ---- 向き（行きたいか） ----
/** 出かけないことを望む問い */
const wantsToStay = (goal: InterpretationGoal | undefined) => goal === "avoid" || goal === "maintain" || goal === "preserve";
const goes = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  wantsToStay(goal) ? { direction: "hindering", note: "出かけないことを望む問いでは逆向き" } : { direction: "favoring" };
const stays = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  wantsToStay(goal) ? { direction: "favoring", note: "出かけないことを望む問いでは逆向き" } : { direction: "hindering" };
const harm = () => ({ direction: "hindering" as DomainDirection, note: "道中の災いは問いの目的によらない" });
const good = () => ({ direction: "favoring" as DomainDirection });
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });

const TRAVEL_RULES: readonly Rule[] = [
  // ===== 人と行き先（relation） =====
  {
    id: "travel.stemUpperOvercomesSiteUpper", when: { domain: "travel" },
    reading: { axis: "relation", topic: "relation", key: "stemUpperOvercomesSiteUpper", label: "日上神が辰上神を剋す（一路坦然）", level: "direct",
      citations: [ZZ("以日为人，以辰为所行之地。日上神克辰上神，一路坦然")] },
    conditions: (i) => rel(i.m.stemUpper, i.m.siteUpper).includes("overcomes")
      ? { detected: `干上 ${i.m.stemUpper} が支上 ${i.m.siteUpper} を剋す`, evidence: [ev("relation", "干上→支上 剋")] } : null,
    assess: good,
  },
  {
    id: "travel.siteUpperOvercomesStemUpper", when: { domain: "travel" },
    reading: { axis: "relation", topic: "relation", key: "siteUpperOvercomesStemUpper", label: "辰上神が日上神を剋す（行くべきでない）", level: "direct",
      citations: [ZZ("辰上神克日上神，不可行"), ZZ("辰上神克日上者，不行")] },
    conditions: (i) => rel(i.m.siteUpper, i.m.stemUpper).includes("overcomes")
      ? { detected: `支上 ${i.m.siteUpper} が干上 ${i.m.stemUpper} を剋す`, evidence: [ev("relation", "支上→干上 剋")] } : null,
    assess: stays,
  },
  {
    id: "travel.stemUpperGeneratesSiteUpper", when: { domain: "travel" },
    reading: { axis: "relation", topic: "relation", key: "stemUpperGeneratesSiteUpper", label: "日上神が辰上神を生ず（必ず行く）", level: "direct",
      citations: [ZZ("日上神生辰上者必行")] },
    conditions: (i) => rel(i.m.stemUpper, i.m.siteUpper).includes("generates")
      ? { detected: `干上 ${i.m.stemUpper} が支上 ${i.m.siteUpper} を生ず`, evidence: [ev("relation", "干上→支上 生")] } : null,
    assess: goes,
  },
  // ===== 出発（departure） =====
  {
    id: "travel.kuiGangOnStemSite", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "kuiGangOnStemSite", label: "魁罡が日辰に臨む（行く。迫られて動く）", level: "direct",
      citations: [ZZ("魁罡临曰辰…必行也"), XJ("注", "《入式》…魁罡加日辰则不得已迫促而动")] },
    conditions: (i) => {
      const at = [i.m.tianGang, i.m.heKui].flatMap((x) => [x.atStemUpper ? `${x.branch} が干上` : "", x.atSiteUpper ? `${x.branch} が支上` : ""]).filter(Boolean);
      return at.length ? { detected: `魁罡（${at.join("・")}）`, evidence: [ev("kuiGang", at.join(","))] } : null;
    },
    assess: (i, s, g) => ({ ...goes(i, s, g), note: "迫られてやむを得ず動く（『心鏡』注引『入式』）" }),
  },
  {
    id: "travel.dingOnStemInitial", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "dingOnStemInitial", label: "丁神が日に臨んで発用（行く）", level: "direct",
      citations: [ZZ("或丁神临日发用…必行也")] },
    conditions: (i) => i.m.xunDing.atStemUpper && i.m.transmissions.initial === i.m.xunDing.branch
      ? { detected: `旬丁 ${i.m.xunDing.branch} が干上にあり発用`, evidence: [ev("xunDing", "干上・初伝")] } : null,
    assess: goes,
  },
  {
    id: "travel.stemUpperSeasonal", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "stemUpperSeasonal", label: "日上が旺相（行く）／休囚（行かない）", level: "combined",
      citations: [ZZ("日上狂相…必行也"), ZZ("日上休囚…不行也")] },
    conditions: (i) => {
      const s = i.comparison.standing.seasonalStrength;
      return strong(s) || s === "休" || s === "囚" ? { detected: `干上 ${i.m.stemUpper} が${s}`, evidence: [ev("standing.seasonalStrength", String(s))] } : null;
    },
    assess: (i, s, g) => ({ ...(strong(i.comparison.standing.seasonalStrength) ? goes(i, s, g) : stays(i, s, g)), note: "電子テキストの「狂相」は「休囚」と対になるので旺相とみる" }),
  },
  {
    id: "travel.tianGangClass", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "tianGangClass", label: "斗罡が季に加わる（行く）／孟に加わる（行かない）", level: "direct",
      citations: [ZZ("斗罡加季…必行也"), ZZ("斗罡加孟曰辰…不行也"), XJ("原文", "年上日辰逢旺相，斗罡加季往无迍"), XJ("注", "天罡加季神在外必主行")] },
    conditions: (i) => i.m.tianGang.earthClass !== "仲"
      ? { detected: `天罡 辰 が地盤 ${i.m.tianGang.earth}（${i.m.tianGang.earthClass}）に加わる`, evidence: [ev("tianGang.earth", `${i.m.tianGang.earth}（${i.m.tianGang.earthClass}）`)] } : null,
    assess: (i, s, g) => (i.m.tianGang.earthClass === "季" ? goes(i, s, g) : stays(i, s, g)),
  },
  {
    id: "travel.siHaiOnMao", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "siHaiOnMao", label: "巳亥が卯に加わる（行く）", level: "direct",
      citations: [ZZ("巳亥加卯…必行也")] },
    conditions: (i) => i.facts.plate.heavenOn["卯"] === "巳" || i.facts.plate.heavenOn["卯"] === "亥"
      ? { detected: `地盤 卯 の上に ${i.facts.plate.heavenOn["卯"]}`, evidence: [ev("plate", `卯上 ${i.facts.plate.heavenOn["卯"]}`)] } : null,
    assess: goes,
  },
  {
    id: "travel.fuyin", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "fuyin", label: "伏吟に丁馬あり（行く）／なし（行かない）", level: "combined",
      citations: [ZZ("伏吟见丁马，必行也"), ZZ("伏今无丁马，不行也"), XJ("注", "《入式》…得伏吟课不动")] },
    conditions: (i) => i.m.method === "伏吟"
      ? { detected: `伏吟で、丁馬（旬丁 ${i.m.xunDing.branch}・驛馬 ${i.m.yima.branch}）が課伝に${dingMaInBoard(i) ? "ある" : "ない"}`, evidence: [ev("method", "伏吟"), ev("dingMa", dingMaInBoard(i) ? "あり" : "なし")] } : null,
    assess: (i, s, g) => (dingMaInBoard(i) ? goes(i, s, g) : stays(i, s, g)),
  },
  {
    id: "travel.zhuYin", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "zhuYin", label: "鋳印（出行の象）", level: "direct",
      citations: [ZN(ZN_C, "注", "补谈：…课得铸印，亦是出行之象。只是不要破模"), ZN(`${ZN_C} 増補占例二`, "注", "坐车者，铸印乘轩也")] },
    conditions: (i) => i.m.zhuYin ? { detected: "三伝 巳→戌→卯（鋳印。破模の条件は未対応）", evidence: [ev("transmissions", "巳戌卯")] } : null,
    assess: goes,
  },
  {
    id: "travel.fanyin", when: { domain: "travel" },
    reading: { axis: "trajectory", topic: "journey", key: "fanyin", label: "返吟（出かけても戻ってくる）", level: "direct",
      citations: [ZZ("返吟，行人去而复返")] },
    conditions: (i) => i.m.method === "返吟" ? { detected: "返吟", evidence: [ev("method", "返吟")] } : null,
    assess: neutral("出かけて戻る流れ（出発の可否は他の要素による）"),
  },
  {
    id: "travel.yimaVoid", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "yimaVoid", label: "驛馬が空（行かない）", level: "direct",
      citations: [ZZ("马值空亡…不行也"), ZN(ZN_C, "原文", "更忌驿马居天中，劝君不必似萍踪")] },
    conditions: (i) => i.m.yima.isVoid ? { detected: `驛馬 ${i.m.yima.branch} が旬空`, evidence: [ev("yima.isVoid", "旬空")] } : null,
    assess: stays,
  },
  {
    id: "travel.tombOnStem", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "tombOnStem", label: "墓が日に臨む（動けない）", level: "combined",
      citations: [ZZ("或墓临日辰上…不行也"), XJ("注", "《入式》…若关墓加日干，则不能动")] },
    conditions: (i) => i.m.stemUpper === elementTombOf(STEM_ELEMENT[dayStem(i)]).branch
      ? { detected: `干上 ${i.m.stemUpper} が日干 ${dayStem(i)} の墓`, evidence: [ev("standing", "墓")] } : null,
    assess: stays,
  },
  {
    id: "travel.nobleOnChou", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "nobleOnChou", label: "天乙が丑に乗る（天将入廟。動けない）", level: "direct",
      citations: [XJ("注", "《入式》…若天将入庙，如天乙乘丑之类…即不能动")] },
    conditions: (i) => i.facts.generals.nobleBranch === "丑" ? { detected: "貴人が丑に乗る", evidence: [ev("nobleBranch", "丑")] } : null,
    assess: stays,
  },
  {
    id: "travel.stemUpperVoid", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "stemUpperVoid", label: "日干（干上）に空亡（動けない）", level: "combined",
      citations: [XJ("注", "《入式》…及日干见空亡，即不能动")] },
    conditions: (i) => isEmpty(i.comparison.standing)
      ? { detected: `干上 ${i.m.stemUpper} が${voidText(i.comparison.standing)}`, evidence: [ev("standing.void", voidText(i.comparison.standing))] } : null,
    assess: stays,
  },
  {
    id: "travel.officerOnStem", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "officerOnStem", label: "鬼が身に臨む（行くべきでない）", level: "direct",
      citations: [ZZ("鬼临身不可行")] },
    conditions: (i) => i.comparison.standing.sixRelation === "官鬼" ? { detected: `干上 ${i.m.stemUpper} が官鬼`, evidence: [ev("standing.sixRelation", "官鬼")] } : null,
    assess: stays,
  },
  {
    id: "travel.staysHome", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "staysHome", label: "日禄が支に帰る・干から支へ伝わる（家にいて行けない）", level: "direct",
      citations: [ZN(ZN_C, "注", "补谈：日禄归支，日课归支，自干传支，皆在家不能行之象，即驿马发用，亦不能行")] },
    conditions: (i) => {
      const hits = [salaryAtSite(i) && !salaryOvercomeBySite(i) ? `日禄 ${daySalaryOf(dayStem(i))} が支上` : "",
        i.m.transmissions.initial === i.m.stemUpper && i.m.transmissions.final === i.m.siteUpper ? `初伝が干上 ${i.m.stemUpper}・末伝が支上 ${i.m.siteUpper}` : ""].filter(Boolean);
      return hits.length ? { detected: hits.join("、"), evidence: [ev("stayHome", hits.join(","))] } : null;
    },
    assess: stays,
  },
  {
    id: "travel.forcedDeparture", when: { domain: "travel" },
    reading: { axis: "opportunity", topic: "departure", key: "forcedDeparture", label: "日禄が支に帰って支に剋される・支から干へ伝わる（迫られて行く）", level: "combined",
      citations: [ZN(ZN_C, "注", "但日禄、日课归支而受支克，自支传干，必是逼迫而行")] },
    conditions: (i) => {
      const hits = [salaryAtSite(i) && salaryOvercomeBySite(i) ? `日禄 ${daySalaryOf(dayStem(i))} が支上にあり日支 ${i.m.dayBranch} に剋される` : "",
        i.m.transmissions.initial === i.m.siteUpper && i.m.transmissions.final === i.m.stemUpper ? `初伝が支上 ${i.m.siteUpper}・末伝が干上 ${i.m.stemUpper}` : ""].filter(Boolean);
      return hits.length ? { detected: hits.join("、"), evidence: [ev("forced", hits.join(","))] } : null;
    },
    assess: (i, s, g) => ({ ...goes(i, s, g), note: "自分から望んでではなく、迫られて出る" }),
  },
  {
    id: "travel.yimaOvercomesStem", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "departure", key: "yimaOvercomesStem", label: "馬星が干に臨んで干を剋す（自由にならず出られない）", level: "direct",
      citations: [ZN(`${ZN_C} 増補占例一`, "注", "马星临干克干，不得自由…总断是出不了门")] },
    conditions: (i) => i.m.yima.atStemUpper && relationBetween(i.m.yima.branch, dayStem(i)).relations.includes("overcomes")
      ? { detected: `驛馬 ${i.m.yima.branch} が干上にあり日干 ${dayStem(i)} を剋す`, evidence: [ev("yima", "干上・剋干")] } : null,
    assess: stays,
  },
  // ===== 道中（journey）・行き先（arrival） =====
  {
    id: "travel.middleFinalVoid", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "journey", key: "middleFinalVoid", label: "中末伝が空で初伝は空でない（途中で引き返す）", level: "direct",
      citations: [ZN(ZN_C, "原文", "中末逢空初不空，行人半路欲回程")] },
    conditions: (i) => !isEmpty(path(i, "initial")) && isEmpty(path(i, "middle")) && isEmpty(path(i, "final"))
      ? { detected: `初伝 ${i.m.transmissions.initial} は空でなく、中伝 ${i.m.transmissions.middle}（${voidText(path(i, "middle"))}）・末伝 ${i.m.transmissions.final}（${voidText(path(i, "final"))}）が空`, evidence: [ev("void", "中末")] } : null,
    assess: (i, s, g) => (wantsToStay(g) ? { direction: "neutral", note: "出かけない問いでは、行っても戻る流れ" } : { direction: "hindering" }),
  },
  {
    id: "travel.initialMiddleVoid", when: { domain: "travel" },
    reading: { axis: "actualization", topic: "arrival", key: "initialMiddleVoid", label: "初中伝が空で末伝が助ける（ここでは難く、行き先で豊か）", level: "direct",
      citations: [ZN(ZN_C, "原文", "初中空陷末传助，在此艰难在彼丰")] },
    conditions: (i) => isEmpty(path(i, "initial")) && isEmpty(path(i, "middle")) && !isEmpty(path(i, "final"))
      ? { detected: `初伝 ${i.m.transmissions.initial}（${voidText(path(i, "initial"))}）・中伝 ${i.m.transmissions.middle}（${voidText(path(i, "middle"))}）が空で、末伝 ${i.m.transmissions.final} は空でない`, evidence: [ev("void", "初中")] } : null,
    assess: goes,
  },
  {
    id: "travel.seasonalCourse", when: { domain: "travel" },
    reading: { axis: "actualization", topic: "arrival", key: "seasonalCourse", label: "初伝と末伝の旺衰（初旺末衰＝前途不偶／初衰末旺＝彼処に機縁）", level: "combined",
      citations: [ZN(ZN_C, "原文", "初传旺相末传否，前去行藏叹不偶。初传囚死末传旺，彼处机缘真个有")] },
    conditions: (i) => {
      const a = path(i, "initial").seasonalStrength, b = path(i, "final").seasonalStrength;
      if (strong(a) && weak(b)) return { detected: `初伝 ${i.m.transmissions.initial} が${a}、末伝 ${i.m.transmissions.final} が${b}（前途がかなわない）`, evidence: [ev("seasonal", `${a}→${b}`)] };
      if ((a === "囚" || a === "死") && strong(b)) return { detected: `初伝 ${i.m.transmissions.initial} が${a}、末伝 ${i.m.transmissions.final} が${b}（行き先に機縁）`, evidence: [ev("seasonal", `${a}→${b}`)] };
      return null;
    },
    assess: (i, s, g) => (strong(path(i, "final").seasonalStrength) ? goes(i, s, g) : stays(i, s, g)),
  },
  {
    id: "travel.guanGe", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "journey", key: "guanGe", label: "天罡が四仲に加わる（天関・地関。道路がふさがる）", level: "direct",
      citations: [ZZ("天罡加子卯为天关格，风雨阻滞；加午酉为地关格，关津阻碍"), ZN(ZN_C, "原文", "若逢台土（月建）及关隔（天罡加四仲），道路四塞何时通")] },
    conditions: (i) => i.m.tianGang.earthClass === "仲"
      ? { detected: `天罡 辰 が地盤 ${i.m.tianGang.earth} に加わる（${i.m.tianGang.earth === "子" || i.m.tianGang.earth === "卯" ? "天関" : "地関"}）`, evidence: [ev("tianGang.earth", i.m.tianGang.earth)] } : null,
    assess: harm,
  },
  {
    id: "travel.yimaQinglong", when: { domain: "travel" },
    reading: { axis: "support", topic: "journey", key: "yimaQinglong", label: "馬が青龍を帯びる（道中安逸）", level: "direct",
      citations: [ZZ("马带青龙，一路安逸")] },
    conditions: (i) => i.m.yima.general === "青龍" ? { detected: `驛馬 ${i.m.yima.branch} に青龍が乗る`, evidence: [ev("heavenlyGeneral", "青龍")] } : null,
    assess: good,
  },
  // ===== 道中の災い（safety） =====
  {
    id: "travel.maoSnakeTiger", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "safety", key: "maoSnakeTiger", label: "卯（太冲）に螣蛇・白虎（車船の災い・驚き）", level: "direct",
      citations: [ZZ("卯临蛇虎，中有忧惊"), XJ("原文", "太冲切忌逢蛇虎，船覆车翻必损人")] },
    conditions: (i) => i.facts.generals.generalOn["卯"] === "螣蛇" || i.facts.generals.generalOn["卯"] === "白虎"
      ? { detected: `卯に${i.facts.generals.generalOn["卯"]}が乗る`, evidence: [ev("heavenlyGeneral", `卯 ${i.facts.generals.generalOn["卯"]}`)] } : null,
    assess: harm,
  },
  {
    id: "travel.heJing", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "safety", key: "heJing", label: "河井相加（戌が卯に加わる。行くべきでない）", level: "direct",
      citations: [ZN(ZN_C, "原文", "河井相加不可往"), ZN(`${ZN_C} 占験一`, "原文", "且壬戌加卯发用，是河井相加，卯受干克，主车船破坏")] },
    conditions: (i) => i.m.heKui.earth === "卯" ? { detected: "河魁 戌 が地盤 卯 に加わる", evidence: [ev("heKui.earth", "卯")] } : null,
    assess: harm,
  },
  {
    id: "travel.tigerOnStemOvercomesNatal", when: { domain: "travel" },
    reading: { axis: "obstruction", topic: "safety", key: "tigerOnStemOvercomesNatal", label: "白虎が干に臨み命を剋す（旅先で病む）", level: "direct",
      citations: [ZN(ZN_C, "原文", "白虎临干克命年，断然抱病客中眠")] },
    conditions: (i) => i.subjectNatalBranch && i.facts.generals.generalOn[i.m.stemUpper] === "白虎" && rel(i.m.stemUpper, i.subjectNatalBranch).includes("overcomes")
      ? { detected: `干上 ${i.m.stemUpper} に白虎が乗り、本人の本命 ${i.subjectNatalBranch} を剋す`, evidence: [ev("heavenlyGeneral", "白虎"), ev("natal", i.subjectNatalBranch)] } : null,
    assess: harm,
  },
  // 逆十二格
  ...([
    ["偃蹇格", "子戌申", "凡举迷暗不明，行军被围，出入作为，亦不吉", "journey"],
    ["渉疑格", "辰寅子", "占事，进退不决，行人未来，欲出不出", "departure"],
    ["時遁格", "亥酉未", "占行人不来，出行不出", "departure"],
  ] as const).map(([name, seq, quote, topic]): Rule => ({
    id: `travel.reverseTwelve.${name}`, when: { domain: "travel" },
    reading: { axis: "obstruction", topic, key: `reverseTwelve.${name}`, label: `逆十二格・${name}`, level: "direct", citations: [DQ(`${seq}为${name}…${quote}`)] },
    conditions: (i) => i.m.reverseTwelve === name ? { detected: `三伝 ${seq.split("").join("→")} は${name}`, evidence: [ev("reverseTwelve", name)] } : null,
    assess: topic === "departure" ? stays : harm,
  })),
];

/** 出行の DOMAIN 判断 */
export function evaluateTravelDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "travel") throw new Error(`出行以外の DOMAIN です: ${context.domain}`);
  const subject = "出行";
  const lead = [{ topic: "relation", label: "本人と行き先の関係（日＝人・辰＝行き先）" }];
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  if (!input) return summarizeDomainReadings("travel", context.subtype, context.goal, [], missing, subject, lead);
  if (!monthBranch) missing.push({ key: "monthBranch", detail: "月支がないので、旺相休囚の読み（『直指』「日上旺相／休囚」・『指南』「初傳旺相末傳否」）は省略" });
  missing.push(
    { key: "tianMa", detail: "天馬の起例は『心鏡』で確認できた（Phase 5K）が、出行の『直指』の「馬」（馬值空亡・馬帶青龍など）が二馬か驛馬かは原文で確定しないので、馬は驛馬だけで見る" },
    { key: "xingNian", detail: "行年は規則が未確定なので未対応" },
    { key: "shensha", detail: "往亡・天車・飛廉・劫煞などの神煞は未対応（往亡は『心鏡』に表があるが『直指』「身帶往亡煞」の見る位置が確定しない。天車は『心鏡』の表と『直指』毕法賦「天車煞即關神」が食い違う。飛廉・劫煞は起例が資料にない）" },
    { key: "route", detail: "水路・陸路の選び方（「干吉宜行陸路，支吉宜行水路」）と天気は未対応" },
  );
  const seated = (["initial", "middle", "final"] as const).filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length || (!input.comparison.standing.isVoid && input.comparison.standing.isSeatedOnVoid))
    missing.push({ key: "seatedOnVoid", detail: "坐空の位置がある。出行の資料には坐空を「空」「空陷」に当てる根拠がないので、坐空は読まない（保留）" });
  const full: Input = { ...input, m: movementFactsOf(input) };
  const readings = evaluateDomainRules(TRAVEL_RULES, full, "travel", context.subtype, context.goal);
  const r = summarizeDomainReadings("travel", context.subtype, context.goal, readings, missing, subject, lead);
  return { ...r, summary: [r.summary, ...monthlySpiritSummaryLines(readings, input.monthlySpirits, monthBranch, TRAVEL_SPIRIT_UNRESOLVED)].join("\n") };
}
/** 出行で神煞を使うが判断しない句（Phase 5L） */
const TRAVEL_SPIRIT_UNRESOLVED = ["『直指』「年命天馬、驛馬，或丁神臨日發用…必行也」は「年命天馬、驛馬」が「臨日發用」にかかるか（年命の上の馬か）が句読で確定しないので読まない"];

/** 監査用: ルールの一覧 */
export const TRAVEL_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = TRAVEL_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
