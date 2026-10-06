// src/lib/takujitsu/activity/activityProfiles.ts
//
// 役割:
//   docs/takujitsu_activity_rules.md（十二建除12・二十八宿28・吉神44行→
//   実装済みoccurrence名69件・凶神53行→実装済みoccurrence名65件）と
//   docs/source/神殺象意.pdf（『擇日秘本萬年通書』日家神殺宜忌の原本確認）
//   の宜/忌を、src/lib/takujitsu/activity/activityDefinitions.ts のidへ
//   接続したデータ（ActivityProfile、計174件）。
//
// 唯一の仕様根拠:
//   docs/takujitsu_activity_rules.md
//   docs/source/神殺象意.pdf（詳細宜忌・原本画像確認、docs/takujitsu_except_resolution_final.md参照）
//   src/lib/takujitsu/jianchu.ts（JIANCHU_MEANINGS。十二建除の象意。coreロジックは今回変更していない）
//   src/lib/takujitsu/shuku28.ts（LODGE28_MEANINGS。二十八宿の象意。今回変更なし）
//
// 重要な方針（ユーザー指示、2026-09-09。用途判定engine 第1フェーズ〜
// 詳細神殺象意・確定ルール本番反映フェーズ）:
//   ・「吉神だから全用事に吉」「凶神だから全用事に凶」としない。本文から
//     確定できた宜/忌だけをコード化した。象意不明・保留のものは
//     favorableActivityIds / unfavorableActivityIdsを空配列にし、notesに
//     理由を残す（推測で埋めない）。
//   ・sourceName は必ず対応する occurrence detection コード
//     （src/lib/takujitsu/shinsatsu/*.ts が kichijin[]/kyojin[] に積む
//     文字列、または JianchuResult.name／Shuku28Info.lodge）と完全一致
//     させる。
//   ・凶神でも本文に明示的な「宜」の記載がある場合（月厭・天乙絶気）は
//     favorableActivityIdsへ入れる。吉神でも明示的な「忌」の記載がある
//     場合はunfavorableActivityIdsへ入れる。sourceTypeによる一般化は
//     行っていない。
//   ・神殺象意.pdf原本確認により判明した2つの追加構造（types.ts参照）：
//     (a) ALL型（positiveMode: "all_except"）＝「諸事皆宜、惟忌〇〇」＝
//         6吉神（天徳・月徳・天徳合・月徳合・天赦・天願）だけに適用。
//         天徳/月徳/天徳合/月徳合/天赦は例外＝畋獵・取魚の2件。天願は
//         原文に例外の明記が無いため例外なし（推測で天徳と同一にしない）。
//     (b) EXCEPT型（negativeMode: "all_except"）＝「止不忌〇〇、餘事皆忌」＝
//         10凶神（月破・死神・劫殺・災殺・月刑・月厭・四廢・上朔・
//         四離・四絶）だけに適用（月殺は 2026-10-06 監修訂正で LIST 型（賓客・動土・栽種の3用事）に変更し、EXCEPT 型から外した）。exceptionActivityIdsは「不忌」であり
//         「宜」ではない（他に宜の根拠が無い限りpositiveにはならない）。
//     いずれも該当する6/10件以外はLIST型（既存どおり明示列挙）のまま。
//   ・COMPOSITE型（composite: true）＝六黄道のうち青龍・明堂・寶光・玉堂の4神に適用
//     （神殺象意.pdf「爲六黄道日、與吉神併則從所宜、與凶神併則從所忌」）。金匱は原文の
//     列挙に無いため対象外。司命は原文の列挙にあるが、監修確定（2026-10-06）により
//     一般的な吉日を示す吉神として扱い、追従させない（generalAuspiciousDay）。composite は
//     favorableActivityIds（家族会議・遠行）を置換しない追加フラグで、
//     評価はevaluateActivities()の第2パスが担う（docs/takujitsu_liuhuangdao_composite_analysis.md）。
//   ・小時のみreducedStillUnfavorableActivityIdsを持つ（「與徳合等併、
//     止忌動土、餘則不忌」＝resolutionが"reduced"でも修造動土・伐木だけ
//     忌が残る）。
//   ・移徙（既存id「移徒」との類似語ペア、未確認）のような類似語は
//     統合していない（保留のまま、SAFE_ADDから除外）。
//   ・複数の名前が1行に併記され、原文が名前ごとに用事を書き分けていない
//     場合（例：四離・四絶、上兀・下兀、瘟入・瘟出）は、同一のリストを
//     両方のsourceNameに割り当てた。天吏は大時と、地嚢は土符と同一の忌
//     リストを持つ（神殺象意.pdfが「忌同大時」「土符と同一リスト」と
//     明記）。
//   ・十二建除は、神殺象意.pdfで季節条件なしに確定できた7直（建・除・平・
//     定・破・開・閉）に加え、執・危・收（季節条件付き。2026-09-09）、
//     成（12建除.pdf＋神殺象意.pdfのunion。C案。2026-09-10。
//     docs/takujitsu_jianchu_cheng_conflict_analysis.md）を実装済み。
//     滿のみ神殺象意.pdfに単独記載が無く保留。jianchu.tsの
//     JIANCHU_MEANINGS／resolveJianchu()自体は変更していない。
//   ・二十八宿はshuku28.tsのLODGE28_MEANINGSと合わせて今回変更なし。
//
// 2026-09-11追記（原典用事クリーンアップ フェーズ）:
//   activityDefinitions.ts の244→178統合（docs/takujitsu_original_activity_cleanup.md）
//   に伴い、favorableActivityIds / unfavorableActivityIds /
//   positiveExceptionActivityIds / exceptionActivityIds /
//   reducedStillUnfavorableActivityIds 内の統合元id（66件）を統合先idへ
//   機械的に置換し、配列内の重複を除去した。sourceType・sourceName・
//   positiveMode・negativeMode・composite・seasonalRules・各エントリの
//   宜/忌の「集合としての意味」は一切変更していない（idの表記が変わった
//   だけで、どのoccurrenceがどの用事を宜/忌とするかの実体は不変）。
//   ただし「執・危・収」のseasonalRulesと「魚釣り・狩猟」「畋獵・取魚」の
//   常時/季節限定の書き分けが衝突することが判明したため、「狩猟」
//   「魚取」「魚釣」「魚釣り」→「畋獵」「取魚」の統合は行っていない
//   （季節限定宜が常時宜化する実害を差分テストで検出し、統合前に
//   revertした）。
//
// 2026-09-11追記2（720実例検証フェーズ）:
//   docs/takujitsu_activity_source_layer_validation.md の720実例検証結果に
//   基づき、A（吉神・凶神の宜忌に存在）B（720実例で十二建除固有の宜として
//   必要と確認された8件）いずれにも該当しないid（51件、教材的説明語・
//   言い換え）への参照を、各エントリのfavorableActivityIds /
//   unfavorableActivityIds / seasonalRulesから削除した（別idへの
//   付け替え・移植はしていない。宜/忌の実体が減っただけで新規追加なし）。
//   併せて「結婚式→結婚姻」統合を取り消し、収のfavorableActivityIdsから
//   「結婚姻」を削除した（神殺象意.pdf側に収日の婚姻系用事の記載が無く、
//   擇日象意720件でも結婚姻が一度も出現せず、収だけを根拠に結婚姻が
//   採用された実例が0件だったため。別用事へは移植していない）。
//   「造作」（二十八宿18箇所から参照）と「結婚納采」（十二建除・二十八宿
//   2箇所から参照）は影響範囲が大きいためHOLDとし変更していない。

