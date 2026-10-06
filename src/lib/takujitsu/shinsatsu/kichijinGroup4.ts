// src/lib/takujitsu/shinsatsu/kichijinGroup4.ts
//
// 役割:
//   擇日「Ⅰ 神殺の原理　日家吉神」のうち、第1〜第3グループ未実装だった
//   吉神のうち、CalendarEngine の現行出力（年干支・月支＝月令・日干支）
//   だけで判定できるものをまとめて実装する。
//   docs/source/擇日テキスト.pdf の該当ページの表を、一般化・要約せずそのまま
//   ロジック化した。他グループのファイルは一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf（このPDF以外は一切参照していない）。
//     ・9）月恩                 p.5
//     ・18）寶義制専伐日（寶日・義日・専日・制日・伐日）p.9-10
//     ・20）要安/玉宇/金堂/啓安/普護/福生/聖心/益後/續世 p.11
//     ・21）五富                p.12
//     ・22）天倉                p.12
//     ・23）陽徳・陰徳          p.13
//     ・25）六儀                p.14
//     ・26）驛馬                p.14
//     ・27）天馬                p.15
//     ・28）青龍・明堂・金匱・天徳（寶光）・玉堂・司命
//           （同項目のうち天刑・朱雀・白虎・天牢・元武・勾陳は凶のため対象外）p.15
//     ・29）解神                p.16
//     ・30）臨日                p.16
//     ・31）兵福                p.16
//     ・39）天瑞・天福          p.18
//     ・42）天貴・催官          p.18
//   要約・補完・推測はしていない。CalendarEngine（src/lib/calendar/）は
//   一切変更しない・依存もしない値の受け渡しのみ。
//
// 名称の重複について:
//   p.28の「天徳（寶光）」は、第1グループで既に実装済みの「天徳」
//   （p.3、月令→天干で判定する別概念）と表記が重なるため、資料が
//   併記しているカッコ内の別名「寶光」をこのモジュールでの名称として
//   採用する（内容の混同を避けるため。判定ロジックはp.28の表のとおり）。
//
// 検証区分:
//   すべて「月令（月建）＋日辰（日干支）」または「季節区分」＋
//   「日干支」で決まるため区分A（実例PDF照合対象）。ただし
//   天瑞・天福・天貴・催官は docs/source/擇日実例.pdf に一度も出現しない
//   （0件）ため区分B（ロジック単体テストのみ）として扱う。
//   詳細は tests/takujitsu_kichijin_group4.manual.ts /
//   tests/takujitsu_kichijin_group4_unit.manual.ts を参照。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/** ［区分A］月恩（p.5）。月令が生ずる場所の干。 */
const YUEEN: Record<string, string> = {
  寅: "丙", 卯: "丁", 辰: "庚", 巳: "己", 午: "戊", 未: "辛",
  申: "壬", 酉: "癸", 戌: "庚", 亥: "乙", 子: "甲", 丑: "辛",
};

/**
 * ［区分A］寶日・義日・専日・制日・伐日（p.9-10）。60干支を過不足なく
 * 5種×12干支に分割する原典の表をそのままロジック化した（合計60干支）。
 * 寶日・義日・専日は吉神、制日・伐日は原文注記「使えない日（凶）」に
 * 従い凶神として扱う。
 */
const BAO_GANZHI: readonly string[] = [
  "甲午", "乙巳", "丙戌", "丙辰", "丁未", "丁丑", "戊申", "己酉", "庚子", "辛亥", "壬寅", "癸卯",
];
const YI_GANZHI: readonly string[] = [
  "甲子", "乙亥", "丙寅", "丁卯", "戊午", "己巳", "庚戌", "庚辰", "辛未", "辛丑", "壬申", "癸酉",
];
const ZHUAN_GANZHI: readonly string[] = [
  "甲寅", "乙卯", "丙午", "丁巳", "戊戌", "戊辰", "己未", "己丑", "庚申", "辛酉", "壬子", "癸亥",
];
/** ［区分A・凶］制日（p.9-10）。原文注記「制日も使えない日、目上の人を押さえつけるという意味がある」。 */
const ZHIRI_GANZHI: readonly string[] = [
  "甲戌", "甲辰", "乙未", "乙丑", "丙申", "丁酉", "戊子", "己亥", "庚寅", "辛卯", "壬午", "癸巳",
];
/** ［区分A・凶］伐日（p.9-10）。原文注記「伐日は使えない日（凶）」。 */
const FARI_GANZHI: readonly string[] = [
  "甲申", "乙酉", "丙子", "丁亥", "戊寅", "己卯", "庚午", "辛巳", "壬戌", "壬辰", "癸未", "癸丑",
];

