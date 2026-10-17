// src/lib/liuren/interpretation/lessonFormSpirits.ts
//
// 役割（Phase 5Q）:
//   課体（lessonForms.ts）に使う神煞そのもの（旬儀・支儀・天羅・地網）の FACT。吉凶・課体の成立・DOMAIN の判断は持たない。
//   三層を分ける:
//     A 神煞そのもの … 原典ごとの定義で求めた支（LESSON_FORM_SPIRIT_DEFINITIONS・lessonFormSpiritBranchOf）
//     B 盤上の位置   … その支が天盤・地盤・四課・三伝のどこにあるか（branchPlacement.ts をそのまま使う）
//     C 課体の成立   … lessonForms.ts（六儀卦・羅網格）。A があるだけ・B の位置にあるだけでは成立させない
//   原典が違えば別の神煞として持ち、同じ名前でも一つの算法にまとめない（地網は『心鏡』と『大全』で別）。
//
//   定義があって求めるもの（A。status は原文に明示＝explicit）:
//     旬儀 … 旬首の支（『心鏡』巻三 吉泰門）
//     支儀 … 日支ごとの表（同 注）。『心鏡』の「六儀」は旬儀と支儀の二つを指す
//     天羅 … 日干の寄宮の前一辰（『心鏡』巻三「日前一辰天羅杀」・『大全』卷十「干上乘干前一辰」の干の羅。二書で一致）
//     地網 … 『心鏡』巻三＝天羅の冲（「對冲名為地網神」）／『大全』卷十＝日支の前一辰（「支上乘支前一辰」の支の網）。別々に持つ
//
//   用例だけで定義の文がないもの・見る位置が書かれていないもの（LESSON_FORM_TERM_USAGES。求めない・判定しない）:
//     『直指』婚姻・『大全』括囊賦の「六儀」、『断案２』例43 の末伝の六儀、『心鏡』天羅地網卦の位置条件、
//     『指南』陽宅章の「羅網」など
//   固定神殺としての天羅（辰）・地網（戌）: 『指南』の「貴履天羅／地網」などはこの用法で、原典の盤の辰・戌と合う。
//     日干・日支から求める上の天羅・地網とは別の用法として、用例を記録するだけにする（ここでは求めない）

import { BRANCHES } from "../constants";
import type { Branch } from "../types";
import { branchPlacementOf } from "./branchPlacement";
import type { BranchPlacement } from "./branchPlacement";
import type { InterpretationFacts } from "./types";

export type LessonFormSpiritId = "xunYi" | "zhiYi" | "tianLuo" | "diWangXinJing" | "diWangDaQuan";
export const LESSON_FORM_SPIRIT_IDS: readonly LessonFormSpiritId[] = ["xunYi", "zhiYi", "tianLuo", "diWangXinJing", "diWangDaQuan"];

export type LessonFormSourceBook = "『六壬心鏡』" | "『六壬大全』" | "『御定六壬直指』" | "『大六壬指南』" | "『六壬断案２』";

export interface LessonFormSpiritSource {
  source: LessonFormSourceBook;
  locator: string;
  layer: "原文" | "注";
  quote: string;
}

export interface LessonFormSpiritDefinition {
  id: LessonFormSpiritId;
  name: string;
  /** 求める基準 */
  basis: "旬首" | "日支" | "日干の寄宮" | "天羅";
  algorithm: string;
  /** 算法の確定状況（今回の5つはすべて原文に明示） */
  status: "explicit";
  sources: readonly LessonFormSpiritSource[];
  notes: readonly string[];
}

const XJ3 = (locator: string, layer: "原文" | "注", quote: string): LessonFormSpiritSource => ({ source: "『六壬心鏡』", locator: `巻三 ${locator}`, layer, quote });
const DQ10 = (quote: string): LessonFormSpiritSource => ({ source: "『六壬大全』", locator: "卷十 毕法赋", layer: "原文", quote });

