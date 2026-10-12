// src/lib/ziwei/meanings/fortune-transformations/data.ts
//
// 行運四化象意のデータ（docs/ziwei-basic-spec.md §30）。大限・小限で共通の1データ（二重登録しない）。
// 監査（入門・基礎編・基礎２を 大限・小限・流年・四化・化禄・化権・化科・化忌 で全文検索）:
//   A. 行運について明示された四化の文 … 基礎２ S33・S36〜S40 だけ。
//      このレイヤーで使うのは S39 の「大限による化忌の凶作用」の一般的な記述だけ（大限のみ。小限には書かれていない）。
//      S33（流年化忌の重なり）・S38（大限の例）は行運格局の層、S36・S40 は喜忌（次工程）、S37 は計算法、S41 は太歳。
//   B. 四化そのものの一般的象意 … 入門 p.15 の星の一覧、入門 p.72〜73 の化曜星の各節の最初の文（星の定義）、
//      基礎２ S20 三奇嘉會の「化禄：主に財」など（保持のみ・表示しない）。
//   C. 命宮に入った場合の本命解釈 … 入門 p.72〜73 の「この星を命宮に持つ人は…」など。行運に流用しない。
// 基礎編には四化の象意の文はない（作盤７の四化表だけ）。
// 表示する文は、資料の意味の範囲で書き直した独自文章（§35）。資料の原文は持たない（出典は sourceRef・sourceId）。一般知識で補わない。

import type { ExcludedFortuneText, TransformationMeaning, TransformationSourceRef, TransformationType } from "./types";

const P15: TransformationSourceRef = { source: "紫微斗数入門", page: "p.15", section: "星の一覧（副星）" };
const p72 = (sourceId: string, page = "p.72"): TransformationSourceRef => ({ source: "紫微斗数入門", page, section: "化曜星", sourceId });
const S20: TransformationSourceRef = { source: "紫微斗数基礎２", page: "S20", section: "格局１９ 三奇嘉會格" };

const DEF_NOTE = "化曜星の節の最初の文（星の定義）を書き直したもの（象意データの独自文章と同じ）。節は命宮に入った場合の意味だが、この文は命宮・人物に触れない";

export const TRANSFORMATION_MEANINGS: Readonly<Record<TransformationType, TransformationMeaning>> = {
  化禄: {
    type: "化禄",
    star: "化禄星",
    coreMeanings: [
      { text: "福に恵まれることや、財・収入の巡りにかかわります。", sourceScope: "generic-transformation", sourceRef: P15, display: true },
      { text: "化禄星は、財とのかかわりを示す星です。", sourceScope: "generic-transformation", sourceRef: p72("N-ST-0831"), display: true, note: DEF_NOTE },
      { text: "化禄はおもに財をあらわす（三奇嘉會の説明）。", sourceScope: "generic-transformation", sourceRef: S20, display: false, note: "三奇嘉會の説明の中の短い象意。保持のみ" },
    ],
    fortuneTexts: [],
    excludedSourceIds: ["N-ST-0832", "N-ST-0833", "N-ST-0834", "N-ST-0835", "N-ST-0836", "N-ST-0837", "N-ST-0838", "N-ST-0839", "N-ST-0840"],
  },
  化権: {
    type: "化権",
    star: "化権星",
    coreMeanings: [
      { text: "勢いを得ることや、権力にかかわります。", sourceScope: "generic-transformation", sourceRef: P15, display: true },
      { text: "化権星が受け持つのは、権力と、物事を決める力です。", sourceScope: "generic-transformation", sourceRef: p72("N-ST-0841"), display: true, note: DEF_NOTE },
      { text: "化権は権力をあらわす（三奇嘉會の説明）。", sourceScope: "generic-transformation", sourceRef: S20, display: false, note: "三奇嘉會の説明の中の短い象意。保持のみ" },
    ],
    fortuneTexts: [],
    excludedSourceIds: ["N-ST-0842", "N-ST-0843", "N-ST-0844", "N-ST-0845"],
  },
  化科: {
    type: "化科",
    star: "化科星",
    coreMeanings: [
      { text: "文章や試験、知恵、そして名声にかかわります。", sourceScope: "generic-transformation", sourceRef: P15, display: true },
      { text: "試験や文章、学問の事柄を受け持つのが、化科星です。", sourceScope: "generic-transformation", sourceRef: p72("N-ST-0846"), display: true, note: DEF_NOTE },
      { text: "化科は名声をあらわす（三奇嘉會の説明）。", sourceScope: "generic-transformation", sourceRef: S20, display: false, note: "三奇嘉會の説明の中の短い象意。保持のみ" },
    ],
    fortuneTexts: [],
    excludedSourceIds: ["N-ST-0847", "N-ST-0848", "N-ST-0849", "N-ST-0850"],
  },
  化忌: {
    type: "化忌",
    star: "化忌星",
    coreMeanings: [
      { text: "物事の是非をめぐる問題、困難や挫折、壊れること、言い争い、ねたみにかかわります。", sourceScope: "generic-transformation", sourceRef: P15, display: true },
      { text: "化忌星があらわすのは、是非をめぐる問題、困難、そして挫折です。", sourceScope: "generic-transformation", sourceRef: p72("N-ST-0851", "p.73"), display: true, note: DEF_NOTE },
    ],
    fortuneTexts: [
      {
        text: "大限の命宮から見た三方四正に悪い格がそろっていなくても、本命盤の命宮は生涯全体の土台となる宮なので、ここに大限の化忌が入ると、その悪い働きは大きく出ると読みます。",
        sourceScope: "fortune-explicit",
        sourceRef: { source: "紫微斗数基礎２", page: "S39", section: "大限四化の例2" },
        display: true,
        appliesTo: ["major"],
        condition: { kind: "natalMing", phrase: "天盤命宮" },
        note: "大限の化忌が天盤（本命）命宮に入るとき。小限については書かれていないので大限だけ",
      },
    ],
    excludedSourceIds: ["N-ST-0852", "N-ST-0853", "N-ST-0854", "N-ST-0855", "N-ST-0856"],
  },
};

