// src/lib/liuren/interpretation/lostItemDomain.ts
//
// 役割（Phase 5H）:
//   失物・盗難（lostItem）の DOMAIN 判断。古典がこの盤の配置をどう読むかを、占的（subtype）ごとに別の規則表で並べる。
//     lostProperty … なくした物を探す。『御定六壬直指』遺失、『六壬心鏡』巻六 亡盗門の郇注「占遺失尋得法」、『六壬大全』卷九 毕法賦、
//                    『大六壬指南』六畜章 占験一の割注。遺失か盗難かの兆候（『直指』遺失「若類神乘元武，乃為人盜去」など）も読む
//     theft        … 盗難（lostItem の subtype に限る。既存の domain "theft" は使わず、その挙動も変えない）。『直指』盗賊、『指南』賊盗章第二十一、『心鏡』巻六 亡盗門 占盗賊（本歌・郇注・引『入式』）、『大全』卷九 毕法賦
//     recovery     … 失物・盗品が戻るか。context.lossCause で遺失（misplaced）か盗難（stolen）かを指定し、その章の発見・捕獲・回収の規則だけで読む。
//                    指定がなければ判断しない（遺失と盗難の規則を混ぜない）
//     general      … 問いの種類が未指定。判断せず不足を返す
//   『直指』は遺失と盗賊を別の章にしているので、規則表も分ける（遺失の規則を盗難に、盗賊の規則を遺失に当てはめない）。
//   『大全』の失脱・招盜の句（「凡占」）は、遺失と盗難の両方で兆候として読む。
//
//   段階（topic）を分けて持ち、ある段階の読みから他の段階を断定しない:
//     relation（古典の役割）・lossSign（失脱の兆候）・theftSign（盗難の兆候）・location（物・盗人の所在）・movement（盗人の移動）・
//     thirdParty（第三者の関与）・discovery（発見）・capture（盗人を捕える古典の読み）・recovery（所有者の手に戻る）・harm（所有者への害）
//   発見（discovery）を回収（recovery）に、捕獲（capture）を回収に読み替えない。
//
//   人物（古典の役割と、実際の人物の Identity を分ける）:
//     古典の日干は失主（所有者）。所有者は context.ownerPersonId で問う人と別に持つ（代理の問い）。
//     物の類神は context.targetSymbol で指定したときだけ使う（『直指』の物の種類と類神の対応表は本文に欠字があるので自動では決めない）。
//     盗人は玄武（賊）・玄武の陰神（盗神）という盤上の類神だけで、実在の人物を推定しない。盗人の人相・男女老少・窩家は出さない。
//     玄武が現れることだけで盗難としない（玄武の乗神・陰神・位置など、原典の条件があるものだけ）。
//
//   向き: 発見・捕獲・回収・所有者への害だけ向きを決める（favoring＝見つかる・戻る・捕える方向）。
//   兆候（失脱・盗難）・所在・移動・第三者・役割は向きを決めない（盗難の兆候は事実の認定ではなく、所有者への不利という評価もしない）。
//   goal（discover・recover）で読みも向きも変えない（資料に、目的で向きが変わる規則がない）。
//   空亡は旬空だけ。坐空は保留（不足に出す）。方位は地盤の支のまま出し、資料に支と方位の対応表があるもの（『直指』『心鏡』の盗神）だけ方位の語を出す。
//   発見日・回収日・里数・人数・具体的な場所は出さない。

