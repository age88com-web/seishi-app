// src/lib/takujitsu/shinsatsu/kyoushinGroup7.ts
//
// 役割:
//   未解決神殺の資料研究フェーズ（2026-10-26 監修決定）で成立条件が確定した
//   日家凶神（天狗・復日・重日・五離・天罡・河魁）を判定する。他グループのファイルは
//   変更していない。血忌は監修決定（Q4＝C）で保留のため実装しない。
//
// 仕様根拠（成立条件。宜忌・解除は activityProfiles.ts／resolution/rules.ts）:
//   ・天狗：申月の満日（＝戌日）。監修決定 Q2＝A。神殺象意〔滿日〕〔天狗〕「申月又爲天狗」、
//     『協紀辨方書』卷四 按「天狗者戌日值滿也…天狗為申建之戌止一位」、擇日実例.pdf
//     （申月の戌日4行すべて）が一致する。擇日テキスト.pdf 5）「戊の日の満日」の「戊」は
//     「戌」の誤記として扱う（原本の印字は「戊」）。
//   ・復日：『協紀辨方書』卷五 歴例「正七月甲庚、二八月乙辛、四十月丙壬、五十一月丁癸、
//     三九六十二月戊己」（四庫本の字は「戊巳」。曹震圭注「辰戌即戊也、丑未即己也」により
//     戊己と読む）。月建と同じ気の日干。
//   ・重日：同 卷五 歴例「巳亥二日」（四庫本の字は「己亥」。曹震圭注「亥為隂極…巳為陽極」
//     により巳亥と読む）。
//   ・五離：同 卷五 歴例「五離者申酉日是也」。
//   ・天罡・河魁：同 卷四 歴例「陽建之月前三辰為天罡、後三辰為河魁、隂建之月反是」
//     （曹震圭注「平收之日也」、建除同位異名「平＝陽月天罡・隂月河魁、收＝陽月河魁・
//     隂月天罡」）。
//   外部資料（協紀辨方書）を成立条件の出典とすることは監修決定 Q1＝A による。
//
// 検証区分:
//   すべて月令（月建）＋日干支で決まるため擇日実例.pdf と照合できる
//   （tests/takujitsu_unresolved_shinsatsu_unit.manual.ts）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

/** 復日：月建ごとの日干（協紀辨方書 卷五 歴例）。 */
const FURI_STEM: Record<string, string> = {
  寅: "甲", 申: "庚",
  卯: "乙", 酉: "辛",
  巳: "丙", 亥: "壬",
  午: "丁", 子: "癸",
  辰: "戊", 戌: "戊",
  未: "己", 丑: "己",
};

function branchAt(base: string, offset: number): string {
  return BRANCHES[(BRANCHES.indexOf(base) + offset + 12) % 12];
}

/**
 * 天狗・復日・重日・五離・天罡・河魁を判定する。吉神は対象外のため kichijin は常に空配列。
 */
export function resolveKyoushinGroup7(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const kyojin: string[] = [];

  // ［区分A］天狗：申月の満日（月建の前二辰＝戌）。
  if (monthBranch === "申" && dayBranch === branchAt(monthBranch, 2)) kyojin.push("天狗");
  // ［区分A］復日：月建と同じ気の日干。
  if (FURI_STEM[monthBranch] === dayStem) kyojin.push("復日");
  // ［区分A］重日：巳亥の日。
  if (dayBranch === "巳" || dayBranch === "亥") kyojin.push("重日");
  // ［区分A］五離：申酉の日。
  if (dayBranch === "申" || dayBranch === "酉") kyojin.push("五離");
  // ［区分A］天罡・河魁：陽建の月は前三辰が天罡・後三辰が河魁、陰建の月は逆。
  if (BRANCHES.includes(monthBranch)) {
    const yangMonth = BRANCHES.indexOf(monthBranch) % 2 === 0;
    const front3 = branchAt(monthBranch, 3);
    const back3 = branchAt(monthBranch, -3);
    if (dayBranch === (yangMonth ? front3 : back3)) kyojin.push("天罡");
    if (dayBranch === (yangMonth ? back3 : front3)) kyojin.push("河魁");
  }

  return { kichijin: [], kyojin };
}
