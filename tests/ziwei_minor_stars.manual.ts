// tests/ziwei_minor_stars.manual.ts
//
// 紫微斗数の新規諸星（src/lib/ziwei/minorStars、docs/ziwei-basic-spec.md §37）の照合テスト。
// 実行: npx tsx tests/ziwei_minor_stars.manual.ts
//
//   1. 既存34星の搭載状況（コードから抽出）と、新規諸星との名前の重複なし
//   2. 表9 時系諸星表（追加画像）× 既存エンジン（文昌・文曲・火星・鈴星・地劫・天空）の全セル
//   3. 表10 月系 × 既存（左輔・右弼・天姚・天馬）の全セル、表12 年干系 × 既存（禄存・擎羊・陀羅・天魁・天鉞・四化）、
//      表15 年支系 × 既存（紅鸞）
//   4. 転記した表の全ケースを、資料の表の並び（順行・逆行・周期・三合／方合のまとまり・註）で再確認（1セルずれの検出）
//   5. 日系（30日×基準の星12宮）・天才／天寿（命宮・身宮12×年支12）・博士（禄存12×順逆）・長生（5局×順逆）・旬空（60干支）
//   6. 基礎編 S19 命盤B（ソフト出力の命盤）に表示された諸星との照合（截空は source_conflict として差を記録）
//   7. 全盤面: 各星が1宮（旬空は2宮）・十二神／長生は12宮に1つずつ・同名異系列の別ID・ZiweiChart を変えない
//   8. 力量・格局・既存象意に新規星が入っていない、新規象意は独自文で全実装星にある
//   不一致はロジックを変えずに FAIL として報告する。

import {
  calculateZiweiChart,
  calculateChartPower,
  hourStarsOf,
  monthStarsOf,
  yearStemStarsOf,
  yearBranchStarsOf,
  transformationTarget,
  arrangePalaces,
  POWER_TABLE,
  PLACED_STARS,
  TABLE2_PLACES,
} from "../src/lib/ziwei";
import type { Branch, Stem, TransformationKind } from "../src/lib/ziwei";
import { STAR_LUCK } from "../src/lib/ziwei/patterns/luck";
import { evaluatePatterns } from "../src/lib/ziwei/patterns";
import { STAR_MEANINGS } from "../src/lib/ziwei/meanings/store";
import {
  MINOR_STARS,
  IMPLEMENTED_MINOR_STARS,
  MINOR_STAR_MEANINGS,
  calculateMinorStars,
  dayMinorStarsOf,
  branchMinorStarsOf,
  boshiOf,
  changshengOf,
  xunkongOf,
  jiekongOf,
  shangShiOf,
  mingShenZhuOf,
  existingStarInventory,
  findMinorStarsByName,
} from "../src/lib/ziwei/minorStars";
import {
  TABLE9_HOUR,
  TABLE10_MONTH,
  TABLE12_YEAR_STEM,
  TABLE12_TRANSFORMATIONS,
  TABLE15_YEAR_BRANCH,
  TABLE15_TIANCAI_PALACE,
  TABLE16_CHANGSHENG,
  TABLE18_XUNKONG,
  TABLE19,
  TABLE20_MINGZHU,
  TABLE21_SHENZHU,
} from "../src/lib/ziwei/minorStars/tables";

const counts = new Map<string, { pass: number; fail: number }>();
const failures: string[] = [];
const notes: string[] = [];

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
const bi = (b: string) => BRANCHES.indexOf(b as Branch);
const at = (i: number) => BRANCHES[((i % 12) + 12) % 12];
const ch = (row: string, i: number) => [...row][i];

// ---------------------------------------------------------------------------
// 1. 既存34星の搭載状況
// ---------------------------------------------------------------------------

