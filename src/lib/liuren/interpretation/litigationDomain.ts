// src/lib/liuren/interpretation/litigationDomain.ts
//
// 役割（Phase 5G）:
//   訴訟・争い（litigation）の DOMAIN 判断。古典がこの盤の配置をどう読むかを、占的（subtype）ごとに並べる。
//     litigation … 官に訴える訴訟・裁判。『大六壬指南』占訟章第十八（歌訣・割注）、『六壬心鏡』巻六 官訟門（本歌・郇注・引『入式』）、
//                  『六壬大全』（卷八 殃咎課・卷九・卷十 毕法賦・鬼墓課・逆十二格の「占訟」の句）、『六壬神課講座』p55
//     dispute    … 当事者間の争い。古典の「訟」は官に訴える争いなので、主客の輸贏・官府・勾陳朱雀の規則は当てはめず、
//                  『大全』で「凡占」「諸占」として書かれた規則（三伝遞克・三伝内戦・賓主不投・彼此全傷）だけで読む
//     settlement … 和解・争いの収束。『心鏡』官訟門の勾陳と日辰（兩和・兩敗）、『大全』の首尾相見・用墓加長生・賓主不投
//     general    … 問いの種類が未指定。判断せず不足を返す
//   『御定六壬直指』には詞訟の章がない（卷上の課ごとの「争訟」は課ごとの判断で、条件の規則ではないので使わない）。
//
//   段階（topic）を分けて持ち、ある段階の読みから他の段階を断定しない:
//     relation（当事者の役割・関係）・outbreak（争いが生じる兆候）・escalation（激化）・advantage（当事者間の優劣）・
//     verdict（勝敗に関する古典的判断）・progress（訴訟の進展・官府）・settlement（和解・収束）・loss（争いによる損失）・
//     prolong（長期化・停滞）・symbol（象意）
//   官鬼が現れることだけで訴訟の発生・敗訴としない（symbol は向きを決めない）。
//
//   人物（古典の役割と、実際の人物の Identity を分ける）:
//     古典の主客は『指南』「日為客，辰為主，先動為客後應為主」、『心鏡』《入式》注「以日干為尊為客，支神為卑為主。若外人論其先後，
//     以日干為客，乃先起之人；支辰為主，乃後對之人」。当事者（context.litigantPersonId）が客・主のどちらかは
//     context.litigationStanding の先後（precedence）・尊卑（rank）で指定し、推測しない。先後と尊卑は別の原典方式として持ち、
//     『指南』の規則は先後だけ、『心鏡』の規則は先後・尊卑で決める。両方あって食い違えば一方を優先せず向きを決めない。
//     現実の原告・被告（legalPosition）を主客に対応させない。
//     六親（官鬼・子孫など）は日干から見るが、それだけで客の読みとしない。原文が日・客・主を名指す規則だけ主客の向きを決める。
//     官府・仲裁者を天乙・勾陳・朱雀などの特定の位置に固定しない。
//
//   向き:
//     主客についての読み … 当事者の立場があれば、当事者の側なら有利・不利、相手側の輸贏（verdict）なら逆向き、
//                          相手側のそれ以外の読みは向きを決めない。立場がなければ向きを決めない
//     双方に及ぶ読み     … 立場によらず同じ向き（彼此全傷など）
//     発生・激化・長期化・収束 … goal（avoid＝争いを避けたい・reconcile＝和解したい・release＝早く終えたい）のときだけ向きを決める。
//                          それ以外（acquire＝有利な結果を得たい・未指定）では勝敗と別なので向きを決めない
//   空亡は旬空だけ。坐空は保留（不足に出す）。判決の結果・勝訴の見込み・賠償額・判決日・刑罰は出さない。

import { BRANCH_ELEMENT, STEM_ELEMENT } from "../constants";
import type { Branch, Element, HeavenlyGeneral, SixRelation } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainReading, DomainResult, DomainRule } from "./domainResult";
import { relationBetween } from "./relations";
import type { InterpretationContext, InterpretationGoal } from "./roles";
import { rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type { InterpretationFacts, SeasonalStrength, StructuralRelation, TransmissionPosition } from "./types";

type Standing = NonNullable<InterpretationContext["litigationStanding"]>;
interface Input extends DomainBoardInput {
  month: Branch | null;
  /** 当事者の古典の主客の立場（なければ null） */
  standing: Standing | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

const ZN = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『大六壬指南』", locator: "占訟章第十八", layer, quote });
/** 『指南』占訟章の古典占験（陳公獻の占例）の断・割注 */
const ZNC = (n: string, layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『大六壬指南』", locator: `占訟章第十八 占験${n}`, layer, quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻六 官訟門", layer, quote });
const DQ = (locator: string, quote: string): DomainCitation => ({ source: "『六壬大全』", locator, layer: "原文", quote });
const KZ = (locator: string, quote: string): DomainCitation => ({ source: "『六壬神課講座』", locator, layer: "講座", quote });
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
/** その天将が乗る天盤支（乗神） */
const riding = (i: Input, g: HeavenlyGeneral): Branch => (Object.keys(i.facts.generals.generalOn) as Branch[]).find((b) => i.facts.generals.generalOn[b] === g)!;
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);
const under = (i: Input, b: Branch) => i.facts.plate.earthUnder[b];
const on = (i: Input, b: Branch) => i.facts.plate.heavenOn[b];
const el = (b: Branch): Element => BRANCH_ELEMENT[b];
const seasonal = (i: Input, e: Element): SeasonalStrength | null => (i.month ? seasonalStrengthOf(e, rulingElementOfMonth(i.month)) : null);
const relIn = (i: Input, rel: SixRelation) => TRANSMISSIONS.filter((p) => t(i, p).sixRelation === rel);
const BRANCHES: readonly Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const shift = (b: Branch, n: number) => BRANCHES[(BRANCHES.indexOf(b) + n + 12) % 12];

// ---- 向き ----
type Party = "guest" | "host" | "both";
const PARTY_LABEL: Record<"guest" | "host", string> = { guest: "客（日）", host: "主（辰）" };
/**
 * 主客の方式。原典ごとに別の方式として持ち、一方を優先して自動で決めない。
 *   precedence … 先後（『指南』「先動為客後應為主」。『心鏡』《入式》注「若外人論其先後」）
 *   rank       … 尊卑（『心鏡』《入式》注「先論尊卑主客，以日干為尊為客，支神為卑為主」。『指南』にはない）
 */
