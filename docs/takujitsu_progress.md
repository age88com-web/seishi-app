# 擇日アプリ開発進捗

最終更新：2026-09-10（擇日UI 用途データ整理・表示修正・メモ化正式採用。詳細は
`docs/takujitsu_activity_engine.md`「補足（2026-09-10、擇日UI ― 用途データ整理・
表示修正・メモ化正式採用）」。①擇日の目的でない12語（初七・十九・十六・
二至二分・伐日・冬至・大凶・大吉・義日・道土・陰將・陽將）を
`activityDefinitions.ts` から削除（**256→244**）。全12語とも ActivityProfile／
occurrence／resolution から activityId として一切参照されていないことを確認
（判定：全て「A. 内部参照なし＝物理削除」）。神殺「義日」（吉神occurrence＋
profile）は別概念で無変更。ALL型6吉神の `positiveMode:"all_except"` の判定式・
意味は不変で「諸事」の母集団が244になっただけ。カテゴリ件数「その他」48→
**36**（他14カテゴリ不変。12語は全て旧「その他」）。`activityCategories.ts` は
`ACTIVITY_DEFINITIONS` 走査のデータ駆動なので自動追随、UI チップ件数も。
「日付を見る」「良い日を探す」の用途母集団は同一（内部専用定義は残さない）。
②神殺欄の開発者向け説明文「※［解除］［軽減］［増悪］［保留］は resolution
レイヤーの…」を UI から削除（バッジ表示自体は維持、resolution ロジック無変更）。
③kyoushinGroup5 の `solarTermStartingOn()` メモ化を正式採用＝キャッシュキーを
監査（year/month/day/timezone が結果に影響＝キーに含める〈0埋め〉、
longitude/latitude/epochJdn/lunisolarConfig は solarTerm/solarTermDateTime に
影響せず不要、値は新規小オブジェクトで非ミューテーション、判定式不変）。
メモ有効／無効で `resolveKyoushinGroup5()` の出力が400日連続で完全一致。
indicator：SOURCE VALIDATION 85.52%/68.10% 不変、APP EVALUATION **一致率
61.98%・MATCH 3,352・SHOGI_ONLY 2,056 は完全に不変**（LOGIC_ONLY のみ
31,439→30,047＝擇日象意が用事としない12語が ALL型展開から消えたノイズ削減）。
テスト：`activity_definitions_unit` 総件数244・非対応205に更新（760→724）、
`evaluate_activities_unit` 246/246・`takujitsu_full` 22/22・`takujitsu_search` 23/23、
occurrence／resolution／十二建除／二十八宿／CalendarEngine／qimen1080 全て同結果、
tsc 0・変更ファイル lint 0・Next build ✓。既知 lunisolar6件・ganzhi1件は別枠。）

最終更新（1つ前）：2026-09-10（擇日UI 第3フェーズ ― 目的から良い日を検索 完了。詳細は
`docs/takujitsu_activity_engine.md`「補足（2026-09-10、擇日UI 第3フェーズ）」。
**期間検索は独自の吉凶判定を一切持たない**：各日について既存の
`calculate()`→`calculateTakujitsu()`→`evaluateActivities()` を1回ずつ実行し、
指定1用途の `verdict`（good/bad/mixed/neutral）をそのまま使う。神殺の数による
ランキング・独自スコアは作らない。①`full.ts` に `searchTakujitsuDays(params)`
＝期間内の各日の1用途評価を返す（基準時刻 正午12:00 固定〈子初23:00の日柱
境界を跨がない〉、上限 `TAKUJITSU_SEARCH_MAX_DAYS=366`日、開始>終了・期間超過・
不正日付はエラー）②`/takujitsu` に「日付を見る」「良い日を探す」モード切替
（既存の日付モードは第2フェーズまでの全機能を維持）③検索UI：用途を1つ選ぶ
〈第2フェーズのカテゴリ／文字／modernName で絞り込み〉→開始日・終了日→
「良い日を探す」。結果は verdict good または mixed の日を候補として月別
グループ化（各月 吉N/吉凶混在N の件数、「凶も表示」「中立も表示」トグル）、
候補日カードに 西暦日付・曜日・日干支・十二建除・二十八宿・判定、展開で
positiveSources/negativeSources/resolutionStatus/note/suppressions（日付モードと
同じ方法）、mixed 日は「吉凶混在（吉日ではない）」を明示、「この日を見る」で
日付モードへ遷移。④スマホ：検索条件を縦並び・候補日カード1カラム・横スクロール
なし。⑤`calculateTakujitsu(input, calendar?)` に任意の第2引数を追加＝既計算の
CalendarResult を渡せば `calculateCalendar()` を呼ばない（純粋関数なので結果
同一、occurrence/resolution/十二建除/二十八宿 のロジック不変、第2引数省略の
従来呼び出しは完全後方互換）。`calculateTakujitsuFull` / `searchTakujitsuDays`
は暦計算1日1回に。⑥`resolveKyoushinGroup5()` の `solarTermStartingOn()` に
節気サンプル（solarTerm/solarTermDateTime）の module 内 `Map` メモ化を追加
（`calculateCalendar` は純粋関数、**判定・全テスト出力は不変**）。効果：
30日検索 2,414ms→565ms／90日 7,064ms→922ms／366日 50,794ms→7,039ms。
⑦**歸忌 → 忌 移徒** を反映（原典監査で IMPLEMENTABLE 確定済み。神殺象意.pdf
「忌移徙」→ id `移徒`。`activityProfiles.ts` の歸忌のみ変更。occurrence・
resolution は無変更、新規 ActivityDefinition なし）。SOURCE VALIDATION
85.52%/68.10% 不変、APP EVALUATION 61.98% 不変（移徒は34語彙外・歸忌日に
擇日象意 expected 移徒は0）。テスト：`takujitsu_search.manual.ts` 23/23
（30/90/366日検索・二重計算後方互換・歸忌単独→移徒bad・歸忌＋月恩→移徒mixed）、
`takujitsu_full` 22/22、activity/resolution/occurrence/十二建除/二十八宿/
CalendarEngine/qimen1080 全て実装前と同結果。tsc 0、変更ファイル lint 0、
Next build ✓。既知 lunisolar6件・ganzhi1件は別枠。）

