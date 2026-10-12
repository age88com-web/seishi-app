// tests/ziwei_fortune_meanings.manual.ts
//
// 大限・小限における星曜の象意（src/lib/ziwei/meanings/fortune）の確認。docs/ziwei-basic-spec.md §29。
// 実行: npx tsx tests/ziwei_fortune_meanings.manual.ts

import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, PlacedStar, ZiweiChart } from "../src/lib/ziwei";
import { PLACED_STARS } from "../src/lib/ziwei/data";
import { calculateChartPower } from "../src/lib/ziwei/power";
import { buildFortunePalaceContext, parseAppraisalDate, selectionFromDate, withMajor, withMinor } from "../src/lib/ziwei/fortune";
import type { FortuneSelection } from "../src/lib/ziwei/fortune";
import {
  FORTUNE_STAR_ITEMS,
  buildFortuneStarMeaningContext,
  buildMajorPalaceInterpretation,
  buildMinorPalaceInterpretation,
  fortuneStarDataCounts,
  fortuneStarItemOf,
  fortuneStarMeaningsAt,
  normalizeFortuneStarName,
} from "../src/lib/ziwei/meanings/fortune";
import starsJson from "../src/lib/ziwei/meanings/data/stars.json";

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

// ---------------------------------------------------------------------------
// 1. データ（大限・小限で共通の1データ）
// ---------------------------------------------------------------------------
const counts = fortuneStarDataCounts();
check("項目17（主星14＋群3）", counts.items === 17 && counts.groups === 3, JSON.stringify(counts));
check("対象の星22（主星14＋文昌・文曲＋左輔・右弼＋火・鈴・擎羊・陀羅）", counts.stars === 22);
check("文48（基礎編 K-ST-DX-001〜048）", counts.lines === 48);
check("無条件23・強11・弱13・太陰1", counts.unconditional === 23 && counts.palacePowerStrong === 11 && counts.palacePowerWeak === 13 && counts.starOrPalaceWeak === 1, JSON.stringify(counts));
{
  const ids = FORTUNE_STAR_ITEMS.flatMap((i) => i.lines.map((l) => l.sourceId)).sort();
  const expected = Array.from({ length: 48 }, (_, i) => `K-ST-DX-${String(i + 1).padStart(3, "0")}`);
  check("基礎編の48文をすべて1回ずつ使う", JSON.stringify(ids) === JSON.stringify(expected));
  const par = FORTUNE_STAR_ITEMS.flatMap((i) => i.lines.map((l) => l.parallelId));
  check("入門の48文と1対1に対応", new Set(par).size === 48 && par.every((p) => /^N-ST-RN-0\d\d$/.test(p)));
  // 表示文は象意データの独自文章（§35）。原文のフィールドは持たない
  const app = new Map((starsJson as unknown as { id: string; text: string }[]).map((e) => [e.id, e.text]));
  for (const l of FORTUNE_STAR_ITEMS.flatMap((i) => i.lines)) {
    check(`${l.id}: 表示文は象意データの独自文章`, app.get(l.sourceId) === l.text && l.text.length > 0);
    check(`${l.id}: 原文フィールドなし`, !("sourceText" in l) && !("parallelText" in l) && !("sourceCorrection" in l));
  }
}
check("星名はすべて作盤エンジンの星名", FORTUNE_STAR_ITEMS.every((i) => i.stars.every((s) => (PLACED_STARS as readonly string[]).includes(s))));
check("星名の正規化: 貧狼→貪狼", normalizeFortuneStarName("貧狼星") === "貪狼星");
check("星名の正規化: 敬羊→擎羊星", normalizeFortuneStarName("敬羊") === "擎羊星" && normalizeFortuneStarName("敬羊星") === "擎羊星" && normalizeFortuneStarName("擎羊星") === "擎羊星");
check("星名の正規化: 右輔→右弼", normalizeFortuneStarName("右輔星") === "右弼星");
check("群: 文昌・文曲は同じ項目", fortuneStarItemOf("文昌星") === fortuneStarItemOf("文曲星") && fortuneStarItemOf("文昌星")!.isGroup);
check("群: 左輔・右弼は同じ項目", fortuneStarItemOf("左輔星") === fortuneStarItemOf("右弼星"));
check(
  "群: 火星・鈴星・擎羊・陀羅は同じ項目",
  (["鈴星", "擎羊星", "陀羅星"] as PlacedStar[]).every((s) => fortuneStarItemOf(s) === fortuneStarItemOf("火星")),
);
check(
  "記載のない星: 天空・地劫・禄存・天魁・天鉞・天馬・天姚・紅鸞",
  (["天空星", "地劫星", "禄存星", "天魁星", "天鉞星", "天馬星", "天姚星", "紅鸞星"] as PlacedStar[]).every((s) => fortuneStarItemOf(s) === null),
);
check("天機: 強の文は学問の成果に触れる", fortuneStarItemOf("天機星")!.lines[1].text.includes("学問"));
check("天府「弱くても」は宮の力量が弱いとき", fortuneStarItemOf("天府星")!.lines[2].condition?.kind === "palacePowerWeak");
check("太陰は 星の力量 OR 宮の力量", fortuneStarItemOf("太陰星")!.lines[2].condition?.kind === "starOrPalaceWeak");