// 2026-09-11追記3（Numbers表判断反映フェーズ）:
//   ユーザーが確認済みNumbers表に明記された統合14組だけを実行し、削除元
//   activityIdを参照する各配列（favorableActivityIds / unfavorableActivityIds /
//   exceptionActivityIds）で統合先idへ置換した。置換後に統合先が既に
//   同じ配列内に存在していた場合は重複させず削除元だけを取り除いた
//   （契約→立券交易＠六合、興造動土/求医/開市交易等→各統合先＠血支、
//   求医→求醫療病＠天醫・天喜・死気・五墓・月忌日・驛馬、
//   集魚→取魚＠觸水龍、狩猟→畋獵＠開）。統合先の記載が無い3件
//   （慈愛・百事・訴訟）は、参照している配列からその参照だけを削除し、
//   別のactivityIdへ移植していない。表にない統合・置換は行っていない。
//   例外1件：jianchu「執」のfavorableActivityIds「狩猟」は、機械的な置換
//   （狩猟→畋獵）を行うと「畋獵」が同エントリのseasonalRules（霜降後立春前
//   限定の季節宜）と重複し、季節限定のはずの畋獵が常時宜化する（以前の
//   フェーズで確認済みの不具合の再発、テスト16.で実検出）。ユーザーに確認の
//   うえ、この1件だけ「狩猟」を単純に取り除く（dedup相当）扱いとし、
//   「畋獵」を新規追加しなかった（seasonalRulesの畋獵が既にこの用事を
//   カバーしているため）。他の3件（jianchu「開」unfavorable・kyojin
//   「氣往亡」unfavorable・kyojin「八節日」unfavorable）は指示どおり
//   狩猟→畋獵の置換を実行した（いずれも忌側で季節ルールの対象外のため
//   問題なし）。
//   詳細は docs/takujitsu_activity_definitions_numbers_review.md 参照。
//
// 2026-09-11追記4（現行95再監査フェーズ・ActivityProfile再監査、95→109で追加した
// 14件のprofile接続確認）:
//   docs/takujitsu_missing_activity_reaudit.md でユーザー承認され追加された
//   14件（安香・起基定硬・安門・安吟・作灶・造倉庫・苫蓋・放水・造船・合帳・
//   斎醮・合壽木・避宅出火・修宅日）について、無条件の宜/忌が明記された原典
//   箇所だけを再確認し、確実なもの2件を接続した：
//     jianchu「開」favorableへ「放水」「安門」を追加（`docs/source/12建除.pdf`
//     ⑪開日「門の設置、水口の設置に良い日である。風水の造作に良い。**放水に
//     吉**。」＝無条件・原文直接記載。「安門」は旧id「門の設置」〈720実例
//     検証フェーズで削除済み〉と同一概念であることをdocs/takujitsu_
//     hongshi_activity_mapping.md L33で確認済み）。
//   保留とした1件（未実装）：shuku28「危」favorableへの「作灶」追加候補
//     （`docs/source/12建除.pdf` 危宿「壁塗り、**かまど作り**、出行など吉」。
//     「かまど」は「灶」の訓読みで「作灶」と同一概念と考えられるが、字面の
//     完全一致ではなく読みを介した対応のため、今回はコードへ反映せず
//     ユーザー確認待ちとした）。
//   `docs/source/神殺象意.pdf`側でreaudit docが指摘した候補（〔冰滑瓦碎〕
//   〔土瘟〕〔土公死〕〔火星〕〔帝酷殺〕〔鼓輪殺〕）は、いずれも
//   `docs/takujitsu_hongshi_activity_mapping.md`§2が「本プロジェクトの吉神・
//   凶神ロスターに存在しない別体系の神殺名」と明記済み、かつ
//   `src/lib/takujitsu/shinsatsu/*.ts`のoccurrence実装（kichijin[]/kyojin[]に
//   積む全名称）にも該当する別名定義が無いことを確認した（「天火」＝「災殺」
//   の別名のようなドキュメント化された対応関係が存在しない）。原文の宜/忌を
//   確認できたとしても、対応するoccurrence detectionがこのプロジェクトに
//   実装されていないため、ActivityProfileのsourceNameとして接続できない
//   （新規occurrence実装は今回の作業範囲外）。
//   上記以外の10件（起基定硬・安香・安吟・造倉庫・苫蓋・造船・合帳・斎醮・
//   合壽木・避宅出火・修宅日）は、`docs/source/神殺象意.pdf`・
//   `docs/source/擇日テキスト.pdf`・`docs/source/12建除.pdf`・
//   `docs/source/擇日実例.pdf`のいずれからも、既存roster内の神殺・十二建除・
//   二十八宿による無条件の宜/忌の直接記載を確認できず、未接続のまま。
//   なお全109件は、negativeMode/positiveMode==="all_except"の10凶神
//   （月破・死神・劫殺・災殺・月刑・月厭・四廢・上朔・四離・四絶）・
//   6吉神（天徳・月徳・天徳合・月徳合・天赦・天願）からは、`evaluateActivities.ts`
//   の`ALL_ACTIVITY_IDS`（ACTIVITY_BY_IDから動的に生成）による既存の仕組みで
//   自動的に忌/宜を受ける（exceptionActivityIds/positiveExceptionActivityIdsに
//   明記されていない限り）。これは新規のコード変更なしに元々有効な挙動であり、
//   「苫蓋」が神殺象意.pdfの構造化転記`tests/fixtures/shinsatsu_shogi_source.py`
//   に残る「災殺」のnote「天火として専忌: 苫蓋」（＝災殺の別名「天火」の
//   忌）とも整合する。詳細は docs/takujitsu_missing_activity_reaudit.md
//   11章参照。
//
// 2026-09-11追記5（ActivityProfile再監査 続編。ユーザー確認・正式採用分）:
//   11.5章の要確認2件をユーザーが確認のうえ正式接続した：
//   (a) kyojin「四方耗」unfavorableActivityIdsへ「造倉庫」「造船」を追加。
//       根拠は`docs/source/擇日テキスト.pdf` 50)四方耗「忌：出行、開市、
//       立券交易、納財、造倉庫、造船」（無条件記載）。出典が`神殺象意.pdf`
//       ではなく`擇日テキスト.pdf`であることを理由に除外しない、という
//       ユーザー判断による（擇日テキスト.pdfは本プロジェクトの正式な
//       5原典資料の1つ）。
//   (b) shuku28「危」favorableActivityIdsへ「作灶」を追加。根拠は
//       `docs/source/12建除.pdf`の二十八宿「危」（読み「き」）
//       「壁塗り、かまど作り、出行など吉」。「かまど作り」＝「作灶」の
//       対応はユーザーが正式承認した。
//   重要な区別（混同注意）: 12建除.pdfには同じ「危」の字を使う別の2項目が
//   ある。十二建除の「危日」（読み「あやぶじつ」。原文「危険な日であり
//   リスクの高いことはしない。特に乗船は凶。ベッドの買い替え設置や移動、
//   子作りに吉。」＝かまど・作灶への言及なし）と、二十八宿の「危」（読み
//   「き」。上記「かまど作り」の記載がある方）は全くの別概念。「作灶」の
//   宜は**二十八宿の危宿**に属し、十二建除の危日には一切帰属しない
//   （jianchu「危」のActivityProfileには「作灶」を追加していない）。

