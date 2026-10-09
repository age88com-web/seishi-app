// src/lib/luckyDay/today.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用ユーティリティ。
//   「今日」を、ブラウザのローカルタイムゾーンではなく常に Asia/Tokyo の
//   暦日として確定する。CalendarEngine・擇日エンジン自体には一切触れない
//   （年月日時を組み立てて calculateTakujitsuFull() に渡す側のユーティリティ）。
//
// 重要:
//   Intl.DateTimeFormat の timeZone 指定で Asia/Tokyo の年月日を取得する。
//   実行環境（ブラウザ／サーバー）のローカルタイムゾーンには依存しない。
//   曜日は、得られた年月日の3値から算出する（暦日そのものの曜日はどの
//   タイムゾーンで計算しても同じ値になるため、これはタイムゾーン依存の
//   計算ではなく単純な暦計算）。

export interface TokyoToday {
  year: number;
  month: number;
  day: number;
  /** 0=日 … 6=土。 */
  weekday: number;
  /** "YYYY-MM-DD"。 */
  iso: string;
}

/** 曜日の短縮表記（日月火水木金土）。UI表示専用の定数。 */
export const WEEKDAY_JA_SHORT = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 現在時刻を Asia/Tokyo の暦日として返す。 */
export function getTodayInTokyo(): TokyoToday {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const weekday = new Date(year, month - 1, day).getDay();

  return {
    year,
    month,
    day,
    weekday,
    iso: `${map.year}-${map.month}-${map.day}`,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "YYYY-MM-DD" に日数を加算した "YYYY-MM-DD" を返す（純粋な暦計算。
 * タイムゾーン・擇日エンジンとは無関係）。「目的から吉日を探す」の
 * 検索期間の初期値（今日〜今日+30日）に使う。
 */
export function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * 2つの "YYYY-MM-DD" の間の日数（両端を含む）を返す。
 * src/lib/takujitsu/full.ts の searchTakujitsuDays() 内部の日数計算
 * （Date.UTC の差分）と同じ考え方。検索を実行する前に、一般向けの
 * 366日制限メッセージを出すためのUI側チェックにのみ使う
 * （擇日エンジン自体の計算には関与しない）。
 */
export function diffDaysInclusive(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** "YYYY-MM-DD" を {year, month, day} に分解する。 */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/**
 * "YYYY-MM-DD" の曜日（0=日…6=土）を返す（純粋な暦計算。タイムゾーンに
 * 依存しない）。「今日の吉凶」を任意の日付で表示する機能で、選択日の
 * 曜日表示に使う。
 */
export function weekdayOfIso(iso: string): number {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(year, month - 1, day).getDay();
}

/** {year, month, day} から "YYYY-MM-DD" を組み立てる（addDaysToIso等と同じ書式）。 */
export function formatIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * "YYYY-MM-DD" に暦月を加算した "YYYY-MM-DD" を返す（純粋な暦計算）。
 * 「検索期間を選ぶ」のクイックボタン（1ヶ月・3ヶ月）に使う。JavaScriptの
 * Dateの月加算（月末日のロールオーバーを含む）をそのまま使ってよい、
 * というユーザー指示（2026-09-19。例: 9/19→1ヶ月後→10/19）どおりの実装。
 */
export function addMonthsToIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return formatIso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}
