// tests/takujitsu_p1_batch_unit.manual.ts
//
// 目的:
//   擇日アプリ全体監査 P1 のうち、資料と既存決定だけで直せた項目（2026-10-24）を検証する。
//   ・P1-1 土符（井戸掘り＝開井）・月建＝小時（土府の專忌4件・建築）
//   ・P1-2 死気（定日）の修造・動土・修造動土・建築と、祝い事5件
//   ・P1-3 母倉の季月「巳午」は土王用事の成立日だけ
//   ・P1-5 原典語「修造動土」の修造・動土への分割（11件）
//   ・P1-6 五富・天倉・寶日・生氣・時陽の宜、八専の忌
//   ・監修回答 Q1〜Q6（土府系の土地展開・黒道6神・嫁娶の目的・上梁・交易）
//   ・一般向け purpose（土を掘る・工事を始める＝動土 など）への反映
//
// 実行:
//   npx tsx tests/takujitsu_p1_batch_unit.manual.ts

import { readFileSync } from "fs";
import { calculateTakujitsuFull, resolveBlackRoad, resolveDoyoMucang, resolveKichijinGroup2, resolveShinsatsuRelations } from "../src/lib/takujitsu";
import { ACTIVITY_PROFILES, ACTIVITY_TERM_EXPANSIONS, getActivityProfile } from "../src/lib/takujitsu/activity";
import type { ActivityProfile } from "../src/lib/takujitsu/activity";
import { evaluateActivities } from "../src/lib/takujitsu/activity/evaluateActivities";
import { resolveJianchu } from "../src/lib/takujitsu";
import { getLuckyDayPurposes } from "../src/lib/luckyDay/purposeMapping";

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

/** 判定時のプロファイル（展開適用後）。 */
function used(type: ActivityProfile["sourceType"], name: string): ActivityProfile {
  const p = getActivityProfile(type, name);
  if (!p) throw new Error(`profile なし: ${type}:${name}`);
  return p;
}
/** 原典転記（ACTIVITY_PROFILES）。 */
function raw(type: ActivityProfile["sourceType"], name: string): ActivityProfile {
  const p = ACTIVITY_PROFILES.find((x) => x.sourceType === type && x.sourceName === name);
  if (!p) throw new Error(`profile なし: ${type}:${name}`);
  return p;
}
const includesAll = (arr: readonly string[], ids: readonly string[]) => ids.every((id) => arr.includes(id));

