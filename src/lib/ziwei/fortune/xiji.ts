// src/lib/ziwei/fortune/xiji.ts
//
// 四化星と宮の喜忌（基礎２ S36・S40）の記述の要約（原文は持たない。§35）。判定は xijiEvaluate.ts（§33。大限・小限のみ・己は needs_review）。

export const LIMIT_TYPES_SOURCE = {
  source: "紫微斗数基礎２",
  page: "S36",
  /** 記述の要約（原文は持たない） */
  summary: [
    "三方四正に殺破狼（七殺・破軍・貪狼）か機月同梁（天機・太陰・天同・天梁）があるかで二つのタイプに分かれる",
    "大限・小限の行運では、殺破狼の時期と機月同梁の時期が交互に巡る",
    "殺破狼の時期に凶となる四化は貪狼だけ、機月同梁の時期に凶となる四化は天機・太陰・天同",
  ],
} as const;

/** S40「四化星と宮の喜忌」の要約（大限・小限での宮の天干ごとの喜忌）。己の行は資料にない */
export const STEM_XIJI: readonly { stems: string; summary: string }[] = [
  { stems: "甲、乙", summary: "殺破狼を喜ぶ。三方四正に化禄・化権・化科があり化忌はない" },
  { stems: "丙", summary: "三方四正に必ず廉貞の化忌が会照する" },
  { stems: "丁", summary: "吉凶が半々。天相が刑忌夾印を形成する" },
  { stems: "戊", summary: "殺破狼を喜ぶ。貪狼の化禄が三方四正に会照する" },
  { stems: "庚", summary: "機月同梁が不利。天同に化忌" },
  { stems: "辛", summary: "機月同梁を喜ぶ" },
  { stems: "壬", summary: "紫微に化権、武曲に化忌。血を見る災いにはならない" },
  { stems: "癸", summary: "殺破狼を忌む。貪狼に化忌" },
];

export const STEM_XIJI_SOURCE = { source: "紫微斗数基礎２", page: "S40", heading: "四化星と宮の喜忌", usedForJudgement: true, appliesTo: ["major", "minor"] as const } as const;
