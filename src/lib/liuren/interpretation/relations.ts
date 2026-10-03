// src/lib/liuren/interpretation/relations.ts
//
// 役割:
//   2つの干支の構造関係（生・剋・比和・冲・刑・六合・破・害）と、三合局の成立を返す。吉凶・強弱の判断はしない。
//   五行・刑・冲・三合の表は起課エンジン（constants.ts・relations.ts）のものを使う。
//
//   生・剋・比和 … 干・支どちらにも使える（五行で見る。elementOf・controls・ELEMENT_GENERATES）
//   冲・刑       … 支どうしのときだけ（CHONG・XING）
//   六合・破・害 … 支どうしのときだけ。向きのない対称関係（A→B と B→A で同じ）
//
// 刑について:
//   XING は1支に1支を対応させた表（講座 p32・p52。伏吟の中末伝で使うもの）をそのまま引く。
//   自刑（辰・午・酉・亥）は from と to が同じ支のとき punishes と punishedBy の両方になる。
//   三刑がそろうかどうかの判定はしない。
//
// 六合・破・害の表（Phase 3C。ユーザー指定 2026-10-03）:
//   六合 … 子丑・寅亥・卯戌・辰酉・巳申・午未（講座 p54 の「合」と同じ）
//   破   … 子酉・卯午・丑辰・未戌・寅亥・巳申（講座に表なし。ユーザー指定の六壬古典の破）
//   害   … 子未・丑午・寅巳・卯辰・申亥・酉戌（講座に表なし。ユーザー指定）
//   寅亥・巳申は六合と破が同時に成り立つ（破合）。表は起課エンジンになく、解釈専用としてここに置く。
//   七政四餘の六害表（shensha_tables.ts）は使わない。
//
// 十二長生・旺衰・墓庫は states.ts、三合局の成立は threeHarmonyOf（下）。

import { CHONG, XING, ELEMENT_GENERATES, SANHE, BRANCH_ELEMENT } from "../constants";
import { controls, elementOf, isStem } from "../relations";
import type { Stem, Branch } from "../types";
import type { RelationFact, StructuralRelation, ThreeHarmony } from "./types";

/** 対称な支の組 → 相手の支の表 */
function pairTable(pairs: readonly string[]): Partial<Record<Branch, Branch>> {
  const m: Partial<Record<Branch, Branch>> = {};
  for (const p of pairs) {
    const [a, b] = [...p] as Branch[];
    m[a] = b;
    m[b] = a;
  }
  return m;
}

const LIUHE = pairTable(["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"]);
const PO = pairTable(["子酉", "卯午", "丑辰", "未戌", "寅亥", "巳申"]);
const HAI = pairTable(["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]);

export function relationBetween(from: Stem | Branch, to: Stem | Branch): RelationFact {
  const relations: StructuralRelation[] = [];
  const ef = elementOf(from);
  const et = elementOf(to);

  if (ELEMENT_GENERATES[ef] === et) relations.push("generates");
  if (ELEMENT_GENERATES[et] === ef) relations.push("generatedBy");
  if (controls(from, to)) relations.push("overcomes");
  if (controls(to, from)) relations.push("overcomeBy");
  if (ef === et) relations.push("sameElement");

  if (!isStem(from) && !isStem(to)) {
    const a = from as Branch;
    const b = to as Branch;
    if (CHONG[a] === b) relations.push("clashes");
    if (XING[a] === b) relations.push("punishes");
    if (XING[b] === a) relations.push("punishedBy");
    if (LIUHE[a] === b) relations.push("combines");
    if (PO[a] === b) relations.push("breaks");
    if (HAI[a] === b) relations.push("harms");
  }

  return { from, to, relations };
}

/** 3支が完全な三合局か（順序は問わず集合で見る。講座 p54・SANHE。欠一神・凑合は扱わない） */
export function threeHarmonyOf(branches: readonly [Branch, Branch, Branch]): ThreeHarmony {
  const set = new Set(branches);
  if (set.size !== 3) return { complete: false };
  const group = SANHE.find((g) => g.every((b) => set.has(b)));
  if (!group) return { complete: false };
  return { complete: true, element: BRANCH_ELEMENT[group[1]], branches };
}
