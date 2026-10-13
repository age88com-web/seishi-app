// tests/qimen_ai_materials.manual.ts
//
// AI 入力専用データ層（src/lib/qimenAiMaterials/、serializeQimenAiInput）の確認。
// 実行: npx tsx tests/qimen_ai_materials.manual.ts
//
// 1) 指定ケース 2025-01-01 15:00（陽遁7局）乾六宮:
//    日奇伏吟・開門×開門 静應/動應・開門×乙・玉兔入天門・休詐・乙奇入墓・三奇受刑・伏吟格・反吟格・
//    linked の伏吟資料・unlinked の反吟資料が欠落・混入せず整理されること、
//    「六十日以内」「「商」音（姓）の人」「六里（2.4km）、十六里（6.4km）」が失われないこと。
// 2) 2025-01-01〜01-30 の2時間刻み全盤（360盤）× 全9宮で:
//    ・ID が出力内で一意・分類ごとの接頭辞と連番どおり
//    ・materialPath で qimenMaterials の出力を引き直すと値が完全一致（要約・言い換え・変更なし）
//    ・qimenMaterials の材料が欠落・重複なく、決められた分類にだけ入る
//    ・gate_notes・unlinked の伏吟反吟・旺衰表は主要材料に入らない

import { calculate } from "../src/lib/qimen";
import { buildQimenPalaceMaterials } from "../src/lib/qimenMaterials";
import type { QimenPalaceMaterials } from "../src/lib/qimenMaterials";
import { serializeQimenAiInput, AI_ID_PREFIX } from "../src/lib/qimenAiMaterials";
import type { QimenAiInput } from "../src/lib/qimenAiMaterials";
import { stripRubyLines } from "../src/lib/qimenAiMaterials/ruby";
import { readFileSync } from "node:fs";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const KANJI = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const HIRAGANA_ONLY = /^[\s\u3041-\u309F]+$/;
/** ルビ除去の不変条件: 除いた行はひらがな＋空白のみ・元の行から除いた行を順に抜くと本文と一致・漢字は減らない。 */
function rubyInvariant(original: string, body: string, removed: string[]): boolean {
  if (!removed.every((l) => HIRAGANA_ONLY.test(l) && /[\u3041-\u309F]/.test(l))) return false;
  const rest = [...removed];
  const kept = original.split("\n").filter((l) => {
    if (rest.length > 0 && l === rest[0]) { rest.shift(); return false; }
    return true;
  });
  if (rest.length !== 0 || kept.join("\n") !== body) return false;
  return same(original.match(KANJI) ?? [], body.match(KANJI) ?? []);
}

/** "a.b[0].c" 形式の materialPath を qimenMaterials の出力に適用する。 */
function resolvePath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.match(/[^.[\]]+/g) ?? []) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const MAIN_KEYS = [
  "chartFacts", "singleMeanings", "kokuo", "palaceKaku", "wholeChartKaku",
  "unknownScopeKaku", "fuYinFanYin",
] as const;

