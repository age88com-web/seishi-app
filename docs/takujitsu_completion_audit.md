# 擇日エンジン完成度・残課題棚卸しフェーズ

最終更新：2026-09-09

本フェーズはコードを一切変更していない（`src`以下無変更）。既存の
occurrence・resolution・ActivityProfile・evaluateActivities・
jianchu・shuku28コードとdocsを読み取り専用で棚卸しした。

---

## 1. occurrence未実装の全件確認

### 1.1 分類凡例
- **IMPLEMENTED**：occurrence detectionが実装済み。
- **ALIAS**：別名として既存occurrenceに統合済み（実質実装済み）。
- **SOURCE_ONLY**：原典（擇日テキスト.pdf）自身が「信用できない」
  「吉神/凶神と考えない方がよい」等と明記し、意図的に実装対象外とした
  もの。原典に忠実な結果であり、欠落ではない。
- **DEFERRED**：判定式は原文にあるが、既存CalendarEngineの入力だけでは
  計算できない（追加の暦計算機能が必要）。
- **UNRESOLVED**：判定式・成立条件が原文からそもそも確定できない、
  または原文と擇日実例.pdfの内容が矛盾する。

### 1.2 ユーザー指定リストの確認結果

| 項目 | 分類 | 根拠 |
|---|---|---|
| 顕星・曲星・傅星 | 該当なし | `src/lib/takujitsu`・既存docsのいずれにも出現しない。擇日テキスト.pdf本文に同名の章・表が見つかっていない（今回のgrep範囲では未確認語のまま）。実装着手前に原本での存在確認が必要。 |
| 満日（天狗） | UNRESOLVED | `kyoushinGroup1.ts`で調査済み：本文「戊の日の満日のみ」という説明が擇日実例.pdfの内容と一致せず保留。`kyoushinGroup6.ts`で再確認したが新情報なし。 |
| 反支日 | 該当なし | src・docsに出現せず。原本での存在確認が必要。 |
| 伏社 | UNRESOLVED | `kyoushinGroup6.ts`：起点（庚日・戊日）の説明はあるが、忌とする対象行為・成立条件が本文に見当たらない。 |
| 朔弦望十五日 | DEFERRED | `kyoushinGroup6.ts`：朔・十五日は既存情報で判定可能だが、上弦・下弦・望は月相角度（0/90/180/270度）を求めるAPIがCalendarEngineに無い。5概念を安易に分割しないため全体を保留。 |
| 百忌日 | SOURCE_ONLY | 本文が「非常に多くなるため信用できない」と明記。 |
| 探病忌日 | SOURCE_ONLY | 本文が「迷信的要素が強いため気にしなくてよい」と明記。 |
| 土忌等 | 該当なし | src・docsに出現せず。原本での存在確認が必要（「土忌」という単独の章の有無を含め要調査）。 |
| 真滅没密日 | DEFERRED | 朔弦望十五日と同じ理由（弦・望の月相角度APIが無い）。 |
| 裁衣吉凶宿 | SOURCE_ONLY | 二十八宿ごとの「裁衣」専用参照表で、他の凶神一覧とは性質が異なる用途限定表のため対象外。 |
| 諸家周堂 | SOURCE_ONLY | 本文が「信用できず気にする必要はない」と明記（同じ項目内の周堂殺は実装済み）。 |
| 食神殺 | SOURCE_ONLY | 本文が「信憑性がない」と明記。 |
| 山痕・田痕・水痕・金痕・土痕・土公占・驚走殺 | UNRESOLVED | `kyoushinGroup6.ts`：7項目×大月/小月14列のリストが列ごとに要素数不揃いで境界を機械的に確定できず、「大月/小月」判定もCalendarEngineに専用フィールドが無い。原本画像での再確認が必要。 |
| 月空 | SOURCE_ONLY | `kichijin.ts`：天恩と並び、本文が「吉神と考えない方がよい」と明記して除外した7項目より後の項目。意図的な除外で欠落ではない。 |
| 天后 | **ALIAS**（＝驛馬） | `kichijinGroup5.ts`：擇日実例.pdfで「天后」は60件すべて「驛馬」と同一行・直後に出現し単独出現が無い。既存の驛馬に統合済み（実質実装済み）。 |
| 小耗 | **IMPLEMENTED**（2026-09-09実装済み） | 神殺象意.pdf画像確認で成立条件「為『舊月破』、又為本月『閉日』之沖」を確認（＝十二直「執」と等価）。`kyoushinGroup6.ts`に実装し、720行検証でTP=58/FN=0/FP=2（FP2件は「中耗」表記＝OCR異体の可能性）。詳細は`docs/takujitsu_xiaohao_fuyi_wuli_verification.md`。 |

