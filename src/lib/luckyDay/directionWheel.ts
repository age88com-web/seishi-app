// src/lib/luckyDay/directionWheel.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）の「吉凶方位」円盤、表示専用レイヤー。
//   既存 calculateDailyDirections()（src/lib/takujitsu/dailyDirections.ts）の
//   戻り値をそのまま使い、円盤の9区画（八方位＋中宮）のどこに置くかという
//   表示上の対応づけだけを行う。新しい方位判定・吉凶ルールは一切追加しない。
//
// 唯一の入力:
//   calculateDailyDirections() の戻り値（DailyDirections）。
//   dailyDirections.ts 自体・その判定ロジック・返す文字列の値は一切変更しない。
//
// 表記ゆれの正規化（ユーザー指示、2026-09-19）:
//   dailyDirections.ts は「東北」「北東」のように同じ方位を指す語順違いの
//   表記をそのまま返す（原文の表記をそのまま採用しているため）。
//   専門家向け /takujitsu の DIRECTION_TO_SLOT（src/app/takujitsu/page.tsx）と
//   同じ考え方で、一般版専用の対応表をここに持つ（/takujitsu 側のファイルは
//   参照・変更しない。一般版独自に同じ発想で再実装したもの）。
//   東北・北東→北東、東南・南東→南東、西南・南西→南西、西北・北西→北西。
//   これは表示上の正規化だけであり、方位判定そのものではない。
//
// 吉凶が重なる場合（ユーザー指示、重要）:
//   同じ区画に喜神・財神・太歳・五鬼のうち複数が乗っても、統合・優先順位付け・
//   多数決・点数化は一切行わない。buildDirectionWheelMarkers() は該当する
//   マーカーを配列にそのまま積むだけで、「吉凶混在」等の新しい判定ラベルは
//   作らない。
//
// 太歳休止日・中宮:
//   taisui が null（休止日）の場合は何も配置しない（「太歳なし」等の新しい
//   表示文言は作らない）。taisui が「中宮」の場合は円盤中央（CENTER）の
//   区画にそのまま配置する（省略しない）。

import type { DailyDirections } from "@/lib/takujitsu/dailyDirections";

export type DirectionWheelSlot = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "CENTER";

/** 円盤の9区画（八方位＋中宮）の表示順。 */
export const DIRECTION_WHEEL_SLOTS: readonly DirectionWheelSlot[] = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW", "CENTER",
];

/** 区画ごとの表示名（ユーザー指示の文言）。 */
export const DIRECTION_SLOT_LABEL: Record<DirectionWheelSlot, string> = {
  N: "北",
  NE: "北東",
  E: "東",
  SE: "南東",
  S: "南",
  SW: "南西",
  W: "西",
  NW: "北西",
  CENTER: "中宮",
};

/**
 * dailyDirections.ts が返す方位文字列（原文の表記ゆれを含む）→円盤区画。
 * 表示専用の対応づけであり、dailyDirections.ts の値・判定は変更しない。
 */
const DIRECTION_STRING_TO_SLOT: Readonly<Record<string, DirectionWheelSlot>> = {
  "北": "N",
  "南": "S",
  "東": "E",
  "西": "W",
  "東北": "NE",
  "北東": "NE",
  "東南": "SE",
  "南東": "SE",
  "西南": "SW",
  "南西": "SW",
  "西北": "NW",
  "北西": "NW",
  "中宮": "CENTER",
};

export type DirectionMarkerTone = "good" | "bad";

export interface DirectionMarker {
  /** 一般向けバッジ表示（例:「喜神・吉」）。ユーザー指示の文言をそのまま使う。 */
  label: string;
  tone: DirectionMarkerTone;
}

/**
 * calculateDailyDirections() の戻り値を、円盤9区画ごとのマーカー一覧へ
 * 変換する。既存データ（喜神・財神＝吉、太歳・五鬼＝凶）をそのまま並べる
 * だけで、統合・優先順位付け・多数決・点数化は一切行わない。
 */
export function buildDirectionWheelMarkers(
  directions: DailyDirections,
): Record<DirectionWheelSlot, DirectionMarker[]> {
  const bySlot: Record<DirectionWheelSlot, DirectionMarker[]> = {
    N: [], NE: [], E: [], SE: [], S: [], SW: [], W: [], NW: [], CENTER: [],
  };

  function place(value: string | null, marker: DirectionMarker) {
    if (!value) return; // 太歳休止日など「方位なし」は何も置かない
    const slot = DIRECTION_STRING_TO_SLOT[value];
    if (!slot) return;
    bySlot[slot].push(marker);
  }

  place(directions.xishen, { label: "喜神・吉", tone: "good" });
  place(directions.caishen, { label: "財神・吉", tone: "good" });
  place(directions.taisui, { label: "太歳・凶", tone: "bad" });
  place(directions.wugui, { label: "五鬼・凶", tone: "bad" });

  return bySlot;
}
