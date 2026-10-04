// tests/liuren_interpretation_anchor_resolver.manual.ts
//
// 六壬神課 解釈エンジン Phase 3W（Board Anchor Resolver）のテスト。
// 実行: npx tsx tests/liuren_interpretation_anchor_resolver.manual.ts（型の確認は npx tsc --noEmit）
//
//   1. 720課×月支で 10種類の BoardAnchor がすべて解決でき（7,200件以上）、返る FACT が生成済みの FACT と同じオブジェクト
//   2. lesson1 と standing、dayBranch と lesson3 は同じ支を含むが別の anchor として解決される
//   3. relationBetweenAnchors が既存の relationBetween と一致する（四課は上神・下神を明示）
//   4. SemanticRoleAssignment.source をそのまま resolveAnchor に渡せる（型の確認）
//   5. 解決しても FACT を書き換えない。InterpretationContext に依存しない

import { calculateLiuren } from "../src/lib/liuren";
import type { Branch } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { relationBetween } from "../src/lib/liuren/interpretation/relations";
import { elementRelationOf } from "../src/lib/liuren/interpretation/standingPathComparison";
import {
  anchorResolutionContextOf, relationBetweenAnchors, resolveAnchor,
} from "../src/lib/liuren/interpretation/anchorResolver";
import type { AnchorResolution, AnchorResolutionContext, RelationAnchor } from "../src/lib/liuren/interpretation/anchorResolver";
import type { BoardAnchor, SemanticRoleAssignment } from "../src/lib/liuren/interpretation/roles";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

const ANCHORS: BoardAnchor[] = [
  { kind: "dayStem" }, { kind: "dayBranch" },
  { kind: "lesson", index: 1 }, { kind: "lesson", index: 2 }, { kind: "lesson", index: 3 }, { kind: "lesson", index: 4 },
  { kind: "position", position: "standing" }, { kind: "position", position: "initial" },
  { kind: "position", position: "middle" }, { kind: "position", position: "final" },
];

// ---- 4. 型の確認: ROLE の source（BoardAnchor）をそのまま渡せる ----
const resolveRoleSource = (a: SemanticRoleAssignment, ctx: AnchorResolutionContext): AnchorResolution | null => resolveAnchor(a.source, ctx);

// ---- 3. 関係の監査で使う組 ----
const PAIRS: [string, RelationAnchor, RelationAnchor][] = [
  ["dayStem→dayBranch", { kind: "dayStem" }, { kind: "dayBranch" }],
  ["dayStem→lesson3.upper", { kind: "dayStem" }, { kind: "lesson", index: 3, part: "upper" }],
  ["dayBranch→lesson3.upper", { kind: "dayBranch" }, { kind: "lesson", index: 3, part: "upper" }],
  ["lesson1.upper→lesson3.upper", { kind: "lesson", index: 1, part: "upper" }, { kind: "lesson", index: 3, part: "upper" }],
  ["standing→initial", { kind: "position", position: "standing" }, { kind: "position", position: "initial" }],
  ["initial→middle", { kind: "position", position: "initial" }, { kind: "position", position: "middle" }],
  ["middle→final", { kind: "position", position: "middle" }, { kind: "position", position: "final" }],
];

