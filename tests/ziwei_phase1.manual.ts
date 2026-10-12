// tests/ziwei_phase1.manual.ts
//
// 紫微斗数 Phase 1 作盤エンジン（src/lib/ziwei/）の照合テスト。
// 実行: npx tsx tests/ziwei_phase1.manual.ts
//
// 照合方針:
//   1. fixture（docs/ziwei-fixtures-candidate.json・tests/fixtures/ziwei_hayami_1926_2000.json）のうち
//      needs_review: false だけを正解として使う。needs_review: true の項目は照合しない
//      （命盤Aの禄存星 U9・財帛宮の大限 D12、命盤Bの天馬星 U10・S表示、早見表 1989/8/1 U14）。
//      命盤A（小田原・表2に掲載なし）・命盤B（出生地の記載なし）は地点を推測せず、
//      表2の全地点で資料どおりになることを確認する。
//   2. 仕様書 docs/ziwei-basic-spec.md の表（表3〜表14）と、src/lib/ziwei の表データ・規則式を全セル照合する。
//   3. 星の旺衰（§20）: 旺衰表252セル（仕様書 §20.4）、入門の主星基本パターン図168件、命盤Aの旺衰表示
//      （火星・巳は資料の命盤が needs_review のため旺衰表の得地を正解）、旺衰表がない星は表示なし。
//   4. 確定仕様の境界（§2.4 旧U4・旧U17、§2.5・§2.6 旧U6、§2.7 サマータイム、§2.8 の例）を確認する。
//   不一致はロジックを変えずに FAIL として報告する。

import { readFileSync } from "node:fs";
import fixture from "../docs/ziwei-fixtures-candidate.json";
import hayami from "./fixtures/ziwei_hayami_1926_2000.json";
import {
  BUREAUS,
  TABLE2_PLACES,
  birthMonthOf,
  calculateZiweiChart,
  correctBirthTime,
  dayunOf,
  fiveElementBureauOf,
  hourBranchOf,
  hourStarsOf,
  judgeLeapHalf,
  kazoeAge,
  lunarDateOf,
  mainStarsOf,
  mingPalaceOf,
  monthStarsOf,
  arrangePalaces,
  resolveChartDate,
  shenPalaceOf,
  transformationTarget,
  xiaoxianAt,
  xiaoxianOf,
  yearBranchStarsOf,
  yearStemStarsOf,
  ziweiTableLookup,
  starStrengthOf,
  PLACED_STARS,
  SOURCE_STRENGTH_CHAR,
  STRENGTH_SHORT,
} from "../src/lib/ziwei";
import type { Branch, BureauName, CivilDate, LunarDate, PlacedStar, Sex, Stem, TransformationKind } from "../src/lib/ziwei";

// ---------------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------------

const counts = new Map<string, { pass: number; fail: number }>();
const failures: string[] = [];

function check(category: string, label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const c = counts.get(category) ?? { pass: 0, fail: 0 };
  if (ok) c.pass += 1;
  else {
    c.fail += 1;
    failures.push(`  [${category}] ${label}: 期待=${JSON.stringify(expected)} 実測=${JSON.stringify(actual)}`);
  }
  counts.set(category, c);
}

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const STEMS = "甲乙丙丁戊己庚辛壬癸".split("") as Stem[];

// ---------------------------------------------------------------------------
// 1. 完成命盤（needs_review: false の項目のみ。表2の全地点）
// ---------------------------------------------------------------------------

interface ChartFixture {
  id: string;
  birth: { year: number; month: number; day: number; hour: number; minute: number };
  sex: string;
  expected: {
    lunar: { yearStem: string; yearBranch: string; month: number; day: number; isLeapMonth: boolean };
    hourBranch: string;
    bureau: string;
    mingPalace: string;
    shenPalace: string;
    palaces: { branch: string; name: string; stars: string[]; dayun: { value: string; needs_review: boolean } }[];
    transformations: Record<string, string>;
    kazoeAge?: { target: CivilDate; age: number };
  };
  excludeStars: string[];
}

