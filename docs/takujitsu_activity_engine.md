# 擇日 用途判定engine 第1フェーズ 設計・実装ドキュメント

最終更新：2026-09-09（初版。用途判定engine 第1フェーズ実装完了）

---

## 0. 位置づけ

本ドキュメントは「用途判定engine 第1フェーズ」（その日に成立している
吉神・凶神・十二建除・二十八宿の象意から、各用事について宜/忌の根拠を
集約するレイヤー）の設計・実装をまとめたものである。

唯一の仕様根拠：

- `docs/takujitsu_activity_rules.md`（吉神44・凶神53・十二建除12・
  二十八宿28の宜/忌棚卸し）
- `docs/takujitsu_resolution_rules.md`（凶神の解除・相殺・増悪ルール）

既存コードは一切変更していない（CalendarEngine・吉神/凶神occurrence
ロジック・resolutionルール・jianchu成立ロジック・shuku28宿値日ロジック）。

**【最終アプリ仕様として確定、2026-09-09】** 最終的な吉用事・凶用事判定
では、神殺（吉神・凶神）・十二建除・二十八宿の**3系統すべての象意を
必ず加味する**。`evaluateActivities()`は既にこの3系統を統合した設計
になっている（3章・6章）。`docs/takujitsu_jitsurei_shogi_analysis.md`・
`docs/takujitsu_720_generation_analysis.md`で十二建除・二十八宿を比較
対象から除外しているのは、擇日実例.pdf→擇日象意.pdfという神殺象意単独の
生成構造を切り分けて検証するための一時的な措置であり、**最終engineから
十二建除・二十八宿を外す判断ではない**。
本フェーズで追加したのは `src/lib/takujitsu/activity/` 配下の新規モジュール
のみ。

---

## 1. モジュール構成

```
src/lib/takujitsu/activity/
  types.ts               … ActivityDefinition / ActivityProfile / ActivityEvaluation 等の型
  activityDefinitions.ts … 用事辞書（242件）
  activityProfiles.ts    … 象意プロファイル（174件）＋ getActivityProfile()
  evaluateActivities.ts  … 用途判定engine本体（evaluateActivities()）
  index.ts                … 公開窓口
```

```
docs/takujitsu_activity_rules.md（宜/忌棚卸し。5章・6章・3章・4章）
        │ 手動接続（推測しない。原典から確定できた語だけ）
        ▼
activityProfiles.ts（sourceType×sourceName → favorable/unfavorable ids）
        │
        ▼
evaluateActivities(resolution, buildingDay, shuku28)
        │
        ▼
ActivityEvaluation[]（活動ごとのpositiveSources/negativeSources/verdict）
+ UnresolvedActivityRestriction[]（No.10等、具体的用事へ未マッピングの残存忌）
```

---

## 2. ActivityProfile（象意プロファイル）

`sourceType`（`"kichijin" | "kyojin" | "jianchu" | "shuku28"`）と
`sourceName`（occurrence detectionコードが実際に使う文字列と完全一致）の
組で1件。`favorableActivityIds` / `unfavorableActivityIds` は
`ActivityDefinition.id` の配列。

- 吉神69件・凶神65件は、`src/lib/takujitsu/shinsatsu/*.ts` が
  `kichijin[]`/`kyojin[]` に積む全occurrence名と過不足なく1対1で対応する
  （単体テストで検証済み）。
- 「吉神だから全用事に宜」「凶神だから全用事に忌」という一般化は行って
  いない。`docs/takujitsu_activity_rules.md`で本文から確定できた宜/忌
  だけをコード化し、確認できなかった項目は空配列＋`notes`にした
  （劫殺・災殺・月殺の「象意：」形式による帰属不明、兵禁/大煞・
  土符/地嚢の表構造上の帰属不明、月害・遊禍・歸忌・往亡・九焦・八風・
  大空亡・小空亡・揚公忌・四方耗・長星・短星・埋兒凶宿の「本文に忌記載
  が見当たらず」等）。
- 凶神でも明示的な宜がある例（月厭＝祈福、天乙絶気＝埋坑/作厠/安碓磑）は
  `favorableActivityIds`に反映した。吉神でも明示的な忌がある例
  （天徳＝結婚式/造作を忌む）は`unfavorableActivityIds`に反映した。

---

## 3. resolution適用方針（凶神のみ）

`evaluateActivities()`は凶神について raw occurrence ではなく、
`resolution`（`ResolvedShinsatsuResult`）の`status`を見て次のように扱う。
吉神・十二建除・二十八宿はresolutionの対象外（`resolutionStatus`は常に
`undefined`）。

| status | 忌の扱い | sourceの情報 |
|---|---|---|
| `active` | 通常どおり反映 | `resolutionStatus: "active"` |
| `cancelled` | 反映しない（negativeSourcesに入らない） | ― |
| `aggravated` | 反映し、増悪情報を保持 | `resolutionStatus: "aggravated"`、`note`にルールの`reason` |
| `reduced` | ActivityProfileにマッピング済みの忌は反映しない | `unresolvedRestrictions`側へ`reason`をそのまま保持（下記4章） |
| `pending` | 勝手に解除せず、忌をそのまま反映 | `resolutionStatus: "pending"`。集約結果の`hasPendingSource`にも反映 |

