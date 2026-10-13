// tests/qimen_judgment_summary.manual.ts
//
// AI を使わない定型説明（src/lib/qimenAiMaterials/judgmentSummary.ts）の確認。
// 実行: npx tsx tests/qimen_judgment_summary.manual.ts（--print で代表例の完成文を出力）
//
// 1) 全盤（2025-01-01〜01-30 の2時間刻み 360盤 × 9宮）で:
//    定型説明用データの名称・順序・件数・内部 ID が確定判断材料の表示用構造と一致（分類・名称の変更なし、重複なし）／
//    関連資料の文は relations がある親だけ／文章は決まった文型だけでできている（名称と件数を記号に置き換えて照合）／
//    内部 ID・原文の断片・禁止語が文章に出ない／0件は「今回の分類では〜はありません」だけ。
// 2) 人工の境界ケース: 名称の並べ方（1・2・3件以上）、関連資料の親が複数・1つの親に関連資料が複数、
//    つながなかった資料、中宮の宮名。

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildConfirmedMaterials,
  buildJudgmentDisplay,
  buildJudgmentSummary,
  renderJudgmentSummaryText,
  joinNames,
} from "../src/lib/qimenAiMaterials";
import type { JudgmentSummary, QimenJudgmentDisplay } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const ID_PATTERN = /\b(?:FACT|SINGLE|KOKUO|KAKU-[PWU]|FYFY|REF|EXCL)-\d{3}\b/;
const FORBIDDEN = [
  "総合", "優勢", "強い", "弱い", "相殺", "打ち消", "上回", "可能性", "べき", "慎重", "ため", "ので", "結果",
  "吉ではない", "吉意", "凶意", "おすすめ", "ください。".repeat(2),
];

/** 文章の段落が、名称（『…』の並び）と数字を記号に置き換えると、決まった文型のどれかになることを確かめる。 */
const TEMPLATES = new Set([
  "この{P}には、吉となる材料として{N}が成立しています。",
  "この{P}では、今回の分類で吉となる材料はありません。",
  "一方、この宮には{N}が注意する材料として成立しています。",
  "この宮では、今回の分類で注意する材料はありません。",
  "さらに宮単独の材料とは別に、盤全体では{N}が成立しています。",
  "盤全体では、今回の分類で注意する材料はありません。",
  "{N}には、別の関連資料もあります。",
  "{N}には、それぞれ別の関連資料もあります。",
  "{N}には、別の関連資料が{C}件あります。",
  "このほか、吉凶を分類していない剋應として、{C}件の剋應が成立しています。",
  "吉凶を分類していない剋應は、今回はありません。",
  "このほか、対応する格局を確定できなかった関連資料が{C}件あります。",
  "具体的な内容は、それぞれの判断材料をご確認ください。",
]);
function sentencesOf(paragraph: string): string[] {
  return paragraph.split(/(?<=。)/).filter((x) => x !== "");
}
function normalize(sentence: string, palace: string): string {
  return sentence
    .split(palace).join("{P}")
    .replace(/(?:『[^』]+』(?:と)?)+/g, "{N}")
    .replace(/\d+件/g, "{C}件");
}

