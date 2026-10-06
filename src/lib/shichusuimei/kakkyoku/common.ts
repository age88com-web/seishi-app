// src/lib/shichusuimei/kakkyoku/common.ts
//
// 強弱・格局判定の共通部品。表は既存データを再利用し、新しい表は作らない。
//   地支の五行 … src/lib/liuren/constants.ts の BRANCH_ELEMENT
//   季節の3支（三会） … src/lib/takujitsu/shinsatsu/kichijinGroup2.ts の SEASON_GROUPS
//   本気 … 蔵干（p114）のうち地支と同じ五行の干（12支すべてで一意）

import { BRANCH_ELEMENT } from "../../liuren/constants";
import { SEASON_GROUPS } from "../../takujitsu/shinsatsu/kichijinGroup2";
import type { Branch, Element, Pillar, PillarKey, Stem } from "../types";
import { STEM_ELEMENT, GENERATES, CONTROLS, SANGO } from "../data";
import { zokanOf } from "../zokan";
import type { Pillars } from "./types";

export { BRANCH_ELEMENT };

export const ELEMENTS: readonly Element[] = ["木", "火", "土", "金", "水"];

/** 命式上の並び（右から年・月・日・時）。隣接は年−月・月−日・日−時だけ */
export const ORDER: readonly PillarKey[] = ["年", "月", "日", "時"];

export interface Slot {
  pillar: PillarKey;
  stem: Stem;
  branch: Branch;
}

export function slotsOf(p: Pillars): Slot[] {
  return ORDER.filter((k) => p[k] !== null).map((k) => ({ pillar: k, stem: p[k]!.stem, branch: p[k]!.branch }));
}

/** 実際に左右に隣接する柱の組（年−月・月−日・日−時。時柱なしなら2組） */
export function adjacentPairs(p: Pillars): [PillarKey, PillarKey][] {
  const pairs: [PillarKey, PillarKey][] = [["年", "月"], ["月", "日"], ["日", "時"]];
  return pairs.filter(([a, b]) => p[a] !== null && p[b] !== null);
}

/** 地支の本気（蔵干のうち地支と同じ五行の干） */
export function mainQiStem(branch: Branch): Stem {
  const stems = zokanOf(branch).stems.filter((s) => STEM_ELEMENT[s] === BRANCH_ELEMENT[branch]);
  if (stems.length !== 1) throw new Error(`本気が一意に決まらない: ${branch}`);
  return stems[0];
}

/** 本気以外の蔵干 */
export function otherQiStems(branch: Branch): Stem[] {
  const main = mainQiStem(branch);
  return zokanOf(branch).stems.filter((s) => s !== main);
}

/** a が b を生じる */
export function generates(a: Element, b: Element): boolean {
  return GENERATES[a] === b;
}

/** a が b を剋す */
export function controls(a: Element, b: Element): boolean {
  return CONTROLS[a] === b;
}

/** 日干から見た印の五行（日干を生じる五行） */
export function inElementOf(dayEl: Element): Element {
  return ELEMENTS.find((e) => generates(e, dayEl))!;
}

/** 天干・地支（表面）の五行の一覧 */
export function surfaceElements(pillars: Pillar[]): Element[] {
  return pillars.flatMap((p) => [STEM_ELEMENT[p.stem], BRANCH_ELEMENT[p.branch]]);
}

/** 三合（p74）で3支そろう組（隣接不要） */
export function completeSango(branches: Branch[]): { group: readonly Branch[]; element: Element; kyoku: string }[] {
  return SANGO.filter(([g]) => g.every((b) => branches.includes(b))).map(([g, kyoku]) => ({
    group: g,
    element: kyoku[0] as Element,
    kyoku,
  }));
}

/** 三会（季節の3支）の組と、その五行（3支のうち2支が共有する五行） */
export const SANKAI: { group: readonly Branch[]; element: Element }[] = SEASON_GROUPS.map((g) => {
  const group = g as readonly Branch[];
  const count = new Map<Element, number>();
  for (const b of group) count.set(BRANCH_ELEMENT[b], (count.get(BRANCH_ELEMENT[b]) ?? 0) + 1);
  const element = [...count.entries()].find(([, n]) => n >= 2)![0];
  return { group, element };
});

export function completeSankai(branches: Branch[]): { group: readonly Branch[]; element: Element }[] {
  return SANKAI.filter(({ group }) => group.every((b) => branches.includes(b)));
}

/** 半合の旺支（KD13-10） */
export const WANG_BRANCHES: readonly Branch[] = ["子", "午", "卯", "酉"];

/** 半合: 三合局の2支で旺支を含む組（KD13-10）。局の五行を返す */
export function hangoElement(a: Branch, b: Branch): Element | null {
  if (a === b || !(WANG_BRANCHES.includes(a) || WANG_BRANCHES.includes(b))) return null;
  const row = SANGO.find(([g]) => g.includes(a) && g.includes(b));
  return row ? (row[1][0] as Element) : null;
}

/** 半会: 三会（季節の3支）のうちの2支（KD13・ユーザー指定）。三会の五行を返す */
export function hankaiElement(a: Branch, b: Branch): Element | null {
  if (a === b) return null;
  return SANKAI.find(({ group }) => group.includes(a) && group.includes(b))?.element ?? null;
}

export function fmtPillar(p: Pillar): string {
  return `${p.stem}${p.branch}`;
}
