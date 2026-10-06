// src/lib/takujitsu/activity/activityDefinitions.ts
//
// 役割:
//   docs/takujitsu_activity_rules.md（十二建除12・二十八宿28・吉神44・
//   凶神53＝計137項目）の宜/忌欄から抽出した用事語のマスタデータ。
//
// 生成方法（推測ではなく機械抽出＋手動レビュー）:
//   docs/takujitsu_activity_rules.md の各表の「宜」「忌」列テキストから
//   活動名を機械的に抽出し、docs/source/用事便覧.pdf（93項目、20番は
//   原本の欠番）と文字列完全一致するものだけに modernName（読み）・
//   description（説明）・youjibinranNoを付与した。
//
//   2026-09-09追記（用途判定engine 第1フェーズでの拡張）:
//   十二建除・二十八宿の宜/忌はプレーンな漢字列だけでなく「酒造り」
//   「井戸掘り」のような送り仮名付きの語や、「＝」で区切られた
//   「名前＝用事」形式（例：「益後＝造宅、嫁娶」）を含む。当初の抽出
//   （182件）はCJK文字のみを対象とする正規表現だったため、これらを
//   取りこぼしていた。ActivityProfile（src/lib/takujitsu/activity/
//   activityProfiles.ts）の接続作業でこの欠落を発見し、
//   docs/takujitsu_activity_rules.md に実在する語を60件追加して242件と
//   した（新しい概念・現代語訳を創作したものは無い。原典表記のまま）。
//
//   方針（ユーザー指示、2026-09-09）:
//   - 用事便覧に対応が無い語は、原典表記をそのまま canonicalName として
//     採用し、無理に現代語化・大分類しない。
//   - 意味が似ているだけの語（例：造作／修造／修造動土／動土）は統合
//     しない。それぞれ別の擇日テキスト.pdf中の記述に基づく別エントリ
//     として保持する。
//   - 新字体/旧字体・OCR誤認の統合は、原本画像で確認できたものだけに
//     限定した。今回のソース（擇日テキスト.pdf・12建除.pdf）はいずれも
//     文字ベースPDFでOCRではないため、明白な新字体/旧字体2件
//     （修飾垣墻＝修飾垣牆、会親友＝會親友。前者はdocs/takujitsu_activity_design.md
//     3.2節で既に確認済みの異体字ペア）のみ統合した。他の紛らわしい対
//     （例：開渠穿并／開渠穿井、堅柱上樑／竪柱上梁、進人口／進入口）は、
//     原本画像未確認のため統合していない（別エントリのまま）。

import type { ActivityDefinition } from "./types";

