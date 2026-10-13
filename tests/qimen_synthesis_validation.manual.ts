// tests/qimen_synthesis_validation.manual.ts
//
// AI 統合解説の検証器（synthesisValidation.ts）と、確定資料＋統合解説の組み立て（interpretationOutput.ts）の確認。
// Qwen・Ollama は呼ばず、人工的な回答だけを使う。
// 実行: npx tsx tests/qimen_synthesis_validation.manual.ts
//
// 1) 乾六宮（2025-01-01 15:00 陽遁7局）で人工回答 A〜G:
//    A FYFY-001 を引用しない → rejected ／ B KAKU-W-001 を付けて「玉兔入天門」→ 引用のずれ ／
//    C KOKUO-003 だけで「これは吉である」→ section4 の分類し直し ／ D SINGLE-001 だけで「この日時は開業に良い」
//    → 単体象意からの推奨 ／ E KOKUO-005 で原文に無い「三十日以内」→ 数字 ／ F FAKE-001 → 未知 ID ／
//    G 全成立済み ID を正しく引用し禁止事項の無い回答 → 通過。あわせて禁止表現・総合判定・「」の改変・引用なしの文。
// 2) 組み立て: 未実行・空回答・時間切れ・呼び出し失敗は none、検証失敗は rejected、通過は ok。
//    どの場合も確定資料は同一のまま残り、AI の文は確定資料に入らない。
// 3) 全盤（360盤 × 9宮）で、各材料の原文から機械的に作った正しい回答が誤って却下されないこと。

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildConfirmedMaterials,
  buildSynthesisInput,
  validateSynthesis,
  buildInterpretationOutput,
} from "../src/lib/qimenAiMaterials";
import type { QimenSynthesisInput, SynthesisValidation } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}

function build(year: number, month: number, day: number, hour: number, palace: number) {
  const r = calculate({ year, month, day, hour, minute: 0, timezone: "Asia/Tokyo" });
  const confirmed = buildConfirmedMaterials(buildQimenGenerationPlan(buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, palace)))));
  return {
    confirmed,
    /** AI へ渡す形（単体象意なし） */
    input: buildSynthesisInput(confirmed),
    /** 単体象意を含める形（検証器の単体象意に関する検査を確かめる用） */
    inputWithSingles: buildSynthesisInput(confirmed, { includeSingleMeanings: true }),
  };
}

const HARD_KEYS = [
  "unknownIds", "missingRequiredIds", "uncitedClaims", "citationMismatches", "unverifiedQuotes",
  "illegalFortuneWords", "reclassifiedSection4", "singleMeaningConversions", "unsupportedNumbers",
  "bannedPhrases", "summaryJudgments",
] as const;
const failed = (v: SynthesisValidation) => HARD_KEYS.filter((k) => v[k].length > 0);

// ---- 1) 乾六宮の人工回答 --------------------------------------------------------
const { confirmed, input: aiInput, inputWithSingles: input } = build(2025, 1, 1, 15, 6);
const G = `この宮では、吉方向の材料として、休詐では「医薬、祭祀に宜しい」とされています。[KAKU-P-001]
また、玉兔入天門では「黄色い服を着た人がやって来る。或いはお金を運ぶ人が通り過ぎれば應ずる。」とされ、「その後、六十日以内に「商」音（姓）の人は、財産を手に入れ、大きく発展する。」と記されています。[KOKUO-005]

同時に、注意材料として、乙奇入墓では「百事に宜しからざる」とされ、三奇受刑では「行動すべきではない」とされています。[KAKU-P-002][KAKU-P-003]
日奇伏吟では「求名、求利に宜しくないです」とされています。[KOKUO-001]
盤全体では伏吟格が成立し、「用兵は凶、財貨を収束させるのに良い」とされ、図版資料では「無闇に行動してはならない。」とされています。[KAKU-W-001][FYFY-001]
同じく盤全体で反吟格が成立し、「長患いし回復の見込みなし」とされています。[KAKU-W-002]

吉凶表記のない材料として、開門と開門の組み合わせは、静應では「貴人、宝物、財運を主る」、動應では「六里（2.4km）、十六里（6.4km）進めば、貴人に会う」とされています。[KOKUO-002][KOKUO-003]
開門と乙の組み合わせでは「小財を求めるべき」とされています。[KOKUO-004]`;