### 1.3 追加で判明した未実装ギャップ（今回の棚卸しで新規発見）

`docs/takujitsu_shinsatsu_shogi_audit.md`4章の「NEW_DETAIL」区分整理時に
記録されていた、occurrence未実装の凶神2件を再確認した：

| 項目 | 分類 | 根拠 |
|---|---|---|
| 復日 | UNRESOLVED（2026-09-09再調査済み、なお未解決） | 神殺象意.pdf・擇日テキスト.pdfのいずれにも成立条件（判定式）の記述が見つからず、忌の列挙（破土・安葬・啓攢）のみ確認できた。原本画像を確認済み（`docs/takujitsu_xiaohao_fuyi_wuli_verification.md`）。720行から逆算せず、DEFERREDのまま維持。擇日実例.pdf残差に72回出現。 |
| 五離 | UNRESOLVED（2026-09-09再調査済み、なお未解決） | 同上（忌：宴會・結婚納采・嫁娶・立券交易のみ確認、成立条件の記述なし）。擇日実例.pdf残差に119回出現（既存の四離・四絶とは別語）。 |

**小耗・復日・五離の3件は、既存の134件（吉神69＋凶神65）とは別に、
擇日実例.pdf自身に高頻度で出現するにもかかわらずoccurrence detectionが
存在しない神殺である。** 判定式の確定にはそれぞれ擇日テキスト.pdfの
該当章の原本画像確認が必要（今回のフェーズでは実施しない）。

---

## 2. 吉神69・凶神65の再確認

`src/lib/takujitsu/shinsatsu/*.ts`が`kichijin.push()`/`kyojin.push()`で
生成するoccurrence名（134件、リテラル文字列のみでvariable pushは無し）
と、`src/lib/takujitsu/activity/activityProfiles.ts`のsourceNameを
突き合わせた。

| 確認事項 | 結果 |
|---|---|
| profileにあるがoccurrenceに無い（吉神） | **0件** |
| occurrenceにあるがprofileに無い（吉神） | **0件** |
| profileにあるがoccurrenceに無い（凶神） | **0件** |
| occurrenceにあるがprofileに無い（凶神） | **0件** |

**134件全て、occurrenceとActivityProfileが1対1で過不足なく対応している**
（前フェーズの`tests/takujitsu_activity_profiles_unit.manual.ts`相当の
検証が今回の棚卸しでも再確認できた）。

ALL/LIST/EXCEPT/COMPOSITEの内訳：

| 型 | 件数 | 対象 |
|---|---|---|
| ALL型（positiveMode:"all_except"） | 6 | 天徳・月徳・天徳合・月徳合・天赦・天願 |
| EXCEPT型（negativeMode:"all_except"） | 11 | 月破・死神・劫殺・災殺・月殺・月刑・月厭・四廢・上朔・四離・四絶 |
| COMPOSITE型（composite:true。2026-09-10実装済） | 5 | 青龍・明堂・寶光・玉堂・司命（3章参照）。家族会議・遠行のLIST型データは追加機能として保持 |
| LIST型（金匱。COMPOSITE化しない。3章参照） | 1 | 金匱（家族会議・遠行） |
| LIST型（上記以外） | 52 | 残る吉神 |
| LIST型（上記以外） | 54 | 残る凶神 |

完全に空のprofile（favorable/unfavorableともに空でALL/EXCEPTでもない）：
**23件**（shuku28 2・kichijin 9・kyojin 12）。

**2026-09-10「空 ActivityProfile 原典監査フェーズ」で全23件を4分類した**
（`docs/takujitsu_empty_activity_profiles_audit.md`）：

| 分類 | 件数 | 神 |
|---|---|---|
| IMPLEMENTABLE | 1 | 歸忌（神殺象意.pdf「忌移徙」。空なのは移徙→id`移徒`のマッピングがSAFE_ADDで「未確認」除外されたため。成日C案の前例で解決可） |
| SOURCE_ONLY_EMPTY | 19 | 牛・鬼（12建除.pdf 抽象「大吉」、神殺象意.pdfに二十八宿なし）／義日・専日（神殺象意.pdf「其義太泛、故不註宜忌」）／要安・五富・天馬・大明・七聖・天貴・催官（抽象象意のみ）／八風（協紀引用のみ）・九焦・埋兒凶宿・大空亡・小空亡・長星・短星・揚公忌（抽象／暦日表のみ） |
| AMBIGUOUS_LAYOUT | 1 | 四方耗（神殺象意.pdf p.44 隣接51番ブロックの「忌：出行・開市・立券交易・納財・造倉庫・造船」の帰属が座標上不明） |
| DEFERRED | 2 | 兵禁・大煞（「兵禁・大煞」併記で忌を分離不可＋著者が実務上の忌を否定。神殺象意.pdfに記載なし） |

