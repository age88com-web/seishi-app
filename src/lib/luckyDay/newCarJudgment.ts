// src/lib/luckyDay/newCarJudgment.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の「新車購入・納車の吉日」専用の判定層。
//   既存の擇日エンジン（calculateTakujitsuFull の結果）を読むだけで、
//   宜忌・resolution・verdict は一切変更しない。ここで加える除外は
//   この機能の表示にだけ使い、エンジンへは戻さない。
//
// 判定方式（監修決定、2026-10-26）:
//   信發堂の掲載日を再現するものではなく、原典の宜忌と既存エンジンを使う独自の選日方式。
//   ・買車（新車購入）＝立券交易：月破でない かつ 長星でない かつ 短星でない かつ 立券交易＝good
//   ・交車（納車）＝出行：月破でない かつ 出行＝good（長星・短星は交車の除外条件にしない）
//   ・買車及交車：買車・交車をそれぞれ判定し、両方 good のときだけ「ともに吉」
//   優先順位：月破 → （買車のみ）長星・短星 → 既存エンジンの最終判定。
//   月破・長星・短星は「成立」（resolution 前の shinsatsu.kyojin）で判定する。
//   吉神の併臨や resolution の結果で除外を解除しない。
//
// 状態は内部で別々に保持する（画面の記号は「—」が共通でも、凶・月破・長星短星は区別する）。
//   good=吉日 / mixed=宜忌が競合 / bad=凶 / undetermined=宜忌なし（吉凶未確定）
//   excluded_geppa=月破により推奨対象外 / excluded_star=長星・短星により推奨対象外

import type { TakujitsuFullResult } from "@/lib/takujitsu";
import { getActivityProfile } from "@/lib/takujitsu/activity";
import type { ActivityEvaluation, ActivitySource, ActivityVerdict } from "@/lib/takujitsu/activity";

export const NEW_CAR_BUY_ACTIVITY_ID = "立券交易";
export const NEW_CAR_DELIVERY_ACTIVITY_ID = "出行";

export type NewCarStatus = "good" | "mixed" | "bad" | "undetermined" | "excluded_geppa" | "excluded_star";

/** 新車専用の追加除外の理由（既存エンジンの忌とは別に保持する）。 */
export type NewCarExclusion = "月破" | "長星" | "短星";

export interface NewCarSourceView {
  name: string;
  /** 凶神の resolution 後の状態（active 以外のときだけ）。 */
  resolutionStatus?: string;
}

/**
 * 六黄道・六黒道（COMPOSITE型）の追従分。エンジンは同日の吉神の宜・凶神の忌を
 * これらの神にも積むが、独立した根拠ではないため直接の根拠と分けて表示する。
 */
export interface NewCarFollowerView {
  name: string;
  /** 追従している直接の根拠（宜は吉神、忌は凶神。十二直・宿は追従対象外）。 */
  follows: string[];
}

export interface NewCarPartJudgment {
  status: NewCarStatus;
  /** 基本となる用事（買車＝立券交易、交車＝出行）。 */
  baseActivityId: string;
  /** 既存エンジンのその用事の最終判定（変更しない）。 */
  baseVerdict: ActivityVerdict;
  /** 宜忌の直接の根拠（追従分を含まない）。 */
  positiveSources: NewCarSourceView[];
  negativeSources: NewCarSourceView[];
  /** 他の神殺に追従しているだけの要素（六黄道・六黒道）。 */
  positiveFollowers: NewCarFollowerView[];
  negativeFollowers: NewCarFollowerView[];
  /** 新車専用の追加除外に該当したもの（空なら追加除外なし）。 */
  exclusions: NewCarExclusion[];
}

export interface NewCarDayFacts {
  dateIso: string;
  /** 0=日 … 6=土。 */
  weekday: number;
  dayStem: string;
  dayBranch: string;
  /** その日に成立した凶神（resolution 前）。 */
  kyojin: readonly string[];
  evaluations: readonly ActivityEvaluation[];
}

