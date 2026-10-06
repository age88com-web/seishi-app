// tests/takujitsu_activity_definitions_unit.manual.ts
//
// 目的:
//   用事辞書（src/lib/takujitsu/activity/）の単体テスト。
//   docs/takujitsu_activity_rules.md の宜/忌欄から抽出した用事語が
//   ACTIVITY_DEFINITIONS に漏れなく登録され、id重複が無く、
//   用事便覧.pdfに対応する語だけが modernName/description を持つ
//   ことを確認する。
//
// 実行:
//   npx tsx tests/takujitsu_activity_definitions_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { ACTIVITY_DEFINITIONS, ACTIVITY_BY_ID, getActivityDefinition } from "../src/lib/takujitsu/activity";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

// 1. 総件数（docs/takujitsu_activity_rules.md の全表から抽出した用事語数。
//    2026-09-09の用途判定engine 第1フェーズでActivityProfile接続時に
//    「＝」区切り・送り仮名付きの語の取りこぼしを発見し60件追加、242件に確定。
//    同日の詳細神殺象意・確定ルール本番反映フェーズで、神殺象意.pdf原本画像の
//    確認により新たに14語（冠帶・冠笄・取魚・啓攢・捕捉・求嗣・求醫療病・
//    畋獵・醞釀・臨政親民・宴會・開渠穿井・結婚姻・修補垣牆）を追加し256件。
//    擇日UI 第3.5フェーズ（2026-09-10）で、擇日の目的として選択される用事では
//    ない12語（初七・十九・十六・二至二分・伐日・冬至・大凶・大吉・義日・
//    道土・陰將・陽將）を削除し244件。いずれも engine 内部（ActivityProfile/
//    occurrence/resolution）から activityId として一切参照されていないことを
//    確認済み。神殺「義日」（吉神occurrence・profile）は別概念で無変更。
//    原典用事クリーンアップ フェーズ（2026-09-11、
//    docs/takujitsu_original_activity_cleanup.md）で、244件のうち
//    「現代語訳・言い換え・短縮表記」として同一原典用事に確実に対応すると
//    確認できた66件を31件の原典用事idへ統合し178件に確定（意味が近いだけの
//    別原典用事、区分D/Eは統合していない。「狩猟・魚取・魚釣・魚釣り」→
//    「畋獵・取魚」は十二建除「執・危・収」の季節限定宜と衝突するため見送り）。
//    続くOCR・誤記候補確定フェーズ（2026-09-11、擇日テキスト.pdf本文の
//    内部整合性を根拠に確定）で、8件（救嗣→求嗣／裁種→栽種／開渠穿并→
//    開渠穿井／進人工→進人口／結婚因→結婚姻／安碓磴→安碓磑／宴会→宴會／
//    救医→求医）をさらに統合し170件に確定。「求医／求醫療病」は独立語として
//    反復使用が確認され統合していない。
//    続く原典用事マスター化フェーズ（2026-09-11、原典用事マスター候補102語を
//    ホワイトリストに170件を再照合）で、原典側の直接的な根拠（description
//    自体の記述、原文の「X（Y）」並記構造）が確認できた7件（子作り／設置／
//    移動→安床、子孫繁栄→安葬、家畜→養育、整手足→整手足甲、結婚式→結婚姻）
//    を統合し163件に確定。「似ている」だけの意味的推測での統合はしていない。
//    続く720実例検証フェーズ（2026-09-11、擇日実例.pdf→擇日象意720件の再現
//    テストで「神殺化されていない十二建除・二十八宿固有用事」の実例的必要性を
//    検証。docs/takujitsu_activity_source_layer_validation.md）で、結婚式→
//    結婚姻の統合を取り消し（720件に結婚姻が一度も出現せず、収日だけを根拠に
//    結婚姻が採用された実例が0件だったため）、正式基準（A:吉神凶神の宜忌に
//    存在／B:720実例で十二建除固有の宜として必要と確認された例外8件＝伐木・
//    修置産室・修飾垣墻・安床・平治道塗・破屋壊垣・築堤防・出行）で163件を
//    再分類した。A/Bいずれにも該当せず、ActivityProfileから単なる教材的
//    説明語・言い換えとして参照されるだけだった51件（結婚式含む）を削除し
//    112件に確定（削除したidのActivityProfile参照は別用事へ移植せず、
//    参照ごと削除。「造作」（二十八宿18件参照）と「結婚納采」（十二建除・
//    二十八宿2件参照、神殺象意.pdfでは同義の吉神側は別id「結婚姻＋納采」で
//    実装済み）は影響範囲が大きいためHOLDとし今回削除していない）。
//    docs/takujitsu_original_activity_cleanup.md参照。
//    続くNumbers表判断反映フェーズ（2026-09-11、ユーザーが確認済みの
//    Numbers表の個別判断・メモに従って112件を再整理。
//    docs/takujitsu_activity_definitions_numbers_review.md）で、表に明記
//    された統合14組（搬移→搬入／増改築→修造／造作→修造／造宅→修造／
//    興造動土→修造動土／開市交易等→開市／契約→立券交易／入学→入学求師／
//    行船→乗船渡水／求医→求醫療病／集魚→取魚／狩猟→畋獵／魚取→取魚／
//    魚釣→取魚）と、統合先の記載がない単純削除3件（慈愛・百事・訴訟、
//    ActivityProfile参照も別用事へ移植せず削除）を実行し95件に確定。
//    表にない統合・置換は行っていない。「求医／求醫療病」は前フェーズまで
//    独立語として保持していたが、今回のNumbers表判断で統合対象に指定され
//    たため統合した（過去の「反復使用が確認され統合していない」という
//    判断はこの回で明示的に上書きされた）。
// 2026-09-11追記7（現行95再監査フェーズ）: docs/takujitsu_missing_activity_reaudit.md
// でユーザーが承認したA判定14件（安香・起基定硬・安門・安吟・作灶・造倉庫・
// 苫蓋・放水・造船・合帳・斎醮・合壽木・避宅出火・修宅日）を正式採用し95→109件。
check(`総件数 = 109 (実際: ${ACTIVITY_DEFINITIONS.length})`, ACTIVITY_DEFINITIONS.length === 109);

