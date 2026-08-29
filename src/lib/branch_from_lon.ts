// src/lib/branch_from_lon.ts
export function branchFromLon(lonDeg: number): string {
  const lon = ((lonDeg % 360) + 360) % 360;

  if (lon >= 240 && lon < 270) return "寅";
  if (lon >= 210 && lon < 240) return "卯";
  if (lon >= 180 && lon < 210) return "辰";
  if (lon >= 150 && lon < 180) return "巳";
  if (lon >= 120 && lon < 150) return "午";
  if (lon >= 90  && lon < 120) return "未";
  if (lon >= 60  && lon < 90 ) return "申";
  if (lon >= 30  && lon < 60 ) return "酉";
  if (lon >= 0   && lon < 30 ) return "戌";
  if (lon >= 330 && lon < 360) return "亥";
  if (lon >= 300 && lon < 330) return "子";
  if (lon >= 270 && lon < 300) return "丑";

  return "";
}