// src/lib/zhangguo_interpretations.ts
// 『張果星宗』十一曜解釈データ（general / branch / mansion / palace）の型定義と lookup。
// 正本は docs/source/zhangguo_*_v1.json。内容はここで加工しない。

import generalJson from "../../docs/qizheng-data/zhangguo_general_v1.json";
import branchJson from "../../docs/qizheng-data/zhangguo_branch_v1.json";
import mansionJson from "../../docs/qizheng-data/zhangguo_mansion_v1.json";
import palaceJson from "../../docs/qizheng-data/zhangguo_palace_v1.json";

export type ZgStarKey =
  | "sun" | "moon" | "jupiter" | "mars" | "saturn" | "venus" | "mercury"
  | "ziqi" | "yuebo" | "rahu" | "ketu";

export type ZgCategory = "general" | "branch" | "mansion" | "palace";

export type ZgBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type ZgMansion =
  | "角" | "亢" | "氐" | "房" | "心" | "尾" | "箕"
  | "斗" | "牛" | "女" | "虚" | "危" | "室" | "壁"
  | "奎" | "婁" | "胃" | "昴" | "畢" | "觜" | "参"
  | "井" | "鬼" | "柳" | "星" | "張" | "翼" | "軫";

export type ZgPalace =
  | "命宮" | "財帛宮" | "兄弟宮" | "田宅宮" | "男女宮" | "奴僕宮"
  | "妻妾宮" | "疾厄宮" | "遷移宮" | "官祿宮" | "福德宮" | "相貌宮";

export type ZgPolarity = "good" | "bad" | "mixed" | "neutral";

export interface ZgConditions {
  status: string[];
  motion: string[];
  dayNight: "day" | "night" | null;
  relatedStars: ZgStarKey[];
  other: string[];
}

interface ZgBase {
  id: string;
  star: ZgStarKey;
  app_label: string;
  classical_name: string;
  category: ZgCategory;
  source_heading: string;
  source_text: string;
  source_ref?: { file: string; lines?: string };
  modern_japanese: string;
  conditions: ZgConditions;
  polarity: ZgPolarity | null;
  keywords: string[];
  meta?: { review_status?: "draft" | "reviewed"; note?: string };
}

export interface ZgGeneral extends ZgBase { category: "general"; target: null; }
export interface ZgBranchRec extends ZgBase { category: "branch"; target: ZgBranch; }
export interface ZgMansionRec extends ZgBase { category: "mansion"; target: ZgMansion; }
export interface ZgPalaceRec extends ZgBase { category: "palace"; target: ZgPalace; }

export type ZgRecord = ZgGeneral | ZgBranchRec | ZgMansionRec | ZgPalaceRec;

interface ZgFile<T extends ZgRecord> {
  schema_version: string;
  records: T[];
}

const GENERAL = (generalJson as unknown as ZgFile<ZgGeneral>).records;
const BRANCH = (branchJson as unknown as ZgFile<ZgBranchRec>).records;
const MANSION = (mansionJson as unknown as ZgFile<ZgMansionRec>).records;
const PALACE = (palaceJson as unknown as ZgFile<ZgPalaceRec>).records;

const BY_ID: ReadonlyMap<string, ZgRecord> = new Map(
  [...GENERAL, ...BRANCH, ...MANSION, ...PALACE].map((r) => [r.id, r] as const)
);

const STAR_KEYS: readonly ZgStarKey[] = [
  "sun", "moon", "jupiter", "mars", "saturn", "venus", "mercury",
  "ziqi", "yuebo", "rahu", "ketu",
];

// 星盤 bodies の id / label → データの star キー
const LABEL_TO_STAR: Record<string, ZgStarKey> = {
  "日": "sun", "太陽": "sun",
  "月": "moon", "太陰": "moon",
  "木": "jupiter", "木星": "jupiter",
  "火": "mars", "火星": "mars",
  "土": "saturn", "土星": "saturn",
  "金": "venus", "金星": "venus",
  "水": "mercury", "水星": "mercury",
  "紫炁": "ziqi", "紫気": "ziqi", "紫氣": "ziqi",
  "月孛": "yuebo",
  "羅喉": "rahu", "羅劫": "rahu",
  "計都": "ketu",
};

export function toZgStarKey(idOrLabel: string | undefined | null): ZgStarKey | null {
  const s = String(idOrLabel ?? "").trim();
  if ((STAR_KEYS as readonly string[]).includes(s)) return s as ZgStarKey;
  return LABEL_TO_STAR[s] ?? null;
}

// 星盤（ChartSVG）の宮名表記 → データの宮名表記
const CHART_PALACE_TO_ZG: Record<string, ZgPalace> = {
  "命宮": "命宮",
  "財帛宮": "財帛宮",
  "兄弟宮": "兄弟宮",
  "田宅宮": "田宅宮",
  "男女宮": "男女宮",
  "奴僕宮": "奴僕宮",
  "妻妾宮": "妻妾宮", "夫妻宮": "妻妾宮",
  "疾厄宮": "疾厄宮",
  "遷移宮": "遷移宮",
  "官祿宮": "官祿宮", "官禄宮": "官祿宮",
  "福德宮": "福德宮", "福徳宮": "福德宮",
  "相貌宮": "相貌宮",
};

export function toZgPalace(chartPalaceName: string | undefined | null): ZgPalace | null {
  return CHART_PALACE_TO_ZG[String(chartPalaceName ?? "").trim()] ?? null;
}

export function getZgGeneral(star: ZgStarKey): ZgGeneral | null {
  return (BY_ID.get(`${star}_general`) as ZgGeneral | undefined) ?? null;
}

export function getZgBranch(star: ZgStarKey, branch: string | null | undefined): ZgBranchRec | null {
  if (!branch) return null;
  return (BY_ID.get(`${star}_branch_${branch}`) as ZgBranchRec | undefined) ?? null;
}

export function getZgMansion(star: ZgStarKey, mansion: string | null | undefined): ZgMansionRec | null {
  if (!mansion) return null;
  return (BY_ID.get(`${star}_mansion_${mansion}`) as ZgMansionRec | undefined) ?? null;
}

export function getZgPalace(star: ZgStarKey, palace: ZgPalace | null | undefined): ZgPalaceRec | null {
  if (!palace) return null;
  return (BY_ID.get(`${star}_palace_${palace}`) as ZgPalaceRec | undefined) ?? null;
}

export type ZgStarLayers = {
  general: ZgGeneral | null;
  branch: ZgBranchRec | null;
  mansion: ZgMansionRec | null;
  palace: ZgPalaceRec | null;
};

/** 星 + 十二支宮 + 宿 + 十二宮 から 4層を個別に取得する（4層は混同しない） */
export function getZgStarLayers(args: {
  star: ZgStarKey;
  branch: string | null | undefined;
  mansion: string | null | undefined;
  palace: ZgPalace | null | undefined;
}): ZgStarLayers {
  return {
    general: getZgGeneral(args.star),
    branch: getZgBranch(args.star, args.branch),
    mansion: getZgMansion(args.star, args.mansion),
    palace: getZgPalace(args.star, args.palace),
  };
}
