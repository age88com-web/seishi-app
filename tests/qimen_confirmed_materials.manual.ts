// tests/qimen_confirmed_materials.manual.ts
//
// 確定資料（confirmedMaterials.ts）・統合解説用入力（synthesisInput.ts）・統合解説用プロンプト
// （synthesisPrompt.ts）の確認。
// 実行: npx tsx tests/qimen_confirmed_materials.manual.ts
//   --print-confirmed / --print-input / --print-prompt で乾六宮の全文を出力する。
//
// 1) 指定ケース 2025-01-01 15:00（陽遁7局）乾六宮の確定情報（FACT-009 六合・静應／動應・scope・detail・
//    吉凶表記・対応格局・組み合わせ）と、入力・プロンプトの構成。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で:
//    Plan の全項目がちょうど1回ずつ・同じ区分・同じ順序で入る／確定情報は Plan の値そのもの／
//    原文 raw は Plan の値そのもの・display は toDisplayText(raw)／格局の2つの象意の扱いが規則どおり／
//    入力に渡さない情報が無い／プロンプトの MATERIALS は入力と完全一致。
// 3) 格局64格の2つの象意: まとめる 48格（完全一致30・句読点空白18）、両方表示 16格。

import { readFileSync } from "node:fs";
import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import { MEANING_DATA } from "../src/lib/qimenMeaning/data";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildConfirmedMaterials,
  buildSynthesisInput,
  buildSynthesisPrompt,
  requiredSynthesisIds,
  optionalSynthesisIds,
  toDisplayText,
  kakuMeaningMatch,
  kokuoCombination,
  synthesisPromptInstructions,
  synthesisMaterials,
  SYNTHESIS_PROMPT_DELIMITERS,
  NO_FORTUNE_LABEL,
} from "../src/lib/qimenAiMaterials";
import type {
  ConfirmedItem,
  ConfirmedMaterials,
  PlanEstablishedItem,
  QimenGenerationPlan,
  QimenSynthesisInput,
} from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ID_PATTERN = /\b(?:FACT|SINGLE|KOKUO|KAKU-[PWU]|FYFY|REF|EXCL)-\d{3}\b/g;
let singleItemsChecked = 0;

function build(year: number, month: number, day: number, hour: number, palace: number) {
  const r = calculate({ year, month, day, hour, minute: 0, timezone: "Asia/Tokyo" });
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, palace))));
  const planJson = JSON.stringify(plan);
  const confirmed = buildConfirmedMaterials(plan);
  const input = buildSynthesisInput(confirmed);
  const prompt = buildSynthesisPrompt(input);
  return { plan, planJson, confirmed, input, prompt };
}

/** Plan の成立済み項目と確定資料の項目を照合する。 */
function verifyItem(p: PlanEstablishedItem, c: ConfirmedItem, L: string) {
  check(`${L} ${c.id} id・kind`, c.id === p.item.id && c.kind === p.kind);
  if (p.kind === "kokuo") {
    const k = p.item;
    check(`${L} ${c.id} 剋應の確定情報`, c.header.type === k.kokuoType && c.header.name === k.name
      && c.header.fortune === (k.fortuneRaw ?? NO_FORTUNE_LABEL) && c.header.mode === (k.mode ?? undefined)
      && c.header.combination === kokuoCombination(k.kokuoType, k.key));
    check(`${L} ${c.id} 剋應の原文`, c.sourceText.length === 1 && c.sourceText[0].raw === k.body
      && c.sourceText[0].display === toDisplayText(k.body).display);
  } else if (p.kind === "fuYinFanYin") {
    const f = p.item;
    check(`${L} ${c.id} 伏吟反吟の確定情報`, c.header.name === f.kind && c.header.judgeDetail === f.judgeDetail
      && same(c.header.linkedKaku, p.basis.linkedKaku ?? undefined));
    const expRaw = [...f.linkedSubtypes.map((s) => s.description.join("\n")), f.fortuneText.join("\n")];
    const expLabel = [...f.linkedSubtypes.map((s) => s.name), f.fortuneHeading];
    check(`${L} ${c.id} 伏吟反吟の原文`, same(c.sourceText.map((s) => s.raw), expRaw) && same(c.sourceText.map((s) => s.label), expLabel));
  } else {
    const k = p.item;
    check(`${L} ${c.id} 格局の確定情報`, c.header.name === k.name && c.header.category === k.category
      && c.header.scope === (k.scope === "palace" ? "この宮" : "盤全体") && c.header.detail === (k.detail ?? undefined));
    const m = kakuMeaningMatch(k.judgeMeaning, k.meaningDb);
    check(`${L} ${c.id} 格局の象意の扱い`, c.kakuMeaning?.mode === (m ? "merged" : "both") && c.kakuMeaning?.matchedBy === m
      && c.kakuMeaning?.judgeMeaning === k.judgeMeaning && same(c.kakuMeaning?.meaningDb, k.meaningDb));
    const expRaw = m ? [k.judgeMeaning] : [k.judgeMeaning, ...(k.meaningDb ? [k.meaningDb.join("、")] : [])];
    check(`${L} ${c.id} 格局の原文`, same(c.sourceText.map((s) => s.raw), expRaw));
  }
  for (const s of c.sourceText) check(`${L} ${c.id} display`, s.display === toDisplayText(s.raw).display);
}

