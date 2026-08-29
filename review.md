# プロジェクト理解 要約

対象ドキュメント: CLAUDE.md, docs/00〜06

---

## 1. このプロジェクトの目的

**御定術数システム** — 伝統術数を正確にデジタル化し、**講義テキストの理論を忠実に再現する**排盤システム。
単なる占術ソフトではなく、秀山氏が長年研究してきた理論を正確に再現することが目的。

### 開発対象の術数

| 術数 | 状況 |
|---|---|
| 七政四餘 | 完成 |
| 奇門遁甲 | 開発中 |
| 擇日 | 未着手 |
| 六壬神課 | 未着手 |

全術数が共通の**暦エンジン（CalendarEngine）**を使い、各術数は個別に暦計算をしない。
暦計算の一元化・重複排除が中核。

---

## 2. 開発方針

### 基本原則（docs/01）

1. **講義テキストを唯一の仕様書とする**。プログラムはテキストの理論に従う。
2. **1080局は検証データ**。プログラムを作る資料ではなく、完成した排盤結果を照合する基準。
3. **設計を優先**。コードを書く前に設計を完成させる。仕様が決まっていない部分は実装しない。推測で実装しない。
4. **共通暦エンジンを最優先**で完成させる。
5. **七政四餘は既存資産（完成版）**。必要最小限の修正を除き既存機能・排盤ロジックは変更しない。

### 役割分担

- ChatGPT: 設計・仕様書作成・レビュー
- **Claude Code: 実装・テストコード作成**
- 秀山: 理論監修・1080局検証・最終判断

開発フロー: 設計 → 実装 → レビュー → 1080局検証 → 完成

### 既存コードの扱い（docs/03・04）

| ファイル | 役割 | 方針 |
|---|---|---|
| `astro.ts` | 天文計算（ユリウス日・太陽/月位置・黄経・ASC 等） | **共通暦エンジンの中核として利用** |
| `eto.ts` | 干支計算（年月日時） | 節入りを固定日付→**天文計算による節入り時刻へ改良予定** |
| `branch_from_lon.ts` | 黄経→十二支位置（七政四餘専用） | 共通化しない |
| `geom.ts` | 描画補助（角度・座標・SVG/Canvas） | 共通暦エンジンに組み込まない |
| `page.tsx` | 画面・入力・排盤制御 | 現時点で変更しない |
| `ChartSVG.tsx` | 星盤 SVG 描画 | 変更しない。奇門遁甲で再利用しない |
| `kakkyoku_engine.ts` | 七政四餘 格局判定（`add(...)` 方式） | 七政四餘専用維持。再利用・整理しない |
| `shensha_engine.ts` | 神殺生成 | 七政四餘専用維持 |

### 節入りの要件（docs/02）

- 固定日付を使わない。各年の実際の太陽黄経を計算し、24節気（立春 315°〜大寒 300°）の正確な節入り日時を求める。
- 年干支 = 立春の節入り時刻が境界／月干支・月支 = 各月の「節」の節入り時刻が境界。

---

## 3. 理解した実装手順

### 全体ロードマップ（docs/06）

| Phase | 内容 | 状態 |
|---|---|---|
| **1. 既存システム解析** | 七政四餘コード解析・共通化部分抽出・設計書作成 | 完了 |
| **2. 共通暦エンジン** | CalendarEngine 作成（Julian Day→太陽黄経→二十四節気→節入り時刻→干支計算→API 整備） | 次の作業 |
| **3. 七政四餘移行** | `eto.ts` を CalendarEngine 利用へ変更・節入り判定の置き換え・排盤検証・格局検証 | 未着手 |
| **4. 奇門遁甲** | 九宮生成・地盤・天盤・八門・九星・八神・格局判定（`src/lib/qimen/` に新規実装） | 未着手 |
| **5. 1080局検証** | 全局照合・例外局確認・バグ修正・最終検証 | 未着手 |

### Phase 2（CalendarEngine）の具体像（docs/03・05）

**位置づけ**: エンジンは**排盤を一切行わない**。暦情報のみ返す。
神殺判定・格局判定・八門/九星/八神配置・SVG 描画・PDF 生成は行わない。

**API**: `calculate()` 単一関数

- 入力
  - 必須: `year, month, day, hour, minute`
  - 任意: `second, timezone, longitude, latitude`
- 出力
  - 基本: `julianDay, deltaT`（ΔT）, `sunLongitude`
  - 太陽: `solarTerm`（二十四節気）, `solarTermEntered`（節入り済みフラグ）, 節入り日時
  - 干支: `yearStem/yearBranch, monthStem/monthBranch, dayStem/dayBranch, hourStem/hourBranch`