最終更新（1つ前）：2026-09-10（擇日UI 第2フェーズ ― 用途カテゴリ分類・実用UI化 完了。
原典ロジック・ActivityProfile・occurrence・resolution・evaluateActivities は
一切変更していない。追加：`src/lib/takujitsu/activity/activityCategories.ts`
（ActivityDefinition 256語を現代の利用目的15カテゴリへ割り当てる **UI／検索用
メタデータ**。婚姻・縁組／妊娠・出産・子供／引越し・移転／建築・工事／土地・
不動産／開業・商売／契約・取引・財／就職・仕事／学業／旅行・外出／医療・健康／
祭祀・祈願／葬祭・墓／農業・畜産／その他。分類済み208語・"その他"48語。
**吉凶判定ロジックには一切使わない**＝`evaluateActivities`／`ActivityProfile`／
occurrence／resolution はこのファイルを import しない）。`/takujitsu` ページを
実用UI化：①「目的から選ぶ」カテゴリフィルタ（15カテゴリ＋すべて、件数表示）
②吉凶フィルタ（すべて・吉・吉凶混在・凶）＋中立トグル ③文字検索（原典語＋
modernName＋description を対象）④カテゴリ＋吉凶＋文字検索の複合フィルタ＋
条件クリア ⑤modernName の「原典語（現代語）」併記・各行にカテゴリタグ
⑥UI並び順を 吉→吉凶混在→凶→中立、同判定内は ActivityDefinition 順
（判定結果そのものの優先順位は不変） ⑦「今日の概要」パネル（日付・十二建除・
二十八宿・吉神数・凶神数・吉/混在/凶/中立の件数。既存結果の集計のみ）
⑧スマホ対応（`<style>` の `@media (max-width:640px)` で神殺2カラム→1カラム、
用途行の折り返し・タップ領域拡大、フィルタ折り返し、詳細展開が画面幅から
はみ出さない。PCレイアウトは維持）。あわせて第1フェーズの
`/takujitsu` で出ていた React Console Error（`border` shorthand と `borderColor`
の混在、フィルタボタン）を修正：全フィルタUIを CSS クラス化し、インライン
`style` の `background` shorthand も `backgroundColor` へ統一（`border`+`borderColor`、
`background`+`backgroundColor` の同一要素混在なしを確認）。歸忌→移徒 の
ActivityProfile 変更は今回も行わず次フェーズへ。テスト：`takujitsu_full.manual.ts`
22/22、activity/resolution/occurrence/十二建除/二十八宿/CalendarEngine/qimen1080
すべて実装前と同結果。tsc 0、変更ファイル lint 0（`react-hooks/exhaustive-deps`
の warning も解消）、Next build ✓。既知 lunisolar6件・ganzhi1件は別枠。詳細は
`docs/takujitsu_activity_engine.md`「補足（2026-09-10、擇日UI 第2フェーズ）」。）

最終更新（1つ前）：2026-09-10（擇日アプリ UI統合 第1フェーズ完了。原典ロジック・
ActivityProfile・occurrence・resolution は一切変更していない。追加：
`src/lib/takujitsu/full.ts`（統合 wrapper `calculateTakujitsuFull()`＝
`calculate()`〈暦〉→`calculateTakujitsu()`〈神殺・十二建除・二十八宿・
resolution〉→`evaluateActivities()`〈用途判定〉を順に呼ぶだけの薄い層。
戻り値 `TakujitsuFullResult` に calendar/shinsatsu/buildingDay/shuku28/
resolution/activities を束ねる。CalendarEngine には擇日判定を混ぜない）／
`src/app/takujitsu/page.tsx`・`layout.tsx`（`/takujitsu` の擇日ページ、
"use client"、PC表示優先。日付・時刻・タイムゾーン入力→暦情報上部表示
〈西暦・干支年月日時・節気・農暦・十二建除・二十八宿〉→神殺〈吉神・凶神を
分け、resolution 状態〈解除／軽減／増悪／保留〉をバッジ表示、cancelled は
取り消し線〉→用途判定一覧〈verdict を吉／凶／吉凶混在／中立 で表示、
フィルタ すべて・吉・凶・吉凶混在 ＋ 中立トグル、クリック展開で
positiveSources／negativeSources を sourceType ラベル〈吉神・凶神・十二建除・
二十八宿〉付きで表示、source.note〈六黄道COMPOSITE の「吉神『三合』の宜に
従う」等〉も表示、suppressions〈「月破により徳神失力」＝reason〉を展開欄に
表示、unresolvedRestrictions も別欄表示〉）。`src/lib/takujitsu/index.ts` に
`calculateTakujitsuFull`／`TakujitsuFullResult` の re-export を追加（純粋な
追加 export、ロジック変更なし）。`src/components/AppSwitcher.tsx` に
`{ href:"/takujitsu", label:"擇日" }` を1行追加。テスト：
`tests/takujitsu_full.manual.ts`（wrapper 疎通 22アサーション全PASS）。
回帰：evaluateActivities 246・activity定義 760・resolution 39+47+10・
吉神occ・凶神occ・jianchu 168・shuku 70+26+32・CalendarEngine 14/0・
qimen1080 1080/1080 全て実装前と同結果。tsc 0、新規ファイルの lint 0、
Next build ✓（`/takujitsu` ルート生成確認）。既知 lunisolar6件・ganzhi1件は
従来どおり別枠。空 ActivityProfile 監査の実装〈歸忌→移徒〉は本フェーズでは
行わず次フェーズへ。）

最終更新（1つ前）：2026-09-10（空 ActivityProfile 原典監査フェーズ完了。コード変更
なし＝`src`以下は無変更、原典監査のみ。詳細は
`docs/takujitsu_empty_activity_profiles_audit.md`。現在の空 ActivityProfile
（favorable/unfavorable とも空で ALL/EXCEPT でもない）を実コードから再抽出＝
**23件**（shuku28 2：牛・鬼／kichijin 9：義日・専日・要安・五富・天馬・大明・
七聖・天貴・催官／kyojin 12：兵禁・大煞・八風・九焦・歸忌・埋兒凶宿・大空亡・
小空亡・四方耗・長星・短星・揚公忌）。神殺象意.pdf 転記データ
（`shinsatsu_shogi_source.py`）・擇日テキスト.pdf・12建除.pdf を突合し4分類：
**IMPLEMENTABLE 1件（歸忌）**／SOURCE_ONLY_EMPTY 19件／AMBIGUOUS_LAYOUT 1件
（四方耗）／DEFERRED 2件（兵禁・大煞）。歸忌は神殺象意.pdf に「忌移徙」と
明記があり（`shinsatsu_shogi_source.py` に転記済み、p.4 原本で「移徙」の字も
目視確認）、空になっていた原因は「原典に記載なし」ではなく
「移徙→ActivityDefinition id のマッピングが SAFE_ADD フェーズで『未確認』
として除外された」こと（辞書 id は `移徒` のみ。往亡 profile も同じ理由で
移徙1語を落としている）。移徙＝移徒 の対応は成日 C案フェーズで既に確立済み
なので、歸忌 `unfavorableActivityIds:["移徒"]` として次フェーズで実装可能。
§9 が再確認を求めた劫殺・災殺・月殺は**空 profile ではなく既に EXCEPT型で
原本画像確定済み**（`takujitsu_except_resolution_final.md` 1.1章）＝分類
IMPLEMENTED（§9 の「象意帰属不明」は解消前の古い状態）。新規
ActivityDefinition は不要（歸忌の移徒は既存 id）。空を埋める候補は凶神の忌
1件のみのため SOURCE VALIDATION（85.52%/68.10%）は構造的に不変、APP
EVALUATION（61.98%）も移徒が34語彙外・歸忌日に擇日象意 expected 移徒が0行
のため一致率不変の見込み。SOURCE_ONLY_EMPTY 19件は原典に用途記述が無い＝
欠落ではないので空のまま維持（推測で埋めない）。四方耗は神殺象意.pdf p.44 の
50/51番の列境界を高精度スキャン＋座標抽出で確定してから。兵禁・大煞は
「兵禁・大煞」併記で分離不可＋著者が実務上の忌を否定しているため実装
しないのが妥当。回帰・ビルドは対象外（コード無変更）。）