// 2026-09-11追記（原典用事クリーンアップ フェーズ）:
//   docs/takujitsu_original_activity_terms_audit.md の監査結果（原典用事
//   マスター候補・区分A/B/C/D/E）に基づき、244件のうち「現代語訳・言い換え・
//   短縮表記」として同一原典用事に確実に対応すると確認できた66件を、対応する
//   原典用事id（31件）へ統合した（244→178件）。
//   - 統合したのは区分C（現代語訳・言い換え）と、誤読でない単純な短縮表記
//     （例：補垣→補垣塞穴、開渠→開渠穿井、上官/赴任→上官赴任）に限る。
//
// 2026-09-11追記2（OCR・誤記候補 確定フェーズ）:
//   docs/takujitsu_original_activity_terms_audit.md ★9件のうち8件を、
//   擇日テキスト.pdf（テキストPDF・OCR無し）本文の内部整合性（同一語の
//   出現回数・出現文脈）を根拠に「転記誤り」または「新字体/旧字体」と
//   確定し、178→170件へ統合した（詳細は
//   docs/takujitsu_original_activity_cleanup.md 参照）：
//     救嗣→求嗣／裁種→栽種／開渠穿并→開渠穿井／進人工→進人口／
//     結婚因→結婚姻／安碓磴→安碓磑／宴会→宴會（新字体/旧字体）／
//     救医→求医。
//
// 2026-09-11追記3（原典用事マスター化 フェーズ）:
//   docs/takujitsu_original_activity_terms_audit.md「原典用事マスター候補
//   102語」をホワイトリストとして170件を再照合し、原典側の直接的な根拠
//   （ActivityDefinition自身のdescription・原文の「X（Y）」型の並記構造
//   など）で対応が明確な7件を統合し170→163件にした：
//     子作り／設置／移動→安床（安床のdescription自体が「ベッドの移動や
//     設置、子作り」と明記）／子孫繁栄→安葬（原文「安葬（子孫繁栄）」の
//     並記）／家畜→養育（原文「養育（家畜）」の並記）／整手足→整手足甲
//     （神殺象意.pdf原典は一貫して「整手足甲」、擇日テキスト.pdf死神の
//     1箇所だけ「甲」欠落）／結婚式→結婚姻（結婚式は原典に一度も出現せず
//     12建除.pdf収日の言い換え、他に対応候補なし）。
//   「似ている」というだけの意味的推測では統合していない（例：壁塗り・
//   かまど作り・手斧始め・財を求める・養子を取る・エステ・髪すき等は、
//   12建除.pdf自身の脚注が「現代語の説明」に留まり原典側の直接対応が
//   確認できないため未統合のまま保留）。詳細は
//   docs/takujitsu_original_activity_cleanup.md 参照。
//   「求医／求醫療病」の対だけは、擇日テキスト.pdf内で「求医」が
//   「療病」等と並列される独立語として反復使用されており、求醫療病の
//   単純な省略形と断定できないため統合していない（両方残す）。
//   - 「畋獵」「取魚」への統合は見送った：十二建除「執・危・収」の
//     favorableActivityIdsは季節限定宜（seasonalRules、霜降後立春前のみ
//     畋獵、雨水後立夏前のみ取魚）を持つ一方、同じ「執」の常時宜・「開」の
//     忌には原文どおり「魚釣り・漁業・狩猟・捕捉」という別語が季節に関係
//     なく並存している。「狩猟」→「畋獵」・「魚釣り」→「取魚」を統合すると
//     季節限定のはずの畋獵・取魚が常時宜になってしまう（差分テストで実害を
//     確認済み）。原典が意図的に書き分けている可能性が高く、「狩猟・魚取・
//     魚釣・魚釣り」は今回統合していない。
//   - 「意味が近いだけ」の別原典用事（例：嫁娶と納采、移徙と入宅、破土と
//     安葬、開市と立券交易、修造と動土、修造と修造動土、上梁と修造、
//     出行と遠行）は統合していない。
//   - 区分D（複合語・説明語の1語化）・区分E（原典対応未確認）は今回
//     原則統合していない（次のユーザー目視削除工程に委ねる）。
//   - 統合に伴い、参照していた ActivityProfile
//     （src/lib/takujitsu/activity/activityProfiles.ts）の
//     favorableActivityIds / unfavorableActivityIds /
//     positiveExceptionActivityIds / exceptionActivityIds /
//     reducedStillUnfavorableActivityIds、および activityCategories.ts の
//     CATEGORY_MEMBERS を、対象id→統合先idへ機械的に付け替え、重複を
//     正規化した（宜/忌の判定内容・occurrence・resolution・十二建除・
//     二十八宿ロジックは無変更）。
//   詳細は docs/takujitsu_original_activity_cleanup.md 参照。
//
// 2026-09-11追記4（720実例検証フェーズ）:
//   擇日実例.pdf→擇日象意720件を再現テストし、「神殺化されていない
//   十二建除・二十八宿固有用事を最終的な用事マスターへ採用する必要が
//   あるか」を実例で検証した（docs/takujitsu_activity_source_layer_
//   validation.md）。その結果に基づき正式基準を
//     A. 吉神・凶神の宜忌対象として原典に存在する用事
//     B. 吉神・凶神には存在しなくても、擇日実例→擇日象意720件の検証で
//        十二建除から独立して最終宜へ供給されることが実例で確認された
//        用事（伐木・修置産室・修飾垣墻・安床・平治道塗・破屋壊垣・
//        築堤防・出行の8件。うち7件は神殺象意.pdf自身の十二建除
//        セクションにも直接記載があることを確認済み）
//   の2つに確定し、A/Bいずれにも該当せず、ActivityProfileから単なる
//   教材的説明語・言い換え・派生語として参照されるだけだった51件
//   （前回フェーズで統合した「結婚式→結婚姻」も、720実例に結婚姻が
//   一度も出現せず・収日だけを根拠に結婚姻が採用された実例が0件だった
//   ため統合を取り消したうえで削除、別用事へは移植していない）を削除し
//   163→112件にした。REMOVE対象のActivityProfile参照は「意味が近い別
//   用事」へ移植せず、参照ごと削除した（原典上同一と確認できるMERGE
//   2件＝出財貨・出貸財→出貨財の誤記統合のみ、参照は元々ゼロ）。
//   「造作」（二十八宿18件から参照）と「結婚納采」（十二建除・二十八宿
//   2件から参照、神殺象意.pdfでは同義の語が吉神側では「結婚姻」＋「納采」
//   に分割実装されている）は影響範囲が大きく設計判断を要するためHOLDとし
//   今回削除していない。擇日象意720件のユニーク宜用事34件は本フェーズ
//   後も34/34を維持している。詳細は
//   docs/takujitsu_activity_source_layer_validation.md、
//   docs/takujitsu_original_activity_cleanup.md 参照。

