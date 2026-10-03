// src/lib/liuren/interpretation/types.ts
//
// 役割:
//   六壬神課 解釈エンジンの入力となる「盤上の事実（FACT）」と、干支の構造関係（RELATION）の型。
//   起課エンジンの結果 LiurenChart を読み取った値だけを持つ。意味・吉凶の判断は含めない。
//
// 依存方向:
//   interpretation → 起課エンジンの型・関係関数 のみ。起課エンジン側からは参照しない。

import type {
  Stem, Branch, HeavenlyGeneral, SixRelation, HeavenEarthPlate, GeneralsLayout,
  LiurenChart, SanchuanResult,
} from "../types";

/**
 * 四課1課の上下の剋関係（講座 p11・p12）。
 *   下賊 … 下が上を剋す（一課の下は日干そのものの五行で見る）
 *   上剋 … 上が下を剋す
 *   無剋 … どちらでもない
 * 五行の相剋は一方向なので、下賊と上剋が同時に成り立つことはない。
 */
export type LessonZeike = "下賊" | "上剋" | "無剋";

/** 四課1課の事実 */
export interface LessonFact {
  index: 1 | 2 | 3 | 4;
  /** 上神（天盤支） */
  upper: Branch;
  /** 下神。一課は日干そのもの、二〜四課は地盤支 */
  lower: Stem | Branch;
  /** 地盤支。一課は日干の寄宮支 */
  lowerBranch: Branch;
  /** 上神に乗る天将（chart.lessonGenerals） */
  general: HeavenlyGeneral;
  /** 日干からみた上神の六親（三伝と同じ sixRelation） */
  relation: SixRelation;
  /** 上下の剋関係 */
  zeike: LessonZeike;
}

/** 三伝1伝の事実（起課エンジンの TransmissionDetail をそのまま使う） */
export type TransmissionFact = NonNullable<LiurenChart["transmissions"]>[number];

/**
 * 解釈用の盤上の事実。
 * plate・generals・sanchuan・transmissions は LiurenChart の同じオブジェクトを参照する（複製しない）。
 * 書き換えると起課結果も変わるため、読み取り専用として扱う。
 */
export interface InterpretationFacts {
  basic: {
    dayStem: Stem;
    dayBranch: Branch;
    /** 占時 */
    divinationBranch: Branch;
    /** 月将 */
    monthGeneral: Branch;
  };
  lessons: readonly [LessonFact, LessonFact, LessonFact, LessonFact];
  /** 初伝・中伝・末伝。三伝未確定（sanchuan.status = "undetermined"）なら null */
  transmissions: readonly [TransmissionFact, TransmissionFact, TransmissionFact] | null;
  /** 旬首と空亡の2支 */
  xun: { xunHead: string; voidBranches: readonly [Branch, Branch] };
  /** 天地盤（offset 0＝伏吟、6＝返吟） */
  plate: Readonly<HeavenEarthPlate>;
  /** 天将配置（昼夜・貴人支・貴人位置・順逆・各支の天将） */
  generals: Readonly<GeneralsLayout>;
  /**
   * 課体（九宗法の法・格・判定記録）。起課エンジンの結果をそのまま持つ。
   * 確定時は method・pattern・middleFinalEvidence・trace、未確定時は method・reason・trace。
   */
  sanchuan: SanchuanResult;
}

/**
 * 2つの干支の構造関係（from から見た向き）。吉凶の意味は持たない。
 *   generates   … from が to を生ずる
 *   generatedBy … to が from を生ずる
 *   overcomes   … from が to を剋す
 *   overcomeBy  … to が from を剋す
 *   sameElement … 五行が同じ（比和）
 *   clashes     … 冲（支どうしのみ）
 *   punishes    … from が to を刑す（支どうしのみ。講座 p32・p52 の刑表 XING）
 *   punishedBy  … to が from を刑す（同上）
 */
export type StructuralRelation =
  | "generates" | "generatedBy"
  | "overcomes" | "overcomeBy"
  | "sameElement"
  | "clashes"
  | "punishes" | "punishedBy";

export interface RelationFact {
  from: Stem | Branch;
  to: Stem | Branch;
  relations: readonly StructuralRelation[];
}
