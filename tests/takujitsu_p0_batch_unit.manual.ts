// tests/takujitsu_p0_batch_unit.manual.ts
//
// 目的:
//   擇日アプリ全体監査 P0-2〜P0-12 のうち、資料だけで直せた項目（2026-10-24）を神殺ごとに検証する。
//   ・P0-2 大空亡・小空亡の忌（製寿衣）／天乙絶気から製寿衣を外す
//   ・P0-3 天馬の宜（家族会議・遠行）／六黄道から外す
//   ・P0-4 六儀の祝事（入学・就職）／驛馬から外す
//   ・P0-6 四方耗の忌6件
//   ・P0-7 歸忌の忌4件
//   ・P0-8 往亡・氣往亡の忌（擇日テキスト17）と神殺象意の和）
//   ・P0-9 移徙→移徒（民日・開日・血支・大時・天吏・五墓・往亡）
//   ・P0-10 八節日の種類分け（全体・二至二分・冬至）
//   ・P0-11 二十八宿（危・胃の裁衣忌、角の堅柱上樑宜）
//   ・P0-12 五合の種類分け（天地合・日月合・人民合・金石合・江河合）
//
// 実行:
//   npx tsx tests/takujitsu_p0_batch_unit.manual.ts

import { calculateTakujitsuFull, resolveWuheSubtypes, RESOLUTION_RULES } from "../src/lib/takujitsu";
import { ACTIVITY_BY_ID, getActivityProfile } from "../src/lib/takujitsu/activity";
import { CATEGORY_BY_ID } from "../src/lib/takujitsu/activity/activityCategories";
import type { ActivityProfile } from "../src/lib/takujitsu/activity";

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