// 2026-09-11追記5（Numbers表判断反映フェーズ）:
//   ユーザーが確認済みNumbers表（112件の個別判断・メモ）に基づき112→95件へ
//   整理した。表に明記された統合14組（搬移→搬入／増改築→修造／造作→修造／
//   造宅→修造／興造動土→修造動土／開市交易等→開市／契約→立券交易／
//   入学→入学求師／行船→乗船渡水／求医→求醫療病／集魚→取魚／狩猟→畋獵／
//   魚取→取魚／魚釣→取魚）だけを実行し、統合先が明記されていない語への
//   推測統合はしていない。統合先の記載が無い3件（慈愛・百事・訴訟）は
//   ActivityDefinitionとActivityProfile参照の両方を、別用事へ移植せず
//   単純に削除した。判断欄が空欄だった94件（カテゴリ変更指定分を除く）は
//   変更していない。「家族会議」は表で「残す」と明記されたため存置。
//
// 2026-09-11追記7（現行95再監査フェーズ・95→109）:
//   docs/takujitsu_missing_activity_reaudit.md（原典独立用事の取りこぼし調査、
//   A/B/C/D判定）の結果、ユーザーが「A：独立用事として追加すべき」15件のうち
//   14件（入学を除く。入学求師との乖離は要検討として保留）を正式採用として
//   承認し、95→109件とした。追加14件：安香・起基定硬（用事便覧#33の表記は
//   「起基定礎」だが、id/canonicalNameは擇日テキスト.pdf「起基定硬忌例」の
//   原典表記を採用。既存の堅柱上樑〈用事便覧側「竪柱上梁」とは表記差〉と
//   同じ扱い）・安門・安吟・作灶・造倉庫・苫蓋・放水・造船・合帳・斎醮・
//   合壽木・避宅出火・修宅日。
//   このうち安香・安門・安吟・作灶・造倉庫・苫蓋・放水・造船・合帳・斎醮・
//   合壽木の11件は用事便覧.pdfの項目名と完全一致するため、既存方針どおり
//   modernName／description／youjibinranNoを設定した（起基定硬は用事便覧側
//   表記「起基定礎」と1字差のため非対応、避宅出火・修宅日はそもそも
//   用事便覧に掲載が無いため非対応）。
//   B「既存ActivityDefinitionの明確な別名」14件については、ユーザーが
//   「明確な別名ではない」と判断し、今回この分類を理由とした既存
//   ActivityDefinitionの変更・統合・削除・ActivityProfile付け替えは
//   一切行っていない（既存95件は完全に維持）。
//   「放水」は720実例検証フェーズ（追記4）でE判定・削除された語だが、
//   今回の再監査で神殺象意.pdf「土瘟」「土公死」条に独立記載があることが
//   判明し判定が覆ったため再追加した（tests/takujitsu_activity_definitions_unit.manual.ts
//   のremoved720配列からも削除済み）。
//   ActivityProfile（favorableActivityIds／unfavorableActivityIds）への接続は
//   今回見送った：安門・作灶・放水・合壽木・斎醮の一部は神殺象意.pdf内に
//   関連記述があるとdocs/takujitsu_missing_activity_reaudit.mdが指摘するが、
//   同PDFは縦書き・旧字体の走査画像で該当箇所の神殺名を確実に判読できず
//   （推測禁止の方針により未確認のまま接続することはできない）、また
//   擇日テキスト.pdf「洪氏錦嚢　解説」の各忌例章（起基定硬忌例・安吟忌例・
//   安門忌例・避宅出火忌例・修宅日忌例等）は用事別に凶神を列挙し「吉神に
//   あえば良い」等の条件文を多く含む構造で、activityProfiles.ts側の
//   神殺象意.pdf由来・条件なしの宜/忌リストとは構造が異なる（この種の
//   条件付き記述はhongshiNotes.tsの役割であり、既存方針上ActivityProfileへ
//   機械的に転記すべきものではない）。そのため14件は全件、ActivityDefinition
//   のみ追加しActivityProfile上は未接続（neutral）のまま明示している。
//   詳細は docs/takujitsu_missing_activity_reaudit.md 参照。
//
// 2026-09-11追記6（表示順並べ替えフェーズ）:
//   ユーザー指定のカテゴリー順・カテゴリー内表示順（重要度・利用頻度順）に
//   ACTIVITY_DEFINITIONS配列の並び順を変更した。95件の内容（id／
//   canonicalName／modernName／description／youjibinranNo／modernLabel）は
//   一切変更していない。配列の並び順だけの変更である。
//   src/app/takujitsu/page.tsxの「用途を選ぶ」一覧（pickerList）は、この
//   配列をフィルタするだけで独自の並べ替えを行わない設計のため、この配列
//   順の変更がそのまま「用途を選ぶ」の表示順（カテゴリ絞り込み・検索時も
//   含む）に反映される。カテゴリー自体の変更は
//   activityCategories.ts追記4を参照（「土地・不動産」廃止・「動土」を
//   「建築・工事」へ移動）。