function day(month: number, d: number) {
  return calculateTakujitsuFull({ year: 2026, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}
type Day = ReturnType<typeof day>;
function hasNeg(r: Day, id: string, source: string): boolean {
  return r.activities.evaluations.find((e) => e.activityId === id)?.negativeSources.some((s) => s.sourceName === source) === true;
}
function hasPos(r: Day, id: string, source: string): boolean {
  return r.activities.evaluations.find((e) => e.activityId === id)?.positiveSources.some((s) => s.sourceName === source) === true;
}

const JIANCHU_KEN = resolveJianchu({ monthBranch: "寅", dayBranch: "寅" });

// P1-1 土符・地嚢・小時（月建・土府）
{
  check("P1-1 土符の忌に開井（井戸掘り）", raw("kyojin", "土符").unfavorableActivityIds.includes("開井"));
  check("P1-1 土符は判定時に修造・動土も忌", includesAll(used("kyojin", "土符").unfavorableActivityIds, ["修造", "動土", "修造動土", "建築"]));
  check("P1-1 地嚢は判定時に修造・動土も忌", includesAll(used("kyojin", "地嚢").unfavorableActivityIds, ["修造", "動土", "修造動土"]));
  // Q1=A・Q2=C（2026-10-24 監修判断）：土府系3神に土王用事と同じ土地展開
  const LAND = ["起基定硬", "埋坑", "作厠", "修宅日", "造畜柵", "建築", "開井", "溝渠", "開道", "築垣", "補垣塞穴", "造倉庫", "啓攢", "啓墳"];
  for (const n of ["土符", "地嚢", "小時"]) {
    check(`Q1 ${n} は判定時に土地展開14件も忌`, includesAll(used("kyojin", n).unfavorableActivityIds, LAND));
  }
  check("Q2 地嚢は判定時に建築・補垣塞穴も忌", includesAll(used("kyojin", "地嚢").unfavorableActivityIds, ["建築", "補垣塞穴"]));
  const redLand = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: ["月徳"], kyojin: ["小時"] }), buildingDay: JIANCHU_KEN });
  check("Q1 小時＋月徳：土地展開の忌は外れ、動土だけ残る",
    !redLand.evaluations.some((e) => ["起基定硬", "作厠", "開井"].includes(e.activityId) && e.negativeSources.some((s) => s.sourceName === "小時")) &&
    redLand.evaluations.find((e) => e.activityId === "動土")?.negativeSources.some((s) => s.sourceName === "小時") === true);
  const shoji = used("kyojin", "小時");
  check("P1-1 小時に土府の專忌4件", includesAll(raw("kyojin", "小時").unfavorableActivityIds, ["開渠穿井", "安碓磑", "修補垣牆", "平治道塗"]));
  check("P1-1 小時に建築（擇日テキスト4））", raw("kyojin", "小時").unfavorableActivityIds.includes("建築"));
  check("P1-1 小時は判定時に修造・動土も忌", includesAll(shoji.unfavorableActivityIds, ["修造", "動土"]));
  check("P1-1 小時の軽減後の残存忌は修造動土・伐木・動土", JSON.stringify([...(shoji.reducedStillUnfavorableActivityIds ?? [])].sort()) ===
    JSON.stringify(["修造動土", "伐木", "動土"].sort()));
  // 天徳で軽減：動土は残り、修造・建築・土府專忌は外れる（象意「止忌動土」）
  const red = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: ["天徳"], kyojin: ["小時"] }), buildingDay: JIANCHU_KEN });
  const negBy = (id: string) => red.evaluations.find((e) => e.activityId === id)?.negativeSources.some((s) => s.sourceName === "小時") === true;
  check("P1-1 小時＋天徳：動土は小時の忌が残る", negBy("動土"));
  for (const id of ["修造", "建築", "開渠穿井", "平治道塗"]) check(`P1-1 小時＋天徳：${id} の小時の忌は外れる`, !negBy(id));

  const dofu = day(11, 14);
  check("P1-1 2026-11-14 は土符", dofu.shinsatsu.kyojin.includes("土符"));
  for (const id of ["動土", "修造", "開井"]) check(`P1-1 2026-11-14 ${id} に土符の忌`, hasNeg(dofu, id, "土符"));
  const chinou = day(11, 22);
  check("P1-1 2026-11-22 は地嚢で動土に地嚢の忌", chinou.shinsatsu.kyojin.includes("地嚢") && hasNeg(chinou, "動土", "地嚢"));
  const ken = day(11, 9);
  check("P1-1 2026-11-09 は小時で建築・動土に小時の忌", ken.shinsatsu.kyojin.includes("小時") && hasNeg(ken, "建築", "小時") && hasNeg(ken, "動土", "小時"));
}

// P1-2 死気（定日）
{
  const ids = ["修造", "動土", "修造動土", "建築", "祝賀", "寿器", "上官赴任", "入学求師", "冠帶"];
  check("P1-2 死気に建築系4件と祝い事5件", includesAll(raw("kyojin", "死気").unfavorableActivityIds, ids));
  for (const id of ["結婚姻", "嫁娶", "納采", "宴會"]) check(`P1-2 死気に ${id} は加えていない`, !raw("kyojin", "死気").unfavorableActivityIds.includes(id));
  const r = day(11, 13);
  check("P1-2 2026-11-13 は死気（定日）", r.shinsatsu.kyojin.includes("死気") && r.buildingDay.name === "定");
  for (const id of ids) check(`P1-2 2026-11-13 ${id} に死気の忌`, hasNeg(r, id, "死気"));
}