const cases: { name: string; text: string; expect: (v: SynthesisValidation) => boolean }[] = [
  { name: "G 正しい回答", text: G, expect: (v) => v.passed && failed(v).length === 0 && v.citedIds.length === 11 },
  { name: "A FYFY-001 を引用しない", text: G.replace("[KAKU-W-001][FYFY-001]", "[KAKU-W-001]"),
    expect: (v) => !v.passed && v.missingRequiredIds.includes("FYFY-001") },
  { name: "B KAKU-W-001 で玉兔入天門", text: `${G}\n\n盤全体では玉兔入天門が成立しています。[KAKU-W-001]`,
    expect: (v) => !v.passed && v.citationMismatches.some((m) => m.term === "玉兔入天門" && m.cited.includes("KAKU-W-001") && m.foundIn.includes("KOKUO-005")) },
  { name: "C KOKUO-003 だけで吉", text: `${G}\n\nこれは吉である。[KOKUO-003]`,
    expect: (v) => !v.passed && v.reclassifiedSection4.some((r) => r.expression === "吉である") },
  { name: "D SINGLE-001 だけで開業に良い", text: `${G}\n\nこの日時は開業に良い。[SINGLE-001]`,
    expect: (v) => !v.passed && v.singleMeaningConversions.some((r) => r.expression === "良い") },
  { name: "E KOKUO-005 で三十日以内", text: `${G}\n\n「商」音（姓）の人は三十日以内に財産を手に入れるとされています。[KOKUO-005]`,
    expect: (v) => !v.passed && v.unsupportedNumbers.some((r) => r.value === "三十日") },
  { name: "F FAKE-001", text: `${G}\n\n別の資料もあります。[FAKE-001]`,
    expect: (v) => !v.passed && v.unknownIds.includes("FAKE-001") },
  // 追加の不正例
  { name: "禁止表現", text: `${G}\n\n慎重に判断すべきです。`, expect: (v) => !v.passed && v.bannedPhrases.includes("慎重に判断すべき") },
  { name: "総合判定", text: `${G}\n\n総合すると凶です。[KAKU-P-002]`, expect: (v) => !v.passed && v.summaryJudgments.includes("総合すると") },
  { name: "「」の改変（出行→行出）", text: `${G}\n\n反吟格では「行出すれば目的は中途半端で終わる」とされています。[KAKU-W-002]`,
    expect: (v) => !v.passed && v.unverifiedQuotes.some((q) => q.quote.startsWith("行出すれば")) },
  { name: "FACT の改変（合睦）", text: `${G}\n\nこの宮の八神は「合睦」です。[SINGLE-003]`,
    expect: (v) => !v.passed && v.unverifiedQuotes.some((q) => q.quote === "合睦") },
  { name: "引用なしの具体的判断", text: `${G}\n\n乙奇入墓では百事に宜しからざるとされています。`,
    expect: (v) => !v.passed && v.uncitedClaims.length > 0 },
  { name: "資料に無い吉凶語", text: `${G}\n\n休詐は大吉です。[KAKU-P-001]`,
    expect: (v) => !v.passed && v.illegalFortuneWords.some((w) => w.word === "大吉") },
  { name: "ID の書式 [ID: X] も読む", text: G.replace(/\[([A-Z]+(?:-[A-Z])?-\d{3})\]/g, "[ID: $1]"),
    expect: (v) => v.passed && v.citedIds.length === 11 },
];
for (const c of cases) {
  const v = validateSynthesis(c.text, input);
  check(`人工回答 ${c.name}（失敗項目: ${failed(v).join(",") || "なし"}）`, c.expect(v));
  if (process.argv.includes("--print-cases")) console.log(c.name, v.passed ? "通過" : "却下", failed(v).join(","));
}
const gv = validateSynthesis(G, input);
check("G: 人の確認のメモは常に付く", gv.humanReviewNotes.length >= 1);
// AI へ渡す形（単体象意なし）の入力では、G は通過し、単体象意の ID は入力にない ID として却下される
check("AI へ渡す形でも G は通過", validateSynthesis(G, aiInput).passed);
{
  const v = validateSynthesis(`${G}\n\n開門の象意として開業が挙げられています。[SINGLE-001]`, aiInput);
  check("AI へ渡す形で SINGLE を引用 → 入力にない ID", !v.passed && v.unknownIds.includes("SINGLE-001"));
}