「以前『象意帰属不明』とされた劫殺・災殺・月殺」は空 profile ではなく、
既に EXCEPT型（諸事皆忌＋例外9語）として原本画像で確定済み
（`docs/takujitsu_except_resolution_final.md` 1.1章）＝分類 IMPLEMENTED。

新規 ActivityDefinition は不要（歸忌の「移徒」は既存 id）。空を埋める候補は
凶神の忌1件のみのため、SOURCE VALIDATION（吉神 favorable の指標）は
構造的に不変、APP EVALUATION も移徒が34語彙外で一致率不変の見込み。
実装（歸忌のみ）は次フェーズ。

---

## 3. COMPOSITE型の棚卸し（六黄道・六黒道）【2026-09-09確定】

「六黄道COMPOSITE型 原典確定フェーズ」で原本画像を再確認し、以下が
確定した（詳細は`docs/takujitsu_liuhuangdao_composite_analysis.md`）：

- **COMPOSITE型の意味が確定した**：神殺象意.pdf「〔青龍〕〔明堂〕
  〔寶光〕〔玉堂〕〔司命〕爲六黄道日，與吉神併，則從所宜，與凶神併，
  則從所忌」——単独では固定の宜忌を持たず、同日に成立する他の吉神・
  凶神の宜/忌をそのまま反映する構造（一般的な「黄道日＝万事に宜」
  という知識ではなく、原文にこの具体的な条件追従構造が明記されている
  ことを直接確認した）。対になる六黒道（天刑・朱雀・白虎・天牢・元武・
  勾陳）にも同一構造の対称的な記述がある。
- **金匱はこのCOMPOSITE定義に含まれない**：神殺象意.pdfの「六黄道日」
  文は5神（青龍・明堂・寶光・玉堂・司命）のみを列挙しており、金匱は
  含まれていない。神殺象意.pdf全7ページを通読したが金匱の独立記述も
  見つからなかった。擇日テキスト.pdfのp.15（12神の月令表＋「吉の象意
  としての特別な意味はなく、一般的な吉日である。政治に関する打ち合わせ、
  家族会議、上司とあう。遠行にも良い」という説明文）が唯一の根拠で、
  現行の`家族会議`・`遠行`はこのテキストに直接由来する（推測ではない）。
- **本番実装完了（2026-09-10、六黄道COMPOSITE 本番実装フェーズ）**：
  ユーザー確定仕様は「5神をCOMPOSITE化（`composite:true`）、金匱は
  LIST型のまま、6神とも家族会議・遠行のLIST型データは削除せず保持
  （COMPOSITEは追加機能）」。`evaluateActivities()`を2パス化し、第2パスで
  吉神由来positive・凶神由来negative（resolution適用後）だけを六黄道神
  自身のsourceとして追従させる。occurrenceは6神とも無変更。指標
  （SOURCE VALIDATION 85.52%/68.10%、APP EVALUATION 60.47%）は実装前後で
  完全に同一。詳細は
  `docs/takujitsu_liuhuangdao_composite_analysis.md`14章。

---

## 4. resolution残課題の再分類

`src/lib/takujitsu/resolution/rules.ts`の全17ルール（pending:false 15・
pending:true 2）と、スキーマに乗らず配列に含まれていない8ルール（No.1・
2・4b・4c・5・6・13a・15）を合わせて再分類した。

### 4.1 IMPLEMENTED（16、2026-09-09更新）

No.3・8・9a・9b・10・11・12・13b・13c・14・16・17・18・20・21・22
（前フェーズで神殺象意.pdf確認に基づき修正済みのNo.3・13b・13cに加え、
小耗解除条件確定・実装フェーズで追加したNo.22を含む。詳細は
`docs/takujitsu_xiaohao_fuyi_wuli_verification.md`13章）。

### 4.2 IMPLEMENTABLE_BUT_NOT_IMPLEMENTED（2）

| No. | 内容 | 実装に必要なこと |
|---|---|---|
| No.4c | 月破の徳合免疫日（特定の月令・日干支と一致する日は徳合併でも影響を受けない） | `resolve()`の入力（現状`ShinsatsuResult`のみ）にmonthBranch・dayGanzhiを渡す設計拡張が必要。 |
| No.15 | 五墓×月徳（月徳成立に加え、monthBranchが午または子であることが条件） | 同上、`resolve()`にmonthBranchを渡す設計拡張が必要。 |

いずれも「原典不足」ではなく「現在のresolve()の入力形状では判定に
必要な情報（月令・日干支）を受け取れない」という**エンジン入力設計の
制約**によるもの。

