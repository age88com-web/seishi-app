// src/lib/ziwei/fortune/patterns.ts
//
// 行運の格局（基礎２の大限の例で行運への適用が書かれている3格だけ）。docs/ziwei-basic-spec.md §27.6。
// 本命の格局（patterns/）とは別の層。本命の星配置は固定し、四化は 生年＋その行運 の層を重ねて（統合せずに）見る。
//   羊陀夾忌（K2-32）: 禄存の宮に化忌（生年・行運のどちらの層でも）。S38 丙寅は生年化忌（太陽）、S39 は大限化忌で成立。
//                     対宮は affectedPalaces（影響範囲。成立判定はしない。§23.5 確定8）。
//   刑忌夾印（K2-33）: 巨門の宮に化忌（生年・行運のどちらの層でも）があるとき、天相の宮で成立。宮名は行運十二宮で読む
//                     （S38 丙寅「父母宮は刑忌夾印」＝天相が大限父母宮、丁卯「天相星が刑忌夾印の敗局」＝天相が大限命宮）。
//   三奇嘉會（K2-19）: 行運の命宮（大限宮・小限宮）＋その三方四正に化禄・化権・化科（生年・行運の層）が揃う。化忌が同宮しても成格。
//                     基準宮の力量が弱・最弱、三方四正に煞星（入門の凶星）は warningCondition（「破格しやすい」。破格にしない）。
// 小限: 基礎２に小限での適用例・同じ判定法で使うという記述がないため、同じ判定を行うが sourceStatus は needs_review（断定しない）。

import { viewOf } from "../patterns/chartView";
import { PATTERN_SOURCE_TEXT } from "../patterns/evaluate";
import { resolvePatternMeaning } from "../patterns/meanings";
import type { ResolvedPatternMeaning } from "../patterns/meanings";
import type { WarningCheck } from "../patterns/types";
import type { Branch, PalaceName, TransformationKind, ZiweiChart } from "../types";
import { fortunePalaceMap, fortunePalaceNameOf } from "./palaceMap";
import type { FortunePalaceEntry } from "./palaceMap";
import type { LayeredTransformation, LimitTransformations } from "./types";

export interface FortunePalaceRef {
  branch: Branch;
  natalPalace: PalaceName;
  fortunePalace: PalaceName;
}

export interface FortunePatternResult {
  id: "K2-32" | "K2-33" | "K2-19";
  name: string;
  origin: "major" | "minor";
  /** 対象の行運（大限の干支・年齢範囲、小限の数え年） */
  limit: { branch: Branch; stem: string; ageRange: [number, number] | null; age: number | null };
  conditionMatched: boolean;
  status: "confirmed" | "not_applicable" | "needs_review";
  sourceStatus: "verified" | "needs_review";
  matchedPalaces: FortunePalaceRef[];
  affectedPalaces: (FortunePalaceRef & { note: string })[];
  /** 成立に使った四化（層＝origin のまま） */
  transformationsUsed: LayeredTransformation[];
  reasons: string[];
  warningConditions: WarningCheck[];
  /** 表示する象意。行運専用の記述（scope major）と、本命・行運共通の記述（scope any）だけ。本命専用（「生涯」など）は使わない（§36） */
  meanings: string[];
  meaning: ResolvedPatternMeaning;
  /**
   * 成立の由来（解釈の区別用）。生年の層だけで成立するか・行運の層だけで成立するかで分ける:
   *   natal_only … 生年の四化だけで成立（本命の条件が行運の宮配置で見えているだけ）
   *   major_only／minor_only … 行運の四化だけで成立（行運で新たに生じた）
   *   each_alone … 生年だけでも行運だけでも成立
   *   natal_plus_major／natal_plus_minor … どちらか一方では成立せず、重なって初めて成立
   * 不成立は null
   */
  formationBasis: { kind: FormationBasis; natalAlone: boolean; limitAlone: boolean } | null;
}

export type FormationBasis = "natal_only" | "major_only" | "minor_only" | "each_alone" | "natal_plus_major" | "natal_plus_minor";

const short = (s: string) => s.replace(/星$/, "");
const ORIGIN_LABEL = { natal: "生年", major: "大限", minor: "小限" } as const;
const tlist = (ts: LayeredTransformation[]) => ts.map((t) => `${ORIGIN_LABEL[t.origin]}${short(t.kind)}（${short(t.star)}）`).join("・");

/** 生年＋行運の層で判定し、生年だけ・行運だけでも判定して成立の由来（formationBasis）を付ける */
export function evaluateFortunePatterns(
  chart: ZiweiChart,
  natal: LayeredTransformation[],
  limit: LimitTransformations,
): FortunePatternResult[] {
  const combined = evaluateWithLayers(chart, limit, [...natal, ...limit.transformations]);
  const natalOnly = evaluateWithLayers(chart, limit, natal);
  const limitOnly = evaluateWithLayers(chart, limit, limit.transformations);
  return combined.map((r, i) => {
    if (!r.conditionMatched) return r;
    const natalAlone = natalOnly[i].conditionMatched;
    const limitAlone = limitOnly[i].conditionMatched;
    const kind: FormationBasis =
      natalAlone && limitAlone
        ? "each_alone"
        : natalAlone
          ? "natal_only"
          : limitAlone
            ? (`${limit.limitType}_only` as FormationBasis)
            : (`natal_plus_${limit.limitType}` as FormationBasis);
    return { ...r, formationBasis: { kind, natalAlone, limitAlone } };
  });
}

