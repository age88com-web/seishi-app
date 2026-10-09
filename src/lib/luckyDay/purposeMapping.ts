// src/lib/luckyDay/purposeMapping.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）「目的から吉日を探す」の
//   ②具体的な目的 選択用データ。①で選んだカテゴリー項目
//   （src/lib/luckyDay/categories.ts の LuckyDayCategoryItem.id）から、
//   一般向け表示ラベルと既存 activityId（activityDefinitions.ts）の
//   組を引けるようにするだけの静的マッピングである。
//
// 重要（ユーザー指示、2026-09-19）:
//   ・一般向けの表示名と既存 activityId を結びつけるだけ。判定の統合や
//     複数 activityId を合成した新しい判定は作らない（1目的＝1 activityId）。
//   - activityDefinitions.ts・判定ロジック（evaluateActivities・resolution等）
//     は一切参照・変更しない。ここにあるのは「表示ラベル文字列」と
//     「activityId文字列」のペアだけ。
//   ・「その他・詳しい目的」（categories.ts の "other-misc"）は今回まだ
//     具体的目的を用意しない。LUCKY_DAY_PURPOSES_BY_CATEGORY に意図的に
//     空配列で登録し、呼び出し側（page.tsx）で「該当0件＝まだ用意されて
//     いないカテゴリー」として案内文を出す（activityIdを勝手に補完しない）。

export interface LuckyDayPurpose {
  /** UI選択用の一意キー（同一カテゴリー項目内で一意）。activityId ではない。 */
  id: string;
  /** 一般向け表示ラベル（ユーザー指定文言をそのまま使用）。 */
  label: string;
  /** 既存 ActivityDefinition の id（src/lib/takujitsu/activity/activityDefinitions.ts）。 */
  activityId: string;
}

function purpose(categoryItemId: string, label: string, activityId: string): LuckyDayPurpose {
  return { id: `${categoryItemId}__${activityId}`, label, activityId };
}

/**
 * カテゴリー項目id（categories.ts の LuckyDayCategoryItem.id）→ 具体的目的一覧。
 * 同じ activityId が複数のカテゴリー項目から参照されることがある
 * （例：「動土」は「新築・建築」と「土地・土木・水工事」の両方に登場する。
 * ユーザー指定の一覧どおりであり、意図的な重複＝正しい状態）。
 */
