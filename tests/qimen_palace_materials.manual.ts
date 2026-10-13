// tests/qimen_palace_materials.manual.ts
//
// 一宮分の判断材料集約（src/lib/qimenMaterials/、buildQimenPalaceMaterials）の確認。
// 実行: npx tsx tests/qimen_palace_materials.manual.ts
//
// 2025-01-01〜2025-01-30 の2時間刻み全盤（360盤）× 全9宮で、次を確認する:
//   ・剋應は既存 resolveKokuoForPalace() の結果と id・件数・notFound が完全一致（新しい剋應を作らない）
//   ・剋應のキーがその宮の天盤干・地盤干・八門・八卦名・値符星・時支と一致（別の宮の剋應を取らない）
//   ・剋應の追加項目(raw)は元データ(JSON)の同じ id のレコードの値と完全一致
//   ・単体象意の要素名はその宮の排盤結果と一致し、データは既存 lookup の戻り値そのもの
//   ・格局は既存判定の結果だけ。palace は当該宮を含み、whole_chart は palaces が空。取りこぼし無し
//   ・伏吟・反吟: 九星／八門の下位分類だけ紐付き、直符は紐付かない。吉凶文は図版データそのもの
//   ・出力中の資料由来の文字列はすべて既存データ（JSON の文字列値・象意 TS ファイル本文）に実在する
//   ・中宮は剋應が空（既存仕様どおり）

import { readFileSync } from "node:fs";
import { calculate, resolveKokuoForPalace, PALACE_TRIGRAM } from "../src/lib/qimen";
import type { QimenResult } from "../src/lib/qimen";
import {
  lookupBaMenMeaning,
  lookupJiuXingMeaning,
  lookupBaShenMeaning,
  lookupSanQiLiuYiMeaning,
  FUYIN_FANYIN_MEANING,
} from "../src/lib/qimenMeaning";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import type { QimenPalaceMaterials } from "../src/lib/qimenMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
  else failures.length === 50 && failures.push("…(以降省略)");
}

// ---- 元データ ------------------------------------------------------------
const KOKUO_FILES = ["jikkan", "hachimon", "kyusei_jichi", "sanki_tokyu"].map((n) =>
  JSON.parse(readFileSync(`src/lib/qimen/kokuo/data/${n}.json`, "utf8")),
);
const RAW_BY_ID = new Map<string, Record<string, unknown>>();
for (const f of KOKUO_FILES) for (const e of f.entries) RAW_BY_ID.set(e.id, e);
const HACHIMON = KOKUO_FILES[1];
const KYUSEI = KOKUO_FILES[2];

/** 資料由来の文字列の照合先: JSON の全文字列値 ＋ 象意 TS ファイル本文。 */
const JSON_STRINGS = new Set<string>();
function collectStrings(v: unknown) {
  if (typeof v === "string") JSON_STRINGS.add(v);
  else if (Array.isArray(v)) v.forEach(collectStrings);
  else if (v && typeof v === "object") Object.values(v).forEach(collectStrings);
}
KOKUO_FILES.forEach(collectStrings);
const TS_TEXT = [
  "baMenMeaning.ts", "jiuXingMeaning.ts", "baShenMeaning.ts", "sanQiLiuYiMeaning.ts",
  "data.ts", "fuYinFanYinMeaning.ts",
].map((f) => readFileSync(`src/lib/qimenMeaning/${f}`, "utf8")).join("\n")
  + readFileSync("src/lib/qimen/jikaku.ts", "utf8")
  + readFileSync("src/lib/qimen/kyokaku.ts", "utf8");
