// src/lib/takujitsu/index.ts
//
// 役割:
//   擇日モジュールの公開窓口。呼び出し側は本ファイルからのみ import する。
//
//   共通 CalendarEngine（src/lib/calendar/）の入力（年月日時など）を受け取り、
//   CalendarEngine が確定した yearStem/yearBranch・monthStem/monthBranch・
//   dayStem/dayBranch だけを取り出して神殺判定へ渡す薄い層。CalendarEngine
//   自体は一切変更しない（呼び出すだけ）。
//
// 月令・日令について（重要）:
//   月令（＝月建）には CalendarResult.monthBranch（節入り時刻で確定した
//   月支）を、日令（＝日辰）には CalendarResult.dayBranch をそのまま使う。
//   新暦の月番号や日付そのものからの変換は行わない。
//
// グループ構成:
//   ・shinsatsu/kichijin.ts       … 第1グループ（天徳・月徳・天徳合・月徳合・
//     歳徳・歳徳合・天赦）。resolveKichijin() としてそのまま公開する
//     （既存テストが直接 import しているため、他グループを混ぜて挙動を
//     変えない）。
//   ・shinsatsu/kichijinGroup2.ts … 第2グループ（母倉・四相・時徳・王日・
//     官日・守日・相日・民日）。resolveKichijinGroup2() として公開する。
//   ・shinsatsu/kichijinGroup3.ts … 第3グループ（三合・六合・五合・鳴吠・
//     鳴吠對）。resolveKichijinGroup3() として公開する。
//   ・shinsatsu/kichijinGroup4.ts … 第1〜3グループ未実装だった残りの日家
//     吉神のうち、CalendarEngine の現行出力だけで判定できるもの
//     （月恩・寶日・義日・専日・要安〜續世・五富・天倉・陽徳・陰徳・六儀・
//     驛馬・天馬・青龍・明堂・金匱・寶光・玉堂・司命・解神・臨日・兵福・
//     天瑞・天福・天貴・催官）。resolveKichijinGroup4() として公開する。
//     これで「日家吉神」章のうち保留分（農暦月番号・十二建・大量固定
//     列挙で実例照合不能なもの）を除き完成する。
//   ・shinsatsu/kyoushinGroup5.ts  … 凶神第5グループ（四離・四絶・八節日・
//     土王用事・氣往亡）。他グループと異なり ShinsatsuInput ではなく
//     CalendarInput（年月日時）をそのまま受け取る（節気の節入り日時を
//     基準とするため、干支だけの薄い型では判定できない）。
//     resolveKyoushinGroup5() として公開し、calculateShinsatsu /
//     calculateTakujitsu からのみ結果を合算する
//     （resolveAllShinsatsu の入力・他グループには一切影響しない）。
//   ・shinsatsu/kyoushinGroup6.ts  … 凶神1〜53番の全件棚卸しで回収した
//     残りの日家凶神（満日・厭對・上朔・月忌日・長星短星・揚公忌・
//     横天朱雀・四不詳・上兀・下兀・受死日・伏斷日・埋兒凶宿・周堂殺・
//     天空・地空・大空亡・小空亡・天乙絶気・四方耗・刀砧日・龍禁・
//     冰消瓦解・冰消瓦砕）。ShinsatsuInput（lunarDay・lodge28 を追加）で
//     判定できるため resolveAllShinsatsu に混ぜる。
//   CalendarEngine 経由のエントリポイント（calculateShinsatsu）だけは
//   全グループを合算した結果を返す。
//
//   ・resolution/          … 神殺解除・相殺・増悪レイヤー（occurrence
//     detectionとは完全に分離した独立モジュール。resolve() は raw の
//     ShinsatsuResult を受け取るだけで、上記の全グループのロジックには
//     一切触れない）。calculateTakujitsu() の戻り値に resolution
//     フィールドとして追加している（shinsatsu・buildingDay・shuku28は
//     変更なし）。calculateShinsatsu() には統合していない（型を変えると
//     既存の呼び出し側に影響するため）。