// P1-3 母倉の季月「巳午」
{
  const tbl = (mb: string, db: string) => resolveKichijinGroup2({ yearStem: "甲", monthBranch: mb, dayStem: "甲", dayBranch: db }).kichijin.includes("母倉");
  for (const mb of ["辰", "未", "戌", "丑"]) {
    for (const db of ["巳", "午"]) {
      check(`P1-3 月表だけでは ${mb}月${db}日は母倉にならない`, !tbl(mb, db));
      check(`P1-3 ${mb}月${db}日＋土王用事 → 母倉`, resolveDoyoMucang({ monthBranch: mb, dayBranch: db }, true).kichijin.includes("母倉"));
      check(`P1-3 ${mb}月${db}日・土王用事なし → 母倉でない`, resolveDoyoMucang({ monthBranch: mb, dayBranch: db }, false).kichijin.length === 0);
    }
  }
  check("P1-3 季月の本来の母倉（戌月の辰戌丑未）は従来どおり", tbl("戌", "辰") && tbl("戌", "未"));
  check("P1-3 季月以外では土王用事でも巳午を足さない", resolveDoyoMucang({ monthBranch: "寅", dayBranch: "巳" }, true).kichijin.length === 0);
  check("P1-3 季月でも巳午以外は足さない", resolveDoyoMucang({ monthBranch: "戌", dayBranch: "子" }, true).kichijin.length === 0);
  for (const [m, d, expect] of [[10, 10, false], [10, 11, false], [10, 22, true], [10, 23, true], [11, 3, true], [11, 4, true]] as const) {
    const r = day(m, d);
    check(`P1-3 2026-${m}-${d}（戌月・${expect ? "土用中" : "土用前"}）母倉=${expect}`, r.shinsatsu.kichijin.includes("母倉") === expect);
  }
}

// P1-5 修造動土 → 修造・動土
{
  const split = ACTIVITY_TERM_EXPANSIONS.filter((e) => e.sourceTerm === "修造動土" && JSON.stringify(e.expandedActivityIds) === JSON.stringify(["修造", "動土"]));
  check("P1-5 修造動土→修造・動土の分割は11件", split.length === 11, String(split.length));
  for (const [t, n] of [["kyojin", "小時"], ["kyojin", "血支"], ["kyojin", "大時"], ["kyojin", "天吏"], ["kyojin", "土符"], ["kyojin", "地嚢"], ["kyojin", "五墓"]] as const) {
    check(`P1-5 ${n} は判定時に修造・動土を忌`, includesAll(used(t, n).unfavorableActivityIds, ["修造", "動土"]));
    if (!["土符", "地嚢", "小時"].includes(n)) {
      check(`P1-5 ${n} に建築は自動継承しない`, raw(t, n).unfavorableActivityIds.includes("建築") || !used(t, n).unfavorableActivityIds.includes("建築"));
    }
  }
  for (const [t, n] of [["jianchu", "開"], ["kichijin", "四相"], ["kichijin", "時徳"], ["kichijin", "三合"]] as const) {
    check(`P1-5 ${n} は判定時に修造・動土を宜`, includesAll(used(t, n).favorableActivityIds, ["修造", "動土"]));
  }
  const r = day(10, 13); // 開日
  check("P1-5 2026-10-13 は開日で修造・動土に開の宜", r.buildingDay.name === "開" && hasPos(r, "修造", "開") && hasPos(r, "動土", "開"));
}

