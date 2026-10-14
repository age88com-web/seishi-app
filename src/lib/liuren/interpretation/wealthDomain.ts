// src/lib/liuren/interpretation/wealthDomain.ts
//
// 役割（Phase 5F）:
//   求財・財物（wealth）の DOMAIN 判断。古典がこの盤の配置をどう読むかを、占的（subtype）ごとに別の規則表で並べる。
//     seekingWealth … 求財（財を得られるか）。『御定六壬直指』財物・謀望、『大六壬指南』求財章第十六、『六壬神課講座』p62・p66、
//                     『六壬大全』（殃咎課・鬼墓課・卷九・卷十の「財受夾克」）
//     trading       … 売買・取引。『直指』財物の附占買賣、『六壬心鏡』巻六 商賈門、『指南』買賣章第十七
//     debtCollection… 索債（貸した財が戻るか）。『指南』討債章の、条件が盤上で確定できる句だけ
//     lending・borrowing・keeping・general … 未対応（専用の規則が取得資料で確定できない／問いが未指定）。判断せず不足を返す
//   求財の規則を売買に、売買の人物対応（『直指』「以日為己，辰為他人，俱以發用為物」）を求財・索債に当てはめない。
//
//   段階（topic）を分けて持ち、ある段階の読みから他の段階を断定しない:
//     symbol（財の象意が現れる）・opportunity（財を得る機会）・acquisition（実際に得る）・retention（得た財を保つ）・
//     deal（取引の成立）・price（物の貴賤＝売り買いのどちらに宜しいか）・profit（利益）・collection（回収）・relation・course
//   財の象意（妻財・青龍）があるだけでは得るとしない（symbol は向きを決めない）。
//
//   人物（古典の役割と、実際の人物の Identity を分ける）:
//     古典の日（日干）・辰（日支）・発用・類神は盤上の役割で、問う人・財を求める人・取引相手そのものではない。
//     財を求める人の本命は context.wealthSeekerPersonId の人物からだけ取る（問う人の本命を使わない）。
//     売買の側（買う側・売る側）は context.tradeSide で指定する（推測しない）。物の類神は context.targetSymbol（自動では決めない）。
//
//   向き: favoring＝古典がその占的に有利に読むもの、hindering＝不利に読むもの。売買の物の貴賤のように、
//   売る側・買う側で意味が逆になる読みは tradeSide で向きを決め、なければ向きを決めない（読みそのものは変えない）。
//   空亡は旬空だけ。坐空は資料に根拠がないので保留（不足に出す）。金額・利益率・回収額・成立日は出さない。
//
//   扱わないもの（不足・保留として出す）: 行年・太歳上神を使う規則（『心鏡』）、求財の方角、神煞（生気・劫煞・丁馬など）、
//   意味や位置が資料で確定しない句（交車十法・還魂・避難・塞户度門・貴坐生合・日上辰上の「背馳」と「將吉」・
//   「自旺傳死墓」・「干吉支傷」・「財歸財庫」・「空手求財」・討債の主客など）、土の墓の方式が違う『指南』の「墓」。

