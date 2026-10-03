// src/lib/liuren/sanchuan/shehai.ts
//
// 役割:
//   涉害法（講座 p17〜21。確定仕様はメモリ liuren-shehai-spec 訂正版）。
//
//   ① 深浅: 各候補の地盤支から順行し、本家（上神の支）の手前まで進む。
//      途中の各支には、その支に寄宮する干をすべて挟む（巳：丙・戊、未：丁・己。p19・p21 方式）。
//      経路のうち上神を剋すもの（賊）だけを数え、最も多い候補の上神を初伝とする（涉害課）。
//   ② 同数なら、候補の地盤支の孟＞仲＞季で決める（孟＝見機格、仲＝察微格）。
//      一課の地盤支は日干の寄宮支。一意に決まらなければ③へ。
//   ③ 最終判定（綴瑕格）:
//      (a) 講座 p21: 日干の寄宮支から順行して各候補の上神までの距離を比べ、最も遠い候補を初伝とする
//          （例題 E09: 巳から午までは一、子までは七 → 子）。
//          候補の上神が日干の寄宮支と同じ支のときは、距離 0 ではなく一周した 12 と数える。
//          ※この「同支＝12」は講座本文に明記された規則ではない。講座 p21 の距離規則と、
//            『七百二十課式便覧表』の実例（戊辰7局・戊戌7局の初伝＝巳）から確定した実装上の補足規則
//            （2026-09-26 ユーザー確認済み）。
//      (b) それでも決まらない場合のみ、講座 p17「陽日は干上神（一課の上神）、陰日は支上神（三課の上神）」。
//          一課・三課の「地盤支」を初伝にするのではない（回帰テスト E09）。
//
//   p18 は経路の表記が p19・p21 と不整合のため、仕様の根拠にしない。
//
//   九宗法一覧（docs/source/九相門.jpg）との差:
//     察微格を「孟無くば季を取る」と書くが、講座 p17（孟深仲浅季当休）・p20（「仲」をとる）は仲。講座を優先する。
//     綴瑕格を「日干の上神（一課）を取る」とだけ書く（陰日の記載なし）。陽日は確定仕様と一致する。

import { BRANCHES, JIGONG, MENG, ZHONG, STEMS } from "../constants";
import { controls } from "../relations";
import type { Stem, Branch, Lesson, DecisionStep, ShehaiCandidateTrace } from "../types";
import type { SanchuanContext, InitialSelection } from "./context";

/** 支 → その支に寄宮する干（十干寄宮表の逆引き。STEMS 順） */
const STEMS_LODGED_AT: Record<Branch, Stem[]> = (() => {
  const m = {} as Record<Branch, Stem[]>;
  for (const b of BRANCHES) m[b] = [];
  for (const s of STEMS) m[JIGONG[s]].push(s);
  return m;
})();

/** 地盤支から順行し、上神の支（本家）の手前までの経路。寄宮干を各支の直後に挟む */
export function shehaiPath(fromBranch: Branch, upper: Branch): (Stem | Branch)[] {
  const out: (Stem | Branch)[] = [];
  let i = BRANCHES.indexOf(fromBranch);
  while (BRANCHES[i] !== upper) {
    const b = BRANCHES[i];
    out.push(b, ...STEMS_LODGED_AT[b]);
    i = (i + 1) % 12;
  }
  return out;
}

function rankOf(b: Branch): "孟" | "仲" | "季" {
  if (MENG.includes(b)) return "孟";
  if (ZHONG.includes(b)) return "仲";
  return "季";
}

const RANK_ORDER = { 孟: 0, 仲: 1, 季: 2 } as const;

