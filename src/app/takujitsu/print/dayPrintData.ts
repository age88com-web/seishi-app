// src/app/takujitsu/print/dayPrintData.ts
//
// 擇日「日付を見る」の印刷用データ（印刷専用レイアウト TakujitsuDayPrint が並べる）。
// 既存の計算結果（calculateTakujitsuFull・calculateDailyDirections・getJikaEntry）を
// 印刷の並びに集めるだけ。神殺・十二建除・二十八宿・用事判定・方位・時家・吉凶判定は一切再計算しない。
// 表記（resolution の状態名・宜忌の根拠名・時家の分類）は画面と同じ既存の表示規則に合わせる。
// 新しい解説文は作らない（説明は画面と同じ resolution 状態の定型文だけ）。
// 用事はプロ用に結果だけ：吉／吉凶混在／凶の用事名を判定別に並べる（カテゴリ・読み・根拠・中立は印刷しない）。

import type { TakujitsuFullResult, ResolvedShinsatsuEntry } from "@/lib/takujitsu";
import { ACTIVITY_DEFINITIONS } from "@/lib/takujitsu/activity";
import { getJikaEntry } from "@/lib/takujitsu/jika";
import { calculateDailyDirections } from "@/lib/takujitsu/dailyDirections";
import { classifyJikaTerm, jikaHourState } from "@/lib/takujitsu/jika/hourClassification";
import type { JikaHourState } from "@/lib/takujitsu/jika/hourClassification";

// ---- 画面と同じ表示規則（page.tsx と同じ対応表） ----
const RES_STATUS_LABEL: Record<string, string> = { active: "", cancelled: "解除", reduced: "軽減", aggravated: "増悪", pending: "保留" };
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const JIKA_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
/** 九宮の並び（左上→右下）と、方位文字列の対応（画面の方位盤 DIRECTION_TO_SLOT と同じ。「東南」「南東」は同じ位置） */
const PALACE_LAYOUT: { trigram: string; direction: string; keys: string[] }[] = [
  { trigram: "巽", direction: "南東", keys: ["東南", "南東"] },
  { trigram: "離", direction: "南", keys: ["南"] },
  { trigram: "坤", direction: "南西", keys: ["西南", "南西"] },
  { trigram: "震", direction: "東", keys: ["東"] },
  { trigram: "中", direction: "", keys: ["中宮"] },
  { trigram: "兌", direction: "西", keys: ["西"] },
  { trigram: "艮", direction: "北東", keys: ["東北", "北東"] },
  { trigram: "坎", direction: "北", keys: ["北"] },
  { trigram: "乾", direction: "北西", keys: ["西北", "北西"] },
];
/** 「23–1時」→「23:00–01:00」（区切りは同じ。表記だけ） */
const hourRangeLabel = (r: string) =>
  r.replace("時", "").split("–").map((h) => `${h.padStart(2, "0")}:00`).join("–");
const JIKA_HOUR_RANGE: Record<string, string> = {
  子: "23–1時", 丑: "1–3時", 寅: "3–5時", 卯: "5–7時", 辰: "7–9時", 巳: "9–11時",
  午: "11–13時", 未: "13–15時", 申: "15–17時", 酉: "17–19時", 戌: "19–21時", 亥: "21–23時",
};

/** 解除・軽減・増悪・保留の説明（画面の神殺の詳細表示と同じ既存の定型文。資料パスなどの開発用の note は印刷しない） */
const RES_STATUS_EXPLANATION: Partial<Record<ResolvedShinsatsuEntry["status"], (name: string) => string>> = {
  cancelled: (name) => `この日は${name}に該当しますが、解除条件が成立しているため、${name}の凶作用は解除されています。`,
  reduced: (name) => `この日は${name}に該当しますが、条件により凶作用が弱められています（軽減）。`,
  aggravated: (name) => `この日は${name}に該当し、条件により凶作用がさらに強まっています（増悪）。`,
  pending: (name) => `この日は${name}に該当しますが、条件が競合している、または資料上一意に確定できないため、最終的な処理を保留しています。`,
};

// ---- 印刷用データの型 ----
export type PrintShinsatsu = { name: string; status: string; reason: string };
/** 九宮（3×3）の1マス。上段 巽・離・坤／中段 震・中・兌／下段 艮・坎・乾 */
export type PrintPalaceCell = { trigram: string; direction: string; marks: { label: string; tone: "吉" | "凶" }[] };
export type PrintHour = {
  branch: string;
  /** 時間帯（画面の時辰別吉凶と同じ区切りを「23:00–01:00」の形で表記） */
  time: string;
  ganzhi: string;
  state: JikaHourState | "勿用";
  kichi: string[];
  kyo: string[];
  other: string[];
};
/** 判定別の用事名（正式な用事名だけ。中立は印刷しない） */
export type PrintActivityNames = { good: string[]; mixed: string[]; bad: string[]; caution: string[] };
export type TakujitsuDayPrintData = {
  date: string;
  weekday: string;
  calendar: [string, string][];
  kichijin: PrintShinsatsu[];
  kyojin: PrintShinsatsu[];
  /** 方位（九宮。左上から右下へ9マス） */
  palace: PrintPalaceCell[];
  taisuiRest: boolean;
  hours: PrintHour[];
  activities: PrintActivityNames;
  restrictions: string[];
};