const inv = existingStarInventory();
check("既存星マスター", "34星", inv.length, 34);
check("既存星マスター", "宮に置く30星", PLACED_STARS.length, 30);
const byFamily = new Map<string, number>();
for (const r of inv) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + 1);
check("既存星マスター", "系列別", Object.fromEntries(byFamily), { main: 14, birth_hour: 6, birth_month: 4, year_stem: 5, year_branch: 1, transformation: 4 });
for (const r of inv) {
  check("既存星マスター", `${r.name} 象意あり`, r.hasMeaning, true);
  check("既存星マスター", `${r.name} 新規諸星と名前が重複しない`, findMinorStarsByName(r.canonical).length + findMinorStarsByName(r.name).length, 0);
}
console.log("既存34星（コードから抽出）:");
for (const r of inv)
  console.log(
    `  ${r.name}\t${r.family}\t${r.basis}\t星級${r.grade}\t旺衰${r.hasStrength ? "○" : "—"}\t力量${r.hasPower ? "○" : "—"}\t格局:${r.patternLuck}\t四化対象:${r.transformationTarget.length ? r.transformationTarget.join(",") : "—"}`,
  );

// ---------------------------------------------------------------------------
// 2. 表9 時系 × 既存エンジン
// ---------------------------------------------------------------------------

const GROUPS: Record<string, Branch> = { 寅午戌: "寅", 申子辰: "子", 巳酉丑: "酉", 亥卯未: "卯" };
for (let h = 0; h < 12; h += 1) {
  for (const [g, yb] of Object.entries(GROUPS)) {
    const e = hourStarsOf(BRANCHES[h], yb);
    check("表9×既存", `文昌 ${BRANCHES[h]}時`, e.文昌星, ch(TABLE9_HOUR.文昌, h));
    check("表9×既存", `文曲 ${BRANCHES[h]}時`, e.文曲星, ch(TABLE9_HOUR.文曲, h));
    check("表9×既存", `地劫 ${BRANCHES[h]}時`, e.地劫星, ch(TABLE9_HOUR.地劫, h));
    check("表9×既存", `天空 ${BRANCHES[h]}時`, e.天空星, ch(TABLE9_HOUR.天空, h));
    check("表9×既存", `火星 ${g} ${BRANCHES[h]}時`, e.火星, ch(TABLE9_HOUR[`火星/${g}`], h));
    check("表9×既存", `鈴星 ${g} ${BRANCHES[h]}時`, e.鈴星, ch(TABLE9_HOUR[`鈴星/${g}`], h));
    // 三合グループの残り2支も同じ列
    for (const other of g) check("表9×既存", `火星 ${other}年 ${BRANCHES[h]}時`, hourStarsOf(BRANCHES[h], other as Branch).火星, e.火星);
  }
}
// 表9の各列が1時ごとに1宮ずつ進む（文昌・天空は逆行、それ以外は順行）
for (const [col, row] of Object.entries(TABLE9_HOUR)) {
  const dir = col === "文昌" || col === "天空" ? -1 : 1;
  for (let h = 1; h < 12; h += 1) check("表9 並び", `${col} ${BRANCHES[h]}`, ch(row, h), at(bi(ch(row, 0)) + dir * h));
}

// ---------------------------------------------------------------------------
// 3. 表10・表12・表15 × 既存エンジン
// ---------------------------------------------------------------------------

for (let m = 1; m <= 12; m += 1) {
  const e = monthStarsOf(m);
  check("表10×既存", `左輔 ${m}月`, e.左輔星, ch(TABLE10_MONTH.左輔, m - 1));
  check("表10×既存", `右弼 ${m}月`, e.右弼星, ch(TABLE10_MONTH.右弼, m - 1));
  check("表10×既存", `天姚 ${m}月`, e.天姚星, ch(TABLE10_MONTH.天姚, m - 1));
  check("表10×既存", `天馬 ${m}月`, e.天馬星, ch(TABLE10_MONTH.天馬, m - 1));
}
const STEM_EXISTING = { 禄存: "禄存星", 擎羊: "擎羊星", 陀羅: "陀羅星", 天魁: "天魁星", 天鉞: "天鉞星" } as const;
STEMS.forEach((s, i) => {
  const e = yearStemStarsOf(s);
  for (const [t, star] of Object.entries(STEM_EXISTING)) check("表12×既存", `${t} ${s}`, e[star], ch(TABLE12_YEAR_STEM[t], i));
  for (const [k, row] of Object.entries(TABLE12_TRANSFORMATIONS)) {
    const target = transformationTarget(`${k}星` as TransformationKind, s);
    check("表12×既存", `${k} ${s}`, target.replace(/星$/, ""), row[i]);
  }
});
BRANCHES.forEach((b, i) => check("表15×既存", `紅鸞 ${b}`, yearBranchStarsOf(b).紅鸞星, ch(TABLE15_YEAR_BRANCH.紅鸞, i)));

