// tests/takujitsu_hongshi_output_unit.manual.ts
//
// 目的:
//   洪氏錦嚢注記の OUTPUT 接続（2026-10-26）を検証する。
//   ・注記データ33件の維持
//   ・洪氏注記検索だけの語彙対応「結婚納采」→「結婚姻」「納采」
//   ・五離の洪氏注記は補足・異説としてだけ取得でき、五離の正式な忌・解除は変わらない
//   ・既存の結婚納采注記（大時・天吏・五墓など）も結婚姻・納采で取得できる
//   ・専門用 /takujitsu だけに接続し、一般向け /lucky-day には接続しない
//
// 実行:
//   npx tsx tests/takujitsu_hongshi_output_unit.manual.ts

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveShinsatsuRelations, resolveJianchu } from "../src/lib/takujitsu";
import { HONGSHI_NOTES, HONGSHI_ACTIVITY_ALIASES, getHongshiNotesFor, ACTIVITY_DEFINITIONS } from "../src/lib/takujitsu/activity";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function evaluate(kichijin: string[], kyojin: string[]) {
  return evaluateActivities({
    resolution: resolveShinsatsuRelations({ kichijin, kyojin }),
    buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
  });
}
function notesFor(kichijin: string[], kyojin: string[], activityId: string) {
  const ev = evaluate(kichijin, kyojin).evaluations.find((e) => e.activityId === activityId);
  return ev ? getHongshiNotesFor(ev) : [];
}

// 1. 注記データの維持
check("HONGSHI_NOTES は33件", HONGSHI_NOTES.length === 33, String(HONGSHI_NOTES.length));
check("語彙対応は結婚納采→結婚姻・納采だけ", JSON.stringify(HONGSHI_ACTIVITY_ALIASES) === JSON.stringify({ 結婚納采: ["結婚姻", "納采"] }));
check("語彙対応の先は実在する activity", Object.values(HONGSHI_ACTIVITY_ALIASES).flat().every((id) => ACTIVITY_DEFINITIONS.some((d) => d.id === id)));

// 2〜4. 結婚姻・納采で「結婚納采」の注記（五離を含む）が取得できる
// 顕星（ALL型の吉神、どの解除ルールにも関わらない）で吉凶混在にする。
for (const id of ["結婚姻", "納采"]) {
  const ns = notesFor(["顕星"], ["五離"], id);
  check(`${id}×五離：洪氏注記「用いて良い」を取得`, ns.length === 1 && ns[0].unfavorableGod === "五離" && ns[0].activityId === "結婚納采" && ns[0].conditionText === "用いて良い");
}
check("嫁娶×五離：注記なし（洪氏の対象は結婚納采だけ）", notesFor(["顕星"], ["五離"], "嫁娶").length === 0);
check("宴會×五離：注記なし", notesFor(["顕星"], ["五離"], "宴會").length === 0);

// 5. 注記があっても五離の正式判定は変わらない
{
  const ev = evaluate(["顕星"], ["五離"]);
  for (const id of ["宴會", "嫁娶", "立券交易", "交易", "結婚姻", "納采"]) {
    const e = ev.evaluations.find((x) => x.activityId === id);
    check(`五離の忌 ${id} は維持（mixed のまま、吉へ反転しない）`, e?.verdict === "mixed" && e.negativeSources.some((s) => s.sourceName === "五離"), e?.verdict);
  }
  const alone = evaluate([], ["五離"]).evaluations.find((x) => x.activityId === "結婚姻");
  check("五離だけの日：結婚姻は凶（注記は吉凶混在のときだけ）", alone?.verdict === "bad" && getHongshiNotesFor(alone).length === 0);
  check("五離の解除は徳合・天赦・六合のまま（天徳で cancelled）", resolveShinsatsuRelations({ kichijin: ["天徳"], kyojin: ["五離"] }).kyojin.find((k) => k.name === "五離")?.status === "cancelled");
  check("五離＋三合は active のまま", resolveShinsatsuRelations({ kichijin: ["三合"], kyojin: ["五離"] }).kyojin.find((k) => k.name === "五離")?.status === "active");
}

// 6. 既存の結婚納采注記も結婚姻・納采で取得できる
for (const god of ["大時", "天吏", "五墓", "月害", "月厭", "月刑", "劫殺", "月殺"]) {
  for (const id of ["結婚姻", "納采"]) {
    check(`${id}×${god}：結婚納采の洪氏注記を取得`, notesFor(["顕星"], [god], id).some((n) => n.unfavorableGod === god && n.activityId === "結婚納采"));
  }
}
check("結婚納采そのものでも従来どおり取得（月厭）", notesFor(["顕星"], ["月厭"], "結婚納采").some((n) => n.unfavorableGod === "月厭"));
check("開市×大時：従来どおり取得", notesFor(["顕星"], ["大時"], "開市").some((n) => n.unfavorableGod === "大時"));
check("上官赴任×天吏：従来どおり取得", notesFor(["顕星"], ["天吏"], "上官赴任").some((n) => n.unfavorableGod === "天吏"));

// 33件の表示可能性（その凶神がその用事を忌む日に取得できるか）
{
  const displayable: string[] = [];
  const notDisplayable: string[] = [];
  for (const n of HONGSHI_NOTES) {
    const ids = [n.activityId, ...(HONGSHI_ACTIVITY_ALIASES[n.activityId] ?? [])];
    const ok = ids.some((id) => notesFor(["顕星"], [n.unfavorableGod], id).includes(n));
    (ok ? displayable : notDisplayable).push(`${n.activityId}×${n.unfavorableGod}`);
  }
  // 天賊・刀砧日は、エンジンの忌（天賊＝修倉庫・出貨財・遠行・開倉庫、刀砧日＝伐木・牧養・納畜・造畜柵）に
  // 洪氏の用事が含まれないため、注記の条件（その凶神がその用事を忌んでいる）を満たす日が無い。
  const EXPECTED_NOT = ["動土×天賊", "堅柱上樑×天賊", "蓋屋×天賊", "開市×天賊", "結婚納采×天賊", "安床×天賊", "安床×刀砧日"];
  check("表示できる注記は26件", displayable.length === 26, String(displayable.length));
  check("表示できない7件は天賊・刀砧日だけ", JSON.stringify(notDisplayable.sort()) === JSON.stringify([...EXPECTED_NOT].sort()), notDisplayable.join("・"));
}

// 7. 専門用 /takujitsu だけに接続し、一般向けには接続しない
{
  const page = readFileSync("src/app/takujitsu/page.tsx", "utf8");
  check("/takujitsu は getHongshiNotesFor を使う", page.includes("getHongshiNotesFor("));
  check("/takujitsu の見出しは「洪氏錦嚢による補足・異説」", page.includes("洪氏錦嚢による補足・異説"));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  const general = [...walk("src/app/lucky-day"), ...walk("src/lib/luckyDay"), ...walk("src/lib/takujitsu/monthly")];
  const leaks = general.filter((f) => /hongshi|Hongshi|HONGSHI/.test(readFileSync(f, "utf8")));
  check("一般向け（/lucky-day・luckyDay・月間予定）は洪氏注記を参照しない", leaks.length === 0, leaks.join(", "));
  check("evaluateActivities の出力に洪氏注記は含まれない", !JSON.stringify(evaluate(["顕星"], ["五離"])).includes("洪氏"));
}

console.log("[区分B] 擇日 洪氏錦嚢注記の OUTPUT 接続");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
