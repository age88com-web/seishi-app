// src/lib/places/types.ts
//
// 出生地検索（共通出生地UI BirthplaceInput）が返す地点情報。
// 計算結果ではなく「各占術の時差計算へ渡す地点」だけを表す。
// 時差の計算方法は占術ごとに別（七政四餘・紫微斗数・四柱推命それぞれの既存処理）で、ここでは扱わない。

export interface BirthplaceInfo {
  /** 表示名（国内: 「愛知県名古屋市中区」、海外: 「London, England, United Kingdom」） */
  displayName: string;
  /** 都道府県（海外は州・地域。不明なら ""） */
  prefecture: string;
  /** 市区町村（国内: 「名古屋市中区」、海外: 都市名。不明なら ""） */
  municipality: string;
  latitude: number;
  longitude: number;
  /** ISO 3166-1 alpha-2（例: "JP"） */
  countryCode: string;
}

/** 国内の住所表記（「愛知県名古屋市中区…」）を都道府県・市区町村・それ以降に分けた結果 */
export interface JapaneseAddressParts {
  prefecture: string;
  municipality: string;
  /** 市区町村より後ろ（町名・大字など）。市区町村までの表記なら "" */
  rest: string;
}
