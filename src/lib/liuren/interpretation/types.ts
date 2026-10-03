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
 *   combines    … 六合（支どうしのみ。向きなし）
 *   breaks      … 破（支どうしのみ。向きなし）
 *   harms       … 害（支どうしのみ。向きなし）
 * 1組の支に複数の関係が同時に成り立つ（例: 寅亥＝combines＋breaks の破合）。
 */
export type StructuralRelation =
  | "generates" | "generatedBy"
  | "overcomes" | "overcomeBy"
  | "sameElement"
  | "clashes"
  | "punishes" | "punishedBy"
  | "combines" | "breaks" | "harms";

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
 *   進間 … 初→中→末が一位を隔てて十二支順に進む（+2・+2。例: 子→寅→辰、亥→丑→卯）
 *   退間 … 初→中→末が一位を隔てて逆行して退く（−2・−2。例: 亥→酉→未、寅→子→戌）
 *   その他 … どれでもない（進間各配列の個別名は持たない）
 */
export type MovementPattern = "進茹" | "退茹" | "進間" | "退間" | "その他";

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
  /** 初中末の3支が完全な三合局か（順序は問わない。2支だけの場合は complete: false） */
  threeHarmony: ThreeHarmony;
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

// ==== 三合・入墓（Phase 3C）。構造だけを表し、吉凶の意味は持たない ====

/** 3支が完全な三合局を構成するか（講座 p54。欠一神・凑合は扱わない） */
export type ThreeHarmony =
  | { complete: true; element: Element; branches: readonly [Branch, Branch, Branch] }
  | { complete: false };

/**
 * ある五行が、その五行墓庫の支に臨んでいるか（五行墓庫への入墓）。
 * 十二長生の「墓」（GrowthStage・growthStageOf）とは別の判定で、kind で区別する。入墓の吉凶は判断しない。
 */
export interface ElementInTombFact {
  kind: "elementInTomb";
  element: Element;
  branch: Branch;
  /** その五行の墓庫の支（elementTombOf） */
  tombBranch: Branch;
  inTomb: boolean;
}

// ==== 盤上の標識となる支（Phase 3D）。どこに現れるかだけを表し、吉凶・象意は持たない ====

/**
 * 標識の種類。
 *   dayVirtue … 日徳（日干から）
 *   daySalary … 日禄（日干から）
 *   xunDing   … 旬丁（日干支の旬で丁が遁する支）
 *   yima      … 驛馬（basis の支の三合局の長生を冲する支）
 */
export type MarkerKind = "dayVirtue" | "daySalary" | "xunDing" | "yima";

/**
 * 標識を求めた基準。今回は日干・日干支（旬）・日支のみ。
 * 驛馬は将来、年命・太歳・月建などを基準にしたものも並べられるように基準を持たせる。
 */
export type MarkerBasis = "dayStem" | "dayXun" | "dayBranch";

/** 四課上神への出現（isVoid はその上神が空亡か） */
export interface LessonOccurrence {
  index: 1 | 2 | 3 | 4;
  isVoid: boolean;
}

/** 三伝への出現（isVoid はその伝が空亡か。facts.transmissions の値） */
export interface TransmissionOccurrence {
  position: TransmissionPosition;
  isVoid: boolean;
}

/** 特定の支と、その支が盤のどこに現れるか */
export interface BranchMarker {
  kind: MarkerKind;
  basis: MarkerBasis;
  branch: Branch;
  /** 標識の支そのものが空亡か（facts.xun.voidBranches） */
  isVoid: boolean;
  /** その支を上神とする四課（重複課はすべて） */
  lessons: readonly LessonOccurrence[];
  /** その支である三伝の位置。三伝未確定なら null */
  transmissions: readonly TransmissionOccurrence[] | null;
}

/** 日干支から求める標識一式（驛馬は日支基準の日馬） */
export interface DayMarkers {
  dayVirtue: BranchMarker;
  daySalary: BranchMarker;
  xunDing: BranchMarker;
  yima: BranchMarker;
}

// ==== 古典共通パターン（Phase 3E）。成立の検出だけで、吉凶・象意は持たない ====
// 起課エンジンの sanchuan.pattern（九宗法の格）とは別物。

/** 三伝の配列で決まるパターンの向き（初→中→末が十二支順なら forward） */
export type PatternDirection = "forward" | "reverse";

/** 元胎（四孟 寅巳申亥 の三伝。『六壬粹言』）。順＝生胎、逆＝病胎 */
export interface YuanTaiPattern {
  kind: "yuanTai";
  direction: PatternDirection;
  classicalName: "生胎" | "病胎";
  branches: Triple<Branch>;
}

/** 関隔（四仲 子卯午酉 の三伝） */
export interface GuanGePattern {
  kind: "guanGe";
  direction: PatternDirection;
  branches: Triple<Branch>;
}

/**
 * 稼穡（三伝がすべて四季 辰戌丑未。『六壬大全』「三傳辰戌丑未」。重複支も含む）。
 * subtype は『六壬粹言』の列挙配列かどうか:
 *   cuiyanForward … 順行三課 辰未戌・未戌丑・戌丑辰
 *   cuiyanReverse … 逆行二課 丑戌未・戌未辰
 *   general       … それ以外の四季神三伝（例: 辰丑戌・戌辰戌）
 */
