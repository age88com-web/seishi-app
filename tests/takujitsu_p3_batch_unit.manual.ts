// tests/takujitsu_p3_batch_unit.manual.ts
//
// 目的:
//   擇日アプリ全体監査 P3（2026-10-25）の修正と、監査で確認した接続状態を検証する。
//   ・Q1＝C 月徳合：結婚姻・嫁娶・納采・結婚納采・修造・修造動土・建築を宜から外し忌にする
//   ・Q2＝B 歳徳・歳徳合：「百事大吉」で ALL型（例外なし。解除も宜）。
//     ただし同日の凶神の忌・尚忌（増悪）は消さない
//   制日・伐日は別スレッドで監修者が定義済みのため、このテストでは定義・profile・宜忌に依存しない。
//   ・Q4＝A 顕星・曲星・傅星は保留（→ 2026-10-26 の監修決定 Q5＝B で実装。検査は
//     tests/takujitsu_unresolved_shinsatsu_unit.manual.ts へ移した）
//   ・Q5＝A 嫁娶を「今日の吉凶」の主要用事に追加（64件）
//   ・Q6＝A 十二建除・二十八宿の削除済み言い回しは移さない（変更なし）
//   ・接続確認：成立する神殺と profile の対応、resolution ルールの対象名・条件名、
//     一般向け（/lucky-day）の表示グループ・ラベル・目的の activityId
//   未実装神殺（満日〔天狗以外〕・血忌・天恩・月空）は成立しないことを確認する。
//   復日・重日・五離・天罡・河魁・天狗・除神・顕星・曲星・傅星は 2026-10-26 の監修決定で
//   実装した（tests/takujitsu_unresolved_shinsatsu_unit.manual.ts）。
//
// 実行:
//   npx tsx tests/takujitsu_p3_batch_unit.manual.ts

import {
  calculateTakujitsuFull,
  resolveShinsatsuRelations,
  resolveJianchu,
  RESOLUTION_RULES,
} from "../src/lib/takujitsu";
import { ACTIVITY_DEFINITIONS, ACTIVITY_PROFILES } from "../src/lib/takujitsu/activity";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";
import { ACTIVITY_GROUP_BY_ID } from "../src/lib/luckyDay/activityGroups";
import { getLuckyDayActivityLabel, LUCKY_DAY_PRIMARY_ACTIVITY_IDS } from "../src/lib/luckyDay/activityDisplay";
import { LUCKY_DAY_PURPOSES_BY_CATEGORY } from "../src/lib/luckyDay/purposeMapping";

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

function evalWith(kichijin: string[], kyojin: string[]) {
  return evaluateActivities({
    resolution: resolveShinsatsuRelations({ kichijin, kyojin }),
    buildingDay: resolveJianchu({ monthBranch: "寅", dayBranch: "寅" }),
  });
}
function posIds(kichijin: string[], source: string): string[] {
  return evalWith(kichijin, []).evaluations.filter((e) => e.positiveSources.some((s) => s.sourceName === source)).map((e) => e.activityId).sort();
}
function negIds(kichijin: string[], kyojin: string[], source: string): string[] {
  return evalWith(kichijin, kyojin).evaluations.filter((e) => e.negativeSources.some((s) => s.sourceName === source)).map((e) => e.activityId).sort();
}
const ALL_IDS = ACTIVITY_DEFINITIONS.map((d) => d.id).sort();

