// src/lib/luckyDay/purposeCalendars.ts
//
// 役割:
//   /lucky-day 上部の「目的別の吉日カレンダー」に並べるページの一覧（表示用データのみ）。
//   各用事の月間一覧は /lucky-day/<用事> の独立ページに置く。
//   ページを実装したものだけをここに追加する（未実装の用事のボタンは置かない）。

export interface LuckyDayPurposeCalendar {
  /** ページのパス。 */
  href: string;
  /** ボタンの表示名。 */
  label: string;
}

export const LUCKY_DAY_PURPOSE_CALENDARS: readonly LuckyDayPurposeCalendar[] = [
  { href: "/lucky-day/car", label: "新車購入・納車吉日" },
  { href: "/lucky-day/travel", label: "海外旅行・観光吉日" },
];
