// src/lib/ziwei/minorStars/types.ts
//
// 紫微斗数の諸星（既存34星以外の星）の型。正本: 紫微諸星.pdf・紫微諸星１.pdf・表9 時系諸星表（追加画像）。
// 既存34星（PlacedStar・四化）とは別の型にして、作盤結果（ZiweiChart）・力量・格局・象意の既存処理に混ぜない。

import type { Branch } from "../types";

/** 系列（docs/ziwei-basic-spec.md §37.2 の A〜M） */
export type StarFamily =
  | "main" // A 14主星
  | "transformation" // B 四化
  | "year_stem" // C 年干系
  | "year_branch" // D 年支系
  | "birth_month" // E 月系
  | "birth_day" // F 日系
  | "birth_hour" // G 時系
  | "changsheng" // H 五行局・十二長生系
  | "boshi" // I 博士十二神
  | "jiangqian" // J 将前十二神
  | "suiqian" // K 歳前十二神
  | "ming_shen" // L 命宮・身宮基準の特殊星
  | "other"; // M その他（空亡系）

/** 配置の基準 */
export type StarBasis =
  | "ziweiStar"
  | "birthYearStem"
  | "birthYearBranch"
  | "birthYearStemBranch"
  | "birthYearBranch+birthHourBranch"
  | "birthMonth"
  | "birthHourBranch"
  | "birthDay+左輔"
  | "birthDay+右弼"
  | "birthDay+文昌"
  | "birthDay+文曲"
  | "mingPalace+birthYearBranch"
  | "shenPalace+birthYearBranch"
  | "mingPalace"
  | "bureau+yinYangSex"
  | "禄存+yinYangSex"
  | "none";

export type SourceStatus = "confirmed" | "needs_review" | "source_conflict" | "source_insufficient";

/** 資料の星級（表の「星級」欄）。表示の階層に使う */
export type StarGrade = "甲" | "乙" | "丙";

/** 盤面の表示階層 */
export type DisplayTier = "main" | "sub" | "minor" | "cycle";

/** 新規諸星の内部ID。同名異系列（博士・小耗と歳前・小耗など）を区別するため「系列/星名」 */
export type MinorStarId = `${StarFamily}/${string}`;

export interface MinorStarDef {
  id: MinorStarId;
  /** canonical name（盤面の表示名） */
  name: string;
  /** 資料側の表記・表記揺れ */
  aliases: string[];
  /** 資料上の正式名称（截路空亡・旬中空亡など。なければ name） */
  officialName: string;
  family: StarFamily;
  basis: StarBasis;
  isMajor: false;
  isTransformation: false;
  /** 十二神・十二長生のように12宮を一巡する系列の星 */
  isCycleStar: boolean;
  /** 1つの星が2宮に入る（旬空） */
  multiPalace: boolean;
  grade: StarGrade | null;
  tier: DisplayTier;
  sourceStatus: SourceStatus;
  /** 資料の表・頁 */
  sourceRef: string;
  /** sourceStatus が confirmed 以外のときの理由 */
  note?: string;
  /** 配置規則を実装したか（source_insufficient の星は false） */
  implemented: boolean;
}

export interface MinorStarPlacement {
  id: MinorStarId;
  name: string;
  family: StarFamily;
  tier: DisplayTier;
  branches: Branch[];
}

export interface MinorStarChart {
  /** 星ID → 宮（旬空だけ2宮） */
  positions: Partial<Record<MinorStarId, Branch[]>>;
  /** 地支 → その宮の新規諸星（星マスターの順） */
  byBranch: Record<Branch, MinorStarPlacement[]>;
  /** 表20 命主（命宮支から）。星盤に配置する星ではなく命盤の付記情報 */
  mingZhu: string;
  /** 表21 身主（本生年支から） */
  shenZhu: string;
}
