// src/lib/liuren/interpretation/basicReadings.ts
//
// 役割（基本判断 BASIC READING）:
//   FACT と占的別判断（DOMAIN）の間の層。占的によらず、四課・三伝・占時・空亡・天将などの盤の事実に、
//   『六壬神課講座』（監修者のテキスト）が明記した基本の読みを当てはめて並べる。新しい FACT の計算はしない（既存の関数を読むだけ）。
//   根拠は『六壬神課講座』と『六壬大全』に限る。『大全』は本文を確認できない規則を入れない（今回は本文を確認できないので『大全』の規則は0件）。
//
//   方針（監修方針）:
//     ・読みの文は講座の文をそのまま引用する（言い換えない）。原典の記述を超えた解釈を足さない
//     ・原典が吉凶を明示した読みは、その評価（evaluation）を保持する。ただし占的固有の成否へは変換しない（DOMAIN の向き direction は持たない）
//     ・単一の総合吉凶スコアは作らない。読みどうしを相殺しない
//     ・空亡: 旬空（浮天空亡）・坐空（落底空亡）・天空を区別する（講座 p66 の浮天空亡・落底空亡の定義）。
//            三伝全部空亡（p66）は旬空だけで判定し、坐空を含めるかは原典で確認できるまで保留（held）にする
//     ・応期（p65）: 初伝が太歳・月建・日支のとき講座の期間を示す。初伝が空亡ならその事実を併記し、目的の達成時期とは断定しない。
//            「初伝が日干の場合」は、支である初伝と干である日干の対応（寄宮か）が講座に書かれていないので保留
//     ・条件の意味が講座から一つに決まらない読み（吉将・凶将の区分・「地を得る」・初伝が「刑冲破害を受ける」相手）は保留
//   三伝の役割は roleRules.ts の汎用 ROLE 規則（初伝＝発端・末伝＝帰計）をそのまま使い、中伝は講座 p58 の移易門を足す。

import { STEM_ELEMENT } from "../constants";
import type { Branch, HeavenlyGeneral, SixRelation } from "../types";
import { initialOriginOf } from "./initialTransmissionOrigin";
import { yimaOf } from "./markers";
import { relationBetween, threeHarmonyOf } from "./relations";
import type { InterpretationContext } from "./roles";
import { SEMANTIC_ROLE_RULES } from "./roleRules";
import { growthStageOfStem, rulingElementOfMonth, seasonalStrengthOf } from "./states";
import type { InterpretationFacts, StructuralRelation, TransmissionPosition } from "./types";

export type BasicReadingCategory =
  | "role" | "divination" | "dayStemBranch" | "fourLessons" | "initial" | "transmissionFlow" | "void" | "relation" | "lessonForm" | "symbolism" | "timing";

export interface BasicCitation {
  source: "『六壬神課講座』";
  page: string;
  quote: string;
}

/** 基本判断1件（占的によらない。DOMAIN の向き direction は持たない） */
export interface BasicReading {
  id: string;
  category: BasicReadingCategory;
  /** この盤で当てはまった事実（盤の値を含む） */
  detected: string;
  /** 講座の読み（原文のまま） */
  reading: string;
  /** 原典が明示した評価（「吉」「凶」「よくない」など原文の語）。明示がなければ null */
  evaluation: string | null;
  /** 原典の但し書き・この層での注意（原文の範囲を超えないこと） */
  note?: string;
  evidence: readonly { fact: string; detail: string }[];
  citations: readonly BasicCitation[];
}

/** 保留した基本判断（この盤で条件が問題になったものだけ。理由つき） */
export interface HeldBasicReading {
  id: string;
  detected: string;
  reason: string;
  citations: readonly BasicCitation[];
}

export interface BasicReadingResult {
  readings: readonly BasicReading[];
  held: readonly HeldBasicReading[];
}

const K = (page: string, quote: string): BasicCitation => ({ source: "『六壬神課講座』", page, quote });
const POS: readonly TransmissionPosition[] = ["initial", "middle", "final"];
const POS_JA: Record<TransmissionPosition, string> = { initial: "初伝", middle: "中伝", final: "末伝" };

