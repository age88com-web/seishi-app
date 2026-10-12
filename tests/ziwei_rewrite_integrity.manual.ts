// tests/ziwei_rewrite_integrity.manual.ts
//
// 紫微斗数の鑑定文の独自化（docs/ziwei-basic-spec.md §35）の確認。
//   - 意味データの件数・ID・条件・星・宮・カテゴリ・タグ・組み合わせの関係など、文章以外の項目が書き直し前と同じ
//   - 原文フィールド（sourceText・normalizedMeaning など）がアプリ用データに残っていない
//   - 表示する文章（解釈・判断根拠・行運星曜象意・行運四化象意・格局象意・S33・S40）に、原文と9字以上連続で一致する箇所がない
//     （星名・宮名・占術用語・定型の条件句・汎用の語尾は除く。照合は原文の指紋〔ハッシュ〕で行い、原文は持たない）
//   - 行運星曜象意の条件・行運格局・応用編144 が変わっていない
// 照合データ: tests/fixtures/ziwei_rewrite_baseline.json（書き直し前のデータから作成）
// 実行: npx tsx tests/ziwei_rewrite_integrity.manual.ts

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import {
  COMBINATION_MEANINGS,
  PALACE_MEANINGS,
  STAR_MEANINGS,
  STAR_PALACE_MEANINGS,
  THEME_MEANINGS,
  TRANSFORMATION_MEANINGS,
  buildPalaceMeaningContext,
  buildRuleBasedInterpretation,
} from "../src/lib/ziwei/meanings";
import { FORTUNE_STAR_ITEMS } from "../src/lib/ziwei/meanings/fortune";
import { TRANSFORMATION_MEANINGS as FORTUNE_HUA } from "../src/lib/ziwei/meanings/fortune-transformations";
import { PATTERN_SOURCE_TEXT } from "../src/lib/ziwei/patterns/evaluate";
import { XIJI_RULES, YANGTUO_LIUNIAN_TEXT } from "../src/lib/ziwei/fortune";
import { windows } from "./fixtures/ziwei_text_mask.mjs";
import base from "./fixtures/ziwei_rewrite_baseline.json";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const FINGER = new Set<string>(base.fingerprints);
const overlaps = (t: string) => windows(t).filter((w: string) => FINGER.has(w)).length;

// ---------------------------------------------------------------------------
// 1. 意味データ: 件数・文章以外の項目・原文フィールド
// ---------------------------------------------------------------------------
const FILES = {
  stars: STAR_MEANINGS,
  transformations: TRANSFORMATION_MEANINGS,
  palaces: PALACE_MEANINGS,
  starPalace: STAR_PALACE_MEANINGS,
  combinations: COMBINATION_MEANINGS,
  themes: THEME_MEANINGS,
} as const;
const FROZEN = ["text", "textKey", "opener", "continuesToNext", "mentionsStars", "mentionsPalaces", "sourceLength"];
for (const [name, arr] of Object.entries(FILES)) {
  const before = (base.structure as Record<string, Record<string, unknown>[]>)[name];
  check(`${name}: 件数が同じ（${before.length}）`, arr.length === before.length, `${arr.length}`);
  arr.forEach((e, i) => {
    const rest = Object.fromEntries(Object.entries(e).filter(([k]) => !FROZEN.includes(k)));
    check(`${name} ${e.id}: 文章以外の項目が同じ`, JSON.stringify(rest) === JSON.stringify(before[i]), e.id);
    check(`${name} ${e.id}: 原文フィールドなし`, !("sourceText" in e) && !("normalizedMeaning" in e) && !("originalText" in e) && !("rawText" in e) && !("quote" in e));
  });
}
const conditionCount = Object.values(FILES).flat().filter((e) => (e as { condition?: string }).condition).length;
const beforeConditions = Object.values(base.structure as Record<string, { condition?: string }[]>).flat().filter((e) => e.condition).length;
check(`条件付きの文の件数が同じ（${beforeConditions}）`, conditionCount === beforeConditions, `${conditionCount}`);

// ---------------------------------------------------------------------------
// 2. 表示文章に原文の長い一致がない
// ---------------------------------------------------------------------------
let textCount = 0;
for (const arr of [STAR_MEANINGS, TRANSFORMATION_MEANINGS, PALACE_MEANINGS, STAR_PALACE_MEANINGS, COMBINATION_MEANINGS]) {
  for (const e of arr) {
    textCount += 1;
    check(`${e.id}: 原文との9字以上の一致なし`, overlaps(e.text) === 0, e.text);
  }
}
for (const i of FORTUNE_STAR_ITEMS) for (const l of i.lines) check(`${l.id}: 行運星曜象意に原文の一致なし`, overlaps(l.text) === 0, l.text);
for (const m of Object.values(FORTUNE_HUA)) for (const c of [...m.coreMeanings, ...m.fortuneTexts]) check(`${m.type}: 行運四化象意に原文の一致なし`, overlaps(c.text) === 0, c.text);
for (const p of PATTERN_SOURCE_TEXT) for (const t of p.meaningText) check(`${p.id}: 格局象意に原文の一致なし`, overlaps(t) === 0, t);
for (const r of Object.values(XIJI_RULES)) check(`S40 ${r!.stem}: 表示文に原文の一致なし`, overlaps(r!.displayText) === 0 && overlaps(r!.summary) === 0, r!.displayText);
check("S33: 表示文に原文の一致なし", overlaps(YANGTUO_LIUNIAN_TEXT) === 0);
console.log(`照合した象意データの文: ${textCount}`);

