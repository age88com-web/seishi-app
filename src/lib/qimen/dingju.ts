// src/lib/qimen/dingju.ts
//
// 役割:
//   奇門遁甲「定局」— 対象日時から「今どの節気パターン（＝陽遁・陰遁の局数表の
//   どの行）が有効か」を決定論的に求め、上元・中元・下元と局数(1〜9)を返す。
//   地盤・天盤・八門・九星・八神・格局判定は行わない。
//
// 仕様の出典:
//   1. 講義テキストの【陰陽遁】【三元】【陽遁の局数】【陰遁の局数】
//      （YANG_JU_TABLE / YIN_JU_TABLE。局数.pdf で 72/72 完全一致まで検証済み）。
//   2. docs/source/局数.pdf … 符頭・正授・超神・接気・置閏の定義、
//      「二至（冬至・夏至）で超神が9日以上になったら置閏」というルール。
//   3. docs/source/奇門遁甲万年暦.xlsx（2018〜2020年の実データ）…
//      「節気の上元符頭は、天文学的な節入り瞬間そのものではなく、
//      前の節気の符頭から15日ごとに連続進行する」という実際の運用規則を
//      日単位で検証した検証専用データ。運用ロジックの根拠であり、
//      production コードからは一切参照しない（Excel非依存）。
//   詳細な監査手順・全件照合結果は docs/qimen-dingju-effective-term.md を参照。
//
// 最重要（今回の実装方針）:
//   「前回計算した符頭」をモジュールのメモリ／グローバル変数として保持する
//   stateful な実装にはしていない。resolveDingju() は呼び出し履歴に一切依存せず、
//   同じ入力（同じ日時）なら必ず同じ結果を返す純粋関数である。
//   内部では「十分に古い、Excel実データで一意に確定できるアンカー地点」から
//   対象日時まで、15日刻みの符頭系列を毎回その場で計算し直す
//   （アンカーの選定根拠は ANCHOR 定数のコメントを参照）。

import { STEMS, BRANCHES } from "../eto";
import type { Stem, Branch } from "../eto";
import { SOLAR_TERMS } from "../calendar/types";
import { findSolarTermCrossing } from "../calendar/solarTerm";

export interface DingjuInput {
  /** 対象時刻の現地壁時計（CalendarEngine への入力そのもの）。
   *  符頭の15日ブロック境界を、日干支と同じ「子初23時」の日境界で
   *  一意に定めるために使う。天文学的な節入り瞬間そのものではない。 */
  localYear: number;
  localMonth: number;
  localDay: number;
  localHour: number;
  /** IANA タイムゾーン名。未指定時は "Asia/Tokyo"（CalendarEngine の既定値と同じ）。 */
  timezone?: string;
  dayStem: Stem;
  dayBranch: Branch;
}

export type Dun = "陽遁" | "陰遁";
export type Yuan = "上元" | "中元" | "下元";

export interface DingjuResult {
  dun: Dun;
  yuan: Yuan;
  ju: number;
  /** 今この日時に有効な節気パターン（局数表の参照行）の節気名。
   *  天文学的に今属している節気（CalendarResult.solarTerm）とは
   *  置閏前後の期間でずれることがある。 */
  effectiveTerm: string;
  /** 置閏により、直前の節気パターン（大雪／芒種）がもう一巡している期間かどうか。 */
  isLeapRepeat: boolean;
}

const DEFAULT_QIMEN_TIMEZONE = "Asia/Tokyo";
const MS_PER_DAY = 86_400_000;
/** 局数.pdf: 二至（冬至・夏至）で超神が9日以上になったら置閏する。 */
const LEAP_TRIGGER_DAYS = 9;
/** 節気候補の天文学的節入り瞬間を探す際の検索起点バッファ（日）。
 *  実データでの超神・接気の最大幅（±9日程度）を十分に含む。 */
const SOLSTICE_SEARCH_BUFFER_DAYS = 20;
/** アンカーから対象日時までの半年ステップ数の安全上限（約1000年分）。 */
const MAX_CHAIN_STEPS = 2000;

const YANG_DUN_TERMS = new Set([
  "冬至", "小寒", "大寒", "立春", "雨水", "啓蟄",
  "春分", "清明", "穀雨", "立夏", "小満", "芒種",
]);

const YIN_DUN_TERMS = new Set([
  "夏至", "小暑", "大暑", "立秋", "処暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
]);