function existsInSources(s: string): boolean {
  return JSON_STRINGS.has(s) || TS_TEXT.includes(s) || TS_TEXT.includes(JSON.stringify(s).slice(1, -1));
}
/** 資料由来の値だけを集める（構造ラベル・出典メタ・注意書き・理由は除く）。 */
function materialStrings(m: QimenPalaceMaterials): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  for (const e of m.elements) for (const it of e.items) walk(it.data);
  for (const list of [m.kokuo.jikkan, m.kokuo.hachimonGate, m.kokuo.hachimonWonder, m.kokuo.sankiTokyu, m.kokuo.kyuseiJichi]) {
    for (const k of list) {
      walk(k.entry.body); walk(k.entry.name); walk(k.raw);
      // 既存 kokuo は八門・九星値時の fortuneRaw を fortune_mentions の「・」連結で返す（既存仕様）。
      const joined = k.entry.category.startsWith("hachimon") || k.entry.category === "kyusei_jichi";
      walk(joined && k.entry.fortuneRaw ? k.entry.fortuneRaw.split("・") : k.entry.fortuneRaw);
    }
  }
  for (const g of m.kokuo.gateNotes) walk([g.static_intro_raw, g.dynamic_intro_raw, g.dynamic_tail_note_raw]);
  for (const c of m.kokuo.kyuseiContext) walk([c.heading, c.body]);
  for (const k of m.kaku) { walk(k.judgeMeaning); walk(k.meaningDb); }
  for (const f of m.fuYinFanYin) { walk(f.linkedSubtypes); walk(f.fortuneText); }
  return out.filter((s) => s !== "");
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const norm = (s?: string) => (s === "甲" ? "戊" : s);