/** ［区分A］要安〜續世（p.11）。月令ごとの地支。9項目とも同じ構造。 */
const YAOAN: Record<string, string> = { 寅:"寅", 卯:"申", 辰:"卯", 巳:"酉", 午:"辰", 未:"戌", 申:"巳", 酉:"亥", 戌:"午", 亥:"子", 子:"未", 丑:"丑" };
const YUYU: Record<string, string> = { 寅:"卯", 卯:"酉", 辰:"辰", 巳:"戌", 午:"巳", 未:"亥", 申:"午", 酉:"子", 戌:"未", 亥:"丑", 子:"申", 丑:"寅" };
const JINTANG: Record<string, string> = { 寅:"辰", 卯:"戌", 辰:"巳", 巳:"亥", 午:"午", 未:"子", 申:"未", 酉:"丑", 戌:"申", 亥:"寅", 子:"酉", 丑:"卯" };
const QIAN: Record<string, string> = { 寅:"未", 卯:"丑", 辰:"申", 巳:"寅", 午:"酉", 未:"卯", 申:"戌", 酉:"辰", 戌:"亥", 亥:"巳", 子:"子", 丑:"午" };
const PUHU: Record<string, string> = { 寅:"申", 卯:"寅", 辰:"酉", 巳:"卯", 午:"戌", 未:"辰", 申:"亥", 酉:"巳", 戌:"子", 亥:"午", 子:"丑", 丑:"未" };
const FUSHENG: Record<string, string> = { 寅:"酉", 卯:"卯", 辰:"戌", 巳:"辰", 午:"亥", 未:"巳", 申:"子", 酉:"午", 戌:"丑", 亥:"未", 子:"寅", 丑:"申" };
const SHENGXIN: Record<string, string> = { 寅:"亥", 卯:"巳", 辰:"子", 巳:"午", 午:"丑", 未:"未", 申:"寅", 酉:"申", 戌:"卯", 亥:"酉", 子:"辰", 丑:"戌" };
const YIHOU: Record<string, string> = { 寅:"子", 卯:"午", 辰:"丑", 巳:"未", 午:"寅", 未:"申", 申:"卯", 酉:"酉", 戌:"辰", 亥:"戌", 子:"巳", 丑:"亥" };
const XUSHI: Record<string, string> = { 寅:"丑", 卯:"未", 辰:"寅", 巳:"申", 午:"卯", 未:"酉", 申:"辰", 酉:"戌", 戌:"巳", 亥:"亥", 子:"午", 丑:"子" };

/** 三合の長生局グループ（寅午戌＝火局、亥卯未＝木局、申子辰＝水局、巳酉丑＝金局）。五富・驛馬で使用。 */
const SANHE_TRIO_GROUPS: readonly (readonly string[])[] = [
  ["寅", "午", "戌"],
  ["亥", "卯", "未"],
  ["申", "子", "辰"],
  ["巳", "酉", "丑"],
];
function trioIndexOf(monthBranch: string): number {
  return SANHE_TRIO_GROUPS.findIndex((g) => g.includes(monthBranch));
}

/** ［区分A］五富（p.12）。三合の長生と合になる地支。 */
const WUFU_BY_TRIO: readonly string[] = ["亥", "寅", "巳", "申"];
/** ［区分A］驛馬（p.14）。 */
const YIMA_BY_TRIO: readonly string[] = ["申", "巳", "寅", "亥"];

/** ［区分A］天倉（p.12）。 */
const TIANCANG: Record<string, string> = { 寅:"寅", 卯:"丑", 辰:"子", 巳:"亥", 午:"戌", 未:"酉", 申:"申", 酉:"未", 戌:"午", 亥:"巳", 子:"辰", 丑:"卯" };

/** ［区分A］陽徳（p.13）。 */
const YANGDE: Record<string, string> = { 寅:"戌", 卯:"子", 辰:"寅", 巳:"辰", 午:"午", 未:"申", 申:"戌", 酉:"子", 戌:"寅", 亥:"辰", 子:"午", 丑:"申" };
/** ［区分A］陰徳（p.13）。 */
const YINDE: Record<string, string> = { 寅:"酉", 卯:"未", 辰:"巳", 巳:"卯", 午:"丑", 未:"亥", 申:"酉", 酉:"未", 戌:"巳", 亥:"卯", 子:"丑", 丑:"亥" };

