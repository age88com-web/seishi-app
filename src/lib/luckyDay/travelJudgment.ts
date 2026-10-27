// src/lib/luckyDay/travelJudgment.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の「海外旅行・観光の吉日」専用の判定層。
//   既存の擇日エンジン（calculateTakujitsuFull の結果）を読むだけで、
//   宜忌・resolution・verdict は一切変更しない。ここで加える除外は
//   この機能の表示にだけ使い、エンジンへは戻さない。
//
// 判定方式（監修決定、2026-10-27。研究記録 docs/takujitsu-travel-day-research.md）:
//   信發堂の掲載日を再現するものではなく、原典の宜忌と既存エンジンを使う独自の選日方式。
//   ・旅行出発＝遠行：月破でない かつ 歸忌でない かつ 往亡でない かつ 遠行＝good
//   ・月破・歸忌・往亡は「成立」（resolution 前の shinsatsu.kyojin）で判定し、
//     吉神の併臨や resolution の軽減・解除・増悪の結果で除外を外さない。
//   ・出行とは統合しない（遠行だけを見る）。天馬・驛馬は必須条件にしない。
//   ・選日の対象は旅行の出発日（旅行期間中の各日は判定しない）。
//
// 状態は内部で別々に保持する（画面の記号は「—」が共通でも、凶と追加除外は区別する）。
//   good=吉日 / mixed=宜忌が競合 / bad=凶 / undetermined=宜忌なし（吉凶未確定）
//   excluded=月破・歸忌・往亡により推奨対象外

import type { TakujitsuFullResult } from "@/lib/takujitsu";
import type { ActivityEvaluation, ActivityVerdict } from "@/lib/takujitsu/activity";
import type { PersonalTakujitsuResult } from "@/lib/takujitsu/personal";
import { splitSources } from "./newCarJudgment";
import type { NewCarFollowerView, NewCarSourceView } from "./newCarJudgment";

export const TRAVEL_ACTIVITY_ID = "遠行";

/** 旅行専用の必須除外（既存エンジンの忌とは別に保持する）。表示順もこの順。 */
export const TRAVEL_EXCLUSION_NAMES = ["月破", "歸忌", "往亡"] as const;
export type TravelExclusion = (typeof TRAVEL_EXCLUSION_NAMES)[number];

export type TravelStatus = "good" | "mixed" | "bad" | "undetermined" | "excluded";

export interface TravelDayFacts {
  dateIso: string;
  /** 0=日 … 6=土。 */
  weekday: number;
  dayStem: string;
  dayBranch: string;
  /** その日に成立した凶神（resolution 前）。 */
  kyojin: readonly string[];
  evaluations: readonly ActivityEvaluation[];
}

export interface TravelDayJudgment {
  dateIso: string;
  weekday: number;
  dayStem: string;
  dayBranch: string;
  status: TravelStatus;
  /** 既存エンジンの遠行の最終判定（変更しない）。 */
  baseVerdict: ActivityVerdict;
  /** 遠行の宜忌の直接の根拠（六黄道・六黒道の追従分を含まない）。 */
  positiveSources: NewCarSourceView[];
  negativeSources: NewCarSourceView[];
  positiveFollowers: NewCarFollowerView[];
  negativeFollowers: NewCarFollowerView[];
  /** 旅行専用の必須除外に該当したもの（空なら追加除外なし）。 */
  exclusions: TravelExclusion[];
}

/** エンジンの事実（成立凶神・用事判定）から、旅行出発日を判定する。 */
export function judgeTravelFromFacts(facts: TravelDayFacts): TravelDayJudgment {
  const exclusions = TRAVEL_EXCLUSION_NAMES.filter((n) => facts.kyojin.includes(n));
  const e = facts.evaluations.find((x) => x.activityId === TRAVEL_ACTIVITY_ID);
  const baseVerdict: ActivityVerdict = e?.verdict ?? "neutral";
  const status: TravelStatus =
    exclusions.length > 0 ? "excluded" : baseVerdict === "neutral" ? "undetermined" : baseVerdict;
  const pos = splitSources(e?.positiveSources ?? [], true);
  const neg = splitSources(e?.negativeSources ?? [], false);
  return {
    dateIso: facts.dateIso,
    weekday: facts.weekday,
    dayStem: facts.dayStem,
    dayBranch: facts.dayBranch,
    status,
    baseVerdict,
    positiveSources: pos.direct,
    negativeSources: neg.direct,
    positiveFollowers: pos.followers,
    negativeFollowers: neg.followers,
    exclusions,
  };
}