/** 監査で見つけた行運の四化の文のうち、このレイヤーで使わないもの */
export const EXCLUDED_FORTUNE_TEXTS: readonly ExcludedFortuneText[] = [
  {
    text: "羊陀夾忌の宮に流年が巡り、その三方四正に流年の化忌が重なる年の記述",
    sourceRef: { source: "紫微斗数基礎２", page: "S33", section: "羊陀夾忌格" },
    reason: "pattern",
    note: "羊陀夾忌の格局の象意（行運格局の層）",
  },
  {
    text: "行運が殺破狼・機月同梁のそれぞれの時期に凶となる四化の星についての記述",
    sourceRef: { source: "紫微斗数基礎２", page: "S36", section: "四化星について" },
    reason: "xiji",
    note: "四化と行運の喜忌。S40 と合わせて次工程（今回は適用しない）",
  },
  {
    text: "大限の宮の天干から大限四化を求める計算法の記述",
    sourceRef: { source: "紫微斗数基礎２", page: "S37", section: "大限と四化星" },
    reason: "calculation",
    note: "大限四化の計算法（§26 で実装済み）",
  },
  {
    text: "丙寅・丁卯・戊辰・己巳の大限の解説（羊陀夾忌・刑忌夾印・戊の化忌が大限命宮に入宮・三奇嘉会）",
    sourceRef: { source: "紫微斗数基礎２", page: "S38", section: "大限四化の例" },
    reason: "example",
    note: "命盤例の個別の記述。格局は行運格局の層（§27.6）。戊辰の「とても悪く、配偶者と離別など」は例の盤の組み合わせ（大限夫妻宮に太陽の化忌・火星・鈴星）の記述で、一般則として書かれていない",
  },
  {
    text: "大限・小限での、宮の天干ごとの四化と喜忌の一覧",
    sourceRef: { source: "紫微斗数基礎２", page: "S40", section: "四化星と宮の喜忌" },
    reason: "xiji",
    note: "データとして保持（fortune/xiji.ts）。己の記載がない。今回は適用しない",
  },
  {
    text: "太歳宮と同宮・三方四正の重なりや会照によって吉凶の増強を見るという記述",
    sourceRef: { source: "紫微斗数基礎２", page: "S41", section: "太歳流年法" },
    reason: "taisei",
    note: "太歳の増強判定（次工程）",
  },
];

export const TRANSFORMATION_TYPES: readonly TransformationType[] = ["化禄", "化権", "化科", "化忌"];
