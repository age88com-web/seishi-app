// src/lib/liuren/interpretation/careerDomain.ts
//
// 役割（Phase 5A）:
//   仕事（work。とくに昇進 promotion）と試験（exam。文試 civil・武試 military）の DOMAIN 判断を、
//   InterpretationContext → 既存の FACT → IdentityLink → ルール → 複数の読み → 総合結果・要約 まで通す。
//   ルールは『六壬断案２』例43・51・52・53・54 と『六壬神課講座』で、判断に使われている FACT の組合せだけを持つ
//   （盤そのものの丸暗記はしない）。官鬼・空亡・天将などに固定の吉凶は付けず、DOMAIN・subtype・goal・位置・組合せで向きを決める。
//   本命（subjectPersonId の natalYear）・太歳がなくても、使える FACT だけで部分判断を返し、不足として明示する。
//   行年は規則が未確定なので使わない（行年が要る読みは不足として出す）。起課・ROLE は変えない。

import type { Branch } from "../types";
import { anchorResolutionContextOf } from "./anchorResolver";
import type { AnchorResolutionContext } from "./anchorResolver";
import { isFlankedBy } from "./branchAdjacency";
import { resolveContextBranch } from "./contextBranch";
import { resolveDerivedContextBranch } from "./contextBranchDerivation";
import { dayNightNobleBranchPairStateOf } from "./dayNightNobleBranchPair";
import { derivedBranchDayStemStateOf } from "./derivedBranchDayStem";
import { evaluateDomainRules, summarizeDomainReadings } from "./domainResult";
import type { DomainCitation, DomainEvidenceItem, DomainMissingFact, DomainResult, DomainRule } from "./domainResult";
import { heavenlyGeneralPlacementRelationsOf } from "./heavenlyGeneralPlacement";
import { collectIdentityLinks } from "./identityLink";
import type { IdentityLink } from "./identityLink";
import type { ContextBranchSource, InterpretationContext, InterpretationGoal } from "./roles";
import { transmissionPassageOf } from "./transmissionPassage";
import type { TransmissionPassage } from "./transmissionPassage";
import type {
  DayNightNobleBranchPairState, DayStemStandingState, InterpretationFacts, StandingPathComparison, TransmissionDayStemState, TransmissionPosition,
} from "./types";

// ---- 入力 ----

type PathPosition = "standing" | TransmissionPosition;
const POSITION_LABEL: Record<PathPosition, string> = { standing: "干上", initial: "初伝", middle: "中伝", final: "末伝" };
const TRANSMISSIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

export interface CareerDomainInput {
  facts: InterpretationFacts;
  ctx: AnchorResolutionContext;
  comparison: StandingPathComparison;
  /** 三伝が通り過ぎる支（一直線に動かなければ null） */
  passage: TransmissionPassage | null;
  noblePair: DayNightNobleBranchPairState;
  /** 日干の寄宮支（一課の地盤支） */
  lodgingBranch: Branch;
  /** subject の人物の本命の支（なければ null）と、その盤とのつながり */
  subjectNatalBranch: Branch | null;
  subjectLinks: readonly IdentityLink[];
  /** 太歳の盤とのつながりと、太歳の上（heavenOn）の支（なければ null） */
  taiSuiLinks: readonly IdentityLink[];
  taiSuiHeavenOn: Branch | null;
}

const stateAt = (i: CareerDomainInput, p: PathPosition): DayStemStandingState | TransmissionDayStemState =>
  p === "standing" ? i.comparison.standing : i.comparison.path[p];
const isEmpty = (s: DayStemStandingState | TransmissionDayStemState) => s.isVoid || s.isSeatedOnVoid;
const emptyText = (s: DayStemStandingState | TransmissionDayStemState) => (s.isVoid ? "旬空" : s.isSeatedOnVoid ? "坐空" : "");
const ev = (fact: string, detail: string): DomainEvidenceItem => ({ fact, detail });
const generalAt = (i: CareerDomainInput, b: Branch) => i.facts.generals.generalOn[b];
const transmissionBranches = (i: CareerDomainInput) => TRANSMISSIONS.map((p) => i.comparison.path[p].branch);

// ---- 出典 ----

const D2 = (locator: string, layer: "原文" | "訳注", quote: string): DomainCitation => ({ source: "『六壬断案２』", locator, layer, quote });
const KOZA = (locator: string, quote: string): DomainCitation => ({ source: "『六壬神課講座』", locator, layer: "講座", quote });

// ---- 向き ----