/** 講座 p55 六親の象意 */
const SIX_RELATION_SYMBOLISM: Record<SixRelation, string> = {
  子孫: "子供、目下、弟子、僧侶、医者、薬、日用品、占い、生産",
  父母: "父母、目上、師匠、文書、印鑑、衣服、旅行、乗り物",
  妻財: "妻、使用人、商売、財産、事業、男性にとっての結婚",
  官鬼: "夫、悪人、役人、裁判、盗難、危険物、死体、病気、怪異、苦労",
  兄弟: "兄弟、同僚、競争、戦争、武器、賭博、嫉妬、散財",
};
/** 講座 p56 十二天将象意（色・数を含む表の行のまま） */
const GENERAL_SYMBOLISM: Record<HeavenlyGeneral, string> = {
  貴人: "高貴、給料、昇進、文章、長、福徳、宝石、牛、寒熱、黄、八",
  螣蛇: "文字、災禍、怪異、心配、小人、悪人、蛇、腫物、血、紫、四",
  朱雀: "知恵、華麗、学者、文書、贅沢、羽毛、果物、午、火気、赤、九",
  六合: "交易、信用、仲人、婚姻、友人、秘密、製造、材料、塩、青、六",
  勾陳: "戦争、兵、警察、遅滞、愚直、貧困、死者、霊、けもの、青黒、五",
  青龍: "活動、権力、金銭、儀式、商売、転職、収穫、狐狸、黄赤、七",
  天空: "損失、召使、無駄な努力、詐欺、消耗、貧乏、合格、黄、五",
  白虎: "果断、残酷、病気、怪我、武器、流血、交通、栗色、七",
  太常: "忍耐、日常、田園、酒食、衣服、転職、昇進、黄、八",
  玄武: "陰険、横領、盗賊、邪なこと、陰謀、水神、豆類、黒、四",
  太陰: "陰私、秘密、消極、引退、潔白、同僚、清潔、黄、六",
  天后: "柔軟、耽溺、女性、妻、結婚、男女関係、傷害、白、九",
};
/** 講座 pp.52–54 支の関係の象意（原文のまま） */
const RELATION_SYMBOLISM: Partial<Record<StructuralRelation, { name: string; text: string; page: string }>> = {
  punishes: { name: "刑", text: "刑ははっきりした悪い関係", page: "p52" },
  punishedBy: { name: "刑", text: "刑ははっきりした悪い関係", page: "p52" },
  clashes: { name: "冲", text: "やはり悪い意味を含むが、変動するという意味が強い", page: "p53" },
  breaks: { name: "破", text: "破も悪い意味があるが、大六壬ではあまり重視しない", page: "p53" },
  harms: { name: "害", text: "害も悪い関係だが、物事の障害を意味する。悪さでは刑や剋より弱い", page: "p53" },
  combines: { name: "合", text: "合はしばり合う関係で、通常良い意味となる", page: "p54" },
};
const BAD: readonly StructuralRelation[] = ["overcomes", "overcomeBy", "punishes", "punishedBy", "clashes", "breaks", "harms"];
const MENG: readonly Branch[] = ["寅", "巳", "申", "亥"], ZHONG: readonly Branch[] = ["子", "卯", "午", "酉"];

const rel = (a: Branch | string, b: Branch | string) => relationBetween(a as Branch, b as Branch).relations;
const has = (rs: readonly StructuralRelation[], ...ks: StructuralRelation[]) => ks.some((k) => rs.includes(k));
const relNames = (rs: readonly StructuralRelation[]) => [...new Set(rs.map((r) => (r === "overcomes" || r === "overcomeBy" ? "剋" : RELATION_SYMBOLISM[r]?.name)).filter(Boolean))].join("・");

/**
 * 盤の基本判断（占的によらない）。monthBranch は月建（日時入力の月支。なければ月建の読みはしない）。
 * context は太歳（taiSui。明示入力だけ）を使う。DOMAIN の結果は変えない。
 */
