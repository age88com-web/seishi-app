// src/lib/ziwei/minorStars/existingStars.ts
//
// 既存34星（十四主星・副星16・四化4）の系列メタデータと、搭載状況の自動抽出。
// 既存の作盤・旺衰・力量・象意・格局のデータからその場で調べるだけで、既存の処理は変えない。
// 新規諸星はこの34星を重複して実装しない（tests/ziwei_minor_stars.manual.ts で名前の重複なしを確認）。

import type { PlacedStar, TransformationKind } from "../types";
import { MAIN_STARS, PLACED_STARS, TRANSFORMATION_KINDS, STEMS, transformationTarget } from "../data";
import { STAR_STRENGTH } from "../strength";
import { POWER_IGNORED_STARS, isPowerStar } from "../power";
import { STAR_MEANINGS, TRANSFORMATION_MEANINGS } from "../meanings/store";
import { STAR_LUCK } from "../patterns/luck";
import type { StarBasis, StarFamily, StarGrade } from "./types";

export interface ExistingStarMeta {
  name: PlacedStar | TransformationKind;
  /** 表示名（「星」を除いた資料の略称） */
  canonical: string;
  aliases: string[];
  family: StarFamily;
  basis: StarBasis;
  /** 新資料（紫微諸星１・表9）の星級 */
  grade: StarGrade;
  placementEngine: string;
}

const HOUR: readonly PlacedStar[] = ["文昌星", "文曲星", "天空星", "地劫星", "火星", "鈴星"];
const MONTH: readonly PlacedStar[] = ["左輔星", "右弼星", "天姚星", "天馬星"];
const STEM: readonly PlacedStar[] = ["禄存星", "擎羊星", "陀羅星", "天魁星", "天鉞星"];

/** 新資料の星級（表9・表10・表12・表15の「星級」欄。十四主星は表にないため甲扱い） */
const GRADE: Readonly<Partial<Record<string, StarGrade>>> = {
  天空星: "乙", 地劫星: "乙", 天姚星: "乙", 天馬星: "乙", 紅鸞星: "乙",
};

export const EXISTING_STAR_META: readonly ExistingStarMeta[] = [
  ...PLACED_STARS.map((s): ExistingStarMeta => {
    const main = (MAIN_STARS as readonly string[]).includes(s);
    const family: StarFamily = main ? "main" : HOUR.includes(s) ? "birth_hour" : MONTH.includes(s) ? "birth_month" : STEM.includes(s) ? "year_stem" : "year_branch";
    const basis: StarBasis = main
      ? "ziweiStar"
      : s === "火星" || s === "鈴星"
        ? "birthYearBranch+birthHourBranch"
        : family === "birth_hour"
          ? "birthHourBranch"
          : family === "birth_month"
            ? "birthMonth"
            : family === "year_stem"
              ? "birthYearStem"
              : "birthYearBranch";
    const canonical = s === "火星" || s === "鈴星" ? s : s.replace(/星$/, "");
    const aliases = s === "擎羊星" ? ["敬羊星", "羊星"] : [];
    return {
      name: s,
      canonical,
      aliases,
      family,
      basis,
      grade: GRADE[s] ?? "甲",
      placementEngine: main ? "stars.ts mainStarsOf" : `stars.ts ${family === "birth_hour" ? "hourStarsOf" : family === "birth_month" ? "monthStarsOf" : family === "year_stem" ? "yearStemStarsOf" : "yearBranchStarsOf"}`,
    };
  }),
  ...TRANSFORMATION_KINDS.map(
    (k): ExistingStarMeta => ({
      name: k,
      canonical: k.replace(/星$/, ""),
      aliases: [],
      family: "transformation",
      basis: "birthYearStem",
      grade: "甲",
      placementEngine: "transformations.ts transformationsOf（対象星に付随）",
    }),
  ),
];

export interface ExistingStarInventoryRow extends ExistingStarMeta {
  displayed: boolean;
  hasMeaning: boolean;
  hasStrength: boolean;
  hasPower: boolean;
  /** 四化の対象になる年干（四化の星は対象になる星の数） */
  transformationTarget: string[];
  /** 格局判定の吉凶分類（入門 p.15） */
  patternLuck: string;
}

/** 既存34星の搭載状況（コードから抽出） */
export function existingStarInventory(): ExistingStarInventoryRow[] {
  const meaningStars = new Set<string>([...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS].flatMap((m) => m.stars as string[]));
  return EXISTING_STAR_META.map((m) => {
    const isHua = m.family === "transformation";
    const targets = isHua
      ? STEMS.map((st) => `${st}:${transformationTarget(m.name as TransformationKind, st)}`)
      : STEMS.filter((st) => TRANSFORMATION_KINDS.some((k) => transformationTarget(k, st) === m.name)).map(String);
    return {
      ...m,
      displayed: true,
      hasMeaning: meaningStars.has(m.name),
      hasStrength: !isHua && STAR_STRENGTH[m.name as PlacedStar] !== undefined,
      hasPower: isPowerStar(m.name) && !(POWER_IGNORED_STARS as readonly string[]).includes(m.name),
      transformationTarget: targets,
      patternLuck: STAR_LUCK[m.name],
    };
  });
}
