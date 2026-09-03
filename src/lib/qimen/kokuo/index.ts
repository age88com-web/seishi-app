// src/lib/qimen/kokuo/index.ts
//
// 奇門遁甲「剋應（こくおう）」参照モジュール。
//   算出済みの盤情報（QimenResult）から、剋應データを引くだけの薄い層。
//   排盤ロジック（CalendarEngine / qimenEngine）は一切呼ばず・変更せず、
//   calculate() の戻り値だけを入力にする。
//
// 唯一の仕様根拠: docs/source/kokuoo/（data/*.json はその検証転記 fixture）。
//   一般書・他流派・推測による補完は禁止。
//
// 検索仕様（正式）:
//   ① 十干剋應          : 天盤奇儀 × 地盤奇儀（甲→戊 正規化）
//   ② 八門剋應（門×門） : 人盤八門 × 地盤八門（後天定位門）。静應・動應の両方
//   ③ 八門剋應（門×三奇）: 人盤八門 × 天盤奇儀（乙丙丁のときのみ）
//   ④ 三奇到宮剋應      : 地盤三奇（乙丙丁）の宮 × 八宮名（天盤ではなく地盤基準）
//   ⑤ 九星値時剋應      : 値符星 × 時支（クリック宮に値符星があるときだけ）
//   中宮(5) は剋應を検索しない（すべて「—」）。

import type { QimenResult } from "../qimenEngine";

import jikkanFile from "./data/jikkan.json";
import hachimonFile from "./data/hachimon.json";
import kyuseiFile from "./data/kyusei_jichi.json";
import sankiFile from "./data/sanki_tokyu.json";

// ---- 剋應データの最小型（data/*.json の該当フィールドのみ） ----------------

interface RawSource {
  document: string;
  printed_pages: string;
}

interface RawJikkan {
  id: string;
  key: { heaven_stem: string; earth_stem: string };
  name: string | null;
  fortune_raw: string | null;
  fortune_label: string | null;
  body: string;
  source: RawSource;
}

interface RawHachimon {
  id: string;
  mode: "static" | "dynamic";
  key: {
    human_gate: string;
    counterpart_type: "earth_gate" | "heaven_stem";
    counterpart: string;
  };
  body: string;
  fortune_mentions: string[];
  source: RawSource;
}

interface RawKyusei {
  id: string;
  source_tradition: string;
  key: { value_star: string; hour_branch: string };
  heading_raw: string;
  body: string;
  fortune_mentions: string[];
  application_mentions: string[];
  source: RawSource;
}

interface RawSanki {
  id: string;
  key: { wonder_stem: string; palace: string };
  name: string | null;
  name_raw: string | null;
  fortune_raw: string | null;
  fortune_code: string | null;
  omen_body: string;
  result_body: string;
  time_expressions: string[];
  notes_raw: string;
  body: string;
  source: RawSource;
}

const JIKKAN = (jikkanFile as { entries: RawJikkan[] }).entries;
const HACHIMON = (hachimonFile as { entries: RawHachimon[] }).entries;
const KYUSEI = (kyuseiFile as { entries: RawKyusei[] }).entries;
const SANKI = (sankiFile as { entries: RawSanki[] }).entries;

// ---- 公開型 --------------------------------------------------------------

export type KokuoCategory =
  | "jikkan" // ① 十干剋應
  | "hachimon_gate" // ② 八門剋應（門×門）
  | "hachimon_wonder" // ③ 八門剋應（門×三奇）
  | "sanki_tokyu" // ④ 三奇到宮剋應
  | "kyusei_jichi"; // ⑤ 九星値時剋應

/** 剋應1件。資料本文(body)をそのまま保持する。吉凶表記は資料の値を選ぶだけで再判定しない。 */
export interface KokuoEntry {
  category: KokuoCategory;
  id: string;
  /** 種類別の判定キー（資料の key をそのまま） */
  key: Record<string, string>;
  /** 資料に名称があれば名称。無ければ null */
  name: string | null;
  /** 資料の吉凶表記（原文のまま。系統によって元フィールドが異なる） */
  fortuneRaw: string | null;
  /** 判定本文（資料そのまま・要約しない） */
  body: string;
  /** 八門剋應のみ: 静應 / 動應 */
  mode?: "static" | "dynamic";
  /** 九星値時剋應のみ: 典拠系統 */
  sourceTradition?: string;
  source: { document: string; printedPages: string };
}