/** ［区分A］六儀（p.14）。正月を辰として十二支を逆行。 */
const LIUYI: Record<string, string> = { 寅:"辰", 卯:"卯", 辰:"寅", 巳:"丑", 午:"子", 未:"亥", 申:"戌", 酉:"酉", 戌:"申", 亥:"未", 子:"午", 丑:"巳" };

/** ［区分A］天馬（p.15）。 */
const TIANMA: Record<string, string> = { 寅:"午", 卯:"申", 辰:"戌", 巳:"子", 午:"寅", 未:"辰", 申:"午", 酉:"申", 戌:"戌", 亥:"子", 子:"寅", 丑:"辰" };

/**
 * ［区分A］p.28の十二神表のうち吉の6項目（青龍・明堂・金匱・寶光・玉堂・司命）。
 * 天刑・朱雀・白虎・天牢・元武・勾陳は資料が凶と明記しているため対象外。
 */
const QINGLONG: Record<string, string> = { 寅:"子", 卯:"寅", 辰:"辰", 巳:"午", 午:"申", 未:"戌", 申:"子", 酉:"寅", 戌:"辰", 亥:"午", 子:"申", 丑:"戌" };
const MINGTANG: Record<string, string> = { 寅:"丑", 卯:"卯", 辰:"巳", 巳:"未", 午:"酉", 未:"亥", 申:"丑", 酉:"卯", 戌:"巳", 亥:"未", 子:"酉", 丑:"亥" };
const JINGUI: Record<string, string> = { 寅:"辰", 卯:"午", 辰:"申", 巳:"戌", 午:"子", 未:"寅", 申:"辰", 酉:"午", 戌:"申", 亥:"戌", 子:"子", 丑:"寅" };
const BAOGUANG: Record<string, string> = { 寅:"巳", 卯:"未", 辰:"酉", 巳:"亥", 午:"丑", 未:"卯", 申:"巳", 酉:"未", 戌:"酉", 亥:"亥", 子:"丑", 丑:"卯" };
const YUTANG: Record<string, string> = { 寅:"未", 卯:"酉", 辰:"亥", 巳:"丑", 午:"卯", 未:"巳", 申:"未", 酉:"酉", 戌:"亥", 亥:"丑", 子:"卯", 丑:"巳" };
const SIMING: Record<string, string> = { 寅:"戌", 卯:"子", 辰:"寅", 巳:"辰", 午:"午", 未:"申", 申:"戌", 酉:"子", 戌:"寅", 亥:"辰", 子:"午", 丑:"申" };

/** ［区分A］解神（p.16）。月令2ヶ月ごとのグループ→地支（正二月/三四月/五六月/七八月/九十月/十一十二月）。 */
const JIESHEN: Record<string, string> = { 寅:"申", 卯:"申", 辰:"戌", 巳:"戌", 午:"子", 未:"子", 申:"寅", 酉:"寅", 戌:"辰", 亥:"辰", 子:"午", 丑:"午" };

/** ［区分A］臨日（p.16）。 */
const LINRI: Record<string, string> = { 寅:"午", 卯:"亥", 辰:"申", 巳:"丑", 午:"戌", 未:"卯", 申:"子", 酉:"巳", 戌:"寅", 亥:"未", 子:"辰", 丑:"酉" };

/** ［区分B・実例PDFに出現しないためロジック単体テストのみ］天瑞・天福（p.18）。固定日干支列挙。 */
const TIANRUI_GANZHI: readonly string[] = ["戊寅", "己卯", "庚寅", "辛巳", "壬子"];
const TIANFU_GANZHI: readonly string[] = ["乙巳", "己巳", "己亥", "庚子", "庚寅", "辛丑", "辛卯", "壬辰", "癸巳"];

