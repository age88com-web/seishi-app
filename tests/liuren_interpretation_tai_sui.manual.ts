// tests/liuren_interpretation_tai_sui.manual.ts
//
// 六壬神課 Phase 4L-1（太歳 TaiSuiState。占年の年支）のテスト。
// 実行: npx tsx tests/liuren_interpretation_tai_sui.manual.ts
//
//   1. 12支それぞれを明示入力として渡すと、そのまま保持する（年干・他の項目を持たない）
//   2. 720課・占時12支 8,640課で、どの太歳を与えても起課結果（四課・三伝・天地盤・天将盤）と解釈 FACT が変わらない
//   3. 太歳の支を既存の関数に渡せる: 上神（plate.heavenOn）・天将（Phase 4B）・日干との関係（Phase 4K）
//   4. 『六壬断案２』例52（己酉年「日上に太歳が来て朱雀」「日貴は…太歳に加わる」）・例33（「10年後の太歳は午」）
//   5. 暦計算（src/lib/calendar）の年支は使わない。比較の値は出力するだけで、一致を前提にしない

import { readFileSync } from "node:fs";
import { calculateLiuren, calculateLiurenAt } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { derivedBranchDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";
import { dayNightNobleBranchPairStateOf } from "../src/lib/liuren/interpretation/dayNightNobleBranchPair";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));

// ---- 1. 12支 ----
for (const b of BRANCHES) {
  const t = taiSuiStateOf(b);
  check(`太歳 ${b} をそのまま保持（kind・branch だけ）`, t.kind === "taiSui" && t.branch === b && Object.keys(t).join() === "kind,branch", JSON.stringify(t));
}

// ---- 2. 起課・解釈 FACT が変わらない ----
let charts = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const ctxBefore = shi === "子" ? JSON.stringify(anchorResolutionContextOf(facts)) : "";
  for (const b of BRANCHES) {
    const t = taiSuiStateOf(b);
    // 太歳の支を既存の関数に渡す（盤を読むだけ）
    void facts.plate.heavenOn[t.branch];
    void heavenlyGeneralStateOf(facts, t.branch);
    void derivedBranchDayStemStateOf(facts, t.branch);
  }
  charts += 1;
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
  if (shi === "子" && JSON.stringify(anchorResolutionContextOf(facts)) !== ctxBefore) changed += 1;
}
check("8,640課（うち720課は占時子）で、12支どの太歳を与えても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);
check("起課の入力に太歳がない（calculateLiuren の入力は日干・日支・占時・月将）",
  Object.keys(calculateLiuren({ dayStem: "甲", dayBranch: "子", divinationBranch: "子", monthGeneral: "子" }).input).join() === "dayStem,dayBranch,divinationBranch,monthGeneral");

// ---- 3・4. 例52・例33 ----
{
  // 例52 己酉年 丁丑日 午将辰時: 太歳＝酉
  const f52 = factsOf("丁丑", "午", "辰");
  const t = taiSuiStateOf("酉");
  check("例52-2 太歳 酉 ＝ 一課上神（日上） 酉", t.branch === "酉" && f52.lessons[0].upper === t.branch);
  check("例52-2 その位置（太歳の支 酉）に乗る天将は朱雀（天将盤はエンジンと一致する例）", heavenlyGeneralStateOf(f52, t.branch).general === "朱雀");
  // 「日貴は官鬼で、太歳に加わる」: 太歳 酉 を地盤の位置として、その上に日貴（昼貴人支）亥
  const pair = dayNightNobleBranchPairStateOf(f52);
  const over = f52.plate.heavenOn[t.branch];
  check("例52 太歳 酉 の上（plate.heavenOn[酉]）は 亥 で、丁の昼貴人支（Phase 4F の dayBranch）と同じ", over === "亥" && pair.dayBranch === "亥" && f52.plate.earthUnder["亥"] === "酉");
  check("例52 日貴 亥 は官鬼（Phase 4K）", derivedBranchDayStemStateOf(f52, over).sixRelation === "官鬼");
  const d = derivedBranchDayStemStateOf(f52, t.branch);
  check("例52 太歳 酉 は Phase 4K に渡せる（丁から見て妻財）", d.branch === "酉" && d.sixRelation === "妻財");
  console.log(`例52: 太歳 ${t.branch} ＝ 一課上神 ${f52.lessons[0].upper}（天将 ${heavenlyGeneralStateOf(f52, t.branch).general}） ／ 太歳の上 ${over}（日貴・昼貴人支 ${pair.dayBranch}、六親 ${derivedBranchDayStemStateOf(f52, over).sixRelation}） ／ 太歳と日干: ${JSON.stringify(d)}`);
}
{
  // 例33 壬午日 辰将申時「10年後の太歳は午…午の陰神は白虎」: 未来の年は計算せず、太歳 午 を明示入力にする
  const f33 = factsOf("壬午", "辰", "申");
  const t = taiSuiStateOf("午");
  const over = f33.plate.heavenOn[t.branch];
  check("例33 明示入力の太歳 午 の上神（陰神の構造）は plate.heavenOn で取得できる（寅）", over === "寅" && f33.plate.earthUnder[over] === "午");
  console.log(`例33: 太歳（明示入力） ${t.branch} の上 ${over}（天将はエンジンの盤で ${heavenlyGeneralStateOf(f33, over).general}。断案の盤では白虎で、天将盤が別方式の例） ／ 太歳と日干: ${JSON.stringify(derivedBranchDayStemStateOf(f33, t.branch))}`);
}

// ---- 5. 暦計算の年支（比較の出力だけ） ----
const calendarLines: string[] = [];
for (const [label, y, m, d] of [
  ["2025-12-31", 2025, 12, 31], ["2026-01-01", 2026, 1, 1], ["2026-02-03（立春前日）", 2026, 2, 3], ["2026-02-05（立春後）", 2026, 2, 5],
  ["2026-02-17（旧正月）", 2026, 2, 17], ["2026-10-05", 2026, 10, 5],
] as const) {
  const r = calculateLiurenAt({ year: y, month: m, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  calendarLines.push(`${label}: calendar.yearStem/yearBranch ${r.calendar.yearStem}${r.calendar.yearBranch}`);
}
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/taiSui.ts");
  const hit = ["calendar", "yearStem", "立春", "lichun", "Stem", "heavenOn", "general", "sixRelation", "growth", "void", "Salary", "role", "domain",
    "InterpretationContext", "吉", "凶", "+ 10", "birth"].filter((w) => code.includes(w));
  check("taiSui.ts に暦計算・年干・上神・天将・六親・十二長生・空亡・標識・ROLE・DOMAIN・吉凶・年の加算がない", hit.length === 0, hit.join(","));
  const t = readFileSync("src/lib/liuren/interpretation/types.ts", "utf8").split("export interface TaiSuiState")[1].split("}")[0];
  check("TaiSuiState の型は kind と branch だけ", !/stem|Stem|general|upper|isOn|sixRelation|growth/.test(t));
  check("起課エンジン・RoleMatcher に太歳を入れていない", !/taiSui|TaiSui|太歳/.test(strip("src/lib/liuren/liurenEngine.ts") + strip("src/lib/liuren/types.ts") + strip("src/lib/liuren/interpretation/roleRules.ts")));
}

console.log("暦計算の年干支（比較のための出力。六壬の太歳としては使わない）:");
for (const l of calendarLines) console.log(`  ${l}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
