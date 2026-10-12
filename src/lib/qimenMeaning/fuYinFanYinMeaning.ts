// src/lib/qimenMeaning/fuYinFanYinMeaning.ts
//
// 役割:
//   伏吟・反吟の分類と吉凶文のデータ。
//
// 唯一の仕様書:
//   docs/source/反吟伏吟.png（この図版以外は一切参照していない）。
//     ・「伏吟」… 九星伏吟・八門伏吟・直符伏吟の3分類と「吉凶」欄
//     ・「反吟」… 九星反吟・八門反吟・直符反吟の3分類と「吉凶」欄
//   図版に書名・ページ番号の記載は無い。要約・補完・推測・現代化はしていない。
//   判定ロジック（src/lib/qimen/ 配下）には一切依存しない・変更しない、
//   独立したデータベース。
//
// 既存データとの区別（重要）:
//   data.ts の MEANING_DATA["伏吟格"] / MEANING_DATA["反吟格"] は
//   docs/source/奇門遁甲講義案N.pdf p.60「格局詳細（凶格８）」由来の象意であり、
//   本ファイルとは別資料・別データとして並存させる（上書き・統合しない）。
//   本ファイルのエントリは sourceDocument で由来を区別できる。
//
// 転記方法:
//   図版の各ボックスの行を1要素として、行の区切り・句読点・語句を図版のまま
//   配列化した（行末が句点で終わらない行もそのまま）。
//
// 資料間の相違（判断はせず、事実のみ記録する）:
//   ・図版の「直符伏吟」は「地盤と天盤の奇子が同じになることをいう」と説明し、
//     「直符反吟」は「地盤上の奇子と天盤上の奇子が対宮する」と説明する。
//     一方、src/lib/qimen/kyokaku.ts の伏吟格／反吟格判定は、同名の内訳
//     「直符伏吟」「直符反吟」を八神「直符」の定位（相沖宮）で判定している。
//     分類名の文字列は一致するが、定義の文言は異なる。どちらが正しいかは
//     判断せず、判定ロジックも本データも変更しない。
//   ・講義案N.pdf p.60 は同じ区分を「値符伏吟」「値符反吟」と表記する。

export type FuYinFanYinKind = "伏吟" | "反吟";

/** 伏吟／反吟の下位分類1件（図版の赤見出しボックス1つ分）。 */
export interface FuYinFanYinSubtypeEntry {
  /** 図版の分類名（原文のまま）。 */
  name: string;
  /** 分類ボックス内の説明文（図版の行ごと・原文のまま）。 */
  description: string[];
}

/** 伏吟または反吟1件分（分類と吉凶欄）。 */
export interface FuYinFanYinMeaningEntry {
  kind: FuYinFanYinKind;
  /** 図版に記載された下位分類（図版の記載順）。 */
  subtypes: FuYinFanYinSubtypeEntry[];
  /** 図版の吉凶欄の見出し（原文のまま）。 */
  fortuneHeading: string;
  /** 吉凶欄の本文（図版の行ごと・原文のまま）。 */
  fortuneText: string[];
  /** 由来資料（プロジェクト内のパス）。 */
  sourceDocument: string;
}

export const FUYIN_FANYIN_SOURCE_DOCUMENT = "docs/source/反吟伏吟.png";

export const FUYIN_FANYIN_MEANING: readonly FuYinFanYinMeaningEntry[] = [
  {
    kind: "伏吟",
    subtypes: [
      {
        name: "九星伏吟",
        description: [
          "天盤の九星が定位となる。つまり地盤定位の九星と重なる。",
          "例えば、天盤の天蓬星が坎一宮に臨む場合は伏吟である。",
        ],
      },
      {
        name: "八門伏吟",
        description: [
          "人盤の八門が定位となる。",
          "例えば、生門が艮八宮に入ると伏吟",
        ],
      },
      {
        name: "直符伏吟",
        description: ["地盤と天盤の奇子が同じになることをいう。"],
      },
    ],
    fortuneHeading: "吉凶",
    fortuneText: [
      "伏吟は大凶であり、相伝によれば、損失人口を招く。喪服を着て葬儀に参列する象意。",
      "この時間帯は用兵や作戦に宜しくない。収斂として財物を集めるのに宜しい。",
      "無闇に行動してはならない。",
    ],
    sourceDocument: FUYIN_FANYIN_SOURCE_DOCUMENT,
  },
  {
    kind: "反吟",
    subtypes: [
      {
        name: "九星反吟",
        description: [
          "地盤定位の九星と天盤の九星が相対することをいう。",
          "例えば、地盤坎一宮の天蓬星が天盤では離宮にあることをいう。",
        ],
      },
      {
        name: "八門反吟",
        description: [
          "地盤定位の八門と人盤の八門が対宮。",
          "例えば、人盤の生門が坤二宮。",
        ],
      },
      {
        name: "直符反吟",
        description: [
          "地盤上の奇子と天盤上の奇子が対宮する。",
          "例えば、地盤艮宮が己のとき、天盤坤宮に己が臨むこと。",
        ],
      },
    ],
    fortuneHeading: "吉凶",
    fortuneText: [
      "反吟となれば、三奇がそれを掩護しても、凶害を見ずにはすまない。",
      "もし三奇に援護されないならば、災害はすぐにやって来る。",
    ],
    sourceDocument: FUYIN_FANYIN_SOURCE_DOCUMENT,
  },
];

/** 「伏吟」「反吟」から分類と吉凶文を引く。データが無ければ undefined。 */
export function lookupFuYinFanYinMeaning(kind: string): FuYinFanYinMeaningEntry | undefined {
  return FUYIN_FANYIN_MEANING.find((e) => e.kind === kind);
}
