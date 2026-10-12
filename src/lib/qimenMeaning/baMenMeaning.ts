// src/lib/qimenMeaning/baMenMeaning.ts
//
// 役割:
//   八門（休門・生門・傷門・杜門・景門・死門・驚門・開門）の象意データ。
//
// 唯一の仕様書:
//   docs/source/奇門遁甲講義案N.pdf（このPDF以外は一切参照していない）。
//     ・「基本象意について（八門）」p.35、「基本象意２」p.36 … 八門の基本象意
//     ・「基本象意３」p.37 … 八門の旺衰（二十四節気を8つに束ねた期間ごとの
//       旺・絶・胎・没・死・因・休・廃の8段階と、各段階に配される八門の対応表）
//   要約・補完・推測はしていない。判定ロジック（src/lib/qimen/ 配下）には
//   一切依存しない・変更しない、独立したデータベース。
//
// 箇条書きへの分割方法:
//   本文を句読点（、。）で区切って配列化した。ただし「Aには良い」
//   「Aにはむかない」「Aに注意」のように、末尾の述語が直前の複数語（、区切り）
//   全体にかかる場合は、その述語を含む節をひとまとまりの1項目として扱い、
//   語順・文言は変更していない。

/** 八門1件分の基本象意（p.35-36）。 */
export interface BaMenMeaningEntry {
  name: string;
  /** 資料に付された吉凶ラベル（例: 上吉・中凶・大凶）。原文のまま。 */
  fortuneLabel: string;
  /** 象意の箇条書き。 */
  basicMeaning: string[];
  sourcePage: number;
}

export const BAMEN_MEANING: readonly BaMenMeaningEntry[] = [
  {
    name: "休門",
    fortuneLabel: "上吉",
    basicMeaning: [
      "貴人にあう", "上官赴任", "嫁娶", "移動", "引っ越し", "修造", "商取引",
      "行刑、投獄にはむかない",
    ],
    sourcePage: 35,
  },
  {
    name: "生門",
    fortuneLabel: "上吉",
    basicMeaning: ["求財", "遠征", "出行", "嫁娶", "建造", "埋葬、葬儀にはむかない"],
    sourcePage: 35,
  },
  {
    name: "傷門",
    fortuneLabel: "中凶",
    basicMeaning: [
      "借金の取り立て、盗賊の捕縛、漁猟、賭銭には良い",
      "商業は破財",
      "出行は災難",
    ],
    sourcePage: 35,
  },
  {
    name: "杜門",
    fortuneLabel: "中凶",
    basicMeaning: [
      "避難", "成敗", "洪水を防ぐ堤防", "判決", "監獄から隠れる",
      "塞がる、阻まれるの意あり",
      "隠密行動のみ良い",
    ],
    sourcePage: 35,
  },
  {
    name: "景門",
    fortuneLabel: "中吉",
    basicMeaning: [
      "策を練る、先生を選ぶ、火攻め、殺戮によい",
      "口舌、血光、火災に注意",
    ],
    sourcePage: 36,
  },
  {
    name: "死門",
    fortuneLabel: "大凶",
    basicMeaning: ["吊死", "送喪", "刑戮（刑罰に処する）", "戦争", "狩猟", "屠殺など"],
    sourcePage: 36,
  },
  {
    name: "驚門",
    fortuneLabel: "中凶",
    basicMeaning: [
      "訴訟", "争いを避ける", "捕縛", "蠱惑（人を惑わす）", "伏兵を疑う",
      "賭博", "遊技など",
    ],
    sourcePage: 36,
  },
  {
    name: "開門",
    fortuneLabel: "上吉",
    basicMeaning: [
      "開業", "商業", "遠征", "結婚", "引っ越し", "建築", "貿易", "出産",
      "治病", "求医",
    ],
    sourcePage: 36,
  },
];

/** 八門の旺衰8段階（p.37 表の見出し行）。 */
export const BAMEN_WANGSHUAI_STAGES = ["旺", "絶", "胎", "没", "死", "因", "休", "廃"] as const;
export type BaMenWangShuaiStage = (typeof BAMEN_WANGSHUAI_STAGES)[number];

/** p.37 表の列見出し（二十四節気を束ねた8区分）。 */
export const SOLAR_SEGMENTS = [
  "冬至後", "立春後", "春分後", "立夏後", "夏至後", "立秋後", "秋分後", "立冬後",
] as const;
export type SolarSegmentLabel = (typeof SOLAR_SEGMENTS)[number];

/**
 * 八門の旺衰表（p.37 を転記）。段階×節気区分 → その時期にその段階となる八門。
 * 資料本文をそのまま配列化しただけで、規則性（門の並びが1つずつ回転している
 * ように見える点など）を根拠に補完した値は無い。
 */
export const BAMEN_WANGSHUAI: Record<BaMenWangShuaiStage, Record<SolarSegmentLabel, string>> = {
  旺: { 冬至後: "休", 立春後: "生", 春分後: "傷", 立夏後: "杜", 夏至後: "景", 立秋後: "死", 秋分後: "驚", 立冬後: "開" },
  絶: { 冬至後: "生", 立春後: "傷", 春分後: "杜", 立夏後: "景", 夏至後: "死", 立秋後: "驚", 秋分後: "開", 立冬後: "休" },
  胎: { 冬至後: "傷", 立春後: "杜", 春分後: "景", 立夏後: "死", 夏至後: "驚", 立秋後: "開", 秋分後: "休", 立冬後: "生" },
  没: { 冬至後: "杜", 立春後: "景", 春分後: "死", 立夏後: "驚", 夏至後: "開", 立秋後: "休", 秋分後: "生", 立冬後: "傷" },
  死: { 冬至後: "景", 立春後: "死", 春分後: "驚", 立夏後: "開", 夏至後: "休", 立秋後: "生", 秋分後: "傷", 立冬後: "杜" },
  因: { 冬至後: "死", 立春後: "驚", 春分後: "開", 立夏後: "休", 夏至後: "生", 立秋後: "傷", 秋分後: "杜", 立冬後: "景" },
  休: { 冬至後: "驚", 立春後: "開", 春分後: "休", 立夏後: "生", 夏至後: "傷", 立秋後: "杜", 秋分後: "景", 立冬後: "死" },
  廃: { 冬至後: "開", 立春後: "休", 春分後: "生", 立夏後: "傷", 夏至後: "杜", 立秋後: "景", 秋分後: "死", 立冬後: "驚" },
};
export const BAMEN_WANGSHUAI_SOURCE_PAGE = 37;

/** 八門名から基本象意を引く。データが無ければ undefined。 */
export function lookupBaMenMeaning(name: string): BaMenMeaningEntry | undefined {
  return BAMEN_MEANING.find((e) => e.name === name);
}

/** 旺衰段階×節気区分から、その時期にその段階となる八門名を引く。 */
export function lookupBaMenWangShuai(
  stage: BaMenWangShuaiStage,
  segment: SolarSegmentLabel,
): string {
  return BAMEN_WANGSHUAI[stage][segment];
}