import { BRANCH_ELEMENT, ELEMENT_CONTROLS, ELEMENT_GENERATES, STEM_ELEMENT } from "../constants";
import type { Branch, Element, HeavenlyGeneral, SixRelation } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainReading, DomainResult, DomainRule } from "./domainResult";
import { resolveContextBranch } from "./contextBranch";
import { heavenlyGeneralIntrinsicAttributesOf } from "./heavenlyGeneralAttributes";
import { initialOriginOf } from "./initialTransmissionOrigin";
import { relationBetween, threeHarmonyOf } from "./relations";
import type { InterpretationContext } from "./roles";
import { rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type { InterpretationFacts, SeasonalStrength, StructuralRelation, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput {
  month: Branch | null;
  /** 財を求める人の本命の支（wealthSeekerPersonId の人物。なければ null） */
  seekerNatal: Branch | null;
  /** 物の類神の天盤支（targetSymbol。なければ null） */
  symbol: { label: string; branch: Branch } | null;
  /** 問う人が取引のどちら側か（なければ null） */
  side: "buyer" | "seller" | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const ZZ = (quote: string, locator = "財物"): DomainCitation => ({ source: "『御定六壬直指』", locator, layer: "原文", quote });
const ZN = (layer: "原文" | "注", quote: string, locator = "求財章第十六"): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻六 商賈門", layer, quote });
const DQ = (locator: string, quote: string): DomainCitation => ({ source: "『六壬大全』", locator, layer: "原文", quote });
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
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);
const under = (i: Input, b: Branch) => i.facts.plate.earthUnder[b];
const on = (i: Input, b: Branch) => i.facts.plate.heavenOn[b];
const el = (b: Branch): Element => BRANCH_ELEMENT[b];
const controlsEl = (a: Element, b: Element) => ELEMENT_CONTROLS[a] === b;
const seasonal = (i: Input, e: Element): SeasonalStrength | null => (i.month ? seasonalStrengthOf(e, rulingElementOfMonth(i.month)) : null);
const strong = (s: SeasonalStrength | null) => s === "旺" || s === "相";
const weak = (s: SeasonalStrength | null) => s === "囚" || s === "死";
/** 「無氣」（旺相でない） */
const noQi = (s: SeasonalStrength | null) => s === "休" || s === "囚" || s === "死";
/** 干上・三伝のうち、指定の六親の位置 */
const positionsOf = (i: Input, rel: SixRelation) => [
  ...(i.comparison.standing.sixRelation === rel ? [{ name: "干上", b: stemUpper(i), void: i.comparison.standing.isVoid, stage: i.comparison.standing.growthStage, s: i.comparison.standing.seasonalStrength }] : []),
  ...TRANSMISSIONS.filter((p) => t(i, p).sixRelation === rel).map((p) => ({ name: LABEL[p], b: t(i, p).branch, void: t(i, p).isVoid, stage: t(i, p).growthStage, s: t(i, p).seasonalStrength })),
];
const wealthInTransmissions = (i: Input) => TRANSMISSIONS.filter((p) => t(i, p).sixRelation === "妻財");
/** 課伝（四課の上神・三伝）の支 */
const boardBranches = (i: Input) => [...i.facts.lessons.map((l) => l.upper), ...TRANSMISSIONS.map((p) => t(i, p).branch)];
/** 初伝が上下から夾克される（地盤支と、初伝に乗る天将の五行が、どちらも初伝を剋す。『大全』鬼墓課の例「午加壬，下克上，將逢天后，上克下，為財受夾克格」） */
const pinched = (i: Input) => {
  const p = t(i, "initial");
  return p.sixRelation === "妻財" && controlsEl(el(under(i, p.branch)), el(p.branch)) && controlsEl(heavenlyGeneralIntrinsicAttributesOf(general(i, p.branch)).element, el(p.branch));
};
/** 初伝・中伝が旬空で末伝が旬空でない（『指南』買賣章の割注「初中空末不空」） */
const hardship = (i: Input) => t(i, "initial").isVoid && t(i, "middle").isVoid && !t(i, "final").isVoid;
const finalRescue = (i: Input) => {
  const f = t(i, "final");
  return [f.sixRelation === "妻財" ? "財" : "", f.isDayVirtue ? "日徳" : "", f.growthStage === "長生" ? "長生" : ""].filter(Boolean);
};
const hardshipDetect = (i: Input) => {
  if (!hardship(i)) return null;
  const r = finalRescue(i);
  return { detected: `初伝 ${t(i, "initial").branch}・中伝 ${t(i, "middle").branch} が旬空で、末伝 ${t(i, "final").branch} は旬空でない（末伝が${r.length ? r.join("・") : "財・日徳・長生のどれでもない"}）`, evidence: [ev("void", "初・中")] };
};
const hardshipAssess = (i: Input) => (finalRescue(i).length
  ? { direction: "favoring" as DomainDirection, note: "初めは難しく、末伝で得る形（古典の「喜末吉」）" }
  : { direction: "hindering" as DomainDirection, note: "古典が求める末伝の財・徳・長生がない" });

// ---- 向き ----
const fav = (note?: string) => () => ({ direction: "favoring" as DomainDirection, ...(note ? { note } : {}) });
const hin = (note?: string) => () => ({ direction: "hindering" as DomainDirection, ...(note ? { note } : {}) });
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
const SEEK = ["seekingWealth"], TRADE = ["trading"], DEBT = ["debtCollection"];

const WEALTH_RULES: readonly Rule[] = [
  // ===================== 求財（seekingWealth） =====================
  {
    id: "wealth.symbol", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "opportunity", topic: "symbol", key: "wealthSymbol", label: "財の象意（妻財）が干上・三伝に現れる", level: "direct",
      citations: [ZZ("日干所克者为财，青龙为财神")] },
    conditions: (i) => {
      const ps = positionsOf(i, "妻財");
      return ps.length ? { detected: `${ps.map((x) => `${x.name} ${x.b}`).join("・")}が妻財（財の象意）`, evidence: [ev("sixRelation", "妻財")] } : null;
    },
    assess: neutral("財の象意があるだけでは、財を得るとはしない"),
  },
  {
    id: "wealth.dragonInBoard", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "opportunity", topic: "opportunity", key: "dragonInBoard", label: "類神の青龍が課伝に入る／入らない", level: "combined",
      citations: [ZZ("如求財要青龍，財神入於課傳", "謀望"), ZZ("若類神不見於課傳", "謀望")] },
    conditions: (i) => {
      const d = riding(i, "青龍"), inBoard = boardBranches(i).includes(d);
      return { detected: `青龍の乗る ${d} は課伝に${inBoard ? "入る" : "入らない"}`, evidence: [ev("青龍", d)] };
    },
    assess: (i) => (boardBranches(i).includes(riding(i, "青龍")) ? { direction: "favoring" } : { direction: "hindering", note: "『直指』謀望の「類神不見於課傳」（他の凶の条件と並べて挙げられる1つ）" }),
  },
  {
    id: "wealth.wealthOnStemOrSite", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "opportunity", topic: "opportunity", key: "wealthOnStemOrSite", label: "財が干上に臨む（易）／支上にだけ臨む（難）", level: "direct",
      citations: [ZZ("财临干易，临支难")] },
    conditions: (i) => {
      const a = i.facts.lessons[0].relation === "妻財", b = i.facts.lessons[2].relation === "妻財";
      return a ? { detected: `干上 ${stemUpper(i)} が妻財（財が干に臨む）`, evidence: [ev("lesson1", stemUpper(i))] }
        : b ? { detected: `支上 ${siteUpper(i)} が妻財（財が支にだけ臨む）`, evidence: [ev("lesson3", siteUpper(i))] } : null;
    },
    assess: (i) => (i.facts.lessons[0].relation === "妻財" ? { direction: "favoring" } : { direction: "hindering", note: "得難いとするだけで、得られないとはしない" }),
  },
  {
    id: "wealth.wealthInitialOrFinal", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "wealthInitialOrFinal", label: "財が発用（易）／末伝にだけある（難）", level: "direct",
      citations: [ZZ("财为发用易，末传难")] },
    conditions: (i) => {
      const ini = t(i, "initial").sixRelation === "妻財", fin = !ini && t(i, "middle").sixRelation !== "妻財" && t(i, "final").sixRelation === "妻財";
      return ini ? { detected: `初伝 ${t(i, "initial").branch} が妻財（財が発用）`, evidence: [ev("initial", "妻財")] }
        : fin ? { detected: `財は末伝 ${t(i, "final").branch} にだけある`, evidence: [ev("final", "妻財")] } : null;
    },
    assess: (i) => (t(i, "initial").sixRelation === "妻財" ? { direction: "favoring" } : { direction: "hindering", note: "得難いとするだけで、得られないとはしない" }),
  },
  {
    id: "wealth.wealthFromLesson34", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "wealthFromLesson34", label: "三課・四課の発用で財", level: "direct",
      citations: [KZ("p62", "三課や四課が初伝で財の場合は、求財占いでは財を得るとされる")] },
    conditions: (i) => {
      const o = initialOriginOf(i.facts);
      if (!o || t(i, "initial").sixRelation !== "妻財") return null;
      const ls = o.kind === "uniqueLesson" || o.kind === "ruleLesson" ? [o.lesson] : o.kind === "ambiguousLessons" ? [...o.lessons] : [];
      return ls.length && ls.every((x) => x === 3 || x === 4) ? { detected: `初伝 ${t(i, "initial").branch}（妻財）は${ls.map((x) => `${"一二三四"[x - 1]}課`).join("・")}からの発用`, evidence: [ev("initialOrigin", ls.join(","))] } : null;
    },
    assess: fav(),
  },
  {
    id: "wealth.virtueSalaryInitial", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "virtueSalaryInitial", label: "日徳・日禄の発用（得やすい）", level: "direct",
      citations: [ZZ("日德禄发用易，伏吟、返吟难")] },
    conditions: (i) => {
      const p = t(i, "initial"), k = [p.isDayVirtue ? "日徳" : "", p.isDaySalary ? "日禄" : ""].filter(Boolean).join("・");
      return k ? { detected: `初伝 ${p.branch} が${k}`, evidence: [ev("initial.marker", k)] } : null;
    },
    assess: fav(),
  },
  {
    id: "wealth.fuyinFanyin", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "fuyinFanyin", label: "伏吟・返吟（得難い）", level: "direct",
      citations: [ZZ("日德禄发用易，伏吟、返吟难"), ZN("原文", "网罗任信空费力")] },
    conditions: (i) => (i.facts.sanchuan.method === "伏吟" || i.facts.sanchuan.method === "返吟" ? { detected: `課体が${i.facts.sanchuan.method}`, evidence: [ev("method", i.facts.sanchuan.method)] } : null),
    assess: (i) => ({ direction: "hindering", note: i.facts.sanchuan.method === "伏吟" ? "『指南』の「任信」（伏吟）は「空費力」" : "得難いとするだけで、得られないとはしない" }),
  },
  {
    id: "wealth.maoXing", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "maoXing", label: "昴星課（成らない）", level: "direct",
      citations: [ZN("原文", "闭口昴星皆不成")] },
    conditions: (i) => (i.facts.sanchuan.method === "昴星" ? { detected: "課体が昴星", evidence: [ev("method", "昴星")] } : null),
    assess: hin(),
  },
  {
    id: "wealth.allWealth", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "allWealth", label: "三伝がすべて財（多すぎてかえって無い。財が鬼に化す）", level: "direct",
      citations: [ZZ("三传皆财，则多反无财，以财化鬼故也")] },
    conditions: (i) => (wealthInTransmissions(i).length === 3 ? { detected: `三伝 ${TRANSMISSIONS.map((p) => t(i, p).branch).join("")} がすべて妻財`, evidence: [ev("sixRelation", "妻財×3")] } : null),
    assess: hin("財の多さとは反対の読み（財の象意が多いほど得るとはしない）"),
  },
  {
    id: "wealth.childrenHarmony", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "support", topic: "acquisition", key: "childrenHarmony", label: "三伝に財がなく、子孫の三合局（子が財を生む）", level: "direct",
      citations: [ZZ("如三传无财，而子孙成局，反有财，以子能生财也")] },
    conditions: (i) => {
      const h = threeHarmonyOf([t(i, "initial").branch, t(i, "middle").branch, t(i, "final").branch]);
      return !wealthInTransmissions(i).length && h.complete && h.element === ELEMENT_GENERATES[STEM_ELEMENT[dayStem(i)]]
        ? { detected: `三伝 ${h.branches.join("")} が${h.element}局（子孫）で、三伝に財がない`, evidence: [ev("threeHarmony", h.element)] } : null;
    },
    assess: fav(),
  },
  {
    id: "wealth.wealthVoid", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "wealthVoid", label: "財が旬空（財が空虚）", level: "direct",
      citations: [KZ("p66", "財に空亡が付いている場合は、求財占においては財が空虚なので凶"), ZN("原文", "财逢空墓最为难")] },
    conditions: (i) => {
      const ps = positionsOf(i, "妻財").filter((x) => x.void);
      return ps.length ? { detected: `${ps.map((x) => `${x.name} ${x.b}`).join("・")}（妻財）が旬空`, evidence: [ev("void", ps.map((x) => x.b).join(","))] } : null;
    },
    assess: hin("『指南』の「墓」は土の墓の方式が違うので、この規則では旬空だけを見る"),
  },
  {
    id: "wealth.pinchedAcquire", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "actualization", topic: "acquisition", key: "pinchedAcquire", label: "初伝の財が上下から夾克される（終に得られない）", level: "direct",
      // 卷十「初传作日之财，受上下夹克而无用」の「無用」は、得られないのか得ても用をなさないのかが確定しないので出典にしない
      citations: [DQ("卷九 毕法赋", "其财受上下夹克，终不可得")] },
    conditions: (i) => (pinched(i) ? { detected: `初伝 ${t(i, "initial").branch}（妻財）を、地盤 ${under(i, t(i, "initial").branch)} と天将 ${general(i, t(i, "initial").branch)} がともに剋す`, evidence: [ev("initial", "夾克")] } : null),
    assess: hin("取得の段階の読み（卷九）。保持の段階の「財不由己費用」（卷八・鬼墓課）とは別の資料の別の読みで、互いに合わせて意味を変えない"),
  },
  {
    id: "wealth.pinchedRetention", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "obstruction", topic: "retention", key: "pinchedRetention", label: "初伝の財が上下から夾克される（財が自分の自由にならず費える）", level: "direct",
      citations: [DQ("卷八 殃咎课", "夹财，财不由己费用"), DQ("鬼墓课", "为财受夹克格，主财不由已费用")] },
    conditions: (i) => (pinched(i) ? { detected: `初伝 ${t(i, "initial").branch}（妻財）が地盤 ${under(i, t(i, "initial").branch)} と天将 ${general(i, t(i, "initial").branch)} に夾克される`, evidence: [ev("initial", "夾克")] } : null),
    assess: hin("保持の段階の読み（卷八・鬼墓課）。得た財が自分の自由にならず費える。取得の段階の「終不可得」（卷九）とは別の読み"),
  },
  {
    id: "wealth.tombAsWealth", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "obstruction", topic: "acquisition", key: "tombAsWealth", label: "日干の墓が財となる（財のために身を墓に引き入れる）", level: "direct",
      citations: [ZZ("墓神作财，是因财而引身入墓也")] },
    conditions: (i) => {
      const ps = positionsOf(i, "妻財").filter((x) => x.stage === "墓");
      return ps.length ? { detected: `${ps.map((x) => `${x.name} ${x.b}`).join("・")}が妻財で、日干 ${dayStem(i)} の墓`, evidence: [ev("growthStage", "墓")] } : null;
    },
    assess: hin(),
  },
  {
    id: "wealth.dragonTempleTomb", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "obstruction", topic: "opportunity", key: "dragonTempleTomb", label: "青龍が寅（入廟・伏して動かず）／未（八墓）に乗る", level: "direct",
      citations: [ZZ("龙在寅为入庙，伏而不动；龙在未为八墓，俱无财")] },
    conditions: (i) => {
      const d = riding(i, "青龍");
      return d === "寅" || d === "未" ? { detected: `青龍が ${d} に乗る（${d === "寅" ? "入廟" : "八墓"}）`, evidence: [ev("青龍", d)] } : null;
    },
    assess: hin(),
  },
  {
    id: "wealth.wealthGodOnNatal", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "support", topic: "opportunity", key: "wealthGodOnNatal", label: "財神（青龍）が財を求める人の本命に臨む", level: "combined",
      citations: [ZZ("日干所克者为财，青龙为财神"), ZZ("财神临命，所求皆成")] },
    conditions: (i) => (i.seekerNatal && general(i, on(i, i.seekerNatal)) === "青龍"
      ? { detected: `財を求める人の本命 ${i.seekerNatal} の上の ${on(i, i.seekerNatal)} に青龍が乗る`, evidence: [ev("seekerNatal", i.seekerNatal)] } : null),
    assess: fav(),
  },
  {
    id: "wealth.branchToStem", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "relation", topic: "relation", key: "branchToStem", label: "日支が日干を生ず（易）／剋す（難）", level: "direct",
      citations: [ZZ("支来生日易，克日难")] },
    conditions: (i) => {
      const g = has(relOf(dayBranch(i), dayStem(i)), "generates"), c = overcomes(dayBranch(i), dayStem(i));
      return g || c ? { detected: `日支 ${dayBranch(i)} が日干 ${dayStem(i)} を${g ? "生ず" : "剋す"}`, evidence: [ev("relation", g ? "支→干 生" : "支→干 剋")] } : null;
    },
    assess: (i) => (has(relOf(dayBranch(i), dayStem(i)), "generates") ? { direction: "favoring" } : { direction: "hindering", note: "得難いとするだけで、得られないとはしない" }),
  },
  {
    id: "wealth.mutualAdd", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "relation", topic: "relation", key: "mutualAdd", label: "干支が互いに加わる（彼我ともに益する）", level: "combined",
      citations: [ZN("原文", "支干相加彼我益")] },
    conditions: (i) => (stemUpper(i) === dayBranch(i) && siteUpper(i) === i.lodgingBranch
      ? { detected: `日支 ${dayBranch(i)} が干上に加わり、日干の寄宮 ${i.lodgingBranch} が支上に加わる`, evidence: [ev("lessons", "干支互加")] } : null),
    assess: fav("「相加」は互いに加わる形として見る（片方だけの加臨は読まない）"),
  },
  {
    id: "wealth.siteToStem", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "trajectory", topic: "course", key: "siteToStem", label: "支上から干上へ伝わる（易）／干上から支上へ伝わる（難）", level: "combined",
      citations: [ZZ("支传干易，干传支难")] },
    conditions: (i) => {
      const a = t(i, "initial").branch === siteUpper(i) && t(i, "final").branch === stemUpper(i), b = t(i, "initial").branch === stemUpper(i) && t(i, "final").branch === siteUpper(i);
      return a !== b ? { detected: a ? `初伝 ${siteUpper(i)}（支上）から末伝 ${stemUpper(i)}（干上）へ伝わる` : `初伝 ${stemUpper(i)}（干上）から末伝 ${siteUpper(i)}（支上）へ伝わる`, evidence: [ev("transmissions", a ? "支→干" : "干→支")] } : null;
    },
    assess: (i) => (t(i, "initial").branch === siteUpper(i) ? { direction: "favoring" } : { direction: "hindering", note: "得難いとするだけで、得られないとはしない" }),
  },
  {
    id: "wealth.finalSupportsWealth", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "support", topic: "acquisition", key: "finalSupportsWealth", label: "末伝が初伝の財を生ず（陰の助けが多い）", level: "direct",
      citations: [ZN("原文", "末助初财暗助多")] },
    conditions: (i) => (t(i, "initial").sixRelation === "妻財" && has(relOf(t(i, "final").branch, t(i, "initial").branch), "generates")
      ? { detected: `末伝 ${t(i, "final").branch} が初伝 ${t(i, "initial").branch}（妻財）を生ず`, evidence: [ev("relation", "末→初 生")] } : null),
    assess: fav(),
  },
  {
    id: "wealth.siblingsStrong", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "obstruction", topic: "acquisition", key: "siblingsStrong", label: "兄弟（比肩）が大いに旺じる（財を争う）", level: "combined",
      citations: [ZN("原文", "妻防生计兄争力（比肩大旺）")] },
    conditions: (i) => {
      const ps = positionsOf(i, "兄弟").filter((x) => x.s === "旺");
      return ps.length ? { detected: `${ps.map((x) => `${x.name} ${x.b}`).join("・")}が兄弟で、月令に旺`, evidence: [ev("sixRelation", "兄弟・旺")] } : null;
    },
    assess: hin("「大旺」は月令の旺として見る"),
  },
  {
    id: "wealth.hardEasy", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "trajectory", topic: "course", key: "hardEasy", label: "先難後易（緩やかに求める）／先易後難（早く取る）", level: "direct",
      citations: [ZZ("先难后易者，初来克日，而中末被日克，求之宜缓"), ZZ("先易后难者，初为日克，而中末克日，取之宜早")] },
    conditions: (i) => {
      const [a, b, c] = TRANSMISSIONS.map((p) => t(i, p).branch);
      if (overcomes(a, dayStem(i)) && overcomes(dayStem(i), b) && overcomes(dayStem(i), c)) return { detected: `初伝 ${a} が日干を剋し、中伝 ${b}・末伝 ${c} は日干に剋される（先難後易）`, evidence: [ev("relation", "先難後易")] };
      if (overcomes(dayStem(i), a) && overcomes(b, dayStem(i)) && overcomes(c, dayStem(i))) return { detected: `初伝 ${a} は日干に剋され、中伝 ${b}・末伝 ${c} が日干を剋す（先易後難）`, evidence: [ev("relation", "先易後難")] };
      return null;
    },
    assess: (i) => (overcomes(t(i, "initial").branch, dayStem(i))
      ? { direction: "neutral", note: "古典は「求之宜緩」（緩やかに求める）とする。得られるかどうかの判断ではない" }
      : { direction: "neutral", note: "古典は「取之宜早」（早く取る）とする。得られるかどうかの判断ではない" }),
  },
  {
    id: "wealth.hardshipSeek", when: { domain: "wealth", subtypes: SEEK },
    reading: { axis: "trajectory", topic: "course", key: "hardship", label: "初伝・中伝が空で末伝に頼る（艱難）", level: "direct",
      citations: [ZN("注", "艰难（谓初中空陷也，要末传见财德长生）"), ZN("注", "进步艰难喜末吉（谓初中空末不空要见财德长生）", "買賣章第十七")] },
    conditions: hardshipDetect,
    assess: hardshipAssess,
  },

  // ===================== 売買（trading） =====================
  {
    id: "wealth.tradeRoles", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "relation", topic: "relation", key: "tradeRoles", label: "売買の古典の役割（日＝己・辰＝他人・発用＝物）", level: "direct",
      citations: [ZZ("以日为巳，辰为他人，俱以发用为物，以子孙为财源。买货时则为货物，卖货时则为主顾")] },
    conditions: (i) => ({ detected: `発用 ${t(i, "initial").branch} が物（${i.side === "buyer" ? "買う側の問いなので貨物" : i.side === "seller" ? "売る側の問いなので主顧（買い手）" : "買う側なら貨物・売る側なら主顧。側が未指定"}）`, evidence: [ev("initial", t(i, "initial").branch)] }),
    assess: neutral("役割の対応で、吉凶の判断ではない"),
  },
  {
    id: "wealth.tradePrice", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "opportunity", topic: "price", key: "tradePrice", label: "干支がともに旺相（物が貴く売るに宜しい）／ともに囚死（物が賤く買うに宜しい）", level: "combined",
      citations: [ZZ("日辰俱吉，物贵宜卖；日辰俱伤，物贱宜买", "財物 附占買賣"), XJ("注", "干支旺相，其物贵；干支囚死，其物贱。贼宜贾，贵宜卖")] },
    conditions: (i) => {
      const a = seasonal(i, STEM_ELEMENT[dayStem(i)]), b = seasonal(i, el(dayBranch(i)));
      return strong(a) && strong(b) ? { detected: `日干 ${dayStem(i)}（${a}）・日支 ${dayBranch(i)}（${b}）がともに旺相（物が貴い）`, evidence: [ev("seasonal", `${a}・${b}`)] }
        : weak(a) && weak(b) ? { detected: `日干 ${dayStem(i)}（${a}）・日支 ${dayBranch(i)}（${b}）がともに囚死（物が賤い）`, evidence: [ev("seasonal", `${a}・${b}`)] } : null;
    },
    assess: (i) => {
      const dear = strong(seasonal(i, STEM_ELEMENT[dayStem(i)]));
      if (!i.side) return { direction: "neutral", note: `売る側・買う側が未指定なので向きを決めない（古典は${dear ? "貴は売るに宜しい" : "賤は買うに宜しい"}とする）` };
      return (i.side === "seller") === dear ? { direction: "favoring", note: dear ? "売る側に宜しい" : "買う側に宜しい" } : { direction: "hindering", note: dear ? "物が貴く、買う側には宜しくない" : "物が賤く、売る側には宜しくない" };
    },
  },
  {
    id: "wealth.tradeStockpile", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "opportunity", topic: "profit", key: "tradeStockpile", label: "発用（物）が無気で、中伝・末伝が相生（貨を積んで利がある）", level: "direct",
      citations: [ZZ("发用无气，中末相生，宜积货有利", "財物 附占買賣")] },
    conditions: (i) => {
      const s = t(i, "initial").seasonalStrength, m = t(i, "middle").branch, f = t(i, "final").branch;
      return noQi(s) && (has(relOf(m, f), "generates") || has(relOf(f, m), "generates"))
        ? { detected: `発用 ${t(i, "initial").branch} が月令に${s}（無気）で、中伝 ${m}・末伝 ${f} が相生`, evidence: [ev("initial.seasonal", s!), ev("relation", "中末 相生")] } : null;
    },
    assess: (i) => (i.side === "buyer" ? { direction: "favoring", note: "買って積む側に宜しい" }
      : { direction: "neutral", note: i.side === "seller" ? "古典は貨を積む（買って持つ）ことを宜しいとする。売る側への判断ではない" : "売る側・買う側が未指定。古典は貨を積む（買って持つ）ことを宜しいとする" }),
  },
  {
    id: "wealth.symbolInTransmissions", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "actualization", topic: "deal", key: "symbolInTransmissions", label: "物の類神が三伝に入る（成る）", level: "direct",
      citations: [XJ("原文", "三传有类可成功"), XJ("注", "凡商贾货卖，专视类神，若入三传生量，有财利")] },
    conditions: (i) => {
      if (!i.symbol) return null;
      const ps = TRANSMISSIONS.filter((p) => t(i, p).branch === i.symbol!.branch);
      return ps.length ? { detected: `類神 ${i.symbol.label}が${ps.map((p) => LABEL[p]).join("・")}に入る`, evidence: [ev("symbol", i.symbol.branch)] } : null;
    },
    assess: fav(),
  },
  {
    id: "wealth.symbolNoHarm", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "actualization", topic: "deal", key: "symbolNoHarm", label: "物の類神と日辰に剋・害がない（売買ともに宜しい）", level: "direct",
      citations: [XJ("原文", "物与日辰无克害，买卖皆宜索即通")] },
    conditions: (i) => {
      if (!i.symbol) return null;
      const b = i.symbol.branch;
      const bad = has(relOf(b, dayStem(i)), "overcomes", "overcomeBy") || has(relOf(b, dayBranch(i)), "overcomes", "overcomeBy", "harms");
      return bad ? null : { detected: `類神 ${i.symbol.label}と日干 ${dayStem(i)}・日支 ${dayBranch(i)} の間に剋・害がない`, evidence: [ev("symbol", b)] };
    },
    assess: fav(),
  },
  {
    id: "wealth.symbolStrength", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "opportunity", topic: "profit", key: "symbolStrength", label: "物の類神が旺相（商いに宜しい）／休囚・旬空（骨折り損）", level: "direct",
      citations: [XJ("原文", "有之旺相宜商贾，休囚空亡枉费工")] },
    conditions: (i) => {
      if (!i.symbol) return null;
      const b = i.symbol.branch, s = seasonal(i, el(b));
      return strong(s) ? { detected: `類神 ${i.symbol.label}が月令に${s}`, evidence: [ev("symbol.seasonal", s!)] }
        : s === "休" || s === "囚" || isVoid(i, b) ? { detected: `類神 ${i.symbol.label}が${[s === "休" || s === "囚" ? `月令に${s}` : "", isVoid(i, b) ? "旬空" : ""].filter(Boolean).join("・")}`, evidence: [ev("symbol", b)] } : null;
    },
    assess: (i) => (strong(seasonal(i, el(i.symbol!.branch))) && !isVoid(i, i.symbol!.branch) ? { direction: "favoring" } : { direction: "hindering" }),
  },
  {
    id: "wealth.buyerSymbolRelation", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "relation", topic: "deal", key: "buyerSymbolRelation", label: "買う物の類神が日辰と比合（物がある）／刑剋（買い難い）", level: "combined",
      citations: [XJ("注", "凡占买物，须定类神，与日辰比合，其物必有。若与日辰相刑克者，难买也")] },
    conditions: (i) => {
      if (!i.symbol) return null;
      const b = i.symbol.branch, rs = [relOf(b, dayStem(i)), relOf(b, dayBranch(i))];
      const bad = rs.some((r) => has(r, "overcomes", "overcomeBy", "punishes", "punishedBy"));
      const good = !bad && rs.some((r) => has(r, "sameElement", "combines"));
      return bad ? { detected: `類神 ${i.symbol.label}が日干・日支と刑剋`, evidence: [ev("symbol", b)] }
        : good ? { detected: `類神 ${i.symbol.label}が日干・日支と比和・六合`, evidence: [ev("symbol", b)] } : null;
    },
    assess: (i) => {
      const b = i.symbol!.branch, bad = [relOf(b, dayStem(i)), relOf(b, dayBranch(i))].some((r) => has(r, "overcomes", "overcomeBy", "punishes", "punishedBy"));
      if (i.side !== "buyer") return { direction: "neutral", note: "資料は物を買う場合についていう（買う側の問いでないので向きを決めない）" };
      return bad ? { direction: "hindering" } : { direction: "favoring" };
    },
  },
  {
    id: "wealth.hardshipTrade", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "trajectory", topic: "course", key: "hardship", label: "初伝・中伝が空で末伝に頼る（進歩艱難）", level: "direct",
      citations: [ZN("注", "进步艰难喜末吉（谓初中空末不空要见财德长生）", "買賣章第十七")] },
    conditions: hardshipDetect,
    assess: hardshipAssess,
  },
  {
    id: "wealth.tradeMovement", when: { domain: "wealth", subtypes: TRADE },
    reading: { axis: "trajectory", topic: "deal", key: "tradeMovement", label: "三伝が進茹（行うに当たる）／退間（止まる）。句の一部の形だけを読む部分実装", level: "combined",
      citations: [ZN("原文", "传进当行间退止", "買賣章第十七")] },
    conditions: (i) => (i.comparison.movementPattern === "進茹" || i.comparison.movementPattern === "退間"
      ? { detected: `三伝が${i.comparison.movementPattern}`, evidence: [ev("movementPattern", i.comparison.movementPattern)] } : null),
    assess: (i) => (i.comparison.movementPattern === "進茹" ? { direction: "favoring", note: "「傳進當行」を進茹だけで読む（部分実装）" } : { direction: "hindering", note: "「間退止」を退間だけで読む（部分実装）" }),
  },

  // ===================== 索債（debtCollection） =====================
  {
    id: "wealth.debtSiteVoid", when: { domain: "wealth", subtypes: DEBT },
    reading: { axis: "actualization", topic: "collection", key: "debtSiteVoid", label: "宅上（支上）が旬空（益がない）", level: "combined",
      citations: [ZN("原文", "宅上空亡无攸利", "討債章")] },
    conditions: (i) => (isVoid(i, siteUpper(i)) ? { detected: `支上 ${siteUpper(i)} が旬空`, evidence: [ev("void", siteUpper(i))] } : null),
    assess: hin("「宅上」は支上として見る"),
  },
  {
    id: "wealth.debtBranchOvercomesStem", when: { domain: "wealth", subtypes: DEBT },
    reading: { axis: "obstruction", topic: "collection", key: "debtBranchOvercomesStem", label: "日が辰に剋される（力が必ず傾く）", level: "direct",
      citations: [ZN("原文", "日逢辰克力必倾", "討債章")] },
    conditions: (i) => (overcomes(dayBranch(i), dayStem(i)) ? { detected: `日支 ${dayBranch(i)} が日干 ${dayStem(i)} を剋す`, evidence: [ev("relation", "支→干 剋")] } : null),
    assess: hin(),
  },
  {
    id: "wealth.debtSolidThenVoid", when: { domain: "wealth", subtypes: DEBT },
    reading: { axis: "trajectory", topic: "collection", key: "debtSolidThenVoid", label: "初伝が実で中伝が空（急いで取る）", level: "combined",
      citations: [ZN("原文", "初实中陷宜急取", "討債章"), ZN("注", "进步艰难喜末吉（谓初中空末不空要见财德长生）", "買賣章第十七")] },
    conditions: (i) => (!t(i, "initial").isVoid && t(i, "middle").isVoid ? { detected: `初伝 ${t(i, "initial").branch} は旬空でなく、中伝 ${t(i, "middle").branch} が旬空`, evidence: [ev("void", "中")] } : null),
    assess: neutral("古典は「宜急取」（急いで取るべき）とする。回収できるかどうかの判断ではない。「陷」は買賣章の割注（空）に従い旬空で見る"),
  },
  {
    id: "wealth.hardshipDebt", when: { domain: "wealth", subtypes: DEBT },
    reading: { axis: "trajectory", topic: "course", key: "hardship", label: "初伝・中伝が空で末伝に頼る（進歩艱難）", level: "direct",
      citations: [ZN("原文", "进步艰难喜末逢", "討債章"), ZN("注", "进步艰难喜末吉（谓初中空末不空要见财德长生）", "買賣章第十七")] },
    conditions: hardshipDetect,
    assess: hardshipAssess,
  },
];