// ---- 1宮分の検証 --------------------------------------------------------------
function verify(r: QimenResult, label: string, palace: number) {
  const m = buildQimenPalaceMaterials(r, palace);
  const p = r.palaces[palace];
  const L = `${label} 宮${palace}`;

  // 基本情報
  check(`${L} facts`, same(m.facts, p));
  check(`${L} trigram`, m.palace.trigram === (PALACE_TRIGRAM[palace] ?? null));
  check(`${L} 旬首`, same(m.chart.xunShou, r.xunShou));

  // 剋應: 既存検索と完全一致
  const k = resolveKokuoForPalace(r, palace);
  const pairs = [
    [m.kokuo.jikkan, k.jikkan], [m.kokuo.hachimonGate, k.hachimonGate],
    [m.kokuo.hachimonWonder, k.hachimonWonder], [m.kokuo.sankiTokyu, k.sankiTokyu],
    [m.kokuo.kyuseiJichi, k.kyuseiJichi],
  ] as const;
  for (const [got, exp] of pairs) {
    check(`${L} 剋應一致`, same(got.map((x) => x.entry), exp));
  }
  check(`${L} notFound`, same(m.kokuo.notFound, k.notFound));

  // 剋應キーがこの宮の条件と一致
  for (const x of m.kokuo.jikkan) {
    check(`${L} 十干キー`, x.entry.key.heaven_stem === norm(p.tianPanStem) && x.entry.key.earth_stem === norm(p.diPanStem));
  }
  for (const x of [...m.kokuo.hachimonGate, ...m.kokuo.hachimonWonder]) {
    check(`${L} 八門キー`, x.entry.key.human_gate === p.baMen[0]);
  }
  for (const x of m.kokuo.hachimonGate) check(`${L} 地盤八門`, x.entry.key.counterpart === m.palace.natalGate);
  for (const x of m.kokuo.hachimonWonder) check(`${L} 門×三奇キー`, x.entry.key.counterpart === p.tianPanStem);
  for (const x of m.kokuo.sankiTokyu) {
    check(`${L} 三奇到宮キー`, x.entry.key.wonder_stem === p.diPanStem && x.entry.key.palace === PALACE_TRIGRAM[palace]);
  }
  for (const x of m.kokuo.kyuseiJichi) {
    check(`${L} 九星値時キー`, p.jiuXing.includes(x.entry.key.value_star as never) && x.entry.key.hour_branch === r.calendar.hourBranch);
  }

  // raw は元データの値そのもの
  for (const list of [m.kokuo.jikkan, m.kokuo.hachimonGate, m.kokuo.hachimonWonder, m.kokuo.sankiTokyu, m.kokuo.kyuseiJichi]) {
    for (const x of list) {
      const rec = RAW_BY_ID.get(x.entry.id);
      check(`${L} raw存在 ${x.entry.id}`, !!rec && Object.keys(x.raw).length > 0);
      for (const [f, v] of Object.entries(x.raw)) check(`${L} raw一致 ${x.entry.id}.${f}`, !!rec && same(rec[f], v));
    }
  }

  // gate_notes / 星別総論
  for (const g of m.kokuo.gateNotes) {
    const rawNote = HACHIMON.gate_notes.find((n: { gate: string }) => n.gate === g.gate);
    check(`${L} gate_notes 門`, g.gate === p.baMen[0]);
    check(`${L} gate_notes 値`, !!rawNote && g.static_intro_raw === rawNote.static_intro_raw
      && g.dynamic_intro_raw === rawNote.dynamic_intro_raw && g.dynamic_tail_note_raw === rawNote.dynamic_tail_note_raw);
  }
  check(`${L} 星別総論は値符宮のみ`, m.kokuo.kyuseiContext.length === 0 || m.kokuo.kyuseiJichi.length > 0);
  if (m.kokuo.kyuseiJichi.length > 0) check(`${L} 星別総論 1件`, m.kokuo.kyuseiContext.length === 1);
  for (const c of m.kokuo.kyuseiContext) {
    const blocks = KYUSEI.context_blocks[c.sourceTradition] as { heading: string; body: string }[];
    check(`${L} 星別総論 値`, blocks.some((b) => b.heading === c.heading && b.body === c.body));
  }

  // 単体象意: この宮の要素だけ・lookup の戻り値そのもの
  const expectNames = [
    ...p.baMen.map((n) => `八門:${n}`), ...p.jiuXing.map((n) => `九星:${n}`), ...p.baShen.map((n) => `八神:${n}`),
    ...(p.tianPanStem ? [`天盤干:${p.tianPanStem}`] : []), ...(p.diPanStem ? [`地盤干:${p.diPanStem}`] : []),
  ];
  check(`${L} 要素名`, same(m.elements.map((e) => `${e.role}:${e.name}`), expectNames));
  for (const e of m.elements) {
    const basic = e.items.find((i) => i.kind === "基本象意" || i.kind === "三奇六儀象意")?.data;
    const expected =
      e.role === "八門" ? lookupBaMenMeaning(e.name)
      : e.role === "九星" ? lookupJiuXingMeaning(e.name)
      : e.role === "八神" ? lookupBaShenMeaning(e.name)
      : lookupSanQiLiuYiMeaning(e.name);
    check(`${L} 象意 ${e.role}${e.name}`, basic === expected);
    const pf = e.items.find((i) => i.kind === "宮位吉凶")?.data as { palace: number } | undefined;
    if (pf) check(`${L} 宮位吉凶の宮`, pf.palace === palace);
  }

  // 格局
  const expJi = r.jikaku.matches.filter((x) => x.palaces.includes(palace) || x.palaces.length === 0);
  const expKyo = r.kyokaku.matches.filter((x) => x.palaces.includes(palace) || x.palaces.length === 0);
  check(`${L} 吉格件数`, m.kaku.filter((x) => x.category === "吉格").length === expJi.length);
  check(`${L} 凶格件数`, m.kaku.filter((x) => x.category === "凶格").length === expKyo.length);
  for (const x of m.kaku) {
    const src = (x.category === "吉格" ? r.jikaku.matches : r.kyokaku.matches).find((y) => y.name === x.name);
    check(`${L} 格局は既存判定 ${x.name}`, !!src && same(src.palaces, x.palaces) && src.meaning === x.judgeMeaning);
    if (x.scope === "palace") check(`${L} palace scope ${x.name}`, x.palaces.includes(palace));
    if (x.scope === "whole_chart") check(`${L} whole_chart ${x.name}`, x.category === "凶格" && x.palaces.length === 0);
    if (x.scope === "scope判定不能") check(`${L} 判定不能 ${x.name}`, x.category === "吉格" && x.palaces.length === 0);
  }

  // 伏吟・反吟
  const judged = r.kyokaku.matches.filter((x) => (x.name === "伏吟格" || x.name === "反吟格") && x.detail);
  check(`${L} 伏吟反吟件数`, m.fuYinFanYin.length === judged.length);
  for (const f of m.fuYinFanYin) {
    const png = FUYIN_FANYIN_MEANING.find((e) => e.kind === f.kind)!;
    const detail = f.judgeDetail.split("・");
    check(`${L} 伏吟反吟 detail網羅`, same([...f.linkedSubtypes.map((s) => s.name), ...f.unlinkedSubtypes.map((s) => s.name)].sort(), [...detail].sort()));
    for (const s of f.linkedSubtypes) {
      check(`${L} 紐付けは九星/八門のみ ${s.name}`, /^(九星|八門)(伏吟|反吟)$/.test(s.name));
      check(`${L} 紐付け説明は図版そのもの`, same(png.subtypes.find((t) => t.name === s.name)?.description, s.description));
    }
    for (const s of f.unlinkedSubtypes) check(`${L} 直符は非紐付け ${s.name}`, s.name.startsWith("直符"));
    if (f.linkedSubtypes.length > 0) check(`${L} 吉凶文は図版そのもの`, f.fortuneText === png.fortuneText);
    else check(`${L} 紐付け無しなら吉凶文なし`, f.fortuneText === null && f.fortuneHeading === null);
  }

  // 中宮
  if (palace === 5) {
    const all = [m.kokuo.jikkan, m.kokuo.hachimonGate, m.kokuo.hachimonWonder, m.kokuo.sankiTokyu, m.kokuo.kyuseiJichi];
    check(`${L} 中宮の剋應は空`, all.every((x) => x.length === 0) && m.kokuo.gateNotes.length === 0);
  }

  // 資料由来の文字列はすべて既存データに実在する
  for (const s of materialStrings(m)) check(`${L} 実在しない文字列: ${s.slice(0, 30)}`, existsInSources(s));
}

