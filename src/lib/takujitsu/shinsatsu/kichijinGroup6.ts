// src/lib/takujitsu/shinsatsu/kichijinGroup6.ts
//
// 役割:
//   擇日「Ⅰ 神殺の原理　日家吉神」のうち、農暦月番号（CalendarResult.lunarMonth）
//   が必要なため保留していた天願・季分を実装する。
//   docs/source/擇日テキスト.pdf の該当ページの表を、一般化・要約せずそのまま
//   ロジック化した。他グループのファイル（kichijin.ts 〜 kichijinGroup5.ts）・
//   CalendarEngine・src/lib/calendar/lunisolar.ts は一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf（このPDF以外は一切参照していない）。
//     ・11）天願（てんがん）p.7
//     ・44）季分（きぶん）  p.20（座標抽出で全行確認済み。行ごとに月→
//       干支リストが素直に並んでおり、item18/28で見つかったような
//       列優先の並び替えトラップはないことを確認済み）
//   要約・補完・推測はしていない。
//
// 判定キーについて（重要・依頼の実装条件どおり）:
//   天願・季分はいずれも「正月は◯◯、2月は◯◯…」という形で月を指定して
//   おり、天願の項は「月は新暦ではなく農暦でみてください」と明記している。
//   これは monthBranch（月令＝月建、節入りで確定する月支）とは別物であり、
//   CalendarResult.lunarMonth（農暦月、朔と中気で確定する月番号。
//   src/lib/calendar/lunisolar.ts）をそのまま判定キーとして使う。
//   monthBranch を使う既存の神殺（第1〜5グループ）には一切触れていない。
//
// 検証区分:
//   天願・季分はいずれも農暦月（lunarMonth）＋日干支で決まる。
//   擇日実例.pdf は月令（月建、節月）で構成された一覧表であり農暦月とは
//   別の暦であるため照合対象にできない（区分B・実例PDFに出現しない扱い）。
//   ロジック単体テストのみで検証する
//   （tests/takujitsu_kichijin_group6_unit.manual.ts 参照）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/**
 * ［区分B］天願（p.7）。農暦月（lunarMonth）ごとの固定日干支1つ。
 * 「月は新暦ではなく農暦でみてください」とテキストが明記している。
 */
const TIANYUAN_BY_LUNAR_MONTH: Record<number, string> = {
  1: "甲午",
  2: "甲戌",
  3: "乙酉",
  4: "丙子",
  5: "丁丑",
  6: "戊午",
  7: "甲寅",
  8: "丙辰",
  9: "辛卯",
  10: "戊辰",
  11: "甲子",
  12: "癸未",
};

/**
 * ［区分B］季分（p.20）。農暦月（lunarMonth）ごとの固定日干支列挙
 * （PyMuPDFの座標抽出で全行を確認済み。天願と同じ「正月・二月…」の
 * 月ラベル形式のため、天願と同じく農暦月をキーとして扱う）。
 */
const JIFEN_BY_LUNAR_MONTH: Record<number, readonly string[]> = {
  1: ["壬午", "戊子", "丙午", "壬子", "辛未", "己未", "乙卯", "癸卯"],
  2: ["戊寅", "乙未", "癸丑"],
  3: ["戊子", "壬寅", "甲寅", "丁卯", "己卯", "庚午"],
  4: ["乙卯", "己卯", "丁卯", "辛卯", "癸卯"],
  5: ["乙丑", "丁丑", "己丑", "辛丑", "癸丑"],
  6: ["己卯", "戊寅", "庚辰", "己未"],
  7: ["丙子", "壬子", "丙辰", "己未"],
  8: ["乙丑", "丁丑", "己丑", "癸丑", "己巳"],
  9: ["己卯", "己巳", "丙午", "己未"],
  10: ["丁卯", "辛未", "戊辰", "丁未", "乙卯"],
  11: ["戊辰", "甲辰", "丙辰"],
  12: ["戊寅", "壬寅", "甲寅", "戊辰", "己巳", "癸巳", "乙巳"],
};

/**
 * 天願・季分（農暦月番号が必要なため保留していた吉神）を判定する。
 * 凶神は今回未実装のため kyojin は常に空配列。
 *
 * input.lunarMonth が未指定の場合（呼び出し側が農暦計算を行っていない場合）は
 * 何も判定しない（未確定の値を仮決めしない）。
 */
export function resolveKichijinGroup6(input: ShinsatsuInput): ShinsatsuResult {
  const { dayStem, dayBranch, lunarMonth } = input;
  const kichijin: string[] = [];

  if (lunarMonth !== undefined) {
    const dayGanzhi = `${dayStem}${dayBranch}`;
    if (TIANYUAN_BY_LUNAR_MONTH[lunarMonth] === dayGanzhi) kichijin.push("天願");
    if (JIFEN_BY_LUNAR_MONTH[lunarMonth]?.includes(dayGanzhi)) kichijin.push("季分");
  }

  return { kichijin, kyojin: [] };
}
