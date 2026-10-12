// src/lib/qimenAiMaterials/generationPlan.ts
//
// 役割:
//   文章生成用ビュー（QimenGenerationView）の各材料を、文章の4区分のどこに置くかを
//   プログラム側で確定する。文章生成 AI には振り分けをさせない。
//   ビューは変更せず、本文の要約・短縮・言い換え・連結・別資料との統合をしない。
//
// 4区分と振り分け規則:
//   section1 この宮にある要素
//     chartFacts のうち label が 宮番号・八卦・天盤干・地盤干・九星・八門・八神 のもの、
//     singleMeanings の全件
//   section2 成立している吉方向の材料
//     palaceKaku / wholeChartKaku のうち category が「吉格」、
//     kokuo のうち classifyKokuoFortune(fortuneRaw) が favorable、
//     fuYinFanYin のうち対応格局（下記）が「吉格」
//   section3 成立している注意材料
//     palaceKaku / wholeChartKaku のうち category が「凶格」、
//     kokuo のうち classifyKokuoFortune(fortuneRaw) が caution、
//     fuYinFanYin のうち対応格局が「凶格」
//   section4 吉凶表記のない、または吉凶が混在する成立材料
//     kokuo のうち classifyKokuoFortune(fortuneRaw) が unclassified
//   unclassified（区分に置かない）
//     fuYinFanYin のうち対応格局を一意に決められないもの
//
// fuYinFanYin の対応格局:
//   judgeName と name が完全一致する palaceKaku / wholeChartKaku がちょうど1件あるときだけ、
//   その category を継承する。0件・複数件のときは推測せず unclassified に置く。
//   fuYinFanYin の本文（fortuneText）は読まない。
//
// 項目の持ち方:
//   各項目はビューの元の項目オブジェクトをそのまま item に持つ（ID と本文を別々の配列から
//   組み合わせない）。viewPath はビュー内の位置（例: kokuo[4]）。

import { classifyKokuoFortune } from "./fortuneClass";
import type { KokuoFortuneClass } from "./fortuneClass";
import type {
  GenerationFact,
  GenerationFuYinFanYin,
  GenerationKaku,
  GenerationKokuo,
  GenerationSingleMeaning,
  QimenGenerationView,
} from "./generationView";

/** section1 に入れる chartFacts の label（serialize.ts の chartFacts の label と一致させる）。 */
export const SECTION1_FACT_LABELS = ["宮番号", "八卦", "天盤干", "地盤干", "九星", "八門", "八神"] as const;

export const PLAN_SECTION_TITLES = {
  section1: "この宮にある要素",
  section2: "成立している吉方向の材料",
  section3: "成立している注意材料",
  section4: "吉凶表記のない、または吉凶が混在する成立材料",
} as const;

export interface PlanFactItem {
  kind: "chartFact";
  viewPath: string;
  item: GenerationFact;
}
export interface PlanSingleMeaningItem {
  kind: "singleMeaning";
  viewPath: string;
  item: GenerationSingleMeaning;
}
export interface PlanKokuoItem {
  kind: "kokuo";
  viewPath: string;
  item: GenerationKokuo;
  /** 振り分けの根拠（fortuneRaw と共通規則の結果） */
  basis: { rule: "classifyKokuoFortune"; fortuneRaw: string | null; result: KokuoFortuneClass };
}
export interface PlanKakuItem {
  kind: "palaceKaku" | "wholeChartKaku";
  viewPath: string;
  item: GenerationKaku;
  basis: { rule: "category"; category: "吉格" | "凶格" };
}
export interface PlanFuYinFanYinItem {
  kind: "fuYinFanYin";
  viewPath: string;
  item: GenerationFuYinFanYin;
  /**
   * 振り分けの根拠。judgeName と同名の成立済み格局が一意なら、その ID・category を継承する。
   * 一意でなければ linkedKaku は null、reason に理由。
   */
  basis: {
    rule: "linkedKakuCategory";
    judgeName: string;
    candidateIds: string[];
    linkedKaku: { id: string; name: string; category: "吉格" | "凶格" } | null;
    reason: string | null;
  };
}