/** 財を求める人の本命（wealthSeekerPersonId の人物だけ。問う人の本命は使わない） */
function seekerNatalOf(context: InterpretationContext, missing: DomainMissingFact[]): Branch | null {
  if (context.wealthSeekerPersonId === undefined) {
    missing.push({ key: "seekerNatalYear", detail: "財を求める人（wealthSeekerPersonId）が指定されていないので、本命の読み（財神臨命）は省略（問う人の本命は使わない。問う人本人が求めるなら同じ ID を入れる）" });
    return null;
  }
  const r = resolveContextBranch(context, { kind: "personNatalYear", personId: context.wealthSeekerPersonId });
  if (r.status === "resolved") return r.branch;
  missing.push({ key: "seekerNatalYear", detail: `財を求める人の本命がない（${r.reason}）ので、本命の読み（財神臨命）は省略` });
  return null;
}

/** 物の類神の天盤支（天将はその天将が乗る支） */
function symbolOf(facts: InterpretationFacts, context: InterpretationContext): Input["symbol"] {
  const s = context.targetSymbol;
  if (!s) return null;
  if (s.kind === "branch") return { label: s.branch, branch: s.branch };
  const b = (Object.keys(facts.generals.generalOn) as Branch[]).find((x) => facts.generals.generalOn[x] === s.general)!;
  return { label: `${s.general}（${b}）`, branch: b };
}

