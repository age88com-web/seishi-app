// src/lib/takujitsu/shinsatsu/kichijinGroup3.ts
//
// 役割:
//   擇日「Ⅰ 神殺の原理　日家吉神」第3グループの判定。
//     三合・六合・五合・鳴吠・鳴吠對
//   docs/source/擇日テキスト.pdf p.9〜p.11 の表を、一般化・要約せずそのまま
//   ロジック化した。src/lib/takujitsu/shinsatsu/kichijin.ts（第1グループ）・
//   kichijinGroup2.ts（第2グループ）は一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf（このPDF以外は一切参照していない）。
//     ・15）三合   p.9（月建と日辰が三合会局する）
//     ・16）六合   p.9（月建と日辰が支合する日。別名 無翹）
//     ・17）五合   p.10（地支が寅・卯になる日。干支ごとに固定列挙）
//     ・19）鳴吠・鳴吠對 p.11（固定の日干支一覧。鳴吠日と鳴吠對日は沖になる日）
//   要約・補完・推測はしていない。CalendarEngine（src/lib/calendar/）は
//   一切変更しない・依存もしない値の受け渡しのみ。
//
// 検証区分（前回までと同じ考え方）:
//   三合・六合はいずれも「月令（月建）＋日辰（日干支）」だけで決まるため
//   区分A（実例PDF照合対象）。五合・鳴吠・鳴吠對は月令に関係なく、
//   資料に列挙された固定の日干支のみで決まるが、これも「日辰（日干支）」
//   だけで決まる＝区分Aに含める（実例PDFの一覧表と全件照合可能）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/**
 * 三合（p.9）。月建ごとに、三合会局する残り2支（月建自身は含まない）。
 * 例: 月建=寅の三合会局は寅午戌のため、表の値は「午・戌」。
 */
const SANHE: Record<string, readonly string[]> = {
  寅: ["午", "戌"],
  卯: ["亥", "未"],
  辰: ["申", "子"],
  巳: ["酉", "丑"],
  午: ["寅", "戌"],
  未: ["亥", "卯"],
  申: ["子", "辰"],
  酉: ["巳", "丑"],
  戌: ["寅", "午"],
  亥: ["卯", "未"],
  子: ["申", "辰"],
  丑: ["巳", "酉"],
};

/** 六合（p.9）。月建と支合する地支。 */
const LIUHE: Record<string, string> = {
  寅: "亥", 卯: "戌", 辰: "酉", 巳: "申", 午: "未", 未: "午",
  申: "巳", 酉: "辰", 戌: "卯", 亥: "寅", 子: "丑", 丑: "子",
};

/** 五合（p.10）。地支が寅・卯になる日干支の固定列挙（推測で一般化しない）。 */
const WUHE_GANZHI: readonly string[] = [
  "甲寅", "乙卯", "丙寅", "丁卯", "戊寅", "己卯", "庚寅", "辛卯", "壬寅", "癸卯",
];

/** 鳴吠日（p.11）。固定の日干支一覧。 */
const MINGFEI_GANZHI: readonly string[] = [
  "甲午", "甲申", "乙酉", "丙午", "丙申", "丁酉",
  "庚午", "庚申", "己酉", "壬午", "壬申", "辛酉", "癸酉",
];

/** 鳴吠對日（p.11）。固定の日干支一覧。 */
const MINGFEIDUI_GANZHI: readonly string[] = [
  "丙子", "甲寅", "乙卯", "庚子", "丙寅", "丁卯", "壬子", "庚寅", "辛卯", "壬寅", "癸卯",
];

/**
 * 「Ⅰ 神殺の原理　日家吉神」第3グループ（三合・六合・五合・鳴吠・鳴吠對）を
 * 判定する。凶神は今回未実装のため kyojin は常に空配列。
 */
export function resolveKichijinGroup3(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const dayGanzhi = `${dayStem}${dayBranch}`;

  const kichijin: string[] = [];

  if (SANHE[monthBranch]?.includes(dayBranch)) kichijin.push("三合");
  if (LIUHE[monthBranch] === dayBranch) kichijin.push("六合");
  if (WUHE_GANZHI.includes(dayGanzhi)) kichijin.push("五合");
  if (MINGFEI_GANZHI.includes(dayGanzhi)) kichijin.push("鳴吠");
  if (MINGFEIDUI_GANZHI.includes(dayGanzhi)) kichijin.push("鳴吠對");

  return { kichijin, kyojin: [] };
}
