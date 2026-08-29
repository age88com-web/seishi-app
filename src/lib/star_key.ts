// src/lib/star_key.ts
export type StarKey =
  | "日" | "月" | "水" | "金" | "火" | "木" | "土"
  | "羅劫" | "計都" | "月孛" | "紫炁";

export function normalizeStarKey(label: string): StarKey | string {
  const s = String(label || "").trim();

  const map: Record<string, StarKey> = {
    "日": "日", "太陽": "日",
    "月": "月", "太陰": "月",
    "水": "水", "水星": "水",
    "金": "金", "金星": "金",
    "火": "火", "火星": "火",
    "木": "木", "木星": "木",
    "土": "土", "土星": "土",
    "羅喉": "羅劫", "羅劫": "羅劫",
    "計都": "計都",
    "月孛": "月孛",
    "紫炁": "紫炁", "紫気": "紫炁",
  };

  return map[s] ?? s;
}