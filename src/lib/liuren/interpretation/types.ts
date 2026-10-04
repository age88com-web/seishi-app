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

// ==== 気勢状態の分類（Phase 3H）。中立の内部分類で、進気・退気・吉凶は判断しない ====

/**
 * 十二長生の段階の大分類（古典語ではなく内部構造名。ユーザー指定 2026-10-03）。
 *   emerging … 胎・養 / growing … 長生・沐浴・冠帯・臨官 / peak … 帝旺 / declining … 衰・病
 *   terminal … 死・墓 / renewingBoundary … 絶（『六壬指南』「死生互換之交」。終端と再生の境界として terminal と分ける）
 */
export type GrowthPhase = "emerging" | "growing" | "peak" | "declining" | "terminal" | "renewingBoundary";

/** 三伝1伝の気勢の状態（十二長生と旺相休囚死は別の軸のまま並べる。合成・数値化しない） */
export interface TransmissionQiState {
  position: TransmissionPosition;
  branch: Branch;
  growthStage: GrowthStage;
  growthPhase: GrowthPhase;
  /** 月支がなければ null */
  seasonalStrength: SeasonalStrength | null;
  isVoid: boolean;
}

/**
 * 段階の境目（隣り合う大分類への変化）。
 *   peakToDeclining … peak→declining / decliningToTerminal … declining→terminal
 *   terminalToRenewing … terminal→renewingBoundary / renewingToEmerging … renewingBoundary→emerging
 *   emergingToGrowing … emerging→growing / growingToPeak … growing→peak
 */
export type GrowthPhaseBoundary =
  | "peakToDeclining" | "decliningToTerminal" | "terminalToRenewing"
  | "renewingToEmerging" | "emergingToGrowing" | "growingToPeak";

/** 大分類の遷移（初→中、中→末） */
export interface GrowthPhaseTransition {
  fromPosition: "initial" | "middle";
  toPosition: "middle" | "final";
  from: GrowthPhase;
  to: GrowthPhase;
  changed: boolean;
  /** 上の6つの境目のどれかに当たれば、その名前。当たらなければ null（同じ大分類・飛び越し・逆向き） */
  boundary: GrowthPhaseBoundary | null;
}

/** 三伝の気勢の状態 */
export interface QiStates {
  qiStates: Triple<TransmissionQiState>;
  phaseTransitions: readonly [GrowthPhaseTransition, GrowthPhaseTransition];
}

// ==== 時令の気勢タイムライン（Phase 3I）。月令の推移による旺相休囚死の変化だけを表す ====
// 進気・退気・吉凶・数値順位は持たない。空亡・墓・生剋・六親・天将・神煞による補正もしない。

/** ある五行の、current から offset か月ずれた月令での旺相休囚死 */
export interface SeasonalTimelinePoint {
  /** current からのずれ（月令の順 寅→卯→…→丑→寅 で数える） */
  offset: number;
  monthBranch: Branch;
  rulingElement: Element;
  strength: SeasonalStrength;
}

/** 隣り合う2点の旺相休囚死の変化 */
export interface SeasonalTimelineTransition {
  fromOffset: number;
  toOffset: number;
  fromMonthBranch: Branch;
  toMonthBranch: Branch;
  from: SeasonalStrength;
  to: SeasonalStrength;
  changed: boolean;
}

/** ある五行の時令タイムライン（前月・当月・翌月・翌々月） */
export interface SeasonalTimeline {
  element: Element;
  currentMonthBranch: Branch;
  /** offset −1・0・+1・+2 の順 */
  points: readonly SeasonalTimelinePoint[];
  previous: SeasonalTimelinePoint;
  current: SeasonalTimelinePoint;
  next: SeasonalTimelinePoint;
  next2: SeasonalTimelinePoint;
  /** current→next、next→next2 */
  transitions: readonly [SeasonalTimelineTransition, SeasonalTimelineTransition];
}

/** 三伝1伝の地支自身の五行の時令タイムライン（日干の五行ではない） */
export interface TransmissionSeasonalTimeline extends SeasonalTimeline {
  position: TransmissionPosition;
  branch: Branch;
}

/** 日干の五行の時令タイムライン */
export interface DayStemSeasonalTimeline extends SeasonalTimeline {
  dayStem: Stem;
}

