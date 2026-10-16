// src/lib/liuren/interpretation/pregnancyDomain.ts
//
// 役割（Phase 5I）:
//   妊娠・出産（pregnancy・childbirth）の DOMAIN 判断。古典がこの盤の配置をどう読むかを、占的（subtype）ごとに別の規則表で並べる。
//     pregnancy.conception … 妊娠の兆候（来意として孕むと読む古典の形）。『六壬大全』卷九 毕法賦の互胎格・腹胎格
//     pregnancy.maintain   … 妊娠中の胎の経過。『大六壬指南』孕産章第八、『御定六壬直指』産孕、『六壬心鏡』巻五 産育門、『大全』卷九
//     childbirth.delivery  … 出産の進行・難易と、母子の古典的象意。同上
//     general              … 問いの種類が未指定。判断せず不足を返す
//   妊娠の兆候・胎の経過・出産の進行・母子・胎児の男女は別の topic として持ち、ある段階の読みから他の段階を断定しない。
//   胎児の男女の読みは吉凶と別の topic（sex）で、向きを決めない。
//
//   類神（原典ごとに出典を残す）:
//     日＝子・辰（日支）＝母（『直指』「以日為子，以支為母」・『心鏡』「支是母兮干是兒」）、正時＝子母の命（『心鏡』注）、
//     天后＝母・六合＝子（『直指』『大全』）、胎神＝日干の五行の十二長生の「胎」の支（『大全』「戊己當絶在亥懷，明知子上是胞胎」、
//     『指南』占験二の割注「金胎在卯」・占験五「陳公獻用五行長生」）。戊己日は『大全』が「或有用午為胎神者」と二説を挙げるので、胎神の規則を判断しない。
//     子孫があるだけで妊娠とはしない。
//
//   人物: 妊娠・出産する本人は context.pregnantPersonId で問う人と別に持つ（代理の問い）。胎児は人物として持たない。
//   月建の神煞（Phase 5L。monthlySpirits.ts）: 『大全』卷九の胎財生気・胎財死気・忧母格・生養神二血法だけを読む。
//     これらの格は日干（胎神・養神）と月で決まり、原文が盤上の位置を指定しないものは位置を条件にしない（忧母格は「天后乘」）。
//     忧子格「六合三月占加申」は、忧母格の「乘」と違い「加」なので、六合の乗神か地盤かが確定しない（保留）。
//     月厭煞「申加母年命上」は、同じ節が「夫妻之行年本命」と行年・本命を分けて書くので、「母年命」が本命だけか行年を含むかが確定しない（保留）。
//   行年と、上記以外の神煞（生神・天獄・劫煞など）を使う規則は未対応。
//
//   向き: 胎の経過・出産の進行・母子は、古典が順調・安と読むものを favoring、損・難・凶と読むものを hindering とする。
//   妊娠の兆候・男女・月が足りない・出産が近い等は向きを決めない。goal で読みも向きも変えない。
//   医学的な判定（妊娠の有無・胎児の状態・出産の安全性・性別）・確率・日時は出さない。空亡は旬空。坐空は原文が明示する腹空格（「或落空」）だけで使う。

import { BRANCH_ELEMENT, STEM_ELEMENT } from "../constants";
import type { Branch, Element, HeavenlyGeneral } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainReading, DomainResult, DomainRule } from "./domainResult";
import { initialOriginOf } from "./initialTransmissionOrigin";
import { relationBetween, threeHarmonyOf } from "./relations";
import type { InterpretationContext } from "./roles";
import { growthStageOf } from "./states";
import { monthlySpiritSummaryLines, spiritFact } from "./monthlySpiritReadings";
import type { InterpretationFacts, StructuralRelation, TransmissionPosition } from "./types";

type Input = DomainBoardInput;
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const BRANCHES: readonly Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const YANG_STEMS = ["甲", "丙", "戊", "庚", "壬"];

const ZZ = (quote: string): DomainCitation => ({ source: "『御定六壬直指』", locator: "産孕", layer: "原文", quote });
const ZN = (layer: "原文" | "注", quote: string, locator = "孕産章第八"): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻五 産育門", layer, quote });
const DQ = (quote: string, locator = "卷九 毕法赋"): DomainCitation => ({ source: "『六壬大全』", locator, layer: "原文", quote });
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り（既存 FACT の参照） ----
const stemUpper = (i: Input) => i.facts.lessons[0].upper;
const siteUpper = (i: Input) => i.facts.lessons[2].upper;
const dayStem = (i: Input) => i.facts.basic.dayStem;
const dayBranch = (i: Input) => i.facts.basic.dayBranch;
const t = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
const seqOf = (i: Input) => TRANSMISSIONS.map((p) => t(i, p).branch);
const relOf = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => relationBetween(a, b).relations;
const has = (rs: readonly StructuralRelation[], ...ks: StructuralRelation[]) => ks.some((k) => rs.includes(k));
const overcomes = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => has(relOf(a, b), "overcomes");
const generates = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => has(relOf(a, b), "generates");
const general = (i: Input, b: Branch): HeavenlyGeneral => i.facts.generals.generalOn[b];
const riding = (i: Input, g: HeavenlyGeneral): Branch => (Object.keys(i.facts.generals.generalOn) as Branch[]).find((b) => i.facts.generals.generalOn[b] === g)!;
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);
const under = (i: Input, b: Branch) => i.facts.plate.earthUnder[b];
const on = (i: Input, b: Branch) => i.facts.plate.heavenOn[b];
const el = (b: Branch): Element => BRANCH_ELEMENT[b];
const isYangBranch = (b: Branch) => BRANCHES.indexOf(b) % 2 === 0;
const yangStem = (i: Input) => YANG_STEMS.includes(dayStem(i));
/** 五行の「胎」の支（五行生墓法）。土は資料で二説あるので null */
const taiOf = (e: Element): Branch | null => (e === "土" ? null : BRANCHES.find((b) => growthStageOf(e, b) === "胎")!);
const dayTai = (i: Input) => taiOf(STEM_ELEMENT[dayStem(i)]);
/** 四課の不備（同じ課が重なる） */
const incomplete = (i: Input) => new Set(i.facts.lessons.map((l) => `${l.upper}${l.lowerBranch}`)).size < 4;
const MENG: readonly Branch[] = ["寅", "巳", "申", "亥"], ZHONG: readonly Branch[] = ["子", "卯", "午", "酉"];

// ---- 向き ----
const fav = (note?: string) => () => ({ direction: "favoring" as DomainDirection, ...(note ? { note } : {}) });
const hin = (note?: string) => () => ({ direction: "hindering" as DomainDirection, ...(note ? { note } : {}) });
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
const SIGN = neutral("妊娠の兆候という古典の読みで、妊娠の有無を判定しない");
const SEX = neutral("胎児の男女に関する古典の説で、性別を判定しない（吉凶とも別）");
const CON = ["conception"], MAI = ["maintain"], DEL = ["delivery"], MD = ["maintain", "delivery"];