function verify(plan: QimenGenerationPlan, planJson: string, c: ConfirmedMaterials, input: QimenSynthesisInput, prompt: string, L: string) {
  check(`${L} Plan 不変`, JSON.stringify(plan) === planJson);
  check(`${L} 区分の構成`, same(Object.keys(c), ["schemaVersion", "palaceNumber", "section1", "section2", "section3", "section4", "unclassified"]));
  check(`${L} FACT`, same(c.section1.facts, plan.section1.facts.map((p) => ({ id: p.item.id, label: p.item.label, value: p.item.value }))));
  check(`${L} SINGLE の ID`, same(c.section1.singleMeanings.map((s) => s.id), plan.section1.singleMeanings.map((p) => p.item.id)));
  for (const [i, s] of c.section1.singleMeanings.entries()) {
    const content = plan.section1.singleMeanings[i].item.content as Record<string, unknown>;
    check(`${L} ${s.id} 吉凶ラベル`, s.fortuneLabel === (typeof content.fortuneLabel === "string" ? content.fortuneLabel : null));
    // 各見出しの項目は content の値そのもの（配列は要素をそのまま1項目ずつ、文字列は1項目）
    const expected = Object.entries(content)
      .filter(([k]) => k !== "name" && k !== "fortuneLabel" && k !== "palace" && k !== "fortune")
      .map(([, v]) => (Array.isArray(v) ? v.map(String) : [String(v)]));
    if (s.kind === "宮位吉凶") expected.push([String(content.fortune)]);
    check(`${L} ${s.id} 項目がそのまま`, same(s.lines.map((l) => l.values), expected));
    check(`${L} ${s.id} 項目数一致`, same(s.lines.map((l) => l.values.length), expected.map((v) => v.length)));
    // 単体象意を含める指定の入力（AI には渡さない）では、確定資料と同じ項目を持つ
    const inputSingle = buildSynthesisInput(c, { includeSingleMeanings: true }).singleMeanings.find((x) => x.id === s.id);
    check(`${L} ${s.id} 単体象意込みの入力も同じ項目`, same(inputSingle?.lines, s.lines));
    singleItemsChecked += s.lines.reduce((a, l) => a + l.values.length, 0);
  }
  for (const key of ["section2", "section3", "section4"] as const) {
    check(`${L} ${key} ID と順序`, same(c[key].items.map((x) => x.id), plan[key].items.map((p) => p.item.id)));
    plan[key].items.forEach((p, i) => verifyItem(p, c[key].items[i], L));
  }
  check(`${L} unclassified ID`, same(c.unclassified.items.map((x) => x.id), plan.unclassified.map((p) => p.item.id)));

  // 統合解説用入力（AI へ渡す形）: 単体象意なし・盤の事実は宮番号と八卦だけ
  const inputKeys: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { inputKeys.push(k); walk(x); }
  };
  walk(input);
  check(`${L} 入力に渡さない情報なし`, !inputKeys.some((k) => ["viewPath", "basis", "raw", "materialPath", "source", "sources", "kakuMeaning"].includes(k)));
  check(`${L} 入力に単体象意なし`, input.singleMeanings.length === 0 && optionalSynthesisIds(input).length === 0);
  check(`${L} 入力の盤の事実は宮番号・八卦だけ`, same(input.facts,
    c.section1.facts.filter((f) => f.label === "宮番号" || f.label === "八卦").map((f) => ({ label: f.label, value: f.value }))));
  check(`${L} 入力の成立済み材料`, same(input.established.map((e) => e.id),
    [...c.section2.items, ...c.section3.items, ...c.section4.items, ...c.unclassified.items].map((x) => x.id)));
  check(`${L} 入力の原文は display`, input.established.every((e) => {
    const src = [...c.section2.items, ...c.section3.items, ...c.section4.items, ...c.unclassified.items].find((x) => x.id === e.id)!;
    return same(e.sourceText, src.sourceText.map((s) => ({ label: s.label, text: s.display })));
  }));
  check(`${L} 引用必須ID`, same(requiredSynthesisIds(input), input.established.map((e) => e.id)));
  // 単体象意を含める指定では、単体象意と section1 の盤の事実が全件入る
  const full = buildSynthesisInput(c, { includeSingleMeanings: true });
  check(`${L} 単体象意込みの入力`, same(full.singleMeanings.map((x) => x.id), c.section1.singleMeanings.map((x) => x.id))
    && full.facts.length === c.section1.facts.length && same(full.established, input.established));

  // プロンプト
  const D = SYNTHESIS_PROMPT_DELIMITERS;
  const seq = [D.instructions, D.requiredIds, D.materials, D.endMaterials];
  const order = seq.map((d) => prompt.indexOf(d));
  check(`${L} 区切り順序・各1回`, order.every((p, i) => p >= 0 && (i === 0 || p > order[i - 1])) && order[0] === 0
    && seq.every((d) => prompt.split(d).length === 2));
  const part = (a: string, b: string) => prompt.slice(prompt.indexOf(a) + a.length, prompt.indexOf(b)).replace(/^\n/, "").replace(/\n+$/, "");
  const n = input.established.length;
  check(`${L} 固定命令は件数入りの定型そのもの`, part(D.instructions, D.requiredIds) === synthesisPromptInstructions(n));
  check(`${L} 固定命令に全件の件数`, n === 0 || part(D.instructions, D.requiredIds).includes(`成立済み判断材料は全${n}件です（REQUIRED IDS の${n}件）`));
  check(`${L} 必須ID一覧`, part(D.requiredIds, D.materials) === requiredSynthesisIds(input).join("\n"));
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(part(D.materials, D.endMaterials)); } catch { parsed = null; }
  check(`${L} MATERIALS は宮と成立済み材料だけ`, same(parsed, synthesisMaterials(input)) && !!parsed
    && same(Object.keys(parsed), ["palace", "established"]));
  const est = (parsed?.established ?? []) as Record<string, unknown>[];
  check(`${L} MATERIALS の成立済み材料`, est.length === n && est.every((o, i) => {
    const e = input.established[i];
    return o.id === e.id && !("番号" in o) && o.section === e.section && same(o.sourceText, e.sourceText) && o.type === e.header.type
      && (o.name ?? null) === e.header.name && o.mode === e.header.mode && o.scope === e.header.scope && o.detail === e.header.detail
      && o.fortune === e.header.fortune && o.combination === e.header.combination && same(o.linkedKaku, e.header.linkedKaku);
  }));
  check(`${L} プロンプトに単体象意なし`, !/SINGLE-\d{3}/.test(prompt) && !prompt.includes("singleMeanings"));
  check(`${L} プロンプトに材料番号なし`, !/成立材料\d/.test(prompt) && !prompt.includes('"番号"'));
  check(`${L} プロンプトに架空の例 ID なし`, !prompt.includes("[ID-") && !prompt.includes("ID-A"));
  const allowed = new Set(requiredSynthesisIds(input));
  check(`${L} プロンプトに入力外の ID なし`, (prompt.match(ID_PATTERN) ?? []).every((t) => allowed.has(t)));
}