import { calculate as calculateCalendar } from "@/lib/calendar";
import type { CalendarInput, CalendarResult } from "@/lib/calendar";

import { resolveKichijin } from "./shinsatsu/kichijin";
import { resolveKichijinGroup2 } from "./shinsatsu/kichijinGroup2";
import { resolveKichijinGroup3 } from "./shinsatsu/kichijinGroup3";
import { resolveKichijinGroup4 } from "./shinsatsu/kichijinGroup4";
import { resolveKichijinGroup5 } from "./shinsatsu/kichijinGroup5";
import { resolveKichijinGroup6 } from "./shinsatsu/kichijinGroup6";
import { resolveKyoushinGroup1 } from "./shinsatsu/kyoushinGroup1";
import { resolveKyoushinGroup2 } from "./shinsatsu/kyoushinGroup2";
import { resolveKyoushinGroup3 } from "./shinsatsu/kyoushinGroup3";
import { resolveKyoushinGroup4 } from "./shinsatsu/kyoushinGroup4";
import { resolveKyoushinGroup5, isDoyouPeriod } from "./shinsatsu/kyoushinGroup5";
import { resolveKyoushinGroup6 } from "./shinsatsu/kyoushinGroup6";
import type { ShinsatsuInput, ShinsatsuResult } from "./types";
import { resolveJianchu } from "./jianchu";
import type { JianchuResult } from "./jianchu";
import { getShuku28Info } from "./shuku28";
import type { Shuku28Info, Lodge28 } from "./shuku28";
import { resolve as resolveShinsatsuRelations } from "./resolution";
import type { ResolvedShinsatsuResult } from "./resolution";

export type { ShinsatsuInput, ShinsatsuResult } from "./types";
export { resolveKichijin } from "./shinsatsu/kichijin";
export { resolveKichijinGroup2 } from "./shinsatsu/kichijinGroup2";
export { resolveKichijinGroup3 } from "./shinsatsu/kichijinGroup3";
export { resolveKichijinGroup4 } from "./shinsatsu/kichijinGroup4";
export { resolveKichijinGroup5 } from "./shinsatsu/kichijinGroup5";
export { resolveKichijinGroup6 } from "./shinsatsu/kichijinGroup6";
export { resolveKyoushinGroup1 } from "./shinsatsu/kyoushinGroup1";
export { resolveKyoushinGroup2 } from "./shinsatsu/kyoushinGroup2";
export { resolveKyoushinGroup3 } from "./shinsatsu/kyoushinGroup3";
export { resolveKyoushinGroup4 } from "./shinsatsu/kyoushinGroup4";
export { resolveKyoushinGroup5 } from "./shinsatsu/kyoushinGroup5";
export { resolveKyoushinGroup6 } from "./shinsatsu/kyoushinGroup6";

// 神殺とは別の独立モジュール（神殺モジュールへは組み込まない）。
export { resolveJianchu, JIANCHU_NAMES, JIANCHU_READINGS, JIANCHU_MEANINGS } from "./jianchu";
export type { JianchuName, JianchuInput, JianchuResult } from "./jianchu";
export {
  getShuku28Info,
  resolveShuku28,
  LODGE28_READINGS,
  LODGE28_MEANINGS,
} from "./shuku28";

// 神殺解除・相殺・増悪レイヤー（神殺の成立判定＝occurrence detectionとは
// 完全に分離した別モジュール）。resolve() は raw の ShinsatsuResult を
// 受け取るだけで、吉神Group1〜6・凶神Group1〜6のロジックには一切触れない。
export { resolve as resolveShinsatsuRelations, RESOLUTION_RULES, DEHE_GROUP, SHAGAN_GROUP } from "./resolution";
export type {
  ResolutionStatus,
  RelationKind,
  ResolutionRule,
  AppliedRuleRecord,
  ResolvedShinsatsuEntry,
  ResolvedShinsatsuResult,
} from "./resolution";
export type { Shuku28Info } from "./shuku28";

