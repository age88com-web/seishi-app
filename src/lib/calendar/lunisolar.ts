// src/lib/calendar/lunisolar.ts
//
// 役割:
//   農暦（太陰太陽暦）。月境界＝朔、月番号は中気の有無で確定し、中気を
//   含まない月を閏月とする（無中気置閏法）。
//
//   今回のスコープは擇日の天願・季分が必要とする lunarMonth・lunarDay・
//   isLeapMonth のみ。lunarYear は今回実装しない（非破壊で後日追加できる
//   設計。下記コメント参照）。
//
// 唯一の仕様根拠:
//   本サブシステムは特定のPDFではなく、ユーザーが設計依頼メッセージ内で
//   明示した原則（月境界＝朔／月番号決定には中気を使う／中気を含まない
//   月を閏月とする、という無中気置閏法）をそのまま実装したものである。
//   具体的な暦法アルゴリズムを一般知識だけで推測して埋めた部分はない。
//
// 既存資産の再利用（新規計算を増やさない）:
//   ・src/lib/astro.ts の sunLonDeg / moonLonDeg … 太陽・月の黄経（既存、無変更）
//   ・src/lib/calendar/solarTerm.ts の findSolarTermCrossing … 中気（太陽黄経が
//     30°刻みに達する瞬間）の探索にそのまま流用する。中気か節かは
//     src/lib/calendar/types.ts の SOLAR_TERMS（kind:"中"）が既に持っている
//     データを使うだけで、新たに判定ロジックを作っていない。
//   ・kakkyoku_engine.ts の isNewMoon()/isFullMoon() 等（±3°の瞬間判定、
//     七政四餘の格局判定専用）は使用しない。朔の瞬間を厳密に特定する
//     ための新規の二分法（findNewMoonCrossing）をこのファイルに実装する
//     （findSolarTermCrossing と同型のアルゴリズムだが、対象が太陽黄経では
//     なく月と太陽の離角であるため、別関数として新規に書く）。
//
// 日境界について（重要）:
//   農暦日（lunarDay）の切替は、日柱の子初23:00ルール（src/lib/calendar/eto.ts
//   の civilJdn）とは別物であり、流用しない。本ファイルでは「朔が発生した
//   瞬間の、CalendarInput.timezone における暦日」を初一とし、以後その
//   タイムゾーンの現地0:00ごとに1日進める（24時間経過ではなく、暦日の
//   差分で数える）。
//   月の所属・中気の所属・冬至の月も同じく暦日で判定する（月＝朔日〜次の
//   朔日の前日。朔の当日は朔の時刻より前でもその月の初一。中気は発生した
//   暦日がこの範囲に入る月に属する）。
//
// 置閏:
//   冬至を含む月（十一月）から次の冬至を含む月の直前までが13ヶ月の年だけ、
//   中気を含まない最初の1ヶ月を閏月とする（1年に閏月は多くても1回）。
//
// 検証（2026-09-27）:
//   ・香港天文台 換算表（tests/lunisolar_unit.manual.ts）156/156
//   ・『紫微斗数入門』新暦旧暦換算早見表（1926〜2000年、各月1日）900点：
//     timezone=Asia/Shanghai で月番号900/900・月日894/900、Asia/Tokyo で月日867/900。
//     1995年は閏八月（9/25〜）になる。
//
// 暦法の拡張点について:
//   LunisolarConfig.method は現時点では "定気"（実視黄経、sunLonDeg/moonLonDeg
//   がそのまま提供する方式）のみを型として許可する。"平気"（太陽の平均運動で
//   節気を等間隔に定める旧方式）は未実装であり、型にも含めない。将来の
//   暦法差異に備え、LunisolarConfig という設定オブジェクトを受け取る形だけを
//   先に用意しておく。
//
// lunarYear を後日追加する際の設計上の担保:
//   月番号確定処理は「冬至を含む朔望月」を基準点（アンカー）として月を
//   ナンバリングする。このアンカーの朔の瞬間を lunarYear 導入時にそのまま
//   使えるため、月番号確定ロジックの再設計は不要になる（今回は
//   winterSolsticeAnchorNewMoon を関数内のローカル変数に留め、公開しない）。