最終更新（1つ前）：2026-09-10（十二建除・成日 C案 本番実装フェーズ完了。詳細は
`docs/takujitsu_jianchu_cheng_conflict_analysis.md` 14章・
`docs/takujitsu_activity_engine.md`「補足（2026-09-10、十二建除「成」C案）」。
`activityProfiles.ts` の成プロファイルのみ変更：`favorableActivityIds` を
`["婚姻","結婚","結納"]`（12建除.pdf ⑨成日由来）→
`["婚姻","結婚","結納","入学","移徒","築堤防","開市"]`（神殺象意.pdf 成日
「宜入學、移徙、築堤防、開市。」由来の4語を追加。置換ではなく union。移徙は
既存 id `移徒`）。**ALL型にしない**（12建除.pdf「全てに吉」は要約。`positiveMode`
無し、7語のLIST型）。執・危・収の「12建除.pdf由来＋神殺象意.pdf由来を1配列に
併記」の前例と統一。`jianchu.ts`（JIANCHU_MEANINGS・occurrence）・
`evaluateActivities`・天喜/天醫・滿 は無変更。特別クロス条件なし（成日に
「與〇〇併」条件は原文に無い）。月破の徳神抑制（第1.5パス、kichijin対象）・
六黄道COMPOSITE（第2パス、kichijin positive追従）とも成は sourceType="jianchu"
なので対象外＝追加ルール不要。評価engine単体テスト 217→246アサーション全PASS。
720実測：成成立60日（各 monthBranch 5日）、7語とも60日で positive 生成
（good/mixed 内訳あり）。SOURCE VALIDATION は 85.52%/68.10% で不変。
**APP EVALUATION は 60.39%→61.98%（+1.59pp、MATCH 3266→3352、SHOGI_ONLY
2142→2056）**。これは入学・築堤防・開市が擇日象意.pdf の34固有語彙に含まれ、
成日60日で 57／45／52 日で宜とされていた＝神殺象意.pdf の成日リストを
擇日象意.pdf（憲書／協紀系）が独立に裏づけていた分で、一致率のための
リスト調整ではなく原典 union の副産物（執・危・収 季節宜が +0.53pt 動いたのと
同じ性質）。俱不取115行（0/0/115/0）不変。回帰（activity/resolution/吉神occ/
凶神occ/十二建除/二十八宿/収クロス/月破徳神失力/六黄道COMPOSITE/
CalendarEngine/qimen1080/tsc/lint/Next build）は実装前と同結果、既知
lunisolar6件・occurrence孤立差異は従来どおり別枠。あわせて補助診断3スクリプト
（gen_cheng_conflict / gen_shu_xiu_cangku / gen_geppo_deity_suppression）の
zeyi参照バグ（`zeyi[row.monthLabel]`＝常にundefined）を
`zeyi[\`${monthLabel}|${ganzhi}\`]`へ修正。正規の
gen_720_metric_reconciliation.ts は元々正しいキーで各フェーズの APP
EVALUATION 数値・結論は正しかった。十二建除の完成数 10直→11直（滿のみ
未着手）。）

最終更新（1つ前）：2026-09-10（十二建除・成日 CONFLICT 原典確定フェーズ完了。コード
変更なし＝`src`以下は無変更、原典解析のみ。診断スクリプト
`tests/fixtures/gen_cheng_conflict.ts` のみ追加。詳細は
`docs/takujitsu_jianchu_cheng_conflict_analysis.md`。神殺象意.pdf 成日を
原本ページ「一一／一二」6倍ズームで1文字ずつ確認：「〔成日〕〔天喜〕〔天醫〕
宜入學、移徙、築堤防、開市。」で確定（「開市」直後は句点。婚姻系語なし、
忌なし、季節・併臨条件なし、ALL型を示す「諸事皆宜」等の語なし＝通常LIST型）。
現行 ActivityProfile の「婚姻・結婚・結納」の出典は 12建除.pdf p.7 ⑨成日
「全てに吉。特に婚姻・結婚・結納に良い」（jianchu.ts JIANCHU_MEANINGS 経由。
従来「擇日テキスト.pdf由来」としていたのは不正確で本フェーズ訂正。擇日
テキスト.pdf には十二直の宜忌専用セクションが無く、成日は「天醫・天喜＝
医療」と間接参照するのみ）。入学・移徙(id "移徒")・築堤防・開市 の4語とも
既存 ActivityDefinition に存在（新規追加不要）。婚姻/結婚/結納/嫁娶/納采は
すべて別 id のまま（統合の原典根拠なし）。720行：成成立60日（各 monthBranch
5日ずつ）、成日60日すべてに三合・天醫・天喜が同時成立。擇日象意.pdf は成日の
60日に 入学/移徒/築堤防/開市/婚姻/結婚/結納/嫁娶/納采 のいずれも宜として
記録しておらず、A/B/C いずれの案でも APP EVALUATION 一致率は不変
（60.39%、SOURCE VALIDATION も 85.52%/68.10% 不変）。両資料は「同じ用事が
無い」が直接の矛盾は無く粒度・観点の差。**推奨：C案＝7語併記
（["婚姻","結婚","結納","入学","移徒","築堤防","開市"]、LIST型、
sourceType:"jianchu"）**。執・危・収の「12建除.pdf由来＋神殺象意.pdf由来を
1配列に併記」の前例と統一され、どちらの一次資料の確定記述も削除しない。
月破・六黄道COMPOSITE・クロス条件との追加ルールは不要（成は通常の
jianchu positive source）。満日は別保留のまま無変更。実装（activityProfiles.ts
の成のみ）はユーザーの案選択待ち。）

最終更新（1つ前）：2026-09-10（十二建除・收日 × 月恩／四相／時徳 → 修倉庫 クロス条件
本番実装フェーズ完了。詳細は`docs/takujitsu_jianchu_seasonal_rules.md`末尾
補足・`docs/takujitsu_activity_engine.md`「補足（2026-09-10、十二建除「収」×
月恩／四相／時徳 → 修倉庫）」。神殺象意.pdf 収日「與『月恩』『四相』『時德』
併，宜修倉庫」を6倍ズームで再確認（「時德」直後は「併」、皆／俱／同時等の
AND語なし）。条件は `収 AND (月恩 OR 四相 OR 時徳)`（OR。既存の月建（小時）
resolution No.4 が同一構文を anyOf で扱うのと一致）。実装：`evaluateActivities()`
の十二建除ブロック直後で、`buildingDay.name==="収"` かつ resolution.kichijin に
月恩・四相・時徳のいずれかがあれば `{activityId:"修倉庫", favorable:true,
source:{sourceType:"jianchu", sourceName:"収", note:"…と併して宜"}}` を1件だけ
積む。「修倉庫」は収の通常favorableにも月恩・四相・時徳の各profileにも入れ
ない（クロス条件のみ）。sourceType="jianchu"のため六黄道COMPOSITE（kichijin
positiveのみ追従）は追従せず、月破の徳神抑制（kichijin対象）も対象外。月破が
同日に修倉庫を忌にすればmixed。occurrence（十二建除・吉神）・収の常時宜／
季節宜・ActivityProfileデータは無変更（収のnotes文言のみ更新）。評価engine
単体テスト 189→217（収クロスA〜M追加、全PASS）。720行実測：収60日、収＋
(月恩/四相/時徳)16日（月恩0・四相12・時徳5）、修倉庫クロスpositive 16日
（good4/mixed12）。擇日象意.pdfの「修倉庫」宜日とは1件も重ならないため、
SOURCE VALIDATIONは85.52%/68.10%で不変、APP EVALUATIONも60.39%/MATCH3266で
不変（LOGIC_ONLY 31436→31438）。回帰（activity/resolution/吉神occ/凶神occ/
十二建除/二十八宿/月破徳神失力/六黄道COMPOSITE/CalendarEngine/qimen1080/
tsc/lint/Next build）は実装前と同結果、既知lunisolar6件・occurrence孤立差異は
従来どおり別枠。）

