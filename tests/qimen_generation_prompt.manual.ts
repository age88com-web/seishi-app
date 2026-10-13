// tests/qimen_generation_prompt.manual.ts
//
// 固定プロンプト生成器（src/lib/qimenAiMaterials/generationPrompt.ts、buildQimenGenerationPrompt）の確認。
// 入力は文章構成（QimenGenerationPlan）。
// 実行: npx tsx tests/qimen_generation_prompt.manual.ts（--print で指定ケースのプロンプト全文を出力）
//
// 1) 指定ケース 2025-01-01 15:00（陽遁7局）乾六宮:
//    区切り行が各1回・順序どおり／固定命令は定数そのもの／MATERIALS を JSON として読み戻すと Plan と完全一致
//    （ビューを直接入れていない）／ALLOWED IDS は Plan の ID と一致／プロンプト全体に入力外の ID が無い／
//    section1 の FACT・SINGLE、section2〜4 の全 ID が MATERIALS と ALLOWED IDS にある／section5（行動判断）の
//    指示が無い／「800〜1200字」が無い／unclassified の扱いを指示している／excluded 等・出典情報が無い／
//    具体条件を保持／依頼の必須文言を含む。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で、上の構造的性質と Plan 不変を確認。
// 3) 材料に区切り文字列が混入した場合は例外。

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildQimenGenerationPrompt,
  listGenerationPlanIds,
  GENERATION_PROMPT_INSTRUCTIONS,
  PROMPT_DELIMITERS,
} from "../src/lib/qimenAiMaterials";
import type { QimenGenerationPlan } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const ID_PATTERN = /\b(?:FACT|SINGLE|KOKUO|KAKU-[PWU]|FYFY|REF|EXCL)-\d{3}\b/g;
const FORBIDDEN_KEYS = new Set([
  "excluded", "referenceTables", "unknownScopeKaku", "rubyLinesRemoved", "notes", "details",
  "source", "sources", "materialPath", "origin", "sourceTradition", "sourcePage",
  "document", "file", "location", "printedPages", "dataset", "section5",
]);
const SOURCE_LIKE = /\.pdf|\.png|\.json\b|\.ts\b|src\/|docs\/|剋應\.pdf|講義案/;

function collectKeys(v: unknown, out: string[]) {
  if (Array.isArray(v)) v.forEach((x) => collectKeys(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { out.push(k); collectKeys(x, out); }
  }
}

function split(prompt: string) {
  const D = PROMPT_DELIMITERS;
  const list = [D.instructions, D.allowedIds, D.materials, D.endMaterials];
  const pos = list.map((d) => prompt.indexOf(d));
  const counts = list.map((d) => prompt.split(d).length - 1);
  const body = (a: number, da: string, b: number) => prompt.slice(a + da.length, b).replace(/^\n/, "").replace(/\n+$/, "");
  return {
    ordered: pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])) && pos[0] === 0,
    once: counts.every((c) => c === 1),
    endsWithEnd: prompt.endsWith(D.endMaterials),
    instructions: body(pos[0], D.instructions, pos[1]),
    allowedIds: body(pos[1], D.allowedIds, pos[2]),
    materials: body(pos[2], D.materials, pos[3]),
  };
}