import { sunLonDeg, moonLonDeg } from "../astro";
import { SOLAR_TERMS } from "./types";
import { findSolarTermCrossing } from "./solarTerm";

const MS_PER_DAY = 86_400_000;
/** 朔望月の平均日数（探索窓のガードに使うだけで、精度そのものには影響しない）。 */
const SYNODIC_MONTH_DAYS = 29.53059;

/** 中気の太陽黄経一覧（0, 30, 60, ..., 330 の12個）。SOLAR_TERMS の kind:"中" から取得。 */
const ZHONGQI_LONGITUDES: readonly number[] = SOLAR_TERMS
  .filter((t) => t.kind === "中")
  .map((t) => t.longitude);

/**
 * 中気（太陽黄経30°刻み）ごとのおおよその新暦月日。findSolarTermCrossing への
 * 橋渡しプローブの起点としてのみ使う。
 *
 * findSolarTermCrossing は「before 以前」の通過しか探さない。実際の中気が
 * この月日より後に来る年（例: 1995年の小雪 11/22 18:53Z）にこの月日を
 * そのまま before に渡すと、通過を挟めず二分法が before 自身に張り付き、
 * 偽の中気を返してしまう。そのため実際のプローブは「この月日＋
 * ZHONGQI_PROBE_OFFSET_DAYS」とし、必ず実際の中気より後から遡って探す
 * （zhongqiCandidatesNearYear）。
 * src/lib/calendar/eto.ts の lichunInstant が「3/1」（立春より十分後）を
 * 立春探索の起点にしているのと同じ考え方。
 */
const ZHONGQI_SEED_MONTH_DAY: Record<number, readonly [number, number]> = {
  270: [12, 22], // 冬至
  300: [1, 20], // 大寒
  330: [2, 19], // 雨水
  0: [3, 20], // 春分
  30: [4, 20], // 穀雨
  60: [5, 21], // 小満
  90: [6, 21], // 夏至
  120: [7, 23], // 大暑
  150: [8, 23], // 処暑
  180: [9, 23], // 秋分
  210: [10, 23], // 霜降
  240: [11, 22], // 小雪
};

function norm360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

/** lon と boundary の差を (-180, 180] の符号付き角度で返す（solarTerm.ts と同じ考え方）。 */
function signedDelta(lon: number, boundary: number): number {
  return ((lon - boundary + 540) % 360) - 180;
}

/** 月黄経－太陽黄経（離角、0..360）。360°で1周＝1朔望月。 */
function elongationDeg(d: Date): number {
  return norm360(moonLonDeg(d) - sunLonDeg(d));
}

/** 離角の平均変化率（度/日）。窓の初期推定にのみ使う（精度そのものは二分法が担保する）。 */
const AVG_ELONGATION_RATE_PER_DAY = 360 / SYNODIC_MONTH_DAYS;

/**
 * before 以前で最も近い、朔（離角が0°に達する瞬間）を二分法で求める（UTC）。
 *
 * 太陽黄経の節気探索（findSolarTermCrossing）と違い、離角は約29.53日で
 * 360°一周してしまう（節気は約365日で一周）。そのため探索窓を節気と同じ
 * 「対象周期に対して十分広い日数」で取ると、1周期を超えて折り返し
 * （signedDelta の不連続点）をまたいでしまい二分法が破綻する。
 * ここでは平均角速度から「直近の朔からの経過日数」を概算し、その概算値を
 * 中心にした狭い窓（前後5日、周期の1/2=約14.8日より十分狭い）で
 * ブラケットしてから二分法を行う。
 */
