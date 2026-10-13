// tests/qimen_generation_plan.manual.ts
//
// 文章構成（src/lib/qimenAiMaterials/generationPlan.ts、buildQimenGenerationPlan）の確認。
// 実行: npx tsx tests/qimen_generation_plan.manual.ts
//
// 1) 指定ケース 2025-01-01 15:00（陽遁7局）乾六宮:
//    section1 = FACT-001/003/005/006/007/008/009 と SINGLE-001〜006、
//    section2 = KAKU-P-001・KOKUO-005、section3 = KOKUO-001・KAKU-P-002・KAKU-P-003・KAKU-W-001・
//    KAKU-W-002・FYFY-001、section4 = KOKUO-002・KOKUO-003・KOKUO-004、section5 は存在しない。
//    KAKU-W-001（伏吟格）と FYFY-001（図版資料）は別項目で、ID と内容が交差しない。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で:
//    全項目の ID と内容がビューの元項目と一致（viewPath から引いても ID から引いても同じ）／
//    成立済み材料（kokuo・格局・fuYinFanYin）が section2〜4・unclassified にちょうど1回ずつ／
//    振り分けが規則どおり／FYFY の対応格局は judgeName と同名で一意のときだけ継承／ビュー不変。
// 3) 人工ケース: FYFY の対応格局が0件・複数件のとき、推測せず unclassified に置く。

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  classifyKokuoFortune,
  SECTION1_FACT_LABELS,
} from "../src/lib/qimenAiMaterials";
import type { QimenGenerationPlan, QimenGenerationView } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function resolvePath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.match(/[^.[\]]+/g) ?? []) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function viewItemById(view: QimenGenerationView, id: string): unknown[] {
  return [
    ...view.chartFacts, ...view.singleMeanings, ...view.kokuo,
    ...view.palaceKaku, ...view.wholeChartKaku, ...view.fuYinFanYin,
  ].filter((x) => x.id === id);
}

function verify(view: QimenGenerationView, plan: QimenGenerationPlan, L: string) {
  check(`${L} section5なし`, !("section5" in plan));
  check(`${L} 区分は4つ`, same(Object.keys(plan).filter((k) => k.startsWith("section")), ["section1", "section2", "section3", "section4"]));

  const all = [
    ...plan.section1.facts, ...plan.section1.singleMeanings,
    ...plan.section2.items, ...plan.section3.items, ...plan.section4.items, ...plan.unclassified,
  ];
  // ID と内容の整合（viewPath から引いても ID から引いても同じ元項目）
  for (const p of all) {
    const byPath = resolvePath(view, p.viewPath);
    const byId = viewItemById(view, p.item.id);
    check(`${L} ${p.item.id} viewPath一致`, same(byPath, p.item));
    check(`${L} ${p.item.id} ID一意で内容一致`, byId.length === 1 && same(byId[0], p.item));
    check(`${L} ${p.item.id} 区分の種類`, p.viewPath.startsWith(p.kind === "chartFact" ? "chartFacts[" : p.kind === "singleMeaning" ? "singleMeanings[" : `${p.kind}[`));
  }

  // section1
  const expFacts = view.chartFacts.filter((f) => (SECTION1_FACT_LABELS as readonly string[]).includes(f.label)).map((f) => f.id);
  check(`${L} section1 FACT`, same(plan.section1.facts.map((p) => p.item.id), expFacts));
  check(`${L} section1 SINGLE全件`, same(plan.section1.singleMeanings.map((p) => p.item.id), view.singleMeanings.map((s) => s.id)));

  // 成立済み材料がちょうど1回ずつ（消失・重複なし）
  const established = [...view.kokuo, ...view.palaceKaku, ...view.wholeChartKaku, ...view.fuYinFanYin].map((x) => x.id);
  const placed = [...plan.section2.items, ...plan.section3.items, ...plan.section4.items, ...plan.unclassified].map((p) => p.item.id);
  check(`${L} 成立済み材料 消失・重複なし`, same([...placed].sort(), [...established].sort()));

  // 振り分け規則
  const inSection = (id: string) =>
    plan.section2.items.some((p) => p.item.id === id) ? 2
      : plan.section3.items.some((p) => p.item.id === id) ? 3
        : plan.section4.items.some((p) => p.item.id === id) ? 4 : 0;
  for (const k of view.kokuo) {
    const c = classifyKokuoFortune(k.fortuneRaw);
    check(`${L} ${k.id} 剋應の区分`, inSection(k.id) === (c === "favorable" ? 2 : c === "caution" ? 3 : 4));
  }
  for (const k of [...view.palaceKaku, ...view.wholeChartKaku]) {
    check(`${L} ${k.id} 格局の区分`, inSection(k.id) === (k.category === "吉格" ? 2 : 3));
  }
  for (const p of [...plan.section2.items, ...plan.section3.items, ...plan.unclassified]) {
    if (p.kind !== "fuYinFanYin") continue;
    const cands = [...view.palaceKaku, ...view.wholeChartKaku].filter((k) => k.name === p.item.judgeName);
    check(`${L} ${p.item.id} 候補`, same(p.basis.candidateIds, cands.map((k) => k.id)));
    if (cands.length === 1) {
      check(`${L} ${p.item.id} 継承`, p.basis.linkedKaku?.id === cands[0].id && inSection(p.item.id) === (cands[0].category === "吉格" ? 2 : 3));
      check(`${L} ${p.item.id} 対応格局とは別項目`, p.item.id !== cands[0].id && inSection(cands[0].id) !== 0);
    } else {
      check(`${L} ${p.item.id} 一意でなければ未分類`, p.basis.linkedKaku === null && plan.unclassified.includes(p));
    }
  }
}

