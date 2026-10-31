// tests/takujitsu_resolution_display_text_unit.manual.ts
//
// 目的:
//   擇日の解除・軽減・増悪・判断保留の利用者向け表示文（2026-10-31 監修確定、
//   src/app/takujitsu/resolutionDisplayText.ts）を検証する。
//   ・resolution/rules.ts の全ルール・全対象に表示文がある
//   ・表示文に内部用語（PENDING_REVIEW・reduced・docs/・監修判断・OR=・AND= 等）が無い
//   ・「赦願」「より強く扱われ」を使わない
//   ・実際の resolve() 結果から、ルールの note ではなく表示文が選ばれる
//   ・page.tsx が rules.ts の note／restriction の description を直接表示しない
//
// 実行:
//   npx tsx tests/takujitsu_resolution_display_text_unit.manual.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RESOLUTION_RULES, resolveShinsatsuRelations } from "../src/lib/takujitsu";
import type { ResolvedShinsatsuEntry } from "../src/lib/takujitsu";
import {
  RESOLUTION_DISPLAY_TEXT,
  pendingDisplayText,
  resolutionDisplayText,
  restrictionDisplayText,
} from "../src/app/takujitsu/resolutionDisplayText";

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

const FORBIDDEN = [
  "PENDING_REVIEW", "pending", "reduced", "reduce", "cancel", "aggravate", "resolution",
  "docs/", ".pdf", ".md", "監修判断", "監修決定", "OR=", "AND=", "OR＝", "AND＝", "(OR", "(AND",
  "ActivityProfile", "reducedStillUnfavorable", "ruleId", "用途判定フェーズ", "協紀辨方書",
  "神殺象意", "本文から", "資料上", "赦願", "より強く扱われ", "undefined",
];

function checkClean(label: string, text: string) {
  check(`${label}: 空でない`, text.length > 0);
  for (const w of FORBIDDEN) {
    check(`${label}: 「${w}」を含まない`, !text.includes(w), text);
  }
}

// 1. 全ルール・全対象に表示文がある＋内部用語が無い
const ruleIds = new Set(RESOLUTION_RULES.map((r) => r.id));
for (const rule of RESOLUTION_RULES) {
  const fn = RESOLUTION_DISPLAY_TEXT[rule.id];
  check(`No.${rule.id}: 表示文がある`, typeof fn === "function");
  if (!fn) continue;
  for (const target of rule.targets) {
    const text = fn(target);
    checkClean(`No.${rule.id} ${target}`, text);
    const shown = rule.id === "3" ? "小時（月建）" : target;
    check(`No.${rule.id} ${target}: 神殺名を含む`, text.includes(shown), text);
    if (rule.kind === "cancel") check(`No.${rule.id} ${target}: 解除の文`, text.includes("凶作用は適用されません"), text);
    if (rule.kind === "reduce") check(`No.${rule.id} ${target}: 軽減の文`, text.includes("凶作用が弱められています") && text.includes("忌は残ります"), text);
    if (rule.kind === "aggravate") {
      check(`No.${rule.id} ${target}: 増悪の文`, text.includes("凶作用が強まるとされます。この日はその条件が成立しています。"), text);
    }
  }
}
// 表示文側に存在しないルールIDが無い（rules.ts と1対1）
for (const id of Object.keys(RESOLUTION_DISPLAY_TEXT)) {
  check(`表示文 No.${id} が rules.ts に存在する`, ruleIds.has(id));
}

