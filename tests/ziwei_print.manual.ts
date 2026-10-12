// tests/ziwei_print.manual.ts
//
// /ziwei の印刷（src/lib/ziwei/print/printData.ts と src/app/ziwei/print/ZiweiChartPrint.tsx・ZiweiInterpretationPrint.tsx）の確認。docs/ziwei-basic-spec.md §25。
// 実行: npx tsx tests/ziwei_print.manual.ts
//
// 確認: 12宮すべて・命宮だけに応用編・confirmed の格局・要確認の格局は「条件一致・要確認」・
// 条件不成立／未判定／異性の応用編の文を印刷しない・内部ID・資料名・ページを印刷しない・
// 画面と同じ既存関数の結果（格局・応用編・解釈 standard）。

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import { evaluatePatterns } from "../src/lib/ziwei/patterns";
import { getAdvancedInterpretation } from "../src/lib/ziwei/meanings/advanced";
import { buildPalaceMeaningContext } from "../src/lib/ziwei/meanings";
import { buildRuleBasedInterpretation } from "../src/lib/ziwei/meanings/ruleInterpretation";
import { buildZiweiPrintData } from "../src/lib/ziwei/print/printData";
import { buildZiweiFortunePrintData } from "../src/lib/ziwei/print/fortunePrintData";
import ZiweiChartPrint from "../src/app/ziwei/print/ZiweiChartPrint";
import ZiweiInterpretationPrint from "../src/app/ziwei/print/ZiweiInterpretationPrint";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}