最終更新（1つ前）：2026-09-10（月破・徳神positive抑制 本番実装フェーズ完了。詳細は
`docs/takujitsu_geppo_deity_suppression_analysis.md` 15章・
`docs/takujitsu_activity_engine.md`「補足（2026-09-10、月破・徳神positive
抑制）」。前フェーズの原典確定を受けて実装：`ActivitySuppression` 型を
新規追加し `ActivityEvaluationResult.suppressions` を追加（`ActivitySource`
は無変更）、`evaluateActivities()` に第1.5パス（月破positive抑制）を第1パスと
pass1スナップショットの間に挿入。月破がactive（status!=="cancelled"）な日は
`favorable && sourceType==="kichijin" && sourceName∈GEPPO_DEITY_SET
（天徳・天徳合・月徳・月徳合・天赦・天願）` の contribution を除外。
`DEHE_GROUP` は流用しない（歳徳・歳徳合は月破の德神に含めない）。六黄道
COMPOSITE（第2パス）は抑制済みpass1を走査するため抑制された徳神positiveを
復活させない（テストJ）。月破のnegativeMode・例外11語・resolution・
月破occurrence・徳神profile・raw occurrenceは無変更（二層構造：天徳等は
月破日でもShinsatsuResult.kichijinに残る）。評価engine単体テスト 114→189
アサーション全PASS。実測：月破60日／月破＋対象6神20日、抑制positive延べ
6,104、mixed→bad 4,473、good→neutral 62。SOURCE VALIDATIONは
85.52%/68.10%で不変（ステージAはevaluateActivitiesを通さない）、APP
EVALUATIONは60.47%→60.39%（−0.08pp、MATCH 3,270→3,266。月破日の徳神
positive抑制分。約4件は擇日象意.pdfと神殺象意.pdfの一次資料間の食い違い、
一致率のためのルール調整はしない）。回帰（activity/resolution/吉神occ/
凶神occ/十二建除/二十八宿/CalendarEngine/qimen1080/tsc/Next build）は
実装前と同結果、既知lunisolar6件・occurrence孤立差異は従来どおり別枠。）

最終更新（1つ前）：2026-09-10（月破・徳神失力 原典確定フェーズ完了。コード変更
なし＝`src`以下は無変更、原典解析と設計のみ。診断スクリプト
`tests/fixtures/gen_geppo_deity_suppression.ts` のみ追加。詳細は
`docs/takujitsu_geppo_deity_suppression_analysis.md`。神殺象意.pdf月破段落
（原本ページ一三／一四）を6倍ズームで再確認し「德神臨此失力、不能爲福、
故即與德合併、猶忌」を確定。全7ページ通読で「德神」の語は月破1箇所のみ
＝神殺象意.pdf単独では内訳未定義。擇日テキスト.pdf p.18の月破ローカル
定義に依拠し「德神」＝天徳・天徳合・月徳・月徳合・天赦・天願の6神（＝
ActivityProfileがall_exceptの6神。DEHE_GROUPとはB＝一部一致：歳徳・
歳徳合は月破の德神に含めない、天赦・天願は含める）。「失力／不能爲福」
＝positive完全抑制（reducedではない、EXCEPT型11凶神で月破だけが持つ
特別表現）。720行影響試算：月破成立60日／月破＋ALL型徳神20日、抑制すると
mixed→bad 2,660件・good→neutral 41件、擇日象意.pdf一致率には影響なし
（月破日はexpected宜0）。実装モデル：evaluateActivities()の第1パスとpass1
スナップショットの間に第1.5パス（月破positive抑制）を挟むだけ。六黄道
COMPOSITE（第2パス）は抑制済みpass1を見るため復活させない。negative側・
resolution・月破occurrenceは無変更。次フェーズで実装可。）

最終更新（1つ前）：2026-09-10（六黄道COMPOSITE 本番実装フェーズ完了。詳細は
`docs/takujitsu_liuhuangdao_composite_analysis.md`14章・
`docs/takujitsu_activity_engine.md`「補足（2026-09-10）」。ユーザー確定
仕様：COMPOSITE化は原文列挙の5神（青龍・明堂・寶光・玉堂・司命）のみ、
金匱はLIST型のまま、6神とも家族会議・遠行のLIST型データは削除せず保持
（COMPOSITEは置換ではなく追加機能）。`ActivityProfile`に
`composite?: boolean`を追加し5神に付与。`evaluateActivities()`を2パス化し、
第2パスで「吉神由来positive」「凶神由来negative（resolution適用後）」
だけを六黄道神自身のsourceとして追従（十二建除・二十八宿・他のCOMPOSITE
は参照しない、cancelled忌は復活させない、再帰なし、二重加点なし、
吉凶同時はmixed）。occurrenceは6神とも無変更。evaluateActivities単体
テストにD・E・F・L＋G〜Nを追加し114アサーション全PASS。SOURCE VALIDATIONは
85.52%/68.10%で不変、APP EVALUATIONも60.47%/MATCH3270で不変（第2パスは
既にその極性を持つ用事にsourceを足すだけでverdictを動かさないため）。
ALL型6吉神・EXCEPT型11凶神・小耗No.22・resolution・十二建除・二十八宿は
無変更。回帰（activity/resolution/吉神occ/凶神occ/十二建除/二十八宿/
CalendarEngine/qimen1080/tsc/Next build）全て実装前と同結果、既知の
lunisolar6件差異・occurrence孤立差異は従来どおり別枠。）

最終更新（1つ前）：2026-09-09（六黄道COMPOSITE型 原典確定フェーズ完了。コード
変更なし、原典解析と設計のみ。詳細は
`docs/takujitsu_liuhuangdao_composite_analysis.md`。神殺象意.pdf原本
画像確認により、六黄道は青龍・明堂・寶光・玉堂・司命の5神のみ（金匱は
対象外）で、「與吉神併，則從所宜，與凶神併，則從所忌」＝単独では固定
宜忌を持たず同日成立の他吉神/凶神に従うCOMPOSITE構造であることを確定。
現行LIST型データ（家族会議・遠行）は金匱ではSUPPORTED（擇日テキスト.pdf
p.15由来）、5神ではCONFLICT（COMPOSITE構造と矛盾）。COMPOSITE型の
データモデル・2パス評価アルゴリズムを設計したが、金匱の扱いと5神の
既存データ削除可否はユーザー判断事項のため本番実装は見送った。
SOURCE VALIDATIONは85.52%/68.10%で不変（コード変更なしのため当然）。

最終更新（1つ前）：2026-09-09（小耗 解除条件確定・実装フェーズ完了。詳細は
`docs/takujitsu_xiaohao_fuyi_wuli_verification.md`13章。神殺象意.pdf
原本画像再確認により、小耗の解除条件「與『德合』『天願』併，則貪合
忘沖，故不忌」（忌全体をcancel、天赦を含まない天願単独が条件）が確定
し、resolution新規ルールNo.22として実装（既存DEHE_GROUP・No.17/18と
同じ天願単独の判断基準を再利用、新しい別定義は作っていない）。
occurrence・ActivityProfileは変更なし。resolution実装済み16→（No.22
追加後の総数）、UNRESOLVED7件は変化なし。SOURCE VALIDATIONは
85.52%/68.10%で不変、APP EVALUATIONは60.15%→60.47%（参考値、一致率
向上目的の調整はしていない）。