// ==== 季節内の進気・退気（Phase 3J）。同じ季節・同じ五行の二支の順逆だけを表す中立 FACT ====
// 進茹・退茹（movementPattern）、十二長生、旺相休囚死、宜進・宜退とは別の概念。吉凶・占断は持たない。

/**
 * 支→支の季節内の向き。
 *   advancing  … 寅→卯・巳→午・申→酉・亥→子
 *   retreating … 卯→寅・午→巳・酉→申・子→亥
 *   none       … 上の8組に当たらない（悪い・弱い・停滞という意味ではない）
 */
export type SeasonalBranchDirection = "advancing" | "retreating" | "none";

export type SeasonName = "spring" | "summer" | "autumn" | "winter";

export interface SeasonalBranchDirectionFact {
  from: Branch;
  to: Branch;
  direction: SeasonalBranchDirection;
  /** advancing / retreating のときの二支の五行。none は null */
  element: Element | null;
  /** advancing / retreating のときの季節。none は null */
  season: SeasonName | null;
}

/** 三伝の2区間の季節内の向き */
export interface TransmissionSeasonalDirection {
  initialToMiddle: SeasonalBranchDirectionFact;
  middleToFinal: SeasonalBranchDirectionFact;
}

// ==== 三伝と日干の作用関係（Phase 3K）。既存 FACT を三伝単位にまとめるだけの中立 FACT ====
// 宜進・宜退・好転・悪化・吉凶・score は持たない。

/**
 * その伝が日干に対してどう作用するか（向きは「伝 → 日干」）。relationBetween(伝, 日干) の五行関係を言い換えたもの。
 *   transmissionGeneratesDayStem … 伝が日干を生ずる（伝生干）
 *   sameElement                  … 比和
 *   dayStemGeneratesTransmission … 日干が伝を生ずる（干生伝）
 *   transmissionOvercomesDayStem … 伝が日干を剋す（伝剋干）
 *   dayStemOvercomesTransmission … 日干が伝を剋す（干剋伝）
 */
export type TransmissionToDayStemRelation =
  | "transmissionGeneratesDayStem"
  | "sameElement"
  | "dayStemGeneratesTransmission"
  | "transmissionOvercomesDayStem"
  | "dayStemOvercomesTransmission";

/** 三伝1伝の、日干との関係と状態（各値は既存の FACT・FLOW・MARKER・STATE から転記） */
export interface TransmissionDayStemState {
  position: TransmissionPosition;
  branch: Branch;
  element: Element;
  relationToDayStem: TransmissionToDayStemRelation;
  /** 六親（facts.transmissions の relation） */
  sixRelation: SixRelation;
  isDaySalary: boolean;
  isDayVirtue: boolean;
  isXunDing: boolean;
  isYima: boolean;
  /** 伝の支そのものが占日の旬空（dayXunVoid。facts.transmissions の isVoid） */
  isVoid: boolean;
  /** 伝の支（天盤）が加わる地盤支が占日の旬空（坐空。Phase 3M-C） */
  isSeatedOnVoid: boolean;
  growthStage: GrowthStage;
  growthPhase: GrowthPhase;
  /** 当月の月令に対する状態。月支がなければ null（将来月は含めない） */
  seasonalStrength: SeasonalStrength | null;
}

/**
 * 三伝の空亡の構造（Phase 3M-C）。日旬空と坐空を別々に持つ。
 * 三伝皆空・踏脚空亡などの判定、旬をたどる空亡（本旬→後旬→外後旬）は持たない。
 */
export interface TransmissionVoidStructure {
  /** 各伝の支そのものが占日の旬空（既存の isVoid と同じ値） */
  dayXunVoid: Triple<boolean>;
  /** 各伝の支が加わる地盤支が占日の旬空 */
  seatedOnVoid: Triple<boolean>;
  finalIsDayXunVoid: boolean;
  finalIsSeatedOnVoid: boolean;
}

/** 三伝と日干の作用関係の流れ */
export interface TransmissionDayStemFlow {
  states: Triple<TransmissionDayStemState>;
  /** 三伝の空亡の構造（Phase 3M-C） */
  voidStructure: TransmissionVoidStructure;
  /** 季節内の進気・退気（区間の FACT。Phase 3J） */
  initialToMiddle: SeasonalBranchDirectionFact;
  middleToFinal: SeasonalBranchDirectionFact;
  /** 支の移動（三伝全体の FLOW） */
  movementPattern: MovementPattern;
}