宜（favorable）はresolutionのcancel/reduceの対象外（凶意の解除・軽減は
忌にのみ関係する）として、statusに関わらず常に反映する。現時点で
favorableを持つ凶神（月厭・天乙絶気）はいずれもresolutionルールの
targetsに含まれないため、この扱いによる実害はない。

---

## 4. No.10（大時・天吏）の特殊対応

`docs/takujitsu_resolution_rules.md`ルールNo.10は「徳合・天赦にて解除
するが、攻めであるビジネスは凶のまま」という用途限定の残存忌を持つ。
この「攻めのビジネス」に対応する`ActivityDefinition`は現時点で存在しない
（前フェーズの調査で、擇日象意.pdf・用事便覧.pdfのどちらの語彙にも
見つからなかったことを確認済み）。

このため、`status === "reduced"`のエントリは、マッピング済みの忌
（大時・天吏の場合：出軍・増改築・會親友・臨官・赴任・遠行・訴訟）を
反映しない一方、対応する`ResolutionRule`の`note`（`entry.reason`）を
`UnresolvedActivityRestriction`として別途保持する。

```ts
interface UnresolvedActivityRestriction {
  sourceType: ActivitySourceType;
  sourceName: string;
  resolutionStatus: ResolutionStatusLike; // 常に "reduced"
  description: string; // ResolvedShinsatsuEntry.reason をそのまま保持
}
```

具体的な用事への対応が将来確定した場合、`activityProfiles.ts`の
大時・天吏プロファイルに個別のreduced用フィールドを追加するか、
`ActivityDefinition`に該当語を追加したうえでこの仕組みを置き換える
想定（今回は勝手にマッピングしない）。

---

## 5. verdictの仕様

```ts
type ActivityVerdict = "good" | "bad" | "mixed" | "neutral";
```

| positiveSources | negativeSources | verdict |
|---|---|---|
| 非空 | 空 | good |
| 空 | 非空 | bad |
| 非空 | 非空 | mixed |
| 空 | 空 | neutral（evaluateActivities()の実際の出力には現れない。1件も出典が無い活動は評価結果に含めないため） |

**件数による多数決はしない**。`positiveSources`が1件、`negativeSources`が
5件でも`verdict`は`mixed`のまま（`bad`にはならない）。単体テスト14で
明示的に検証済み。

`pending`はverdictの値にせず、`hasPendingSource: boolean`という独立
フラグで保持する。pendingな凶神のstatusを理由に、確定した宜/忌の事実
分類（good/bad/mixed/neutral）を上書きしないためである。

---

## 6. calculateTakujitsu()との統合について

`calculateTakujitsu()`の戻り値（`shinsatsu`・`buildingDay`・`shuku28`・
`resolution`）は一切変更していない。`evaluateActivities()`はこれらを
引数として受け取る独立関数として実装した（`resolution`・`buildingDay`・
`shuku28`をそのまま渡せる）。

```ts
const result = calculateTakujitsu(input);
const activity = evaluateActivities({
  resolution: result.resolution,
  buildingDay: result.buildingDay,
  shuku28: result.shuku28,
});
```

`calculateTakujitsu()`の戻り値に`activityEvaluation`フィールドを追加する
統合は今回行っていない（既存の`TakujitsuResult`型を変更すると呼び出し側
への影響検討が必要なため。resolution統合時と同じ判断）。将来必要になれば
追加する。

---

## 7. 今回作らなかったもの（意図的なスコープ外）

- 独自の総合吉凶ルール・優先順位・点数化・ランキング
- 擇日象意.pdf 720行との本格照合（擇日象意.pdfは答え合わせ資料。
  今回のロジックの仕様としては使っていない）
- 用途カテゴリ（求財・求官・婚姻・出産・動土・建築・移転・開店・契約・
  旅行・医療・訴訟・葬祭等）への活動の分類・表示
- カレンダーUI、目的から最良日を検索する機能

---

## 8. 既知の保留・限界

- ActivityProfileが空配列の項目（劫殺・災殺・月殺、兵禁・大煞、土符の
  地嚢側、月害・遊禍・歸忌・往亡・九焦・八風・大空亡・小空亡・揚公忌・
  四方耗・長星・短星・埋兒凶宿）は、その神殺が成立していても
  evaluateActivities()の出力に一切寄与しない（推測で埋めていないため）。
  将来、原本画像・座標抽出で表構造の帰属が確定すれば追加する。
- No.10大時・天吏の「攻めのビジネス」対応語は7章のとおり未確定。
- 十二建除・二十八宿のActivityProfileは、`JIANCHU_MEANINGS`/
  `LODGE28_MEANINGS`（自由文の説明）から辞書と完全一致する語だけを
  抽出しているため、吉神・凶神と比べて網羅性が低い（例：定「出かける、
  引越しは凶」から抽出できたのは"出かける"/"引越し"のみ）。