**ドキュメント間の差異（着手前に要確定）**
docs/03 の出力リストには「UTC・節入り時刻」が明記されているが、docs/05 の TypeScript 型には
`julianDay / deltaT / sunLongitude / solarTerm / solarTermEntered` と各干支のみ。
UTC 値・節入り日時のフィールド名が型に未反映。

### 実装の進め方（方針から導かれる手順）

1. まず設計を固める（docs/03・05 の差異、フィールド名を確定）。仕様未確定部分は実装しない。
2. `astro.ts` を土台に CalendarEngine を**独立実装**（既存コードには触れない）。
3. Julian Day / ΔT → 太陽黄経 → 節気・節入り時刻（黄経ベース、固定日付不使用）→ 干支計算 の順。
4. テストコードを作成。
5. 十分な検証後に Phase 3 で `eto.ts` へ組み込み、1080局で照合。

---

## 4. 確定した仕様（実装前の合意）

### CalendarEngine.calculate() 出力（docs/03・05 の差異を解消）

以下2フィールドを追加し確定:

- `utc: string` — 入力日時を UTC に正規化した ISO 8601 文字列
- `solarTermDateTime: string` — その節の節入り日時（ISO 8601 文字列）

### 構成方針の修正

- `time.ts` は作らない。UTC / Julian Day / ΔT は `julian.ts` にまとめる。
- 干支ファイル名は `ganzhi.ts` ではなく `eto.ts`（既存の命名規則 astro.ts / eto.ts / geom.ts に合わせる）。
- `timezone` 未指定時のデフォルトは `Asia/Tokyo`。
- `astro.ts` の既存関数を最大限利用し、同一処理を再実装しない。

---

## 5. Phase 2 雛形作成の結果（2026-08-28）

`src/lib/calendar/` に6ファイルを新規作成。雛形のみ（ロジック未実装、関数は `throw new Error("not implemented")`）。
既存コードは変更なし（`astro.ts`・`eto.ts` は import のみ）。

| ファイル | 役割 | 主な export |
|---|---|---|
| `types.ts` | 入出力型の唯一の基準。`CalendarInput` / `CalendarResult`（`utc`・`solarTermDateTime` を含む統合仕様）、二十四節気の定義データ（名称・黄経角度・節/中気）、デフォルト TZ。 | `CalendarInput`, `CalendarResult`, `SolarTermDef`, `SOLAR_TERMS`, `DEFAULT_TIMEZONE` |
| `julian.ts` | 時刻正規化と基礎数値。ローカル日時(+timezone) → UTC、UTC → Julian Day、ΔT。 | `JulianResult`, `toJulian()` |
| `solarTerm.ts` | 太陽黄経から節気判定と節入り日時を算出。固定日付不使用、太陽黄経は `astro.ts` の `sunLonDeg` を利用予定。 | `SolarTermResult`, `resolveSolarTerm()`, `findSolarTermInstant()` |
| `eto.ts` | 節入り時刻を境界とした年/月/日/時の干支計算（新規ロジック）。干支名テーブルは既存 `../eto` の `STEMS`/`BRANCHES` を再利用。 | `GanzhiResult`, `resolveGanzhi()`, 再 export: `STEMS`, `BRANCHES`, `Stem`, `Branch` |
| `calendarEngine.ts` | 本体。`calculate()` が julian → solarTerm → eto を統合して `CalendarResult` を返す薄い調整層。排盤・格局・描画は行わない。 | `calculate()` |
| `index.ts` | 公開エントリ。各術数はここからのみ import。内部モジュールへ直接依存させない。 | `calculate`, `CalendarInput`, `CalendarResult`, `SOLAR_TERMS`, `DEFAULT_TIMEZONE` |

依存方向: `index → calendarEngine → { julian, solarTerm, eto } → types`。

### 実装前に確定が必要な点（雛形内に TODO 記載）

1. `astro.ts` の `julianDayUTC` が未 export。既存ファイル変更禁止のため、共有方法を決める必要あり。
2. `utc` / `solarTermDateTime` の文字列フォーマット（ISO 8601 で確定してよいか）。
3. timezone → UTC 変換の実装方針（`Intl` ベースか、ライブラリ導入か）。

### 型チェック

`npx tsc --noEmit` — `calendar/` の6ファイルはエラーなし。
既存の `src/lib/ascendant.ts:74` に元からの構文エラーあり（今回未変更・無関係）。