// ==== 干上の現在地と三伝の経路（Phase 3L）。比較のための中立 FACT。宜進・宜退・評価は持たない ====

/**
 * 日干上神（一課上神）の、日干との関係と状態（TransmissionDayStemState と同じ項目）。
 * relationToDayStem の向きは「上神 → 日干」（TransmissionToDayStemRelation の「伝」を「上神」と読む）。
 */
export interface DayStemStandingState {
  branch: Branch;
  element: Element;
  relationToDayStem: TransmissionToDayStemRelation;
  /** 六親（facts.lessons[0].relation） */
  sixRelation: SixRelation;
  isDaySalary: boolean;
  isDayVirtue: boolean;
  isXunDing: boolean;
  isYima: boolean;
  /** 上神そのものが占日の旬空 */
  isVoid: boolean;
  /** 上神（天盤）が加わる地盤支（＝日干の寄宮支）が占日の旬空（坐空。Phase 3M-C） */
  isSeatedOnVoid: boolean;
  growthStage: GrowthStage;
  growthPhase: GrowthPhase;
  /** 当月の月令に対する状態。月支がなければ null */
  seasonalStrength: SeasonalStrength | null;
}

/** 干上に留まる側（standing）と三伝へ進む側（path）を並べたもの */
export interface StandingAndTransmissionPath {
  standing: DayStemStandingState;
  /** Phase 3K の三伝と日干の作用関係。三伝未確定なら null */
  path: TransmissionDayStemFlow | null;
}

// ==== 進退判断の材料（Phase 3N）。方向のシグナルを並べるだけの中立 FACT ====
// 宜進・宜退・宜守の判定、score は持たない。季節内の進気・退気（SeasonalBranchDirection）とは別。

/**
 * 三伝の支の移動の向き（movementPattern を言い換えたもの）。
 *   advancing … 進茹・進間 / retreating … 退茹・退間 / neutral … その他
 * advancing＝宜進、retreating＝宜退 ではない。
 */
export type MovementDirection = "advancing" | "retreating" | "neutral";

/** 進退判断に使う材料（三伝の向き・末伝の空亡・干上の現在地・三伝の経路を分けたまま持つ） */
export interface DirectionEvidence {
  movementDirection: MovementDirection;
  movementPattern: MovementPattern;
  /** 干上（日干上神）の現在地（Phase 3L） */
  standing: DayStemStandingState;
  /** 三伝の経路（Phase 3K・3M-C） */
  path: TransmissionDayStemFlow;
  /** 末伝の空亡（Phase 3M-C の voidStructure） */
  terminal: { dayXunVoid: boolean; seatedOnVoid: boolean };
}

// ==== 干上と三伝の比較（Phase 3P）。4段階（干上→初伝→中伝→末伝）を同じ軸で並べるだけの中立 FACT ====
// 宜進・宜退・宜守、実効性（空亡が禄・旺を無効にする等）の判定、評価語は持たない。

/** 比較の位置（干上と三伝） */
export type ComparisonPosition = "standing" | TransmissionPosition;

/** 干上→初伝→中伝→末伝 の4段階 */
export interface StandingPathSequence<T> {
  standing: T;
  initial: T;
  middle: T;
  final: T;
}

/** 1段階の値の変化（from→to をそのまま持つ） */
export interface ValueChange<T> {
  from: T;
  to: T;
  changed: boolean;
}

/** 隣り合う2段階の変化（同じ軸で並べる） */
export interface ComparisonStep {
  fromPosition: ComparisonPosition;
  toPosition: TransmissionPosition;
  relationToDayStem: ValueChange<TransmissionToDayStemRelation>;
  sixRelation: ValueChange<SixRelation>;
  growthStage: ValueChange<GrowthStage>;
  growthPhase: ValueChange<GrowthPhase>;
  dayXunVoid: ValueChange<boolean>;
  seatedOnVoid: ValueChange<boolean>;
  daySalary: ValueChange<boolean>;
  dayVirtue: ValueChange<boolean>;
}

