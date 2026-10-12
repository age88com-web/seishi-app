// src/lib/qimenAiMaterials/confirmedMaterials.ts
//
// 役割:
//   文章構成（QimenGenerationPlan）から、画面にそのまま表示できる「確定資料」を作る。
//   ID・種類・名称・吉凶表記・範囲・内訳・静應／動應・組み合わせ・対応格局・原文は、
//   すべて Plan の値からプログラムが作り、AI には生成させない。値が無いものは作らない。
//
// 原文（sourceText）:
//   raw は Plan の値そのまま（剋應の本文はルビ除去済み）、display は toDisplayText で
//   語中の PDF 改行だけをつないだもの。
//
// 格局の2つの象意（judgeMeaning / meaningDb）:
//   A. meaningDb を「、」でつないだ文字列が judgeMeaning と完全一致
//   B. 両方から 、。と空白を除くと完全一致
//   の場合だけ表示を1つにまとめ、judgeMeaning 側を表示する（kakuMeaning.mode = "merged"）。
//   それ以外（括弧の全角・半角の違いを含む）は両方表示する（mode = "both"）。正誤は判断しない。
//
// 組み合わせ（combination）:
//   十干剋應 天盤X × 地盤Y ／ 八門剋應（門×門） X × 地盤Y ／ 八門剋應（門×三奇） X × 天盤Y ／
//   三奇到宮剋應 X奇 × Y宮 ／ 九星値時剋應 X × Y時。必要なキーが揃わないときは作らない。

import { toDisplayText } from "./displayText";
import type {
  PlanEstablishedItem,
  PlanFuYinFanYinItem,
  QimenGenerationPlan,
} from "./generationPlan";
import type { GenerationKaku, GenerationKokuo } from "./generationView";

export interface ConfirmedFact {
  id: string;
  label: string;
  value: string | number | boolean;
}

/** 単体象意の1見出し分。values は元データの配列の要素をそのまま1項目ずつ持つ（再結合・再分割しない）。 */
export interface ConfirmedLine {
  label: string;
  values: string[];
}

export interface ConfirmedSingle {
  id: string;
  element: string;
  role: string;
  kind: string;
  /** 要素に付いた吉凶ラベル（この日時・この宮の判断ではない）。無ければ null */
  fortuneLabel: string | null;
  lines: ConfirmedLine[];
}

export interface ConfirmedSourceText {
  label: string;
  raw: string;
  display: string;
}

export interface ConfirmedHeader {
  /** 種類（例: 十干剋應・吉格・伏吟反吟の追加資料） */
  type: string;
  name: string | null;
  /** 剋應の吉凶表記（null は「吉凶表記なし」） */
  fortune?: string;
  category?: "吉格" | "凶格";
  scope?: "この宮" | "盤全体";
  detail?: string;
  mode?: "静應" | "動應";
  combination?: string;
  linkedKaku?: { id: string; name: string; category: "吉格" | "凶格" };
  /** 伏吟反吟の追加資料: 判定側の内訳（例: 九星伏吟・八門伏吟） */
  judgeDetail?: string;
  /** 対応格局を決められなかった理由（unclassified のみ） */
  unclassifiedReason?: string;
}

export interface ConfirmedKakuMeaning {
  mode: "merged" | "both";
  /** merged の場合の一致の種類 */
  matchedBy: "exact" | "punctuation" | null;
  judgeMeaning: string;
  meaningDb: string[] | null;
}

export interface ConfirmedItem {
  id: string;
  kind: "kokuo" | "palaceKaku" | "wholeChartKaku" | "fuYinFanYin";
  header: ConfirmedHeader;
  sourceText: ConfirmedSourceText[];
  /** 格局のみ: 2つの象意をどう表示したか（元の値も保持） */
  kakuMeaning?: ConfirmedKakuMeaning;
}

export interface ConfirmedMaterials {
  schemaVersion: 1;
  palaceNumber: number;
  section1: { title: string; facts: ConfirmedFact[]; singleMeanings: ConfirmedSingle[] };
  section2: { title: string; items: ConfirmedItem[] };
  section3: { title: string; items: ConfirmedItem[] };
  section4: { title: string; items: ConfirmedItem[] };
  unclassified: { title: string; items: ConfirmedItem[] };
}

export const UNCLASSIFIED_TITLE = "分類未確定資料";
export const NO_FORTUNE_LABEL = "吉凶表記なし";

// ---- 単体象意 -------------------------------------------------------------

/** 三奇六儀象意などの content のキー → 見出し。 */
const SINGLE_FIELD_LABELS: Record<string, string> = {
  basicMeaning: "象意",
  personality: "性格",
  body: "身体",
  bodyNote: "身体（付記）",
  color: "色",
  taste: "味",
  people: "人物",
  aspiration: "志向",
};

function singleLines(kind: string, content: unknown): { fortuneLabel: string | null; lines: ConfirmedLine[] } {
  if (content === null || typeof content !== "object") return { fortuneLabel: null, lines: [] };
  const c = content as Record<string, unknown>;
  if (kind === "宮位吉凶") {
    return {
      fortuneLabel: null,
      lines: [{ label: `宮位吉凶（${String(c.palace)}宮）`, values: [String(c.fortune)] }],
    };
  }
  const lines: ConfirmedLine[] = [];
  for (const [key, label] of Object.entries(SINGLE_FIELD_LABELS)) {
    const v = c[key];
    if (Array.isArray(v)) lines.push({ label, values: v.map((x) => String(x)) });
    else if (typeof v === "string") lines.push({ label, values: [v] });
  }
  return { fortuneLabel: typeof c.fortuneLabel === "string" ? c.fortuneLabel : null, lines };
}

