// src/lib/qimen/dingju.ts
//
// 役割:
//   奇門遁甲「定局」— CalendarEngine の出力（solarTerm / dayStem / dayBranch）から
//   陽遁・陰遁 / 上元・中元・下元 / 局数（1〜9）だけを求める。
//   地盤・天盤・八門・九星・八神・格局判定は行わない。
//
// 仕様の出典:
//   講義テキストの【陰陽遁】【三元】【陽遁の局数】【陰遁の局数】のみ。
//   それ以外の理論は追加しない。1080局からの逆算は行わない。

import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch } from "../eto";

export interface DingjuInput {
  solarTerm: string;
  dayStem: Stem;
  dayBranch: Branch;
}

export type Dun = "陽遁" | "陰遁";
export type Yuan = "上元" | "中元" | "下元";

export interface DingjuResult {
  dun: Dun;
  yuan: Yuan;
  ju: number;
}

const YANG_DUN_TERMS = new Set([
  "冬至", "小寒", "大寒", "立春", "雨水", "啓蟄",
  "春分", "清明", "穀雨", "立夏", "小満", "芒種",
]);

const YIN_DUN_TERMS = new Set([
  "夏至", "小暑", "大暑", "立秋", "処暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
]);

// 上元・中元・下元それぞれの「符頭」（5日単位の先頭日の干支）
const SHANG_YUAN_FUTOU = ["甲子", "己卯", "甲午", "己酉"];
const ZHONG_YUAN_FUTOU = ["己巳", "甲申", "己亥", "甲寅"];
const XIA_YUAN_FUTOU = ["甲戌", "己丑", "甲辰", "己未"];

// [上元, 中元, 下元] の局数
const YANG_JU_TABLE: Record<string, [number, number, number]> = {
  "冬至": [1, 7, 4],
  "啓蟄": [1, 7, 4],
  "小寒": [2, 8, 5],
  "春分": [3, 9, 6],
  "大寒": [3, 9, 6],
  "芒種": [6, 3, 9],
  "穀雨": [5, 2, 8],
  "小満": [5, 2, 8],
  "立春": [8, 5, 2],
  "立夏": [4, 1, 7],
  "清明": [4, 1, 7],
  "雨水": [9, 6, 2],
};

const YIN_JU_TABLE: Record<string, [number, number, number]> = {
  "夏至": [9, 3, 6],
  "白露": [9, 3, 6],
  "小暑": [8, 2, 5],
  "秋分": [7, 1, 4],
  "大暑": [7, 1, 4],
  "立秋": [2, 5, 8],
  "霜降": [5, 8, 3],
  "小雪": [5, 8, 3],
  "大雪": [4, 7, 1],
  "処暑": [1, 4, 7],
  "立冬": [6, 9, 3],
  "寒露": [6, 9, 3],
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 干支（幹・支）から六十干支インデックス（甲子=0）を求める。 */
function ganzhiIndex(stem: Stem, branch: Branch): number {
  const stemIndex = STEMS.indexOf(stem);
  const branchIndex = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) {
      return i;
    }
  }
  throw new Error(`invalid ganzhi combination: ${stem}${branch}`);
}

function ganzhiAt(index: number): string {
  return `${STEMS[mod(index, 10)]}${BRANCHES[mod(index, 12)]}`;
}

function resolveYuan(dayStem: Stem, dayBranch: Branch): Yuan {
  const dayIndex = ganzhiIndex(dayStem, dayBranch);
  const futouIndex = dayIndex - mod(dayIndex, 5);
  const futou = ganzhiAt(futouIndex);

  if (SHANG_YUAN_FUTOU.includes(futou)) return "上元";
  if (ZHONG_YUAN_FUTOU.includes(futou)) return "中元";
  if (XIA_YUAN_FUTOU.includes(futou)) return "下元";

  throw new Error(`符頭が三元のいずれにも該当しません: ${futou}`);
}

function resolveDun(solarTerm: string): Dun {
  if (YANG_DUN_TERMS.has(solarTerm)) return "陽遁";
  if (YIN_DUN_TERMS.has(solarTerm)) return "陰遁";
  throw new Error(`未知の節気です: ${solarTerm}`);
}

function resolveJu(dun: Dun, solarTerm: string, yuan: Yuan): number {
  const table = dun === "陽遁" ? YANG_JU_TABLE : YIN_JU_TABLE;
  const row = table[solarTerm];
  if (!row) {
    throw new Error(`局数表に節気が見つかりません: ${solarTerm}`);
  }
  const yuanIndex = yuan === "上元" ? 0 : yuan === "中元" ? 1 : 2;
  return row[yuanIndex];
}

/**
 * 定局: 陽遁/陰遁・上元/中元/下元・局数(1〜9) を返す。
 * 地盤・天盤・八門・九星・八神・格局判定は行わない。
 */
export function resolveDingju(input: DingjuInput): DingjuResult {
  const { solarTerm, dayStem, dayBranch } = input;

  const dun = resolveDun(solarTerm);
  const yuan = resolveYuan(dayStem, dayBranch);
  const ju = resolveJu(dun, solarTerm, yuan);

  return { dun, yuan, ju };
}