const WORK_RELEASE_GOALS: readonly InterpretationGoal[] = ["release", "separate", "avoid"];
const workOpportunity = (_: CareerDomainInput, __: string | undefined, goal: InterpretationGoal | undefined) =>
  goal && WORK_RELEASE_GOALS.includes(goal)
    ? { direction: "neutral" as const, note: "離れることを望む問いでの読みは資料にない" }
    : { direction: "favoring" as const };
const hindering = () => ({ direction: "hindering" as const });
const favoring = () => ({ direction: "favoring" as const });
/** 試験での空亡（例51・52 訳注「試験占いで空亡はあまり気にしない」、例54 訳注「初伝空亡なので武試は受けられないか通らない」） */
const examVoid = (_: CareerDomainInput, subtype: string | undefined) =>
  subtype === "military"
    ? { direction: "hindering" as const, note: "武試では空亡を妨げとする（例54 訳注）" }
    : { direction: "neutral" as const, note: "試験占いでは空亡をあまり気にしない（例51・52 訳注）" };
/** 文試の根拠で、武試の根拠ではないもの（例54「武なく文あり」） */
const civilOnly = (_: CareerDomainInput, subtype: string | undefined) =>
  subtype === "military"
    ? { direction: "neutral" as const, note: "文試の根拠で、武試の根拠ではない（例54「この課は武なく文がある」）" }
    : { direction: "favoring" as const };
/** 武試だけの妨げ */
const militaryOnly = (_: CareerDomainInput, subtype: string | undefined) =>
  subtype === "military" ? { direction: "hindering" as const } : { direction: "neutral" as const, note: "武試の条件で、文試には関わらない" };

// ---- 条件で使う小さな検出 ----

function officerPositions(i: CareerDomainInput): TransmissionPosition[] {
  return TRANSMISSIONS.filter((p) => i.comparison.path[p].sixRelation === "官鬼");
}
function officerDetected(i: CareerDomainInput) {
  const ps = officerPositions(i);
  if (!ps.length) return null;
  return {
    detected: `官鬼（官星）が${ps.map((p) => `${POSITION_LABEL[p]}の${i.comparison.path[p].branch}`).join("・")}に出ている`,
    evidence: ps.map((p) => ev("sixRelation", `${POSITION_LABEL[p]} ${i.comparison.path[p].branch}＝官鬼`)),
  };
}
function emptyOfficer(i: CareerDomainInput) {
  const ps = officerPositions(i).filter((p) => isEmpty(i.comparison.path[p]));
  if (!ps.length) return null;
  return {
    detected: `官星（${ps.map((p) => `${POSITION_LABEL[p]}の${i.comparison.path[p].branch}`).join("・")}）は${ps.map((p) => emptyText(i.comparison.path[p])).join("・")}で、存在するが実現しにくい形`,
    evidence: ps.map((p) => ev(i.comparison.path[p].isVoid ? "dayXunVoid" : "seatedOnVoid", `${POSITION_LABEL[p]} ${i.comparison.path[p].branch}`)),
  };
}
const isDengSanTian = (i: CareerDomainInput) => transmissionBranches(i).join("") === "辰午申";
function nobleAbundance(i: CareerDomainInput) {
  const nobles = [i.noblePair.dayBranch, i.noblePair.nightBranch];
  const l1 = i.facts.lessons[0].upper, l2 = i.facts.lessons[1].upper;
  const inPath = TRANSMISSIONS.filter((p) => nobles.includes(i.comparison.path[p].branch));
  if (!(nobles.includes(l1) && nobles.includes(l2) && inPath.length >= 2)) return null;
  return {
    detected: `昼夜貴人支（${nobles.join("・")}）が一課・二課の上神（${l1}・${l2}）と${inPath.map((p) => POSITION_LABEL[p]).join("・")}にある（課伝ともに貴人）`,
    evidence: [ev("dayNightNobleBranchPair", nobles.join("・")), ev("lessonUpper", `一課 ${l1}・二課 ${l2}`), ...inPath.map((p) => ev("transmission", `${POSITION_LABEL[p]} ${i.comparison.path[p].branch}`))],
  };
}
const linkAt = (links: readonly IdentityLink[], derivation: string, anchor: (l: IdentityLink) => boolean) =>
  links.find((l) => l.source.derivation === derivation && anchor(l)) ?? null;
const isPosition = (p: PathPosition) => (l: IdentityLink) => l.anchor.kind === "position" && l.anchor.position === p;

// ---- ルール ----

type Rule = DomainRule<CareerDomainInput>;