### 4.3 BLOCKED_BY_OCCURRENCE（1）

| No. | 内容 | 理由 |
|---|---|---|
| No.6 | 満日（天狗）の解除条件 | 対象のoccurrence detection自体が凶神第1グループで保留中（1.2節）。occurrenceが無い神殺の解除規則は実装できない。 |

### 4.4 UNRESOLVED（7）

| No. | 内容 | 神殺象意.pdf追加後の再確認結果 |
|---|---|---|
| No.1 | 歳徳合→全凶殺解除 | 神殺象意.pdfにも「全凶殺」を有限リスト化できる記述は無し。実例ベースのまま未解決。 |
| No.2 | 歳徳・歳徳合→月殺等 | 同上。 |
| No.4b | 月破の構造的例外（3通りの解釈） | 神殺象意.pdfの記述（4a、既に確定）はNo.4bの構造的例外の解釈を確定させるものではなかった。target×requires型のエンジンに当てはまらない構造という結論は変わらず。 |
| No.5 | 死神の「吉星が多ければ」 | 神殺象意.pdfの死神記載（EXCEPT型「餘事皆忌」）にも具体的な吉神名・閾値の言及は無し。未解決のまま。 |
| No.7 | 血支（「歳徳・(歳徳)合、月徳・(月徳)合、赦願など」の「など」） | 神殺象意.pdfの血支データ（LIST型忌リストのSAFE_ADD）にも、この「など」を確定させる解除条件テキストは含まれていなかった。未解決のまま。 |
| No.13a | 四撃〜五虚×土旺 | 「土旺」の定義自体が神殺象意.pdfにも見当たらず。未解決のまま。 |
| No.19 | 九空の「月建」条件の意味 | 神殺象意.pdfの九空データにもこの条件を明確化する記述は無し。未解決のまま。 |

**結論：神殺象意.pdf追加によって新たに解決できたのはNo.3・4a・13b分割
（前フェーズで実施済み）のみで、残る7件のUNRESOLVEDは今回の一次資料
追加でも解消しなかった。推測による解決は行っていない。**

**訂正（2026-09-09、小耗・復日・五離occurrence完成フェーズでの再確認）**：
前回report本文中「UNRESOLVED = 8」という記載は、本節の表が7件（No.1・2・
4b・5・7・13a・19）しか列挙していないことと矛盾していた。表・
`docs/takujitsu_progress.md`を確認した結果、これは前回の単純な集計
ミス（4.1〜4.4節の内訳を数え直すと15+2+1+7=25で、rules.ts配列内の
17ルール＋スキーマ外の8ルール＝25と一致する）であり、記載漏れの
ルールは無かった。正しい件数は**7件**。本ファイル・
`docs/takujitsu_progress.md`とも「8」の表記を「7」に修正した。

---

## 5. 十二建除残課題

`src/lib/takujitsu/jianchu.ts`（occurrence・JIANCHU_MEANINGS）は今回も
無変更。前フェーズでSAFE_ADD済みの7直（建・除・平・定・破・開・閉）は
`activityProfiles.ts`側で完了。残る5直の状況：

| 直 | 分類 | 内容 |
|---|---|---|
| 滿 | SOURCE_ONLY | 神殺象意.pdfに満日単独の宜忌記載が無い（天巫・福德とセットの記述のみで、既にkichijin側で実装済み）。追加データなし＝欠落ではない。 |
| 執 | **IMPLEMENTED**（2026-09-09実装済み） | 常時宜「捕捉」＋季節限定宜（霜降後立春前→畋獵、雨水後立夏前→取魚）を`ActivityProfile.seasonalRules`として実装。詳細は`docs/takujitsu_jianchu_seasonal_rules.md`。 |
| 危 | **IMPLEMENTED**（2026-09-09実装済み） | 常時宜「安床」＋季節限定宜（立冬後立春前→伐木、霜降後立春前→畋獵、雨水後立夏前→取魚）を実装。 |
| 收 | **IMPLEMENTED**（2026-09-09＋2026-09-10） | 常時宜（進人口・納財・捕捉・納畜）＋季節限定宜（執と同区間）を2026-09-09実装。「與『月恩』『四相』『時德』併，宜修倉庫」クロス条件（收 AND (月恩 OR 四相 OR 時徳) → 修倉庫、sourceType="jianchu"）も2026-09-10実装済み（`evaluateActivities()` 十二建除ブロック直後。`docs/takujitsu_jianchu_seasonal_rules.md` 末尾補足）。 |
| 成 | **IMPLEMENTED（2026-09-10、C案）** | 「CONFLICT」ではなく資料ごとの代表用事の差（直接の矛盾なし）と確定し、**C案（7語 union）で実装**：`activityProfiles.ts` の成 `favorableActivityIds` を `["婚姻","結婚","結納"]`（12建除.pdf p.7 ⑨成日 由来。従来「擇日テキスト.pdf由来」としていたのは不正確、本フェーズで訂正）→ **`["婚姻","結婚","結納","入学","移徒","築堤防","開市"]`**（神殺象意.pdf 成日「宜入學、移徙、築堤防、開市。」を原本6倍で確定し追加。移徙は id `移徒`）。**ALL型にしない**（12建除.pdf「全てに吉」は要約）。執・危・収の「12建除.pdf由来＋神殺象意.pdf由来を1配列に併記」の前例と統一。`jianchu.ts`・occurrence・`evaluateActivities`・天喜/天醫・滿 は無変更。SOURCE VALIDATION 不変、**APP EVALUATION 60.39%→61.98%（+1.59pp、MATCH +86）**（入学・築堤防・開市が擇日象意.pdf の成日記録＝57/45/52日 と独立に一致していたため。数値調整ではなく原典 union の副産物）。詳細は `docs/takujitsu_jianchu_cheng_conflict_analysis.md` 14章。 |