export function selectByShehai(
  ctx: SanchuanContext,
  candidates: readonly Lesson[],
  steps: DecisionStep[],
): InitialSelection {
  const traces: ShehaiCandidateTrace[] = candidates.map((l) => {
    const path = shehaiPath(l.lowerBranch, l.upper);
    const zei = path.filter((x) => controls(x, l.upper));
    return {
      lessonIndex: l.index, upper: l.upper, lowerBranch: l.lowerBranch,
      path, zei, depth: zei.length, rank: rankOf(l.lowerBranch),
    };
  });
  steps.push({
    stage: "涉害①深浅",
    detail: traces
      .map((t) => `${t.lessonIndex}課 上神${t.upper}（地盤${t.lowerBranch}）経路 ${t.path.join("")} 賊 ${t.zei.join("") || "なし"} = ${t.depth}`)
      .join(" / "),
    source: "講座 p17・p19〜21",
  });

  const maxDepth = Math.max(...traces.map((t) => t.depth));
  const deepest = traces.filter((t) => t.depth === maxDepth);
  if (new Set(deepest.map((t) => t.upper)).size === 1) {
    steps.push({ stage: "涉害①深浅", detail: `最も深い ${deepest[0].upper}（${maxDepth}）を初伝とする`, source: "講座 p17・p20" });
    return { ok: true, initial: deepest[0].upper, method: "涉害", pattern: "涉害課", steps, shehai: traces };
  }
  steps.push({ stage: "涉害①深浅", detail: `涉害数が同数（${maxDepth}）で決まらない`, source: "講座 p19・p21" });

  const bestRank = Math.min(...deepest.map((t) => RANK_ORDER[t.rank]));
  const best = deepest.filter((t) => RANK_ORDER[t.rank] === bestRank);
  const rankDetail = deepest.map((t) => `${t.lessonIndex}課 地盤${t.lowerBranch}＝${t.rank}`).join(" / ");
  if (bestRank < RANK_ORDER.季 && new Set(best.map((t) => t.upper)).size === 1) {
    const pattern = best[0].rank === "孟" ? "見機格" : "察微格";
    steps.push({
      stage: "涉害②孟仲季",
      detail: `${rankDetail} → ${best[0].rank}の ${best[0].upper} を初伝とする`,
      source: pattern === "見機格" ? "講座 p19" : "講座 p20",
    });
    return { ok: true, initial: best[0].upper, method: "涉害", pattern, steps, shehai: traces };
  }
  steps.push({ stage: "涉害②孟仲季", detail: `${rankDetail} → 一意に決まらない`, source: "講座 p21" });

  // (a) 日干の寄宮支から順行した距離（同支は 12）が最も遠い候補
  const jigong = JIGONG[ctx.dayStem];
  const withDistance = best.map((t) => ({ t, distance: distanceFromJigong(jigong, t.upper) }));
  const maxDistance = Math.max(...withDistance.map((x) => x.distance));
  const farthest = withDistance.filter((x) => x.distance === maxDistance);
  const distanceDetail = withDistance.map((x) => `${x.t.lessonIndex}課 上神${x.t.upper}＝${x.distance}`).join(" / ");
  if (new Set(farthest.map((x) => x.t.upper)).size === 1) {
    const initial = farthest[0].t.upper;
    steps.push({
      stage: "涉害③最終判定",
      detail: `日干${ctx.dayStem}の寄宮支${jigong}から順行した距離 ${distanceDetail} → 最も遠い ${initial} を初伝とする`,
      source: "講座 p21（同支＝12 は七百二十課式便覧表から確定した補足規則）",
    });
    return { ok: true, initial, method: "涉害", pattern: "綴瑕格", steps, shehai: traces };
  }

  // (b) 最終フォールバック: 陽日は干上神、陰日は支上神
  const initial = ctx.yangDay ? ctx.ganUpper : ctx.zhiUpper;
  steps.push({
    stage: "涉害③最終判定",
    detail: `寄宮支${jigong}からの距離（${distanceDetail}）でも決まらない → ` +
      (ctx.yangDay
        ? `陽日のため干上神（一課の上神）${initial} を初伝とする`
        : `陰日のため支上神（三課の上神）${initial} を初伝とする`),
    source: "講座 p17",
  });
  return { ok: true, initial, method: "涉害", pattern: "綴瑕格", steps, shehai: traces };
}

/** 日干の寄宮支から順行して上神までの支の数。同じ支は一周した 12 とする */
function distanceFromJigong(jigong: Branch, upper: Branch): number {
  const d = (((BRANCHES.indexOf(upper) - BRANCHES.indexOf(jigong)) % 12) + 12) % 12;
  return d === 0 ? 12 : d;
}
