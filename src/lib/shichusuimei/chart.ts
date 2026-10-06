// src/lib/shichusuimei/chart.ts
//
// 命式4柱（年・月・日・時）。干支・節入りの計算は共通暦エンジン calculate() に任せ、
// ここでは「どの時刻で呼ぶか」だけを決める。
//
//   年柱・月柱 … 現地法定時刻＋IANA timeZone で calculate()。出生の瞬間と節入りの瞬間の比較（D10）
//   日柱・時柱 … 地方真太陽時（D7・D8）の壁時計で calculate()。
//                23:00 以降は翌日の日干支、時干は切り替え後の日干（D3。calendar の子初換日）
//   時刻不明   … 時柱なし。年柱・月柱がその日のうちに変わる（節入り日）場合はエラー

import { calculate } from "../calendar";
import type { CalendarResult } from "../calendar";
import type { BirthDateTime, BirthPlace, Meishiki, Pillar } from "./types";
import { resolveStandardOffsetMinutes, toLocalApparentSolarTime } from "./timeCorrection";
import type { WallClock } from "./timeCorrection";

/**
 * 日柱・時柱用に calculate() を呼ぶときの timeZone。
 * calendar の日干支・時干支は入力の壁時計（年月日時）だけで決まるので、
 * 地方真太陽時の壁時計をそのまま渡す（UTC はサマータイムの欠落・重複がない）。
 */
const SOLAR_TIME_CALENDAR_ZONE = "UTC";

function calendarAt(w: WallClock, timeZone: string): CalendarResult {
  return calculate({ ...w, timezone: timeZone });
}

function yearPillar(c: CalendarResult): Pillar {
  return { stem: c.yearStem as Pillar["stem"], branch: c.yearBranch as Pillar["branch"] };
}
function monthPillar(c: CalendarResult): Pillar {
  return { stem: c.monthStem as Pillar["stem"], branch: c.monthBranch as Pillar["branch"] };
}
function dayPillar(c: CalendarResult): Pillar {
  return { stem: c.dayStem as Pillar["stem"], branch: c.dayBranch as Pillar["branch"] };
}
function hourPillar(c: CalendarResult): Pillar {
  return { stem: c.hourStem as Pillar["stem"], branch: c.hourBranch as Pillar["branch"] };
}

function samePillar(a: Pillar, b: Pillar): boolean {
  return a.stem === b.stem && a.branch === b.branch;
}

export function calculateMeishiki(birth: BirthDateTime, place: BirthPlace): Meishiki {
  const { year, month, day } = birth;

  if (birth.hour === null) {
    const start = calendarAt({ year, month, day, hour: 0, minute: 0, second: 0 }, place.timeZone);
    const end = calendarAt({ year, month, day, hour: 23, minute: 59, second: 59 }, place.timeZone);
    if (!samePillar(yearPillar(start), yearPillar(end)) || !samePillar(monthPillar(start), monthPillar(end))) {
      throw new Error(`birth time is required: year/month pillar changes on ${year}-${month}-${day} (節入り日)`);
    }
    const noon = calendarAt({ year, month, day, hour: 12, minute: 0, second: 0 }, place.timeZone);
    return {
      pillars: { 時: null, 日: dayPillar(noon), 月: monthPillar(noon), 年: yearPillar(noon) },
      timeCorrection: null,
      birthUtc: new Date(noon.utc),
      standardOffsetMinutes: resolveStandardOffsetMinutes(place),
      birthStandardDate: { year, month, day },
      sunLongitude: noon.sunLongitude,
      timeUnknown: true,
    };
  }

  const legal: WallClock = {
    year,
    month,
    day,
    hour: birth.hour,
    minute: birth.minute ?? 0,
    second: birth.second ?? 0,
  };
  const atBirth = calendarAt(legal, place.timeZone);
  const utc = new Date(atBirth.utc);
  const { correction, solarTime, standardLocal } = toLocalApparentSolarTime(legal, utc, place);
  const atSolarTime = calendarAt(solarTime, SOLAR_TIME_CALENDAR_ZONE);

  return {
    pillars: {
      時: hourPillar(atSolarTime),
      日: dayPillar(atSolarTime),
      月: monthPillar(atBirth),
      年: yearPillar(atBirth),
    },
    timeCorrection: correction,
    birthUtc: utc,
    standardOffsetMinutes: correction.standardOffsetMinutes,
    birthStandardDate: { year: standardLocal.year, month: standardLocal.month, day: standardLocal.day },
    sunLongitude: atBirth.sunLongitude,
    timeUnknown: false,
  };
}