import type { ActivityProfile } from "./types";

const SOLAR_TERMS_SOUKOU_TO_RISSHUN = ["霜降", "立冬", "小雪", "大雪", "冬至", "小寒", "大寒"];
const SOLAR_TERMS_USUI_TO_RIKKA = ["雨水", "啓蟄", "春分", "清明", "穀雨"];
const SOLAR_TERMS_RITTOU_TO_RISSHUN = ["立冬", "小雪", "大雪", "冬至", "小寒", "大寒"];

export const ACTIVITY_PROFILES: ActivityProfile[] = [
  { sourceType: "jianchu", sourceName: "建", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: ["伐木"] },
  { sourceType: "jianchu", sourceName: "除", favorableActivityIds: ["剃頭", "掃舎宇", "整手足甲", "求醫療病", "沐浴", "解除", "祈福"], unfavorableActivityIds: [] },
  { sourceType: "jianchu", sourceName: "満", favorableActivityIds: ["開市", "立券交易", "修倉庫"], unfavorableActivityIds: ["動土", "安葬"] },
  { sourceType: "jianchu", sourceName: "平", favorableActivityIds: ["修飾垣墻", "修造", "平治道塗"], unfavorableActivityIds: [] },
  { sourceType: "jianchu", sourceName: "定", favorableActivityIds: ["冠帶"], unfavorableActivityIds: ["出行", "移徒"] },
  {
    sourceType: "jianchu",
    sourceName: "執",
    favorableActivityIds: ["捕捉"],
    unfavorableActivityIds: [],
    seasonalRules: [
      { label: "霜降後、立春前", solarTerms: SOLAR_TERMS_SOUKOU_TO_RISSHUN, favorableActivityIds: ["畋獵"] },
      { label: "雨水後、立夏前", solarTerms: SOLAR_TERMS_USUI_TO_RIKKA, favorableActivityIds: ["取魚"] },
    ],
    notes: "",
  },
  { sourceType: "jianchu", sourceName: "破", favorableActivityIds: ["求醫療病", "破屋壊垣"], unfavorableActivityIds: [] },
  {
    sourceType: "jianchu",
    sourceName: "危",
    favorableActivityIds: ["安床"],
    unfavorableActivityIds: ["乗船渡水"],
    seasonalRules: [
      { label: "立冬後、立春前", solarTerms: SOLAR_TERMS_RITTOU_TO_RISSHUN, favorableActivityIds: ["伐木"] },
      { label: "霜降後、立春前", solarTerms: SOLAR_TERMS_SOUKOU_TO_RISSHUN, favorableActivityIds: ["畋獵"] },
      { label: "雨水後、立夏前", solarTerms: SOLAR_TERMS_USUI_TO_RIKKA, favorableActivityIds: ["取魚"] },
    ],
    notes: "",
  },
  {
    sourceType: "jianchu",
    sourceName: "成",
    favorableActivityIds: ["結婚姻", "結婚納采", "入学求師", "移徒", "築堤防", "開市"],
    unfavorableActivityIds: [],
  },
  {
    sourceType: "jianchu",
    sourceName: "収",
    favorableActivityIds: ["安葬", "出行", "進人口", "納財", "捕捉", "納畜"],
    unfavorableActivityIds: [],
    seasonalRules: [
      { label: "霜降後、立春前", solarTerms: SOLAR_TERMS_SOUKOU_TO_RISSHUN, favorableActivityIds: ["畋獵"] },
      { label: "雨水後、立夏前", solarTerms: SOLAR_TERMS_USUI_TO_RIKKA, favorableActivityIds: ["取魚"] },
    ],
    notes: "",
  },
  { sourceType: "jianchu", sourceName: "開", favorableActivityIds: ["上官赴任", "上梁", "修置産室", "修造動土", "入学求師", "安碓磑", "宴會", "栽種", "求嗣", "求醫療病", "牧養", "祈福", "祭祀", "裁衣", "解除", "開市", "開渠穿井", "放水", "安門"], unfavorableActivityIds: ["伐木", "取魚", "啓攢", "安葬", "畋獵", "破土"] },
  { sourceType: "jianchu", sourceName: "閉", favorableActivityIds: ["補垣塞穴", "安葬", "築堤防"], unfavorableActivityIds: ["求醫療病"] },
  { sourceType: "shuku28", sourceName: "角", favorableActivityIds: ["裁衣", "醞釀", "開井"], unfavorableActivityIds: ["安葬"] },
  { sourceType: "shuku28", sourceName: "亢", favorableActivityIds: ["結婚納采", "結婚姻", "栽種", "裁衣"], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "氐", favorableActivityIds: ["結婚姻", "醞釀", "移徒", "栽種"], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "房", favorableActivityIds: ["結婚姻", "出行", "祭祀", "修造", "裁衣"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "心", favorableActivityIds: ["祭祀", "移徒", "出行"], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "尾", favorableActivityIds: [], unfavorableActivityIds: ["結婚姻", "開市", "移徒", "修造", "裁衣"] },
  { sourceType: "shuku28", sourceName: "箕", favorableActivityIds: ["修造", "醞釀"], unfavorableActivityIds: ["結婚姻", "安葬"] },
  { sourceType: "shuku28", sourceName: "斗", favorableActivityIds: ["動土", "修造"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "牛", favorableActivityIds: [], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "女", favorableActivityIds: [], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "虚", favorableActivityIds: ["入学求師"], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "危", favorableActivityIds: ["出行", "作灶"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "室", favorableActivityIds: ["祭祀", "祈福", "結婚姻", "乗船渡水", "修造"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "壁", favorableActivityIds: ["修造", "結婚姻", "裁衣"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "奎", favorableActivityIds: ["修造", "堅柱上樑", "開井", "出行"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "婁", favorableActivityIds: ["結婚姻", "修造"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "胃", favorableActivityIds: ["上官赴任", "結婚姻", "修造"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "昴", favorableActivityIds: ["祈福", "修造"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "畢", favorableActivityIds: ["祭祀", "修造"], unfavorableActivityIds: ["結婚姻"] },
  { sourceType: "shuku28", sourceName: "觜", favorableActivityIds: ["入学求師"], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "参", favorableActivityIds: ["修造", "遠行"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "井", favorableActivityIds: ["祭祀", "栽種"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "鬼", favorableActivityIds: [], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "柳", favorableActivityIds: [], unfavorableActivityIds: ["修造"] },
  { sourceType: "shuku28", sourceName: "星", favorableActivityIds: ["求醫療病"], unfavorableActivityIds: ["結婚姻", "安葬"] },
  { sourceType: "shuku28", sourceName: "張", favorableActivityIds: ["出行", "上官赴任", "結婚姻", "栽種"], unfavorableActivityIds: [] },
  { sourceType: "shuku28", sourceName: "翼", favorableActivityIds: ["栽種", "出行"], unfavorableActivityIds: ["結婚姻"] },
  { sourceType: "shuku28", sourceName: "軫", favorableActivityIds: [], unfavorableActivityIds: ["裁衣"] },
  { sourceType: "kichijin", sourceName: "天徳", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: ["取魚", "畋獵"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "月徳", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: ["取魚", "畋獵"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "天徳合", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: ["取魚", "畋獵"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "月徳合", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: ["取魚", "畋獵"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "歳徳", favorableActivityIds: ["修造", "動土", "嫁娶"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "歳徳合", favorableActivityIds: ["修造", "動土", "嫁娶"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天赦", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: ["取魚", "畋獵"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "月恩", favorableActivityIds: ["上官赴任", "修造", "修造動土", "出貨財", "動土", "堅柱上樑", "結婚姻", "栽種", "求嗣", "牧養", "祈福", "祭祀", "移徒", "納財", "納采", "解除", "開倉庫"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "母倉", favorableActivityIds: ["栽種", "牧養", "納畜", "納財"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天願", positiveMode: "all_except", favorableActivityIds: [], positiveExceptionActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "四相", favorableActivityIds: ["上官赴任", "修造動土", "出貨財", "堅柱上樑", "栽種", "求嗣", "牧養", "祈福", "祭祀", "移徒", "納財", "納采", "結婚姻", "解除", "遠行", "開倉庫", "養育"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "時徳", favorableActivityIds: ["上官赴任", "修造動土", "出貨財", "堅柱上樑", "栽種", "求嗣", "牧養", "祈福", "祭祀", "移徒", "納財", "納采", "結婚姻", "解除", "遠行", "開倉庫", "養育"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "王日", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "官日", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "守日", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "相日", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "民日", favorableActivityIds: ["交易", "宴會", "栽種", "牧養", "立券交易", "納畜", "納財", "納采", "結婚姻", "進人口", "開市"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "三合", favorableActivityIds: ["上梁", "交易", "修倉庫", "修造", "修造動土", "堅柱上樑", "結婚姻", "嫁娶", "安碓磑", "宴會", "立券交易", "納畜", "納財", "納采", "経絡", "裁衣", "進人口", "醞釀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "六合", favorableActivityIds: ["交易", "結婚姻", "嫁娶", "安葬", "宴會", "立券交易", "納畜", "納財", "経絡", "賓客", "進人口", "醞釀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "五合", favorableActivityIds: ["結婚姻", "宴會", "祈福", "移徒", "立券交易", "乗船渡水", "開光"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "寶日", favorableActivityIds: ["栽種"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "義日", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "専日", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "鳴吠", favorableActivityIds: ["安葬", "破土"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "鳴吠對", favorableActivityIds: ["啓攢", "破土"], unfavorableActivityIds: ["安葬"] },
  { sourceType: "kichijin", sourceName: "要安", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "玉宇", favorableActivityIds: ["修造", "結婚姻", "賓客"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "金堂", favorableActivityIds: ["建築", "修造"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "啓安", favorableActivityIds: ["親睦", "儀礼"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "普護", favorableActivityIds: ["求醫療病", "祈福", "祭祀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "福生", favorableActivityIds: ["祈福", "祭祀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "聖心", favorableActivityIds: ["上表彰", "祈福", "祭祀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "益後", favorableActivityIds: ["嫁娶", "求嗣", "祈福", "祭祀", "修造"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "續世", favorableActivityIds: ["求嗣", "祈福", "祭祀", "結婚姻", "親睦"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "五富", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "天倉", favorableActivityIds: ["納財", "牧養"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "陽徳", favorableActivityIds: ["上官赴任", "交易", "結婚姻", "臨政親民", "開市"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "陰徳", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "不將", favorableActivityIds: ["嫁娶", "結婚姻"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "六儀", favorableActivityIds: ["牧養", "栽種"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "驛馬", favorableActivityIds: ["入学求師", "上官赴任", "求醫療病", "祈福", "移徒"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天馬", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "青龍", favorableActivityIds: ["家族会議", "遠行"], unfavorableActivityIds: [], composite: true },
  { sourceType: "kichijin", sourceName: "明堂", favorableActivityIds: ["家族会議", "遠行"], unfavorableActivityIds: [], composite: true },
  { sourceType: "kichijin", sourceName: "金匱", favorableActivityIds: ["家族会議", "遠行"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "寶光", favorableActivityIds: ["家族会議", "遠行"], unfavorableActivityIds: [], composite: true },
  { sourceType: "kichijin", sourceName: "玉堂", favorableActivityIds: ["家族会議", "遠行"], unfavorableActivityIds: [], composite: true },
  // 司命：監修確定（2026-10-06）。特定の用事に個別の宜を与える神ではなく、一般的な吉日を示す吉神
  // （擇日テキスト p.15「吉の象意としての特別な意味はなく、一般的な吉日である」）。個別用事の宜忌には
  // 展開せず（家族会議・遠行の宜も持たない）、六黄道の追従（COMPOSITE）も行わない。日次評価の要素として
  // generalAuspiciousDay を立てる。
  { sourceType: "kichijin", sourceName: "司命", favorableActivityIds: [], unfavorableActivityIds: [], generalAuspiciousDay: true, notes: "一般的な吉日（個別用事には展開しない）" },
  { sourceType: "kichijin", sourceName: "解神", favorableActivityIds: ["上表彰", "剃頭", "掃舎宇", "整手足甲", "求醫療病", "沐浴", "解除"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "臨日", favorableActivityIds: ["上官赴任", "臨政親民"], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "兵福", favorableActivityIds: ["出兵"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "吉期", favorableActivityIds: ["上官赴任", "出兵", "剃頭", "掃舎宇", "整手足甲", "會親友", "求醫療病", "沐浴", "解除"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天巫", favorableActivityIds: ["修倉庫", "修造", "出貨財", "祈福", "祭祀", "立券交易", "納財", "経絡", "裁衣", "補垣塞穴", "進人口", "開倉庫", "開市"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "福徳", favorableActivityIds: ["修倉庫", "修造", "出貨財", "宴會", "祈福", "祭祀", "立券交易", "納財", "経絡", "裁衣", "補垣塞穴", "進人口", "開倉庫", "開市"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "時陰", favorableActivityIds: ["冠帶", "會親友", "策略"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "枝德", favorableActivityIds: ["修造", "築垣"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天醫", favorableActivityIds: ["求醫療病"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天喜", favorableActivityIds: ["求醫療病"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "生氣", favorableActivityIds: ["開道", "溝渠", "修造", "養育"], unfavorableActivityIds: ["伐木", "取魚"] },
  { sourceType: "kichijin", sourceName: "時陽", favorableActivityIds: ["開道", "溝渠", "修造", "養育"], unfavorableActivityIds: ["伐木", "取魚"] },
  { sourceType: "kichijin", sourceName: "兵吉", favorableActivityIds: ["出兵", "出陣"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天瑞", favorableActivityIds: ["上官赴任", "祝賀"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "天福", favorableActivityIds: ["入宅", "上官赴任"], unfavorableActivityIds: [] },
  { sourceType: "kichijin", sourceName: "大明", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "天貴", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "催官", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kichijin", sourceName: "季分", favorableActivityIds: ["嫁娶"], unfavorableActivityIds: [] },
  { sourceType: "kyojin", sourceName: "小時", favorableActivityIds: [], unfavorableActivityIds: ["伐木", "修倉庫", "修置産室", "修造動土", "出貨財", "剃頭", "啓攢", "堅柱上樑", "安葬", "整手足甲", "栽種", "求嗣", "求醫療病", "破土", "破屋壊垣", "祈福", "築堤防", "納采", "結婚姻", "解除", "開倉庫"], reducedStillUnfavorableActivityIds: ["修造動土", "伐木"], notes: "" },
  { sourceType: "kyojin", sourceName: "月破", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["入学求師", "取魚", "平治道塗", "捕捉", "掃舎宇", "求醫療病", "沐浴", "畋獵", "破屋壊垣", "祭祀", "解除"], notes: "" },
  { sourceType: "kyojin", sourceName: "死神", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "修飾垣墻", "入学求師", "剃頭", "取魚", "安碓磑", "平治道塗", "捕捉", "掃舎宇", "整手足甲", "沐浴", "畋獵", "破屋壊垣", "祭祀", "補垣塞穴"], notes: "" },
  { sourceType: "kyojin", sourceName: "死気", favorableActivityIds: [], unfavorableActivityIds: ["修置産室", "出征", "栽種", "求醫療病", "解除"] },
  { sourceType: "kyojin", sourceName: "血支", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "修置産室", "修造動土", "出庫", "出貨財", "堅柱上樑", "嫁娶", "安床", "宴會", "求醫療病", "祭祀", "納采", "結婚姻", "進人口", "鍼灸", "開倉庫", "開市", "開渠穿井"] },
  { sourceType: "kyojin", sourceName: "劫殺", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "入学求師", "取魚", "平治道塗", "捕捉", "掃舎宇", "沐浴", "畋獵", "祭祀"], notes: "" },
  { sourceType: "kyojin", sourceName: "災殺", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "入学求師", "取魚", "平治道塗", "捕捉", "掃舎宇", "沐浴", "畋獵", "祭祀"], notes: "" },
  { sourceType: "kyojin", sourceName: "月殺", favorableActivityIds: [], unfavorableActivityIds: ["賓客", "動土", "栽種"], notes: "監修訂正（2026-10-06）：月殺の忌は擇日テキスト.pdf p.22「月殺＝賓客・動土・種蒔き」の3用事だけ（種蒔き＝栽種）。神殺象意.pdf「忌同劫殺」による all_except（餘事皆忌）の適用は誤りとして削除。" },
  { sourceType: "kyojin", sourceName: "月厭", favorableActivityIds: ["祈福"], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["入学求師", "取魚", "捕捉", "掃舎宇", "沐浴", "畋獵", "祭祀"], notes: "" },
  { sourceType: "kyojin", sourceName: "厭對", favorableActivityIds: [], unfavorableActivityIds: ["乗船渡水", "取魚", "嫁娶"] },
  { sourceType: "kyojin", sourceName: "月刑", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "入学求師", "取魚", "平治道塗", "捕捉", "掃舎宇", "沐浴", "畋獵", "祭祀"], notes: "" },
  { sourceType: "kyojin", sourceName: "大時", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "修倉庫", "修置産室", "修造動土", "出貨財", "出軍", "取魚", "堅柱上樑", "修造", "嫁娶", "安床", "會親友", "栽種", "求嗣", "求醫療病", "牧養", "祈福", "立券交易", "築堤防", "納畜", "納財", "納采", "結婚姻", "臨官", "解除", "進人口", "遠行", "開倉庫", "開市"] },
  { sourceType: "kyojin", sourceName: "天吏", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "修倉庫", "修置産室", "修造動土", "出貨財", "出軍", "取魚", "堅柱上樑", "修造", "嫁娶", "安床", "會親友", "栽種", "求嗣", "求醫療病", "牧養", "祈福", "立券交易", "築堤防", "納畜", "納財", "納采", "結婚姻", "臨官", "解除", "進人口", "遠行", "開倉庫", "開市"] },
  { sourceType: "kyojin", sourceName: "天賊", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "出貨財", "遠行", "開倉庫"] },
  { sourceType: "kyojin", sourceName: "兵禁", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "大煞", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "土符", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "修置産室", "修補垣牆", "修造動土", "安碓磑", "平治道塗", "建築", "栽種", "破土", "破屋壊垣", "築堤防", "補垣塞穴", "開渠穿井"] },
  { sourceType: "kyojin", sourceName: "地嚢", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "修置産室", "修補垣牆", "修造動土", "安碓磑", "平治道塗", "栽種", "破土", "破屋壊垣", "築堤防", "開渠穿井"], notes: "" },
  { sourceType: "kyojin", sourceName: "四撃", favorableActivityIds: [], unfavorableActivityIds: ["出陣", "防備"] },
  { sourceType: "kyojin", sourceName: "四耗", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "出師", "出貨財", "放債負", "會親友", "立券交易", "納財", "開倉庫", "開市"] },
  { sourceType: "kyojin", sourceName: "小耗", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "出貨財", "立券交易", "納財", "開倉庫", "開市"], notes: "" },
  { sourceType: "kyojin", sourceName: "四廢", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "入学求師", "剃頭", "取魚", "平治道塗", "捕捉", "掃舎宇", "整手足甲", "沐浴", "畋獵", "破屋壊垣", "祭祀"], notes: "" },
  { sourceType: "kyojin", sourceName: "四忌", favorableActivityIds: [], unfavorableActivityIds: ["嫁娶", "安葬", "納采", "結婚姻"] },
  { sourceType: "kyojin", sourceName: "四窮", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "出貨財", "嫁娶", "安葬", "立券交易", "納財", "納采", "結婚姻", "進人口", "開倉庫", "開市"] },
  { sourceType: "kyojin", sourceName: "五虚", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "出財寶", "出貨財", "放債負", "栽種", "開倉庫"] },
  { sourceType: "kyojin", sourceName: "氣往亡", favorableActivityIds: [], unfavorableActivityIds: ["出軍", "上官赴任", "嫁娶", "進人口", "搬入", "求醫療病", "畋獵", "取魚"] },
  { sourceType: "kyojin", sourceName: "五墓", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "上梁", "修置産室", "修造", "修造動土", "冠笄", "啓墳", "啓攢", "堅柱上樑", "嫁娶", "安床", "安葬", "搬入", "栽種", "求醫療病", "牧養", "破土", "立券交易", "納畜", "納采", "結婚姻", "解除", "進人口", "開市"] },
  { sourceType: "kyojin", sourceName: "八風", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "觸水龍", favorableActivityIds: [], unfavorableActivityIds: ["乗船渡水", "取魚"] },
  { sourceType: "kyojin", sourceName: "八専", favorableActivityIds: [], unfavorableActivityIds: ["出軍", "嫁娶"] },
  { sourceType: "kyojin", sourceName: "九空", favorableActivityIds: [], unfavorableActivityIds: ["進人口", "修倉庫", "開市", "立券交易", "納財", "開倉庫", "出貨財"] },
  { sourceType: "kyojin", sourceName: "九焦", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "無禄", favorableActivityIds: [], unfavorableActivityIds: ["乗船渡水", "築堤防", "鋳造", "栽種", "祭祀", "解除"] },
  { sourceType: "kyojin", sourceName: "上朔", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "修飾垣墻", "剃頭", "平治道塗", "掃舎宇", "整手足甲", "沐浴", "破屋壊垣", "祭祀", "補垣塞穴"], notes: "" },
  { sourceType: "kyojin", sourceName: "四離", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "修飾垣墻", "剃頭", "平治道塗", "掃舎宇", "整手足甲", "沐浴", "破屋壊垣", "祭祀", "補垣塞穴"], notes: "" },
  { sourceType: "kyojin", sourceName: "四絶", favorableActivityIds: [], negativeMode: "all_except", unfavorableActivityIds: [], exceptionActivityIds: ["伐木", "修飾垣墻", "剃頭", "平治道塗", "掃舎宇", "整手足甲", "沐浴", "破屋壊垣", "祭祀", "補垣塞穴"], notes: "" },
  { sourceType: "kyojin", sourceName: "歸忌", favorableActivityIds: [], unfavorableActivityIds: ["移徒"], notes: "" },
  { sourceType: "kyojin", sourceName: "往亡", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "取魚", "嫁娶", "捕捉", "求醫療病", "畋獵", "進人口"], notes: "" },
  { sourceType: "kyojin", sourceName: "月害", favorableActivityIds: [], unfavorableActivityIds: ["修倉庫", "修置産室", "出貨財", "啓攢", "嫁娶", "安葬", "宴會", "求嗣", "求醫療病", "牧養", "破土", "祈福", "立券交易", "納畜", "納財", "納采", "経絡", "結婚姻", "進人口", "醞釀", "開倉庫", "開市"], notes: "" },
  { sourceType: "kyojin", sourceName: "遊禍", favorableActivityIds: [], unfavorableActivityIds: ["求嗣", "求醫療病", "祈福", "解除"], notes: "" },
  { sourceType: "kyojin", sourceName: "月忌日", favorableActivityIds: [], unfavorableActivityIds: ["祭祀", "宴會", "沐浴", "整容", "剃頭", "整手足甲", "求醫療病", "補垣塞穴", "掃舎宇", "平治道塗", "破屋壊垣"] },
  { sourceType: "kyojin", sourceName: "八節日", favorableActivityIds: [], unfavorableActivityIds: ["嫁娶", "上官赴任", "會親友", "出行", "進人口", "結婚姻", "納采", "移徒", "入宅", "開市", "立券交易", "畋獵", "取魚", "伐木"] },
  { sourceType: "kyojin", sourceName: "土王用事", favorableActivityIds: [], unfavorableActivityIds: ["築堤防", "修造動土", "修倉庫", "修置産室", "開渠穿井", "安碓磑", "修飾垣墻", "平治道塗", "破屋壊垣", "栽種", "破土", "開市", "納財", "立券交易", "裁衣"] },
  { sourceType: "kyojin", sourceName: "横天朱雀", favorableActivityIds: [], unfavorableActivityIds: ["嫁娶", "上梁", "安葬", "移徒"] },
  { sourceType: "kyojin", sourceName: "四不詳", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "開市", "交易"] },
  { sourceType: "kyojin", sourceName: "上兀", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "入学求師", "乗船渡水"] },
  { sourceType: "kyojin", sourceName: "下兀", favorableActivityIds: [], unfavorableActivityIds: ["上官赴任", "入学求師", "乗船渡水"] },
  { sourceType: "kyojin", sourceName: "瘟入", favorableActivityIds: [], unfavorableActivityIds: ["入宅", "牧養", "修造", "納畜", "移徒"] },
  { sourceType: "kyojin", sourceName: "瘟出", favorableActivityIds: [], unfavorableActivityIds: ["入宅", "牧養", "修造", "納畜", "移徒"] },
  { sourceType: "kyojin", sourceName: "冰消瓦解", favorableActivityIds: [], unfavorableActivityIds: ["上梁"] },
  { sourceType: "kyojin", sourceName: "冰消瓦碎", favorableActivityIds: [], unfavorableActivityIds: ["修造", "蓋屋", "開井"] },
  { sourceType: "kyojin", sourceName: "受死日", favorableActivityIds: [], unfavorableActivityIds: ["上表彰", "修造", "嫁娶", "祭祀"] },
  { sourceType: "kyojin", sourceName: "伏斷日", favorableActivityIds: [], unfavorableActivityIds: ["伐木", "経絡"] },
  { sourceType: "kyojin", sourceName: "埋兒凶宿", favorableActivityIds: [], unfavorableActivityIds: ["安床"], nonReleasableUnfavorableActivityIds: ["安床"], weakInfluence: true, notes: "影響の弱い神殺（監修確定 2026-10-06）。忌は安床だけに限定し、一般用事へは展開しない。洪氏錦嚢 安床忌例「埋兒宿」用いてはいけない（監修確定 2026-10-06：埋兒宿＝埋兒凶宿。安床に対する個別禁止で、吉神による解除不可）。" },
  { sourceType: "kyojin", sourceName: "周堂殺", favorableActivityIds: [], unfavorableActivityIds: ["嫁娶"] },
  { sourceType: "kyojin", sourceName: "天空", favorableActivityIds: [], unfavorableActivityIds: ["堅柱上樑"] },
  { sourceType: "kyojin", sourceName: "地空", favorableActivityIds: [], unfavorableActivityIds: ["安葬"] },
  { sourceType: "kyojin", sourceName: "大空亡", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "小空亡", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "天乙絶気", favorableActivityIds: ["埋坑", "作厠", "安碓磑"], unfavorableActivityIds: ["製寿衣"], notes: "" },
  { sourceType: "kyojin", sourceName: "四方耗", favorableActivityIds: [], unfavorableActivityIds: ["造倉庫", "造船"], notes: "" },
  { sourceType: "kyojin", sourceName: "長星", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "短星", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "揚公忌", favorableActivityIds: [], unfavorableActivityIds: [], notes: "" },
  { sourceType: "kyojin", sourceName: "刀砧日", favorableActivityIds: [], unfavorableActivityIds: ["伐木", "牧養", "納畜", "造畜柵"] },
  { sourceType: "kyojin", sourceName: "龍禁", favorableActivityIds: [], unfavorableActivityIds: ["乗船渡水", "造船"], nonReleasableUnfavorableActivityIds: ["乗船渡水", "造船"], weakInfluence: true, notes: "影響の弱い神殺（監修確定 2026-10-06）。忌は乗船渡水・造船だけに限定し、一般用事へは展開しない。p.43「忌：行船」（乗船渡水）に加え、洪氏錦嚢 造船行舟忌例「龍禁日」用いてはいけない（監修確定 2026-10-06：造船・行舟に対する個別禁止で、吉神による解除不可）。" },
];

const PROFILE_INDEX: Map<string, ActivityProfile> = new Map(
  ACTIVITY_PROFILES.map((p) => [`${p.sourceType}:${p.sourceName}`, p]),
);

export function getActivityProfile(
  sourceType: ActivityProfile["sourceType"],
  sourceName: string,
): ActivityProfile | undefined {
  return PROFILE_INDEX.get(`${sourceType}:${sourceName}`);
}