// ---- 剋應 ---------------------------------------------------------------

/** 剋應の組み合わせ表示。必要なキーが揃わないときは undefined。 */
export function kokuoCombination(kokuoType: string, key: Record<string, string>): string | undefined {
  if (kokuoType === "十干剋應" && key.heaven_stem && key.earth_stem) {
    return `天盤${key.heaven_stem} × 地盤${key.earth_stem}`;
  }
  if (kokuoType === "八門剋應（門×門）" && key.human_gate && key.counterpart_type === "earth_gate" && key.counterpart) {
    return `${key.human_gate} × 地盤${key.counterpart}`;
  }
  if (kokuoType === "八門剋應（門×三奇）" && key.human_gate && key.counterpart_type === "heaven_stem" && key.counterpart) {
    return `${key.human_gate} × 天盤${key.counterpart}`;
  }
  if (kokuoType === "三奇到宮剋應" && key.wonder_stem && key.palace) {
    return `${key.wonder_stem}奇 × ${key.palace}宮`;
  }
  if (kokuoType === "九星値時剋應" && key.value_star && key.hour_branch) {
    return `${key.value_star} × ${key.hour_branch}時`;
  }
  return undefined;
}

function source(label: string, raw: string): ConfirmedSourceText {
  const d = toDisplayText(raw);
  return { label, raw: d.raw, display: d.display };
}

function kokuoItem(k: GenerationKokuo): ConfirmedItem {
  const combination = kokuoCombination(k.kokuoType, k.key);
  return {
    id: k.id,
    kind: "kokuo",
    header: {
      type: k.kokuoType,
      name: k.name,
      fortune: k.fortuneRaw ?? NO_FORTUNE_LABEL,
      ...(k.mode ? { mode: k.mode } : {}),
      ...(combination ? { combination } : {}),
    },
    sourceText: [source("本文", k.body)],
  };
}

// ---- 格局 ---------------------------------------------------------------

const PUNCT_SPACE = /[、。\s]/g;

/** 格局の2つの象意をまとめられるか（A: 完全一致 / B: 句読点・空白だけの違い）。 */
export function kakuMeaningMatch(judgeMeaning: string, meaningDb: string[] | null): "exact" | "punctuation" | null {
  if (!meaningDb) return null;
  const joined = meaningDb.join("、");
  if (joined === judgeMeaning) return "exact";
  if (joined.replace(PUNCT_SPACE, "") === judgeMeaning.replace(PUNCT_SPACE, "")) return "punctuation";
  return null;
}

function kakuItem(k: GenerationKaku, kind: "palaceKaku" | "wholeChartKaku"): ConfirmedItem {
  const matchedBy = kakuMeaningMatch(k.judgeMeaning, k.meaningDb);
  const sourceText = matchedBy
    ? [source("象意", k.judgeMeaning)]
    : [
        source("象意（判定側）", k.judgeMeaning),
        ...(k.meaningDb ? [source("象意（意味DB側）", k.meaningDb.join("、"))] : []),
      ];
  return {
    id: k.id,
    kind,
    header: {
      type: k.category,
      name: k.name,
      category: k.category,
      scope: k.scope === "palace" ? "この宮" : "盤全体",
      ...(k.detail ? { detail: k.detail } : {}),
    },
    sourceText,
    kakuMeaning: {
      mode: matchedBy ? "merged" : "both",
      matchedBy,
      judgeMeaning: k.judgeMeaning,
      meaningDb: k.meaningDb,
    },
  };
}

// ---- 伏吟・反吟 -------------------------------------------------------------

function fuYinFanYinItem(p: PlanFuYinFanYinItem): ConfirmedItem {
  const f = p.item;
  return {
    id: f.id,
    kind: "fuYinFanYin",
    header: {
      type: `伏吟反吟の追加資料（${f.kind}）`,
      name: f.kind,
      judgeDetail: f.judgeDetail,
      ...(p.basis.linkedKaku ? { linkedKaku: p.basis.linkedKaku } : {}),
      ...(p.basis.reason ? { unclassifiedReason: p.basis.reason } : {}),
    },
    sourceText: [
      ...f.linkedSubtypes.map((s) => source(s.name, s.description.join("\n"))),
      source(f.fortuneHeading, f.fortuneText.join("\n")),
    ],
  };
}

function establishedItem(p: PlanEstablishedItem): ConfirmedItem {
  if (p.kind === "kokuo") return kokuoItem(p.item);
  if (p.kind === "fuYinFanYin") return fuYinFanYinItem(p);
  return kakuItem(p.item, p.kind);
}

// ---- 本体 ------------------------------------------------------------------

/** 文章構成（Generation Plan）から確定資料を作る。Plan は変更しない。 */
export function buildConfirmedMaterials(plan: QimenGenerationPlan): ConfirmedMaterials {
  return {
    schemaVersion: 1,
    palaceNumber: plan.palaceNumber,
    section1: {
      title: plan.section1.title,
      facts: plan.section1.facts.map((p) => ({ id: p.item.id, label: p.item.label, value: p.item.value })),
      singleMeanings: plan.section1.singleMeanings.map((p) => {
        const s = p.item;
        const { fortuneLabel, lines } = singleLines(s.kind, s.content);
        return { id: s.id, element: s.element, role: s.role, kind: s.kind, fortuneLabel, lines };
      }),
    },
    section2: { title: plan.section2.title, items: plan.section2.items.map(establishedItem) },
    section3: { title: plan.section3.title, items: plan.section3.items.map(establishedItem) },
    section4: { title: plan.section4.title, items: plan.section4.items.map(establishedItem) },
    unclassified: { title: UNCLASSIFIED_TITLE, items: plan.unclassified.map(fuYinFanYinItem) },
  };
}
