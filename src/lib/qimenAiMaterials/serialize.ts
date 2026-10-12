// src/lib/qimenAiMaterials/serialize.ts
//
// 役割:
//   qimenMaterials（buildQimenPalaceMaterials）の出力を、AI 入力専用データへ
//   機械的に並べ替え、各材料に一意の ID を付ける。
//   判断本文は既存データの値をそのまま渡す（要約・言い換え・補完・吉凶変更・条件省略をしない）。
//   材料の分類・取捨はすべてプログラム側の固定規則で行い、AI には任せない。
//
// 独立性:
//   qimenMaterials の出力を読むだけ。排盤・剋應・格局判定・象意DBは呼ばない・変更しない。
//
// 分類規則:
//   ・chartFacts      … palace / facts / chart の値（null の項目は出さない）
//   ・singleMeanings  … elements[].items のうち 基本象意・三奇六儀象意・宮位吉凶
//   ・referenceTables … elements[].items のうち 旺衰表・旺相休囚死表・旺相休囚死の凡例
//                       （現在の段階は選ばない。既存 note をそのまま付ける）
//   ・kokuo           … kokuo の5系統＋九星値時剋應の星別総論。notes_raw（元データで本文と
//                       別フィールドの注記）は notes へ分ける
//   ・palaceKaku / wholeChartKaku / unknownScopeKaku … kaku の scope（既存判定）どおり
//   ・fuYinFanYin     … 既存判定と紐付いた（linkedSubtypes が1件以上ある）ものだけ
//   ・excluded        … 八門剋應の gate_notes（占身命・語注・古典引用・里の説明が1つの項目に
//                       混在し、元データで判断本文と区別されていないため）、紐付けなかった
//                       伏吟・反吟（名称と理由のみ）、qimenMaterials が取得しなかった項目
//
// 本文の整形:
//   剋應本文（body）だけ、独立した行として混入したルビを ruby.ts の規則で除く
//   （除いた行は rubyLinesRemoved に原文のまま残す）。それ以外の文字は変更しない。
//
// 重複の整理:
//   qimenMaterials は紐付けなかった伏吟・反吟を fuYinFanYin[].unlinkedSubtypes と
//   omitted の両方に持つ。omitted 側の項目名が「<伏吟|反吟>の吉凶文（<下位分類>）」で
//   理由の文が完全一致するものだけ、unlinked 側の1件にまとめ、その位置を
//   duplicateMaterialPaths に残す（紐付けの状態・理由は変えない）。

import type {
  ElementMaterialItem,
  KokuoMaterial,
  QimenPalaceMaterials,
} from "@/lib/qimenMaterials";
import type {
  AiChartFact,
  AiExcluded,
  AiFuYinFanYin,
  AiKaku,
  AiKokuo,
  AiReferenceTable,
  AiSingleMeaning,
  QimenAiInput,
} from "./types";
import { stripRubyLines } from "./ruby";

/** ID の接頭辞（分類ごと）。 */
export const AI_ID_PREFIX = {
  chartFacts: "FACT",
  singleMeanings: "SINGLE",
  kokuo: "KOKUO",
  palaceKaku: "KAKU-P",
  wholeChartKaku: "KAKU-W",
  unknownScopeKaku: "KAKU-U",
  fuYinFanYin: "FYFY",
  referenceTables: "REF",
  excluded: "EXCL",
} as const;

/** 単体象意として扱う items の kind。それ以外は参照表。 */
const SINGLE_KINDS = new Set(["基本象意", "三奇六儀象意", "宮位吉凶"]);
const REFERENCE_KINDS = new Set(["旺衰表", "旺相休囚死表", "旺相休囚死の凡例"]);

