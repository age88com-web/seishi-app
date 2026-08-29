// src/lib/geom.ts
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 経度(deg) → 描画角(rad)
 * 0°を上(12時方向)、正方向は「時計回り」にする版
 */
export function angleFromLon(lonDeg: number): number {
  const lon = ((lonDeg % 360) + 360) % 360;
  return deg2rad(90 - lon);
}

/**
 * 経度(deg) → 描画角(rad)
 * 0°を上(12時方向)、正方向は「反時計回り」にする版
 */
export function angleFromLonCCW(lonDeg: number): number {
  const lon = ((lonDeg % 360) + 360) % 360;
  return deg2rad(lon - 90);
}

export function polar(cx: number, cy: number, r: number, angRad: number) {
  return {
    x: cx + r * Math.cos(angRad),
    y: cy + r * Math.sin(angRad),
  };
}