let resolutions = 0;
let roleChecked = 0;
for (let i = 0; i < 60; i++) {
  for (let o = 0; o < 12; o++) {
    const tag = `${STEMS[i % 10]}${BRANCHES[i % 12]}+${o}`;
    const chart = calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] });
    const before = JSON.stringify(chart);
    const facts = buildInterpretationFacts(chart);
    for (const m of [null, BRANCHES[(i + o) % 12]] as (Branch | null)[]) {
      const ctx = anchorResolutionContextOf(facts, m);
      const ctxBefore = JSON.stringify(ctx);
      const rs = ANCHORS.map((a) => resolveAnchor(a, ctx));
      if (rs.some((r) => r === null)) {
        check(`${tag} 月${m ?? "なし"} 10 anchor がすべて解決`, false);
        continue;
      }
      if (m === null) resolutions += rs.length;
      const [ds, db, l1, l2, l3, l4, st, ini, mid, fin] = rs as AnchorResolution[];
      const a = ctx.actualization!;
      const c = ctx.comparison!;
      // 1. 同じオブジェクト
      const ok =
        ds.kind === "dayStem" && ds.stem === facts.basic.dayStem && ds.standing === c.standing && ds.constraints.length === 0 &&
        db.kind === "dayBranch" && db.source === ctx.dayBranch && db.constraints === ctx.dayBranch.constraints &&
        [l1, l2, l3, l4].every((r, k) => r.kind === "lesson" && r.source === ctx.fourLessons.lessons[k] && r.constraints === ctx.fourLessons.lessons[k].constraints) &&
        [st, ini, mid, fin].every((r, k) => r.kind === "path" && r.source === a.states[k] && r.constraints === a.states[k].constraints) &&
        st.kind === "path" && st.source.source === c.standing &&
        ini.kind === "path" && ini.source.source === c.path.initial && fin.kind === "path" && fin.source.source === c.path.final;
      if (!ok) check(`${tag} 月${m ?? "なし"} 同じオブジェクト`, false);
      // 2. 別の anchor として解決（値は一致）
      // kind が "lesson" と "path"、"dayBranch" と "lesson" に分かれる（型の上でも別の anchor）
      const sep = l1.kind === "lesson" && st.kind === "path" &&
        JSON.stringify(l1.source.upper) === JSON.stringify(st.source.source) &&
        db.kind === "dayBranch" && l3.kind === "lesson" && db.source.branch === l3.source.lowerBranch;
      if (!sep) check(`${tag} 月${m ?? "なし"} lesson1/standing・dayBranch/lesson3 の区別`, false);
      // 3. 関係
      const term = (x: RelationAnchor) => x.kind === "dayStem" ? facts.basic.dayStem : x.kind === "dayBranch" ? facts.basic.dayBranch
        : x.kind === "lesson" ? (x.part === "upper" ? facts.lessons[x.index - 1].upper : facts.lessons[x.index - 1].lower)
          : x.position === "standing" ? facts.lessons[0].upper
            : facts.transmissions![["initial", "middle", "final"].indexOf(x.position)].branch;
      const relOk = PAIRS.every(([, x, y]) => {
        const r = relationBetweenAnchors(x, y, ctx);
        const s = relationBetween(term(x), term(y));
        return r !== null && JSON.stringify(r.structural) === JSON.stringify(s) && r.relation === elementRelationOf(s);
      });
      if (!relOk) check(`${tag} 月${m ?? "なし"} relationBetweenAnchors`, false);
      // 4. ROLE の source から
      const assignment: SemanticRoleAssignment = { role: "target", source: { kind: "lesson", index: 3 }, evidence: [], confidence: "direct" };
      if (resolveRoleSource(assignment, ctx) !== null) roleChecked += 1;
      // 5. 書き換えない
      if (JSON.stringify(ctx) !== ctxBefore) check(`${tag} 月${m ?? "なし"} FACT 不変`, false);
    }
    check(`${tag} 起課結果不変`, JSON.stringify(chart) === before);
  }
}
check("720課×10 anchor＝7,200件の解決", resolutions === 7200, String(resolutions));
check("ROLE の source から解決（720課×月支2通り）", roleChecked === 1440, String(roleChecked));
{
  // 三伝未確定: 位置（standing・三伝）は解決できず null、それ以外は解決できる
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "卯" }));
  const ctx = anchorResolutionContextOf({ ...facts, transmissions: null });
  const rs = ANCHORS.map((a) => resolveAnchor(a, ctx));
  check("三伝未確定 → 位置は null・日干/日支/四課は解決", rs.slice(0, 6).every((r) => r !== null) && rs.slice(6).every((r) => r === null) &&
    (rs[0] as { standing: unknown }).standing === null);
}
{
  // InterpretationContext に依存しない（resolveAnchor は CONTEXT を受け取らない。同じ盤・同じ anchor で同じ結果）
  const facts = buildInterpretationFacts(calculateLiuren({ dayStem: "丙", dayBranch: "午", divinationBranch: "申", monthGeneral: "卯" }));
  const ctx = anchorResolutionContextOf(facts);
  check("同じ盤・同じ anchor は常に同じ FACT", ANCHORS.every((a) => resolveAnchor(a, ctx)!.kind === resolveAnchor(a, ctx)!.kind &&
    JSON.stringify(resolveAnchor(a, ctx)) === JSON.stringify(resolveAnchor(a, ctx))) && resolveAnchor.length === 2);
}

console.log(`720課 解決件数: ${resolutions}（10 anchor × 720課。月支ありの照合も同数）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
