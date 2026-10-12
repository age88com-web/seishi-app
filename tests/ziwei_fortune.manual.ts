// tests/ziwei_fortune.manual.ts
//
// 行運四化（src/lib/ziwei/fortune・src/lib/ziwei/palaceStems.ts）の確認。docs/ziwei-basic-spec.md §26。
// 実行: npx tsx tests/ziwei_fortune.manual.ts
//
// 確認: 宮干（五虎遁表60セル・資料の命盤4つ）・大限（宮・宮干・10干の四化・既存四化表と一致・星の所在宮）・
// 小限（数え年→既存の小限宮・宮干・四化・所在宮）・層（生年四化を変えない・生年＋大限＋小限の重複を保持・origin）・
// 基礎２ S38・S39 の大限四化の例。

import fs from "node:fs";
import {
  calculateZiweiChart,
  dayunAt,
  kazoeAge,
  sanfangSizheng,
  TRANSFORMATION_KINDS,
  transformationTarget,
  xiaoxianAt,
} from "../src/lib/ziwei";
import type { Branch, Stem, ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import {
  kazoeAgeOn,
  majorLimitTransformations,
  minorLimitTransformations,
  natalTransformations,
  palaceStemOf,
  palaceStemsOf,
  STEM_XIJI,
  transformationLayersByBranch,
  transformationsForStem,
} from "../src/lib/ziwei/fortune";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const STEMS = "甲乙丙丁戊己庚辛壬癸".split("") as Stem[];
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];
const FX = JSON.parse(fs.readFileSync("tests/fixtures/ziwei_fortune_examples.json", "utf8"));

// ---------------------------------------------------------------------------
// 1. 宮干
// ---------------------------------------------------------------------------
for (const c of FX.wuhudun.cells as { yearStems: string; branch: Branch; stem: Stem }[]) {
  for (const ys of c.yearStems.split("") as Stem[]) check(`五虎遁表 ${ys}・${c.branch} = ${c.stem}`, palaceStemOf(ys, c.branch) === c.stem, palaceStemOf(ys, c.branch));
}
const inputs = new Map<string, ZiweiInput>();
for (const p of FX.printedPalaceStems as { id: string; input: ZiweiInput; yearStem: Stem; stems: Record<Branch, Stem> }[]) {
  inputs.set(p.id, p.input);
  const chart = calculateZiweiChart(p.input);
  check(`${p.id} 生年干 ${p.yearStem}`, chart.yearStem === p.yearStem);
  const ps = palaceStemsOf(chart);
  check(`${p.id} 十二宮すべてに天干`, ps.length === 12 && new Set(ps.map((x) => x.branch)).size === 12);
  for (const x of ps) check(`${p.id} ${x.palace}（${x.branch}）の宮干＝印刷 ${p.stems[x.branch]}`, x.stem === p.stems[x.branch], x.stem);
}

// ---------------------------------------------------------------------------
// 2. 10干の四化＝既存の四化表
// ---------------------------------------------------------------------------
const chartA = calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" });
for (const st of STEMS) {
  const ts = transformationsForStem(chartA, st, "major");
  check(`${st} 四化4つ`, ts.length === 4 && ts.map((t) => t.kind).join() === TRANSFORMATION_KINDS.join());
  for (const t of ts) {
    check(`${st} ${t.kind} ＝ 既存の四化表`, t.star === transformationTarget(t.kind, st));
    check(`${st} ${t.kind} の星の所在宮`, chartA.starPositions[t.star] === t.branch && chartA.palaces.find((p) => p.branch === t.branch)!.name === t.palace);
  }
}
check("四化表は入門のまま（戊の化科＝右弼・壬の化科＝左輔）", transformationTarget("化科星", "戊") === "右弼星" && transformationTarget("化科星", "壬") === "左輔星");
check("四化の喜忌（S40）はデータとして保持（8行）", STEM_XIJI.length === 8);

