// src/lib/takujitsu/shinsatsu/doyo.ts
//
// 役割:
//   31）土王用事（土用）の「期間」を太陽黄経から求める。
//   凶神第5グループ（kyoushinGroup5.ts）の土王用事判定だけが使う。
//
// 正式仕様（2026-10-24 人間側決定。旧「四立の18日前の1日」判定は廃止）:
//   ・土王用事は土用入りから次の四立までの期間とする。
//   ・土用入り・四立は日数ではなく太陽黄経で決める。
//       冬土用 297° → 立春 315°
//       春土用  27° → 立夏  45°
//       夏土用 117° → 立秋 135°
//       秋土用 207° → 立冬 225°
//     期間は [土用入りの瞬間, 四立の瞬間)（四立の瞬間は含まない）。
//   ・土用間日は導入しない（採用資料に根拠が確認できていないため）。
//   ・No.13a「土旺」とは結び付けない（別途資料確認のうえ決定）。
//   根拠資料: docs/source/擇日テキスト.pdf p.34「31）土王用事（土用）」。
//
// 太陽黄経の定義:
//   CalendarEngine（src/lib/calendar/solarTerm.ts）と同じ太陽の視黄経。
//   節入り時刻と同じ定義・同じ二分法（findSolarTermCrossing）を使うため、
//   土用入り・四立の時刻は節気の節入り時刻と同一基準になる。
//
// 時刻と日単位（2026-10-24 正式仕様。八節日の「節入り暦日は新しい節の日」の扱いには合わせない）:
//   ・resolveDoyoPeriodAt() / resolveDoyoAt() は瞬間単位で判定し、土用入り・四立の
//     正確な時刻を DoyoPeriod として返す。時刻を指定する機能は、行為開始時刻で
//     これを使う（例: 2026-11-07 18:51 は土用中、18:53 は土用外）。
//   ・resolveDoyoDayStatus() は日単位の区分。土用入り日・四立日を一日まるごと
//     同じ状態にせず、現地の [当日0:00, 翌日0:00) と土用期間の重なりで
//       土用外 / 土用入り日（途中から土用） / 土用中 / 土用明け日（四立日、途中まで土用）
//     を返す。
//   ・時刻を指定しない擇日（kyoushinGroup5 の土王用事）は、その日の一部でも
//     土用期間に入っていれば（土用外以外）土王用事を成立させる。

import { calculate as calculateCalendar, DEFAULT_TIMEZONE, findSolarTermCrossing } from "@/lib/calendar";
import type { CalendarInput } from "@/lib/calendar";

const MS_PER_DAY = 86_400_000;

export type DoyoSeason = "冬" | "春" | "夏" | "秋";

interface DoyoDef {
  season: DoyoSeason;
  /** 土用入りの太陽黄経。 */
  startLongitude: number;
  /** 土用明け（次の四立）の太陽黄経。 */
  endLongitude: number;
  /** 土用明けとなる四立の名称。 */
  endTerm: "立春" | "立夏" | "立秋" | "立冬";
}

const DOYO_DEFS: readonly DoyoDef[] = [
  { season: "冬", startLongitude: 297, endLongitude: 315, endTerm: "立春" },
  { season: "春", startLongitude: 27, endLongitude: 45, endTerm: "立夏" },
  { season: "夏", startLongitude: 117, endLongitude: 135, endTerm: "立秋" },
  { season: "秋", startLongitude: 207, endLongitude: 225, endTerm: "立冬" },
];

/** 土用期間（[start, end)）。時刻は UTC の ISO 8601 文字列。 */
export interface DoyoPeriod {
  season: DoyoSeason;
  startLongitude: number;
  endLongitude: number;
  endTerm: DoyoDef["endTerm"];
  /** 土用入り（太陽黄経 startLongitude に達した瞬間）。 */
  start: string;
  /** 土用明け＝次の四立の節入り（太陽黄経 endLongitude に達した瞬間）。期間に含まない。 */
  end: string;
}

/**
 * 瞬間 utc（その瞬間の太陽視黄経 sunLongitude）が土用期間内なら、その期間を返す。
 * 期間外なら null。sunLongitude は CalendarEngine の calculate() が返す値を渡す。
 */
