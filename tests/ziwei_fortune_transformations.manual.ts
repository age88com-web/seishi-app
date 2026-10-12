// tests/ziwei_fortune_transformations.manual.ts
//
// 行運四化象意（src/lib/ziwei/meanings/fortune-transformations）と星名「擎羊星」の統一の確認。docs/ziwei-basic-spec.md §30。
// 実行: npx tsx tests/ziwei_fortune_transformations.manual.ts

import { readFileSync } from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, ZiweiChart } from "../src/lib/ziwei";
import { PLACED_STARS } from "../src/lib/ziwei/data";
import { POWER_TABLE, POWER_TABLE_KISO, POWER_TABLE_NYUMON, calculateChartPower, starPowerOf } from "../src/lib/ziwei/power";
import { STAR_STRENGTH } from "../src/lib/ziwei/strength";
import { STAR_LUCK } from "../src/lib/ziwei/patterns/luck";
import { buildFortunePalaceContext, parseAppraisalDate, selectionFromDate, withMajor, withMinor } from "../src/lib/ziwei/fortune";
import type { FortuneSelection } from "../src/lib/ziwei/fortune";
import { buildFortuneStarMeaningContext, FORTUNE_STAR_ITEMS, fortuneStarItemOf } from "../src/lib/ziwei/meanings/fortune";
import {
  EXCLUDED_FORTUNE_TEXTS,
  TRANSFORMATION_MEANINGS,
  TRANSFORMATION_TYPES,
  buildFortuneTransformationContext,
  buildFortuneTransformationSection,
  transformationMeaningOf,
} from "../src/lib/ziwei/meanings/fortune-transformations";
import transformationsJson from "../src/lib/ziwei/meanings/data/transformations.json";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const BRANCHES: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const S38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
const pctx = (c: ZiweiChart, s: FortuneSelection, b: Branch) =>
  buildFortunePalaceContext(c, { appraisalDate: parseAppraisalDate(s.appraisalDate)!, majorStartAge: s.majorStartAge, minorAge: s.minorAge }, b);
const s0 = selectionFromDate(S38, "2008-07-01");