export function basicReadingsOf(facts: InterpretationFacts, monthBranch?: Branch | null, context?: Pick<InterpretationContext, "taiSui">): BasicReadingResult {
  const out: BasicReading[] = [], held: HeldBasicReading[] = [];
  const add = (r: BasicReading) => out.push(r);
  const ts = facts.transmissions;
  const { dayStem, dayBranch, divinationBranch } = facts.basic;
  const lodging = facts.lessons[0].lowerBranch, v = facts.xun.voidBranches;
  const isVoid = (b: Branch) => v.includes(b);
  const earth = (b: Branch) => facts.plate.earthUnder[b];
  const gen = (b: Branch) => facts.generals.generalOn[b];

  // ---- 三伝の役割（roleRules.ts の汎用 ROLE 規則と、講座 p58 の移易門） ----
  if (ts) {
    for (const rule of SEMANTIC_ROLE_RULES.filter((x) => Object.keys(x.when).length === 0 && x.source.kind === "position")) {
      const p = (rule.source as { kind: "position"; position: TransmissionPosition }).position, t = ts[POS.indexOf(p)];
      const ev = rule.evidence[0], src = ev.source;
      add({ id: `basic.role.${p}`, category: "role", detected: `${POS_JA[p]} ${t.branch}`, reading: ev.detail, evaluation: null,
        evidence: [{ fact: `${p}`, detail: t.branch }], citations: [K(src?.locator ?? "", `${src?.note ?? ""}（ROLE 規則 ${rule.id}）`)] });
    }
    add({ id: "basic.role.middle", category: "role", detected: `中伝 ${ts[1].branch}`, reading: "中伝は事件の経過を示す", evaluation: null,
      evidence: [{ fact: "middle", detail: ts[1].branch }], citations: [K("p58", "移易門とは中伝をいう。中伝は事件の経過を示す。")] });
  }

  // ---- 占時（講座 p60） ----
  {
    const d = divinationBranch, dr = rel(dayStem, d);
    if (has(dr, "overcomes")) add({ id: "basic.divination.wealth", category: "divination", detected: `占時 ${d} が日干 ${dayStem} の財`, reading: "お金にかんすることが多い。また、妻のことの場合もある。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: d }], citations: [K("p60", "占時が日干の財にあたる場合は、お金にかんすることが多い。また、妻のことの場合もある。")] });
    if (yimaOf(dayBranch) === d) add({ id: "basic.divination.yima", category: "divination", detected: `占時 ${d} が駅馬`, reading: "道路、移動、旅行など。（信憑性うすい）事が早く進むなど。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: d }], citations: [K("p60", "占時が駅馬の場合は、道路、移動、旅行など。（信憑性うすい）事が早く進むなど。")], note: "駅馬は日支から求めた（既存の駅馬の計算）" });
    const lr = rel(d, lodging), br = rel(d, dayBranch);
    if (has(lr, "combines")) add({ id: "basic.divination.lodgingCombine", category: "divination", detected: `占時 ${d} と日干寄宮 ${lodging} が合`, reading: "夫婦、家庭、友人関係などを意味することがある。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: `${d}・${lodging}` }], citations: [K("p60", "占時と日干寄宮が合の場合は、夫婦、家庭、友人関係などを意味することがある。")] });
    if (has(lr, "punishes", "punishedBy", "clashes", "harms", "breaks")) add({ id: "basic.divination.lodgingOuter", category: "divination", detected: `占時 ${d} と日干寄宮 ${lodging} が${relNames(lr.filter((x) => !["overcomes", "overcomeBy"].includes(x)))}`, reading: "おもに外事とされる。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: `${d}・${lodging}` }], citations: [K("p60", "占時と日干寄宮が刑、冲、害、破の場合は、おもに外事とされる。")] });
    if (has(br, "punishes", "punishedBy", "clashes", "harms", "breaks")) add({ id: "basic.divination.branchInner", category: "divination", detected: `占時 ${d} と日支 ${dayBranch} が${relNames(br.filter((x) => !["overcomes", "overcomeBy"].includes(x)))}`, reading: "内事。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: `${d}・${dayBranch}` }], citations: [K("p60", "日支と刑、冲、破害の場合は内事。")] });
    if (isVoid(d)) add({ id: "basic.divination.void", category: "divination", detected: `占時 ${d} が旬空`, reading: "はっきりとしないことが多い。また十二天将の象意を空しくする。", evaluation: null,
      evidence: [{ fact: "divinationBranch", detail: `${d} 旬空` }], citations: [K("p60", "占時が空亡のときは、はっきりとしないことが多い。また十二天将の象意を空しくする。")] });
  }

  // ---- 日干支（講座 p61） ----
  {
    const s = facts.lessons[0].upper, r = rel(dayStem, s);
    if (has(r, "generatedBy")) add({ id: "basic.stem.generatedByStanding", category: "dayStemBranch", detected: `干上神 ${s} が日干 ${dayStem} を生ず`, reading: "日干が干上神（一課）から生じられるのは吉", evaluation: "吉",
      evidence: [{ fact: "lesson1.upper", detail: s }], citations: [K("p61", "日干が干上神（一課）から生じられるのは吉だが、日干が干上神に剋されたり、洩らされたりするのはよくない。")] });
    if (has(r, "overcomeBy") || has(r, "generates")) add({ id: "basic.stem.hurtByStanding", category: "dayStemBranch", detected: `日干 ${dayStem} が干上神 ${s} に${has(r, "overcomeBy") ? "剋される" : "洩らされる"}`, reading: "日干が干上神に剋されたり、洩らされたりするのはよくない。", evaluation: "よくない",
      evidence: [{ fact: "lesson1.upper", detail: s }], citations: [K("p61", "日干が干上神（一課）から生じられるのは吉だが、日干が干上神に剋されたり、洩らされたりするのはよくない。")] });
    if (monthBranch) {
      const st = seasonalStrengthOf(STEM_ELEMENT[dayStem], rulingElementOfMonth(monthBranch));
      if (st === "旺" || st === "相") add({ id: "basic.stem.seasonal", category: "dayStemBranch", detected: `日干 ${dayStem} が月建 ${monthBranch} で${st}`, reading: "日干が季節によって旺相しているのは概して吉だが、他課や三伝との関係に気をつける必要がある。", evaluation: "概して吉",
        evidence: [{ fact: "seasonal", detail: `${dayStem} ${st}` }], citations: [K("p61", "日干が季節によって旺相しているのは概して吉だが、他課や三伝との関係に気をつける必要がある。")] });
    }
  }

  // ---- 四課（講座 p62） ----
  {
    const L = facts.lessons.map((l) => l.upper);
    for (const [a, b] of [[0, 3], [1, 2]] as const) {
      const r = rel(L[a], L[b]).filter((x) => BAD.includes(x));
      if (r.length) add({ id: `basic.lessons.discord${a + 1}${b + 1}`, category: "fourLessons", detected: `${a + 1}課 ${L[a]} と ${b + 1}課 ${L[b]} が${relNames(r)}`, reading: "家庭の不和やもめごとが多い。", evaluation: null,
        note: "「関係が悪い」は、講座51〜53頁が悪い関係とする剋・刑・冲・破・害で見た", evidence: [{ fact: `lessons${a + 1}${b + 1}`, detail: `${L[a]}・${L[b]}` }],
        citations: [K("p62", "一課と四課、あるいは二課と三課の関係が悪いときは、家庭の不和やもめごとが多い。")] });
    }
    const o = initialOriginOf(facts);
    if (o && (o.kind === "uniqueLesson" || o.kind === "ruleLesson")) {
      const outer = o.lesson <= 2;
      add({ id: "basic.lessons.origin", category: "fourLessons", detected: `初伝が${o.lesson}課から発用`, reading: outer ? "主として外で起きた事や自分に関すること" : "主として内輪の事や相手に関することが原因", evaluation: null,
        note: "講座は「ただ必ずしもそうとはいえない場合もある」とする", evidence: [{ fact: "initialOrigin", detail: `${o.lesson}課` }],
        citations: [K("p62", "一課、二課が初伝のときは主として外で起きた事や自分に関すること、三課、四課が初伝のときは主として内輪の事や相手に関することが原因。ただ必ずしもそうとはいえない場合もある。")] });
      const dir = facts.generals.direction;
      if ((outer && dir === "順") || (!outer && dir === "逆")) add({ id: "basic.initial.speed", category: "initial", detected: `${o.lesson}課が発用で、貴人が${dir}行`, reading: outer ? "物事は速くすすみ" : "物事の進みは遅い", evaluation: null,
        evidence: [{ fact: "initialOrigin", detail: `${o.lesson}課・${dir}` }], citations: [K("p64", "一課または二課が発用で、貴人が順行であれば、物事は速くすすみ、三課または四課が発用で、貴人が逆行であれば、物事の進みは遅い。")] });
    }
  }

  if (ts) {
    const [I, M, F] = ts;
    // ---- 初伝（発用。講座 p64・p65） ----
    {
      const e = earth(I.branch), r = rel(I.branch, e);
      if (has(r, "overcomes")) add({ id: "basic.initial.overcomesBelow", category: "initial", detected: `初伝 ${I.branch} がその地盤支 ${e} を剋す（上剋下）`, reading: "物事は外部で起き、偉い人、年をとった人によく、また動くに吉。", evaluation: "動くに吉",
        evidence: [{ fact: "initial.earth", detail: e }], citations: [K("p64", "初伝が上剋下（初伝がその地盤支を剋する）ならば、物事は外部で起き、偉い人、年をとった人によく、また動くに吉。")] });
      if (has(r, "overcomeBy")) add({ id: "basic.initial.overcomeFromBelow", category: "initial", detected: `初伝 ${I.branch} がその地盤支 ${e} から剋される（下剋上）`, reading: "物事は内輪で置き、若い人、身分の低い人によく、また先に動かず後で動いた方が吉。", evaluation: "後で動いた方が吉",
        evidence: [{ fact: "initial.earth", detail: e }], citations: [K("p64", "初伝が下剋上（初伝がその地盤支から剋される）ならば、物事は内輪で置き、若い人、身分の低い人によく、また先に動かず後で動いた方が吉。")] });
      const g = growthStageOfStem(dayStem, I.branch), note = "十二長生は日干基準で見た（既存の計算。疾病の規則と同じ見方）";
      if (g === "長生") {
        const ge = growthStageOfStem(dayStem, e);
        add({ id: ge === "墓" ? "basic.initial.growthTombBelow" : "basic.initial.growth", category: "initial", detected: `初伝 ${I.branch} が日干 ${dayStem} の長生${ge === "墓" ? `で、下神 ${e} が墓` : ""}`, reading: ge === "墓" ? "古い事が発端。" : "順調。", evaluation: ge === "墓" ? null : "順調", note,
          evidence: [{ fact: "initial.growthStage", detail: g }], citations: [K("p64", "初伝が長生の場合は順調。初伝が長生でその下神が墓ならば古い事が発端。")] });
      }
      if (g === "墓") add({ id: "basic.initial.tomb", category: "initial", detected: `初伝 ${I.branch} が日干 ${dayStem} の墓`, reading: "事が進みません。", evaluation: null, note: `${note}。講座の「病占の場合はとくに凶」は占的別判断なので、ここでは使わない`,
        evidence: [{ fact: "initial.growthStage", detail: g }], citations: [K("p64", "初伝が墓の場合は事が進みません。病占の場合はとくに凶。")] });
      if (g === "死" || g === "絶") add({ id: `basic.initial.${g === "死" ? "death" : "end"}`, category: "initial", detected: `初伝 ${I.branch} が日干 ${dayStem} の${g}`, reading: g === "死" ? "事態の収拾は手遅れ" : "もう事態は終わっている", evaluation: null, note,
        evidence: [{ fact: "initial.growthStage", detail: g }], citations: [K("p64", "初伝が死の場合は事態の収拾は手遅れで、絶の場合はもう事態は終わっている。")] });
      if (isVoid(I.branch)) add({ id: "basic.initial.void", category: "initial", detected: `初伝 ${I.branch} が旬空`, reading: "事の発端がはっきりせず、無意味になることもある。", evaluation: null,
        evidence: [{ fact: "initial.isVoid", detail: "旬空" }], citations: [K("p64", "初伝が空亡の場合は、事の発端がはっきりせず、無意味になることもある。")] });
      // 刑冲破害を「受ける」相手が講座に書かれていないので保留
      if (has(r, "clashes", "punishes", "punishedBy", "breaks", "harms")) held.push({ id: "basic.initial.harmed", detected: `初伝 ${I.branch} とその地盤支 ${e} が${relNames(r.filter((x) => BAD.includes(x) && x !== "overcomes" && x !== "overcomeBy"))}`,
        reason: "講座は「初伝が刑冲破害を受けるとき」とするが、何から受けるか（地盤支・日干支など）が書かれていないので保留", citations: [K("p64", "初伝が刑冲破害を受けるときはやはり順調にはことは運ばない。（破や害は軽い）")] });
      const sr = rel(I.branch, dayStem), br = rel(I.branch, dayBranch), dr = rel(I.branch, divinationBranch), fr = rel(I.branch, F.branch);
      if (has(sr, "overcomes")) add({ id: "basic.initial.overcomesStem", category: "initial", detected: `初伝 ${I.branch} が日干 ${dayStem} を剋す`, reading: "本人に不利。", evaluation: "不利", note: "講座は「占的による」とする",
        evidence: [{ fact: "initial", detail: I.branch }], citations: [K("p65", "初伝が日干を剋すのは、本人に不利。初伝が日支を剋すのは家に不安がある。（占的による）")] });
      if (has(br, "overcomes")) add({ id: "basic.initial.overcomesBranch", category: "initial", detected: `初伝 ${I.branch} が日支 ${dayBranch} を剋す`, reading: "家に不安がある。", evaluation: null, note: "講座は「占的による」とする",
        evidence: [{ fact: "initial", detail: I.branch }], citations: [K("p65", "初伝が日干を剋すのは、本人に不利。初伝が日支を剋すのは家に不安がある。（占的による）")] });
      if (has(dr, "overcomes")) add({ id: "basic.initial.overcomesDivination", category: "initial", detected: `初伝 ${I.branch} が占時 ${divinationBranch} を剋す`, reading: "突然の出来事で驚くことが多い。", evaluation: null, note: "講座は「これも常識的に判断すべし」とする",
        evidence: [{ fact: "initial", detail: I.branch }], citations: [K("p65", "初伝が時支を剋すのは、突然の出来事で驚くことが多い。（これも常識的に判断すべし）")] });
      if (has(fr, "overcomes")) add({ id: "basic.initial.overcomesFinal", category: "initial", detected: `初伝 ${I.branch} が末伝 ${F.branch} を剋す`, reading: "終わりがよくないかはっきりしない。", evaluation: null, note: "講座は「初伝と末伝の関係は諸説あり」とする",
        evidence: [{ fact: "initial→final", detail: "剋" }], citations: [K("p65", "初伝が末伝を剋すのは、終わりがよくないかはっきりしない。（初伝と末伝の関係は諸説あり）")] });
    }
    // ---- 三伝の生剋（講座 p63） ----
    {
      const im = rel(I.branch, M.branch), mf = rel(M.branch, F.branch), ifr = rel(I.branch, F.branch);
      const C63 = "一般的に、初伝が中伝を生じ、中伝が末伝を生じる場合は吉、初伝が中伝を剋し、中伝が末伝を剋する場合は凶とされる。また、初伝が末伝を剋する場合は凶、末伝が初伝を剋する場合は吉というが、これは占うきっかけが凶の場合に限る。";
      if (has(im, "generates") && has(mf, "generates")) add({ id: "basic.flow.generating", category: "transmissionFlow", detected: `初伝 ${I.branch} が中伝 ${M.branch} を生じ、中伝が末伝 ${F.branch} を生ず`, reading: "吉", evaluation: "吉", note: "講座は「一般的に」とする",
        evidence: [{ fact: "transmissions", detail: "初→中→末 生" }], citations: [K("p63", C63)] });
      if (has(im, "overcomes") && has(mf, "overcomes")) add({ id: "basic.flow.overcoming", category: "transmissionFlow", detected: `初伝 ${I.branch} が中伝 ${M.branch} を剋し、中伝が末伝 ${F.branch} を剋す`, reading: "凶", evaluation: "凶", note: "講座は「一般的に」とする",
        evidence: [{ fact: "transmissions", detail: "初→中→末 剋" }], citations: [K("p63", C63)] });
      if (has(ifr, "overcomes")) add({ id: "basic.flow.initialOvercomesFinal", category: "transmissionFlow", detected: `初伝 ${I.branch} が末伝 ${F.branch} を剋す`, reading: "凶", evaluation: "凶", note: "講座は「これは占うきっかけが凶の場合に限る」と続ける（きっかけの吉凶はこの層では決めない）",
        evidence: [{ fact: "initial→final", detail: "剋" }], citations: [K("p63", C63)] });
      if (has(ifr, "overcomeBy")) add({ id: "basic.flow.finalOvercomesInitial", category: "transmissionFlow", detected: `末伝 ${F.branch} が初伝 ${I.branch} を剋す`, reading: "吉", evaluation: "吉", note: "講座は「これは占うきっかけが凶の場合に限る」とする（きっかけの吉凶はこの層では決めない）",
        evidence: [{ fact: "final→initial", detail: "剋" }], citations: [K("p63", C63)] });
      if (has(ifr, "generates")) add({ id: "basic.flow.forward", category: "transmissionFlow", detected: `初伝 ${I.branch} が末伝 ${F.branch} を生ず`, reading: "順道といい、和合の象。", evaluation: null,
        evidence: [{ fact: "initial→final", detail: "生" }], citations: [K("p63", "初伝が末伝を生じるのは順道といい、和合の象。末伝が初伝を生じるのは逆道といい、悖乱の象。")] });
      if (has(ifr, "generatedBy")) add({ id: "basic.flow.backward", category: "transmissionFlow", detected: `末伝 ${F.branch} が初伝 ${I.branch} を生ず`, reading: "逆道といい、悖乱の象。", evaluation: null,
        evidence: [{ fact: "final→initial", detail: "生" }], citations: [K("p63", "初伝が末伝を生じるのは順道といい、和合の象。末伝が初伝を生じるのは逆道といい、悖乱の象。")] });
      const bs = [I.branch, M.branch, F.branch];
      if (bs.every((b) => MENG.includes(b))) add({ id: "basic.flow.meng", category: "transmissionFlow", detected: `三伝 ${bs.join("・")} がすべて孟神`, reading: "新たなことが発生しやすく", evaluation: null, note: "「三伝が孟神」を三伝すべてが孟神の場合とした",
        evidence: [{ fact: "transmissions", detail: bs.join("") }], citations: [K("p63", "三伝が孟神（寅巳申亥）の場合は新たなことが発生しやすく、仲神（子卯午酉）の場合は古いことがぶり返しやすい。")] });
      if (bs.every((b) => ZHONG.includes(b))) add({ id: "basic.flow.zhong", category: "transmissionFlow", detected: `三伝 ${bs.join("・")} がすべて仲神`, reading: "古いことがぶり返しやすい。", evaluation: null, note: "「三伝が仲神」を三伝すべてが仲神の場合とした",
        evidence: [{ fact: "transmissions", detail: bs.join("") }], citations: [K("p63", "三伝が孟神（寅巳申亥）の場合は新たなことが発生しやすく、仲神（子卯午酉）の場合は古いことがぶり返しやすい。")] });
      // 支の関係の象意（三伝のとなりどうし）
      for (const [a, b, la] of [[I, M, "初伝と中伝"], [M, F, "中伝と末伝"]] as const) {
        for (const k of rel(a.branch, b.branch)) {
          const s = RELATION_SYMBOLISM[k];
          if (s && !(k === "punishedBy" && rel(a.branch, b.branch).includes("punishes"))) add({ id: `basic.relation.${k}.${la === "初伝と中伝" ? "im" : "mf"}`, category: "relation", detected: `${la}（${a.branch}・${b.branch}）が${s.name}`, reading: s.text, evaluation: null,
            evidence: [{ fact: "transmissions", detail: `${a.branch}${b.branch}` }], citations: [K(s.page, s.text)] });
        }
      }
      const h = threeHarmonyOf([I.branch, M.branch, F.branch]);
      if (h.complete) add({ id: "basic.relation.harmony", category: "relation", detected: `三伝 ${bs.join("・")} が三合（会）`, reading: "親和力のある関係であり、通常はいい意味である。", evaluation: null,
        evidence: [{ fact: "threeHarmony", detail: bs.join("") }], citations: [K("p54", "会は方位でいえば６０度の関係で、３つの支の関係で、三合会局ともいう。親和力のある関係であり、通常はいい意味である。")] });
    }
    // ---- 空亡と天空（講座 p59・p66） ----
    {
      const kind = (t: typeof I) => (isVoid(t.branch) ? "旬空" : isVoid(earth(t.branch)) ? "坐空" : null);
      for (const p of POS) {
        const t = ts[POS.indexOf(p)], k = kind(t);
        if (k) add({ id: `basic.void.kind.${p}`, category: "void", detected: `${POS_JA[p]} ${t.branch} が${k === "旬空" ? "旬空（天盤の支が空亡＝浮天空亡）" : `坐空（地盤 ${earth(t.branch)} が空亡＝落底空亡）`}`,
          reading: k === "旬空" ? "ある支の天盤支が空亡の場合を、浮天空亡とか遊行空亡とよぶ。" : "ある支の地盤支が空亡の場合を、落底空亡と言う。", evaluation: null,
          evidence: [{ fact: `${p}.void`, detail: k }], citations: [K("p66", "ある支の天盤支が空亡の場合を、浮天空亡とか遊行空亡とよぶ。また、ある支の地盤支が空亡の場合を、落底空亡と言う。")] });
      }
      if (isVoid(F.branch) || gen(F.branch) === "天空") add({ id: "basic.void.final", category: "void", detected: `末伝 ${F.branch} が${[isVoid(F.branch) ? "旬空" : "", gen(F.branch) === "天空" ? "天空" : ""].filter(Boolean).join("・")}`,
        reading: "終わりはすっきりしないものになりがち。", evaluation: null, evidence: [{ fact: "final", detail: F.branch }],
        citations: [K("p59", "末伝が空亡だったり、天空だったりすると、終わりはすっきりしないものになりがち。")] });
      const kinds = POS.map((p) => kind(ts[POS.indexOf(p)])), sky = POS.filter((p) => gen(ts[POS.indexOf(p)].branch) === "天空");
      const C66 = "三伝が全部空亡だったり、一つが天空であとが空亡だったりするのは、全く得るものがなく、目的も達成しない。ただし悪いこと、心配事もなくなる場合もある。";
      const voidOf = (p: TransmissionPosition) => kinds[POS.indexOf(p)] === "旬空";
      const allVoid = POS.every(voidOf), skyRest = sky.length === 1 && POS.filter((p) => p !== sky[0]).every(voidOf);
      if (allVoid || skyRest) add({ id: "basic.void.allTransmissions", category: "void", detected: allVoid ? "三伝がすべて旬空" : `${POS_JA[sky[0]]}が天空で、ほかの二伝が旬空`, reading: "全く得るものがなく、目的も達成しない。ただし悪いこと、心配事もなくなる場合もある。", evaluation: null,
        evidence: [{ fact: "transmissions", detail: kinds.join(",") }], citations: [K("p66", C66)] });
      else if (POS.every((p) => kinds[POS.indexOf(p)] !== null) || (sky.length === 1 && POS.filter((p) => p !== sky[0]).every((p) => kinds[POS.indexOf(p)] !== null))) held.push({ id: "basic.void.allTransmissions",
        detected: `三伝の空亡: ${POS.map((p, i) => `${POS_JA[p]} ${ts[i].branch} ${kinds[i] ?? (sky.includes(p) ? "天空" : "なし")}`).join("・")}`,
        reason: "坐空（落底空亡）を含めれば「三伝が全部空亡」に当たるが、坐空を含めるかは原典で確認できるまで保留", citations: [K("p66", C66)] });
    }
    // ---- 課体（講座 p32・p38・p53。定義と冲・刑の象意を並べるだけ。返吟・伏吟の象意は『大全』の本文確認まで保留） ----
    if (facts.sanchuan.status === "determined" && (facts.sanchuan.method === "返吟" || facts.sanchuan.method === "伏吟")) {
      const fan = facts.sanchuan.method === "返吟";
      add({ id: `basic.lessonForm.${fan ? "fanyin" : "fuyin"}`, category: "lessonForm", detected: `課体は${facts.sanchuan.method}${facts.sanchuan.pattern ? `（${facts.sanchuan.pattern}）` : ""}`,
        reading: fan ? "月将と占時が相冲となる場合。天盤と地盤がすべて相冲となる" : "天盤と地盤が同じとなり、この場合は伏吟法を用いる。", evaluation: null,
        note: fan ? "講座53頁は冲を「悪い意味を含むが、変動するという意味が強い」とする。返吟そのものの象意（『大全』）は本文を確認できるまで出さない" : "伏吟そのものの象意（『大全』）は本文を確認できるまで出さない",
        evidence: [{ fact: "method", detail: facts.sanchuan.method }],
        citations: fan ? [K("p38", "月将と占時が相冲となる場合。天盤と地盤がすべて相冲となる、この場合を返吟法という。"), K("p53", "やはり悪い意味を含むが、変動するという意味が強い。")]
          : [K("p32", "月将と占時が同じ。たとえば月将「子」で占時が子など。天盤と地盤が同じとなり、この場合は伏吟法を用いる。")] });
    }
    // ---- 象意（六親 p55・十二天将 p56）。三伝と占時 ----
    for (const p of POS) {
      const t = ts[POS.indexOf(p)], g = gen(t.branch);
      add({ id: `basic.symbolism.${p}`, category: "symbolism", detected: `${POS_JA[p]} ${t.branch}（${t.relation}・${g}）`,
        reading: `${t.relation}：${SIX_RELATION_SYMBOLISM[t.relation as SixRelation]}。${g}：${GENERAL_SYMBOLISM[g]}`, evaluation: null, note: "象意の一覧で、どれに当たるかは決めない",
        evidence: [{ fact: p, detail: `${t.relation}・${g}` }], citations: [K("p55", "生剋の象意の表"), K("p56", "十二天将象意の表")] });
    }
    // ---- 応期（講座 p65） ----
    {
      const voidNote = isVoid(I.branch) ? `初伝 ${I.branch} は旬空。講座64頁は初伝が空亡なら「事の発端がはっきりせず、無意味になることもある」とする。目的の達成時期とは断定しない` : "「はっきりする」期間で、目的の達成時期とは断定しない";
      const T65 = "初伝が太歳（年支）の場合は、事は１年以内にはっきりする。初伝が月建（月支）の場合は、事は１ヶ月以内にはっきりする。初伝が日支の場合は、事は１旬（約２週間）ではっきりする。初伝が日干の場合は、事はその日のうちにはっきりする。";
      const tai = context?.taiSui?.branch;
      if (tai && tai === I.branch) add({ id: "basic.timing.taiSui", category: "timing", detected: `初伝 ${I.branch} が太歳`, reading: "事は１年以内にはっきりする。", evaluation: null, note: voidNote, evidence: [{ fact: "taiSui", detail: tai }], citations: [K("p65", T65)] });
      if (monthBranch && monthBranch === I.branch) add({ id: "basic.timing.month", category: "timing", detected: `初伝 ${I.branch} が月建`, reading: "事は１ヶ月以内にはっきりする。", evaluation: null, note: voidNote, evidence: [{ fact: "monthBranch", detail: monthBranch }], citations: [K("p65", T65)] });
      if (dayBranch === I.branch) add({ id: "basic.timing.dayBranch", category: "timing", detected: `初伝 ${I.branch} が日支`, reading: "事は１旬（約２週間）ではっきりする。", evaluation: null, note: voidNote, evidence: [{ fact: "dayBranch", detail: dayBranch }], citations: [K("p65", T65)] });
      if (lodging === I.branch) held.push({ id: "basic.timing.dayStem", detected: `初伝 ${I.branch} が日干 ${dayStem} の寄宮`, reason: "講座の「初伝が日干の場合」が寄宮を指すかは書かれていないので保留", citations: [K("p65", T65)] });
    }
  }
  return { readings: out, held };
}

/** 監査用: 基本判断の規則 ID の一覧（盤によらず、登録している規則） */
export const BASIC_READING_RULE_IDS: readonly string[] = [
  "basic.role.initial", "basic.role.final", "basic.role.middle",
  "basic.divination.wealth", "basic.divination.yima", "basic.divination.lodgingCombine", "basic.divination.lodgingOuter", "basic.divination.branchInner", "basic.divination.void",
  "basic.stem.generatedByStanding", "basic.stem.hurtByStanding", "basic.stem.seasonal",
  "basic.lessons.discord14", "basic.lessons.discord23", "basic.lessons.origin", "basic.initial.speed",
  "basic.initial.overcomesBelow", "basic.initial.overcomeFromBelow", "basic.initial.growth", "basic.initial.growthTombBelow", "basic.initial.tomb", "basic.initial.death", "basic.initial.end", "basic.initial.void",
  "basic.initial.overcomesStem", "basic.initial.overcomesBranch", "basic.initial.overcomesDivination", "basic.initial.overcomesFinal",
  "basic.flow.generating", "basic.flow.overcoming", "basic.flow.initialOvercomesFinal", "basic.flow.finalOvercomesInitial", "basic.flow.forward", "basic.flow.backward", "basic.flow.meng", "basic.flow.zhong",
  "basic.relation.(刑・冲・破・害・合)", "basic.relation.harmony",
  "basic.void.kind", "basic.void.final", "basic.void.allTransmissions",
  "basic.lessonForm.fanyin", "basic.lessonForm.fuyin",
  "basic.symbolism", "basic.timing.taiSui", "basic.timing.month", "basic.timing.dayBranch",
];
/** 保留している基本判断（盤で条件が問題になったときだけ held に出す） */
export const HELD_BASIC_RULE_IDS: readonly string[] = ["basic.initial.harmed", "basic.void.allTransmissions（坐空を含む場合）", "basic.timing.dayStem"];