// ---------------------------------------------------------------------------
// 4. 転記した表の並び（新規星の全セル）
// ---------------------------------------------------------------------------

// 表10: 天刑は順行・天巫は4ヶ月周期・陰煞は6ヶ月周期（2宮ずつ逆行）・解神は2ヶ月ずつ同じ宮で2宮ずつ順行
for (let m = 0; m < 12; m += 1) {
  check("表10 並び", `天刑 ${m + 1}月`, ch(TABLE10_MONTH.天刑, m), at(9 + m));
  check("表10 並び", `天巫 ${m + 1}月`, ch(TABLE10_MONTH.天巫, m), ch(TABLE10_MONTH.天巫, m % 4));
  check("表10 並び", `陰煞 ${m + 1}月`, ch(TABLE10_MONTH.陰煞, m), at(2 - 2 * m));
  check("表10 並び", `解神 ${m + 1}月`, ch(TABLE10_MONTH.解神, m), at(8 + 2 * Math.floor(m / 2)));
}
// 天月は規則性がないため、表のセルを1つずつ固定値で確認（原画像から再転記）
check("表10 並び", "天月 12ヶ月", [...TABLE10_MONTH.天月].join(""), "戌巳辰寅未卯亥未寅午戌寅");
// 表12 天官・天福も規則性がないため固定値
check("表12 並び", "天官 10干", TABLE12_YEAR_STEM.天官, "未辰巳寅卯酉亥酉戌午");
check("表12 並び", "天福 10干", TABLE12_YEAR_STEM.天福, "酉申子亥卯寅午巳午巳");
// 表15: 天哭は逆行・天虚は順行（どちらも子年午）、龍池（辰起）順行・鳳閣（戌起）逆行・天喜（酉起）逆行＝紅鸞の対宮
for (let y = 0; y < 12; y += 1) {
  const T = TABLE15_YEAR_BRANCH;
  check("表15 並び", `天哭 ${BRANCHES[y]}`, ch(T.天哭, y), at(6 - y));
  check("表15 並び", `天虚 ${BRANCHES[y]}`, ch(T.天虚, y), at(6 + y));
  check("表15 並び", `竜池 ${BRANCHES[y]}`, ch(T.竜池, y), at(4 + y));
  check("表15 並び", `鳳閣 ${BRANCHES[y]}`, ch(T.鳳閣, y), at(10 - y));
  check("表15 並び", `天喜 ${BRANCHES[y]}`, ch(T.天喜, y), at(bi(ch(T.紅鸞, y)) + 6));
  // 孤辰・寡宿: 方合（亥子丑・寅卯辰・巳午未・申酉戌）ごとに同じ宮。孤辰＝次の方合の最初、寡宿＝前の方合の最後
  const season = Math.floor(((y + 1) % 12) / 3); // 亥子丑=0, 寅卯辰=1, 巳午未=2, 申酉戌=3
  check("表15 並び", `孤辰 ${BRANCHES[y]}`, ch(T.孤辰, y), at(2 + 3 * season));
  check("表15 並び", `寡宿 ${BRANCHES[y]}`, ch(T.寡宿, y), at(10 + 3 * season));
  check("表15 並び", `破砕 ${BRANCHES[y]}`, ch(T.破砕, y), ["巳", "丑", "酉"][y % 3]);
  // 蜚廉: 子丑寅→申酉戌、卯辰巳→巳午未、午未申→寅卯辰、酉戌亥→亥子丑（3支ずつ順行）
  check("表15 並び", `蜚廉 ${BRANCHES[y]}`, ch(T.蜚廉, y), at([8, 5, 2, 11][Math.floor(y / 3)] + (y % 3)));
}
check("表15 並び", "天才の宮名", TABLE15_TIANCAI_PALACE.join(""), "命宮父母宮福徳宮田宅宮官禄宮奴僕宮遷移宮疾厄宮財帛宮子女宮夫妻宮兄弟宮");
// 表16: 各行は長生から1宮ずつ（順＝順行、逆＝逆行）。水二局と土五局は同じ。長生の宮 水土＝申・木＝亥・金＝巳・火＝寅
const CS_START: Record<string, Branch> = { 水二局: "申", 木三局: "亥", 金四局: "巳", 土五局: "申", 火六局: "寅" };
for (const [key, row] of Object.entries(TABLE16_CHANGSHENG)) {
  const [bureau, dir] = key.split("/");
  for (let k = 0; k < 12; k += 1) check("表16 並び", `${key} ${k}`, ch(row, k), at(bi(CS_START[bureau]) + (dir === "順" ? k : -k)));
}
// 表18: 旬空＝甲子旬なら戌亥（年支−年干の番号で決まる）
STEMS.forEach((s, i) => {
  for (const [pair, row] of Object.entries(TABLE18_XUNKONG)) {
    const yb = ch(row, i);
    check("表18 並び", `${s}${yb}`, pair, at(bi(yb) - i + 10) + at(bi(yb) - i + 11));
  }
});
// 表19: 註「天傷は常に僕役宮、天使は常に疾厄宮」
BRANCHES.forEach((mp, i) => {
  const pal = arrangePalaces(mp);
  check("表19 註", `天傷 命宮${mp}`, ch(TABLE19.天傷, i), pal.find((p) => p.name === "奴僕宮")!.branch);
  check("表19 註", `天使 命宮${mp}`, ch(TABLE19.天使, i), pal.find((p) => p.name === "疾厄宮")!.branch);
  check("表19", `shangShiOf ${mp}`, shangShiOf(mp), { 天傷: ch(TABLE19.天傷, i), 天使: ch(TABLE19.天使, i) });
});
// 表20・表21
check("表20 命主", "12支", TABLE20_MINGZHU.join(","), "貪狼,巨門,禄存,文曲,廉貞,武曲,破軍,武曲,廉貞,文曲,禄存,巨門");
check("表21 身主", "12支", TABLE21_SHENZHU.join(","), "火星,天相,天梁,天同,文昌,天機,火星,天相,天梁,天同,文昌,天機");
for (let i = 1; i < 6; i += 1) check("表20 命主", `子午を軸に対称 ${i}`, TABLE20_MINGZHU[i], TABLE20_MINGZHU[12 - i]);
for (let i = 0; i < 6; i += 1) check("表21 身主", `6年周期 ${i}`, TABLE21_SHENZHU[i], TABLE21_SHENZHU[i + 6]);
check("表20・21", "命宮寅・年支辰", mingShenZhuOf("寅", "辰"), { mingZhu: "禄存", shenZhu: "文昌" });

