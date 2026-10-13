// src/lib/shichusuimei/kakkyoku/index.ts
//
// 強弱・格局の補助判定（docs/shichusuimei-kakkyoku-spec.md）。
// 順序: 1. 強弱 → 2. 外格・特殊格局の候補（途中で止めない：KD22）→ 3. 外格候補がなければ内格 → 4. 内格補助点数。
// 内格の強弱は新方式の内格力量（elementForce：KD27）。旧内格補助点数（innerScore：KD12・KD13）は比較・回帰確認用に並べて計算するだけ。
// 内格補助点数は外格判定には使わず、外格・化格の機械判定にかかわらず常に計算する（KD19）。
// 最終判断は術者（decision.ts の PractitionerDecision）。原命式は書き換えない。

import type { KakkyokuResult, Pillars } from "./types";
import { assessStrength } from "./strength";
import { assessHehua } from "./hehua";
import { assessGaikaku } from "./gaikaku";
import { calculateInnerScore } from "./innerScore";
import { calculateElementForce } from "./elementForce";

export function assessKakkyoku(pillars: Pillars): KakkyokuResult {
  const referenceOnly = pillars.時 === null;
  const strength = assessStrength(pillars);
  const hehua = assessHehua(pillars);
  const { candidates, route } = assessGaikaku(pillars, strength, hehua, referenceOnly);
  const enginePattern =
    route === "naikaku" ? { name: "内格", status: referenceOnly ? ("provisional" as const) : ("candidate" as const) } : null;
  const innerScore = calculateInnerScore(pillars, referenceOnly);
  const innerScoreScope = route === "naikaku" ? "naikaku" : "withGaikakuCandidates";
  const elementForce = calculateElementForce(pillars, referenceOnly, strength);
  return {
    referenceOnly,
    strength,
    hehua,
    candidates,
    route,
    enginePattern,
    innerScore,
    innerScoreScope,
    elementForce,
    finalJudgment: "requires_practitioner_judgment",
  };
}

export { assessStrength, assessTouta, forceBalanceOf } from "./strength";
export { assessHehua } from "./hehua";
export { assessGaikaku } from "./gaikaku";
export { calculateInnerScore } from "./innerScore";
export { calculateElementForce, judgeSupportRatio } from "./elementForce";
export {
  FINAL_PATTERN_OPTIONS,
  FINAL_STRENGTH_OPTIONS,
  resolveEffectiveStrength,
  santokuSideOf,
  EMPTY_DECISION,
  finalPatternLabelOf,
  resolveEffectivePattern,
  buildInterpretationInput,
} from "./decision";
export type * from "./types";
export type {
  FinalPatternOption,
  FinalStrengthOption,
  PractitionerDecision,
  EffectivePattern,
  EffectiveStrength,
  InterpretationInput,
} from "./decision";