function verify(display: QimenJudgmentDisplay, L: string) {
  const before = JSON.stringify(display);
  const s = buildJudgmentSummary(display);
  const t = renderJudgmentSummaryText(s);
  check(`${L} 入力不変`, JSON.stringify(display) === before);

  // データ: 分類・名称・順序・内部 ID が表示用構造のまま
  const g = display.groups;
  const map = (items: typeof g.favorable.items) => items.map((i) => ({ id: i.id, name: i.label, scope: i.scope }));
  check(`${L} 吉`, same(s.favorable, map(g.favorable.items)));
  check(`${L} 注意（この宮）`, same(s.cautionPalace, map(g.cautionPalace.items)));
  check(`${L} 注意（盤全体）`, same(s.cautionWholeChart, map(g.cautionWholeChart.items)));
  check(`${L} 未分類の剋應`, same(s.unclassifiedKokuo, map(g.unclassifiedKokuo.items)));
  const ids = [...s.favorable, ...s.cautionPalace, ...s.cautionWholeChart, ...s.unclassifiedKokuo].map((e) => e.id);
  check(`${L} 重複なし`, new Set(ids).size === ids.length);
  check(`${L} 関連資料の親`, same(
    s.relatedParents.map((r) => [r.parent.id, r.relatedIds]),
    Object.values(g).flatMap((x) => x.items).filter((p) => p.related.length > 0).map((p) => [p.id, p.related.map((c) => c.id)]),
  ) && s.relatedParents.every((r) => r.relatedIds.every((cid) => display.relations.some((x) => x.parentId === r.parent.id && x.childId === cid))));
  check(`${L} つながなかった資料`, same(s.unlinkedIds, display.unlinked.map((u) => u.item.id)));

  // 文章
  const palace = s.palaceTrigramName ? `${s.palaceTrigramName}（${s.palaceNumber}宮）` : `${s.palaceNumber}宮`;
  check(`${L} 段落数`, t.paragraphs.length === 5 + (s.unlinkedIds.length > 0 ? 1 : 0));
  for (const p of t.paragraphs) {
    for (const sent of sentencesOf(p)) check(`${L} 定型文のみ: ${sent.slice(0, 30)}`, TEMPLATES.has(normalize(sent, palace)));
  }
  check(`${L} 内部 ID なし`, !ID_PATTERN.test(t.text));
  for (const w of FORBIDDEN) check(`${L} 禁止語なし: ${w}`, !t.text.includes(w));
  // 名称はそのまま『』で入る
  for (const e of s.favorable) check(`${L} 吉の名称 ${e.name}`, t.paragraphs[0].includes(`『${e.scope === "盤全体" ? `${e.name}（盤全体）` : e.name}』`));
  for (const e of s.cautionPalace) check(`${L} 注意の名称 ${e.name}`, t.paragraphs[1].includes(`『${e.name}』`));
  for (const e of s.cautionWholeChart) check(`${L} 盤全体の名称 ${e.name}`, t.paragraphs[2].includes(`『${e.name}』`));
  // 関連資料の文: 関連資料が1件の親はまとめて1文、複数件の親は親ごとに1文
  const singleParents = s.relatedParents.filter((r) => r.relatedIds.length === 1).map((r) => r.parent.name);
  if (singleParents.length > 0) check(`${L} 関連資料の親の名称`, t.paragraphs[2].includes(`${joinNames(singleParents)}には、`));
  for (const r of s.relatedParents.filter((x) => x.relatedIds.length > 1)) {
    check(`${L} 関連資料が複数の親`, t.paragraphs[2].includes(`『${r.parent.name}』には、別の関連資料が${r.relatedIds.length}件あります。`));
  }
  check(`${L} 関連資料の文は relations がある場合だけ`, t.paragraphs[2].includes("関連資料") === (display.relations.length > 0));
  // 0件の文と件数
  check(`${L} 吉の0件`, (s.favorable.length === 0) === t.paragraphs[0].includes("今回の分類で吉となる材料はありません"));
  check(`${L} 注意の0件`, (s.cautionPalace.length === 0) === t.paragraphs[1].includes("今回の分類で注意する材料はありません"));
  check(`${L} 盤全体の0件`, (s.cautionWholeChart.length === 0) === t.paragraphs[2].includes("今回の分類で注意する材料はありません"));
  check(`${L} 未分類の件数`, s.unclassifiedKokuo.length === 0
    ? t.paragraphs[3] === "吉凶を分類していない剋應は、今回はありません。"
    : t.paragraphs[3].includes(`${s.unclassifiedKokuo.length}件の剋應`));
  // 原文の断片（6字以上）が文章に出ない（名称そのものは除く）
  const textWithoutNames = t.text.replace(/『[^』]+』/g, "");
  const all = Object.values(g).flatMap((x) => x.items).flatMap((p) => [p, ...p.related]);
  for (const it of all) {
    for (const src of it.sourceText) {
      for (const chunk of src.display.split(/[、。\n：:（）「」\s]/).filter((c) => [...c].length >= 6)) {
        check(`${L} 原文の断片なし ${it.id}`, !textWithoutNames.includes(chunk));
      }
    }
  }
  // 決定的（同じ入力から同じ文）
  check(`${L} 決定的`, renderJudgmentSummaryText(buildJudgmentSummary(display)).text === t.text);
  return { s, t };
}

function build(year: number, month: number, day: number, hour: number, palace: number) {
  const r = calculate({ year, month, day, hour, minute: 0, timezone: "Asia/Tokyo" });
  const full = serializeQimenAiInput(buildQimenPalaceMaterials(r, palace));
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(full));
  return buildJudgmentDisplay({ plan, confirmed: buildConfirmedMaterials(plan), full });
}

// ---- 1) 全盤 -----------------------------------------------------------------
const start = Date.UTC(2025, 0, 1, 0);
let boards = 0;
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  for (let palace = 1; palace <= 9; palace += 1) {
    verify(build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), palace), `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`);
    boards += 1;
  }
}

