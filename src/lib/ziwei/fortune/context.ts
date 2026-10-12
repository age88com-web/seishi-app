// src/lib/ziwei/fortune/context.ts
//
// 鑑定日の行運コンテキスト（本命＋大限＋小限＋太歳）。docs/ziwei-basic-spec.md §27。
// 入口: buildFortuneContext(chart, 鑑定日)。本命盤（chart）は変更しない。鑑定日から行運部分だけを計算する。
//   数え年 … 既存 kazoeAge（旧正月で加算）
//   大限 … 既存の大限（chart.dayun）。最初の大限の前は「大限開始前」、表の最後より後は「大限表の範囲外」（§18 U8）
//   小限 … 既存 xiaoxianAt、太歳 … 鑑定日の陰暦年の地支（taisei.ts）
//   四化 … 生年・大限・小限の層（統合しない）、行運格局 … 3格（patterns.ts）
// 宮クリック用の buildFortunePalaceContext(chart, 鑑定日, 宮の支) も同じデータから作る（解釈文はまだ作らない）。
// 太歳による年運補助（taiseiInfluence.ts。§31 重なりだけ）・流年＝小限の年運ルール（liunian.ts。§32）・
// 四化星と宮の喜忌（xijiEvaluate.ts。§33 大限・小限を別評価）も同じデータから作る。

import { sanfangSizheng } from "../sanfang";
import type { Branch, CivilDate, PalaceName, ZiweiChart } from "../types";
import { dayunAt } from "../dayun";
import { kazoeAgeOn, majorLimitTransformations, minorLimitTransformations, natalTransformations, transformationLayersByBranch } from "./limitTransformations";
import { fortunePalaceMap, fortunePalaceNameOf } from "./palaceMap";
import type { FortunePalaceEntry } from "./palaceMap";
import { evaluateFortunePatterns } from "./patterns";
import type { FortunePatternResult } from "./patterns";
import { taiseiOf } from "./taisei";
import type { TaiseiContext } from "./taisei";
import { buildTaiseiInfluence, taiseiRelationOf } from "./taiseiInfluence";
import type { TaiseiInfluence, TaiseiRelation } from "./taiseiInfluence";
import { evaluateLiunian } from "./liunian";
import type { LiunianContext, LiunianEffect } from "./liunian";
import { evaluateLimitXiji } from "./xijiEvaluate";
import { calcYearFortuneIndex } from "./yearIndex";
import type { YearFortuneIndex } from "./yearIndex";
import type { LimitXijiResult } from "./xijiEvaluate";
import type { LayeredTransformation, LimitTransformations } from "./types";

export type MajorLimitStatus = "active" | "beforeFirst" | "afterLast" | "none";

export interface FortuneContext {
  /** 鑑定日（太歳宮と鑑定日の数え年はこの日だけで決まる） */
  date: CivilDate;
  /** 鑑定日の数え年 */
  kazoeAge: number;
  /** 選択中の大限（開始年齢）・小限（数え年）。鑑定日から同期した値か、手動で選んだ値 */
  selection: { majorStartAge: number | null; minorAge: number | null };
  majorLimitStatus: MajorLimitStatus;
  majorLimit: LimitTransformations | null;
  /** 数え年が1未満（鑑定日が出生の年より前）なら null */
  minorLimit: LimitTransformations | null;
  taisei: TaiseiContext;
  natalTransformations: LayeredTransformation[];
  majorTransformations: LayeredTransformation[];
  minorTransformations: LayeredTransformation[];
  majorPalaceMap: FortunePalaceEntry[] | null;
  minorPalaceMap: FortunePalaceEntry[] | null;
  majorPatterns: FortunePatternResult[];
  minorPatterns: FortunePatternResult[];
  /** 宮の支ごとの四化（生年・大限・小限の層のまま） */
  transformationsByBranch: Record<Branch, LayeredTransformation[]>;
  /** 太歳宮による年運補助（§31。小限とは別の層。重なりだけ） */
  taiseiInfluence: TaiseiInfluence;
  /** 流年（＝小限）の年運ルール（§32。S33 羊陀夾忌） */
  liunian: LiunianContext;
  /** 四化星と宮の喜忌（§33。S40）。大限・小限を別々に評価。太歳には当てない */
  majorXiji: LimitXijiResult | null;
  minorXiji: LimitXijiResult | null;
  /** 選択中の小限の年齢の流年指数（§34。年齢が属する大限から求める。小限がなければ null） */
  yearIndex: YearFortuneIndex | null;
}

/** "YYYY-MM-DD" を暦日として読む（Date を経由しないので UTC で日付がずれない） */
export function parseAppraisalDate(s: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31 ? d : null;
}

