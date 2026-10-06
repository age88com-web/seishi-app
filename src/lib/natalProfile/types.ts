// src/lib/natalProfile/types.ts
//
// 命術3種（七政四餘・紫微斗数・四柱推命）で共通の人物情報。
// 各占術固有の設定（紫微斗数の表2地点・四柱推命のp22地点／標準時オフセット・
// 七政四餘の昼夜／命宮方式など）はここに含めず、各ページ側で持つ。
// 各エンジンの入力型への変換は各ページの profileAdapter.ts が行う。

export type NatalGender = "male" | "female";

export interface CommonNatalProfile {
  /** 顧客DBの clients.id。未保存の新規入力は null */
  clientId: number | null;
  name: string;
  /** "YYYY-MM-DD" */
  birthDate: string;
  /** "HH:mm"（出生時刻不明でも入力欄の値は保持する） */
  birthTime: string;
  birthTimeUnknown: boolean;
  gender: NatalGender;
  /** 出生地の地名（自由入力） */
  birthPlace: string;
  latitude: number | null;
  longitude: number | null;
  /** 出生地の IANA timeZone */
  timeZone: string;
}

/** 七政四餘の従来の初期値（1990-01-01 12:00 東京都）に合わせる */
export const DEFAULT_NATAL_PROFILE: CommonNatalProfile = {
  clientId: null,
  name: "",
  birthDate: "1990-01-01",
  birthTime: "12:00",
  birthTimeUnknown: false,
  gender: "male",
  birthPlace: "東京都",
  latitude: 35.6895,
  longitude: 139.6917,
  timeZone: "Asia/Tokyo",
};

export const GENDER_LABEL: Readonly<Record<NatalGender, string>> = {
  male: "男",
  female: "女",
};
