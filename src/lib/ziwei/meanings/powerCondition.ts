// src/lib/ziwei/meanings/powerCondition.ts
//
// 力量（運命指数）の条件が付いた象意文の判定。docs/ziwei-basic-spec.md §22.6。
// 入口: evaluatePowerCondition(entry, power)。power は buildPalaceMeaningContext() が作る PowerSnapshot。
//
// 方針:
//   - 文の条件は、資料の文言をそのまま引用した表（CONDITION_SPECS）で持つ。文から自動で推測しない。
//   - 判定に使う基準は資料に書かれたものだけ:
//       命宮の力量が強い … 運命指数の段階が「最強」か「強」（入門 N-ST-0021「命宮の力量が「最強」や「強」であれば」、
//                          入門 p.35／基礎編 S18「命宮、身宮が強か最強」）
//       命宮の力量が弱い … 段階が「弱」か「最弱」（入門 p.35／基礎編 S18「弱か最弱」）
//       星の力量が強い／弱い … 資料が数値を書いている星だけ（STAR_POWER_RULES）。それ以外の星は判定しない。
//   - 力量以外の条件（同宮・加会、配合、女性、子位の命宮など）は判定しない（other）。
//   - 三値で判定する: 成立（met）／不成立（notMet）／判定不能（undetermined）。
//     「かつ」は1つでも不成立なら不成立、「または」は1つでも成立なら成立。それ以外で判定不能が残れば判定不能。
//   - 1文の中に条件の違う記述が並ぶ文（「強ければ…、弱ければ…」）は判定不能（branching）。
//   - 大限・小限の「巡る宮の力量」は宮クリックの対象外（どの宮が巡るかを決めていない）ので判定不能。

import { STAR_MEANINGS, TRANSFORMATION_MEANINGS } from "./store";
import type { PowerGrade } from "../power";
import type { Branch } from "../types";

/** 宮の象意コンテキストに載せる力量の情報（context.ts が作る） */
export interface PowerSnapshot {
  mingPalace: { branch: Branch; index: number; grade: PowerGrade };
  /** 盤面の星（四化を除く）の力量。天馬・天姚・紅鸞は含めない */
  starPower: Record<string, { branch: Branch; power: number }>;
}

export type PowerTest = "strong" | "weak" | "notWeak";

export type ConditionTerm =
  | { kind: "palacePower"; palace: "命宮"; test: PowerTest; phrase: string }
  | { kind: "starPower"; star: string; test: "strong" | "weak"; phrase: string }
  | { kind: "other"; phrase: string };

export interface PowerConditionSpec {
  combine: "all" | "any";
  terms: ConditionTerm[];
  /** 1文に条件の異なる記述が並ぶ（判定不能） */
  branching?: string;
  /** 前の文を受ける語句（接続語の一覧にない指示語）。成立時は前の文を文脈として付ける */
  refersBack?: string;
}

export type ConditionResult = "met" | "notMet" | "undetermined";

export interface PowerConditionEvaluation {
  id: string;
  condition: string;
  result: ConditionResult;
  terms: { term: ConditionTerm; result: ConditionResult; detail: string }[];
  /** 判定の説明（UI・excluded・referenceOnly の理由） */
  reason: string;
  refersBack?: string;
}

/** 運命指数の段階の読み方（資料の文言） */
export const PALACE_POWER_RULES = {
  strong: { grades: ["最強", "強"] as PowerGrade[], source: "入門 N-ST-0021「「最強」や「強」」・入門 p.35／基礎編 S18「強か最強」" },
  weak: { grades: ["弱", "最弱"] as PowerGrade[], source: "入門 p.35／基礎編 S18「弱か最弱」" },
} as const;

/**
 * 星の力量の強弱の数値（資料が括弧書きで数値を書いている星だけ）。
 * 範囲は表13の値（その星の finalPower）で見る。書かれていない側（例: 武曲星の「強い」）は判定しない。
 */