for (const fx of fixture.charts as ChartFixture[]) {
  const cat = `完成命盤${fx.id}`;
  for (const place of TABLE2_PLACES) {
    const chart = calculateZiweiChart({ birth: fx.birth, place, sex: fx.sex as Sex });
    const tag = `${fx.id}/${place}`;
    const e = fx.expected;
    check(cat, `${tag} 陰暦`, {
      yearStem: chart.yearStem,
      yearBranch: chart.yearBranch,
      month: chart.lunar.month,
      day: chart.lunar.day,
      isLeapMonth: chart.lunar.isLeapMonth,
    }, e.lunar);
    check(cat, `${tag} 生時支`, chart.hourBranch, e.hourBranch);
    check(cat, `${tag} 五行局`, chart.bureau.name, e.bureau);
    check(cat, `${tag} 命宮`, chart.mingPalace, e.mingPalace);
    check(cat, `${tag} 身宮`, chart.shenPalace, e.shenPalace);
    for (const p of e.palaces) {
      const actual = chart.palaces.find((x) => x.branch === p.branch)!;
      check(cat, `${tag} ${p.branch}宮の宮名`, actual.name, p.name);
      // needs_review の星（excludeStars）は実測・期待の両方から除く
      const stars = actual.stars.filter((s) => !fx.excludeStars.includes(s)).slice().sort();
      const expectedStars = p.stars.filter((s) => !fx.excludeStars.includes(s)).slice().sort();
      check(cat, `${tag} ${p.branch}宮の星`, stars, expectedStars);
      if (!p.dayun.needs_review) {
        const shown = p.dayun.value.includes("-")
          ? `${actual.dayun.startAge}-${actual.dayun.endAge}`
          : `${actual.dayun.startAge}`;
        check(cat, `${tag} ${p.branch}宮の大限`, shown, p.dayun.value.replace(/^0/, ""));
      }
    }
    for (const [kind, star] of Object.entries(e.transformations)) {
      const t = chart.transformations.find((x) => x.kind === (kind as TransformationKind))!;
      check(cat, `${tag} ${kind}`, [t.star, t.branch], [star, chart.starPositions[star as PlacedStar]]);
    }
    if (e.kazoeAge) {
      check(cat, `${tag} 数え年`, kazoeAge(chart.lunar.lunarYear, e.kazoeAge.target), e.kazoeAge.age);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. 主星配置パターン（入門 p.108–119）
// ---------------------------------------------------------------------------

for (const p of fixture.mainStarPatterns) {
  if (p.needs_review) continue;
  check("主星配置パターン", `${p.id} 紫微星=${p.ziwei}`, mainStarsOf(p.ziwei as Branch), p.mainStars);
}

// ---------------------------------------------------------------------------
// 3. 陰暦変換例（入門 p.11・p.12・p.27・p.106）。作盤日をそのまま陰暦に変換する（§2.8 手順6）。
// ---------------------------------------------------------------------------

interface LunarExampleFixture {
  id: string;
  needs_review: boolean;
  date?: CivilDate;
  expected?: Record<string, unknown>;
  birthDate?: CivilDate;
  kazoe?: { target: CivilDate; age: number }[];
}
const NOON = { year: 0, month: 0, day: 0, hour: 12, minute: 0, second: 0 };
for (const l of fixture.lunarExamples as LunarExampleFixture[]) {
  if (l.needs_review) continue;
  if (l.kazoe && l.birthDate) {
    const birthLunarYear = lunarDateOf(l.birthDate).lunarYear;
    for (const k of l.kazoe) {
      check("陰暦変換例", `${l.id} 数え年 ${k.target.year}/${k.target.month}/${k.target.day}`, kazoeAge(birthLunarYear, k.target), k.age);
    }
    continue;
  }
  if (!l.date || !l.expected) throw new Error(`陰暦変換例 ${l.id}: date/expected がありません`);
  const date = l.date;
  const expected = l.expected;
  const lunar = lunarDateOf(date);
  const leapHalf = judgeLeapHalf(lunar, { ...NOON, ...date }, false);
  const actual: Record<string, unknown> = {
    lunarMonth: lunar.month,
    lunarDay: lunar.day,
    isLeapMonth: lunar.isLeapMonth,
    yearStem: lunar.yearStem,
    yearBranch: lunar.yearBranch,
    leapHalf,
    birthMonth: birthMonthOf(lunar, leapHalf),
    birthDay: lunar.day,
  };
  const picked = Object.fromEntries(Object.keys(expected).map((k) => [k, actual[k]]));
  check("陰暦変換例", `${l.id} ${date.year}/${date.month}/${date.day}`, picked, expected);
}

// ---------------------------------------------------------------------------
// 4. 新暦旧暦換算早見表（入門 p.107、1926〜2000年の各月1日）。needs_review（1989/8/1）は除外。
// ---------------------------------------------------------------------------

let hayamiSkipped = 0;
for (const r of hayami.rows) {
  if (r.needs_review) {
    hayamiSkipped += 1;
    continue;
  }
  const lunar = lunarDateOf(r.date);
  check("早見表", `${r.date.year}/${r.date.month}/1`, [lunar.month, lunar.day], [r.lunarMonth, r.lunarDay]);
}

// ---------------------------------------------------------------------------
// 5. 仕様書の表との全セル照合
// ---------------------------------------------------------------------------

const spec = readFileSync(new URL("../docs/ziwei-basic-spec.md", import.meta.url), "utf8");

/** anchor の後で、見出し行が headerStart で始まる最初の表を行×列の文字列で返す（区切り行は除く）。 */
function specTable(anchor: string, headerStart: string): string[][] {
  const from = spec.indexOf(anchor);
  if (from < 0) throw new Error(`仕様書に見つからない: ${anchor}`);
  const lines = spec.slice(from).split("\n");
  const start = lines.findIndex((l) => l.startsWith(headerStart));
  const rows: string[][] = [];
  for (let i = start; i < lines.length && lines[i].startsWith("|"); i += 1) {
    if (/^\|[-| ]+\|$/.test(lines[i])) continue;
    rows.push(lines[i].slice(1, -1).split("|").map((c) => c.trim()));
  }
  return rows;
}

// 表3 命宮・身宮
for (const [anchor, fn, name] of [
  ["表3 命宮（行=生時支、列=陰暦生月）", mingPalaceOf, "命宮"],
  ["表3 身宮（行=生時支、列=陰暦生月）", shenPalaceOf, "身宮"],
] as const) {
  const t = specTable(anchor, "| 生時支");
  for (const row of t.slice(1)) {
    const h = row[0] as Branch;
    for (let m = 1; m <= 12; m += 1) check("仕様書の表", `表3 ${name} ${h}時 ${m}月`, fn(m, h), row[m]);
  }
}

// 表4 十二宮
{
  const t = specTable("表4（全セル一致確認済）", "| 命宮");
  const mings = t[0].slice(1) as Branch[];
  for (const row of t.slice(1)) {
    mings.forEach((ming, i) => {
      const palace = arrangePalaces(ming).find((p) => p.name === row[0])!;
      check("仕様書の表", `表4 命宮${ming} ${row[0]}`, palace.branch, row[i + 1]);
    });
  }
}

// 表5 五行局
{
  const t = specTable("## 6. 五行局", "| 生年干");
  const cols = t[0].slice(1); // 子・丑 など
  for (const row of t.slice(1)) {
    for (const stem of row[0].split("・") as Stem[]) {
      cols.forEach((pair, i) => {
        for (const b of pair.split("・") as Branch[]) {
          check("仕様書の表", `表5 ${stem} ${b}`, fiveElementBureauOf(stem, b).name, row[i + 1]);
        }
      });
    }
  }
}

// 表6 紫微星
{
  const t = specTable("## 7. 紫微星", "| 生日");
  const bureaus = t[0].slice(1) as BureauName[];
  for (const row of t.slice(1)) {
    bureaus.forEach((b, i) => check("仕様書の表", `表6 ${b} ${row[0]}日`, ziweiTableLookup(b, Number(row[0])), row[i + 1]));
  }
}

// 表7 十四主星
{
  const t = specTable("表7（紫微星の宮 → 各主星の宮）", "| 紫微星");
  const zs = t[0].slice(1) as Branch[];
  for (const row of t.slice(1)) {
    zs.forEach((z, i) => check("仕様書の表", `表7 紫微${z} ${row[0]}`, mainStarsOf(z)[row[0] as keyof ReturnType<typeof mainStarsOf>], row[i + 1]));
  }
}

// 表8 時系（生時支のみ）
{
  const t = specTable("### 9.1 生時支のみで決まる星", "| 星");
  for (const row of t.slice(1)) {
    BRANCHES.forEach((h, i) => check("仕様書の表", `表8 ${row[0]} ${h}時`, hourStarsOf(h, "子")[row[0] as "文昌星"], row[i + 2]));
  }
}

// 表8 火星・鈴星
{
  const t = specTable("### 9.2 生年支＋生時支で決まる星", "| 生年支");
  for (const row of t.slice(1)) {
    for (const y of row[0].split("・") as Branch[]) {
      BRANCHES.forEach((h, i) => check("仕様書の表", `表8 ${y}年 ${row[1]} ${h}時`, hourStarsOf(h, y)[row[1] as "火星"], row[i + 3]));
    }
  }
}

// 表9 月系
{
  const t = specTable("## 10. 月系諸星", "| 星");
  for (const row of t.slice(1)) {
    for (let m = 1; m <= 12; m += 1) check("仕様書の表", `表9 ${row[0]} ${m}月`, monthStarsOf(m)[row[0] as "左輔星"], row[m + 1]);
  }
}

// 表10 年干系・四化
{
  const t = specTable("### 11.1 宮に配置する星", "| 星");
  for (const row of t.slice(1)) {
    STEMS.forEach((s, i) => check("仕様書の表", `表10 ${row[0]} ${s}`, yearStemStarsOf(s)[row[0] as "禄存星"], row[i + 1]));
  }
  const q = specTable("### 11.2 四化", "| 化星");
  for (const row of q.slice(1)) {
    STEMS.forEach((s, i) =>
      check("仕様書の表", `表10 ${row[0]} ${s}`, transformationTarget(`${row[0]}星` as TransformationKind, s), `${row[i + 1]}星`),
    );
  }
}

// 表11 年支系
{
  const t = specTable("## 12. 年支系諸星", "| 星");
  for (const row of t.slice(1)) {
    BRANCHES.forEach((y, i) => check("仕様書の表", `表11 ${row[0]} ${y}年`, yearBranchStarsOf(y)[row[0] as "紅鸞星"], row[i + 2]));
  }
}

// 表14 大限（命宮を子に置き、十二宮ごとの年齢範囲を照合）
{
  const t = specTable("表14", "| 宮");
  const cols = t[0].slice(1); // 「水二 陽男陰女」など
  const bureauOf: Record<string, BureauName> = { 水二: "水二局", 木三: "木三局", 金四: "金四局", 土五: "土五局", 火六: "火六局" };
  for (const row of t.slice(1)) {
    cols.forEach((col, i) => {
      const [b, yy] = col.split(" ");
      // 陽男陰女の列は 甲年の男、陰男陽女の列は 乙年の男 で代表する
      const stem: Stem = yy === "陽男陰女" ? "甲" : "乙";
      const bureau = BUREAUS[bureauOf[b]];
      for (const sex of ["male", "female"] as Sex[]) {
        // 陽女・陰女は列の組み合わせが逆（陽女＝陰男陽女の列、陰女＝陽男陰女の列）
        const st: Stem = sex === "male" ? stem : stem === "甲" ? "乙" : "甲";
        const d = dayunOf({ yearStem: st, sex, bureau, mingPalace: "子" });
        const p = d.periods.find((x) => x.palace === row[0])!;
        check("仕様書の表", `表14 ${row[0]} ${col} ${sex}`, `${p.startAge}-${p.endAge}`, row[i + 1]);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 6. 確定仕様の境界（仕様書に明記した規則・例のみ）
// ---------------------------------------------------------------------------

// §2.6 旧U6: 時支は境界ちょうどから次の支
for (const [sec, b] of [
  [23 * 3600, "子"], [0, "子"], [3600 - 1, "子"], [3600, "丑"], [3 * 3600, "寅"], [21 * 3600, "亥"], [23 * 3600 - 1, "亥"],
] as const) {
  check("確定仕様の境界", `時支 ${sec}秒`, hourBranchOf(sec), b);
}

// §2.5 旧U6: 23:00 ちょうどから作盤日を翌日へ
check("確定仕様の境界", "作盤日 22:59:59", resolveChartDate({ year: 2024, month: 2, day: 9, hour: 22, minute: 59, second: 59 }), {
  chartDate: { year: 2024, month: 2, day: 9 },
  advancedAt23: false,
});
check("確定仕様の境界", "作盤日 23:00:00", resolveChartDate({ year: 2024, month: 2, day: 9, hour: 23, minute: 0, second: 0 }), {
  chartDate: { year: 2024, month: 2, day: 10 },
  advancedAt23: true,
});

// §2.8 の例（東京 +19分）: 2/9 23:30 と 2/10 00:30 はどちらも作盤日 2024/2/10・甲辰年1月1日
for (const [d, h] of [[9, 23], [10, 0]] as const) {
  const c = calculateZiweiChart({ birth: { year: 2024, month: 2, day: d, hour: h, minute: 30 }, place: "東京", sex: "male" });
  check("確定仕様の境界", `§2.8例 2024/2/${d} ${h}:30 東京`, [c.chartDate, c.yearStem + c.yearBranch, c.lunar.month, c.lunar.day], [
    { year: 2024, month: 2, day: 10 },
    "甲辰",
    1,
    1,
  ]);
}

// §2.4 旧U4・旧U17: 閏月の前半・後半
const leap = (day: number, monthLength: 29 | 30): LunarDate => ({
  lunarYear: 1995, yearStem: "乙", yearBranch: "亥", month: 8, isLeapMonth: true, day, monthLength,
});
const at = (h: number, m = 0) => ({ year: 1995, month: 1, day: 1, hour: h, minute: m, second: 0 });
check("確定仕様の境界", "閏月14日 前半", judgeLeapHalf(leap(14, 30), at(12), false), "前半");
check("確定仕様の境界", "閏月16日 後半", judgeLeapHalf(leap(16, 29), at(12), false), "後半");
check("確定仕様の境界", "30日の閏月 15日 22:59", judgeLeapHalf(leap(15, 30), at(22, 59), false), "前半");
check("確定仕様の境界", "29日の閏月 15日 10:59", judgeLeapHalf(leap(15, 29), at(10, 59), false), "前半");
check("確定仕様の境界", "29日の閏月 15日 11:00（境界ちょうど）", judgeLeapHalf(leap(15, 29), at(11, 0), false), "後半");
check("確定仕様の境界", "30日の閏月 14日23:30→15日（旧U17）", judgeLeapHalf(leap(15, 30), at(23, 30), true), "前半");
check("確定仕様の境界", "29日の閏月 14日23:30→15日（旧U17）", judgeLeapHalf(leap(15, 29), at(23, 30), true), "前半");

// §2.7 サマータイム（入門 p.12 の期間。両端の日を含む）と表2
check("確定仕様の境界", "サマータイム 1948/5/1", correctBirthTime({ year: 1948, month: 5, day: 1, hour: 12, minute: 0, second: 0 }, "大阪").summerTimeApplied, true);
check("確定仕様の境界", "サマータイム 1948/9/12", correctBirthTime({ year: 1948, month: 9, day: 12, hour: 12, minute: 0, second: 0 }, "大阪").summerTimeApplied, true);
check("確定仕様の境界", "サマータイム 1948/9/13", correctBirthTime({ year: 1948, month: 9, day: 13, hour: 12, minute: 0, second: 0 }, "大阪").summerTimeApplied, false);
check("確定仕様の境界", "補正 東京 1949/7/1 12:00", correctBirthTime({ year: 1949, month: 7, day: 1, hour: 12, minute: 0, second: 0 }, "東京").corrected, {
  year: 1949, month: 7, day: 1, hour: 11, minute: 19, second: 0,
});
check("確定仕様の境界", "補正 沖縄 2000/1/1 00:10", correctBirthTime({ year: 2000, month: 1, day: 1, hour: 0, minute: 10, second: 0 }, "沖縄").corrected, {
  year: 1999, month: 12, day: 31, hour: 23, minute: 40, second: 40,
});

// §14 小限（生年支と性別）
check("確定仕様の境界", "小限 辰年男 61歳", xiaoxianAt(xiaoxianOf("辰", "male"), 61), "戌");
check("確定仕様の境界", "小限 未年女 2歳", xiaoxianAt(xiaoxianOf("未", "female"), 2), "子");

// ---------------------------------------------------------------------------
// 7. 星の旺衰（§20）
// ---------------------------------------------------------------------------

// 旺衰表 252セル（仕様書 §20.4。「—」は空欄＝null）
{
  const t = specTable("### 20.4 参照表", "| 星");
  for (const row of t.slice(1)) {
    BRANCHES.forEach((b, i) => {
      const cell = row[i + 1];
      const expected = cell === "—" ? null : SOURCE_STRENGTH_CHAR[cell];
      check("旺衰", `表 ${row[0]} ${b}`, starStrengthOf(row[0] as PlacedStar, b), expected);
    });
  }
}

// 主星基本パターン図 168件（入門 p.108–119）。星の位置もエンジンの主星配置と一致すること
interface StrengthItem {
  star: PlacedStar;
  branch: Branch;
  strength: string;
  needs_review: boolean;
  adopted?: string;
}
const sfx = fixture.strengthFixtures as unknown as {
  mainStarPatterns: { id: string; ziwei: string; needs_review: boolean; items: StrengthItem[] }[];
  chartA: { items: StrengthItem[] };
  noStrengthStars: { stars: PlacedStar[] };
};
for (const p of sfx.mainStarPatterns) {
  if (p.needs_review) continue;
  const positions = mainStarsOf(p.ziwei as Branch);
  for (const it of p.items) {
    check("旺衰", `${p.id} ${it.star} 位置`, positions[it.star as keyof typeof positions], it.branch);
    check("旺衰", `${p.id} ${it.star}（${it.branch}）`, starStrengthOf(it.star, it.branch), SOURCE_STRENGTH_CHAR[it.strength]);
  }
}

// 命盤A の旺衰表示（needs_review の火星・巳は adopted＝旺衰表の値を正解）
{
  const a = (fixture.charts as ChartFixture[]).find((c) => c.id === "A")!;
  const chart = calculateZiweiChart({ birth: a.birth, place: "東京", sex: a.sex as Sex });
  for (const it of sfx.chartA.items) {
    const branch = chart.starPositions[it.star as PlacedStar];
    check("旺衰", `命盤A ${it.star} 位置`, branch, it.branch);
    const expected = it.needs_review ? it.adopted : SOURCE_STRENGTH_CHAR[it.strength];
    check("旺衰", `命盤A ${it.star}（${it.branch}）${it.needs_review ? "※needs_review" : ""}`, starStrengthOf(it.star, branch), expected);
  }
  check("旺衰", "命盤A 火星の表示", STRENGTH_SHORT[starStrengthOf("火星", "巳")!], "得");
  // 命盤Aで旺衰表示がない星（表に行がない星）は null
  for (const p of chart.palaces) {
    for (const star of p.stars) {
      if (sfx.noStrengthStars.stars.includes(star)) check("旺衰", `命盤A ${star} 表示なし`, starStrengthOf(star, p.branch), null);
    }
  }
}

// 旺衰表がない星（宮に配置する9星）は全十二支で null。四化は宮に配置する星ではないため参照対象外
for (const star of sfx.noStrengthStars.stars as PlacedStar[]) {
  check("旺衰", `${star} は PLACED_STARS`, PLACED_STARS.includes(star), true);
  BRANCHES.forEach((b) => check("旺衰", `表なし ${star} ${b}`, starStrengthOf(star, b), null));
}

// 表示の略記（得＝得地、利＝利益、平＝平和、不＝不得地）
check("旺衰", "表示の略記", STRENGTH_SHORT, { 廟: "廟", 旺: "旺", 得地: "得", 利益: "利", 平和: "平", 不得地: "不", 陥: "陥" });

// ---------------------------------------------------------------------------
// 結果
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
console.log("=== 紫微斗数 Phase 1 照合 ===");
for (const [cat, c] of counts) {
  console.log(`${cat.padEnd(12)} PASS ${c.pass} / FAIL ${c.fail}`);
  pass += c.pass;
  fail += c.fail;
}
console.log(`（早見表の needs_review 除外: ${hayamiSkipped} 件）`);
console.log(`\n合計: ${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log("\n--- 不一致（ロジックは変更せずそのまま報告） ---");
  for (const f of failures.slice(0, 200)) console.log(f);
  if (failures.length > 200) console.log(`  … ほか ${failures.length - 200} 件`);
  process.exit(1);
}
process.exit(0);
