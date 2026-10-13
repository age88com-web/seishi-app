// tests/qimen_generation_view.manual.ts
//
// 文章生成用ビュー（src/lib/qimenAiMaterials/generationView.ts、buildQimenGenerationView）の確認。
// 実行: npx tsx tests/qimen_generation_view.manual.ts
//
// 1) 指定ケース 2025-01-01 15:00（陽遁7局）乾六宮:
//    必要な chartFacts・開門/天心/六合/乙奇の単体象意・剋應5件・宮単位格局3件・盤全体格局（反吟格を含む）・
//    linked 伏吟資料があり、unlinked 直符反吟の追加資料・excluded・referenceTables・rubyLinesRemoved が無く、
//    出典情報が混入せず、既存 ID が保たれること。条件文（六里（2.4km）、十六里（6.4km）・六十日以内・
//    「商」音（姓）の人・安分守己・日奇伏吟・玉兔入天門）が失われないこと。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で:
//    ・含める6区分の ID と並びが完全版と同一（振り直しなし）・値は完全版そのもの
//    ・除外する項目・出典キーが1つも無く、出典らしい文字列（.pdf・.png・src/・docs/）も無い
//    ・完全版を変更しない・全 ID が完全版で引けて出典を辿れる

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  findQimenAiItem,
} from "../src/lib/qimenAiMaterials";
import type { QimenAiInput, QimenGenerationView } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const INCLUDED = ["chartFacts", "singleMeanings", "kokuo", "palaceKaku", "wholeChartKaku", "fuYinFanYin"] as const;
const FORBIDDEN_KEYS = new Set([
  "excluded", "referenceTables", "unknownScopeKaku", "rubyLinesRemoved", "notes", "details",
  "source", "sources", "materialPath", "origin", "sourceTradition", "sourcePage",
  "document", "file", "location", "printedPages", "dataset",
]);
const SOURCE_LIKE = /\.pdf|\.png|\.json|\.ts\b|src\/|docs\//;

/** ビュー全体のキー・文字列を走査する。 */
function scan(v: unknown, keys: string[], strings: string[]) {
  if (typeof v === "string") strings.push(v);
  else if (Array.isArray(v)) v.forEach((x) => scan(x, keys, strings));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { keys.push(k); scan(x, keys, strings); }
  }
}

function withoutSourcePage(c: unknown): unknown {
  if (c === null || typeof c !== "object" || Array.isArray(c)) return c;
  const r: Record<string, unknown> = { ...(c as Record<string, unknown>) };
  delete r.sourcePage;
  return r;
}

function verify(full: QimenAiInput, view: QimenGenerationView, L: string) {
  // ID と並びが完全版と同じ
  for (const key of INCLUDED) {
    check(`${L} ${key} ID同一`, same(view[key].map((x) => x.id), full[key].map((x) => x.id)));
  }
  // 値は完全版そのもの
  view.chartFacts.forEach((f, i) => check(`${L} ${f.id}`, f.label === full.chartFacts[i].label && f.value === full.chartFacts[i].value));
  view.singleMeanings.forEach((s, i) => {
    const o = full.singleMeanings[i];
    check(`${L} ${s.id}`, s.role === o.role && s.element === o.element && s.kind === o.kind && same(s.content, withoutSourcePage(o.content)));
  });
  view.kokuo.forEach((k, i) => {
    const o = full.kokuo[i];
    check(`${L} ${k.id}`, k.body === o.body && k.name === o.name && k.mode === o.mode && k.fortuneRaw === o.fortuneRaw
      && k.kokuoType === o.kokuoType && same(k.key, o.key));
  });
  for (const key of ["palaceKaku", "wholeChartKaku"] as const) {
    view[key].forEach((k, i) => {
      const o = full[key][i];
      check(`${L} ${k.id}`, k.name === o.name && k.category === o.category && k.scope === o.scope && k.judgeMeaning === o.judgeMeaning
        && same(k.meaningDb, o.meaningDb) && same(k.palaces, o.palaces) && k.detail === o.detail);
    });
  }
  view.fuYinFanYin.forEach((f, i) => {
    const o = full.fuYinFanYin[i];
    check(`${L} ${f.id}`, same(f.linkedSubtypes, o.linkedSubtypes) && same(f.fortuneText, o.fortuneText)
      && f.judgeDetail === o.judgeDetail && f.linkedSubtypes.length > 0);
  });

  // 除外する項目・出典キー・出典らしい文字列が無い
  const keys: string[] = [];
  const strings: string[] = [];
  scan(view, keys, strings);
  const badKeys = keys.filter((k) => FORBIDDEN_KEYS.has(k));
  check(`${L} 除外キーなし ${[...new Set(badKeys)].join(",")}`, badKeys.length === 0);
  const badStrings = strings.filter((s) => SOURCE_LIKE.test(s));
  check(`${L} 出典文字列なし ${badStrings.slice(0, 2).join("|")}`, badStrings.length === 0);
  check(`${L} トップレベルは6区分のみ`, same(Object.keys(view), ["schemaVersion", "palaceNumber", ...INCLUDED]));

  // unlinked の伏吟反吟の名称がビューの伏吟反吟資料に無い
  const unlinked = full.excluded.filter((x) => x.kind === "紐付けなかった伏吟反吟").map((x) => x.item);
  for (const u of unlinked) {
    const name = u.replace(/^.+（(.+)）$/, "$1");
    check(`${L} unlinked ${name} は渡さない`, view.fuYinFanYin.every((f) => f.linkedSubtypes.every((s) => s.name !== name)));
  }

  // 全 ID が完全版で引け、chartFacts 以外は出典を辿れる
  for (const key of INCLUDED) {
    for (const x of view[key]) {
      const hit = findQimenAiItem(full, x.id);
      check(`${L} ${x.id} 追跡`, !!hit && (key === "chartFacts" ? hit.source === null : hit.source !== null) && typeof hit.materialPath === "string");
    }
  }
}