// 物語・人物・たとえ・原書引用の形がない（星の特徴・宮別鑑定・行運・四化・格局・S33・S40）
const NARRATIVE = /彼ら|彼女|彼は|将軍|皇帝|帝王|(?<!破)軍|戦場|戦い|突撃|親衛|僧|出家|商人|宮廷|王族|王様|文官|官僚|関羽|三国|寓話|物語|昔々|とある|人物|たとえ|例えば|原書|古典|書物|本書|テキスト|前節|のちほど|後ほど|北斗|南斗|卦/;
const allTexts: [string, string][] = [
  ...[STAR_MEANINGS, TRANSFORMATION_MEANINGS, PALACE_MEANINGS, STAR_PALACE_MEANINGS, COMBINATION_MEANINGS].flatMap((arr) => arr.map((e) => [e.id, e.text] as [string, string])),
  ...FORTUNE_STAR_ITEMS.flatMap((i) => i.lines.map((l) => [l.id, l.text] as [string, string])),
  ...Object.values(FORTUNE_HUA).flatMap((m) => [...m.coreMeanings, ...m.fortuneTexts].map((c) => [m.type, c.text] as [string, string])),
  ...PATTERN_SOURCE_TEXT.flatMap((p) => p.meaningText.map((t) => [p.id, t] as [string, string])),
  ...Object.values(XIJI_RULES).map((r) => [`S40 ${r!.stem}`, r!.displayText] as [string, string]),
  ["S33", YANGTUO_LIUNIAN_TEXT],
];
for (const [id, t] of allTexts) check(`${id}: 架空人物・物語・たとえ・原書引用の語なし`, !NARRATIVE.test(t), t);
console.log(`物語形式を照合した文: ${allTexts.length}`);

// 表示しない文（空文字）は、星のイメージ文と、資料の前置き・文の断片だけ。星ごとの最初のイメージ文は表示する
const EMPTY_OK = new Set(["N-PL-041", "K-PL-兄弟宮-05", "K-PL-財帛宮-04", "K-PL-奴僕宮-04", "K-PL-身宮-05"]);
for (const arr of [STAR_MEANINGS, TRANSFORMATION_MEANINGS, PALACE_MEANINGS, STAR_PALACE_MEANINGS, COMBINATION_MEANINGS]) {
  for (const e of arr) if (e.text === "") check(`${e.id}: 空文はイメージ文か断片だけ`, (e as { category?: string }).category === "image" || EMPTY_OK.has(e.id));
}
const firstImage = new Map<string, string>();
for (const e of STAR_MEANINGS) if ((e as { category?: string }).category === "image" && !firstImage.has(e.stars[0])) firstImage.set(e.stars[0], e.text);
for (const [star, t] of firstImage) check(`${star}: 最初のイメージ文は表示する`, t !== "");

// 解釈本文と判断根拠（実際の命盤・全宮・全段階）
let basisCount = 0;
for (let y = 1945; y < 2005; y += 6) {
  const c = calculateZiweiChart({ birth: { year: y, month: (y % 12) + 1, day: 5 + (y % 20), hour: (y * 7) % 24, minute: 0 }, place: "東京", sex: y % 2 ? "male" : "female" });
  for (const p of c.palaces) {
    const ctx = buildPalaceMeaningContext(c, p.branch);
    for (const lv of ["brief", "standard", "detailed"] as const) {
      const r = buildRuleBasedInterpretation(ctx, { detailLevel: lv });
      check(`${y} ${p.name} ${lv}: 解釈本文に原文の一致なし`, overlaps(r.fullText.replace(/\n/g, "")) === 0);
      for (const sec of r.sections) {
        for (const b of sec.basis) {
          basisCount += 1;
          check(`${y} ${p.name}: 判断根拠に原文の一致なし`, overlaps(b) === 0, b);
          check(`${y} ${p.name}: 判断根拠に資料名・ページ・ID なし`, !/入門|基礎編|基礎２|p\.\d|N-ST|K-ST|N-SP|N-PL|K-PL/.test(b), b);
        }
        check(`${y} ${p.name}: 文に原文フィールドなし`, sec.sentences.every((s) => !("sourceText" in s)));
      }
    }
  }
}
console.log(`照合した判断根拠: ${basisCount}`);

// ---------------------------------------------------------------------------
// 3. 行運・格局・応用編の構造
// ---------------------------------------------------------------------------
const lines = FORTUNE_STAR_ITEMS.flatMap((i) => i.lines.map((l) => ({ id: l.id, kind: l.condition?.kind ?? null, sourceId: l.sourceId, parallelId: l.parallelId })));
check("行運星曜象意: 文の数・条件・対応が同じ", JSON.stringify(lines) === JSON.stringify(base.fortuneLines));
check("行運星曜象意: 原文フィールドなし", FORTUNE_STAR_ITEMS.every((i) => i.lines.every((l) => !("sourceText" in l) && !("parallelText" in l))));
check("格局: 33格の ID と出典が同じ", JSON.stringify(PATTERN_SOURCE_TEXT.map((p) => ({ id: p.id, sourceRef: p.sourceRef }))) === JSON.stringify(base.patternIds));
check("格局: 原文フィールドなし", PATTERN_SOURCE_TEXT.every((p) => !("conditionText" in p) && p.meaningConditions.every((m) => !("text" in m))));
check("応用編144: ouyou.json は変更なし", createHash("sha256").update(readFileSync("src/lib/ziwei/meanings/advanced/data/ouyou.json")).digest("hex") === base.ouyouSha256);
check("S40: 原文フィールドなし", Object.values(XIJI_RULES).every((r) => !("sourceText" in r!)));

const fail = failures.length;
console.log(`鑑定文の独自化: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