/**
 * 判定別の用事名（既存の evaluations の verdict をそのまま使う。並びは ActivityDefinition の順。
 * 正式な用事名〔canonicalName〕だけで、読み・宜忌の根拠・補足は付けない。中立〔判定結果なしを含む〕は入れない）
 */
export function activityNamesByVerdict(data: TakujitsuFullResult): PrintActivityNames {
  const byId = new Map(data.activities.evaluations.map((e) => [e.activityId, e]));
  const out: PrintActivityNames = { good: [], mixed: [], bad: [], caution: [] };
  for (const def of ACTIVITY_DEFINITIONS) {
    const e = byId.get(def.id);
    const v = e?.verdict;
    // 吉で弱い神殺の忌がある用事は「（注意あり）」を付ける（判定は吉のまま）。
    if (v === "good" && e?.hasCaution) out.good.push(`${def.canonicalName}（注意あり）`);
    else if (v === "good" || v === "mixed" || v === "bad" || v === "caution") out[v].push(def.canonicalName);
  }
  return out;
}

const shinsatsu = (e: ResolvedShinsatsuEntry): PrintShinsatsu => ({
  name: e.name,
  status: RES_STATUS_LABEL[e.status] || "",
  reason: RES_STATUS_EXPLANATION[e.status]?.(e.name) ?? "",
});

export function buildTakujitsuDayPrintData(input: { date: string; time: string; timezone: string; data: TakujitsuFullResult }): TakujitsuDayPrintData {
  const { date, time, timezone, data } = input;
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAY[new Date(y, m - 1, d).getDay()];
  const c = data.calendar;
  const dayGanzhi = `${c.dayStem}${c.dayBranch}`;

  const calendar: [string, string][] = [
    ["日付", `${y}年${m}月${d}日（${weekday}）`],
    ["計算基準時刻", `${time}（${timezone}）`],
    ["干支", `${c.yearStem}${c.yearBranch}年　${c.monthStem}${c.monthBranch}月　${dayGanzhi}日　${c.hourStem}${c.hourBranch}時`],
    ["節気", c.solarTerm],
    ["農暦", c.lunarMonth != null ? `${c.isLeapMonth ? "閏" : ""}${c.lunarMonth}月${c.lunarDay ?? ""}日` : "―"],
    ["十二直（十二建除）", `${data.buildingDay.name}（${data.buildingDay.reading}）`],
    ["二十八宿", data.shuku28 ? `${data.shuku28.lodge}（${data.shuku28.reading}／${data.shuku28.shukuYo}）` : "―"],
  ];

  // 方位（日盤吉凶方位。画面の方位盤と同じ4つの値・同じ吉凶の別）
  const dir = calculateDailyDirections(dayGanzhi);
  const marks: { label: string; tone: "吉" | "凶"; value: string | null }[] = [
    { label: "喜神", tone: "吉", value: dir.xishen },
    { label: "財神", tone: "吉", value: dir.caishen },
    { label: "太歳遊方", tone: "凶", value: dir.taisui },
    { label: "五鬼", tone: "凶", value: dir.wugui },
  ];
  const palace: PrintPalaceCell[] = PALACE_LAYOUT.map((c) => ({
    trigram: c.trigram,
    direction: c.direction,
    marks: marks.filter((mk) => mk.value && c.keys.includes(mk.value)).map((mk) => ({ label: mk.label, tone: mk.tone })),
  }));

  // 時間（時家。12時辰すべて。画面の時辰別吉凶と同じ表引き・同じ分類）
  const hours: PrintHour[] = JIKA_BRANCHES.map((b) => {
    const entry = getJikaEntry(dayGanzhi, b);
    const terms = entry?.normalizedTerms ?? [];
    const kichi = terms.filter((t) => classifyJikaTerm(t) === "吉");
    const kyo = terms.filter((t) => classifyJikaTerm(t) === "凶");
    const other = terms.filter((t) => classifyJikaTerm(t) === "独立");
    return {
      branch: b,
      time: hourRangeLabel(JIKA_HOUR_RANGE[b]),
      ganzhi: entry?.hourGanzhi ?? "―",
      state: entry?.isMuyo ? "勿用" : jikaHourState(kichi.length, kyo.length),
      kichi,
      kyo,
      other,
    };
  });

  const activities = activityNamesByVerdict(data);

  return {
    date,
    weekday,
    calendar,
    kichijin: data.resolution.kichijin.map(shinsatsu),
    kyojin: data.resolution.kyojin.map(shinsatsu),
    palace,
    taisuiRest: !dir.taisui,
    hours,
    activities,
    restrictions: data.activities.unresolvedRestrictions.map(
      (r) => `${r.sourceName}（${RES_STATUS_LABEL[r.resolutionStatus] || r.resolutionStatus}）：${r.description}`,
    ),
  };
}
