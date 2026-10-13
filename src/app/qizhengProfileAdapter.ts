// src/app/qizhengProfileAdapter.ts
//
// 共通プロフィール（CommonNatalProfile）→ 七政四餘ページ（src/app/page.tsx）が計算に使う入力値。
// 七政四餘の計算は従来どおりページ内で date / time / lat / lon / sex から行う（計算コードは変更しない）。
// 昼夜・命宮方式など七政四餘固有の設定はページ側に持つ。

import type { CommonNatalProfile } from "@/lib/natalProfile/types";

export interface QizhengInput {
  name: string;
  sex: "男" | "女";
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  time: string;
  /** 緯度経度が未入力のときは NaN（計算結果は表示しない） */
  lat: number;
  lon: number;
  /** 盤を表示できない理由（なければ null） */
  unavailable: string | null;
}

export function profileToQizhengInput(p: CommonNatalProfile): QizhengInput {
  const unavailable = p.birthTimeUnknown
    ? "七政四餘は出生時刻が必要です（時刻不明では星盤を作成できません）"
    : p.latitude === null || p.longitude === null
      ? "七政四餘は出生地の緯度・経度が必要です（「緯度経度」ボタンで地名から取得できます）"
      : null;
  return {
    name: p.name,
    sex: p.gender === "male" ? "男" : "女",
    date: p.birthDate,
    time: p.birthTime,
    lat: p.latitude ?? Number.NaN,
    lon: p.longitude ?? Number.NaN,
    unavailable,
  };
}
