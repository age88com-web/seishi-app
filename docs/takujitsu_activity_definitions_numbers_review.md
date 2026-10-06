# 擇日 ActivityDefinition Numbers表判断反映フェーズ

- 実施日: 2026-09-11
- 基準資料: ユーザーが確認済みのNumbers表（残存112件の個別判断・メモ）
- 目的: Numbers表に明記された統合・単純削除・カテゴリー変更だけを機械的に反映する。
  表にない統合先の推測は行わない。
- **`src/lib/takujitsu/` 配下のうち変更したのは
  `activityDefinitions.ts` / `activityProfiles.ts` / `activityCategories.ts` の3ファイルのみ**。

## 0. 確定（2026-09-11 追記）

現在の**ActivityDefinition = 95件**を、正式なアプリ用用事マスターとしてユーザーが確定した。
以降、追加実装・追加変更の指示があるまで、`activityDefinitions.ts` /
`activityProfiles.ts` / `activityCategories.ts` は本フェーズの状態を正とする。

## 1. 作業前の確認結果

- 変更前のActivityDefinition件数: **112件**（確認済み）
- 削除元17件・統合先14件・カテゴリー変更対象10件、いずれも辞書上に**1件ずつ**存在することを
  `grep -c` で確認済み（多重定義・表記ゆれなし）。
- 「生活」カテゴリーは既存の`ACTIVITY_CATEGORIES`（婚姻・縁組／妊娠・出産・子供／引越し・移転／
  建築・工事／土地・不動産／開業・商売／契約・取引・財／就職・仕事／学業／旅行・外出／
  医療・健康／祭祀・祈願／葬祭・墓／農業・畜産／その他）のいずれにも存在しないことを確認し、
  ユーザーに確認のうえ新設した（新規カテゴリーの追加は事前承認を得たうえで実施）。

## 2. 指定統合14件

| No. | 削除元 | 統合先 | 変更したActivityProfile（参照フィールド） |
|---|---|---|---|
| 1 | 搬移 | 搬入 | kyojin:五墓(unfavorableActivityIds) |
| 2 | 増改築 | 修造 | kyojin:大時／kyojin:天吏(unfavorableActivityIds) |
| 3 | 造作 | 修造 | shuku28:亢・氐・房・心・尾・箕・斗・虚・室・壁・奎・婁・胃・昴・畢・觜・参・柳（計18箇所、favorable/unfavorable） |
| 4 | 造宅 | 修造 | kichijin:益後(favorableActivityIds) |
| 5 | 興造動土 | 修造動土 | kyojin:血支(unfavorableActivityIds、統合先が既に配列内に存在したためdedup除去) |
| 6 | 開市交易等 | 開市 | kyojin:血支(unfavorableActivityIds、同上dedup除去) |
| 7 | 契約 | 立券交易 | jianchu:満(favorableActivityIds、置換) ／ kichijin:六合(favorableActivityIds、統合先が既存のためdedup除去) |
| 8 | 入学 | 入学求師 | jianchu:成・開(favorableActivityIds) ／ shuku28:虚・觜(favorableActivityIds) ／ kichijin:驛馬(favorableActivityIds) ／ kyojin:月破・死神・劫殺・災殺・月殺・月厭・月刑・四廢(exceptionActivityIds)　計13箇所 |
| 9 | 行船 | 乗船渡水 | shuku28:室(favorableActivityIds) ／ kichijin:五合(favorableActivityIds) ／ kyojin:龍禁(unfavorableActivityIds) |
| 10 | 求医 | 求醫療病 | kichijin:普護・驛馬・天醫・天喜(favorableActivityIds、うち天醫・天喜・驛馬は統合先が既存のためdedup除去) ／ kyojin:死気・血支・氣往亡・五墓・月忌日(unfavorableActivityIds、うち血支・五墓・月忌日は統合先が既存のためdedup除去) |
| 11 | 集魚 | 取魚 | kyojin:觸水龍(unfavorableActivityIds、統合先が既存のためdedup除去) ／ kyojin:八節日(unfavorableActivityIds、置換) |
| 12 | 狩猟 | 畋獵 | jianchu:開(unfavorableActivityIds、統合先が既存のためdedup除去) ／ kyojin:氣往亡・八節日(unfavorableActivityIds、置換) ／ **jianchu:執(favorableActivityIds)は例外**（下記3.参照） |
| 13 | 魚取 | 取魚 | kyojin:氣往亡(unfavorableActivityIds、置換) |
| 14 | 魚釣 | 取魚 | kichijin:生氣・時陽(unfavorableActivityIds、置換) |