最終更新（1つ前）：2026-09-09（十二建除 執・危・収 季節条件完成フェーズ完了。
詳細は`docs/takujitsu_jianchu_seasonal_rules.md`。神殺象意.pdf原本
画像確認により、執・危・収の季節限定宜（二十四節気ベース、霜降後
立春前→畋獵、雨水後立夏前→取魚、危のみ立冬後立春前→伐木も）が確定。
`ActivityProfile.seasonalRules`型を新規追加し、`EvaluateActivitiesInput`
に任意項目`solarTerm`を追加（CalendarEngineは無変更、既存呼び出しとの
後方互換を維持）。季節判定はmonthBranch・lunarMonthではなくsolarTerm
を使用（原文が節気名そのもので期間を指定しているため）。十二建除の
完成数：7直→10直（滿・成は今回も未着手）。SOURCE VALIDATIONは
85.52%/68.10%で不変（ステージAは十二建除を参照しないため）、APP
EVALUATIONは59.62%→60.15%（参考値、一致率向上を目的にルール調整は
していない）。小耗・六黄道COMPOSITE型は今回変更なし。

最終更新（1つ前）：2026-09-09（小耗・復日・五離occurrence完成フェーズ完了。
詳細は`docs/takujitsu_xiaohao_fuyi_wuli_verification.md`。神殺象意.pdf
原本画像確認により小耗の成立条件（＝十二直「執」と等価）が確定し
occurrence実装（`kyoushinGroup6.ts`にjianchu.ts呼び出しを追加、
jianchu.ts自体は無変更）＋ActivityProfile接続、720行検証TP=58/FN=0/
FP=2（96.7%）。復日・五離は原典に成立条件の記述が無く未実装のまま
DEFERRED（推測実装なし）。occurrence総数134→135件（吉神69・凶神66）。
SOURCE VALIDATIONは85.52%/68.10%で不変、APP EVALUATIONは59.93%→
59.62%（小耗の忌が正しく反映されたことによる自然な変化、原典式は
変更していない）。前回report本文の「resolution UNRESOLVED=8」は
表の実件数（7）との不一致があり単純な集計ミスと判明、7に修正した。

最終更新（1つ前）：2026-09-09（擇日エンジン完成度・残課題棚卸しフェーズ完了。
コード変更なし、棚卸しのみ。詳細は`docs/takujitsu_completion_audit.md`。
サマリ：occurrence134件（吉神69・凶神65）はActivityProfileと1対1で
過不足なし。resolution17ルール中15 IMPLEMENTED・2
IMPLEMENTABLE_BUT_NOT_IMPLEMENTED（要resolve()入力拡張）・1
BLOCKED_BY_OCCURRENCE・7 UNRESOLVED（神殺象意.pdf追加後も未解決）。
十二建除は7直完成・執/危/收は季節条件反映で実装可能（CalendarEngine
変更不要）・滿は原典データなしで完成扱い・成のみユーザー判断が必要な
CONFLICT。二十八宿28宿とも完成。ActivityDefinition256語中217語が原語
のみ表示（方針どおりブロッカーにしない）。evaluateActivities()は
LIST/ALL/EXCEPT/resolution全status/十二建除/二十八宿すべて統合済み。
月破は「徳神自身のpositive効果を無効化する」という原文記述が未実装
のまま残っている（月破固有規則、新しいクロス参照メカニズムが必要）。
COMPOSITE型6吉神（青龍等）は原文の意味自体が未確定で未実装。致命的な
Aブロッカーは無く、C/D（保留可能・将来拡張）に多くが分類される。
UIには暦情報とevaluateActivities結果を統合する薄いラッパーが必要。

最終更新（1つ前）：2026-09-09（720検証低下・俱不取構造 原因特定フェーズ完了。
85.52%→56.3%の低下は同一定義の指標ではなかったことが判明
（`docs/takujitsu_720_metric_reconciliation.md`参照）。コード変更なし、
原因分析のみ。以下は直前の本番反映フェーズの記録）

最終更新（1つ前）：2026-09-09（詳細神殺象意・確定ルール 本番反映フェーズ完了。
`docs/source/神殺象意.pdf`原本画像確認で確定した内容のみを反映：
ActivityDefinition辞書242→256件、ActivityProfileにALL型（6吉神）・
EXCEPT型（11凶神）・reduced部分反映（小時）を追加、resolution/rules.ts
のNo.3・No.13b・No.4aを修正。720行再検証（本番コード実行）は
`docs/takujitsu_except_resolution_final.md`「本番反映結果」セクション
を参照。独自の総合吉凶ルール・優先順位・点数化は今回も作っていない。
用途カテゴリ分類・UI接続は未着手）

---

# 1. 共通CalendarEngine

## 暦エンジン

- [x] ユリウス日（JD）
- [x] ΔT
- [x] 太陽黄経
- [x] 二十四節気
- [x] 年干支
- [x] 月干支（節入り）
- [x] 日干支
- [x] 時干支

---

## 二十八宿

- [x] 宿値日
- [x] 七曜属性
- [x] 小周（84日）
- [x] 大周（420日）
- [x] 七元（420日を60日ずつ7分割）
- [x] 基準日（アンカー）確定（2025-12-21＝虚。現代通書実データで検証済み。
      src/lib/calendar/shukuYoAnchor.ts に分離）

---

## 農暦（太陰太陽暦）

- [x] 朔探索
- [x] 中気判定
- [x] 閏月判定
- [x] 農暦月
- [x] 農暦日
- [ ] 農暦年（未実装）

---

# 2. 擇日

## 十二建除

- [x] 判定ロジック
- [x] 象意
- [x] API化

---

## 二十八宿

- [x] 象意
- [x] API化

---

## 吉神

### 第1グループ

- [x] 完了

### 第2グループ

- [x] 完了

### 第3グループ

- [x] 完了

### 第4グループ

- [x] 完了

### 第5グループ

- [x] 完了

### 第6グループ

- [x] 完了

---

## 凶神

### 第1グループ

- [x] 完了（小時＝月建・死神・死気＝定日・血支＝閉日）

### 第2グループ

- [x] 完了（月破・劫殺・災殺・月殺・月刑）

### 第3グループ

- [x] 完了（月害・大煞・土符・歸忌・往亡・天賊・九焦・大時・天吏・遊禍・九空・兵禁）

### 第4グループ

- [x] 完了（地嚢・四撃・四耗・四廢・四忌・四窮・五虚・五墓・八風・觸水龍・八専・無禄）

### 第5グループ

- [x] 完了（四離・四絶・八節日・土王用事・氣往亡。二十四節気の節入り日時基準）

### 第6グループ

- [x] 完了（凶神1〜53番の全件棚卸しで回収した残り項目。月厭・厭對・上朔・
      月忌日・長星・短星・揚公忌・横天朱雀・四不詳・上兀・下兀・
      瘟入・瘟出・冰消瓦解・冰消瓦碎・受死日・伏斷日・埋兒凶宿・周堂殺・
      天空・地空・大空亡・小空亡・天乙絶気・四方耗・刀砧日・龍禁）

（必要に応じて追加）

---

## 凶神実装台帳（1〜53番、全件棚卸し）

凶神第6グループの実施要件により、擇日テキスト「日家凶神」1〜53番の
状態を以下に整理する。「実装Group」列が空欄の行は未実装（保留）。

