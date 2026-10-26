// tests/takujitsu_unresolved_shinsatsu_unit.manual.ts
//
// 目的:
//   未解決神殺の資料研究フェーズの監修決定（2026-10-26）で追加した神殺を検証する。
//   ・Q1＝A 協紀辨方書を成立条件の出典に採用：復日・重日・五離・除神・天罡・河魁
//   ・Q2＝A 天狗＝申月の満日（戌日）
//   ・Q3＝B 天狗は歳徳・月徳が同宮すれば忌まない（擇日テキスト）
//   ・Q4＝C 血忌は保留（成立しない）
//   ・Q5＝B 顕星・曲星・傅星は擇日テキスト p.19 の表どおり成立し、宜は ALL型
//   ・復日・重日・五離の解除は神殺象意に明記された範囲だけ（五離の「天合」は PENDING_REVIEW で未接続、
//     三合への読み替えはしない）
//   ・洪氏錦嚢 p.62「五離用いて良い」は結婚納采の補足・異説（HONGSHI_NOTES）としてだけ持つ
//   ・天狗の「祈神・祈求・福願関係全般」→祈福は正式採用
//
// 実行:
//   npx tsx tests/takujitsu_unresolved_shinsatsu_unit.manual.ts

import jitsurei from "./fixtures/jitsurei_720_tokenized.json";
import {
  calculateTakujitsuFull,
  resolveKichijinGroup7,
  resolveKyoushinGroup7,
  resolveShinsatsuRelations,
  resolveJianchu,
  DEHE_GROUP,
  RESOLUTION_RULES,
} from "../src/lib/takujitsu";
import type { ShinsatsuInput } from "../src/lib/takujitsu/types";
import { ACTIVITY_DEFINITIONS, ACTIVITY_PROFILES, HONGSHI_NOTES, getHongshiNotesFor } from "../src/lib/takujitsu/activity";
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

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const GANZHI = Array.from({ length: 60 }, (_, i) => `${STEMS[i % 10]}${BRANCHES[i % 12]}`);