// ---------------------------------------------------------------------------
// 5. 規則で数える星の全ケース（独立に1宮ずつ数えた結果と照合）
// ---------------------------------------------------------------------------

const walk = (start: Branch, steps: number, dir: 1 | -1) => {
  let i = bi(start);
  for (let k = 0; k < steps; k += 1) i += dir;
  return at(i);
};
for (let d = 1; d <= 30; d += 1) {
  for (const base of BRANCHES) {
    const r = dayMinorStarsOf(d, { 左輔: base, 右弼: base, 文昌: base, 文曲: base });
    check("表11 日系", `三台 ${base}起 ${d}日`, r.三台, walk(base, d - 1, 1));
    check("表11 日系", `八座 ${base}起 ${d}日`, r.八座, walk(base, d - 1, -1));
    check("表11 日系", `恩光 ${base}起 ${d}日`, r.恩光, walk(walk(base, d - 1, 1), 1, -1));
    check("表11 日系", `天貴 ${base}起 ${d}日`, r.天貴, walk(walk(base, d - 1, 1), 1, -1));
  }
}
for (const mp of BRANCHES)
  for (const sp of BRANCHES)
    BRANCHES.forEach((yb, y) => {
      const r = branchMinorStarsOf(yb, mp, sp);
      const pal = arrangePalaces(mp);
      check("表15 天才", `命宮${mp} ${yb}年`, r.天才, pal.find((p) => p.name === TABLE15_TIANCAI_PALACE[y])!.branch);
      check("表15 天寿", `身宮${sp} ${yb}年`, r.天寿, walk(sp, y, 1));
    });