export function resolveDoyoPeriodAt(utc: Date, sunLongitude: number): DoyoPeriod | null {
  const def = DOYO_DEFS.find((d) => {
    const sinceStart = (((sunLongitude - d.startLongitude) % 360) + 360) % 360;
    return sinceStart < d.endLongitude - d.startLongitude;
  });
  if (!def) return null;

  // 対象瞬間は土用入りから18°以内（約19日以内）なので、直前の土用入りを確実に求められる。
  const start = findSolarTermCrossing(utc, def.startLongitude);
  // 黄経18°は約18〜19日。土用入り+25日を上端にすれば、その直前の四立を求められる。
  const end = findSolarTermCrossing(new Date(start.getTime() + 25 * MS_PER_DAY), def.endLongitude);

  return {
    season: def.season,
    startLongitude: def.startLongitude,
    endLongitude: def.endLongitude,
    endTerm: def.endTerm,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * 時刻指定用。input の年月日時分秒（timezone 基準）の瞬間が土用期間内なら、その期間を返す。
 */
export function resolveDoyoAt(input: CalendarInput): DoyoPeriod | null {
  const cal = calculateCalendar(input);
  return resolveDoyoPeriodAt(new Date(cal.utc), cal.sunLongitude);
}

/** 日単位の土用区分。 */
export type DoyoDayKind = "土用外" | "土用入り日" | "土用中" | "土用明け日";

export interface DoyoDayStatus {
  kind: DoyoDayKind;
  /** 当日に重なる土用期間（土用外なら null）。土用入り・四立の正確な時刻を持つ。 */
  period: DoyoPeriod | null;
}

/** 対象暦日（Y/M/D）を deltaDays 日ずらした暦日。 */
function shiftYmd(year: number, month: number, day: number, deltaDays: number) {
  const t = new Date(Date.UTC(year, month - 1, day) + deltaDays * MS_PER_DAY);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

// 日単位区分のメモ化（期間検索で同じ暦日が繰り返し要求されるため）。
// 結果は (year, month, day, timezone) だけで決まる（0:00 固定、太陽黄経は観測地に依存しない）。
const DOYO_DAY_CACHE = new Map<string, DoyoDayStatus>();

/**
 * 対象暦日（input.year/month/day、timezone 基準）の土用区分を返す。
 * 現地の当日0:00〜翌日0:00（翌日0:00は含まない）と土用期間 [土用入り, 四立) の
 * 重なりで判定する。input の時・分・秒は使わない（日柱の子初23:00切替とも無関係）。
 */
export function resolveDoyoDayStatus(input: CalendarInput): DoyoDayStatus {
  const timeZone = input.timezone ?? DEFAULT_TIMEZONE;
  const cacheKey = `${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}|${timeZone}`;
  const cached = DOYO_DAY_CACHE.get(cacheKey);
  if (cached) return cached;

  const dayStart = calculateCalendar({ ...input, hour: 0, minute: 0, second: 0 });
  const next = shiftYmd(input.year, input.month, input.day, 1);
  const nextStart = calculateCalendar({ ...input, ...next, hour: 0, minute: 0, second: 0 });
  const ds = new Date(dayStart.utc);
  const de = new Date(nextStart.utc);

  // 土用期間は約18日あるため、1日の中に収まることはない。当日に重なる期間は
  // 当日0:00 か 翌日0:00 のどちらかを含む。
  const period =
    resolveDoyoPeriodAt(ds, dayStart.sunLongitude) ?? resolveDoyoPeriodAt(de, nextStart.sunLongitude);

  let status: DoyoDayStatus;
  if (!period) {
    status = { kind: "土用外", period: null };
  } else {
    const start = new Date(period.start).getTime();
    const end = new Date(period.end).getTime();
    if (start > ds.getTime()) status = { kind: "土用入り日", period };
    else if (end < de.getTime()) status = { kind: "土用明け日", period };
    else status = { kind: "土用中", period };
  }

  if (DOYO_DAY_CACHE.size >= 4096) DOYO_DAY_CACHE.clear();
  DOYO_DAY_CACHE.set(cacheKey, status);
  return status;
}
