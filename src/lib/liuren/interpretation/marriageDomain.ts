// src/lib/liuren/interpretation/marriageDomain.ts
//
// 役割（Phase 5D）:
//   婚姻・男女関係（marriage）の DOMAIN 判断。subtype で問いを分ける:
//     proposal … 縁談・婚姻が成立するか（『大六壬指南』婚姻章「夫卜妻姻成不成」・『六壬心鏡』婚姻門「占求婚成否」）
//     married  … 夫婦関係が続くか・離別に向かうか（『指南』「欲知偕老是何術」）
//     dating（交際）・reunion（復縁）・general（未指定）… 古典の婚姻門に専用の規則がないので判断しない（不足として返す）
//
//   人物と類神（原典の見方をそのまま使い、問う人・相手には読み替えない）:
//     『御定六壬直指』婚姻「青龍為男，天后為女，日為男，支為女」「六合者，媒也」
//     『六壬心鏡』婚姻門 注「以日為夫，以辰為婦」「六合為媒」
//     『指南』婚姻章「夫卜妻…財」「女推夫婿…鬼」
//   読みの文は「男側（日・青龍）」「女側（支・天后）」で書き、問う人がどちら側か（context.subjectSide）が分かるときだけ
//   「問う人＝男側」などを添える。男女別の規則（夫が占えば財・妻が占えば鬼）は subjectSide がなければ判断しない。
//
//   扱わないもの（不足・保留として出す）: 容貌・性情・淫奔などの人物評価、第三者の存在を示す規則（二夫二婦・陰陽課不備の争いなど）、
//   孤辰寡宿（基準の支が資料で不明）、三光・六儀・三陽・乱首・九丑など定義が資料にない課体、本命・年命の規則、成婚の時期、行年。
//   空亡は旬空で読む（坐空を「空亡」に当てる根拠が婚姻の資料にない）。

import { STEM_ELEMENT } from "../constants";
import type { Branch, HeavenlyGeneral } from "../types";
import { buildDomainBoardInput } from "./domainBoardInput";
import type { DomainBoardInput } from "./domainBoardInput";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainDirection, DomainEvidenceItem, DomainMissingFact, DomainResult, DomainRule } from "./domainResult";
import { analyzeTransmissionFlow } from "./flow";
import { branchClassOf } from "./movementFacts";
import { detectClassicalPatterns } from "./patterns";
import { relationBetween } from "./relations";
import type { InterpretationContext, InterpretationGoal } from "./roles";
import type { InterpretationFacts, StructuralRelation, TransmissionFlow, TransmissionPosition } from "./types";

interface Input extends DomainBoardInput {
  flow: TransmissionFlow;
  side: "male" | "female" | null;
}
type Rule = DomainRule<Input>;
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const LABEL: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };
const BOTH = ["proposal", "married"] as const;

const ZN = (layer: "原文" | "注", quote: string, locator = "婚姻章第七"): DomainCitation => ({ source: "『大六壬指南』", locator, layer, quote });
const ZZ = (quote: string): DomainCitation => ({ source: "『御定六壬直指』", locator: "婚姻", layer: "原文", quote });
const XJ = (layer: "原文" | "注", quote: string): DomainCitation => ({ source: "『六壬心鏡』", locator: "巻五 婚姻門", layer, quote });
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });

// ---- 盤の読み取り（既存 FACT の参照） ----
const stemUpper = (i: Input) => i.facts.lessons[0].upper;
const siteUpper = (i: Input) => i.facts.lessons[2].upper;
const dayStem = (i: Input) => i.facts.basic.dayStem;
const dayBranch = (i: Input) => i.facts.basic.dayBranch;
const t = (i: Input, p: TransmissionPosition) => i.comparison.path[p];
const relOf = (a: Parameters<typeof relationBetween>[0], b: Parameters<typeof relationBetween>[1]) => relationBetween(a, b).relations;
const has = (rs: readonly StructuralRelation[], ...ks: StructuralRelation[]) => ks.some((k) => rs.includes(k));
const DISCORD: readonly StructuralRelation[] = ["punishes", "punishedBy", "clashes", "breaks", "harms"];
const NAME: Partial<Record<StructuralRelation, string>> = { punishes: "刑", punishedBy: "刑", clashes: "冲", breaks: "破", harms: "害", overcomes: "剋", overcomeBy: "剋", generates: "生", generatedBy: "生", combines: "合", sameElement: "比和" };
const names = (rs: readonly StructuralRelation[]) => [...new Set(rs.map((r) => NAME[r]).filter(Boolean))].join("・");
/** その天将が乗る天盤支 */
const riding = (i: Input, g: HeavenlyGeneral): Branch => (Object.keys(i.facts.generals.generalOn) as Branch[]).find((b) => i.facts.generals.generalOn[b] === g)!;
const isVoid = (i: Input, b: Branch) => i.facts.xun.voidBranches.includes(b);

// ---- 向き（結びつきを望むか） ----
/** 縁談では成立を望まない問い、夫婦では離別を望む問い */
const wantsApart = (goal: InterpretationGoal | undefined) => goal === "avoid" || goal === "separate" || goal === "release";
const union = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  wantsApart(goal) ? { direction: "hindering", note: "結びつきを望まない（離れたい）問いでは逆向き" } : { direction: "favoring" };
const apart = (_: Input, __: string | undefined, goal: InterpretationGoal | undefined): { direction: DomainDirection; note?: string } =>
  wantsApart(goal) ? { direction: "favoring", note: "結びつきを望まない（離れたい）問いでは逆向き。離れる兆しで、実際の離別を示すものではない" } : { direction: "hindering" };
const neutral = (note: string) => () => ({ direction: "neutral" as DomainDirection, note });

/** 男女のどちら側についての読みか（問う人の側が分かれば検出文に添える） */
export const MARRIAGE_SIDE: Readonly<Record<string, "male" | "female">> = {
  maleHarmsFemale: "female", femaleHarmsMale: "male", empressOvercomesStemProposal: "male", stemOvercomesEmpressProposal: "female",
  empressOvercomesStemMarried: "male", dragonOvercomesBranchMarried: "female", divinationOvercomesBranch: "female",
  wealthVoidMarried: "female", officerVoidMarried: "male",
};

