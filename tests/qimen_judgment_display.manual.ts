// tests/qimen_judgment_display.manual.ts
//
// 確定判断材料の表示用構造（src/lib/qimenAiMaterials/judgmentDisplay.ts、buildJudgmentDisplay）の確認。
// AI は使わない。
// 実行: npx tsx tests/qimen_judgment_display.manual.ts（--print で乾六宮の完成データを出力）
//
// 1) 乾六宮（2025-01-01 15:00 陽遁7局）: 吉=休詐・玉兔入天門／注意（この宮）=乙奇入墓・三奇受刑・日奇伏吟／
//    注意（盤全体）=伏吟格（関連資料: 伏吟）・反吟格／未分類の剋應=開門×地盤開門 静應・動應、開門×天盤乙 静應。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で:
//    成立済み材料がちょうど1回ずつ（重複・欠落なし）／グループが Plan の区分と一致／この宮と盤全体が混ざらない／
//    関連資料は linkedKaku の親の下だけ／unclassified の資料は推測でつながない／原文と出典が元と一致／
//    ID から完全版をたどれる／入力（Plan・確定資料・完全版）を変更しない。
// 3) 人工ケース: 対応格局の無い資料・対応格局が構造に無い資料は unlinked に残る。

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildConfirmedMaterials,
  buildJudgmentDisplay,
  findQimenAiItem,
  JUDGMENT_GROUP_TITLES,
} from "../src/lib/qimenAiMaterials";
import type {
  ConfirmedMaterials,
  JudgmentItem,
  QimenAiInput,
  QimenGenerationPlan,
  QimenJudgmentDisplay,
} from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function build(year: number, month: number, day: number, hour: number, palace: number) {
  const r = calculate({ year, month, day, hour, minute: 0, timezone: "Asia/Tokyo" });
  const full = serializeQimenAiInput(buildQimenPalaceMaterials(r, palace));
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(full));
  const confirmed = buildConfirmedMaterials(plan);
  return { full, plan, confirmed };
}

function allItems(d: QimenJudgmentDisplay): JudgmentItem[] {
  const top = Object.values(d.groups).flatMap((g) => g.items);
  return [...top, ...top.flatMap((i) => i.related), ...d.unlinked.map((u) => u.item)];
}