import { BRANCH_ELEMENT } from "../constants";
import type { Branch, Element, HeavenlyGeneral } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainReading, DomainResult, DomainRule } from "./domainResult";
import { relationBetween } from "./relations";
import type { InterpretationContext } from "./roles";
import { growthStageOf } from "./states";
import type { InterpretationFacts, StructuralRelation, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput {
  month: Branch | null;
  /** 物の類神の天盤支（targetSymbol。なければ null） */
  symbol: { label: string; branch: Branch } | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const ZZ = (quote: string, locator: "遺失" | "盗賊"): DomainCitation => ({ source: "『御定六壬直指』", locator, layer: "原文", quote });
const ZN = (layer: "原文" | "注", quote: string, locator = "賊盗章第二十一"): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻六 亡盗門", layer, quote });
const DQ = (quote: string): DomainCitation => ({ source: "『六壬大全』", locator: "卷九 毕法赋", layer: "原文", quote });
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り（既存 FACT の参照） ----
const lessonUpper = (i: Input, n: 1 | 2 | 3 | 4) => i.facts.lessons[n - 1].upper;
const dayStem = (i: Input) => i.facts.basic.dayStem;
const dayBranch = (i: Input) => i.facts.basic.dayBranch;
const t = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
const seqOf = (i: Input) => TRANSMISSIONS.map((p) => t(i, p).branch);
const relOf = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => relationBetween(a, b).relations;
const has = (rs: readonly StructuralRelation[], ...ks: StructuralRelation[]) => ks.some((k) => rs.includes(k));
const overcomes = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => has(relOf(a, b), "overcomes");
const generates = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => has(relOf(a, b), "generates");
const general = (i: Input, b: Branch): HeavenlyGeneral => i.facts.generals.generalOn[b];
/** その天将が乗る天盤支（乗神） */
const riding = (i: Input, g: HeavenlyGeneral): Branch => (Object.keys(i.facts.generals.generalOn) as Branch[]).find((b) => i.facts.generals.generalOn[b] === g)!;
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);
const under = (i: Input, b: Branch) => i.facts.plate.earthUnder[b];
const on = (i: Input, b: Branch) => i.facts.plate.heavenOn[b];
const el = (b: Branch): Element => BRANCH_ELEMENT[b];
/** 課伝（四課の上神・三伝）の支 */
const boardBranches = (i: Input) => [...i.facts.lessons.map((l) => l.upper), ...seqOf(i)];
/** 玄武の乗神（賊）と、その陰神（盗神。『直指』「元武之陰神為盜神」） */
const xuan = (i: Input) => riding(i, "玄武");
const thiefGod = (i: Input) => on(i, xuan(i));
const xuanInBoard = (i: Input) => boardBranches(i).includes(xuan(i));
const sameEl = (a: Branch, b: Branch) => el(a) === el(b);
/** 類神が旬空、または坐空（地盤が旬空） */
const symbolFallsVoid = (i: Input, b: Branch) => isVoid(i, b) || isVoid(i, under(i, b));

/** 『直指』盗賊の盗神の方位（本文のまま。酉・戌は「西北」、亥は本文の「益神」は盗神の誤字） */
const ZZ_DIRECTION: Record<Branch, string> = {
  子: "正北方", 丑: "北方近东", 寅: "东方靠北", 卯: "东方", 辰: "东方", 巳: "东南方", 午: "南方", 未: "南方，近西", 申: "西南方", 酉: "西北", 戌: "西北", 亥: "北方",
};
/** 『心鏡』《入式》の盗神の方位（本文のまま） */
const XJ_DIRECTION: Record<Branch, string> = {
  子: "北方", 丑: "北方", 寅: "东方", 卯: "东方", 辰: "东方", 巳: "东南方", 午: "南方", 未: "南方", 申: "西南方", 酉: "西方", 戌: "西方", 亥: "北方",
};

// ---- 向き ----
const fav = (note?: string) => () => ({ direction: "favoring" as DomainDirection, ...(note ? { note } : {}) });
const hin = (note?: string) => () => ({ direction: "hindering" as DomainDirection, ...(note ? { note } : {}) });
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
const SIGN = neutral("兆候という古典の読みで、盗難・紛失の事実を認定しない（所有者への有利・不利という向きにもしない）");
const PLACE = neutral("所在・方位の古典の読みで、具体的な場所を示さない");
const LP = ["lostProperty"], LPM = ["lostProperty", "recovery:misplaced"], TH = ["theft"], THS = ["theft", "recovery:stolen"], SIGNS = ["lostProperty", "theft"];

const LOST_ITEM_RULES: readonly Rule[] = [
  // ===================== 遺失（『直指』遺失・『心鏡』郇注・『指南』六畜章） =====================
  {
    id: "lostItem.symbolLocation", when: { domain: "lostItem", subtypes: LP },
    reading: { axis: "relation", topic: "location", key: "symbolLocation", label: "類神が課伝にあり、玄武に乗らず空亡に落ちない（類神の臨む地で探す）", level: "direct",
      citations: [ZZ("凡类见课传而不乘元武，不落空亡者，当于类神所临之地寻之", "遺失")] },
    conditions: (i) => {
      const s = i.symbol;
      // 「不落空亡」が旬空か坐空（『指南』の表記の「落空」）かは確定しないので、どちらにも当たらないときだけ読む
      if (!s || !boardBranches(i).includes(s.branch) || general(i, s.branch) === "玄武" || symbolFallsVoid(i, s.branch)) return null;
      return { detected: `類神 ${s.label}が課伝にあり、地盤 ${under(i, s.branch)} に臨む（古典はその地で探すとする）`, evidence: [ev("symbol", `${s.branch}加${under(i, s.branch)}`)] };
    },
    assess: PLACE,
  },
  {
    id: "lostItem.symbolGround", when: { domain: "lostItem", subtypes: LP },
    reading: { axis: "relation", topic: "location", key: "symbolGround", label: "類神の地盤が方向（『指南』六畜章の割注）", level: "combined",
      citations: [ZN("注", "阴神为形状，地盘为方向", "六畜章第二十三 占験一")] },
    conditions: (i) => (i.symbol ? { detected: `類神 ${i.symbol.label}の地盤は ${under(i, i.symbol.branch)}（古典はこれを方向とする）`, evidence: [ev("symbol", `${i.symbol.branch}加${under(i, i.symbol.branch)}`)] } : null),
    assess: neutral("所在・方位の古典の読みで、具体的な場所を示さない（方位への換算表は資料にないので支のまま出す。陰神の形状は読まない）"),
  },
  {
    id: "lostItem.symbolWithXuanwu", when: { domain: "lostItem", subtypes: LP },
    reading: { axis: "relation", topic: "theftSign", key: "symbolWithXuanwu", label: "類神に玄武が乗る（人に盗み去られた兆候）", level: "direct",
      citations: [ZZ("若类神乘元武，乃为人盗去", "遺失")] },
    conditions: (i) => (i.symbol && general(i, i.symbol.branch) === "玄武" ? { detected: `類神 ${i.symbol.label}に玄武が乗る`, evidence: [ev("symbol", i.symbol.branch)] } : null),
    assess: SIGN,
  },
  {
    id: "lostItem.lostNotStolen", when: { domain: "lostItem", subtypes: LP },
    reading: { axis: "relation", topic: "lossSign", key: "lostNotStolen", label: "貴人が順行し、玄武が課伝にない（遺失の兆候）", level: "direct",
      citations: [ZZ("贵人顺行，元武不见，乃遗失也", "遺失"), ZN("原文", "贵顺玄藏自失忧")] },
    conditions: (i) => (i.facts.generals.direction === "順" && !xuanInBoard(i) ? { detected: `天将が順行し、玄武（乗神 ${xuan(i)}）が課伝にない`, evidence: [ev("generals", "順・玄武なし")] } : null),
    assess: SIGN,
  },
  {
    id: "lostItem.householdHidden", when: { domain: "lostItem", subtypes: LP },
    reading: { axis: "relation", topic: "thirdParty", key: "householdHidden", label: "支上に天空が乗り旬空で、玄武が課伝にない（家の者が隠している）", level: "direct",
      citations: [ZZ("若辰上天空空亡而不见元武，家人隐匿也", "遺失")] },
    conditions: (i) => {
      const z = lessonUpper(i, 3);
      return general(i, z) === "天空" && isVoid(i, z) && !xuanInBoard(i) ? { detected: `支上 ${z} に天空が乗り旬空、玄武が課伝にない`, evidence: [ev("lesson3", z)] } : null;
    },
    assess: neutral("第三者の関与の古典の読みで、特定の人物を示さない"),
  },
  {
    id: "lostItem.stemTaiyin", when: { domain: "lostItem", subtypes: LPM },
    reading: { axis: "opportunity", topic: "discovery", key: "stemTaiyin", label: "干上に太陰（隠れているが密でなく探せる）", level: "direct",
      citations: [ZZ("日上乘太阴，隐藏者，不密而可寻", "遺失")] },
    conditions: (i) => (general(i, lessonUpper(i, 1)) === "太陰" ? { detected: `干上 ${lessonUpper(i, 1)} に太陰が乗る`, evidence: [ev("lesson1", lessonUpper(i, 1))] } : null),
    assess: fav(),
  },
  {
    id: "lostItem.symbolOnStemBranch", when: { domain: "lostItem", subtypes: LPM },
    reading: { axis: "support", topic: "recovery", key: "symbolOnStemBranch", label: "類神が日辰（干上・支上）に臨む（本家から失われない）", level: "direct",
      citations: [ZZ("类神临曰辰，本家不失", "遺失")] },
    conditions: (i) => {
      const s = i.symbol;
      if (!s) return null;
      const at = [lessonUpper(i, 1) === s.branch ? "干上" : "", lessonUpper(i, 3) === s.branch ? "支上" : ""].filter(Boolean);
      return at.length ? { detected: `類神 ${s.label}が${at.join("・")}にある`, evidence: [ev("symbol", s.branch)] } : null;
    },
    assess: fav(),
  },
  {
    id: "lostItem.lesson4OvercomesLesson1", when: { domain: "lostItem", subtypes: LPM },
    reading: { axis: "actualization", topic: "discovery", key: "lesson4OvercomesLesson1", label: "第四課の上神が第一課の上神を剋す（失物が見える）", level: "direct",
      citations: [XJ("注", "若辰之阴神第四课来克日之阳神第一课，所失之物可见也")] },
    conditions: (i) => (overcomes(lessonUpper(i, 4), lessonUpper(i, 1)) ? { detected: `第四課 ${lessonUpper(i, 4)} が第一課 ${lessonUpper(i, 1)} を剋す`, evidence: [ev("lessons", "4→1")] } : null),
    assess: fav(),
  },
  {
    id: "lostItem.lesson2OvercomesLesson3", when: { domain: "lostItem", subtypes: LPM },
    reading: { axis: "obstruction", topic: "discovery", key: "lesson2OvercomesLesson3", label: "第二課の上神が第三課の上神を剋す（失物が見えない）", level: "direct",
      citations: [XJ("注", "凡占遗失寻得法，日干之阴神第二课来克辰之阳神第三课，所失之物不可见也")] },
    conditions: (i) => (overcomes(lessonUpper(i, 2), lessonUpper(i, 3)) ? { detected: `第二課 ${lessonUpper(i, 2)} が第三課 ${lessonUpper(i, 3)} を剋す`, evidence: [ev("lessons", "2→3")] } : null),
    assess: hin(),
  },
  {
    id: "lostItem.nobleControls", when: { domain: "lostItem", subtypes: LPM },
    reading: { axis: "actualization", topic: "recovery", key: "nobleControls", label: "天乙が日辰の上に臨み、類神または玄武を剋す（得やすい）", level: "combined",
      // 本文の「所夫之物」は「所失之物」の誤字
      citations: [XJ("注", "若天乙并临日辰之上，克制所夫之物类神者，好得；不然克制玄武亦得")] },
    conditions: (i) => {
      const n = riding(i, "貴人");
      const at = [lessonUpper(i, 1) === n ? "干上" : "", lessonUpper(i, 3) === n ? "支上" : ""].filter(Boolean);
      if (!at.length) return null;
      const targets = [i.symbol && overcomes(n, i.symbol.branch) ? `類神 ${i.symbol.label}` : "", overcomes(n, xuan(i)) ? `玄武の乗神 ${xuan(i)}` : ""].filter(Boolean);
      return targets.length ? { detected: `貴人（乗神 ${n}）が${at.join("・")}にあり、${targets.join("・")}を剋す`, evidence: [ev("貴人", n)] } : null;
    },
    assess: fav(),
  },
  {
    id: "lostItem.symbolOnGrowth", when: { domain: "lostItem", subtypes: ["lostProperty", "recovery:misplaced", "recovery:stolen"] },
    reading: { axis: "support", topic: "recovery", key: "symbolOnGrowth", label: "類神が自らの長生の地に坐す（失われない）", level: "combined",
      citations: [DQ("或所失者物类坐于长生之上，亦不失矣")] },
    conditions: (i) => {
      const s = i.symbol;
      if (!s || el(s.branch) === "土" || growthStageOf(el(s.branch), under(i, s.branch)) !== "長生") return null;
      return { detected: `類神 ${s.label}が地盤 ${under(i, s.branch)}（${el(s.branch)}の長生）に坐す`, evidence: [ev("symbol", `${s.branch}加${under(i, s.branch)}`)] };
    },
    assess: fav(),
  },

  // ===================== 失脱・盗難の兆候（『大全』卷九。凡占） =====================
  {
    id: "lostItem.houseDrained", when: { domain: "lostItem", subtypes: SIGNS },
    reading: { axis: "relation", topic: "theftSign", key: "houseDrained", label: "人宅がともに脱される（盗みを招く）", level: "direct",
      citations: [DQ("人宅受脱，俱招盗。此例有二等：一者支上干上皆乘脱气。二者干上脱支，支上脱干。巳上二例，凡占人被脱赚家宅，必被盗窃财物")] },
    conditions: (i) => {
      const s1 = lessonUpper(i, 1), s3 = lessonUpper(i, 3);
      const a = generates(dayStem(i), s1) && generates(dayBranch(i), s3), b = generates(dayBranch(i), s1) && generates(dayStem(i), s3);
      return a || b ? { detected: [a ? `干上 ${s1} が日干を、支上 ${s3} が日支を脱す` : "", b ? `干上 ${s1} が日支を、支上 ${s3} が日干を脱す` : ""].filter(Boolean).join("・"), evidence: [ev("lessons13", `${s1}${s3}`)] } : null;
    },
    assess: SIGN,
  },
  {
    id: "lostItem.voidInitialXuanwu", when: { domain: "lostItem", subtypes: SIGNS },
    reading: { axis: "relation", topic: "lossSign", key: "voidInitialXuanwu", label: "遥剋・昴星・別責で、旬空の初伝に玄武が乗る（失脱）", level: "combined",
      citations: [DQ("遥克昴星，别责乘空。落空为初传，发用。将乘玄武者，凡占定主失脱"), DQ("此等日乃空亡，乘玄武为用")] },
    conditions: (i) => {
      const m = i.facts.sanchuan.method, b = t(i, "initial").branch;
      return (m === "遥剋" || m === "昴星" || m === "別責") && isVoid(i, b) && general(i, b) === "玄武"
        ? { detected: `課体が${m}で、初伝 ${b} が旬空・玄武が乗る`, evidence: [ev("method", m)] } : null;
    },
    assess: SIGN,
  },
  {
    id: "lostItem.ghostDrainXuanwu", when: { domain: "lostItem", subtypes: SIGNS },
    reading: { axis: "relation", topic: "lossSign", key: "ghostDrainXuanwu", label: "初伝の官鬼または子孫（脱気）に玄武が乗る（失脱）", level: "direct",
      citations: [DQ("鬼脱乘玄格，缘日鬼或脱气乘玄武来意。占失脱为发用，尤的"), ZN("原文", "鬼脱乘玄遭盗窃")] },
    conditions: (i) => {
      const p = t(i, "initial");
      return (p.sixRelation === "官鬼" || p.sixRelation === "子孫") && general(i, p.branch) === "玄武" ? { detected: `初伝 ${p.branch}（${p.sixRelation}）に玄武が乗る`, evidence: [ev("initial", p.branch)] } : null;
    },
    assess: SIGN,
  },

  // ===================== 盗難（『直指』盗賊・『指南』賊盗章・『心鏡』占盗賊・『大全』） =====================
  {
    id: "lostItem.theftRoles", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "relation", topic: "relation", key: "theftRoles", label: "盗難の古典の役割（日干＝失主・玄武＝賊の類神・玄武の陰神＝盗神）", level: "direct",
      citations: [ZZ("以日干为失主，元武为贼，元武之阴神为盗神", "盗賊"), XJ("原文", "元武之阴须识取，名为盗者审斯奸")] },
    conditions: (i) => ({ detected: `日干 ${dayStem(i)} が失主、玄武の乗神 ${xuan(i)} が賊の類神、その陰神 ${thiefGod(i)} が盗神`, evidence: [ev("玄武", xuan(i)), ev("盗神", thiefGod(i))] }),
    assess: neutral("参考：盤上の役割の対応で、判断ではない。盗人の存在や実在の人物を示さない"),
  },
  {
    id: "lostItem.xuanwuGround", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "trajectory", topic: "location", key: "xuanwuGround", label: "玄武の臨む地盤の支（古典が賊の去る方とする支）", level: "direct",
      citations: [ZN("原文", "地支临处知贼去"), ZN("注", "谓玄武所临地盘之支游于何方也")] },
    conditions: (i) => ({ detected: `玄武の乗神 ${xuan(i)} が地盤 ${under(i, xuan(i))} に臨む（古典はこの支の方へ賊が去るとする）`, evidence: [ev("玄武", `${xuan(i)}加${under(i, xuan(i))}`)] }),
    assess: neutral("参考：位置を示すだけで判断ではない。具体的な場所・発見の見込みを示さない（方位への換算表は資料にないので支のまま出す）"),
  },
  {
    id: "lostItem.thiefGodDirectionZZ", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "relation", topic: "location", key: "thiefGodDirectionZZ", label: "盗神の天地盤が比和（『直指』の盗神の方位）", level: "direct",
      citations: [ZZ("然必盗神天地盘比和者，阿似此断。若上下相克，则盗不留至", "盗賊"), ZZ("如盗神是子，贼在正北方", "盗賊")] },
    conditions: (i) => {
      const g = thiefGod(i);
      return sameEl(g, under(i, g)) ? { detected: `盗神 ${g} と地盤 ${under(i, g)} が比和（『直指』は盗神 ${g} を「${ZZ_DIRECTION[g]}」とする）`, evidence: [ev("盗神", `${g}加${under(i, g)}`)] } : null;
    },
    assess: PLACE,
  },
  {
    id: "lostItem.thiefGodDirectionXJ", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "relation", topic: "location", key: "thiefGodDirectionXJ", label: "盗神の天地盤が相生（『心鏡』の盗神の方位。そこに蔵す）", level: "direct",
      citations: [XJ("原文", "克处不将赃物寄，生处应在此方攒"), XJ("注", "若盗神所在上下相生，即藏此处也"), XJ("注", "盗神所在，即盗所在之处")] },
    conditions: (i) => {
      const g = thiefGod(i), u = under(i, g);
      return generates(g, u) || generates(u, g) ? { detected: `盗神 ${g} と地盤 ${u} が相生（『心鏡』《入式》は盗神 ${g} を「${XJ_DIRECTION[g]}」とする）`, evidence: [ev("盗神", `${g}加${u}`)] } : null;
    },
    assess: PLACE,
  },
  {
    id: "lostItem.thiefGodOvercomeBelow", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "relation", topic: "location", key: "thiefGodOvercomeBelow", label: "盗神が地盤に剋される（そこには蔵さない）", level: "direct",
      citations: [XJ("注", "若盗神受下克，便不藏于此处")] },
    conditions: (i) => {
      const g = thiefGod(i);
      return overcomes(under(i, g), g) ? { detected: `盗神 ${g} が地盤 ${under(i, g)} に剋される`, evidence: [ev("盗神", `${g}加${under(i, g)}`)] } : null;
    },
    assess: PLACE,
  },
  {
    id: "lostItem.fuFanLocation", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "relation", topic: "location", key: "fuFanLocation", label: "伏吟は支の前後・返吟は玄武の対冲（捕える・尋ねる処）", level: "direct",
      citations: [ZN("原文", "伏支前后返冲排"), ZN("注", "伏吟贵顺支前一位捕之，逆支后一位寻。返吟贼在玄武对冲处也")] },
    conditions: (i) => {
      const off = i.facts.plate.offset, B: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
      const sh = (b: Branch, n: number) => B[(B.indexOf(b) + n + 12) % 12];
      if (off === 0) return i.facts.generals.direction === "順"
        ? { detected: `伏吟で貴人が順行（日支 ${dayBranch(i)} の前一位 ${sh(dayBranch(i), 1)} で捕える）`, evidence: [ev("plate", "伏吟")] }
        : { detected: `伏吟で貴人が逆行（日支 ${dayBranch(i)} の後一位 ${sh(dayBranch(i), -1)} で尋ねる）`, evidence: [ev("plate", "伏吟")] };
      if (off === 6) return { detected: `返吟（玄武の乗神 ${xuan(i)} の対冲 ${sh(xuan(i), 6)} に賊がいる）`, evidence: [ev("plate", "返吟")] };
      return null;
    },
    assess: neutral("所在・方位の古典の読みで、具体的な場所を示さない（支のまま出す）"),
  },
  {
    id: "lostItem.generalsDirection", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "trajectory", topic: "movement", key: "generalsDirection", label: "天乙（玄武）の順行・逆行（古典は賊が去った／まだ伏すとする）", level: "direct",
      citations: [ZN("原文", "天乙顺行贼游走，逆行方识贼藏瞒"), XJ("原文", "传若顺行贼游走，逆行乃知贼伏蟠"), XJ("注", "凡元武顺行，其贼已行；元武逆行，其贼未行")] },
    conditions: (i) => ({ detected: i.facts.generals.direction === "順" ? "天将が順行（古典は、盗難であれば賊は既に去ったとする）" : "天将が逆行（古典は、盗難であれば賊はまだ伏しているとする）", evidence: [ev("generals", i.facts.generals.direction)] }),
    assess: neutral("参考：天将の順逆はどの盤にもある位置の FACT で、判断ではない。盗人の存在を前提にせず、発見・回収の向きにしない"),
  },
  {
    id: "lostItem.cannotCatch", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "obstruction", topic: "capture", key: "cannotCatch", label: "支上に辰戌（斬関）・三伝の日鬼に青龍・六合・太陰（捕えられない）", level: "direct",
      citations: [ZZ("如辰戌立于支上，名斩关课者", "盗賊"), ZZ("三传见曰鬼，而乘青龙、六合太阴", "盗賊"), ZZ("皆不可捕", "盗賊")] },
    conditions: (i) => {
      const out: string[] = [];
      const z = lessonUpper(i, 3);
      if (z === "辰" || z === "戌") out.push(`支上が ${z}（斬関）`);
      const ps = TRANSMISSIONS.filter((p) => t(i, p).sixRelation === "官鬼" && ["青龍", "六合", "太陰"].includes(general(i, t(i, p).branch)));
      if (ps.length) out.push(`${ps.map((p) => `${LABEL[p]} ${t(i, p).branch}（官鬼）に${general(i, t(i, p).branch)}`).join("・")}`);
      return out.length ? { detected: out.join("・"), evidence: [ev("cannotCatch", out.length.toString())] } : null;
    },
    assess: hin(),
  },
  {
    id: "lostItem.xuanSeatNoOvercome", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "obstruction", topic: "capture", key: "xuanSeatNoOvercome", label: "玄武の乗神と地盤が相剋しない（賊が発覚しない）", level: "direct",
      citations: [XJ("原文", "大贼不然元武所居神不相克贼不发")] },
    conditions: (i) => {
      const x = xuan(i), u = under(i, x);
      return !overcomes(x, u) && !overcomes(u, x) ? { detected: `玄武の乗神 ${x} と地盤 ${u} が相剋しない`, evidence: [ev("玄武", `${x}加${u}`)] } : null;
    },
    assess: hin(),
  },
  {
    id: "lostItem.thiefGodFierceControl", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "thiefGodFierceControl", label: "盗神に朱雀・勾陳・螣蛇・白虎が乗り玄武を剋す（賊が敗れる）", level: "direct",
      citations: [XJ("注", "凡元武之阴神作朱雀克元武，被吏所捕而败。乘勾陈、克元武，亦然。乘螣蛇克元武，贼自惊惶而败。乘白虎克元武，贼被伤杀而败，或自杀。皆以盗神克下，或遥克元武之阳神")] },
    conditions: (i) => {
      const g = thiefGod(i), gn = general(i, g);
      return ["朱雀", "勾陳", "螣蛇", "白虎"].includes(gn) && overcomes(g, xuan(i)) ? { detected: `盗神 ${g} に${gn}が乗り、玄武の乗神 ${xuan(i)} を剋す`, evidence: [ev("盗神", `${g}・${gn}`)] } : null;
    },
    assess: fav(),
  },
  {
    id: "lostItem.thiefGodHidden", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "obstruction", topic: "thirdParty", key: "thiefGodHidden", label: "盗神に太陰・六合が乗る（人が匿い、捕え難い）", level: "direct",
      citations: [XJ("注", "若盗神与太阴六合并者，有人藏匿，贼难捕捉")] },
    conditions: (i) => {
      const g = thiefGod(i), gn = general(i, g);
      return gn === "太陰" || gn === "六合" ? { detected: `盗神 ${g} に${gn}が乗る`, evidence: [ev("盗神", `${g}・${gn}`)] } : null;
    },
    assess: hin("第三者の関与の古典の読みで、特定の人物を示さない"),
  },
  {
    id: "lostItem.gouVsThiefGod", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "gouVsThiefGod", label: "勾陳（捕える側）と盗神の生剋（『心鏡』《入式》）", level: "direct",
      citations: [XJ("注", "常以勾陈为捕盗之人，勾陈克盗神易获，盗神克勾陈难获；勾陈生盗神则捕人纵贼，盗神生勾陈则捕人受贿；勾陈与盗神比和则通同隐容")] },
    conditions: (i) => {
      const c = riding(i, "勾陳"), g = thiefGod(i);
      const r = overcomes(c, g) ? "勾陳が盗神を剋す（獲やすい）" : overcomes(g, c) ? "盗神が勾陳を剋す（獲難い）" : generates(c, g) ? "勾陳が盗神を生ず（捕える側が賊を逃す形）"
        : generates(g, c) ? "盗神が勾陳を生ず（捕える側が賊に通じる形）" : "勾陳と盗神が比和（捕える側が賊に通じる形）";
      return { detected: `勾陳の乗神 ${c}・盗神 ${g}：${r}`, evidence: [ev("勾陳・盗神", `${c}・${g}`)] };
    },
    assess: (i) => (overcomes(riding(i, "勾陳"), thiefGod(i))
      ? { direction: "favoring", note: "資料が5通りの関係すべてに判断を書くのでどの盤でも出る。捕獲の読みで、回収とは別" }
      : { direction: "hindering", note: "資料が5通りの関係すべてに判断を書くのでどの盤でも出る。古典の象意で、現実の捕える側の人物の行為を示すものではない" }),
  },
  {
    id: "lostItem.gouVsXuanwu", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "gouVsXuanwu", label: "勾陳の乗神と玄武の乗神の生剋（『直指』）", level: "direct",
      citations: [ZZ("当视勾所乘神克元所乘之神则得。若勾乘神生武或比和，主受赂私通而不得", "盗賊")] },
    conditions: (i) => {
      const c = riding(i, "勾陳"), x = xuan(i);
      if (overcomes(c, x)) return { detected: `勾陳の乗神 ${c} が玄武の乗神 ${x} を剋す（得る）`, evidence: [ev("勾陳・玄武", `${c}・${x}`)] };
      if (generates(c, x) || sameEl(c, x)) return { detected: `勾陳の乗神 ${c} が玄武の乗神 ${x} を${sameEl(c, x) ? "比和" : "生ず"}（得ない）`, evidence: [ev("勾陳・玄武", `${c}・${x}`)] };
      return null;
    },
    assess: (i) => (overcomes(riding(i, "勾陳"), xuan(i)) ? { direction: "favoring" } : { direction: "hindering", note: "古典の象意で、現実の捕える側の人物の行為を示すものではない" }),
  },
  {
    id: "lostItem.transmissionsOldMethod", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "transmissionsOldMethod", label: "三伝に勾陳がなく、初＝贓・中＝賊・末＝吏で末伝が中伝を剋す／生じ比和（『直指』の旧法）", level: "direct",
      citations: [ZZ("若三传中不见勾陈，则当视末传。盖初赃，中贼，末吏，此旧法也。若末克中者，捕得，相生比和者不得", "盗賊")] },
    conditions: (i) => {
      if (seqOf(i).some((b) => general(i, b) === "勾陳")) return null;
      const m = t(i, "middle").branch, f = t(i, "final").branch;
      if (overcomes(f, m)) return { detected: `三伝に勾陳がなく、末伝 ${f} が中伝 ${m} を剋す（捕える）`, evidence: [ev("final→middle", "剋")] };
      if (generates(f, m) || generates(m, f) || sameEl(f, m)) return { detected: `三伝に勾陳がなく、末伝 ${f} と中伝 ${m} が${sameEl(f, m) ? "比和" : "相生"}（捕えない）`, evidence: [ev("final・middle", "生・比和")] };
      return null;
    },
    assess: (i) => (overcomes(t(i, "final").branch, t(i, "middle").branch) ? { direction: "favoring" } : { direction: "hindering" }),
  },
  {
    id: "lostItem.transmissionsRuShi", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "transmissionsRuShi", label: "初＝賊・中＝贓・末＝捕人で末伝と初伝の剋（『心鏡』《入式》・『指南』）", level: "direct",
      citations: [XJ("注", "以初传为贼，中传为赃，末传为捕人"), XJ("注", "初传克末传为贼难捉。末传克初传则贼易获"), ZN("原文", "发用为偷即贼身，中传为赃末捕人")] },
    conditions: (i) => {
      const a = t(i, "initial").branch, f = t(i, "final").branch;
      if (overcomes(f, a)) return { detected: `末伝 ${f} が初伝 ${a} を剋す（賊を獲やすい）`, evidence: [ev("final→initial", "剋")] };
      if (overcomes(a, f)) return { detected: `初伝 ${a} が末伝 ${f} を剋す（賊を捉え難い）`, evidence: [ev("initial→final", "剋")] };
      return null;
    },
    assess: (i) => (overcomes(t(i, "final").branch, t(i, "initial").branch) ? { direction: "favoring", note: "『直指』の旧法（初＝贓・中＝賊・末＝吏）とは三伝の割り当てが違う（相殺しない）" } : { direction: "hindering", note: "『直指』の旧法（初＝贓・中＝賊・末＝吏）とは三伝の割り当てが違う（相殺しない）" }),
  },
  {
    id: "lostItem.middleLoot", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "recovery", key: "middleLoot", label: "中伝（贓）が旺相（贓物がまだある）／休囚・旬空（分けられて無い）", level: "direct",
      citations: [XJ("注", "若中传旺相则赃物犹在。中传休囚及空亡，则赃物已分废无存")] },
    conditions: (i) => {
      const m = t(i, "middle"), s = m.seasonalStrength;
      if (m.isVoid) return { detected: `中伝 ${m.branch} が旬空`, evidence: [ev("middle", "旬空")] };
      if (s === "旺" || s === "相") return { detected: `中伝 ${m.branch} が月令に${s}`, evidence: [ev("middle", s)] };
      if (s === "休" || s === "囚") return { detected: `中伝 ${m.branch} が月令に${s}`, evidence: [ev("middle", s)] };
      return null;
    },
    assess: (i) => {
      const m = t(i, "middle");
      const note = "『直指』の旧法では中伝は賊なので、この読みは『心鏡』《入式》の割り当てによる";
      return !m.isVoid && (m.seasonalStrength === "旺" || m.seasonalStrength === "相") ? { direction: "favoring", note } : { direction: "hindering", note };
    },
  },
  {
    id: "lostItem.wealthVoid", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "obstruction", topic: "recovery", key: "wealthVoid", label: "課伝の妻財がすべて旬空（贓を尋ね難い）", level: "combined",
      citations: [ZN("原文", "财爻空陷赃难寻")] },
    conditions: (i) => {
      const ws = [...i.facts.lessons.filter((l) => l.relation === "妻財").map((l) => l.upper), ...TRANSMISSIONS.filter((p) => t(i, p).sixRelation === "妻財").map((p) => t(i, p).branch)];
      return ws.length && ws.every((b) => isVoid(i, b)) ? { detected: `課伝の妻財 ${[...new Set(ws)].join("・")} がすべて旬空`, evidence: [ev("void", ws.join(""))] } : null;
    },
    assess: hin("「空陷」の陷（坐空）は読まず、旬空だけで見る"),
  },
  {
    id: "lostItem.thiefGodHurtsOwner", when: { domain: "lostItem", subtypes: TH },
    reading: { axis: "obstruction", topic: "harm", key: "thiefGodHurtsOwner", label: "盗神が日干を剋す（賊が主を傷つける）", level: "direct",
      citations: [XJ("注", "若盗神克日干，则贼伤主")] },
    conditions: (i) => (overcomes(thiefGod(i), dayStem(i)) ? { detected: `盗神 ${thiefGod(i)} が日干 ${dayStem(i)} を剋す`, evidence: [ev("盗神", thiefGod(i))] } : null),
    assess: hin(),
  },
  {
    id: "lostItem.xuanCatchable", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "opportunity", topic: "capture", key: "xuanCatchable", label: "玄武が卯・辰・巳・午・申に乗る（なお盗を捕えられる）", level: "direct",
      citations: [DQ("玄武虽不临太阳之上，如加于卯辰已午申天盘之上者，尚可捕盗")] },
    // 「虽不临太阳之上」は「太陽に臨まなくても」の意で、太陽照武（位置が確定しないので保留）の有無を条件にしない
    conditions: (i) => (["卯", "辰", "巳", "午", "申"].includes(xuan(i)) ? { detected: `玄武の乗神 ${xuan(i)}`, evidence: [ev("玄武", xuan(i))] } : null),
    assess: fav(),
  },
  {
    id: "lostItem.skyNet", when: { domain: "lostItem", subtypes: THS },
    reading: { axis: "actualization", topic: "capture", key: "skyNet", label: "初伝と占時がともに日干を剋す（天網四張。賊を必ず獲る）", level: "combined",
      citations: [DQ("天网四张格最宜占贼必获。谓用神与正时同克日是也。惟在破网卦，反难捉贼矣")] },
    conditions: (i) => (overcomes(t(i, "initial").branch, dayStem(i)) && overcomes(i.facts.basic.divinationBranch, dayStem(i))
      ? { detected: `初伝 ${t(i, "initial").branch}・占時 ${i.facts.basic.divinationBranch} がともに日干 ${dayStem(i)} を剋す`, evidence: [ev("initial・時", "剋日")] } : null),
    assess: fav("破網（神が初伝を剋す）は見る神が資料で確定しないので判断しない"),
  },
];

