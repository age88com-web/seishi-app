// tests/ziwei_pattern_meanings.manual.ts
//
// 格局の象意の出し分け（src/lib/ziwei/patterns/meanings.ts・data/meanings.json）の確認。docs/ziwei-basic-spec.md §36。
// 実行: npx tsx tests/ziwei_pattern_meanings.manual.ts
//
// 確認: 33格の登録・成立した格局に象意がある・needs_review は「成立した場合の象意」・男女条件・条件付き象意・
// pending を出さない・warning／破格を象意に混ぜない・成立箇所（宮名を本文に入れない）・影響が及ぶ宮・
// 本命と大限の区別（「生涯」などを大限に出さない・大限専用の文を本命に出さない）・S33 年運文と混同しない・
// 資料にない語（一般知識の補完）がない・原文フィールドがない・印刷にも原文・資料名が出ない。

import { readFileSync } from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import { evaluatePatterns, PATTERN_MEANINGS, PATTERN_SOURCE_TEXT, resolvePatternMeaning, viewOf } from "../src/lib/ziwei/patterns";
import type { PatternMeaningItem, PatternResult } from "../src/lib/ziwei/patterns";
import { buildFortuneContextFor, YANGTUO_LIUNIAN_TEXT } from "../src/lib/ziwei/fortune";
import { buildZiweiPrintData } from "../src/lib/ziwei/print/printData";
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
const items = (id: string) => PATTERN_MEANINGS[id].items;
const textItem = (id: string, t: string) => items(id).find((i) => i.text === t);

// ---------------------------------------------------------------------------
// 1. 登録（33格・原文フィールドなし・資料にない語なし）
// ---------------------------------------------------------------------------
const ids = PATTERN_SOURCE_TEXT.map((p) => p.id);
check("33格すべて象意データあり", ids.length === 33 && ids.every((id) => PATTERN_MEANINGS[id]) && Object.keys(PATTERN_MEANINGS).length === 33);
const stats = { base: 0, conditional: 0, pending: 0, gender: 0, major: 0, any: 0 };
for (const id of ids) {
  const e = PATTERN_MEANINGS[id];
  check(`${id}: meaningStatus`, e.meaningStatus === "ok" || e.meaningStatus === "source_insufficient");
  check(`${id}: ok なら表示できる文（base か conditional）がある`, e.meaningStatus !== "ok" || e.items.some((i) => i.kind !== "pending"));
  for (const it of e.items) {
    stats[it.kind] += 1;
    if (it.gender) stats.gender += 1;
    if (it.scope === "major") stats.major += 1;
    if (it.scope === "any") stats.any += 1;
    check(`${id}: 文が空でない`, it.text.length > 0);
    check(`${id}: conditional は条件あり`, it.kind !== "conditional" || !!it.when);
    check(`${id}: pending は理由あり・条件なし`, it.kind !== "pending" || (!!it.pendingReason && !it.when));
    check(`${id}: 原文フィールドなし`, !["sourceText", "meaningTextOriginal", "quote", "rawText", "originalText"].some((k) => k in it));
    check(`${id}: 原文との9字以上の一致なし`, overlaps(it.text) === 0, it.text);
    // 資料にない意味（投資・起業の勧め・心理診断・助言など）を足していない。「投資」は K2-22 の資料の語
    check(`${id}: 一般知識の補完語なし`, !/おすすめ|しましょう|カウンセリング|メンタル|自己肯定|ストレス|キャリア|スキル/.test(it.text), it.text);
    check(`${id}: 破格・注意の文を象意に混ぜない`, !/破格|崩れやすい/.test(it.text), it.text);
    check(`${id}: 流年（S33）の文を混ぜない`, !/流年/.test(it.text) && it.text !== YANGTUO_LIUNIAN_TEXT, it.text);
    check(`${id}: 資料名・ページ・IDなし`, !/入門|基礎編|基礎２|S\d|p\.\d|K2-/.test(it.text), it.text);
    if (it.scope === "any" || it.scope === "major") check(`${id}: 行運で使う文に生涯の表現なし`, !/一生|生涯|人生を通|若いうち|若いころ|中年|晩年|三十歳/.test(it.text), it.text);
  }
}
const raw = readFileSync("src/lib/ziwei/patterns/data/meanings.json", "utf8") + readFileSync("src/lib/ziwei/patterns/data/sourceText.json", "utf8").replace(/"classicalPatterns"[\s\S]*$/, "");
check("象意データ・本編33格の出典データに原文フィールドなし", !/"(sourceText|meaningTextOriginal|quote|rawText|conditionText|meaningText)"\s*:/.test(raw));
check("全書52格は象意データなし", !Object.keys(PATTERN_MEANINGS).some((k) => !k.startsWith("K2-")));
console.log(`象意: base ${stats.base}・conditional ${stats.conditional}・pending ${stats.pending}（うち男女別 ${stats.gender}・大限専用 ${stats.major}・本命と大限共通 ${stats.any}）`);

