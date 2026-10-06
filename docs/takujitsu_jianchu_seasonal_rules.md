# 十二建除 執・危・収 季節条件完成フェーズ

最終更新：2026-09-09

完成度棚卸しで保留と判定されていた十二建除5直（滿・執・危・收・成）の
うち、季節条件付きの宜忌が原文に明記され、既存CalendarEngineを変更
せず実装可能と判断された執・危・收の3直を完成させた。滿・成は今回
一切変更していない。

---

## 1. 執日の原文確認

`docs/source/神殺象意.pdf`原本画像（4〜5倍ズーム、既存方針どおり180度
回転補正して確認）より：

> 〔執日〕宜捕捉。霜降後，立春前，宜畋獵。雨水後，立夏前，宜取魚
> （義取諸執，且順時也）。

構造化：

- **常時宜**：捕捉
- **常時忌**：なし
- **季節限定宜**：
  - 霜降後、立春前 → 畋獵
  - 雨水後、立夏前 → 取魚
- **条件となる季節**：二十四節気（霜降・立春・雨水・立夏という節気名
  そのもの）。「春夏秋冬」でも「四季月」でもなく、**特定の節気名を
  起点・終点とする期間**として明記されている。
- **その他の条件**：括弧内「義取諸執，且順時也」は語義の説明のみで、
  追加の判定条件ではない。

`docs/source/12建除.pdf`（既存jianchu.tsの唯一の仕様根拠）の執日の
記述は「執着する日なので魚釣・漁業、狩猟に吉」のみで、季節条件は
含まれていない（神殺象意.pdfの方がより詳細な一次資料であることを
再確認）。

---

## 2. 危日の原文確認

同ページより：

> 〔危日〕宜安床（取安不忘危之義）。立冬後，立春前，宜伐木。霜降後，
> 立春前，宜畋獵。雨水後，立夏前，宜取魚。

- **常時宜**：安床
- **常時忌**：なし（`activityProfiles.ts`既存の「乗船」忌は
  `docs/source/12建除.pdf`＝「危険な日でありリスクの高いことはしない。
  特に乗船は凶」由来で、今回も維持。神殺象意.pdfにはこの常時忌の
  記述は無いが、既存データを削除する根拠も無いため、そのまま残した）。
- **季節限定宜**：
  - 立冬後、立春前 → 伐木（執日には無い、危日固有の季節限定宜）
  - 霜降後、立春前 → 畋獵
  - 雨水後、立夏前 → 取魚
- **条件**：執日と同じ二十四節気ベース。ただし「伐木」の区間（立冬〜
  立春前）は「畋獵」の区間（霜降〜立春前）よりも狭い（霜降は立冬より
  前の節気のため）。この2つの区間を混同しないよう、別々の
  `seasonalRules`エントリとして実装した（3〜4章参照）。

12建除.pdfの危日の記述「危険な日でありリスクの高いことはしない。特に
乗船は凶。ベッドの買い替え設置や移動、子作りに吉」にも季節条件は無い。

---

## 3. 収日の原文確認

同ページより：

> 〔收日〕宜進人口，納財，捕捉，納畜（義取諸收）。霜降後，立春前，宜
> 畋獵。雨水後，立夏前，宜取魚。與「月恩」「四相」「時德」併，宜修
> 倉庫。

- **常時宜**：進人口、納財、捕捉、納畜
- **常時忌**：なし
- **季節限定宜**：執日と同一区間（霜降後立春前→畋獵、雨水後立夏前→
  取魚）
- **その他の条件（2026-09-10、本番実装済み）**：「與『月恩』『四相』
  『時德』併，宜修倉庫」＝収日がこの3吉神の**いずれか1つ以上**と同日に
  成立すると「修倉庫」が追加で宜になる、という他の神殺との併存条件。
  季節条件ではなく同日に成立している別の神殺を参照するクロス条件のため、
  `evaluateActivities()` に十二建除ブロックの直後で実装した
  （`収 AND (月恩 OR 四相 OR 時徳)`）。詳細は本ドキュメント末尾「補足
  （2026-09-10、収 × 月恩／四相／時徳 → 修倉庫）」参照。

同じ用事（畋獵・取魚）に、季節によって宜になる場合とならない場合が
あるため、単純な配列へ平坦化せず、`seasonalRules`という条件付き
構造のまま保持した（4〜7章）。

---

## 4. 「季節」の定義（monthBranch / solarTerm / lunarMonth の選定）

原文の期間表現（「霜降後，立春前」「雨水後，立夏前」「立冬後，立春前」）
は、いずれも**二十四節気の名称そのもの**で期間を指定している。