// P1-6 吉神の宜・八専の忌
{
  check("P1-6 五富の宜10件", includesAll(raw("kichijin", "五富").favorableActivityIds, ["経絡", "醞釀", "開市", "立券交易", "納財", "開倉庫", "出貨財", "栽種", "牧養", "納畜"]));
  check("P1-6 天倉の宜に修倉庫・進人口・納畜", includesAll(raw("kichijin", "天倉").favorableActivityIds, ["修倉庫", "進人口", "納畜", "納財", "牧養"]));
  check("P1-6 寶日の宜に牧養・納畜", includesAll(raw("kichijin", "寶日").favorableActivityIds, ["栽種", "牧養", "納畜"]));
  check("P1-6 生氣の宜に栽種", raw("kichijin", "生氣").favorableActivityIds.includes("栽種"));
  check("P1-6 時陽の宜に栽種", raw("kichijin", "時陽").favorableActivityIds.includes("栽種"));
  check("P1-6 八専の忌に結婚姻・納采", includesAll(raw("kyojin", "八専").unfavorableActivityIds, ["出軍", "嫁娶", "結婚姻", "納采"]));
  const gofu = day(11, 12);
  check("P1-6 2026-11-12 は五富で開市に五富の宜", gofu.shinsatsu.kichijin.includes("五富") && hasPos(gofu, "開市", "五富"));
  const hassen = day(11, 29);
  check("P1-6 2026-11-29 は八専で結婚姻に八専の忌", hassen.shinsatsu.kyojin.includes("八専") && hasNeg(hassen, "結婚姻", "八専"));
}

// Q3 黒道6神（成立は擇日テキスト28）の表。COMPOSITE で凶神の忌・吉神の宜に従う）
{
  const BLACK = ["天刑", "朱雀", "白虎", "天牢", "元武", "勾陳"];
  // 寅月の表：天刑寅・朱雀卯・白虎午・天牢申・元武酉・勾陳亥
  const tora: Record<string, string> = { 天刑: "寅", 朱雀: "卯", 白虎: "午", 天牢: "申", 元武: "酉", 勾陳: "亥" };
  for (const [g, b] of Object.entries(tora)) {
    check(`Q3 寅月${b}日は${g}`, JSON.stringify(resolveBlackRoad({ yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: b }).kyojin) === JSON.stringify([g]));
  }
  for (const b of ["子", "丑", "辰", "巳", "未", "戌"]) {
    check(`Q3 寅月${b}日は黒道ではない`, resolveBlackRoad({ yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: b }).kyojin.length === 0);
  }
  // 擇日実例.pdf 720行と照合
  const rows = JSON.parse(readFileSync("tests/fixtures/jitsurei_720_tokenized.json", "utf8")) as
    { monthBranch: string; ganzhi: string; kichijinRaw: string; kyojinRaw: string; gap?: boolean }[];
  let ok = 0;
  let ng = 0;
  for (const r of rows) {
    if (r.gap) continue;
    const got = resolveBlackRoad({ yearStem: "甲", monthBranch: r.monthBranch, dayStem: r.ganzhi[0], dayBranch: r.ganzhi[1] }).kyojin;
    for (const g of BLACK) {
      const inRaw = (r.kichijinRaw + r.kyojinRaw).includes(g);
      if (inRaw === got.includes(g)) ok += 1; else ng += 1;
    }
  }
  check("Q3 黒道6神は擇日実例720行と完全一致", ng === 0 && ok > 4000, `一致${ok} 不一致${ng}`);
  for (const g of BLACK) {
    const p = used("kyojin", g);
    check(`Q3 ${g} は COMPOSITE・固有の宜忌なし`, p.composite === true && p.favorableActivityIds.length === 0 && p.unfavorableActivityIds.length === 0);
  }
  // 単独：何も生成しない／凶神と併：その凶神の忌に従う（判定は変えない）
  const alone = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: [], kyojin: ["白虎"] }), buildingDay: JIANCHU_KEN });
  check("Q3 白虎単独では白虎由来の宜忌を生成しない",
    !alone.evaluations.some((e) => [...e.positiveSources, ...e.negativeSources].some((x) => x.sourceName === "白虎")));
  const withGetsuha = evaluateActivities({ resolution: resolveShinsatsuRelations({ kichijin: [], kyojin: ["白虎", "八専"] }), buildingDay: JIANCHU_KEN });
  const kaju = withGetsuha.evaluations.find((e) => e.activityId === "嫁娶");
  check("Q3 白虎＋八専：嫁娶に白虎が八専の忌として付く", kaju?.negativeSources.some((s) => s.sourceName === "白虎" && s.sourceType === "kyojin") === true);
  check("Q3 白虎＋八専：嫁娶は bad のまま（判定は変えない）", kaju?.verdict === "bad");
  const shuzo = withGetsuha.evaluations.find((e) => e.activityId === "修造");
  check("Q3 白虎＋八専：八専の忌に無い修造には付かない", shuzo === undefined);
  // 実日付：12日間で黒道の日は6日、1日に2つ以上は成立しない
  let blackDays = 0;
  let multi = false;
  for (let d = 8; d <= 19; d += 1) { // 亥月（立冬 11/07 の翌日から）の連続12日
    const n = day(11, d).shinsatsu.kyojin.filter((x) => BLACK.includes(x)).length;
    if (n > 0) blackDays += 1;
    if (n > 1) multi = true;
  }
  check("Q3 2026-11-08〜19（亥月の連続12日）の黒道の日は6日（1日1神まで）", blackDays === 6 && !multi, String(blackDays));
}