function verify(full: QimenAiInput, plan: QimenGenerationPlan, confirmed: ConfirmedMaterials, L: string) {
  const before = JSON.stringify({ full, plan, confirmed });
  const d = buildJudgmentDisplay({ plan, confirmed, full });
  check(`${L} 入力不変`, JSON.stringify({ full, plan, confirmed }) === before);
  check(`${L} グループ構成`, same(Object.keys(d.groups), ["favorable", "cautionPalace", "cautionWholeChart", "unclassifiedKokuo"])
    && Object.entries(d.groups).every(([k, g]) => g.title === JUDGMENT_GROUP_TITLES[k as keyof typeof JUDGMENT_GROUP_TITLES]));

  // 成立済み材料がちょうど1回ずつ
  const expected = [
    ...confirmed.section2.items, ...confirmed.section3.items, ...confirmed.section4.items, ...confirmed.unclassified.items,
  ].map((c) => c.id).sort();
  const got = allItems(d).map((i) => i.id);
  check(`${L} 重複・欠落なし`, same([...got].sort(), expected) && new Set(got).size === got.length);

  // グループと区分・scope
  const sectionOf = (id: string) =>
    confirmed.section2.items.some((c) => c.id === id) ? "section2"
      : confirmed.section3.items.some((c) => c.id === id) ? "section3"
        : confirmed.section4.items.some((c) => c.id === id) ? "section4" : "unclassified";
  for (const i of d.groups.favorable.items) check(`${L} ${i.id} 吉は section2`, sectionOf(i.id) === "section2" && i.fortuneClass === "favorable" && i.kind !== "fuYinFanYin");
  for (const i of d.groups.cautionPalace.items) {
    check(`${L} ${i.id} 注意（この宮）`, sectionOf(i.id) === "section3" && i.fortuneClass === "caution"
      && (i.kind === "kokuo" ? i.scope === null : i.kind === "palaceKaku" && i.scope === "この宮"));
  }
  for (const i of d.groups.cautionWholeChart.items) {
    check(`${L} ${i.id} 注意（盤全体）`, sectionOf(i.id) === "section3" && i.fortuneClass === "caution" && i.kind === "wholeChartKaku" && i.scope === "盤全体");
  }
  for (const i of d.groups.unclassifiedKokuo.items) check(`${L} ${i.id} 未分類の剋應`, sectionOf(i.id) === "section4" && i.fortuneClass === "unclassified" && i.kind === "kokuo");
  for (const i of [...d.groups.cautionPalace.items, ...d.groups.favorable.items]) {
    check(`${L} ${i.id} この宮に盤全体が混ざらない`, !(d.groups.cautionPalace.items.includes(i) && i.scope === "盤全体"));
  }

  // 関連資料
  const top = Object.values(d.groups).flatMap((g) => g.items);
  for (const p of top) {
    for (const ch of p.related) {
      check(`${L} ${ch.id} 親は linkedKaku`, ch.kind === "fuYinFanYin" && ch.linkedKaku?.id === p.id && ch.related.length === 0);
      check(`${L} ${ch.id} 関係の一覧`, d.relations.some((r) => r.parentId === p.id && r.childId === ch.id));
    }
  }
  check(`${L} 関係の件数`, d.relations.length === top.reduce((a, p) => a + p.related.length, 0));
  check(`${L} 伏吟反吟の資料は最上位に置かない`, top.every((p) => p.kind !== "fuYinFanYin"));
  for (const u of d.unlinked) check(`${L} ${u.item.id} unlinked は資料だけ`, u.item.kind === "fuYinFanYin" && u.reason.length > 0);
  for (const c of confirmed.unclassified.items) check(`${L} ${c.id} unclassified はつながない`, d.unlinked.some((u) => u.item.id === c.id));

  // 原文・確定情報・出典・追跡
  const confAll = [...confirmed.section2.items, ...confirmed.section3.items, ...confirmed.section4.items, ...confirmed.unclassified.items];
  for (const i of allItems(d)) {
    const c = confAll.find((x) => x.id === i.id)!;
    check(`${L} ${i.id} 原文は確定資料そのもの`, same(i.sourceText, c.sourceText) && i.sourceText.every((s) => typeof s.raw === "string"));
    check(`${L} ${i.id} 確定情報`, i.type === c.header.type && i.name === c.header.name && i.scope === (c.header.scope ?? null)
      && i.detail === (c.header.detail ?? null) && i.mode === (c.header.mode ?? null) && i.combination === (c.header.combination ?? null)
      && same(i.linkedKaku, c.header.linkedKaku ?? null) && same(i.kakuMeaning, c.kakuMeaning ?? null)
      && i.fortune === (c.kind === "kokuo" ? c.header.fortune ?? null : c.header.category ?? null));
    const hit = findQimenAiItem(full, i.id) as { source?: unknown; sources?: unknown[] } | undefined;
    check(`${L} ${i.id} ID から完全版をたどれる`, !!hit);
    check(`${L} ${i.id} 出典`, same(i.sources, Array.isArray(hit?.sources) ? hit?.sources : hit?.source ? [hit.source] : []) && i.sources.length > 0);
    check(`${L} ${i.id} 見出しは既存の値`, i.label === (i.name ?? [i.combination, i.mode].filter(Boolean).join("　")));
  }
  return d;
}