// 上元・中元・下元それぞれの「符頭」（5日単位の先頭日の干支）
const SHANG_YUAN_FUTOU = ["甲子", "己卯", "甲午", "己酉"];
const ZHONG_YUAN_FUTOU = ["己巳", "甲申", "己亥", "甲寅"];
const XIA_YUAN_FUTOU = ["甲戌", "己丑", "甲辰", "己未"];

// [上元, 中元, 下元] の局数（docs/source/局数.pdf で 72/72 完全一致まで検証済み）
const YANG_JU_TABLE: Record<string, [number, number, number]> = {
  "冬至": [1, 7, 4],
  "啓蟄": [1, 7, 4],
  "小寒": [2, 8, 5],
  "春分": [3, 9, 6],
  "大寒": [3, 9, 6],
  "芒種": [6, 3, 9],
  "穀雨": [5, 2, 8],
  "小満": [5, 2, 8],
  "立春": [8, 5, 2],
  "立夏": [4, 1, 7],
  "清明": [4, 1, 7],
  "雨水": [9, 6, 3],
};

const YIN_JU_TABLE: Record<string, [number, number, number]> = {
  "夏至": [9, 3, 6],
  "白露": [9, 3, 6],
  "小暑": [8, 2, 5],
  "秋分": [7, 1, 4],
  "大暑": [7, 1, 4],
  "立秋": [2, 5, 8],
  "霜降": [5, 8, 2],
  "小雪": [5, 8, 2],
  "大雪": [4, 7, 1],
  "処暑": [1, 4, 7],
  "立冬": [6, 9, 3],
  "寒露": [6, 9, 3],
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 干支（幹・支）から六十干支インデックス（甲子=0）を求める。 */
function ganzhiIndex(stem: Stem, branch: Branch): number {
  const stemIndex = STEMS.indexOf(stem);
  const branchIndex = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stemIndex && i % 12 === branchIndex) {
      return i;
    }
  }
  throw new Error(`invalid ganzhi combination: ${stem}${branch}`);
}

function ganzhiAt(index: number): string {
  return `${STEMS[mod(index, 10)]}${BRANCHES[mod(index, 12)]}`;
}

/**
 * resolveYuan: 日干支 → 5日単位 → 上元／中元／下元。
 * 講義テキストの符頭定義そのままの、置閏の影響を受けない普遍的な計算。
 * （どの60日周期でも、日干支だけから一意に上元/中元/下元が決まる。
 *  「今どの節気パターンが有効か」＝ effectiveTerm とは独立。）
 */
function resolveYuan(dayStem: Stem, dayBranch: Branch): Yuan {
  const dayIndex = ganzhiIndex(dayStem, dayBranch);
  const futouIndex = dayIndex - mod(dayIndex, 5);
  const futou = ganzhiAt(futouIndex);

  if (SHANG_YUAN_FUTOU.includes(futou)) return "上元";
  if (ZHONG_YUAN_FUTOU.includes(futou)) return "中元";
  if (XIA_YUAN_FUTOU.includes(futou)) return "下元";

  throw new Error(`符頭が三元のいずれにも該当しません: ${futou}`);
}

function resolveDun(effectiveTerm: string): Dun {
  if (YANG_DUN_TERMS.has(effectiveTerm)) return "陽遁";
  if (YIN_DUN_TERMS.has(effectiveTerm)) return "陰遁";
  throw new Error(`未知の節気です: ${effectiveTerm}`);
}

function resolveJu(dun: Dun, effectiveTerm: string, yuan: Yuan): number {
  const table = dun === "陽遁" ? YANG_JU_TABLE : YIN_JU_TABLE;
  const row = table[effectiveTerm];
  if (!row) {
    throw new Error(`局数表に節気が見つかりません: ${effectiveTerm}`);
  }
  const yuanIndex = yuan === "上元" ? 0 : yuan === "中元" ? 1 : 2;
  return row[yuanIndex];
}