// ---------------------------------------------------------------------------
// 3. 大限・小限（多数の盤面）
// ---------------------------------------------------------------------------
const charts: ZiweiChart[] = [];
for (let y = 1930; y <= 2010; y += 7) for (const m of [2, 6, 10]) charts.push(calculateZiweiChart({ birth: { year: y, month: m, day: 14, hour: (y + m) % 24, minute: 10 }, place: "東京", sex: (y + m) % 2 ? "male" : "female" }));
for (const chart of charts) {
  const natalBefore = JSON.stringify(chart.transformations);
  for (const period of chart.dayun.periods) {
    const r = majorLimitTransformations(chart, { period })!;
    const byAge = majorLimitTransformations(chart, { age: period.startAge + 5 })!;
    if (!(r.palaceBranch === period.branch && r.palaceStem === palaceStemOf(chart.yearStem, period.branch) && r.ageRange![0] === period.startAge)) check("大限の宮・宮干", false);
    if (JSON.stringify(byAge) !== JSON.stringify(r)) check("大限: 数え年からも同じ大限", false);
    if (r.transformations.some((t) => t.origin !== "major" || chart.starPositions[t.star] !== t.branch)) check("大限四化の所在宮", false);
  }
  // 数え1歳〜局数−1歳は資料の表の範囲外（§18 U8）。既存の dayunAt と同じく null
  check("大限: 表の範囲外は null", majorLimitTransformations(chart, { age: chart.bureau.number - 1 }) === null);
  for (let age = 1; age <= 100; age += 9) {
    const r = minorLimitTransformations(chart, age);
    if (!(r.palaceBranch === xiaoxianAt(chart.xiaoxian, age) && r.palaceStem === palaceStemOf(chart.yearStem, r.palaceBranch) && r.transformations.length === 4)) check("小限の宮・宮干・四化", false);
    if (r.transformations.some((t) => t.origin !== "minor" || chart.starPositions[t.star] !== t.branch)) check("小限四化の所在宮", false);
  }
  check("生年四化を変更しない", JSON.stringify(chart.transformations) === natalBefore);
}
check("大限・小限の盤面検査", true);

// 西暦の日付 → 数え年（既存 kazoeAge）
{
  const chart = calculateZiweiChart({ birth: { year: 1970, month: 12, day: 7, hour: 12, minute: 0 }, place: "東京", sex: "male" });
  // 入門 p.27 の例: 1970/12/7 生まれは 1971/1/26 まで1歳、1/27 から2歳
  check("数え年 1971/1/26 は1歳", kazoeAgeOn(chart, { year: 1971, month: 1, day: 26 }) === 1);
  check("数え年 1971/1/27 は2歳", kazoeAgeOn(chart, { year: 1971, month: 1, day: 27 }) === 2);
  check("kazoeAgeOn は既存 kazoeAge と同じ", kazoeAgeOn(chart, { year: 2000, month: 6, day: 1 }) === kazoeAge(chart.lunar.lunarYear, { year: 2000, month: 6, day: 1 }));
  const age = kazoeAgeOn(chart, { year: 2000, month: 6, day: 1 });
  check("日付から小限", minorLimitTransformations(chart, age).palaceBranch === xiaoxianAt(chart.xiaoxian, age));
}