export const LESSON_FORM_SPIRIT_DEFINITIONS: Readonly<Record<LessonFormSpiritId, LessonFormSpiritDefinition>> = {
  xunYi: {
    id: "xunYi", name: "旬儀", basis: "旬首", algorithm: "占日の旬の旬首の支", status: "explicit",
    sources: [XJ3("吉泰門 六儀卦", "原文", "六仪一段居旬首，甲子旬中神后为"), XJ3("吉泰門 六儀卦", "注", "旬仪即旬首")],
    notes: ["『心鏡』の「六儀」は旬儀と支儀の二つ（「六仪一段居旬首…更复子当从午配」）。『断案２』例43 は旬儀だけを「六儀」と呼ぶ（「戌は六儀すなわち甲戌旬の初めの支」）"],
  },
  zhiYi: {
    id: "zhiYi", name: "支儀", basis: "日支", algorithm: "子日午・丑日巳・寅日辰・卯日卯・辰日寅・巳日丑・午日未・未日申・申日酉・酉日戌・戌日亥・亥日子", status: "explicit",
    sources: [XJ3("吉泰門 六儀卦", "注", "支仪，子日在午，丑日在巳，寅日在辰，卯日在卯，辰日在寅，巳日在丑，午日在未，未日在申，申日在酉，酉日在戌，戌日在亥，亥日在子")],
    notes: [],
  },
  tianLuo: {
    id: "tianLuo", name: "天羅", basis: "日干の寄宮", algorithm: "日干の寄宮の前一辰", status: "explicit",
    sources: [XJ3("凶否門 天羅地網卦", "原文", "日前一辰天罗杀"), XJ3("凶否門 天羅地網卦", "注", "如庚日庚课申，则酉为天罗，卯为地网"),
      DQ10("逢罗网，谓干上乘干前一辰，支上乘支前一辰，故名天罗地网"), DQ10("破罗，干上乘支之网，支上乘干之罗")],
    notes: ["『大全』は「干の羅・支の網」（破羅の文）で、干の前一辰を羅とする。『心鏡』と同じ支になる",
      "『大全』卷十「值干之天罗地网…值支天罗地网」は干・支それぞれに天羅地網があるようにも読めるが、算法は書かれていない（求めない）"],
  },
  diWangXinJing: {
    id: "diWangXinJing", name: "地網（『心鏡』）", basis: "天羅", algorithm: "天羅の冲", status: "explicit",
    sources: [XJ3("凶否門 天羅地網卦", "原文", "对冲名为地网神"), XJ3("凶否門 天羅地網卦", "注", "如庚日庚课申，则酉为天罗，卯为地网")],
    notes: ["『大全』の地網（日支の前一辰）とは定義が違う。同じ支になる日もあるが統合しない"],
  },
  diWangDaQuan: {
    id: "diWangDaQuan", name: "地網（『大全』）", basis: "日支", algorithm: "日支の前一辰", status: "explicit",
    sources: [DQ10("逢罗网，谓干上乘干前一辰，支上乘支前一辰，故名天罗地网"), DQ10("破罗，干上乘支之网，支上乘干之罗"),
      { source: "『御定六壬直指』", locator: "毕法賦", layer: "原文", quote: "干上乘干前一位之辰，支上乘支前一位之神，名天罗地网" }],
    notes: ["『直指』毕法賦も同じ定義", "『心鏡』の地網（天羅の冲）とは定義が違う"],
  },
};

const next = (b: Branch): Branch => BRANCHES[(BRANCHES.indexOf(b) + 1) % 12] as Branch;
const oppose = (b: Branch): Branch => BRANCHES[(BRANCHES.indexOf(b) + 6) % 12] as Branch;
/** 支儀（『心鏡』注の表） */
const ZHI_YI: Record<Branch, Branch> = { 子: "午", 丑: "巳", 寅: "辰", 卯: "卯", 辰: "寅", 巳: "丑", 午: "未", 未: "申", 申: "酉", 酉: "戌", 戌: "亥", 亥: "子" };

/** 基準の支（旬首・日支・日干の寄宮・天羅） */
function basisBranchOf(id: LessonFormSpiritId, facts: InterpretationFacts): Branch {
  switch (LESSON_FORM_SPIRIT_DEFINITIONS[id].basis) {
    case "旬首": return facts.xun.xunHead.slice(1) as Branch;
    case "日支": return facts.basic.dayBranch;
    case "日干の寄宮": return facts.lessons[0].lowerBranch;
    case "天羅": return next(facts.lessons[0].lowerBranch);
  }
}