// ---- 1) 指定ケース -----------------------------------------------------------
const sample = build(2025, 1, 1, 15, 6);
{
  const { plan, planJson, confirmed: c, input, prompt } = sample;
  const L = "指定ケース";
  verify(plan, planJson, c, input, prompt, L);
  const all = [...c.section2.items, ...c.section3.items, ...c.section4.items];
  const get = (id: string) => all.find((x) => x.id === id)!;
  const s2 = c.section1.singleMeanings.find((s) => s.id === "SINGLE-002")!;
  check(`${L} SINGLE-002 は4項目`, same(s2.lines, [{ label: "象意", values: ["病気の診断", "薬の処方など", "秋冬は嫁娶、征伐、訴訟", "祭祀、商業によいが、春夏は不利"] }]));
  check(`${L} SINGLE-002 単体象意込みの入力も4項目`, same(buildSynthesisInput(c, { includeSingleMeanings: true }).singleMeanings.find((s) => s.id === "SINGLE-002")?.lines, s2.lines));
  check(`${L} SINGLE-002 はプロンプトに無い`, !prompt.includes("秋冬は嫁娶"));
  check(`${L} FACT-009 は六合`, c.section1.facts.find((f) => f.id === "FACT-009")?.value === "六合");
  check(`${L} KOKUO-002 静應`, get("KOKUO-002").header.mode === "静應" && get("KOKUO-002").header.combination === "開門 × 地盤開門");
  check(`${L} KOKUO-003 動應`, get("KOKUO-003").header.mode === "動應" && get("KOKUO-003").header.fortune === "吉凶表記なし");
  check(`${L} KOKUO-004 静應`, get("KOKUO-004").header.mode === "静應" && get("KOKUO-004").header.combination === "開門 × 天盤乙");
  check(`${L} KOKUO-005 吉`, get("KOKUO-005").header.fortune === "吉" && get("KOKUO-005").header.combination === "乙奇 × 乾宮");
  check(`${L} KOKUO-001 凶`, get("KOKUO-001").header.fortune === "凶" && get("KOKUO-001").header.combination === "天盤乙 × 地盤乙");
  check(`${L} KAKU-W-001`, get("KAKU-W-001").header.scope === "盤全体" && get("KAKU-W-001").header.detail === "九星伏吟・八門伏吟");
  check(`${L} KAKU-W-002`, get("KAKU-W-002").header.scope === "盤全体" && get("KAKU-W-002").header.detail === "直符反吟");
  const f = get("FYFY-001");
  check(`${L} FYFY-001`, same(f.header.linkedKaku, { id: "KAKU-W-001", name: "伏吟格", category: "凶格" })
    && same(f.sourceText.map((s) => s.label), ["九星伏吟", "八門伏吟", "吉凶"]) && f.sourceText[2].raw.split("\n").length === 3);
  check(`${L} KOKUO-005 display`, get("KOKUO-005").sourceText[0].display.includes("大きく発展する。"));
  check(`${L} KOKUO-001 display`, get("KOKUO-001").sourceText[0].display.includes("わきまえて生き"));
  check(`${L} 盤の事実は宮番号と八卦`, same(input.facts, [{ label: "宮番号", value: 6 }, { label: "八卦", value: "乾" }]));
  check(`${L} 引用必須11件`, requiredSynthesisIds(input).length === 11);
  const I = synthesisPromptInstructions(11);
  check(`${L} 全11件`, prompt.includes("成立済み判断材料は全11件です（REQUIRED IDS の11件）。11件すべてを、本文のどこかで根拠として扱ってください。"));
  for (const w of [
    "あなたの仕事は、この宮で成立している判断材料全体を見て、それらが同時に成立している状態を、読み手が理解しやすい文章に整理することだけです",
    "各資料を順番に紹介することではありません。各資料の原文を書き写すことでもありません",
    "どのような吉の材料があるか", "どのような注意材料が同時にあるか", "盤全体に関係する材料には何があるか",
    "それぞれ別の資料であることを保ったまま", "最終的な吉凶の判定はしません",
    "全文を再現する必要はありません", "要約・整理はしてかまいません。ただし、意味を変えてはいけません",
    "ある材料の意味を、別の材料に混ぜてはいけません", "剋應を「吉格」と呼んではいけません",
    "主体や対象を変えてはいけません。条件を逆にしてはいけません", "資料にない吉凶を付けてはいけません。資料にない因果関係を作ってはいけません",
    "1件ずつ順番に説明する必要はありません", "REQUIRED IDS に書かれている文字列を一字も変えずにそのまま書いてください",
    "本文に「材料1」のような番号を書いてはいけません", "1つの資料にまとめず、それぞれの内容を書いた文の文末に、それぞれの ID を付けてください",
    "「剋應としてこのような内容がある」という扱いにしてください", "「吉」「凶」「吉の材料」「凶の材料」「注意材料」などに分類し直してはいけません",
    "入力にない材料を追加してはいけません", "八門・九星・八神・干などの意味を自分で補ってはいけません",
    "学習済みの奇門遁甲・風水・易・五行・占術知識を使用してはいけません",
    "2〜4段落程度", "材料名の一覧だけにしてはいけません",
    "「総合すると吉」「総合すると凶」「吉意の方が強い」「凶意の方が強い」",
  ]) {
    check(`${L} 必須文言: ${w.slice(0, 20)}`, I.includes(w));
  }
  for (const w of ["[ID-", "ID-A", "FYFY", "伏吟の図版", "「」で囲んで引用", "singleMeanings", "OPTIONAL"]) check(`${L} 含まない: ${w}`, !I.includes(w));
  check(`${L} 固定命令に ID なし`, (I.match(ID_PATTERN) ?? []).length === 0);
  check(`${L} 材料0件の文`, synthesisPromptInstructions(0).includes("この宮には成立済み判断材料がありません"));
}