export const STAR_POWER_RULES: Readonly<
  Record<string, Partial<Record<"strong" | "weak", { label: string; test: (v: number) => boolean; source: string }>>>
> = {
  武曲星: { weak: { label: "0", test: (v) => v === 0, source: "入門 p.45 N-ST-0180「武曲星の力量が弱ければ（力量数値０）」" } },
  巨門星: {
    strong: { label: "2〜4", test: (v) => v >= 2 && v <= 4, source: "入門 p.57 N-ST-0482「巨門星の力量が強ければ（４〜２）」" },
    weak: { label: "0以下", test: (v) => v <= 0, source: "入門 p.57 N-ST-0484「巨門星の力量が弱ければ（０かマイナス）」" },
  },
  天梁星: {
    strong: { label: "4〜6", test: (v) => v >= 4 && v <= 6, source: "入門 p.61 N-ST-0573「天梁星の力量が強ければ（４〜６）」" },
    weak: { label: "0", test: (v) => v === 0, source: "入門 p.61 N-ST-0574「天梁星の力量が低い（０）」" },
  },
  七殺星: {
    strong: { label: "2〜4", test: (v) => v >= 2 && v <= 4, source: "入門 p.63 N-ST-0625「七殺星の力量が強いと（２〜４）」" },
    weak: { label: "0以下", test: (v) => v <= 0, source: "入門 p.63 N-ST-0625「七殺星の力量が弱いと（０以下）」" },
  },
};

const P = (test: PowerTest, phrase: string): ConditionTerm => ({ kind: "palacePower", palace: "命宮", test, phrase });
const S = (star: string, test: "strong" | "weak", phrase: string): ConditionTerm => ({ kind: "starPower", star, test, phrase });
const O = (phrase: string): ConditionTerm => ({ kind: "other", phrase });
const all = (...terms: ConditionTerm[]): PowerConditionSpec => ({ combine: "all", terms });
const any = (...terms: ConditionTerm[]): PowerConditionSpec => ({ combine: "any", terms });
const branching = (why: string): PowerConditionSpec => ({ combine: "all", terms: [], branching: why });

/**
 * condition が「命宮の力量」の文の条件（資料の文言の引用）。
 * 「その他の星曜との配合」（category: combination）の文には、配合の条件（other）を自動で加える（specFor）。
 */
