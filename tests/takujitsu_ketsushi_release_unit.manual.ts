// tests/takujitsu_ketsushi_release_unit.manual.ts
//
// 目的:
//   1. 血支の解除ルール No.7（擇日テキスト.pdf p.23「吉日が来ていれば解除できる。
//      歳徳・合、月徳・合、赦願など」）が、監修確定（2026-10-06）の5条件
//      ＝歳徳・歳徳合・月徳・月徳合・赦願（天赦 または 天願）だけで成立し、
//      「など」から推測した吉神（天徳・天徳合・六合 など）では成立しないことを確認する。
//   2. 2027-05-13（丁未年 巳月 甲辰日。吉神：歳徳合・時徳・福生・陽徳・司命・天福、
//      凶神：伐日・血支・月殺・五虚・埋兒凶宿・龍禁）で、歳徳合の有無により
//      血支・五虚だけが解除され、伐日・月殺・埋兒凶宿・龍禁は残ることを確認する。
//   3. 洪氏錦嚢の用事別記載（監修確定 2026-10-06）:
//      ・埋兒宿×安床、龍禁日×造船・行舟（乗船渡水）は個別禁止で解除不可
//        → その凶神が仮に cancelled になっても当該用事は忌のまま残る。
//      ・埋兒凶宿・龍禁は影響の弱い神殺：忌は直接関係する用事（安床／造船・乗船渡水）に限り、
//        一般用事の判定を変えない（weak 印で区別）。
//      ・月殺：開市「問題ない」・結婚納采「用いて良い」は不忌。上官赴任
//        「吉神にあうなど条件が合えば用いて良い」は吉神の範囲が未確定のため忌のまま。
//
// 実行:
//   npx tsx tests/takujitsu_ketsushi_release_unit.manual.ts

import { RESOLUTION_RULES } from "../src/lib/takujitsu";
import { resolve } from "../src/lib/takujitsu/resolution";
import { evaluateActivities } from "../src/lib/takujitsu/activity";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else {
    fail += 1;
    failures.push(`  [${label}] ${detail}`);
  }
}

const statusOf = (kichijin: string[], kyojin: string[], name: string, rules = RESOLUTION_RULES) =>
  resolve({ kichijin, kyojin }, rules).kyojin.find((e) => e.name === name)?.status;

// ---- 1. No.7 の解除条件（5条件。赦願＝天赦 または 天願）----
console.log("[1] 血支の解除条件（歳徳・歳徳合・月徳・月徳合・赦願）");
for (const k of ["歳徳", "歳徳合", "月徳", "月徳合", "天赦", "天願"]) {
  const s = statusOf([k], ["血支"], "血支");
  check(`${k} があれば血支は cancelled`, s === "cancelled", `実測=${s}`);
}
check("吉神なしなら血支は active", statusOf([], ["血支"], "血支") === "active");
// 「など」から推測で追加しない
for (const k of ["天徳", "天徳合", "六合", "三合", "時徳", "司命", "天福", "母倉"]) {
  const s = statusOf([k], ["血支"], "血支");
  check(`${k} だけでは血支は解除されない`, s === "active", `実測=${s}`);
}

// ---- 2. 2027-05-13 の6凶神 ----
console.log("[2] 2027-05-13 の6凶神と歳徳合");
const K = ["歳徳合", "時徳", "福生", "陽徳", "司命", "天福"];
const K_NO = K.filter((k) => k !== "歳徳合");
const Y = ["伐日", "血支", "月殺", "五虚", "埋兒凶宿", "龍禁"];
const EXPECT_WITH: Record<string, string> = {
  伐日: "active", 血支: "cancelled", 月殺: "active", 五虚: "cancelled", 埋兒凶宿: "active", 龍禁: "active",
};
for (const y of Y) {
  const sWith = statusOf(K, Y, y);
  const sWithout = statusOf(K_NO, Y, y);
  check(`歳徳合あり: ${y} = ${EXPECT_WITH[y]}`, sWith === EXPECT_WITH[y], `実測=${sWith}`);
  check(`歳徳合なし: ${y} = active`, sWithout === "active", `実測=${sWithout}`);
}

// ---- 3. 用事レベル ----
console.log("[3] 用事レベル（洪氏錦嚢の個別禁止・月殺の用事別記載）");
type Ev = ReturnType<typeof evaluateActivities>["evaluations"][number];
const evalOf = (kichijin: string[], kyojin: string[], rules = RESOLUTION_RULES) =>
  new Map<string, Ev>(
    evaluateActivities({ resolution: resolve({ kichijin, kyojin }, rules), buildingDay: { name: "_" } as never }).evaluations
      .map((e) => [e.activityId, e]),
  );