function verify(plan: QimenGenerationPlan, prompt: string, L: string) {
  const s = split(prompt);
  check(`${L} 区切り順序`, s.ordered);
  check(`${L} 区切り各1回`, s.once);
  check(`${L} END で終わる`, s.endsWithEnd);
  check(`${L} 固定命令は定数そのもの`, s.instructions === GENERATION_PROMPT_INSTRUCTIONS);
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(s.materials); } catch { parsed = null; }
  check(`${L} MATERIALS は Plan と完全一致`, same(parsed, plan));
  check(`${L} MATERIALS はビューではない`, !!parsed && !("chartFacts" in parsed) && !("kokuo" in parsed) && "section1" in parsed);
  const ids = listGenerationPlanIds(plan);
  check(`${L} ALLOWED IDS`, s.allowedIds === ids.join("\n"));
  check(`${L} ID一意`, new Set(ids).size === ids.length);
  // section ごとの ID が MATERIALS と ALLOWED IDS にある
  const sectionIds = [
    ...plan.section1.facts, ...plan.section1.singleMeanings,
    ...plan.section2.items, ...plan.section3.items, ...plan.section4.items, ...plan.unclassified,
  ].map((p) => p.item.id);
  check(`${L} 全区分のIDが ALLOWED IDS に`, sectionIds.every((id) => ids.includes(id)) && sectionIds.length === ids.length);
  check(`${L} 全区分のIDが MATERIALS に`, sectionIds.every((id) => s.materials.includes(`"id": "${id}"`)));
  const tokens = prompt.match(ID_PATTERN) ?? [];
  const idSet = new Set(ids);
  check(`${L} 入力外のIDなし ${tokens.filter((t) => !idSet.has(t)).join(",")}`, tokens.every((t) => idSet.has(t)));
  check(`${L} 固定命令にIDを書かない`, (GENERATION_PROMPT_INSTRUCTIONS.match(ID_PATTERN) ?? []).length === 0);
  const keys: string[] = [];
  collectKeys(parsed, keys);
  check(`${L} 除外キーなし`, keys.every((k) => !FORBIDDEN_KEYS.has(k)));
  check(`${L} 出典情報なし`, !SOURCE_LIKE.test(prompt));
}