// ---------------------------------------------------------------------------
// effectiveTerm（今この日時に有効な節気パターン）の決定
// ---------------------------------------------------------------------------
//
// 資料（局数.pdf・奇門遁甲万年暦.xlsx）から確定した構造:
//
//   節気の上元符頭 → 15日間(上元5日/中元5日/下元5日) → 次の節気の上元符頭 → …
//
//   という連続系列であり、通常は「次の符頭 = 前の符頭 + 15日」。
//   二至（冬至・夏至）へ移行する直前だけ置閏判定を行う:
//     candidate = 前節気の符頭 + 15日
//     実際の二至の日付 − candidate が9日以上（超神9日以上）なら、
//     直前の節気（冬至前=大雪／夏至前=芒種）の15日パターンをもう一巡させてから
//     二至の符頭へ移行する（＝ candidate にさらに15日を足す）。
//
//   このため、二至から二至までは必ず180日（通常）または195日（置閏時、
//   節気1つ分＝15日が余分に挿入される）になる。これは奇門遁甲万年暦.xlsxの
//   2018〜2020年全72節気境界のうち71/72（残り1件は「大雪」という節気名の
//   2つの実在インスタンス＝本来の開始と置閏後の繰り返しのどちらを指すかという
//   定義上の差でしかなく、日単位では243/245=99.18%一致・残差2件も原因判明済み）
//   で確認済み。詳細は docs/qimen-dingju-effective-term.md 参照。

interface SolsticeChainPoint {
  /** この二至の実効上元符頭日（UTC 00:00 起点の暦日として保持。時刻情報は持たない）。 */
  futouDay: Date;
  /** SOLAR_TERMS 内でのインデックス（9=夏至 または 21=冬至）。 */
  termIndex: number;
}

// ---- アンカー ----------------------------------------------------------
//
// 奇門遁甲万年暦.xlsx（2018年 戊戌）の実データから一意に確定できる、
// 2018年夏至の上元符頭を採用する。
//   天文学的夏至: 2018-06-21 19:07(JST)
//   Excel上の符頭: 2018-06-16（己卯）
//   offset = +5日（超神。候補間隔15日の半分=7.5日以内で一意に最近傍が定まり、
//     どちらの符頭を採るか曖昧にならない実データ点）
// この地点を基準に「前進のみ」で 2018〜2020年の全ての公式回帰テスト対象日
// （2018年大雪の置閏3日間を含む）に到達できるため、後退方向の逆算
// （置閏の有無を2通り試して順方向ルールと矛盾しない方を採用する──
// stepSolsticeBackward）を経由しない、最も検証が単純なアンカーとして選んだ。
// 一般知識やアプリのデフォルト年からの類推では選んでいない。
const ANCHOR: SolsticeChainPoint = {
  futouDay: new Date(Date.UTC(2018, 5, 16)),
  termIndex: SOLAR_TERMS.findIndex((t) => t.name === "夏至"),
};

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/**
 * 現地壁時計（年月日時）を、日干支と同じ「子初23時」の日境界規則で
 * 暦日（UTC 00:00 起点の Date として表現するだけの、実際のタイムゾーンとは
 * 無関係な内部表現）に変換する。src/lib/calendar/eto.ts の civilJdn() と
 * 同じ境界規則をそのまま踏襲する。
 */
