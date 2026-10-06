// src/lib/takujitsu/personal/honmeisatsu.ts
//
// 役割:
//   年命（年干支）と候補日の日支から、本命殺4種（相冲・三殺・三刑・箭刃）を
//   独立判定する純関数。点数化・強弱・優先順位づけはしない。
//
// 唯一の仕様根拠:
//   秀山確認済み「本命殺.csv」。60干支全件について、下記4対応表と
//   1件ずつ突合し完全一致を確認済み（tests/takujitsu_personal_honmeisatsu_unit.manual.ts）。
//   検証用の原本コピーは tests/fixtures/honmeisatsu.csv に保管する。
//   一般的な命理・擇日知識による補完・他流派規則への置き換えは禁止。
//
// 判定基準（本命殺.csv 60/60件と一致）:
//   相冲・三殺・三刑 … 年命の「地支」だけで決まる。
//   箭刃            … 年命の「天干」だけで決まる。

import type { PersonalAvoidReason, PersonalAvoidType } from "./types";

/** 相冲: 年支 → 冲する支（1件）。 */
const SOCHUU: Record<string, string> = {
  子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥",
  午: "子", 未: "丑", 申: "寅", 酉: "卯", 戌: "辰", 亥: "巳",
};

/** 三殺: 年支 → 該当する支（1件）。 */
const SANSATSU: Record<string, string> = {
  子: "未", 丑: "辰", 寅: "丑", 卯: "戌", 辰: "未", 巳: "辰",
  午: "丑", 未: "戌", 申: "未", 酉: "辰", 戌: "丑", 亥: "戌",
};

/** 三刑: 年支 → 該当する支（1〜2件。いずれかに一致すれば成立）。 */
const SANKEI: Record<string, string[]> = {
  子: ["卯"],
  丑: ["戌"],
  寅: ["巳"],
  卯: ["子"],
  辰: ["辰"],
  巳: ["寅", "申"],
  午: ["午"],
  未: ["戌"],
  申: ["巳"],
  酉: ["酉"],
  戌: ["丑", "未"],
  亥: ["亥"],
};

/** 箭刃: 年干 → 該当する支（2件。いずれかに一致すれば成立）。 */
const SENJIN: Record<string, string[]> = {
  甲: ["卯", "酉"], 庚: ["卯", "酉"],
  乙: ["辰", "戌"], 辛: ["辰", "戌"],
  丙: ["子", "午"], 戊: ["子", "午"], 壬: ["子", "午"],
  丁: ["丑", "未"], 己: ["丑", "未"], 癸: ["丑", "未"],
};

/**
 * 年命（yearStem・yearBranch）と候補日の日支（dayBranch）から、
 * 相冲・三殺・三刑・箭刃を独立に判定する。
 * 出生時刻不明などによる undetermined はこの関数の対象外（呼び出し側が扱う）。
 */
export function evaluatePersonalHonmeisatsu(
  yearStem: string,
  yearBranch: string,
  dayBranch: string,
): { status: "clear" | "avoid"; reasons: PersonalAvoidReason[] } {
  const reasons: PersonalAvoidReason[] = [];
  const push = (type: PersonalAvoidType) => {
    reasons.push({ type, yearStem, yearBranch, dayBranch });
  };

  if (SOCHUU[yearBranch] === dayBranch) push("相冲");
  if (SANSATSU[yearBranch] === dayBranch) push("三殺");
  if ((SANKEI[yearBranch] ?? []).includes(dayBranch)) push("三刑");
  if ((SENJIN[yearStem] ?? []).includes(dayBranch)) push("箭刃");

  return { status: reasons.length > 0 ? "avoid" : "clear", reasons };
}
