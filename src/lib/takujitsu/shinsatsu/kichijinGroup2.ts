// src/lib/takujitsu/shinsatsu/kichijinGroup2.ts
//
// 役割:
//   擇日「Ⅰ 神殺の原理　日家吉神」第2グループの判定。
//     母倉・四相・時徳・王日・官日・守日・相日・民日
//   docs/source/擇日テキスト.pdf p.7〜p.8 の表を、一般化・要約せずそのまま
//   ロジック化した。src/lib/takujitsu/shinsatsu/kichijin.ts（第1グループ：
//   天徳・月徳・天徳合・月徳合・歳徳・歳徳合・天赦）は一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf（このPDF以外は一切参照していない）。
//     ・10）母倉               p.7
//     ・12）四相               p.8
//     ・13）時徳               p.8
//     ・14）王官守相民日       p.8（王日・官日・守日・相日・民日の5項目）
//   要約・補完・推測はしていない。CalendarEngine（src/lib/calendar/）は
//   一切変更しない・依存もしない値の受け渡しのみ。
//
// 検証区分（重要。前回導入した区分A/Bの考え方を踏襲する）:
//   母倉・四相・時徳・王日・官日・守日・相日・民日は、いずれも
//   「月令（月建）＋日辰（日干支）」だけで決まる神殺のため区分A
//   （実例PDF照合対象）に分類する。docs/source/擇日実例.pdf の一覧表に
//   すべて出現することを確認済み（tests/takujitsu_kichijin_group2.manual.ts
//   参照）。
//
// 今回は実装しない項目（重要・理由を記録する）:
//   ・11）天願（p.7）は「正月は甲午、2月は甲戌…（月は新暦ではなく農暦で
//     みてください）」と、月令（月支＝節入りで確定する月建）ではなく
//     農暦（旧暦）の月番号1〜12をキーにしている。CalendarEngine
//     （src/lib/calendar/）は年干支・月干支（節入りで確定する月建）・
//     日干支・時干支のみを提供し、農暦月番号は算出していない。
//     CalendarEngine は変更禁止であり、農暦月番号の算出を本モジュール側で
//     独自に実装することは、月令（月建）とは別の新しい暦計算を推測で
//     追加することになるため行わない。天願は今回のスコープから除外する
//     （削除ではなく、実装保留として記録する）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/** 季節区分（寅卯辰＝春、巳午未＝夏、申酉戌＝秋、亥子丑＝冬）。四相・時徳・王官守相民日で共通に使う。 */
export const SEASON_GROUPS: readonly (readonly string[])[] = [
  ["寅", "卯", "辰"],
  ["巳", "午", "未"],
  ["申", "酉", "戌"],
  ["亥", "子", "丑"],
];

function seasonIndexOf(monthBranch: string): number {
  return SEASON_GROUPS.findIndex((group) => group.includes(monthBranch));
}

/** 母倉（p.7）。月令ごとに複数の地支があり得るため配列で持つ。 */
const MUCANG: Record<string, readonly string[]> = {
  寅: ["亥", "子"],
  卯: ["亥", "子"],
  辰: ["亥", "子", "巳", "午"],
  巳: ["寅", "卯"],
  午: ["寅", "卯"],
  未: ["寅", "卯", "巳", "午"],
  申: ["辰", "戌", "丑", "未"],
  酉: ["辰", "戌", "丑", "未"],
  戌: ["辰", "戌", "丑", "未", "巳", "午"],
  亥: ["申", "酉"],
  子: ["申", "酉"],
  丑: ["申", "酉", "巳", "午"],
};

/** 四相（p.8）。季節区分ごとに天干2つ。春=丙丁、夏=戊己、秋=壬癸、冬=甲乙。 */
const SIXIANG_BY_SEASON: readonly (readonly string[])[] = [
  ["丙", "丁"], // 春（寅卯辰）
  ["戊", "己"], // 夏（巳午未）
  ["壬", "癸"], // 秋（申酉戌）
  ["甲", "乙"], // 冬（亥子丑）
];

/** 時徳（p.8）。季節区分ごとに地支1つ。春=午、夏=辰、秋=子、冬=寅。 */
const JIDE_BY_SEASON: readonly string[] = ["午", "辰", "子", "寅"];

/** 王官守相民日（p.8）。季節区分ごとに地支1つずつ。 */
const WANG_BY_SEASON: readonly string[] = ["寅", "巳", "申", "亥"];
const GUAN_BY_SEASON: readonly string[] = ["卯", "午", "酉", "子"];
const SHOU_BY_SEASON: readonly string[] = ["辰", "未", "戌", "丑"];
const XIANG_BY_SEASON: readonly string[] = ["巳", "申", "亥", "寅"];
const MIN_BY_SEASON: readonly string[] = ["午", "酉", "子", "卯"];

/**
 * 「Ⅰ 神殺の原理　日家吉神」第2グループ（母倉・四相・時徳・王日・官日・
 * 守日・相日・民日）を判定する。凶神は今回未実装のため kyojin は常に空配列。
 */
export function resolveKichijinGroup2(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const season = seasonIndexOf(monthBranch);

  const kichijin: string[] = [];

  if (MUCANG[monthBranch]?.includes(dayBranch)) kichijin.push("母倉");

  if (season !== -1) {
    if (SIXIANG_BY_SEASON[season].includes(dayStem)) kichijin.push("四相");
    if (JIDE_BY_SEASON[season] === dayBranch) kichijin.push("時徳");
    if (WANG_BY_SEASON[season] === dayBranch) kichijin.push("王日");
    if (GUAN_BY_SEASON[season] === dayBranch) kichijin.push("官日");
    if (SHOU_BY_SEASON[season] === dayBranch) kichijin.push("守日");
    if (XIANG_BY_SEASON[season] === dayBranch) kichijin.push("相日");
    if (MIN_BY_SEASON[season] === dayBranch) kichijin.push("民日");
  }

  return { kichijin, kyojin: [] };
}