type Method = "precedence" | "rank";
/** 『指南』の規則は先後だけ、『心鏡』の規則は先後・尊卑のどちらでもよい */
const ZN_METHODS: readonly Method[] = ["precedence"], XJ_METHODS: readonly Method[] = ["precedence", "rank"];
/**
 * 当事者の古典の側。規則の原典が使う方式の情報だけで決める。指定された方式どうしで客・主が食い違えば決めない（null）
 */
const sideOf = (i: Input, methods: readonly Method[]): { side: "guest" | "host" | null; why: string } => {
  const s = i.standing;
  const got: ("guest" | "host")[] = [];
  if (methods.includes("precedence") && s?.precedence) got.push(s.precedence === "initiator" ? "guest" : "host");
  if (methods.includes("rank") && s?.rank) got.push(s.rank === "senior" ? "guest" : "host");
  if (!got.length) return { side: null, why: methods.length === 1 ? "この規則の原典（『指南』）の主客は先後だけで決まり、先後（litigationStanding.precedence）がない" : "先後・尊卑（litigationStanding）がない" };
  if (got.some((x) => x !== got[0])) return { side: null, why: "先後と尊卑で客・主が食い違う（一方を優先して決めない）" };
  return { side: got[0], why: "" };
};
/**
 * 主客についての読みの向き。good＝その側に有利な読み。verdict＝輸贏（勝敗）の読み（相手側の輸は当事者の贏として逆向きにする）。
 * methods＝その規則の原典が使う主客の方式
 */
const partyAssess = (party: Party, good: boolean, verdict: boolean, methods: readonly Method[]) => (i: Input): { direction: DomainDirection; note?: string } => {
  if (party === "both") return { direction: good ? "favoring" : "hindering", note: "主客の双方に及ぶ読み（当事者の立場によらない）" };
  const { side, why } = sideOf(i, methods);
  if (!side) return { direction: "neutral", note: `${why}ので向きを決めない（古典は${PARTY_LABEL[party]}に${good ? "有利" : "不利"}とする）` };
  if (side === party) return { direction: good ? "favoring" : "hindering", note: `当事者は${PARTY_LABEL[side]}` };
  if (verdict) return { direction: good ? "hindering" : "favoring", note: `相手側（${PARTY_LABEL[party]}）についての輸贏の読み` };
  return { direction: "neutral", note: `相手側（${PARTY_LABEL[party]}）についての読みで、当事者の有利・不利を直接いわない` };
};
/** 発生・激化・長期化・収束の向き（goal が avoid・reconcile・release のときだけ） */
const SETTLE_GOALS: readonly InterpretationGoal[] = ["avoid", "reconcile", "release"];
const processAssess = (bad: boolean) => (_i: Input, _s: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  goal && SETTLE_GOALS.includes(goal)
    ? { direction: bad ? "hindering" : "favoring", note: `goal（${goal}）に対して` }
    : { direction: "neutral", note: "争いの発生・激化・長期化・収束は勝敗とは別なので、goal（avoid・reconcile・release）がなければ向きを決めない" };
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });
/** 原文が誰の有利・不利かを示さない読み（六親は日干から見るが、それだけで客の読みとしない） */
const NO_PARTY = neutral("原文は主客のどちらの有利・不利かを示さないので向きを決めない（六親が日干から見たものというだけで客の読みとしない）");
const LIT = ["litigation"], DIS = ["litigation", "dispute"], SET = ["litigation", "settlement"], ALL3 = ["litigation", "dispute", "settlement"];

// ---- 個別の盤の形 ----
/** 主客の一方についての読みの対象（日干・日支のどちらか・両方） */
const partyOf = (guest: boolean, host: boolean): Party | null => (guest && host ? "both" : guest ? "guest" : host ? "host" : null);
const partyText = (p: Party) => (p === "both" ? "日干・日支の両方" : p === "guest" ? `日干` : `日支`);
/** 勾陳の乗神と日干・日支の剋 */
const gouOf = (i: Input) => {
  const g = riding(i, "勾陳");
  return { g, toStem: overcomes(g, dayStem(i)), toBranch: overcomes(g, dayBranch(i)), fromStem: overcomes(dayStem(i), g), fromBranch: overcomes(dayBranch(i), g) };
};
/** 『大全』卷八 殃咎課の三伝遞克（初→中→末→日干、または末→中→初→日干） */
const diKe = (i: Input) => {
  const [a, b, c] = seqOf(i);
  if (overcomes(a, b) && overcomes(b, c) && overcomes(c, dayStem(i))) return `初伝 ${a} が中伝 ${b} を、中伝が末伝 ${c} を、末伝が日干 ${dayStem(i)} を剋す`;
  if (overcomes(c, b) && overcomes(b, a) && overcomes(a, dayStem(i))) return `末伝 ${c} が中伝 ${b} を、中伝が初伝 ${a} を、初伝が日干 ${dayStem(i)} を剋す`;
  return null;
};
/** 『大全』卷十 賓主不投（干支上・四課・三伝の刑の三等） */
const SELF_PUNISH: readonly Branch[] = ["辰", "午", "酉", "亥"];
const binZhu = (i: Input) => {
  const uppers = i.facts.lessons.map((l) => l.upper);
  const s = new Set(seqOf(i));
  const out: string[] = [];
  if (uppers.every((u) => SELF_PUNISH.includes(u))) out.push(`四課の上神 ${uppers.join("")} がすべて辰・午・酉・亥（一字刑）`);
  const pair = [stemUpper(i), siteUpper(i)].sort().join("");
  if (pair === ["子", "卯"].sort().join("")) out.push(`干上 ${stemUpper(i)}・支上 ${siteUpper(i)} が子と卯（二字刑）`);
  if (s.size === 3 && (["寅", "巳", "申"].every((b) => s.has(b as Branch)) || ["丑", "戌", "未"].every((b) => s.has(b as Branch)))) out.push(`三伝 ${seqOf(i).join("")} が三字刑`);
  return out;
};
/** 旬首・旬尾（旬首の支から9つ先） */
const xunHeadBranch = (i: Input) => i.facts.xun.xunHead[1] as Branch;
/** 『大全』鬼墓課「用墓加長生」の墓と長生（「未加亥，戌加寅，丑加巳，辰加申」）。土は墓の方式が資料で分かれるので持たない */
const TOMB_ON_GROWTH: Partial<Record<Element, { tomb: Branch; growth: Branch }>> = {
  木: { tomb: "未", growth: "亥" }, 火: { tomb: "戌", growth: "寅" }, 金: { tomb: "丑", growth: "巳" }, 水: { tomb: "辰", growth: "申" },
};