/** 問う人と、財を求める人の関係 */
export function seekerRelationOf(context: InterpretationContext): "self" | "proxy" | "unknown" {
  if (context.wealthSeekerPersonId === undefined || context.subjectPersonId === undefined) return "unknown";
  return context.wealthSeekerPersonId === context.subjectPersonId ? "self" : "proxy";
}

type WealthSubtype = "seekingWealth" | "trading" | "debtCollection";
const SUBJECT: Record<WealthSubtype, string> = { seekingWealth: "求財（財を得られるか）", trading: "売買・取引", debtCollection: "索債（貸した財が戻るか）" };
/** 段階（topic）の表示。ある段階の読みから他の段階を断定しないため、段階ごとに分けて書く */
const STAGES: Record<WealthSubtype, readonly { topic: string; label: string }[]> = {
  seekingWealth: [{ topic: "symbol", label: "財の象意" }, { topic: "opportunity", label: "財を得る機会" }, { topic: "acquisition", label: "実際に得るか" }, { topic: "retention", label: "得た財を保てるか" }],
  trading: [{ topic: "deal", label: "取引の成立" }, { topic: "price", label: "物の貴賤（売り買いのどちらに宜しいか）" }, { topic: "profit", label: "利益" }],
  debtCollection: [{ topic: "collection", label: "回収" }],
};
const HEAD = "【古典の読み】以下は、六壬の古典がこの盤の配置をどう読むかの整理です。古典の日（日干）・辰（日支）・発用・類神は盤上の役割で、実際の人物（問う人・財を求める人・取引相手）とは別に扱います。";
const TAIL = "【注意】財の象意・得る機会・実際の取得・取引の成立・利益・保持は別々の判断で、ある段階の読みから他の段階を断定しません。金額・利益率・回収額・成立の日は古典の読みから出しません。";

