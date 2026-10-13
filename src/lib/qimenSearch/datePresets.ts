// src/lib/qimenSearch/datePresets.ts
//
// 役割:
//   /qimen/search の期間プリセット（第3段階）。開始日・終了日入力欄へ
//   反映する日付文字列を計算するだけの純粋な日付計算層。
//   検索ロジック（searchEngine.ts）・排盤ロジックには一切関与しない。
//
// 現在日:
//   ブラウザのローカル日付（new Date() の年月日）をそのまま使う。時刻は見ない。
//
// 月末・うるう年の扱い:
//   「Nか月後」は暦月を進めた上で、その月に該当日が存在しない場合は
//   その月の末日にクランプする（例: 1/31 の1か月後 → 2/28 または 2/29。
//   3/3 のような日付の繰り上がりにはしない）。うるう年の 2/29 も
//   daysInMonth() が Date(y, m, 0) から実際の月末日を取得するため自然に扱える。
//   「1週間」は暦日を 7 日進めるだけ（月をまたいでも Date の日加算に任せる）。

export type QimenSearchPresetId = "today" | "tomorrow" | "1w" | "1m" | "3m" | "6m" | "1y";

export interface QimenSearchPresetRange {
  startDate: string;
  endDate: string;
}

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function pad(x: number): string {
  return String(x).padStart(2, "0");
}

function toIso(v: Ymd): string {
  return `${v.y}-${pad(v.m)}-${pad(v.d)}`;
}

function todayYmd(): Ymd {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

/** y年m月(1-12)の末日。Date(y, m, 0) は m月(1-based)の前日 = m月自身の末日になる。 */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function addDays(base: Ymd, days: number): Ymd {
  const d = new Date(base.y, base.m - 1, base.d);
  d.setDate(d.getDate() + days);
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

/** 暦月を months だけ進める。該当日が存在しない月はその月の末日にクランプする。 */
function addMonthsClamped(base: Ymd, months: number): Ymd {
  const totalMonthIndex = base.y * 12 + (base.m - 1) + months;
  const y = Math.floor(totalMonthIndex / 12);
  const m = (totalMonthIndex % 12) + 1;
  return { y, m, d: Math.min(base.d, daysInMonth(y, m)) };
}

export const QIMEN_SEARCH_PRESETS: readonly { id: QimenSearchPresetId; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "tomorrow", label: "明日" },
  { id: "1w", label: "1週間" },
  { id: "1m", label: "1か月" },
  { id: "3m", label: "3か月" },
  { id: "6m", label: "半年" },
  { id: "1y", label: "1年" },
];

/** 指定プリセットの開始日・終了日（"YYYY-MM-DD"）を、ブラウザのローカル日付から計算する。 */
export function resolvePreset(id: QimenSearchPresetId): QimenSearchPresetRange {
  const today = todayYmd();
  switch (id) {
    case "today":
      return { startDate: toIso(today), endDate: toIso(today) };
    case "tomorrow": {
      const t = addDays(today, 1);
      return { startDate: toIso(t), endDate: toIso(t) };
    }
    case "1w":
      return { startDate: toIso(today), endDate: toIso(addDays(today, 7)) };
    case "1m":
      return { startDate: toIso(today), endDate: toIso(addMonthsClamped(today, 1)) };
    case "3m":
      return { startDate: toIso(today), endDate: toIso(addMonthsClamped(today, 3)) };
    case "6m":
      return { startDate: toIso(today), endDate: toIso(addMonthsClamped(today, 6)) };
    case "1y":
      return { startDate: toIso(today), endDate: toIso(addMonthsClamped(today, 12)) };
  }
}