for (const lu of BRANCHES)
  for (const fw of [true, false]) {
    const r = boshiOf(lu, fw);
    const order = ["博士", "力士", "青龍", "小耗", "将軍", "奏書", "飛廉", "喜神", "病符", "大耗", "伏兵", "官府"];
    order.forEach((n, k) => check("表13 博士", `禄存${lu} ${fw ? "順" : "逆"} ${n}`, r[n], walk(lu, k, fw ? 1 : -1)));
  }
for (const bureau of Object.keys(CS_START))
  for (const fw of [true, false]) {
    const r = changshengOf(bureau, fw);
    check("表16 長生", `${bureau} ${fw ? "順" : "逆"} 12宮が重複なし`, new Set(Object.values(r)).size, 12);
    check("表16 長生", `${bureau} ${fw ? "順" : "逆"} 長生`, r.長生, CS_START[bureau]);
  }
for (let i = 0; i < 60; i += 1) {
  const s = STEMS[i % 10];
  const b = BRANCHES[i % 12];
  check("表18 旬空", `${s}${b}`, xunkongOf(s, b), [at(bi(b) - (i % 10) + 10), at(bi(b) - (i % 10) + 11)]);
}
check("表17 截空", "10干", STEMS.map(jiekongOf).join(""), "申午辰寅子酉未巳卯丑");

// ---------------------------------------------------------------------------
// 6. 基礎編 S19 命盤B（1964/12/21 06:00 男）
// ---------------------------------------------------------------------------

