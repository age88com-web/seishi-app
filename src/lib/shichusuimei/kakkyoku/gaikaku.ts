// src/lib/shichusuimei/kakkyoku/gaikaku.ts
//
// 外格・特殊格局の候補（§14・§15）と内格への分岐。
//   外格の成立は自動で出さない。候補（candidate / needs_review）まで。
//   特殊格局の条件は月柱・日柱・時柱を中心に見る。年柱にだけ異質な五行があっても候補を落とさず注記する（KD9）。
//   時柱なしは参考判定（KD11）: candidate → provisional。

import { STEM_ELEMENT } from "../data";
import { goshinOfElement } from "../tsuhensei";
import type { Element, GoshinName, Pillar } from "../types";
import type { CandidateStatus, KakkyokuCandidate, NatalHehua, Pillars, Route, StrengthAssessment } from "./types";
import { BRANCH_ELEMENT, completeSango, completeSankai, controls, generates, surfaceElements } from "./common";
import { zokanOf } from "../zokan";

const IKKOU_NAME: Record<Element, string> = {
  木: "曲直格",
  火: "炎上格",
  土: "稼穡格",
  金: "従革格",
  水: "潤下格",
};

const JU_SUB: { goshin: GoshinName; name: string }[] = [
  { goshin: "財", name: "従財格" },
  { goshin: "官", name: "従殺格" },
  { goshin: "食傷", name: "従児格" },
];

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function assessGaikaku(
  p: Pillars,
  strength: StrengthAssessment,
  hehua: NatalHehua[],
  referenceOnly: boolean,
): { candidates: KakkyokuCandidate[]; route: Route } {
  const dayStem = p.日.stem;
  const dayEl = STEM_ELEMENT[dayStem];
  const goshin = (e: Element) => goshinOfElement(dayStem, e);
  const center: Pillar[] = [p.月, p.日, ...(p.時 ? [p.時] : [])];
  const all: Pillar[] = [...center, p.年];
  const centerEls = surfaceElements(center);
  const yearEls = surfaceElements([p.年]);
  const countAll = (g: GoshinName) => surfaceElements(all).filter((e) => goshin(e) === g).length;
  const classes = strength.classificationCandidates;
  const soft = (s: CandidateStatus): CandidateStatus =>
    referenceOnly && (s === "candidate" || s === "confirmed_by_engine") ? "provisional" : s;
  const yearNote = (pred: (e: Element) => boolean) =>
    uniq(yearEls.filter(pred)).map((e) => `年柱の${e}は弱い反対要素`);

  const out: KakkyokuCandidate[] = [];
  const add = (
    name: string,
    status: CandidateStatus,
    basis: string[],
    notes: string[] = [],
    subName: string | null = null,
    uiVisible = true,
  ) => out.push({ name, subName, status: soft(status), basis, notes, uiVisible: uiVisible && status !== "not_applicable" });
  let gaikaku = false;
  const fmt = (h: NatalHehua) => `${h.stems!.join("")}合→${h.transformElement}`;

  // 内格の候補（強弱の類型から。§10）
  // 身強・身弱は格局ではない（内格の強弱）。三得由来の候補として内部に保持し、格局候補欄には出さない（KD20）
  if (classes.some((c) => c === "過強" || c === "中強" || c === "境界")) {
    add("身強", "candidate", [`三得：${classes.join("・")}`], [], null, false);
  }
  if (classes.some((c) => c === "中弱" || c === "弱（得地のみ）" || c === "過弱" || c === "境界")) {
    const onlyChuujaku30 = classes.every((c) => c === "中弱");
    add("身弱", onlyChuujaku30 ? "needs_review" : "candidate", [`三得：${classes.join("・")}`], [], null, false);
  }

  // 従旺格（引き金①過強・④食傷財官なし）
  const juouBasis: string[] = [];
  if (classes.includes("過強")) juouBasis.push("強弱：過強を含む");
  const noWeakening = !centerEls.some((e) => ["食傷", "財", "官"].includes(goshin(e)));
  if (noWeakening) juouBasis.push("月・日・時柱に食傷・財・官なし");
  if (juouBasis.length) {
    gaikaku = true;
    add("従旺格", "candidate", juouBasis, noWeakening ? yearNote((e) => ["食傷", "財", "官"].includes(goshin(e))) : []);

    // 一行得気格
    const branches = all.map((x) => x.branch);
    const ikkouBasis: string[] = [];
    for (const g of completeSango(branches)) if (g.element === dayEl) ikkouBasis.push(`三合（${g.kyoku}）`);
    for (const g of completeSankai(branches)) if (g.element === dayEl) ikkouBasis.push(`三会（${g.group.join("")}）`);
    const onlyDayEl = centerEls.every((e) => e === dayEl);
    if (onlyDayEl) ikkouBasis.push(`月・日・時柱が${dayEl}のみ`);
    if (ikkouBasis.length) {
      const notes = onlyDayEl ? yearNote((e) => e !== dayEl) : [];
      if (dayEl === "金") notes.push("原文表記は縦（従）革格");
      add("一行得気格", "candidate", ikkouBasis, notes, IKKOU_NAME[dayEl]);
    }
  }

  // 従強格（過強かつ印が比劫より多い）
  if (classes.includes("過強")) {
    const inN = countAll("印");
    const hiN = surfaceElements(all).filter((e) => goshin(e) === "比劫").length - 1; // 日干自身を除く
    if (inN > hiN) add("従強格", "needs_review", [`過強・印${inN}＞比劫${hiN}（日干除く）`]);
  }

  // 従格（引き金②過弱、③印なし）。得地のみ（20%）は弱側で、従格の引き金にしない（KD15）
  const juBasis: string[] = [];
  const weakCls = classes.filter((c) => c === "過弱");
  if (weakCls.length) juBasis.push(`強弱：${weakCls.join("・")}を含む`);
  const noIn = !centerEls.some((e) => goshin(e) === "印");
  if (noIn) juBasis.push("月・日・時柱に印なし");
  // 一次除外（KD18）: 月・日・時支の本気が日主と同じ五行（明確な根）なら従格候補にしない
  const clearRoots = [p.月, p.日, ...(p.時 ? [p.時] : [])]
    .map((x, i) => ({ key: ["月", "日", "時"][i], branch: x.branch }))
    .filter((x) => BRANCH_ELEMENT[x.branch] === dayEl);
  if (juBasis.length && clearRoots.length) {
    add("従格", "not_applicable", [...juBasis, `日主に明確な根（${clearRoots.map((r) => `${r.key}支${r.branch}`).join("・")}）のため除外`], [], null, false);
  } else if (juBasis.length) {
    gaikaku = true;
    const notes = noIn ? yearNote((e) => goshin(e) === "印") : [];
    if (BRANCH_ELEMENT[p.年.branch] === dayEl) notes.push(`年支${p.年.branch}に根（弱い反対要素）`);
    const zokanIn = all.some((x) => zokanOf(x.branch).stems.some((s) => goshin(STEM_ELEMENT[s]) === "印"));
    if (zokanIn) notes.push("蔵干に印あり（流派により従格不成立とする説。共通条件にはしない）");
    add("従格", "candidate", juBasis, notes);
    for (const { goshin: g, name } of JU_SUB) add(name, "needs_review", [`${g} ${countAll(g)}`]);
  }

  // 両神成象格（月・日・時柱の五行が2種類）
  const kinds = uniq(centerEls);
  if (kinds.length === 2) {
    gaikaku = true;
    const [a, b] = kinds;
    const sub = generates(a, b) || generates(b, a) ? "両神相生格" : controls(a, b) || controls(b, a) ? "両神相成格" : null;
    add("両神成象格", "needs_review", [`月・日・時柱が${a}・${b}のみ`], yearNote((e) => !kinds.includes(e)), sub);
  }

  // 化格（KD23）: 月支条件を満たした干合だけ候補。他の格局の判定は止めない（KD22）
  const kaka = hehua.filter((h) => h.stemCombination === "hehuaCandidate" || h.stemCombination === "hehuaCandidateSupported");
  if (kaka.length) {
    gaikaku = true;
    add(
      "化格",
      "candidate",
      kaka.map((h) => `${fmt(h)}：月支${h.monthBranch}（月支条件成立）`),
      kaka.flatMap((h) => [
        h.supports.length ? `補強：${h.supports.join("／")}` : "補強：なし",
        ...h.references.map((x) => `参考：${x}`),
        h.monthRelations.length ? `月支関係：${h.monthRelations.join("・")}（要術者判断）` : "月支関係：なし",
      ]),
    );
  } else {
    const hequ = hehua.filter((h) => h.stemCombination === "hequ");
    add("化格", "not_applicable", hequ.length ? hequ.map((h) => `${fmt(h)}：月支${h.monthBranch}は月支条件外 → 合去`) : ["日干と月干・時干の干合なし"]);
  }

  // 月刃格: 修正済みテキストに命例（ベッカム）はあるが、一般の成立条件の記載はない → 一般判定は要確認
  // 画面には出さない（成立条件がなく、命式ごとの成立可能性を示せないため）
  add("月刃格", "needs_review", ["成立条件は資料になし（術者判断）"], [], null, false);
  // 建禄格: 資料に条件なし
  add("建禄格", "not_applicable", ["資料に条件なし"]);

  return { candidates: out, route: gaikaku ? "gaikakuCandidate" : "naikaku" };
}