export const ACTIVITY_DEFINITIONS: ActivityDefinition[] = [
  // 2026-09-09追記：神殺象意.pdf（『擇日秘本萬年通書』日家神殺宜忌）を
  // 原本画像で確認して追加した14語（docs/takujitsu_except_resolution_final.md・
  // docs/takujitsu_shinsatsu_shogi_audit.md 参照）。移徙（既存id「移徒」との
  // 類似語ペア、未確認）・會親友/宴會（意味は近いが別語として温存）のような
  // 未確認の類似語は統合していない。
  { id: "祈福", canonicalName: "祈福", modernName: "きふく", description: "個人的な開運祈願、上棟式など", youjibinranNo: 2, modernLabel: "開運祈願をすること" },
  { id: "祭祀", canonicalName: "祭祀", modernName: "さいし", description: "先祖、神仏へ供え物をして祈願する。お店などの開店日", youjibinranNo: 1, modernLabel: "先祖や神仏へ祈願すること" },
  { id: "解除", canonicalName: "解除", modernName: "かいじょ", description: "厄除け、除霊、祝詞（のりと）をあげる、お守りを求めるなど", youjibinranNo: 9, modernLabel: "厄除け・お祓いをすること" },
  { id: "開光", canonicalName: "開光", modernName: "かいこう", description: "化殺用具を使えるように儀式をしたり、神仏に生を入れるなど。一般的には神社から頂いた御札などを祭るに良い日。", youjibinranNo: 5, modernLabel: "神仏像やお札を祀る儀式をすること" },
  { id: "修造", canonicalName: "修造", modernLabel: "新築、リフォーム工事" },
  { id: "修造動土", canonicalName: "修造動土", modernName: "しゅうぞうどうど", description: "建築関係で土を動かす日、基礎うち、リフォームなど。", youjibinranNo: 32, modernLabel: "新築・リフォーム工事、および土を掘る・土地に手を入れる工事" },
  { id: "建築", canonicalName: "建築", modernLabel: "建物を建てること" },
  { id: "破屋壊垣", canonicalName: "破屋壊垣", modernName: "はやかいかん", description: "家を取り囲む壁を撤去する日", youjibinranNo: 45, modernLabel: "壁や垣根を取り壊すこと" },
  { id: "動土", canonicalName: "動土", modernLabel: "土を掘る・土地に手を入れる工事" },
  { id: "上梁", canonicalName: "上梁", modernLabel: "棟上げ" },
  { id: "堅柱上樑", canonicalName: "堅柱上樑", modernLabel: "柱を立て、棟上げをすること" },
  { id: "蓋屋", canonicalName: "蓋屋", modernLabel: "屋根を葺く（瓦を拭くなど）こと" },
  { id: "修倉庫", canonicalName: "修倉庫", modernName: "しゅうそうこ", description: "倉庫の掃除、虫干しなど。倉庫を改装するのも良い", youjibinranNo: 52, modernLabel: "倉庫の掃除・改装をすること" },
  { id: "修補垣牆", canonicalName: "修補垣牆", modernLabel: "塀や垣根を修理すること" },
  { id: "修飾垣墻", canonicalName: "修飾垣墻", modernName: "しゅうしょくかんしょう", description: "垣根、塀、エクステリア(外構工事)", youjibinranNo: 36, modernLabel: "垣根・塀を修理・整備すること" },
  { id: "築垣", canonicalName: "築垣", modernLabel: "塀や垣根を造ること" },
  { id: "補垣塞穴", canonicalName: "補垣塞穴", modernName: "ほかんさいけつ", description: "穴が空いた壁やでこぼこな道を修復する", youjibinranNo: 63, modernLabel: "壁や道の穴を修復すること" },
  { id: "築堤防", canonicalName: "築堤防", modernName: "ちくていぼう", description: "堤防を作ったり修理する日。灌漑工事など", youjibinranNo: 57, modernLabel: "堤防を作る・修理すること" },
  { id: "開渠穿井", canonicalName: "開渠穿井", modernLabel: "ふたのない水路を作ること" },
  { id: "開井", canonicalName: "開井", modernLabel: "井戸を掘ること" },
  { id: "溝渠", canonicalName: "溝渠", modernLabel: "溝や水路を造ること" },
  { id: "開道", canonicalName: "開道", modernLabel: "道路・通路を開くこと" },
  { id: "平治道塗", canonicalName: "平治道塗", modernName: "へいじどうと", description: "家の前にある道路を舗装する。", youjibinranNo: 46, modernLabel: "道路や通路を整備すること" },
  { id: "作厠", canonicalName: "作厠", modernName: "さくし", description: "トイレを作ったりリフォームする日", youjibinranNo: 59, modernLabel: "トイレを作る・改修すること" },
  { id: "安碓磑", canonicalName: "安碓磑", modernName: "あんついがい", description: "装飾、建具など仕上げ", youjibinranNo: 40, modernLabel: "内装・建具の仕上げをすること" },
  { id: "埋坑", canonicalName: "埋坑", modernLabel: "杭打ちをすること" },
  { id: "啓攢", canonicalName: "啓攢", modernLabel: "改葬のため墓を開き、遺骨を移すこと" },
  { id: "啓墳", canonicalName: "啓墳", modernLabel: "墓を開くこと" },
  { id: "安葬", canonicalName: "安葬", modernName: "あんそう", description: "亡骸を埋める日。火葬などにも用いて良い日", youjibinranNo: 85, modernLabel: "遺体を埋葬すること" },
  { id: "掃舎宇", canonicalName: "掃舎宇", modernName: "そうしゃう", description: "お墓の大掃除、除霊をする日", youjibinranNo: 92, modernLabel: "お墓の掃除・除霊をすること" },
  { id: "破土", canonicalName: "破土", modernName: "はど", description: "埋葬のための穴を掘る日。", youjibinranNo: 84, modernLabel: "埋葬のための穴を掘ること" },
  { id: "製寿衣", canonicalName: "製寿衣", modernLabel: "葬儀のための寿衣を作ること" },
  { id: "入宅", canonicalName: "入宅", modernName: "にゅうたく", description: "引っ越して家に住み始める日", youjibinranNo: 43, modernLabel: "引っ越して新居に住み始めること" },
  { id: "搬入", canonicalName: "搬入", modernLabel: "家財や物品を運び入れること" },
  { id: "移徒", canonicalName: "移徒", modernName: "いと・わたまし", description: "転入居日、引越し", youjibinranNo: 42, modernLabel: "引っ越しをすること" },
  { id: "結婚姻", canonicalName: "結婚姻", modernLabel: "結婚式を挙げること" },
  { id: "嫁娶", canonicalName: "嫁娶", modernName: "かしゅ", description: "嫁入り、嫁取り(嫁をもらって良い日、住み始める、交渉など）", youjibinranNo: 25, modernLabel: "結婚（嫁入り・嫁取り）すること" },
  { id: "納采", canonicalName: "納采", modernLabel: "結納（婚約の取り交わし）をすること" },
  { id: "結婚納采", canonicalName: "結婚納采", modernLabel: "結婚・婚約や結納を行うこと" },
  { id: "裁衣", canonicalName: "裁衣", modernName: "さいい", description: "衣替え（本来は結婚式の服を選ぶ、あるいは作る日）", youjibinranNo: 26, modernLabel: "衣服を仕立てること" },
  { id: "求嗣", canonicalName: "求嗣", modernLabel: "子孫繁栄を祈願すること" },
  { id: "修置産室", canonicalName: "修置産室", modernName: "しゅうちさんしつ", description: "女性の部屋を設置する日。", youjibinranNo: 51, modernLabel: "産室（女性の部屋）を設けること" },
  { id: "安床", canonicalName: "安床", modernName: "あんしょう", description: "ベッドの移動や設置、子作り、婚姻届提出など", youjibinranNo: 28, modernLabel: "寝床・ベッドを整えること" },
  { id: "進人口", canonicalName: "進人口", modernLabel: "養子を迎える、子を授かること" },
  { id: "養育", canonicalName: "養育", modernLabel: "家畜などを養い育てること" },
  { id: "開市", canonicalName: "開市", modernName: "かいし", description: "交易を始める日。開店、オープンセレモニーなど。", youjibinranNo: 64, modernLabel: "開店・商売を始めること" },
  { id: "開倉庫", canonicalName: "開倉庫", modernLabel: "倉庫を開くこと・使用開始すること" },
  { id: "出庫", canonicalName: "出庫", modernLabel: "倉庫から品物を出すこと" },
  { id: "交易", canonicalName: "交易", modernLabel: "売買・取引" },
  { id: "立券交易", canonicalName: "立券交易", modernName: "りっけんこうえき", description: "物の販売を始める日。契約によい。", youjibinranNo: 65, modernLabel: "販売や契約を始めること" },
  { id: "納財", canonicalName: "納財", modernName: "のうざい", description: "お金を納める日。申告や納税など", youjibinranNo: 66, modernLabel: "お金を納める・納税すること" },
  { id: "出財寶", canonicalName: "出財寶", modernLabel: "財物を持ち出すこと" },
  { id: "出貨財", canonicalName: "出貨財", modernLabel: "商品や財物を出すこと" },
  { id: "放債負", canonicalName: "放債負", modernLabel: "借金の返済をすること" },
  { id: "求醫療病", canonicalName: "求醫療病", modernLabel: "医者にかかり病気を治すこと" },
  { id: "鍼灸", canonicalName: "鍼灸", modernLabel: "鍼や灸による治療" },
  { id: "整容", canonicalName: "整容", modernLabel: "身なり・容姿を整えること" },
  { id: "沐浴", canonicalName: "沐浴", modernName: "もくよく", description: "身なりを綺麗にする。今風にはデトックス(アロマトリートメントや韓国マッサージで解毒する日)やお灸、ヒーリングなど", youjibinranNo: 16, modernLabel: "入浴・身なりを整えること" },
  { id: "剃頭", canonicalName: "剃頭", modernName: "ていとう", description: "子供が始めて髪を切る日、出家する日など", youjibinranNo: 17, modernLabel: "髪を剃る・初めて切ること" },
  { id: "整手足甲", canonicalName: "整手足甲", modernName: "せいしゅそくこう", description: "子供が始めて爪を切る日", youjibinranNo: 18, modernLabel: "爪を切ること" },
  { id: "家族会議", canonicalName: "家族会議", modernLabel: "家族で相談・話し合いをすること" },
  { id: "會親友", canonicalName: "會親友", description: "親しい家族や友人と会う、宴会を行うなど", youjibinranNo: 14, modernLabel: "家族や友人と会うこと" },
  { id: "祝賀", canonicalName: "祝賀", modernLabel: "お祝い・祝い事" },
  { id: "親睦", canonicalName: "親睦", modernLabel: "人との親交を深めること" },
  { id: "賓客", canonicalName: "賓客", modernLabel: "客を招くこと" },
  { id: "出行", canonicalName: "出行", modernName: "しゅっこう", description: "出かける、遠出、船に乗る", youjibinranNo: 12, modernLabel: "外出・遠出をすること" },
  { id: "遠行", canonicalName: "遠行", modernLabel: "遠方へ旅行・外出すること" },
  { id: "乗船渡水", canonicalName: "乗船渡水", modernLabel: "船に乗って水上を渡ること" },
  { id: "上官赴任", canonicalName: "上官赴任", modernName: "じょうかんふにん", description: "面接などに赴く日、栄転や昇給し職を祝う日。階級が上昇して祝う日", youjibinranNo: 13, modernLabel: "就任・栄転・昇進を祝うこと" },
  { id: "臨官", canonicalName: "臨官", modernLabel: "官職に就くこと・仕事に着任すること" },
  { id: "臨政親民", canonicalName: "臨政親民", modernLabel: "政務に就き、人々を治めること" },
  { id: "策略", canonicalName: "策略", modernLabel: "計画・策略を立てること" },
  { id: "経絡", canonicalName: "経絡", modernName: "けいらく", description: "機織りの意味で、機械を設置したり、繊維関係の仕事を始めるなど。", youjibinranNo: 69, modernLabel: "機械の設置や繊維関係の仕事を始めること" },
  { id: "鋳造", canonicalName: "鋳造", modernLabel: "金属を鋳造すること（鋳物・窯業など）" },
  { id: "入学求師", canonicalName: "入学求師", modernLabel: "入学すること・師につくこと" },
  { id: "栽種", canonicalName: "栽種", modernName: "さいしゅ", description: "種まきに良い日。ガーデニングなど", youjibinranNo: 74, modernLabel: "種まき・植え付けをすること" },
  { id: "伐木", canonicalName: "伐木", modernName: "ばつぼく", description: "木を切っても良い日、山に入っても良い日でもある。その他木材を家に運び込むなどによい。", youjibinranNo: 47, modernLabel: "木を伐採すること" },
  { id: "牧養", canonicalName: "牧養", modernName: "ぼくよう", description: "牛馬に農具をつける日。放牧など", youjibinranNo: 80, modernLabel: "家畜の放牧・世話をすること" },
  { id: "納畜", canonicalName: "納畜", modernName: "のうちく", description: "家畜を買い付けるに良い日。ペットを家に迎える日など", youjibinranNo: 81, modernLabel: "家畜やペットを迎えること" },
  { id: "造畜柵", canonicalName: "造畜柵", modernLabel: "家畜の囲いや柵を造ること" },
  { id: "捕捉", canonicalName: "捕捉", modernLabel: "捕まえること・捕獲（害虫駆除など）" },
  { id: "畋獵", canonicalName: "畋獵", modernLabel: "狩猟をすること" },
  { id: "取魚", canonicalName: "取魚", modernLabel: "漁業や魚釣りをすること" },
  { id: "冠帶", canonicalName: "冠帶", modernLabel: "成人式（元服）を行うこと" },
  { id: "冠笄", canonicalName: "冠笄", modernLabel: "成人の儀式・冠やかんざしを着ける儀礼" },
  { id: "醞釀", canonicalName: "醞釀", modernLabel: "味噌・醤油などの発酵を仕込むこと" },
  { id: "宴會", canonicalName: "宴會", modernLabel: "宴会・会食" },
  { id: "上表彰", canonicalName: "上表彰", modernLabel: "上申書や表文を提出すること（上司に交渉する）" },
  { id: "儀礼", canonicalName: "儀礼", modernLabel: "儀式・礼式" },
  { id: "出兵", canonicalName: "出兵", modernLabel: "警察・自衛隊・警備員の訓練など（本来は出兵の意）" },
  { id: "出師", canonicalName: "出師", modernLabel: "軍隊を出動させること・出兵" },
  { id: "出征", canonicalName: "出征", modernLabel: "出征（戦争に出ること）" },
  { id: "出軍", canonicalName: "出軍", modernLabel: "軍隊を出動させること" },
  { id: "出陣", canonicalName: "出陣", modernLabel: "現代では営業活動などに例えられる（本来は出陣の意）" },
  { id: "防備", canonicalName: "防備", modernLabel: "防御・備えを整えること" },

  // 2026-09-11追記7（現行95再監査フェーズ）: 正式採用14件。詳細は追記7参照。
  { id: "安香", canonicalName: "安香", modernName: "あんこう", description: "香を焚き、お仏壇、神棚を設置する日(落成式)", youjibinranNo: 7, modernLabel: "お香を焚き、仏壇・神棚を設置すること" },
  { id: "斎醮", canonicalName: "斎醮", modernName: "さいしょう", description: "徳を積む日。浮かばれない霊魂をあの世に送る日 (お仏壇やを変えたり、お仏壇やお墓のお掃除などに良いと思われる)", youjibinranNo: 4, modernLabel: "徳を積み、供養の儀式を行うこと" },
  { id: "起基定硬", canonicalName: "起基定硬", modernLabel: "基礎工事をし、柱・構造材を建てること" },
  { id: "安門", canonicalName: "安門", modernName: "あんもん", description: "門、玄関の設置", youjibinranNo: 38, modernLabel: "門・玄関を設置すること" },
  { id: "安吟", canonicalName: "安吟", modernName: "あんぎん", description: "敷地内の路盤や階段の設置、アプローチなど。", youjibinranNo: 39, modernLabel: "敷地内の路盤・階段・アプローチを設置すること" },
  { id: "作灶", canonicalName: "作灶", modernName: "さくそう", description: "キッチンの工事、引っ越しの場合、コンロを置く", youjibinranNo: 41, modernLabel: "キッチン（かまど）を設置・工事すること" },
  { id: "造倉庫", canonicalName: "造倉庫", modernName: "ぞうそうこ", description: "倉庫を造る日", youjibinranNo: 53, modernLabel: "倉庫を新しく造ること" },
  { id: "苫蓋", canonicalName: "苫蓋", modernName: "せんがい", description: "納屋などを造る日", youjibinranNo: 55, modernLabel: "納屋などを造ること" },
  { id: "放水", canonicalName: "放水", modernName: "ほうすい", description: "池、貯水池に水を入れる、下水道を作る日。", youjibinranNo: 61, modernLabel: "池・貯水池に水を入れる、下水道を作ること" },
  { id: "修宅日", canonicalName: "修宅日", modernLabel: "家を修理・リフォームすること" },
  { id: "合帳", canonicalName: "合帳", modernName: "がっちょう", description: "蚊帳を張る日、新居に住んで良い日", youjibinranNo: 27, modernLabel: "蚊帳を張ること・新居に住み始めること" },
  { id: "合壽木", canonicalName: "合壽木", modernName: "ごうじゅぼく", description: "自分の棺を作る日。あまり使わない方が良い。", youjibinranNo: 89, modernLabel: "生前に自分の棺を作ること" },
  { id: "造船", canonicalName: "造船", modernName: "ぞうせん", description: "船を造り始める日", youjibinranNo: 73, modernLabel: "船を造り始めること" },
  { id: "避宅出火", canonicalName: "避宅出火", modernLabel: "家からの出火を避けること" },
];

export const ACTIVITY_BY_ID: Record<string, ActivityDefinition> = Object.fromEntries(
  ACTIVITY_DEFINITIONS.map((d) => [d.id, d]),
);

export function getActivityDefinition(id: string): ActivityDefinition | undefined {
  return ACTIVITY_BY_ID[id];
}