function localCivilDay(year: number, month: number, day: number, hour: number): Date {
  if (hour >= 23) {
    return new Date(Date.UTC(year, month - 1, day + 1));
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * 天文学的な瞬時（UTC）を、指定タイムゾーンの現地壁時計に変換したうえで
 * localCivilDay() と同じ「子初23時」規則で暦日に丸める。
 * 二至の超神／接気の判定を、符頭側と同じ日境界基準で比較するために使う。
 */
function localCivilDayOfInstant(instant: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  if (map.hour === 24) map.hour = 0;
  return localCivilDay(map.year, map.month, map.day, map.hour);
}

function solsticeLongitude(termName: string): number {
  if (termName === "冬至") return 270;
  if (termName === "夏至") return 90;
  throw new Error(`二至ではありません: ${termName}`);
}

/**
 * ある二至の実効符頭日から半年（12節気=180日）進めた次の二至の実効符頭日を求める。
 * 途中の非二至の節気（各1回ずつ）は分岐がない（置閏判定は二至への移行時にしか
 * 行われないため）ので、まとめて180日進めてよい。
 */
function stepSolsticeForward(point: SolsticeChainPoint, timeZone: string): SolsticeChainPoint {
  const nextTermIndex = (point.termIndex + 12) % 24;
  const nextTermName = SOLAR_TERMS[nextTermIndex].name;
  const candidate = addDays(point.futouDay, 180);

  const longitude = solsticeLongitude(nextTermName);
  const astroInstant = findSolarTermCrossing(addDays(candidate, SOLSTICE_SEARCH_BUFFER_DAYS), longitude);
  const astroLocalDay = localCivilDayOfInstant(astroInstant, timeZone);
  const offsetDays = diffDays(astroLocalDay, candidate);

  const futouDay = offsetDays >= LEAP_TRIGGER_DAYS ? addDays(candidate, 15) : candidate;
  return { futouDay, termIndex: nextTermIndex };
}

/**
 * stepSolsticeForward の逆方向。置閏の有無は「前→今」方向の判定式でしか
 * 定義されていないため単純な引き算では逆算できない。前の二至の候補を
 * 「置閏なし(-180日)」「置閏あり(-195日)」の2通り試し、実際に
 * stepSolsticeForward を適用して現在の点を再現する方を採用する
 * （＝順方向ルールと矛盾しない一意な解を選ぶ。推測ではなく総当たり確認）。
 */
function stepSolsticeBackward(point: SolsticeChainPoint, timeZone: string): SolsticeChainPoint {
  const prevTermIndex = (point.termIndex + 12) % 24;

  const noLeapGuess: SolsticeChainPoint = {
    futouDay: addDays(point.futouDay, -180),
    termIndex: prevTermIndex,
  };
  if (diffDays(stepSolsticeForward(noLeapGuess, timeZone).futouDay, point.futouDay) === 0) {
    return noLeapGuess;
  }

  const leapGuess: SolsticeChainPoint = {
    futouDay: addDays(point.futouDay, -195),
    termIndex: prevTermIndex,
  };
  if (diffDays(stepSolsticeForward(leapGuess, timeZone).futouDay, point.futouDay) === 0) {
    return leapGuess;
  }

  throw new Error("二至の逆算に失敗しました（置閏判定と矛盾する結果になりました）");
}

/**
 * 対象暦日に有効な節気（節気パターン）を、ANCHOR から毎回その場で
 * 計算し直して求める（呼び出し履歴に依存しない純粋関数）。
 */
function resolveEffectiveTermIndex(
  targetDay: Date,
  timeZone: string,
): { termIndex: number; isLeapRepeat: boolean } {
  let point = ANCHOR;
  let guard = 0;

  if (targetDay.getTime() >= point.futouDay.getTime()) {
    for (;;) {
      const next = stepSolsticeForward(point, timeZone);
      if (next.futouDay.getTime() > targetDay.getTime()) break;
      point = next;
      guard += 1;
      if (guard > MAX_CHAIN_STEPS) {
        throw new Error("effectiveTerm の計算が収束しませんでした（前進）");
      }
    }
  } else {
    while (point.futouDay.getTime() > targetDay.getTime()) {
      point = stepSolsticeBackward(point, timeZone);
      guard += 1;
      if (guard > MAX_CHAIN_STEPS) {
        throw new Error("effectiveTerm の計算が収束しませんでした（後退）");
      }
    }
  }

  const diff = diffDays(targetDay, point.futouDay);
  const rawBlockCount = Math.floor(diff / 15);
  // 通常の半年は12ブロック（0〜11）。置閏があった半年だけ13ブロック目
  // （＝直前ブロックの節気がもう一巡した期間）が存在するので、
  // それを「同じ節気の継続」として扱う（次の二至へは進めない）。
  const isLeapRepeat = rawBlockCount === 12;
  const blockCount = Math.min(rawBlockCount, 11);
  const termIndex = (point.termIndex + blockCount) % 24;

  return { termIndex, isLeapRepeat };
}

/**
 * 定局: 陽遁/陰遁・上元/中元/下元・局数(1〜9) を返す。
 * 地盤・天盤・八門・九星・八神・格局判定は行わない。
 */
export function resolveDingju(input: DingjuInput): DingjuResult {
  const { localYear, localMonth, localDay, localHour, dayStem, dayBranch } = input;
  const timeZone = input.timezone ?? DEFAULT_QIMEN_TIMEZONE;

  const targetDay = localCivilDay(localYear, localMonth, localDay, localHour);
  const { termIndex, isLeapRepeat } = resolveEffectiveTermIndex(targetDay, timeZone);
  const effectiveTerm = SOLAR_TERMS[termIndex].name;

  const dun = resolveDun(effectiveTerm);
  const yuan = resolveYuan(dayStem, dayBranch);
  const ju = resolveJu(dun, effectiveTerm, yuan);

  return { dun, yuan, ju, effectiveTerm, isLeapRepeat };
}