const S19_SHOWN: Record<string, Branch[]> = {
  // 既存仕様書 §15.3 の転記（34星以外）のうち、今回実装した星
  "birth_month/天刑": ["未"], "birth_month/解神": ["午"], "birth_month/天巫": ["寅"], "birth_month/天月": ["戌"], "birth_month/陰煞": ["午"],
  "birth_day/三台": ["未"], "birth_day/八座": ["未"], "birth_day/恩光": ["亥"], "birth_day/天貴": ["亥"],
  "year_stem/天官": ["未"], "year_stem/天福": ["酉"],
  "year_branch/天哭": ["寅"], "year_branch/天虚": ["戌"], "year_branch/天喜": ["巳"], "year_branch/孤辰": ["巳"], "year_branch/寡宿": ["丑"], "year_branch/天寿": ["未"],
  "ming_shen/天傷": ["寅"], "ming_shen/天使": ["辰"],
  "other/旬空": ["寅", "卯"],
  "boshi/博士": ["寅"], "boshi/力士": ["卯"], "boshi/青龍": ["辰"], "boshi/小耗": ["巳"], "boshi/将軍": ["午"], "boshi/奏書": ["未"],
  "boshi/飛廉": ["申"], "boshi/喜神": ["酉"], "boshi/病符": ["戌"], "boshi/大耗": ["亥"], "boshi/伏兵": ["子"],
  "changsheng/長生": ["巳"], "changsheng/沐浴": ["午"], "changsheng/冠帯": ["未"], "changsheng/臨官": ["申"], "changsheng/帝旺": ["酉"],
  "changsheng/衰": ["戌"], "changsheng/病": ["亥"], "changsheng/死": ["子"], "changsheng/墓": ["丑"], "changsheng/絶": ["寅"],
  "changsheng/胎": ["卯"], "changsheng/養": ["辰"],
};
const S19_JIEKONG_SHOWN: Branch[] = ["申", "酉"];
let s19Places = 0;
for (const place of TABLE2_PLACES) {
  const c = calculateZiweiChart({ birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 }, place, sex: "male" });
  if (c.mingPalace !== "酉" || c.birthDay !== 18 || c.hourBranch !== "卯") continue; // 資料の陰暦・時支と同じ地点だけ
  s19Places += 1;
  const mc = calculateMinorStars(c);
  for (const [id, exp] of Object.entries(S19_SHOWN)) check("命盤B（S19）", `${place} ${id}`, mc.positions[id as keyof typeof mc.positions], exp);
  check("命盤B（S19）", `${place} 截空は表17の申（S19は申・酉の2宮＝source_conflict）`, mc.positions["other/截空"], ["申"]);
}
check("命盤B（S19）", "照合した地点がある", s19Places > 0, true);
notes.push(`命盤B 截空: 表17＝申のみ／S19表示＝${S19_JIEKONG_SHOWN.join("・")}（source_conflict。表17を採用）`);
notes.push("命盤B: 台輔・封誥・龍池・鳳閣・蜚廉・破碎・天才・官府は S19 に表示なし（不一致ではなく未表示）");

// ---------------------------------------------------------------------------
// 7. 全盤面
// ---------------------------------------------------------------------------

const ids = new Set(MINOR_STARS.map((d) => d.id));
check("星マスター", "ID 重複なし", ids.size, MINOR_STARS.length);
check("星マスター", "博士・小耗と歳前・小耗は別ID", ids.has("boshi/小耗") && ids.has("suiqian/小耗"), true);
check("星マスター", "博士・病符と歳前・病符は別ID", ids.has("boshi/病符") && ids.has("suiqian/病符"), true);
check("星マスター", "同名の小耗は2系列", findMinorStarsByName("小耗").map((d) => d.family), ["boshi", "suiqian"]);
check("星マスター", "実装した星", IMPLEMENTED_MINOR_STARS.length, 52);
check("星マスター", "source_insufficient（将前・歳前）", MINOR_STARS.filter((d) => d.sourceStatus === "source_insufficient").length, 24);
for (const d of MINOR_STARS) {
  check("星マスター", `${d.id} isMajor/isTransformation`, [d.isMajor, d.isTransformation], [false, false]);
  check("星マスター", `${d.id} 実装⇔規則あり`, d.implemented, d.sourceStatus !== "source_insufficient");
}

