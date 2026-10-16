// src/lib/qimenSearch/candidateInfo.ts
//
// 役割:
//   検索結果（日時×成立宮）を鑑定候補として見るための情報をまとめる（Phase 4A・2026-10-16）。
//   既存の計算結果（qimenEngine.calculate() の QimenResult）・剋應（resolveKokuoForPalace）・
//   象意データ（qimenMeaning）を読んで並べるだけで、新しい象意・判定規則・点数は作らない。
//
//   buildPalaceSummary   … 宮の基本情報（方位・八門・九星・八神・天盤干・地盤干（寄宮干を含む）・
//                          その宮の吉格・凶格）。検索エンジンがヒットごとに持たせる要約。
//   buildCandidateDetail … 上記＋盤全体の凶格・剋應5系統・婚姻に関する参考情報（展開表示・比較表用）。
//
// 婚姻に関する参考情報:
//   八門・九星・八神・格局の象意（講義案N）と剋應本文のうち、「婚」「嫁娶」「縁談」を含むものを、
//   その項目の全文・吉凶ラベル・出典と一緒に並べる。語を含むことを示すだけで、
//   「良縁・出会いの移動に適した条件」などの判定は一切しない。
//   講義案N p.64 の用事別造作法（求婚・女性の結婚の格局一覧）は造作法であり、ここでは使わない。

import { PALACE_TRIGRAM, resolveKokuoForPalace } from "@/lib/qimen";
import type { QimenResult, KokuoEntry, KokuoResult } from "@/lib/qimen";
import {
  lookupMeaning,
  lookupBaMenMeaning,
  lookupJiuXingMeaning,
  lookupBaShenMeaning,
} from "@/lib/qimenMeaning";

/** 宮番号 → 宮名。 */
export const PALACE_NAME: Record<number, string> = {
  1: "坎一宮", 2: "坤二宮", 3: "震三宮", 4: "巽四宮", 5: "中五宮",
  6: "乾六宮", 7: "兌七宮", 8: "艮八宮", 9: "離九宮",
};

/** 宮番号 → 方位（洛書九宮。/qimen の宮詳細と同じ対応）。 */
export const PALACE_DIRECTION: Record<number, string> = {
  1: "北", 2: "南西", 3: "東", 4: "南東", 5: "中央",
  6: "北西", 7: "西", 8: "北東", 9: "南",
};

/** 方位指定検索で選べる八方位（宮番号）。北から時計回り。 */
export const DIRECTION_PALACES: readonly number[] = [1, 8, 3, 4, 9, 2, 7, 6];

/** 宮の名称と方位（例: 坎一宮・北）。 */
export function palaceDirectionLabel(palace: number): string {
  return `${PALACE_NAME[palace] ?? `${palace}宮`}・${PALACE_DIRECTION[palace] ?? "—"}`;
}

/** 成立宮の要約（検索結果カード用）。 */
export interface PalaceSummaryInfo {
  palace: number;
  /** 後天八卦（中宮は null） */
  trigram: string | null;
  baMen: string[];
  jiuXing: string[];
  baShen: string[];
  tianPanStem: string | null;
  /** 天禽が帯同する中五宮の干（芮禽同居宮のみ） */
  tianPanLodged: string | null;
  diPanStem: string | null;
  /** 坤二宮に寄宮した中五宮の地盤干（坤二宮のみ） */
  diPanLodged: string | null;
  /** その宮で成立した吉格（検索条件に関係なく全件） */
  jikaku: string[];
  /** その宮で成立した凶格（検索条件に関係なく全件。detail があれば括弧で併記） */
  kyokaku: string[];
}

/** 盤全体で成立した凶格（palaces=[]。伏吟格・反吟格・五不遇時など）。detail があれば併記。 */
export function boardWideKyokaku(result: QimenResult): string[] {
  return result.kyokaku.matches
    .filter((m) => m.palaces.length === 0)
    .map((m) => (m.detail ? `${m.name}（${m.detail}）` : m.name));
}

export function buildPalaceSummary(result: QimenResult, palace: number): PalaceSummaryInfo {
  const p = result.palaces[palace];
  return {
    palace,
    trigram: PALACE_TRIGRAM[palace] ?? null,
    baMen: p ? [...p.baMen] : [],
    jiuXing: p ? [...p.jiuXing] : [],
    baShen: p ? [...p.baShen] : [],
    tianPanStem: p?.tianPanStem ?? null,
    tianPanLodged: p?.tianPanLodged?.stem ?? null,
    diPanStem: p?.diPanStem ?? null,
    diPanLodged: p?.diPanLodged?.stem ?? null,
    jikaku: result.jikaku.matches.filter((m) => m.palaces.includes(palace)).map((m) => m.name),
    kyokaku: result.kyokaku.matches
      .filter((m) => m.palaces.includes(palace))
      .map((m) => (m.detail ? `${m.name}（${m.detail}）` : m.name)),
  };
}

/** 干の表示（寄宮干は括弧書き。/qimen の盤面と同じ「乙(庚)」形式）。 */
export function stemLabel(stem: string | null, lodged: string | null): string {
  return `${stem ?? "—"}${lodged ? `(${lodged})` : ""}`;
}