// 2. id重複が無いこと
const idSet = new Set(ACTIVITY_DEFINITIONS.map((d) => d.id));
check(`id重複なし (${idSet.size} / ${ACTIVITY_DEFINITIONS.length})`, idSet.size === ACTIVITY_DEFINITIONS.length);

// 3. id === canonicalName（原典表記をそのまま安定化したIDという設計どおり）
for (const d of ACTIVITY_DEFINITIONS) {
  check(`id===canonicalName: ${d.id}`, d.id === d.canonicalName);
}

// 4. 用事便覧に対応する語数（現代語訳・説明を持つ語）= 47件
//    （Numbers表判断反映フェーズで「入学」（用事便覧#15）を入学求師へ
//    統合し削除したため37→36。2026-09-11現行95再監査フェーズで新規14件の
//    うち11件が用事便覧と完全一致したため36→47）
const withModern = ACTIVITY_DEFINITIONS.filter((d) => d.youjibinranNo !== undefined);
check(`用事便覧対応 = 47件 (実際: ${withModern.length})`, withModern.length === 47);
for (const d of withModern) {
  check(`${d.canonicalName}: modernName または description のいずれかを保持`, !!d.modernName || !!d.description);
}

// 5. 用事便覧に対応が無い語は modernName/description を持たない（無理な現代語化をしていないことの確認）
//    2026-09-11現行95再監査フェーズで新規14件のうち3件（起基定硬・避宅出火・
//    修宅日）は用事便覧に対応が無い（起基定硬は用事便覧側表記「起基定礎」と
//    1字差のため非対応）ため59→62
const withoutModern = ACTIVITY_DEFINITIONS.filter((d) => d.youjibinranNo === undefined);
check(`用事便覧非対応 = 62件 (実際: ${withoutModern.length})`, withoutModern.length === 62);
for (const d of withoutModern) {
  check(`${d.canonicalName}: modernName未設定`, d.modernName === undefined);
  check(`${d.canonicalName}: description未設定`, d.description === undefined);
}