// Q5 堅柱上樑→上梁・Q6 立券交易→交易（忌側だけ）
{
  for (const n of ["小時", "血支", "大時", "天吏", "天空"]) check(`Q5 ${n} は判定時に上梁も忌`, used("kyojin", n).unfavorableActivityIds.includes("上梁"));
  check("Q5 宜側（月恩・三合など）の堅柱上樑は上梁へ広げない", !used("kichijin", "月恩").favorableActivityIds.includes("上梁"));
  for (const n of ["大時", "天吏", "四耗", "小耗", "四窮", "五墓", "九空", "月害", "八節日（二至二分）", "四方耗", "長星", "短星"]) {
    check(`Q6 ${n} は判定時に交易も忌`, used("kyojin", n).unfavorableActivityIds.includes("交易"));
  }
  check("Q6 宜側（三合・民日など）の立券交易は交易へ広げない（民日は原典に交易あり）",
    !used("kichijin", "五富").favorableActivityIds.includes("交易"));
  const r = day(11, 11); // 四方耗
  check("Q6 2026-11-11（四方耗）交易に四方耗の忌", hasNeg(r, "交易", "四方耗"));
}

// 一般向け purpose への反映
{
  const ids = (cat: string) => getLuckyDayPurposes(cat).map((p) => p.activityId);
  check("一般向け：「土を掘る・工事を始める」は動土", ids("housing-build").includes("動土") && ids("housing-land").includes("動土"));
  check("一般向け：「新築・リフォーム工事をする」は修造", ids("housing-renovate").includes("修造"));
  const dofu = day(11, 14);
  const ev = dofu.activities.evaluations.find((e) => e.activityId === "動土");
  check("一般向け：2026-11-14（土符）の動土は「適したこと」「用いて良いこと」にならない", ev !== undefined && ev.verdict !== "good" && ev.verdict !== "neutral", ev?.verdict);
  check("一般向け：「結婚式を挙げる」は結婚姻（八専の忌が反映される）", ids("life-marriage").includes("結婚姻"));
  check("Q4 一般向け：目的に嫁娶（結婚（嫁入り・嫁取り）する）を追加", getLuckyDayPurposes("life-marriage").some((p) => p.activityId === "嫁娶" && p.label === "結婚（嫁入り・嫁取り）する"));
  check("Q4 嫁娶の忌は結婚姻に広げない（エンジンは変えない）", !used("kyojin", "周堂殺").unfavorableActivityIds.includes("結婚姻"));
  check("Q5 一般向け：「梁を工事する」は上梁（堅柱上樑の忌が反映される）", ids("housing-build").includes("上梁"));
  check("Q6 一般向け：「商売・取引を始める」は交易（立券交易の忌が反映される）", ids("work-open").includes("交易"));
}

console.log("[区分B] 擇日 全体監査 P1 一括修正");
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