| 番号 | 名称 | 状態 | 実装Group | 判定キー | 保留理由 |
|---|---|---|---|---|---|
| 1 | 月建（小時・土府） | 実装済み | 1 | jianchu=建 | |
| 2 | 月破（大耗） | 実装済み※ | 2 | monthBranchの沖 | ※本文の例外（子午月→災殺等）は保留。凶神第1グループのコメント参照 |
| 3 | 死神（平日） | 実装済み | 1 | jianchu=平 | |
| 4 | 定日（死気・官符） | 実装済み | 1 | jianchu=定 | 実例PDFの表記は「死気」を採用 |
| 5 | 満日（天狗） | 保留 | | | 本文「戊の日の満日のみ」が実例PDFと食い違う（凶神第1グループで調査済み・仕様差異） |
| 6 | 閉日（血支・血忌） | 実装済み※ | 1 | jianchu=閉 | ※「血忌」は実例PDFと一致率が低く対象外（仕様差異） |
| 7 | 劫殺・歳殺（天獄天火）・月殺（月虚） | 実装済み | 2 | 三合トリオ | |
| 8 | 月厭・厭對（招搖） | 実装済み | 6 | monthBranch固定表 | 解除条件記録あり（徳合・赦願） |
| 9 | 月刑 | 実装済み | 2 | monthBranch固定表 | |
| 10 | 月害 | 実装済み | 3 | monthBranch固定表 | |
| 11 | 大時（大敗咸池）・天吏（致死） | 実装済み | 3 | monthBranch固定表 | |
| 12 | 遊禍 | 実装済み | 3 | monthBranch固定表 | |
| 13 | 天賊 | 実装済み | 3 | monthBranch固定表 | |
| 14 | 兵禁・大煞 | 実装済み | 3 | monthBranch固定表 | 表見出しは「兵禁・大煞」（p.24）で1項目扱いだが、kyoushinGroup3.tsでは兵禁・大煞を別々のoccurrence名として実装済み（2026-09-09、用途判定engine 第1フェーズで発見・訂正。以前の記載「大煞という独立実装項目は無い」は誤りだった） |
| 15 | 土符・地嚢 | 実装済み | 3（土符）／4（地嚢） | monthBranch固定表／dayGanzhi固定表 | |
| 16 | 歸忌 | 実装済み | 3 | monthBranch（孟仲季）固定表 | |
| 17 | 往亡 | 実装済み | 3 | monthBranch固定表 | 氣往亡（18番内）とは別概念 |
| 18 | 四撃・四耗・四廢・四忌・四窮・五虚 | 実装済み | 4 | 季節＋dayGanzhi/地支固定表 | 解除条件記録あり（徳合・六合、土旺） |
| 18内 | 氣往亡 | 実装済み | 5 | 節気（節）＋日数オフセット | 往亡（17番）とは別概念 |
| 19 | 五墓 | 実装済み | 4 | monthBranch固定表 | |
| 20 | 八風・觸水龍 | 実装済み | 4 | 季節固定表／dayGanzhi固定列挙 | |
| 21 | 八専 | 実装済み | 4 | dayGanzhi固定列挙 | |
| 22 | 九空 | 実装済み | 3 | monthBranch固定表 | |
| 23 | 九扻（九焦） | 実装済み | 3 | monthBranch固定表 | |
| 24 | 無禄 | 実装済み | 4 | dayStem固定表 | |
| 25 | 上朔 | 実装済み | 6 | yearStem固定表 | |
| 26 | 四離・四絶 | 実装済み | 5 | 節気（中／節）前日 | 解除条件記録あり（徳合・天願） |
| 27 | 月忌日 | 実装済み | 6 | lunarDay固定列挙 | |
| 28 | 反支日 | 保留 | | | 本文が「根拠がないので気にする必要はない」と明記 |
| 29 | 長星・短星 | 実装済み | 6 | lunarMonth固定表＋lunarDay | |
| 30 | 八節日 | 実装済み | 5 | 節気（中／節）当日 | 解除条件記録あり（徳合・赦願） |
| 31 | 土王用事（土用） | 実装済み | 5 | 節気（節）18日前 | 解除条件記録あり（徳合・赦願）。18番の「土旺」との関係は調査したが確定できず結び付けていない |
| 32 | 伏社 | 保留 | | | 忌の記載・成立条件（何を凶とするか）が本文に無い |
| 33 | 朔・弦・望・十五日 | 保留 | | | 上弦・下弦・望に月相角度が必要でCalendarEngine未提供。5概念を1つに統合してよいかも本文からは断定できない |
| 34 | 百忌日（彭祖忌） | 保留 | | | 本文が「信用できず気にする必要はない」と明記 |
| 35 | 揚公忌 | 実装済み | 6 | lunarMonth固定表＋lunarDay | |
| 36 | 横天朱雀 | 実装済み | 6 | lunarDay固定列挙 | |
| 37 | 探病忌日 | 保留 | | | 本文が「非常に迷信的要素が強いため気にしなくて良い」と明記 |
| 38 | 四不詳 | 実装済み | 6 | lunarDay固定列挙 | |
| 39 | 上兀（留紳）・下兀（赤口） | 実装済み※ | 6 | yearBranch陰陽＋lunarMonthペア＋lunarDay | ※同じ表内の大安・空亡・小吉・㏿喜（福喜）は項目39自身の名称ではないため対象外（記録のみ） |
| 40 | 土忌・赤松子・天休廢・天地凶敗 | 保留 | | | 本文が「信用できず気にする必要はない」と明記 |
| 41 | 瘟星入出日（瘟入・瘟出） | 実装済み | 6 | lunarMonth固定表＋lunarDay | |
| 42 | 冰消瓦解・冰消瓦碎 | 実装済み | 6 | yearBranch六冲グループ＋lunarMonth＋lunarDay／lunarMonth＋lunarDay | |
| 43 | 受死日 | 実装済み | 6 | monthBranch固定表 | |
| 44 | 真滅没・密日 | 保留 | | | 望・弦の判定に月相角度が必要（33番と同じ理由） |
| 44 | 裁衣吉凶宿 | 保留 | | | 「裁衣」という単一活動限定の参照表で、汎用的な凶神一覧とは性質が異なるため対象外 |
| 44 | 伏斷日 | 実装済み | 6 | dayBranch＋lodge28（二十八宿） | |
| 44 | 埋兒凶宿 | 実装済み | 6 | lodge28固定列挙 | |
| 45 | 周堂殺 | 実装済み | 6 | lunarDay固定列挙 | |
| 45 | 諸家周堂 | 保留 | | | 本文が「信用できず気にする必要はない」と明記 |
| 46 | 食神殺（食主） | 保留 | | | 本文が「諸家周堂殺などと似た理論で信憑性がない」と明記 |
| 47 | 天空・地空 | 実装済み | 6 | yearBranch8グループ＋lunarMonth＋lunarDay | |
| 48 | 大空亡・小空亡 | 実装済み | 6 | lunarMonth固定表＋lunarDay | |
| 49 | 天乙絶気 | 実装済み | 6 | lunarMonth固定表＋lunarDay | 凶神第5グループでmonthBranch型と誤記していたが本グループで訂正 |
| 50 | 四方耗 | 実装済み | 6 | monthBranch三合トリオ＋lunarDay | |
| 51 | 山痕・田痕・水痕・金痕・土痕・土公占・驚走殺 | 保留 | | | 座標抽出では列境界が確定できない複雑な表。大月/小月の判定情報もCalendarEngine未提供 |
| 52 | 刀砧日 | 実装済み | 6 | monthBranch季節＋dayBranch | |
| 53 | 龍禁 | 実装済み | 6 | lunarDay固定列挙 | |