function idOf(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

/** 分類ごとの連番 ID 発行器。 */
function counter(prefix: string) {
  let n = 0;
  return () => idOf(prefix, ++n);
}

// ---- A. 盤の事実 ------------------------------------------------------------

function chartFacts(m: QimenPalaceMaterials): AiChartFact[] {
  const next = counter(AI_ID_PREFIX.chartFacts);
  const out: AiChartFact[] = [];
  const add = (label: string, materialPath: string, value: string | number | boolean | null | undefined) => {
    if (value === null || value === undefined) return;
    out.push({ id: next(), materialPath, origin: "排盤計算結果", source: null, label, value });
  };
  const { palace, facts, chart } = m;
  add("宮番号", "palace.number", palace.number);
  add("中宮か", "palace.isCenter", palace.isCenter);
  add("八卦", "palace.trigram", palace.trigram);
  add("地盤八門（NATAL_GATE）", "palace.natalGate", palace.natalGate);
  add("天盤干", "facts.tianPanStem", facts.tianPanStem);
  add("地盤干", "facts.diPanStem", facts.diPanStem);
  facts.jiuXing.forEach((v, i) => add("九星", `facts.jiuXing[${i}]`, v));
  facts.baMen.forEach((v, i) => add("八門", `facts.baMen[${i}]`, v));
  facts.baShen.forEach((v, i) => add("八神", `facts.baShen[${i}]`, v));
  const c = chart.calendar;
  add("節気", "chart.calendar.solarTerm", c.solarTerm);
  add("年干", "chart.calendar.yearStem", c.yearStem);
  add("年支", "chart.calendar.yearBranch", c.yearBranch);
  add("月干", "chart.calendar.monthStem", c.monthStem);
  add("月支", "chart.calendar.monthBranch", c.monthBranch);
  add("日干", "chart.calendar.dayStem", c.dayStem);
  add("日支", "chart.calendar.dayBranch", c.dayBranch);
  add("時干", "chart.calendar.hourStem", c.hourStem);
  add("時支", "chart.calendar.hourBranch", c.hourBranch);
  add("遁", "chart.dingju.dun", chart.dingju.dun);
  add("局", "chart.dingju.ju", chart.dingju.ju);
  add("元", "chart.dingju.yuan", chart.dingju.yuan);
  add("定局に用いた節気", "chart.dingju.effectiveTerm", chart.dingju.effectiveTerm);
  add("置閏期間か", "chart.dingju.isLeapRepeat", chart.dingju.isLeapRepeat);
  add("旬", "chart.xunShou.xun", chart.xunShou.xun);
  add("旬首", "chart.xunShou.xunShou", chart.xunShou.xunShou);
  add("旬首の六儀", "chart.xunShou.liuyi", chart.xunShou.liuyi);
  add("値符（九星）", "chart.zhifuStar.star", chart.zhifuStar?.star);
  add("値符（九星）の宮", "chart.zhifuStar.palace", chart.zhifuStar?.palace);
  add("値使（八門）", "chart.zhishi.men", chart.zhishi?.men);
  add("値使（八門）の宮", "chart.zhishi.palace", chart.zhishi?.palace);
  add("直符（八神）", "chart.zhifuGod.god", chart.zhifuGod?.god);
  add("直符（八神）の宮", "chart.zhifuGod.palace", chart.zhifuGod?.palace);
  add("未算出（天盤）", "chart.errors.tianPan", chart.errors.tianPan);
  add("未算出（九星）", "chart.errors.jiuXing", chart.errors.jiuXing);
  add("未算出（八門）", "chart.errors.baMen", chart.errors.baMen);
  add("未算出（八神）", "chart.errors.baShen", chart.errors.baShen);
  chart.kakuUnavailable.jikaku.forEach((v, i) =>
    add("吉格判定で未算出だった段", `chart.kakuUnavailable.jikaku[${i}]`, v));
  chart.kakuUnavailable.kyokaku.forEach((v, i) =>
    add("凶格判定で未算出だった段", `chart.kakuUnavailable.kyokaku[${i}]`, v));
  return out;
}

// ---- B. 単体象意／参照表 ------------------------------------------------------

function elementItems(m: QimenPalaceMaterials): {
  singles: AiSingleMeaning[];
  tables: AiReferenceTable[];
  unknown: AiExcluded[];
} {
  const nextS = counter(AI_ID_PREFIX.singleMeanings);
  const nextR = counter(AI_ID_PREFIX.referenceTables);
  const singles: AiSingleMeaning[] = [];
  const tables: AiReferenceTable[] = [];
  const unknown: AiExcluded[] = [];
  m.elements.forEach((e, ei) => {
    e.items.forEach((it: ElementMaterialItem, ii) => {
      const materialPath = `elements[${ei}].items[${ii}]`;
      if (SINGLE_KINDS.has(it.kind)) {
        singles.push({
          id: nextS(), materialPath, origin: "既存データ", source: it.source,
          role: e.role, element: e.name, kind: it.kind, content: it.data,
        });
      } else if (REFERENCE_KINDS.has(it.kind)) {
        tables.push({
          id: nextR(), materialPath, origin: "既存データ", source: it.source,
          role: e.role, element: e.name, kind: it.kind, content: it.data, note: it.note ?? null,
        });
      } else {
        // 想定外の kind は主要材料に入れない（推測で分類しない）。
        unknown.push({
          id: "", materialPath, origin: "既存データ", source: it.source,
          kind: "取得しなかった項目", item: `${e.role} ${e.name} ${it.kind}`,
          reason: "単体象意・参照表のどちらとも決められていない種類のため主要材料に入れない。",
          content: null,
          duplicateMaterialPaths: [],
        });
      }
    });
  });
  return { singles, tables, unknown };
}

// ---- C. 剋應 ------------------------------------------------------------------

const MODE_LABEL = { static: "静應", dynamic: "動應" } as const;

function kokuoItem(k: KokuoMaterial, materialPath: string, id: string): AiKokuo {
  const { notes_raw, ...rest } = k.raw;
  const ruby = stripRubyLines(k.entry.body);
  return {
    id,
    materialPath,
    origin: "既存データ",
    source: k.source,
    kokuoType: k.source.dataset,
    entryId: k.entry.id,
    key: k.entry.key,
    name: k.entry.name,
    mode: k.entry.mode ? MODE_LABEL[k.entry.mode] : null,
    sourceTradition: k.entry.sourceTradition ?? null,
    fortuneRaw: k.entry.fortuneRaw,
    body: ruby.text,
    rubyLinesRemoved: ruby.removedLines,
    details: rest,
    notes: typeof notes_raw === "string" && notes_raw !== "" ? notes_raw : null,
  };
}

function kokuo(m: QimenPalaceMaterials): AiKokuo[] {
  const next = counter(AI_ID_PREFIX.kokuo);
  const out: AiKokuo[] = [];
  const lists = [
    ["jikkan", m.kokuo.jikkan],
    ["hachimonGate", m.kokuo.hachimonGate],
    ["hachimonWonder", m.kokuo.hachimonWonder],
    ["sankiTokyu", m.kokuo.sankiTokyu],
    ["kyuseiJichi", m.kokuo.kyuseiJichi],
  ] as const;
  for (const [name, list] of lists) {
    list.forEach((k, i) => out.push(kokuoItem(k, `kokuo.${name}[${i}]`, next())));
  }
  m.kokuo.kyuseiContext.forEach((c, i) => {
    const ruby = stripRubyLines(c.body);
    out.push({
      id: next(),
      materialPath: `kokuo.kyuseiContext[${i}]`,
      origin: "既存データ",
      source: c.source,
      kokuoType: c.source.dataset,
      entryId: null,
      key: {},
      name: c.heading,
      mode: null,
      sourceTradition: c.sourceTradition,
      fortuneRaw: null,
      body: ruby.text,
      rubyLinesRemoved: ruby.removedLines,
      details: {},
      notes: null,
    });
  });
  return out;
}

// ---- D/E. 格局 ------------------------------------------------------------------

function kaku(m: QimenPalaceMaterials) {
  const nextP = counter(AI_ID_PREFIX.palaceKaku);
  const nextW = counter(AI_ID_PREFIX.wholeChartKaku);
  const nextU = counter(AI_ID_PREFIX.unknownScopeKaku);
  const palaceKaku: AiKaku[] = [];
  const wholeChartKaku: AiKaku[] = [];
  const unknownScopeKaku: AiKaku[] = [];
  m.kaku.forEach((k, i) => {
    const base = {
      materialPath: `kaku[${i}]`,
      origin: "既存データ" as const,
      source: k.sources[0] ?? null,
      category: k.category,
      name: k.name,
      scope: k.scope,
      palaces: k.palaces,
      detail: k.detail ?? null,
      judgeMeaning: k.judgeMeaning,
      meaningDb: k.meaningDb,
      sources: k.sources,
    };
    if (k.scope === "palace") palaceKaku.push({ id: nextP(), ...base });
    else if (k.scope === "whole_chart") wholeChartKaku.push({ id: nextW(), ...base });
    else unknownScopeKaku.push({ id: nextU(), ...base });
  });
  return { palaceKaku, wholeChartKaku, unknownScopeKaku };
}

// ---- F. 伏吟・反吟 ----------------------------------------------------------------

function fuYinFanYin(m: QimenPalaceMaterials): {
  linked: AiFuYinFanYin[];
  unlinked: AiExcluded[];
  /** unlinked と同じ並びで、omitted 側の重複照合に使う項目名と理由 */
  unlinkedKeys: { item: string; reason: string }[];
} {
  const next = counter(AI_ID_PREFIX.fuYinFanYin);
  const linked: AiFuYinFanYin[] = [];
  const unlinked: AiExcluded[] = [];
  const unlinkedKeys: { item: string; reason: string }[] = [];
  m.fuYinFanYin.forEach((f, i) => {
    const materialPath = `fuYinFanYin[${i}]`;
    if (f.linkedSubtypes.length > 0 && f.fortuneHeading !== null && f.fortuneText !== null) {
      linked.push({
        id: next(), materialPath, origin: "既存データ", source: f.source,
        kind: f.kind, judgeName: f.judgeName, judgeDetail: f.judgeDetail,
        linkedSubtypes: f.linkedSubtypes,
        fortuneHeading: f.fortuneHeading,
        fortuneText: f.fortuneText,
      });
    }
    f.unlinkedSubtypes.forEach((u, j) => {
      unlinked.push({
        id: "", materialPath: `${materialPath}.unlinkedSubtypes[${j}]`, origin: "既存データ", source: f.source,
        kind: "紐付けなかった伏吟反吟", item: `${f.kind}（${u.name}）`, reason: u.reason, content: null,
        duplicateMaterialPaths: [],
      });
      unlinkedKeys.push({ item: `${f.kind}の吉凶文（${u.name}）`, reason: u.reason });
    });
  });
  return { linked, unlinked, unlinkedKeys };
}

// ---- 本体 ------------------------------------------------------------------

/**
 * qimenMaterials の出力から AI 入力専用データを作る。値は既存データのまま。
 */
export function serializeQimenAiInput(m: QimenPalaceMaterials): QimenAiInput {
  const { singles, tables, unknown } = elementItems(m);
  const { palaceKaku, wholeChartKaku, unknownScopeKaku } = kaku(m);
  const fy = fuYinFanYin(m);

  const gateNotes: AiExcluded[] = m.kokuo.gateNotes.map((g, i) => ({
    id: "",
    materialPath: `kokuo.gateNotes[${i}]`,
    origin: "既存データ",
    source: g.source,
    kind: "分類未確定の注記",
    item: `八門剋應の共通注記（${g.gate}）`,
    reason:
      "占身命の判断・語句注釈・古典引用・里の説明などが元データの1項目に混在し、判断本文と区別されていないため主要材料に入れない。",
    content: {
      gate: g.gate,
      static_intro_raw: g.static_intro_raw,
      dynamic_intro_raw: g.dynamic_intro_raw,
      dynamic_tail_note_raw: g.dynamic_tail_note_raw,
    },
    duplicateMaterialPaths: [],
  }));
  const omitted: AiExcluded[] = [];
  m.omitted.forEach((o, i) => {
    const materialPath = `omitted[${i}]`;
    const dup = fy.unlinkedKeys.findIndex((k) => k.item === o.item && k.reason === o.reason);
    if (dup >= 0) {
      fy.unlinked[dup].duplicateMaterialPaths.push(materialPath);
      return;
    }
    omitted.push({
      id: "",
      materialPath,
      origin: "既存データ",
      source: null,
      kind: "取得しなかった項目",
      item: o.item,
      reason: o.reason,
      content: null,
      duplicateMaterialPaths: [],
    });
  });
  const nextX = counter(AI_ID_PREFIX.excluded);
  const excluded = [...gateNotes, ...fy.unlinked, ...unknown, ...omitted].map((x) => ({ ...x, id: nextX() }));

  return {
    schemaVersion: 1,
    palaceNumber: m.palace.number,
    chartFacts: chartFacts(m),
    singleMeanings: singles,
    kokuo: kokuo(m),
    palaceKaku,
    wholeChartKaku,
    unknownScopeKaku,
    fuYinFanYin: fy.linked,
    referenceTables: tables,
    excluded,
  };
}