// ---------------------------------------------------------------------------
// 0. 星名: 作盤エンジンの標準名は擎羊星（資料の「敬羊」は別名）
// ---------------------------------------------------------------------------
{
  check("PLACED_STARS に擎羊星", (PLACED_STARS as readonly string[]).includes("擎羊星"));
  check("PLACED_STARS に敬羊星がない", !(PLACED_STARS as readonly string[]).includes("敬羊星"));
  for (const [name, table] of [["入門", POWER_TABLE_NYUMON], ["基礎編", POWER_TABLE_KISO], ["採用", POWER_TABLE]] as const) {
    check(`力量表（${name}）の行名は擎羊星`, "擎羊星" in table && !("敬羊星" in table));
  }
  check("旺衰表の行名は擎羊星", "擎羊星" in STAR_STRENGTH && !("敬羊星" in STAR_STRENGTH));
  check("吉凶の分類は擎羊星", STAR_LUCK["擎羊星"] === "凶星" && !("敬羊星" in STAR_LUCK));
  check("行運星曜象意の群は擎羊星", fortuneStarItemOf("擎羊星")?.id === "FS-火鈴羊陀" && FORTUNE_STAR_ITEMS.every((i) => !(i.stars as string[]).includes("敬羊星")));
  // 盤面: 全命盤に擎羊星が1つ（禄存の次の支）
  let ok = 0;
  for (let y = 1950; y < 2010; y += 1) {
    const c = calculateZiweiChart({ birth: { year: y, month: 6, day: 15, hour: 12, minute: 0 }, place: "東京", sex: "male" });
    const stars = c.palaces.flatMap((p) => p.stars as string[]);
    if (stars.filter((s) => s === "擎羊星").length === 1 && !stars.includes("敬羊星") && starPowerOf("擎羊星", c.starPositions["擎羊星"]) !== null) ok += 1;
  }
  check("作盤: 60命盤すべてに擎羊星が1つ・力量表の値あり", ok === 60, `${ok}`);
  // データの星名フィールド（stars・withStars・subjectStars・star・条件の stars）に敬羊星が残っていない
  const canonicalFields = new Set(["stars", "withStars", "subjectStars", "star"]);
  const files = [
    "src/lib/ziwei/meanings/data/stars.json",
    "src/lib/ziwei/meanings/data/combinations.json",
    "src/lib/ziwei/meanings/data/starPalace.json",
    "src/lib/ziwei/meanings/data/meta.json",
    "src/lib/ziwei/meanings/data/transformations.json",
    "src/lib/ziwei/meanings/data/palaces.json",
    "src/lib/ziwei/meanings/data/themes.json",
    "src/lib/ziwei/meanings/advanced/data/ouyou.json",
    "src/lib/ziwei/meanings/fortune/data/fortuneStars.json",
  ];
  for (const f of files) {
    let bad = 0;
    let qi = 0;
    const walk = (o: unknown, key: string | null): void => {
      if (typeof o === "string") {
        if (key && canonicalFields.has(key) && o === "敬羊星") bad += 1;
        if (key && canonicalFields.has(key) && o === "擎羊星") qi += 1;
      } else if (Array.isArray(o)) o.forEach((x) => walk(x, key));
      else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, k);
    };
    walk(JSON.parse(readFileSync(f, "utf8")), null);
    check(`${f}: 星名フィールドに敬羊星なし`, bad === 0, `${bad}`);
    if (f.endsWith("stars.json") && !f.includes("fortune")) check("stars.json の星名フィールドは擎羊星", qi > 0);
  }
  // ソースコード: 文字列リテラル "敬羊星" は資料の文の引用だけ
  const code = ["src/lib/ziwei/data.ts", "src/lib/ziwei/types.ts", "src/lib/ziwei/power.ts", "src/lib/ziwei/strength.ts", "src/lib/ziwei/patterns/luck.ts", "src/lib/ziwei/patterns/data.ts"];
  for (const f of code) check(`${f}: "敬羊星" の識別子なし`, !/["']敬羊星["']|^\s*敬羊星:/m.test(readFileSync(f, "utf8")));
}

// ---------------------------------------------------------------------------
// 1. 四化象意データ
// ---------------------------------------------------------------------------
check("4四化", TRANSFORMATION_TYPES.length === 4 && TRANSFORMATION_TYPES.every((t) => TRANSFORMATION_MEANINGS[t].type === t));
for (const t of TRANSFORMATION_TYPES) {
  const m = TRANSFORMATION_MEANINGS[t];
  check(`${t}: 基本象意あり（表示2）`, m.coreMeanings.filter((c) => c.display).length === 2);
  check(`${t}: 基本象意は generic-transformation`, m.coreMeanings.every((c) => c.sourceScope === "generic-transformation"));
  check(`${t}: 行運文は fortune-explicit`, m.fortuneTexts.every((f) => f.sourceScope === "fortune-explicit" && f.appliesTo.length > 0));
  check(`${t}: 基本象意は入門 p.15 の一覧と化曜星の定義文`, m.coreMeanings[0].sourceRef.page === "p.15" && /化.星/.test(m.coreMeanings[1].text));
}
check("化禄・化権・化科に基礎２ S20 の短い象意（保持のみ）", (["化禄", "化権", "化科"] as const).every((t) => TRANSFORMATION_MEANINGS[t].coreMeanings.some((c) => c.sourceRef.page === "S20" && !c.display)));
check("行運明示文は化忌の S39 の1文だけ（大限のみ）", TRANSFORMATION_TYPES.flatMap((t) => TRANSFORMATION_MEANINGS[t].fortuneTexts).length === 1 && TRANSFORMATION_MEANINGS.化忌.fortuneTexts[0].appliesTo.join() === "major");
{
  // 命宮専用の人物解釈を流用しない
  const raw = transformationsJson as unknown as { id: string; text: string }[];
  const byId = new Map(raw.map((e) => [e.id, e.text]));
  const used = TRANSFORMATION_TYPES.flatMap((t) => [...TRANSFORMATION_MEANINGS[t].coreMeanings, ...TRANSFORMATION_MEANINGS[t].fortuneTexts]);
  const allText = used.map((u) => u.text).join("\n");
  check("「命宮に持つ人」の文を使わない", !/命宮に持つ|命宮にあり|命宮で/.test(allText));
  const excluded = TRANSFORMATION_TYPES.flatMap((t) => TRANSFORMATION_MEANINGS[t].excludedSourceIds);
  check("除外した命宮専用文は22文", excluded.length === 22 && new Set(excluded).size === 22);
  check("除外した文は使った文に含まれない", excluded.every((id) => !used.some((u) => u.sourceRef.sourceId === id) && !allText.includes(byId.get(id)!)));
  for (const u of used.filter((x) => x.sourceRef.sourceId)) check(`${u.sourceRef.sourceId}: 象意データの独自文章と同じ`, byId.get(u.sourceRef.sourceId!) === u.text);
  const ids = new Set([...used.map((u) => u.sourceRef.sourceId).filter(Boolean), ...excluded]);
  check("化曜星の節の各四化の文（N-ST-0831〜0856）をすべて分類", raw.filter((e) => /^N-ST-08(3[1-9]|4\d|5[0-6])$/.test(e.id)).every((e) => ids.has(e.id)));
  check("格局・喜忌・太歳の文は別レイヤー（除外の記録）", EXCLUDED_FORTUNE_TEXTS.some((e) => e.reason === "pattern") && EXCLUDED_FORTUNE_TEXTS.some((e) => e.reason === "xiji") && EXCLUDED_FORTUNE_TEXTS.some((e) => e.reason === "taisei"));
  check("化忌の基本象意に格局の語を混ぜない", !/羊陀|刑忌|夾/.test(TRANSFORMATION_MEANINGS.化忌.coreMeanings.map((c) => c.text).join()));
}
check("大限・小限で同じデータを参照", transformationMeaningOf("化禄星") === TRANSFORMATION_MEANINGS.化禄 && transformationMeaningOf("化忌星") === TRANSFORMATION_MEANINGS.化忌);

// ---------------------------------------------------------------------------
// 2. 宮クリック（全大限・小限・全宮）
// ---------------------------------------------------------------------------
const powerBefore = JSON.stringify(calculateChartPower(S38));
const chartBefore = JSON.stringify(S38);
let overlapSeen = 0;
for (const p of S38.dayun.periods) {
  for (let age = p.startAge; age <= p.endAge; age += 1) {
    const s = withMinor(S38, withMajor(S38, s0, p.startAge), age);
    for (const b of BRANCHES) {
      const ctx = pctx(S38, s, b);
      const r = buildFortuneTransformationContext(ctx);
      const majorHere = ctx.fortune.majorTransformations.filter((t) => t.branch === b);
      const minorHere = ctx.fortune.minorTransformations.filter((t) => t.branch === b);
      // 欄はその層の四化がある宮だけ
      check(`大限四化の欄（${p.startAge}・${b}）`, (r.major !== null) === majorHere.length > 0);
      check(`小限四化の欄（${age}・${b}）`, (r.minor !== null) === minorHere.length > 0);
      if (r.major) {
        check("大限四化: 星と種類が層のまま", JSON.stringify(r.major.items.map((i) => i.star).sort()) === JSON.stringify(majorHere.map((t) => t.star).sort()));
        check("大限四化: 表記は大X", r.major.items.every((i) => i.origin === "major" && i.label === `大${i.type.slice(1)}`));
        check("大限四化: 象意は共通データ", r.major.items.every((i) => JSON.stringify(i.coreMeanings) === JSON.stringify(TRANSFORMATION_MEANINGS[i.type].coreMeanings.filter((c) => c.display).map((c) => c.text))));
        for (const i of r.major.items) {
          const expectS39 = i.type === "化忌" && ctx.natalPalace === "命宮";
          check("大限化忌の S39 文は天盤命宮のときだけ", (i.fortuneTexts.length === 1) === expectS39);
        }
      }
      if (r.minor) {
        check("小限四化: 星と種類が層のまま", JSON.stringify(r.minor.items.map((i) => i.star).sort()) === JSON.stringify(minorHere.map((t) => t.star).sort()));
        check("小限四化: 表記は小X", r.minor.items.every((i) => i.origin === "minor" && i.label === `小${i.type.slice(1)}`));
        check("小限四化: S39 の文は出さない（大限のみの記述）", r.minor.items.every((i) => i.fortuneTexts.length === 0));
      }
      // 同じ星の大限・小限を統合しない
      if (r.major && r.minor) {
        for (const mi of r.major.items) {
          const same = r.minor.items.find((x) => x.star === mi.star);
          if (same) {
            overlapSeen += 1;
            check("同じ星の大限・小限は別々", same.origin === "minor" && mi.origin === "major" && same.label.startsWith("小") && mi.label.startsWith("大"));
          }
        }
      }
      // 本命四化は扱わない
      check("本命四化を含めない", [...(r.major?.items ?? []), ...(r.minor?.items ?? [])].every((i) => i.origin !== ("natal" as string)));
    }
  }
}
check("同じ星に大限・小限の四化が付く場面がある", overlapSeen > 0, `${overlapSeen}`);
console.log(`同じ星に大限・小限: ${overlapSeen} 件`);
check("宮の力量を変更しない", JSON.stringify(calculateChartPower(S38)) === powerBefore);
check("本命盤を変更しない", JSON.stringify(S38) === chartBefore);

// 大限・小限の変更に追従
{
  const a = withMajor(S38, s0, 22);
  const b2 = withMajor(S38, s0, 42);
  const at = (s: FortuneSelection) => BRANCHES.map((b) => JSON.stringify(buildFortuneTransformationSection(pctx(S38, s, b), "major")?.items ?? null)).join("|");
  check("大限を変えると大限四化象意が変わる", at(a) !== at(b2));
  const m1 = withMinor(S38, s0, 45);
  const m2 = withMinor(S38, s0, 46);
  const atm = (s: FortuneSelection) => BRANCHES.map((b) => JSON.stringify(buildFortuneTransformationSection(pctx(S38, s, b), "minor")?.items ?? null)).join("|");
  check("小限を変えると小限四化象意が変わる", atm(m1) !== atm(m2));
  check("小限だけ変えても大限四化象意は同じ", at(m1) === at(m2));
  // 丁卯（22〜31）: 丁の化忌は巨門。巨門の宮に大忌
  const ju = S38.starPositions["巨門星"];
  const sec = buildFortuneTransformationSection(pctx(S38, a, ju), "major")!;
  check("丁卯: 巨門に大忌", sec.items.some((i) => i.star === "巨門星" && i.label === "大忌"));
  // 大限開始前: 大限の欄なし
  const before = withMinor(S38, s0, 1);
  check("大限開始前: 大限四化の欄なし", BRANCHES.every((b) => buildFortuneTransformationSection(pctx(S38, before, b), "major") === null));
}

// 宮の力量・星曜象意の条件・行運格局・盤面の四化の層を壊さない
{
  const s = withMinor(S38, withMajor(S38, s0, 22), 25);
  const natalPower = calculateChartPower(S38);
  for (const b of BRANCHES) {
    const ctx = pctx(S38, s, b);
    const sm = buildFortuneStarMeaningContext(S38, ctx);
    check(`${b}: 星曜象意の宮の力量は本命の運命指数のまま`, sm.major!.palacePower.index === natalPower.byBranch[b].index && sm.minor!.palacePower.grade === natalPower.byBranch[b].grade);
    check(`${b}: 盤面の四化の層（生年・大限・小限）`, ctx.transformations.every((t) => ["natal", "major", "minor"].includes(t.origin)));
  }
  const f = pctx(S38, s, "子").fortune;
  check("盤面の大限四化は4つ（大禄・大権・大科・大忌）", f.majorTransformations.length === 4 && new Set(f.majorTransformations.map((t) => t.kind)).size === 4);
  check("盤面の小限四化は4つ（小禄・小権・小科・小忌）", f.minorTransformations.length === 4 && new Set(f.minorTransformations.map((t) => t.kind)).size === 4);
  check("行運格局: 丁卯の刑忌夾印は成立のまま", f.majorPatterns.find((p) => p.id === "K2-33")!.status === "confirmed");
}

// S39（大限四化の例2）: 5〜54歳の5つの大限で化忌がすべて天盤命宮（卯）に入る → S39 の文を出す
{
  const S39 = calculateZiweiChart({ birth: { year: 1975, month: 3, day: 9, hour: 22, minute: 0 }, place: "東京", sex: "male" });
  const d = parseAppraisalDate("2000-07-01")!;
  const want = ["文曲星", "天機星", "文曲星", "天機星", "巨門星"];
  S39.dayun.periods.slice(0, 5).forEach((p, i) => {
    const ctx = buildFortunePalaceContext(S39, { appraisalDate: d, majorStartAge: p.startAge, minorAge: p.startAge }, S39.mingPalace);
    const ji = buildFortuneTransformationSection(ctx, "major")?.items.find((x) => x.type === "化忌");
    check(`S39 大限${p.startAge}: 天盤命宮に${want[i]}の大忌・S39 の文`, ctx.natalPalace === "命宮" && ji?.star === want[i] && ji.fortuneTexts.length === 1);
  });
  const p6 = S39.dayun.periods[5];
  const c6 = buildFortunePalaceContext(S39, { appraisalDate: d, majorStartAge: p6.startAge, minorAge: p6.startAge }, S39.mingPalace);
  check("S39 大限55: 天盤命宮に大忌なし → 文なし", !buildFortuneTransformationSection(c6, "major")?.items.some((x) => x.type === "化忌"));
}

const fail = failures.length;
console.log(`行運四化象意: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
