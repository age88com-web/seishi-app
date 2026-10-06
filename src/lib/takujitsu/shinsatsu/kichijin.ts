// src/lib/takujitsu/shinsatsu/kichijin.ts
//
// 役割:
//   擇日「Ⅰ 神殺の原理　日家吉神」冒頭7項目の判定。
//     天徳・月徳・天徳合・月徳合・歳徳・歳徳合・天赦
//   docs/source/擇日テキスト.pdf p.3〜p.6 の表を、一般化・要約せずそのまま
//   ロジック化した。この7項目より後（天恩・月空以降）は今回実装しない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf（このPDF以外は一切参照していない）。
//     ・1）天徳（天道）   p.3
//     ・2）月徳           p.3
//     ・3）天徳合         p.4
//     ・4）月徳合         p.4
//     ・5）歳徳・歳徳合   p.5
//     ・6）天赦           p.6
//   要約・補完・推測はしていない。CalendarEngine（src/lib/calendar/）は
//   一切変更しない・依存もしない値の受け渡しのみ（呼び出し側が
//   CalendarResult から取り出した年干支・月支・日干支を渡す）。
//
// 検証区分（重要）:
//   docs/source/擇日実例.pdf の一覧表は「月令（月建）＋日辰（日干支）」の
//   組み合わせだけで現れる神殺を中心とした実例表であり、年干・季節・方位
//   など月令＋日辰以外の条件を使う神殺は、この実例表に出ていないというだけの
//   理由で不正解・未実装扱いにはしない（削除・変更もしない）。そのため
//   検証を2種類に分けている。
//     A. 実例PDF照合テスト（月令＋日辰だけで決まる神殺）
//        → 天徳・月徳・天徳合・月徳合・天赦
//        → tests/takujitsu_kichijin.manual.ts で
//          docs/source/擇日実例.pdf 由来の fixture と全件照合する。
//     B. ロジック単体テスト（年干など、月令＋日辰だけでは決まらない神殺）
//        → 歳徳・歳徳合（年干をキーに使うため実例PDFの一覧表には出現しない）
//        → tests/takujitsu_kichijin_unit.manual.ts で、擇日テキストp.5の
//          表そのもの（年干10種）と実例1・2で個別に検証する。
//
// 仕様差異・未解決点（推測で埋めず、事実として記録する）:
//   ・天徳／天徳合の表は、月令が卯・午・酉・子（四仲）のとき値が
//     十干ではなく四維（坤・乾・艮・巽）になる。p.3の見出しに
//     「日干だけでなく、方位も入っている」とあるが、方位（四維）が
//     具体的にどの日干支と対応して「その日が天徳／天徳合である」と
//     判定されるのかは、このテキストのどこにも明記されていない。
//     本実装では表の値をそのまま日干と比較するため、四維が入る4つの
//     月（卯・午・酉・子）では天徳／天徳合は判定上つねに不成立になる
//     （日干は十干であり四維とは一致し得ないため）。これは推測で
//     補って解消せず、仕様上の未解決点として扱う（区分Aの実例照合
//     テストで、この4ヶ月について擇日実例.pdf 自身も天徳／天徳合を
//     一度も掲載していないことを確認済み＝この挙動と実例表は矛盾しない）。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/** ［区分A・実例PDF照合対象］天徳（p.3）。月令ごとの値。卯・午・酉・子は十干ではなく四維（坤・乾・艮・巽）。 */
const TIANDE: Record<string, string> = {
  寅: "丁", 卯: "坤", 辰: "壬", 巳: "辛", 午: "乾", 未: "甲",
  申: "癸", 酉: "艮", 戌: "丙", 亥: "乙", 子: "巽", 丑: "庚",
};

/** ［区分A・実例PDF照合対象］月徳（p.3）。 */
const YUEDE: Record<string, string> = {
  寅: "丙", 卯: "甲", 辰: "壬", 巳: "庚", 午: "丙", 未: "甲",
  申: "壬", 酉: "庚", 戌: "丙", 亥: "甲", 子: "壬", 丑: "庚",
};

/** ［区分A・実例PDF照合対象］天徳合（p.4）。天徳と合になる干（四維の月は天徳合も四維）。 */
const TIANDEHE: Record<string, string> = {
  寅: "壬", 卯: "巽", 辰: "丁", 巳: "丙", 午: "艮", 未: "己",
  申: "戊", 酉: "乾", 戌: "辛", 亥: "庚", 子: "坤", 丑: "乙",
};

/** ［区分A・実例PDF照合対象］月徳合（p.4）。月徳と合になる天干。 */
const YUEDEHE: Record<string, string> = {
  寅: "辛", 卯: "己", 辰: "丁", 巳: "乙", 午: "辛", 未: "己",
  申: "丁", 酉: "乙", 戌: "辛", 亥: "己", 子: "丁", 丑: "乙",
};

/** ［区分B・ロジック単体テスト対象（年干を使用）］歳徳（p.5）。歳徳は年の天干と同じ干。 */
const SUIDE: Record<string, string> = {
  甲: "甲", 乙: "乙", 丙: "丙", 丁: "丁", 戊: "戊",
  己: "己", 庚: "庚", 辛: "辛", 壬: "壬", 癸: "癸",
};

/** ［区分B・ロジック単体テスト対象（年干を使用）］歳徳合（p.5）。歳徳と合になる干。 */
const SUIDEHE: Record<string, string> = {
  甲: "己", 乙: "庚", 丙: "辛", 丁: "壬", 戊: "癸",
  己: "甲", 庚: "乙", 辛: "丙", 壬: "丁", 癸: "戊",
};

/** ［区分A・実例PDF照合対象］天赦（p.6）。季節ごとに固定の干支1つ。月令の四季区分は寅卯辰＝春、巳午未＝夏、申酉戌＝秋、亥子丑＝冬。 */
const TIANSHE_GROUPS: readonly [readonly string[], string][] = [
  [["寅", "卯", "辰"], "戊寅"],
  [["巳", "午", "未"], "甲午"],
  [["申", "酉", "戌"], "戊申"],
  [["亥", "子", "丑"], "甲子"],
];

function tianSheGanzhiFor(monthBranch: string): string | undefined {
  for (const [branches, ganzhi] of TIANSHE_GROUPS) {
    if (branches.includes(monthBranch)) return ganzhi;
  }
  return undefined;
}

/**
 * 「Ⅰ 神殺の原理　日家吉神」冒頭7項目を判定する。
 * 凶神は今回未実装のため kyojin は常に空配列。
 */
export function resolveKichijin(input: ShinsatsuInput): ShinsatsuResult {
  const { yearStem, monthBranch, dayStem, dayBranch } = input;
  const dayGanzhi = `${dayStem}${dayBranch}`;

  const kichijin: string[] = [];
  if (TIANDE[monthBranch] === dayStem) kichijin.push("天徳");
  if (YUEDE[monthBranch] === dayStem) kichijin.push("月徳");
  if (TIANDEHE[monthBranch] === dayStem) kichijin.push("天徳合");
  if (YUEDEHE[monthBranch] === dayStem) kichijin.push("月徳合");
  if (SUIDE[yearStem] === dayStem) kichijin.push("歳徳");
  if (SUIDEHE[yearStem] === dayStem) kichijin.push("歳徳合");
  if (tianSheGanzhiFor(monthBranch) === dayGanzhi) kichijin.push("天赦");

  return { kichijin, kyojin: [] };
}