const PREGNANCY_RULES: readonly Rule[] = [
  // ===================== 役割 =====================
  {
    id: "pregnancy.roles", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "relation", key: "roles", label: "妊娠・出産の古典の類神（出典ごと：日＝子・辰＝母／天后＝母・六合＝子／胎神）", level: "direct",
      citations: [ZZ("以日为子，以支为母"), XJ("原文", "支是母兮干是儿"), XJ("注", "日为子，辰为母，正时为子母之命"), ZZ("天后为母，六合为子"),
        ZN("原文", "又审盘中合后神"), DQ("此二例乃天后六合为子母之类也"), DQ("戊已当绝在亥怀，明知子上是胞胎"), ZN("注", "以金胎在卯故也", "孕産章第八 占験二")] },
    conditions: (i) => {
      const tai = dayTai(i);
      return { detected: `『直指』『心鏡』は日干 ${dayStem(i)} を子・日支 ${dayBranch(i)} を母とする／『直指』『指南』『大全』は天后（乗神 ${riding(i, "天后")}）を母・六合（乗神 ${riding(i, "六合")}）を子とする（産の占）／${tai ? `胎神は ${tai}（日干の五行の胎）` : "胎神は戊己日のため資料の二説（子・午）で決まらない"}。各規則はその出典の類神だけで読む`,
        evidence: [ev("dayStem", dayStem(i)), ev("dayBranch", dayBranch(i))] };
    },
    assess: neutral("参考：盤上の類神の対応で、判断ではない（問う人・当事者・胎児とは別）。ある出典の類神を別の出典の規則に当てない"),
  },

  // ===================== 妊娠の兆候（conception） =====================
  {
    id: "pregnancy.mutualTai", when: { domain: "pregnancy", subtypes: CON },
    reading: { axis: "opportunity", topic: "sign", key: "mutualTai", label: "干上に日支の胎神・支上に日干の胎神（互胎格）", level: "direct",
      citations: [DQ("互胎格"), DQ("已上并是干上得支之胎神，支上得干之胎神也"), DQ("又作夫妻之行年本命，必然妻怀孕喜")] },
    conditions: (i) => {
      const a = dayTai(i), b = taiOf(el(dayBranch(i)));
      return a && b && stemUpper(i) === b && siteUpper(i) === a ? { detected: `干上 ${stemUpper(i)} が日支の胎神、支上 ${siteUpper(i)} が日干の胎神`, evidence: [ev("tai", `${b}・${a}`)] } : null;
    },
    assess: neutral("妊娠の兆候という古典の読みで、妊娠の有無を判定しない（原文はさらに夫妻の行年本命に当たれば必ず孕むとするが、行年は未対応）"),
  },
  {
    id: "pregnancy.bellyOnTai", when: { domain: "pregnancy", subtypes: CON },
    reading: { axis: "opportunity", topic: "sign", key: "bellyOnTai", label: "丑（腹）が胎神に加わる（腹胎格）", level: "direct",
      citations: [DQ("腹胎格。腹加胎神，丑为腹也"), DQ("如值此来意，妻必有孕")] },
    conditions: (i) => { const a = dayTai(i); return a && under(i, "丑") === a ? { detected: `天盤の丑（腹）が地盤の胎神 ${a} に加わる`, evidence: [ev("丑", `丑加${a}`)] } : null; },
    assess: SIGN,
  },

  // ===================== 胎の象意（maintain・delivery） =====================
  {
    id: "pregnancy.taiGroundGood", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "support", topic: "fetus", key: "taiGroundGood", label: "胎神の落ちる地盤が生・合・比和・旺（古典は祥とする）", level: "combined",
      citations: [ZN("原文", "怀胎凶吉古今难，全凭落处地盘看。生旺比和祥可知"), ZN("注", "胎神所落地盘，生合为吉")] },
    conditions: (i) => {
      const a = dayTai(i);
      if (!a) return null;
      const u = under(i, a), r = relOf(u, a), out: string[] = [];
      if (has(r, "generates")) out.push("地盤が胎神を生ず");
      if (has(r, "combines")) out.push("六合");
      if (has(r, "sameElement")) out.push("比和");
      if (growthStageOf(el(a), u) === "帝旺") out.push("帝旺の地");
      return out.length ? { detected: `胎神 ${a} が地盤 ${u} に落ちる（${out.join("・")}）`, evidence: [ev("tai", `${a}加${u}`)] } : null;
    },
    assess: fav("古典の吉の読みで、胎児の状態の医学的な判定・保証ではない"),
  },
  {
    id: "pregnancy.taiGroundBad", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "obstruction", topic: "fetus", key: "taiGroundBad", label: "胎神の落ちる地盤が剋・刑・衰絶死墓（古典は凶とする）", level: "combined",
      citations: [ZN("原文", "刑害克绝凶立验"), ZN("注", "克刑衰绝死墓为凶")] },
    conditions: (i) => {
      const a = dayTai(i);
      if (!a) return null;
      const u = under(i, a), out: string[] = [];
      if (overcomes(u, a)) out.push("地盤が胎神を剋す");
      if (has(relOf(u, a), "punishes")) out.push("地盤が胎神を刑す");
      const st = growthStageOf(el(a), u);
      if (["衰", "死", "墓", "絶"].includes(st)) out.push(`${st}の地`);
      return out.length ? { detected: `胎神 ${a} が地盤 ${u} に落ちる（${out.join("・")}）`, evidence: [ev("tai", `${a}加${u}`)] } : null;
    },
    assess: hin("古典の吉凶の読みで、胎児の状態の医学的な判定ではない"),
  },
  {
    id: "pregnancy.voidTaiMaintain", when: { domain: "pregnancy", subtypes: MAI },
    reading: { axis: "obstruction", topic: "fetus", key: "voidTaiMaintain", label: "胎神が旬空で地盤に剋される（損孕格。孕を占えば損とする）", level: "direct",
      citations: [DQ("缘胎神作空受克，占产当日便生，占孕必损")] },
    conditions: (i) => { const a = dayTai(i); return a && isVoid(i, a) && overcomes(under(i, a), a) ? { detected: `胎神 ${a} が旬空で、地盤 ${under(i, a)} に剋される`, evidence: [ev("tai", a)] } : null; },
    assess: hin("古典の象意で、流産の予測ではない"),
  },
  {
    id: "pregnancy.voidTaiDelivery", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "voidTaiDelivery", label: "胎神が旬空で地盤に剋される（損孕格。産を占えばすぐ生まれるとする）", level: "direct",
      citations: [DQ("缘胎神作空受克，占产当日便生，占孕必损")] },
    conditions: (i) => { const a = dayTai(i); return a && isVoid(i, a) && overcomes(under(i, a), a) ? { detected: `胎神 ${a} が旬空で、地盤 ${under(i, a)} に剋される`, evidence: [ev("tai", a)] } : null; },
    assess: fav("古典の象意で、出産の時期の予測・安全の保証ではない"),
  },
  {
    id: "pregnancy.bellyVoidMaintain", when: { domain: "pregnancy", subtypes: MAI },
    reading: { axis: "obstruction", topic: "fetus", key: "bellyVoidMaintain", label: "天盤の丑（腹）が旬空・落空（腹空格。孕を占えば損とする）", level: "direct",
      citations: [DQ("腹空格。如天盘之丑作空，或落空。如占产，则生速。缘腹空而必已诞其子，占孕必损孕")] },
    conditions: (i) => (isVoid(i, "丑") || isVoid(i, under(i, "丑")) ? { detected: `天盤の丑が${isVoid(i, "丑") ? "旬空" : `坐空（地盤 ${under(i, "丑")} が旬空）`}`, evidence: [ev("丑", "空")] } : null),
    assess: hin("古典の象意で、流産の予測ではない"),
  },
  {
    id: "pregnancy.bellyVoidDelivery", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "bellyVoidDelivery", label: "天盤の丑（腹）が旬空・落空（腹空格。産を占えば生まれるのが速い）", level: "direct",
      citations: [DQ("腹空格。如天盘之丑作空，或落空。如占产，则生速。缘腹空而必已诞其子，占孕必损孕")] },
    conditions: (i) => (isVoid(i, "丑") || isVoid(i, under(i, "丑")) ? { detected: `天盤の丑が${isVoid(i, "丑") ? "旬空" : `坐空（地盤 ${under(i, "丑")} が旬空）`}`, evidence: [ev("丑", "空")] } : null),
    assess: fav("古典の象意で、出産の時期の予測・安全の保証ではない"),
  },
  {
    id: "pregnancy.transmissionsAndStem", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "actualization", topic: "fetus", key: "transmissionsAndStem", label: "三伝がすべて日干を生ず（子が育つ）／日干が三伝をすべて生ず（子が成らない）", level: "combined",
      citations: [XJ("注", "三传生日则子育，日生三传则子不成或坠胎")] },
    conditions: (i) => {
      const s = seqOf(i);
      if (s.every((b) => generates(b, dayStem(i)))) return { detected: `三伝 ${s.join("")} がすべて日干 ${dayStem(i)} を生ず（古典は子が育つとする）`, evidence: [ev("transmissions", "生日")] };
      if (s.every((b) => generates(dayStem(i), b))) return { detected: `日干 ${dayStem(i)} が三伝 ${s.join("")} をすべて生ず（古典は子が成らないとする）`, evidence: [ev("transmissions", "日生")] };
      return null;
    },
    assess: (i) => (seqOf(i).every((b) => generates(b, dayStem(i))) ? { direction: "favoring", note: "古典の吉の読みで、胎児の状態の医学的な判定・保証ではない" } : { direction: "hindering", note: "古典の象意で、流産の予測ではない" }),
  },
  {
    id: "pregnancy.incomplete", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "trajectory", topic: "fetus", key: "incomplete", label: "四課が不備（古典は月が足りないとする）", level: "direct",
      citations: [ZZ("遇阴阳不备，昴星虎视，必日月不足"), ZN("原文", "不备何能十月全"), XJ("注", "不备卦为不足月")] },
    conditions: (i) => (incomplete(i) ? { detected: "四課が不備", evidence: [ev("lessons", "不備")] } : null),
    assess: neutral("古典の象意で、早産の予測ではない"),
  },

  // ===================== 出産の進行（delivery） =====================
  {
    id: "pregnancy.tigerInitial", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "tigerInitial", label: "初伝に白虎（産では血神。産期が速い）", level: "direct",
      citations: [ZZ("惟产取白虎为血神，若出现发用，产期速")] },
    conditions: (i) => (general(i, t(i, "initial").branch) === "白虎" ? { detected: `初伝 ${t(i, "initial").branch} に白虎`, evidence: [ev("initial", "白虎")] } : null),
    assess: fav("古典の象意で、出産の時期の予測・安全の保証ではない"),
  },
  {
    id: "pregnancy.siteGeneratesStemUpper", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "siteGeneratesStemUpper", label: "支上が干上を生ず（順で産みやすい）", level: "direct",
      citations: [ZZ("辰上生日上，顺而易产"), XJ("注", "辰上神生日上神")] },
    conditions: (i) => (generates(siteUpper(i), stemUpper(i)) ? { detected: `支上 ${siteUpper(i)} が干上 ${stemUpper(i)} を生ず`, evidence: [ev("lessons13", "3→1")] } : null),
    assess: fav("古典の難易の読みで、出産の安全を保証しない"),
  },
  {
    id: "pregnancy.stemUpperGeneratesSite", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "progress", key: "stemUpperGeneratesSite", label: "干上が支上を生ず（逆で産み難い）", level: "direct",
      citations: [ZZ("日上生辰上逆而难产"), XJ("注", "若日上神生支上神")] },
    conditions: (i) => (generates(stemUpper(i), siteUpper(i)) ? { detected: `干上 ${stemUpper(i)} が支上 ${siteUpper(i)} を生ず`, evidence: [ev("lessons13", "1→3")] } : null),
    assess: hin("古典の難易の読みで、出産の危険度の判定ではない"),
  },
  {
    id: "pregnancy.easyBirthSigns", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "easyBirthSigns", label: "三伝に旬空・子孫（脱気）・傳送（申）（産みやすい）", level: "combined",
      citations: [ZZ("占产要见空亡脱气"), XJ("注", "要传送或空亡或是今日之孙孙泄气，易生")] },
    conditions: (i) => {
      const out: string[] = [];
      const v = TRANSMISSIONS.filter((p) => t(i, p).isVoid), c = TRANSMISSIONS.filter((p) => t(i, p).sixRelation === "子孫");
      if (v.length) out.push(`旬空（${v.map((p) => t(i, p).branch).join("")}）`);
      if (c.length) out.push(`子孫（${c.map((p) => t(i, p).branch).join("")}）`);
      if (seqOf(i).includes("申")) out.push("傳送（申）");
      return out.length ? { detected: `三伝に${out.join("・")}`, evidence: [ev("transmissions", seqOf(i).join(""))] } : null;
    },
    assess: fav("古典の難易の読みで、出産の安全を保証しない"),
  },
  {
    id: "pregnancy.childClingsMother", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "childClingsMother", label: "傳送がなく、三伝が三合・すべて父母・四孟（子恋母腹。月を越えて生まれるのを吉とする）", level: "combined",
      citations: [ZZ("不要见三六合及四生之类，谓之子恋母腹，生时反有可患"), XJ("注", "不见传送，或三合六合，或三传是今日父母，或四生元胎，只宜过月生则吉，速生则凶")] },
    conditions: (i) => {
      const s = seqOf(i);
      if (s.includes("申")) return null;
      const out: string[] = [];
      if (threeHarmonyOf([s[0], s[1], s[2]]).complete) out.push("三合");
      if (TRANSMISSIONS.every((p) => t(i, p).sixRelation === "父母")) out.push("すべて父母");
      if (s.every((b) => MENG.includes(b))) out.push("四孟");
      return out.length ? { detected: `傳送がなく、三伝 ${s.join("")} が${out.join("・")}`, evidence: [ev("transmissions", s.join(""))] } : null;
    },
    assess: hin("古典は速く生まれるのを凶、月を越えるのを吉とする（出産の時期の予測ではない）。「六合」は三伝のどの関係かが確定しないので読まない"),
  },
  {
    id: "pregnancy.branchOnStem", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "branchOnStem", label: "日支が干上に臨む（支臨干位。母が俯いて子を見る・産が速い）", level: "direct",
      citations: [ZN("原文", "支临干位儿生运"), DQ("外有支加干而克干者，则产速，或无克亦产。支为母俯首，巳见其子也")] },
    conditions: (i) => (stemUpper(i) === dayBranch(i) ? { detected: `干上が日支 ${dayBranch(i)}`, evidence: [ev("lesson1", stemUpper(i))] } : null),
    assess: fav("古典の難易の読みで、出産の安全を保証しない"),
  },
  {
    id: "pregnancy.stemOnBranch", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "stemOnBranch", label: "日干が支上に加わる（干加支上。子が母を恋う）", level: "direct",
      citations: [ZN("原文", "干加支上子恋母")] },
    conditions: (i) => (siteUpper(i) === i.lodgingBranch ? { detected: `支上が日干の寄宮 ${i.lodgingBranch}`, evidence: [ev("lesson3", siteUpper(i))] } : null),
    assess: hin("古典は子が母を恋うて出にくいとする（出産の時期の予測ではない）"),
  },
  {
    id: "pregnancy.nobleAndTransmissions", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "nobleAndTransmissions", label: "貴人と三伝がともに順（最も易い）／ともに逆（やや難い）", level: "combined",
      citations: [ZN("原文", "贵传俱逆生颇难，贵传俱顺生最易")] },
    conditions: (i) => {
      const d = i.facts.generals.direction, m = i.comparison.movementPattern;
      const fwd = m === "進茹" || m === "進間", back = m === "退茹" || m === "退間";
      return d === "順" && fwd ? { detected: `貴人が順行し、三伝が${m}`, evidence: [ev("direction", `順・${m}`)] }
        : d === "逆" && back ? { detected: `貴人が逆行し、三伝が${m}`, evidence: [ev("direction", `逆・${m}`)] } : null;
    },
    assess: (i) => (i.facts.generals.direction === "順" ? { direction: "favoring", note: "古典の難易の読みで、出産の安全を保証しない" } : { direction: "hindering", note: "古典の難易の読みで、出産の危険度の判定ではない" }),
  },
  {
    id: "pregnancy.lianru", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "lianru", label: "三伝が進茹（順生）／退茹（不順生）", level: "direct",
      citations: [XJ("注", "顺连茹顺元胎，日辰在天乙前皆为顺生；退连茹，逆元胎，日辰在天乙后，皆为不顺生")] },
    conditions: (i) => (i.comparison.movementPattern === "進茹" || i.comparison.movementPattern === "退茹" ? { detected: `三伝が${i.comparison.movementPattern}`, evidence: [ev("movement", i.comparison.movementPattern)] } : null),
    assess: (i) => (i.comparison.movementPattern === "進茹" ? { direction: "favoring", note: "古典の難易の読みで、出産の安全を保証しない" } : { direction: "hindering", note: "古典の難易の読みで、出産の危険度の判定ではない（元胎の順逆・天乙の前後は見る位置が確定しないので読まない）" }),
  },
  {
    id: "pregnancy.hardBirthPatterns", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "progress", key: "hardBirthPatterns", label: "虎視・涉害・間伝（難生）", level: "direct",
      citations: [XJ("注", "及虎视、涉害、间传皆为难生")] },
    conditions: (i) => {
      const m = i.facts.sanchuan.method, mv = i.comparison.movementPattern, out: string[] = [];
      if (m === "昴星" && !yangStem(i)) out.push("虎視（柔日の昴星）");
      if (m === "涉害") out.push("涉害");
      if (mv === "進間" || mv === "退間") out.push(`間伝（${mv}）`);
      return out.length ? { detected: out.join("・"), evidence: [ev("pattern", out.join(""))] } : null;
    },
    assess: hin("古典の難易の読みで、出産の危険度の判定ではない"),
  },
  {
    id: "pregnancy.kuiCrossesGate", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "progress", key: "kuiCrossesGate", label: "戌が亥に加わる（魁度天門。阻滞が多い）", level: "direct",
      citations: [ZN("原文", "魁度天门阻滞多")] },
    conditions: (i) => (on(i, "亥") === "戌" ? { detected: "天盤の戌が地盤の亥に加わる", evidence: [ev("plate", "戌加亥")] } : null),
    assess: hin("古典の難易の読みで、出産の危険度の判定ではない"),
  },
  {
    id: "pregnancy.gangSeason", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "gangSeason", label: "天罡（辰）の加わる地盤が孟（まだ・難）／仲（近い）／季（既に生まれ易い）", level: "direct",
      citations: [XJ("原文", "斗罡加孟产犹未，纵使生时亦主难。临仲如今将稍近，加季已生如等闲")] },
    conditions: (i) => {
      const u = under(i, "辰");
      return { detected: `天罡が地盤 ${u}（${MENG.includes(u) ? "孟。古典はまだ生まれず、生まれても難とする" : ZHONG.includes(u) ? "仲。古典は近いとする" : "季。古典は既に生まれ、易いとする"}）に加わる`, evidence: [ev("辰", `辰加${u}`)] };
    },
    assess: neutral("参考：『心鏡』の見出しは「産遲速」で、どの盤でも孟仲季のどれかに当たる。古典の判断は本文に残し、時期を出さないので向きに入れない"),
  },

  // ===================== 母子の象意（delivery） =====================
  {
    id: "pregnancy.harmMotherXJ", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "harmMotherXJ", label: "干上が支を刑害剋し、または支上に魁罡・蛇虎（『心鏡』注：母を害す）", level: "direct",
      citations: [XJ("原文", "支伤害母干伤子，蛇虎刑并命必危"), XJ("注", "干上神刑害克支及支上见魁罡蛇虎，主害母"), XJ("注", "见空亡及有救不妨"), ZN("原文", "支伤损母干损儿，两处无伤母子笑")] },
    conditions: (i) => {
      const out = harmTo(i, "mother");
      return out.length ? { detected: out.join("・"), evidence: [ev("lessons13", `${stemUpper(i)}${siteUpper(i)}`)] } : null;
    },
    assess: (i) => (harmVoided(i, "mother") ? { direction: "neutral", note: "害する上神が旬空なので、古典は妨げないとする" } : { direction: "hindering", note: "古典の象意で、母体の医学的な状態を示さない" }),
  },
  {
    id: "pregnancy.harmChildXJ", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "harmChildXJ", label: "支上が干を刑害剋し、または干上に魁罡・蛇虎（『心鏡』注：子を害す）", level: "direct",
      citations: [XJ("原文", "支伤害母干伤子，蛇虎刑并命必危"), XJ("注", "支上神刑害克干及干上见魁罡蛇虎主害子"), XJ("注", "见空亡及有救不妨"), ZN("原文", "支伤损母干损儿，两处无伤母子笑")] },
    conditions: (i) => {
      const out = harmTo(i, "child");
      return out.length ? { detected: out.join("・"), evidence: [ev("lessons13", `${stemUpper(i)}${siteUpper(i)}`)] } : null;
    },
    assess: (i) => (harmVoided(i, "child") ? { direction: "neutral", note: "害する上神が旬空なので、古典は妨げないとする" } : { direction: "hindering", note: "古典の象意で、胎児の医学的な状態を示さない" }),
  },
  {
    id: "pregnancy.motherChildSafe", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "support", topic: "motherChild", key: "motherChildSafe", label: "日辰が相生・比和で、魁罡・蛇虎・刑害剋がない（『心鏡』注：安）", level: "direct",
      citations: [XJ("注", "日辰相生比和不见魁罡蛇虎刑害克破为安")] },
    conditions: (i) => {
      const r = relOf(dayStem(i), dayBranch(i));
      const ok = (has(r, "generates", "generatedBy", "sameElement")) && !harmTo(i, "mother").length && !harmTo(i, "child").length && !has(relOf(stemUpper(i), siteUpper(i)), "breaks");
      return ok ? { detected: `日干 ${dayStem(i)} と日支 ${dayBranch(i)} が${has(r, "sameElement") ? "比和" : "相生"}で、『心鏡』注が母子を害するとする形がない（古典は「安」とする）`, evidence: [ev("dayStem・dayBranch", "生・比和")] } : null;
    },
    assess: fav("古典の吉の読みで、母子の医学的な安全を保証しない"),
  },
  {
    id: "pregnancy.liuheTianhouGround", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "liuheTianhouGround", label: "六合（子）・天后（母）の乗神が地盤に剋される", level: "direct",
      citations: [ZN("原文", "又审盘中合后神，死生克制细详论。合受下克伤儿命，下制天后危母身")] },
    conditions: (i) => {
      const h = riding(i, "六合"), q = riding(i, "天后"), out: string[] = [];
      if (overcomes(under(i, h), h)) out.push(`六合の乗神 ${h} が地盤 ${under(i, h)} に剋される（子）`);
      if (overcomes(under(i, q), q)) out.push(`天后の乗神 ${q} が地盤 ${under(i, q)} に剋される（母）`);
      return out.length ? { detected: out.join("・"), evidence: [ev("六合・天后", `${h}・${q}`)] } : null;
    },
    assess: hin("古典の象意で、母子の医学的な状態を示さない"),
  },
  {
    id: "pregnancy.auspiciousGenerals", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "support", topic: "motherChild", key: "auspiciousGenerals", label: "三伝に六合・青龍・太常（喜慶・驚恐がない）", level: "direct",
      citations: [XJ("原文", "又看三传神将决，六合青龙喜庆随"), XJ("注", "传内见青龙六合太常，主分娩无惊恐")] },
    conditions: (i) => {
      const gs = [...new Set(seqOf(i).map((b) => general(i, b)).filter((g) => g === "六合" || g === "青龍" || g === "太常"))];
      return gs.length ? { detected: `三伝に${gs.join("・")}`, evidence: [ev("generals", gs.join(""))] } : null;
    },
    assess: fav("古典の吉の読みで、母子の医学的な安全を保証しない"),
  },
  {
    id: "pregnancy.siteAndInitialHarm", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "siteAndInitialHarm", label: "支上と初伝がともに日干（子）・日支（母）・正時（命）を剋害", level: "direct",
      citations: [XJ("注", "若辰上神并用神克害日干，伤子；克害日支伤母；克正时必伤命也")] },
    conditions: (i) => {
      const z = siteUpper(i), a = t(i, "initial").branch, hit = (x: Parameters<typeof relationBetween>[1]) => [z, a].every((b) => has(relOf(b, x), "overcomes", "harms"));
      const out = [hit(dayStem(i)) ? `日干 ${dayStem(i)}（子）` : "", hit(dayBranch(i)) ? `日支 ${dayBranch(i)}（母）` : "", hit(i.facts.basic.divinationBranch) ? `正時 ${i.facts.basic.divinationBranch}（命）` : ""].filter(Boolean);
      return out.length ? { detected: `支上 ${z} と初伝 ${a} がともに${out.join("・")}を剋害`, evidence: [ev("lesson3・initial", `${z}${a}`)] } : null;
    },
    assess: hin("古典の象意で、母子の医学的な状態を示さない"),
  },
  {
    id: "pregnancy.transmissionsOvercome", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "transmissionsOvercome", label: "三伝がすべて日を剋す（養い難い）／すべて支を剋す（母を損なう）", level: "direct",
      citations: [ZZ("三传俱克日，难养；俱克支损母")] },
    conditions: (i) => {
      const s = seqOf(i), a = s.every((b) => overcomes(b, dayStem(i))), b = s.every((x) => overcomes(x, dayBranch(i)));
      return a || b ? { detected: [a ? `三伝 ${s.join("")} がすべて日干を剋す（子）` : "", b ? `三伝 ${s.join("")} がすべて日支を剋す（母）` : ""].filter(Boolean).join("・"), evidence: [ev("transmissions", s.join(""))] } : null;
    },
    assess: hin("古典の象意で、母子の医学的な状態を示さない"),
  },
  {
    id: "pregnancy.bothHurtDQ", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "bothHurtDQ", label: "干・支がそれぞれ上神に剋される（全傷格。『大全』の類神で、独り支は母を害し、独り干は「男」を害す）", level: "combined",
      citations: [DQ("全伤格。支干全伤，子母俱凶。独支受伤害母。独干受伤害男"), DQ("谓支干各被上乘克伐者", "卷十 毕法赋")] },
    conditions: (i) => {
      const a = overcomes(stemUpper(i), dayStem(i)), b = overcomes(siteUpper(i), dayBranch(i));
      return a || b ? { detected: a && b ? `干上 ${stemUpper(i)} が日干を、支上 ${siteUpper(i)} が日支を剋す（子母とも）` : a ? `干上 ${stemUpper(i)} が日干を剋す（原文は「害男」）` : `支上 ${siteUpper(i)} が日支を剋す（母）`, evidence: [ev("lessons13", `${stemUpper(i)}${siteUpper(i)}`)] } : null;
    },
    assess: hin("『心鏡』注は干上・支上が相手の干支を傷つける形で母子を分ける（傷の位置の定義が違うので併記する）。古典の象意で、母子の医学的な状態を示さない"),
  },

  // ===================== 月建の神煞（Phase 5L。『大全』卷九 毕法賦） =====================
  {
    id: "pregnancy.taiCaiShengQi", when: { domain: "pregnancy", subtypes: CON },
    reading: { axis: "opportunity", topic: "sign", key: "taiCaiShengQi", label: "日干の胎神が妻財で、月の生気（胎財生気格）", level: "direct",
      citations: [DQ("胎财生气妻怀孕"), DQ("谓日干之胎神，作日之妻财，又逢月内之生气者，如占妻必孕也"), DQ("五壬日，七月占皆同")] },
    // 原文は日と月で決まる格（「五壬日，七月占皆同」）で、盤上の位置を条件にしない
    conditions: (i) => {
      const a = dayTai(i), sp = i.monthlySpirits?.shengQi;
      return a && sp && sp.branch === a && overcomes(dayStem(i), a)
        ? { detected: `日干 ${dayStem(i)} の胎神 ${a} が妻財で、月（月支 ${sp.monthBranch}）の生気`, evidence: [ev("tai", a), ev(spiritFact("shengQi"), sp.branch)] } : null;
    },
    assess: SIGN,
  },
  {
    id: "pregnancy.taiSiQi", when: { domain: "pregnancy", subtypes: MAI },
    reading: { axis: "obstruction", topic: "fetus", key: "taiSiQi", label: "胎神が月の死気（胎財死気。孕は育たないとする）", level: "direct",
      citations: [DQ("胎财死气损胎推"), DQ("但凡胎神作月内之死气，妇孕不育")] },
    conditions: (i) => {
      const a = dayTai(i), sp = i.monthlySpirits?.siQi;
      return a && sp && sp.branch === a
        ? { detected: `日干 ${dayStem(i)} の胎神 ${a}（${overcomes(dayStem(i), a) ? "胎財" : "胎鬼"}）が月（月支 ${sp.monthBranch}）の死気`, evidence: [ev("tai", a), ev(spiritFact("siQi"), sp.branch)] } : null;
    },
    assess: hin("古典の象意で、流産の予測ではない"),
  },
  {
    id: "pregnancy.motherWorryTianhou", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "obstruction", topic: "motherChild", key: "motherWorryTianhou", label: "天后（母）が月の死気（土）に乗り剋される（忧母格）", level: "direct",
      citations: [DQ("忧母格"), DQ("已上者，乃月内死气克天后也。如至产期，必忧母凶")] },
    conditions: (i) => {
      const q = riding(i, "天后"), sp = i.monthlySpirits?.siQi;
      return sp && q === sp.branch && el(q) === "土"
        ? { detected: `天后が月（月支 ${sp.monthBranch}）の死気 ${q}（土）に乗る（死気が天后〔水〕を剋す）`, evidence: [ev(spiritFact("siQi"), q), ev("天后", q)] } : null;
    },
    assess: hin("古典の象意で、母体の医学的な状態を示さない"),
  },
  {
    id: "pregnancy.twoBloodMaintain", when: { domain: "pregnancy", subtypes: MAI },
    reading: { axis: "obstruction", topic: "fetus", key: "twoBloodMaintain", label: "血支・血忌が養神（胎神を剋す）か胎神に並ぶ（生養神二血法。孕を占えば損とする）", level: "direct",
      citations: [DQ("生养神二血法：如丙丁戊已日，胎神在子，养神在丑。如在正月占，言血支、血忌皆在丑，并养神而克胎神，如占产，生速；如或占孕，有损无疑"),
        DQ("如在十二月占，言血支、血忌皆在子作胎神，如占产，亦生速；如占孕，亦防损"), DQ("已上血忌作空亡，或坐空乡，占孕占产，亦无防也")] },
    conditions: (i) => twoBlood(i),
    assess: (i) => (twoBloodVoid(i) ? { direction: "neutral", note: "血忌が旬空か坐空なので、古典は妨げないとする" } : { direction: "hindering", note: "古典の象意で、流産の予測ではない" }),
  },
  {
    id: "pregnancy.twoBloodDelivery", when: { domain: "pregnancy", subtypes: DEL },
    reading: { axis: "trajectory", topic: "progress", key: "twoBloodDelivery", label: "血支・血忌が養神（胎神を剋す）か胎神に並ぶ（生養神二血法。産を占えば生まれるのが速い）", level: "direct",
      citations: [DQ("生养神二血法：如丙丁戊已日，胎神在子，养神在丑。如在正月占，言血支、血忌皆在丑，并养神而克胎神，如占产，生速；如或占孕，有损无疑"),
        DQ("如在十二月占，言血支、血忌皆在子作胎神，如占产，亦生速；如占孕，亦防损"), DQ("已上血忌作空亡，或坐空乡，占孕占产，亦无防也")] },
    conditions: (i) => twoBlood(i),
    assess: (i) => (twoBloodVoid(i) ? { direction: "neutral", note: "血忌が旬空か坐空なので、古典は妨げないとする（速いとする読みも向きを決めない）" } : { direction: "favoring", note: "古典の象意で、出産の時期の予測・安全の保証ではない" }),
  },

  // ===================== 胎児の男女（吉凶と別。maintain・delivery） =====================
  {
    id: "pregnancy.sexStemUpper", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexStemUpper", label: "干上の陰陽（『直指』：陽は男・陰は女）", level: "direct",
      citations: [ZZ("日上神属阳为男，属阴为女")] },
    conditions: (i) => ({ detected: `干上 ${stemUpper(i)} が${isYangBranch(stemUpper(i)) ? "陽（古典は男とする）" : "陰（古典は女とする）"}`, evidence: [ev("lesson1", stemUpper(i))] }),
    assess: SEX,
  },
  {
    id: "pregnancy.sexWrap", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexWrap", label: "三伝の陰陽の包み（二陰が陽を包めば男・二陽が陰を包めば女）", level: "direct",
      citations: [ZZ("又三传阴包阳为男，阳包阴为女"), ZN("原文", "二阳包阴女衣裼，二阴包阳男衣裳")] },
    conditions: (i) => {
      const [a, b, c] = seqOf(i).map(isYangBranch);
      if (a !== c || a === b) return null;
      return { detected: `三伝 ${seqOf(i).join("")} が${a ? "二陽が陰を包む（古典は女とする）" : "二陰が陽を包む（古典は男とする）"}`, evidence: [ev("transmissions", seqOf(i).join(""))] };
    },
    assess: SEX,
  },
  {
    id: "pregnancy.sexStemUpperBi", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexStemUpperBi", label: "干上が日干と比和（剛日は男・柔日は女）", level: "direct",
      citations: [ZN("原文", "男女须观日上神，刚干阳比是男身。若逢阴比知为女，不比阴阳两处巡")] },
    conditions: (i) => (BRANCH_ELEMENT[stemUpper(i)] === STEM_ELEMENT[dayStem(i)] ? { detected: `干上 ${stemUpper(i)} が日干 ${dayStem(i)}（${yangStem(i) ? "剛日。古典は男とする" : "柔日。古典は女とする"}）と比和`, evidence: [ev("lesson1", stemUpper(i))] } : null),
    assess: SEX,
  },
  {
    id: "pregnancy.sexHarmony", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexHarmony", label: "三伝の三合が西北（金・水局は女）・東南（木・火局は男）", level: "direct",
      citations: [ZN("原文", "传合西北为弄瓦"), ZN("注", "即从革润下局"), ZN("原文", "传合东南定弄璋")] },
    conditions: (i) => {
      const s = seqOf(i), h = threeHarmonyOf([s[0], s[1], s[2]]);
      if (!h.complete || h.element === "土") return null;
      return { detected: `三伝 ${s.join("")} が${h.element}局（${h.element === "金" || h.element === "水" ? "西北。古典は女とする" : "東南。古典は男とする"}）`, evidence: [ev("threeHarmony", h.element)] };
    },
    assess: SEX,
  },
  {
    id: "pregnancy.sexInitialZeike", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexInitialZeike", label: "発用の課が上剋下（男）・下賊上（女）、剋賊がなければ日上二課（男）・辰上二課（女）", level: "combined",
      citations: [XJ("原文", "用神克下生男子"), XJ("注", "凡用神上克下为男，下贼上为妇。若无克贼，则日上之二课发用为男，辰上之二课发用为女")] },
    conditions: (i) => {
      const o = initialOriginOf(i.facts);
      if (!o || (o.kind !== "uniqueLesson" && o.kind !== "ruleLesson")) return null;
      const l = i.facts.lessons[o.lesson - 1];
      const male = l.zeike === "上剋" ? true : l.zeike === "下賊" ? false : o.lesson <= 2;
      return { detected: `発用が第${o.lesson}課（${l.zeike}）から出る（古典は${male ? "男" : "女"}とする）`, evidence: [ev("origin", `${o.lesson}課`)] };
    },
    assess: SEX,
  },
  {
    id: "pregnancy.sexMaoXing", when: { domain: "pregnancy", subtypes: MD },
    reading: { axis: "relation", topic: "sex", key: "sexMaoXing", label: "昴星課（剛日は女・柔日の虎視は男）", level: "direct",
      citations: [DQ("昴星格。刚日生女，或柔日虎视生男"), ZN("原文", "阴阳昴星两课举，阴俯是男阳仰女")] },
    conditions: (i) => (i.facts.sanchuan.method === "昴星" ? { detected: `昴星課で${yangStem(i) ? "剛日（古典は女とする）" : "柔日・虎視（古典は男とする）"}`, evidence: [ev("method", "昴星")] } : null),
    assess: SEX,
  },
];

