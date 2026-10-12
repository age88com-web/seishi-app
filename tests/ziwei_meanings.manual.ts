// tests/ziwei_meanings.manual.ts
//
// 紫微斗数の象意データベース（src/lib/ziwei/meanings/）の整合テスト。
// 実行: npx tsx tests/ziwei_meanings.manual.ts
//
// 内容の正しさ（原文が出典ページにあること）は生成時に scripts/ziwei/extract_meanings.py が検証する。
// ここでは、出典の欠け・星名／宮名の不一致・ID の重複・34星の収録状況を確認する。

import {
  COMBINATION_MEANINGS,
  MEANINGS_META,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  THEME_MEANINGS,
  TRANSFORMATION_MEANINGS,
  getCombinationMeanings,
  getStarMeanings,
  getStarPalaceMeanings,
} from "../src/lib/ziwei/meanings";
import type { MeaningBase } from "../src/lib/ziwei/meanings";

const STARS = [
  "紫微星", "天機星", "太陽星", "武曲星", "天同星", "廉貞星", "天府星", "太陰星", "貪狼星", "巨門星", "天相星", "天梁星", "七殺星", "破軍星",
  "文昌星", "文曲星", "天空星", "地劫星", "火星", "鈴星", "左輔星", "右弼星", "天姚星", "天馬星", "禄存星", "擎羊星", "陀羅星", "天魁星", "天鉞星", "紅鸞星",
  "化禄星", "化権星", "化科星", "化忌星",
];
const PALACES = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"];

let fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) {
    fail += 1;
    console.log(`FAIL ${label} ${detail}`);
  }
};

const all: [string, (Omit<MeaningBase, "text"> & { text?: string; stars?: string[]; palace?: string | null })[]][] = [
  ["stars", STAR_MEANINGS],
  ["transformations", TRANSFORMATION_MEANINGS],
  ["palaces", PALACE_MEANINGS],
  ["starPalace", STAR_PALACE_MEANINGS],
  ["combinations", COMBINATION_MEANINGS],
  ["themes", THEME_MEANINGS],
];

const ids = new Set<string>();
for (const [kind, arr] of all) {
  for (const e of arr) {
    check(`${kind} ${e.id} 出典`, ["紫微斗数入門", "紫微斗数基礎編"].includes(e.ref.source) && e.ref.pdfPage > 0 && !!e.ref.section, JSON.stringify(e.ref));
    // 表示文は独自文章（§35）。テーマ別の記述は画面に出さないので表示文を持たない。原文のフィールドは持たない
    // 空文（""）は選別に残すが表示しない文（イメージの物語部分・資料の前置き。§35.6）
    check(`${kind} ${e.id} 本文`, kind === "themes" ? !("text" in e) : typeof e.text === "string");
    check(`${kind} ${e.id} 原文フィールドなし`, !("sourceText" in e) && !("normalizedMeaning" in e));
    check(`${kind} ${e.id} 凍結メタデータ`, typeof e.textKey === "string" && Array.isArray(e.mentionsStars) && typeof e.sourceLength === "number");
    check(`${kind} ${e.id} ID重複なし`, !ids.has(e.id));
    ids.add(e.id);
    for (const s of e.stars ?? []) check(`${kind} ${e.id} 星名`, STARS.includes(s), s);
    if (e.palace) check(`${kind} ${e.id} 宮名`, PALACES.includes(e.palace) || e.palace === "身宮", e.palace);
  }
  console.log(`${kind}: ${arr.length}件`);
}

// 34星の収録状況
const status = MEANINGS_META.starStatus;
check("34星すべての収録状況がある", status.length === 34 && STARS.every((s) => status.some((r) => r.star === s)));
const missing = status.filter((r) => !r.meaningAvailable).map((r) => r.star);
console.log(`象意のある星: ${status.length - missing.length} / 34${missing.length ? `（なし: ${missing.join("・")}）` : ""}`);

// 検索関数
check("紫微星・命宮の象意がある", getStarMeanings("紫微星", { palace: "命宮" }).length > 0);
check("文昌星・夫妻宮の記述がある", getStarPalaceMeanings("文昌星", "夫妻宮").length > 0);
check("紫微星＋天府星の組み合わせがある", getCombinationMeanings(["紫微星", "天府星"]).length > 0);

console.log(fail ? `FAIL ${fail}` : "PASS");
if (fail) process.exit(1);