// 1. Q2 歳徳・歳徳合は ALL型（例外なし）
for (const n of ["歳徳", "歳徳合"]) {
  const p = ACTIVITY_PROFILES.find((x) => x.sourceType === "kichijin" && x.sourceName === n);
  check(`Q2 ${n} は ALL型で例外なし`, p?.positiveMode === "all_except" && (p?.positiveExceptionActivityIds?.length ?? 0) === 0);
  check(`Q2 ${n} の日は全用事に${n}の宜が付く`, JSON.stringify(posIds([n], n)) === JSON.stringify(ALL_IDS), `${posIds([n], n).length}/${ALL_IDS.length}`);
  check(`Q2 ${n} の日は解除・修造・動土・嫁娶も宜`, ["解除", "修造", "動土", "嫁娶"].every((a) => posIds([n], n).includes(a)));
  // 他の凶神の忌は消さない（月破＋歳徳 → 嫁娶は月破の忌が残り mixed）
  const ev = evalWith([n], ["月破"]).evaluations.find((e) => e.activityId === "嫁娶");
  check(`Q2 ${n}＋月破 → 嫁娶に月破の忌が残る（mixed）`, ev?.verdict === "mixed" && ev.negativeSources.some((x) => x.sourceName === "月破"), ev?.verdict);
  // 尚忌（No.14 往亡は徳合で増悪）は維持
  check(`Q2 ${n}＋往亡 → 往亡は aggravated のまま`,
    resolveShinsatsuRelations({ kichijin: [n], kyojin: ["往亡"] }).kyojin.find((e) => e.name === "往亡")?.status === "aggravated");
}

// 2. Q1 月徳合：結婚系・造作系は宜から外れて忌
{
  const MARRIAGE_BUILD = ["結婚姻", "嫁娶", "納采", "結婚納采", "修造", "修造動土", "建築"].sort();
  const pos = posIds(["月徳合"], "月徳合");
  check("Q1 月徳合の宜に結婚系・造作系は含まれない", MARRIAGE_BUILD.every((a) => !pos.includes(a)));
  check("Q1 月徳合の宜から外れるのは取魚・畋獵と結婚系・造作系だけ",
    JSON.stringify(ALL_IDS.filter((a) => !pos.includes(a)).sort()) === JSON.stringify([...MARRIAGE_BUILD, "取魚", "畋獵"].sort()));
  check("Q1 月徳合の忌は結婚系・造作系の7件", JSON.stringify(negIds(["月徳合"], [], "月徳合")) === JSON.stringify(MARRIAGE_BUILD), negIds(["月徳合"], [], "月徳合").join("・"));
  check("Q1 月徳合の日も解除・祭祀は宜", pos.includes("解除") && pos.includes("祭祀"));
  check("Q1 月徳（月徳合ではない）は変更なし（嫁娶は宜）", posIds(["月徳"], "月徳").includes("嫁娶"));
}

// 3. Q6 十二建除・二十八宿の言い回しは移さない（Q4 の顕星・曲星・傅星は 2026-10-26 に実装済み）
check("Q6 満の profile は削除済み言い回し（養子・集金・宴会）を持たない",
  !ACTIVITY_PROFILES.some((p) => p.sourceType === "jianchu" && p.sourceName === "満" && p.favorableActivityIds.some((a) => ["進人口", "納財", "宴會"].includes(a))));

// 4. Q5 嫁娶は主要用事
check("Q5 嫁娶は主要用事に含まれる", LUCKY_DAY_PRIMARY_ACTIVITY_IDS.includes("嫁娶"));
check("Q5 主要用事は64件・重複なし", LUCKY_DAY_PRIMARY_ACTIVITY_IDS.length === 64 && new Set(LUCKY_DAY_PRIMARY_ACTIVITY_IDS).size === 64, String(LUCKY_DAY_PRIMARY_ACTIVITY_IDS.length));