上記のうち「解除条件記録あり」と注記した項目、および月刑・大時・九空・
四撃系列など各グループの実装コメントに記載した解除・増悪条件はすべて
将来の「神殺解除・相殺」フェーズで扱う（今回は判定ロジックに反映しない）。

---

# 3. 神殺評価

## 吉神・凶神一覧表示

- [ ] 未実装

## 神殺の解除・相殺

**神殺resolutionフェーズ：確定ルール実装完了。残余は用途判定移管または保留。**

- [x] 第1実装フェーズ完了（resolution engine。`src/lib/takujitsu/resolution/`）
- [x] 第2実装フェーズ完了（pending9ルールの再判定・正式有効化）
- [x] 最終整理フェーズ完了（全25ルールをA/B/Cに最終分類。コード変更なし）
  - occurrence detection（吉神Group1〜6・凶神Group1〜6）とは完全に分離
  - 実装した確定ルール（A：14件。pending:false）:
    - No.3 月建（小時）解除
    - No.9a 月刑解除／No.9b 月刑×月破増悪
    - No.10 大時・天吏 凶性軽減（reduced）
    - No.11 遊禍 増悪
    - No.13b 四撃・四耗・四廢・四忌・四窮・五虚 解除
    - No.16 八風 解除
    - No.8 月厭・厭對 解除（徳合AND赦願）
    - No.12 土符 増悪（徳合AND赦願）
    - No.14 氣往亡 増悪（徳合OR赦願）
    - No.17 觸水龍 増悪（徳合OR天願）
    - No.18 四離・四絶 増悪（徳合AND天願）
    - No.20 八節日 増悪（徳合AND赦願）
    - No.21 土王用事 増悪（徳合AND赦願）
  - 用途判定へ移管（B）: 0件（該当なし。No.10のreduced内の用途限定注記は
    将来の用途判定レイヤーで扱う情報として温存）
  - 保留（C：11件）: No.1・2・4a・4b・4c・5・6（歳徳合の一般解除・月破の
    構造的例外/免疫日・死神・満日は本文の曖昧さ、または実例のみで正式な
    判定式でないため）、No.7（「など」が非網羅的）、No.13a（土旺未定義）、
    No.15（条件は確定しているがmonthBranchがresolve()に渡っていない）、
    No.19（「月建」の指示対象が2通り読め一義的に確定できない）
- [ ] calculateShinsatsu への統合（型変更の影響検討が必要なため見送り）

## 神殺優先順位

- [ ] 未実装（複数ルール競合時は resolution engine が status="pending" を
      返す設計のみ実装済み。優先順位そのものの明文化は未着手）

---

# 4. 用途判定

## 用事辞書（ActivityDefinition）

- [x] 242件（`src/lib/takujitsu/activity/activityDefinitions.ts`）。うち
      39件は用事便覧.pdfと完全一致し現代語訳・説明を付与、残り203件は
      原典表記そのまま（無理な現代語化・大分類はしない方針）

## ActivityProfile（象意プロファイル）

- [x] 174件（`src/lib/takujitsu/activity/activityProfiles.ts`）。
      十二建除12・二十八宿28・吉神69（実装済みoccurrence名と1対1）・
      凶神65（同）。docs/takujitsu_activity_rules.mdで本文から確定
      できた宜/忌だけをコード化（象意不明・保留は空配列＋notes）

## 用途判定engine 第1フェーズ

- [x] `evaluateActivities()`（`src/lib/takujitsu/activity/evaluateActivities.ts`）。
      resolution結果・十二建除・二十八宿を入力に、用事ごとの
      positiveSources/negativeSources/verdict（good/bad/mixed/neutral）
      を集約する。cancelled→忌を反映しない／aggravated→反映しnote保持／
      reduced→マッピング済みの忌は反映せずunresolvedRestrictionsへ
      （No.10大時・天吏の「攻めのビジネス」等）／pending→忌を反映し
      hasPendingSourceで明示。独自の総合吉凶ルール・優先順位・点数化・
      ランキングは今回作っていない
- [ ] 以下の用途ごとの最終評価（個別の用途カテゴリへの分類・表示は未着手）

- [ ] 求財
- [ ] 求官
- [ ] 婚姻
- [ ] 出産
- [ ] 動土
- [ ] 建築
- [ ] 移転
- [ ] 開店
- [ ] 契約
- [ ] 旅行
- [ ] 医療
- [ ] 訴訟
- [ ] 葬祭
- [ ] その他

---

# 5. UI

## カレンダー

- [ ] 月表示
- [ ] 日選択

---

## 日詳細

- [ ] 干支
- [ ] 二十四節気
- [ ] 農暦
- [ ] 十二建除
- [ ] 二十八宿
- [ ] 吉神一覧
- [ ] 凶神一覧

---

## 最終評価

- [ ] 吉用事
- [ ] 凶用事
- [ ] 注意事項

---

# 6. テスト

## CalendarEngine

- [x] TypeScript
- [x] Build
- [x] 二十八宿
- [x] 農暦

---

## 擇日

- [x] 吉神全グループ
- [x] 凶神（第1〜第6グループ完了。凶神1〜53番の全件棚卸し完了、残りは保留台帳のとおり）
- [x] 神殺解除・相殺・増悪（第1・第2実装フェーズ＋最終整理フェーズで完了。
      確定14ルール、保留11ルール、用途判定移管0件。単体テスト87件＝
      resolution単体30＋第2フェーズ単体47＋統合10、全件PASS。フェーズ完了）
- [x] 用途判定engine 第1フェーズ（用事辞書242件＋ActivityProfile174件＋
      evaluateActivities()。単体テスト2ファイル＝ActivityDefinition
      760アサーション＋evaluateActivities 114アサーション、全件PASS）
- [x] 六黄道COMPOSITE 本番実装フェーズ（2026-09-10。5神に`composite:true`＋
      evaluateActivities()2パス化。金匱はLIST型のまま、6神とも家族会議・
      遠行は保持。指標は実装前後で完全に同一。詳細は
      `docs/takujitsu_liuhuangdao_composite_analysis.md`14章）
- [x] 月破・徳神失力 原典確定フェーズ（2026-09-10。コード変更なし＝原典
      解析と設計のみ。「德神」＝天徳・天徳合・月徳・月徳合・天赦・天願の
      6神、positive完全抑制、と確定。詳細は
      `docs/takujitsu_geppo_deity_suppression_analysis.md`）
- [x] 月破・徳神positive抑制 本番実装フェーズ（2026-09-10。
      `ActivitySuppression`型＋`evaluateActivities()`第1.5パス。SOURCE
      VALIDATION不変、APP EVALUATION 60.47%→60.39%。単体テスト114→189。
      詳細は同analysis 15章）
- [x] 十二建除・收日 × 月恩／四相／時徳 → 修倉庫 クロス条件 本番実装
      フェーズ（2026-09-10。`evaluateActivities()`十二建除ブロック直後に
      `収 AND (月恩 OR 四相 OR 時徳) → 修倉庫`（sourceType="jianchu"）を追加。
      SOURCE VALIDATION・APP EVALUATION とも不変。単体テスト189→217。
      詳細は`docs/takujitsu_jianchu_seasonal_rules.md`末尾補足）
- [x] 十二建除「収」の完成（常時宜＋季節宜＋月恩四相時德クロス条件、
      全て実装済み）。滿は未着手のまま
