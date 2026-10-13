// tests/natal_profile_adapters.manual.ts
//
// 命術3種の共通入力UI・共通出生地UIで、各エンジンへ渡る入力と計算結果が変わらないことの確認。
//   - 紫微斗数: 旧UI（表2の地点を選択）の入力と、共通の出生地UIで確定した地点（表示名＋経度）から
//     profileAdapter が作る入力を比較する。表2の地点と同じ時差になる経度（135 + 表2の秒/240）なら命盤が一致すること。
//   - 四柱推命: 旧UI（p22 地点を選択）の入力と、共通の出生地UIの地点（表示名＋経度）から作る入力をエンジンに通し、
//     命式・格局判定が一致すること（市が p22 の地名なら表の値、そうでなければ経度。仕様 D7）。
//   - 七政四餘: ページ内で計算に使う date / time / lat / lon / sex / name が共通プロフィールの値そのものか。
//
// 実行: npx tsx tests/natal_profile_adapters.manual.ts

import { calculateZiweiChart, TABLE2_OFFSET_SECONDS } from "../src/lib/ziwei";
import type { Sex as ZiweiSex, Table2Place, ZiweiInput } from "../src/lib/ziwei";
import { calculateShichusuimei } from "../src/lib/shichusuimei";
import { assessKakkyoku } from "../src/lib/shichusuimei/kakkyoku";
import type { BirthPlace, Sex as ScSex, ShichusuimeiInput } from "../src/lib/shichusuimei";
import { DEFAULT_NATAL_PROFILE } from "../src/lib/natalProfile/types";
import type { CommonNatalProfile } from "../src/lib/natalProfile/types";
import { profileToZiweiInput } from "../src/app/ziwei/profileAdapter";
import { p22NameForBirthPlace, profileToShichusuimeiInput } from "../src/app/shichusuimei/profileAdapter";
import { profileToQizhengInput } from "../src/app/qizhengProfileAdapter";

let failures = 0;
let checks = 0;
function check(cond: boolean, label: string, detail?: unknown): void {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`NG: ${label}`, detail ?? "");
  }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- 共通化前の参照実装（src/app/ziwei/page.tsx・src/app/shichusuimei/page.tsx の旧 compute() の入力組み立て） ----

type OldZiweiForm = { date: string; time: string; sex: ZiweiSex; place: Table2Place };
function oldZiweiInput(f: OldZiweiForm): ZiweiInput | { error: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date);
  if (!d) return { error: "生年月日を入力してください" };
  const t = /^(\d{2}):(\d{2})$/.exec(f.time);
  if (!t) return { error: "出生時刻を入力してください" };
  return {
    birth: { year: Number(d[1]), month: Number(d[2]), day: Number(d[3]), hour: Number(t[1]), minute: Number(t[2]) },
    place: f.place,
    sex: f.sex,
  };
}

type OldScForm = {
  date: string;
  time: string;
  timeUnknown: boolean;
  sex: ScSex;
  p22Name: string;
  timeZone: string;
  longitude: string;
  standardOffset: string;
};
function oldScInput(f: OldScForm): ShichusuimeiInput | { error: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date);
  if (!d) return { error: "生年月日を入力してください" };
  const t = /^(\d{2}):(\d{2})$/.exec(f.time);
  if (!f.timeUnknown && !t) return { error: "出生時刻を入力してください（不明なら「時刻不明」）" };
  const place: BirthPlace = { timeZone: f.timeZone.trim() };
  if (f.p22Name) place.p22Name = f.p22Name;
  if (f.longitude.trim() !== "") place.longitude = Number(f.longitude);
  if (f.standardOffset.trim() !== "") place.standardOffsetMinutes = Math.round(Number(f.standardOffset) * 60);
  return {
    birth: {
      year: Number(d[1]),
      month: Number(d[2]),
      day: Number(d[3]),
      hour: f.timeUnknown ? null : Number(t![1]),
      minute: f.timeUnknown ? 0 : Number(t![2]),
    },
    place,
    sex: f.sex,
  };
}

function runZiwei(i: ZiweiInput | { error: string }) {
  if ("error" in i) return i;
  try {
    return calculateZiweiChart(i);
  } catch (e) {
    return { error: String(e) };
  }
}
function runSc(i: ShichusuimeiInput | { error: string }) {
  if ("error" in i) return i;
  try {
    const r = calculateShichusuimei(i);
    return { r, k: assessKakkyoku(r.meishiki.pillars) };
  } catch (e) {
    return { error: String(e) };
  }
}

// ---- 紫微斗数 ---------------------------------------------------------------

