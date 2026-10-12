// src/lib/qimenMeaning/baShenMeaning.ts
//
// 役割:
//   八神（値符・騰蛇・太陰・六合・勾陳・朱雀・九地・九天）の象意データ。
//
// 唯一の仕様書:
//   docs/source/奇門遁甲講義案N.pdf（このPDF以外は一切参照していない）。
//     ・「基本象意７」p.41、「基本象意８」p.42 … 八神の基本象意
//     ・「基本象意９」p.43 … 八神の宮位による吉凶一覧（8神×9宮のマトリクス。
//       旺相休囚死の周期ではなく、宮位ごとに吉／凶／次吉／大凶を直接示す表）
//   要約・補完・推測はしていない。判定ロジック（src/lib/qimen/ 配下）には
//   一切依存しない・変更しない、独立したデータベース。
//
// 表記についての注記（判断はせず、事実のみ記録する）:
//   p.41・p.43本文はこの八神の首位を「値符」と表記している。一方、同じ
//   資料内の p.9「構成要素④」（八神の一覧）や、既存モジュール
//   src/lib/qimen/bashen.ts の BaShenName 型は「直符」表記である。
//   どちらが正しいかは判断せず、p.41・p.43の原文表記のまま「値符」として
//   転記した。呼び出し側の実装との突き合わせのため、
//   lookupBaShenMeaning() / lookupBaShenPalaceFortune() は「直符」表記でも
//   同じ結果を返すようにしている（表記ゆれの吸収であり、象意の内容自体は
//   一切補完していない）。
//
// 箇条書きへの分割方法: baMenMeaning.ts と同じ方針。

/** 八神1件分の基本象意（p.41-42）。name は資料原文の表記（値符）。 */
export interface BaShenMeaningEntry {
  name: string;
  /** 資料に付された吉凶ラベル（例: 吉・凶）。原文のまま。 */
  fortuneLabel: string;
  basicMeaning: string[];
  sourcePage: number;
}

export const BASHEN_MEANING: readonly BaShenMeaningEntry[] = [
  {
    name: "値符",
    fortuneLabel: "吉",
    basicMeaning: ["八神の首領", "貴人", "百悪を消散させる", "凶となると憂いに沈む"],
    sourcePage: 41,
  },
  {
    name: "騰蛇",
    fortuneLabel: "凶",
    basicMeaning: [
      "虚詐の神", "虚偽", "口舌は悪らつ", "驚恐", "怪異", "偽り欺く",
      "凶となる場合詐欺、汚職に注意",
    ],
    sourcePage: 41,
  },
  {
    name: "太陰",
    fortuneLabel: "吉",
    basicMeaning: [
      "陰護の神", "秘密のはかりごと", "陰謀", "隠れた兵を移動", "避難",
      "凶となれば淫乱、詐欺、口舌、私通",
    ],
    sourcePage: 41,
  },
  {
    name: "六合",
    fortuneLabel: "吉",
    basicMeaning: [
      "護衛の神", "平和的で穏やか", "婚姻", "交易", "談判", "仲介など",
      "凶となれば口論、疾病、争い",
    ],
    sourcePage: 41,
  },
  {
    name: "勾陳",
    fortuneLabel: "凶",
    basicMeaning: [
      "陽遁では勾陳、陰遁では白虎",
      "葬儀、埋葬には良い",
      "その他では殺人、闘争、疾病、交通事故など",
    ],
    sourcePage: 42,
  },
  {
    name: "朱雀",
    fortuneLabel: "凶",
    basicMeaning: [
      "陽遁では朱雀、陰遁では玄武",
      "こそ泥の神",
      "盗賊", "口論", "空想", "離別", "家出", "損失など",
    ],
    sourcePage: 42,
  },
  {
    name: "九地",
    fortuneLabel: "吉",
    basicMeaning: ["堅牢の神", "種まき", "繁殖", "養殖", "出産", "医者", "占いなど"],
    sourcePage: 42,
  },
  {
    name: "九天",
    fortuneLabel: "吉",
    basicMeaning: ["悍威の神", "海外旅行", "行軍", "出張など"],
    sourcePage: 42,
  },
];

/** p.43 表の列見出し（洛書九宮）。 */
export const BASHEN_PALACES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** p.43 表を転記。八神名 → 宮番号(1-9) → 吉凶ラベル（吉/凶/次吉/大凶）。 */
export const BASHEN_PALACE_FORTUNE: Record<string, Record<number, string>> = {
  値符: { 1: "吉", 2: "吉", 3: "吉", 4: "吉", 5: "凶", 6: "吉", 7: "吉", 8: "吉", 9: "吉" },
  騰蛇: { 1: "凶", 2: "凶", 3: "凶", 4: "凶", 5: "大凶", 6: "凶", 7: "凶", 8: "凶", 9: "凶" },
  太陰: { 1: "次吉", 2: "次吉", 3: "次吉", 4: "次吉", 5: "凶", 6: "次吉", 7: "次吉", 8: "次吉", 9: "次吉" },
  六合: { 1: "次吉", 2: "次吉", 3: "次吉", 4: "次吉", 5: "凶", 6: "次吉", 7: "次吉", 8: "次吉", 9: "次吉" },
  勾陳: { 1: "凶", 2: "凶", 3: "凶", 4: "凶", 5: "大凶", 6: "凶", 7: "凶", 8: "凶", 9: "凶" },
  朱雀: { 1: "凶", 2: "凶", 3: "凶", 4: "凶", 5: "大凶", 6: "凶", 7: "凶", 8: "凶", 9: "凶" },
  九地: { 1: "次吉", 2: "次吉", 3: "次吉", 4: "次吉", 5: "凶", 6: "次吉", 7: "次吉", 8: "次吉", 9: "次吉" },
  九天: { 1: "次吉", 2: "次吉", 3: "次吉", 4: "次吉", 5: "凶", 6: "次吉", 7: "次吉", 8: "次吉", 9: "次吉" },
};
export const BASHEN_PALACE_FORTUNE_SOURCE_PAGE = 43;

/** 「直符」表記を p.41/43 の原文表記「値符」へ寄せるだけの表記ゆれ吸収。 */
function normalizeBaShenName(name: string): string {
  return name === "直符" ? "値符" : name;
}

/** 八神名（値符／直符いずれの表記でも可）から基本象意を引く。データが無ければ undefined。 */
export function lookupBaShenMeaning(name: string): BaShenMeaningEntry | undefined {
  const n = normalizeBaShenName(name);
  return BASHEN_MEANING.find((e) => e.name === n);
}

/** 八神名（値符／直符いずれの表記でも可）と宮番号(1-9)から宮位吉凶を引く。 */
export function lookupBaShenPalaceFortune(name: string, palace: number): string | undefined {
  const n = normalizeBaShenName(name);
  return BASHEN_PALACE_FORTUNE[n]?.[palace];
}
