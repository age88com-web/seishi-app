// src/lib/ascendant.ts
// ASC（上昇点）の黄経（0-360°）を返す。tropical（春分点基準）。
// lonDeg: 東経＋（例: 東京 139.6917） / latDeg: 北緯＋（例: 35.6895）

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const norm360 = (x: number) => ((x % 360) + 360) % 360;

// ユリウス日（UTC）
function jdFromUTC(d: Date): number {
  const year = d.getUTCFullYear();
  let month = d.getUTCMonth() + 1;
  const day =
    d.getUTCDate() +
    (d.getUTCHours() + (d.getUTCMinutes() + d.getUTCSeconds() / 60) / 60) / 24;

  let Y = year;
  let M = month;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day +
    B -
    1524.5
  );
}

// 平均黄道傾斜（度） 近似（十分実用）
function meanObliquityDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  // arcsec
  const eps =
    84381.448 -
    46.8150 * T -
    0.00059 * T * T +
    0.001813 * T * T * T;
  return eps / 3600.0;
}

// GMST（度）
function gmstDeg(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
return norm360(Math.atan2(y, x) * RAD + 180);

// ASC 黄経（度）
export function ascendantLonDeg(utcDate: Date, lonDeg: number, latDeg: number): number {
  const jd = jdFromUTC(utcDate);
  const eps = meanObliquityDeg(jd) * DEG;

  // 地方恒星時（度→rad）
  const lst = norm360(gmstDeg(jd) + lonDeg) * DEG;

  const phi = latDeg * DEG;

  // 標準式：λ_asc = atan2( sin(θ), cos(θ)*cos(ε) - tan(φ)*sin(ε) )
  const y = Math.sin(lst);
  const x = Math.cos(lst) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps);

  const lam = Math.atan2(y, x) * RAD;
  return norm360(lam);
}