// ---- 実行 ------------------------------------------------------------------
let boards = 0;
const kinds = new Set<string>();
const start = Date.UTC(2025, 0, 1, 0);
for (let i = 0; i < 360; i += 1) {
  const d = new Date(start + i * 2 * 3600_000);
  const input = {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: 0, timezone: "Asia/Tokyo",
  };
  const r = calculate(input);
  boards += 1;
  for (const x of r.kyokaku.matches) if (x.name === "伏吟格" || x.name === "反吟格") kinds.add(`${x.name}:${x.detail}`);
  for (let palace = 1; palace <= 9; palace += 1) {
    verify(r, `${input.year}-${input.month}-${input.day} ${input.hour}時`, palace);
  }
}

// 伏吟・反吟の紐付けが実際に両方向（紐付く／紐付かない）で検証されたこと
check("伏吟: 九星/八門のみの盤を含む", [...kinds].some((k) => k.startsWith("伏吟格:") && !k.includes("直符")));
check("伏吟: 直符のみの盤を含む", kinds.has("伏吟格:直符伏吟"));
check("反吟: 九星/八門のみの盤を含む", [...kinds].some((k) => k.startsWith("反吟格:") && !k.includes("直符")));
check("反吟: 直符のみの盤を含む", kinds.has("反吟格:直符反吟"));

// 宮番号の範囲外は例外
let threw = false;
try { buildQimenPalaceMaterials(calculate({ year: 2025, month: 4, day: 15, hour: 12, minute: 0 }), 10); } catch { threw = true; }
check("宮番号10は例外", threw);

console.log(`盤: ${boards} × 9宮`);
console.log(`伏吟・反吟の出現パターン: ${[...kinds].sort().join(" / ")}`);
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