/** 干上（現在地）と三伝（経路）の比較 */
export interface StandingPathComparison {
  /** Phase 3N の三伝の向き（比較の結果には使わない） */
  movementDirection: MovementDirection;
  movementPattern: MovementPattern;
  /** 干上（Phase 3L の値をそのまま参照） */
  standing: DayStemStandingState;
  /** 三伝（Phase 3K の値をそのまま参照） */
  path: Triple<TransmissionDayStemState>;
  transitions: { standingToInitial: ComparisonStep; initialToMiddle: ComparisonStep; middleToFinal: ComparisonStep };
  sequences: {
    relationToDayStem: StandingPathSequence<TransmissionToDayStemRelation>;
    sixRelation: StandingPathSequence<SixRelation>;
    growthStage: StandingPathSequence<GrowthStage>;
  };
  /** 日禄・日徳・旬丁・驛馬が現れる位置（干上→末伝の順。なければ []） */
  markerPositions: {
    daySalary: readonly ComparisonPosition[];
    dayVirtue: readonly ComparisonPosition[];
    xunDing: readonly ComparisonPosition[];
    yima: readonly ComparisonPosition[];
  };
  /** 旬空・坐空の位置（別々に持つ。干上を含む） */
  voidPositions: {
    dayXunVoid: readonly ComparisonPosition[];
    seatedOnVoid: readonly ComparisonPosition[];
  };
  /** 地点どうしの関係（Phase 3R） */
  internalRelations: StandingPathInternalRelations;
}

// ==== 干上・三伝の地点どうしの関係（Phase 3R）。生剋の向きだけを持ち、吉凶は持たない ====

/**
 * 2つの支の五行の関係（向きは from → to。relationBetween(from, to) の五行関係）。
 *   generates … from が to を生ずる / sameElement … 同じ五行 / generatedBy … from が to に生じられる
 *   overcomes … from が to を剋す / overcomeBy … from が to に剋される
 */
export type ElementRelation = Extract<StructuralRelation, "generates" | "sameElement" | "generatedBy" | "overcomes" | "overcomeBy">;

/** 地点どうしの関係（順方向のみ。逆向きは保存しない） */
export interface PathInternalRelation {
  fromPosition: ComparisonPosition;
  toPosition: TransmissionPosition;
  fromBranch: Branch;
  toBranch: Branch;
  relation: ElementRelation;
  /** relationBetween(from, to) の結果そのもの（冲・刑・六合・破・害も含む） */
  structural: RelationFact;
}

export interface StandingPathInternalRelations {
  /** 隣り合う3組: 干上→初伝・初伝→中伝・中伝→末伝（all の同じオブジェクト） */
  adjacent: readonly [PathInternalRelation, PathInternalRelation, PathInternalRelation];
  /** 順方向の6組: 干上→初・干上→中・干上→末・初→中・初→末・中→末 */
  all: readonly PathInternalRelation[];
}

// ==== 実現の制約（Phase 3S）。象意が「存在するか」ではなく、
// 「その象意が現実化・作用するときに古典上考慮される制約 FACT が付いているか」を持つ層。
// 制約があるから作用しない、とはしない（有効・無効・虚実・吉凶・score は持たない）。

/** 今回扱う制約（既存 FACT の isVoid・isSeatedOnVoid をそのまま言い換えたもの） */
export type ActualizationConstraint = "dayXunVoid" | "seatedOnVoid";

/** 1地点に存在する FACT と、その地点の制約 */
export interface PositionActualizationState {
  position: ComparisonPosition;
  branch: Branch;
  /** なければ []。順は dayXunVoid → seatedOnVoid */
  constraints: readonly ActualizationConstraint[];
  relationToDayStem: TransmissionToDayStemRelation;
  sixRelation: SixRelation;
  growthStage: GrowthStage;
  growthPhase: GrowthPhase;
  markers: { daySalary: boolean; dayVirtue: boolean; xunDing: boolean; yima: boolean };
  /** 元の FACT（Phase 3L・3K の状態。isVoid・isSeatedOnVoid はここに残る） */
  source: DayStemStandingState | TransmissionDayStemState;
}

/** 地点どうしの関係（Phase 3R）と、その両端の制約 */
export interface InternalRelationConstraints {
  relation: PathInternalRelation;
  fromConstraints: readonly ActualizationConstraint[];
  toConstraints: readonly ActualizationConstraint[];
}

export interface StandingPathActualization {
  /** 干上・初伝・中伝・末伝 */
  states: readonly [PositionActualizationState, PositionActualizationState, PositionActualizationState, PositionActualizationState];
  /** Phase 3R の順方向6組と同じ順 */
  internalRelations: readonly InternalRelationConstraints[];
}