---

## 9. テスト

- `tests/takujitsu_activity_definitions_unit.manual.ts`（717アサーション）：
  用事辞書の総件数・id重複なし・用事便覧対応件数・非対応語のmodernName
  未設定などを検証。
- `tests/takujitsu_evaluate_activities_unit.manual.ts`（36アサーション）：
  verdict4分類、resolution各status（active/cancelled/aggravated/reduced/
  pending）の扱い、吉神の忌・凶神の宜、十二建除・二十八宿の反映、
  複数sourceの保持、件数による多数決をしないこと、
  ActivityDefinition不在idが0件であること、No.10の
  unresolvedActivityRestrictionを検証。

両ファイルとも `npx tsx <ファイル>` で実行し、全件PASSを確認済み
（`npx tsc --noEmit`・`npx next build`も含め、既存の回帰テスト26ファイル
すべてPASS。lunisolar_unit.manual.tsの既知の6件差異は本フェーズと無関係
の既存の未解決事項）。

---

# 詳細神殺象意・確定ルール 本番反映フェーズ（2026-09-09）

`docs/source/神殺象意.pdf`（『擇日秘本萬年通書』日家神殺宜忌）の原本
画像確認で確定した内容だけを本番コードへ反映した（推測・相関のみの
規則は実装していない）。

## ActivityProfile型の拡張

`src/lib/takujitsu/activity/types.ts` に以下を追加（既存フィールドは
全て後方互換、既存のLIST型プロファイルの挙動は変えていない）：

- `positiveMode?: "list" | "all_except"` / `positiveExceptionActivityIds?: string[]`
- `negativeMode?: "list" | "all_except"` / `exceptionActivityIds?: string[]`
- `reducedStillUnfavorableActivityIds?: string[]`

## all_exceptの評価ロジック

`evaluateActivities.ts` に `resolveFavorableIds()` / `resolveUnfavorableIds()`
を追加。`positiveMode`/`negativeMode`が`"all_except"`の場合、
`ACTIVITY_BY_ID`全件からexceptionを除いた集合を実効的な宜/忌集合として
使う。exceptionは「不忌」であり「宜」ではないため、positive側の計算には
一切影響しない（resolveFavorableIdsとresolveUnfavorableIdsは完全に独立）。

`reducedStillUnfavorableActivityIds`が設定されている凶神は、
resolutionが`"reduced"`のとき、この配列（かつ元のunfavorable集合に
含まれるもの）だけを忌として反映する（例：小時＝修造動土・伐木）。
指定が無い凶神は従来どおり、reduced時は忌を反映せず
unresolvedRestrictionsに生テキストを保持する（No.10大時・天吏）。

## 実装した構造

- ALL型（6吉神）：天徳・月徳・天徳合・月徳合・天赦（例外＝畋獵・取魚）、
  天願（例外なし、原文に明記が無いため推測で補わない）。
- EXCEPT型（11凶神）：月破・死神・劫殺・災殺・月殺・月刑・月厭・四廢・
  上朔・四離・四絶。
- 小時のreducedStillUnfavorableActivityIds＝修造動土・伐木。

詳細は `docs/takujitsu_except_resolution_final.md` の実装結果セクションを
参照。

`tests/takujitsu_evaluate_activities_unit.manual.ts` にALL型・EXCEPT型・
reduced部分反映・凶神favorableとall_exceptの共存（mixed）の単体テストを
追加した（48アサーション、全PASS）。

---

## 補足（2026-09-09、720検証低下・俱不取構造 原因特定フェーズ）

`positiveMode:"all_except"`（ALL型6吉神）は、ActivityDefinition全256語
からexceptionを除いた集合を宜として展開する（`resolveFavorableIds()`）。
これは実装上正しい（`docs/takujitsu_except_resolution_final.md`5章の
確定文言どおり）が、擇日象意.pdf自身の固有語彙（34語）と比較する検証
スクリプトでは、この256語全体がLOGIC_ONLYの主要な発生源として観測される
（`docs/takujitsu_720_metric_reconciliation.md`4〜5章）。これは検証方法
（比較の射影範囲）に起因するものであり、engine自体の不具合ではない。

---

## 補足（2026-09-09、十二建除 執・危・収 季節条件完成フェーズ）

`ActivityProfile`に`seasonalRules?: ActivitySeasonalRule[]`を追加し、
`EvaluateActivitiesInput`に`solarTerm?: string`（任意項目、既存呼び出し
との後方互換を維持）を追加した。十二建除（jianchu）の評価ブロックで、
`input.solarTerm`が`rule.solarTerms`に含まれるときだけ季節限定の宜/忌を
追加反映する。通常宜忌とは独立集計で、優先順位・上書きは作っていない
（競合すれば既存の仕組みのままmixedになる）。詳細は
`docs/takujitsu_jianchu_seasonal_rules.md`参照。

---

## 補足（2026-09-10、六黄道COMPOSITE 本番実装フェーズ）

### 型の追加

