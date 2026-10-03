// src/lib/liuren/relations.ts
//
// 役割:
//   干支の関係（五行・剋・陰陽・六親）と、旬・空亡・遁干の計算。
//   四課・三伝・付加情報の各モジュールから共通に使う。

import {
  STEMS, BRANCHES, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENT_CONTROLS, ELEMENT_GENERATES,
  isYangStem, isYangBranch,
} from "./constants";
import type { Stem, Branch, Element, SixRelation } from "./types";

export function isStem(x: string): x is Stem {
  return (STEMS as readonly string[]).includes(x);
}

export function elementOf(x: Stem | Branch): Element {
  return isStem(x) ? STEM_ELEMENT[x] : BRANCH_ELEMENT[x as Branch];
}

export function isYang(x: Stem | Branch): boolean {
  return isStem(x) ? isYangStem(x) : isYangBranch(x as Branch);
}

/** a が b を剋すか（五行の相剋） */
export function controls(a: Stem | Branch, b: Stem | Branch): boolean {
  return ELEMENT_CONTROLS[elementOf(a)] === elementOf(b);
}

/** 支を十二支順に n 進める（負なら戻る） */
export function shiftBranch(b: Branch, n: number): Branch {
  const i = BRANCHES.indexOf(b);
  return BRANCHES[(((i + n) % 12) + 12) % 12];
}

/** 六親（講座 p55。日干の五行を基準に見る：p44「日干からみた六親」） */
export function sixRelation(dayStem: Stem, target: Branch): SixRelation {
  const me = STEM_ELEMENT[dayStem];
  const other = BRANCH_ELEMENT[target];
  if (me === other) return "兄弟";
  if (ELEMENT_GENERATES[me] === other) return "子孫";
  if (ELEMENT_GENERATES[other] === me) return "父母";
  if (ELEMENT_CONTROLS[me] === other) return "妻財";
  return "官鬼";
}

/**
 * 日干支の旬（講座 p44 の六旬表）。
 * 旬首＝その旬の甲の干支、空亡＝旬に干が当たらない2支。
 * 遁干＝旬の中で支に当たる干。空亡の支は遁干なし（講座 p44 の「○」）。
 */
export function resolveXun(dayStem: Stem, dayBranch: Branch): {
  xunHead: string;
  voidBranches: readonly [Branch, Branch];
  hiddenStemOf: (b: Branch) => Stem | null;
} {
  const s = STEMS.indexOf(dayStem);
  const b = BRANCHES.indexOf(dayBranch);
  // 旬首（甲）の支 = 日支から日干の番号ぶん戻った支
  const headBranchIndex = (((b - s) % 12) + 12) % 12;
  const xunHead = `甲${BRANCHES[headBranchIndex]}`;
  const voidBranches: readonly [Branch, Branch] = [
    BRANCHES[(headBranchIndex + 10) % 12],
    BRANCHES[(headBranchIndex + 11) % 12],
  ];
  const hiddenStemOf = (target: Branch): Stem | null => {
    const k = (((BRANCHES.indexOf(target) - headBranchIndex) % 12) + 12) % 12;
    return k < 10 ? STEMS[k] : null;
  };
  return { xunHead, voidBranches, hiddenStemOf };
}
