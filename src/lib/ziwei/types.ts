// src/lib/ziwei/types.ts
//
// 紫微斗数 Phase 1（作盤計算）の入出力型。
// 正本: docs/ziwei-basic-spec.md

import type { Stem, Branch } from "../eto";

export type { Stem, Branch };

export type Sex = "male" | "female";

/** 入門 p.12 表2（明石標準時との時差）の24地点（§2.7）。表外の出生地は利用者がここから最も近い地点を選ぶ。 */
export type Table2Place =
  | "札幌" | "宮城" | "福島" | "山形" | "千葉" | "東京" | "埼玉"
  | "新潟" | "静岡" | "富山" | "愛知" | "福井" | "奈良" | "京都"
  | "大阪" | "鳥取" | "香川" | "岡山" | "愛媛" | "広島" | "山口"
  | "福岡" | "長崎" | "沖縄";

/** 時計の年月日時分秒（タイムゾーンを持たない壁時計の値）。 */
export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

/**
 * §2.7 出生地を経度で指定する（2026-10-02 仕様変更。表2を一般化）。
 * 時差 ＝（経度 − 135°）× 4分。東経135°より東はプラス、西はマイナス。秒まで計算する。
 */
export interface ZiweiLongitudePlace {
  /** 表示用の地点名（例: 愛知県名古屋市中区） */
  name: string;
  /** 東経（度） */
  longitude: number;
}

/**
 * 紫微斗数の出生地。画面からは経度で指定する（ZiweiLongitudePlace）。
 * 表2の地点名（Table2Place）は表2の時差をそのまま使う従来の指定で、資料の命盤例・早見表の回帰テスト用に残す。
 */
export type ZiweiBirthPlace = Table2Place | ZiweiLongitudePlace;

/**
 * 紫微斗数 Phase 1 の入力。
 * birth は出生地（日本国内のみ。§2.7 旧U18）の法定時刻（日本標準時の時計の値）。
 */
export interface ZiweiInput {
  birth: { year: number; month: number; day: number; hour: number; minute: number; second?: number };
  place: ZiweiBirthPlace;
  sex: Sex;
}

/** §2.7 出生時刻の補正結果。 */
export interface TimeCorrection {
  legal: WallClock;
  /** 入門 p.12 のサマータイム期間に該当し1時間引いたか */
  summerTimeApplied: boolean;
  /** 地点名（表2の地点名、または経度指定の地点名） */
  place: string;
  /** 経度指定のときの東経（度）。表2の地点名で指定したときは null */
  longitude: number | null;
  /** 地点の時差（秒）。経度指定は（経度 − 135）× 240 を秒単位に四捨五入、表2指定は表2の値 */
  placeOffsetSeconds: number;
  /** 紫微斗数用の補正済み時刻 */
  corrected: WallClock;
}

/** 作盤日を固定UTC+8基準の陰暦に変換した結果（§2.1・§2.8 手順6〜7）。 */
export interface LunarDate {
  /** 陰暦年（旧正月で切り替わる年の西暦番号。例: 新暦1995/1/15 は陰暦1994年＝甲戌年） */
  lunarYear: number;
  yearStem: Stem;
  yearBranch: Branch;
  month: number;
  isLeapMonth: boolean;
  day: number;
  /** その陰暦月の日数（29 または 30） */
  monthLength: 29 | 30;
}

export type LeapHalf = "前半" | "後半";

export type PalaceName =
  | "命宮" | "兄弟宮" | "夫妻宮" | "子女宮" | "財帛宮" | "疾厄宮"
  | "遷移宮" | "奴僕宮" | "官禄宮" | "田宅宮" | "福徳宮" | "父母宮";

export type MainStar =
  | "紫微星" | "天機星" | "太陽星" | "武曲星" | "天同星" | "廉貞星" | "天府星"
  | "太陰星" | "貪狼星" | "巨門星" | "天相星" | "天梁星" | "七殺星" | "破軍星";
export type HourStar = "文昌星" | "文曲星" | "天空星" | "地劫星" | "火星" | "鈴星";
export type MonthStar = "左輔星" | "右弼星" | "天姚星" | "天馬星";
export type YearStemStar = "禄存星" | "擎羊星" | "陀羅星" | "天魁星" | "天鉞星";
export type YearBranchStar = "紅鸞星";
/** 宮に配置する30星（34星から四化の4星を除いたもの） */
export type PlacedStar = MainStar | HourStar | MonthStar | YearStemStar | YearBranchStar;
/** 四化（年干系。すでに配置された星に付く。§11.2） */
export type TransformationKind = "化禄星" | "化権星" | "化科星" | "化忌星";

/** §20 星の旺衰（7区分・正式名称。強い順） */
export type StarStrength = "廟" | "旺" | "得地" | "利益" | "平和" | "不得地" | "陥";

export type BureauName = "水二局" | "木三局" | "金四局" | "土五局" | "火六局";
export interface Bureau {
  name: BureauName;
  element: "水" | "木" | "金" | "土" | "火";
  number: 2 | 3 | 4 | 5 | 6;
}

export interface Transformation {
  kind: TransformationKind;
  star: PlacedStar;
  branch: Branch;
}

export type Direction = "順行" | "逆行";

export interface DayunPeriod {
  palace: PalaceName;
  branch: Branch;
  startAge: number;
  endAge: number;
}

export interface Dayun {
  /** 陽男・陰女＝順行、陰男・陽女＝逆行（§13） */
  yinYang: "陽男" | "陰男" | "陽女" | "陰女";
  direction: Direction;
  /** 命宮から方向順に12期間。表14の範囲（局数〜局数+119歳）だけ（§18 U8） */
  periods: DayunPeriod[];
}

export interface Xiaoxian {
  /** 数え1歳の宮（§14.1） */
  startBranch: Branch;
  /** 男＝順行、女＝逆行（§14.2） */
  direction: Direction;
}

export interface Palace {
  name: PalaceName;
  branch: Branch;
  isShenPalace: boolean;
  stars: PlacedStar[];
  transformations: TransformationKind[];
  dayun: { startAge: number; endAge: number };
}

export interface ZiweiChart {
  timeCorrection: TimeCorrection;
  /** §2.8 手順4〜5 の作盤日（西暦） */
  chartDate: CivilDate;
  /** 補正済み時刻が 23:00 以上で作盤日を翌日に進めたか */
  advancedAt23: boolean;
  /** 作盤日を固定UTC+8基準の陰暦に変換した結果（閏月のみなし前） */
  lunar: LunarDate;
  /** 閏月の場合のみ前半・後半（§2.4）。閏月でなければ null */
  leapHalf: LeapHalf | null;
  /** 作盤に使う生月（閏月は前半＝本月、後半＝後月にみなした月） */
  birthMonth: number;
  /** 陰暦生日（閏月のみなしでも変えない） */
  birthDay: number;
  hourBranch: Branch;
  yearStem: Stem;
  yearBranch: Branch;
  sex: Sex;
  mingPalace: Branch;
  shenPalace: Branch;
  bureau: Bureau;
  /** 命宮から父母宮の順 */
  palaces: Palace[];
  starPositions: Record<PlacedStar, Branch>;
  transformations: Transformation[];
  dayun: Dayun;
  xiaoxian: Xiaoxian;
}
