// src/lib/liuren/interpretation/monthlySpirits.ts
//
// 役割（Phase 5K）:
//   月建（月支）から求める神煞の第1群（生気・死気・月厭・血支・血忌・天喜・天馬）の FACT。
//   神煞ごとに「どの支か」と「その支が盤のどこに現れるか」（四課上神・三伝・天盤で加わる地盤支・乗る天将・旬空）を返すだけで、
//   吉凶・象意・DOMAIN の判断は持たない。神煞ごとに算法の出典・確定状況・原典差を MONTHLY_SPIRIT_DEFINITIONS に持つ。
//
//   月支: 呼び出し側が渡す月支（domainBoardInput と同じ monthBranch。calendar.monthBranch＝節月）。月の数え方は寅月＝正月。
//     暦法・節気による月支の算出はしない。月支がなければ null（推測しない）。月将（chart.input.monthGeneral）は使わない。
//
//   算法（Phase 5J 監査 docs/liuren-missing-facts-audit.md §4-1 を出発点に、原文を再確認）:
//     生気 … 正月子・順行。明示の起例の文は取得資料にない。『六壬大全』卷九 毕法賦の例（月と支を直接書く15か所）から復元した算法
//     死気 … 正月午・順行。同上（生気とあわせて復元）
//     月厭 … 正月戌・逆行（『六壬心鏡』巻七「月厌，正月起戌逆十二」）
//     血支 … 正月丑・順行（『心鏡』巻五 産育門「血支，正月起丑顺行十二支」）
//     血忌 … 正丑・二未・三寅・四申・五卯・六酉・七辰・八戌・九巳・十亥・十一午・十二子（『心鏡』巻五 産育門の表）
//     天喜 … 春戌・夏丑・秋辰・冬未（『心鏡』巻五 産育門・巻六）。春＝寅卯辰月
//     天馬 … 正月午から陽支を順行（午・申・戌・子・寅・辰。『心鏡』巻二・巻三・巻六「正月起午，順行六陽神」）
//
//   既存 FACT との関係:
//     日徳・日禄・旬丁・驛馬（markers.ts）は変えない。天馬は驛馬（三合局の長生を冲する支・日支基準）と別の神煞で、二馬として合わせない。
//     『心鏡』の生神（正月午・順行）・死神（正月巳・順行）は名前が似ていても別の神煞で、ここでは作らない（生神は死気と同じ位置になるが統合しない）。

import { BRANCHES } from "../constants";
import type { Branch, HeavenlyGeneral } from "../types";
import type { InterpretationFacts, LessonOccurrence, TransmissionOccurrence, TransmissionPosition } from "./types";

/** 月建の神煞の種類 */
export type MonthlySpiritKind = "shengQi" | "siQi" | "yueYan" | "xueZhi" | "xueJi" | "tianXi" | "tianMa";

export const MONTHLY_SPIRIT_KINDS: readonly MonthlySpiritKind[] = ["shengQi", "siQi", "yueYan", "xueZhi", "xueJi", "tianXi", "tianMa"];

/**
 * 算法の確定状況。
 *   explicit                 … 起例（月と支の対応の規則）が原文に明示されている
 *   reconstructedFromExamples … 明示の起例の文が取得資料になく、原典の例から一意に復元した
 */
export type MonthlySpiritAlgorithmStatus = "explicit" | "reconstructedFromExamples";

/** 算法の出典（rule＝起例の文、example＝算法の復元に使った原典の例） */
export interface MonthlySpiritSource {
  source: "『六壬心鏡』" | "『六壬大全』" | "『大六壬指南』" | "『御定六壬直指』";
  locator: string;
  layer: "原文" | "注";
  role: "rule" | "example";
  quote: string;
}

export interface MonthlySpiritDefinition {
  kind: MonthlySpiritKind;
  name: string;
  /** 算法の説明（月支 → 支） */
  algorithm: string;
  status: MonthlySpiritAlgorithmStatus;
  sources: readonly MonthlySpiritSource[];
  /** 原典差・注意（なければ空） */
  notes: readonly string[];
}

const XJ = (locator: string, quote: string, layer: "原文" | "注" = "原文"): MonthlySpiritSource => ({ source: "『六壬心鏡』", locator, layer, role: "rule", quote });
const DQ9 = (quote: string): MonthlySpiritSource => ({ source: "『六壬大全』", locator: "卷九 毕法赋", layer: "原文", role: "example", quote });