let charts = 0;
for (let y = 1926; y <= 2030; y += 1)
  for (let mo = 1; mo <= 12; mo += 2) {
    const day = 1 + ((y * 5 + mo * 7) % 28);
    const hour = (y * 3 + mo) % 24;
    for (const sex of ["male", "female"] as const) {
      const c = calculateZiweiChart({ birth: { year: y, month: mo, day, hour, minute: 30 }, place: { name: "t", longitude: 139.7 }, sex });
      const before = JSON.stringify(c);
      const mc = calculateMinorStars(c);
      charts += 1;
      const tag = `${y}/${mo}/${day} ${hour}時 ${sex}`;
      if (JSON.stringify(c) !== before) check("全盤面", `${tag} ZiweiChart を変えない`, false, true);
      for (const d of IMPLEMENTED_MINOR_STARS) {
        const bs = mc.positions[d.id];
        if (!bs || bs.length !== (d.multiPalace ? 2 : 1)) check("全盤面", `${tag} ${d.id} の宮の数`, bs?.length, d.multiPalace ? 2 : 1);
      }
      for (const fam of ["boshi", "changsheng"]) {
        const set = new Set(IMPLEMENTED_MINOR_STARS.filter((d) => d.family === fam).map((d) => mc.positions[d.id]![0]));
        if (set.size !== 12) check("全盤面", `${tag} ${fam} が12宮に1つずつ`, set.size, 12);
      }
      const placed = Object.values(mc.byBranch).flat().length;
      if (placed !== 53) check("全盤面", `${tag} 宮内の星の延べ数（52星＋旬空の2宮目）`, placed, 53);
      if (mc.positions["boshi/博士"]![0] !== c.starPositions.禄存星) check("全盤面", `${tag} 博士＝禄存の宮`, mc.positions["boshi/博士"], [c.starPositions.禄存星]);
      // 天才・天寿の別表現（命宮＋年支・身宮＋年支）
      if (mc.positions["year_branch/天才"]![0] !== at(bi(c.mingPalace) + bi(c.yearBranch))) check("全盤面", `${tag} 天才`, 0, 1);
      if (mc.positions["year_branch/天寿"]![0] !== at(bi(c.shenPalace) + bi(c.yearBranch))) check("全盤面", `${tag} 天寿`, 0, 1);
      // 力量・格局は新規星と無関係（新規星を計算しても同じ値）
      if (charts % 25 === 0) {
        const p1 = JSON.stringify(calculateChartPower(c));
        const g1 = JSON.stringify(evaluatePatterns(c));
        calculateMinorStars(c);
        check("全盤面", `${tag} 力量・格局が変わらない`, [JSON.stringify(calculateChartPower(c)), JSON.stringify(evaluatePatterns(c))], [p1, g1]);
      }
    }
  }
check("全盤面", "盤面数", charts > 1000, true);

// ---------------------------------------------------------------------------
// 8. 力量・格局・既存象意・新規象意
// ---------------------------------------------------------------------------

const newNames = new Set(IMPLEMENTED_MINOR_STARS.flatMap((d) => [d.name, `${d.name}星`, ...d.aliases]));
check("影響範囲", "力量表（表13）に新規星なし", Object.keys(POWER_TABLE).filter((s) => newNames.has(s)), []);
check("影響範囲", "格局の吉凶星分類に新規星なし", Object.keys(STAR_LUCK).filter((s) => newNames.has(s)), []);
check("影響範囲", "既存の象意データに新規星なし", STAR_MEANINGS.flatMap((x) => x.stars as string[]).filter((s) => newNames.has(s)), []);
const meaningIds = new Set(MINOR_STAR_MEANINGS.map((x) => x.id));
check("新規象意", "件数＝実装した星", MINOR_STAR_MEANINGS.length, IMPLEMENTED_MINOR_STARS.length);
for (const d of IMPLEMENTED_MINOR_STARS) check("新規象意", `${d.id} あり`, meaningIds.has(d.id), true);
// 原文の言い回しをそのまま使っていない（資料の定型句）
const SOURCE_PHRASES = ["を主る", "を象徴", "を忌む", "を喜ぶ", "化凶為吉", "暗中受難", "陞遷", "生気発剌", "台閣の星", "封章の星"];
for (const x of MINOR_STAR_MEANINGS) {
  check("新規象意", `${x.id} 原文の定型句なし`, SOURCE_PHRASES.filter((p) => x.text.includes(p)), []);
  check("新規象意", `${x.id} 短文（80字以内）`, x.text.length <= 80, true);
}

// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
for (const [cat, c] of counts) {
  pass += c.pass;
  fail += c.fail;
  console.log(`  ${c.fail === 0 ? "OK  " : "FAIL"} ${cat}: ${c.pass}/${c.pass + c.fail}`);
}
for (const n of notes) console.log(`  注: ${n}`);
if (failures.length) {
  console.log("不一致:");
  console.log(failures.slice(0, 60).join("\n"));
}
console.log(`新規諸星: ${pass} / ${pass + fail} ${fail === 0 ? "PASS" : "FAIL"}`);
if (fail) process.exit(1);
