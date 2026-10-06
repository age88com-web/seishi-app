// src/lib/takujitsu/monthly/monthlyDisplay.ts
//
// 役割:
//   月間行動予定の1日分について、吉用事欄・凶用事欄に「表示する文字列」を決める。
//   PDF（monthlySchedulePdf.ts）はこの関数の結果だけを描画する。
//   判定は一切持たず、buildMonthlySchedule() の結果（good・bad・nanigoto・
//   badAbbreviated）を、画面（src/app/takujitsu/MonthlyScheduleView.tsx の
//   GoodCell・BadCell）と同じ規則で文字列にするだけ。
//
// 規則（docs/monthly-action-schedule-engine-mapping.md §7・§8・§16、2026-09-27 確定）:
//   ・吉用事: good だけ。mixed・neutral は出さない。1件も無ければ「―」。
//   ・「何事も宜しからず」の日: 吉用事欄はこの表示だけ。凶用事欄は「（何事も宜しからず）」。
//   ・凶用事: 8件以下は全件。超える日は8件＋「その他すべて凶」。1件も無ければ「―」。

import { BAD_LIST_DISPLAY_LIMIT } from "./buildMonthlySchedule";
import type { MonthlyDay } from "./buildMonthlySchedule";

/** 1つのセルに並べる語。kind で表示の強調を変える。 */
export interface MonthlyDisplayToken {
  text: string;
  kind: "item" | "none" | "nanigoto" | "nanigoto-note" | "sonota";
}

export interface MonthlyDayDisplay {
  good: MonthlyDisplayToken[];
  bad: MonthlyDisplayToken[];
}

export const NANIGOTO_LABEL = "何事も宜しからず";
export const SONOTA_LABEL = "その他すべて凶";
const NONE_LABEL = "―";

export function monthlyDayDisplay(d: MonthlyDay): MonthlyDayDisplay {
  if (d.nanigoto.show) {
    return {
      good: [{ text: NANIGOTO_LABEL, kind: "nanigoto" }],
      bad: [{ text: `（${NANIGOTO_LABEL}）`, kind: "nanigoto-note" }],
    };
  }
  const good: MonthlyDisplayToken[] =
    d.good.length > 0
      ? d.good.map((a) => ({ text: a.item.label, kind: "item" as const }))
      : [{ text: NONE_LABEL, kind: "none" }];

  let bad: MonthlyDisplayToken[];
  if (d.bad.length === 0) {
    bad = [{ text: NONE_LABEL, kind: "none" }];
  } else if (d.badAbbreviated) {
    bad = [
      ...d.bad.slice(0, BAD_LIST_DISPLAY_LIMIT).map((a) => ({ text: a.item.label, kind: "item" as const })),
      { text: SONOTA_LABEL, kind: "sonota" },
    ];
  } else {
    bad = d.bad.map((a) => ({ text: a.item.label, kind: "item" as const }));
  }
  return { good, bad };
}

/**
 * 方位の表示行（例「喜神：東北」）。画面と同じ calculateDailyDirections() の結果
 * （MonthlyDay.goodDirections・badDirections）をそのまま使う。太歳遊方の休止日は「なし」。
 */
export function monthlyDirectionLines(dirs: MonthlyDay["goodDirections"]): string[] {
  return dirs.map((x) => `${x.name}：${x.direction ?? "なし"}`);
}