export const MONTHLY_SPIRIT_DEFINITIONS: Readonly<Record<MonthlySpiritKind, MonthlySpiritDefinition>> = {
  shengQi: {
    kind: "shengQi", name: "生気", algorithm: "正月（寅月）子から順行", status: "reconstructedFromExamples",
    sources: [
      DQ9("及七月生气在午"),
      DQ9("六月占，巳加母年命。十二月占，亥加母年命上。缘生气作月厌"),
      DQ9("六庚六辛日，四月占皆然"),
      DQ9("六戊六已日，正月占，亦主孕喜"),
    ],
    notes: [
      "起例の文は取得資料にない。死気とあわせ、『大全』卷九の17か所（生気5・死気12。月と支を直接書く15か所と、胎神から求める2か所）から復元した。生気は直接書く3か所（七月午・六月巳・十二月亥）と胎神から求める2か所（庚辛日の四月＝卯・戊己日の正月＝子）",
      "17か所のうち1か所（「六戊六已日，正月占」の正月＝子）は戊己日の胎神を子とする説に依存する（胎神は子・午の二説）。これを除く16か所でも同じ算法になる",
      "独立した検証例（復元に使っていない書）: 『大六壬指南』孕産章第八 占験三（丁丑年四月）の割注「但末传卯作支之胎神生气」＝四月の生気は卯",
      "『六壬心鏡』の生神（正月午・順行）は別の神煞で、位置は死気と同じになるが統合しない",
    ],
  },
  siQi: {
    kind: "siQi", name: "死気", algorithm: "正月（寅月）午から順行", status: "reconstructedFromExamples",
    sources: [
      DQ9("七月死气在子"), DQ9("十月死气在夘"), DQ9("正月死气在午"), DQ9("四月死气在酉"),
      DQ9("乃六合三月占加申，四月占加酉，乃月之死气克六合"),
      DQ9("如十一月占，天后乘辰。五月占，天后乘戌。八月占，天后乘丑。二月占，天后乘未。已上者，乃月内死气克天后也"),
      DQ9("如三月占，不宜申加母年命上。九月占，不宜寅加母年命上。缘死气作月厌"),
    ],
    notes: [
      "起例の文は取得資料にない。生気とあわせ、『大全』卷九の17か所から復元した。死気は月と支を直接書く12か所（胎財死気4・忧子格2・忧母格4・月厭煞2）",
      "独立した検証例（復元に使っていない書）: 『大六壬指南』孕産章第八 占験三（丁丑年四月）の割注「酉为日之胎鬼死气」＝四月の死気は酉",
      "『六壬心鏡』の死神（正月巳・順行）は別の神煞",
    ],
  },
  yueYan: {
    kind: "yueYan", name: "月厭", algorithm: "正月（寅月）戌から逆行", status: "explicit",
    sources: [XJ("巻七 雜課門（占怪）郇注", "月厌，正月起戌逆十二", "注")],
    notes: [],
  },
  xueZhi: {
    kind: "xueZhi", name: "血支", algorithm: "正月（寅月）丑から順行", status: "explicit",
    sources: [XJ("巻五 産育門 注", "血支，正月起丑顺行十二支", "注")],
    notes: [],
  },
  xueJi: {
    kind: "xueJi", name: "血忌", algorithm: "正丑・二未・三寅・四申・五卯・六酉・七辰・八戌・九巳・十亥・十一午・十二子", status: "explicit",
    sources: [XJ("巻五 産育門 注", "血忌，正月丑，二月未，三月寅，四月申，五月卯，六月酉，七月辰，八月戌，九月巳，十月亥，十一月午，十二月子", "注")],
    notes: ["『大六壬指南』選挙章 占験二の割注は、本文の「血忌加支」を「血支之誤」とする（表そのものは『心鏡』と同じ）"],
  },
  tianXi: {
    kind: "tianXi", name: "天喜", algorithm: "春（寅卯辰月）戌・夏（巳午未月）丑・秋（申酉戌月）辰・冬（亥子丑月）未", status: "explicit",
    sources: [XJ("巻五 産育門 注", "天喜，春戌，夏丑，秋辰，冬未也", "注"), XJ("巻六 官訟門 郇注", "天喜，春戌夏丑秋辰冬未", "注")],
    notes: ["『六壬大全』卷九「夫天喜者，乃逐季养」（季の五行の養）と同じ支になる"],
  },
  tianMa: {
    kind: "tianMa", name: "天馬", algorithm: "正月（寅月）午から陽支を順行（午・申・戌・子・寅・辰）", status: "explicit",
    sources: [
      XJ("巻二 隱匿門", "天马正月起午，顺行六阳神", "注"),
      XJ("巻三 吉泰門", "天马，正月午顺行六阳", "注"),
      XJ("巻六 官職門", "天马，正午顺行六阳神", "注"),
    ],
    notes: ["驛馬（三合局の長生を冲する支・markers.ts）とは別の神煞。二馬（驛馬・天馬）としてまとめる判断は DOMAIN 側で行う"],
  },
};