置換時、統合先が同一配列内に既に存在していたケース（5. 6. 7-六合. 10-天醫/天喜/驛馬/血支/五墓/月忌日. 11-觸水龍. 12-開）は、指示どおり重複させず削除元だけを取り除いた（dedup扱い）。それ以外は削除元→統合先へ単純置換し、配列内の順序を維持した。

## 3. 例外：jianchu「執」の「狩猟」（ユーザーに確認のうえ処理変更）

12番（狩猟→畋獵）を機械的に適用すると、jianchu「執」の`favorableActivityIds`に「畋獵」が
常時宜として追加され、同エントリの`seasonalRules`（霜降後立春前限定の季節宜「畋獵」）と
競合し、**季節限定のはずの畋獵が常時宜化する**（以前のセッションで確認・回避されていた
不具合の再発）ことが既存テスト（`takujitsu_evaluate_activities_unit.manual.ts` 16.）で
検出された。

ユーザーに確認し、**この1件だけ**「狩猟」を単純に取り除く（dedup相当）扱いとし、
「畋獵」は追加しなかった（`seasonalRules`側の「畋獵」が既にこの用事をカバーしているため、
新規追加する必要がない）。他の3箇所（jianchu「開」unfavorable・kyojin「氣往亡」
unfavorable・kyojin「八節日」unfavorable）は指示どおり置換した（いずれも忌側でseasonalRules
の対象外のため問題ない）。

**（2026-09-11 追記・正式仕様として確定）** 十二建除「執」については、
- 「狩猟」参照を削除する
- 「畋獵」を常時宜（favorableActivityIds）へは追加しない
- 既存の`seasonalRules`（霜降後、立春前のみ「畋獵」を季節宜とする）をそのまま維持する

という処理を、ユーザー確認済みの正式仕様として記録する。今後この箇所を再度「狩猟→畋獵の
単純置換」に戻す変更は行わない。

## 4. 単純削除3件

統合先の指定が無いため、ActivityDefinitionとActivityProfile参照の両方を、別用事へ移植せず
単純に削除した。

| 用事 | 削除したActivityProfile参照 |
|---|---|
| 慈愛 | kichijin:陰徳(favorableActivityIds) |
| 百事 | kichijin:歳徳・歳徳合・聖心・天瑞(favorableActivityIds、計4箇所) |
| 訴訟 | kyojin:大時・天吏(unfavorableActivityIds、計2箇所) |

削除によって空配列になった箇所はなかった（型・設計上の問題は発生しなかった）。

## 5. カテゴリー変更10件

| 用事 | 変更前カテゴリー | 変更後カテゴリー |
|---|---|---|
| 剃頭 | 妊娠・出産・子供 | 生活（新設） |
| 整手足甲 | 妊娠・出産・子供 | 生活（新設） |
| 沐浴 | 医療・健康 | 生活（新設） |
| 家族会議 | その他 | 生活（新設） |
| 會親友 | その他 | 生活（新設） |
| 祝賀 | その他 | 生活（新設） |
| 親睦 | その他 | 生活（新設） |
| 賓客 | その他 | 生活（新設） |
| 進人口 | 就職・仕事 | 妊娠・出産・子供 |
| 鋳造 | その他 | 就職・仕事 |

「家族会議」は表で「残す」と明記されたためActivityDefinition自体は削除していない
（カテゴリーのみ変更）。上記以外の94件はカテゴリーを変更していない。

## 6. 720実例検証への影響（重要・ユーザー確認済み）

### 6-1. jianchu「執」の狩猟→畋獵季節衝突

上記3.の対応により、既存テスト16.（畋獵の季節限定挙動）は現状維持で問題なし
（回帰テスト確認済み）。

### 6-2. 「入学 → 入学求師」統合による720一致率への影響

擇日象意720件のgolden側`expectedCombined`を照合したところ、**「入学」は115回出現する
一方、「入学求師」は0回しか出現しなかった**（`tests/fixtures/zeyi_720_resolved.json`で
確認）。神殺象意.pdf上も両語は別々に使われていた可能性がある（入学求師は上兀・下兀の
kyojin unfavorableでのみ使用されていた語）。