// 6. 代表サンプル（十二建除・二十八宿・吉神・凶神の各カテゴリから）が解決できること
//    （2026-09-11 原典用事クリーンアップで「埋葬」→「安葬」「衣類裁断」→「裁衣」
//    「婚礼」→「結婚姻」へ統合済みのため、統合先idに差し替えた）
const sampleIds = [
  // 十二建除
  "解除", "動土", "安葬",
  // 二十八宿
  "裁衣", "結婚姻", "修造",
  // 吉神
  "祭祀", "沐浴", "會親友", "祈福", "納財", "解除",
  // 凶神
  "嫁娶", "沐浴", "破屋壊垣", "出軍", "臨官", "堅柱上樑",
];
for (const id of sampleIds) {
  check(`getActivityDefinition("${id}") が解決できる`, getActivityDefinition(id) !== undefined);
}

// 7. 用事便覧との対応がある語のピンポイント検証（原文と食い違っていないか）
check(
  '祭祀.description に「先祖」を含む（用事便覧#1）',
  !!ACTIVITY_BY_ID["祭祀"]?.description?.includes("先祖"),
);
check(
  '解除.description に「厄除け」を含む（用事便覧#9）',
  !!ACTIVITY_BY_ID["解除"]?.description?.includes("厄除け"),
);
check("會親友.youjibinranNo === 14", ACTIVITY_BY_ID["會親友"]?.youjibinranNo === 14);

// 8. OCR・誤記候補 確定フェーズ（2026-09-11）の結果が反映されていること
//    擇日テキスト.pdf本文の内部整合性（出現回数・出現文脈）で「転記誤り」
//    「新字体/旧字体」と確定した8件は正典表記へ統合済み＝旧idは存在しない。
const ocrMerged: [string, string][] = [
  ["救嗣", "求嗣"],
  ["裁種", "栽種"],
  ["開渠穿并", "開渠穿井"],
  ["進人工", "進人口"],
  ["結婚因", "結婚姻"],
  ["安碓磴", "安碓磑"],
  ["宴会", "宴會"],
];
for (const [oldId, newId] of ocrMerged) {
  check(`${oldId} は統合済みで辞書に存在しない`, ACTIVITY_BY_ID[oldId] === undefined);
  check(`統合先 ${newId} は独立エントリとして存在`, ACTIVITY_BY_ID[newId] !== undefined);
}
// 「救医→求医」（OCR確定フェーズ、2026-09-11）の統合先「求医」は、
// 今回のNumbers表判断反映フェーズでさらに求醫療病へ統合されたため、
// 「求医」自体は辞書に存在しない（救医→求医→求醫療病と連鎖した）。
check("救医は統合済みで辞書に存在しない", ACTIVITY_BY_ID["救医"] === undefined);
check("求医は今回のNumbers表統合でさらに求醫療病へ統合され辞書に存在しない", ACTIVITY_BY_ID["求医"] === undefined);
check("求醫療病が独立エントリとして存在", ACTIVITY_BY_ID["求醫療病"] !== undefined);
check("竪柱上梁（用事便覧側の表記）は今回未統合のため辞書に存在しない", ACTIVITY_BY_ID["竪柱上梁"] === undefined);