/** 日本の今日の日付（"YYYY-MM-DD"） */
export function todayInJapan(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * 行運コンテキスト（選択を明示的に受け取る）。鑑定日は太歳宮と鑑定日の数え年に使い、
 * 大限・小限は selection の値だけで決める（鑑定日から暗黙に決めない）。
 */
export function buildFortuneContextFor(
  chart: ZiweiChart,
  date: CivilDate,
  selection: { majorStartAge: number | null; minorAge: number | null },
): FortuneContext {
  const kazoeAge = kazoeAgeOn(chart, date);
  const periods = chart.dayun.periods;
  const period = selection.majorStartAge === null ? null : (periods.find((p) => p.startAge === selection.majorStartAge) ?? null);
  const majorLimit = period ? majorLimitTransformations(chart, { period }) : null;
  const refAge = selection.minorAge ?? kazoeAge;
  const majorLimitStatus: MajorLimitStatus = majorLimit
    ? "active"
    : refAge >= 1 && refAge < periods[0].startAge
      ? "beforeFirst"
      : refAge > periods[periods.length - 1].endAge
        ? "afterLast"
        : "none";
  const minorLimit = selection.minorAge !== null && selection.minorAge >= 1 ? minorLimitTransformations(chart, selection.minorAge) : null;
  const natal = natalTransformations(chart);
  const transformationsByBranch = transformationLayersByBranch(chart, { major: majorLimit, minor: minorLimit });
  const taisei = taiseiOf(chart, date, transformationsByBranch);
  const majorPalaceMap = majorLimit ? fortunePalaceMap(chart, majorLimit.palaceBranch) : null;
  const minorPalaceMap = minorLimit ? fortunePalaceMap(chart, minorLimit.palaceBranch) : null;
  const majorPatterns = majorLimit ? evaluateFortunePatterns(chart, natal, majorLimit) : [];
  const minorPatterns = minorLimit ? evaluateFortunePatterns(chart, natal, minorLimit) : [];
  return {
    date,
    kazoeAge,
    selection: { majorStartAge: period ? period.startAge : null, minorAge: minorLimit ? selection.minorAge : null },
    majorLimitStatus,
    majorLimit,
    minorLimit,
    taisei,
    natalTransformations: natal,
    majorTransformations: majorLimit?.transformations ?? [],
    minorTransformations: minorLimit?.transformations ?? [],
    majorPalaceMap,
    minorPalaceMap,
    majorPatterns,
    minorPatterns,
    transformationsByBranch,
    taiseiInfluence: buildTaiseiInfluence(chart, {
      taisei,
      transformationsByBranch,
      majorLimit,
      minorLimit,
      majorPalaceMap,
      minorPalaceMap,
      majorPatterns,
      minorPatterns,
    }),
    liunian: evaluateLiunian(chart, { minorLimit, majorPatterns, transformationsByBranch }),
    majorXiji: majorLimit ? evaluateLimitXiji(chart, majorLimit, majorPatterns) : null,
    minorXiji: minorLimit ? evaluateLimitXiji(chart, minorLimit, minorPatterns) : null,
    yearIndex: minorLimit ? calcYearFortuneIndex(chart, minorLimit.age!) : null,
  };
}

/** 鑑定日の行運（その日の数え年の大限・小限を選んだ状態） */
export function buildFortuneContext(chart: ZiweiChart, date: CivilDate): FortuneContext {
  const age = kazoeAgeOn(chart, date);
  return buildFortuneContextFor(chart, date, {
    majorStartAge: age >= 1 ? (dayunAt(chart.dayun, age)?.startAge ?? null) : null,
    minorAge: age >= 1 ? age : null,
  });
}

export interface FortunePalaceContext {
  branch: Branch;
  natalPalace: PalaceName;
  majorPalace: PalaceName | null;
  minorPalace: PalaceName | null;
  isMajorMing: boolean;
  isMinorMing: boolean;
  isTaisei: boolean;
  sanfangSizheng: { self: Branch; opposite: Branch; trines: [Branch, Branch] };
  /** この宮の四化（層のまま） */
  transformations: LayeredTransformation[];
  /** この宮が成立箇所・影響範囲になっている行運格局 */
  patterns: FortunePatternResult[];
  /** 太歳宮との関係（太歳宮・三合宮・対宮。三方四正の外は null） */
  taiseiRelation: TaiseiRelation | null;
  /** この宮についての流年（小限）の作用（S33。成立したものだけ） */
  liunianEffects: LiunianEffect[];
  fortune: FortuneContext;
}

/**
 * 宮クリック用（次工程で行運解釈を付ける）。鑑定日（太歳）・選択中の大限・選択中の小限を明示的に受け取り、
 * この宮の本命・大限・小限・太歳の位置づけを返す。
 */
export function buildFortunePalaceContext(
  chart: ZiweiChart,
  input: { appraisalDate: CivilDate; majorStartAge: number | null; minorAge: number | null },
  branch: Branch,
): FortunePalaceContext {
  const f = buildFortuneContextFor(chart, input.appraisalDate, { majorStartAge: input.majorStartAge, minorAge: input.minorAge });
  const sf = sanfangSizheng(branch);
  return {
    branch,
    natalPalace: chart.palaces.find((p) => p.branch === branch)!.name,
    majorPalace: f.majorPalaceMap ? fortunePalaceNameOf(f.majorPalaceMap, branch) : null,
    minorPalace: f.minorPalaceMap ? fortunePalaceNameOf(f.minorPalaceMap, branch) : null,
    isMajorMing: f.majorLimit?.palaceBranch === branch,
    isMinorMing: f.minorLimit?.palaceBranch === branch,
    isTaisei: f.taisei.branch === branch,
    sanfangSizheng: { self: sf.self, opposite: sf.opposite, trines: sf.trines },
    transformations: f.transformationsByBranch[branch],
    patterns: [...f.majorPatterns, ...f.minorPatterns].filter(
      (p) => p.conditionMatched && (p.matchedPalaces.some((m) => m.branch === branch) || p.affectedPalaces.some((m) => m.branch === branch)),
    ),
    taiseiRelation: taiseiRelationOf(f.taisei.branch, branch),
    liunianEffects: f.liunian.effects.filter((e) => e.branch === branch),
    fortune: f,
  };
}