// 擇日UI（src/app/takujitsu/）向けの統合 wrapper（2026-09-10、UI統合 第1フェーズ）。
// 暦→神殺→resolution→十二建除→二十八宿→用途判定 を1回で返すだけの薄い層。
// occurrence/resolution/十二建除/二十八宿/ActivityProfile のロジックは無変更。
export { calculateTakujitsuFull, searchTakujitsuDays, TAKUJITSU_SEARCH_MAX_DAYS } from "./full";
export type {
  TakujitsuFullResult,
  TakujitsuSearchResult,
  TakujitsuSearchDay,
  TakujitsuSearchParams,
} from "./full";

/**
 * 実装済みの全グループを合算して判定する（吉神第1〜第6グループ・
 * 凶神第1〜第4グループ・凶神第6グループ）。凶神第5グループ（節気型）は
 * CalendarInput が必要なため、calculateShinsatsu / calculateTakujitsu が
 * 別途 resolveKyoushinGroup5 を呼んで合算する（本関数の対象外）。
 */
export function resolveAllShinsatsu(input: ShinsatsuInput): ShinsatsuResult {
  const g1 = resolveKichijin(input);
  const g2 = resolveKichijinGroup2(input);
  const g3 = resolveKichijinGroup3(input);
  const g4 = resolveKichijinGroup4(input);
  const g5 = resolveKichijinGroup5(input);
  const g6 = resolveKichijinGroup6(input);
  const ky1 = resolveKyoushinGroup1(input);
  const ky2 = resolveKyoushinGroup2(input);
  const ky3 = resolveKyoushinGroup3(input);
  const ky4 = resolveKyoushinGroup4(input);
  const ky6 = resolveKyoushinGroup6(input);
  return {
    kichijin: [...g1.kichijin, ...g2.kichijin, ...g3.kichijin, ...g4.kichijin, ...g5.kichijin, ...g6.kichijin],
    kyojin: [
      ...g1.kyojin, ...g2.kyojin, ...g3.kyojin, ...g4.kyojin, ...g5.kyojin, ...g6.kyojin,
      ...ky1.kyojin, ...ky2.kyojin, ...ky3.kyojin, ...ky4.kyojin, ...ky6.kyojin,
    ],
  };
}

/**
 * CalendarEngine の入力（年月日時など）から
 * yearStem/yearBranch・monthStem/monthBranch・dayStem/dayBranch・lunarMonth を
 * 取り出し、神殺（実装済みの全グループ）を判定する。
 * lunarMonth は第6グループ（天願・季分）のみが使用し、monthBranch を使う
 * 既存グループ（第1〜5グループ）には一切渡らない・影響しない
 * （ShinsatsuInput.lunarMonth を読むのは resolveKichijinGroup6 だけ）。
 *
 * 凶神第5グループ（四離・四絶・八節日・土王用事・氣往亡）だけは
 * 干支ではなく二十四節気の節入り日時を基準とするため、ShinsatsuInput
 * ではなく CalendarInput をそのまま resolveKyoushinGroup5 に渡す
 * （resolveAllShinsatsu の入力・他グループの判定には一切影響しない）。
 */
export function calculateShinsatsu(input: CalendarInput): ShinsatsuResult {
  const calendar = calculateCalendar(input);
  const base = resolveAllShinsatsu({
    yearStem: calendar.yearStem,
    yearBranch: calendar.yearBranch,
    monthStem: calendar.monthStem,
    monthBranch: calendar.monthBranch,
    dayStem: calendar.dayStem,
    dayBranch: calendar.dayBranch,
    lunarMonth: calendar.lunarMonth,
    lunarDay: calendar.lunarDay,
    lodge28: calendar.lodge28,
    isDoyou: isDoyouPeriod(input),
  });
  const ky5 = resolveKyoushinGroup5(input);
  return {
    kichijin: base.kichijin,
    kyojin: [...base.kyojin, ...ky5.kyojin],
  };
}