const CAREER_RULES: readonly Rule[] = [
  // ===== 仕事（work） =====
  {
    id: "work.officerInTransmissions", when: { domain: "work" },
    reading: { axis: "opportunity", key: "officerInTransmissions", label: "官星が三伝に出る", level: "combined",
      citations: [D2("例52", "原文", "水は官星として、朝郎になるのはなかなか難しい"), D2("例54", "原文", "官星学堂、故に科甲")] },
    conditions: officerDetected, assess: workOpportunity,
  },
  {
    id: "work.officerEmpty", when: { domain: "work" },
    reading: { axis: "actualization", key: "officerEmpty", label: "官星が空亡・坐空", level: "combined",
      citations: [D2("例52", "原文", "身と初伝中伝は空であり、十を求めても一も得られず"), D2("例52", "訳注", "この場合は将来を占うのですから、これは凶象")] },
    conditions: emptyOfficer, assess: hindering,
  },
  {
    id: "work.bodyAndInitialEmpty", when: { domain: "work" },
    reading: { axis: "actualization", key: "bodyAndInitialEmpty", label: "干上と初伝が空", level: "direct",
      citations: [D2("例52", "原文", "身と初伝中伝は空であり、十を求めても一も得られず、いたずらに心を浪費する")] },
    conditions: (i) => {
      const s = stateAt(i, "standing"), n = stateAt(i, "initial");
      if (!(isEmpty(s) && isEmpty(n))) return null;
      return { detected: `干上 ${s.branch}（${emptyText(s)}）と初伝 ${n.branch}（${emptyText(n)}）がともに空`, evidence: [ev("standing", `${s.branch} ${emptyText(s)}`), ev("initial", `${n.branch} ${emptyText(n)}`)] };
    },
    assess: hindering,
  },
  {
    id: "work.finalEmpty", when: { domain: "work" },
    reading: { axis: "trajectory", key: "finalEmpty", label: "末伝が空（しりすぼみ）", level: "combined",
      citations: [D2("例53", "訳注", "末伝空亡であり…竜頭蛇尾でしりすぼみ")] },
    conditions: (i) => {
      const f = stateAt(i, "final");
      return isEmpty(f) ? { detected: `末伝 ${f.branch} が${emptyText(f)}で、流れの終わりが空`, evidence: [ev("final", `${f.branch} ${emptyText(f)}`)] } : null;
    },
    assess: hindering,
  },
  {
    id: "work.promotion.dengSanTian", when: { domain: "work", subtypes: ["promotion"] },
    reading: { axis: "opportunity", key: "dengSanTian", label: "登三天（三伝 辰午申）", level: "direct",
      citations: [D2("例53", "原文", "登三天（三伝が辰午申）、本来は昇遷の象である")] },
    conditions: (i) => isDengSanTian(i) ? { detected: "三伝が辰→午→申と登る（登三天）", evidence: [ev("transmissions", "辰・午・申")] } : null,
    assess: favoring,
  },
  {
    id: "work.promotion.gateNotPassed", when: { domain: "work", subtypes: ["promotion"] },
    reading: { axis: "trajectory", key: "gateNotPassed", label: "登るが関（日支）を過ぎない", level: "direct",
      citations: [D2("例53", "原文", "ただ登るに関を過ぎずを嫌う。関とは子日のことである。既に関を過ぎずとは、昇遷は難しい")] },
    conditions: (i) => {
      if (!isDengSanTian(i) || !i.passage) return null;
      const db = i.facts.basic.dayBranch;
      const passed = i.passage.steps.flatMap((s) => s.passed);
      if (passed.includes(db) || transmissionBranches(i).includes(db)) return null;
      return { detected: `三伝は登るが、関（日支 ${db}）を通らない`, evidence: [ev("dayBranch", db), ev("passage", passed.join("・"))] };
    },
    assess: hindering,
  },
  {
    id: "work.promotion.passesDayStem", when: { domain: "work", subtypes: ["promotion"] },
    reading: { axis: "trajectory", key: "passesDayStem", label: "三伝が日干（身）を通り過ぎる", level: "combined",
      citations: [D2("例53", "訳注", "初伝辰から中伝午へ遷るのに、巳（丙日干）を通り過ぎてしまう…身すなわち日干には到達するのですが行き過ぎてしまい")] },
    conditions: (i) => {
      const step = i.passage?.steps.find((s) => s.passed.includes(i.lodgingBranch));
      if (!step) return null;
      return { detected: `三伝が${step.from}から${step.to}へ移るときに日干の寄宮 ${i.lodgingBranch} を通り過ぎる（本人の位置を越えて進む）`,
        evidence: [ev("passage", `${step.from}→${step.to} の間に ${step.passed.join("・")}`), ev("lodgingBranch", i.lodgingBranch)] };
    },
    assess: hindering,
  },
  {
    id: "work.promotion.climbFromChild", when: { domain: "work", subtypes: ["promotion"] },
    reading: { axis: "trajectory", key: "climbFromChild", label: "子孫から登り、身に及んで止まる", level: "direct",
      citations: [D2("例53", "原文", "辰が年命であり、丙火の子孫とする。子孫から登三天となるのは身に及んでそこで止まるということである")] },
    conditions: (i) => {
      const n = i.comparison.path.initial;
      const step = i.passage?.steps.find((s) => s.passed.includes(i.lodgingBranch));
      if (n.sixRelation !== "子孫" || i.passage?.direction !== "forward" || !step) return null;
      return { detected: `初伝 ${n.branch} が子孫で、そこから登る流れが日干の寄宮 ${i.lodgingBranch} に及んで越えていく`,
        evidence: [ev("sixRelation", `初伝 ${n.branch}＝子孫`), ev("passage", `${step.from}→${step.to} の間に ${step.passed.join("・")}`)] };
    },
    assess: hindering,
  },
  {
    id: "work.promotion.natalAtInitial", when: { domain: "work", subtypes: ["promotion"] },
    reading: { axis: "trajectory", key: "natalAtInitial", label: "初伝が年命（初伝にとどまる）", level: "combined",
      citations: [D2("例53", "訳注", "初伝が年命であることから初伝にとどまることになり、昇進には至らない")] },
    conditions: (i) => {
      const l = linkAt(i.subjectLinks, "self", isPosition("initial"));
      if (!l) return null;
      return { detected: `本人の年命 ${l.branch} が初伝にある`, evidence: [ev("identityLink", `年命 self → 初伝 ${l.branch}`)] };
    },
    assess: (i) => i.passage?.steps.some((s) => s.passed.includes(i.lodgingBranch))
      ? { direction: "hindering", note: "三伝が日干を通り過ぎる流れと組んで、初伝にとどまる（例53 訳注）" }
      : { direction: "neutral", note: "日干を通り過ぎる流れがないので、初伝にとどまる読みは成り立たない" },
  },
  {
    id: "work.taiSuiPetition", when: { domain: "work" },
    reading: { axis: "opportunity", key: "taiSuiPetition", label: "日上に太歳が来て朱雀（上申書）", level: "direct",
      citations: [D2("例52", "原文", "およそ日上に太歳が来て朱雀となるのは上申書…日上太歳が朱雀となるのは上申書を欲することになる")] },
    conditions: (i) => {
      const l = linkAt(i.taiSuiLinks, "self", isPosition("standing"));
      if (!l || generalAt(i, l.branch) !== "朱雀") return null;
      return { detected: `太歳 ${l.branch} が干上にあり朱雀が乗る（上申書を出そうとする形）`, evidence: [ev("identityLink", `太歳 self → 干上 ${l.branch}`), ev("heavenlyGeneral", "朱雀")] };
    },
    assess: () => ({ direction: "neutral", note: "上申書そのものの成否は別の読み（太歳の上の日貴）で決まる" }),
  },
  {
    id: "work.officerNobleOverTaiSui", when: { domain: "work" },
    reading: { axis: "obstruction", key: "officerNobleOverTaiSui", label: "官鬼の日貴が太歳に加わる", level: "direct",
      citations: [D2("例52", "原文", "日貴は官鬼で、太歳に加わるのは、その書がでたらめであることを示す")] },
    conditions: (i) => {
      const b = i.taiSuiHeavenOn;
      if (!b || b !== i.noblePair.dayBranch || derivedBranchDayStemStateOf(i.facts, b).sixRelation !== "官鬼") return null;
      return { detected: `太歳の上に日貴（昼貴人支 ${b}）が乗り、それが官鬼`, evidence: [ev("taiSui.heavenOn", b), ev("dayNightNobleBranchPair.dayBranch", b), ev("sixRelation", "官鬼")] };
    },
    assess: hindering,
  },
  {
    id: "work.nobleAbundance", when: { domain: "work" },
    reading: { axis: "obstruction", key: "nobleAbundance", label: "課伝ともに貴人（貴多きは貴とせず）", level: "combined",
      citations: [D2("例52", "原文", "満局みな貴人であるがこれは多くは謀…貴が多いのは貴としないで、十を求めて一を得ず"), D2("例52", "訳注", "課伝倶貴転無依…干上は空亡で貴人は落空")] },
    conditions: nobleAbundance,
    assess: (i) => isEmpty(i.comparison.standing)
      ? { direction: "hindering", note: "干上が空で貴人が落空（例52 訳注）" }
      : { direction: "neutral", note: "干上が空でないので、例52 の「落空」とは同じでない" },
  },
  // ===== 仕事・試験 共通（日禄・三刑・貴人登天門・末伝と初伝） =====
  ...(["work", "exam"] as const).flatMap((domain): Rule[] => [
    {
      id: `${domain}.salaryOnStanding`, when: { domain },
      reading: { axis: "support", key: "salaryOnStanding", label: "日禄扶身（日禄が干上）", level: "direct",
        citations: [D2("例43", "原文", "午は丁の建禄で干上に臨み、日禄扶身")] },
      conditions: (i) => i.comparison.standing.isDaySalary && !isEmpty(i.comparison.standing)
        ? { detected: `日禄 ${i.comparison.standing.branch} が干上にある（日禄扶身）`, evidence: [ev("daySalary", `干上 ${i.comparison.standing.branch}`)] } : null,
      assess: favoring,
    },
    {
      id: `${domain}.emptySalary`, when: { domain },
      reading: { axis: "actualization", key: "emptySalary", label: "日禄が干上にあるが空（虚禄）", level: "direct",
        citations: [D2("例54", "原文", "将仕の禄は虚禄…庚禄は申で、禄は空…日干天地盤みな空禄、空のゆえに武はならず")] },
      conditions: (i) => i.comparison.standing.isDaySalary && isEmpty(i.comparison.standing)
        ? { detected: `日禄 ${i.comparison.standing.branch} が干上にあるが${emptyText(i.comparison.standing)}（虚禄）`, evidence: [ev("daySalary", `干上 ${i.comparison.standing.branch}`), ev("dayXunVoid", emptyText(i.comparison.standing))] } : null,
      assess: domain === "work" ? hindering : (i, subtype) => subtype === "military" ? { direction: "hindering", note: "空のゆえに武はならず（例54 原文）" } : { direction: "neutral", note: "例54 は虚禄でも文では科甲としている" },
    },
    {
      id: `${domain}.threePunishment`, when: { domain },
      reading: { axis: "trajectory", key: "threePunishment", label: "三伝が三刑", level: "combined",
        citations: [D2("例54", "訳注", "三伝は三刑ですから当初の願望はなかなか成就しにくい")] },
      conditions: (i) => {
        const adj = i.comparison.internalRelations.adjacent;
        if (!(adj[1].structural.relations.includes("punishes") && adj[2].structural.relations.includes("punishes"))) return null;
        return { detected: `三伝 ${transmissionBranches(i).join("→")} が順に刑する（三刑）`, evidence: [ev("internalRelation", "初→中 punishes・中→末 punishes")] };
      },
      assess: hindering,
    },
    {
      id: `${domain}.nobleAtHeavenGate`, when: { domain },
      reading: { axis: "support", key: "nobleAtHeavenGate", label: "貴人が亥に乗る（貴人登天門）", level: "combined",
        citations: [D2("例43", "訳注", "亥に貴人がつきこれは貴人登天門で高位につくことを示しています")] },
      conditions: (i) => {
        const where = [...TRANSMISSIONS.map((p) => i.comparison.path[p].branch), ...i.facts.lessons.map((l) => l.upper)];
        return where.includes("亥") && generalAt(i, "亥") === "貴人"
          ? { detected: "天将の貴人が亥（天門）に乗り、課伝に現れる", evidence: [ev("heavenlyGeneral", "亥 貴人")] } : null;
      },
      assess: favoring,
    },
    {
      id: `${domain}.finalOvercomesInitial`, when: { domain },
      reading: { axis: "trajectory", key: "finalOvercomesInitial", label: "末伝が初伝を剋す", level: "inferred",
        citations: [KOZA("p63", "末伝が初伝を剋する場合は吉というが、これは占うきっかけが凶の場合に限る"), D2("例43", "訳注", "末伝戌は子土螣蛇を剋し…終わりもよい")] },
      conditions: (i) => {
        const r = i.comparison.internalRelations.all.find((x) => x.fromPosition === "initial" && x.toPosition === "final");
        if (!r || r.relation !== "overcomeBy") return null;
        return { detected: `末伝 ${r.toBranch} が初伝 ${r.fromBranch} を剋す`, evidence: [ev("internalRelation", `初伝 ${r.fromBranch} ← 末伝 ${r.toBranch} 剋`)] };
      },
      assess: () => ({ direction: "neutral", note: "きっかけが凶の場合に限り吉（講座 p63）。きっかけの吉凶はこの層では決めない" }),
    },
  ]),
  // ===== 試験（exam） =====
  {
    id: "exam.officerInTransmissions", when: { domain: "exam" },
    reading: { axis: "opportunity", key: "officerInTransmissions", label: "官星が三伝に出る", level: "combined",
      citations: [D2("例54", "原文", "末伝巳は朱雀となり長生で、官星学堂、故に科甲である")] },
    conditions: officerDetected, assess: favoring,
  },
  {
    id: "exam.officerEmpty", when: { domain: "exam" },
    reading: { axis: "actualization", key: "officerEmpty", label: "官星が空亡・坐空", level: "combined",
      citations: [D2("例51", "訳注", "試験占いで空亡はあまり気にする必要はありません"), D2("例54", "訳注", "この課は初伝空亡なので、結局武試は受けられないか受けても通らない")] },
    conditions: emptyOfficer, assess: examVoid,
  },
  {
    id: "exam.initialEmpty", when: { domain: "exam" },
    reading: { axis: "actualization", key: "initialEmpty", label: "初伝（発用）が空", level: "combined",
      citations: [D2("例51", "訳注", "発用は空亡ですが、試験占いで空亡はあまり気にする必要はありません"), D2("例54", "訳注", "この課は初伝空亡なので、結局武試は受けられないか受けても通らない")] },
    conditions: (i) => {
      const n = stateAt(i, "initial");
      return isEmpty(n) ? { detected: `初伝 ${n.branch} が${emptyText(n)}`, evidence: [ev("initial", `${n.branch} ${emptyText(n)}`)] } : null;
    },
    assess: examVoid,
  },
  {
    id: "exam.officerStudyHall", when: { domain: "exam" },
    reading: { axis: "opportunity", key: "officerStudyHall", label: "官星学堂（官鬼が日干の長生）", level: "direct",
      citations: [D2("例54", "原文", "末伝巳は朱雀となり長生で、官星学堂、故に科甲である"), D2("例54", "訳注", "官鬼ですが、年命でありさらに日干の長生で学堂でもあります")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => i.comparison.path[p].sixRelation === "官鬼" && i.comparison.path[p].growthStage === "長生");
      if (!ps.length) return null;
      return { detected: `${ps.map((p) => `${POSITION_LABEL[p]} ${i.comparison.path[p].branch}`).join("・")}が官鬼で日干の長生（官星学堂）`,
        evidence: ps.flatMap((p) => [ev("sixRelation", `${POSITION_LABEL[p]} 官鬼`), ev("growthStage", `${POSITION_LABEL[p]} 長生`)]) };
    },
    assess: civilOnly,
  },
  {
    id: "exam.natalOnStudyHall", when: { domain: "exam" },
    reading: { axis: "support", key: "natalOnStudyHall", label: "年命が官星学堂の位置にある", level: "combined",
      citations: [D2("例54", "訳注", "官鬼ですが、年命でありさらに日干の長生で学堂でもあります。これだけそろえば文に生きるべき")] },
    conditions: (i) => {
      const l = i.subjectLinks.find((x) => x.source.derivation === "self" && x.anchor.kind === "position" && x.anchor.position !== "standing" &&
        i.comparison.path[x.anchor.position as TransmissionPosition].sixRelation === "官鬼" && i.comparison.path[x.anchor.position as TransmissionPosition].growthStage === "長生");
      if (!l || l.anchor.kind !== "position") return null;
      return { detected: `本人の年命 ${l.branch} が${POSITION_LABEL[l.anchor.position]}（官鬼・日干の長生）にある`, evidence: [ev("identityLink", `年命 self → ${POSITION_LABEL[l.anchor.position]} ${l.branch}`)] };
    },
    assess: civilOnly,
  },
  {
    id: "exam.suzakuWriting", when: { domain: "exam" },
    reading: { axis: "support", key: "suzakuWriting", label: "朱雀（文章）が三伝に乗る", level: "combined",
      citations: [D2("例54", "訳注", "末伝をみると巳でこれは朱雀です。朱雀は文章であり")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => generalAt(i, i.comparison.path[p].branch) === "朱雀");
      return ps.length ? { detected: `朱雀が${ps.map((p) => `${POSITION_LABEL[p]} ${i.comparison.path[p].branch}`).join("・")}に乗る`, evidence: ps.map((p) => ev("heavenlyGeneral", `${POSITION_LABEL[p]} 朱雀`)) } : null;
    },
    assess: civilOnly,
  },
  {
    id: "exam.qinglongTemple", when: { domain: "exam" },
    reading: { axis: "support", key: "qinglongTemple", label: "青龍が入廟（所属支の寅に乗る）", level: "direct",
      citations: [D2("例54", "原文", "寅上青龍は入廟し、天后は恩沢の神である。よって文を習うによろしい")] },
    conditions: (i) => {
      const ps = TRANSMISSIONS.filter((p) => {
        const pl = heavenlyGeneralPlacementRelationsOf(i.facts, i.comparison.path[p].branch);
        return pl.general === "青龍" && pl.skyBranchMatchesAffiliatedBranch;
      });
      return ps.length ? { detected: `青龍が${ps.map((p) => POSITION_LABEL[p]).join("・")}の寅（青龍の所属支）に乗る`, evidence: [ev("heavenlyGeneralPlacement", "青龍 skyBranch＝所属支 寅")] } : null;
    },
    assess: civilOnly,
  },
  {
    id: "exam.tianKong", when: { domain: "exam" },
    reading: { axis: "support", key: "tianKong", label: "天空（試験では吉神）", level: "combined",
      citations: [D2("例43", "訳注", "天空は奉書の神であり、身を助けます。天空は凶神ですが、試験においては吉神です")] },
    conditions: (i) => {
      const where = [...i.facts.lessons.map((l) => l.upper), ...transmissionBranches(i)].filter((b) => generalAt(i, b) === "天空");
      return where.length ? { detected: `天空が課伝の ${[...new Set(where)].join("・")} に乗る`, evidence: [ev("heavenlyGeneral", "天空")] } : null;
    },
    assess: favoring,
  },
  {
    id: "exam.natalFlankedByNobles", when: { domain: "exam" },
    reading: { axis: "support", key: "natalFlankedByNobles", label: "昼夜貴人が年命をはさむ", level: "direct",
      citations: [D2("例51", "原文", "寅上辰は年命であり、昼夜貴人がこれをはさむ、故に必ず及第する")] },
    conditions: (i) => {
      const b = i.subjectNatalBranch;
      if (!b || !isFlankedBy(b, i.noblePair.dayBranch, i.noblePair.nightBranch)) return null;
      return { detected: `本人の年命 ${b}（地盤 ${i.facts.plate.earthUnder[b]} の上）を昼夜貴人支 ${i.noblePair.nightBranch}・${i.noblePair.dayBranch} が両側からはさむ`,
        evidence: [ev("natalYear", b), ev("dayNightNobleBranchPair", `${i.noblePair.dayBranch}・${i.noblePair.nightBranch}`), ev("adjacency", "両隣")] };
    },
    assess: favoring,
  },
  {
    id: "exam.nobleAbundance", when: { domain: "exam" },
    reading: { axis: "support", key: "nobleAbundance", label: "課伝ともに昼夜貴人", level: "combined",
      citations: [D2("例51", "訳注", "まさに昼夜貴人が一課二課に表れ、しかも中伝末伝にありますので、合格は疑いありません")] },
    conditions: nobleAbundance, assess: favoring,
  },
  {
    id: "exam.dayNobleAtFinal", when: { domain: "exam" },
    reading: { axis: "trajectory", key: "dayNobleAtFinal", label: "日貴が末伝（先に暗く後に明るい）", level: "direct",
      citations: [D2("例51", "原文", "日貴は末伝にある。先に暗く後に明るい")] },
    conditions: (i) => i.comparison.path.final.branch === i.noblePair.dayBranch
      ? { detected: `日貴（昼貴人支 ${i.noblePair.dayBranch}）が末伝にある（終わりに向かって明るくなる流れ）`, evidence: [ev("final", i.noblePair.dayBranch), ev("dayNightNobleBranchPair.dayBranch", i.noblePair.dayBranch)] } : null,
    assess: favoring,
  },
  {
    id: "exam.oppositeNobleOnStanding", when: { domain: "exam" },
    reading: { axis: "support", key: "oppositeNobleOnStanding", label: "天将盤で採用されなかった側の貴人支が干上（例51 の幕貴）", level: "inferred",
      citations: [D2("例51", "原文", "太陰卯に乗じて幕貴となり、日干に加わる")] },
    conditions: (i) => {
      const other = i.noblePair.selected.period === "day" ? i.noblePair.nightBranch : i.noblePair.dayBranch;
      return i.comparison.standing.branch === other
        ? { detected: `干上 ${other} は、天将盤で採用されなかった側（${i.noblePair.selected.period === "day" ? "夜" : "昼"}）の貴人支`, evidence: [ev("standing", other), ev("dayNightNobleBranchPair", `採用 ${i.noblePair.selected.branch}`)] } : null;
    },
    assess: favoring,
  },
  {
    id: "exam.military.metalVoid", when: { domain: "exam" },
    reading: { axis: "obstruction", key: "metalVoid", label: "金（申酉）が空亡", level: "direct",
      citations: [D2("例54", "原文", "武職兵権というのはただ金が盛んなのが必要で、金がなければ男で武であろうか"), D2("例54", "訳注", "申酉空亡ですから、この課は金が全くの空亡ということで、武に向かない")] },
    conditions: (i) => i.facts.xun.voidBranches.join("") === "申酉"
      ? { detected: "旬空が申酉で、金がすべて空亡", evidence: [ev("dayXunVoid", "申・酉")] } : null,
    assess: militaryOnly,
  },
  {
    id: "exam.military.taiChangAbsent", when: { domain: "exam", subtypes: ["military"] },
    reading: { axis: "obstruction", key: "taiChangAbsent", label: "太常が三伝に入らない", level: "direct",
      citations: [D2("例54", "原文", "太常は入伝せず、よって武は不可")] },
    conditions: (i) => transmissionBranches(i).every((b) => generalAt(i, b) !== "太常")
      ? { detected: `三伝（${transmissionBranches(i).join("・")}）に太常が乗らない`, evidence: [ev("heavenlyGeneral", "三伝に太常なし")] } : null,
    assess: hindering,
  },
];

