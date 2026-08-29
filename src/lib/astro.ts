// src/lib/astro.ts
import * as Astronomy from "astronomy-engine";

function rad(deg: number) { return (deg * Math.PI) / 180; }
function deg(radVal: number) { return (radVal * 180) / Math.PI; }
function norm360(x: number) { x = x % 360; return x < 0 ? x + 360 : x; }

// ===== Julian Day (UTC) =====
function julianDayUTC(d: Date): number {
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth() + 1;
  const day =
    d.getUTCDate() +
    d.getUTCHours() / 24 +
    d.getUTCMinutes() / 1440 +
    d.getUTCSeconds() / 86400;

  let y2 = y;
  let m = m0;
  if (m <= 2) { y2 -= 1; m += 12; }
  const A = Math.floor(y2 / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y2 + 4716)) +
         Math.floor(30.6001 * (m + 1)) +
         day + B - 1524.5;
}

function centuriesSinceJ2000(d: Date): number {
  return (julianDayUTC(d) - 2451545.0) / 36525.0;
}

// ===== 地心黄経（共通）=====
function geoLon(body: Astronomy.Body, d: Date): number {
  const t = new Astronomy.AstroTime(d);
  const vec = Astronomy.GeoVector(body, t, false);
  const ecl = Astronomy.Ecliptic(vec);
  return norm360(ecl.elon);
}

// ===== Sun / Moon =====
export function sunLonDeg(d: Date): number {
  return geoLon(Astronomy.Body.Sun, d);
}
export function moonLonDeg(d: Date): number {
  return geoLon(Astronomy.Body.Moon, d);
}

// ===== Lunar nodes (斉藤国治) =====
export function lunarNodesMeanLonDeg(d: Date): { rahu: number; ketu: number } {
  const JD = julianDayUTC(d);
  const J = (JD - 2378496) / 36525;

  const OMG =
    33.272936 -
    1934.144694 * J +
    0.00208028 * J * J +
    0.00000208333 * J * J * J;

  const rahu = norm360(OMG);
  const ketu = norm360(OMG + 180);

  return { rahu, ketu };
}

// ===== Lunar perigee =====
export function lunarPerigeeLonDeg(d: Date): number {
  const JD = julianDayUTC(d);
  const J = (JD - 2378496) / 36525;

  const PNL =
    225.397325 +
    4069.053805 * J -
    0.0102869 * J * J -
    0.0000122222 * J * J * J;

  return norm360(PNL);
}

// ===== 紫炁 =====
export function ziQiLonDeg(d: Date): number {
  const jd = julianDayUTC(d);
  return norm360(0.035201691 * jd + 290.82);
}

// ===== Ascendant helpers =====
function meanObliquityDeg(T: number): number {
  const seconds =
    84381.448 -
    46.8150 * T -
    0.00059 * T * T +
    0.001813 * T * T * T;
  return seconds / 3600;
}

function gmstDeg(d: Date): number {
  const jd = julianDayUTC(d);
  const T = (jd - 2451545.0) / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return norm360(gmst);
}

/**
 * 標準のASC（上昇点）：
 * - lonDeg は「東経＝+」で受け取る（日本は +）
 * - θ = GMST + lonDeg（度）
 *
 * ※他ソフト比較で「経度符号を逆にしたい」場合は、
 *   呼び出し側で lonDeg を -lonDeg にして渡す。
 */
export function ascendantLonDeg(dLocal: Date, latDeg: number, lonDeg: number): number {
  const d = new Date(dLocal.getTime());
  const T = centuriesSinceJ2000(d);
  const eps = rad(meanObliquityDeg(T));
  const phi = rad(latDeg);

  const theta = rad(norm360(gmstDeg(d) + lonDeg)); // east-positive lon

  const y = Math.sin(theta) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps);
  const x = Math.cos(theta);

  const asc = Math.atan2(y, x);
  return norm360(deg(asc));
}

/**
 * MORIA比較用ASC：
 * - 計算式だけ差し替え（y/x の形）
 * - 経度符号の比較は呼び出し側で lonDeg を ± して行う
 */
export function ascendantLonDeg_MORIA(dLocal: Date, latDeg: number, lonDeg: number): number {
  const d = new Date(dLocal.getTime());
  const T = centuriesSinceJ2000(d);
  const eps = rad(meanObliquityDeg(T));
  const phi = rad(latDeg);

  const theta = rad(norm360(gmstDeg(d) + lonDeg)); // east-positive lon

  const y = Math.sin(theta);
  const x = Math.cos(theta) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps);

  const asc = Math.atan2(y, x);
  return norm360(deg(asc));
}

// ===== Seven planets =====
export function sevenPlanetsLonDeg(d: Date) {
  return [
    { id: "sun",     label: "日", lonDeg: sunLonDeg(d) },
    { id: "moon",    label: "月", lonDeg: moonLonDeg(d) },
    { id: "mercury", label: "水", lonDeg: geoLon(Astronomy.Body.Mercury, d) },
    { id: "venus",   label: "金", lonDeg: geoLon(Astronomy.Body.Venus, d) },
    { id: "mars",    label: "火", lonDeg: geoLon(Astronomy.Body.Mars, d) },
    { id: "jupiter", label: "木", lonDeg: geoLon(Astronomy.Body.Jupiter, d) },
    { id: "saturn",  label: "土", lonDeg: geoLon(Astronomy.Body.Saturn, d) },
  ];
}