/** 季節区分（寅卯辰＝春、巳午未＝夏、申酉戌＝秋、亥子丑＝冬）。天貴・催官で使用。 */
const SEASON_GROUPS: readonly (readonly string[])[] = [
  ["寅", "卯", "辰"],
  ["巳", "午", "未"],
  ["申", "酉", "戌"],
  ["亥", "子", "丑"],
];
function seasonIndexOf(monthBranch: string): number {
  return SEASON_GROUPS.findIndex((g) => g.includes(monthBranch));
}
/** ［区分B・実例PDFに出現しないためロジック単体テストのみ］天貴（p.18）。季節ごとの天干（複数可）。 */
const TIANGUI_BY_SEASON: readonly (readonly string[])[] = [["甲"], ["丙", "丁"], ["庚", "辛"], ["壬", "癸"]];
/** ［区分B］催官（p.18）。季節ごとの天干。 */
const CUIGUAN_BY_SEASON: readonly string[] = ["乙", "丁", "辛", "癸"];

/**
 * 「Ⅰ 神殺の原理　日家吉神」のうち、第1〜第3グループ未実装で
 * CalendarEngine の現行出力だけで判定できる吉神をまとめて判定する。
 * kyojin は寶義制専伐日のうち凶とされる制日・伐日のみ（日干支の固定列挙、
 * p.9-10）。他の凶神グループは本ファイルの対象外。
 */
export function resolveKichijinGroup4(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const dayGanzhi = `${dayStem}${dayBranch}`;
  const trio = trioIndexOf(monthBranch);
  const season = seasonIndexOf(monthBranch);

  const kichijin: string[] = [];
  const kyojin: string[] = [];

  if (YUEEN[monthBranch] === dayStem) kichijin.push("月恩");
  if (BAO_GANZHI.includes(dayGanzhi)) kichijin.push("寶日");
  if (YI_GANZHI.includes(dayGanzhi)) kichijin.push("義日");
  if (ZHUAN_GANZHI.includes(dayGanzhi)) kichijin.push("専日");
  if (ZHIRI_GANZHI.includes(dayGanzhi)) kyojin.push("制日");
  if (FARI_GANZHI.includes(dayGanzhi)) kyojin.push("伐日");

  if (YAOAN[monthBranch] === dayBranch) kichijin.push("要安");
  if (YUYU[monthBranch] === dayBranch) kichijin.push("玉宇");
  if (JINTANG[monthBranch] === dayBranch) kichijin.push("金堂");
  if (QIAN[monthBranch] === dayBranch) kichijin.push("啓安");
  if (PUHU[monthBranch] === dayBranch) kichijin.push("普護");
  if (FUSHENG[monthBranch] === dayBranch) kichijin.push("福生");
  if (SHENGXIN[monthBranch] === dayBranch) kichijin.push("聖心");
  if (YIHOU[monthBranch] === dayBranch) kichijin.push("益後");
  if (XUSHI[monthBranch] === dayBranch) kichijin.push("續世");

  if (trio !== -1) {
    if (WUFU_BY_TRIO[trio] === dayBranch) kichijin.push("五富");
    if (YIMA_BY_TRIO[trio] === dayBranch) kichijin.push("驛馬");
  }

  if (TIANCANG[monthBranch] === dayBranch) kichijin.push("天倉");
  if (YANGDE[monthBranch] === dayBranch) kichijin.push("陽徳");
  if (YINDE[monthBranch] === dayBranch) kichijin.push("陰徳");
  if (LIUYI[monthBranch] === dayBranch) kichijin.push("六儀");
  if (TIANMA[monthBranch] === dayBranch) kichijin.push("天馬");

  if (QINGLONG[monthBranch] === dayBranch) kichijin.push("青龍");
  if (MINGTANG[monthBranch] === dayBranch) kichijin.push("明堂");
  if (JINGUI[monthBranch] === dayBranch) kichijin.push("金匱");
  if (BAOGUANG[monthBranch] === dayBranch) kichijin.push("寶光");
  if (YUTANG[monthBranch] === dayBranch) kichijin.push("玉堂");
  if (SIMING[monthBranch] === dayBranch) kichijin.push("司命");

  if (JIESHEN[monthBranch] === dayBranch) kichijin.push("解神");
  if (LINRI[monthBranch] === dayBranch) kichijin.push("臨日");
  if (monthBranch === dayBranch) kichijin.push("兵福");

  if (TIANRUI_GANZHI.includes(dayGanzhi)) kichijin.push("天瑞");
  if (TIANFU_GANZHI.includes(dayGanzhi)) kichijin.push("天福");

  if (season !== -1) {
    if (TIANGUI_BY_SEASON[season].includes(dayStem)) kichijin.push("天貴");
    if (CUIGUAN_BY_SEASON[season] === dayStem) kichijin.push("催官");
  }

  return { kichijin, kyojin };
}