/** A: 神煞の支 */
export function lessonFormSpiritBranchOf(id: LessonFormSpiritId, facts: InterpretationFacts): Branch {
  const b = basisBranchOf(id, facts);
  switch (id) {
    case "xunYi": return b;
    case "zhiYi": return ZHI_YI[b];
    case "tianLuo": return next(b);
    case "diWangXinJing": return oppose(b);
    case "diWangDaQuan": return next(b);
  }
}

/** A（神煞の支と基準）と B（盤上の位置）。課体の成立（C）は持たない */
export interface LessonFormSpiritFact {
  id: LessonFormSpiritId;
  name: string;
  basis: LessonFormSpiritDefinition["basis"];
  basisBranch: Branch;
  branch: Branch;
  placement: BranchPlacement;
}

export function lessonFormSpiritOf(facts: InterpretationFacts, id: LessonFormSpiritId): LessonFormSpiritFact {
  const d = LESSON_FORM_SPIRIT_DEFINITIONS[id], branch = lessonFormSpiritBranchOf(id, facts);
  return { id, name: d.name, basis: d.basis, basisBranch: basisBranchOf(id, facts), branch, placement: branchPlacementOf(facts, branch) };
}

export function lessonFormSpiritsOf(facts: InterpretationFacts): Readonly<Record<LessonFormSpiritId, LessonFormSpiritFact>> {
  const out = {} as Record<LessonFormSpiritId, LessonFormSpiritFact>;
  for (const id of LESSON_FORM_SPIRIT_IDS) out[id] = lessonFormSpiritOf(facts, id);
  return out;
}

// ---- 原典の用例（求めない・判定しない。原文と、そこから言えること・言えないことを分けて持つ） ----

/**
 * 用例の確定状況。
 *   definesLessonForm … 課体の成立条件が原文で確定し、lessonForms.ts で判定している
 *   matchesDefinition … 用例の支・位置が、上の定義の一つと原典の盤で一致する（用例そのものは定義の文ではない）
 *   positionUnstated  … 神煞は定義できても、盤のどこで見るかが原文に書かれていない
 *   undefinedTerm     … 語の定義が取得資料にない（ほかの書の定義と同じかは確かめられない）
 *   unmatched         … 上の定義のどれとも原典の盤で合わない
 *   fixedSpiritUsage  … 固定神殺としての用法（天羅＝辰・地網＝戌）。上の定義とは別の用法で、用例として記録するだけ
 */
export type LessonFormTermUsageStatus = "definesLessonForm" | "matchesDefinition" | "positionUnstated" | "undefinedTerm" | "unmatched" | "fixedSpiritUsage";

export interface LessonFormTermUsage {
  term: "六儀" | "天羅" | "地網" | "羅網" | "天羅地網";
  source: LessonFormSourceBook;
  locator: string;
  quote: string;
  status: LessonFormTermUsageStatus;
  /** 一致する定義（matchesDefinition・definesLessonForm のとき） */
  matches: readonly LessonFormSpiritId[];
  /** 原文に書かれた位置（なければ null） */
  statedPosition: string | null;
  /** 原文から言えること・言えないこと（推論はそれと分かるように書く） */
  note: string;
}