- **monthBranch（月令＝月建）は使わない**：霜降・雨水は「中気」
  （節気のうち月の中間に来るもの）であり、月の開始点（「節」）とは
  一致しない。例えば霜降は戌月の中頃に位置し、月の切り替わり
  （寒露〜立冬）とはズレる。月単位（monthBranch）では原文の期間を
  正確に表現できない。
- **lunarMonth（農暦月）も使わない**：原文に「農暦」「旧暦」「閏」
  等の語は一切登場せず、農暦月を示す根拠が無い（既存の
  `docs/takujitsu_activity_design.md`2.2節で確立済みの「農暦月と
  monthBranchを混同しない」という原則にも従う）。
- **solarTermを使う**：`src/lib/calendar/types.ts`の`SOLAR_TERMS`
  （二十四節気の定義データ、既存・無変更）と、`CalendarResult.solarTerm`
  （対象日が属する節気名、既存・無変更）が、原文の期間表現とそのまま
  対応する。追加のCalendarEngine変更は不要。

---

## 5. 入力の可用性の確認

`CalendarResult.solarTerm`は既にCalendarEngineが計算済みだが、
`calculateTakujitsu()`の戻り値（`TakujitsuResult`）にも
`EvaluateActivitiesInput`にも含まれていなかった（
`docs/takujitsu_completion_audit.md`13章で既に指摘済みの「UIには暦
情報を渡す別呼び出しが必要」という既知のギャップと同根）。

**CalendarEngine自体は変更していない。** `EvaluateActivitiesInput`に
`solarTerm?: string`という任意フィールドを追加しただけで、既存の
呼び出し側（`solarTerm`を渡さないコード）は従来どおり動作する
（季節限定宜が反映されないだけで、エラーにはならない）。

---

## 6. データモデルの変更内容

`src/lib/takujitsu/activity/types.ts`に`ActivitySeasonalRule`型を
新規追加し、`ActivityProfile`に`seasonalRules?: ActivitySeasonalRule[]`
を追加した（既存フィールドは無変更、後方互換）：

```ts
export interface ActivitySeasonalRule {
  label: string;              // 例：「霜降後、立春前」
  solarTerms: string[];       // この節気の間だけ成立
  favorableActivityIds?: string[];
  unfavorableActivityIds?: string[];
}
```

通常の`favorableActivityIds`/`unfavorableActivityIds`（常時宜忌）とは
別フィールドとして持ち、混ぜて平坦化していない。`activityProfiles.ts`
の執・危・収のエントリに、常時宜（捕捉／安床／進人口等）は既存の
`favorableActivityIds`へ追加し、季節限定宜（畋獵・取魚・伐木）は
`seasonalRules`へ分離して追加した。

---

## 7. evaluateActivities側の変更内容

`src/lib/takujitsu/activity/evaluateActivities.ts`：

- `EvaluateActivitiesInput`に`solarTerm?: string`を追加。
- 十二建除（jianchu）の処理ブロックで、通常の宜/忌を反映した後、
  `jianchuProfile.seasonalRules`のうち`rule.solarTerms.includes(input.solarTerm)`
  が真のものだけ、`favorableActivityIds`/`unfavorableActivityIds`を
  追加で反映する。

通常宜忌と季節宜忌は完全に独立した`RawContribution`として`all[]`へ
積まれ、既存のactivityIdごとのグルーピング・verdict計算（`computeVerdict`）
にそのまま合流する。**新しい優先順位・上書きロジックは一切追加して
いない**——原文に優先関係の明記が無い限り、同じ用事に通常忌と季節宜が
同時に成立すれば、既存の仕組みのまま自然に`mixed`になる（8章）。

---

## 8. 条件付きsourceの追跡方法

季節限定の宜/忌は、通常の`ActivitySource`と同じ`sourceType`/
`sourceName`（例：`jianchu`/`執`）を持ちつつ、`note`に`seasonalRule.label`
（例：「霜降後、立春前」）をそのまま入れている。UI側は
`${sourceName}（${note}）`のように組み立てるだけで「執日（霜降後、
立春前）」という説明を再現できる（過剰なUI文言はコード側で作らず、
原文の期間表現をそのまま使った）。単体テスト
（`tests/takujitsu_evaluate_activities_unit.manual.ts`セクション16）で
`note`が期待どおりの文字列になることを確認済み。

---

## 9. conflict処理の確認