// 5. 成立する神殺と profile の対応（2026年を通しで集計）
const emittedK = new Set<string>();
const emittedY = new Set<string>();
let saitokuDay: string | null = null;
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 86400000) {
  const d = new Date(t);
  const r = calculateTakujitsuFull({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  r.shinsatsu.kichijin.forEach((n) => emittedK.add(n));
  r.shinsatsu.kyojin.forEach((n) => emittedY.add(n));
  if (!saitokuDay && r.shinsatsu.kichijin.includes("歳徳")) {
    const ev = r.activities.evaluations.find((e) => e.activityId === "解除");
    if (ev?.positiveSources.some((s) => s.sourceName === "歳徳")) saitokuDay = d.toISOString().slice(0, 10);
  }
}
check("実日付で歳徳の日の解除に歳徳の宜が付く", saitokuDay !== null);
const kNoProf = [...emittedK].filter((n) => !ACTIVITY_PROFILES.some((p) => p.sourceType === "kichijin" && p.sourceName === n));
const yNoProf = [...emittedY].filter((n) => !ACTIVITY_PROFILES.some((p) => p.sourceType === "kyojin" && p.sourceName === n));
check("成立する吉神はすべて profile あり", kNoProf.length === 0, kNoProf.join("・"));
// 制日・伐日は別スレッドの確定仕様に任せ、ここでは対象外とする
check("成立する凶神（制日・伐日を除く）はすべて profile あり",
  yNoProf.filter((n) => n !== "制日" && n !== "伐日").length === 0, yNoProf.join("・"));
for (const n of ["満日", "血忌", "天恩", "月空"]) {
  check(`${n} は未実装（成立しない）`, !emittedK.has(n) && !emittedY.has(n));
}
const dupProfiles = ACTIVITY_PROFILES.map((p) => `${p.sourceType}:${p.sourceName}`).filter((x, i, a) => a.indexOf(x) !== i);
check("profile の重複なし", dupProfiles.length === 0, dupProfiles.join("・"));

// 6. resolution ルールの接続（対象名・条件名がすべて実在する神殺名）
const allNames = new Set([...emittedK, ...emittedY, ...ACTIVITY_PROFILES.map((p) => p.sourceName)]);
for (const r of RESOLUTION_RULES) {
  const bad = [...r.targets, ...r.requires.flatMap((g) => g.names)].filter((n) => !allNames.has(n));
  check(`resolution No.${r.id} の対象・条件名が実在`, bad.length === 0, bad.join("・"));
  if (r.kind === "reduce") {
    for (const t of r.targets) {
      const p = ACTIVITY_PROFILES.find((x) => x.sourceName === t);
      check(`resolution No.${r.id}（reduce）${t} に軽減後の残存忌`, (p?.reducedStillUnfavorableActivityIds?.length ?? 0) > 0);
    }
  }
}
check("resolution ルール ID の重複なし", new Set(RESOLUTION_RULES.map((r) => r.id)).size === RESOLUTION_RULES.length);

// 7. 一般向け接続
const ids = ACTIVITY_DEFINITIONS.map((d) => d.id);
check("全用事に表示グループあり", ids.every((i) => Boolean(ACTIVITY_GROUP_BY_ID[i])));
check("表示グループに余分な id なし", Object.keys(ACTIVITY_GROUP_BY_ID).every((k) => ids.includes(k)));
check("全用事に一般向けラベルあり（原名のままの用事なし）",
  ids.every((i) => getLuckyDayActivityLabel(i) !== ACTIVITY_DEFINITIONS.find((d) => d.id === i)!.canonicalName));
const labels = ids.map((i) => getLuckyDayActivityLabel(i));
check("一般向けラベルの重複なし", new Set(labels).size === labels.length);
check("主要用事はすべて実在 id", LUCKY_DAY_PRIMARY_ACTIVITY_IDS.every((i) => ids.includes(i)));
const purposeIds = Object.values(LUCKY_DAY_PURPOSES_BY_CATEGORY).flat().map((p) => p.activityId);
check("目的の activityId はすべて実在 id", purposeIds.every((i) => ids.includes(i)));
check("解除は目的「厄除け・お祓いをする」から引ける",
  Object.values(LUCKY_DAY_PURPOSES_BY_CATEGORY).flat().some((p) => p.activityId === "解除"));

console.log("[区分B] 擇日 全体監査 P3（監修回答の反映と接続確認）");
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