// 9. 720実例検証フェーズ（2026-09-11）で削除した51件のうち、今回も削除済みの
//    ままである49件（放水・安香を除く）が辞書に存在しないこと
//    （神殺=吉神凶神の宜忌に一切存在せず、かつ擇日象意720件で十二建除固有の
//    宜として必要と確認された8件の例外にも該当しない＝教材的説明語・言い換え。
//    docs/takujitsu_activity_source_layer_validation.md参照）
// 2026-09-11現行95再監査フェーズ: 「放水」「安香」は今回の再監査でA判定を
// 受け正式採用idとして再追加されたため、この削除対象リストから除外した
// （放水＝神殺象意.pdf「土瘟」「土公死」条の独立記載が判明しE→A相当に判定が
// 覆った。docs/takujitsu_missing_activity_reaudit.md 3章8項／安香＝過去に
// 一度A判定されながら反映漏れだったことが判明し復活。同2.1章）。
const removed720 = [
  "お祝い", "エステ", "上司とあう", "出財貨", "出貸財", "利益大", "土痕", "城の修復",
  "寿具", "寿器", "建造", "弔い合戦", "征討", "政治の打ち合わせ", "正直な行い",
  "祈求", "祈神", "福願関係全般", "穿井導泉", "結婚嫁娶", "計画を練る", "試験", "贈り物",
  "迎親", "造舎", "造葬", "連絡や便りへの返信",
  "かまど作り", "不動産の取得", "乗馬", "出産後の退院", "壁塗り", "帰宅", "手斧始め",
  "新しい部署への移動", "水口の設置", "漁業", "相談事", "着始め",
  "財を求める", "財産の収蔵", "門の設置", "集金", "風水の造作", "養子を取る",
  "養子を迎える", "養蚕", "髪すき", "魚釣り",
];
check(`720実例検証フェーズの削除対象件数 = 49 (実際: ${removed720.length})`, removed720.length === 49);
for (const id of removed720) {
  check(`${id} は削除済みで辞書に存在しない`, ACTIVITY_BY_ID[id] === undefined);
}
check("安香は今回の再監査で新規追加され辞書に存在する（720削除→再監査で復活）", ACTIVITY_BY_ID["安香"] !== undefined);
check("放水は今回の再監査で新規追加され辞書に存在する（720削除→再監査で復活）", ACTIVITY_BY_ID["放水"] !== undefined);

// 10. 720実例検証フェーズで「原典に存在するのに十二建除のみで供給される例外」
//     として残した8件が引き続き存在すること
const jianchu720Exceptions = ["伐木", "修置産室", "修飾垣墻", "安床", "平治道塗", "破屋壊垣", "築堤防", "出行"];
for (const id of jianchu720Exceptions) {
  check(`${id}（十二建除720実例例外）は辞書に存在`, ACTIVITY_BY_ID[id] !== undefined);
}

// 11. 出貨財の同義誤記2件（出財貨・出貸財）はMERGE対象として削除済み、
//     出貨財自体は独立エントリとして存在（出財寶は別語のため無関係・存置）
check("出財貨は統合済みで辞書に存在しない", ACTIVITY_BY_ID["出財貨"] === undefined);
check("出貸財は統合済みで辞書に存在しない", ACTIVITY_BY_ID["出貸財"] === undefined);
check("出貨財は独立エントリとして存在", ACTIVITY_BY_ID["出貨財"] !== undefined);
check("出財寶（別語）は無関係のため存置", ACTIVITY_BY_ID["出財寶"] !== undefined);

// 11.5 結婚式（前回フェーズで既に統合・削除済み）は今回も再確認：
//     辞書に存在せず、かつ収日ActivityProfileへの「結婚姻」付け替えは
//     取り消し済み（別ファイルtakujitsu_evaluate_activities_unit.manual.tsで
//     収日favorableに結婚姻が含まれないことを確認）。
check("結婚式は辞書に存在しない（統合取り消し後も未復活）", ACTIVITY_BY_ID["結婚式"] === undefined);

