// src/lib/shichusuimei/kakkyoku/types.ts
//
// 強弱・格局判定（補助判定）の型。
// 正本: docs/shichusuimei-kakkyoku-spec.md（§11・§17・§19・§22・§25）
// 最終判断は常に術者（finalJudgment: "requires_practitioner_judgment"）。

import type { Branch, Element, Pillar, PillarKey, Stem } from "../types";

export type Pillars = { 時: Pillar | null; 日: Pillar; 月: Pillar; 年: Pillar };

export type Tristate = "yes" | "no" | "undetermined";

// ---------------------------------------------------------------------------
// 強弱（§9・§13・§17・§22）
// ---------------------------------------------------------------------------

export interface SantokuItem {
  value: Tristate;
  /** 三得の割合（得令50・得勢30・得地20）。強さの点数ではない */
  indexPercent: 50 | 30 | 20;
  evidence: string[];
  undeterminedReason?: string;
}

/** 「弱（得地のみ）」は三得が得地だけ（20%）の弱側（KD15。旧「未分類」） */
export type StrengthClass = "過強" | "中強" | "境界" | "中弱" | "弱（得地のみ）" | "過弱";
export type StrengthLeaning = "身強寄り" | "身弱寄り" | "要術者判断";

export interface ForceRange {
  min: number;
  max: number;
}

export interface PercentRange {
  minPercent: number;
  maxPercent: number;
}

/** 強弱用の力量バランス（KD1）。内格の点数とは別体系 */
export interface ForceBalance {
  weights: { stem: 1; yearDayHourBranch: ForceRange; monthBranch: 6 };
  byElement: Record<Element, ForceRange>;
  breakdown: { position: string; element: Element; force: ForceRange }[];
}

export type ToutaLevel = "touta" | "notTouta" | "borderline";

/** 党多（KD10） */
export interface ToutaAssessment {
  target: { label: string; elements: Element[] };
  share: PercentRange;
  others: { element: Element; share: PercentRange }[];
  level: ToutaLevel;
}

export interface StrengthAssessment {
  dayMaster: { stem: Stem; element: Element };
  tokurei: SantokuItem;
  tokusei: SantokuItem;
  tokuchi: SantokuItem;
  indexPercent: number | null;
  indexRange: [number, number];
  classification: StrengthClass | null;
  classificationCandidates: StrengthClass[];
  leaning: StrengthLeaning;
  /** 日干の比劫＋印の党多（得勢の根拠） */
  touta: ToutaAssessment;
  forceBalance: ForceBalance;
  /** 日干五行の透干・通根の区分（三p34） */
  rootStrength: "最強" | "強" | "弱" | "なし";
  strengtheningFactors: string[];
  weakeningFactors: string[];
  reviewNotes: string[];
}

// ---------------------------------------------------------------------------
// 干合・化格（KD2・KD4）
// ---------------------------------------------------------------------------

/**
 * 干合の分類（KD23）。どれも自動確定ではない（最終判断は術者）。
 *   none … 干合なし（化格対象外）
 *   hequ … 干合あり・月支条件不成立（合去。原局化格候補外）
 *   hehuaCandidate … 干合あり・月支条件成立（化格候補）
 *   hehuaCandidateSupported … 月支条件成立＋補強あり（化格候補・補強あり）
 */
export type StemCombination = "none" | "hequ" | "hehuaCandidate" | "hehuaCandidateSupported";

export interface NatalHehua {
  position: "日干-月干" | "日干-時干";
  stems: [Stem, Stem] | null;
  stemCombination: StemCombination;
  transformElement: Element | null;
  monthBranch: Branch;
  monthMainElement: Element;
  /** 化す五行の月支条件（KD23）。干合なしは null */
  requiredMonthBranches: readonly Branch[] | null;
  /** 月支条件の成否。干合なしは null */
  monthCondition: boolean | null;
  /** 原局内の補強（化す五行と比和する天干・地支だけ。干合の2干と月支は数えない）。1件以上で hehuaCandidateSupported */
  supports: string[];
  /** 参考情報（化す五行を生じる五行・比劫＋印の党多）。補強の判定には使わない */
  references: string[];
  /** 月支の地支関係（三合・三会・半合・半会・六合・冲を全件。事実のみ。化の維持・解消は判定しない） */
  monthRelations: string[];
  /** 行運補強（あり／なし）。原局の月支条件・補強とは別。未実装のため常に null */
  luckSupport: boolean | null;
}

// ---------------------------------------------------------------------------
// 外格・特殊格局（§14・§15・KD9・KD11）
// ---------------------------------------------------------------------------

/**
 * confirmed_by_engine … エンジンの機械判定で成立。術者の確定ではない（KD19）。現在これを返す格はない（化格は KD23 で candidate）
 */
export type CandidateStatus = "confirmed_by_engine" | "candidate" | "provisional" | "needs_review" | "not_applicable";

export interface KakkyokuCandidate {
  name: string;
  /** 一行得気格の曲直格など、下位名称（資料の規則で機械的に決まるもの） */
  subName: string | null;
  status: CandidateStatus;
  basis: string[];
  notes: string[];
  /** 画面に出すか（成立可能性のない格は false。内部には保持） */
  uiVisible: boolean;
}