/** calculateTakujitsuFull() の結果1日分から判定する。 */
export function judgeTravelDay(dateIso: string, weekday: number, result: TakujitsuFullResult): TravelDayJudgment {
  return judgeTravelFromFacts({
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

export const TRAVEL_STATUS_SYMBOL: Readonly<Record<TravelStatus, string>> = {
  good: "◎",
  mixed: "△",
  bad: "—",
  excluded: "—",
  undetermined: "？",
};

export const TRAVEL_STATUS_LABEL: Readonly<Record<TravelStatus, string>> = {
  good: "吉日",
  mixed: "宜忌が競合",
  bad: "凶",
  excluded: "推奨対象外",
  undetermined: "吉凶未確定",
};

/** 一覧の記号の横に添える短い理由（追加除外のときだけ）。 */
export function travelStatusTag(j: TravelDayJudgment): string | null {
  return j.status === "excluded" ? j.exclusions.join("・") : null;
}

// ---------------------------------------------------------------------------
// 個人の忌日（有料会員が生年月日を入れたときだけ。2026-10-27）。
// 個人判定そのものは既存の computePersonalResultForDay()（evaluatePersonalForBirth）の結果を
// そのまま受け取り、ここでは計算しない。判定順は ①遠行 ②月破・歸忌・往亡 ③個人の忌日。
// 個人の忌日（status "avoid"）は吉日を推奨対象外にするだけで、他の日を吉日へ繰り上げない。
// 一般の旅行判定（TravelDayJudgment.status）は書き換えず、表示用の状態を別に返す。
// ---------------------------------------------------------------------------

/** 一覧に出す状態。personal_excluded＝一般には吉日だが、個人の忌日のため推奨対象外。 */
export type TravelDisplayStatus = TravelStatus | "personal_excluded";

export function travelDisplayStatus(j: TravelDayJudgment, personal: PersonalTakujitsuResult | null): TravelDisplayStatus {
  return j.status === "good" && personal?.status === "avoid" ? "personal_excluded" : j.status;
}

export const TRAVEL_DISPLAY_SYMBOL: Readonly<Record<TravelDisplayStatus, string>> = {
  ...TRAVEL_STATUS_SYMBOL,
  personal_excluded: "—",
};

export const TRAVEL_DISPLAY_LABEL: Readonly<Record<TravelDisplayStatus, string>> = {
  ...TRAVEL_STATUS_LABEL,
  personal_excluded: "個人の忌日により推奨対象外",
};

/** 一覧の記号の横に添える短い理由（必須除外の神殺名と、個人の忌日）。 */
export function travelDisplayTag(j: TravelDayJudgment, personal: PersonalTakujitsuResult | null): string | null {
  const parts: string[] = [...(j.status === "excluded" ? j.exclusions : [])];
  if (personal?.status === "avoid") parts.push("個人忌日");
  return parts.length > 0 ? parts.join("・") : null;
}

/** 個人の忌日についての説明文（生年月日が未登録・判定なしのときは null）。 */
export function describeTravelPersonal(j: TravelDayJudgment, personal: PersonalTakujitsuResult | null): string | null {
  if (!personal) return null;
  if (personal.status === "avoid") {
    const reasons = personal.reasons.map((r) => r.type).join("・");
    return j.status === "good"
      ? `本人には避けたい日（${reasons}）のため、旅行の出発には推奨しません。`
      : `本人には避けたい日（${reasons}）にもあたります。`;
  }
  if (personal.status === "clear") return "この生年月日による個人の忌日には該当しません。";
  return "この生年月日では個人の忌日を判定できません。";
}

/** 詳細表示の説明文。 */
export function describeTravelDay(j: TravelDayJudgment): string {
  switch (j.status) {
    case "good":
      return "旅行の出発：吉。遠行に適し、月破・歸忌・往亡にも該当しません。";
    case "excluded":
      return `旅行の出発：推奨対象外。${j.exclusions.join("・")}に該当します。`;
    case "mixed":
      return "旅行の出発：宜忌が競合しています。遠行に宜と忌の両方があります。";
    case "bad":
      return "旅行の出発：推奨対象外。遠行を忌む日です。";
    case "undetermined":
      return "旅行の出発：吉凶未確定。遠行の宜忌がありません。";
  }
}