/** 生養神二血法: 血支・血忌が同じ支で、それが養神（胎神を剋す）か胎神 */
function twoBlood(i: Input) {
  const a = dayTai(i), z = i.monthlySpirits?.xueZhi, j = i.monthlySpirits?.xueJi;
  if (!a || !z || !j || z.branch !== j.branch) return null;
  const yang = BRANCHES.find((b) => growthStageOf(STEM_ELEMENT[dayStem(i)], b) === "養")!;
  const where = z.branch === a ? "胎神" : z.branch === yang && overcomes(yang, a) ? "養神（胎神を剋す）" : null;
  return where ? { detected: `血支・血忌がともに ${z.branch}（月支 ${z.monthBranch}）で、日干 ${dayStem(i)} の${where}${twoBloodVoid(i) ? "。血忌が旬空か坐空" : ""}`,
    evidence: [ev(spiritFact("xueZhi"), z.branch), ev(spiritFact("xueJi"), j.branch), ev("tai", a)] } : null;
}
/** 『大全』「血忌作空亡，或坐空郷…亦無防」: 原文が坐空を明示するので、旬空と坐空（地盤が旬空）の両方で見る */
function twoBloodVoid(i: Input): boolean {
  const j = i.monthlySpirits?.xueJi;
  return !!j && (j.isVoid || isVoid(i, j.earthUnder));
}