// ---- 1) 指定ケース -----------------------------------------------------------
let sample: QimenGenerationPlan | null = null;
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const view = buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, 6)));
  const before = JSON.stringify(view);
  const plan = buildQimenGenerationPlan(view);
  sample = plan;
  const L = "指定ケース";
  check(`${L} ビュー不変`, JSON.stringify(view) === before);
  verify(view, plan, L);
  const ids = (items: { item: { id: string } }[]) => items.map((p) => p.item.id);
  check(`${L} section1 FACT`, same(ids(plan.section1.facts), ["FACT-001", "FACT-003", "FACT-005", "FACT-006", "FACT-007", "FACT-008", "FACT-009"]));
  check(`${L} section1 SINGLE`, same(ids(plan.section1.singleMeanings), ["SINGLE-001", "SINGLE-002", "SINGLE-003", "SINGLE-004", "SINGLE-005", "SINGLE-006"]));
  check(`${L} section2`, same(ids(plan.section2.items).sort(), ["KAKU-P-001", "KOKUO-005"]));
  check(`${L} section3`, same(ids(plan.section3.items).sort(), ["FYFY-001", "KAKU-P-002", "KAKU-P-003", "KAKU-W-001", "KAKU-W-002", "KOKUO-001"]));
  check(`${L} section4`, same(ids(plan.section4.items), ["KOKUO-002", "KOKUO-003", "KOKUO-004"]));
  check(`${L} 未分類なし`, plan.unclassified.length === 0);

  // ID と内容の交差なし（代表的な本文）
  const get = (id: string) => [...plan.section2.items, ...plan.section3.items, ...plan.section4.items].find((p) => p.item.id === id)!;
  const k5 = get("KOKUO-005");
  check(`${L} KOKUO-005 は玉兔入天門`, k5.kind === "kokuo" && k5.item.name === "玉兔入天門" && k5.item.body.includes("「商」音（姓）の人"));
  const w1 = get("KAKU-W-001");
  check(`${L} KAKU-W-001 は伏吟格`, w1.kind === "wholeChartKaku" && w1.item.name === "伏吟格" && w1.item.judgeMeaning === "用兵は凶、財貨を収束させるのに良い");
  check(`${L} KAKU-W-001 に剋應本文なし`, !JSON.stringify(w1).includes("玉兔入天門") && !JSON.stringify(w1).includes("収斂"));
  const f1 = get("FYFY-001");
  check(`${L} FYFY-001 は図版資料のみ`, f1.kind === "fuYinFanYin" && f1.item.fortuneText[1] === "この時間帯は用兵や作戦に宜しくない。収斂として財物を集めるのに宜しい。"
    && !JSON.stringify(f1.item).includes("財貨を収束させるのに良い"));
  check(`${L} FYFY-001 は KAKU-W-001 の category を継承`, f1.kind === "fuYinFanYin" && f1.basis.linkedKaku?.id === "KAKU-W-001" && f1.basis.linkedKaku.category === "凶格");
  const w2 = get("KAKU-W-002");
  check(`${L} KAKU-W-002 は反吟格`, w2.kind === "wholeChartKaku" && w2.item.name === "反吟格" && w2.item.detail === "直符反吟");
  const p1 = get("KAKU-P-001");
  check(`${L} KAKU-P-001 は休詐`, p1.kind === "palaceKaku" && p1.item.name === "休詐" && p1.item.category === "吉格");
  const k3 = get("KOKUO-003");
  check(`${L} KOKUO-003 の距離`, k3.kind === "kokuo" && k3.item.body.includes("六里（2.4km）、十六里（6.4km）") && k3.item.mode === "動應");
}