この統合により、統合前は「入学」として正しく一致していた最大115行が、統合後は
システムが「入学求師」を出力するため golden側「入学」と一致しなくなる。ユーザーに
この影響を報告し確認を得たうえで、**指示どおり統合を実行し確定した**（720一致率よりも
Numbers表の判断を優先する、という明示的な判断）。

**（2026-09-11 追記・重要な注記）** この統合によって生じる最大115件の不一致は、
以下のいずれの不具合としても扱ってはならない。

- 神殺（吉神凶神）発生ロジックの誤り
- 十二建除ロジックの誤り
- 二十八宿ロジックの誤り
- resolution（徳合・冲刑などの解除・抑制）ロジックの誤り

これは上記4系統のロジックとは無関係で、**「アプリ用canonical用事語彙と、擇日象意原典語彙の
意図的な統合差」**であり、別枠管理する。原因は「入学」と「入学求師」という2つの原典語彙を、
Numbers表判断反映フェーズでユーザーが目視判断により1つのcanonical id（入学求師）へ
意図的に統合したことにある。ロジック層（occurrence判定・十二建除・二十八宿・resolution）は
本フェーズで一切変更しておらず、いずれも正しく動作している。

今後、擇日象意720件の一致率を算出・報告する際は、次の2種類を区別して注記すること。

- **RAW SOURCE MATCH**：原典語彙（擇日象意.pdfの`expectedCombined`表記、例：「入学」）を
  そのまま文字列比較した一致率。canonical統合の影響を受けるため、統合した語（本フェーズ時点
  では入学→入学求師の1組）は原理的に一致しない行が発生する。
- **CANONICAL MATCH**：今回ユーザーが承認済みのcanonical語彙統合（Numbers表の統合14組、
  および今後承認される統合）を踏まえたうえでの一致率。原典側の語を統合後のcanonical id
  （例：「入学」→「入学求師」）へ変換してから比較することで、意図的な語彙統合による差分を
  除外して測定する。

**今回はこの区別の検証コード（`tests/fixtures/gen_final_720_verification.ts`等）への実装は
行っていない。** 次回以降、720一致率を再計測・報告する際に、この2種類のいずれで算出した値かを
明記すること（現状の`gen_final_720_verification.ts`はRAW SOURCE MATCH相当であり、
CANONICAL MATCHへの変換ロジックはまだ実装されていない）。

## 7. 検証結果

- 削除対象17件がActivityDefinitionに残っていないこと: **確認済み（0件残存）**
- 削除済みactivityIdへの参照が0件: **確認済み**（`ACTIVITY_PROFILES`全域を17id×全フィールドで
  再走査し、リーク0件）
- 指定された14組以外への参照移植がないこと: **確認済み**（表にない統合は一切実行していない）
- 統合先のActivityProfile参照に重複がないこと: **確認済み**（全配列を`Set`化して内部重複0件）
- カテゴリー変更10件が指定どおりであること: **確認済み**
- その他94件のカテゴリーが変わっていないこと: **確認済み**（変更したのは指定10件の
  移動元・移動先カテゴリーのみ）
- ActivityDefinitionのid重複: **0件**
- TypeScript型チェック: **エラーなし**
- ESLint: **`src/lib/takujitsu/`にエラーなし**（既存の未使用変数warning1件は本フェーズと無関係）
- Next.jsビルド: **成功**
- 全擇日回帰テスト: **全件PASS**
  - `takujitsu_activity_definitions_unit.manual.ts`: 401/401
  - `takujitsu_search.manual.ts`: 47/47（ActivityDefinition総数=95、カテゴリ合計=95、
    その他=12、生活=8、カテゴリー変更10件を個別検証）
  - `takujitsu_evaluate_activities_unit.manual.ts`: 247/247（「訴訟」を汎用プレースホルダー
    「臨官」へ差し替え、「入学」を「入学求師」へ差し替えたうえで全件確認）
  - `takujitsu_kichijin*` / `takujitsu_kyoushin*` / `takujitsu_resolution*` /
    `jianchu_unit` / `shuku28_*`: 全件既存の合格状態を維持（新規差異なし）
- 擇日象意720件・34用事カバレッジ: 静的分類でA+B+C+D+E+F+G=**33/34**
  （「入学」がH区分＝現行ActivityProfileから参照されるid無しとなったため。
  6-2節のとおりユーザー確認済みの意図した結果）

## 8. 変更前後の件数

- 変更前: 112件
- 変更後: **95件**（112 − 統合14 − 単純削除3 = 95）