/** 『心鏡』注の母（支）・子（干）を害する形 */
function harmTo(i: Input, who: "mother" | "child"): string[] {
  const s = stemUpper(i), z = siteUpper(i), out: string[] = [];
  const [from, toTarget, other] = who === "mother" ? [s, dayBranch(i), z] : [z, dayStem(i), s];
  const r = relOf(from, toTarget);
  if (has(r, "punishes", "harms", "overcomes")) out.push(`${who === "mother" ? "干上" : "支上"} ${from} が${who === "mother" ? "日支" : "日干"} ${toTarget} を${["punishes", "harms", "overcomes"].filter((k) => r.includes(k as StructuralRelation)).map((k) => ({ punishes: "刑", harms: "害", overcomes: "剋" } as Record<string, string>)[k]).join("・")}す`);
  if (other === "辰" || other === "戌") out.push(`${who === "mother" ? "支上" : "干上"}が魁罡（${other}）`);
  const g = general(i, other);
  if (g === "螣蛇" || g === "白虎") out.push(`${who === "mother" ? "支上" : "干上"}に${g}`);
  return out;
}
/** 害する上神がすべて旬空か（『心鏡』注「見空亡…不妨」） */
function harmVoided(i: Input, who: "mother" | "child"): boolean {
  const s = stemUpper(i), z = siteUpper(i);
  const [from, toTarget, other] = who === "mother" ? [s, dayBranch(i), z] : [z, dayStem(i), s];
  const ups = [has(relOf(from, toTarget), "punishes", "harms", "overcomes") ? from : null, other === "辰" || other === "戌" || ["螣蛇", "白虎"].includes(general(i, other)) ? other : null].filter((x): x is Branch => !!x);
  return ups.length > 0 && ups.every((b) => isVoid(i, b));
}