/** 月支 → 何月か（寅＝1 … 丑＝12） */
export function lunarMonthNumberOf(monthBranch: Branch): number {
  const i = BRANCHES.indexOf(monthBranch);
  if (i < 0) throw new Error(`月支ではありません: ${monthBranch}`);
  return ((i - 2 + 12) % 12) + 1;
}

const shift = (start: Branch, steps: number): Branch => BRANCHES[(((BRANCHES.indexOf(start) + steps) % 12) + 12) % 12];
const XUE_JI: readonly Branch[] = ["丑", "未", "寅", "申", "卯", "酉", "辰", "戌", "巳", "亥", "午", "子"];
const TIAN_XI: readonly Branch[] = ["戌", "丑", "辰", "未"];

/** 月支 → 神煞の支 */
export function monthlySpiritBranchOf(kind: MonthlySpiritKind, monthBranch: Branch): Branch {
  const n = lunarMonthNumberOf(monthBranch) - 1; // 正月＝0
  switch (kind) {
    case "shengQi": return shift("子", n);
    case "siQi": return shift("午", n);
    case "yueYan": return shift("戌", -n);
    case "xueZhi": return shift("丑", n);
    case "xueJi": return XUE_JI[n];
    case "tianXi": return TIAN_XI[Math.floor(n / 3)];
    case "tianMa": return shift("午", 2 * n);
  }
}

/** 神煞の支と、その支が盤のどこに現れるか（吉凶・象意は持たない） */
export interface MonthlySpiritPlacement {
  kind: MonthlySpiritKind;
  name: string;
  monthBranch: Branch;
  branch: Branch;
  /** 神煞の支そのものが占日の旬空か（facts.xun.voidBranches） */
  isVoid: boolean;
  /** 神煞の支（天盤）が加わる地盤支（plate.earthUnder） */
  earthUnder: Branch;
  /** 神煞の支（天盤）に乗る天将（generals.generalOn） */
  general: HeavenlyGeneral;
  /** その支を上神とする四課（重複課はすべて。1＝干上・3＝支上） */
  lessons: readonly LessonOccurrence[];
  /** その支である三伝の位置。三伝未確定なら null */
  transmissions: readonly TransmissionOccurrence[] | null;
}

export type MonthlySpiritsState = Readonly<Record<MonthlySpiritKind, MonthlySpiritPlacement>>;

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 1つの神煞の位置。月支がなければ null */
export function monthlySpiritOf(facts: InterpretationFacts, kind: MonthlySpiritKind, monthBranch: Branch | null | undefined): MonthlySpiritPlacement | null {
  if (!monthBranch) return null;
  const branch = monthlySpiritBranchOf(kind, monthBranch);
  const isVoid = facts.xun.voidBranches.includes(branch);
  const ts = facts.transmissions;
  return {
    kind, name: MONTHLY_SPIRIT_DEFINITIONS[kind].name, monthBranch, branch, isVoid,
    earthUnder: facts.plate.earthUnder[branch],
    general: facts.generals.generalOn[branch],
    lessons: facts.lessons.filter((l) => l.upper === branch).map((l) => ({ index: l.index, isVoid })),
    transmissions: ts ? POSITIONS.flatMap((position, i) => (ts[i].branch === branch ? [{ position, isVoid: ts[i].isVoid }] : [])) : null,
  };
}

/** 月建の神煞・第1群すべての位置。月支がなければ null（推測しない） */
export function monthlySpiritsOf(facts: InterpretationFacts, monthBranch: Branch | null | undefined): MonthlySpiritsState | null {
  if (!monthBranch) return null;
  const out = {} as Record<MonthlySpiritKind, MonthlySpiritPlacement>;
  for (const k of MONTHLY_SPIRIT_KINDS) out[k] = monthlySpiritOf(facts, k, monthBranch)!;
  return out;
}