export const LESSON_FORM_TERM_USAGES: readonly LessonFormTermUsage[] = [
  { term: "六儀", source: "『六壬心鏡』", locator: "巻三 吉泰門 六儀卦", quote: "用得此神名善卦，又须传末吉相随", status: "definesLessonForm", matches: ["xunYi", "zhiYi"],
    statedPosition: "用神（初伝）", note: "六儀卦の成立条件。注「终传神将又大吉」は成立の条件でなく別の読み" },
  { term: "六儀", source: "『六壬断案２』", locator: "例43（丁丑日 甲戌旬）", quote: "戌は六儀すなわち甲戌旬の初めの支", status: "matchesDefinition", matches: ["xunYi"],
    statedPosition: null, note: "戌は末伝で天盤の亥の上（魁度天門）。旬儀と一致するが、初伝は子なので六儀卦の成立の証拠にはならない（原典も六儀卦とは言わない）" },
  { term: "六儀", source: "『御定六壬直指』", locator: "婚姻", quote: "课传所喜三光、六仪、元胎、三阳连茹", status: "positionUnstated", matches: [],
    statedPosition: null, note: "六儀を定義せず、課伝のどこで見るかも書かない。『心鏡』の六儀卦（初伝）と同じかは確かめられない" },
  { term: "六儀", source: "『六壬大全』", locator: "卷四 括囊赋", quote: "三奇六仪交重，连绵喜矣", status: "positionUnstated", matches: [],
    statedPosition: null, note: "六儀を定義せず、見る位置も書かない" },
  { term: "羅網", source: "『六壬大全』", locator: "卷十 毕法赋", quote: "逢罗网，谓干上乘干前一辰，支上乘支前一辰，故名天罗地网", status: "definesLessonForm", matches: ["tianLuo", "diWangDaQuan"],
    statedPosition: "干上・支上", note: "羅網格。『直指』毕法賦も同じ文。「或遇空亡，亦名破网」の空亡が旬空か坐空か、天羅・地網のどちらかは書かれていない" },
  { term: "天羅地網", source: "『六壬心鏡』", locator: "巻三 凶否門 天羅地網卦", quote: "发用行年支干上，官灾病厄是其迍", status: "positionUnstated", matches: ["tianLuo", "diWangXinJing"],
    statedPosition: "「发用行年支干上」", note: "天羅・地網は定義される。「发用」と「行年支干上」の区切り、天羅と地網のどちらでもよいか、行年上が地盤の行年の上か、が一つに決まらないので天羅地網卦は判定しない" },
  { term: "羅網", source: "『大六壬指南』", locator: "仕宦章 占験八・占験十三、隠遁章 占験一", quote: "仕宦逢罗网", status: "matchesDefinition", matches: ["tianLuo", "diWangDaQuan"],
    statedPosition: null, note: "3例とも『大全』の羅網格が原典の盤で成立する（Phase 5P）。隠遁章 占験一「日上罗网逢空」の空は干上の天羅 巳 の旬空" },
  { term: "天羅", source: "『大六壬指南』", locator: "仕宦章 占験十六・十七・三十", quote: "官贵履天罗之地", status: "fixedSpiritUsage", matches: [],
    statedPosition: "貴人（官）が「履む」地盤", note: "固定神殺の天羅（辰）。原典の盤では貴人が地盤の辰に乗る。日干から求める『心鏡』『大全』の天羅（寄宮の前一辰）とは別の用法" },
  { term: "地網", source: "『大六壬指南』", locator: "仕宦章 占験一・七・十七・十八、占訟章 占験十八", quote: "禄巳加戌入墓地网", status: "fixedSpiritUsage", matches: [],
    statedPosition: "地盤（「加戌」「临戌」「履」）", note: "固定神殺の地網（戌）。原典の盤ではいずれも地盤の戌。『心鏡』『大全』の地網とは別の用法" },
  { term: "羅網", source: "『大六壬指南』", locator: "陽宅章", quote: "罗网来乘身宅上", status: "undefinedTerm", matches: [],
    statedPosition: "身・宅の上", note: "羅網を定義しない。『大全』の羅網格、固定神殺の辰戌のどれに当たるかは確かめられない" },
  { term: "天羅", source: "『六壬断案２』", locator: "例50（戊寅日）", quote: "干支がみな天羅羊刃", status: "matchesDefinition", matches: ["tianLuo", "diWangDaQuan"],
    statedPosition: "干上・支上", note: "干上 午・支上 卯 が『大全』の天羅・地網と一致。同じ例の「子が今日の地網」は、天羅 午 の冲として『心鏡』の地網と同じ支になる（推論。原典は算法を書かない）" },
  { term: "地網", source: "『六壬断案２』", locator: "例30（甲寅日）", quote: "巳が辰に加わるのは勾地網", status: "unmatched", matches: [],
    statedPosition: "巳が辰に加わる", note: "『心鏡』（酉）・『大全』（卯）の地網とも、固定神殺の地網（戌）とも合わない" },
];
