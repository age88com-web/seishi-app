// src/lib/liuren/interpretation/patterns.ts
//
// 役割:
//   古典に明示された盤全体の共通パターン（PATTERN層）の成立を検出する。吉凶・象意・占目別の意味は付けない。
//   FACT・FLOW・MARKER・基礎状態の既存関数から読み、新しい天地盤・四課・墓庫の計算は作らない。
//   起課エンジンの sanchuan.pattern（九宗法の格）とは別物で、そこには混ぜない。
//
// 三伝の配列で決まるもの（『六壬粹言』。ユーザー指定 2026-10-03。列挙された配列だけを検出する）:
//   元胎（四孟）… 順＝生胎: 寅巳申・巳申亥・申亥寅・亥寅巳 / 逆＝病胎: 亥申巳・申巳寅・巳寅亥・寅亥申
//   関隔（四仲）… 順: 子卯午・卯午酉・午酉子・酉子卯 / 逆: 子酉午・酉午卯・午卯子・卯子酉
//   稼穡（四季）… 三伝がすべて辰戌丑未なら成立（『六壬大全』「三傳辰戌丑未」。重複支も含む。Phase 3E-2）。
//     『六壬粹言』の列挙配列は subtype で区別する: 順 辰未戌・未戌丑・戌丑辰 / 逆 丑戌未・戌未辰 / それ以外は general。
//   進間・退間（FLOW）や完全三合局（threeHarmony）と同時に成り立ってもよい（別の構造として両方持つ）。
//
// 天地盤で決まるもの:
//   四絶 … 日禄（daySalaryOf）が天盤で臨む地盤支（plate.earthUnder）が、古典に指定された支（Phase 3E-2）。
//          『六壬粹言』「乙禄卯加申、丁己禄午加亥、辛禄酉加寅、癸禄子加巳」:
//          乙卯→申・丁午→亥・己午→亥・辛酉→寅・癸子→巳。十二長生の絶では判定せず、この表をそのまま持つ。
//   墓覆干頭 … 陽干 甲・丙・戊・庚・壬 の日干上神（一課上神）が日干五行の墓庫支（isElementInTomb）。
//          甲未・丙戌・戊戌・庚丑・壬辰。墓を冲して解く判定（六処・年命）は未実装。
//
// 全局課・三合欠一神（Phase 3F）:
//   全局課 … 三伝が完全三合局（threeHarmonyOf）。木＝曲直・火＝炎上・金＝従革・水＝潤下。土の稼穡は jiaSe のまま。
//   欠一神 … 三伝の異なる支のうち、ちょうど2支が1つの三合局（SANHE を走査）に属し、残る1支が三伝にない
//            （『六壬大全』「三合入伝缺一神」＝折腰格・虚一待用格）。完全三合局のときは成立させない。
//   凑合格 … 「若日辰偶足之」の「日辰」が盤のどの位置に当たるか（日干の寄宮支・干上神・日支・支上神など）が
//            未確定のため判定しない。欠けた支の盤上の位置（missingBranchOccurrences）だけを持つ。

import { BRANCH_ELEMENT, SANHE, STEM_ELEMENT, isYangStem } from "../constants";
import type { Branch, Element, Stem } from "../types";
import { daySalaryOf } from "./markers";
import { threeHarmonyOf } from "./relations";
import { isElementInTomb } from "./states";
import type {
  ClassicalPattern, FourJuePattern, FullHarmonyPattern, InterpretationFacts, MissingBranchOccurrences,
  PartialHarmonyPattern, PatternDirection, TombOverStemPattern, TransmissionPosition, Triple,
} from "./types";

type SequenceKind = "yuanTai" | "guanGe";

/** 三伝の配列 → パターン（古典に列挙された配列だけ） */
const SEQUENCES: readonly { kind: SequenceKind; direction: PatternDirection; seqs: readonly string[] }[] = [
  { kind: "yuanTai", direction: "forward", seqs: ["寅巳申", "巳申亥", "申亥寅", "亥寅巳"] },
  { kind: "yuanTai", direction: "reverse", seqs: ["亥申巳", "申巳寅", "巳寅亥", "寅亥申"] },
  { kind: "guanGe", direction: "forward", seqs: ["子卯午", "卯午酉", "午酉子", "酉子卯"] },
  { kind: "guanGe", direction: "reverse", seqs: ["子酉午", "酉午卯", "午卯子", "卯子酉"] },
];

/** 稼穡の四季神と『六壬粹言』の列挙配列 */
const SIJI: readonly Branch[] = ["辰", "戌", "丑", "未"];
const JIASE_CUIYAN_FORWARD: readonly string[] = ["辰未戌", "未戌丑", "戌丑辰"];
const JIASE_CUIYAN_REVERSE: readonly string[] = ["丑戌未", "戌未辰"];

/** 四絶: 日干 → 日禄が臨む地盤支（『六壬粹言』の5例） */
const FOUR_JUE_EARTH: Partial<Record<Stem, Branch>> = { 乙: "申", 丁: "亥", 己: "亥", 辛: "寅", 癸: "巳" };