/** 所有者と問う人の関係 */
export function ownerRelationOf(context: InterpretationContext): "self" | "proxy" | "unknown" {
  if (context.ownerPersonId === undefined || context.subjectPersonId === undefined) return "unknown";
  return context.ownerPersonId === context.subjectPersonId ? "self" : "proxy";
}

/** 物の類神の天盤支（天将はその天将が乗る支） */
function symbolOf(facts: InterpretationFacts, context: InterpretationContext): Input["symbol"] {
  const s = context.targetSymbol;
  if (!s) return null;
  if (s.kind === "branch") return { label: s.branch, branch: s.branch };
  const b = (Object.keys(facts.generals.generalOn) as Branch[]).find((x) => facts.generals.generalOn[x] === s.general)!;
  return { label: `${s.general}（${b}）`, branch: b };
}

type Sub = "lostProperty" | "theft" | "recovery:misplaced" | "recovery:stolen";
const SUBJECT: Record<Sub, string> = { lostProperty: "失物（なくした物を探す）", theft: "盗難", "recovery:misplaced": "遺失した物が戻るか", "recovery:stolen": "盗まれた物が戻るか" };
/** 段階（topic）の表示。ある段階の読みから他の段階を断定しないため、段階ごとに分けて書く */
const STAGES: Record<Sub, readonly { topics: readonly string[]; label: string }[]> = {
  lostProperty: [
    { topics: ["lossSign", "theftSign"], label: "紛失・盗難に関する兆候" }, { topics: ["location"], label: "物の所在・移動" },
    { topics: ["thirdParty"], label: "第三者の関与" }, { topics: ["discovery"], label: "発見の可能性" }, { topics: ["recovery"], label: "回収の可能性" },
  ],
  theft: [
    { topics: ["relation"], label: "盗難の古典の役割" }, { topics: ["lossSign", "theftSign"], label: "紛失・盗難に関する兆候" },
    { topics: ["location", "movement"], label: "盗人・盗品の所在・移動" }, { topics: ["thirdParty"], label: "第三者の関与" },
    { topics: ["capture"], label: "盗人を捕える古典の読み（物が戻ることとは別）" }, { topics: ["recovery"], label: "回収の可能性" }, { topics: ["harm"], label: "所有者への害" },
  ],
  "recovery:misplaced": [{ topics: ["discovery"], label: "発見の可能性" }, { topics: ["recovery"], label: "回収の可能性" }],
  "recovery:stolen": [{ topics: ["thirdParty"], label: "第三者の関与" }, { topics: ["capture"], label: "盗人を捕える古典の読み（物が戻ることとは別）" }, { topics: ["recovery"], label: "回収の可能性" }],
};
const HEAD = "【古典の読み】以下は、六壬の古典がこの盤の配置を失物・盗難の占としてどう読むかの整理です。古典の日干（失主）・類神・玄武（賊）・盗神は盤上の役割で、実際の人物（問う人・所有者・探す人・物を持っている人）とは別に扱い、実在の人物を盗人と推定しません。";
const TAIL = "【注意】古典に基づく象意の解釈で、盗難の事実や人物の責任を示すものではありません。具体的な場所・発見日・回収日・距離は出しません。兆候・所在・発見・捕獲・回収は別々の判断で、ある段階の読みから他の段階を断定しません。";