const MARRIAGE_RULES: readonly Rule[] = [
  // ===== 人物間の関係（relation） =====
  {
    id: "marriage.uppersHarmony", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "relation", topic: "relation", key: "uppersHarmony", label: "日上と辰上が生合（男女相得る）", level: "direct",
      citations: [ZZ("日上与辰上生合，为男女相得"), XJ("注", "以日为夫，以辰为妇。日辰上神相生则成"), ZN("原文", "因干支上下相合…支上神又生干上神（支上申生干上子），女愿与男连姻", "婚姻章第七 占験一")] },
    conditions: (i) => {
      const r = relOf(siteUpper(i), stemUpper(i)), r2 = relOf(stemUpper(i), siteUpper(i));
      if (!has(r, "generates", "combines") && !has(r2, "generates")) return null;
      const dir = has(r, "generates") ? "支上（女側）が干上（男側）を生ず（女側が縁を望む・占験一）" : has(r2, "generates") ? "干上（男側）が支上（女側）を生ず" : "六合";
      return { detected: `干上 ${stemUpper(i)}・支上 ${siteUpper(i)}：${dir}`, evidence: [ev("relation", `支上→干上 ${names(r)}`)] };
    },
    assess: union,
  },
  {
    id: "marriage.uppersDiscord", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "relation", topic: "relation", key: "uppersDiscord", label: "日上と辰上が刑剋破害（成らない・離れる）", level: "direct",
      citations: [XJ("注", "日辰上神相生则成，刑克破害则尖民"), XJ("注", "一有刑克破害不成")] },
    conditions: (i) => {
      const r = [...relOf(stemUpper(i), siteUpper(i))].filter((x) => x === "overcomes" || x === "overcomeBy" || DISCORD.includes(x));
      return r.length ? { detected: `干上 ${stemUpper(i)} と支上 ${siteUpper(i)} が${names(r)}`, evidence: [ev("relation", names(r))] } : null;
    },
    assess: apart,
  },
  ...([
    ["maleHarmsFemale", "日が辰を剋す（男が婦を妨げる）", (i: Input) => has(relOf(dayStem(i), dayBranch(i)), "overcomes"), "日干（男側）が日支（女側）を剋す", [ZZ("龙克后，日克辰者，男妨妇"), ZN("原文", "干支刑克朝夕背")]],
    ["femaleHarmsMale", "辰が日を剋す（女が夫を妨げる）", (i: Input) => has(relOf(dayBranch(i), dayStem(i)), "overcomes"), "日支（女側）が日干（男側）を剋す", [ZZ("后克龙，辰克曰者，女妨夫"), ZN("原文", "干支刑克朝夕背")]],
  ] as const).map(([key, label, cond, text, citations]): Rule => ({
    id: `marriage.${key}`, when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "relation", topic: "relation", key, label, level: "direct", citations },
    conditions: (i) => cond(i) ? { detected: `${text}（日干 ${dayStem(i)}・日支 ${dayBranch(i)}）`, evidence: [ev("relation", "日干・日支 剋")] } : null,
    assess: apart,
  })),
  {
    id: "marriage.kaiLi", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "relation", topic: "relation", key: "kaiLi", label: "解離（干上神が支を、支上神が干を剋す。内の禍）", level: "direct",
      citations: [ZN("原文", "芜淫…解离…心腹祸，外争凶浅内争深"), ZN("注", "解离（干上神克支，支上神克干）")] },
    conditions: (i) => has(relOf(stemUpper(i), dayBranch(i)), "overcomes") && has(relOf(siteUpper(i), dayStem(i)), "overcomes")
      ? { detected: `干上 ${stemUpper(i)} が日支 ${dayBranch(i)} を剋し、支上 ${siteUpper(i)} が日干 ${dayStem(i)} を剋す`, evidence: [ev("relation", "干上→支 剋・支上→干 剋")] } : null,
    assess: apart,
  },
  {
    id: "marriage.wuYin", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "relation", topic: "relation", key: "wuYin", label: "蕪淫（四課の陰陽が備わらない）", level: "combined",
      citations: [ZN("原文", "芜淫…解离…心腹祸"), ZN("注", "芜淫（阴阳不备）"), ZZ("所忌狡童、泆女、芜淫")] },
    conditions: (i) => {
      const pairs = new Set(i.facts.lessons.map((l) => `${l.upper}${l.lowerBranch}`));
      return pairs.size < 4 ? { detected: `四課が${pairs.size}課しかない（重複課。陰陽が備わらない）`, evidence: [ev("lessons", `${pairs.size}課`)] } : null;
    },
    assess: apart,
  },
  {
    id: "marriage.stemComesToSite", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "relation", topic: "relation", key: "stemComesToSite", label: "日が辰上に臨む（男が女の家に就く）／辰が日上に臨む（女が男の家に就く）", level: "direct",
      citations: [ZZ("日临辰上，男就女家也；辰临日上，女就男家也")] },
    conditions: (i) => siteUpper(i) === i.lodgingBranch ? { detected: `日干の寄宮 ${i.lodgingBranch} が支上（男が女の家に就く）`, evidence: [ev("lesson3.upper", i.lodgingBranch)] }
      : stemUpper(i) === dayBranch(i) ? { detected: `日支 ${dayBranch(i)} が干上（女が男の家に就く）`, evidence: [ev("lesson1.upper", dayBranch(i))] } : null,
    assess: neutral("どちらの家に入るかの形で、成否は他の要素による"),
  },
  // 青龍（男）と天后（女）の乗神どうしの関係（『直指』「青龍所乘神生后或比合…天后所乘神生合龍…龍克后…后克龍…若龍后所乘之神，刑冲破害」）は
  // 読まない: 十二天将の並びは固定で、青龍と天后の乗神は常に6支離れる（必ず冲。生・合は起こらない）ため、原典がどの対象との関係を言うのか
  // （龍后どうし・日辰・二后）が確認できるまで保留する。
  {
    id: "marriage.dragonEmpressVoid", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "actualization", topic: "formation", key: "dragonEmpressVoid", label: "青龍・天后の乗神が空亡", level: "direct",
      citations: [ZZ("若龙后所乘之神，刑冲破害，或落空亡…皆不吉")] },
    conditions: (i) => {
      const hits = (["青龍", "天后"] as const).filter((g) => isVoid(i, riding(i, g))).map((g) => `${g}の乗る ${riding(i, g)}`);
      return hits.length ? { detected: `${hits.join("・")}が旬空`, evidence: [ev("void", hits.join(","))] } : null;
    },
    assess: apart,
  },
  // ===== 媒（mediator） =====
  // 『直指』「六合者，媒也，所乘神要與龍后比和，而無刑冲破害」は読まない: 六合と青龍・天后の乗神は常に2支・4支離れ、比和にも刑冲破害にもならない（保留）
  {
    id: "marriage.matchmakerDeceives", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "obstruction", topic: "mediator", key: "matchmakerDeceives", label: "中伝は空でなく初末伝が空（媒人が欺く）", level: "direct",
      citations: [ZN("原文", "中不虚兮初末虚，冰人脱骗两相欺")] },
    conditions: (i) => t(i, "initial").isVoid && t(i, "final").isVoid && !t(i, "middle").isVoid
      ? { detected: `初伝 ${t(i, "initial").branch}・末伝 ${t(i, "final").branch} が旬空で、中伝 ${t(i, "middle").branch} は空でない`, evidence: [ev("void", "初・末")] } : null,
    assess: apart,
  },
  // ===== 成立（formation。縁談） =====
  {
    id: "marriage.dragonOrSixHeInTransmissions", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "opportunity", topic: "formation", key: "dragonOrSixHeInTransmissions", label: "三伝に六合・青龍があって気がある（よい婚姻）", level: "combined",
      citations: [XJ("原文", "传中六合青龙在，阴阳有气好婚姻")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => ["六合", "青龍"].includes(i.facts.generals.generalOn[t(i, p).branch]) && (t(i, p).seasonalStrength === "旺" || t(i, p).seasonalStrength === "相"));
      return ps.length ? { detected: `${ps.map((p) => `${LABEL[p]} ${t(i, p).branch} に${i.facts.generals.generalOn[t(i, p).branch]}（${t(i, p).seasonalStrength}）`).join("・")}`, evidence: [ev("transmissions", ps.join(","))] } : null;
    },
    assess: union,
  },
  {
    id: "marriage.tianGang", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "trajectory", topic: "formation", key: "tianGang", label: "斗罡が季（婚礼を急ぐ）・仲（許して配偶となる）・孟（礼を尽くしても空しい）", level: "direct",
      citations: [XJ("原文", "斗罡加季催花烛，加孟礼仪徒自营。加仲许之为配偶")] },
    conditions: (i) => {
      const e = i.facts.plate.earthUnder["辰"], c = branchClassOf(e);
      return { detected: `斗罡 辰 が地盤 ${e}（${c}）に加わる（${c === "季" ? "婚礼を急ぐ" : c === "仲" ? "許して配偶となる" : "礼を尽くしても空しい"}）`, evidence: [ev("tianGang.earth", `${e}（${c}）`)] };
    },
    assess: (i, s, g) => (branchClassOf(i.facts.plate.earthUnder["辰"]) === "孟" ? apart(i, s, g) : union(i, s, g)),
  },
  {
    id: "marriage.siteUpperOvercomesBranch", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "obstruction", topic: "formation", key: "siteUpperOvercomesBranch", label: "支が上神に剋される（干がその神を制すれば成る）", level: "direct",
      citations: [XJ("原文", "不然支被上神克，干又遥能制此神"), XJ("注", "支上神克支，便须干制支上神，可成")] },
    conditions: (i) => {
      if (!has(relOf(siteUpper(i), dayBranch(i)), "overcomes")) return null;
      const rescued = has(relOf(dayStem(i), siteUpper(i)), "overcomes");
      return { detected: `支上 ${siteUpper(i)} が日支 ${dayBranch(i)} を剋す${rescued ? `が、日干 ${dayStem(i)} が ${siteUpper(i)} を制す（成る）` : "（日干はこれを制さない）"}`, evidence: [ev("relation", rescued ? "支上→支 剋・干→支上 剋" : "支上→支 剋")] };
    },
    assess: (i, s, g) => (has(relOf(dayStem(i), siteUpper(i)), "overcomes") ? union(i, s, g) : apart(i, s, g)),
  },
  ...([
    ["empressOvercomesStemProposal", "天后の乗神が日干を剋す（男が娶ろうとしない）", (i: Input) => has(relOf(riding(i, "天后"), dayStem(i)), "overcomes"), (i: Input) => `天后の乗る ${riding(i, "天后")} が日干 ${dayStem(i)}（${STEM_ELEMENT[dayStem(i)]}）を剋す`, "天后刑克日干，男不肯娶"],
    ["stemOvercomesEmpressProposal", "日干が天后の乗神を剋す（女が許そうとしない）", (i: Input) => has(relOf(dayStem(i), riding(i, "天后")), "overcomes"), (i: Input) => `日干 ${dayStem(i)} が天后の乗る ${riding(i, "天后")} を剋す`, "日干刑克天后，男贪女，女不肯许"],
  ] as const).map(([key, label, cond, text, quote]): Rule => ({
    id: `marriage.${key}`, when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "obstruction", topic: "formation", key, label, level: "direct", citations: [XJ("注", quote), XJ("原文", "须知二后莫相刑")] },
    conditions: (i) => cond(i) ? { detected: text(i), evidence: [ev("relation", "天后・日干 剋")] } : null,
    assess: apart,
  })),
  {
    id: "marriage.wealthOrOfficerVoidProposal", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "actualization", topic: "formation", key: "wealthOrOfficerVoidProposal", label: "男が占えば財、女が占えば鬼が旬空（成らない）", level: "combined",
      citations: [ZN("原文", "夫卜妻姻成不成，财居旬后总无情。女推夫婿将何断，鬼坐天中同此祥"), ZZ("男占忌日财空亡，女占忌日官空亡，皆不成之兆")] },
    conditions: (i) => {
      if (!i.side) return null;
      const want = i.side === "male" ? "妻財" : "官鬼";
      const ps = TRANSMISSIONS.filter((p) => t(i, p).sixRelation === want && t(i, p).isVoid);
      return ps.length ? { detected: `問う人は${i.side === "male" ? "男側" : "女側"}で、三伝の${want} ${ps.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")}が旬空`, evidence: [ev("void", want)] } : null;
    },
    assess: apart,
  },
  {
    id: "marriage.mutualGeneration", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "support", topic: "formation", key: "mutualGeneration", label: "三伝が遞いに日干を生ず（傍らの人が賛ける）", level: "direct",
      citations: [ZN("原文", "递生干兮旁人赞")] },
    conditions: (i) => i.flow.generationFlow.transmissionsToDayStem
      ? { detected: `三伝 ${t(i, "initial").branch}→${t(i, "middle").branch}→${t(i, "final").branch} が順に生じ、末伝が日干 ${dayStem(i)} を生ず`, evidence: [ev("generationFlow", "三伝→日干")] } : null,
    assess: union,
  },
  {
    id: "marriage.harmonyRelatives", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "support", topic: "formation", key: "harmonyRelatives", label: "三伝が三合（縁故から縁がまとまる）", level: "combined",
      citations: [ZZ("课传循环，三合六合，是因亲而致亲也")] },
    conditions: (i) => i.flow.threeHarmony.complete ? { detected: `三伝が${i.flow.threeHarmony.element}の三合局（循環・六合は未対応）`, evidence: [ev("threeHarmony", i.flow.threeHarmony.element)] } : null,
    assess: union,
  },
  {
    id: "marriage.favoredPattern", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "opportunity", topic: "formation", key: "favoredPattern", label: "課伝に喜ぶ形（元胎・連茹）", level: "direct",
      citations: [ZZ("课传所喜三光、六仪、元胎、三阳连茹")] },
    conditions: (i) => {
      const hits = [detectClassicalPatterns(i.facts).some((p) => p.kind === "yuanTai") ? "元胎" : "", i.comparison.movementPattern === "進茹" || i.comparison.movementPattern === "退茹" ? `連茹（${i.comparison.movementPattern}）` : ""].filter(Boolean);
      return hits.length ? { detected: `${hits.join("・")}（三光・六儀・三陽は定義が資料にないので未対応）`, evidence: [ev("pattern", hits.join(","))] } : null;
    },
    assess: union,
  },
  {
    id: "marriage.heKuiOnHai", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "trajectory", topic: "relation", key: "heKuiOnHai", label: "河魁が亥を渡る（風波が動く）", level: "direct",
      citations: [ZN("原文", "河魁渡亥风波动")] },
    conditions: (i) => i.facts.plate.earthUnder["戌"] === "亥" ? { detected: "河魁 戌 が地盤 亥 に加わる", evidence: [ev("plate", "戌加亥")] } : null,
    assess: apart,
  },
  {
    id: "marriage.divinationOvercomesBranch", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "obstruction", topic: "relation", key: "divinationOvercomesBranch", label: "占時が支に勝つ（女に妨げ）", level: "direct",
      citations: [XJ("原文", "时胜支兮女有妨")] },
    conditions: (i) => has(relOf(i.facts.basic.divinationBranch, dayBranch(i)), "overcomes")
      ? { detected: `占時 ${i.facts.basic.divinationBranch} が日支 ${dayBranch(i)} を剋す`, evidence: [ev("relation", "占時→日支 剋")] } : null,
    assess: apart,
  },
  {
    id: "marriage.yinOverYang", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "trajectory", topic: "relation", key: "yinOverYang", label: "支から干へ伝わる（陰が陽に勝つ）", level: "direct",
      citations: [XJ("原文", "支传干兮阴胜阳")] },
    conditions: (i) => t(i, "initial").branch === siteUpper(i) && t(i, "final").branch === stemUpper(i)
      ? { detected: `初伝が支上 ${siteUpper(i)}、末伝が干上 ${stemUpper(i)}（女側が主になる形）`, evidence: [ev("transmissions", "支上→干上")] } : null,
    assess: neutral("どちらが主導するかの形で、成否は他の要素による"),
  },
  {
    id: "marriage.jiaoTongYiNu", when: { domain: "marriage", subtypes: BOTH },
    reading: { axis: "trajectory", topic: "relation", key: "jiaoTongYiNu", label: "狡童（初伝に六合・末伝に天后）／泆女（初伝に天后・末伝に六合）", level: "direct",
      citations: [ZN("注", "狡童者初合末后，主男诱女；泆女者初后末合，主女诱男")] },
    conditions: (i) => {
      const a = i.facts.generals.generalOn[t(i, "initial").branch], b = i.facts.generals.generalOn[t(i, "final").branch];
      return a === "六合" && b === "天后" ? { detected: "初伝に六合・末伝に天后（狡童。男が誘う形）", evidence: [ev("generals", "六合→天后")] }
        : a === "天后" && b === "六合" ? { detected: "初伝に天后・末伝に六合（泆女。女が誘う形）", evidence: [ev("generals", "天后→六合")] } : null;
    },
    assess: neutral("どちらから誘うかの形。『直指』は「所忌」とするが、人物の評価は扱わない"),
  },
  {
    id: "marriage.preMaritalTie", when: { domain: "marriage", subtypes: ["proposal"] },
    reading: { axis: "trajectory", topic: "relation", key: "preMaritalTie", label: "日上に天后・辰上に六合（娶る前に通じる）", level: "direct",
      citations: [ZZ("日上乘天后，辰上乘六合，是未娶而先通也")] },
    conditions: (i) => i.facts.generals.generalOn[stemUpper(i)] === "天后" && i.facts.generals.generalOn[siteUpper(i)] === "六合"
      ? { detected: `干上 ${stemUpper(i)} に天后・支上 ${siteUpper(i)} に六合`, evidence: [ev("generals", "干上天后・支上六合")] } : null,
    assess: neutral("関係が先に進んでいる古典の象。断定はしない"),
  },
  // ===== 夫婦が続くか（durability。married） =====
  ...([
    ["wealthVoidMarried", "妻財", "財が旬空（鳳が孤り飛ぶ＝妻を失う兆し）", "财乘旬后凤孤飞"],
    ["officerVoidMarried", "官鬼", "官が旬空（鸞が匹を失う＝夫を失う兆し）", "官坐空亡鸾失匹"],
  ] as const).map(([key, rel, label, quote]): Rule => ({
    id: `marriage.${key}`, when: { domain: "marriage", subtypes: ["married"] },
    reading: { axis: "actualization", topic: "durability", key, label, level: "direct",
      citations: [ZN("原文", `欲知偕老是何术，全凭财官虚与实…${quote}`), ...(rel === "妻財" ? [ZN("原文", "传将见妻复入空，中年弦断无续妪。空于其妻又见妻，初虽有伤复再娶")] : [])] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => t(i, p).sixRelation === rel);
      const voids = ps.filter((p) => t(i, p).isVoid);
      if (!voids.length) return null;
      const later = rel === "妻財" ? ps.filter((p) => !t(i, p).isVoid && TRANSMISSIONS.indexOf(p) > TRANSMISSIONS.indexOf(voids[0])) : [];
      return { detected: `三伝の${rel} ${voids.map((p) => `${LABEL[p]} ${t(i, p).branch}`).join("・")}が旬空${later.length ? `。後の${LABEL[later[0]]} ${t(i, later[0]).branch} に再び財（いったん傷ついても再び娶る）` : ""}`, evidence: [ev("void", rel)] };
    },
    assess: apart,
  })),
  {
    id: "marriage.unstablePattern", when: { domain: "marriage", subtypes: ["married"] },
    reading: { axis: "trajectory", topic: "durability", key: "unstablePattern", label: "返吟・別責（長く続かない）", level: "direct",
      citations: [ZZ("返吟、别责不久")] },
    conditions: (i) => i.facts.sanchuan.method === "返吟" || i.facts.sanchuan.method === "別責" ? { detected: `課体が${i.facts.sanchuan.method}`, evidence: [ev("method", i.facts.sanchuan.method)] } : null,
    assess: apart,
  },
  {
    id: "marriage.empressOvercomesStemMarried", when: { domain: "marriage", subtypes: ["married"] },
    reading: { axis: "obstruction", topic: "durability", key: "empressOvercomesStemMarried", label: "天后が干を剋す（夫が早く亡くなる兆し）", level: "direct",
      citations: [ZN("原文", "后克干兮夫早亡")] },
    conditions: (i) => has(relOf(riding(i, "天后"), dayStem(i)), "overcomes") ? { detected: `天后の乗る ${riding(i, "天后")} が日干 ${dayStem(i)} を剋す`, evidence: [ev("relation", "天后→日干 剋")] } : null,
    assess: apart,
  },
  {
    id: "marriage.dragonOvercomesBranchMarried", when: { domain: "marriage", subtypes: ["married"] },
    reading: { axis: "obstruction", topic: "durability", key: "dragonOvercomesBranchMarried", label: "青龍が支を傷つける（婦が先に損なわれる兆し）", level: "direct",
      citations: [ZN("原文", "龙伤支兮妇先损")] },
    conditions: (i) => has(relOf(riding(i, "青龍"), dayBranch(i)), "overcomes") ? { detected: `青龍の乗る ${riding(i, "青龍")} が日支 ${dayBranch(i)} を剋す`, evidence: [ev("relation", "青龍→日支 剋")] } : null,
    assess: apart,
  },
];

