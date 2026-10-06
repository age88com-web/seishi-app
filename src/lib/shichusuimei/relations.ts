// src/lib/shichusuimei/relations.ts
//
// 干支の関係の存在検出（p67〜77、D19）。命式4柱の中だけを見る。
// 合化の成立条件・半会の作用・三刑の成立条件などの判断はしない（Phase 2）。
//
// - 干合・支合・冲・二刑: 表の組がそろう2柱の組ごとに1件
// - 三合: 表の3支がそろう柱の組ごとに1件（2支だけの半会は講座に記載がないので出さない）
// - 三刑: 表の3支のうち2支以上がある柱の組ごとに1件。3支そろうかを complete で示す
// - 自刑: 辰・午・酉・亥の同じ支が2柱以上にある組ごとに1件

import type { Branch, LuckRelation, LuckRelationType, Pillar, PillarKey, Relation, RelationMember, Stem } from "./types";
import { KANGO, SHIGO, CHU, SANGO, JIKEI, NIKEI, SANKEI, STEM_ELEMENT } from "./data";
import { controls, hangoElement, hankaiElement, SANKAI } from "./kakkyoku/common";

const PILLAR_KEYS: readonly PillarKey[] = ["時", "日", "月", "年"];

type Slot<T> = { pillar: PillarKey; value: T };

function pairs<T>(xs: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < xs.length; i += 1) for (let j = i + 1; j < xs.length; j += 1) out.push([xs[i], xs[j]]);
  return out;
}

