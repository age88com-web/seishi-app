// src/lib/liuren/interpretation/lessonForms.ts
//
// 役割（Phase 5P）:
//   課体（卦・格）の FACT。起課結果（四課・三伝・天地盤・initialOrigin）を読むだけで、起課・既存の格の判定は変えない。吉凶は持たない。
//
//   既存の判定（ここでは判定し直さず、参照の一覧として並べるだけ）:
//     起課エンジン … 九宗門の法（sanchuan.method）と格（sanchuan.pattern。蒿矢・弾射・虎視・冬蛇掩目など）
//     patterns.ts  … 元胎・関隔・稼穡・四絶・墓覆干頭・全局・欠一（detectClassicalPatterns）
//     三伝の進退   … 進茹・退茹・進間・退間（standingPathComparison の movementPattern）
//
//   新しく判定する課体（原典で成立条件が確定したものだけ）:
//     六儀卦 … 『六壬心鏡』巻三 吉泰門「六儀一段居旬首…用得此神名善卦」。初伝（用神）が旬儀（旬首の支）か支儀（日支ごとの表）
//              注「凡用神將得六儀，終傳神將又大吉，乃始終有慶也」の「終傳…大吉」は成立の条件でなく、別の読み（ここでは判定しない）
//     羅網格 … 『六壬大全』卷十「逢羅網，謂干上乘干前一辰，支上乘支前一辰，故名天羅地網」。干上が日干の寄宮の前一辰で、かつ支上が日支の前一辰
//
//   天羅・地網の位置（羅網格とは別に持つ。原典差を残す）:
//     天羅 … 日干の寄宮の前一辰（『心鏡』巻三「日前一辰天羅杀」・『大全』卷十「干前一辰」で一致）
//     地網 … 『心鏡』巻三は天羅の冲（「對冲名為地網神。如庚日庚課申，則酉為天羅，卯為地網」）、『大全』卷十は日支の前一辰で、定義が違う
//
//   判定しない課体（docs/liuren-missing-facts-audit.md の Phase 5P 追記）: 三光（「傳中復有吉神」の吉神の範囲）・三陽（「日辰有氣在天乙前」の位置）など
//
//   DOMAIN への接続（Phase 5P 最終監査で保留）:
//     婚姻 … 『御定六壬直指』「課傳所喜…六儀」は六儀を定義せず、課伝のどこで見るかも書かない（『断案２』例43 は末伝の旬儀を「六儀」と呼ぶ）。
//            『心鏡』の六儀卦（初伝に限る）と同じとは確かめられないので、婚姻の規則には使わない
//     家宅 … 『大六壬指南』陽宅章「羅網來乘身宅上」は羅網を定義しないので、『大全』の羅網格と同じとは確かめられない。家宅の規則には使わない

import type { Branch } from "../types";
import { lessonFormSpiritBranchOf } from "./lessonFormSpirits";
import { detectClassicalPatterns } from "./patterns";
import type { InterpretationFacts } from "./types";

export type LessonFormId = "liuYiGua" | "luoWang";

export interface LessonFormSource {
  source: "『六壬心鏡』" | "『六壬大全』";
  locator: string;
  layer: "原文" | "注";
  quote: string;
}

/** 課体の判定結果（吉凶なし） */
export interface LessonFormFact {
  id: LessonFormId;
  name: string;
  holds: boolean;
  /** 判定条件（日本語） */
  condition: string;
  /** この盤で見た値 */
  detail: string;
  sources: readonly LessonFormSource[];
  /** 判定に使った盤の情報 */
  requires: readonly string[];
  /** 未確定事項・原典差 */
  notes: readonly string[];
}

// 神煞そのもの（旬儀・支儀・天羅・地網の二説）の算法と原典は lessonFormSpirits.ts（Phase 5Q）に置き、ここではその支を使って成立だけを見る。

/** 旬儀（旬首の支）と支儀 */
export function liuYiBranchesOf(facts: InterpretationFacts): { xunYi: Branch; zhiYi: Branch } {
  return { xunYi: lessonFormSpiritBranchOf("xunYi", facts), zhiYi: lessonFormSpiritBranchOf("zhiYi", facts) };
}