const negFrom = (m: Map<string, Ev>, activityId: string) =>
  (m.get(activityId)?.negativeSources ?? []).map((s) => s.sourceName);

const withSG = evalOf(K, Y);
const withoutSG = evalOf(K_NO, Y);
// 血支の忌（例：上官赴任・祭祀）は歳徳合ありで消え、なしで残る
for (const a of ["祭祀", "鍼灸"]) {
  check(`歳徳合あり: ${a} に血支の忌が無い`, !negFrom(withSG, a).includes("血支"), negFrom(withSG, a).join("・"));
  check(`歳徳合なし: ${a} に血支の忌が有る`, negFrom(withoutSG, a).includes("血支"), negFrom(withoutSG, a).join("・"));
}
// 五虚の忌（開倉庫）は歳徳合ありで消える
check("歳徳合あり: 開倉庫 に五虚の忌が無い", !negFrom(withSG, "開倉庫").includes("五虚"));
check("歳徳合なし: 開倉庫 に五虚の忌が有る", negFrom(withoutSG, "開倉庫").includes("五虚"));
// 埋兒凶宿×安床、龍禁×造船・乗船渡水 は歳徳合ありでも忌
check("歳徳合あり: 安床 は埋兒凶宿で忌", negFrom(withSG, "安床").includes("埋兒凶宿"), negFrom(withSG, "安床").join("・"));
check("歳徳合あり: 造船 は龍禁で忌", negFrom(withSG, "造船").includes("龍禁"));
check("歳徳合あり: 乗船渡水 は龍禁で忌", negFrom(withSG, "乗船渡水").includes("龍禁"));
// 月殺の用事別記載
check("月殺: 開市（問題ない）は月殺の忌が無い", !negFrom(withoutSG, "開市").includes("月殺"));
check("月殺: 結婚納采（用いて良い）は月殺の忌が無い", !negFrom(withoutSG, "結婚納采").includes("月殺"));
check("月殺: 上官赴任（吉神にあえば）は月殺の忌のまま", negFrom(withSG, "上官赴任").includes("月殺"));
check("月殺: 歳徳合ありでも嫁娶は月殺の忌のまま", negFrom(withSG, "嫁娶").includes("月殺"));

// 埋兒凶宿・龍禁は影響の弱い神殺（監修確定 2026-10-06）: 直接関係する用事だけに限定し、weak 印を持つ
{
  const onlyWeak = evalOf(K, ["埋兒凶宿", "龍禁"]);
  const hit = [...onlyWeak.values()].filter((e) => e.negativeSources.some((s) => s.sourceName === "埋兒凶宿" || s.sourceName === "龍禁"));
  const ids = hit.map((e) => e.activityId).sort();
  check("埋兒凶宿・龍禁の忌は 乗船渡水・安床・造船 だけ", JSON.stringify(ids) === JSON.stringify(["乗船渡水", "安床", "造船"].sort()), ids.join("・"));
  check("埋兒凶宿・龍禁の作用元は weak 印付き", hit.every((e) => e.negativeSources.filter((s) => s.sourceName === "埋兒凶宿" || s.sourceName === "龍禁").every((s) => s.weak === true)));
  const plain = evalOf(K, []);
  const changed = [...plain.keys()].filter((a) => !["乗船渡水", "安床", "造船"].includes(a) && plain.get(a)?.verdict !== onlyWeak.get(a)?.verdict);
  check("埋兒凶宿・龍禁の成立だけで一般用事の判定は変わらない", changed.length === 0, changed.join("・"));
}

// 解除不可の個別禁止は、仮に凶神全体が cancelled になっても残る
const HYPO = [
  ...RESOLUTION_RULES,
  { id: "H", targets: ["埋兒凶宿", "龍禁"], requires: [{ names: ["歳徳合"], mode: "any" as const }], combine: "any" as const, kind: "cancel" as const, pending: false, page: "検証用の仮ルール" },
];
check("仮ルール: 埋兒凶宿は cancelled", statusOf(K, Y, "埋兒凶宿", HYPO as typeof RESOLUTION_RULES) === "cancelled");
const hypo = evalOf(K, Y, HYPO as typeof RESOLUTION_RULES);
check("仮ルールで cancelled でも 安床 は埋兒凶宿で忌", negFrom(hypo, "安床").includes("埋兒凶宿"));
check("仮ルールで cancelled でも 造船 は龍禁で忌", negFrom(hypo, "造船").includes("龍禁"));
check("仮ルールで cancelled でも 乗船渡水 は龍禁で忌", negFrom(hypo, "乗船渡水").includes("龍禁"));

console.log(`一致: ${pass} / ${pass + fail}`);
if (fail > 0) {
  console.log("\n--- 不一致 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
