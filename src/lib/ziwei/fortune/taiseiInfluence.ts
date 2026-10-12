// src/lib/ziwei/fortune/taiseiInfluence.ts
//
// 太歳宮による年運補助レイヤー（docs/ziwei-basic-spec.md §31）。
// 基礎２ S41「本来紫微斗数推命では、生まれ年（数え年）での小限を、流年として判断する。…流年の地支と同じ宮を太歳宮として
// 判断する…同宮、または三方四正に重疊や会照があるか？によって吉が増強されるかまたは凶が増強されるかを判断する。」
//   小限＝その年の基本年運（既存の小限層のまま）。太歳＝それを補助する層（小限を置き換えない）。
//   このレイヤーは太歳宮と三方四正（三合2宮・対宮）に「何が重なっているか」を取り出すだけ。
//   吉凶の増強の一般ルール（吉星数・化禄＋1 など）は資料にないので作らない。S40 喜忌・行運星曜象意は太歳に使わない。
//   羊陀夾忌の流年の記述（S33）は「流年＝小限」（§32）なので太歳層ではなく liunian.ts で判定する。

import { STAR_LUCK } from "../patterns/luck";
import type { LuckClass } from "../patterns/luck";
import { sanfangSizheng } from "../sanfang";
import type { Branch, PalaceName, PlacedStar, TransformationKind, ZiweiChart } from "../types";
import type { FortunePalaceEntry } from "./palaceMap";
import { fortunePalaceNameOf } from "./palaceMap";
import type { FortunePatternResult } from "./patterns";
import type { TaiseiContext } from "./taisei";
import { natalMatchedPatterns } from "./liunian";
import type { LayeredTransformation, LimitTransformations, TransformationOrigin } from "./types";

/** 太歳宮との関係（三方四正を1種類にまとめない） */
export type TaiseiRelation = "same_palace" | "trine" | "opposite";

export const TAISEI_RELATION_LABEL: Readonly<Record<TaiseiRelation, string>> = {
  same_palace: "太歳宮",
  trine: "太歳宮の三合宮",
  opposite: "太歳宮の対宮",
};

export interface TaiseiPalaceRef {
  branch: Branch;
  relation: TaiseiRelation;
  natalPalace: PalaceName;
  /** 選択中の大限・小限での宮名（なければ null） */
  majorPalace: PalaceName | null;
  minorPalace: PalaceName | null;
}

export type TaiseiOverlap =
  | {
      kind: "transformation";
      origin: TransformationOrigin;
      type: "化禄" | "化権" | "化科" | "化忌";
      star: PlacedStar;
      branch: Branch;
      relation: TaiseiRelation;
    }
  | { kind: "star"; star: PlacedStar; luck: LuckClass; branch: Branch; relation: TaiseiRelation }
  | {
      kind: "pattern";
      /** natal … 本命格局、major・minor … 行運格局 */
      layer: "natal" | "major" | "minor";
      id: string;
      name: string;
      status: "confirmed" | "needs_review" | "not_applicable";
      /** matched … 成立箇所、affected … 影響範囲（羊陀夾忌の対宮など） */
      role: "matched" | "affected";
      branch: Branch;
      relation: TaiseiRelation;
    };

export interface TaiseiPalaceContents {
  palace: TaiseiPalaceRef;
  transformations: Extract<TaiseiOverlap, { kind: "transformation" }>[];
  stars: Extract<TaiseiOverlap, { kind: "star" }>[];
  patterns: Extract<TaiseiOverlap, { kind: "pattern" }>[];
}

export interface TaiseiInfluence {
  taiseiBranch: Branch;
  taiseiPalace: PalaceName;
  yearStem: TaiseiContext["yearStem"];
  yearBranch: Branch;
  /** 小限（その年の基本年運）。太歳とは別の層として参照だけ持つ */
  minorLimit: { branch: Branch; palace: PalaceName; age: number } | null;
  samePalace: TaiseiPalaceContents;
  sanfangSizheng: {
    /** 三合2宮・対宮（太歳宮は含まない） */
    branches: [Branch, Branch, Branch];
    trines: [TaiseiPalaceContents, TaiseiPalaceContents];
    opposite: TaiseiPalaceContents;
  };
  /** 4宮の重なりの一覧（relation つき。層は統合しない） */
  overlaps: TaiseiOverlap[];
}