function isPair<T>(a: T, b: T, table: readonly (readonly [T, T, ...unknown[]])[]): (readonly [T, T, ...unknown[]]) | undefined {
  return table.find(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/** 各グループの支ごとに該当する柱を選ぶ全組み合わせ（重複した支がある場合は複数） */
function combinations(group: readonly Branch[], branches: readonly Slot<Branch>[]): Slot<Branch>[][] {
  let acc: Slot<Branch>[][] = [[]];
  for (const g of group) {
    const slots = branches.filter((s) => s.value === g);
    if (slots.length === 0) continue;
    acc = acc.flatMap((c) => slots.map((s) => [...c, s]));
  }
  return acc;
}

export function detectRelations(pillars: { 時: Pillar | null; 日: Pillar; 月: Pillar; 年: Pillar }): Relation[] {
  const present = PILLAR_KEYS.filter((k) => pillars[k] !== null);
  const stems: Slot<Stem>[] = present.map((k) => ({ pillar: k, value: pillars[k]!.stem }));
  const branches: Slot<Branch>[] = present.map((k) => ({ pillar: k, value: pillars[k]!.branch }));
  const stemMember = (s: Slot<Stem>): RelationMember => ({ pillar: s.pillar, part: "干", value: s.value });
  const branchMember = (s: Slot<Branch>): RelationMember => ({ pillar: s.pillar, part: "支", value: s.value });
  const out: Relation[] = [];

  for (const [a, b] of pairs(stems)) {
    const row = isPair(a.value, b.value, KANGO);
    if (row) out.push({ type: "干合", members: [stemMember(a), stemMember(b)], tableElement: row[2] as string });
  }

  for (const [a, b] of pairs(branches)) {
    const members = [branchMember(a), branchMember(b)];
    if (isPair(a.value, b.value, SHIGO)) out.push({ type: "支合", members, tableElement: null });
    if (isPair(a.value, b.value, CHU)) out.push({ type: "冲", members, tableElement: null });
    if (isPair(a.value, b.value, NIKEI)) out.push({ type: "二刑", members, tableElement: null });
    if (a.value === b.value && JIKEI.includes(a.value)) out.push({ type: "自刑", members, tableElement: null });
  }

  for (const [group, kyoku] of SANGO) {
    if (!group.every((g) => branches.some((s) => s.value === g))) continue;
    for (const combo of combinations(group, branches)) {
      out.push({ type: "三合", members: combo.map(branchMember), tableElement: kyoku });
    }
  }

  for (const group of SANKEI) {
    const found = group.filter((g) => branches.some((s) => s.value === g));
    if (found.length < 2) continue;
    for (const combo of combinations(group, branches)) {
      out.push({ type: "三刑", members: combo.map(branchMember), tableElement: null, complete: found.length === 3 });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 大運干支と命式4柱の関係（存在検出のみ）。
// 判定表・規則は既存のものだけを使い、新しい表は作らない。
//   干合・支合・冲・三合・二刑・三刑・自刑 … 上の detectRelations と同じ表（p68〜77）
//   冲剋（干合の組以外の相剋） … 格局 KD12-10・KD13-13
//   半合（旺支を含む三合局の2支）・半会（三会の2支）・三会 … 格局 KD13（kakkyoku/common）
// 大運と命式の柱は隣り合う位置にないので、隣接の条件は付けない（大運支と各柱の支を1組ずつ見る）。
// 三合・三会は「大運支＋命式の支」で3支そろう組、三刑は大運支と同じ組の別の支がある組を出す。
// 内格点数の優先順位（三合＞半合＞六合＞冲）で間引かず、成立する関係はすべて返す。
// ---------------------------------------------------------------------------

function stemsClash(a: Stem, b: Stem): boolean {
  const ea = STEM_ELEMENT[a];
  const eb = STEM_ELEMENT[b];
  return (controls(ea, eb) || controls(eb, ea)) && !isPair(a, b, KANGO);
}

export function detectLuckRelations(
  pillars: { 時: Pillar | null; 日: Pillar; 月: Pillar; 年: Pillar },
  luck: Pillar,
): LuckRelation[] {
  const present = (["年", "月", "日", "時"] as const).filter((k) => pillars[k] !== null);
  const out: LuckRelation[] = [];

  for (const k of present) {
    const row = isPair(luck.stem, pillars[k]!.stem, KANGO);
    if (row) out.push({ type: "干合", part: "干", natal: [k], tableElement: row[2] as string });
    else if (stemsClash(luck.stem, pillars[k]!.stem)) out.push({ type: "冲剋", part: "干", natal: [k], tableElement: null });
  }

  const lb = luck.branch;
  for (const k of present) {
    const nb = pillars[k]!.branch;
    const one = (type: LuckRelationType, tableElement: string | null = null) =>
      out.push({ type, part: "支", natal: [k], tableElement });
    if (isPair(lb, nb, SHIGO)) one("支合");
    if (isPair(lb, nb, CHU)) one("冲");
    const hg = hangoElement(lb, nb);
    if (hg) one("半合", hg);
    const hk = hankaiElement(lb, nb);
    if (hk) one("半会", hk);
    if (isPair(lb, nb, NIKEI)) one("二刑");
    if (lb === nb && JIKEI.includes(lb)) one("自刑");
  }

  const branches: Slot<Branch>[] = present.map((k) => ({ pillar: k, value: pillars[k]!.branch }));
  /** 大運支を含む3支の組で、残り2支を命式から選ぶ全組み合わせ */
  const withLuck = (group: readonly Branch[]) => {
    if (!group.includes(lb)) return [];
    const rest = group.filter((g) => g !== lb);
    return combinations(rest, branches).filter((c) => c.length > 0);
  };
  for (const [group, kyoku] of SANGO) {
    for (const c of withLuck(group)) {
      if (c.length === 2) out.push({ type: "三合", part: "支", natal: c.map((s) => s.pillar), tableElement: kyoku });
    }
  }
  for (const { group, element } of SANKAI) {
    for (const c of withLuck(group)) {
      if (c.length === 2) out.push({ type: "三会", part: "支", natal: c.map((s) => s.pillar), tableElement: element });
    }
  }
  for (const group of SANKEI) {
    for (const c of withLuck(group)) {
      out.push({ type: "三刑", part: "支", natal: c.map((s) => s.pillar), tableElement: null, complete: c.length === 2 });
    }
  }
  return out;
}
