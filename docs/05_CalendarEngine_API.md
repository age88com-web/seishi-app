# CalendarEngine API

## Version

0.1

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

---

# 入力

## 必須

- 年
- 月
- 日
- 時
- 分

## 任意

- 秒
- タイムゾーン
- 経度
- 緯度

---

# 出力

## 基本情報

- UTC
- Julian Day
- ΔT

## 太陽

- 太陽黄経
- 二十四節気
- 節入り日時

## 干支

- 年干支
- 月干支
- 日干支
- 時干支

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

入力された日時から、
共通暦情報を計算して返す。

---

## 入力

```ts
{
  year: number
  month: number
  day: number

  hour: number
  minute: number
  second?: number

  timezone?: string

  longitude?: number
  latitude?: number
}
```

---

## 出力

```ts
{
  julianDay: number

  deltaT: number

  sunLongitude: number

  solarTerm: string

  solarTermEntered: boolean

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