export interface NewCarDayJudgment {
  dateIso: string;
  weekday: number;
  dayStem: string;
  dayBranch: string;
  geppa: boolean;
  chousei: boolean;
  tansei: boolean;
  buy: NewCarPartJudgment;
  delivery: NewCarPartJudgment;
  /** 買車・交車がともに good のときだけ true。 */
  bothGood: boolean;
}

function sourceLabel(s: ActivitySource): string {
  if (s.sourceType === "jianchu") return `${s.sourceName}（十二直）`;
  if (s.sourceType === "shuku28") return `${s.sourceName}宿`;
  return s.sourceName;
}

function isCompositeSource(s: ActivitySource): boolean {
  return (s.sourceType === "kichijin" || s.sourceType === "kyojin") && getActivityProfile(s.sourceType, s.sourceName)?.composite === true;
}

/**
 * 出典を直接の根拠と追従分に分ける。追従先は evaluateActivities() 第2パスの定義どおり、
 * 同じ側の直接の根拠のうち、宜なら吉神・忌なら凶神のもの。
 * 追従先が無い COMPOSITE 型の出典（固有の宜忌）は直接の根拠として扱う。
 */
export function splitSources(
  sources: readonly ActivitySource[],
  favorable: boolean,
): { direct: NewCarSourceView[]; followers: NewCarFollowerView[] } {
  const directSources = sources.filter((s) => !isCompositeSource(s));
  const followTargetType = favorable ? "kichijin" : "kyojin";
  const follows = [...new Set(directSources.filter((s) => s.sourceType === followTargetType).map((s) => s.sourceName))];
  const direct: NewCarSourceView[] = [];
  const followers: NewCarFollowerView[] = [];
  for (const s of sources) {
    if (isCompositeSource(s) && follows.length > 0) {
      if (!followers.some((f) => f.name === s.sourceName)) followers.push({ name: s.sourceName, follows });
      continue;
    }
    direct.push({
      name: sourceLabel(s),
      ...(s.resolutionStatus && s.resolutionStatus !== "active" ? { resolutionStatus: s.resolutionStatus } : {}),
    });
  }
  return { direct, followers };
}

function verdictToStatus(v: ActivityVerdict): NewCarStatus {
  return v === "neutral" ? "undetermined" : v;
}

function judgePart(
  activityId: string,
  evaluations: readonly ActivityEvaluation[],
  exclusions: NewCarExclusion[],
): NewCarPartJudgment {
  const e = evaluations.find((x) => x.activityId === activityId);
  const baseVerdict: ActivityVerdict = e?.verdict ?? "neutral";
  let status: NewCarStatus;
  if (exclusions.includes("月破")) status = "excluded_geppa";
  else if (exclusions.length > 0) status = "excluded_star";
  else status = verdictToStatus(baseVerdict);
  const pos = splitSources(e?.positiveSources ?? [], true);
  const neg = splitSources(e?.negativeSources ?? [], false);
  return {
    status,
    baseActivityId: activityId,
    baseVerdict,
    positiveSources: pos.direct,
    negativeSources: neg.direct,
    positiveFollowers: pos.followers,
    negativeFollowers: neg.followers,
    exclusions,
  };
}

/** エンジンの事実（成立凶神・用事判定）から、新車購入・納車を判定する。 */
export function judgeNewCarFromFacts(facts: NewCarDayFacts): NewCarDayJudgment {
  const geppa = facts.kyojin.includes("月破");
  const chousei = facts.kyojin.includes("長星");
  const tansei = facts.kyojin.includes("短星");

  const buyExclusions: NewCarExclusion[] = [];
  if (geppa) buyExclusions.push("月破");
  if (chousei) buyExclusions.push("長星");
  if (tansei) buyExclusions.push("短星");
  const deliveryExclusions: NewCarExclusion[] = geppa ? ["月破"] : [];

  const buy = judgePart(NEW_CAR_BUY_ACTIVITY_ID, facts.evaluations, buyExclusions);
  const delivery = judgePart(NEW_CAR_DELIVERY_ACTIVITY_ID, facts.evaluations, deliveryExclusions);
  return {
    dateIso: facts.dateIso,
    weekday: facts.weekday,
    dayStem: facts.dayStem,
    dayBranch: facts.dayBranch,
    geppa,
    chousei,
    tansei,
    buy,
    delivery,
    bothGood: buy.status === "good" && delivery.status === "good",
  };
}