const LITIGATION_RULES: readonly Rule[] = [
  // ===================== 役割・象意 =====================
  {
    id: "litigation.roles", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "relation", topic: "relation", key: "roles", label: "訴訟の古典の主客（日＝客・辰＝主）", level: "direct",
      citations: [ZN("原文", "占讼日辰分主客"), ZN("注", "日为客，辰为主，先动为客后应为主"), XJ("原文", "论讼四般看胜负，尊卑先后各区分"),
        XJ("注", "以日干为尊为客，支神为卑为主。若外人论其先后，以日干为客，乃先起之人；支辰为主，乃后对之人")] },
    conditions: (i) => ({ detected: `日干 ${dayStem(i)} が客（先に動いた側・尊）、日支 ${dayBranch(i)} が主（後で応じた側・卑）`, evidence: [ev("dayStem", dayStem(i)), ev("dayBranch", dayBranch(i))] }),
    assess: neutral("役割の対応で、吉凶の判断ではない（現実の原告・被告とは対応させない）"),
  },
  {
    id: "litigation.symbol", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "opportunity", topic: "symbol", key: "ghostSymbol", label: "官鬼（裁判の象意）が課伝に現れる", level: "direct",
      citations: [KZ("p55", "裁判、盗難、危険物、死体、病気、怪異、苦労")] },
    conditions: (i) => {
      const ls = i.facts.lessons.filter((l) => l.relation === "官鬼").map((l) => `${l.index}課 ${l.upper}`);
      const ps = relIn(i, "官鬼").map((p) => `${LABEL[p]} ${t(i, p).branch}`);
      return ls.length || ps.length ? { detected: `${[...ls, ...ps].join("・")} が官鬼`, evidence: [ev("sixRelation", "官鬼")] } : null;
    },
    assess: neutral("官鬼の象意は裁判のほか盗難・病気などにもわたり、現れるだけでは訴訟の発生・敗訴としない"),
  },

  // ===================== 『指南』占訟章：主客の輸贏 =====================
  {
    id: "litigation.stemUpperGhost", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "advantage", key: "stemUpperGhost", label: "干上に官鬼（客に不利）", level: "direct",
      citations: [ZN("原文", "课传官鬼断输赢"), ZN("注", "日上有鬼不利客")] },
    conditions: (i) => (i.facts.lessons[0].relation === "官鬼" ? { detected: `干上 ${stemUpper(i)} が日干 ${dayStem(i)} の官鬼`, evidence: [ev("lesson1", stemUpper(i))] } : null),
    assess: partyAssess("guest", false, false, ZN_METHODS),
  },
  {
    id: "litigation.initialOvercomesStem", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "actualization", topic: "verdict", key: "initialOvercomesStem", label: "発用が日を剋す（客が輸ける）", level: "direct",
      citations: [ZN("注", "发用克日客输")] },
    conditions: (i) => (overcomes(t(i, "initial").branch, dayStem(i)) ? { detected: `初伝 ${t(i, "initial").branch} が日干 ${dayStem(i)} を剋す`, evidence: [ev("initial", t(i, "initial").branch)] } : null),
    assess: partyAssess("guest", false, true, ZN_METHODS),
  },
  {
    id: "litigation.initialOvercomesBranch", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "actualization", topic: "verdict", key: "initialOvercomesBranch", label: "発用が辰を剋す（主が輸ける）", level: "direct",
      citations: [ZN("注", "发用克日客输，克辰主输")] },
    conditions: (i) => (overcomes(t(i, "initial").branch, dayBranch(i)) ? { detected: `初伝 ${t(i, "initial").branch} が日支 ${dayBranch(i)} を剋す`, evidence: [ev("initial", t(i, "initial").branch)] } : null),
    assess: partyAssess("host", false, true, ZN_METHODS),
  },
  {
    id: "litigation.crossOvercome", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "advantage", key: "crossOvercome", label: "干支の上下が交互に剋す（剋される側に不利）", level: "combined",
      citations: [ZN("注", "如干支上神受克及干支上下交互相克亦然")] },
    conditions: (i) => {
      const a = overcomes(stemUpper(i), dayBranch(i)), b = overcomes(siteUpper(i), dayStem(i));
      if (!a && !b) return null;
      return { detected: [a ? `干上 ${stemUpper(i)} が日支 ${dayBranch(i)} を剋す` : "", b ? `支上 ${siteUpper(i)} が日干 ${dayStem(i)} を剋す` : ""].filter(Boolean).join("・"),
        evidence: [ev("cross", `${stemUpper(i)}→${dayBranch(i)}・${siteUpper(i)}→${dayStem(i)}`)] };
    },
    assess: (i) => partyAssess(partyOf(overcomes(siteUpper(i), dayStem(i)), overcomes(stemUpper(i), dayBranch(i)))!, false, false, ZN_METHODS)(i),
  },
  {
    id: "litigation.childrenControlGhost", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "support", topic: "advantage", key: "childrenControlGhost", label: "三伝に官鬼と子孫（子孫が鬼を制し、患に救いがある）", level: "direct",
      citations: [ZN("原文", "子孙制鬼患有救")] },
    conditions: (i) => {
      const g = relIn(i, "官鬼"), c = relIn(i, "子孫");
      return g.length && c.length ? { detected: `${g.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")}（官鬼）と ${c.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")}（子孫）が三伝にある`, evidence: [ev("sixRelation", "官鬼・子孫")] } : null;
    },
    assess: NO_PARTY,
  },
  {
    id: "litigation.finalGeneratesInitialGhost", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "advantage", key: "finalGeneratesInitialGhost", label: "末伝が初伝の官鬼を生ず（忌む）", level: "direct",
      citations: [ZN("原文", "末初三般仔细论"), ZN("注", "忌末生初鬼")] },
    conditions: (i) => (t(i, "initial").sixRelation === "官鬼" && generates(t(i, "final").branch, t(i, "initial").branch)
      ? { detected: `末伝 ${t(i, "final").branch} が初伝 ${t(i, "initial").branch}（官鬼）を生ず`, evidence: [ev("final→initial", "生")] } : null),
    assess: NO_PARTY,
  },
  {
    id: "litigation.tigerGhostHorse", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "loss", key: "tigerGhostHorse", label: "驛馬が白虎・官鬼を載せる（禍が頻り）", level: "direct",
      citations: [ZN("原文", "虎鬼乘骐"), ZN("注", "即马载虎鬼")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => t(i, p).isYima && t(i, p).sixRelation === "官鬼" && general(i, t(i, p).branch) === "白虎");
      return ps.length ? { detected: `${ps.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")} が驛馬・官鬼で白虎が乗る`, evidence: [ev("yima", ps.map((p) => t(i, p).branch).join(""))] } : null;
    },
    assess: NO_PARTY,
  },
  {
    id: "litigation.zhuGouOvercomeStem", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "advantage", key: "zhuGouOvercomeStem", label: "朱雀・勾陳の乗神が日干を剋す（訴えを興すべきでない）", level: "combined",
      citations: [ZN("原文", "朱勾克日莫兴词，妄举轻为自投死"), ZNC("十七", "注", "勾乘卯生日干丁")] },
    conditions: (i) => {
      const gs = (["朱雀", "勾陳"] as const).filter((g) => overcomes(riding(i, g), dayStem(i)));
      return gs.length ? { detected: `${gs.map((g) => `${g}の乗神 ${riding(i, g)}`).join("・")} が日干 ${dayStem(i)} を剋す`, evidence: [ev("general", gs.join("・"))] } : null;
    },
    assess: partyAssess("guest", false, false, ZN_METHODS),
  },
  {
    id: "litigation.zhuGouGenerateStem", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "support", topic: "advantage", key: "zhuGouGenerateStem", label: "朱雀・勾陳の乗神が日干を生ず（審理で冤が晴れる）", level: "combined",
      citations: [ZN("原文", "二将若也生日干，勘官昭雪人欣喜"), ZNC("十七", "注", "勾乘卯生日干丁")] },
    conditions: (i) => {
      const gs = (["朱雀", "勾陳"] as const).filter((g) => generates(riding(i, g), dayStem(i)));
      return gs.length ? { detected: `${gs.map((g) => `${g}の乗神 ${riding(i, g)}`).join("・")} が日干 ${dayStem(i)} を生ず`, evidence: [ev("general", gs.join("・"))] } : null;
    },
    assess: partyAssess("guest", true, false, ZN_METHODS),
  },
  {
    id: "litigation.gouTigerOvercomeStem", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "loss", key: "gouTigerOvercomeStem", label: "勾陳・白虎の乗神がともに日干を剋す（刑を受ける）", level: "combined",
      citations: [ZN("原文", "勾陈白虎同克日，犯法之人遭刑戮")] },
    conditions: (i) => (overcomes(riding(i, "勾陳"), dayStem(i)) && overcomes(riding(i, "白虎"), dayStem(i))
      ? { detected: `勾陳の乗神 ${riding(i, "勾陳")}・白虎の乗神 ${riding(i, "白虎")} がともに日干 ${dayStem(i)} を剋す`, evidence: [ev("general", "勾陳・白虎")] } : null),
    assess: partyAssess("guest", false, false, ZN_METHODS),
  },
  {
    id: "litigation.tigerHeadSnakeTail", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "support", topic: "loss", key: "tigerHeadSnakeTail", label: "初伝に白虎・末伝に螣蛇（虎頭蛇尾。禍が凶とならない）", level: "direct",
      citations: [ZN("原文", "虎头蛇尾"), ZN("注", "初虎末蛇"), ZN("原文", "祸不凶")] },
    conditions: (i) => (general(i, t(i, "initial").branch) === "白虎" && general(i, t(i, "final").branch) === "螣蛇"
      ? { detected: `初伝 ${t(i, "initial").branch} に白虎、末伝 ${t(i, "final").branch} に螣蛇`, evidence: [ev("generals", "白虎…螣蛇")] } : null),
    assess: partyAssess("both", true, false, []),
  },
  {
    id: "litigation.zhuInGou", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "trajectory", topic: "escalation", key: "zhuInGou", label: "午が辰に加わる（雀入勾郷。訟が最も重い）", level: "direct",
      citations: [ZN("原文", "雀入勾乡"), ZN("注", "午加辰也"), ZN("注", "事情重大"), DQ("卷十 毕法赋", "朱勾相会格，如丙辰，乃朱雀入勾陈，必有非细之讼")] },
    conditions: (i) => (on(i, "辰") === "午" ? { detected: "天盤の午が地盤の辰に加わる", evidence: [ev("plate", "午加辰")] } : null),
    assess: processAssess(true),
  },
  {
    id: "litigation.zhuOvercomesTaiSui", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "trajectory", topic: "escalation", key: "zhuOvercomesTaiSui", label: "朱雀の乗神が太歳を剋す（岁君を犯す）", level: "combined",
      citations: [ZN("原文", "若犯岁君坐死推"), ZN("注", "朱雀克太岁也"), ZNC("三", "原文", "赤鸟犯岁君"), ZNC("三", "注", "朱雀戌克太岁子也")] },
    conditions: (i) => (i.taiSuiBranch && overcomes(riding(i, "朱雀"), i.taiSuiBranch)
      ? { detected: `朱雀の乗神 ${riding(i, "朱雀")} が太歳 ${i.taiSuiBranch} を剋す`, evidence: [ev("taiSui", i.taiSuiBranch)] } : null),
    assess: processAssess(true),
  },
  {
    id: "litigation.taiSuiNoble", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "support", topic: "advantage", key: "taiSuiNoble", label: "太歳が貴人に乗り日干を生ず（恩星。罪が重くても軽くなる）", level: "combined",
      citations: [ZN("原文", "太岁贵人作恩星"), ZN("注", "谓生日也"), ZN("原文", "罪虽至重还轻逐")] },
    conditions: (i) => (i.taiSuiBranch && riding(i, "貴人") === i.taiSuiBranch && generates(i.taiSuiBranch, dayStem(i))
      ? { detected: `太歳 ${i.taiSuiBranch} に貴人が乗り、日干 ${dayStem(i)} を生ず`, evidence: [ev("taiSui", i.taiSuiBranch)] } : null),
    assess: partyAssess("guest", true, false, ZN_METHODS),
  },

  // ===================== 『心鏡』官訟門 =====================
  {
    id: "litigation.restDeath", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "advantage", key: "restDeath", label: "日干・日支が月令に休（その側が罪を受ける。休墓死のうち休だけ）", level: "combined",
      citations: [XJ("注", "凡自逢休墓死者，皆遭罪")] },
    conditions: (i) => {
      const a = seasonal(i, STEM_ELEMENT[dayStem(i)]), b = seasonal(i, el(dayBranch(i)));
      const ga = a === "休", hb = b === "休";
      return ga || hb ? { detected: [ga ? `日干 ${dayStem(i)} が月令に${a}` : "", hb ? `日支 ${dayBranch(i)} が月令に${b}` : ""].filter(Boolean).join("・"), evidence: [ev("seasonal", `${a}・${b}`)] } : null;
    },
    assess: (i) => {
      const a = seasonal(i, STEM_ELEMENT[dayStem(i)]), b = seasonal(i, el(dayBranch(i)));
      return partyAssess(partyOf(a === "休", b === "休")!, false, false, XJ_METHODS)(i);
    },
  },
  {
    id: "litigation.gouOvercomes", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "actualization", topic: "verdict", key: "gouOvercomes", label: "勾陳の乗神が日干（客が敗れる）・日支（主が敗れる）を剋す", level: "combined",
      citations: [XJ("原文", "如来克日难分诉"), XJ("注", "克日干客败，勾陈克支辰主败")] },
    conditions: (i) => {
      const g = gouOf(i), p = partyOf(g.toStem, g.toBranch);
      return p ? { detected: `勾陳の乗神 ${g.g} が${partyText(p)}を剋す`, evidence: [ev("勾陳", g.g)] } : null;
    },
    assess: (i) => { const g = gouOf(i); return partyAssess(partyOf(g.toStem, g.toBranch)!, false, true, XJ_METHODS)(i); },
  },
  {
    id: "litigation.dayOvercomesGou", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "actualization", topic: "verdict", key: "dayOvercomesGou", label: "日干が勾陳の乗神を剋す（訟が必ず聴かれる）", level: "combined",
      citations: [XJ("原文", "日克勾陈讼必听")] },
    conditions: (i) => (gouOf(i).fromStem ? { detected: `日干 ${dayStem(i)} が勾陳の乗神 ${gouOf(i).g} を剋す`, evidence: [ev("勾陳", gouOf(i).g)] } : null),
    assess: partyAssess("guest", true, true, XJ_METHODS),
  },
  {
    id: "litigation.gouOvercomesBoth", when: { domain: "litigation", subtypes: SET },
    reading: { axis: "trajectory", topic: "settlement", key: "gouOvercomesBoth", label: "勾陳の乗神が日干・日支をともに剋す（両敗。訟が息みにくい）", level: "combined",
      citations: [XJ("注", "若勾陈克日辰，主两败，讼难息")] },
    conditions: (i) => (gouOf(i).toStem && gouOf(i).toBranch ? { detected: `勾陳の乗神 ${gouOf(i).g} が日干 ${dayStem(i)}・日支 ${dayBranch(i)} をともに剋す`, evidence: [ev("勾陳", gouOf(i).g)] } : null),
    assess: processAssess(true),
  },
  {
    id: "litigation.bothOvercomeGou", when: { domain: "litigation", subtypes: SET },
    reading: { axis: "actualization", topic: "settlement", key: "bothOvercomeGou", label: "日干・日支がともに勾陳の乗神を剋す（両和して争わない）", level: "combined",
      citations: [XJ("注", "若日辰并克勾陈，两和不争讼，事得伸也")] },
    conditions: (i) => (gouOf(i).fromStem && gouOf(i).fromBranch ? { detected: `日干 ${dayStem(i)}・日支 ${dayBranch(i)} がともに勾陳の乗神 ${gouOf(i).g} を剋す`, evidence: [ev("勾陳", gouOf(i).g)] } : null),
    assess: processAssess(false),
  },
  {
    id: "litigation.gouYinNoble", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "support", topic: "advantage", key: "gouYinNoble", label: "勾陳の陰神に天乙が乗り日干を生ず（貴人が救う）", level: "combined",
      citations: [XJ("原文", "勾阴若是为天乙，生其系日放疏情"), XJ("注", "若勾陈之阴神作天乙，复生日干者")] },
    conditions: (i) => {
      const y = on(i, riding(i, "勾陳"));
      return general(i, y) === "貴人" && generates(y, dayStem(i)) ? { detected: `勾陳の乗神 ${riding(i, "勾陳")} の陰神 ${y} に貴人が乗り、日干 ${dayStem(i)} を生ず`, evidence: [ev("勾陳陰神", y)] } : null;
    },
    assess: partyAssess("guest", true, false, XJ_METHODS),
  },
  {
    id: "litigation.gouTigerWeak", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "opportunity", topic: "progress", key: "gouTigerWeak", label: "勾陳・白虎がともに囚死で、日辰が旺相（書を献じて陳情できる）", level: "combined",
      citations: [XJ("原文", "勾虎二神俱不旺，日辰有气献书呈"), XJ("注", "勾虎二神俱囚死，更在无气之乡，不能为害。若日辰俱旺，更在有气之乡，可进状陈情雪冤")] },
    conditions: (i) => {
      const g = seasonal(i, el(riding(i, "勾陳"))), h = seasonal(i, el(riding(i, "白虎")));
      const a = seasonal(i, STEM_ELEMENT[dayStem(i)]), b = seasonal(i, el(dayBranch(i)));
      const dead = (s: SeasonalStrength | null) => s === "囚" || s === "死", up = (s: SeasonalStrength | null) => s === "旺" || s === "相";
      return dead(g) && dead(h) && up(a) && up(b)
        ? { detected: `勾陳の乗神 ${riding(i, "勾陳")}（${g}）・白虎の乗神 ${riding(i, "白虎")}（${h}）がともに囚死、日干 ${dayStem(i)}（${a}）・日支 ${dayBranch(i)}（${b}）がともに旺相`, evidence: [ev("seasonal", `${g}${h}${a}${b}`)] } : null;
    },
    assess: (_i, _s, goal) => (goal === "acquire" ? { direction: "favoring", note: "有利な結果を求める問いに対して（陳情できる形）" } : { direction: "neutral", note: "陳情できる形という読みで、goal が acquire でなければ向きを決めない" }),
  },
  {
    id: "litigation.venue", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "trajectory", topic: "progress", key: "venue", label: "訴訟が関わる官府の古典の読み（太歳・月建・天罡・天乙臨辰戌）", level: "combined",
      citations: [XJ("原文", "事关明敕神同岁，理涉州司月建并"), XJ("注", "月建用事，讼涉州县，传见天罡，讼涉监司。传见太岁，事干朝廷。凡天乙临辰戌，主移司换狱")] },
    conditions: (i) => {
      const s = seqOf(i), out: string[] = [];
      if (i.taiSuiBranch && s.includes(i.taiSuiBranch)) out.push(`太歳 ${i.taiSuiBranch} が三伝にある（朝廷に関わる）`);
      if (i.month && s[0] === i.month) out.push(`月建 ${i.month} が発用（州県に関わる）`);
      if (s.includes("辰")) out.push("天罡（辰）が三伝にある（監司に関わる）");
      const nb = under(i, riding(i, "貴人"));
      if (nb === "辰" || nb === "戌") out.push(`天乙が地盤の${nb}に臨む（司を移し獄を換える）`);
      return out.length ? { detected: out.join("・"), evidence: [ev("venue", out.length.toString())] } : null;
    },
    assess: neutral("どの官府に関わるかの古典の読みで、現代の裁判所の審級とは対応させない"),
  },

  // ===================== 『大全』 =====================
  {
    id: "litigation.ghostIn34", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "opportunity", topic: "outbreak", key: "ghostIn34", label: "三課・四課の上神がともに官鬼（官詞・病患が続いて至る）", level: "direct",
      citations: [DQ("卷十 毕法赋", "谓日干之鬼临干第三四课全者，官词病患继踵而至"), DQ("卷十 毕法赋", "如或全值空亡，始能免此")] },
    conditions: (i) => {
      const [, , l3, l4] = i.facts.lessons;
      if (l3.relation !== "官鬼" || l4.relation !== "官鬼") return null;
      const v = isVoid(i, l3.upper) && isVoid(i, l4.upper);
      return { detected: `三課 ${l3.upper}・四課 ${l4.upper} がともに官鬼${v ? "で、ともに旬空（免れる）" : ""}`, evidence: [ev("lessons34", `${l3.upper}${l4.upper}`)] };
    },
    assess: (i, s, goal) => (isVoid(i, i.facts.lessons[2].upper) && isVoid(i, i.facts.lessons[3].upper)
      ? { direction: "neutral", note: "ともに旬空で、古典は免れる（虚しく騒がせるだけ）とする" } : processAssess(true)(i, s, goal)),
  },
  {
    id: "litigation.voidNoble", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "obstruction", topic: "progress", key: "voidNoble", label: "貴人の乗神が旬空（訟を占えば大凶）", level: "direct",
      citations: [DQ("卷九 毕法赋", "缘贵人作空亡者，亦是神祗挠害，占讼大凶")] },
    conditions: (i) => (isVoid(i, riding(i, "貴人")) ? { detected: `貴人の乗神 ${riding(i, "貴人")} が旬空`, evidence: [ev("貴人", riding(i, "貴人"))] } : null),
    assess: partyAssess("both", false, false, []),
  },
  {
    id: "litigation.bothHurt", when: { domain: "litigation", subtypes: DIS },
    reading: { axis: "obstruction", topic: "loss", key: "bothHurt", label: "日干・日支がともに上神に剋される（彼此全傷。両方が損なう）", level: "direct",
      citations: [DQ("卷十 毕法赋", "谓支干各被上乘克伐者"), DQ("卷十 毕法赋", "如占讼，必两家皆被罪责。诸占必两边各有所亏")] },
    conditions: (i) => (overcomes(stemUpper(i), dayStem(i)) && overcomes(siteUpper(i), dayBranch(i))
      ? { detected: `干上 ${stemUpper(i)} が日干 ${dayStem(i)} を、支上 ${siteUpper(i)} が日支 ${dayBranch(i)} を剋す`, evidence: [ev("lessons13", `${stemUpper(i)}${siteUpper(i)}`)] } : null),
    assess: partyAssess("both", false, false, []),
  },
  {
    id: "litigation.diKe", when: { domain: "litigation", subtypes: DIS },
    reading: { axis: "obstruction", topic: "advantage", key: "diKe", label: "三伝が遞克して日干に至る（他人に欺かれ、互いに剋害する）", level: "direct",
      citations: [DQ("卷八 殃咎课", "初传克中，中克未，传，未克日干"), DQ("卷八 殃咎课", "末传克中传，中传克初传。初克日干为递克，主他人欺凌，互相克害")] },
    conditions: (i) => { const d = diKe(i); return d ? { detected: d, evidence: [ev("transmissions", seqOf(i).join(""))] } : null; },
    assess: NO_PARTY,
  },
  {
    id: "litigation.innerWar", when: { domain: "litigation", subtypes: DIS },
    reading: { axis: "opportunity", topic: "outbreak", key: "innerWar", label: "三伝がすべて下が上を剋す（三伝内戦。争いが家庭の内から出る）", level: "direct",
      citations: [DQ("卷九 毕法赋", "三传内战格缘三传俱下贼上"), DQ("卷九 毕法赋", "凡占，必是有窝犯讼，自家庭而出")] },
    conditions: (i) => (TRANSMISSIONS.every((p) => overcomes(under(i, t(i, p).branch), t(i, p).branch))
      ? { detected: `三伝 ${seqOf(i).map((b) => `${b}（地盤 ${under(i, b)}）`).join("・")} がすべて下から剋される`, evidence: [ev("zeike", "下賊上×3")] } : null),
    assess: processAssess(true),
  },
  {
    id: "litigation.binZhu", when: { domain: "litigation", subtypes: ALL3 },
    reading: { axis: "relation", topic: "relation", key: "binZhu", label: "干支の上・四課・三伝に刑（賓主不投。互いに異心がある）", level: "direct",
      citations: [DQ("卷十 毕法赋", "宾主不投刑在上，凡支干上乘刑者，有三等。凡占，未免相刑之意，所谋交涉事，必各有异心")] },
    conditions: (i) => { const b = binZhu(i); return b.length ? { detected: b.join("・"), evidence: [ev("punish", b.length.toString())] } : null; },
    assess: processAssess(true),
  },
  {
    id: "litigation.headTail", when: { domain: "litigation", subtypes: SET },
    reading: { axis: "trajectory", topic: "prolong", key: "headTail", label: "干上・支上に旬首と旬尾（首尾相見。事が脱けず、釈散に宜しくない）", level: "direct",
      citations: [DQ("卷九 毕法赋", "谓干上有旬尾，支上有旬首"), DQ("卷九 毕法赋", "占讼宜换司易局，占交加用事，去而复来。惟不宜占释散事")] },
    conditions: (i) => {
      const h = xunHeadBranch(i), tail = shift(h, 9), s = stemUpper(i), z = siteUpper(i);
      return (s === tail && z === h) || (s === h && z === tail)
        ? { detected: `干上 ${s}・支上 ${z} が旬首 ${h}・旬尾 ${tail}`, evidence: [ev("xun", `${h}…${tail}`)] } : null;
    },
    assess: processAssess(true),
  },
  {
    id: "litigation.tombOnGrowth", when: { domain: "litigation", subtypes: SET },
    reading: { axis: "trajectory", topic: "prolong", key: "tombOnGrowth", label: "発用の日辰の墓が長生に加わる（訟が断じてもまた論じられる）", level: "combined",
      citations: [DQ("鬼墓课", "凡日辰墓神及日鬼发用，为鬼墓课"), DQ("鬼墓课", "或未加亥，戌加寅，丑加已，辰加申。用墓加长生，旧事再发，讼断了又论")] },
    conditions: (i) => {
      const b = t(i, "initial").branch;
      const owners = [STEM_ELEMENT[dayStem(i)], el(dayBranch(i))].filter((e) => TOMB_ON_GROWTH[e]?.tomb === b && under(i, b) === TOMB_ON_GROWTH[e]!.growth);
      return owners.length ? { detected: `初伝 ${b}（${owners.join("・")}の墓）が地盤 ${under(i, b)}（長生）に加わる`, evidence: [ev("initial", `${b}加${under(i, b)}`)] } : null;
    },
    assess: processAssess(true),
  },
  {
    id: "litigation.jiYin", when: { domain: "litigation", subtypes: LIT },
    reading: { axis: "trajectory", topic: "escalation", key: "jiYin", label: "三伝が丑亥酉（極陰格。訟が省部に至る）", level: "direct",
      citations: [DQ("逆十二格", "丑亥酉为极阴格"), DQ("逆十二格", "讼至省部")] },
    conditions: (i) => (seqOf(i).join("") === "丑亥酉" ? { detected: "三伝が丑亥酉", evidence: [ev("transmissions", "丑亥酉")] } : null),
    assess: processAssess(true),
  },
];