export type Route = "gaikakuCandidate" | "naikaku";

// ---------------------------------------------------------------------------
// 内格点数（KD12・KD13）
// ---------------------------------------------------------------------------

export interface BranchState {
  pillar: PillarKey;
  branch: Branch;
  relations: string[];
  transformedTo: Element | null;
  decay: number;
  notes: string[];
}

/** 内格補助の判定（比劫＋印 対 食傷＋財＋官。KD17） */
export type InnerJudgment = "身強" | "身弱" | "境界";

export interface InnerPatternScore {
  system: "inner-pattern-scoring";
  /** 比劫＋印 と 食傷＋財＋官 の比較（日干単独点ではない） */
  judgment: InnerJudgment;
  /** 日主側を助ける比劫・印の配置（短い根拠） */
  helps: string[];
  dayMaster: { stem: Stem; points: number };
  supportingSide: { elements: Element[]; points: number };
  weakeningSide: { elements: Element[]; points: number };
  byElement: Record<Element, number>;
  byStem: { pillar: PillarKey; stem: Stem; total: number; fromBranches: number; adjacent: number }[];
  branchStates: BranchState[];
  assumptions: string[];
  referenceOnly: boolean;
}

/** 五季の旺相休囚死（KD27-1） */
export type SeasonalState = "旺" | "相" | "休" | "囚" | "死";

/** 天干の通根の段階（KD27-4）。month は月支に通根（2根相当） */
export type RootLevel = "none" | "one" | "twoOrMore" | "month";

/** 新方式の地支1支の力量（KD27）。地支の五行に1回だけ加える */
export interface ElementForceBranch {
  pillar: PillarKey;
  branch: Branch;
  /** 力量を加える五行（化した地支は化後の五行） */
  element: Element;
  /** 化した場合だけ、もとの地支の五行 */
  originalElement: Element | null;
  /** 基礎点（月支5・他2） */
  base: number;
  seasonal: SeasonalState;
  coefficient: number;
  force: number;
}

/** 新方式の天干1本の力量（KD27）。季節係数は掛けない */
export interface ElementForceStem {
  pillar: PillarKey;
  stem: Stem;
  element: Element;
  /** 天干と同じ五行の蔵干を持つ地支（自柱を含む。印は数えない） */
  roots: PillarKey[];
  rootLevel: RootLevel;
  multiplier: number;
  force: number;
}

/** 新方式の内格力量（KD27）。旧 InnerPatternScore とは別の結果 */
export interface ElementForceResult {
  system: "element-force";
  monthBranch: Branch;
  /** 月令の五行（五季。辰戌丑未は月全体を土旺） */
  rulingElement: Element;
  seasonal: Record<Element, { state: SeasonalState; coefficient: number }>;
  branches: ElementForceBranch[];
  stems: ElementForceStem[];
  /** 五行ごとに命式全体で1回だけ集計（季節補正後の地支力量＋通根補正後の天干力量） */
  byElement: Record<Element, { branch: number; stem: number; total: number }>;
  supportingSide: { elements: Element[]; points: number };
  weakeningSide: { elements: Element[]; points: number };
  totalPoints: number;
  /** 扶助率（％）＝ 扶助側 ÷ 五行総力量 × 100 */
  supportRatioPercent: number;
  /** 点数による判定（55%以上 身強・45%以下 身弱・その間 境界） */
  scoreJudgment: InnerJudgment;
  /** KD21 の成立（月刃格: 月支本気＝日干の五行／建禄格: 月支本気が日干を生じる） */
  monthPattern: "月刃格" | "建禄格" | null;
  /** 最終判定（建禄格・月刃格なら格局表どおり身強。それ以外は点数判定） */
  finalJudgment: InnerJudgment;
  finalSource: "monthPattern" | "score";
  /** 点数判定が境界のときの補助判断材料（数値係数にはしない） */
  borderlineMaterials: string[];
  referenceOnly: boolean;
}

export interface KakkyokuResult {
  referenceOnly: boolean;
  strength: StrengthAssessment;
  hehua: NatalHehua[];
  candidates: KakkyokuCandidate[];
  route: Route;
  /** エンジン判定の要約（外格候補がなければ内格。外格候補が並ぶときは null で candidates を参照。1つを自動選択しない） */
  enginePattern: { name: string; status: CandidateStatus } | null;
  /** 旧方式の内格補助点（KD12・KD13・KD17）。比較・回帰確認用に残す。通常の身強・身弱判定には使わない（KD27） */
  innerScore: InnerPatternScore;
  /** 内格補助の位置づけ: 内格の経路／外格・特殊格局候補あり（内格補助点は参考） */
  innerScoreScope: "naikaku" | "withGaikakuCandidates";
  /** 新方式の内格力量（KD27）。画面の内格強弱・resolveEffectiveStrength・印刷はこれを使う（外格・化格の機械判定にかかわらず常に計算する） */
  elementForce: ElementForceResult;
  finalJudgment: "requires_practitioner_judgment";
}
