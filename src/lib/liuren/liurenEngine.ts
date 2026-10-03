// src/lib/liuren/liurenEngine.ts
//
// 役割:
//   六壬神課 起課エンジン本体。UI に依存しない純粋な計算処理。
//
//   calculateLiuren(core)       … 日干支・占時・月将から起課する（核）
//   calculateLiurenAt(datetime) … 日時から CalendarEngine で日干支・時支・太陽黄経を求め、
//                                  月将・占時を決めて calculateLiuren に渡す
//
//   処理の流れ:
//     入力 → 月将 → 天地盤 → 四課 → 十二天将 → 三伝 → 遁干・空亡・天将・六親
//
// 暦情報は共通暦エンジン src/lib/calendar の公開窓口からのみ取得する。

import { calculate } from "../calendar";
import type { CalendarInput } from "../calendar";
import { STEMS, BRANCHES } from "./constants";
import { resolveXun } from "./relations";
import { resolveMonthGeneral } from "./yuejiang";
import { buildPlate } from "./tiandipan";
import { buildFourLessons } from "./sike";
import { placeGenerals } from "./tianjiang";
import { resolveSanchuan } from "./sanchuan";
import { annotateTransmission } from "./annotate";
import type { Stem, Branch, LiurenCoreInput, LiurenChart } from "./types";

export function calculateLiuren(input: LiurenCoreInput): LiurenChart {
  const { dayStem, dayBranch, divinationBranch, monthGeneral } = input;
  if ((STEMS.indexOf(dayStem) - BRANCHES.indexOf(dayBranch)) % 2 !== 0) {
    throw new Error(`六十干支にない組み合わせです: ${dayStem}${dayBranch}`);
  }

  const plate = buildPlate(monthGeneral, divinationBranch);
  const lessons = buildFourLessons(dayStem, dayBranch, plate);
  const generals = placeGenerals(dayStem, divinationBranch, plate);
  const xun = resolveXun(dayStem, dayBranch);
  const sanchuan = resolveSanchuan(dayStem, dayBranch, lessons, plate);

  const transmissions = sanchuan.status === "determined"
    ? ([sanchuan.initial, sanchuan.middle, sanchuan.final].map((b) =>
        annotateTransmission(b, dayStem, xun, generals),
      ) as unknown as LiurenChart["transmissions"])
    : null;

  return {
    input,
    plate,
    lessons,
    generals,
    lessonGenerals: [
      generals.generalOn[lessons[0].upper],
      generals.generalOn[lessons[1].upper],
      generals.generalOn[lessons[2].upper],
      generals.generalOn[lessons[3].upper],
    ],
    xun: { xunHead: xun.xunHead, voidBranches: xun.voidBranches },
    sanchuan,
    transmissions,
  };
}

/** 日時から起課する場合の入力 */
export interface LiurenDateTimeInput extends CalendarInput {
  /** 占時を指定する場合（例: 問題発覚時。講座 p42）。未指定なら入力時刻の時支 */
  divinationBranch?: Branch;
  /** 月将を指定する場合。未指定なら入力時刻の太陽黄経から求める（講座 p4） */
  monthGeneral?: Branch;
}

export interface LiurenDateTimeResult {
  chart: LiurenChart;
  /** 月将の起点となった中気（月将を指定した場合は null） */
  zhongqi: string | null;
  calendar: ReturnType<typeof calculate>;
}

export function calculateLiurenAt(input: LiurenDateTimeInput): LiurenDateTimeResult {
  const { divinationBranch, monthGeneral, ...calendarInput } = input;
  const cal = calculate(calendarInput);
  const mg = monthGeneral
    ? { general: monthGeneral, zhongqi: null }
    : resolveMonthGeneral(cal.sunLongitude);
  const chart = calculateLiuren({
    dayStem: cal.dayStem as Stem,
    dayBranch: cal.dayBranch as Branch,
    divinationBranch: divinationBranch ?? (cal.hourBranch as Branch),
    monthGeneral: mg.general,
  });
  return { chart, zhongqi: mg.zhongqi, calendar: cal };
}