/** 当事者と問う人の関係 */
export function litigantRelationOf(context: InterpretationContext): "self" | "proxy" | "unknown" {
  if (context.litigantPersonId === undefined || context.subjectPersonId === undefined) return "unknown";
  return context.litigantPersonId === context.subjectPersonId ? "self" : "proxy";
}

type LitigationSubtype = "litigation" | "dispute" | "settlement";
const SUBJECT: Record<LitigationSubtype, string> = { litigation: "訴訟（官に訴える争い）", dispute: "当事者間の争い", settlement: "和解・争いの収束" };
/** 段階（topic）の表示。ある段階の読みから他の段階を断定しないため、段階ごとに分けて書く */
const STAGES: Record<LitigationSubtype, readonly { topic: string; label: string }[]> = {
  litigation: [
    { topic: "relation", label: "当事者の役割・関係" }, { topic: "symbol", label: "訴訟の象意" }, { topic: "outbreak", label: "争いが生じる兆候" },
    { topic: "escalation", label: "激化" }, { topic: "advantage", label: "当事者間の優劣" }, { topic: "verdict", label: "勝敗に関する古典的判断" },
    { topic: "progress", label: "訴訟の進展・官府" }, { topic: "settlement", label: "和解・収束" }, { topic: "loss", label: "争いによる損失" }, { topic: "prolong", label: "長期化・停滞" },
  ],
  dispute: [{ topic: "relation", label: "当事者の関係" }, { topic: "outbreak", label: "争いが生じる兆候" }, { topic: "advantage", label: "当事者間の優劣" }, { topic: "loss", label: "争いによる損失" }],
  settlement: [{ topic: "relation", label: "当事者の関係" }, { topic: "settlement", label: "和解・収束" }, { topic: "prolong", label: "長期化・停滞" }],
};
const HEAD = "【古典の読み】以下は、六壬の古典がこの盤の配置を訴訟・争いの占としてどう読むかの整理です。古典の日（日干）・辰（日支）・主客・天将は盤上の役割で、実際の人物（問う人・当事者・相手方・原告・被告・官府・仲裁者）とは別に扱います。";
const TAIL = "【注意】古典的な占断は現実の法律上の判断ではなく、判決の結果・勝訴の見込み・賠償額・判決の日を示すものではありません。法的な判断や手続きは弁護士などの専門家に確認してください。争いの発生・激化・優劣・勝敗・進展・和解・損失・長期化は別々の判断で、ある段階の読みから他の段階を断定しません。";