/** 本人と問う人の関係 */
export function pregnantRelationOf(context: InterpretationContext): "self" | "proxy" | "unknown" {
  if (context.pregnantPersonId === undefined || context.subjectPersonId === undefined) return "unknown";
  return context.pregnantPersonId === context.subjectPersonId ? "self" : "proxy";
}

type Sub = "conception" | "maintain" | "delivery";
const SUBJECT: Record<Sub, string> = { conception: "妊娠の兆候", maintain: "妊娠中の経過", delivery: "出産" };
const STAGES: Record<Sub, readonly { topic: string; label: string }[]> = {
  conception: [{ topic: "sign", label: "妊娠に関する古典的兆候" }],
  maintain: [{ topic: "relation", label: "古典の類神" }, { topic: "fetus", label: "胎に関する象意" }, { topic: "sex", label: "胎児の男女に関する古典の説（判定ではない）" }],
  delivery: [
    { topic: "relation", label: "古典の類神" }, { topic: "fetus", label: "胎に関する象意" }, { topic: "progress", label: "出産の進行に関する象意" },
    { topic: "motherChild", label: "母子に関する古典的象意" }, { topic: "sex", label: "胎児の男女に関する古典の説（判定ではない）" },
  ],
};
const HEAD = "【古典の読み】以下は、六壬の古典がこの盤の配置を妊娠・出産の占としてどう読むかの整理です。古典の日（子）・辰（母）・胎神・天后・六合は盤上の類神で、実際の人物（問う人・妊娠している本人・胎児）とは別に扱います。";
const TAIL = "【注意】古典に基づく歴史的な象意の解釈で、妊娠の有無・胎児の状態や性別・出産の安全性を判定するものではありません。確率・日時も出しません。医学的な判断は検査や医療専門職に確認してください。";