export const CONDITION_SPECS: Readonly<Record<string, PowerConditionSpec>> = {
  "N-ST-0021": all(P("strong", "命宮の力量が「最強」や「強」であれば")),
  "N-ST-0026": { ...all(P("weak", "命宮の力量が弱いと")), refersBack: "そうなった場合" },
  "N-ST-0037": all(P("weak", "命宮の力量が弱く"), O("特に陀羅星、羊星、天空星、地劫星と同宮加会すれば")),
  "N-ST-0043": all(O("この配合で"), P("weak", "命宮の力量が弱いと")),
  "N-ST-0049": all(O("紫微星だけが命宮にあり"), P("weak", "命宮の力量が弱いと")),
  "N-ST-0079": all(S("天機星", "strong", "天機星の力量が強い人の場合")),
  "N-ST-0126": all(S("太陽星", "weak", "太陽星の力量が弱い場合は")),
  "N-ST-0127": all(S("太陽星", "weak", "太陽星の力量が弱く"), P("weak", "命宮の力量が弱い時は")),
  "N-ST-0130": all(S("太陽星", "weak", "太陽星の力量が弱い場合は")),
  "N-ST-0174": { ...all(P("strong", "命宮の力量が強ければ強いほど")), refersBack: "その傾向" },
  "N-ST-0180": all(S("武曲星", "weak", "武曲星の力量が弱ければ（力量数値０）")),
  "N-ST-0191": all(S("武曲星", "weak", "武曲星の力量が弱い場合は")),
  "N-ST-0194": all(O("武曲星と天府星が同宮すれば（力量の強まりは同宮の結果として書かれている）")),
  "N-ST-0196": all(O("武曲星と貪狼星が同宮すれば（力量の強まりは同宮の結果として書かれている）")),
  "N-ST-0200": all(P("weak", "命宮の力量が弱いと")),
  "N-ST-0205": all(P("weak", "なおかつ命宮の力量が弱い場合")),
  "N-ST-0234": all(S("天同星", "strong", "天同星の力量が強いと")),
  "N-ST-0235": all(S("天同星", "weak", "力量が弱いと（天同星の節）")),
  "N-ST-0236": all(S("天同星", "weak", "力量が弱い人の中には（天同星の節）")),
  "N-ST-0240": all(O("天同星と巨門星が同宮すれば（力量の弱まりは同宮の結果として書かれている）")),
  "N-ST-0241": all(P("weak", "さらに命宮の力量が弱い場合")),
  "N-ST-0245": all(O("天同星と太陰星が同宮すれば・特に子位の命宮ですと")),
  "N-ST-0247": all(O("午位の命宮で"), P("weak", "命宮の力量は低いと")),
  "N-ST-0256": all(P("notWeak", "命宮の力量が弱くなければ")),
  "N-ST-0286": all(O("廉貞星と天府星が同宮すれば（力量の強まりは同宮の結果として書かれている）")),
  "N-ST-0287": all(P("strong", "なおかつ命宮の力量が強ければ")),
  "N-ST-0288": all(O("廉貞星と貪狼星が同宮すれば（力量の弱まりは同宮の結果として書かれている）")),
  "N-ST-0291": all(P("weak", "さらに命宮の力量が弱ければ")),
  "N-ST-0293": all(O("廉貞星と天相星が同宮すれば（力量の強まりは同宮の結果として書かれている）")),
  "N-ST-0296": all(O("廉貞星と七殺星が同宮すれば（力量の強まりは同宮の結果として書かれている）")),
  "N-ST-0298": all(O("廉貞星と破軍星が同宮すれば（力量の弱まりは同宮の結果として書かれている）")),
  "N-ST-0299": all(P("strong", "命宮の力量が強ければ")),
  "N-ST-0300": all(P("weak", "命宮の力量が弱ければ")),
  "N-ST-0325": all(P("strong", "命宮の力量が強く"), O("文昌星や文曲星が同宮していますと")),
  "N-ST-0340": all(O("文昌星・文曲星と同宮し"), P("strong", "命宮の力量が強いと")),
  "N-ST-0348": all(P("strong", "しかし命宮の力量が強ければ")),
  "N-ST-0349": all(O("天府星が天空星・地劫星が同宮・加会すれば"), P("notWeak", "命宮の力量が弱くなければ")),
  "N-ST-0374": any(S("太陰星", "weak", "太陰星の力量が弱かったり"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0376": all(S("太陰星", "weak", "太陰星の力量が弱い人は")),
  "N-ST-0416": all(S("貪狼星", "weak", "貪狼星の力量が弱い人は")),
  "N-ST-0424": all(S("貪狼星", "weak", "貪狼星の力量が弱く"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0431": all(S("貪狼星", "strong", "貪狼星の力量が強ければ")),
  "N-ST-0432": all(S("貪狼星", "weak", "貪狼星の力量が弱ければ")),
  "N-ST-0474": any(S("巨門星", "weak", "巨門星の力量が弱いか"), P("weak", "命宮の力量が弱いと")),
  "N-ST-0482": all(S("巨門星", "strong", "巨門星の力量が強ければ（４〜２）")),
  "N-ST-0484": all(S("巨門星", "weak", "巨門星の力量が弱ければ（０かマイナス）")),
  "N-ST-0494": all(O("巨門星と化禄星・化科星・科権星が同宮・加会し"), S("巨門星", "strong", "巨門星の力量が強ければ")),
  "N-ST-0495": all(O("巨門星が火星・鈴星と同宮し"), S("巨門星", "weak", "巨門星の力量が弱いと")),
  "N-ST-0536": all(S("天相星", "strong", "天相星の力量が強く"), P("strong", "命宮の力量が強ければ")),
  "N-ST-0540": all(P("strong", "命宮の力量が強ければ")),
  "N-ST-0541": all(O("天相星と化禄星・化科星・科権星が同宮・加会し"), S("天相星", "strong", "天相星の力量が強ければ")),
  "N-ST-0543": all(P("weak", "また命宮の力量が弱ければ")),
  "N-ST-0573": all(S("天梁星", "strong", "天梁星の力量が強ければ（４〜６）")),
  "N-ST-0574": all(S("天梁星", "weak", "天梁星の力量が低い（０）と")),
  "N-ST-0580": all(O("天梁星と禄存星が同宮すれば"), P("strong", "命宮の力量が強ければ")),
  "N-ST-0621": all(S("七殺星", "strong", "七殺星の力量が強く"), P("strong", "命宮の力量が強ければ")),
  "N-ST-0625": branching("「七殺星の力量が強いと（２〜４）…、七殺星の力量が弱いと（０以下）…」を1文で述べている"),
  "N-ST-0632": all(P("strong", "また命宮の力量が強ければ")),
  "N-ST-0677": all(P("weak", "しかし、命宮の力量が弱ければ")),
  "N-ST-0679": all(P("strong", "命宮の力量が強ければ")),
  "N-ST-0684": all(P("strong", "しかし命宮の力量が強ければ")),
  "N-ST-0685": all(S("破軍星", "weak", "破軍星の力量が弱く"), P("weak", "命宮の力量が弱いと")),
  "N-ST-0686": all(O("破軍星が天空星・地劫星が同宮・加会すれば"), P("notWeak", "命宮の力量が弱くなければ")),
  "N-ST-0687": all(S("破軍星", "weak", "破軍星の力量が弱く"), P("weak", "命宮の力量が弱いと")),
  "N-ST-0712": all(O("文昌星・文曲星が羊星・陀羅星・火星・鈴星などと同宮・加会して"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0727": all(P("weak", "ただし命宮の力量が弱ければ")),
  "N-ST-0732": branching("「命宮の力量が強ければ…」と「…同宮・加会して、命宮の力量が弱ければ…」を1文で述べている"),
  "N-ST-0740": all(P("strong", "命宮の力量が強ければ")),
  "N-ST-0774": all(O("禄存星が天空星・地劫星・火星・鈴星などと同宮・加会し"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0785": branching("「命宮の力量が強ければ…が、命宮の力量が弱ければ…」を1文で述べている"),
  "N-ST-0788": all(S("擎羊星・陀羅星", "weak", "羊星・陀羅星の力量が弱ければ")),
  "N-ST-0792": all(O("敬羊星・陀羅星が貪狼星と同宮し"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0803": all(O("女性の命宮に火星・鈴星が入り、左輔星・右弼星が同宮して"), P("strong", "命宮の力量が強ければ")),
  "N-ST-0810": all(O("火星・鈴星が敬羊星や陀羅星、廉貞星、破軍星、七殺星などと同宮・加会し"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0826": all(O("天空星・地劫星が火星・鈴星・敬羊星・陀羅星などと同宮・加会し"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0864": branching("「吉星と同宮・加会し、命宮の力量が強ければ…、凶星と同宮・加会し、命宮の力量が弱ければ…」を1文で述べている"),
  "N-ST-0840": all(O("化禄星が凶星と同宮・加会し"), P("weak", "命宮の力量が弱ければ")),
  "N-ST-0854": all(S("化忌星がつく星曜", "strong", "化忌星がつく星曜の力量が強く"), P("strong", "命宮の力量が強ければ")),
};

const COMBINATION_TERM: ConditionTerm = O("「その他の星曜との配合」の文（配合の成立を判定していない）");
const CATEGORY_BY_ID = new Map<string, string | undefined>(
  [...STAR_MEANINGS, ...TRANSFORMATION_MEANINGS].map((e) => [e.id, (e as { category?: string }).category]),
);

/** 文の条件の表（配合の文には配合の条件を加える）。登録がなければ null */
export function specFor(id: string): PowerConditionSpec | null {
  const spec = CONDITION_SPECS[id];
  if (!spec) return null;
  if (CATEGORY_BY_ID.get(id) === "combination" && spec.combine === "all" && !spec.branching) {
    return { ...spec, terms: [...spec.terms, COMBINATION_TERM] };
  }
  return spec;
}

const TEST_LABEL: Record<PowerTest, string> = { strong: "強い", weak: "弱い", notWeak: "弱くない" };

function evalTerm(t: ConditionTerm, power: PowerSnapshot): { result: ConditionResult; detail: string } {
  if (t.kind === "other") return { result: "undetermined", detail: `力量以外の条件（${t.phrase}）は判定しない` };
  if (t.kind === "palacePower") {
    const { grade, index } = power.mingPalace;
    const isStrong = (PALACE_POWER_RULES.strong.grades as string[]).includes(grade);
    const isWeak = (PALACE_POWER_RULES.weak.grades as string[]).includes(grade);
    const ok = t.test === "strong" ? isStrong : t.test === "weak" ? isWeak : !isWeak;
    return {
      result: ok ? "met" : "notMet",
      detail: `命宮の運命指数 ${index.toFixed(1)}（${grade}）→「${TEST_LABEL[t.test]}」は${ok ? "成立" : "不成立"}`,
    };
  }
  const rule = STAR_POWER_RULES[t.star]?.[t.test];
  if (!rule) return { result: "undetermined", detail: `${t.star}の力量が「${TEST_LABEL[t.test]}」の数値は資料にない` };
  const sp = power.starPower[t.star];
  if (!sp) return { result: "undetermined", detail: `${t.star}が盤面にない` };
  const ok = rule.test(sp.power);
  return {
    result: ok ? "met" : "notMet",
    detail: `${t.star}（${sp.branch}）の力量 ${sp.power} →「${TEST_LABEL[t.test]}（${rule.label}）」は${ok ? "成立" : "不成立"}`,
  };
}

/** 条件付きの文の判定。condition のない文は null */
export function evaluatePowerCondition(
  entry: { id: string; condition?: string },
  power: PowerSnapshot | undefined,
): PowerConditionEvaluation | null {
  if (!entry.condition) return null;
  const base = { id: entry.id, condition: entry.condition };
  if (entry.condition === "巡る宮の力量") {
    return { ...base, result: "undetermined", terms: [], reason: "巡る宮（大限・小限）の力量は、宮クリックではどの宮が巡るかを決めていないため判定しない" };
  }
  const spec = specFor(entry.id);
  if (!spec) return { ...base, result: "undetermined", terms: [], reason: "条件の読み方が未登録" };
  if (spec.branching) return { ...base, result: "undetermined", terms: [], reason: `1文に条件の異なる記述が並ぶため判定しない（${spec.branching}）` };
  if (!power) return { ...base, result: "undetermined", terms: [], reason: "力量を計算していない" };

  const terms = spec.terms.map((term) => ({ term, ...evalTerm(term, power) }));
  const rs = terms.map((t) => t.result);
  let result: ConditionResult;
  if (spec.combine === "all") result = rs.includes("notMet") ? "notMet" : rs.every((r) => r === "met") ? "met" : "undetermined";
  else result = rs.includes("met") ? "met" : rs.every((r) => r === "notMet") ? "notMet" : "undetermined";
  const label = result === "met" ? "条件成立" : result === "notMet" ? "条件不成立" : "条件未判定";
  const joiner = spec.combine === "all" ? "かつ" : "または";
  return {
    ...base,
    result,
    terms,
    reason: `${label}（${joiner}）: ${terms.map((t) => t.detail).join("／")}`,
    ...(spec.refersBack ? { refersBack: spec.refersBack } : {}),
  };
}