const ZIWEI_CASES: OldZiweiForm[] = [
  { date: "1955-10-16", time: "15:55", sex: "female", place: "東京" }, // 旧初期値（命盤A）
  { date: "1990-01-01", time: "12:00", sex: "male", place: "東京" },
  { date: "1948-06-15", time: "23:30", sex: "male", place: "沖縄" }, // サマータイム期間・23時
  { date: "1984-02-01", time: "00:10", sex: "female", place: "札幌" },
  { date: "2001-12-31", time: "23:59", sex: "male", place: "福岡" },
  { date: "1966-08-20", time: "11:00", sex: "female", place: "大阪" },
];
/** 表2の地点と同じ時差になる経度 */
const impliedLongitude = (p: Table2Place) => 135 + TABLE2_OFFSET_SECONDS[p] / 240;
/** 地点の指定方法だけが違う timeCorrection の項目（地点名・経度）を除いて比べる */
const chartWithoutPlace = (c: ReturnType<typeof runZiwei>) =>
  "error" in c ? c : { ...c, timeCorrection: { ...c.timeCorrection, place: undefined, longitude: undefined } };
for (const f of ZIWEI_CASES) {
  const profile: CommonNatalProfile = {
    ...DEFAULT_NATAL_PROFILE,
    birthDate: f.date,
    birthTime: f.time,
    gender: f.sex,
    birthPlace: `（表2 ${f.place} 相当の地点）`,
    longitude: impliedLongitude(f.place),
  };
  const r = profileToZiweiInput(profile);
  check("input" in r, `紫微 adapter 入力 ${f.date} ${f.time}`, r);
  if (!("input" in r)) continue;
  const old = oldZiweiInput(f);
  if ("error" in old) continue;
  check(same(r.input.birth, old.birth) && r.input.sex === old.sex, `紫微 生年月日時・性別一致 ${f.date} ${f.time}`);
  check(
    same(r.input.place, { name: profile.birthPlace, longitude: profile.longitude }),
    `紫微 出生地は共通UIの地点名と経度 ${f.place}`,
    r.input.place,
  );
  check(
    same(chartWithoutPlace(runZiwei(r.input)), chartWithoutPlace(runZiwei(old))),
    `紫微 命盤一致（表2 ${f.place} と同じ経度） ${f.date} ${f.time}`,
  );
}
check("error" in profileToZiweiInput({ ...DEFAULT_NATAL_PROFILE, birthTimeUnknown: true }), "紫微 時刻不明は作盤しない");
check("error" in profileToZiweiInput({ ...DEFAULT_NATAL_PROFILE, longitude: null }), "紫微 出生地未確定は作盤しない");
check("error" in profileToZiweiInput({ ...DEFAULT_NATAL_PROFILE, timeZone: "Europe/London" }), "紫微 海外出生は作盤しない");
{
  // 経度は秒まで: 既定の東京都（東経139.6917°）は +18分46秒（表2の東京 +19分00秒とは別の値になる）
  const r = profileToZiweiInput(DEFAULT_NATAL_PROFILE);
  const c = "input" in r ? runZiwei(r.input) : r;
  check(!("error" in c) && c.timeCorrection.placeOffsetSeconds === 18 * 60 + 46, "紫微 東京都 東経139.6917° → +18分46秒", c);
}

// ---- 四柱推命 ---------------------------------------------------------------

