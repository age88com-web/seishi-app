// src/app/takujitsu/print/candidatePrintData.ts
//
// 擇日「良い日を探す」の候補日印刷（一覧表）の印刷用データ。
// 候補日＝期間検索の結果（searchTakujitsuDays）のうち、選んだ用途の判定が 吉・吉凶混在 の日（従来の候補日印刷と同じ）。
// 各候補日について、期間検索と同じ基準時刻で既存の calculateTakujitsuFull を呼び、
// 吉神・凶神・全用事の判定・日盤吉凶方位・時家（12時辰）を集めるだけ。判定・順位は再計算・変更しない（日付昇順のまま）。

import { calculateTakujitsuFull } from "@/lib/takujitsu";
import type { TakujitsuSearchResult } from "@/lib/takujitsu";
import type { ActivityVerdict } from "@/lib/takujitsu/activity";
import { calculateDailyDirections } from "@/lib/takujitsu/dailyDirections";
import { getJikaEntry } from "@/lib/takujitsu/jika";
import { classifyJikaTerm, jikaHourState } from "@/lib/takujitsu/jika/hourClassification";
import { activityNamesByVerdict, type PrintActivityNames } from "./dayPrintData";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const VERDICT_LABEL: Record<ActivityVerdict, string> = { good: "吉", bad: "凶", mixed: "吉凶混在", caution: "注意", neutral: "中立" };
const RES_STATUS_LABEL: Record<string, string> = { active: "", cancelled: "解除", reduced: "軽減", aggravated: "増悪", pending: "保留" };
const JIKA_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

export type CandidateDay = {
  date: string;
  weekday: string;
  dayGanzhi: string;
  buildingDay: string;
  shuku28: string;
  /** 選んだ用途のこの日の判定（期間検索の verdict のまま） */
  verdict: ActivityVerdict;
  verdictLabel: string;
  /** 吉神・凶神（解除などの状態は［解除］のように付ける） */
  kichijin: string[];
  kyojin: string[];
  activities: PrintActivityNames;
  /** 吉方位（日盤の喜神・財神。画面の方位盤と同じ値） */
  goodDirections: string[];
  /** 吉時（時家で「吉神のみ」の時辰。画面の時辰別吉凶と同じ分類） */
  goodHours: string[];
};

export type TakujitsuCandidatePrintData = {
  activityName: string;
  period: string;
  baseTime: string;
  counts: { good: number; mixed: number };
  days: CandidateDay[];
};

export function buildTakujitsuCandidatePrintData(input: {
  search: TakujitsuSearchResult;
  activityName: string;
  timezone: string;
}): TakujitsuCandidatePrintData {
  const { search, activityName, timezone } = input;
  const { hour, minute } = search.baseTime;
  const candidates = search.days.filter((d) => d.verdict === "good" || d.verdict === "mixed");
  const days: CandidateDay[] = candidates.map((d) => {
    const full = calculateTakujitsuFull({ year: d.year, month: d.month, day: d.day, hour, minute, timezone });
    const dayGanzhi = `${d.dayStem}${d.dayBranch}`;
    const dir = calculateDailyDirections(dayGanzhi);
    const goodHours = JIKA_BRANCHES.filter((b) => {
      const terms = getJikaEntry(dayGanzhi, b)?.normalizedTerms ?? [];
      const entry = getJikaEntry(dayGanzhi, b);
      if (entry?.isMuyo) return false;
      const k = terms.filter((t) => classifyJikaTerm(t) === "吉").length;
      const x = terms.filter((t) => classifyJikaTerm(t) === "凶").length;
      return jikaHourState(k, x) === "吉神のみ";
    }).map((b) => `${b}`);
    const mark = (e: { name: string; status: string }) => (RES_STATUS_LABEL[e.status] ? `${e.name}［${RES_STATUS_LABEL[e.status]}］` : e.name);
    return {
      date: `${d.year}/${pad(d.month)}/${pad(d.day)}`,
      weekday: WEEKDAY[d.weekday],
      dayGanzhi,
      buildingDay: d.buildingDay,
      shuku28: d.shuku28 ?? "―",
      verdict: d.verdict,
      verdictLabel: VERDICT_LABEL[d.verdict],
      kichijin: full.resolution.kichijin.map(mark),
      kyojin: full.resolution.kyojin.map(mark),
      activities: activityNamesByVerdict(full),
      goodDirections: [`喜神 ${dir.xishen}`, `財神 ${dir.caishen}`],
      goodHours,
    };
  });
  const f = search.from;
  const t = search.to;
  return {
    activityName,
    period: `${f.year}年${f.month}月${f.day}日 〜 ${t.year}年${t.month}月${t.day}日`,
    baseTime: `${pad(hour)}:${pad(minute)}`,
    counts: { good: days.filter((d) => d.verdict === "good").length, mixed: days.filter((d) => d.verdict === "mixed").length },
    days,
  };
}
