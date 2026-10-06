// src/lib/takujitsu/shinsatsu/kyoushinGroup4.ts
//
// 役割:
//   擇日「日家凶神」第4グループ。凶神第3グループで保留した項目のうち、
//   「日干支（dayGanzhi）の固定列挙」で判定できるものをまとめて実装する。
//   docs/source/擇日テキスト.pdf の該当ページを、一般化・要約せずそのまま
//   ロジック化した。既存の吉神ファイル・kyoushinGroup1〜3.ts・jianchu.ts・
//   shuku28.ts・src/lib/calendar/（CalendarEngine・lunisolar含む）は
//   一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf「日家凶神」章（このPDF以外は一切参照していない）。
//   すべて PyMuPDF 座標抽出＋原本ページの高倍率画像確認で表を確認済み
//   （複数の表・側注が近接して配置されているページが多く、フラットな
//   テキスト抽出や単純な座標の最近傍対応だけでは誤読する箇所が
//   複数見つかったため、疑わしい箇所は必ず画像で最終確認した）。
//     ・15）地嚢               p.24（土符は凶神第3グループで実装済み）
//     ・18）四撃・四耗・四廢・四忌・四窮・五虚 p.25-26
//     ・19）五墓               p.26
//     ・20）八風・觸水龍       p.27
//     ・21）八専               p.27
//     ・24）無禄               p.28
//   要約・補完・推測はしていない。
//
// 判定キーについて（依頼どおり「日干支の固定列挙」でまとめた）:
//   すべて対象日の日干支（dayStem＋dayBranch）が、monthBranch（月令）や
//   季節（寅卯辰＝春等）で選ばれる固定の干支（または干支の組）と一致
//   するかで判定する。地嚢・五墓は月令ごとに、四撃〜五虚・八風・觸水龍は
//   季節ごとに対象の干支（または地支）が変わり、八専・無禄は月令に関係ない
//   固定列挙（無禄は日干ごとの固定地支＝実質は固定10干支列挙）。
//
//   四撃・五虚のみ、最終的な比較対象が「地支」（四撃）または「地支3つの
//   組」（五虚）であり、他の項目のような「干支そのもの」ではない。これは
//   擇日テキストp.25-26の表自体がそのような構造になっているためで
//   （四撃列は干支ではなく地支1つ、五虚列は地支3つの組）、推測で
//   ganzhi化していない。表の構造をそのまま実装した結果である。
//
// 表の読み取りに関する重要な訂正（画像で確認済み）:
//   ・19）五墓のp.26原本の表は、寅・卯／巳・午／申・酉／亥・子の4組が
//     それぞれセル結合されて1つの干支を共有している（辰・未・戌・丑は
//     単独）。当初のPyMuPDF座標抽出では結合セルの片方の地支しか
//     値を拾えず「卯・午・酉・子は該当なし」と誤読していたが、
//     原本画像で確認したところ実際は「寅と卯は同じ乙未」等、地支2つで
//     1つの五墓を共有する構造だった。訂正後の値で実装している。
//   ・20）八風の列は「地支×2＋干支1つ（例：丁丑・己酉）」の形で、
//     観水龍という第2列があるように見えたが、実際は「觸水龍」は
//     八風の表とは別の側注（月令に関係ない固定3干支列挙）であり、
//     八風の列自体が季節ごとに2つの干支を持つ構造だった。原本画像で
//     再確認して訂正している。
//
// 解除条件として記録した事項（今回は実装しない。将来の「神殺解除・相殺」
// フェーズ用の記録のみ）:
//   ・18）四撃・四耗・四廢・四忌・四窮・五虚: 「土旺が重なると更に忌む」
//     （p.25本文）。この「土旺」は、p.25の表の「月令」列に季節の3ヶ月に
//     加えて4つ目の地支（春＝戌、夏＝丑、秋＝辰、冬＝未）が併記されている
//     ことと関係すると考えられるが、本文にはこの4つ目の地支が具体的に
//     何を意味するかの説明がなく、確定できないため実装していない
//     （保留、下記参照）。また「徳合・六合が来れば解除される」
//     （四撃〜五虚共通、p.26本文）も解除条件として記録するのみ。
//   ・19）五墓: 「午月と子月に月徳に遭えば忌まない」（p.26本文）。
//   ・20）八風・觸水龍: 「八風：徳合・六合がくれば解除される」
//     「觸水龍：徳合・天願がくると更に忌む」（p.27本文）。
//
// 保留（今回実装しない。理由を明記）:
//   ・18）の「土旺」に関する4つ目の地支（春＝戌、夏＝丑、秋＝辰、冬＝未）:
//     本文に具体的な用途の説明がなく、単独の判定項目として実装すると
//     推測になるため保留する。
//
// 名称の整理（実例PDFで確認済み。重複実装を避けるため1概念1名称とする）:
//   ・觸水龍: 実例PDFでは「蝕水龍」（触／蝕の字形類似の文字化け）でも
//     出現するためfixtureでのみ許容する。
//   ・無禄: 実例PDFに一度も出現しない（0/720）。擇日テキストp.28の表には
//     明記されているため区分Bとして実装し、単体テストのみで検証する。
//
// 検証区分:
//   地嚢・四撃・四耗・四廢・四忌・四窮・五虚・五墓・八風・觸水龍・八専は
//   実例PDFに出現するため区分A。無禄は実例PDFに出現しないため区分B。