export function findNewMoonCrossing(before: Date): Date {
  const beforeMs = before.getTime();
  const estimatedDaysSinceNewMoon = elongationDeg(before) / AVG_ELONGATION_RATE_PER_DAY;
  const estimateMs = beforeMs - estimatedDaysSinceNewMoon * MS_PER_DAY;

  let loMs = estimateMs - 5 * MS_PER_DAY;
  let hiMs = Math.min(estimateMs + 5 * MS_PER_DAY, beforeMs);

  let guard = 0;
  while (signedDelta(elongationDeg(new Date(loMs)), 0) >= 0 && guard < 6) {
    loMs -= MS_PER_DAY;
    guard += 1;
  }
  guard = 0;
  while (signedDelta(elongationDeg(new Date(hiMs)), 0) < 0 && guard < 6 && hiMs < beforeMs) {
    hiMs = Math.min(hiMs + MS_PER_DAY, beforeMs);
    guard += 1;
  }

  for (let i = 0; i < 60; i += 1) {
    const midMs = (loMs + hiMs) / 2;
    const g = signedDelta(elongationDeg(new Date(midMs)), 0);
    if (g < 0) {
      loMs = midMs;
    } else {
      hiMs = midMs;
    }
    if (hiMs - loMs < 1) break; // 1ms 精度
  }

  return new Date(Math.round((loMs + hiMs) / 2));
}

/** target 以降で最初に来る朔を求める（findNewMoonCrossing を逆向きに使うだけ）。 */
function findNextNewMoon(after: Date): Date {
  const probe = new Date(after.getTime() + (SYNODIC_MONTH_DAYS + 3) * MS_PER_DAY);
  return findNewMoonCrossing(probe);
}

/**
 * 中気の実際の瞬間より後にプローブを置くための日数。中気の実際の月日は
 * ZHONGQI_SEED_MONTH_DAY から±2日程度しかずれないため、15日後のプローブは
 * 必ず実際の中気より後になり、かつ findSolarTermCrossing の初期窓（30日）の
 * 中に実際の中気が入る（前後の別の中気（約30日間隔）を拾うこともない）。
 */
const ZHONGQI_PROBE_OFFSET_DAYS = 15;

/**
 * findSolarTermCrossing への橋渡し関数（findSolarTermCrossing 自体は無変更）。
 *
 * findSolarTermCrossing は「対象角度の近く（既存の呼び出し元はいずれも
 * 数日〜数週間以内）」から呼ぶ前提で、30日の初期窓＋20日刻みのガード
 * （最大150日）しか持たない。太陽黄経は約365日で1周するため、対象の中気の
 * 実際の瞬間から180日以上離れた地点から呼ぶと、符号付き差分が周期の
 * 折り返し（エイリアシング）を起こし、まったく無関係な瞬間に収束する
 * （実際に発生を確認済み）。
 *
 * そこで、対象の中気 lon について「前年・当年・翌年」のおおよその新暦月日
 * （ZHONGQI_SEED_MONTH_DAY）の ZHONGQI_PROBE_OFFSET_DAYS 日後をプローブにして、
 * 必ず「実際の中気より少し後」の近距離から findSolarTermCrossing を呼ぶ。
 */
function zhongqiCandidatesNearYear(referenceYear: number, lon: number): Date[] {
  const [month, day] = ZHONGQI_SEED_MONTH_DAY[lon];
  return [referenceYear - 1, referenceYear, referenceYear + 1].map((y) =>
    findSolarTermCrossing(new Date(Date.UTC(y, month - 1, day + ZHONGQI_PROBE_OFFSET_DAYS, 12)), lon),
  );
}

/** timeZone ごとの Intl.DateTimeFormat（暦日変換を繰り返すためキャッシュする）。 */
const civilDateFormatters = new Map<string, Intl.DateTimeFormat>();

/** [year, month, day]（対象タイムゾーンでの暦日）を返す。 */
function civilDateParts(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  let dtf = civilDateFormatters.get(timeZone);
  if (dtf === undefined) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    civilDateFormatters.set(timeZone, dtf);
  }
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return { year: map.year, month: map.month, day: map.day };
}

