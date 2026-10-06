// src/lib/shichusuimei/types.ts
//
// 四柱推命 Phase 1 の入出力型。
// 正本: docs/shichusuimei-basic-spec.md（確定仕様 D1〜D29）

import type { Stem, Branch } from "../eto";

export type { Stem, Branch };

export type Element = "木" | "火" | "土" | "金" | "水";
export type YinYang = "陽" | "陰";
export type Sex = "M" | "F";

/** 柱の位置（講座の表記順は 時・日・月・年） */
export type PillarKey = "時" | "日" | "月" | "年";

export interface Pillar {
  stem: Stem;
  branch: Branch;
}

/** 出生の現地法定時刻（時計の時刻）。hour を null にすると時刻不明（時柱なし） */
export interface BirthDateTime {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute?: number;
  second?: number;
}

/**
 * 出生地（D7・D8・D29）。
 * - timeZone: IANA timeZone ID（例: "Asia/Tokyo", "Europe/London"）
 * - standardOffsetMinutes: 当時の現地標準時の UTC オフセット（分）。
 *   Asia/Tokyo 以外では必須（標準時とサマータイムを自動では分離しない）。
 *   Asia/Tokyo は日本標準時 +540 分（東経135°）。
 * - 地域時差は regionalDiffMinutes（明示）→ p22 の地名（国内のみ）→ 経度 の順で決める。
 */
export interface BirthPlace {
  timeZone: string;
  standardOffsetMinutes?: number;
  /** 東経を正とする経度（度） */
  longitude?: number;
  /** p22「地域別の時間偏差」の地名（例: "東京"）。国内のみ */
  p22Name?: string;
  /** 地域時差（分）が分かっている場合の明示指定 */
  regionalDiffMinutes?: number;
}

export type RegionalDiffSource = "explicit" | "p22" | "longitude";

/** 地方真太陽時補正の内訳（D7・D8・D9） */
export interface TimeCorrection {
  /** 出生の瞬間（UTC, ISO 8601） */
  utc: string;
  /** 現地法定時刻のUTCオフセット（分。サマータイム込み） */
  legalOffsetMinutes: number;
  /** 現地標準時のUTCオフセット（分） */
  standardOffsetMinutes: number;
  /** サマータイム分（分）。0 ならサマータイムなし */
  dstMinutes: number;
  /** 標準子午線（東経、度） */
  standardMeridian: number;
  /** 現地標準時の壁時計（YYYY-MM-DDTHH:mm:ss） */
  standardLocal: string;
  regionalDiffMinutes: number;
  regionalDiffSource: RegionalDiffSource;
  /** p23 均時差（分） */
  equationOfTimeMinutes: number;
  /** 地方真太陽時の壁時計（YYYY-MM-DDTHH:mm:ss） */
  localApparentSolarTime: string;
  /** 地方真太陽時が 23:00〜23:59 で、日柱を翌日に切り替えた（D3） */
  dayChangedAt23: boolean;
}

export interface Meishiki {
  pillars: {
    時: Pillar | null;
    日: Pillar;
    月: Pillar;
    年: Pillar;
  };
  /** 時刻不明のときは null */
  timeCorrection: TimeCorrection | null;
  /** 出生の瞬間（UTC）。時刻不明のときはその日の正午（現地法定時刻）で代用 */
  birthUtc: Date;
  /** 現地標準時のUTCオフセット（分）。立運の日付比較に使う（D17・D27） */
  standardOffsetMinutes: number;
  /** 現地標準時での出生日（D27） */
  birthStandardDate: { year: number; month: number; day: number };
  /** 年柱・月柱の判定に使った太陽黄経（度） */
  sunLongitude: number;
  timeUnknown: boolean;
}

export type TsuhenName =
  | "比肩" | "劫財" | "食神" | "傷官" | "偏財"
  | "正財" | "偏官" | "正官" | "偏印" | "印綬";

/** 五神（p57） */
export type GoshinName = "比劫" | "食傷" | "財" | "官" | "印";

export type ZokanRole = "本気" | "中気" | "余気";

export interface ZokanEntry {
  /** p114 の記載順 */
  stems: readonly Stem[];
  /** 本気・中気・余気の区別（D18）。講座に明記がないため現時点は null */
  roles: readonly (ZokanRole | null)[] | null;
}