// ---- 2) 全盤 -----------------------------------------------------------------
let fyfyCount = 0;
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  const r = calculate({
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: 0, timezone: "Asia/Tokyo",
  });
  for (let palace = 1; palace <= 9; palace += 1) {
    const view = buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, palace)));
    const before = JSON.stringify(view);
    const plan = buildQimenGenerationPlan(view);
    fyfyCount += view.fuYinFanYin.length;
    const L = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`;
    check(`${L} ビュー不変`, JSON.stringify(view) === before);
    verify(view, plan, L);
  }
}
check("全盤で FYFY を検証した", fyfyCount > 0);

// ---- 3) 人工ケース: 対応格局が0件・複数件 --------------------------------------
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const view = buildQimenGenerationView(serializeQimenAiInput(buildQimenPalaceMaterials(r, 6)));
  // 0件: 伏吟格を格局から除く
  const none: QimenGenerationView = { ...view, wholeChartKaku: view.wholeChartKaku.filter((k) => k.name !== "伏吟格") };
  const pn = buildQimenGenerationPlan(none);
  check("人工0件 未分類", pn.unclassified.length === 1 && pn.unclassified[0].item.id === "FYFY-001"
    && pn.unclassified[0].basis.linkedKaku === null && pn.unclassified[0].basis.candidateIds.length === 0);
  check("人工0件 section2/3 に入らない", ![...pn.section2.items, ...pn.section3.items].some((p) => p.item.id === "FYFY-001"));
  verify(none, pn, "人工0件");
  // 複数件: 同名の格局を宮単位にも置く
  const dup: QimenGenerationView = {
    ...view,
    palaceKaku: [...view.palaceKaku, { ...view.wholeChartKaku[0], id: "KAKU-P-099", scope: "palace", palaces: [6] }],
  };
  const pd = buildQimenGenerationPlan(dup);
  check("人工複数件 未分類", pd.unclassified.length === 1 && pd.unclassified[0].basis.linkedKaku === null
    && same(pd.unclassified[0].basis.candidateIds, ["KAKU-P-099", "KAKU-W-001"]));
  check("人工複数件 section2/3 に入らない", ![...pd.section2.items, ...pd.section3.items].some((p) => p.item.id === "FYFY-001"));
  verify(dup, pd, "人工複数件");
}

if (process.argv.includes("--print")) console.log(JSON.stringify(sample, null, 1));
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