`ActivityProfile`に`composite?: boolean`（任意項目）を追加した。過剰な
汎用ルールエンジンは作らず、「この吉神は同日に成立している他の神殺の
宜忌に従う」という識別フラグ1つに留めた。既存フィールド
（favorableActivityIds/unfavorableActivityIds/positiveMode/negativeMode）
は変更していない。

`composite: true`を立てたのは神殺象意.pdfが六黄道日として列挙する5神
（青龍・明堂・寶光・玉堂・司命）のみ。金匱は原文の列挙に含まれないため
立てていない（`docs/takujitsu_liuhuangdao_composite_analysis.md`2章）。
5神の既存LIST型データ（家族会議・遠行。擇日テキスト.pdf p.15由来）は
置換せず保持する（ユーザー判断、2026-09-10）。金匱もLIST型のまま
（家族会議・遠行）。

### 2パス評価

`evaluateActivities()`を2パス化した。

- **第1パス**（従来どおり）：吉神・凶神（resolution適用後）・十二建除・
  二十八宿から`RawContribution[]`を積み、各用事のpositive/negativeを
  確定する。COMPOSITE型の5神も第1パスでは他の吉神と同様にLIST型
  （家族会議・遠行）として評価される。
- **第2パス**（今回追加）：第1パスのスナップショット（`pass1`）を走査し、
  成立しているCOMPOSITE型の吉神ごとに、
  - **kichijin由来positive**（「與吉神併，則從所宜」）
  - **kyojin由来negative**（「與凶神併，則從所忌」）

  だけを、そのCOMPOSITE型神自身のsourceとして追加する。

参照範囲の限定（原典に無い挙動を作らないため）：

| 参照対象 | 追従するか |
|---|---|
| 吉神(kichijin)由来positive | ○ |
| 凶神(kyojin)由来negative（resolution適用後の有効な忌のみ） | ○ |
| 吉神由来negative（生氣の忌など） | × |
| 凶神由来positive（月厭の祈福・天乙絶気の埋坑など） | × |
| 十二建除(jianchu)の宜忌 | × |
| 二十八宿(shuku28)の宜忌 | × |
| 他のCOMPOSITE型神の宜忌 | ×（再帰コピー防止） |

- **resolution後を参照**：kyojin由来negativeは第1パスの時点で既に
  resolution適用後（cancelled=0件、reduced=reducedStillUnfavorable
  ActivityIdsのみ）。したがってcancelledの忌をCOMPOSITEが復活させる
  ことはない。
- **再帰なし**：第2パスは`pass1`スナップショットだけを走査し、第2パスで
  push したcontributionは再走査しない。かつ参照元が`composite`プロファイル
  のkichijinなら明示的にskipする。二重の防御でCOMPOSITE連鎖は起きない。
- **COMPOSITE単独成立**：他の吉神・凶神からその用事への宜忌が第1パスに
  無ければ、第2パスは何も追加しない（ActivityDefinition全256語をgoodに
  しない。ALL型ではない）。
- **二重加点なし**：同じ(用事, 宜/忌)にそのCOMPOSITE型神のsourceを複数
  積まない（元のLIST型で既にある分・複数の参照元がある分とも1件に集約）。
  そもそもverdictはsource件数ではなく有無で決まるため、判定への影響は
  設計上ゼロ。
- **source追跡**：追加するsourceは`sourceName`=六黄道神名、`note`=
  「吉神「〇〇」の宜に従う」/「凶神「〇〇」の忌に従う」。既存
  `ActivitySource`型は変更していない。
- **吉凶同時成立**：同じ用事に有効な吉神positiveと凶神negativeが両方
  ある場合、COMPOSITE神も両方に積まれ、既存`computeVerdict()`がそのまま
  `mixed`を返す（原典に無い優先順位を追加しない）。

### 指標への影響

第2パスは「既にその極性を持つ用事」にsourceを追加するだけで、新しい
用事のpositive/negativeを生まない（追従元が既にその用事のsourceに
なっている）。したがって`rawSet`（positive有無）・`verdictSet`
（verdict==="good"）は理論上不変であり、実測でも
`tests/fixtures/gen_720_metric_reconciliation.ts`のSOURCE VALIDATION
（85.52%/68.10%）・APP EVALUATION（E verdict 60.47%、MATCH 3270）とも
実装前後で完全に同一。変化したのは診断出力の「LOGIC_ONLY発生源
ランキング」に六黄道5神が追従元として表示されるようになった点のみ。

---

## 補足（2026-09-10、月破・徳神positive抑制 本番実装フェーズ）

### 第1.5パスの追加

`evaluateActivities()` に「第1.5パス（月破による徳神positive抑制）」を
挿入した。実行順序：

```
第1パス（吉神/凶神/十二建除/二十八宿から all を構築）
  ↓
第1.5パス（月破 positive 抑制）← 新規
  ↓
pass1 = all.slice()（スナップショット）
  ↓
第2パス（六黄道COMPOSITE。pass1＝抑制後を走査）
  ↓
グルーピング → verdict
```

### 規則