/** calculateTakujitsuFull() の結果1日分から判定する。 */
export function judgeNewCarDay(dateIso: string, weekday: number, result: TakujitsuFullResult): NewCarDayJudgment {
  return judgeNewCarFromFacts({
    dateIso,
    weekday,
    dayStem: result.calendar.dayStem,
    dayBranch: result.calendar.dayBranch,
    kyojin: result.shinsatsu.kyojin,
    evaluations: result.activities.evaluations,
  });
}

// ---------------------------------------------------------------------------
// 表示（OUTPUT 層）。記号は凶・追加除外で共通の「—」だが、状態は上で区別している。
// ---------------------------------------------------------------------------

export const NEW_CAR_STATUS_SYMBOL: Readonly<Record<NewCarStatus, string>> = {
  good: "◎",
  mixed: "△",
  bad: "—",
  excluded_geppa: "—",
  excluded_star: "—",
  undetermined: "？",
};

export const NEW_CAR_STATUS_LABEL: Readonly<Record<NewCarStatus, string>> = {
  good: "吉日",
  mixed: "宜忌が競合",
  bad: "凶",
  excluded_geppa: "月破により推奨対象外",
  excluded_star: "長星・短星により推奨対象外",
  undetermined: "吉凶未確定",
};

/** 一覧の記号の横に添える短い理由（追加除外のときだけ）。 */
export function newCarStatusTag(part: NewCarPartJudgment): string | null {
  if (part.status === "excluded_geppa") return "月破";
  if (part.status === "excluded_star") return part.exclusions.filter((x) => x !== "月破").join("・");
  return null;
}

function buySentence(p: NewCarPartJudgment): string {
  switch (p.status) {
    case "good":
      return "新車購入：吉。立券交易に適し、月破・長星・短星にも該当しません。";
    case "excluded_geppa":
      return "新車購入：推奨対象外。月破に該当します。";
    case "excluded_star":
      return `新車購入：推奨対象外。${p.exclusions.join("・")}が成立しています。`;
    case "mixed":
      return "新車購入：宜忌が競合しています。立券交易に宜と忌の両方があります。";
    case "bad":
      return "新車購入：推奨対象外。立券交易を忌む日です。";
    case "undetermined":
      return "新車購入：吉凶未確定。立券交易の宜忌がありません。";
  }
}

function deliverySentence(p: NewCarPartJudgment): string {
  switch (p.status) {
    case "good":
      return "納車：吉。出行に適し、月破に該当しません。";
    case "excluded_geppa":
      return "納車：推奨対象外。月破に該当します。";
    case "excluded_star":
      // 交車には長星・短星の除外を付けないため、通常は到達しない。
      return `納車：推奨対象外。${p.exclusions.join("・")}が成立しています。`;
    case "mixed":
      return "納車：宜忌が競合しています。出行に宜と忌の両方があります。";
    case "bad":
      return "納車：推奨対象外。出行を忌む日です。";
    case "undetermined":
      return "納車：吉凶未確定。出行の宜忌がありません。";
  }
}

/** 詳細表示の説明文。月破の日は購入・納車をまとめて1文にする。 */
export function describeNewCarDay(j: NewCarDayJudgment): string[] {
  if (j.buy.status === "excluded_geppa" && j.delivery.status === "excluded_geppa") {
    return ["新車購入・納車：推奨対象外。月破に該当します。"];
  }
  const lines = [buySentence(j.buy), deliverySentence(j.delivery)];
  if (j.bothGood) lines.push("購入・納車を同じ日に行うのにも適しています。");
  return lines;
}