// 12. Numbers表判断反映フェーズ（2026-09-11）で統合された14組：
//     削除元idが辞書に存在せず、統合先idが存在すること
//     （旧HOLD対象だった「造作」も今回は修造へ統合され、辞書から消えた）
const numbersMerged: [string, string][] = [
  ["搬移", "搬入"],
  ["増改築", "修造"],
  ["造作", "修造"],
  ["造宅", "修造"],
  ["興造動土", "修造動土"],
  ["開市交易等", "開市"],
  ["契約", "立券交易"],
  ["入学", "入学求師"],
  ["行船", "乗船渡水"],
  ["求医", "求醫療病"],
  ["集魚", "取魚"],
  ["狩猟", "畋獵"],
  ["魚取", "取魚"],
  ["魚釣", "取魚"],
];
check(`Numbers表統合の件数 = 14 (実際: ${numbersMerged.length})`, numbersMerged.length === 14);
for (const [oldId, newId] of numbersMerged) {
  check(`${oldId} は統合済みで辞書に存在しない`, ACTIVITY_BY_ID[oldId] === undefined);
  check(`統合先 ${newId} は独立エントリとして存在`, ACTIVITY_BY_ID[newId] !== undefined);
}

// 13. Numbers表判断反映フェーズで統合先の指定なく単純削除された3件：
//     辞書に存在せず、かつ別用事へ置き換えられていない
//     （「結婚納采」はHOLD対象のまま今回も未削除）
const numbersSimpleRemoved = ["慈愛", "百事", "訴訟"];
check(`Numbers表単純削除の件数 = 3 (実際: ${numbersSimpleRemoved.length})`, numbersSimpleRemoved.length === 3);
for (const id of numbersSimpleRemoved) {
  check(`${id} は削除済みで辞書に存在しない`, ACTIVITY_BY_ID[id] === undefined);
}
check("結婚納采はHOLD対象のため辞書に存在（未削除）", ACTIVITY_BY_ID["結婚納采"] !== undefined);

// 14. カテゴリー変更対象10件は削除されず、辞書に引き続き存在すること
//     （カテゴリー自体の検証は takujitsu_search.manual.ts 側で行う）
const categoryChangedIds = ["剃頭", "整手足甲", "沐浴", "家族会議", "會親友", "祝賀", "親睦", "賓客", "進人口", "鋳造"];
for (const id of categoryChangedIds) {
  check(`${id}（カテゴリー変更対象）は辞書に存在（削除されていない）`, ACTIVITY_BY_ID[id] !== undefined);
}

// 15. 用事詳細・現代語訳フェーズ（2026-09-11）:
//     canonical id/canonicalName は一切変更せず、表示専用のmodernLabelだけを
//     確認済みの59件へ追加した（用事便覧.pdf／神殺象意.pdf／擇日テキスト.pdf／
//     12建除.pdf、またはプロジェクト内の既存descriptionで直接確認できた語のみ。
//     一般知識による推測補完はしていない）。
// 16. 続く保留解消フェーズ（2026-09-11）:
//     残っていた36件について、ユーザー自身が内容を確認・確定した値を
//     反映し、95件全件にmodernLabelを設定した。詳細は
//     docs/takujitsu_activity_modern_label_review.md 参照。
// 17. 現行95再監査フェーズ（2026-09-11）: 95→109。新規14件にもmodernLabelを
//     全件設定済み（docs/takujitsu_missing_activity_reaudit.md参照）。
check(`総件数 = 109件（現行95再監査フェーズで95→109）（実際: ${ACTIVITY_DEFINITIONS.length}）`, ACTIVITY_DEFINITIONS.length === 109);
const withModernLabel = ACTIVITY_DEFINITIONS.filter((d) => d.modernLabel !== undefined);
check(`modernLabel = 109/109件（全件確定） (実際: ${withModernLabel.length})`, withModernLabel.length === 109);
for (const d of ACTIVITY_DEFINITIONS) {
  check(`${d.id}: modernLabelは空文字でない`, !!d.modernLabel && d.modernLabel.trim().length > 0);
  check(`${d.id}: idとcanonicalNameは変更されていない`, d.id === d.canonicalName);
}
// ユーザー提示済みの具体例がその通りの値であること
check('堅柱上樑のmodernLabelが確認済みの値と一致', ACTIVITY_BY_ID["堅柱上樑"]?.modernLabel === "柱を立て、棟上げをすること");
check('啓攢のmodernLabelが確認済みの値と一致', ACTIVITY_BY_ID["啓攢"]?.modernLabel === "改葬のため墓を開き、遺骨を移すこと");
check('安床のmodernLabelが確認済みの値と一致', ACTIVITY_BY_ID["安床"]?.modernLabel === "寝床・ベッドを整えること");
// ユーザーが今回確定した36件のうち代表サンプルが確定値どおりであること
check('冠笄のmodernLabelがユーザー確定値と一致', ACTIVITY_BY_ID["冠笄"]?.modernLabel === "成人の儀式・冠やかんざしを着ける儀礼");
check('臨官のmodernLabelがユーザー確定値と一致', ACTIVITY_BY_ID["臨官"]?.modernLabel === "官職に就くこと・仕事に着任すること");
check('防備のmodernLabelがユーザー確定値と一致', ACTIVITY_BY_ID["防備"]?.modernLabel === "防御・備えを整えること");

