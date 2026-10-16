// src/lib/liuren/interpretation/secondarySpirits.ts
//
// 役割（Phase 5M）:
//   太歳から求める神煞（病符・歳破）と、月建から求める第2群の神煞（天鬼・関神・生神・死神）の FACT。
//   神煞ごとに「どの支か」と「その支が盤のどこに現れるか」（四課上神・三伝・天盤で加わる地盤支・乗る天将・旬空）を返すだけで、
//   吉凶・象意・DOMAIN の判断は持たない。神煞ごとに算法の出典・確定状況・原典差を SECONDARY_SPIRIT_DEFINITIONS に持つ。
//
//   入力:
//     太歳 … 呼び出し側が渡す太歳の支（context.taiSui。年の境界は既存の扱いのまま）。なければその神煞は null（推測しない）
//     月支 … monthBranch（節月。寅月＝正月）。なければその神煞は null
//
//   月建の神煞・第1群（monthlySpirits.ts）とは別のファイルで持ち、monthlySpirits.ts・markers.ts は変えない。
//   『心鏡』の生神・死神は、生気・死気（monthlySpirits）と同じ支になる月があっても別の神煞として持つ（生神の位置は死気と常に同じ）。
//
//   調べたが実装しないもの（docs/liuren-missing-facts-audit.md の Phase 5M 追記）:
//     天車 … 『心鏡』巻六「春巳夏辰秋在未，冬酉」と『御定六壬直指』毕法賦「天車煞即關神」（春丑夏辰秋未冬戌）が食い違う
//     浴盆 … 疾病 DOMAIN（Phase 5E）が『心鏡』の表をすでに持つので、重複して作らない

import { BRANCHES } from "../constants";
import type { Branch, HeavenlyGeneral } from "../types";
import type { InterpretationFacts, LessonOccurrence, TransmissionOccurrence, TransmissionPosition } from "./types";

export type SecondarySpiritKind = "bingFu" | "suiPo" | "tianGui" | "guanShen" | "shengShen" | "siShen";
export const SECONDARY_SPIRIT_KINDS: readonly SecondarySpiritKind[] = ["bingFu", "suiPo", "tianGui", "guanShen", "shengShen", "siShen"];

/** 求める基準（太歳の支か月支か） */
export type SecondarySpiritBasis = "taiSui" | "monthBranch";

/**
 * 算法の確定状況。
 *   explicit                  … 起例が原文に明示されている
 *   reconstructedFromExamples … 起例の文が取得資料になく、原典の例から求めた
 */
export type SecondarySpiritAlgorithmStatus = "explicit" | "reconstructedFromExamples";

export interface SecondarySpiritSource {
  source: "『六壬心鏡』" | "『六壬大全』" | "『大六壬指南』" | "『御定六壬直指』";
  locator: string;
  layer: "原文" | "注";
  role: "rule" | "example";
  quote: string;
}

export interface SecondarySpiritDefinition {
  kind: SecondarySpiritKind;
  name: string;
  basis: SecondarySpiritBasis;
  algorithm: string;
  status: SecondarySpiritAlgorithmStatus;
  sources: readonly SecondarySpiritSource[];
  notes: readonly string[];
}

const src = (source: SecondarySpiritSource["source"], locator: string, layer: "原文" | "注", role: "rule" | "example", quote: string): SecondarySpiritSource => ({ source, locator, layer, role, quote });