function sequencePatterns(t: Triple<Branch>): ClassicalPattern[] {
  const key = `${t.initial}${t.middle}${t.final}`;
  const out: ClassicalPattern[] = [];
  for (const { kind, direction, seqs } of SEQUENCES) {
    if (!seqs.includes(key)) continue;
    if (kind === "yuanTai") {
      out.push({ kind, direction, classicalName: direction === "forward" ? "生胎" : "病胎", branches: t });
    } else {
      out.push({ kind, direction, branches: t });
    }
  }
  if ([t.initial, t.middle, t.final].every((b) => SIJI.includes(b))) {
    const subtype = JIASE_CUIYAN_FORWARD.includes(key) ? "cuiyanForward"
      : JIASE_CUIYAN_REVERSE.includes(key) ? "cuiyanReverse" : "general";
    out.push({ kind: "jiaSe", subtype, branches: t });
  }
  return out;
}

function fourJue(facts: InterpretationFacts): FourJuePattern | null {
  const { dayStem } = facts.basic;
  const target = FOUR_JUE_EARTH[dayStem];
  if (!target) return null;
  const salaryBranch = daySalaryOf(dayStem);
  const earthBranch = facts.plate.earthUnder[salaryBranch];
  if (earthBranch !== target) return null;
  return {
    kind: "fourJue", dayStem, salaryBranch, earthBranch,
    salaryIsVoid: facts.xun.voidBranches.includes(salaryBranch),
  };
}

function tombOverStem(facts: InterpretationFacts): TombOverStemPattern | null {
  const { dayStem } = facts.basic;
  if (!isYangStem(dayStem)) return null;
  const upper = facts.lessons[0].upper;
  if (!isElementInTomb(STEM_ELEMENT[dayStem], upper)) return null;
  return { kind: "tombOverStem", dayStem, upper, lessonIndex: 1 };
}

const FULL_HARMONY_NAME: Partial<Record<Element, FullHarmonyPattern["classicalName"]>> = {
  木: "曲直", 火: "炎上", 金: "従革", 水: "潤下",
};

function fullHarmony(t: Triple<Branch>): FullHarmonyPattern | null {
  const h = threeHarmonyOf([t.initial, t.middle, t.final]);
  if (!h.complete) return null;
  const classicalName = FULL_HARMONY_NAME[h.element];
  if (!classicalName) return null;
  return { kind: "fullHarmony", element: h.element, classicalName, branches: t };
}

/** 支が盤のどこにあるか（欠一神の調査用） */
function occurrencesOf(facts: InterpretationFacts, b: Branch): MissingBranchOccurrences {
  const ls = facts.lessons;
  return {
    dayBranch: facts.basic.dayBranch === b,
    lessonUppers: ls.filter((l) => l.upper === b).map((l) => l.index),
    lessonLowerBranches: ls.filter((l) => l.lowerBranch === b).map((l) => l.index),
    dayStemUpper: ls[0].upper === b,
    dayBranchUpper: ls[2].upper === b,
  };
}

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

function partialHarmonies(facts: InterpretationFacts, t: Triple<Branch>): PartialHarmonyPattern[] {
  if (threeHarmonyOf([t.initial, t.middle, t.final]).complete) return [];
  const branches = [t.initial, t.middle, t.final];
  const distinct = new Set(branches);
  const out: PartialHarmonyPattern[] = [];
  for (const group of SANHE) {
    const present = group.filter((b) => distinct.has(b));
    if (present.length !== 2) continue;
    const missingBranch = group.find((b) => !distinct.has(b))!;
    out.push({
      kind: "partialHarmony",
      missingOneOfThree: true,
      element: BRANCH_ELEMENT[group[1]],
      classicalNames: ["折腰格", "虚一待用格"],
      presentBranches: [present[0], present[1]],
      missingBranch,
      transmissionPositions: present.map((b) => ({ branch: b, positions: POSITIONS.filter((_, i) => branches[i] === b) })),
      missingBranchOccurrences: occurrencesOf(facts, missingBranch),
    });
  }
  return out;
}

/** 成立した古典共通パターン（成立しなければ空配列。三伝未確定なら三伝の配列で決まるものは見ない） */
export function detectClassicalPatterns(facts: InterpretationFacts): ClassicalPattern[] {
  const out: ClassicalPattern[] = [];
  const ts = facts.transmissions;
  if (ts) {
    const t: Triple<Branch> = { initial: ts[0].branch, middle: ts[1].branch, final: ts[2].branch };
    out.push(...sequencePatterns(t));
    const full = fullHarmony(t);
    if (full) out.push(full);
    out.push(...partialHarmonies(facts, t));
  }
  const fj = fourJue(facts);
  if (fj) out.push(fj);
  const tomb = tombOverStem(facts);
  if (tomb) out.push(tomb);
  return out;
}