function stageLines(sub: Sub, readings: readonly DomainReading[], missing: readonly DomainMissingFact[]): string[] {
  const dir = (r: DomainReading) => (r.direction === "favoring" ? "追い風" : r.direction === "hindering" ? "妨げ" : "参考");
  const lines = STAGES[sub].map(({ topic, label }) => {
    const rs = readings.filter((r) => r.topic === topic);
    return `・${label}: ${rs.length ? rs.map((r) => `${r.detected}（${dir(r)}）`).join("。") : "この盤では資料に根拠のある読みがない（断定しない）"}`;
  });
  const conflicts: string[] = [];
  for (const { topic, label } of STAGES[sub]) {
    const rs = readings.filter((r) => r.topic === topic);
    if (rs.some((r) => r.direction === "favoring") && rs.some((r) => r.direction === "hindering")) conflicts.push(`${label}で追い風と妨げが併存`);
  }
  const sex = readings.filter((r) => r.topic === "sex");
  if (sex.some((r) => r.detected.includes("男とする")) && sex.some((r) => r.detected.includes("女とする"))) conflicts.push("男女の説が出典ごとに食い違う");
  lines.push(`・判断が相反する事項: ${conflicts.length ? `${conflicts.join("・")}（相殺しない）` : "なし"}`);
  lines.push(`・判断できない事項: ${missing.length ? `${missing.length}件（下の「未確定」。推測で補わない）` : "なし"}`);
  return lines;
}