/**
 * 擇日の暦情報3本柱（神殺・十二建除・二十八宿）をまとめた出力。
 * 将来の構成（1.暦情報 → 2.取捨選択 → 3.吉用事・凶用事）のうち、
 * 今回実装するのは「1.暦情報」の集約のみ。取捨選択・吉凶判断は持たない。
 */
export interface TakujitsuResult {
  shinsatsu: ShinsatsuResult;
  /** 十二建除（神殺とは別の独立モジュール。shinsatsu/ 配下ではない）。 */
  buildingDay: JianchuResult;
  /**
   * 二十八宿。CalendarEngine が既定アンカー（shukuYoAnchor.ts、
   * 2025-12-21＝虚）で常に算出するため、通常は常に値が入る。
   * epochJdn を明示的に別値で上書きした場合はその基準で算出される。
   */
  shuku28?: Shuku28Info;
  /**
   * 神殺解除・相殺・増悪レイヤー（src/lib/takujitsu/resolution/）の
   * 適用結果。shinsatsu（occurrence detection の生の結果）は一切変更
   * せず、resolution はそれを元にした別レイヤーの追加情報として持つ。
   * 既存フィールド（shinsatsu・buildingDay・shuku28）の名称・型・意味は
   * 一切変更していない（後方互換）。
   */
  resolution: ResolvedShinsatsuResult;
}

/**
 * CalendarEngine の入力（年月日時など。epochJdn 指定は任意で、
 * 未指定なら shukuYoAnchor.ts の既定アンカーが使われる）から、
 * 神殺・十二建除・二十八宿をまとめて算出する。
 * CalendarEngine は変更せず、その戻り値を利用するだけ。
 *
 * `calendar` を渡すと、その CalendarResult をそのまま使い calculateCalendar() を
 * 呼ばない（同一 input を暦計算する呼び出し側＝calculateTakujitsuFull や
 * 期間検索で二重計算を避けるため。2026-09-10、擇日UI 第3フェーズ）。
 * 渡された CalendarResult は同じ input から得られたものであることを呼び出し側が
 * 保証する（calculateCalendar は純粋関数なので結果は同一）。occurrence /
 * resolution / 十二建除 / 二十八宿 のロジックは一切変わらない。
 * 引数を省略した従来の呼び出しは完全に後方互換。
 */
export function calculateTakujitsu(input: CalendarInput, calendar?: CalendarResult): TakujitsuResult {
  const cal = calendar ?? calculateCalendar(input);

  const shinsatsuBase = resolveAllShinsatsu({
    yearStem: cal.yearStem,
    yearBranch: cal.yearBranch,
    monthStem: cal.monthStem,
    monthBranch: cal.monthBranch,
    dayStem: cal.dayStem,
    dayBranch: cal.dayBranch,
    lunarMonth: cal.lunarMonth,
    lunarDay: cal.lunarDay,
    lodge28: cal.lodge28,
    isDoyou: isDoyouPeriod(input),
  });
  // 凶神第5グループ（四離・四絶・八節日・土王用事・氣往亡）は節気の
  // 節入り日時を基準とするため CalendarInput をそのまま渡す（calculateShinsatsu と同じ理由）。
  const ky5 = resolveKyoushinGroup5(input);
  const shinsatsu: ShinsatsuResult = {
    kichijin: shinsatsuBase.kichijin,
    kyojin: [...shinsatsuBase.kyojin, ...ky5.kyojin],
  };

  const buildingDay = resolveJianchu({
    monthBranch: cal.monthBranch,
    dayBranch: cal.dayBranch,
  });

  const shuku28 =
    cal.lodge28 !== undefined
      ? getShuku28Info(cal.lodge28 as Lodge28)
      : undefined;

  // shinsatsu（rawのoccurrence detection結果）はここまでで確定済み。
  // resolveShinsatsuRelations はこれを入力に取るだけで、shinsatsu自体は
  // 一切変更しない（凶神が解除されても shinsatsu.kyojin からは削除しない）。
  const resolution = resolveShinsatsuRelations(shinsatsu);

  return { shinsatsu, buildingDay, shuku28, resolution };
}
