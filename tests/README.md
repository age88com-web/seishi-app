# tests/

テスト用フレームワーク（Jest / Vitest 等）は未導入。各テストは `npx tsx` で直接実行する
自己完結スクリプト。終了コード 0 が PASS、非 0 が FAIL。

| ファイル | 内容 | 実行コマンド |
|---|---|---|
| `qimen_1080.manual.ts` | 奇門遁甲 排盤エンジンの **1080局 完全一致 回帰テスト**（地盤・旬首・天盤・九星・八門・八神）。検証データは `fixtures/qimen1080.json`（`docs/source/1080.pdf` からの機械転記・検証専用）。 | `npx tsx tests/qimen_1080.manual.ts` |
| `qimen_dingju_context.manual.ts` | 奇門遁甲 **日時→定局 回帰テスト**（超神・接気・置閏）。1974〜1979 の講義例、1976年置閏の受け入れ条件、講義例 2012・2015、23:00 境界、規則から導出した検証例。 | `npx tsx tests/qimen_dingju_context.manual.ts` |
| `calendarEngine.manual.ts` | CalendarEngine.calculate() の代表ケース確認 | `npx tsx tests/calendarEngine.manual.ts` |
| `ganzhi_parity.manual.ts` | 旧 eto.ts と CalendarEngine の干支計算の互換性確認 | `TZ=Asia/Tokyo npx tsx tests/ganzhi_parity.manual.ts` |
| `kakkyoku_cases.ts` | 七政四餘 格局エンジンの動作確認 | `npx tsx tests/kakkyoku_cases.ts` |

## qimen_1080.manual.ts

### 目的

「1080局すべてが `docs/source/1080.pdf` と完全一致」する現状を回帰テストとして固定する。
奇門遁甲の排盤ロジック（`src/lib/qimen/` 配下）を変更してこの一致が壊れると FAIL する。

### 実行

```
npx tsx tests/qimen_1080.manual.ts
```

- 全一致: `1080 / 1080 PASS` を表示して exit 0。
- 1件でも不一致: 「局番号・項目・期待値・実測値」を一覧表示して exit 1。

### 検証データ（fixtures/qimen1080.json）

- `docs/source/1080.pdf`（呉煒維 制作／山道帰一 監修「陰陽遁1080局 奇門遁甲格局総覧」）から
  **PyMuPDF で機械的に転記した検証専用 fixture**。仕様書ではない。
- **奇門遁甲ロジックの逆算・変更に使ってはならない**（1080.pdf は検証データであって仕様ではない）。
- 再生成: `python3 tests/fixtures/gen_qimen1080.py`（要 `pip install pymupdf`）。
  1080.pdf を差し替えた場合や抽出ロジックを直した場合のみ実行する。
- 詳細は `qimen1080.json` の `_meta` フィールド参照。

### 照合範囲

局・時干支を fixture から直接与えて、排盤6モジュールを駆動して照合する:

- `dipan.ts` … 地盤（9宮）
- `xunshou.ts` … 旬首（1080.pdf に旬首欄は無いため、時干支から 60干支の旬の先頭として
  算出した期待値と照合）
- `tianpan.ts` … 天盤（9宮）
- `jiuxing.ts` … 九星（9宮）＋ 値符（星・宮）
- `bamen.ts` … 八門（外周8宮）＋ 値使（門・宮）
- `bashen.ts` … 八神（外周8宮）

`dingju.ts` / `dingjuContext.ts` / `CalendarEngine` / `qimenEngine.ts` は「日時→局／排盤」の入口で、
1080.pdf は (局, 時干支) を索引に持つためこの fixture からは直接駆動できない。日時→定局は
`qimen_dingju_context.manual.ts` が検証する（下記「保証範囲」参照）。

## qimen_dingju_context.manual.ts

### 目的

`src/lib/qimen/dingjuContext.ts`（超神・接気・置閏）による「日時→定局」を回帰テストとして固定する。
仕様は `docs/qimen-spec/03_超神接気・置閏.md`。

### 実行

```
npx tsx tests/qimen_dingju_context.manual.ts
```

全項目 PASS で `N passed, 0 failed` を表示して exit 0。1件でも失敗すれば FAIL 行を表示して exit 1。

### 検証内容

期待値は次の3区分で、テスト内のコメントにも区分を明記している。

- **講義資料の例**
  - 1974-06-22 正授
  - 1975-06-22 超神・置閏なし
  - 1976-06-06〜10 通常の陽九局、6/11〜15 陽六局・6/16〜20 陽三局・6/21〜25 陽九局（置閏）、6/26 陰九局
  - 1976-06-22 天文上の節気（夏至・陰遁）と定局節気（芒種・陽遁・9局）の同時保持
  - 1979-06-22 接気（符頭 6/26 甲子）
  - 2015-09-08 10:00（p18・p21）、2012-03-06 卯刻（p25）
- **実装規則**（ユーザー確定 2026-10-06）
  - 置閏の閾値: 二至当日を含めず、符頭が二至の9日以上前
  - 日の境: 23:00（1976-06-10 22:59 / 23:30）
- **規則から導出した検証例**（講義資料の具体例ではない）
  - 1975-06-17〜21 の局、1978年冬至の置閏、1994年夏至（23:39 節入り → 翌日扱いで正授）
  - 1974〜1980年の二至で、局所判定と 1974年正授からの逐次適用が一致
  - 1974-06-01〜1980-06-30 の毎日で例外が無く、置閏期間が 1976夏至・1978冬至の各15日のみ

## 保証範囲

| 範囲 | `qimen_1080.manual.ts` | `qimen_dingju_context.manual.ts` |
|---|---|---|
| (陰陽遁, 局, 時干支) → 地盤・旬首・天盤・九星・値符・八門・値使・八神 | **全1080通りを保証** | 対象外 |
| 日時 → 天文上の節気・日干支（CalendarEngine） | 対象外 | 講義例・検証例の日付のみ |
| 日時 → 定局節気・陰陽遁・三元・局（超神・接気・置閏、23:00 境界） | 対象外 | 講義例と規則から導出した検証例（主に 1974〜1980）。全日付の網羅ではない |
| 日時 → 排盤の統合（`qimenEngine.calculate()`） | 対象外 | 2015・2012 の講義例のみ |
| 冬至側の置閏 | — | 規則から導出した例（1978年）のみ。講義資料に冬至側の年月日例は無い |
| 格局判定 | 対象外 | 対象外 |
