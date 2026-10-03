// src/lib/liuren/interpretation/types.ts
//
// 役割:
//   六壬神課 解釈エンジンの入力となる「盤上の事実（FACT）」と、干支の構造関係（RELATION）の型。
//   起課エンジンの結果 LiurenChart を読み取った値だけを持つ。意味・吉凶の判断は含めない。
//
// 依存方向:
//   interpretation → 起課エンジンの型・関係関数 のみ。起課エンジン側からは参照しない。

import type {
  Stem, Branch, Element, HeavenlyGeneral, SixRelation, HeavenEarthPlate, GeneralsLayout,
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

// ==== 基礎状態（Phase 3A）。状態だけを表し、吉凶の意味は持たない ====

/** 旺相休囚死（月令の五行を旺とした、対象五行の状態） */
export type SeasonalStrength = "旺" | "相" | "休" | "囚" | "死";

/**
 * 十二長生の段階（十二長生上の「墓」はここに含まれる）。
 * 六壬の五行生墓法（『六壬粹言』五行十干生墓第四）で求める。五行墓庫（ElementTomb）とは別の概念。
 */
export type GrowthStage =
  | "長生" | "沐浴" | "冠帯" | "臨官" | "帝旺" | "衰"
  | "病" | "死" | "墓" | "絶" | "胎" | "養";

/**
 * 五行の墓庫（三合局の生・旺・墓の「墓」。講座 p54、土は『六壬粹言』土墓従火第五）。
 * 十二長生の「墓」（GrowthStage）とは別の概念で、kind で区別する。入墓の判断はしない。
 */
export interface ElementTomb {
  kind: "elementTomb";
  element: Element;
  branch: Branch;
}

// ==== 三伝の流れ（Phase 3B）。構造だけを表し、吉凶・占目別の意味は持たない ====

/** 三伝の位置 */
export type TransmissionPosition = "initial" | "middle" | "final";

/** 初伝・中伝・末伝の3つ組 */
export interface Triple<T> {
  initial: T;
  middle: T;
  final: T;
}

/**
 * 三伝の支の進退。
 *   進茹 … 初→中→末が十二支順に一支ずつ進む（亥→子→丑 のように子を越えてもよい）
 *   退茹 … 初→中→末が十二支逆順に一支ずつ退く
 *   その他 … どちらでもない（退間などは未判定）
 */
export type MovementPattern = "進茹" | "退茹" | "その他";

/**
 * 同じ向きの生（または剋）が連続するか。
 *   amongTransmissions … 初→中・中→末 がどちらも成り立つ
 *   transmissionsToDayStem … 上に加えて 末→日干（三伝遞生日干など）
 *   dayStemToTransmissions … 日干→初 に加えて 初→中・中→末（日干から三伝へ流れる）
 *   transmissionsToDayBranch / dayBranchToTransmissions … 日干の代わりに日支
 */
export interface ChainFlow {
  amongTransmissions: boolean;
  transmissionsToDayStem: boolean;
  dayStemToTransmissions: boolean;
  transmissionsToDayBranch: boolean;
  dayBranchToTransmissions: boolean;
}

/** 三伝の流れ（三伝が確定している場合） */
export interface TransmissionFlow {
  status: "determined";
  /** 初伝・中伝・末伝の支 */
  branches: Triple<Branch>;
  movementPattern: MovementPattern;
  /** 三伝どうしの関係（from が前の伝） */
  branchRelations: { initialToMiddle: RelationFact; middleToFinal: RelationFact };
  /** 各伝 → 日干 の関係（from が伝。日干→伝 の向きは generatedBy などで読む） */
  relationsToDayStem: Triple<RelationFact>;
  /** 各伝 → 日支 の関係（同上） */
  relationsToDayBranch: Triple<RelationFact>;
  /** 生の連続（generates の連鎖） */
  generationFlow: ChainFlow;
  /** 剋の連続（overcomes の連鎖） */
  overcomingFlow: ChainFlow;
  /**
   * 各伝の五行の旺相休囚死。月支を渡さなかった場合は null（未評価）。
   * changed … 初中末の状態がすべて同じでなければ true（数値化はしない）
   */
  seasonalStrength: (Triple<SeasonalStrength> & { monthBranch: Branch; rulingElement: Element; changed: boolean }) | null;
  /** 日干の五行を基準にした各伝の十二長生（五行生墓法） */
  growthStages: Triple<GrowthStage>;
  /** 長生・帝旺・墓・絶が三伝のどの位置にあるか（なければ空配列） */
  keyGrowthStages: Record<"長生" | "帝旺" | "墓" | "絶", readonly TransmissionPosition[]>;
  /** 各伝が空亡か。positions は空亡の位置（初→中→末の順） */
  voidStages: Triple<boolean> & { positions: readonly TransmissionPosition[] };
}

/** 三伝未確定（facts.transmissions = null）のときの結果 */
export interface TransmissionFlowUndetermined {
  status: "undetermined";
  reason: string;
}

export type TransmissionFlowResult = TransmissionFlow | TransmissionFlowUndetermined;