export interface KokuoLookupInput {
  /** ① 天盤奇儀（甲は呼び出し側で戊へ正規化して渡してよい。内部でも正規化する） */
  heavenStem?: string;
  /** ① 地盤奇儀 */
  earthStem?: string;
  /** ②③ 人盤八門 */
  humanGate?: string;
  /** ② 地盤八門（後天定位門） */
  earthGate?: string;
  /** ③ 天盤奇儀のうち三奇（乙丙丁）のみ。それ以外は undefined を渡す */
  heavenWonderStem?: string;
  /** ④ 地盤三奇（乙丙丁） */
  groundWonderStem?: string;
  /** ④ 八宮名（乾坎艮震巽離坤兌） */
  palaceName?: string;
  /** ⑤ 値符星 */
  chiefStar?: string;
  /** ⑤ 時支 */
  hourBranch?: string;
}

export interface KokuoResult {
  jikkan: KokuoEntry[];
  hachimonGate: KokuoEntry[];
  hachimonWonder: KokuoEntry[];
  sankiTokyu: KokuoEntry[];
  kyuseiJichi: KokuoEntry[];
  /** 検索キーは揃っていたが該当0件だった系統（推測補完しない） */
  notFound: KokuoCategory[];
}

// ---- 定数（資料および排盤の不変対応。局に依存しない） --------------------

/** 八門の後天定位門（地盤八門）。中宮5は無位。 */
const NATAL_GATE: Record<number, string> = {
  1: "休門", 2: "死門", 3: "傷門", 4: "杜門",
  6: "開門", 7: "驚門", 8: "生門", 9: "景門",
};

/** 宮番号 → 八宮名（後天八卦）。中宮5は八宮に含まれない。 */
const BAGUA_NAME: Record<number, string> = {
  1: "坎", 2: "坤", 3: "震", 4: "巽",
  6: "乾", 7: "兌", 8: "艮", 9: "離",
};

const THREE_WONDERS = new Set(["乙", "丙", "丁"]);

/** 甲は資料どおり戊へ正規化（十干剋應）。 */
function normalizeStem(stem: string | undefined): string | undefined {
  if (stem === undefined) return undefined;
  return stem === "甲" ? "戊" : stem;
}

function toSource(s: RawSource): KokuoEntry["source"] {
  return { document: s.document, printedPages: s.printed_pages };
}

// ---- lookupKokuo: キーを渡して引くだけ ---------------------------------