function stageLines(sub: LitigationSubtype, readings: readonly DomainReading[]): string[] {
  const dir = (r: DomainReading) => (r.direction === "favoring" ? "追い風" : r.direction === "hindering" ? "妨げ" : "参考");
  return STAGES[sub].map(({ topic, label }) => {
    const rs = readings.filter((r) => r.topic === topic);
    return `・${label}: ${rs.length ? rs.map((r) => `${r.detected}（${dir(r)}）`).join("。") : "この盤では資料に根拠のある読みがない（断定しない）"}`;
  });
}

const STANDING_TEXT = (s: Standing) => [
  s.precedence ? (s.precedence === "initiator" ? "当事者は先に動いた側（先後の方式で客・日）" : "当事者は後で応じた側（先後の方式で主・辰）") : "",
  s.rank ? (s.rank === "senior" ? "当事者は尊の側（尊卑の方式で客・日。『心鏡』の規則だけに使う）" : "当事者は卑の側（尊卑の方式で主・辰。『心鏡』の規則だけに使う）") : "",
].filter(Boolean).join("・") || "当事者の古典の主客の立場は未指定（主客で向きが分かれる読みは向きを決めない）";

/** 訴訟・争いの DOMAIN 判断 */
export function evaluateLitigationDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "litigation") throw new Error(`訴訟以外の DOMAIN です: ${context.domain}`);
  const sub = context.subtype ?? "general";
  if (sub !== "litigation" && sub !== "dispute" && sub !== "settlement") {
    return summarizeDomainReadings("litigation", context.subtype, context.goal, [],
      [{ key: "subtype", detail: "問いの種類（訴訟 litigation・当事者間の争い dispute・和解 settlement）が未指定なので判断しない" }], "訴訟・争い");
  }
  const subject = SUBJECT[sub];
  const rel = litigantRelationOf(context);
  const who = [
    rel === "self" ? "問う人本人が当事者" : rel === "proxy" ? "代理の問い（当事者は問う人と別の人物）" : "当事者が問う人本人かどうかは未指定",
    STANDING_TEXT(context.litigationStanding ?? {}),
    context.legalPosition ? `現実の立場は${context.legalPosition === "plaintiff" ? "原告" : "被告"}（古典の主客には対応させない）` : "",
    context.counterpartyPersonId !== undefined ? "相手方は別の人物として指定（古典では当事者の反対側の主客として読むだけ）" : "",
    "官府・仲裁者は盤上の特定の位置に固定しない",
  ].filter(Boolean).join("・");
  const wrap = (r: DomainResult): DomainResult => ({ ...r, summary: [HEAD, `人物: ${who}。`, "段階ごとの読み:", ...stageLines(sub, r.readings), r.summary, TAIL].join("\n") });
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  // 問う人の本命は訴訟の規則に使わない（年命の規則は未対応）。太歳は使う
  const own = missing.filter((x) => x.key !== "natalYear");
  if (!input) return wrap(summarizeDomainReadings("litigation", context.subtype, context.goal, [], missing, subject));
  if (!monthBranch) own.push({ key: "monthBranch", detail: "月支がないので、旺相休囚を使う読み（日辰の休死・勾虎の囚死）と月建の読みは判断しない" });
  const st = context.litigationStanding ?? {};
  if (!st.precedence && !st.rank) own.push({ key: "litigationStanding", detail: "当事者の古典の主客（litigationStanding の先後・尊卑）がないので、主客で向きが分かれる読みは向きを決めない（原告・被告から自動では決めない）" });
  else if (!st.precedence) own.push({ key: "litigationStanding", detail: "先後（precedence）がないので、主客を先後だけで決める『指南』の規則は向きを決めない（尊卑は『心鏡』の規則だけに使う）" });
  if (st.precedence && st.rank && (st.precedence === "initiator") !== (st.rank === "senior")) own.push({ key: "standingConflict", detail: "先後と尊卑で客・主が食い違うので、両方式を使える『心鏡』の規則は向きを決めない（『心鏡』《入式》は尊卑を先に論じるが、一方を優先して自動では決めない）" });
  if (context.goal && !["acquire", ...SETTLE_GOALS].includes(context.goal)) own.push({ key: "goal", detail: `goal（${context.goal}）は訴訟の向きに使わない（acquire・avoid・reconcile・release だけ）` });
  own.push({ key: "seatedOnVoidAndXiRi", detail: "坐空（落空）は規則の条件として資料で定まらないので読まない。系日（初めて訴えた・拘束された日）は扱わず、勾陳の規則は占日の日干・日支で読む" });
  if (sub === "litigation") own.push(
    { key: "detention", detail: "拘禁・出獄・刑罰の種類（關鑰・傳逢日墓・天獄天牢・五行決罪・兔犬・雞蛇・丁動刃逢）は占的として扱わない" },
    { key: "shenSha", detail: "神煞（皇恩・天赦・解神・生氣・飛符など）と、年命・行年を使う読み（朱雀帶殺傷年命など）は未対応" },
    { key: "unresolvedPhrases", detail: "意味や見る位置が資料で確定しない句（支上有鬼・干支上神受克・父母化官・害合解結・旺敗灾祥・空亡喜懼・墓庫結散・傳互克干・用神内戰・將傳間逆・貴罡杜户・循環周遍・根斷源消・害貴・閉口・交車・干支自作三合）は保留" },
    { key: "tomb", detail: "『心鏡』の「自逢休墓死」は休（旺相休囚死の休）だけを読む。墓は土の墓の方式が資料で分かれ、死は旺相休囚死の死か十二長生の死かが確定しないので読まない。鬼墓課の「用墓加長生」も土の日辰は判断しない" },
    { key: "timing", detail: "訟が了る期（鬼賊絶處）・散ずる期（末傳冲處）は日付を出さないので読まない" },
  );
  if (sub === "dispute") own.push({ key: "disputeScope", detail: "古典の「訟」は官に訴える争いなので、『指南』占訟章・『心鏡』官訟門の主客の輸贏・官府・勾陳朱雀の規則は当てはめず、『大全』で「凡占」「諸占」と書かれた規則だけで読む" });
  if (sub === "settlement") own.push(
    { key: "settlementScope", detail: "和解・収束の規則は古典の「訟」（官に訴える争い）の章の規則で、官に訴えていない争いの収束にそのまま当てはまるかは資料で確定しない。『指南』「害合區分窺解結」は合・害を見る位置が資料で確定しないので読まない" },
  );
  if (sub !== "dispute") own.push({ key: "gouSameKind", detail: "『心鏡』「勾陳繫日為同類」は原文が繫日（初めて拘束された日）との比較で、郇注の「與日辰為同類」も日・辰のどちらとの比較か（両方か一方か）が確定しないので読まない（保留）" });
  if (sub !== "dispute") own.push({ key: "unconfirmedPatterns", detail: "『大全』の尋死格（「三傳生日，皆空」「占訟理虧」）は原典の例（丙午日 三傳卯寅丑）が条件と合わないので保留。凝陽格（三傳申午辰「占訟，留連」）は起課の720課に現れないので規則にしない" });
  const seated = TRANSMISSIONS.filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length) own.push({ key: "seatedOnVoid", detail: `${seated.map((p) => LABEL[p]).join("・")}が坐空（保留）` });
  const full: Input = { ...input, month: monthBranch ?? null, standing: context.litigationStanding ?? null };
  const readings = evaluateDomainRules(LITIGATION_RULES, full, "litigation", sub, context.goal);
  return wrap(summarizeDomainReadings("litigation", context.subtype, context.goal, readings, own, subject));
}

/** 監査用: ルールの一覧 */
export const LITIGATION_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = LITIGATION_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
