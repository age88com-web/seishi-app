// src/lib/ouboin.ts

export type PalaceBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type OuboinStatus = "旺" | "廟" | "陥";

type OuboinMap = Record<string, Record<PalaceBranch, OuboinStatus>>;

export type OuboinMap = Record<string, Record<string, string>>;

export type OuboinMap = Record<string, Record<string, "旺" | "廟" | "陥">>;

function splitStars(cell: string): string[] {
  if (!cell) return [];
  return String(cell)
    .replace(/\s+/g, "")
    .split(/[、,]/)
    .filter(Boolean);
}

// src/lib/ouboin.ts
type OuboinStatus = "旺" | "廟" | "陥";
export type OuboinMap = Record<string, Record<string, OuboinStatus>>;

export function parseOuboinCSV(csv: string) {
  const lines = csv.trim().split(/\r?\n/);

  const header = lines[0].split(",").map(s => s.trim());
  const palaces = header.slice(1); // 子, 丑, 寅...

  const map: Record<string, Record<string, string>> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(s => s.trim());
    const type = cols[0]; // 旺 / 廟 / 陥

    for (let j = 1; j < cols.length; j++) {
      const cell = cols[j];
      if (!cell) continue;

      const palace = palaces[j - 1];
      const stars = splitStars(cell);

      for (const star of stars) {
        if (!map[star]) map[star] = {};
        map[star][palace] = type;
      }
    }
  }

  console.log("=== OUBOIN MAP ===", map);

  return map;
}
export function normalizePlanetKey(idOrLabel: string): string {
  const s = String(idOrLabel);

  const table: Record<string,string> = {
    sun:"日", moon:"月", mercury:"水", venus:"金", mars:"火", jupiter:"木", saturn:"土",
    "太陽":"日", "太陰":"月", "水星":"水", "金星":"金", "火星":"火", "木星":"木", "土星":"土",
    "日":"日","月":"月","水":"水","金":"金","火":"火","木":"木","土":"土",

    rahu: "羅喉",
    ketu: "計都",
    yuebo: "月孛",
    ziqi: "紫炁",

    "羅喉":"羅喉",
    "計都":"計都",
    "月孛":"月孛",
    "紫炁":"紫炁",
  };

  return table[s] ?? "";
}

export function getOuboinStatus(
  map: OuboinMap,
  planet: string,
  palace: PalaceBranch
): "" | OuboinStatus {
  const key = normalizePlanetKey(planet);
  if (!key) return "";
  return map[key]?.[palace] ?? "";
}

export function normalizeStarName(label: string): string {
  const s = String(label ?? "").trim();

  const map: Record<string, string> = {
    "日": "日",
    "太陽": "日",

    "月": "月",
    "太陰": "月",

    "水": "水",
    "水星": "水",

    "金": "金",
    "金星": "金",

    "火": "火",
    "火星": "火",

    "木": "木",
    "木星": "木",

    "土": "土",
    "土星": "土",

    "羅喉": "羅劫",
    "羅劫": "羅劫",

    "計都": "計都",
    "月孛": "月孛",
    "紫炁": "紫炁",
    "紫気": "紫炁",
  };

  return map[s] ?? s;
}