// ---- 2) 全盤 -----------------------------------------------------------------
const mergeSeen = { merged: 0, both: 0 };
let kyuseiCombos = 0;
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  for (let palace = 1; palace <= 9; palace += 1) {
    const b = build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), palace);
    verify(b.plan, b.planJson, b.confirmed, b.input, b.prompt, `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`);
    for (const it of [...b.confirmed.section2.items, ...b.confirmed.section3.items]) {
      if (it.kakuMeaning) mergeSeen[it.kakuMeaning.mode] += 1;
      if (it.header.type === "九星値時剋應" && it.header.combination) kyuseiCombos += 1;
    }
  }
}
check("全盤で両方表示の格局を検証した", mergeSeen.both > 0 && mergeSeen.merged > 0);
check("全盤で九星値時の組み合わせを検証した", kyuseiCombos > 0);

// ---- 3) 格局64格の2つの象意 ---------------------------------------------------
{
  const src = readFileSync("src/lib/qimen/jikaku.ts", "utf8") + readFileSync("src/lib/qimen/kyokaku.ts", "utf8");
  const counts = { exact: 0, punctuation: 0, both: 0 };
  let n = 0;
  for (const m of src.matchAll(/name:\s*"([^"]+)",\s*meaning:\s*\n?\s*"([^"]+)"/g)) {
    n += 1;
    const r = kakuMeaningMatch(m[2], MEANING_DATA[m[1]] ?? null);
    counts[r ?? "both"] += 1;
  }
  check("格局64格", n === 64);
  check("完全一致30", counts.exact === 30);
  check("句読点・空白のみ18", counts.punctuation === 18);
  check("両方表示16", counts.both === 16);
  console.log(`格局64格: まとめる ${counts.exact + counts.punctuation}（完全一致 ${counts.exact}・句読点空白 ${counts.punctuation}）／両方表示 ${counts.both}`);
}

if (process.argv.includes("--print-confirmed")) console.log(JSON.stringify(sample.confirmed, null, 1));
if (process.argv.includes("--print-input")) console.log(JSON.stringify(sample.input, null, 1));
if (process.argv.includes("--print-prompt")) console.log(sample.prompt);
console.log(`全盤で見た格局: まとめる ${mergeSeen.merged} ／ 両方表示 ${mergeSeen.both}`);
console.log(`単体象意の項目数を照合した項目: ${singleItemsChecked}`);
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