神殺象意.pdf 月破「德神臨此失力、不能爲福、故即與德合併、猶忌」。
`input.resolution.kyojin` に月破が `status!=="cancelled"` で存在する日は、
`all` から次の contribution を除外する：

- `favorable === true`
- `source.sourceType === "kichijin"`
- `source.sourceName ∈ GEPPO_DEITY_SET`

```
GEPPO_DEITY_SET = 天徳・天徳合・月徳・月徳合・天赦・天願
```

`resolution/rules.ts` の `DEHE_GROUP`（歳徳・歳徳合を含み天赦・天願を
含まない）は**流用しない**（月破の「德神」とは分類B＝一部一致。
`docs/takujitsu_geppo_deity_suppression_analysis.md` 3章）。歳徳・歳徳合・
三合・時徳など他の吉神は抑制しない。

### 型

`ActivitySuppression` を新規追加、`ActivityEvaluationResult` に
`suppressions: ActivitySuppression[]` を追加（`ActivitySource` は無変更）。
何が・何によって・なぜ抑制されたか、どの用事idが対象かを保持し、UIで
「天徳（月破により失力）」と説明できるようにする。raw occurrence
（`ShinsatsuResult.kichijin`）からは天徳等を削除しない（二層構造）。

### 変更していないもの

月破の `negativeMode:"all_except"`・exceptionActivityIds（11語）、徳神6神の
`positiveMode:"all_except"`、`resolution/rules.ts`（月破 cancel ルールなし）、
`kyoushinGroup1.ts`（月破 occurrence）。

### 指標への影響

- SOURCE VALIDATION（ステージA）：**85.52%/68.10% で不変**
  （ステージAは `evaluateActivities` を通さず ground-truth トークン＋
  fixture の raw union で計算するため、第1.5パスの抑制を見ない）。
- APP EVALUATION（E verdict）：60.47% → **60.39%**（MATCH 3,270→3,266、
  −0.08pp）。月破日に抑制された徳神positiveが verdict から消えた分。
  MATCH −4 は擇日象意.pdf（憲書／協紀）と神殺象意.pdf（象吉通書系）が
  特定日で食い違う箇所であり、実装のバグではない。
- 720行実測：月破60日／月破＋対象6神20日、抑制positive延べ6,104、
  mixed→bad 4,473、good→neutral 62（`gen_geppo_deity_suppression.ts`）。

---

## 補足（2026-09-10、十二建除「収」× 月恩／四相／時徳 → 修倉庫 クロス条件）

### 評価順序

```
第1パス（吉神/凶神/十二建除通常宜忌/十二建除季節宜）
  ↓
十二建除「収」クロス条件（新規。十二建除ブロック直後）
  ↓
第1.5パス（月破 positive 抑制）
  ↓
pass1 = all.slice()
  ↓
第2パス（六黄道COMPOSITE）
  ↓
グルーピング → verdict
```

### 規則

神殺象意.pdf 収日「與『月恩』『四相』『時德』併，宜修倉庫」。
`input.buildingDay.name === "収"` かつ `input.resolution.kichijin` に
**月恩・四相・時徳のいずれか**があれば、
`{ activityId:"修倉庫", favorable:true, source:{ sourceType:"jianchu",
sourceName:"収", note:"<成立した吉神名>と併して宜" } }` を **1件だけ**
`all` に積む（`収 AND (月恩 OR 四相 OR 時徳)`）。

- **AND/OR**：OR。原文「與 A B C 併」に共起マーカーが無い
  （`docs/takujitsu_resolution_rules.md` 1.4節の判断基準）。月建（小時）の
  同一構文を `anyOf` で扱う既存 resolution No.4 と一致させた。
- **sourceType は "jianchu"**：十二建除「収」の条件付き宜であって、月恩・
  四相・時徳自身の宜ではない。よって：
  - 六黄道COMPOSITE（第2パス。kichijin由来positiveのみ追従）は
    この修倉庫positiveを**追従しない**。
  - 月破の徳神positive抑制（第1.5パス。`source.sourceType === "kichijin"`
    が対象）の**対象外**。月破が同日に修倉庫を忌にすれば
    positive(収クロス)＋negative(月破) で mixed（優先順位を付けない）。
- **通常LISTに入れない**：「修倉庫」は収の `favorableActivityIds` にも、
  月恩・四相・時徳の各 ActivityProfile にも入れない（収単独では宜に
  ならないため、クロス条件としてのみ生成）。
- **二重加点しない**：複数の吉神が揃っても収 source は1件、note に
  「月恩・四相・時徳と併して宜」のように列挙。

### 変更していないもの

十二建除12直の occurrence（`jianchu.ts`）、月恩・四相・時徳の occurrence
（`kichijin*.ts`）、収の常時宜（進人口・納財・捕捉・納畜）・季節宜
（畋獵・取魚 の `seasonalRules`）、`ActivityProfile` の全データ
（収の `notes` 文言のみ「実装済み」に更新）。

### 指標への影響

- SOURCE VALIDATION：85.52%/68.10% で不変（ステージAは `evaluateActivities`
  を通さず、かつ十二建除を参照しない）。