- [x] 十二建除・成日 CONFLICT 原典確定フェーズ（2026-09-10。神殺象意.pdf
      成日＝入學・移徙・築堤防・開市 で確定。直接矛盾なし＝C案推奨）
- [x] 十二建除・成日 C案 本番実装フェーズ（2026-09-10。`activityProfiles.ts`
      の成を7語 union へ拡張。APP EVALUATION 60.39%→61.98%（原典 union の
      副産物）。単体テスト217→246。詳細は同analysis 14章）
- [x] 十二建除11直の完成（建・除・平・定・執・破・危・成・収・開・閉。
      滿のみ神殺象意.pdf単独記載なしで未着手）
- [x] 空 ActivityProfile 原典監査フェーズ（2026-09-10。コード変更なし。
      空23件を IMPLEMENTABLE 1（歸忌→移徒）／SOURCE_ONLY_EMPTY 19／
      AMBIGUOUS_LAYOUT 1（四方耗）／DEFERRED 2（兵禁・大煞）に分類。詳細は
      `docs/takujitsu_empty_activity_profiles_audit.md`）
- [x] 歸忌 → 忌 移徒 本番実装（2026-09-10、擇日UI 第3フェーズと同時。
      `activityProfiles.ts` の歸忌のみ `unfavorableActivityIds:["移徒"]`。
      occurrence・resolution 無変更。指標不変）
- [x] 擇日アプリ UI統合 第1フェーズ（2026-09-10。`/takujitsu` ページ＋
      `calculateTakujitsuFull()` 統合 wrapper。原典ロジック無変更）
- [x] 擇日UI 第2フェーズ ― 用途カテゴリ分類・実用UI化（2026-09-10。
      `activityCategories.ts`〈UIメタデータ、判定ロジック非依存〉＋複合
      フィルタ＋今日の概要＋UI並び順＋スマホ対応。原典ロジック無変更）
- [x] 擇日UI 第3フェーズ ― 目的から良い日を検索（2026-09-10。
      `searchTakujitsuDays()`〈独自吉凶判定なし＝各日 evaluateActivities の
      verdict をそのまま使用〉＋モード切替＋月別グループ＋二重計算解消
      〈`calculateTakujitsu(input, calendar?)`〉＋kyoushinGroup5 節気メモ化
      〈判定不変・366日 50s→7s〉。詳細は本ファイル）
- [x] 擇日UI 用途データ整理・表示修正・メモ化正式採用（2026-09-10。
      擇日の目的でない12語を ActivityDefinition から削除〈256→244、内部
      参照なしを確認〉／神殺欄の開発者向け説明文を削除〈バッジは維持〉／
      kyoushinGroup5 メモ化のキャッシュキー監査＋正式採用。engine 判定・
      一致率は完全に不変。詳細は本ファイル最終更新）
- [ ] 擇日UI 第4フェーズ（真太陽時／地点入力・時刻擇定・印刷・
      用事便覧の説明ツールチップ・URLクエリ共有・歸忌の resolution
      〈徳合/赦/願併→猶忌〉・"その他"36語の「宴席・交際」カテゴリ検討 等）
- [x] 現行95再監査フェーズ（2026-09-11。`docs/takujitsu_missing_activity_reaudit.md`
      で発見したA判定15件のうちユーザー承認14件を正式採用し95→109。
      安香・起基定硬（用事便覧側表記は起基定礎）・安門・安吟・作灶・造倉庫・
      苫蓋・放水・造船・合帳・斎醮・合壽木・避宅出火・修宅日。B判定14件は
      「明確な別名ではない」というユーザー判断により既存95件は無変更。
      14件は原典上の用途に基づき既存15カテゴリーへ配置し全件modernLabelを
      設定（11件は用事便覧.pdfと完全一致しyoujibinranNo等も設定）。
      ActivityProfileへの接続は、根拠となる`神殺象意.pdf`該当箇所が縦書き
      旧字体で判読不能、`擇日テキスト.pdf`忌例章は条件付き記述中心で
      既存ActivityProfileの構造と不一致という理由により全14件見送り
      （ActivityDefinitionのみ追加、profile上は未接続と明示）。
      TypeScript／ESLint／Next build／既存回帰テスト25ファイル全てPASS。
      詳細は同docs 10章参照）
- [x] ActivityProfile再監査フェーズ（2026-09-11。95→109で追加した14件のうち
      「無条件の宜・忌が原典に直接書かれているもの」だけを`神殺象意.pdf`・
      `擇日テキスト.pdf`・`12建除.pdf`・`擇日実例.pdf`で再確認し、jianchu
      「開」favorableへ「放水」「安門」の2件を新規接続（`12建除.pdf`⑪開日
      「放水に吉」「門の設置…に良い」が根拠）。「苫蓋」は既存の「災殺」
      all_except機構によりコード変更なしで既に忌として機能済みと確認。
      「神殺象意.pdf」側の候補（冰滑瓦碎・土瘟・土公死・火星・帝酷殺・
      鼓輪殺）は実装ロスター外と確認し未接続のまま。作灶→危宿「かまど作り」
      対応と造倉庫・造船→四方耗対応の2件はユーザー確認待ちとして保留。
      TypeScript／ESLint／Next build／既存回帰テスト25ファイル全てPASS、
      既存95件・新規追加2件以外の判定結果は不変。詳細は
      `docs/takujitsu_missing_activity_reaudit.md` 11章参照）
- [x] ActivityProfile再監査 続編（2026-09-11。保留していた2件をユーザーが
      原典を確認のうえ正式承認。(a) shuku28「危」favorableへ「作灶」を追加
      （`12建除.pdf`二十八宿「危」〈読み「き」〉「かまど作り」が根拠。
      **重要**：同PDFの十二建除「危日」〈読み「あやぶじつ」〉には
      かまど・作灶への言及が一切無く別概念のため、jianchu「危」には
      作灶を追加していない。両者は同じ「危」の字を使う別の日家システムで
      混同注意）。(b) kyojin「四方耗」unfavorableへ「造倉庫」「造船」を
      追加（`擇日テキスト.pdf` 50)四方耗「忌：出行、開市、立券交易、納財、
      造倉庫、造船」が根拠。出典が神殺象意.pdfでないことは除外理由に
      しないとユーザーが明示）。安門・放水・苫蓋の既存の扱いは維持。
      これで新規14件中5件（安門・放水・作灶・造倉庫・造船）がProfile接続、
      9件（うち苫蓋はall_except機構で自動的に対象）が未接続。
      TypeScript／ESLint／Next build／既存回帰テスト25ファイル全てPASS、
      既存95件・既接続2件以外の判定結果は不変。詳細は
      `docs/takujitsu_missing_activity_reaudit.md` 11.6章参照）
- [ ] 用途判定engine 第2フェーズ（用途カテゴリ分類、擇日象意.pdfとの
      答え合わせ、UI接続）

---

# 今後の実装順序

1. 凶神
2. 神殺の解除・相殺
3. 用途判定engine 第1フェーズ（象意プロファイル接続・根拠集約）
4. 用途判定engine 第2フェーズ（用途カテゴリ分類・擇日象意.pdf答え合わせ）
5. カレンダーUI
6. 日詳細UI
7. 実運用テスト

---

注意事項

このファイルは進捗管理専用とする。

新しい機能を実装したら、その都度チェックボックスを更新すること。

仕様書ではなく、開発の現在地を把握するためのドキュメントとする。