const TYPE_OF: Readonly<Record<TransformationKind, "化禄" | "化権" | "化科" | "化忌">> = { 化禄星: "化禄", 化権星: "化権", 化科星: "化科", 化忌星: "化忌" };

/** 太歳宮との関係（三方四正の外なら null） */
export function taiseiRelationOf(taiseiBranch: Branch, branch: Branch): TaiseiRelation | null {
  const sf = sanfangSizheng(taiseiBranch);
  if (branch === sf.self) return "same_palace";
  if (branch === sf.opposite) return "opposite";
  if (sf.trines.includes(branch)) return "trine";
  return null;
}

export interface TaiseiInfluenceInput {
  taisei: TaiseiContext;
  transformationsByBranch: Record<Branch, LayeredTransformation[]>;
  majorLimit: LimitTransformations | null;
  minorLimit: LimitTransformations | null;
  majorPalaceMap: FortunePalaceEntry[] | null;
  minorPalaceMap: FortunePalaceEntry[] | null;
  majorPatterns: FortunePatternResult[];
  minorPatterns: FortunePatternResult[];
}

/** 太歳宮と三方四正の重なり（吉凶の増強は判定しない） */
export function buildTaiseiInfluence(chart: ZiweiChart, input: TaiseiInfluenceInput): TaiseiInfluence {
  const t = input.taisei;
  const sf = sanfangSizheng(t.branch);
  const natalPatterns = natalMatchedPatterns(chart);
  const fortunePatterns = [...input.majorPatterns, ...input.minorPatterns].filter((p) => p.conditionMatched);

  const contentsOf = (branch: Branch, relation: TaiseiRelation): TaiseiPalaceContents => {
    const palace: TaiseiPalaceRef = {
      branch,
      relation,
      natalPalace: chart.palaces.find((p) => p.branch === branch)!.name,
      majorPalace: input.majorPalaceMap ? fortunePalaceNameOf(input.majorPalaceMap, branch) : null,
      minorPalace: input.minorPalaceMap ? fortunePalaceNameOf(input.minorPalaceMap, branch) : null,
    };
    const transformations = input.transformationsByBranch[branch].map((x) => ({
      kind: "transformation" as const,
      origin: x.origin,
      type: TYPE_OF[x.kind],
      star: x.star,
      branch,
      relation,
    }));
    const stars = chart.palaces
      .find((p) => p.branch === branch)!
      .stars.map((s) => ({ kind: "star" as const, star: s, luck: STAR_LUCK[s], branch, relation }));
    const patterns: TaiseiPalaceContents["patterns"] = [];
    for (const p of natalPatterns) {
      if (p.matchedPalaces.some((m) => m.branch === branch))
        patterns.push({ kind: "pattern", layer: "natal", id: p.id, name: p.name, status: p.status, role: "matched", branch, relation });
      if (p.affectedPalaces.some((m) => m.branch === branch))
        patterns.push({ kind: "pattern", layer: "natal", id: p.id, name: p.name, status: p.status, role: "affected", branch, relation });
    }
    for (const p of fortunePatterns) {
      if (p.matchedPalaces.some((m) => m.branch === branch))
        patterns.push({ kind: "pattern", layer: p.origin, id: p.id, name: p.name, status: p.status, role: "matched", branch, relation });
      if (p.affectedPalaces.some((m) => m.branch === branch))
        patterns.push({ kind: "pattern", layer: p.origin, id: p.id, name: p.name, status: p.status, role: "affected", branch, relation });
    }
    return { palace, transformations, stars, patterns };
  };

  const samePalace = contentsOf(sf.self, "same_palace");
  const trines: [TaiseiPalaceContents, TaiseiPalaceContents] = [contentsOf(sf.trines[0], "trine"), contentsOf(sf.trines[1], "trine")];
  const opposite = contentsOf(sf.opposite, "opposite");
  const all = [samePalace, ...trines, opposite];
  const overlaps: TaiseiOverlap[] = all.flatMap((c) => [...c.transformations, ...c.stars, ...c.patterns]);

  return {
    taiseiBranch: t.branch,
    taiseiPalace: t.palace,
    yearStem: t.yearStem,
    yearBranch: t.yearBranch,
    minorLimit: input.minorLimit ? { branch: input.minorLimit.palaceBranch, palace: input.minorLimit.palaceName, age: input.minorLimit.age! } : null,
    samePalace,
    sanfangSizheng: { branches: [sf.trines[0], sf.trines[1], sf.opposite], trines, opposite },
    overlaps,
  };
}