// 乾六宮の完成文
const kan = verify(build(2025, 1, 1, 15, 6), "乾六宮");
check("乾六宮の完成文", kan.t.text === [
  "この乾宮（6宮）には、吉となる材料として『休詐』と『玉兔入天門』が成立しています。",
  "一方、この宮には『乙奇入墓』『三奇受刑』『日奇伏吟』が注意する材料として成立しています。",
  "さらに宮単独の材料とは別に、盤全体では『伏吟格』と『反吟格』が成立しています。『伏吟格』には、別の関連資料もあります。",
  "このほか、吉凶を分類していない剋應として、3件の剋應が成立しています。",
  "具体的な内容は、それぞれの判断材料をご確認ください。",
].join("\n\n"));

// ---- 2) 人工の境界ケース ------------------------------------------------------
check("並べ方 0件", joinNames([]) === "");
check("並べ方 1件", joinNames(["休詐"]) === "『休詐』");
check("並べ方 2件", joinNames(["休詐", "玉兔入天門"]) === "『休詐』と『玉兔入天門』");
check("並べ方 3件", joinNames(["乙奇入墓", "三奇受刑", "日奇伏吟"]) === "『乙奇入墓』『三奇受刑』『日奇伏吟』");
{
  const e = (id: string, name: string, scope: "この宮" | "盤全体" | null = null) => ({ id, name, scope });
  const base: JudgmentSummary = {
    palaceNumber: 5, palaceTrigramName: null,
    favorable: [e("KAKU-W-009", "某吉格", "盤全体")], cautionPalace: [], cautionWholeChart: [e("KAKU-W-001", "伏吟格", "盤全体"), e("KAKU-W-002", "反吟格", "盤全体")],
    relatedParents: [
      { parent: e("KAKU-W-001", "伏吟格", "盤全体"), relatedIds: ["FYFY-001"] },
      { parent: e("KAKU-W-002", "反吟格", "盤全体"), relatedIds: ["FYFY-002"] },
    ],
    unclassifiedKokuo: [], unlinkedIds: ["FYFY-003"],
  };
  const t = renderJudgmentSummaryText(base);
  check("人工: 中宮は5宮", t.paragraphs[0].startsWith("この5宮には"));
  check("人工: 盤全体の吉は注記", t.paragraphs[0].includes("『某吉格（盤全体）』"));
  check("人工: 親が複数", t.paragraphs[2].includes("『伏吟格』と『反吟格』には、それぞれ別の関連資料もあります。"));
  check("人工: つながなかった資料", t.paragraphs.includes("このほか、対応する格局を確定できなかった関連資料が1件あります。"));
  check("人工: 0件の文", t.paragraphs[1] === "この宮では、今回の分類で注意する材料はありません。" && t.paragraphs[3] === "吉凶を分類していない剋應は、今回はありません。");
  check("人工: 内部 ID なし", !ID_PATTERN.test(t.text));
  const multi = renderJudgmentSummaryText({ ...base, relatedParents: [{ parent: e("KAKU-W-001", "伏吟格", "盤全体"), relatedIds: ["FYFY-001", "FYFY-002"] }], unlinkedIds: [] });
  check("人工: 1つの親に関連資料が複数", multi.paragraphs[2].includes("『伏吟格』には、別の関連資料が2件あります。"));
  for (const tt of [t, multi]) {
    for (const p of tt.paragraphs) for (const sent of sentencesOf(p)) check(`人工: 定型文のみ ${sent.slice(0, 20)}`, TEMPLATES.has(normalize(sent, "5宮")));
  }
}

if (process.argv.includes("--print")) {
  const samples: [string, number, number, number, number][] = [
    ["乾六宮（A・D・F・I）", 1, 1, 15, 6],
    ["1/1 4時 宮1（A・E・G・I）", 1, 1, 4, 1],
    ["1/1 0時 宮5（B・D・F・H）", 1, 1, 0, 5],
    ["1/1 0時 宮6（C・D・F・I）", 1, 1, 0, 6],
    ["1/5 2時 宮5（全グループ0件）", 1, 5, 2, 5],
  ];
  for (const [label, mo, da, h, p] of samples) {
    const disp = build(2025, mo, da, h, p);
    console.log(`==== ${label}`);
    console.log(renderJudgmentSummaryText(buildJudgmentSummary(disp)).text);
  }
}
console.log(`全盤 ${boards} 宮`);
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