// ---- 1) 乾六宮 ---------------------------------------------------------------
const s = build(2025, 1, 1, 15, 6);
const sample = verify(s.full, s.plan, s.confirmed, "乾六宮");
{
  const L = "乾六宮";
  const labels = (k: keyof QimenJudgmentDisplay["groups"]) => sample.groups[k].items.map((i) => `${i.id}:${i.label}`);
  check(`${L} 吉`, same(labels("favorable"), ["KAKU-P-001:休詐", "KOKUO-005:玉兔入天門"]));
  check(`${L} 注意（この宮）`, same(labels("cautionPalace"), ["KAKU-P-002:乙奇入墓", "KAKU-P-003:三奇受刑", "KOKUO-001:日奇伏吟"]));
  check(`${L} 注意（盤全体）`, same(labels("cautionWholeChart"), ["KAKU-W-001:伏吟格", "KAKU-W-002:反吟格"]));
  check(`${L} 未分類の剋應`, same(labels("unclassifiedKokuo"),
    ["KOKUO-002:開門 × 地盤開門　静應", "KOKUO-003:開門 × 地盤開門　動應", "KOKUO-004:開門 × 天盤乙　静應"]));
  const fuYin = sample.groups.cautionWholeChart.items[0];
  check(`${L} 伏吟格の関連資料`, fuYin.related.length === 1 && fuYin.related[0].id === "FYFY-001" && fuYin.related[0].label === "伏吟"
    && same(fuYin.related[0].sourceText.map((x) => x.label), ["九星伏吟", "八門伏吟", "吉凶"]));
  check(`${L} 伏吟格の本文に関連資料が混ざらない`, !JSON.stringify(fuYin.sourceText).includes("損失人口"));
  check(`${L} 反吟格に関連資料なし`, sample.groups.cautionWholeChart.items[1].related.length === 0);
  check(`${L} 関係の一覧`, same(sample.relations, [{ parentId: "KAKU-W-001", childId: "FYFY-001", basis: "linkedKaku" }]));
  check(`${L} 未リンクなし`, sample.unlinked.length === 0);
  check(`${L} 日奇伏吟は剋應の根拠で「この宮」`, sample.groups.cautionPalace.items[2].placementBasis === "section3・kokuo（宮ごとの剋應検索の結果）");
}

// ---- 2) 全盤 -----------------------------------------------------------------
let relationsSeen = 0;
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  for (let palace = 1; palace <= 9; palace += 1) {
    const b = build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), palace);
    const disp = verify(b.full, b.plan, b.confirmed, `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`);
    relationsSeen += disp.relations.length;
  }
}
check("全盤で関連資料の親子を検証した", relationsSeen > 0);

// ---- 3) 人工ケース ------------------------------------------------------------
{
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  // 対応格局が構造に無い（伏吟格を確定資料と Plan から取り除く）
  const plan = clone(s.plan);
  const confirmed = clone(s.confirmed);
  plan.section3.items = plan.section3.items.filter((p) => p.item.id !== "KAKU-W-001");
  confirmed.section3.items = confirmed.section3.items.filter((c) => c.id !== "KAKU-W-001");
  const d = buildJudgmentDisplay({ plan, confirmed, full: s.full });
  check("人工: 親の無い資料は unlinked", d.unlinked.length === 1 && d.unlinked[0].item.id === "FYFY-001" && d.unlinked[0].reason.includes("KAKU-W-001"));
  check("人工: 親の無い資料をどこにも付けない", Object.values(d.groups).every((g) => g.items.every((p) => p.related.length === 0)));

  // Plan の unclassified にある資料（対応格局未確定）
  const plan2 = clone(s.plan);
  const confirmed2 = clone(s.confirmed);
  const fy = plan2.section3.items.find((p) => p.item.id === "FYFY-001")!;
  plan2.section3.items = plan2.section3.items.filter((p) => p.item.id !== "FYFY-001");
  if (fy.kind === "fuYinFanYin") plan2.unclassified.push({ ...fy, basis: { ...fy.basis, linkedKaku: null, reason: "人工: 対応格局が一意でない" } });
  const cfy = confirmed2.section3.items.find((c) => c.id === "FYFY-001")!;
  confirmed2.section3.items = confirmed2.section3.items.filter((c) => c.id !== "FYFY-001");
  confirmed2.unclassified.items.push({ ...cfy, header: { ...cfy.header, linkedKaku: undefined, unclassifiedReason: "人工: 対応格局が一意でない" } });
  const d2 = buildJudgmentDisplay({ plan: plan2, confirmed: confirmed2, full: s.full });
  check("人工: unclassified は推測でつながない", d2.unlinked.length === 1 && d2.unlinked[0].reason === "人工: 対応格局が一意でない"
    && d2.groups.cautionWholeChart.items[0].related.length === 0);

  // Plan と確定資料が食い違えば例外
  const confirmed3 = clone(s.confirmed);
  confirmed3.section2.items.reverse();
  let threw = false;
  try { buildJudgmentDisplay({ plan: s.plan, confirmed: confirmed3, full: s.full }); } catch { threw = true; }
  check("人工: Plan と確定資料の食い違いは例外", threw);
}

if (process.argv.includes("--print")) console.log(JSON.stringify(sample, null, 1));
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
