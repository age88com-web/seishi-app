// src/lib/liuren/interpretation/markers.ts
//
// 役割:
//   日徳・日禄・旬丁・驛馬など「特定の支を求め、その支が盤のどこに現れるか」の FACT。
//   支を求める純粋関数と、四課上神・三伝への出現（空亡かどうかを含む）を返すだけで、吉凶・象意は付けない。
//
// 表（ユーザー指定 2026-10-03。講座に表なし）:
//   日徳 … 甲己＝寅、乙庚＝申、丙辛＝巳、丁壬＝亥、戊癸＝巳
//   日禄 … 甲寅・乙卯・丙巳・丁午・戊巳・己午・庚申・辛酉・壬亥・癸子
//   他術（四柱推命の ROKU など）の表は使わない。
//
// 旬丁: 起課エンジンの resolveXun（旬首・空亡・遁干）の hiddenStemOf で、丁が遁する支を引く（六十甲子の計算は作らない）。
//
// 驛馬: 起課エンジンの YIMA（講座 p40。三合局の長生を冲する支）をそのまま使う。
//   ユーザー提示の表（申子辰→寅・寅午戌→申・亥卯未→巳・巳酉丑→亥）と12支すべてで一致することを確認済み。
//   yimaOf は基準の支を引数で受け取る（今回は日支。年命・太歳・月建などの馬は basis を変えて同じ関数で求められる）。

import { BRANCHES, YIMA } from "../constants";
import { resolveXun } from "../relations";
import type { Stem, Branch } from "../types";
import type {
  BranchMarker, DayMarkers, InterpretationFacts, MarkerBasis, MarkerKind, TransmissionPosition,
} from "./types";

const DAY_VIRTUE: Record<Stem, Branch> = {
  甲: "寅", 己: "寅",
  乙: "申", 庚: "申",
  丙: "巳", 辛: "巳",
  丁: "亥", 壬: "亥",
  戊: "巳", 癸: "巳",
};

const DAY_SALARY: Record<Stem, Branch> = {
  甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳",
  己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子",
};

/** 日徳の支 */
export function dayVirtueOf(dayStem: Stem): Branch {
  return DAY_VIRTUE[dayStem];
}

/** 日禄の支 */
export function daySalaryOf(dayStem: Stem): Branch {
  return DAY_SALARY[dayStem];
}

/** 旬丁の支（日干支の旬で丁が遁する支）。どの旬にも丁は1つだけある */
export function xunDingOf(dayStem: Stem, dayBranch: Branch): Branch {
  const { hiddenStemOf } = resolveXun(dayStem, dayBranch);
  const b = BRANCHES.find((x) => hiddenStemOf(x) === "丁");
  if (!b) throw new Error(`旬丁が見つかりません: ${dayStem}${dayBranch}`);
  return b;
}

/** 驛馬の支（基準の支の三合局の長生を冲する支） */
export function yimaOf(basisBranch: Branch): Branch {
  return YIMA[basisBranch];
}

const POSITIONS: readonly TransmissionPosition[] = ["initial", "middle", "final"];

/** 支が四課上神・三伝のどこに現れるか（空亡かどうかを含む） */
export function branchMarker(facts: InterpretationFacts, kind: MarkerKind, basis: MarkerBasis, branch: Branch): BranchMarker {
  const isVoid = facts.xun.voidBranches.includes(branch);
  const ts = facts.transmissions;
  return {
    kind, basis, branch, isVoid,
    lessons: facts.lessons.filter((l) => l.upper === branch).map((l) => ({ index: l.index, isVoid })),
    transmissions: ts
      ? POSITIONS.flatMap((position, i) => (ts[i].branch === branch ? [{ position, isVoid: ts[i].isVoid }] : []))
      : null,
  };
}

/** 日干支から求める標識一式（驛馬は日支基準） */
export function dayMarkersOf(facts: InterpretationFacts): DayMarkers {
  const { dayStem, dayBranch } = facts.basic;
  return {
    dayVirtue: branchMarker(facts, "dayVirtue", "dayStem", dayVirtueOf(dayStem)),
    daySalary: branchMarker(facts, "daySalary", "dayStem", daySalaryOf(dayStem)),
    xunDing: branchMarker(facts, "xunDing", "dayXun", xunDingOf(dayStem, dayBranch)),
    yima: branchMarker(facts, "yima", "dayBranch", yimaOf(dayBranch)),
  };
}