function stageLines(sub: WealthSubtype, readings: readonly DomainReading[]): string[] {
  const dir = (r: DomainReading) => (r.direction === "favoring" ? "追い風" : r.direction === "hindering" ? "妨げ" : "参考");
  return STAGES[sub].map(({ topic, label }) => {
    const rs = readings.filter((r) => r.topic === topic);
    return `・${label}: ${rs.length ? rs.map((r) => `${r.detected}（${dir(r)}）`).join("。") : "この盤では資料に根拠のある読みがない（成立を断定しない）"}`;
  });
}

/** 求財・財物の DOMAIN 判断 */
export function evaluateWealthDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "wealth") throw new Error(`求財以外の DOMAIN です: ${context.domain}`);
  const sub = context.subtype ?? "general";
  if (sub !== "seekingWealth" && sub !== "trading" && sub !== "debtCollection") {
    const name = sub === "lending" ? "貸す" : sub === "borrowing" ? "借りる" : sub === "keeping" ? "財物の保持" : "";
    const why: DomainMissingFact = sub === "general"
      ? { key: "subtype", detail: "問いの種類（求財 seekingWealth・売買 trading・索債 debtCollection）が未指定なので判断しない" }
      : sub === "borrowing"
        ? { key: "subtype", detail: "借りる占（『心鏡』假借門）は行年（月将を行年に加える）を使い、行年が未実装なので未対応" }
        : { key: "subtype", detail: `${name}は、取得した古典に専用の規則が確定できないので未対応` };
    return summarizeDomainReadings("wealth", context.subtype, context.goal, [], [why], "財物");
  }
  const subject = SUBJECT[sub];
  const rel = seekerRelationOf(context);
  const who = [
    sub === "seekingWealth" ? (rel === "self" ? "問う人本人が財を求める" : rel === "proxy" ? "代理の問い（財を求める人は問う人と別の人物）" : "財を求める人が問う人本人かどうかは未指定") : "",
    sub === "trading" ? (context.tradeSide === "buyer" ? "問う人は買う側" : context.tradeSide === "seller" ? "問う人は売る側" : "問う人が買う側か売る側かは未指定") : "",
    sub === "debtCollection" ? "問う人が貸した財を取り戻す問い" : "",
  ].filter(Boolean).join("・");
  const wrap = (r: DomainResult): DomainResult => ({ ...r, summary: [HEAD, `人物: ${who}。`, "段階ごとの読み:", ...stageLines(sub, r.readings), r.summary, TAIL].join("\n") });
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  // 問う人の本命・太歳は求財の規則に使わない（buildDomainBoardInput の不足は問う人のもの）
  const own = missing.filter((x) => x.key !== "natalYear" && x.key !== "taiSui");
  if (!input) return wrap(summarizeDomainReadings("wealth", context.subtype, context.goal, [], missing, subject));
  const seekerNatal = sub === "seekingWealth" ? seekerNatalOf(context, own) : null;
  const symbol = sub === "trading" ? symbolOf(facts, context) : null;
  if (!monthBranch) own.push({ key: "monthBranch", detail: "月支がないので、旺相を使う読み（兄弟の大旺・干支の旺相囚死・発用の無気・類神の旺相休囚）は判断しない" });
  if (context.goal && context.goal !== "acquire") own.push({ key: "goal", detail: `goal（${context.goal}）は向きに使わない。古典が財を得る・取引が成る方向に読むかどうかで示す（売買の売り買いは tradeSide で分ける）` });
  if (sub === "seekingWealth") own.push(
    { key: "direction", detail: "求財の方角（青龍の臨む方）は扱わない" },
    { key: "unresolvedPhrases", detail: "意味や位置が資料で確定しない句（交車十法・干財傳助の還魂・避難・塞户度門・貴坐生合・財乘丁馬・玄武防失・日上辰上の背馳と將吉・財絶逢生・財歸財庫・空手求財）は保留" },
    { key: "tombSystem", detail: "『指南』の「財逢空墓」の墓は土の墓の方式がエンジンと違うので読まない（『直指』の「墓神作財」は日干の墓で読む）" },
  );
  if (sub === "trading") {
    if (!symbol) own.push({ key: "targetSymbol", detail: "物の類神（targetSymbol）が指定されていないので、『心鏡』商賈門の類神の読みは判断しない（類神は自動では決めない。『直指』の「發用為物」は別の規則として読む）" });
    if (!context.tradeSide) own.push({ key: "tradeSide", detail: "問う人が買う側か売る側か（tradeSide）がないので、物の貴賤・積貨・買う物の読みは向きを決めない" });
    own.push(
      { key: "xingNian", detail: "行年・太歳上神を使う読み（『心鏡』）は未対応" },
      { key: "movementPartial", detail: "『指南』買賣章の「傳進當行間退止」は進茹・退間だけを読む部分実装。「傳進」に進間が入るか、「間退」が退間だけか（間伝・退茹を含むか）は資料で確定しないので、進間・退茹は読まない。後句「有防生計為財多」も読まない" },
      { key: "unresolvedPhrases", detail: "意味や位置が資料で確定しない句（交車・末助三般遞生・互相生旺・財墓並關・兩貴拱・自旺傳死墓・干吉支傷・支吉干傷など）は保留" },
    );
  }
  if (sub === "debtCollection") own.push(
    { key: "hostGuest", detail: "『指南』討債章の「主若克客事須成」は主・客が盤のどこか資料にないので保留" },
    { key: "debtScope", detail: "索債は『指南』討債章の、条件が盤上で確定できる句だけで読む（専用 DOMAIN としての完成ではない）" },
  );
  const seated = TRANSMISSIONS.filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length) own.push({ key: "seatedOnVoid", detail: `${seated.map((p) => LABEL[p]).join("・")}が坐空。財物の資料には坐空を空亡に当てる根拠がないので読まない（保留）` });
  const full: Input = { ...input, month: monthBranch ?? null, seekerNatal, symbol, side: context.tradeSide ?? null };
  const readings = evaluateDomainRules(WEALTH_RULES, full, "wealth", sub, context.goal);
  return wrap(summarizeDomainReadings("wealth", context.subtype, context.goal, readings, own, subject));
}

/** 監査用: ルールの一覧 */
export const WEALTH_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = WEALTH_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