export const SECONDARY_SPIRIT_DEFINITIONS: Readonly<Record<SecondarySpiritKind, SecondarySpiritDefinition>> = {
  bingFu: {
    kind: "bingFu", name: "病符", basis: "taiSui", algorithm: "前年の太歳（太歳の支の一つ前）", status: "explicit",
    sources: [
      src("『六壬大全』", "卷十 毕法赋", "原文", "rule", "夫病符者，每年旧太岁者是也。且如子年亥为病符，丑年子为病符，余年仿此"),
      src("『御定六壬直指』", "毕法賦", "原文", "rule", "病符者，本年旧太岁也"),
    ],
    notes: [],
  },
  suiPo: {
    kind: "suiPo", name: "歳破", basis: "taiSui", algorithm: "太歳の冲", status: "reconstructedFromExamples",
    sources: [
      src("『大六壬指南』", "章奏章第二十八 占験五", "原文", "example", "嫌初末逢空，独存中传，岁破为鬼"),
      src("『大六壬指南』", "応候章第二十四 占験四", "原文", "example", "末传太阴刀乘岁破冲克太岁"),
      src("『大六壬指南』", "占訟章第十八 占験四", "原文", "example", "然贵被干克，岁破发用，课传退茹"),
      src("『大六壬指南』", "仕宦章第十五 占験十九", "原文", "example", "盖初传岁破内战"),
    ],
    notes: [
      "起例の文は取得資料にない。『大六壬指南』の占験4例（辛未年の丑・庚寅年の申・壬午年の子が2例）で、原典が歳破とする位置が太歳の冲で、エンジンの三伝と一致する（月将は節気の前後の2候補のうち一致する方）",
      "4例はいずれも規則の出典ではない（歳破を使う規則の文はまだ規則にしていない）",
      "月将は原典に書かれていないので、節気の前後の2候補から、原典の課名（從革・彈射と病胎・退茹・知一）に合う方を選んだ。月将の選択は歳破の位置に依存しない（仕宦章 占験十九は「知一」には合うが「鑄印」には合わない）",
    ],
  },
  tianGui: {
    kind: "tianGui", name: "天鬼", basis: "monthBranch", algorithm: "正月（寅月）酉から四仲を逆行（酉・午・卯・子）", status: "explicit",
    sources: [
      src("『六壬大全』", "卷十 毕法赋", "原文", "rule", "天鬼者，正月酉，逆行四仲"),
      src("『御定六壬直指』", "毕法賦", "原文", "rule", "天鬼者，正月酉逆行四仲"),
      src("『六壬心鏡』", "巻三 凶否門 伏殃卦", "注", "rule", "天鬼一名伏殃，正月酉，二月午，逆行四仲"),
    ],
    notes: [],
  },
  guanShen: {
    kind: "guanShen", name: "関神", basis: "monthBranch", algorithm: "春（寅卯辰月）丑・夏（巳午未月）辰・秋（申酉戌月）未・冬（亥子丑月）戌", status: "explicit",
    sources: [
      src("『六壬大全』", "卷十 毕法赋", "原文", "rule", "夫关神者，春丑、夏辰、秋未、冬戍"),
      src("『六壬大全』", "鬼墓課", "原文", "rule", "关神春丑夏辰秋未冬戌也"),
      src("『六壬心鏡』", "巻六 官訟門 郇注", "注", "rule", "关神春丑夏辰秋未冬戌"),
    ],
    notes: [
      "『心鏡』巻六の「關鎖神」（春丑夏辰秋未冬戌）と同じ表",
      "『御定六壬直指』毕法賦「天車煞即關神」は天車をこの表とするが、『心鏡』巻六の天車（春巳夏辰秋未冬酉）とは食い違うので、天車は作らない",
    ],
  },
  shengShen: {
    kind: "shengShen", name: "生神", basis: "monthBranch", algorithm: "正月（寅月）午から順行", status: "explicit",
    sources: [src("『六壬心鏡』", "巻五 産育門 注", "注", "rule", "生神，正月起午顺行十二支")],
    notes: ["生気（月建の神煞・第1群。正月子）とは別の神煞。位置は『大全』の死気（正月午）と常に同じになるが、名前・出典・用法が違うので統合しない"],
  },
  siShen: {
    kind: "siShen", name: "死神", basis: "monthBranch", algorithm: "正月（寅月）巳から順行", status: "explicit",
    sources: [
      src("『六壬心鏡』", "巻七 疾病門 注", "注", "rule", "死神，正月在巳，顺行十二支辰"),
      src("『六壬心鏡』", "巻三 凶否門", "原文", "example", "六月死神来至戌"),
    ],
    notes: ["死気（月建の神煞・第1群。正月午）とは別の神煞"],
  },
};