const PALACE_ORDER = ["命宮", "兄弟宮", "夫妻宮", "子女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "父母宮"];
const INTERNAL = /N-ST-|N-CB-|N-PL-|N-SP-|N-TH-|K-ST-|K-TH-|OUYOU-|K2-\d|EX-S|ZS-\d|sourceIds|needs_review|conditionPending|referenceOnly/;
const SOURCES = /紫微斗数入門|紫微斗数基礎編|紫微斗数基礎２|紫微斗数基礎2|紫微斗数応用編|入門 ?p\.|基礎編 ?S|基礎２ ?S|p\.\d|表13|表2|出典|開発/;

const inputs: [string, ZiweiInput][] = [
  ["A", { birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" }],
  ["B", { birth: { year: 1964, month: 12, day: 21, hour: 6, minute: 0 }, place: "東京", sex: "male" }],
  ["S38", { birth: { year: 1965, month: 1, day: 10, hour: 0, minute: 0 }, place: "東京", sex: "male" }],
  ["S24", { birth: { year: 1947, month: 3, day: 2, hour: 8, minute: 30 }, place: "東京", sex: "male" }],
];
for (let y = 1931; y <= 2007; y += 19) inputs.push([`sweep${y}`, { birth: { year: y, month: (y % 12) + 1, day: 12, hour: y % 24, minute: 5 }, place: "東京", sex: y % 2 ? "female" : "male" }]);

const header = (c: ZiweiChart) => ({
  name: "テスト",
  birthDate: "x",
  birthTime: "x",
  sex: c.sex === "male" ? "男" : "女",
  place: "東京",
  lunar: "x",
  mingPalace: c.mingPalace,
  shenPalace: c.shenPalace,
  bureau: c.bureau.name,
});

for (const [tag, inp] of inputs) {
  const chart = calculateZiweiChart(inp);
  const data = buildZiweiPrintData(chart, header(chart));
  const chartHtml = renderToStaticMarkup(createElement(ZiweiChartPrint, { data }));
  const fortune = buildZiweiFortunePrintData(chart, "2026-10-03");
  const html = renderToStaticMarkup(createElement(ZiweiInterpretationPrint, { data, fortune }));
  const text = (chartHtml + html).replace(/<[^>]+>/g, "\n");

  // 盤印刷と解釈印刷の分離
  check(`${tag} 盤印刷に命盤12宮`, (chartHtml.match(/class="zwp-cell/g) ?? []).length === 12);
  check(`${tag} 盤印刷に解釈の文章なし`, !/詳細解釈|応用編解釈|成立根拠|zwp-palace"/.test(chartHtml));
  check(`${tag} 解釈印刷に命盤なし`, !html.includes("zwp-board") && !html.includes("zwp-cell"));
  // 解釈印刷の構成順: 運命指数 → 格局 → 十二宮の解説 → 大限 → 小限
  const order = ["運命指数</h2>", "格局</h2>", "十二宮の解説</h2>", "大限</h2>", "小限</h2>"].map((k) => html.indexOf(k));
  check(`${tag} 構成順（運命指数→格局→十二宮→大限→小限）`, order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order.join(","));
  check(`${tag} 運命指数グラフ（画面と同じ部品）`, html.includes("zw-yearindex-svg") && html.indexOf("zw-yearindex-svg") < html.indexOf("格局</h2>"));
  check(`${tag} 大限は全大限`, fortune.majors.length === chart.dayun.periods.length && fortune.majors.every((m) => html.includes(`大限 ${m.startAge}〜${m.endAge}歳`)));
  check(`${tag} 小限の位置は全年齢`, fortune.minorTable.reduce((n, r) => n + r.ages.length, 0) === chart.dayun.periods[chart.dayun.periods.length - 1].endAge);
  // 盤全体の格局の説明は1回だけ
  for (const p of [...data.patterns.confirmed, ...data.patterns.review]) {
    for (const m of p.meanings) check(`${tag} 格局 ${p.name} の象意は1回`, html.split(m).length - 1 === 1);
    check(`${tag} 格局 ${p.name} の詳細は1回`, html.split(`${p.name}<span class="zwp-label`).length - 1 === 1);
  }

  // 12宮
  check(`${tag} 12宮すべて（命盤の宮順）`, data.palaces.map((p) => p.name).join() === PALACE_ORDER.join());
  check(`${tag} 命盤12宮`, data.board.length === 12);
  for (const n of PALACE_ORDER) check(`${tag} ${n}の詳細を印刷`, html.includes(`pp-title">${n}<`));
  // 応用編は命宮だけ
  check(`${tag} 命宮に応用編`, data.palaces[0].advanced !== null && data.palaces[0].name === "命宮");
  check(`${tag} 他宮に応用編なし`, data.palaces.slice(1).every((p) => p.advanced === null));
  // 解釈の全節を見出しに振り分けて漏れなく印刷（文章はそのまま）
  // 同じ宮の中で同じ文を2回以上印刷しない（別の宮では残す）。解釈の各文は宮の中に少なくとも1回は印刷
  for (const pd of data.palaces) {
    const sec = html.split(`pp-title">${pd.name}<`)[1]?.split('class="pp-palace')[0] ?? "";
    const sents = [...new Set(pd.interpretation.flatMap((x) => x.text.match(/[^。]+。?/g) ?? []).map((t) => t.replace(/^(また、|一方で、)/, "").replace(/。$/, "").trim()).filter((t) => t.length > 0))];
    for (const t of sents) {
      const n = sec.split(t.replaceAll("&", "&amp;")).length - 1;
      check(`${tag} ${pd.name} 文を1回以上印刷`, n >= 1, t.slice(0, 30));
    }
  }
  check(`${tag} 応用編の見出しは1つ`, (html.match(/pp-h3">応用編</g) ?? []).length === 1);

  // 画面と同じ結果（既存関数）
  const adv = getAdvancedInterpretation(chart);
  check(`${tag} 応用編本文＝画面`, JSON.stringify(data.palaces[0].advanced!.paragraphs) === JSON.stringify(adv.paragraphs.map((p) => p.text)));
  for (const s of adv.sentences.filter((x) => !x.shown)) check(`${tag} 非表示の応用編の文（${s.hiddenReason}）を印刷しない`, !html.includes(s.text));
  const pat = evaluatePatterns(chart);
  check(`${tag} confirmed の格局＝画面`, data.patterns.confirmed.map((p) => p.name).join() === pat.confirmed.map((p) => p.name).join());
  check(`${tag} 要確認の格局＝画面`, data.patterns.review.map((p) => p.name).join() === pat.matchedNeedsReview.map((p) => p.name).join());
  for (const p of pat.confirmed) check(`${tag} 成立の格局 ${p.name} を印刷`, html.includes(p.name));
  for (const p of data.patterns.review) check(`${tag} ${p.name} は「条件一致・要確認」`, p.label === "条件一致・要確認");
  for (const p of pat.patterns.filter((x) => x.status === "not_applicable")) {
    // 本命の格局の欄だけを見る（大限の欄の行運格局は別判定）
    const natalPart = html.slice(0, html.indexOf("大限</h2>"));
    if (!pat.confirmed.some((c) => c.name === p.name)) check(`${tag} 不成立の ${p.name} を印刷しない`, !natalPart.includes(`${p.name}<`));
  }
  for (const p of chart.palaces) {
    const r = buildRuleBasedInterpretation(buildPalaceMeaningContext(chart, p.branch), { detailLevel: "standard" });
    const d = data.palaces.find((x) => x.branch === p.branch)!;
    check(`${tag} ${p.name} 解釈（standard）＝既存関数`, JSON.stringify(d.interpretation) === JSON.stringify(r.sections.map((s) => ({ theme: s.theme, text: s.text }))));
  }

  // 内部ID・資料名・ページを印刷しない
  check(`${tag} 内部IDを印刷しない`, !INTERNAL.test(text), (text.match(INTERNAL) ?? [""])[0]);
  check(`${tag} 資料名・ページを印刷しない`, !SOURCES.test(text), (text.match(SOURCES) ?? [""])[0]);
  check(`${tag} 計算式を印刷しない`, !/×0\.5|×0\.3/.test(text));
}

const fail = failures.length;
console.log(`印刷: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
