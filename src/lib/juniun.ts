export const GANSHI_TO_NAON: Record<string, "木" | "火" | "土" | "金" | "水"> = {
  "甲子": "金", "乙丑": "金",
  "甲午": "金", "乙未": "金",
  "丙子": "水", "丁丑": "水",
  "丙午": "水", "丁未": "水",
  "戊子": "火", "己丑": "火",
  "戊午": "火", "己未": "火",
  "庚子": "土", "辛丑": "土",
  "庚午": "土", "辛未": "土",
  "壬子": "木", "癸丑": "木",
  "壬午": "木", "癸未": "木",

  "甲寅": "水", "乙卯": "水",
  "甲申": "水", "乙酉": "水",
  "丙寅": "火", "丁卯": "火",
  "丙申": "火", "丁酉": "火",
  "戊寅": "土", "己卯": "土",
  "戊申": "土", "己酉": "土",
  "庚寅": "木", "辛卯": "木",
  "庚申": "木", "辛酉": "木",
  "壬寅": "金", "癸卯": "金",
  "壬申": "金", "癸酉": "金",

  "甲辰": "火", "乙巳": "火",
  "甲戌": "火", "乙亥": "火",
  "丙辰": "土", "丁巳": "土",
  "丙戌": "土", "丁亥": "土",
  "戊辰": "木", "己巳": "木",
  "戊戌": "木", "己亥": "木",
  "庚辰": "金", "辛巳": "金",
  "庚戌": "金", "辛亥": "金",
  "壬辰": "水", "癸巳": "水",
  "壬戌": "水", "癸亥": "水",
};

// この定義：生年納音 → 長生の起点支
export const NAON_LONGSHENG_START: Record<"木" | "火" | "土" | "金" | "水", string> = {
  木: "亥",
  火: "寅",
  土: "申",
  金: "巳",
  水: "申",
};

// 十二運の並びは固定（ここを変えない）
export const JUNIUN_SEQ = ["長生","沐浴","冠帯","建禄","帝旺","衰","病","死","墓","絶","胎","養"] as const;

// 入力：生年干支（例 "乙巳"）
// 出力：各支（子〜亥）→十二運 の辞書
export function calcJuniun(yearGanzhi: string) {
  console.log("calcJuniun input:", yearGanzhi);

  const naon = GANSHI_TO_NAON[yearGanzhi];
  console.log("naon =", naon);
  if (!naon) return null;

  const startBranch = NAON_LONGSHENG_START[naon];
  if (!startBranch) return null;

  // 支の標準順（固定）
  const BR = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;

  const i0 = BR.indexOf(startBranch as any);
  if (i0 < 0) return null;

  const out: Record<string, string> = {};
  for (let k = 0; k < 12; k++) {
    const b = BR[k];
    const idx = (k - i0 + 12) % 12; // 「支の位置 − 長生起点の位置」
    out[b] = JUNIUN_SEQ[idx];
  }
  return out;
}