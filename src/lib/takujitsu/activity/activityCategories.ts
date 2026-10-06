// src/lib/takujitsu/activity/activityCategories.ts
//
// 役割:
//   ActivityDefinition（現在178語。原典用事クリーンアップ後）を
//   「現代の利用目的」から探すための UI／検索用メタデータ。
//
// 重要（擇日UI 第2フェーズ、2026-09-10）:
//   ・**このカテゴリ分類は吉凶判定ロジックに一切使わない**。
//     evaluateActivities() / ActivityProfile / occurrence / resolution は
//     このファイルを import しないし、参照もしない。純粋に UI のフィルタ・
//     検索のための付加情報である。
//   ・分類は既存の ActivityDefinition（canonicalName / modernName /
//     description、用事便覧由来）から**意味が明確に判断できるものだけ**を
//     割り当てた。曖昧なもの・古典語で現代目的が一義に定まらないものは
//     "その他" に置いている（推測で現代カテゴリへ寄せない）。
//   ・原典語の翻訳・新規 ActivityDefinition の追加はしていない。
//
// 2026-09-11追記（原典用事クリーンアップ フェーズ）:
//   activityDefinitions.ts の244→178統合に伴い、統合で消えた66idを
//   CATEGORY_MEMBERS から機械的に削除した（統合先idは既存のまま。
//   新規追加・カテゴリ変更はしていない）。詳細は
//   docs/takujitsu_original_activity_cleanup.md 参照。
//
// 2026-09-11追記2（720実例検証フェーズ）:
//   activityDefinitions.ts の163→112削除（docs/takujitsu_activity_source_
//   layer_validation.md）に伴い、削除された51idをCATEGORY_MEMBERSから
//   機械的に削除した（カテゴリ変更・新規追加はしていない）。
//
// 2026-09-11追記3（Numbers表判断反映フェーズ）:
//   ユーザーが確認したNumbers表の判断に基づき、112→95統合（詳細は
//   activityDefinitions.ts追記5参照）で消えた14idをCATEGORY_MEMBERSから
//   機械的に削除した（慈愛・百事・訴訟はカテゴリ未割当＝その他だった
//   ため対象なし）。あわせてNumbers表で明記された10件のカテゴリ変更を
//   実施した：剃頭・整手足甲・沐浴・家族会議・會親友・祝賀・親睦・賓客を
//   新設カテゴリ「生活」へ、進人口を「妊娠・出産・子供」へ、鋳造を
//   「就職・仕事」へ。「生活」は既存カテゴリに該当が無いとユーザーに
//   確認のうえ新設した（表記揺れなし）。他の94件のカテゴリは変更していない。
//
// 2026-09-11追記4（表示順並べ替えフェーズ）:
//   ユーザー指定の重要度・利用頻度順に、ACTIVITY_CATEGORIESの並び順と各
//   CATEGORY_MEMBERSの用事並び順を変更した（カテゴリ数16→15）。「土地・
//   不動産」カテゴリを廃止し、唯一の所属語だった「動土」を「建築・工事」へ
//   移動した。カテゴリの新設・削除（「土地・不動産」の廃止を除く）・用事の
//   追加削除は行っていない。「用途を選ぶ」の表示順は
//   activityDefinitions.tsのACTIVITY_DEFINITIONS配列順をそのまま使うため
//   （src/app/takujitsu/page.tsxのpickerListがフィルタのみで並べ替えない
//   設計）、同フェーズでactivityDefinitions.ts側の配列順も本ファイルの
//   カテゴリ順・用事順と一致させて並べ替えている。

import { ACTIVITY_DEFINITIONS } from "./activityDefinitions";