function evaluateWithLayers(chart: ZiweiChart, limit: LimitTransformations, layers: LayeredTransformation[]): FortunePatternResult[] {
  const v = viewOf(chart);
  const map: FortunePalaceEntry[] = fortunePalaceMap(chart, limit.palaceBranch);
  const ref = (b: Branch): FortunePalaceRef => ({ branch: b, natalPalace: v.palaceAt(b).name, fortunePalace: fortunePalaceNameOf(map, b) });
  const at = (b: Branch, kind?: TransformationKind) => layers.filter((t) => t.branch === b && (!kind || t.kind === kind));
  const origin = limit.limitType;
  const sourceStatus = origin === "major" ? "verified" : "needs_review";
  const limitLabel = origin === "major" ? `大限 ${limit.palaceStem}${limit.palaceBranch}` : `小限 ${limit.palaceStem}${limit.palaceBranch}`;
  const base = (id: FortunePatternResult["id"]) => {
    const src = PATTERN_SOURCE_TEXT.find((s) => s.id === id)!;
    return {
      id,
      name: src.canonicalName,
      origin,
      limit: { branch: limit.palaceBranch, stem: limit.palaceStem, ageRange: limit.ageRange, age: limit.age },
      sourceStatus,
      meanings: [] as string[],
      meaning: { meaningStatus: "ok", base: [], conditional: [], pending: [] } as ResolvedPatternMeaning,
      formationBasis: null,
    } as const;
  };
  const statusOf = (matched: boolean): FortunePatternResult["status"] => (!matched ? "not_applicable" : sourceStatus === "verified" ? "confirmed" : "needs_review");

  // 羊陀夾忌
  const lucun = v.posOf("禄存星");
  const jiAtLucun = at(lucun, "化忌星");
  const ytj: FortunePatternResult = {
    ...base("K2-32"),
    conditionMatched: jiAtLucun.length > 0,
    status: statusOf(jiAtLucun.length > 0),
    matchedPalaces: jiAtLucun.length ? [ref(lucun)] : [],
    affectedPalaces: jiAtLucun.length ? [{ ...ref(v.opposite(lucun)), note: "対宮もこの格の影響を受ける" }] : [],
    transformationsUsed: jiAtLucun,
    reasons: jiAtLucun.length ? [`禄存の宮 ${ref(lucun).natalPalace}（${lucun}・${limitLabel}の${ref(lucun).fortunePalace}）に化忌: ${tlist(jiAtLucun)}`] : [],
    warningConditions: [],
  };

  // 刑忌夾印
  const ju = v.posOf("巨門星");
  const xiang = v.posOf("天相星");
  const jiAtJu = at(ju, "化忌星");
  const xjjy: FortunePatternResult = {
    ...base("K2-33"),
    conditionMatched: jiAtJu.length > 0,
    status: statusOf(jiAtJu.length > 0),
    matchedPalaces: jiAtJu.length ? [ref(xiang)] : [],
    affectedPalaces: [],
    transformationsUsed: jiAtJu,
    reasons: jiAtJu.length
      ? [`天相の宮 ${ref(xiang).natalPalace}（${xiang}・${limitLabel}の${ref(xiang).fortunePalace}）を、巨門の宮（${ju}）の化忌が夾む: ${tlist(jiAtJu)}`]
      : [],
    warningConditions: [],
  };

  // 三奇嘉會
  const mingB = limit.palaceBranch;
  const area = [mingB, ...v.sanfangSizheng(mingB)];
  const three: TransformationKind[] = ["化禄星", "化権星", "化科星"];
  const found = three.map((k) => ({ k, ts: layers.filter((t) => t.kind === k && area.includes(t.branch)) }));
  const sqOk = found.every((f) => f.ts.length > 0);
  const warnings: WarningCheck[] = [];
  if (sqOk) {
    const g = v.gradeOf(mingB);
    const sat = v.maleficIn(v.sanfangSizheng(mingB));
    warnings.push(
      { text: "基準の宮の力量が弱いと格が崩れやすい", result: g === "弱" || g === "最弱" ? "applies" : "clear", detail: `${limitLabel}の命宮（${mingB}）の運命指数 ${v.power.byBranch[mingB].index.toFixed(1)}（${g}）` },
      {
        text: "煞星が加会すると格が崩れやすい",
        result: sat.length > 0 ? "applies" : "clear",
        detail: sat.length > 0 ? `加会する煞星: ${sat.map((x) => `${short(x.star)}（${x.branch}）`).join("・")}` : "加会する煞星なし",
      },
    );
  }
  const sq: FortunePatternResult = {
    ...base("K2-19"),
    conditionMatched: sqOk,
    status: statusOf(sqOk),
    matchedPalaces: sqOk ? [ref(mingB)] : [],
    affectedPalaces: [],
    transformationsUsed: found.flatMap((f) => f.ts),
    reasons: sqOk ? [`${limitLabel}の命宮（${mingB}）とその三方四正（${area.join("・")}）に ${found.map((f) => tlist(f.ts)).join("／")}`] : [],
    warningConditions: warnings,
  };
  // 象意（成立したものだけ。大限は scope major・any、小限は any だけ）
  return [ytj, xjjy, sq].map((r) => {
    if (!r.conditionMatched) return r;
    const meaning = resolvePatternMeaning(r.id, v, r.matchedPalaces.map((m) => m.branch), origin, {
      natalPalaces: [...r.matchedPalaces, ...r.affectedPalaces].map((m) => m.natalPalace),
      fortunePalaces: r.matchedPalaces.map((m) => m.fortunePalace),
    });
    return { ...r, meaning, meanings: [...meaning.base, ...meaning.conditional] };
  });
}