**結論（2026-09-09更新）：執・危・收の3直を季節条件込みで実装した
（CalendarEngine変更なし、`EvaluateActivitiesInput.solarTerm`という
任意項目の追加のみ）。滿は原典データなしで完成扱いのまま。成のみ
ユーザー判断が必要で、今回も未着手。十二建除の完成数：7直→10直。**

**結論（2026-09-10更新①）：收に「與月恩四相時德併宜修倉庫」クロス条件を
実装。成の CONFLICT は原典確定フェーズで「直接の矛盾は無い・C案推奨」まで
整理。**

**結論（2026-09-10更新②）：成を C案（7語 union）で本番実装。十二建除の
完成数 10直→11直（滿のみ未着手）。詳細は
`docs/takujitsu_jianchu_cheng_conflict_analysis.md` 14章。**

---

## 6. 二十八宿

`src/lib/takujitsu/shuku28.ts`（LODGE28_MEANINGS・宿値日ロジック）は
無変更。28宿すべてでoccurrence（sourceType:"shuku28"）とActivityProfile
エントリが1対1対応していることを確認済み（2章）。

空profile（favorable/unfavorableとも空）：**2宿**（牛・鬼）。両宿とも
`shuku28.ts`のmeaning自体が「【牛】「鬼」に告ぐ大吉日。正午付近を除き
全て大吉」「【鬼】二十八宿中で最大吉日。全てにおいて大吉」という
**個別の用事名を伴わない抽象的な吉日評価のみ**で、他のkichijin側の
義日・専日・要安等と同種の「原文に個別用事名が無い」ケースであり、
未調査の欠落ではない。

**結論：28宿とも完成（残課題なし）。**

---

## 7. ActivityDefinition

| 指標 | 件数 |
|---|---|
| 総数 | 256 |
| 用事便覧.pdf対応（現代語訳・説明あり） | 39 |
| 原語のみ（modernName/description未設定） | 217 |
| 未解決語（id・canonicalNameが確定していない語） | 0（全件id===canonicalNameで安定化済み） |

用事便覧との対応率：39/256（15.2%）。**ユーザー方針のとおり、この
217件（原語のみ表示）はエンジン完成のブロッカーではない**（重要度の
低い用事を無理に現代語訳しない、という既存方針を維持）。

---

## 8. activity evaluation完成度

`src/lib/takujitsu/activity/evaluateActivities.ts`を確認した結果、
以下すべてが統合済みであることを確認した：

| 機能 | 統合状況 |
|---|---|
| LIST型（宜・忌とも） | ✅ 統合済み |
| ALL型（positiveMode:"all_except"） | ✅ `resolveFavorableIds()`で統合済み |
| EXCEPT型（negativeMode:"all_except"） | ✅ `resolveUnfavorableIds()`で統合済み |
| resolution cancelled | ✅ 忌を反映しない（宜は維持） |
| resolution reduced（一般） | ✅ `unresolvedRestrictions`へ生テキスト保持 |
| resolution reduced（部分反映） | ✅ `reducedStillUnfavorableActivityIds`（現状は小時のみ） |
| resolution aggravated | ✅ 忌を反映しaggravated情報を保持 |
| resolution pending | ✅ 忌を反映しhasPendingSourceフラグを保持 |
| 十二建除 | ✅ 統合済み（favorableActivityIds/unfavorableActivityIds） |
| 二十八宿 | ✅ 統合済み（同上） |

**未接続の確定データは見つからなかった**。前フェーズのSAFE_ADD・
ALL型・EXCEPT型・reduced部分反映の実装内容は全て`evaluateActivities()`
から利用可能な状態になっている。