/** 仕事・試験の DOMAIN 判断。monthBranch は旺衰を使う場合の月支（今回のルールでは使わない） */
export function evaluateCareerDomain(facts: InterpretationFacts, context: InterpretationContext, monthBranch?: Branch | null): DomainResult {
  if (context.domain !== "work" && context.domain !== "exam") throw new Error(`仕事・試験以外の DOMAIN です: ${context.domain}`);
  const subject = context.domain === "exam" ? "試験" : context.subtype === "promotion" ? "昇進" : "仕事";
  const missing: DomainMissingFact[] = [];
  const ctx = anchorResolutionContextOf(facts, monthBranch);
  const comparison = ctx.comparison;
  if (!comparison) {
    return summarizeDomainReadings(context.domain, context.subtype, context.goal, [], [{ key: "transmissions", detail: "三伝が未確定なので判断できない" }], subject);
  }
  // 本人の本命（subjectPersonId の natalYear）
  let subjectNatalBranch: Branch | null = null;
  let subjectLinks: readonly IdentityLink[] = [];
  if (context.subjectPersonId !== undefined) {
    const src: ContextBranchSource = { kind: "personNatalYear", personId: context.subjectPersonId };
    const r = resolveContextBranch(context, src);
    if (r.status === "resolved") {
      subjectNatalBranch = r.branch;
      subjectLinks = collectIdentityLinks(ctx, context, [src]).links;
    } else missing.push({ key: "natalYear", detail: `本人の本命・年命がない（${r.reason}）ので年命の読みは省略` });
  } else missing.push({ key: "natalYear", detail: "本人（subjectPersonId）の本命・年命がないので年命の読みは省略" });
  // 太歳
  let taiSuiLinks: readonly IdentityLink[] = [];
  let taiSuiHeavenOn: Branch | null = null;
  if (context.taiSui) {
    const src: ContextBranchSource = { kind: "taiSui" };
    taiSuiLinks = collectIdentityLinks(ctx, context, [src]).links;
    const on = resolveDerivedContextBranch(facts, context, { source: src, derivation: "heavenOn" });
    taiSuiHeavenOn = on.status === "resolved" ? on.branch : null;
  } else missing.push({ key: "taiSui", detail: "太歳がないので太歳の読みは省略" });
  missing.push({ key: "xingNian", detail: "行年は規則が未確定なので、行年を使う読み（例43「行年ともに白虎」・例51「行年午上に申」など）は未対応" });
  missing.push({ key: "timing", detail: "時期（応期）の読みは未対応" });
  const input: CareerDomainInput = {
    facts, ctx, comparison,
    passage: transmissionPassageOf({ initial: comparison.path.initial.branch, middle: comparison.path.middle.branch, final: comparison.path.final.branch }, comparison.movementPattern),
    noblePair: dayNightNobleBranchPairStateOf(facts),
    lodgingBranch: facts.lessons[0].lowerBranch,
    subjectNatalBranch, subjectLinks, taiSuiLinks, taiSuiHeavenOn,
  };
  const readings = evaluateDomainRules(CAREER_RULES, input, context.domain, context.subtype, context.goal);
  return summarizeDomainReadings(context.domain, context.subtype, context.goal, readings, missing, subject);
}

/** 監査用: ルールの一覧（ID・軸・推論レベル・出典） */
export const CAREER_DOMAIN_RULES: readonly Pick<Rule, "id" | "when" | "reading">[] = CAREER_RULES.map(({ id, when, reading }) => ({ id, when, reading }));