function prof(type: ActivityProfile["sourceType"], name: string): ActivityProfile {
  const p = getActivityProfile(type, name);
  if (!p) throw new Error(`profile なし: ${type}:${name}`);
  return p;
}
const same = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function day(year: number, month: number, d: number) {
  return calculateTakujitsuFull({ year, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}
type Day = ReturnType<typeof day>;
function hasNeg(r: Day, id: string, source: string): boolean {
  return r.activities.evaluations.find((e) => e.activityId === id)?.negativeSources.some((s) => s.sourceName === source) === true;
}
function hasPos(r: Day, id: string, source: string): boolean {
  return r.activities.evaluations.find((e) => e.activityId === id)?.positiveSources.some((s) => s.sourceName === source) === true;
}

const t0 = () => prof("kyojin", "天乙絶気");

// Q1 揚公忌（判定しない）・探病忌日（求醫療病の忌）
{
  check("Q1 揚公忌の profile は無い", getActivityProfile("kyojin", "揚公忌") === undefined);
  check("Q1 探病忌日の忌は求醫療病", same(prof("kyojin", "探病忌日").unfavorableActivityIds, ["求醫療病"]));
  let tan: Day | undefined;
  let youkou = false;
  for (let t = Date.UTC(2026, 10, 1); t < Date.UTC(2027, 1, 1); t += 86_400_000) {
    const dt = new Date(t);
    const r = day(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (r.shinsatsu.kyojin.includes("揚公忌")) youkou = true;
    if (!tan && r.shinsatsu.kyojin.includes("探病忌日")) tan = r;
  }
  check("Q1 2026-11〜2027-01 に揚公忌は出ない", !youkou);
  check("Q1 探病忌日の日は求醫療病に探病忌日の忌", tan !== undefined && hasNeg(tan, "求醫療病", "探病忌日"));
}

// P0-2 大空亡・小空亡 ⇄ 天乙絶気
{
  check("P0-2 大空亡の忌は製寿衣・寿具", same(prof("kyojin", "大空亡").unfavorableActivityIds, ["製寿衣", "寿具"]));
  check("P0-2 小空亡の忌は製寿衣・寿具", same(prof("kyojin", "小空亡").unfavorableActivityIds, ["製寿衣", "寿具"]));
  check("Q3 寿具は新設の用事（葬祭・墓）", ACTIVITY_BY_ID["寿具"] !== undefined && CATEGORY_BY_ID.get("寿具") === "葬祭・墓");
  check("Q2 天乙絶気の忌は資料が喜び事と明示する5件", same(t0().unfavorableActivityIds, ["祝賀", "寿器", "上官赴任", "入学求師", "冠帶"]));
  for (const id of ["求嗣", "進人口", "栽種"]) {
    check(`Q2 天乙絶気に神殺象意の ${id} は入れていない`, !t0().unfavorableActivityIds.includes(id));
  }
  for (const id of ["結婚姻", "嫁娶", "宴會", "會親友"]) check(`Q2 天乙絶気に保留候補の ${id} は入れていない`, !t0().unfavorableActivityIds.includes(id));
  const t = prof("kyojin", "天乙絶気");
  check("P0-2 天乙絶気から製寿衣を外した", !t.unfavorableActivityIds.includes("製寿衣"));
  check("P0-2 天乙絶気の可（埋坑・作厠・安碓磑）は維持", same(t.favorableActivityIds, ["埋坑", "作厠", "安碓磑"]));
  const a = day(2026, 11, 1);
  check("P0-2 2026-11-01 は大空亡", a.shinsatsu.kyojin.includes("大空亡"));
  check("P0-2 2026-11-01 製寿衣に大空亡の忌", hasNeg(a, "製寿衣", "大空亡"));
  check("Q3 2026-11-01 寿具に大空亡の忌", hasNeg(a, "寿具", "大空亡"));
  const b = day(2026, 11, 23);
  check("P0-2 2026-11-23 は天乙絶気", b.shinsatsu.kyojin.includes("天乙絶気"));
  check("P0-2 2026-11-23 製寿衣に天乙絶気の忌は付かない", !hasNeg(b, "製寿衣", "天乙絶気"));
  for (const id of ["祝賀", "寿器", "上官赴任", "入学求師", "冠帶"]) {
    const ev = b.activities.evaluations.find((e) => e.activityId === id);
    check(`Q2 2026-11-23 ${id} に天乙絶気の忌が付き、吉ではない`, hasNeg(b, id, "天乙絶気") && ev?.verdict !== "good", ev?.verdict);
  }
  for (const id of ["埋坑", "作厠", "安碓磑"]) check(`Q2 2026-11-23 ${id} は天乙絶気の可（宜）を維持`, hasPos(b, id, "天乙絶気"));
}

// P0-3 天馬 ⇄ 六黄道
{
  check("P0-3/Q4 天馬の宜は家族会議・遠行・上表彰", same(prof("kichijin", "天馬").favorableActivityIds, ["家族会議", "遠行", "上表彰"]));
  for (const g of ["青龍", "明堂", "金匱", "寶光", "玉堂", "司命"]) {
    check(`P0-3 ${g} に固有の宜は無い`, prof("kichijin", g).favorableActivityIds.length === 0);
  }
  for (const g of ["青龍", "明堂", "寶光", "玉堂", "司命"]) {
    check(`P0-3 ${g} の COMPOSITE は維持`, prof("kichijin", g).composite === true);
  }
  check("P0-3 金匱は COMPOSITE ではない（従来どおり）", prof("kichijin", "金匱").composite !== true);
}

// P0-4 六儀 ⇄ 驛馬
{
  check("P0-4 六儀の宜は牧養・栽種・入学求師・上官赴任", same(prof("kichijin", "六儀").favorableActivityIds, ["牧養", "栽種", "入学求師", "上官赴任"]));
  check("P0-4 驛馬の宜は求醫療病・祈福・移徒", same(prof("kichijin", "驛馬").favorableActivityIds, ["求醫療病", "祈福", "移徒"]));
}

// P0-6 四方耗
{
  check("P0-6 四方耗の忌6件", same(prof("kyojin", "四方耗").unfavorableActivityIds, ["出行", "開市", "立券交易", "納財", "造倉庫", "造船"]));
  const r = day(2026, 11, 11);
  check("P0-6 2026-11-11 は四方耗", r.shinsatsu.kyojin.includes("四方耗"));
  for (const id of ["出行", "開市", "立券交易", "納財"]) check(`P0-6 2026-11-11 ${id} に四方耗の忌`, hasNeg(r, id, "四方耗"));
}

// P0-7 歸忌
{
  check("P0-7/Q6 歸忌の忌6件", same(prof("kyojin", "歸忌").unfavorableActivityIds, ["移徒", "遠行", "嫁娶", "搬入", "出行", "入宅"]));
  const r = day(2026, 11, 11);
  check("P0-7 2026-11-11 は歸忌", r.shinsatsu.kyojin.includes("歸忌"));
  for (const id of ["移徒", "遠行", "嫁娶", "搬入", "出行", "入宅"]) check(`P0-7 2026-11-11 ${id} に歸忌の忌`, hasNeg(r, id, "歸忌"));
}

// P0-8 往亡・氣往亡
{
  const all = ["出軍", "上官赴任", "嫁娶", "進人口", "搬入", "求醫療病", "畋獵", "取魚", "移徒", "捕捉"];
  check("P0-8 往亡の忌10件", same(prof("kyojin", "往亡").unfavorableActivityIds, all));
  check("P0-8 氣往亡の忌10件", same(prof("kyojin", "氣往亡").unfavorableActivityIds, all));
  const r = day(2026, 11, 2);
  check("P0-8 2026-11-02 は往亡", r.shinsatsu.kyojin.includes("往亡"));
  for (const id of ["移徒", "出軍", "搬入"]) check(`P0-8 2026-11-02 ${id} に往亡の忌`, hasNeg(r, id, "往亡"));
}

// P0-9 移徙→移徒
{
  for (const n of ["民日"]) check(`P0-9 ${n} の宜に移徒`, prof("kichijin", n).favorableActivityIds.includes("移徒"));
  check("P0-9 開日の宜に移徒", prof("jianchu", "開").favorableActivityIds.includes("移徒"));
  for (const n of ["血支", "大時", "天吏", "五墓", "往亡"]) check(`P0-9 ${n} の忌に移徒`, prof("kyojin", n).unfavorableActivityIds.includes("移徒"));
}

// P0-10 八節日
{
  check("P0-10 八節日（全体）の忌は嫁娶だけ", same(prof("kyojin", "八節日").unfavorableActivityIds, ["嫁娶"]));
  check("P0-10 八節日（二至二分）の忌12件", same(prof("kyojin", "八節日（二至二分）").unfavorableActivityIds,
    ["上官赴任", "會親友", "出行", "進人口", "結婚姻", "納采", "移徒", "入宅", "開市", "立券交易", "畋獵", "取魚"]));
  check("P0-10 八節日（冬至）の忌は伐木", same(prof("kyojin", "八節日（冬至）").unfavorableActivityIds, ["伐木"]));
  const rule20 = RESOLUTION_RULES.find((r) => r.id === "20");
  check("P0-10 解除ルールNo.20（尚忌）は3種すべてが対象", !!rule20 && same(rule20.targets, ["八節日", "八節日（二至二分）", "八節日（冬至）"]));

  const risshun = day(2027, 2, 4);
  check("P0-10 2027-02-04（立春）は八節日だけ", risshun.shinsatsu.kyojin.includes("八節日") &&
    !risshun.shinsatsu.kyojin.includes("八節日（二至二分）") && !risshun.shinsatsu.kyojin.includes("八節日（冬至）"));
  check("P0-10 立春：嫁娶に八節日の忌", hasNeg(risshun, "嫁娶", "八節日"));
  for (const id of ["伐木", "上官赴任", "開市"]) {
    check(`P0-10 立春：${id} に八節日系の忌は付かない`, !["八節日", "八節日（二至二分）", "八節日（冬至）"].some((n) => hasNeg(risshun, id, n)));
  }
  const shunbun = day(2027, 3, 21);
  check("P0-10 2027-03-21（春分）は八節日＋二至二分（冬至なし）", shunbun.shinsatsu.kyojin.includes("八節日") &&
    shunbun.shinsatsu.kyojin.includes("八節日（二至二分）") && !shunbun.shinsatsu.kyojin.includes("八節日（冬至）"));
  check("P0-10 春分：上官赴任に二至二分の忌", hasNeg(shunbun, "上官赴任", "八節日（二至二分）"));
  check("P0-10 春分：伐木に八節日系の忌は付かない", !["八節日", "八節日（二至二分）", "八節日（冬至）"].some((n) => hasNeg(shunbun, "伐木", n)));
  const touji = day(2026, 12, 22);
  check("P0-10 2026-12-22（冬至）は3種すべて", ["八節日", "八節日（二至二分）", "八節日（冬至）"].every((n) => touji.shinsatsu.kyojin.includes(n)));
  check("P0-10 冬至：伐木に八節日（冬至）の忌", hasNeg(touji, "伐木", "八節日（冬至）"));
}

// P0-11 二十八宿
{
  check("P0-11 危宿の忌に裁衣", prof("shuku28", "危").unfavorableActivityIds.includes("裁衣"));
  check("P0-11 胃宿の忌に裁衣", prof("shuku28", "胃").unfavorableActivityIds.includes("裁衣"));
  check("P0-11 角宿の宜に堅柱上樑", prof("shuku28", "角").favorableActivityIds.includes("堅柱上樑"));
  const jo = prof("shuku28", "女");
  check("Q5 女宿は剃頭以外すべて忌", jo.negativeMode === "all_except" && same(jo.exceptionActivityIds ?? [], ["剃頭"]) && jo.favorableActivityIds.length === 0);
  const joDay = day(2026, 11, 21);
  check("Q5 2026-11-21 は女宿", joDay.shuku28?.lodge === "女");
  check("Q5 2026-11-21 安葬に女宿の忌（吉ではない）", hasNeg(joDay, "安葬", "女") &&
    joDay.activities.evaluations.find((e) => e.activityId === "安葬")?.verdict !== "good");
  check("Q5 2026-11-21 剃頭に女宿の忌は付かない", !hasNeg(joDay, "剃頭", "女"));
  const ki = day(2026, 11, 23);
  check("P0-11 2026-11-23 は危宿で裁衣に危の忌", ki.shuku28?.lodge === "危" && hasNeg(ki, "裁衣", "危"));
  const i = day(2026, 11, 28);
  check("P0-11 2026-11-28 は胃宿で裁衣に胃の忌", i.shuku28?.lodge === "胃" && hasNeg(i, "裁衣", "胃"));
  const kaku = day(2027, 2, 4);
  check("P0-11 2027-02-04 は角宿で堅柱上樑に角の宜", kaku.shuku28?.lodge === "角" && hasPos(kaku, "堅柱上樑", "角"));
}

// P0-12 五合
{
  check("Q3 寿器は新設の用事（生活）", ACTIVITY_BY_ID["寿器"] !== undefined && CATEGORY_BY_ID.get("寿器") === "生活");
  check("P0-12 五合（共通）の宜は神殺象意の3件", same(prof("kichijin", "五合").favorableActivityIds, ["結婚姻", "宴會", "立券交易"]));
  const expected: Record<string, string[]> = {
    天地合: ["祈福"], 日月合: ["開光"], 人民合: ["結婚姻"], 金石合: ["寿器"], 江河合: ["乗船渡水", "移徒"],
  };
  for (const [n, ids] of Object.entries(expected)) check(`P0-12 ${n} の宜`, same(prof("kichijin", n).favorableActivityIds, ids));
  const byGanzhi: [string, string, string][] = [
    ["甲", "寅", "天地合"], ["乙", "卯", "天地合"], ["丙", "寅", "日月合"], ["丁", "卯", "日月合"],
    ["戊", "寅", "人民合"], ["己", "卯", "人民合"], ["庚", "寅", "金石合"], ["辛", "卯", "金石合"],
    ["壬", "寅", "江河合"], ["癸", "卯", "江河合"],
  ];
  for (const [stem, branch, n] of byGanzhi) {
    const r = resolveWuheSubtypes({ yearStem: "甲", monthBranch: "寅", dayStem: stem, dayBranch: branch });
    check(`P0-12 ${stem}${branch} は ${n}`, same(r.kichijin, [n]));
  }
  check("P0-12 五合以外の干支では種類を返さない", resolveWuheSubtypes({ yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: "子" }).kichijin.length === 0);

  // 実日付：五合の日を探して、その種類の宜だけが付くこと（他の種類の宜が付かないこと）
  const found = new Set<string>();
  for (let t = Date.UTC(2026, 10, 1); t < Date.UTC(2027, 1, 1) && found.size < 5; t += 86_400_000) {
    const dt = new Date(t);
    const r = day(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    const sub = Object.keys(expected).find((n) => r.shinsatsu.kichijin.includes(n));
    if (!sub || found.has(sub)) continue;
    found.add(sub);
    check(`P0-12 ${dt.toISOString().slice(0, 10)}（${sub}）は五合も成立`, r.shinsatsu.kichijin.includes("五合"));
    for (const [n, ids] of Object.entries(expected)) {
      for (const id of ids) {
        const pos = hasPos(r, id, n);
        check(`P0-12 ${dt.toISOString().slice(0, 10)}（${sub}）${id} の ${n} 由来の宜は${n === sub ? "あり" : "なし"}`, pos === (n === sub));
      }
    }
  }
  check("P0-12 実日付で5種すべてを確認", found.size === 5, [...found].join("・"));
}

console.log("[区分B] 擇日 全体監査 P0-2〜P0-12 一括修正");
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
