// src/lib/liunian.ts
// 七政四餘：行限（大限・小限）と流年の連動（Phase 7A）
// - 対象年 = 出生年 + 対象年齢（現行アプリは 0歳＝出生年）
// - 大限・小限とも、クリックした宮が「対象年齢の大限宮／小限宮」のときだけ流年を求める
//   （大限の年齢範囲や小限ラベルの年齢から別の1年を選ばない）
// - 流年干支は共通暦エンジン calculate() の年干支を使う。年干支は立春で切り替わるため、
//   対象年の立春後の日付（7月1日正午）で引く
// - 太歳宮 = 流年の年支
// - 流年神殺は既存の神殺エンジン（年干・年支 → 宮）を対象年の年干・年支に当てたもの。出生時神殺とは別に保持する

import { calculate } from "./calendar";
import { getCurrentBigLimit, type Branch } from "./big_limit";
import { getCurrentSmallLimitBranch } from "./small_limit";
import { getNenganPalaceShensha, getNenshiPalaceShensha, type PalaceMap } from "./shensha_engine";
import type { Stem, Branch as ShenshaBranch } from "./shensha_tables";

export type Liunian =
  | {
      available: true;
      targetAge: number;
      targetYear: number;
      stem: string;          // 流年の年干
      branch: string;        // 流年の年支
      ganzhi: string;        // 流年干支
      taisuiBranch: string;  // 太歳宮（＝流年の年支）
      /** 流年神殺（対象年の年干・年支で既存の神殺エンジンを適用。出生時神殺とは別） */
      shensha: { year_stem: Partial<PalaceMap>; year_branch: Partial<PalaceMap> };
    }
  | { available: false; reason: "no_birth_year" | "no_target_age" | "not_target_limit" };

export const targetYearOf = (birthYear: number, targetAge: number) => birthYear + targetAge;

/** 対象年の流年干支・太歳宮・流年神殺（行限の判定は含まない） */
export function liunianOfYear(targetYear: number): { stem: string; branch: string } {
  const cal = calculate({ year: targetYear, month: 7, day: 1, hour: 12, minute: 0 });
  return { stem: String(cal.yearStem), branch: String(cal.yearBranch) };
}

export function getLiunianForLimit(args: {
  birthYear: number | null | undefined;
  targetAge: number | null | undefined;
  selection: { type: "big" | "small"; branch: string };
  mingBranch: string;
  mingDegree: number | null | undefined;
}): Liunian {
  const { birthYear, targetAge, selection } = args;
  if (birthYear == null || !Number.isInteger(birthYear)) return { available: false, reason: "no_birth_year" };
  if (targetAge == null || !Number.isInteger(targetAge) || targetAge < 0) return { available: false, reason: "no_target_age" };

  // クリックした宮が対象年齢の大限宮・小限宮か（既存の大限・小限の規則そのまま）
  const current =
    selection.type === "big"
      ? args.mingDegree != null ? getCurrentBigLimit(args.mingBranch as Branch, args.mingDegree, targetAge)?.branch ?? null : null
      : getCurrentSmallLimitBranch(args.mingBranch, targetAge);
  if (current !== selection.branch) return { available: false, reason: "not_target_limit" };

  const targetYear = targetYearOf(birthYear, targetAge);
  const { stem, branch } = liunianOfYear(targetYear);
  return {
    available: true,
    targetAge,
    targetYear,
    stem,
    branch,
    ganzhi: stem + branch,
    taisuiBranch: branch,
    shensha: {
      year_stem: getNenganPalaceShensha(stem as Stem),
      year_branch: getNenshiPalaceShensha(branch as ShenshaBranch),
    },
  };
}