const SIDE_TEXT = (side: "male" | "female", asker: "male" | "female" | null) =>
  asker === null ? "" : side === asker ? "（この側＝問う人）" : "（この側＝相手）";

/** 婚姻・男女関係の DOMAIN 判断 */
export function evaluateMarriageDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "marriage") throw new Error(`婚姻以外の DOMAIN です: ${context.domain}`);
  const sub = context.subtype ?? "general";
  const subject = sub === "married" ? "夫婦関係" : sub === "proposal" ? "縁談・婚姻の成立" : sub === "dating" ? "交際" : sub === "reunion" ? "復縁" : "婚姻・男女関係";
  const lead = [{ topic: "relation", label: "男女の関係（日・青龍＝男側、支・天后＝女側）" }];
  if (sub !== "proposal" && sub !== "married") {
    const why: DomainMissingFact = sub === "general"
      ? { key: "subtype", detail: "問いの種類（縁談 proposal・夫婦 married）が未指定なので判断しない" }
      : { key: "subtype", detail: `${subject}は、取得した古典の婚姻門（『指南』『直指』『心鏡』）に専用の規則がないので未対応` };
    return summarizeDomainReadings("marriage", context.subtype, context.goal, [], [why], subject, lead);
  }
  const { input, missing } = buildDomainBoardInput(facts, context, monthBranch);
  if (!input) return summarizeDomainReadings("marriage", context.subtype, context.goal, [], missing, subject, lead);
  const own = missing.filter((x) => x.key !== "natalYear" && x.key !== "taiSui");
  const flow = analyzeTransmissionFlow(facts, monthBranch);
  if (flow.status !== "determined") return summarizeDomainReadings("marriage", context.subtype, context.goal, [], missing, subject, lead);
  const side = context.subjectSide ?? null;
  if (!side) own.push({ key: "subjectSide", detail: "問う人が男女のどちら側か（subjectSide）がないので、男女別の規則（夫が占えば財・妻が占えば鬼）は判断しない。他の読みは「男側・女側」で示す" });
  if (!monthBranch) own.push({ key: "monthBranch", detail: "月支がないので、「三伝に六合・青龍があって気がある」は判断しない" });
  own.push(
    { key: "natalYear", detail: "本命・年命の規則（「夫之本命加婦命」など）は資料の条件が曖昧なので未対応" },
    { key: "dragonEmpress", detail: "青龍・天后の乗神どうしの生剋・刑冲破害と、六合（媒）の乗神と青龍・天后の比和は、天将の並びが固定で常に同じ関係になる（龍后は必ず冲）ので、原典の対象が確認できるまで保留" },
    { key: "character", detail: "容貌・性情・淫奔などの人物評価と、第三者を示す規則（二夫二婦・陰陽課不備の争いなど）は扱わない（保留）" },
    { key: "timing", detail: "成婚の時期（「末傳合處驗成期」など）・行年は未対応" },
  );
  const seated = (["initial", "middle", "final"] as const).filter((p) => !input.comparison.path[p].isVoid && input.comparison.path[p].isSeatedOnVoid);
  if (seated.length) own.push({ key: "seatedOnVoid", detail: `${seated.map((p) => LABEL[p]).join("・")}が坐空。婚姻の資料には坐空を空亡に当てる根拠がないので読まない（保留）` });
  const full: Input = { ...input, flow, side };
  const readings = evaluateDomainRules(MARRIAGE_RULES, full, "marriage", context.subtype, context.goal)
    .map((r) => (MARRIAGE_SIDE[r.key] ? { ...r, detected: `${r.detected}（${MARRIAGE_SIDE[r.key] === "male" ? "男側" : "女側"}に関わる）${SIDE_TEXT(MARRIAGE_SIDE[r.key], side)}` } : r));
  return summarizeDomainReadings("marriage", context.subtype, context.goal, readings, own, subject, lead);
}

/** 監査用: ルールの一覧 */
export const MARRIAGE_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = MARRIAGE_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