/** 瞬間を、timeZone における暦日の通し番号（1970-01-01=0）に変換する。 */
function civilDayNumber(instant: Date, timeZone: string): number {
  const { year, month, day } = civilDateParts(instant, timeZone);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * 朔望月（暦日単位）。朔が発生した現地暦日 startDay を初一とし、次の朔の
 * 現地暦日 endDay の前日までを1ヶ月とする（[startDay, endDay)）。
 */
interface LunarMonthSpan {
  start: Date;
  end: Date;
  startDay: number;
  endDay: number;
}

function toSpan(start: Date, timeZone: string): LunarMonthSpan {
  const end = findNextNewMoon(start);
  return {
    start,
    end,
    startDay: civilDayNumber(start, timeZone),
    endDay: civilDayNumber(end, timeZone),
  };
}

/**
 * 月 span に中気が1つでも含まれるか（暦日で判定）。
 *
 * 中気の瞬間と朔の瞬間の前後ではなく、中気が発生した現地暦日が
 * [朔日, 次の朔日) に入るかで判定する。月は朔日の0:00から始まるため、
 * 朔と同じ日の朔より前の時刻に起きた中気も、その朔から始まる月に属する
 * （例: 1995年 霜降 10/24 06:23 JST と 朔 10/24 13:36 JST → 霜降は
 * 10/24 から始まる月に属し、9/25 から始まる月は中気を含まない）。
 */
function containsZhongqi(span: LunarMonthSpan, zhongqiDays: readonly number[]): boolean {
  return zhongqiDays.some((d) => d >= span.startDay && d < span.endDay);
}

/**
 * 冬至を含む朔望月（暦日判定）＝その年の十一月の開始。
 * 冬至の瞬間以前で最も近い朔から始まる月を基本とし、次の朔が冬至と同じ
 * 暦日なら（冬至の暦日はその朔から始まる月に属するので）次の朔を採る。
 */
function winterSolsticeMonthStart(winterSolstice: Date, timeZone: string): Date {
  const before = findNewMoonCrossing(winterSolstice);
  const next = findNextNewMoon(before);
  return civilDayNumber(next, timeZone) <= civilDayNumber(winterSolstice, timeZone) ? next : before;
}

/** 2つの暦日（Y/M/D、時刻を無視）の差を「日数」で返す（タイムゾーン変換は済んでいる前提）。 */
function civilDateDiffDays(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((aMs - bMs) / MS_PER_DAY);
}

/**
 * 暦法の設定。現時点では "定気"（実視黄経、sunLonDeg/moonLonDeg の方式）のみ
 * 許可する。"平気"（太陽の平均運動による旧方式）は未実装のため型に含めない。
 * 将来の暦法差異に備えた拡張点として、設定オブジェクトの受け口だけを用意する。
 */
export interface LunisolarConfig {
  method?: "定気";
}

export interface LunisolarResult {
  /** 農暦月（1〜12）。 */
  lunarMonth: number;
  /** 閏月かどうか。 */
  isLeapMonth: boolean;
  /** 農暦日（1〜30）。朔が発生した暦日（timezone基準）を1とし、現地0:00ごとに1日進める。 */
  lunarDay: number;
  /**
   * 対象の暦日を含む月の朔の瞬間（UTC の ISO 8601 文字列）。月は朔日の0:00から
   * 始まるため、朔の当日で朔より前の時刻を指定した場合は対象時刻より後になる。
   */
  newMoonTime: string;
  /** 次の朔の瞬間（UTC の ISO 8601 文字列）。 */
  nextNewMoonTime: string;
}

/**
 * 対象時刻（UTC）とタイムゾーンから農暦（lunarMonth・lunarDay・isLeapMonth）を求める。
 * 月・中気・冬至の所属はすべて timezone における暦日で判定する。
 *
 * 処理の流れ:
 *   1. 対象年の前後の冬至それぞれについて「冬至を含む月（十一月）」の開始を求め、
 *      対象の暦日以前で最も新しいものをアンカー、その次のものを次アンカーとする。
 *   2. アンカーから次アンカーの直前までの月を並べる。月数が13なら閏年であり、
 *      中気を含まない最初の月だけを閏月とする（月番号は直前と同じ）。
 *      月数が12なら閏月は置かない（冬至を含む月が常に十一月になるための条件。
 *      12ヶ月の年に閏月を置くと、次の冬至の月が十一月にならない）。
 *   3. 対象の暦日を含む月の月番号・閏月フラグを返す。
 *   4. 農暦日は、対象の月の開始（朔）が発生した現地暦日を1とし、
 *      対象時刻の現地暦日との差分＋1で求める。
 */
export function resolveLunisolar(
  utc: Date,
  timezone: string,
  config?: LunisolarConfig,
): LunisolarResult {
  void config; // 現時点では定気法のみのため未使用（将来の暦法差異への拡張点）

  const targetDay = civilDayNumber(utc, timezone);
  const referenceYear = utc.getUTCFullYear();

  // 1. アンカー（冬至を含む月＝十一月）。前年・当年・翌年の冬至から求め、
  //    対象の暦日以前で最も新しいものと、その次のものを使う。
  const anchors = zhongqiCandidatesNearYear(referenceYear, 270)
    .map((ws) => winterSolsticeMonthStart(ws, timezone))
    .sort((a, b) => a.getTime() - b.getTime());
  let anchorIndex = -1;
  for (let i = 0; i < anchors.length; i += 1) {
    if (civilDayNumber(anchors[i], timezone) <= targetDay) anchorIndex = i;
  }
  if (anchorIndex < 0 || anchorIndex + 1 >= anchors.length) {
    throw new Error("resolveLunisolar: 対象日を挟む冬至の月が見つかりませんでした（想定外の入力範囲）。");
  }
  const anchorStart = anchors[anchorIndex];
  const nextAnchorDay = civilDayNumber(anchors[anchorIndex + 1], timezone);

  // 2. アンカーから次アンカーの直前までの月を並べる。
  const spans: LunarMonthSpan[] = [toSpan(anchorStart, timezone)];
  while (spans[spans.length - 1].endDay < nextAnchorDay && spans.length < 14) {
    spans.push(toSpan(spans[spans.length - 1].end, timezone));
  }
  if (spans[spans.length - 1].endDay !== nextAnchorDay) {
    throw new Error("resolveLunisolar: 冬至の月から次の冬至の月まで到達できませんでした（想定外の暦法境界）。");
  }

  // 中気の暦日（前年・当年・翌年の12中気。アンカー区間を必ず覆う）。
  const zhongqiDays = ZHONGQI_LONGITUDES.flatMap((lon) =>
    zhongqiCandidatesNearYear(referenceYear, lon).map((z) => civilDayNumber(z, timezone)),
  );

  // 3. 月番号の確定（冬至から次の冬至までに閏月は多くても1回）。
  const isLeapYear = spans.length === 13;
  let currentMonth = 11;
  let leapUsed = false;
  let target: { span: LunarMonthSpan; month: number; isLeap: boolean } | undefined;
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i];
    let isLeap = false;
    if (i > 0) {
      if (isLeapYear && !leapUsed && !containsZhongqi(span, zhongqiDays)) {
        // 中気を含まない最初の月＝閏月（月番号は直前と同じ）
        isLeap = true;
        leapUsed = true;
      } else {
        currentMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      }
    }
    if (targetDay >= span.startDay && targetDay < span.endDay) {
      target = { span, month: currentMonth, isLeap };
      break;
    }
  }
  if (target === undefined) {
    throw new Error(
      "resolveLunisolar: アンカーから対象の朔望月まで到達できませんでした（想定外の暦法境界）。",
    );
  }

  // 4. 農暦日：朔が発生した現地暦日を1とし、現地0:00ごとに1日進める。
  const newMoonLocalDate = civilDateParts(target.span.start, timezone);
  const targetLocalDate = civilDateParts(utc, timezone);
  const lunarDay = civilDateDiffDays(targetLocalDate, newMoonLocalDate) + 1;

  return {
    lunarMonth: target.month,
    isLeapMonth: target.isLeap,
    lunarDay,
    newMoonTime: target.span.start.toISOString(),
    nextNewMoonTime: target.span.end.toISOString(),
  };
}