// ---------------------------------------------------------------------------
// 4. 層（生年・大限・小限を統合しない）
// ---------------------------------------------------------------------------
{
  // 生年と大限で同じ星に四化が付く盤面・三層が同じ宮に重なる盤面を探す
  let natalMajorSameStar = false;
  let threeLayers = false;
  for (const chart of charts) {
    for (const period of chart.dayun.periods) {
      const major = majorLimitTransformations(chart, { period })!;
      if (major.transformations.some((m) => chart.transformations.some((n) => n.star === m.star))) {
        const layers = transformationLayersByBranch(chart, { major });
        const t = major.transformations.find((m) => chart.transformations.some((n) => n.star === m.star))!;
        const at = layers[t.branch].filter((x) => x.star === t.star);
        if (at.some((x) => x.origin === "natal") && at.some((x) => x.origin === "major")) natalMajorSameStar = true;
      }
      for (let age = period.startAge; age <= period.endAge && !threeLayers; age += 1) {
        const minor = minorLimitTransformations(chart, age);
        const layers = transformationLayersByBranch(chart, { major, minor });
        for (const b of BRANCHES) {
          const origins = new Set(layers[b].filter((x) => x.kind === "化忌星").map((x) => x.origin));
          if (origins.size === 3) threeLayers = true;
        }
      }
    }
  }
  check("生年＋大限の同じ星の四化を別々に保持", natalMajorSameStar);
  check("生年＋大限＋小限の化忌が同じ宮に重なっても3つ保持", threeLayers);
  const chart = charts[0];
  const major = majorLimitTransformations(chart, { period: chart.dayun.periods[1] })!;
  const minor = minorLimitTransformations(chart, 20);
  const layers = transformationLayersByBranch(chart, { major, minor });
  const all = BRANCHES.flatMap((b) => layers[b]);
  check("層の合計は 4×3＝12（統合しない）", all.length === 12);
  check("origin を区別", ["natal", "major", "minor"].every((o) => all.filter((x) => x.origin === o).length === 4));
  check("生年の層は chart.transformations のまま", JSON.stringify(natalTransformations(chart).map((t) => [t.kind, t.star, t.branch])) === JSON.stringify(chart.transformations.map((t) => [t.kind, t.star, t.branch])));
  // 三方四正: 既存 sanfangSizheng の支でそのまま引ける
  const sf = sanfangSizheng(major.palaceBranch);
  const inSf = [sf.self, sf.opposite, ...sf.trines].flatMap((b) => layers[b]);
  check("三方四正の層を既存 sanfangSizheng で引ける", inSf.every((t) => [sf.self, sf.opposite, ...sf.trines].includes(t.branch)));
}

// ---------------------------------------------------------------------------
// 5. 基礎２ の大限四化の例（S38・S39）
// ---------------------------------------------------------------------------
type MajorFx = {
  id: string;
  input: string;
  ageRange: [number, number];
  branch: Branch;
  stem: Stem;
  checks: { kind: string; star: string; branch: Branch; palace?: string }[];
  natalChecks?: { kind: string; star: string; branch: Branch }[];
  overlapWithNatal?: { kind: string; branch: Branch };
  inSanfangOfLimit?: Branch[];
};
for (const f of FX.majorLimits as MajorFx[]) {
  const chart = calculateZiweiChart(inputs.get(f.input)!);
  const period = dayunAt(chart.dayun, f.ageRange[0])!;
  check(`${f.id} 大限の年齢範囲 ${f.ageRange.join("〜")}`, period.startAge === f.ageRange[0] && period.endAge === f.ageRange[1]);
  const r = majorLimitTransformations(chart, { period })!;
  check(`${f.id} 大限宮 ${f.branch}`, r.palaceBranch === f.branch, r.palaceBranch);
  check(`${f.id} 大限宮干 ${f.stem}`, r.palaceStem === f.stem, r.palaceStem);
  for (const c of f.checks) {
    const t = r.transformations.find((x) => x.kind === c.kind)!;
    check(`${f.id} 大限${c.kind.replace(/星$/, "")}＝${c.star}（${c.branch}${c.palace ? `・${c.palace}` : ""}）`, t.star === c.star && t.branch === c.branch && (!c.palace || t.palace === c.palace), `${t.star} ${t.branch} ${t.palace}`);
  }
  for (const c of f.natalChecks ?? []) {
    const t = chart.transformations.find((x) => x.kind === c.kind)!;
    check(`${f.id} 生年${c.kind.replace(/星$/, "")}＝${c.star}（${c.branch}）`, t.star === c.star && t.branch === c.branch);
  }
  if (f.overlapWithNatal) {
    const layers = transformationLayersByBranch(chart, { major: r });
    const at = layers[f.overlapWithNatal.branch].filter((x) => x.kind === f.overlapWithNatal!.kind);
    check(`${f.id} ${f.overlapWithNatal.branch}に生年・大限の化忌が2つ`, at.length === 2 && at.some((x) => x.origin === "natal") && at.some((x) => x.origin === "major"));
  }
  if (f.inSanfangOfLimit) {
    const sf = sanfangSizheng(r.palaceBranch);
    check(`${f.id} ${f.inSanfangOfLimit.join()} は大限宮の三方四正`, f.inSanfangOfLimit.every((b) => [sf.opposite, ...sf.trines].includes(b)));
  }
}

const fail = failures.length;
console.log(`行運四化: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