- APP EVALUATION（E verdict）：**60.39% で不変**（MATCH 3,266 / SHOGI_ONLY
  2,142 とも不変。LOGIC_ONLY 31,436→31,438、生成延べ +11）。720行で収 ×
  (月恩/四相/時徳) は16日成立し修倉庫positiveを生むが、その16日は
  擇日象意.pdf が「修倉庫」を宜とする日と1件も重ならないため一致率は
  動かない（`gen_shu_xiu_cangku.ts`）。一致率のためのルール調整はしない。

---

## 補足（2026-09-10、十二建除「成」C案）

`activityProfiles.ts` の成プロファイルのみ変更（`evaluateActivities` は
無変更）。成は通常の `sourceType:"jianchu"` LIST 型 positive source として
処理される：

- `favorableActivityIds:["婚姻","結婚","結納","入学","移徒","築堤防","開市"]`
  （12建除.pdf ⑨＋神殺象意.pdf 成日の union。C案。ALL型ではない）。
- 月破の徳神positive抑制（第1.5パス）の対象外（`sourceType==="kichijin"`
  のみが対象）。月破 all_except の negative と同用事なら `mixed`。
- 六黄道COMPOSITE（第2パス）の追従対象外（`sourceType==="kichijin"` の
  positive のみ追従）。青龍等が成の7語を追従・復活させない。
- 特別クロス条件は追加しない（成日に「與〇〇併」条件は原文に無い）。

指標：SOURCE VALIDATION 不変（85.52%/68.10%）。APP EVALUATION
60.39%→61.98%（+1.59pp、MATCH +86 / SHOGI_ONLY −86）。入学・築堤防・開市が
擇日象意.pdf の34語彙に含まれ、成日60日で 57／45／52 日で宜とされている
ため（神殺象意.pdf の独立裏づけ。詳細は
`docs/takujitsu_jianchu_cheng_conflict_analysis.md` 14章）。

### 補助診断スクリプトの zeyi 参照バグ訂正

`tests/fixtures/gen_cheng_conflict.ts` / `gen_shu_xiu_cangku.ts` /
`gen_geppo_deity_suppression.ts` の zeyi 参照を `zeyi[row.monthLabel]`
（常に undefined）→ `zeyi[\`${monthLabel}|${ganzhi}\`]` に修正した。
正規の `gen_720_metric_reconciliation.ts` は元々正しいキーで、
各フェーズの APP EVALUATION 数値・結論は正しかった（月破 −0.08pp、
収 ±0、成 +1.59pp はいずれも正規スクリプトの実測）。

---

## 補足（2026-09-10、擇日UI 第2フェーズ ― カテゴリ分類・full.ts）

### カテゴリ分類は「判定ロジックではなく UI メタデータ」

`src/lib/takujitsu/activity/activityCategories.ts` を新規追加。
ActivityDefinition 256語を「現代の利用目的」15カテゴリ
（婚姻・縁組／妊娠・出産・子供／引越し・移転／建築・工事／土地・不動産／
開業・商売／契約・取引・財／就職・仕事／学業／旅行・外出／医療・健康／
祭祀・祈願／葬祭・墓／農業・畜産／その他）へ割り当てる。

- **`evaluateActivities()` / `ActivityProfile` / occurrence / resolution は
  このファイルを import しない。参照もしない。** 吉凶判定は一切変わらない。
  カテゴリは `/takujitsu` ページのフィルタ・検索のためだけの付加情報。
- 分類は既存 ActivityDefinition（canonicalName / modernName / description、
  用事便覧由来）から**意味が明確に判断できるものだけ**割り当て。曖昧なもの・
  古典語で現代目的が一義に定まらないもの（軍事語、二至二分等の暦標識、
  宴席・交際語、冠帶・醞釀等）は **"その他" に置く**（推測で寄せない）。
- 内訳：分類済み 208語／"その他" 48語（256語）。

### full.ts の二重 Calendar 計算（将来改善案。今回は変更しない）

現状 `calculateTakujitsuFull(input)` は
`calculate(input)`（暦）と `calculateTakujitsu(input)`（内部でさらに
`calculate(input)`）で **同一入力の暦計算が2回走る**。純粋関数で副作用は
無く、単日表示では体感差も無いため今回は変更しない。

将来「目的から最良日を検索」（期間を走査して特定用途が吉の日を列挙）を
実装するときは、1日あたり暦計算1回に抑えたい。改善案：

1. `calculateTakujitsu()` に「暦を外から渡せる」オーバーロード（任意引数
   `calendar?: CalendarResult`）を追加し、渡されたらそれを使う。
   → `calculateTakujitsuFull()` は `calculate()` を1回呼び、その結果を
   `calculateTakujitsu(input, calendar)` へ渡す。既存の
   `calculateTakujitsu(input)` 単独呼び出しは後方互換のまま。
2. または検索専用の内部関数
   `evaluateDay(calendar, shinsatsuInput)` を切り出し、検索ループは
   `calculate()` → `resolveAllShinsatsu()` → `resolveJianchu()` →
   `getShuku28Info()` → `resolveShinsatsuRelations()` → `evaluateActivities()`
   を1回ずつ呼ぶ。