export function lookupKokuo(input: KokuoLookupInput): KokuoResult {
  const notFound: KokuoCategory[] = [];

  // ① 十干剋應: 天盤奇儀 × 地盤奇儀
  const heaven = normalizeStem(input.heavenStem);
  const earth = normalizeStem(input.earthStem);
  let jikkan: KokuoEntry[] = [];
  if (heaven && earth) {
    jikkan = JIKKAN.filter(
      (e) => e.key.heaven_stem === heaven && e.key.earth_stem === earth,
    ).map((e) => ({
      category: "jikkan" as const,
      id: e.id,
      key: { ...e.key },
      name: e.name,
      fortuneRaw: e.fortune_label ?? e.fortune_raw,
      body: e.body,
      source: toSource(e.source),
    }));
    if (jikkan.length === 0) notFound.push("jikkan");
  }

  // ② 八門剋應（門×門）: 人盤八門 × 地盤八門（静應・動應の両方）
  let hachimonGate: KokuoEntry[] = [];
  if (input.humanGate && input.earthGate) {
    hachimonGate = HACHIMON.filter(
      (e) =>
        e.key.human_gate === input.humanGate &&
        e.key.counterpart_type === "earth_gate" &&
        e.key.counterpart === input.earthGate,
    ).map((e) => ({
      category: "hachimon_gate" as const,
      id: e.id,
      key: { ...e.key },
      name: null,
      fortuneRaw: e.fortune_mentions.length ? e.fortune_mentions.join("・") : null,
      body: e.body,
      mode: e.mode,
      source: toSource(e.source),
    }));
    if (hachimonGate.length === 0) notFound.push("hachimon_gate");
  }

  // ③ 八門剋應（門×三奇）: 人盤八門 × 天盤奇儀（乙丙丁のときのみ）
  let hachimonWonder: KokuoEntry[] = [];
  if (input.humanGate && input.heavenWonderStem && THREE_WONDERS.has(input.heavenWonderStem)) {
    hachimonWonder = HACHIMON.filter(
      (e) =>
        e.key.human_gate === input.humanGate &&
        e.key.counterpart_type === "heaven_stem" &&
        e.key.counterpart === input.heavenWonderStem,
    ).map((e) => ({
      category: "hachimon_wonder" as const,
      id: e.id,
      key: { ...e.key },
      name: null,
      fortuneRaw: e.fortune_mentions.length ? e.fortune_mentions.join("・") : null,
      body: e.body,
      mode: e.mode,
      source: toSource(e.source),
    }));
    if (hachimonWonder.length === 0) notFound.push("hachimon_wonder");
  }

  // ④ 三奇到宮剋應: 地盤三奇 × 八宮名
  let sankiTokyu: KokuoEntry[] = [];
  if (input.groundWonderStem && THREE_WONDERS.has(input.groundWonderStem) && input.palaceName) {
    sankiTokyu = SANKI.filter(
      (e) => e.key.wonder_stem === input.groundWonderStem && e.key.palace === input.palaceName,
    ).map((e) => ({
      category: "sanki_tokyu" as const,
      id: e.id,
      key: { ...e.key },
      name: e.name ?? e.name_raw,
      fortuneRaw: e.fortune_raw,
      body: e.body,
      source: toSource(e.source),
    }));
    if (sankiTokyu.length === 0) notFound.push("sanki_tokyu");
  }

  // ⑤ 九星値時剋應: 値符星 × 時支（典拠別に全件）
  let kyuseiJichi: KokuoEntry[] = [];
  if (input.chiefStar && input.hourBranch) {
    kyuseiJichi = KYUSEI.filter(
      (e) => e.key.value_star === input.chiefStar && e.key.hour_branch === input.hourBranch,
    ).map((e) => ({
      category: "kyusei_jichi" as const,
      id: e.id,
      key: { ...e.key },
      name: null,
      fortuneRaw: e.fortune_mentions.length ? e.fortune_mentions.join("・") : null,
      body: e.body,
      sourceTradition: e.source_tradition,
      source: toSource(e.source),
    }));
    if (kyuseiJichi.length === 0) notFound.push("kyusei_jichi");
  }

  return { jikkan, hachimonGate, hachimonWonder, sankiTokyu, kyuseiJichi, notFound };
}

// ---- resolveKokuoForPalace: QimenResult + 宮番号 → 剋應 -----------------

/**
 * 選択宮の剋應を引く。QimenResult は読むだけ（排盤ロジックは呼ばない）。
 *   - 天盤奇儀 / 地盤奇儀 : result.palaces[palace].tianPanStem / diPanStem
 *   - 人盤八門           : result.palaces[palace].baMen[0]
 *   - 地盤八門（後天定位門）: NATAL_GATE[palace]（局に依らない固定対応）
 *   - 八宮名             : BAGUA_NAME[palace]
 *   - 値符星             : result.jiuXing?.zhifu.star
 *   - 時支              : result.calendar.hourBranch
 * 中宮(5) は検索しない（すべて空）。
 */
export function resolveKokuoForPalace(result: QimenResult, palace: number): KokuoResult {
  const empty: KokuoResult = {
    jikkan: [], hachimonGate: [], hachimonWonder: [],
    sankiTokyu: [], kyuseiJichi: [], notFound: [],
  };
  if (palace === 5) return empty;

  const p = result.palaces[palace];
  if (!p) return empty;

  const tianPanStem = p.tianPanStem;
  const diPanStem = p.diPanStem;
  const humanGate = p.baMen[0];
  const chiefStar = result.jiuXing?.zhifu.star;
  // ⑤: クリック宮に値符星がある場合だけ
  const starInThisPalace = !!chiefStar && p.jiuXing.includes(chiefStar);

  return lookupKokuo({
    // ①
    heavenStem: tianPanStem,
    earthStem: diPanStem,
    // ②
    humanGate,
    earthGate: NATAL_GATE[palace],
    // ③（天盤奇儀が三奇のときだけ）
    heavenWonderStem:
      tianPanStem && THREE_WONDERS.has(tianPanStem) ? tianPanStem : undefined,
    // ④（地盤三奇の宮）
    groundWonderStem:
      diPanStem && THREE_WONDERS.has(diPanStem) ? diPanStem : undefined,
    palaceName: BAGUA_NAME[palace],
    // ⑤
    chiefStar: starInThisPalace ? chiefStar : undefined,
    hourBranch: starInThisPalace ? result.calendar.hourBranch : undefined,
  });
}
