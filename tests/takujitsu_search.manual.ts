// tests/takujitsu_search.manual.ts
//
// 目的:
//   擇日UI 第3フェーズ「目的から良い日を探す」（searchTakujitsuDays）と
//   full.ts の二重 Calendar 計算解消、および 歸忌 → 忌 移徒 の反映を確認する。
//   **期間検索は独自の吉凶ロジックを持たない**：各日 evaluateActivities() を
//   1回呼び、その verdict をそのまま使うことを検証する。
//
// 実行:
//   npx tsx tests/takujitsu_search.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { calculateTakujitsu } from "../src/lib/takujitsu";
import { calculate } from "../src/lib/calendar";
import { calculateTakujitsuFull, searchTakujitsuDays, TAKUJITSU_SEARCH_MAX_DAYS } from "../src/lib/takujitsu";
import { evaluateActivities, ACTIVITY_DEFINITIONS, ACTIVITY_BY_ID } from "../src/lib/takujitsu/activity";
import { CATEGORY_COUNTS, categoryOf } from "../src/lib/takujitsu/activity/activityCategories";
import { readFileSync } from "fs";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(`  ${label}`); }
}

// -----------------------------------------------------------------------
// 1. calculateTakujitsu(input, calendar) は calculateTakujitsu(input) と完全一致
//    （二重計算解消・後方互換）
// -----------------------------------------------------------------------
{
  const input = { year: 2024, month: 6, day: 15, hour: 12, minute: 0, timezone: "Asia/Tokyo" as const };
  const a = calculateTakujitsu(input);
  const cal = calculate(input);
  const b = calculateTakujitsu(input, cal);
  check("1. calendar 省略／明示渡しで結果が完全一致（shinsatsu）", JSON.stringify(a.shinsatsu) === JSON.stringify(b.shinsatsu));
  check("1. 同（buildingDay）", JSON.stringify(a.buildingDay) === JSON.stringify(b.buildingDay));
  check("1. 同（shuku28）", JSON.stringify(a.shuku28) === JSON.stringify(b.shuku28));
  check("1. 同（resolution）", JSON.stringify(a.resolution) === JSON.stringify(b.resolution));
}

// -----------------------------------------------------------------------
// 2. 30 / 90 / 366 日検索ができ、日数が正しい
// -----------------------------------------------------------------------
for (const [label, from, to, expect] of [
  ["30日", "2026-04-01", "2026-04-30", 30],
  ["90日", "2026-01-01", "2026-03-31", 90],
  ["366日", "2024-01-01", "2024-12-31", 366], // 2024はうるう年 → 366日
] as [string, string, string, number][]) {
  const t0 = Date.now();
  const r = searchTakujitsuDays({ activityId: "嫁娶", from, to, timezone: "Asia/Tokyo" });
  const ms = Date.now() - t0;
  check(`2. ${label}検索：日数 ${expect}`, r.days.length === expect);
  check(`2. ${label}検索：日付が昇順`, r.days.every((d, i) => i === 0 || (d.year * 10000 + d.month * 100 + d.day) > (r.days[i - 1].year * 10000 + r.days[i - 1].month * 100 + r.days[i - 1].day)));
  console.log(`   [計測] ${label}検索: ${ms} ms（嫁娶）`);
}