function stageLines(sub: Sub, readings: readonly DomainReading[], missing: readonly DomainMissingFact[]): string[] {
  const dir = (r: DomainReading) => (r.direction === "favoring" ? "追い風" : r.direction === "hindering" ? "妨げ" : "参考");
  return [
    ...STAGES[sub].map(({ topics, label }) => {
      const rs = readings.filter((r) => topics.includes(r.topic ?? ""));
      return `・${label}: ${rs.length ? rs.map((r) => `${r.detected}（${dir(r)}）`).join("。") : "この盤では資料に根拠のある読みがない（断定しない）"}`;
    }),
    `・判断できない事項: ${missing.length ? `${missing.length}件（下の「未確定」。推測で補わない）` : "なし"}`,
  ];
}

/** 失物・盗難の DOMAIN 判断 */
export function evaluateLostItemDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "lostItem") throw new Error(`失物以外の DOMAIN です: ${context.domain}`);
  const raw = context.subtype ?? "general";
  if (raw !== "lostProperty" && raw !== "theft" && raw !== "recovery") {
    return summarizeDomainReadings("lostItem", context.subtype, context.goal, [],
      [{ key: "subtype", detail: "問いの種類（失物 lostProperty・盗難 theft・回収 recovery）が未指定なので判断しない" }], "失物・盗難");
  }
  if (raw === "recovery" && !context.lossCause) {
    return summarizeDomainReadings("lostItem", context.subtype, context.goal, [],
      [{ key: "lossCause", detail: "遺失（misplaced）か盗難（stolen）か（lossCause）が未指定なので、回収は判断しない（『直指』は遺失と盗賊を別の章にしている。遺失・盗難の兆候は lostProperty で読む）" }], "失物・盗品の回収");
  }
  const sub: Sub = raw === "recovery" ? (context.lossCause === "stolen" ? "recovery:stolen" : "recovery:misplaced") : raw;
  const subject = SUBJECT[sub];
  const rel = ownerRelationOf(context);
  const premise = sub === "theft" || sub === "recovery:stolen" ? "盗難の占として読む（盗難があったことを前提にした古典の読みで、盗難の事実を確かめるものではない）" : "";
  const who = [
    rel === "self" ? "問う人本人が所有者" : rel === "proxy" ? "代理の問い（所有者は問う人と別の人物）" : "所有者が問う人本人かどうかは未指定",
    "古典の日干は失主（所有者）の位置",
    context.lossCause ? `失った原因は${context.lossCause === "stolen" ? "盗難" : "遺失"}として問う（指定による）` : "",
    "盗人・物を持っている人は実在の人物として推定しない",
    premise,
  ].filter(Boolean).join("・");
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  const own = missing.filter((x) => x.key !== "natalYear" && x.key !== "taiSui");
  const wrap = (r: DomainResult): DomainResult => ({ ...r, summary: [HEAD, `人物: ${who}。`, "段階ごとの読み:", ...stageLines(sub, r.readings, r.missing), r.summary, TAIL].join("\n") });
  if (!input) return wrap(summarizeDomainReadings("lostItem", context.subtype, context.goal, [], missing, subject));
  const symbol = symbolOf(facts, context);
  if (!symbol && sub !== "theft") own.push({ key: "targetSymbol", detail: "物の類神（targetSymbol）が指定されていないので、類神の読み（所在・玄武が乗る・日辰に臨む・長生に坐す・天乙が剋す）は判断しない（『直指』の物の種類と類神の対応表は本文に欠字があるので自動では決めない）" });
  if (context.goal && context.goal !== "discover" && context.goal !== "recover") own.push({ key: "goal", detail: `goal（${context.goal}）は失物の向きに使わない（discover・recover でも読みと向きは変えない）` });
  if (!monthBranch && (sub === "theft" || sub === "recovery:stolen")) own.push({ key: "monthBranch", detail: "月支がないので、中伝（贓）の旺相休囚の読みは旬空のときだけ判断する" });
  own.push({ key: "xingNian", detail: "行年・本命を使う読み（行年上の神が玄武・盗神を制す・年に玄武が乗る家の者など）は未対応" });
  if (sub === "lostProperty" || sub === "recovery:misplaced") own.push({ key: "unresolvedLost", detail: "意味や位置が資料で確定しない句（類乘日貴「日貴」が昼貴人か日干の貴人か・類神作長生或入墓・「上神能制武之所乘」の欠字・物類神と玄武が天乙と日辰上神を反制）と、『直指』の物の種類と類神の対応表（欠字）は保留" });
  if (sub === "theft" || sub === "recovery:stolen") own.push(
    { key: "unresolvedTheft", detail: "意味や位置が資料で確定しない句（丁馬發用・元武三傳比和・盜仲遁旬丁・元武是日刃・玄武内戰・循環周遍・貴人順治終玄捉・盜神「合」（郇注と《入式》で六合の扱いが逆）・玄武陰神在天乙前後・破網・游都）、玄武の位置が確定しない句（太陽照武の「玄武坐於太陽月將之上」が乗るのか地盤なのか・「玄武臨天馬、六丁」が乗るのか地盤なのか）と、『心鏡』の盗神所生の藏物処（本文が二通りで食い違う）は保留。『心鏡』「干若來傷支上將…支上陽神傷日上」は原文の位置（干・支上）と小注・郇注の位置（第二課・第四課）が食い違うので、盗難では読まない（郇注の遺失の読みだけを失物で使う）" },
    { key: "noPersonImage", detail: "盗人の人相・男女老少・人数（伴数）・窩家・里数・捕える日は、実在の人物の推定や具体的な数値につながるので出さない。亡神・天目・天馬などの神煞も未対応" },
  );
  const seated = i0SeatedVoid(input, symbol);
  if (seated) own.push({ key: "seatedOnVoid", detail: `${seated}が坐空（坐空は規則の条件にしない）` });
  if (symbol && sub === "lostProperty" && (input.facts.xun.voidBranches.includes(symbol.branch) || input.facts.xun.voidBranches.includes(input.facts.plate.earthUnder[symbol.branch])))
    own.push({ key: "symbolVoid", detail: `類神 ${symbol.label}が旬空または坐空。『直指』遺失の「不落空亡」が旬空か坐空（『指南』の表記の「落空」）かが確定しないので、「類神所臨之地」の読みは出さない（『指南』の「地盤為方向」は別の規則として出す）` });
  if (symbol && el(symbol.branch) === "土" && sub !== "theft") own.push({ key: "earthGrowth", detail: "類神が土なので、長生に坐すかは判断しない（土の長生の方式が資料で分かれる）" });
  const full: Input = { ...input, month: monthBranch ?? null, symbol };
  const readings = evaluateDomainRules(LOST_ITEM_RULES, full, "lostItem", sub, context.goal);
  return wrap(summarizeDomainReadings("lostItem", context.subtype, context.goal, readings, own, subject));
}

/** 類神・三伝の坐空（旬空でないのに地盤が旬空） */
function i0SeatedVoid(input: DomainBoardInput, symbol: Input["symbol"]): string {
  const out: string[] = [];
  const v = input.facts.xun.voidBranches;
  if (symbol && !v.includes(symbol.branch) && v.includes(input.facts.plate.earthUnder[symbol.branch])) out.push(`類神 ${symbol.label}`);
  for (const p of TRANSMISSIONS) if (!input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid) out.push(LABEL[p]);
  return out.join("・");
}

/** 監査用: ルールの一覧 */
export const LOST_ITEM_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = LOST_ITEM_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
/** 監査用: 盗神の方位表（資料の本文のまま） */
export const THIEF_GOD_DIRECTIONS = { zhiZhi: ZZ_DIRECTION, xinJing: XJ_DIRECTION } as const;