export interface JiaSePattern {
  kind: "jiaSe";
  subtype: "cuiyanForward" | "cuiyanReverse" | "general";
  branches: Triple<Branch>;
}

/** 四絶（『六壬粹言』「乙禄卯加申、丁己禄午加亥、辛禄酉加寅、癸禄子加巳」。日禄が指定の地盤支に臨む） */
export interface FourJuePattern {
  kind: "fourJue";
  dayStem: Stem;
  /** 日禄の支（天盤） */
  salaryBranch: Branch;
  /** 日禄が臨む地盤支（＝日干五行の絶地） */
  earthBranch: Branch;
  /** 日禄の支が空亡か（別の事実として持つだけ） */
  salaryIsVoid: boolean;
}

/** 墓覆干頭（陽干の日干上神＝一課上神が、日干五行の墓庫支） */
export interface TombOverStemPattern {
  kind: "tombOverStem";
  dayStem: Stem;
  /** 日干上神（一課の上神） */
  upper: Branch;
  lessonIndex: 1;
}

export type ClassicalPattern =
  | YuanTaiPattern
  | GuanGePattern
  | JiaSePattern
  | FourJuePattern
  | TombOverStemPattern
  | FullHarmonyPattern
  | PartialHarmonyPattern;

// ==== 全局課・三合欠一神（Phase 3F）。成立の検出だけで、吉凶・象意・応期は持たない ====

/** 全局課（三伝が完全三合局。threeHarmonyOf）。木＝曲直・火＝炎上・金＝従革・水＝潤下。土の稼穡は jiaSe で別に持つ */
export interface FullHarmonyPattern {
  kind: "fullHarmony";
  element: Element;
  classicalName: "曲直" | "炎上" | "従革" | "潤下";
  branches: Triple<Branch>;
}

/** 欠けた一神（missingBranch）が盤のどこにあるか（凑合格を将来判定するための調査用。日干は支でないので含めない） */
export interface MissingBranchOccurrences {
  /** 日支そのもの */
  dayBranch: boolean;
  /** その支を上神とする四課 */
  lessonUppers: readonly (1 | 2 | 3 | 4)[];
  /** その支を地盤支（lowerBranch。一課は日干の寄宮支）とする四課 */
  lessonLowerBranches: readonly (1 | 2 | 3 | 4)[];
  /** 日干上神（一課上神） */
  dayStemUpper: boolean;
  /** 日支上神（三課上神） */
  dayBranchUpper: boolean;
}

/**
 * 三合局の欠一神（三伝の異なる支のうち、ちょうど2支が1つの三合局に属し、残る1支が三伝にない）。
 * 完全三合局（fullHarmony）のときは成立させない。重複伝（例: 寅午午）は異なる支で数える。
 * 『六壬大全』「三合入伝缺一神」＝折腰格・虚一待用格。名称を持つだけで占断は付けない。
 * 凑合格（「若日辰偶足之」）は「日辰」の対応が未確定のため判定しない（missingBranchOccurrences で調査できる）。
 */
export interface PartialHarmonyPattern {
  kind: "partialHarmony";
  missingOneOfThree: true;
  element: Element;
  classicalNames: readonly ["折腰格", "虚一待用格"];
  /** 三伝にある局の2支（三合局の生・旺・墓の順） */
  presentBranches: readonly [Branch, Branch];
  /** 三伝にない局の1支 */
  missingBranch: Branch;
  /** 局の2支それぞれが三伝のどこにあるか */
  transmissionPositions: readonly { branch: Branch; positions: readonly TransmissionPosition[] }[];
  missingBranchOccurrences: MissingBranchOccurrences;
}

// ==== 気勢の遷移（Phase 3G）。状態の並びと変化だけを表し、進気・退気・吉凶は判断しない ====
// 支の移動（movementPattern）・五行の生剋（generationFlow など）とは別の FLOW。

/** 十二長生の遷移（初→中、中→末） */
export interface GrowthTransition {
  fromPosition: "initial" | "middle";
  toPosition: "middle" | "final";
  from: GrowthStage;
  to: GrowthStage;
  /** 十二長生の循環（長生→沐浴→…→養→長生）を順に進んだ段数（0〜11。同じ段階なら 0） */
  forwardSteps: number;
  /** 逆に戻った段数（0〜11。同じ段階なら 0）。forwardSteps と合わせて両方持ち、近い方に潰さない */
  backwardSteps: number;
}

/** 旺相休囚死の遷移（初→中、中→末）。段数・数値は持たない */
export interface SeasonalTransition {
  fromPosition: "initial" | "middle";
  toPosition: "middle" | "final";
  from: SeasonalStrength;
  to: SeasonalStrength;
  changed: boolean;
}

/** 三伝の気勢の遷移 */
export interface StateTransitions {
  /** 日干の五行を基準にした十二長生の並び（TransmissionFlow.growthStages） */
  growthSequence: Triple<GrowthStage>;
  growthTransitions: readonly [GrowthTransition, GrowthTransition];
  /** 旺相休囚死の並び。月支がなければ null */
  seasonalSequence: Triple<SeasonalStrength> | null;
  /** 旺相休囚死の遷移。月支がなければ null */
  seasonalTransitions: readonly [SeasonalTransition, SeasonalTransition] | null;
}