const shift = (start: Branch, steps: number): Branch => BRANCHES[(((BRANCHES.indexOf(start) + steps) % 12) + 12) % 12];
const ZHONG_BACK: readonly Branch[] = ["酉", "午", "卯", "子"];
const GUAN: readonly Branch[] = ["丑", "辰", "未", "戌"];

/** 月支 → 何月か（寅＝1 … 丑＝12） */
function monthNumber(monthBranch: Branch): number {
  const i = BRANCHES.indexOf(monthBranch);
  if (i < 0) throw new Error(`月支ではありません: ${monthBranch}`);
  return ((i - 2 + 12) % 12) + 1;
}

/** 基準の支 → 神煞の支（基準は太歳の支か月支。定義の basis に従う） */
export function secondarySpiritBranchOf(kind: SecondarySpiritKind, basisBranch: Branch): Branch {
  if (BRANCHES.indexOf(basisBranch) < 0) throw new Error(`支ではありません: ${basisBranch}`);
  switch (kind) {
    case "bingFu": return shift(basisBranch, -1);
    case "suiPo": return shift(basisBranch, 6);
    case "tianGui": return ZHONG_BACK[(monthNumber(basisBranch) - 1) % 4];
    case "guanShen": return GUAN[Math.floor((monthNumber(basisBranch) - 1) / 3)];
    case "shengShen": return shift("午", monthNumber(basisBranch) - 1);
    case "siShen": return shift("巳", monthNumber(basisBranch) - 1);
  }
}

/** 神煞の支と、その支が盤のどこに現れるか（吉凶・象意は持たない） */
export interface SecondarySpiritPlacement {
  kind: SecondarySpiritKind;
  name: string;
  basis: SecondarySpiritBasis;
  /** 求めた基準の支（太歳の支か月支） */
  basisBranch: Branch;
  branch: Branch;
  /** 神煞の支そのものが占日の旬空か */
  isVoid: boolean;
  /** 神煞の支（天盤）が加わる地盤支 */
  earthUnder: Branch;
  /** 神煞の支（天盤）に乗る天将 */
  general: HeavenlyGeneral;
  /** その支を上神とする四課（1＝干上・3＝支上） */
  lessons: readonly LessonOccurrence[];
  /** その支である三伝の位置。三伝未確定なら null */
  transmissions: readonly TransmissionOccurrence[] | null;
}

export type SecondarySpiritsState = Readonly<Record<SecondarySpiritKind, SecondarySpiritPlacement | null>>;

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 1つの神煞の位置。基準（太歳・月支）がなければ null */
export function secondarySpiritOf(facts: InterpretationFacts, kind: SecondarySpiritKind, bases: { taiSui?: Branch | null; monthBranch?: Branch | null }): SecondarySpiritPlacement | null {
  const basis = SECONDARY_SPIRIT_DEFINITIONS[kind].basis;
  const basisBranch = basis === "taiSui" ? bases.taiSui : bases.monthBranch;
  if (!basisBranch) return null;
  const branch = secondarySpiritBranchOf(kind, basisBranch);
  const isVoid = facts.xun.voidBranches.includes(branch);
  const ts = facts.transmissions;
  return {
    kind, name: SECONDARY_SPIRIT_DEFINITIONS[kind].name, basis, basisBranch, branch, isVoid,
    earthUnder: facts.plate.earthUnder[branch],
    general: facts.generals.generalOn[branch],
    lessons: facts.lessons.filter((l) => l.upper === branch).map((l) => ({ index: l.index, isVoid })),
    transmissions: ts ? POSITIONS.flatMap((position, i) => (ts[i].branch === branch ? [{ position, isVoid: ts[i].isVoid }] : [])) : null,
  };
}

/** 6種すべての位置（基準がない神煞は null。推測しない） */
export function secondarySpiritsOf(facts: InterpretationFacts, bases: { taiSui?: Branch | null; monthBranch?: Branch | null }): SecondarySpiritsState {
  const out = {} as Record<SecondarySpiritKind, SecondarySpiritPlacement | null>;
  for (const k of SECONDARY_SPIRIT_KINDS) out[k] = secondarySpiritOf(facts, k, bases);
  return out;
}