// 2. 監修確定の文面（代表）
check(
  "八風は監修指定の文面",
  RESOLUTION_DISPLAY_TEXT["16"]("八風") ===
    "八風は凶神ですが、徳合または六合と重なる場合は凶作用を解除します。この日は解除条件が成立しているため、八風の凶作用は適用されません。",
);
check(
  "往亡は監修例の文面",
  RESOLUTION_DISPLAY_TEXT["14"]("往亡") ===
    "往亡は本来、赴任・移転・結婚・治療などを忌む凶神です。徳合、または天赦・天願が重なると、かえって凶作用が強まるとされます。この日はその条件が成立しています。",
);
check(
  "判断保留は監修指定の文面",
  pendingDisplayText("月刑") ===
    "この日は月刑に該当し、凶作用を解除する条件と強める条件が同時に成立しています。どちらを優先するか定まっていないため、月刑は凶神として扱います（判断保留）。",
);
checkClean("判断保留", pendingDisplayText("月刑"));

// 3. 実際の resolve() 結果から表示文が選ばれる（note は出ない）
function entry(kyojin: string[], kichijin: string[], name: string): ResolvedShinsatsuEntry {
  const res = resolveShinsatsuRelations({ kichijin, kyojin });
  const e = res.kyojin.find((x) => x.name === name);
  if (!e) throw new Error(`${name} not found`);
  return e;
}
const cases: { label: string; e: ResolvedShinsatsuEntry; status: string; expect: string }[] = [
  { label: "五離＋天徳", e: entry(["五離"], ["天徳"], "五離"), status: "cancelled", expect: RESOLUTION_DISPLAY_TEXT["28"]("五離") },
  { label: "大時＋天赦", e: entry(["大時"], ["天赦"], "大時"), status: "reduced", expect: RESOLUTION_DISPLAY_TEXT["10"]("大時") },
  { label: "往亡＋天願", e: entry(["往亡"], ["天願"], "往亡"), status: "aggravated", expect: RESOLUTION_DISPLAY_TEXT["14"]("往亡") },
  { label: "月刑＋天徳＋月破", e: entry(["月刑", "月破"], ["天徳"], "月刑"), status: "pending", expect: pendingDisplayText("月刑") },
  { label: "八専＋天願", e: entry(["八専"], ["天願"], "八専"), status: "cancelled", expect: RESOLUTION_DISPLAY_TEXT["26"]("八専") },
];
for (const c of cases) {
  check(`${c.label}: status=${c.status}`, c.e.status === c.status, c.e.status);
  const text = resolutionDisplayText(c.e) ?? "";
  check(`${c.label}: 表示文が一致`, text === c.expect, text);
  checkClean(c.label, text);
  for (const r of c.e.appliedRules ?? []) {
    if (r.note) check(`${c.label}: note を出さない`, !text.includes(r.note));
  }
}
check("active は表示文なし", resolutionDisplayText(entry(["五離"], [], "五離")) === undefined);

// 4. 用途限定の残存忌（note を使わない）
const restrictWithIds = restrictionDisplayText({
  sourceType: "kyojin", sourceName: "大時", resolutionStatus: "reduced", description: "内部note PENDING_REVIEW reduced",
});
check("残存忌：登録済みは用事名だけ", restrictWithIds.startsWith("次の用事の忌は残ります：") && restrictWithIds.includes("開市"), restrictWithIds);
checkClean("残存忌（登録あり）", restrictWithIds);
const restrictNoIds = restrictionDisplayText({
  sourceType: "kyojin", sourceName: "存在しない神殺", resolutionStatus: "reduced", description: "内部note PENDING_REVIEW reduced",
});
checkClean("残存忌（登録なし）", restrictNoIds);

// 5. page.tsx が note／description を直接表示しない
const page = readFileSync(join(__dirname, "../src/app/takujitsu/page.tsx"), "utf-8");
check("page.tsx: resolutionDisplayText を使う", page.includes("resolutionDisplayText(e)"));
check("page.tsx: restrictionDisplayText を使う", page.includes("restrictionDisplayText(r)"));
for (const pat of ["e.reason", "e.note", "r.note", "r.description", "stripInternalKindTags", "RES_STATUS_EXPLANATION"]) {
  check(`page.tsx: ${pat} を使わない`, !page.includes(pat));
}

console.log(`takujitsu_resolution_display_text_unit: pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log(failures.join("\n"));
  process.exit(1);
}