/** 天羅（日干の寄宮の前一辰）と地網の二説 */
export function tianLuoDiWangOf(facts: InterpretationFacts): { tianLuo: Branch; diWangXinJing: Branch; diWangDaQuan: Branch } {
  return { tianLuo: lessonFormSpiritBranchOf("tianLuo", facts), diWangXinJing: lessonFormSpiritBranchOf("diWangXinJing", facts), diWangDaQuan: lessonFormSpiritBranchOf("diWangDaQuan", facts) };
}

const XJ3 = (layer: "原文" | "注", quote: string): LessonFormSource => ({ source: "『六壬心鏡』", locator: "巻三", layer, quote });

/** 六儀卦 */
export function liuYiGuaOf(facts: InterpretationFacts): LessonFormFact {
  const { xunYi, zhiYi } = liuYiBranchesOf(facts), init = facts.transmissions?.[0].branch ?? null;
  const hit = init ? [init === xunYi ? `旬儀 ${xunYi}` : "", init === zhiYi ? `支儀 ${zhiYi}` : ""].filter(Boolean) : [];
  return {
    id: "liuYiGua", name: "六儀卦", holds: hit.length > 0,
    condition: "初伝（用神）が旬儀（旬首の支）または支儀（日支ごとの表）",
    detail: init ? `初伝 ${init}・旬儀 ${xunYi}（旬首 ${facts.xun.xunHead}）・支儀 ${zhiYi}${hit.length ? `（${hit.join("・")}に当たる）` : ""}` : "三伝が未確定",
    sources: [XJ3("原文", "六仪一段居旬首，甲子旬中神后为"), XJ3("注", "旬仪即旬首"), XJ3("原文", "用得此神名善卦，又须传末吉相随"),
      XJ3("注", "支仪，子日在午，丑日在巳，寅日在辰，卯日在卯，辰日在寅，巳日在丑，午日在未，未日在申，申日在酉，酉日在戌，戌日在亥，亥日在子")],
    requires: ["初伝", "旬首", "日支"],
    notes: ["注「終傳神將又大吉，乃始終有慶」は成立の条件でなく別の読みなので、ここでは判定しない"],
  };
}

/** 羅網格（『大全』の定義） */
export function luoWangOf(facts: InterpretationFacts): LessonFormFact {
  const { tianLuo, diWangDaQuan } = tianLuoDiWangOf(facts), s = facts.lessons[0].upper, z = facts.lessons[2].upper;
  return {
    id: "luoWang", name: "羅網格", holds: s === tianLuo && z === diWangDaQuan,
    condition: "干上が日干の寄宮の前一辰（天羅）で、かつ支上が日支の前一辰（『大全』の地網）",
    detail: `干上 ${s}（天羅 ${tianLuo}）・支上 ${z}（日支の前一辰 ${diWangDaQuan}）`,
    sources: [{ source: "『六壬大全』", locator: "卷十 毕法赋", layer: "原文", quote: "逢罗网，谓干上乘干前一辰，支上乘支前一辰，故名天罗地网" }],
    requires: ["干上（一課上神）", "支上（三課上神）", "日干の寄宮", "日支"],
    notes: ["地網は『心鏡』巻三では天羅の冲で、『大全』の「支前一辰」と定義が違う。羅網格は『大全』の定義だけで判定する"],
  };
}

/** 既存の判定の一覧（判定し直さない） */
export function existingLessonFormsOf(facts: InterpretationFacts): { method: string | null; pattern: string | null; classical: readonly string[] } {
  const s = facts.sanchuan;
  return {
    method: s.status === "determined" ? s.method : null,
    pattern: s.status === "determined" ? s.pattern : null,
    classical: detectClassicalPatterns(facts).map((p) => p.kind),
  };
}

/** 新しく判定する課体の一覧 */
export function lessonFormsOf(facts: InterpretationFacts): readonly LessonFormFact[] {
  return [liuYiGuaOf(facts), luoWangOf(facts)];
}