一方、**8章とは別に、9章で新たに判明した「月破と徳神の相互作用」は
未接続**（次章参照）。

---

## 9. 月破固有規則の現状確認

現在の実装：`negativeMode:"all_except"`（月破自身の忌スイープ）のみ。
resolution層にcancelルールは無い（No.4a、確定済み・意図的）。

原文（神殺象意.pdf、`docs/takujitsu_except_resolution_final.md`で
既に画像確認済み）：

> 「德神臨此失力，不能爲福，故即與『德合』併，猶忌」

これを文節ごとに読むと、

1. 「德神臨此失力」＝**徳神（天徳・月徳等）がここ（月破）に臨むと力を
   失う**
2. 「不能爲福」＝**（徳神が）福（＝宜・恩恵）を為すことができなくなる**
3. 「故即與『德合』併，猶忌」＝**それゆえ、徳合と併存しても（月破は）
   なお忌のままである**

**現在の実装は3.（月破自身が解除されない）のみを反映している。
1.・2.（月破成立日は、その日に共存する徳神自身の「宜を生む力」が
失われる＝徳神のALL型positive効果そのものが無効化される）は
未実装である。**

これは**一般的な「凶神が吉神に勝つ」というルールではなく、月破という
特定の神殺についてのみ原文が明記する固有規則**である（既存の11.節
「ALL型とEXCEPT型が同時成立時の優先関係」で確認したとおり、他の
EXCEPT型10凶神・ALL型6吉神の組み合わせ全般には適用しない）。

実装するとすれば、現在のActivityProfileのスキーマ（宜/忌の静的な
リスト・展開ルール）だけでは表現できず、「同日に成立している別の
神殺（月破）の存在によって、ある吉神（徳神）自身のpositiveModeを
無効化する」という**神殺間のクロス参照を扱う新しいメカニズム**が
必要になる（現在のActivityProfileは自分自身の宜/忌しか記述できず、
他の神殺の成立有無を参照する仕組みが無い）。**今回はコードを変更
しない（棚卸しのみ）。**

### 9.1 月破・徳神positive抑制（2026-09-10、原典確定 → 本番実装済み）

`docs/takujitsu_geppo_deity_suppression_analysis.md` で原典を確定し、
同フェーズで本番実装した（15章）。

- **「德神」の範囲**：神殺象意.pdfは月破段落で「德神」の内訳を明示せず
  （全7ページ通読、「德神」は月破の1箇所のみ）。擇日テキスト.pdf p.18の
  月破ローカル定義に依拠し **天徳・天徳合・月徳・月徳合・天赦・天願の
  6神**（＝ActivityProfileが`all_except`の6神）。**DEHE_GROUPとはB（一部
  一致）**：共通4、DEHE_GROUPのみ歳徳・歳徳合、月破側のみ天赦・天願。
  歳徳・歳徳合は月破の「德神」に**含めない**。
- **「失力／不能爲福」**：A＝**positiveの完全抑制**（reducedではない）。
  EXCEPT型11凶神のうち「德神臨此失力、不能爲福」という言い回しは月破
  だけが持つ特別表現。
- **影響試算（720行）**：月破成立60日、月破＋ALL型徳神20日。抑制すると
  mixed→bad が延べ2,660件（月破日が本来の「諸事皆忌」に戻る）、
  good→neutral が41件（例外11語で徳神が唯一の宜だったもの）。
  擇日象意.pdfとの一致率には影響なし（月破日はexpected宜が0）。
- **実装（済）**：`evaluateActivities()` の第1パスと pass1 スナップショット
  の間に「第1.5パス（月破 positive 抑制）」を挿入。`GEPPO_DEITY_SET`
  （6神）の `favorable && kichijin` contribution を除外し、
  `ActivityEvaluationResult.suppressions` に説明情報を保持。六黄道COMPOSITE
  （第2パス）は抑制済み `pass1` を見るため、抑制された徳神positiveを
  復活させない（テストJで検証）。resolution・月破occurrence・月破の
  negativeMode・徳神profile・raw occurrence は無変更。
- **実測**：SOURCE VALIDATION は 85.52%/68.10% で不変。APP EVALUATION
  60.47%→60.39%（−0.08pp。月破日の徳神positive抑制分。約4件は擇日象意.pdf
  と神殺象意.pdfの一次資料間の食い違い）。評価engine単体テスト 114→189。
  回帰（activity/resolution/occurrence/十二建除/二十八宿/CalendarEngine/
  qimen1080/tsc/Next build）は実装前と同結果。詳細は
  `docs/takujitsu_geppo_deity_suppression_analysis.md` 15章。