import type { ShinsatsuInput, ShinsatsuResult } from "../types";

/** ［区分A］地嚢（p.24）。月建ごとに固定2干支（土符は凶神第3グループで実装済み）。 */
const DINANG: Record<string, readonly string[]> = {
  寅: ["庚子", "庚午"], 卯: ["癸丑", "癸未"], 辰: ["甲子", "甲寅"], 巳: ["己丑", "己卯"],
  午: ["戊辰", "戊午"], 未: ["癸巳", "癸未"], 申: ["丙寅", "丙申"], 酉: ["丁卯", "丁巳"],
  戌: ["戊子", "戊辰"], 亥: ["庚戌", "庚子"], 子: ["辛未", "辛酉"], 丑: ["乙酉", "乙未"],
};

/** 季節区分（寅卯辰＝春、巳午未＝夏、申酉戌＝秋、亥子丑＝冬）。18）四撃〜五虚、20）八風・觸水龍で使用。 */
const SEASON_GROUPS: readonly (readonly string[])[] = [
  ["寅", "卯", "辰"],
  ["巳", "午", "未"],
  ["申", "酉", "戌"],
  ["亥", "子", "丑"],
];
function seasonIndexOf(monthBranch: string): number {
  return SEASON_GROUPS.findIndex((g) => g.includes(monthBranch));
}

/** ［区分A］四撃（p.25-26）。季節ごとに固定1地支（干支ではなく地支そのもの）。 */
const SIJI_BRANCH_BY_SEASON: readonly string[] = ["戌", "丑", "辰", "未"];
/** ［区分A］四耗（p.25-26）。季節ごとに固定1干支。 */
const SIHAO_BY_SEASON: readonly string[] = ["壬子", "乙卯", "戊午", "辛酉"];
/** ［区分A］四廢（p.25-26）。季節ごとに固定2干支。 */
const SIFEI_BY_SEASON: readonly (readonly string[])[] = [
  ["庚申", "辛酉"], ["壬子", "癸亥"], ["甲寅", "乙卯"], ["丙午", "丁巳"],
];
/** ［区分A］四忌（p.25-26）。季節ごとに固定1干支。 */
const SIJI2_BY_SEASON: readonly string[] = ["甲子", "丙子", "庚子", "壬子"];
/** ［区分A］四窮（p.25-26）。季節ごとに固定1干支。 */
const SIQIONG_BY_SEASON: readonly string[] = ["乙亥", "丁亥", "辛亥", "癸亥"];
/** ［区分A］五虚（p.25-26）。季節ごとに固定3地支の組（干支ではなく地支の組）。 */
const WUXU_TRIO_BY_SEASON: readonly (readonly string[])[] = [
  ["巳", "酉", "丑"], ["申", "子", "辰"], ["亥", "卯", "未"], ["寅", "午", "戌"],
];