// -----------------------------------------------------------------------
// 3. 検索の verdict は各日の evaluateActivities() の verdict と一致
//    （独自の吉凶ロジックを持たない）
// -----------------------------------------------------------------------
{
  const r = searchTakujitsuDays({ activityId: "嫁娶", from: "2026-04-01", to: "2026-05-31", timezone: "Asia/Tokyo" });
  let mism = 0;
  for (const d of r.days.slice(0, 20)) {
    const full = calculateTakujitsuFull({ year: d.year, month: d.month, day: d.day, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
    const ev = full.activities.evaluations.find((e) => e.activityId === "嫁娶");
    const v = ev?.verdict ?? "neutral";
    if (v !== d.verdict) mism += 1;
  }
  check("3. 検索 verdict が calculateTakujitsuFull の verdict と一致（先頭20日）", mism === 0);
}

// -----------------------------------------------------------------------
// 4. good / mixed / bad / neutral がそれぞれ verdict どおり分類される
// -----------------------------------------------------------------------
{
  const r = searchTakujitsuDays({ activityId: "嫁娶", from: "2024-01-01", to: "2024-06-30", timezone: "Asia/Tokyo" });
  check("4. good の日は evaluation.verdict==='good'", r.days.filter((d) => d.verdict === "good").every((d) => d.evaluation?.verdict === "good"));
  check("4. mixed の日は positive・negative 両方非空", r.days.filter((d) => d.verdict === "mixed").every((d) => (d.evaluation?.positiveSources.length ?? 0) > 0 && (d.evaluation?.negativeSources.length ?? 0) > 0));
  check("4. neutral の日は evaluation===null（その用途に言及なし）", r.days.filter((d) => d.verdict === "neutral").every((d) => d.evaluation === null));
  check("4. good/mixed/bad/neutral 以外の verdict は出ない", r.days.every((d) => ["good", "bad", "mixed", "neutral"].includes(d.verdict)));
  const dist = { g: r.days.filter((d) => d.verdict === "good").length, m: r.days.filter((d) => d.verdict === "mixed").length, b: r.days.filter((d) => d.verdict === "bad").length, n: r.days.filter((d) => d.verdict === "neutral").length };
  console.log(`   [分布] 嫁娶 2024 上半期(182日): 吉${dist.g} 混在${dist.m} 凶${dist.b} 中立${dist.n}`);
}

// -----------------------------------------------------------------------
// 5. 用途変更（別 activityId で結果が変わる）
// -----------------------------------------------------------------------
{
  const a = searchTakujitsuDays({ activityId: "嫁娶", from: "2026-04-01", to: "2026-04-30" });
  const b = searchTakujitsuDays({ activityId: "修造動土", from: "2026-04-01", to: "2026-04-30" });
  const av = a.days.map((d) => d.verdict).join("");
  const bv = b.days.map((d) => d.verdict).join("");
  check("5. 用途を変えると候補日の verdict 列が変わる", av !== bv);
}

// -----------------------------------------------------------------------
// 6. エラー: 開始>終了 / 期間超過 / 不正日付
// -----------------------------------------------------------------------
{
  let e1 = false, e2 = false, e3 = false;
  try { searchTakujitsuDays({ activityId: "嫁娶", from: "2026-05-01", to: "2026-04-01" }); } catch { e1 = true; }
  try { searchTakujitsuDays({ activityId: "嫁娶", from: "2024-01-01", to: "2025-12-31" }); } catch { e2 = true; }
  try { searchTakujitsuDays({ activityId: "嫁娶", from: "2026/01/01", to: "2026-02-01" }); } catch { e3 = true; }
  check("6. 開始>終了 でエラー", e1);
  check(`6. ${TAKUJITSU_SEARCH_MAX_DAYS}日超過でエラー`, e2);
  check("6. 不正な日付形式でエラー", e3);
}

// -----------------------------------------------------------------------
// 7. 歸忌 → 忌 移徒 の反映（ActivityProfile 変更）
// -----------------------------------------------------------------------
{
  // 歸忌のみ成立 → 移徒 が bad
  const r1 = evaluateActivities({
    resolution: { raw: { kichijin: [], kyojin: ["歸忌"] }, kichijin: [], kyojin: [{ name: "歸忌", status: "active" }] },
    buildingDay: { name: "建", reading: "たつじつ", meaning: "" },
  });
  const ev1 = r1.evaluations.find((e) => e.activityId === "移徒");
  check("7. 歸忌単独：移徒が bad", ev1?.verdict === "bad");
  check("7. 移徒の negativeSources に歸忌", ev1?.negativeSources.some((s) => s.sourceName === "歸忌") === true);

  // 歸忌 ＋ 月恩（月恩は移徙を宜とする） → mixed
  const r2 = evaluateActivities({
    resolution: {
      raw: { kichijin: ["月恩"], kyojin: ["歸忌"] },
      kichijin: [{ name: "月恩", status: "active" }],
      kyojin: [{ name: "歸忌", status: "active" }],
    },
    buildingDay: { name: "建", reading: "たつじつ", meaning: "" },
  });
  const ev2 = r2.evaluations.find((e) => e.activityId === "移徒");
  check("7. 歸忌＋月恩：移徒が mixed（月恩の宜と歸忌の忌が共存）", ev2?.verdict === "mixed");
  check("7. 移徒の positiveSources に月恩、negativeSources に歸忌",
    ev2?.positiveSources.some((s) => s.sourceName === "月恩") === true &&
    ev2?.negativeSources.some((s) => s.sourceName === "歸忌") === true);
}

// -----------------------------------------------------------------------
// 8. 擇日の目的でない12語が用途母集団（＝日付画面・検索画面 共通）から
//    完全に除外されていること
// -----------------------------------------------------------------------
{
  const EXCLUDED = ["初七", "十九", "十六", "二至二分", "伐日", "冬至", "大凶", "大吉", "義日", "道土", "陰將", "陽將"];
  // 2026-09-11 原典用事クリーンアップ＋OCR確定＋マスター化＋720実例検証＋Numbers表判断反映
  // フェーズで244→95（詳細はdocs/takujitsu_original_activity_cleanup.md、
  // docs/takujitsu_activity_source_layer_validation.md、
  // docs/takujitsu_activity_definitions_numbers_review.md）。
  // 2026-09-11現行95再監査フェーズ: docs/takujitsu_missing_activity_reaudit.md
  // でユーザー承認されたA判定14件を追加し95→109。
  check("8. ActivityDefinition 総数 = 109", ACTIVITY_DEFINITIONS.length === 109);
  check("8. 12語は ActivityDefinition に存在しない", EXCLUDED.every((id) => !ACTIVITY_BY_ID[id] && !ACTIVITY_DEFINITIONS.some((d) => d.id === id)));

  // 用途一覧（evaluateActivities）に一年通じて1度も出ない
  const seen = new Set<string>();
  for (let d = 0; d < 366; d++) {
    const dt = new Date(2024, 0, 1 + d);
    const inp = { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), hour: 12, minute: 0, timezone: "Asia/Tokyo" as const };
    const full = calculateTakujitsuFull(inp);
    for (const e of full.activities.evaluations) seen.add(e.activityId);
  }
  check("8. 12語は用途判定一覧に一年通じて1度も出ない", EXCLUDED.every((id) => !seen.has(id)));
  check("8. 通常の用途（嫁娶・開市・移徒・修造動土）は出る", ["嫁娶", "開市", "移徒", "修造動土"].every((id) => seen.has(id)));

  // 検索（searchTakujitsuDays）でも 12語で候補が生成されない（evaluation は常に null / neutral）
  const r = searchTakujitsuDays({ activityId: "冬至", from: "2024-01-01", to: "2024-03-31" });
  check("8. 除外語で検索しても全日 evaluation===null（母集団外）", r.days.every((day) => day.evaluation === null && day.verdict === "neutral"));

  // カテゴリ件数の整合（現行95再監査フェーズで95→109。
  // 祭祀・祈願+2〈安香・斎醮〉／建築・工事+8〈起基定硬・安門・安吟・作灶・
  // 造倉庫・苫蓋・放水・修宅日〉／婚姻・縁組+1〈合帳〉／葬祭・墓+1〈合壽木〉／
  // その他+2〈造船・避宅出火〉）
  const catTotal = Object.values(CATEGORY_COUNTS).reduce((a, b) => a + b, 0);
  check("8. カテゴリ件数の合計 = 109", catTotal === 109);
  check("8. その他 = 14", CATEGORY_COUNTS["その他"] === 14);
  check("8. 生活 = 8", CATEGORY_COUNTS["生活"] === 8);
  check("8. 祭祀・祈願 = 6", CATEGORY_COUNTS["祭祀・祈願"] === 6);
  check("8. 建築・工事 = 30", CATEGORY_COUNTS["建築・工事"] === 30);
  check("8. 婚姻・縁組 = 6", CATEGORY_COUNTS["婚姻・縁組"] === 6);
  check("8. 葬祭・墓 = 7", CATEGORY_COUNTS["葬祭・墓"] === 7);
  // 新規14件のカテゴリーが原典上の用途に基づき正しく割り当てられていること
  const newCategoryAssignments: [string, string][] = [
    ["安香", "祭祀・祈願"],
    ["斎醮", "祭祀・祈願"],
    ["起基定硬", "建築・工事"],
    ["安門", "建築・工事"],
    ["安吟", "建築・工事"],
    ["作灶", "建築・工事"],
    ["造倉庫", "建築・工事"],
    ["苫蓋", "建築・工事"],
    ["放水", "建築・工事"],
    ["修宅日", "建築・工事"],
    ["合帳", "婚姻・縁組"],
    ["合壽木", "葬祭・墓"],
    ["造船", "その他"],
    ["避宅出火", "その他"],
  ];
  for (const [id, cat] of newCategoryAssignments) {
    check(`8. ${id} のカテゴリー = 「${cat}」`, categoryOf(id) === cat);
  }

  // Numbers表判断反映フェーズ（2026-09-11）のカテゴリー変更10件が指定どおりであること
  const categoryChanges: [string, string][] = [
    ["剃頭", "生活"],
    ["整手足甲", "生活"],
    ["沐浴", "生活"],
    ["家族会議", "生活"],
    ["會親友", "生活"],
    ["祝賀", "生活"],
    ["親睦", "生活"],
    ["賓客", "生活"],
    ["進人口", "妊娠・出産・子供"],
    ["鋳造", "就職・仕事"],
  ];
  for (const [id, cat] of categoryChanges) {
    check(`8. ${id} のカテゴリー = 「${cat}」`, categoryOf(id) === cat);
  }
  // 変更していないはずの代表サンプルのカテゴリーが変わっていないこと
  check("8. 安床 のカテゴリーは妊娠・出産・子供のまま", categoryOf("安床") === "妊娠・出産・子供");
  check("8. 出行 のカテゴリーは旅行・外出のまま", categoryOf("出行") === "旅行・外出");
  check("8. 求醫療病 のカテゴリーは医療・健康のまま", categoryOf("求醫療病") === "医療・健康");
  check("8. 結婚姻 のカテゴリーは婚姻・縁組のまま", categoryOf("結婚姻") === "婚姻・縁組");
}

// -----------------------------------------------------------------------
// 9. 神殺説明文（開発者向け）は page.tsx から削除済み
// -----------------------------------------------------------------------
{
  const src = readFileSync(new URL("../src/app/takujitsu/page.tsx", import.meta.url), "utf-8");
  check("9. 神殺欄の開発者向け説明文が page.tsx に無い", !src.includes("resolution レイヤーの適用結果"));
  check("9. resolution バッジ表示（RES_STATUS_LABEL）は維持", src.includes("RES_STATUS_LABEL") && src.includes("解除") && src.includes("軽減") && src.includes("増悪") && src.includes("保留"));
}

console.log("\n[擇日UI 第3フェーズ+3.5] searchTakujitsuDays / 二重計算解消 / 歸忌→移徒 / 12語除外 / 説明文削除");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}\n`);
if (fail > 0) {
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}
console.log(`${pass} / ${pass + fail} PASS`);
process.exit(0);
