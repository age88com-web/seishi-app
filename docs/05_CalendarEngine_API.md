# CalendarEngine API

## Version

0.1

> 本書は 2026-09-02 に、実装済みの `src/lib/calendar/`（`c29d425 baseline: seishi-app and CalendarEngine v1`）へ**完全一致**するよう改訂した。
> 方針: 実装は変更せず、仕様書を現行実装に合わせる。実装の唯一の基準は `src/lib/calendar/types.ts` の型と `calendarEngine.ts` の処理。

---

# 目的

CalendarEngine は、
御定術数システム全体で使用する共通暦エンジンである。

七政四餘、奇門遁甲、擇日、六壬神課は、
本エンジンから暦情報を取得する。

---

# 基本思想

CalendarEngine は排盤を行わない。

排盤に必要な暦情報のみを返す。

公開エントリポイントは `src/lib/calendar/index.ts` の `calculate` のみ。
内部モジュール（`julian` / `solarTerm` / `eto` / `calendarEngine`）へは直接依存させない。

---

# 入力

## 必須

- 年
- 月
- 日
- 時
- 分

## 任意

- 秒（既定 0）
- タイムゾーン（IANA 名。未指定時は `"Asia/Tokyo"`）
- 経度
- 緯度

> **経度・緯度は現行実装では受け取るが未使用**（`CalendarInput` に存在するが `calculate()` の計算に影響しない）。将来 ASC 等の所在地依存計算を足すときに使う想定。

---

# 出力

## 基本情報

- UTC（入力日時を UTC へ正規化した ISO 8601 文字列）
- Julian Day（UT ベース）
- ΔT（TT − UT、秒）

## 太陽

- 太陽黄経（対象時刻。度、0〜360）
- 二十四節気（対象時刻が属する節気の名称。例: 立春、啓蟄）
- 節入り日時（その節気の節入り瞬間。UTC の ISO 8601 文字列）

## 干支

- 年干支（立春の節入り時刻を境界に判定）
- 月干支（各「節」の節入り時刻＝太陽黄経を境界に判定。五虎遁）
- 日干支（Julian Day 基準。日の切替は子初 23:00）
- 時干支（日干と時支から。五鼠遁。23時・0時＝子）

> `solarTermEntered: boolean` は**採用しない**。「節入り」の出力は
> `solarTerm: string`（節気名）と `solarTermDateTime: string`（節入り瞬間の ISO 日時）の2値。

---

# 行わない処理

CalendarEngine は次の処理を行わない。

- 七政四餘の排盤
- 奇門遁甲の排盤
- 神殺判定
- 格局判定
- SVG描画
- PDF生成

---

# API

## calculate()

CalendarEngine の基本関数。
入力された日時から、共通暦情報を計算して返す。

```ts
import { calculate } from "@/lib/calendar";
const r = calculate({ year: 2012, month: 3, day: 6, hour: 6, minute: 0 });
```

---

## 入力（`CalendarInput`）

```ts
{
  year: number
  month: number
  day: number

  hour: number
  minute: number
  second?: number        // 既定 0

  timezone?: string       // IANA タイムゾーン名。未指定時は "Asia/Tokyo"。
                          // Intl で解決できない値は Error を投げる。

  longitude?: number      // 現行実装では未使用
  latitude?: number       // 現行実装では未使用
}
```

`year..second` は `timezone` の**壁時計時刻**として解釈する。

---

## 出力（`CalendarResult`）

```ts
{
  utc: string                 // 入力日時を UTC に正規化した ISO 8601 文字列

  julianDay: number           // ユリウス日（UT ベース。astronomy-engine AstroTime.ut + 2451545.0）
  deltaT: number              // ΔT = (AstroTime.tt − AstroTime.ut) × 86400  [秒]

  sunLongitude: number        // 対象時刻の太陽黄経（度、0〜360）

  solarTerm: string           // 対象時刻が属する節気の名称
  solarTermDateTime: string   // その節気の節入り日時（UTC の ISO 8601 文字列）

  yearStem: string
  yearBranch: string

  monthStem: string
  monthBranch: string

  dayStem: string
  dayBranch: string

  hourStem: string
  hourBranch: string
}
```

型の唯一の基準は `src/lib/calendar/types.ts` の `CalendarInput` / `CalendarResult`。

---

## index.ts が公開するもの

- 関数 `calculate`
- 型 `CalendarInput` / `CalendarResult` / `SolarTermDef`
- 定数 `SOLAR_TERMS`（二十四節気の定義配列）/ `DEFAULT_TIMEZONE`（`"Asia/Tokyo"`）

内部関数（`toJulian` / `resolveSolarTerm` / `resolveGanzhi`）は非公開。

---

## 例外

- `timezone` が Intl で解決できない → `Error("invalid IANA timezone: ...")`
- 太陽黄経に対応する節気が見つからない（通常起こらない）→ `Error("solar term not found ...")`
- 年月日の値域チェック（月 1〜12 等）は行わない。

---

## 計算方針（実装の要点）

| 項目 | 実装 |
|---|---|
| 壁時計 → UTC | `Intl.DateTimeFormat` のオフセットで変換。DST 境界は 2 パスで補正 |
| Julian Day | `astronomy-engine` の `AstroTime.ut + 2451545.0` |
| ΔT | `astronomy-engine` の `(AstroTime.tt − AstroTime.ut) × 86400` 秒 |
| 太陽黄経 | `src/lib/astro.ts` の `sunLonDeg`（内部で `astronomy-engine` を使用） |
| 節入り時刻 | 太陽黄経が 15° 刻みの境界に達した瞬間を二分法で逆算（固定日付を使わない） |
| 年干支 | その年の立春（315°）の瞬間を境界に暦年を確定。`1984 = 甲子` を基準 |
| 月干支 | 太陽黄経から節月序数（0＝寅月）を求め、五虎遁で月干を決定 |
| 日干支 | 現地暦日（23時以降は翌日扱い）の JDN を求め、`1984-02-02 = 丙寅` で較正した剰余で決定 |
| 時干支 | 時支 = `floor((hour+1)/2) mod 12`、時干 = 五鼠遁 |

詳細は [03_共通暦エンジン設計.md](./03_共通暦エンジン設計.md) を参照。

---

## 未反映・注意（TODO は 03 に集約）

- 現行実装は「入力＝現地壁時計」を前提に、干支計算へ `input.year/month/day/hour` をそのまま渡す。
  `timezone` が `"Asia/Tokyo"` 以外のとき、干支計算に渡すべき現地壁時計への変換は未実装
  （`calendarEngine.ts` の TODO コメントに記載）。