/** 妊娠・出産の DOMAIN 判断（domain pregnancy・childbirth） */
export function evaluatePregnancyDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "pregnancy" && context.domain !== "childbirth") throw new Error(`妊娠・出産以外の DOMAIN です: ${context.domain}`);
  const raw = context.subtype ?? "general";
  const sub: Sub | null = context.domain === "pregnancy" ? (raw === "conception" || raw === "maintain" ? raw : null) : raw === "delivery" ? "delivery" : null;
  if (!sub) {
    return summarizeDomainReadings(context.domain, context.subtype, context.goal, [],
      [{ key: "subtype", detail: context.domain === "pregnancy" ? "問いの種類（妊娠の兆候 conception・妊娠中の経過 maintain）が未指定なので判断しない" : "問いの種類（出産 delivery）が未指定なので判断しない" }], "妊娠・出産");
  }
  const rel = pregnantRelationOf(context);
  const who = [
    rel === "self" ? "問う人本人が妊娠・出産の当事者" : rel === "proxy" ? "代理の問い（当事者は問う人と別の人物）" : "当事者が問う人本人かどうかは未指定",
    "胎児は人物として扱わず、古典の類神（日・胎神・六合）で読む",
  ].join("・");
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  const own = missing.filter((x) => x.key !== "natalYear" && x.key !== "taiSui");
  const wrap = (r: DomainResult): DomainResult => ({ ...r, summary: [HEAD, `人物: ${who}。`, "段階ごとの読み:", ...stageLines(sub, r.readings, r.missing), r.summary, TAIL].join("\n") });
  if (!input) return wrap(summarizeDomainReadings(context.domain, context.subtype, context.goal, [], missing, SUBJECT[sub]));
  if (!dayTai(input)) own.push({ key: "taiEarth", detail: "戊己日は胎神が子か午か資料で二説ある（『大全』「或有用午為胎神者也，不可不知」）ので、胎神の規則は判断しない" });
  if (context.goal) own.push({ key: "goal", detail: `goal（${context.goal}）は妊娠・出産の向きに使わない（目的で古典の読みを変えない）` });
  own.push({ key: "shenSha", detail: "生神・天狱・劫煞などの神煞と、行年を使う規則（『心鏡』の婦の行年など）、忧子格（「加申」が乗神か地盤か未確定）、『心鏡』「或見生神，血支血忌天喜則易生」（生神は Phase 5M）、『直指』「占孕要看生氣」・『指南』「蛇夾月厭」（見る位置が未確定）、月厭煞（「母年命」が本命だけか行年を含むか未確定）、小產法・夫妻の年命が胎神を冲剋は未対応" });
  if (sub === "conception" && !taiOf(el(dayBranch(input)))) own.push({ key: "taiEarthBranch", detail: "日支が土なので日支の胎神が資料の二説（子・午）で決まらず、互胎格は判断しない" });
  if (sub === "conception") own.push({ key: "conceptionScope", detail: "妊娠の兆候は『大全』の互胎格・腹胎格・胎財生気格だけで読む（『直指』「占孕要看生氣」は見る位置が書かれていないので読まない）。子孫があるだけでは妊娠としない" });
  if (sub !== "conception") own.push(
    { key: "unresolved", detail: "意味や見る位置が資料で確定しない句（伏吟無丁・天后六合不可臨凶處・純陰課・胎乘鬼死・胎加生方・兩儀夾傳・恋胎五等・干支交車の双生・陰陽不備の男女・『大全』の胎受克絶格（日干で吉凶が分かれる）・胎神坐長生・夾定三傳・三玄胎）は保留" },
    { key: "noTiming", detail: "受胎の時期・産期（胜光所臨・冲胎・生養之下）・陣痛や出産の時刻、双胎の判断、私妊の象意は出さない" },
  );
  if (sub === "delivery") own.push({ key: "presentation", detail: "胎位（頭先・足先。『直指』「傳順貴順頭先出」・『指南』「卯戌相加」）は三伝の順逆の定義が確定せず、医学的な判定と誤認されやすいので出さない" });
  // 規則表は妊娠・出産で1つ（when.domain は "pregnancy"）。妊娠・出産のどちらの規則かは占的（subtype）で分ける
  if (!input.monthlySpirits) own.push({ key: "monthBranch", detail: "月支がないので、月建の神煞（生気・死気・血支・血忌）を使う格は判断しない" });
  const readings = evaluateDomainRules(PREGNANCY_RULES, input, "pregnancy", sub, context.goal);
  const r = summarizeDomainReadings(context.domain, context.subtype, context.goal, readings, own, SUBJECT[sub]);
  return wrap({ ...r, summary: [r.summary, ...monthlySpiritSummaryLines(readings, input.monthlySpirits, monthBranch, PREGNANCY_SPIRIT_UNRESOLVED[sub])].join("\n") });
}

/** 妊娠・出産で神煞を使うが判断しない句（Phase 5L） */
const PREGNANCY_SPIRIT_UNRESOLVED: Record<Sub, readonly string[]> = {
  conception: ["『直指』「占孕要看生氣」は見る位置が書かれていないので読まない", "戊己日は胎神が子・午の二説で決まらないので、胎神を使う格は判断しない"],
  maintain: ["『指南』「蛇夾月厭」は「夾」の位置が確定しないので読まない", "戊己日は胎神が子・午の二説で決まらないので、胎神を使う格は判断しない"],
  delivery: ["忧子格「六合三月占加申」は「加」が六合の乗神か地盤かが確定しないので読まない",
    "月厭煞「申加母年命上」は、同じ節が「夫妻之行年本命」と行年・本命を分けて書くので、「母年命」が本命だけか行年を含むかが確定せず読まない", "『心鏡』「或見生神，血支血忌天喜則易生」は生神（『心鏡』の起例）を Phase 5M で扱うまで読まない", "戊己日は胎神が子・午の二説で決まらないので、胎神を使う格は判断しない"],
};

/** 監査用: ルールの一覧 */
export const PREGNANCY_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = PREGNANCY_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
