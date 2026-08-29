// src/lib/koku_rei_eiki.ts

export type Star =
  | "木星"
  | "火星"
  | "土星"
  | "金星"
  | "水星"
  | "紫炁"
  | "月孛"
  | "羅劫"
  | "計都";

export type Palace =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type KokuType = "受尅" | "失令" | "泄気";

export const KOKU_MAP: Record<Star, Partial<Record<Palace, KokuType[]>>> = {
  木星: build(["辰","酉"], ["申","酉","戌"], ["卯","戌"]),
  火星: build(["申","巳"], ["亥","子","丑"], ["子","丑"]),
  土星: build(["寅","亥"], ["寅","卯","辰"], ["辰","酉"]),
  金星: build(["卯","戌"], ["巳","午","未"], ["巳","申"]),
  水星: build(["子","丑"], [], ["寅","亥"]),
  紫炁: build(["辰","酉"], ["申","酉","戌"], ["卯","戌"]),
  月孛: build(["子","丑"], [], ["寅","亥"]),
  羅劫: build(["申","巳"], ["亥","子","丑"], ["子","丑"]),
  計都: build(["寅","亥"], ["寅","卯","辰"], ["辰","酉"]),
};

function build(
  koku: Palace[],
  rei: Palace[],
  eiki: Palace[]
): Partial<Record<Palace, KokuType[]>> {
  const map: Partial<Record<Palace, KokuType[]>> = {};

  for (const p of koku) push(map, p, "受尅");
  for (const p of rei)  push(map, p, "失令");
  for (const p of eiki) push(map, p, "泄気");

  return map;
}

function push(
  map: Partial<Record<Palace, KokuType[]>>,
  palace: Palace,
  type: KokuType
) {
  if (!map[palace]) map[palace] = [];
  map[palace]!.push(type);
}