// 2026-09-11追記5（現行95再監査フェーズ・95→109）:
//   docs/takujitsu_missing_activity_reaudit.mdでユーザー承認された新規14件を、
//   各用事の原典上の用途（用事便覧.pdf・擇日テキスト.pdfで確認できた内容）に
//   基づき分類した。名称から推測せず、原典の説明文を根拠にした：
//   安香・斎醮＝祭祀・祈願（用事便覧側もそれぞれ祭祀篇#7・#4に掲載）／
//   起基定硬・安門・安吟・作灶・造倉庫・苫蓋・放水・修宅日＝建築・工事
//   （いずれも基礎工事・門/設備の設置・倉庫や納屋の建造・給排水工事など）／
//   合帳＝婚姻・縁組（用事便覧が婚姻篇#27に掲載）／
//   合壽木＝葬祭・墓（用事便覧が喪葬編#89に掲載）／
//   造船・避宅出火＝原典の用途が現代の分類軸のどれとも一義に定まらないため
//   「その他」（推測で建築・工事や旅行・外出へ寄せていない）。
//   既存の表示順・重要度順を崩さないよう、各カテゴリーの末尾に追加した
//   （＝ACTIVITY_DEFINITIONS配列でも既存95件の後ろに追加している）。

export const ACTIVITY_CATEGORIES = [
  "祭祀・祈願",
  "建築・工事",
  "葬祭・墓",
  "引越し・移転",
  "婚姻・縁組",
  "妊娠・出産・子供",
  "開業・商売",
  "契約・取引・財",
  "医療・健康",
  "生活",
  "旅行・外出",
  "就職・仕事",
  "学業",
  "農業・畜産",
  "その他",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

const CATEGORY_MEMBERS: Record<Exclude<ActivityCategory, "その他">, readonly string[]> = {
  "祭祀・祈願": [
    "祈福", "祭祀", "解除", "開光", "安香", "斎醮",
  ],
  "建築・工事": [
    "修造", "修造動土", "建築", "破屋壊垣", "動土", "上梁", "堅柱上樑", "蓋屋",
    "修倉庫", "修補垣牆", "修飾垣墻", "築垣", "補垣塞穴", "築堤防",
    "開渠穿井", "開井", "溝渠", "開道", "平治道塗", "作厠", "安碓磑", "埋坑",
    "起基定硬", "安門", "安吟", "作灶", "造倉庫", "苫蓋", "放水", "修宅日",
  ],
  "葬祭・墓": [
    "啓攢", "啓墳", "安葬", "掃舎宇", "破土", "製寿衣", "合壽木",
  ],
  "引越し・移転": [
    "入宅", "搬入", "移徒",
  ],
  "婚姻・縁組": [
    "結婚姻", "嫁娶", "納采", "結婚納采", "裁衣", "合帳",
  ],
  "妊娠・出産・子供": [
    "求嗣", "修置産室", "安床", "進人口", "養育",
  ],
  "開業・商売": [
    "開市", "開倉庫", "出庫",
  ],
  "契約・取引・財": [
    "交易", "立券交易", "納財", "出財寶", "出貨財", "放債負",
  ],
  "医療・健康": [
    "求醫療病", "鍼灸", "整容",
  ],
  "生活": [
    "沐浴", "剃頭", "整手足甲", "家族会議", "會親友", "祝賀", "親睦", "賓客",
  ],
  "旅行・外出": [
    "出行", "遠行", "乗船渡水",
  ],
  "就職・仕事": [
    "上官赴任", "臨官", "臨政親民", "策略", "経絡", "鋳造",
  ],
  "学業": [
    "入学求師",
  ],
  "農業・畜産": [
    "栽種", "伐木", "牧養", "納畜", "造畜柵", "捕捉", "畋獵", "取魚",
  ],
};

export const CATEGORY_BY_ID: ReadonlyMap<string, ActivityCategory> = (() => {
  const map = new Map<string, ActivityCategory>();
  for (const [cat, ids] of Object.entries(CATEGORY_MEMBERS) as [ActivityCategory, readonly string[]][]) {
    for (const id of ids) map.set(id, cat);
  }
  for (const def of ACTIVITY_DEFINITIONS) {
    if (!map.has(def.id)) map.set(def.id, "その他");
  }
  return map;
})();

export const CATEGORY_COUNTS: Readonly<Record<ActivityCategory, number>> = (() => {
  const counts = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c, 0])) as Record<ActivityCategory, number>;
  for (const cat of CATEGORY_BY_ID.values()) counts[cat] += 1;
  return counts;
})();

export function categoryOf(id: string): ActivityCategory {
  return CATEGORY_BY_ID.get(id) ?? "その他";
}