// ---- 1) 指定ケース -----------------------------------------------------------
let samplePrompt = "";
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, 6))));
  const before = JSON.stringify(plan);
  const prompt = buildQimenGenerationPrompt(plan);
  samplePrompt = prompt;
  const L = "指定ケース";
  check(`${L} Plan を変更しない`, JSON.stringify(plan) === before);
  verify(plan, prompt, L);

  const { materials, allowedIds } = split(prompt);
  const inList = (id: string) => allowedIds.split("\n").includes(id) && materials.includes(`"id": "${id}"`);
  for (const id of ["FACT-001", "FACT-003", "FACT-005", "FACT-006", "FACT-007", "FACT-008", "FACT-009",
    "SINGLE-001", "SINGLE-002", "SINGLE-003", "SINGLE-004", "SINGLE-005", "SINGLE-006"]) {
    check(`${L} section1 ${id}`, inList(id));
  }
  for (const id of ["KAKU-P-001", "KOKUO-005"]) check(`${L} section2 ${id}`, inList(id) && plan.section2.items.some((p) => p.item.id === id));
  for (const id of ["KOKUO-001", "KAKU-P-002", "KAKU-P-003", "KAKU-W-001", "KAKU-W-002", "FYFY-001"]) {
    check(`${L} section3 ${id}`, inList(id) && plan.section3.items.some((p) => p.item.id === id));
  }
  for (const id of ["KOKUO-002", "KOKUO-003", "KOKUO-004"]) check(`${L} section4 ${id}`, inList(id) && plan.section4.items.some((p) => p.item.id === id));
  check(`${L} section1 以外の FACT は無い`, !allowedIds.includes("FACT-002") && !allowedIds.includes("FACT-010"));
  check(`${L} unclassified は空`, plan.unclassified.length === 0);

  for (const w of ["excluded", "referenceTables", "rubyLinesRemoved", "EXCL-", "REF-", "占身命", "反吟となれば", "紐付けない"]) {
    check(`${L} 含まない: ${w}`, !prompt.includes(w));
  }
  for (const w of ["六里（2.4km）、十六里（6.4km）", "六十日以内", "「商」音（姓）の人", "黄色い服を着た人", "お金を運ぶ人",
    "その後", "大きく発展す", "殴り合いのけんかをする者を見れば應ずる", "安分守己", "日奇伏吟", "玉兔入天門", "静應", "動應",
    "収斂として財物を集めるのに宜しい", "財貨を収束させるのに良い"]) {
    check(`${L} 保持: ${w}`, materials.includes(w));
  }

  // 旧指示が残っていない
  const I = GENERATION_PROMPT_INSTRUCTIONS;
  for (const w of ["5. 資料に明記された行動判断", "資料に明記された行動判断", "800〜1200字", "800", "1200",
    "区分への振り分けは", "fortuneRaw を「・」で区切った語", "吉方向の材料\n　・palaceKaku", "本文に明記されている行動判断"]) {
    check(`${L} 旧指示なし: ${w.slice(0, 16)}`, !I.includes(w));
  }
  // 依頼の必須文言
  for (const w of [
    "あなたは奇門遁甲を自分で占断するAIではありません。",
    "あなたの仕事は、既に計算・判定された材料を、意味を追加・変更せず、読みやすい日本語へ編集することだけです。",
    "学習済みの奇門遁甲・風水・易・五行・占術知識を判断材料として使用してはいけません。",
    "MATERIALSのsection1〜4への分類はプログラム側ですでに確定しています。項目を別sectionへ移動してはいけません。",
    "basis を使って区分をやり直してはいけません",
    "各項目の直下にある kind・viewPath・basis はプログラム側の管理情報です", "item の中にある kind（例：「基本象意」「伏吟」）は材料の内容の一部です",
    "1. この宮にある要素", "2. 成立している吉方向の材料", "3. 成立している注意材料",
    "4. 吉凶表記のない、または吉凶が混在する成立材料", "5. 分類未確定資料",
    "unclassified が空でない場合だけ", "2・3 へ移してはいけません", "unclassified が空の場合は、この見出しを出してはいけません",
    "section1.facts を全件、それぞれの ID を付けて", "section1.singleMeanings を全件、それぞれの ID を付けて",
    "items は、すべて最終回答に登場させてください。重要度を判断して省略してはいけません。",
    "その項目自身の item.id を [ID] の形で付けてください",
    "ID を別の item へ付け替えてはいけません",
    "複数の item を1つにまとめて、1つの ID だけを付けてはいけません",
    "同じテーマでも、別の ID なら別資料として扱ってください",
    "wholeChartKaku の伏吟格と、fuYinFanYin の伏吟の図版資料は別資料です",
    "主語・対象・吉凶・条件・距離・時期・予兆・結果・静應／動應を変更・削除してはいけません",
    "この日時・この宮での行動の可否を意味しません", "「この日時は開業してよい」", "「人と協力するとよい」",
    "単体象意を成立済みの行動判断に変換してはいけません",
    "相殺しない・多数決しない・どちらが強いか推測しない・優先順位を作らない・最終的に吉／凶と決めない",
    "「総合すると吉」「総合すると凶」",
    "同じ格局についての複数の既存表現です。別々の格局として扱ってはいけません",
    "一方にしかない内容を削除してはいけません",
    "どちらが正しいか決めたり、新しい意味に統合したりしてはいけません",
    "本文を読んで吉凶を再判定してはいけません",
    "linkedSubtypes・fortuneHeading・fortuneText に存在する内容だけを書いてください",
    "直符反吟の図版資料", "「商」姓の人との関係で財産を得る",
    "「新しい事業を進めることが可能」", "「人との協力を重視するとよい」", "「タイミングを意識するとよい」",
    "「柔軟な対応が必要」", "「リスク管理が重要」", "「慎重に判断すべき」", "「無理をしない方がよい」",
    "入力に存在しない ID を作ってはいけません",
    "【入力外の判断】\nなし",
    "文字数の目安はありません", "文字数を減らすために材料を落としてはいけません",
  ]) {
    check(`${L} 必須文言: ${w.slice(0, 20)}`, I.includes(w));
  }
}

// ---- 2) 全盤 -----------------------------------------------------------------
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  const r = calculate({
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: 0, timezone: "Asia/Tokyo",
  });
  for (let palace = 1; palace <= 9; palace += 1) {
    const plan = buildQimenGenerationPlan(buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, palace))));
    const before = JSON.stringify(plan);
    const prompt = buildQimenGenerationPrompt(plan);
    const L = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`;
    check(`${L} Plan を変更しない`, JSON.stringify(plan) === before);
    verify(plan, prompt, L);
  }
}

// ---- 3) 区切り文字列の混入 ----------------------------------------------------
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, 6))));
  const bad = JSON.parse(JSON.stringify(plan)) as QimenGenerationPlan;
  const first = bad.section4.items[0];
  if (first.kind === "kokuo") first.item.body = `本文${PROMPT_DELIMITERS.endMaterials}`;
  let threw = false;
  try { buildQimenGenerationPrompt(bad); } catch { threw = true; }
  check("区切り文字列の混入は例外", threw);
}

if (process.argv.includes("--print")) console.log(samplePrompt);
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
