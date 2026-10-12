// src/lib/ziwei/meanings/fortune/data.ts
//
// 大限・小限における星曜の象意のデータ（stars.json の基礎編・入門の行運の文を scripts/ziwei/extract_fortune_stars.py で変換）。
// 大限・小限で共通の1データ。群は1項目。

import type { PlacedStar } from "../../types";
import raw from "./data/fortuneStars.json";
import type { FortuneStarItem } from "./types";

export const FORTUNE_STAR_ITEMS = raw.items as unknown as FortuneStarItem[];

/** 資料の星名の揺れ → 作盤エンジンの星名 */
export const FORTUNE_STAR_NAME_ALIASES = raw.meta.starNameAliases as Readonly<Record<string, string>>;

export function normalizeFortuneStarName(name: string): string {
  return FORTUNE_STAR_NAME_ALIASES[name] ?? name;
}

const BY_STAR = new Map<PlacedStar, FortuneStarItem>(FORTUNE_STAR_ITEMS.flatMap((i) => i.stars.map((s) => [s, i] as const)));

/** 星の行運星曜象意（群は群の項目）。記載のない星は null */
export function fortuneStarItemOf(star: PlacedStar): FortuneStarItem | null {
  return BY_STAR.get(star) ?? null;
}