// ---------------------------------------------------------------------------
// 2. 命盤の走査（成立・要確認の格局の象意）
// ---------------------------------------------------------------------------
const inputs: ZiweiInput[] = [];
for (let y = 1930; y <= 2012; y += 1)
  for (let m = 1; m <= 12; m += 1)
    for (const d of [5, 19]) inputs.push({ birth: { year: y, month: m, day: d, hour: (y * 5 + m * 7 + d) % 24, minute: 20 }, place: "東京", sex: (y + m + d) % 2 ? "male" : "female" });

const shown: Record<string, number> = {};
const seen = (k: string) => (shown[k] = (shown[k] ?? 0) + 1);
const allowed = (p: PatternResult, c: ZiweiChart) =>
  items(p.id).filter((i) => i.kind !== "pending" && (!i.scope || i.scope === "natal" || i.scope === "any") && (!i.gender || i.gender === c.sex));
const PALACES = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"];
let multiConfirmed = 0;
for (const inp of inputs) {
  const c = calculateZiweiChart(inp);
  const v = viewOf(c);
  const r = evaluatePatterns(c);
  if (r.confirmed.length >= 2) multiConfirmed += 1;
  for (const p of [...r.confirmed, ...r.matchedNeedsReview]) {
    const tag = `${JSON.stringify(inp.birth)} ${p.id}`;
    seen(`${p.status}`);
    const ok = allowed(p, c);
    // 表示文は、性別・スコープの合う base と、条件が成立した conditional だけ
    check(`${tag}: 表示文はデータの文のまま`, p.meanings.every((t) => ok.some((i) => i.text === t)));
    check(`${tag}: base はすべて表示`, ok.filter((i) => i.kind === "base").every((i) => p.meanings.includes(i.text)));
    check(`${tag}: pending は表示しない`, !items(p.id).some((i) => i.kind === "pending" && p.meanings.includes(i.text)));
    check(`${tag}: 大限専用の文を本命に出さない`, !items(p.id).some((i) => i.scope === "major" && p.meanings.includes(i.text)));
    check(`${tag}: 異なる性別の文を出さない`, !items(p.id).some((i) => i.gender && i.gender !== c.sex && p.meanings.includes(i.text)));
    check(`${tag}: 成立した格局に象意がある`, p.meanings.length > 0);
    // 宮名を本文に差し込まない（宮名は資料の文に含まれるものだけ）
    for (const t of p.meanings) for (const pn of PALACES) if (t.includes(pn)) check(`${tag}: 宮名は元の文にあるものだけ`, !!textItem(p.id, t));
    for (const t of p.meaning.conditional) {
      seen(`cond:${p.id}`);
      if (textItem(p.id, t)?.gender) seen("genderCond");
    }
    for (const t of p.meaning.base) if (textItem(p.id, t)?.gender) seen(`gender:${c.sex}`);
    // 条件付き象意の個別確認（判定を独立に計算）
    const m = c.mingPalace;
    if (p.id === "K2-04") {
      const met = v.meets(m, "文曲星") !== null;
      check(`${tag}: 明珠出海 文曲と会う文は会うときだけ`, p.meanings.some((t) => t.startsWith("文曲星と会っているため")) === met);
      const sat = v.maleficIn(v.sanfangSizheng(m)).length > 0;
      if (c.sex === "female") check(`${tag}: 明珠出海 女性の煞星有無で文を出し分け`, p.meanings.some((t) => t.includes("煞星が加会しているため")) === sat && p.meanings.some((t) => t.includes("煞星の加会がないため")) === !sat);
      else check(`${tag}: 明珠出海 男性に女性の文なし`, !p.meanings.some((t) => t.startsWith("女性")));
    }
    if (p.id === "K2-06") check(`${tag}: 日照雷門 甲年の女性の文`, p.meanings.some((t) => t.startsWith("甲の年に")) === (c.sex === "female" && c.yearStem === "甲"));
    if (p.id === "K2-08") check(`${tag}: 巨機同臨 酉の文は命宮酉だけ`, p.meanings.some((t) => t.startsWith("命宮が酉")) === (m === "酉"));
    if (p.id === "K2-24") {
      check(`${tag}: 坐貴向貴 男性・命宮天鉞の文`, p.meanings.some((t) => t.startsWith("男性で命宮に天鉞星")) === (c.sex === "male" && v.has(m, "天鉞星")));
      check(`${tag}: 坐貴向貴 女性・命宮天魁の文`, p.meanings.some((t) => t.startsWith("女性で命宮に天魁星")) === (c.sex === "female" && v.has(m, "天魁星")));
    }
    if (p.id === "K2-19") {
      // 三奇嘉會: 化禄・化権・化科の意味は常に表示。warning は注意（象意に入れない）
      check(`${tag}: 三奇嘉會 化禄・化権・化科の文`, p.meanings.some((t) => t.includes("化禄は主に財")));
      check(`${tag}: 三奇嘉會 warning を象意に入れない`, p.warningConditions.length === 4 || p.warningConditions.length === 2);
      if (p.warningConditions.some((w) => w.result === "applies")) seen("K2-19 warning");
    }
    if (p.id === "K2-32") {
      check(`${tag}: 羊陀夾忌 本命の文・影響が及ぶ宮は別`, p.meanings.includes("人生を通して災難や困難の多い格局です。") && p.affectedPalaces.length === p.matchedPalaces.length);
      check(`${tag}: 羊陀夾忌 大限の文・S33 の文なし`, !p.meanings.some((t) => t.includes("大限") || t === YANGTUO_LIUNIAN_TEXT));
    }
    if (p.status === "needs_review") check(`${tag}: 要確認は matchedNeedsReview に入る`, r.matchedNeedsReview.includes(p));
  }
  // 男女の対になる格局（君臣慶會）の出し分け（成立しなくても解決結果で確認）
  const k25 = resolvePatternMeaning("K2-25", v, [c.mingPalace], "natal");
  check("君臣慶會 性別で出し分け", k25.base.length === 1 && k25.base[0].startsWith(c.sex === "male" ? "男性" : "女性"));
}
console.log(`走査 ${inputs.length} 盤: ${JSON.stringify(shown)}・成立が2格以上の盤 ${multiConfirmed}`);
check("confirmed の格局がある", (shown.confirmed ?? 0) > 0);
check("needs_review（条件一致）の格局がある", (shown.needs_review ?? 0) > 0);
check("条件付き象意が表示される盤がある", Object.keys(shown).some((k) => k.startsWith("cond:")));
check("男女別の文が男女とも表示される", (shown["gender:male"] ?? 0) > 0 && (shown["gender:female"] ?? 0) > 0);