---

## 10. SOURCE VALIDATION（正式指標として固定）

- **測定条件**：擇日実例.pdf720行のground-truth吉神トークン
  （`tests/fixtures/jitsurei_720_tokenized.json`）を直接使用し、
  `tests/fixtures/shinsatsu_shogi_source_kichi.json`のfavorable/
  favorable_expanded（COMPOSITE型は除外）でraw union（忌との相殺なし）
  を計算し、擇日象意.pdf自身の34語彙（`tests/fixtures/zeyi_720_resolved.json`
  のexpectedCombined全体）と比較する。
- **現在値**：ALL型込み **MATCH 4,625 / SHOGI_ONLY 783 / 一致率85.52%**、
  LIST型のみ **MATCH 3,683 / SHOGI_ONLY 1,725 / 一致率68.10%**
  （`docs/takujitsu_720_metric_reconciliation.md`2章で再現確認済み）。
- **再現方法**：`tests/fixtures/gen_720_metric_reconciliation.ts`の
  「ステージA」ロジックをそのまま再実行する（`npx tsx
  tests/fixtures/gen_720_metric_reconciliation.ts`）。
- 2026-09-10の六黄道COMPOSITE本番実装後も **85.52%／68.10%で不変**
  （ステージAは`shinsatsu_shogi_source_kichi.json`を使い、六黄道6神は
  もともと`favorable:["COMPOSITE"]`としてraw unionから除外されている）。

---

## 11. APP EVALUATION（現在状態）

ActivityDefinition全256語空間で、最終アプリ（神殺＋resolution＋
十二建除＋二十八宿、verdict==="good"）が擇日象意.pdfの記載をどこまで
再現するかを測る指標。値の変遷（`gen_720_metric_reconciliation.ts` の
E verdict）：

- 十二建除 執・危・収 季節条件反映後：MATCH 3,270 / SHOGI_ONLY 2,138 /
  **60.47%**
- 六黄道COMPOSITE本番実装後（2026-09-10）：**60.47% / MATCH 3,270 で不変**
  （第2パスは既にその極性を持つ用事に六黄道神のsourceを足すだけで
  verdictを動かさない）
- 月破・徳神positive抑制 本番実装後（2026-09-10）：MATCH 3,266 /
  LOGIC_ONLY 31,436 / SHOGI_ONLY 2,142 / **60.39%**（−0.08pp）。月破日に
  抑制された徳神positiveが verdict から消えた分。MATCH −4 は擇日象意.pdf
  と神殺象意.pdfが特定日で食い違う箇所（実装のバグではない）。
- 十二建除「収」× 月恩／四相／時徳 → 修倉庫 クロス条件 実装後（2026-09-10）：
  MATCH 3,266 / SHOGI_ONLY 2,142 / **60.39% で不変**（LOGIC_ONLY 31,436→
  31,438）。収 × (月恩/四相/時徳) は16日成立して修倉庫positiveを生むが、
  そのうち擇日象意.pdf が修倉庫を宜とする5日は既に別sourceで good/mixed
  だったため MATCH は動かない。
- 十二建除「成」C案（7語 union）実装後（2026-09-10）：MATCH **3,352
  （+86）** / LOGIC_ONLY 31,463 / SHOGI_ONLY **2,056（−86）** /
  **61.98%（+1.59pp）**。成の追加4語のうち 入学・築堤防・開市 が
  擇日象意.pdf の34語彙に含まれ、成日60日で 57／45／52 日で宜とされて
  いた（神殺象意.pdf の成日リストを擇日象意.pdf が独立に裏づけていた分。
  一致率のためのリスト調整ではなく原典 union の副産物）。

**この指標は擇日象意.pdfとの一致率をエンジン完成の判定基準にしない**
（ユーザー方針どおり）。擇日象意.pdfは【憲宜】【協紀】という2つの
歴史的資料由来の宜専用データであり、ActivityDefinition256語のうち
擇日象意.pdfが扱わない語（220語超）についてアプリが下す判定は、
そもそも擇日象意.pdf側で検証しようがない（`docs/takujitsu_720_metric_reconciliation.md`
13章で確定した方針）。

---

## 12. 完成BLOCKERの分類

### A：完成前に必ず必要
- なし。現在確認できた範囲では、A相当（無ければ致命的に不正な結果を
  返す）の課題は見つからなかった。既存の23件の空profile・resolutionの
  UNRESOLVED 7件は、いずれも「宜/忌ともに空」
  「resolutionが働かず常にactiveのまま」という**保守的（何もしない）
  な既定動作**であり、誤った宜/忌を積極的に返すものではない。