export const LUCKY_DAY_PURPOSES_BY_CATEGORY: Readonly<Record<string, readonly LuckyDayPurpose[]>> = {
  "housing-move": [
    purpose("housing-move", "引っ越しをする", "移徒"),
    purpose("housing-move", "新居に住み始める", "入宅"),
    purpose("housing-move", "家具・荷物を新居へ搬入する", "搬入"),
    purpose("housing-move", "新居でキッチン・コンロを使い始める", "作灶"),
  ],
  "housing-build": [
    purpose("housing-build", "建物を建て始める", "建築"),
    purpose("housing-build", "土を掘る・工事を始める", "動土"),
    purpose("housing-build", "建築工事と土地工事を始める", "修造動土"),
    purpose("housing-build", "基礎・構造工事を始める", "起基定硬"),
    purpose("housing-build", "梁を工事する", "上梁"),
    purpose("housing-build", "門・玄関を設置する", "安門"),
  ],
  "housing-renovate": [
    purpose("housing-renovate", "リフォーム・修理をする", "修宅日"),
    purpose("housing-renovate", "新築・リフォーム工事をする", "修造"),
    purpose("housing-renovate", "工事に伴って土を動かす", "修造動土"),
    purpose("housing-renovate", "建物を取り壊す", "破屋壊垣"),
    purpose("housing-renovate", "外構・塀を整備する", "修飾垣墻"),
    purpose("housing-renovate", "トイレを設置・改修する", "作厠"),
  ],
  "housing-land": [
    purpose("housing-land", "土を掘る・工事を始める", "動土"),
    purpose("housing-land", "道路・通路を整備する", "平治道塗"),
    purpose("housing-land", "木を伐採する", "伐木"),
  ],

  "work-open": [
    purpose("work-open", "開業・開店する", "開市"),
    purpose("work-open", "商売・取引を始める", "交易"),
    purpose("work-open", "販売・契約を始める", "立券交易"),
    purpose("work-open", "開業・開店に伴う祭祀を行う", "祭祀"),
  ],
  "work-contract": [
    purpose("work-contract", "契約する", "立券交易"),
    purpose("work-contract", "売買・取引する", "交易"),
    purpose("work-contract", "お金を納める・納税する", "納財"),
    purpose("work-contract", "商品を出荷する", "出貨財"),
  ],
  "work-job": [
    purpose("work-job", "新しい仕事・役職に就く", "臨官"),
    purpose("work-job", "就任・昇進・赴任する", "上官赴任"),
    purpose("work-job", "重要な計画を立てる", "策略"),
    purpose("work-job", "上司などへの重要な申請・交渉をする", "上表彰"),
    purpose("work-job", "営業活動などで積極的に動く", "出陣"),
  ],

  "life-marriage": [
    purpose("life-marriage", "結婚式を挙げる", "結婚姻"),
    purpose("life-marriage", "婚約・結納をする", "納采"),
    purpose("life-marriage", "結婚・婚約・結納", "結婚納采"),
    purpose("life-marriage", "新婚生活の寝床を整える", "安床"),
  ],
  "life-family": [
    purpose("life-family", "子授け・子孫繁栄を願う", "求嗣"),
    purpose("life-family", "子作り・養子を迎える", "進人口"),
    purpose("life-family", "家族で重要な話し合いをする", "家族会議"),
  ],
  "life-travel": [
    purpose("life-travel", "外出・旅行に出発する", "出行"),
    purpose("life-travel", "遠方・海外旅行に出発する", "遠行"),
    purpose("life-travel", "赴任先へ出発する", "上官赴任"),
  ],
  "life-shrine": [
    purpose("life-shrine", "祈願する", "祈福"),
    purpose("life-shrine", "先祖供養・神仏を祀る", "祭祀"),
    purpose("life-shrine", "厄除け・お祓いをする", "解除"),
    purpose("life-shrine", "仏壇・神棚を設置する", "安香"),
  ],
  "life-health": [
    purpose("life-health", "病院・治療を始める", "求醫療病"),
    purpose("life-health", "鍼灸を受ける", "鍼灸"),
    purpose("life-health", "美容・身なりを整える", "整容"),
    purpose("life-health", "髪を切る", "剃頭"),
    purpose("life-health", "爪を切る・ネイルをする", "整手足甲"),
  ],
  "life-social": [
    purpose("life-social", "家族・友人・知人と会う", "會親友"),
    purpose("life-social", "お祝いをする", "祝賀"),
    purpose("life-social", "親交を深める", "親睦"),
    purpose("life-social", "客を招く", "賓客"),
    purpose("life-social", "宴会・会食をする", "宴會"),
  ],
  "life-study": [
    purpose("life-study", "入学する・先生や師匠につく", "入学求師"),
  ],

  "other-hobby": [
    purpose("other-hobby", "種まき・植え付けをする", "栽種"),
    purpose("other-hobby", "木を伐採する", "伐木"),
    purpose("other-hobby", "ペット・家畜を迎える", "納畜"),
    purpose("other-hobby", "ペット・家畜などの手入れをする", "養育"),
    purpose("other-hobby", "害虫などを捕獲・駆除する", "捕捉"),
    purpose("other-hobby", "狩猟をする", "畋獵"),
    purpose("other-hobby", "魚釣り・漁をする", "取魚"),
    purpose("other-hobby", "味噌・醤油などの発酵食品を仕込む", "醞釀"),
  ],
  "other-funeral": [
    purpose("other-funeral", "埋葬・火葬をする", "安葬"),
    purpose("other-funeral", "埋葬のために土を掘る", "破土"),
    purpose("other-funeral", "改葬のために墓を開く", "啓攢"),
    purpose("other-funeral", "墓を掃除する", "掃舎宇"),
    purpose("other-funeral", "供養を行う", "斎醮"),
  ],
  // 「その他・詳しい目的」は今回まだ具体的目的を用意しない（意図的に空配列）。
  "other-misc": [],
};

/** カテゴリー項目idから具体的目的一覧を得る。未登録idは空配列。 */
export function getLuckyDayPurposes(categoryItemId: string): readonly LuckyDayPurpose[] {
  return LUCKY_DAY_PURPOSES_BY_CATEGORY[categoryItemId] ?? [];
}
