# tests/

テスト用フレームワーク（Jest / Vitest 等）は未導入。各テストは `npx tsx` で直接実行する
自己完結スクリプト。終了コード 0 が PASS、非 0 が FAIL。

| ファイル | 内容 | 実行コマンド |
|---|---|---|
| `qimen_1080.manual.ts` | 奇門遁甲 排盤エンジンの **1080局 完全一致 回帰テスト**（地盤・旬首・天盤・九星・八門・八神）。検証データは `fixtures/qimen1080.json`（`docs/source/1080.pdf` からの機械転記・検証専用）。 | `npx tsx tests/qimen_1080.manual.ts` |
| `calendarEngine.manual.ts` | CalendarEngine.calculate() の代表ケース確認 | `npx tsx tests/calendarEngine.manual.ts` |
| `ganzhi_parity.manual.ts` | 旧 eto.ts と CalendarEngine の干支計算の互換性確認 | `TZ=Asia/Tokyo npx tsx tests/ganzhi_parity.manual.ts` |
| `kakkyoku_cases.ts` | 七政四餘 格局エンジンの動作確認 | `npx tsx tests/kakkyoku_cases.ts` |
| `liuren_interpretation_void_structure.manual.ts` | 六壬神課 解釈エンジン Phase 3M-C（空亡の構造 FACT）のテスト。dayXunVoid（既存 isVoid）と seatedOnVoid（坐空＝支が加わる地盤支が旬空）を分離。古典例（丁巳・乙卯・壬子・甲午・丙午）の値、甲子日退間（戌→申→午）の末伝午が日旬空・坐空では表せない未実装領域であること、720課×月支12 で既存 isVoid と完全一致・三伝（Phase 3K）と干上（Phase 3L）の isSeatedOnVoid が一致すること、720課の位置別・組合せ・movementPattern 別の監査値を確認。 | `npx tsx tests/liuren_interpretation_void_structure.manual.ts` |
| `liuren_interpretation_direction_evidence.manual.ts` | 六壬神課 解釈エンジン Phase 3N（進退判断の材料 FACT）のテスト。720課×月支12 で DirectionEvidence（movementDirection・standing・path・末伝の空亡）が既存 FACT と一致すること、古典4例と丁巳日の FACT 出力（結論はコードで出さない）、720課の向き別の監査値を確認。 | `npx tsx tests/liuren_interpretation_direction_evidence.manual.ts` |
| `liuren_audit_lianru_void.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3M-A・3M-B の連茹空亡の古典構造監査。古典9例（壬子・甲午・丁巳・戊申・乙卯・甲子・丙午・甲申・丙辰）の日旬空・坐空・天空と、旬をたどる空亡の候補規則（R1〜R5）を並べ、720課での成立件数を出す。候補規則は本番に実装していない（研究資料）。 | `npx tsx tests/liuren_audit_lianru_void.manual.ts` |

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

`dingju.ts` / `CalendarEngine` / `qimenEngine.ts` は「日時→局／排盤」の入口で、1080.pdf は
(局, 時干支) を索引に持つためこの fixture からは直接駆動できない。`qimenEngine.calculate()` は
上記6モジュールをこの順で呼ぶ薄い統合層であり、本テストはその中核を全数で固定している。
日時→排盤の疎通は `calendarEngine.manual.ts` 等が担保する。