いずれも occurrence/resolution/十二建除/二十八宿/ActivityProfile の
ロジックは無変更で実現できる（入力の受け渡し方だけの調整）。

---

## 補足（2026-09-10、擇日UI 第3フェーズ ― 目的から良い日を検索）

### 期間検索は独自の吉凶判定を持たない

`src/lib/takujitsu/full.ts` に `searchTakujitsuDays(params)` を追加。
期間内の各日について **既存の
`calculate()` → `calculateTakujitsu()` → `evaluateActivities()` を1回ずつ実行**し、
指定した1つの `activityId` の `ActivityEvaluation`（`verdict` は good/bad/mixed/
neutral）をそのまま取り出して返すだけ。

- **検索専用の吉凶ロジックは無い。** 神殺の数によるランキング・独自スコア・
  重み付けは一切しない（現エンジンには good/bad/mixed/neutral 以上の順位規則が
  存在しない）。
- UI（`/takujitsu` の「良い日を探す」モード）は、`verdict` が **good または
  mixed の日を候補として表示**（「凶も表示」「中立も表示」トグルで拡張）。
  同区分内は日付昇順。月別グループ化。mixed 日は「吉凶混在（吉日ではない）」
  と明示し、宜・忌 両方の根拠を必ず見せる。
- 根拠表示は日付モードと同じ `positiveSources` / `negativeSources` /
  `resolutionStatus` / `note` / `suppressions` をそのまま使う（検索画面専用の
  根拠生成はしない）。
- 基準時刻：正午 12:00 固定（子初 23:00 の日柱境界を跨がない安全な値。
  時刻の擇定は別フェーズ）。検索期間の上限 `TAKUJITSU_SEARCH_MAX_DAYS = 366` 日。
  開始日>終了日・期間超過・不正日付はエラー。

### 二重 Calendar 計算の解消

`calculateTakujitsu(input, calendar?)` に**任意の第2引数**を追加。
`calendar` を渡すと `calculateCalendar()` を呼ばず、渡された `CalendarResult` を
そのまま使う（`calculateCalendar` は純粋関数なので、同じ input から得た結果は
同一。occurrence / resolution / 十二建除 / 二十八宿 のロジックは一切変わらない。
第2引数省略の従来呼び出しは完全に後方互換）。

- `calculateTakujitsuFull(input)` と `searchTakujitsuDays()` は
  `calculate()` を1日1回だけ呼び、その結果を `calculateTakujitsu(input, calendar)`
  へ渡す。

### kyoushinGroup5 の節気サンプルのメモ化（重複計算の解消）

`resolveKyoushinGroup5()` は四離・四絶・八節日・土王用事・氣往亡の判定で
`solarTermStartingOn()` を1日あたり最大15回呼び、その中で
`calculateCalendar(当日23:59:59)` を実行していた。同一 `(year, month, day,
timezone)` が **同じ日の複数チェックと、期間検索での隣接日どうしのオフセット
重複**で何度も要求されるため、`solarTerm` と `solarTermDateTime` だけを
module 内 `Map` にメモ化した（上限4096件、超過時 clear）。

- `calculateCalendar` は純粋関数。**判定ロジック・全テスト出力は不変**
  （`kyoushin_group5_unit` 26/26、`kyoushin_group2` 720/720 等 全PASS）。
  longitude/latitude/epochJdn/lunisolarConfig は solarTerm/solarTermDateTime に
  影響しないためキーに含めない。
- 効果（`tsx` 実測、`嫁娶` で計測）：
  - 30日検索 2,414 ms → **565 ms**
  - 90日検索 7,064 ms → **922 ms**
  - 366日検索 50,794 ms → **7,039 ms**
- 初回検索はキャッシュ cold のため上記。重なる期間の再検索はさらに速い。
  ブラウザ（V8 JIT）ではおおむね同等〜やや速い想定。

### 歸忌 → 忌 移徒（ActivityProfile、歸忌のみ変更）

空 ActivityProfile 原典監査（`docs/takujitsu_empty_activity_profiles_audit.md`）で
IMPLEMENTABLE と確定した歸忌を反映。`activityProfiles.ts` の歸忌エントリを
`unfavorableActivityIds: []` → `["移徒"]`（神殺象意.pdf「忌移徙」。移徙は既存
ActivityDefinition id `移徒` へマッピング＝成日C案の前例と同じ対応。新規
ActivityDefinition は追加しない）。

- occurrence（`kyoushinGroup3.ts` の歸忌成立式）・resolution（徳合/赦/願併→
  猶忌の解除条件）は**変更しない**（resolution は別課題）。
- 指標：SOURCE VALIDATION 85.52%/68.10% で不変（凶神の忌は吉神 favorable の
  指標に影響しない）。APP EVALUATION も 61.98% で不変（移徒は擇日象意.pdf の
  34語彙外、engine の歸忌 occurrence 60日のうち擇日象意.pdf が移徒を宜とする
  日は0）。LOGIC_ONLY は 31463→31439（他 source で good だった移徒が歸忌日に
  mixed 化した分）。