// ---- 1) 指定ケース -----------------------------------------------------------
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const full = serializeQimenAiInput(buildQimenPalaceMaterials(r, 6));
  const before = JSON.stringify(full);
  const view = buildQimenGenerationView(full);
  const L = "指定ケース";
  check(`${L} 完全版を変更しない`, JSON.stringify(full) === before);
  check(`${L} 完全版に除外対象が残る`, full.excluded.length === 7 && full.referenceTables.length === 3
    && full.kokuo.some((k) => k.rubyLinesRemoved.length > 0));
  verify(full, view, L);

  const fact = (label: string) => view.chartFacts.filter((f) => f.label === label).map((f) => f.value);
  check(`${L} chartFacts`, same(fact("宮番号"), [6]) && same(fact("八卦"), ["乾"]) && same(fact("遁"), ["陽遁"])
    && same(fact("局"), [7]) && same(fact("天盤干"), ["乙"]) && same(fact("地盤干"), ["乙"]) && same(fact("九星"), ["天心"])
    && same(fact("八門"), ["開門"]) && same(fact("八神"), ["六合"]) && same(fact("地盤八門（NATAL_GATE）"), ["開門"])
    && same(fact("時干"), ["甲"]) && same(fact("時支"), ["申"]) && same(fact("旬首"), ["甲申"]));
  check(`${L} 単体象意`, same(view.singleMeanings.map((s) => `${s.id}:${s.role}:${s.element}:${s.kind}`), [
    "SINGLE-001:八門:開門:基本象意", "SINGLE-002:九星:天心:基本象意", "SINGLE-003:八神:六合:基本象意",
    "SINGLE-004:八神:六合:宮位吉凶", "SINGLE-005:天盤干:乙:三奇六儀象意", "SINGLE-006:地盤干:乙:三奇六儀象意",
  ]));
  check(`${L} 単体象意は吉凶ラベルを保持`, (view.singleMeanings[0].content as { fortuneLabel: string }).fortuneLabel === "上吉");
  check(`${L} 剋應5件`, same(view.kokuo.map((k) => k.id), ["KOKUO-001", "KOKUO-002", "KOKUO-003", "KOKUO-004", "KOKUO-005"]));
  check(`${L} 宮単位格局3件`, same(view.palaceKaku.map((k) => `${k.id}:${k.name}`), ["KAKU-P-001:休詐", "KAKU-P-002:乙奇入墓", "KAKU-P-003:三奇受刑"]));
  check(`${L} 盤全体格局（反吟格を保持）`, same(view.wholeChartKaku.map((k) => `${k.id}:${k.name}:${k.detail}`), [
    "KAKU-W-001:伏吟格:九星伏吟・八門伏吟", "KAKU-W-002:反吟格:直符反吟",
  ]));
  check(`${L} linked 伏吟資料`, view.fuYinFanYin.length === 1 && view.fuYinFanYin[0].id === "FYFY-001"
    && view.fuYinFanYin[0].kind === "伏吟" && same(view.fuYinFanYin[0].linkedSubtypes.map((s) => s.name), ["九星伏吟", "八門伏吟"]));
  const text = JSON.stringify(view);
  check(`${L} 直符反吟の追加資料なし`, !text.includes("反吟となれば") && !text.includes("紐付けない")
    && view.fuYinFanYin.every((f) => f.kind !== "反吟"));
  check(`${L} gate_notes なし`, !text.includes("占身命"));
  for (const s of ["六里（2.4km）、十六里（6.4km）", "六十日以内", "「商」音（姓）の人", "安分守己", "日奇伏吟", "玉兔入天門"]) {
    check(`${L} 保持: ${s}`, view.kokuo.some((k) => k.body.includes(s)));
  }
  check(`${L} ルビなし`, !text.includes("にっきふくぎん") && !text.includes("あんぶんしゅき") && !text.includes("ぎょくとにゅうてんもん"));
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
    const full = serializeQimenAiInput(buildQimenPalaceMaterials(r, palace));
    const before = JSON.stringify(full);
    const view = buildQimenGenerationView(full);
    const L = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`;
    check(`${L} 完全版を変更しない`, JSON.stringify(full) === before);
    verify(full, view, L);
  }
}

if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