// ---- 全盤共通の検証 ----------------------------------------------------------
function verify(m: QimenPalaceMaterials, a: QimenAiInput, L: string) {
  // ID: 一意・接頭辞・連番
  const sections = { ...AI_ID_PREFIX } as Record<string, string>;
  const allIds: string[] = [];
  for (const [key, prefix] of Object.entries(sections)) {
    const list = (a as unknown as Record<string, { id: string }[]>)[key];
    list.forEach((x, i) => {
      allIds.push(x.id);
      check(`${L} ID形式 ${x.id}`, x.id === `${prefix}-${String(i + 1).padStart(3, "0")}`);
    });
  }
  check(`${L} ID一意`, new Set(allIds).size === allIds.length);

  // A. 盤の事実: materialPath の値と一致
  for (const f of a.chartFacts) check(`${L} ${f.id} 値`, resolvePath(m, f.materialPath) === f.value);

  // B. 単体象意／参照表: 各 item がちょうど1回、値そのまま
  const itemPaths: string[] = [];
  m.elements.forEach((e, ei) => e.items.forEach((_, ii) => itemPaths.push(`elements[${ei}].items[${ii}]`)));
  const placed = [...a.singleMeanings, ...a.referenceTables].map((x) => x.materialPath);
  check(`${L} 象意 欠落重複なし`, same([...placed].sort(), [...itemPaths].sort()));
  for (const s of a.singleMeanings) {
    const it = resolvePath(m, s.materialPath) as { kind: string; data: unknown; source: unknown };
    check(`${L} ${s.id} 値`, it.data === s.content && same(it.source, s.source));
    check(`${L} ${s.id} 旺衰を含まない`, !/旺衰|旺相/.test(s.kind));
  }
  for (const t of a.referenceTables) {
    const it = resolvePath(m, t.materialPath) as { kind: string; data: unknown; note?: string };
    check(`${L} ${t.id} 値`, it.data === t.content && (it.note ?? null) === t.note);
    check(`${L} ${t.id} 参照表の種類`, /旺衰|旺相/.test(t.kind));
  }

  // C. 剋應: 5系統＋星別総論がちょうど1回、本文・キー・吉凶・付属項目がそのまま
  const kPaths: string[] = [];
  for (const name of ["jikkan", "hachimonGate", "hachimonWonder", "sankiTokyu", "kyuseiJichi", "kyuseiContext"] as const) {
    (m.kokuo[name] as unknown[]).forEach((_, i) => kPaths.push(`kokuo.${name}[${i}]`));
  }
  check(`${L} 剋應 欠落重複なし`, same(a.kokuo.map((x) => x.materialPath), kPaths));
  for (const k of a.kokuo) {
    const src = resolvePath(m, k.materialPath) as Record<string, unknown>;
    if (k.materialPath.startsWith("kokuo.kyuseiContext")) {
      check(`${L} ${k.id} 星別総論`, src.heading === k.name && rubyInvariant(src.body as string, k.body, k.rubyLinesRemoved));
      continue;
    }
    const entry = src.entry as Record<string, unknown>;
    const raw = src.raw as Record<string, unknown>;
    check(`${L} ${k.id} 本文（ルビ行のみ除去）`, rubyInvariant(entry.body as string, k.body, k.rubyLinesRemoved)
      && k.body === stripRubyLines(entry.body as string).text);
    check(`${L} ${k.id} キー・名称・吉凶`, same(entry.key, k.key) && entry.name === k.name && entry.fortuneRaw === k.fortuneRaw && entry.id === k.entryId);
    const { notes_raw, ...rest } = raw;
    check(`${L} ${k.id} 付属項目`, same(rest, k.details));
    check(`${L} ${k.id} 注記`, k.notes === (typeof notes_raw === "string" && notes_raw !== "" ? notes_raw : null));
  }

  // D/E. 格局: scope どおりの分類にちょうど1回、値そのまま
  const byScope = { palace: a.palaceKaku, whole_chart: a.wholeChartKaku, scope判定不能: a.unknownScopeKaku };
  check(`${L} 格局 欠落重複なし`, same(
    [...a.palaceKaku, ...a.wholeChartKaku, ...a.unknownScopeKaku].map((x) => x.materialPath).sort(),
    m.kaku.map((_, i) => `kaku[${i}]`).sort(),
  ));
  for (const [scope, list] of Object.entries(byScope)) {
    for (const k of list) {
      const src = resolvePath(m, k.materialPath) as Record<string, unknown>;
      check(`${L} ${k.id} scope`, src.scope === scope && k.scope === scope);
      check(`${L} ${k.id} 値`, src.name === k.name && src.judgeMeaning === k.judgeMeaning
        && same(src.meaningDb, k.meaningDb) && same(src.sources, k.sources) && same(src.palaces, k.palaces)
        && (src.detail ?? null) === k.detail);
    }
  }

  // F. 伏吟・反吟: linked のみ主要材料、unlinked は excluded（名称と理由のみ）
  const expLinked = m.fuYinFanYin.filter((f) => f.linkedSubtypes.length > 0);
  check(`${L} 伏吟反吟 linked 件数`, a.fuYinFanYin.length === expLinked.length);
  for (const f of a.fuYinFanYin) {
    const src = resolvePath(m, f.materialPath) as Record<string, unknown>;
    check(`${L} ${f.id} 値`, same(src.linkedSubtypes, f.linkedSubtypes) && same(src.fortuneText, f.fortuneText)
      && src.judgeDetail === f.judgeDetail);
  }
  const unlinkedNames = m.fuYinFanYin.flatMap((f) => f.unlinkedSubtypes.map((u) => u.name));
  for (const n of unlinkedNames) {
    check(`${L} unlinked は主要材料に無い ${n}`, a.fuYinFanYin.every((f) => f.linkedSubtypes.every((s) => s.name !== n)));
  }
  const exUnlinked = a.excluded.filter((x) => x.kind === "紐付けなかった伏吟反吟");
  check(`${L} unlinked は excluded`, exUnlinked.length === unlinkedNames.length && exUnlinked.every((x) => x.content === null));

  // gate_notes は主要材料に入らず excluded に原文のまま
  const exNotes = a.excluded.filter((x) => x.kind === "分類未確定の注記");
  check(`${L} gate_notes 件数`, exNotes.length === m.kokuo.gateNotes.length);
  const mainJson = JSON.stringify(MAIN_KEYS.map((k) => a[k]));
  m.kokuo.gateNotes.forEach((g, i) => {
    check(`${L} gate_notes 原文`, same(exNotes[i].content, {
      gate: g.gate, static_intro_raw: g.static_intro_raw, dynamic_intro_raw: g.dynamic_intro_raw,
      dynamic_tail_note_raw: g.dynamic_tail_note_raw,
    }));
    // 景門・驚門は dynamic_tail_note_raw が空文字（元データどおり）のため照合対象外。
    if (g.dynamic_tail_note_raw !== "") {
      check(`${L} gate_notes は主要材料に無い`, !mainJson.includes(JSON.stringify(g.dynamic_tail_note_raw).slice(1, -1)));
    }
  });
  // omitted: unlinked と項目名・理由が完全一致するものだけ unlinked 側へまとめる
  const dupPaths = exUnlinked.flatMap((x) => x.duplicateMaterialPaths);
  check(`${L} omitted 件数`, a.excluded.filter((x) => x.kind === "取得しなかった項目").length + dupPaths.length === m.omitted.length);
  for (const x of exUnlinked) {
    for (const p of x.duplicateMaterialPaths) {
      const o = resolvePath(m, p) as { item: string; reason: string };
      check(`${L} まとめた omitted は同一内容 ${p}`, o.reason === x.reason && o.item === x.item.replace(/^(伏吟|反吟)（/, "$1の吉凶文（"));
    }
  }
  for (const n of unlinkedNames) {
    check(`${L} 紐付けなかった ${n} は excluded に1件`, a.excluded.filter((x) => x.item.includes(`（${n}）`)).length === 1);
  }
}