執・危・収それぞれの季節限定宜（畋獵・取魚・伐木）は、いずれも各直の
既存の常時宜・常時忌のActivityDefinition idとは重複しないため、
今回のデータでは実際の競合（同じ用事に通常忌と季節宜が同時発生する
ケース）は発生しなかった。ただし、通常宜忌と季節宜忌は共に同じ`all[]`
配列へ独立して積まれ、活動IDでグルーピングされた時点で自然に
`positiveSources`/`negativeSources`へ振り分けられる——これは
`tests/takujitsu_evaluate_activities_unit.manual.ts`セクション14
（複数の凶神の忌と吉神の宜が同一活動に競合してもmixedになることを
確認済み）と全く同じ仕組みであり、**もし将来競合するデータが追加
されても、勝手な優先順位を新設せず自然にmixedになる**ことをコードの
構造上確認した。

---

## 10. 完成可否まとめ

| 直 | 常時宜（新規追加分） | 季節限定宜 | 完成可否 |
|---|---|---|---|
| 執 | 捕捉 | 畋獵（霜降〜立春前）、取魚（雨水〜立夏前） | **完成** |
| 危 | 安床 | 伐木（立冬〜立春前）、畋獵（霜降〜立春前）、取魚（雨水〜立夏前） | **完成** |
| 収 | 進人口、納財、捕捉、納畜 | 畋獵（霜降〜立春前）、取魚（雨水〜立夏前） | **完成**（「與月恩四相時德併宜修倉庫」クロス条件も 2026-09-10 実装済み） |

十二建除の完成数：7直（建・除・平・定・破・開・閉、前々回確定）→
**10直**（執・危・収を追加）→ **11直**（2026-09-10 成を C案で追加）。
**滿のみ未着手**（神殺象意.pdf に単独記載が無く別保留）。

---

## 11. 滿・成・小耗・六黄道COMPOSIT型は変更なし

- **滿**：`docs/source/神殺象意.pdf`に単独の宜忌記述が無く、今回も
  一切触れていない（既存notesのまま）。
- **成**：2026-09-10 に **C案（7語 union）で実装済み**。既存資料
  （婚姻・結婚・結納。12建除.pdf ⑨）と神殺象意.pdf（入學・移徙・築堤防・
  開市）は「同じ用事が無い」が直接の矛盾は無く、粒度・観点の差と確定。
  執・危・収と同じ「12建除.pdf由来＋神殺象意.pdf由来を1配列に併記」方針で
  `favorableActivityIds:["婚姻","結婚","結納","入学","移徒","築堤防","開市"]`
  へ拡張（`activityProfiles.ts` のみ。ALL型にしない。`jianchu.ts` 無変更）。
  詳細は `docs/takujitsu_jianchu_cheng_conflict_analysis.md`。
- **小耗**：前回実装（十二直「執」と等価）を今回一切変更していない。
  「德合/天願併，則貪合忘沖，故不忌」という解除条件も今回は
  resolutionへ実装しない（別フェーズとする、という前回の方針を維持）。
- **六黄道COMPOSITE型**（青龍・明堂・寶光・玉堂・司命）：前回副次的に
  確認した「與吉神併，則從所宜，與凶神併，則從所忌」という原文は
  `docs/takujitsu_xiaohao_fuyi_wuli_verification.md`8章に記録済みの
  ままで、今回もコード変更していない。

---

## 12. SOURCE VALIDATION・APP EVALUATIONへの影響

`tests/fixtures/gen_720_metric_reconciliation.ts`を再実行した（十二建除
執・危・収の季節限定宜を反映させるため、同スクリプトのステージD・Eの
`evaluateActivities()`呼び出しに`solarTerm`を渡す変更を追加した。
ステージA＝SOURCE VALIDATIONのロジックは一切変更していない）。

| 指標 | 前回（小耗実装後） | 今回（執・危・収season実装後） | 差分 |
|---|---|---|---|
| SOURCE VALIDATION（ALL型込み） | 85.52% | **85.52%**（不変） | ±0 |
| SOURCE VALIDATION（LIST型のみ） | 68.10% | **68.10%**（不変） | ±0 |
| APP EVALUATION（ステージE、verdict、参考値） | 59.62% | 60.15% | +0.53pt |
| APP EVALUATION SHOGI_ONLY（参考値） | 2,184 | 2,155 | -29 |

SOURCE VALIDATIONは想定どおり完全に不変（ステージAは十二建除を一切
参照しないため）。APP EVALUATIONはわずかに改善したが、**これは一致率
向上を狙って調整した結果ではなく、原文どおりの季節限定宜を追加した
副産物**である。指示どおり、一致率を目的にルールを調整することはして
いない。

---

## 補足（2026-09-10、収 × 月恩／四相／時徳 → 修倉庫 クロス条件 本番実装）

### 原文再確認（神殺象意.pdf、原本ページ「一一／一二」、6倍ズーム）