// 18. 現行95再監査フェーズ（2026-09-11）で正式追加した14件が全件存在し、
//     idとcanonicalNameが一致し、modernLabelを保持すること
const newActivities14 = [
  "安香", "起基定硬", "安門", "安吟", "作灶", "造倉庫", "苫蓋", "放水",
  "造船", "合帳", "斎醮", "合壽木", "避宅出火", "修宅日",
];
check(`18. 新規14件の件数 = 14 (実際: ${newActivities14.length})`, newActivities14.length === 14);
for (const id of newActivities14) {
  const def = ACTIVITY_BY_ID[id];
  check(`18. ${id} が辞書に存在する`, def !== undefined);
  check(`18. ${id}: id===canonicalName`, def?.id === def?.canonicalName);
  check(`18. ${id}: modernLabelを保持`, !!def?.modernLabel);
}
// 用事便覧と完全一致する11件はyoujibinranNo等も保持していること
const newWithYoujibinran: [string, number][] = [
  ["安香", 7], ["斎醮", 4], ["安門", 38], ["安吟", 39], ["作灶", 41],
  ["造倉庫", 53], ["苫蓋", 55], ["放水", 61], ["合帳", 27], ["合壽木", 89], ["造船", 73],
];
for (const [id, no] of newWithYoujibinran) {
  check(`18. ${id}: youjibinranNo === ${no}`, ACTIVITY_BY_ID[id]?.youjibinranNo === no);
}
// 用事便覧に対応が無い3件（起基定硬は用事便覧側表記「起基定礎」と1字差のため非対応）
const newWithoutYoujibinran = ["起基定硬", "避宅出火", "修宅日"];
for (const id of newWithoutYoujibinran) {
  check(`18. ${id}: youjibinranNo未設定`, ACTIVITY_BY_ID[id]?.youjibinranNo === undefined);
}
// ユーザーが名称・意味の再確認を求めた2件のmodernLabelが用事便覧.pdfの原文と一致
check(
  '18. 起基定硬のmodernLabelが用事便覧#33「起基定礎」の説明と整合',
  ACTIVITY_BY_ID["起基定硬"]?.modernLabel === "基礎工事をし、柱・構造材を建てること",
);
check(
  '18. 安吟のmodernLabelが用事便覧#39の説明と整合',
  ACTIVITY_BY_ID["安吟"]?.modernLabel === "敷地内の路盤・階段・アプローチを設置すること",
);
// 新規14件はActivityProfileへの接続を今回見送っており（推測禁止のため）、
// activityDefinitions.ts側にもfavorable/unfavorableの参照を持たせていない
// ことをここでは確認しない（ActivityProfile側はactivityProfiles.tsを無変更で
// 維持しているため、favorableActivityIds/unfavorableActivityIdsに新規14件の
// idは一切出現しない）。

console.log("[区分B] ロジック単体テスト（用事辞書 ActivityDefinition）");
console.log("根拠: docs/takujitsu_activity_rules.md（宜/忌欄）＋ docs/source/用事便覧.pdf\n");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
