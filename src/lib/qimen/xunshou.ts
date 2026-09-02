// src/lib/qimen/xunshou.ts
//
// 役割:
//   奇門遁甲「旬首」— 時干支だけから、その時刻が属する旬・旬首・
//   六甲の隠れている六儀（liuyi）を求める。
//   天盤・九星・八門・八神・格局判定は行わない。
//
// 仕様の出典:
//   講義テキスト10〜14ページ（六十甲子には六つの旬がある／
//   旬の最初に来る時辰を旬首という／時間の干支から旬首を割り出し、
//   六甲の隠れている六儀を割り出す）と、ユーザー確認済みの旬首→六儀対応表のみ。
//   それ以外の理論は追加しない。1080局からの逆算は行わない。

import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch } from "../eto";

export interface XunShouInput {
  hourStem: Stem;
  hourBranch: Branch;
}

export interface XunShouResult {
  xun: string;
  xunShou: string;
  liuyi: string;
}

/** 旬首（甲＋支）→ 六甲の隠れている六儀。ユーザー確認済みの対応表。 */
const LIUYI_TABLE: Record<string, string> = {
  "子": "戊",
  "戌": "己",
  "申": "庚",
  "午": "辛",
  "辰": "壬",
  "寅": "癸",
};

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

function ganzhiAt(index: number): { stem: string; branch: string } {
  return { stem: STEMS[index % 10], branch: BRANCHES[index % 12] };
}

/**
 * 旬首: 時干支から、その時刻が属する旬・旬首・六儀(liuyi)を求める。
 * 天盤・九星・八門・八神・格局判定は行わない。
 */
export function resolveXunShou(input: XunShouInput): XunShouResult {
  const { hourStem, hourBranch } = input;

  const hourIndex = ganzhiIndex(hourStem, hourBranch);
  const xunStartIndex = hourIndex - (hourIndex % 10);
  const { stem: xunShouStem, branch: xunShouBranch } = ganzhiAt(xunStartIndex);
  const xunShou = `${xunShouStem}${xunShouBranch}`;
  const xun = `${xunShou}旬`;

  const liuyi = LIUYI_TABLE[xunShouBranch];
  if (!liuyi) {
    throw new Error(`旬首に対応する六儀が見つかりません: ${xunShou}`);
  }

  return { xun, xunShou, liuyi };
}