// ---- 1) 指定ケース -----------------------------------------------------------
{
  const r = calculate({ year: 2025, month: 1, day: 1, hour: 15, minute: 0, timezone: "Asia/Tokyo" });
  const m = buildQimenPalaceMaterials(r, 6);
  const a = serializeQimenAiInput(m);
  const L = "指定ケース";
  verify(m, a, L);

  const fact = (label: string) => a.chartFacts.filter((f) => f.label === label).map((f) => f.value);
  check(`${L} 陽遁7局`, same(fact("遁"), ["陽遁"]) && same(fact("局"), [7]));
  check(`${L} 乾六宮`, same(fact("宮番号"), [6]) && same(fact("八卦"), ["乾"]));

  const kokuoIds = a.kokuo.map((k) => k.entryId);
  check(`${L} 剋應の顔ぶれ`, same(kokuoIds, [
    "jikkan-乙-乙", "hachimon-static-開門-開門", "hachimon-dynamic-開門-開門", "hachimon-static-開門-乙", "sanki-乙-乾",
  ]));
  const byEntry = (id: string) => a.kokuo.find((k) => k.entryId === id)!;
  check(`${L} 日奇伏吟`, byEntry("jikkan-乙-乙").name === "日奇伏吟" && byEntry("jikkan-乙-乙").fortuneRaw === "凶");
  check(`${L} 開門×開門 静應`, byEntry("hachimon-static-開門-開門").mode === "静應");
  check(`${L} 開門×開門 動應`, byEntry("hachimon-dynamic-開門-開門").mode === "動應");
  check(`${L} 開門×乙`, byEntry("hachimon-static-開門-乙").kokuoType === "八門剋應（門×三奇）");
  const sanki = byEntry("sanki-乙-乾");
  check(`${L} 玉兔入天門`, sanki.name === "玉兔入天門" && sanki.fortuneRaw === "吉");

  // 条件の保持
  check(`${L} 六十日以内（本文）`, sanki.body.includes("六十日以内"));
  check(`${L} 六十日以内（時期）`, same(sanki.details.time_expressions, ["六十日以内"]));
  check(`${L} 「商」音（姓）の人（本文）`, sanki.body.includes("「商」音（姓）の人"));
  check(`${L} 「商」音（姓）の人（結果）`, String(sanki.details.result_body).includes("「商」音（姓）の人"));
  check(`${L} 五音`, same(sanki.details.five_tone_mentions, ["商"]));
  const dyn = byEntry("hachimon-dynamic-開門-開門");
  check(`${L} 六里（2.4km）、十六里（6.4km）`, dyn.body.includes("六里（2.4km）、十六里（6.4km）"));
  check(`${L} 距離`, same(dyn.details.distances, [
    { li_raw: "六里", metric_raw: "2.4km" }, { li_raw: "十六里", metric_raw: "6.4km" },
  ]));

  check(`${L} 宮単位の格局`, same(a.palaceKaku.map((k) => k.name), ["休詐", "乙奇入墓", "三奇受刑"]));
  check(`${L} 盤全体の格局`, same(a.wholeChartKaku.map((k) => k.name), ["伏吟格", "反吟格"]));
  check(`${L} scope判定不能なし`, a.unknownScopeKaku.length === 0);

  check(`${L} linked の伏吟資料`, a.fuYinFanYin.length === 1 && a.fuYinFanYin[0].kind === "伏吟"
    && same(a.fuYinFanYin[0].linkedSubtypes.map((s) => s.name), ["九星伏吟", "八門伏吟"]));
  check(`${L} 反吟は主要材料に無い`, a.fuYinFanYin.every((f) => f.kind !== "反吟"));
  check(`${L} unlinked の反吟資料`, a.excluded.some((x) => x.kind === "紐付けなかった伏吟反吟" && x.item === "反吟（直符反吟）"));
  check(`${L} 図版の反吟吉凶文は主要材料に無い`, !JSON.stringify(MAIN_KEYS.map((k) => a[k])).includes("反吟となれば"));
  check(`${L} gate_notes（開門）は excluded`, a.excluded.some((x) => x.kind === "分類未確定の注記" && x.content?.gate === "開門"));
  check(`${L} 占身命は主要材料に無い`, !JSON.stringify(MAIN_KEYS.map((k) => a[k])).includes("占身命"));

  // ルビ除去（KOKUO-001）
  const k1 = a.kokuo.find((k) => k.id === "KOKUO-001")!;
  check(`${L} KOKUO-001 日奇伏吟・安分守己が残る`, k1.body.includes("日奇伏吟") && k1.body.includes("安分守己（自分の身の程をわきま"));
  check(`${L} KOKUO-001 ルビ除去`, !k1.body.includes("にっきふくぎん") && !k1.body.includes("あんぶんしゅき")
    && same(k1.rubyLinesRemoved.map((l) => l.trim()), ["にっきふくぎん", "あんぶんしゅき"]));
  check(`${L} 玉兔入天門のルビ除去と条件保持`, !sanki.body.includes("ぎょくとにゅうてんもん")
    && sanki.body.includes("玉兔入天門") && sanki.body.includes("その後、六十日以内に「商」音（姓）の人は"));

  // 直符反吟: excluded に1件だけ・理由を保持・linked にしない・追加吉凶文なし
  const zhifu = a.excluded.filter((x) => x.item.includes("直符反吟"));
  check(`${L} 直符反吟は excluded に1件`, zhifu.length === 1 && zhifu[0].kind === "紐付けなかった伏吟反吟");
  check(`${L} 直符反吟の理由を保持`, zhifu[0].reason.includes("判定成立から図版の状態を導けないため紐付けない"));
  check(`${L} 直符反吟のまとめ先`, same(zhifu[0].duplicateMaterialPaths, ["omitted[5]"]));
  check(`${L} 直符反吟は linked でない`, a.fuYinFanYin.every((f) => f.linkedSubtypes.every((s) => s.name !== "直符反吟")));
}

// ---- 剋應データ全件へのルビ除去 --------------------------------------------------
{
  let removedTotal = 0;
  for (const n of ["jikkan", "hachimon", "kyusei_jichi", "sanki_tokyu"]) {
    const data = JSON.parse(readFileSync(`src/lib/qimen/kokuo/data/${n}.json`, "utf8"));
    const texts: [string, string][] = data.entries.map((e: { id: string; body: string }) => [e.id, e.body]);
    if (data.context_blocks) {
      for (const blocks of Object.values(data.context_blocks) as { heading: string; body: string }[][]) {
        for (const b of blocks) texts.push([b.heading, b.body]);
      }
    }
    for (const [id, text] of texts) {
      const r = stripRubyLines(text);
      removedTotal += r.removedLines.length;
      check(`全件 ルビ除去の不変条件 ${id}`, rubyInvariant(text, r.text, r.removedLines));
    }
  }
  console.log(`剋應データ全件で除去したルビ行: ${removedTotal}`);
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
    const m = buildQimenPalaceMaterials(r, palace);
    verify(m, serializeQimenAiInput(m), `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}時 宮${palace}`);
  }
}

if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