/**
 * ［区分A］五墓（p.26）。月建ごとに固定1干支。原本は寅・卯／巳・午／
 * 申・酉／亥・子の4組がセル結合され1つの干支を共有する構造
 * （高倍率画像で確認済み）。
 */
const WUMU: Record<string, string> = {
  寅: "乙未", 卯: "乙未", 辰: "戊辰", 巳: "丙戌", 午: "丙戌", 未: "戊戌",
  申: "辛丑", 酉: "辛丑", 戌: "戊辰", 亥: "壬辰", 子: "壬辰", 丑: "戊辰",
};

/** ［区分A］八風（p.27）。季節ごとに固定2干支（原本画像で確認済み）。 */
const BAFENG_BY_SEASON: readonly (readonly string[])[] = [
  ["丁丑", "己酉"], ["甲申", "甲辰"], ["辛未", "丁未"], ["甲戌", "甲寅"],
];

/** ［区分A］觸水龍（p.27）。月建・季節に関係ない固定3干支列挙（八風の表とは別の側注）。 */
const CHUSHUILONG_GANZHI: readonly string[] = ["癸丑", "癸未", "丙子"];

/** ［区分A］八専（p.27）。月建に関係ない固定5干支列挙。 */
const BAZHUAN_GANZHI: readonly string[] = ["癸丑", "庚申", "己未", "丁未", "甲寅"];

/**
 * ［区分B・実例PDFに出現しないためロジック単体テストのみ］無禄（p.28）。
 * 日干ごとに固定1地支（実質は固定10干支列挙）。
 */
const WULU_BY_STEM: Record<string, string> = {
  甲: "辰", 乙: "巳", 丙: "申", 丁: "亥", 戊: "戌",
  己: "丑", 庚: "辰", 辛: "巳", 壬: "申", 癸: "亥",
};

/**
 * 「日家凶神」第4グループ（地嚢・四撃・四耗・四廢・四忌・四窮・五虚・
 * 五墓・八風・觸水龍・八専・無禄）を判定する。吉神は今回対象外のため
 * kichijin は常に空配列。
 */
export function resolveKyoushinGroup4(input: ShinsatsuInput): ShinsatsuResult {
  const { monthBranch, dayStem, dayBranch } = input;
  const dayGanzhi = `${dayStem}${dayBranch}`;
  const season = seasonIndexOf(monthBranch);

  const kyojin: string[] = [];

  if (DINANG[monthBranch]?.includes(dayGanzhi)) kyojin.push("地嚢");
  if (WUMU[monthBranch] === dayGanzhi) kyojin.push("五墓");
  if (CHUSHUILONG_GANZHI.includes(dayGanzhi)) kyojin.push("觸水龍");
  if (BAZHUAN_GANZHI.includes(dayGanzhi)) kyojin.push("八専");
  if (WULU_BY_STEM[dayStem] === dayBranch) kyojin.push("無禄");

  if (season !== -1) {
    if (SIJI_BRANCH_BY_SEASON[season] === dayBranch) kyojin.push("四撃");
    if (SIHAO_BY_SEASON[season] === dayGanzhi) kyojin.push("四耗");
    if (SIFEI_BY_SEASON[season].includes(dayGanzhi)) kyojin.push("四廢");
    if (SIJI2_BY_SEASON[season] === dayGanzhi) kyojin.push("四忌");
    if (SIQIONG_BY_SEASON[season] === dayGanzhi) kyojin.push("四窮");
    if (WUXU_TRIO_BY_SEASON[season].includes(dayBranch)) kyojin.push("五虚");
    if (BAFENG_BY_SEASON[season].includes(dayGanzhi)) kyojin.push("八風");
  }

  return { kichijin: [], kyojin };
}