### B：できれば完成前に実装
- ~~十二建除「執・危・收」の季節条件反映~~（実装済み、
  `docs/takujitsu_jianchu_seasonal_rules.md`）。
- resolution No.4c・No.15（4.2節。`resolve()`入力拡張が必要）。
- ~~月破の徳神positive抑制~~（9.1章。実装済み 2026-09-10
  `docs/takujitsu_geppo_deity_suppression_analysis.md` 15章。
  `evaluateActivities()`に第1.5パスを挿入。「德神」＝天徳・天徳合・月徳・
  月徳合・天赦・天願の6神、positive完全抑制。SOURCE VALIDATION不変、
  APP EVALUATION 60.47%→60.39%）。
- ~~COMPOSITE型6神の原文再確認・本番実装~~（実装済み 2026-09-10、
  `docs/takujitsu_liuhuangdao_composite_analysis.md`14章。5神を
  `composite:true`化＋evaluateActivities()の2パス化。金匱はLIST型のまま。
  6神とも家族会議・遠行は保持。指標は実装前後で完全に同一）。
- ~~小耗のoccurrence実装~~（実装済み、
  `docs/takujitsu_xiaohao_fuyi_wuli_verification.md`）。復日・五離は
  原典に成立条件の記述が無く、引き続きDEFERRED。
- 小耗の解除条件実装（実装済み、resolution No.22、
  `docs/takujitsu_xiaohao_fuyi_wuli_verification.md`13章）。

### C：原典不足のため保留可能
- resolution No.1・2・5・7・13a・19（4.4節）。
- 十二建除「滿」（5章）。
- 空profile 23件（2026-09-10監査で分類済み、上記表参照）：
  IMPLEMENTABLE 1件（歸忌→移徒。次フェーズで実装可）、
  SOURCE_ONLY_EMPTY 19件（原典に用途記述なし＝欠落ではない、空のまま維持）、
  AMBIGUOUS_LAYOUT 1件（四方耗。高精度スキャン＋座標抽出待ち）、
  DEFERRED 2件（兵禁・大煞。分離不可＋著者否定）。
- 満日（天狗）・伏社（UNRESOLVED、1.2節）。
- 山痕・田痕・水痕・金痕・土痕・土公占・驚走殺（1.2節）。

### D：将来拡張
- 朔弦望十五日・真滅没密日（月相角度APIが必要、astro.tsの拡張が
  前提）。
- 顕星・曲星・傅星・反支日・土忌等（原本での存在確認が前提）。
- ActivityDefinitionの現代語訳拡充（217→更に多く。ユーザー方針上、
  優先度は低い）。
- resolution No.4b（構造的にエンジンの形に当てはまらないため、
  エンジン自体の設計変更が前提）。

**「全部実装しないと完成ではない」とは考えない。C・Dは保留のまま
完成扱いにできる。**

---

## 13. UIに必要な出力の確認

`calculateTakujitsu()`の戻り値（`TakujitsuResult`）を確認した結果：

```ts
interface TakujitsuResult {
  shinsatsu: ShinsatsuResult;      // 吉神・凶神の生occurrence結果
  buildingDay: JianchuResult;      // 十二建除
  shuku28?: Shuku28Info;           // 二十八宿
  resolution: ResolvedShinsatsuResult; // 解除・相殺・増悪適用後
}
```

**確認できた不足点（2件）**：

1. **暦情報（年月日干支・農暦・二十四節気等）が`TakujitsuResult`に
   含まれていない**。`calculateTakujitsu()`は内部で`calculateCalendar()`
   を呼んでいるが、その結果（`CalendarResult`＝dayStem/dayBranch/
   monthBranch/lunarMonth/solarTerm等）を戻り値に含めていない。UI側は
   `calculateCalendar()`（または`calculate()`）を**別途もう一度**
   呼び出す必要がある。
2. **`evaluateActivities()`の結果（用事判定）が`calculateTakujitsu()`
   に統合されていない**。UI側は`calculateTakujitsu()`の戻り値から
   `{resolution, buildingDay, shuku28}`を取り出し、**別途
   `evaluateActivities()`を呼び出す**必要がある。

いずれも「呼び出せない」わけではなく、**UI層で2〜3回の関数呼び出しを
組み合わせる必要がある**という状態（今回はUI自体を作らないため、
この2点は次フェーズでの検討事項として記録するに留める）。

---

## 14. コード変更

なし（`src`以下は無変更）。既存の`npx tsc --noEmit`・
`npx next build`・全`tests/*.manual.ts`を再実行し、現状（前フェーズ
終了時点）から変化が無いことのみ確認した。

---

## 15. docs

新規：本ファイル（`docs/takujitsu_completion_audit.md`）。
`docs/takujitsu_progress.md`に現在の完成度サマリを追記した。