> 〔收日〕宜進人口，納財，捕捉，納畜（義取諸收）。霜降後，立春前，宜
> 畋獵。雨水後，立夏前，宜取魚。**與「月恩」「四相」「時德」併，宜修倉庫。**

「時德」の直後は「併」で、「皆」「俱」「同時」「一齊」等の共起（AND）を
示す語は無い。ブラケット列挙＋「併」のみ。

### AND/OR の最終解釈

**OR（月恩・四相・時徳のいずれか1つ以上）。**

- 原文に共起マーカーが無い（`docs/takujitsu_decisions.md`・
  `docs/takujitsu_resolution_rules.md` 1.4節の判断基準：単純な列挙は OR）。
- 既存の月建（小時）resolution ルールが、同じ構文「與『天德』…『月恩』
  『四相』併，止忌動土」を `anyOf`（OR）で実装済み（`resolution/rules.ts`
  ルール No.4）。同一構文なので同じ扱いにする。
- 「三神すべて同時」を要求する文法根拠は見つからなかった（＝停止・報告
  の対象外。実装続行）。

### 実装

- occurrence（十二建除12直、月恩・四相・時徳の吉神）は**一切変更しない**。
- `evaluateActivities()` の十二建除ブロック（季節限定宜の直後）に追加：
  `input.buildingDay.name === "収"` かつ `input.resolution.kichijin` に
  月恩・四相・時徳 のいずれかがある場合、`{ activityId: "修倉庫",
  favorable: true, source: { sourceType: "jianchu", sourceName: "収",
  note: "<成立した吉神名を・区切りで列挙>と併して宜" } }` を1件だけ積む。
- 「修倉庫」を収の通常 `favorableActivityIds` にも、月恩・四相・時徳の
  各 ActivityProfile にも入れない（`activityProfiles.ts` は 収 の `notes`
  文言のみ「実装済み」に更新）。
- `sourceType: "jianchu"` なので、六黄道COMPOSITE（kichijin由来positiveのみ
  追従）はこの修倉庫positiveを追従しない。月破の徳神positive抑制
  （第1.5パス、`sourceType === "kichijin"` を対象）も対象外。月破が同日に
  「修倉庫」を忌にする場合は positive(収クロス)＋negative(月破) を双方
  保持し mixed（原典にない優先順位を付けない）。

### 720行 参考集計（`tests/fixtures/gen_shu_xiu_cangku.ts`）

| 指標 | 値 |
|---|---|
| 720行中の収成立日数 | 60 |
| 収 ＋ 月恩 | 0 |
| 収 ＋ 四相 | 12 |
| 収 ＋ 時徳 | 5 |
| 収 ＋ (月恩 OR 四相 OR 時徳) | 16 |
| 修倉庫がクロス条件で positive 生成された日数 | 16（verdict good 4 / mixed 12） |
| うち擇日象意.pdf も「修倉庫」を宜としている日数 | **0** |

「修倉庫」は擇日象意.pdf の34固有語彙に含まれる（別の日に宜として出現）
が、この16日には1件も重ならない。したがって APP EVALUATION の一致率
（＝MATCH / expected）は動かない。一致率のためのルール調整はしない
（原典規則を優先）。

### 指標

| | 変更前 | 変更後 |
|---|---|---|
| SOURCE VALIDATION（ALL型込み／LIST型のみ） | 85.52% / 68.10% | **85.52% / 68.10%（不変）** |
| APP EVALUATION（E verdict、一致率） | 60.39% | **60.39%（不変）** |
| APP EVALUATION MATCH / SHOGI_ONLY | 3,266 / 2,142 | **3,266 / 2,142（不変）** |
| APP EVALUATION LOGIC_ONLY | 31,436 | 31,438（＋2。収クロスで新規に good になった修倉庫） |
| E段階 生成延べ（raw） | 64,484 | 64,495（＋11。16日のうち修倉庫rawが未生成だった分） |

SOURCE VALIDATION はステージAが `evaluateActivities()` を通さず、かつ
十二建除を参照しないため定義上不変。APP EVALUATION 一致率も、この規則が
生む「修倉庫」宜が擇日象意.pdf の該当16日と重ならないため不変。

### 回帰

evaluateActivities 単体テスト 189→**217**（収クロス A〜M を追加、全PASS）。
月破・徳神positive抑制、六黄道COMPOSITE、resolution、occurrence、
十二建除、二十八宿、CalendarEngine、qimen1080、tsc、lint、Next build は
実装前と同結果（既知の lunisolar 6件・occurrence 孤立差異は従来どおり別枠）。