- テスト（`tests/takujitsu_search.manual.ts`）：歸忌単独→移徒 bad／歸忌＋月恩
  →移徒 mixed。

---

## 補足（2026-09-10、擇日UI ― 用途データ整理・表示修正・メモ化正式採用）

### 擇日の目的でない12語を ActivityDefinition から削除（256 → 244）

初七・十九・十六・二至二分・伐日・冬至・大凶・大吉・義日・道土・陰將・陽將
の12語は、利用者が擇日の目的として選ぶ「用事」ではない（暦の標識・
抽象的な吉凶語・神殺名など）。**全12語とも engine 内部（ActivityProfile の
favorableActivityIds/unfavorableActivityIds/exceptionActivityIds/seasonalRules、
occurrence、resolution）から activityId として一切参照されていない**ことを
確認済み（判定：全て「A. 内部参照なし → 物理削除」）。`activityDefinitions.ts`
から12エントリを削除した。

- 神殺「義日」（吉神 occurrence `kichijinGroup4.ts` ＋ ActivityProfile
  `{ sourceType:"kichijin", sourceName:"義日", favorable:[] }`）は**別概念**で
  無変更（用事「義日」を消しても神殺「義日」には影響しない）。
- ALL型6吉神（天徳・月徳・…）の `positiveMode:"all_except"` は「諸事皆宜、
  惟忌〇〇」を `ALL_ACTIVITY_IDS`（＝`Object.keys(ACTIVITY_BY_ID)`）から
  例外を除いた集合で表現する。**判定式・意味は不変**で、「諸事」の母集団が
  256→244 になっただけ。副作用として、これら12語は擇日象意.pdf が用事として
  記録しない語なので、APP EVALUATION の LOGIC_ONLY（＝engine good だが
  擇日象意に無い）が **31,439 → 30,047（−1,392）** 減る（ノイズ削減）。
  **MATCH 3,352・SHOGI_ONLY 2,056・一致率 61.98% は完全に不変**。
  SOURCE VALIDATION も 85.52%／68.10% で不変。
- カテゴリ件数（`activityCategories.ts` は `ACTIVITY_DEFINITIONS` を走査する
  データ駆動）：「その他」48 → **36**、他14カテゴリは不変（12語は全て
  旧「その他」だった）。合計 244。UI のカテゴリチップ件数も自動で追随。
- テスト `takujitsu_activity_definitions_unit.manual.ts` の総件数アサーションを
  256→244、用事便覧非対応を217→205 に更新（760→724 アサーション）。

### 「日付を見る」と「良い日を探す」の用途母集団は同一

どちらも `ACTIVITY_DEFINITIONS` / `ACTIVITY_BY_ID` を母集団にするため、
削除した12語はどちらの画面でも選択・検索・表示されない。engine 内部に
残した内部専用定義は無い（全て物理削除）。

### 神殺欄の開発者向け説明文を削除

「※［解除］［軽減］［増悪］［保留］は resolution レイヤーの適用結果。
raw occurrence は内部で保持しています。」を UI から削除（開発者向けの説明で
利用者には不要）。**［解除］［軽減］［増悪］［保留］の各バッジ表示は維持**
（`ShinsatsuList` / `SourceBlock` の `resolutionStatus` レンダリングは無変更）。
resolution ロジックは無変更。

### kyoushinGroup5 節気メモ化の正式採用（キャッシュキー監査済み）

第3フェーズで追加した `solarTermStartingOn()` の
`{solarTerm, solarTermDateTime}` メモ化を正式採用。キー監査：

| 入力 | 結果に影響するか | キーに含めるか |
|---|---|---|
| year / month / day | ○（対象日 23:59:59 の UTC 瞬間を決める） | **含める（0埋め `${year}-${MM}-${DD}`）** |
| timezone | ○（同上。未指定は `DEFAULT_TIMEZONE` に正規化） | **含める** |
| hour / minute / second | 本関数内で 23/59/59 に固定 | 不要（固定値） |
| longitude / latitude | ×（`resolveSolarTerm(utcDate)` に渡らない。太陽黄経は地心量） | 不要 |
| epochJdn | ×（二十八宿暦アンカー専用＝lodge28 のみ） | 不要 |
| lunisolarConfig | ×（農暦の暦法＝lunarMonth/lunarDay のみ） | 不要 |

- キャッシュ値は毎回新規生成する小オブジェクトで、呼び出し側へは
  `string | undefined` しか返さない＝後からミューテーションされない。
- 判定式（`startKey === ymdKey(...)` で solarTerm を返すか undefined か）は不変。
- 差分検証：メモ有効／無効で `resolveKyoushinGroup5()` の出力が **400日連続で
  完全一致**。`kyoushin_group5_unit` 26/26・`kyoushin_group2` 720/720 等 全PASS。
- 効果：366日検索 約50秒 → **約7秒**（`tsx` 実測、`嫁娶`。30日 565ms／90日 922ms）。