function input(monthBranch: string, ganzhi: string): ShinsatsuInput {
  return { yearStem: "甲", yearBranch: "子", monthStem: "丙", monthBranch, dayStem: ganzhi[0], dayBranch: ganzhi[1] } as ShinsatsuInput;
}
function names(monthBranch: string, ganzhi: string): string[] {
  const i = input(monthBranch, ganzhi);
  return [...resolveKichijinGroup7(i).kichijin, ...resolveKyoushinGroup7(i).kyojin];
}
function days(monthBranch: string, name: string): string[] {
  return GANZHI.filter((g) => names(monthBranch, g).includes(name));
}
function status(kichijin: string[], kyojin: string[], target: string): string | undefined {
  return resolveShinsatsuRelations({ kichijin, kyojin }).kyojin.find((e) => e.name === target)?.status;
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
const same = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const ALL_IDS = ACTIVITY_DEFINITIONS.map((d) => d.id).sort();

// 1. 顕星・曲星・傅星（擇日テキスト p.19 の表）
{
  const TABLE: Record<string, Record<string, string[]>> = {
    顕星: {
      季: ["乙丑", "甲戌", "癸未", "壬辰", "辛丑", "庚戌", "己未"],
      仲: ["丙寅", "乙亥", "甲申", "癸巳", "壬寅", "辛亥", "庚申"],
      孟: ["丁卯", "丙子", "乙酉", "甲午", "癸卯", "壬子", "辛酉"],
    },
    曲星: {
      季: ["丙寅", "乙亥", "甲申", "癸巳", "壬寅", "辛亥", "庚申"],
      仲: ["丁卯", "丙子", "乙酉", "甲午", "癸卯", "壬子", "辛酉"],
      孟: ["戊辰", "丁丑", "丙戌", "乙未", "甲辰", "癸丑", "壬戌"],
    },
    傅星: {
      季: ["己巳", "戊寅", "丁亥", "丙申", "乙巳", "甲寅", "癸亥"],
      仲: ["庚午", "己卯", "戊子", "丁酉", "丙午", "乙卯"],
      孟: ["辛未", "庚辰", "己丑", "戊戌", "丁未", "丙辰"],
    },
  };
  const CLASS_MONTHS: Record<string, string[]> = { 孟: ["寅", "申", "巳", "亥"], 仲: ["子", "午", "卯", "酉"], 季: ["辰", "戌", "未", "丑"] };
  for (const [star, byClass] of Object.entries(TABLE)) {
    for (const [cls, months] of Object.entries(CLASS_MONTHS)) {
      for (const m of months) {
        check(`顕星表 ${star} ${m}月（四${cls}月）`, same(days(m, star), byClass[cls]), days(m, star).join("・"));
      }
    }
    const p = ACTIVITY_PROFILES.find((x) => x.sourceType === "kichijin" && x.sourceName === star);
    check(`${star} は ALL型で例外なし`, p?.positiveMode === "all_except" && (p?.positiveExceptionActivityIds?.length ?? 0) === 0);
    check(`${star} の日は全用事に${star}の宜が付く`, same(posIds([star], star), ALL_IDS));
  }
  for (const m of BRANCHES) {
    const overlap = GANZHI.filter((g) => names(m, g).filter((n) => ["顕星", "曲星", "傅星"].includes(n)).length > 1);
    check(`顕星・曲星・傅星は ${m}月に同じ日に重ならない`, overlap.length === 0, overlap.join("・"));
  }
}

// 2. 天狗（申月の満日）
{
  check("天狗は申月の戌日だけ", same(days("申", "天狗"), ["甲戌", "丙戌", "戊戌", "庚戌", "壬戌"]));
  for (const m of BRANCHES.replace("申", "")) check(`天狗は${m}月に成立しない`, days(m, "天狗").length === 0);
  check("天狗の申月戌日は十二建除の満", resolveJianchu({ monthBranch: "申", dayBranch: "戌" }).name === "満");
  check("寅月の戊辰（戊×満）は天狗ではない", !names("寅", "戊辰").includes("天狗"));
  check("天狗の忌は祭祀・祈福", same(negIds([], ["天狗"], "天狗"), ["祭祀", "祈福"]), negIds([], ["天狗"], "天狗").join("・"));
  for (const k of ["歳徳", "月徳"]) check(`天狗＋${k} → cancelled`, status([k], ["天狗"], "天狗") === "cancelled");
  for (const k of ["歳徳合", "月徳合", "天徳", "天赦", "天願"]) check(`天狗＋${k} → active（本文に無い）`, status([k], ["天狗"], "天狗") === "active");
}

// 3. 復日・重日
{
  const FURI: Record<string, string> = { 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬", 子: "癸", 丑: "己" };
  for (const m of BRANCHES) {
    check(`復日 ${m}月は${FURI[m]}日の6日`, same(days(m, "復日"), GANZHI.filter((g) => g[0] === FURI[m])));
    check(`重日 ${m}月は巳亥の日`, same(days(m, "重日"), GANZHI.filter((g) => g[1] === "巳" || g[1] === "亥")));
  }
  for (const n of ["復日", "重日"]) {
    check(`${n}の忌は破土・安葬・啓攢`, same(negIds([], [n], n), ["破土", "安葬", "啓攢"]), negIds([], [n], n).join("・"));
    for (const k of [...DEHE_GROUP, "天赦", "六合"]) check(`${n}＋${k} → cancelled`, status([k], [n], n) === "cancelled");
    for (const k of ["天願", "三合", "母倉"]) check(`${n}＋${k} → active（本文に無い）`, status([k], [n], n) === "active");
  }
}

// 4. 五離・除神
{
  for (const m of BRANCHES) {
    const sy = GANZHI.filter((g) => g[1] === "申" || g[1] === "酉");
    check(`五離 ${m}月は申酉の日`, same(days(m, "五離"), sy));
    check(`除神 ${m}月は申酉の日`, same(days(m, "除神"), sy));
  }
  check("五離の忌は宴會・嫁娶・立券交易・交易・納采・結婚姻", same(negIds([], ["五離"], "五離"), ["宴會", "嫁娶", "立券交易", "交易", "納采", "結婚姻"]), negIds([], ["五離"], "五離").join("・"));
  for (const k of [...DEHE_GROUP, "天赦", "六合"]) check(`五離＋${k} → cancelled`, status([k], ["五離"], "五離") === "cancelled");
  for (const k of ["天願", "三合"]) check(`五離＋${k} → active（天合は未接続）`, status([k], ["五離"], "五離") === "active");
  const r28 = RESOLUTION_RULES.find((r) => r.id === "28");
  check("No.28 の条件に天合・三合は無い", r28 !== undefined && r28.requires.every((g) => !g.names.includes("天合") && !g.names.includes("三合")));
  check("No.28 の注記に天合 PENDING_REVIEW", r28?.note?.includes("PENDING_REVIEW") === true);
  // 洪氏錦嚢の補足は表示専用データだけで、五離の RULE・解除には入らない
  const hn = HONGSHI_NOTES.filter((n) => n.unfavorableGod === "五離");
  check("洪氏補足 結婚納采×五離「用いて良い」が1件", hn.length === 1 && hn[0].activityId === "結婚納采" && hn[0].conditionText === "用いて良い" && hn[0].sourcePage === "印字p.62");
  check("洪氏補足があっても五離は徳合等なしでは active", status([], ["五離"], "五離") === "active");
  check("洪氏補足があっても五離の忌は変わらない（結婚納采を宜にしない）", !posIds([], "五離").includes("結婚納采"));
  check("洪氏補足は吉凶混在の結婚納采×五離で返る",
    getHongshiNotesFor({ activityId: "結婚納采", positiveSources: [{ sourceName: "天徳" }], negativeSources: [{ sourceName: "五離" }] }).some((n) => n.unfavorableGod === "五離"));
  check("除神の宜は神殺象意どおり", same(posIds(["除神"], "除神"), ["剃頭", "掃舎宇", "整手足甲", "求醫療病", "沐浴", "解除"]), posIds(["除神"], "除神").join("・"));
}

// 5. 天罡・河魁（陽月は平＝天罡・収＝河魁、陰月は逆）
{
  for (const m of BRANCHES) {
    const yang = BRANCHES.indexOf(m) % 2 === 0;
    const jc = (g: string) => resolveJianchu({ monthBranch: m, dayBranch: g[1] }).name;
    check(`天罡 ${m}月は${yang ? "平" : "収"}日`, same(days(m, "天罡"), GANZHI.filter((g) => jc(g) === (yang ? "平" : "収"))));
    check(`河魁 ${m}月は${yang ? "収" : "平"}日`, same(days(m, "河魁"), GANZHI.filter((g) => jc(g) === (yang ? "収" : "平"))));
  }
  check("天罡 寅月は巳、卯月は子", days("寅", "天罡").every((g) => g[1] === "巳") && days("卯", "天罡").every((g) => g[1] === "子"));
  check("河魁 寅月は亥、卯月は午", days("寅", "河魁").every((g) => g[1] === "亥") && days("卯", "河魁").every((g) => g[1] === "午"));
  for (const n of ["天罡", "河魁"]) check(`${n}の忌は嫁娶だけ`, same(negIds([], [n], n), ["嫁娶"]));
}

// 6. 血忌は保留（Q4＝C）
check("血忌は成立しない", BRANCHES.split("").every((m) => days(m, "血忌").length === 0));

// 7. 擇日実例.pdf との照合（既知の差はすべて OCR の欠落・行ずれ）
{
  const KNOWN: Record<string, string[]> = {
    重日: ["六月壬辰"], // 実例側の行ずれ（次行 癸巳 の「重日」が混入）
    五離: ["十二月戊申"], // 実例側で「五離」が欠落
    天罡: ["正月辛巳", "十一月乙卯"], // 実例側で「天罡」の「罡」が欠落（「天」「天?」）
  };
  const rows = jitsurei as { monthLabel: string; monthBranch: string; ganzhi: string; kichijinRaw: string; kyojinRaw: string }[];
  for (const n of ["天狗", "復日", "重日", "五離", "天罡", "河魁", "除神"]) {
    let tp = 0;
    const diff: string[] = [];
    for (const r of rows) {
      const e = names(r.monthBranch, r.ganzhi).includes(n);
      const j = (r.kichijinRaw + r.kyojinRaw).includes(n);
      if (e && j) tp += 1;
      else if (e || j) diff.push(`${r.monthLabel}${r.ganzhi}`);
    }
    check(`実例 ${n}：一致${tp}件、差は既知分だけ`, same(diff, KNOWN[n] ?? []), diff.join("・"));
  }
}

// 8. 実日付で全体の判定に接続されている（2026年）
{
  const seen = new Set<string>();
  let tiangouDay: string | null = null;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 86400000) {
    const d = new Date(t);
    const r = calculateTakujitsuFull({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    [...r.shinsatsu.kichijin, ...r.shinsatsu.kyojin].forEach((n) => seen.add(n));
    if (!tiangouDay && r.resolution.kyojin.find((e) => e.name === "天狗")?.status === "active") {
      const ev = r.activities.evaluations.find((e) => e.activityId === "祭祀");
      if (ev?.negativeSources.some((s) => s.sourceName === "天狗")) tiangouDay = d.toISOString().slice(0, 10);
    }
  }
  for (const n of ["顕星", "曲星", "傅星", "除神", "天狗", "復日", "重日", "五離", "天罡", "河魁"]) check(`2026年に${n}が成立する`, seen.has(n));
  check("2026年に血忌は成立しない", !seen.has("血忌"));
  check("実日付で天狗の日の祭祀に天狗の忌が付く", tiangouDay !== null);
}

console.log("[区分A/B] 擇日 未解決神殺の追加（2026-10-26 監修決定）");
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