export interface StemWithTsuhen {
  stem: Stem;
  tsuhen: TsuhenName;
}

export interface PillarDetail {
  pillar: Pillar;
  /** 天干の通変星（D16）。日柱の天干は日主 */
  stemTsuhen: TsuhenName;
  isDayMaster: boolean;
  /** 蔵干と、その通変星（地支そのものには通変星を付けない：D16） */
  zokan: StemWithTsuhen[];
  zokanRoles: ZokanEntry["roles"];
}

export type DaiunDirection = "forward" | "backward";

export interface DaiunPeriod {
  /** 0 始まり（0＝第1大運） */
  index: number;
  pillar: Pillar;
  /** 数え年（D23）。立運0歳は 0（D25） */
  ageFrom: number;
  ageTo: number;
}

export interface Daiun {
  direction: DaiunDirection;
  /** 立運で数えた節 */
  jie: { name: string; utc: string; standardDate: string };
  /** 日付の差（D27） */
  days: number;
  /** 立運年齢（日数÷3 四捨五入：D11・D26） */
  startAge: number;
  periods: DaiunPeriod[];
}

export type ShinsatsuMatchedBy =
  | "yearStem" | "dayStem" | "yearBranch" | "dayBranch"
  | "monthBranch" | "dayPillar" | "anyBranch";

/** 神煞の該当位置。大運は luckIndex（0＝第1大運）で示す */
export type ShinsatsuPosition =
  | { kind: "pillar"; pillar: PillarKey; part: "干" | "支" | "柱" }
  | { kind: "luck"; luckIndex: number; branch: Branch };

export interface ShinsatsuHit {
  id: string;
  name: string;
  /** 天羅地網の「天羅」「地網」の別 */
  subType: string | null;
  position: ShinsatsuPosition;
  matchedBy: ShinsatsuMatchedBy[];
}

export type RelationType = "干合" | "支合" | "冲" | "三合" | "自刑" | "二刑" | "三刑";

export interface RelationMember {
  pillar: PillarKey;
  part: "干" | "支";
  value: Stem | Branch;
}

export interface Relation {
  type: RelationType;
  members: RelationMember[];
  /** 表に記載の化・局（干合の化、三合の局）。成立の判断はしない（D19） */
  tableElement: string | null;
  /** 三刑のみ: 3支すべてがそろっているか。成立条件の判断はしない（D19） */
  complete?: boolean;
}

/** 大運と命式の干支関係の種類（既存の判定表・判定規則にあるものだけ） */
export type LuckRelationType =
  | "干合" | "冲剋"
  | "支合" | "冲" | "三合" | "三会" | "半合" | "半会" | "二刑" | "三刑" | "自刑";

/** 大運干支と命式の関係（存在検出のみ。成立・作用の判断はしない） */
export interface LuckRelation {
  type: LuckRelationType;
  part: "干" | "支";
  /** 関係する命式の柱（三合・三会・三刑は2柱のこともある） */
  natal: PillarKey[];
  /** 表の化・局（干合の化、三合の局、半合・半会・三会の五行） */
  tableElement: string | null;
  /** 三刑のみ: 大運を含めて3支すべてがそろうか */
  complete?: boolean;
}

/** 大運1本ごとの詳細（日干基準の通変星・蔵干・神煞・命式との関係） */
export interface DaiunDetail {
  index: number;
  pillar: Pillar;
  stemTsuhen: TsuhenName;
  zokan: StemWithTsuhen[];
  zokanRoles: ZokanEntry["roles"];
  shinsatsu: ShinsatsuHit[];
  relations: LuckRelation[];
}

export interface ShichusuimeiInput {
  birth: BirthDateTime;
  place: BirthPlace;
  sex: Sex;
  /** 表示する大運の本数（講座では 6〜10 本とまちまち。既定 10） */
  daiunCount?: number;
}

export interface ShichusuimeiResult {
  meishiki: Meishiki;
  details: { 時: PillarDetail | null; 日: PillarDetail; 月: PillarDetail; 年: PillarDetail };
  daiun: Daiun;
  /** daiun.periods と同じ順・同じ index */
  daiunDetails: DaiunDetail[];
  shinsatsu: ShinsatsuHit[];
  relations: Relation[];
}
