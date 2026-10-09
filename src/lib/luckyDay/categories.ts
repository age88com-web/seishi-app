// src/lib/luckyDay/categories.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の「目的から吉日を探す」カテゴリー
//   選択UI用データ。ユーザー指示（2026-09-18）のカテゴリー構成をそのまま
//   データ化したもの。既存の専門家向け activityCategories.ts（/takujitsu の
//   用事フィルタ用メタデータ）とは無関係の別レイヤーであり、どちらも
//   互いを参照・変更しない。
//
// 重要（今回の作業範囲）:
//   カテゴリー → 具体的目的 → activityId の本接続はまだ行わない
//   （ユーザー指示、2026-09-18）。各項目の id はUI選択用の一意キーに
//   すぎず、activityId ではない。次フェーズで正式な一般語マッピングが
//   渡された時点で activityId を接続する（このファイルの構造を保ったまま
//   items に activityId フィールドを追加できるようにしてある）。

export interface LuckyDayCategoryItem {
  /** UI選択用の一意キー（activityId ではない）。 */
  id: string;
  /** 表示ラベル（ユーザー指示の文言をそのまま使用）。 */
  label: string;
}

export interface LuckyDayCategoryGroup {
  id: string;
  title: string;
  items: readonly LuckyDayCategoryItem[];
}

export const LUCKY_DAY_CATEGORY_GROUPS: readonly LuckyDayCategoryGroup[] = [
  {
    id: "housing",
    title: "住まい",
    items: [
      { id: "housing-move", label: "引越し・新居" },
      { id: "housing-build", label: "新築・建築" },
      { id: "housing-renovate", label: "リフォーム・修理・外構" },
      { id: "housing-land", label: "土地・土木・水工事" },
    ],
  },
  {
    id: "work-money",
    title: "仕事・お金",
    items: [
      { id: "work-open", label: "開業・開店・事業開始" },
      { id: "work-contract", label: "契約・売買・お金" },
      { id: "work-job", label: "就職・転職・仕事" },
    ],
  },
  {
    id: "life",
    title: "人生・暮らし",
    items: [
      { id: "life-marriage", label: "結婚・婚約" },
      { id: "life-family", label: "子ども・家族" },
      { id: "life-travel", label: "旅行・外出・移動" },
      { id: "life-shrine", label: "神社参拝・お祓い" },
      { id: "life-health", label: "健康・治療・美容" },
      { id: "life-social", label: "人付き合い・祝い事" },
      { id: "life-study", label: "入学・学び" },
    ],
  },
  {
    id: "other",
    title: "その他",
    items: [
      { id: "other-hobby", label: "農業・園芸・ペット・趣味" },
      { id: "other-funeral", label: "葬儀・墓・供養" },
      { id: "other-misc", label: "その他・詳しい目的" },
    ],
  },
] as const;