// 新UI: birthPlace は共通の出生地UIの表示名。p22 は表示名から決まる（旧UIで選んでいた p22 と同じになること）
type ScCase = { old: OldScForm; profile: Partial<CommonNatalProfile>; standardOffset: string };
const SC_CASES: ScCase[] = [
  // 旧初期値（講座 p51 1972/8/12 9:44 東京都）: 旧UIは経度空欄・p22=東京。新UIは経度も渡るが p22 が優先される
  {
    old: { date: "1972-08-12", time: "09:44", timeUnknown: false, sex: "M", p22Name: "東京", timeZone: "Asia/Tokyo", longitude: "", standardOffset: "" },
    profile: { birthPlace: "東京都", birthDate: "1972-08-12", birthTime: "09:44", gender: "male", longitude: 139.6917 },
    standardOffset: "",
  },
  {
    old: { date: "1985-03-05", time: "06:00", timeUnknown: false, sex: "F", p22Name: "札幌", timeZone: "Asia/Tokyo", longitude: "", standardOffset: "" },
    profile: { birthPlace: "北海道札幌市中央区", birthDate: "1985-03-05", birthTime: "06:00", gender: "female", longitude: 141.35 },
    standardOffset: "",
  },
  // 時刻不明
  {
    old: { date: "1960-02-04", time: "12:00", timeUnknown: true, sex: "M", p22Name: "大阪", timeZone: "Asia/Tokyo", longitude: "", standardOffset: "" },
    profile: { birthPlace: "大阪府大阪市北区", birthDate: "1960-02-04", birthTime: "12:00", birthTimeUnknown: true, gender: "male", longitude: 135.5 },
    standardOffset: "",
  },
  // 一覧にない国内地点（経度で地域差）
  {
    old: { date: "1999-07-07", time: "23:20", timeUnknown: false, sex: "F", p22Name: "", timeZone: "Asia/Tokyo", longitude: "136.63", standardOffset: "" },
    profile: { birthPlace: "石川県金沢市", birthDate: "1999-07-07", birthTime: "23:20", gender: "female", longitude: 136.63 },
    standardOffset: "",
  },
  // 海外（標準時オフセット必須）
  {
    old: { date: "1975-11-30", time: "14:15", timeUnknown: false, sex: "M", p22Name: "", timeZone: "Europe/London", longitude: "-0.1276", standardOffset: "0" },
    profile: { birthPlace: "London, England, United Kingdom", birthDate: "1975-11-30", birthTime: "14:15", gender: "male", longitude: -0.1276, timeZone: "Europe/London" },
    standardOffset: "0",
  },
];
for (const c of SC_CASES) {
  const profile: CommonNatalProfile = { ...DEFAULT_NATAL_PROFILE, ...c.profile };
  const r = profileToShichusuimeiInput(profile, { standardOffset: c.standardOffset });
  check("input" in r, `四柱 adapter 入力 ${c.old.date}`, r);
  if (!("input" in r)) continue;
  const old = oldScInput(c.old);
  check(same(runSc(r.input), runSc(old)), `四柱 命式一致 ${c.old.date} ${c.old.time} ${c.old.p22Name || c.old.longitude}`, {
    new: r.input,
    old,
  });
  // 経度以外の入力は旧UIと完全一致
  if (!("error" in old)) {
    const strip = (i: ShichusuimeiInput) => ({ ...i, place: { ...i.place, longitude: undefined } });
    check(same(strip(r.input), strip(old)), `四柱 入力一致（経度以外） ${c.old.date}`);
  }
}

// ---- 七政四餘 ---------------------------------------------------------------

{
  const p: CommonNatalProfile = {
    ...DEFAULT_NATAL_PROFILE,
    name: "山田太郎",
    birthDate: "1980-01-01",
    birthTime: "12:30",
    gender: "female",
    latitude: 35.4233,
    longitude: 136.7607,
  };
  const q = profileToQizhengInput(p);
  check(
    same(q, { name: "山田太郎", sex: "女", date: "1980-01-01", time: "12:30", lat: 35.4233, lon: 136.7607, unavailable: null }),
    "七政 入力値",
    q,
  );
  check(profileToQizhengInput({ ...p, birthTimeUnknown: true }).unavailable !== null, "七政 時刻不明は盤を出さない");
  check(profileToQizhengInput({ ...p, latitude: null }).unavailable !== null, "七政 緯度なしは盤を出さない");
  check(
    same(profileToQizhengInput(DEFAULT_NATAL_PROFILE), {
      name: "",
      sex: "男",
      date: "1990-01-01",
      time: "12:00",
      lat: 35.6895,
      lon: 139.6917,
      unavailable: null,
    }),
    "七政 既定値が共通化前の初期値と同じ",
  );
}

// ---- 四柱推命: 出生地の表示名 → p22 の地名 ----------------------------------

const P22_CASES: [string, string | null][] = [
  ["東京都", "東京"],
  ["東京都新宿区", "東京"],
  ["東京都千代田区", "東京"],
  ["東京都八王子市", null],
  ["愛知県名古屋市中区", "名古屋"],
  ["北海道札幌市", "札幌"],
  ["大阪府大阪市福島区", "大阪"],
  ["福島県福島市", "福島"],
  ["京都府京都市", "京都"],
  ["兵庫県明石市", "明石"],
  ["神奈川県横浜市中区", "横浜"],
  ["鹿児島県鹿児島市", "鹿児島"],
  ["沖縄県那覇市", "那覇"],
  ["和歌山県新宮市", "新宮"],
  ["福岡県新宮町", null],
  ["石川県金沢市", null], // D15: 金沢は表を使わず経度
  ["三重県四日市市", null],
  ["岐阜県大垣市", null],
  ["London, England, United Kingdom", null],
  ["", null],
];
for (const [place, want] of P22_CASES) {
  check(p22NameForBirthPlace(place) === want, `四柱 p22 判定 ${place || "（空）"} → ${want}`, p22NameForBirthPlace(place));
}

console.log(`${checks - failures}/${checks} OK`);
if (failures > 0) {
  console.error(`FAIL: ${failures}`);
  process.exit(1);
}
console.log("PASS");