export type PlanEstablishedItem = PlanKokuoItem | PlanKakuItem | PlanFuYinFanYinItem;

export interface QimenGenerationPlan {
  schemaVersion: 1;
  palaceNumber: number;
  section1: { title: string; facts: PlanFactItem[]; singleMeanings: PlanSingleMeaningItem[] };
  section2: { title: string; items: PlanEstablishedItem[] };
  section3: { title: string; items: PlanEstablishedItem[] };
  section4: { title: string; items: PlanEstablishedItem[] };
  /** 対応格局を一意に決められなかった fuYinFanYin（区分に置かない） */
  unclassified: PlanFuYinFanYinItem[];
}

/** 文章生成用ビューから文章構成（Generation Plan）を作る。ビューは変更しない。 */
export function buildQimenGenerationPlan(view: QimenGenerationView): QimenGenerationPlan {
  const section2: PlanEstablishedItem[] = [];
  const section3: PlanEstablishedItem[] = [];
  const section4: PlanEstablishedItem[] = [];
  const unclassified: PlanFuYinFanYinItem[] = [];

  const facts: PlanFactItem[] = [];
  view.chartFacts.forEach((f, i) => {
    if ((SECTION1_FACT_LABELS as readonly string[]).includes(f.label)) {
      facts.push({ kind: "chartFact", viewPath: `chartFacts[${i}]`, item: f });
    }
  });
  const singleMeanings: PlanSingleMeaningItem[] = view.singleMeanings.map((s, i) => ({
    kind: "singleMeaning",
    viewPath: `singleMeanings[${i}]`,
    item: s,
  }));

  // 格局（palace → whole_chart の順）
  const kakuLists = [
    ["palaceKaku", view.palaceKaku],
    ["wholeChartKaku", view.wholeChartKaku],
  ] as const;
  for (const [kind, list] of kakuLists) {
    list.forEach((k, i) => {
      const p: PlanKakuItem = { kind, viewPath: `${kind}[${i}]`, item: k, basis: { rule: "category", category: k.category } };
      (k.category === "吉格" ? section2 : section3).push(p);
    });
  }

  // 剋應
  view.kokuo.forEach((k, i) => {
    const result = classifyKokuoFortune(k.fortuneRaw);
    const p: PlanKokuoItem = {
      kind: "kokuo",
      viewPath: `kokuo[${i}]`,
      item: k,
      basis: { rule: "classifyKokuoFortune", fortuneRaw: k.fortuneRaw, result },
    };
    (result === "favorable" ? section2 : result === "caution" ? section3 : section4).push(p);
  });

  // 伏吟・反吟（対応格局の category を継承）
  const allKaku: { id: string; name: string; category: "吉格" | "凶格" }[] = [...view.palaceKaku, ...view.wholeChartKaku];
  view.fuYinFanYin.forEach((f, i) => {
    const candidates = allKaku.filter((k) => k.name === f.judgeName);
    const linked = candidates.length === 1 ? candidates[0] : null;
    const p: PlanFuYinFanYinItem = {
      kind: "fuYinFanYin",
      viewPath: `fuYinFanYin[${i}]`,
      item: f,
      basis: {
        rule: "linkedKakuCategory",
        judgeName: f.judgeName,
        candidateIds: candidates.map((k) => k.id),
        linkedKaku: linked ? { id: linked.id, name: linked.name, category: linked.category } : null,
        reason:
          candidates.length === 0
            ? "judgeName と同名の成立済み格局がビューに無いため、区分を決めない。"
            : candidates.length > 1
              ? "judgeName と同名の成立済み格局が複数あり一意に決められないため、区分を決めない。"
              : null,
      },
    };
    if (!linked) unclassified.push(p);
    else (linked.category === "吉格" ? section2 : section3).push(p);
  });

  return {
    schemaVersion: 1,
    palaceNumber: view.palaceNumber,
    section1: { title: PLAN_SECTION_TITLES.section1, facts, singleMeanings },
    section2: { title: PLAN_SECTION_TITLES.section2, items: section2 },
    section3: { title: PLAN_SECTION_TITLES.section3, items: section3 },
    section4: { title: PLAN_SECTION_TITLES.section4, items: section4 },
    unclassified,
  };
}
