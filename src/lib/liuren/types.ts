// src/lib/liuren/types.ts
//
// 役割:
//   六壬神課 起課エンジンの入出力型。
//   UI・API・古典実例照合のどこからでも同じ型で結果を受け取れるようにする。
//
// 仕様の出典:
//   『六壬神課講座』（docs/source/六壬神課講座.pdf）と、Phase 1 で確定した仕様
//   （涉害法はメモリ liuren-shehai-spec の訂正版）。

import type { Stem, Branch } from "../eto";

export type { Stem, Branch };

export type Element = "木" | "火" | "土" | "金" | "水";

/** 十二天将（講座 p9 の順序。表記は p56） */
export type HeavenlyGeneral =
  | "貴人" | "螣蛇" | "朱雀" | "六合" | "勾陳" | "青龍"
  | "天空" | "白虎" | "太常" | "玄武" | "太陰" | "天后";

/** 六親（講座 p55） */
export type SixRelation = "子孫" | "父母" | "妻財" | "官鬼" | "兄弟";

/**
 * 根拠レベル。
 *   textbook  … 講座の本文・例題で確認済み
 *   reference … 講座に記載がなく、同じ流れで出した参考値（検証済みではない）
 */
export type EvidenceLevel = "textbook" | "reference";

/** 起課の核になる入力（日時を経由しない純粋な入力） */
export interface LiurenCoreInput {
  dayStem: Stem;
  dayBranch: Branch;
  /** 占時（十二支） */
  divinationBranch: Branch;
  /** 月将（十二支） */
  monthGeneral: Branch;
}

/** 天地盤。地盤支ごとの天盤支 */
export interface HeavenEarthPlate {
  /** 天盤支 − 地盤支（mod 12）。0＝伏吟、6＝返吟 */
  offset: number;
  /** 地盤支 → 天盤支 */
  heavenOn: Record<Branch, Branch>;
  /** 天盤支 → その下の地盤支 */
  earthUnder: Record<Branch, Branch>;
}

/** 四課の1課 */
export interface Lesson {
  /** 課番号（1〜4） */
  index: 1 | 2 | 3 | 4;
  /** 上神（天盤支） */
  upper: Branch;
  /**
   * 下神。一課は日干そのもの、二〜四課は地盤支。
   * 賊剋の判定では一課は日干の五行を使う（講座 p12）。
   */
  lower: Stem | Branch;
  /** 地盤支。一課は日干の寄宮支（講座 p5・p19）、二〜四課は lower と同じ */
  lowerBranch: Branch;
}

export type FourLessons = readonly [Lesson, Lesson, Lesson, Lesson];

/** 天将の配置 */
export interface GeneralsLayout {
  /** 昼占か夜占か（講座 p8：卯〜申＝昼、酉〜寅＝夜） */
  dayOrNight: "昼" | "夜";
  /** 貴人の支（天盤） */
  nobleBranch: Branch;
  /** 貴人の位置（貴人支の下の地盤支） */
  noblePosition: Branch;
  /** 順布／逆布（講座 p9） */
  direction: "順" | "逆";
  /** 天盤支 → 乗っている天将 */
  generalOn: Record<Branch, HeavenlyGeneral>;
}

/** 九宗法の法名 */
export type SanchuanMethod =
  | "重審" | "元首" | "比用" | "涉害"
  | "遥剋" | "昴星" | "別責" | "八専"
  | "伏吟" | "返吟";

/** 判定の1段階の記録（なぜその法・格になったかを後から追跡する） */
export interface DecisionStep {
  /** 判定した段階（例: "伏吟判定", "賊剋", "比用", "涉害①深浅"） */
  stage: string;
  /** 判定内容の説明 */
  detail: string;
  /** 講座の根拠ページ */
  source?: string;
}

/** 涉害の候補ごとの計算記録 */
export interface ShehaiCandidateTrace {
  lessonIndex: 1 | 2 | 3 | 4;
  upper: Branch;
  lowerBranch: Branch;
  /** 地盤支から本家の手前までの経路（寄宮干を含む） */
  path: readonly (Stem | Branch)[];
  /** 経路のうち上神を剋すもの（賊） */
  zei: readonly (Stem | Branch)[];
  /** 涉害数（賊の数） */
  depth: number;
  /** 地盤支の孟仲季 */
  rank: "孟" | "仲" | "季";
}

/** 三伝の決定結果 */
export interface SanchuanDetermined {
  status: "determined";
  /** 法（九宗法） */
  method: SanchuanMethod;
  /** 格（講座に名称がある場合のみ） */
  pattern: string | null;
  initial: Branch;
  middle: Branch;
  final: Branch;
  /** 中伝・末伝の根拠レベル（遥剋は講座に中末の記載がないため reference） */
  middleFinalEvidence: EvidenceLevel;
  trace: readonly DecisionStep[];
  /** 涉害に進んだ場合の候補ごとの記録 */
  shehai?: readonly ShehaiCandidateTrace[];
}

/** 講座の記述だけでは三伝を決められない場合 */
export interface SanchuanUndetermined {
  status: "undetermined";
  /** どの法の途中で止まったか */
  method: SanchuanMethod;
  /** 決められない理由（講座に記載のない分岐） */
  reason: string;
  trace: readonly DecisionStep[];
}

export type SanchuanResult = SanchuanDetermined | SanchuanUndetermined;

/** 三伝の1伝に付ける付加情報 */
export interface TransmissionDetail {
  branch: Branch;
  /** 遁干。空亡の支は null（講座 p44） */
  hiddenStem: Stem | null;
  isVoid: boolean;
  general: HeavenlyGeneral;
  relation: SixRelation;
}

/** 起課結果 */
export interface LiurenChart {
  input: LiurenCoreInput;
  plate: HeavenEarthPlate;
  lessons: FourLessons;
  generals: GeneralsLayout;
  /** 四課の上神に乗る天将（一課〜四課） */
  lessonGenerals: readonly [HeavenlyGeneral, HeavenlyGeneral, HeavenlyGeneral, HeavenlyGeneral];
  /** 日干支の旬と空亡（講座 p44） */
  xun: { xunHead: string; voidBranches: readonly [Branch, Branch] };
  sanchuan: SanchuanResult;
  /** 三伝が決まった場合のみ */
  transmissions: readonly [TransmissionDetail, TransmissionDetail, TransmissionDetail] | null;
}