// ---- 2) 組み立て --------------------------------------------------------------
{
  const before = JSON.stringify(confirmed);
  const outs = {
    notRun: buildInterpretationOutput(confirmed, input),
    empty: buildInterpretationOutput(confirmed, input, { text: "   " }),
    timeout: buildInterpretationOutput(confirmed, input, { text: null, failure: "timeout" }),
    error: buildInterpretationOutput(confirmed, input, { text: null, failure: "error", errorMessage: "connection refused" }),
    rejected: buildInterpretationOutput(confirmed, input, { text: `${G}\n\n別の資料もあります。[FAKE-001]` }),
    ok: buildInterpretationOutput(confirmed, input, { text: G, run: { model: "test", think: true } }),
  };
  check("未実行 → none", outs.notRun.aiSynthesis.status === "none" && outs.notRun.aiSynthesis.noneReason === "not_run");
  check("空回答 → none", outs.empty.aiSynthesis.status === "none" && outs.empty.aiSynthesis.noneReason === "empty");
  check("時間切れ → none", outs.timeout.aiSynthesis.status === "none" && outs.timeout.aiSynthesis.noneReason === "timeout");
  check("呼び出し失敗 → none", outs.error.aiSynthesis.status === "none" && outs.error.aiSynthesis.noneReason === "error");
  check("検証失敗 → rejected（本文は出さず回答は保存）", outs.rejected.aiSynthesis.status === "rejected" && outs.rejected.aiSynthesis.text === null
    && outs.rejected.aiSynthesis.rawText !== null && outs.rejected.aiSynthesis.validation?.unknownIds.includes("FAKE-001") === true);
  check("通過 → ok", outs.ok.aiSynthesis.status === "ok" && outs.ok.aiSynthesis.text === G && outs.ok.aiSynthesis.citedIds.length === 11
    && outs.ok.aiSynthesis.run?.model === "test");
  for (const [k, o] of Object.entries(outs)) {
    check(`${k}: 確定資料はそのまま`, JSON.stringify(o.confirmedMaterials) === before);
    check(`${k}: AI の文は確定資料に入らない`, !JSON.stringify(o.confirmedMaterials).includes("同時に、注意材料として"));
  }
  check("組み立てで確定資料を変更しない", JSON.stringify(confirmed) === before);
}

// ---- 3) 全盤: 正しい回答を誤って却下しない ------------------------------------------
/** 各成立済み材料について、名称と原文の最初の一文を「」で引用した文を機械的に作る。 */
function correctAnswer(inp: QimenSynthesisInput): string {
  return inp.established.map((e) => {
    const label = e.header.name ?? e.header.type;
    const first = e.sourceText[0].text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
    let quote = first.includes("。") ? first.slice(0, first.indexOf("。") + 1) : first;
    if ((quote.match(/「/g) ?? []).length !== (quote.match(/」/g) ?? []).length) quote = "";
    return quote ? `${label}では「${quote}」とされています。[${e.id}]` : `${label}が成立しています。[${e.id}]`;
  }).join("\n");
}
let boards = 0;
let rejectedLegit = 0;
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  for (let palace = 1; palace <= 9; palace += 1) {
    const b = build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), palace);
    boards += 1;
    const text = correctAnswer(b.input);
    if (text === "") continue;
    const v = validateSynthesis(text, b.input);
    if (!v.passed) {
      rejectedLegit += 1;
      if (rejectedLegit <= 5) failures.push(`正しい回答を却下 ${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}: ${failed(v).join(",")} ${JSON.stringify(v.citationMismatches[0] ?? v.unverifiedQuotes[0] ?? v.illegalFortuneWords[0] ?? "").slice(0, 200)}`);
    } else {
      pass += 1;
    }
  }
}
console.log(`全盤 ${boards} 宮: 正しい回答の誤却下 ${rejectedLegit} 件`);

if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