// ---------------------------------------------------------------------------
// 2. 強・弱・平の判定（多数の命盤の全宮）
// ---------------------------------------------------------------------------
const charts: ZiweiChart[] = [];
for (let y = 1950; y < 2010; y += 3)
  for (const m of [1, 4, 7, 10])
    charts.push(calculateZiweiChart({ birth: { year: y, month: m, day: 5 + (y % 20), hour: (y + m) % 24, minute: 0 }, place: "東京", sex: y % 2 ? "male" : "female" }));
const seen = { strong: 0, weak: 0, flat: 0, taiyinMet: 0, taiyinPending: 0 };
for (const c of charts) {
  const power = calculateChartPower(c);
  for (const b of BRANCHES) {
    const g = power.byBranch[b].grade;
    const ms = fortuneStarMeaningsAt(c, b, power);
    const strong = g === "最強" || g === "強";
    const weak = g === "弱" || g === "最弱";
    if (strong) seen.strong += 1;
    else if (weak) seen.weak += 1;
    else seen.flat += 1;
    for (const m of ms) {
      for (const l of m.lines) {
        if (!l.condition) check("無条件の文は常に表示", l.shown && l.result === "unconditional");
        else if (l.condition.kind === "palacePowerStrong") check(`強の文 ${g}`, l.shown === strong);
        else if (l.condition.kind === "palacePowerWeak") check(`弱の文 ${g}`, l.shown === weak);
        else {
          if (weak) {
            check("太陰: 宮が弱いので成立", l.result === "met" && l.shown);
            seen.taiyinMet += 1;
          } else {
            check("太陰: 宮が弱くなければ未判定（星の力量の弱さは定義なし）", l.result === "pending" && !l.shown);
            seen.taiyinPending += 1;
          }
        }
      }
      if (g === "平") check("平: 条件付きの文は出さない", m.lines.filter((l) => l.condition).every((l) => !l.shown));
    }
    // 群は1回だけ
    const ids = ms.map((m) => m.item.id);
    check("同じ項目は1回だけ", new Set(ids).size === ids.length);
    // 宮の星と一致
    const st = c.palaces.find((p) => p.branch === b)!.stars;
    check("宮の星の項目だけ", ms.every((m) => m.presentStars.every((s) => st.includes(s))));
    check("資料の見出しの順", ms.every((m, i) => i === 0 || ms[i - 1].item.sourceOrder < m.item.sourceOrder));
  }
}
check("強・弱・平・太陰の両方の場合が試験データに含まれる", seen.strong > 0 && seen.weak > 0 && seen.flat > 0 && seen.taiyinMet > 0 && seen.taiyinPending > 0, JSON.stringify(seen));
console.log(`判定した宮: ${JSON.stringify(seen)}`);

// ---------------------------------------------------------------------------
// 3. 群の重複除外（星を動かした命盤）
// ---------------------------------------------------------------------------
{
  const moved: ZiweiChart = structuredClone(S38);
  const target = moved.palaces[0];
  for (const p of moved.palaces) p.stars = p.stars.filter((s) => !["火星", "鈴星", "擎羊星", "陀羅星", "文昌星", "文曲星"].includes(s));
  target.stars = [...target.stars, "火星", "擎羊星", "陀羅星", "文昌星", "文曲星"];
  const ms = fortuneStarMeaningsAt(moved, target.branch);
  const fire = ms.filter((m) => m.item.id === "FS-火鈴羊陀");
  check("火星・擎羊・陀羅が同宮でも群は1回", fire.length === 1 && fire[0].label === "火・擎羊・陀羅", fire.map((m) => m.label).join("/"));
  const wen = ms.filter((m) => m.item.id === "FS-文昌文曲");
  check("文昌・文曲が同宮でも群は1回", wen.length === 1 && wen[0].label === "文昌・文曲");
  check("群の文は2つ（重複しない）", fire[0].lines.length === 2);
}