// ==== 四課の状態（Phase 3U）。一課〜四課の上神を三伝と同じ項目で持つ中立 FACT。ROLE・吉凶は持たない ====

export type LessonPosition = "lesson1" | "lesson2" | "lesson3" | "lesson4";

/** 下神→上神 の関係（下神は一課では日干そのもの〔干〕、二〜四課では地盤支） */
export interface LessonLowerToUpper {
  from: Stem | Branch;
  to: Branch;
  /** relationBetween(下神, 上神) の五行関係（干が下神のときは五行の関係だけになる） */
  relation: ElementRelation;
  structural: RelationFact;
  /** 既存の四課の剋関係（Phase 2 の LessonFact.zeike） */
  zeike: LessonZeike;
}

/** 四課1課の状態 */
export interface FourLessonState {
  position: LessonPosition;
  index: 1 | 2 | 3 | 4;
  /** 下神（一課は日干そのもの） */
  lower: Stem | Branch;
  /** 地盤支（一課は日干の寄宮支） */
  lowerBranch: Branch;
  /** 上神の状態（干上の DayStemStandingState と同じ形・同じ規則） */
  upper: DayStemStandingState;
  /** Phase 3S と同じ規則の制約（上神の旬空・坐空） */
  constraints: readonly ActualizationConstraint[];
  lowerToUpper: LessonLowerToUpper;
}

/** 四課の上神どうしの関係（順方向のみ） */
export interface FourLessonInternalRelation {
  fromPosition: LessonPosition;
  toPosition: LessonPosition;
  fromBranch: Branch;
  toBranch: Branch;
  relation: ElementRelation;
  structural: RelationFact;
}

export interface FourLessonsState {
  lessons: readonly [FourLessonState, FourLessonState, FourLessonState, FourLessonState];
  /** 上神どうしの順方向6組: 1→2・1→3・1→4・2→3・2→4・3→4 */
  internalRelations: readonly FourLessonInternalRelation[];
}

// ==== 日支そのものの状態（Phase 3V）。三課の上神ではなく、その日の支そのもの。ROLE・吉凶は持たない ====

/** 日支に当てはまる制約（日支は天盤の上神ではないので坐空は対象外。旬空だけ） */
export type DayBranchConstraint = Extract<ActualizationConstraint, "dayXunVoid">;

export interface DayBranchState {
  anchor: "dayBranch";
  branch: Branch;
  element: Element;
  /** 日支 → 日干 の五行関係（TransmissionToDayStemRelation の「伝」を「日支」と読む） */
  relationToDayStem: TransmissionToDayStemRelation;
  /** 日干からみた日支の六親 */
  sixRelation: SixRelation;
  growthStage: GrowthStage;
  growthPhase: GrowthPhase;
  /** 月支がなければ null */
  seasonalStrength: SeasonalStrength | null;
  /** 日支そのものが日禄・日徳・旬丁・驛馬の支か */
  markers: { daySalary: boolean; dayVirtue: boolean; xunDing: boolean; yima: boolean };
  /** 日支そのものが占日の旬空か（既存の旬空 FACT から求める。特別扱いはしない） */
  isDayXunVoid: boolean;
  /** 日支に当てはめる制約の種類（坐空は対象外） */
  applicableConstraints: readonly DayBranchConstraint[];
  constraints: readonly DayBranchConstraint[];
}

// ==== 天盤支が乗る地盤位置での状態（Phase 4A）。中立 FACT。ROLE・DOMAIN・吉凶・強弱は持たない ====
// 既存の growthStage（日干の五行を基準に、その天盤支を見る）とは別物。
// こちらは天盤支自身の五行を基準に、その天盤支が乗る地盤支を見る。旺相休囚死は地盤支で変わらないので持たない。

export interface SiteState {
  /** 天盤支 */
  skyBranch: Branch;
  /** 天盤支が乗る地盤支（facts.plate.earthUnder[skyBranch]） */
  siteBranch: Branch;
  /** 天盤支自身の五行 */
  skyElement: Element;
  /** skyElement を siteBranch に当てた十二長生（五行生墓法） */
  growthStageAtSite: GrowthStage;
  growthPhaseAtSite: GrowthPhase;
  /** relationBetween(skyBranch, siteBranch) の五行関係（向きは 天盤支 → 地盤支） */
  relation: ElementRelation;
  /** relationBetween(skyBranch, siteBranch)（合・冲・刑・害・破を含む） */
  structural: RelationFact;
}
