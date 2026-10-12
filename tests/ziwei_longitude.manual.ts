// tests/ziwei_longitude.manual.ts
//
// 紫微斗数の出生時刻補正を経度で行う方式（2026-10-02 仕様変更。表2「主要都市時差表」の一般化）の回帰テスト。
//   時差 ＝（出生地の経度 − 135°）× 4分（秒まで）。東はプラス、西はマイナス。サマータイムは該当期間のみ1時間戻す。
//   均時差は使わない。四柱推命の地方真太陽時・七政四餘の補正とは無関係。
//
//   1. 表2の既知地点: 表2の時差と同じになる経度（135 + 秒/240）で、表2の値と秒まで一致する（24地点すべて）。
//      ユーザー指定の例（東京 +19分00秒・愛知 +7分40秒・大阪 +1分56秒・福岡 −18分24秒・沖縄 −29分20秒）。
//   2. その経度で作った命盤が、表2の地点名で作った命盤と一致する
//      （補正出生時刻・陰暦・命宮・身宮・五行局・星配置・四化・大限・小限。地点名・経度の項目以外すべて）。
//      1926〜2000年の日時を広く取り（23時台・サマータイム期間を含む）、24地点×男女で確認する。
//   3. 秒の扱い（四捨五入）・符号・サマータイム・不正な経度。
//
// 実行: npx tsx tests/ziwei_longitude.manual.ts

import { calculateZiweiChart, correctBirthTime, longitudeOffsetSeconds, TABLE2_OFFSET_SECONDS, TABLE2_PLACES } from "../src/lib/ziwei";
import type { Table2Place, ZiweiChart } from "../src/lib/ziwei";

let failures = 0;
let checks = 0;
function check(cond: boolean, label: string, detail?: unknown): void {
  checks += 1;
  if (!cond) {
    failures += 1;
    if (failures <= 30) console.error(`NG: ${label}`, detail ?? "");
  }
}

const impliedLongitude = (p: Table2Place) => 135 + TABLE2_OFFSET_SECONDS[p] / 240;
const mmss = (sec: number) => `${sec < 0 ? "−" : "+"}${Math.floor(Math.abs(sec) / 60)}分${String(Math.abs(sec) % 60).padStart(2, "0")}秒`;

// ---- 1. 表2の既知地点 ----------------------------------------------------------

for (const p of TABLE2_PLACES) {
  check(longitudeOffsetSeconds(impliedLongitude(p)) === TABLE2_OFFSET_SECONDS[p], `表2 ${p}: 経度 ${impliedLongitude(p).toFixed(4)}° → ${mmss(TABLE2_OFFSET_SECONDS[p])}`);
}
// ユーザー指定の例（経度は小数4桁に丸めた値でも秒まで一致すること）
const EXAMPLES: [string, number, number][] = [
  ["東京", 139.75, 19 * 60],
  ["愛知", 136.9167, 7 * 60 + 40],
  ["大阪", 135.4833, 60 + 56],
  ["福岡", 130.4, -(18 * 60 + 24)],
  ["沖縄", 127.6667, -(29 * 60 + 20)],
];
for (const [name, lon, sec] of EXAMPLES) {
  check(longitudeOffsetSeconds(lon) === sec, `${name} 東経${lon}° → ${mmss(sec)}`, mmss(longitudeOffsetSeconds(lon)));
}

// ---- 2. 経度で作った命盤 ＝ 表2の地点名で作った命盤 ----------------------------------

const withoutPlace = (c: ZiweiChart) => ({ ...c, timeCorrection: { ...c.timeCorrection, place: null, longitude: null } });

const births: { year: number; month: number; day: number; hour: number; minute: number }[] = [
  { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, // 命盤A
  { year: 1948, month: 6, day: 15, hour: 23, minute: 30 }, // サマータイム期間・23時
  { year: 1951, month: 5, day: 6, hour: 0, minute: 20 }, // サマータイム期間・日付の戻り
  { year: 1984, month: 2, day: 1, hour: 0, minute: 10 },
  { year: 2001, month: 12, day: 31, hour: 22, minute: 50 },
];
// 1926〜2000年を 389日おき・時刻を変えながら（約70件）
for (let ms = Date.UTC(1926, 0, 3, 0, 0), i = 0; ms < Date.UTC(2001, 0, 1); ms += 389 * 86_400_000, i += 1) {
  const d = new Date(ms);
  births.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: (i * 7) % 24, minute: (i * 13) % 60 });
}
let charts = 0;
for (const b of births) {
  for (const place of TABLE2_PLACES) {
    for (const sex of ["male", "female"] as const) {
      const byTable = calculateZiweiChart({ birth: b, place, sex });
      const byLon = calculateZiweiChart({ birth: b, place: { name: `${place}相当`, longitude: impliedLongitude(place) }, sex });
      charts += 1;
      check(
        JSON.stringify(withoutPlace(byLon)) === JSON.stringify(withoutPlace(byTable)),
        `命盤一致 ${JSON.stringify(b)} ${place} ${sex}`,
      );
      if (charts === 1) {
        check(byLon.timeCorrection.place === `${place}相当` && byLon.timeCorrection.longitude === impliedLongitude(place), "経度指定の地点名・経度を保持");
        check(byTable.timeCorrection.longitude === null, "表2指定は経度 null");
      }
    }
  }
}

// ---- 3. 秒・符号・サマータイム・不正値 ---------------------------------------------

check(longitudeOffsetSeconds(135) === 0 && Object.is(longitudeOffsetSeconds(135), 0), "東経135° → 0秒");
check(longitudeOffsetSeconds(139.6917) === 18 * 60 + 46, "東経139.6917°（東京都庁）→ +18分46秒（秒まで・四捨五入）");
check(longitudeOffsetSeconds(136.9103) === 7 * 60 + 38, "東経136.9103°（名古屋市中区）→ +7分38秒");
check(longitudeOffsetSeconds(134.9) === -24, "東経134.9° → −24秒（西はマイナス）");
check(longitudeOffsetSeconds(135.00208) === 0 && longitudeOffsetSeconds(135.00209) === 1, "0.5秒の境界は四捨五入");
{
  const legal = { year: 1948, month: 6, day: 15, hour: 12, minute: 0, second: 0 };
  const tc = correctBirthTime(legal, { name: "名古屋", longitude: 136.9103 });
  check(tc.summerTimeApplied && tc.corrected.hour === 11 && tc.corrected.minute === 7 && tc.corrected.second === 38, "サマータイム −1時間 ＋ 経度の時差", tc.corrected);
  const tc2 = correctBirthTime({ ...legal, year: 1960 }, { name: "名古屋", longitude: 136.9103 });
  check(!tc2.summerTimeApplied && tc2.corrected.hour === 12 && tc2.corrected.minute === 7, "期間外はサマータイムなし", tc2.corrected);
}
for (const bad of [Number.NaN, 181, -181, Number.POSITIVE_INFINITY]) {
  let threw = false;
  try {
    longitudeOffsetSeconds(bad);
  } catch {
    threw = true;
  }
  check(threw, `不正な経度 ${bad} はエラー`);
}

console.log(`命盤 ${charts} 件を比較`);
console.log(`${checks - failures}/${checks} OK`);
if (failures > 0) {
  console.error(`FAIL: ${failures}`);
  process.exit(1);
}
console.log("PASS");