// ---------------------------------------------------------------------------
// 4. 大限・小限への適用（buildFortunePalaceContext の宮名を使う）
// ---------------------------------------------------------------------------
{
  const s0 = selectionFromDate(S38, "2008-07-01");
  for (const p of S38.dayun.periods) {
    const s = withMajor(S38, s0, p.startAge);
    for (const b of BRANCHES) {
      const ctx = pctx(S38, s, b);
      const r = buildMajorPalaceInterpretation(S38, ctx)!;
      check(`大限${p.startAge} ${b}: 大限上の宮名は palaceMap のまま`, r.fortunePalace === ctx.majorPalace);
      check(`大限${p.startAge} ${b}: 年齢範囲`, r.ageRange[0] === p.startAge && r.ageRange[1] === p.endAge);
      check(`大限${p.startAge} ${b}: 物理的な宮の星`, JSON.stringify(r.stars) === JSON.stringify(S38.palaces.find((x) => x.branch === b)!.stars));
    }
    const ming = buildMajorPalaceInterpretation(S38, pctx(S38, s, p.branch))!;
    check(`大限${p.startAge}: 大限の宮は大限上の命宮`, ming.fortunePalace === "命宮");
  }
  for (const age of [1, 12, 25, 45, 48, 57]) {
    const s = withMinor(S38, s0, age);
    const mingB = pctx(S38, s, "子").fortune.minorLimit!.palaceBranch;
    const r = buildMinorPalaceInterpretation(S38, pctx(S38, s, mingB))!;
    check(`小限${age}: 小限の宮は小限上の命宮`, r.fortunePalace === "命宮" && r.ageRange[0] === age && r.ageRange[1] === age);
    for (const b of BRANCHES) {
      const ctx = pctx(S38, s, b);
      const m = buildMinorPalaceInterpretation(S38, ctx)!;
      check(`小限${age} ${b}: 小限上の宮名は palaceMap のまま`, m.fortunePalace === ctx.minorPalace);
    }
  }
  // 同じ宮なら大限・小限で同じ象意（共通データ・同じ宮の力量）
  const s = withMinor(S38, withMajor(S38, s0, 22), 25);
  for (const b of BRANCHES) {
    const both = buildFortuneStarMeaningContext(S38, pctx(S38, s, b));
    check(`${b}: 大限・小限で同じ象意データ`, JSON.stringify(both.major!.meanings) === JSON.stringify(both.minor!.meanings));
    check(`${b}: 大限上と小限上の宮名は別々に決まる`, both.major!.fortunePalace === pctx(S38, s, b).majorPalace && both.minor!.fortunePalace === pctx(S38, s, b).minorPalace);
  }
  // 大限開始前: 大限なし・小限あり
  const s1 = withMinor(S38, s0, 1);
  const b1 = buildFortuneStarMeaningContext(S38, pctx(S38, s1, "子"));
  check("大限開始前: 大限は null・小限はあり", b1.major === null && b1.minor !== null);
  // 本命盤を変更しない
  const before = JSON.stringify(S38);
  for (const b of BRANCHES) buildFortuneStarMeaningContext(S38, pctx(S38, s, b));
  check("本命盤（chart）を変更しない", JSON.stringify(S38) === before);
}

// ---------------------------------------------------------------------------
// 5. 該当なし
// ---------------------------------------------------------------------------
{
  const empty: ZiweiChart = structuredClone(S38);
  empty.palaces[3].stars = ["天馬星", "紅鸞星"]; // 力量を無視する星（力量表の空欄に当たらない）
  const s0 = selectionFromDate(empty, "2008-07-01");
  const r = buildMajorPalaceInterpretation(empty, pctx(empty, s0, empty.palaces[3].branch))!;
  check("記載のない星だけの宮: 象意なし", r.meanings.length === 0 && r.starsWithoutMeaning.length === 2);
}

const fail = failures.length;
console.log(`行運星曜象意: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