// pending は表示されない（データ上の pending を直接確認）
const pendingIds = Object.entries(PATTERN_MEANINGS).filter(([, e]) => e.items.some((i: PatternMeaningItem) => i.kind === "pending")).map(([id]) => id);
console.log(`pending のある格局: ${pendingIds.join("・")}`);

// ---------------------------------------------------------------------------
// 3. 大限の格局（S38 の命盤）
// ---------------------------------------------------------------------------
const s38 = calculateZiweiChart({ birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" });
const fAt = (start: number) => buildFortuneContextFor(s38, { year: 2026, month: 1, day: 1 }, { majorStartAge: start, minorAge: start + 1 });
const bing = fAt(12); // 丙寅
const ytj = bing.majorPatterns.find((p) => p.id === "K2-32")!;
check("S38 丙寅: 羊陀夾忌 成立", ytj.status === "confirmed");
check("S38 丙寅: 羊陀夾忌 大限の文", ytj.meanings.includes("この大限は凶と見ます。"));
check("S38 丙寅: 羊陀夾忌 本命の「人生を通して」を出さない", !ytj.meanings.some((t) => t.includes("人生")));
const touchesJie = [...ytj.matchedPalaces, ...ytj.affectedPalaces].some((x) => x.natalPalace === "疾厄宮");
check("S38 丙寅: 羊陀夾忌 疾厄宮に及ぶときだけ病気の文", ytj.meanings.some((t) => t.includes("病気")) === touchesJie && touchesJie);
check("S38 丙寅: 羊陀夾忌 影響が及ぶ宮は別に保持", ytj.affectedPalaces.length === 1);
check("S38 丙寅: S33 の年運文を混ぜない", !ytj.meanings.includes(YANGTUO_LIUNIAN_TEXT));
const xj = bing.majorPatterns.find((p) => p.id === "K2-33")!;
check("S38 丙寅: 刑忌夾印 大限父母宮で成立", xj.status === "confirmed" && xj.matchedPalaces[0].fortunePalace === "父母宮");
check("S38 丙寅: 刑忌夾印 父母宮の文・敗局の文", xj.meanings.some((t) => t.includes("両親や年長者")) && xj.meanings.some((t) => t.includes("敗局")));
check("S38 丙寅: 刑忌夾印 本命の文を出さない", !xj.meanings.includes("凶の働きを持つ格局です。"));
const ding = fAt(22); // 丁卯: 天相が大限命宮
const xj2 = ding.majorPatterns.find((p) => p.id === "K2-33")!;
check("S38 丁卯: 刑忌夾印 大限命宮では父母宮の文なし", xj2.status === "confirmed" && !xj2.meanings.some((t) => t.includes("両親")) && xj2.meanings.some((t) => t.includes("敗局")));
const ji = fAt(42); // 己巳
const sq = ji.majorPatterns.find((p) => p.id === "K2-19")!;
check("S38 己巳: 三奇嘉會 成立", sq.status === "confirmed");
check("S38 己巳: 三奇嘉會 大限の文と共通の文", sq.meanings.includes("この大限は、事業が伸びていく時期と見ます。") && sq.meanings.some((t) => t.includes("化禄は主に財")));
check("S38 己巳: 三奇嘉會 本命専用の条件文を出さない", !sq.meanings.some((t) => t.includes("財産と社会的地位の両方")));
check("S38 己巳: 三奇嘉會 warning は注意に分ける", sq.warningConditions.length === 2 && !sq.meanings.some((t) => /崩れ/.test(t)));
for (const p of [...bing.minorPatterns, ...ji.minorPatterns].filter((x) => x.conditionMatched))
  check(`S38 小限 ${p.id}: 大限専用の文を出さない`, !p.meanings.some((t) => t.includes("大限")));
// 本命の S38: 三奇嘉會・羊陀夾忌の本命の文
const n38 = evaluatePatterns(s38);
const nsq = n38.patterns.find((p) => p.id === "K2-19")!;
check("S38 本命: 三奇嘉會に大限の文なし", nsq.status === "confirmed" && !nsq.meanings.some((t) => t.includes("大限")));

// ---------------------------------------------------------------------------
// 4. 印刷・UI
// ---------------------------------------------------------------------------
const SOURCES = /紫微斗数入門|紫微斗数基礎編|紫微斗数基礎２|紫微斗数基礎2|入門 ?p\.|基礎２ ?S|p\.\d|K2-\d|needs_review/;
for (const inp of inputs.filter((_, i) => i % 97 === 0)) {
  const c = calculateZiweiChart(inp);
  const r = evaluatePatterns(c);
  const d = buildZiweiPrintData(c, { name: null, birthDate: "", birthTime: "", sex: "", place: "", lunar: "", mingPalace: "", shenPalace: "", bureau: "" });
  const tag = JSON.stringify(inp.birth);
  check(`${tag}: 印刷の成立格局に象意`, d.patterns.confirmed.every((p, i) => JSON.stringify(p.meanings) === JSON.stringify(r.confirmed[i].meanings) && p.meanings.length > 0));
  check(`${tag}: 印刷の要確認格局も象意`, d.patterns.review.every((p) => p.label === "条件一致・要確認" && p.meanings.length > 0));
  const txt = JSON.stringify(d.patterns);
  check(`${tag}: 印刷の格局に資料名・ID・原文なし`, !SOURCES.test(txt) && [...d.patterns.confirmed, ...d.patterns.review].every((p) => p.meanings.every((t) => overlaps(t) === 0)));
}
const panel = readFileSync("src/app/ziwei/PatternPanel.tsx", "utf8");
const printDoc = readFileSync("src/app/ziwei/print/ZiweiInterpretationPrint.tsx", "utf8");
check("UI: 要確認は「成立した場合の象意」", panel.includes("成立した場合の象意") && printDoc.includes("成立した場合の象意"));
check("UI: 象意は折りたたみに入れない", !/<summary>格局の象意<\/summary>/.test(panel) && panel.indexOf("zw-pattern-meaning") < panel.indexOf("<details"));
check("UI: 成立箇所・注意・影響が及ぶ宮を表示", panel.includes("成立箇所：") && panel.includes(">注意<") && panel.includes("影響が及ぶ宮："));
check("UI: 開発用の一覧・ID を出さない", !/sourceStatus|>\{p\.id\}<|全33格|開発確認/.test(panel.replace(/^\/\/.*$/gm, "")));

const fail = failures.length;
console.log(`格局の象意: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
