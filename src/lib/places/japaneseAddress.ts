// src/lib/places/japaneseAddress.ts
//
// 国内の住所表記を都道府県・市区町村に分ける（国土地理院の市区町村一覧で最長一致）。
// 「四日市市」「十日町市」「東村山市」のように名前の途中に市・町・村を含む自治体も一覧で正しく分けられる。

import data from "./gsiMunicipalities.json";
import type { JapaneseAddressParts } from "./types";

/** [自治体コード, 都道府県名, 市区町村名] */
const MUNICIPALITIES = data.municipalities as [string, string, string][];
const PREFECTURES = [...new Set(MUNICIPALITIES.map(([, p]) => p))];
const BY_PREFECTURE = new Map<string, string[]>();
for (const [, p, m] of MUNICIPALITIES) BY_PREFECTURE.set(p, [...(BY_PREFECTURE.get(p) ?? []), m]);
const BY_CODE = new Map(MUNICIPALITIES.map(([c, p, m]) => [c, { prefecture: p, municipality: m }]));

/** 自治体コード（国土地理院の addressCode。先頭0なし）から都道府県・市区町村を引く */
export function municipalityByCode(code: string): { prefecture: string; municipality: string } | null {
  return BY_CODE.get(code.replace(/^0+/, "")) ?? null;
}

function longestPrefix(s: string, candidates: readonly string[]): string | null {
  let best: string | null = null;
  for (const c of candidates) if (s.startsWith(c) && (best === null || c.length > best.length)) best = c;
  return best;
}

/** 都道府県で始まらない表記は null。市区町村が一覧に見つからなければ municipality は "" */
export function parseJapaneseAddress(text: string): JapaneseAddressParts | null {
  const s = text.replace(/[\s　]/g, "");
  const prefecture = longestPrefix(s, PREFECTURES);
  if (!prefecture) return null;
  const afterPref = s.slice(prefecture.length);
  const municipality = longestPrefix(afterPref, BY_PREFECTURE.get(prefecture) ?? []) ?? "";
  return { prefecture, municipality, rest: afterPref.slice(municipality.length) };
}