/** 婚姻に関する参考情報1件。 */
export interface MarriageReference {
  /** 区分（八門・九星・八神・吉格・凶格・剋應の系統名） */
  category: string;
  /** 名称（八門名・九星名・格局名・剋應名など） */
  name: string;
  /** 資料の吉凶ラベル（無ければ null） */
  fortuneLabel: string | null;
  /** 該当項目の全文（語を含む項目だけでなく、その名称の象意すべて） */
  texts: string[];
  /** 「婚」「嫁娶」「縁談」を含む項目 */
  matchedTexts: string[];
  /** 出典 */
  source: string;
}

/** 婚姻に関する語。語を含むかどうかだけを見る（判定はしない）。 */
export const MARRIAGE_KEYWORDS = ["婚", "嫁娶", "縁談"] as const;

function hasMarriageWord(text: string): boolean {
  return MARRIAGE_KEYWORDS.some((w) => text.includes(w));
}

function meaningRef(
  category: string,
  name: string,
  fortuneLabel: string | null,
  texts: readonly string[] | undefined,
  source: string,
): MarriageReference | null {
  if (!texts) return null;
  const matched = texts.filter(hasMarriageWord);
  if (matched.length === 0) return null;
  return { category, name, fortuneLabel, texts: [...texts], matchedTexts: matched, source };
}

const KOKUO_LABEL: Record<KokuoEntry["category"], string> = {
  jikkan: "十干剋應",
  hachimon_gate: "八門剋應（門×門）",
  hachimon_wonder: "八門剋應（門×三奇）",
  sanki_tokyu: "三奇到宮剋應",
  kyusei_jichi: "九星値時剋應",
};

export function kokuoCategoryLabel(c: KokuoEntry["category"]): string {
  return KOKUO_LABEL[c];
}

/** 剋應5系統を1つの配列にする（資料の順・全件）。 */
export function flattenKokuo(k: KokuoResult): KokuoEntry[] {
  return [...k.jikkan, ...k.hachimonGate, ...k.hachimonWonder, ...k.sankiTokyu, ...k.kyuseiJichi];
}

/** 剋應1件の短い名称（判定キーの値を「×」でつなぐ。資料に名称があれば前に付ける）。 */
export function kokuoShortLabel(e: KokuoEntry): string {
  // 八門剋應の counterpart_type（earth_gate／heaven_stem）は種別名であって値ではないため除く。
  const key = Object.entries(e.key)
    .filter(([k]) => k !== "counterpart_type")
    .map(([, v]) => v)
    .join("×");
  return e.name ? `${e.name}（${key}）` : key;
}

/** 九星値時剋應の典拠系統の表示名（/qimen の宮詳細と同じ対応）。 */
export const KOKUO_TRADITION_LABEL: Record<string, string> = {
  kimon_tonkou_hiketsu_taizen: "奇門遁甲秘笈大全",
  tonkou_engi: "遁甲演義",
};

/** 宮の婚姻に関する参考情報（八門・九星・八神・格局・剋應）。 */
export function marriageReferences(result: QimenResult, palace: number, kokuo: KokuoResult): MarriageReference[] {
  const p = result.palaces[palace];
  const out: (MarriageReference | null)[] = [];
  if (p) {
    for (const door of p.baMen) {
      const e = lookupBaMenMeaning(door);
      out.push(meaningRef("八門", door, e?.fortuneLabel ?? null, e?.basicMeaning, `奇門遁甲講義案N p.${e?.sourcePage ?? "—"}`));
    }
    for (const star of p.jiuXing) {
      const e = lookupJiuXingMeaning(star);
      out.push(meaningRef("九星", star, e?.fortuneLabel ?? null, e?.basicMeaning, `奇門遁甲講義案N p.${e?.sourcePage ?? "—"}`));
    }
    for (const god of p.baShen) {
      const e = lookupBaShenMeaning(god);
      out.push(meaningRef("八神", god, e?.fortuneLabel ?? null, e?.basicMeaning, `奇門遁甲講義案N p.${e?.sourcePage ?? "—"}`));
    }
  }
  for (const m of result.jikaku.matches.filter((x) => x.palaces.includes(palace))) {
    out.push(meaningRef("吉格", m.name, null, lookupMeaning(m.name), `奇門遁甲講義案N ${m.source}`));
  }
  for (const m of result.kyokaku.matches.filter((x) => x.palaces.includes(palace) || x.palaces.length === 0)) {
    const cat = m.palaces.length === 0 ? "凶格（盤全体）" : "凶格";
    out.push(meaningRef(cat, m.name, null, lookupMeaning(m.name), `奇門遁甲講義案N ${m.source}`));
  }
  for (const e of flattenKokuo(kokuo)) {
    out.push(
      meaningRef(
        kokuoCategoryLabel(e.category),
        kokuoShortLabel(e),
        e.fortuneRaw,
        [e.body],
        `${e.source.document} ${e.source.printedPages}`,
      ),
    );
  }
  return out.filter((x): x is MarriageReference => x !== null);
}

/** 候補（日時×宮）の鑑定情報一式。 */
export interface CandidateDetail extends PalaceSummaryInfo {
  /** 盤全体で成立した凶格 */
  boardWide: string[];
  /** 宮に関係する剋應（5系統） */
  kokuo: KokuoResult;
  /** 婚姻に関する参考情報（判定ではない） */
  marriage: MarriageReference[];
}

export function buildCandidateDetail(result: QimenResult, palace: number): CandidateDetail {
  const kokuo = resolveKokuoForPalace(result, palace);
  return {
    ...buildPalaceSummary(result, palace),
    boardWide: boardWideKyokaku(result),
    kokuo,
    marriage: marriageReferences(result, palace, kokuo),
  };
}
