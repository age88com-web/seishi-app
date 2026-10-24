// tests/takujitsu_doyo_expansion_unit.manual.ts
//
// 目的:
//   土王用事の実務展開（土地そのものを動かす行為全般を忌む。2026-10-24 人間側決定）を検証する。
//   ・原典の11件（ACTIVITY_PROFILES）は変わらない
//   ・展開は土王用事にだけ適用され、他の神殺へ波及しない
//   ・土用期間中だけ、展開した用事に土王用事の忌が付く
//   ・儀礼としての安葬などは含めない
//   ・一般向け /lucky-day の「適したこと」に土工事系が残らない
//
// 実行:
//   npx tsx tests/takujitsu_doyo_expansion_unit.manual.ts

import { calculateTakujitsuFull, resolveShinsatsuRelations } from "../src/lib/takujitsu";
import { ACTIVITY_PROFILES, ACTIVITY_TERM_EXPANSIONS, getActivityProfile } from "../src/lib/takujitsu/activity";
import { isDoyoDayFromKyojin, splitDoyoRecommendedIds } from "../src/lib/luckyDay/doyoRecommendation";

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

const ORIGINAL_11 = ["築堤防", "修造動土", "修倉庫", "修置産室", "開渠穿井", "安碓磑", "修飾垣墻", "平治道塗", "破屋壊垣", "栽種", "破土"];
const PREVIOUS_EXPANSION = ["修造", "動土", "建築"];
const REQUIRED_10 = ["起基定硬", "啓攢", "啓墳", "埋坑", "作厠", "開道", "溝渠", "開井", "築垣", "造倉庫"];
const ADDED_FROM_INVENTORY = ["修補垣牆", "補垣塞穴", "修宅日"];
// 判断保留から正式追加（杭・柱を地面へ設置する工事を含む。2026-10-24 人間側決定）
const ADDED_FROM_PENDING = ["造畜柵"];
const ALL_DOYO = [...ORIGINAL_11, ...PREVIOUS_EXPANSION, ...REQUIRED_10, ...ADDED_FROM_INVENTORY, ...ADDED_FROM_PENDING];
// 土王用事の忌にしないもの（儀礼・土を動かさない・原典上の例外・判断保留）
const NOT_DOYO = ["安葬", "掃舎宇", "合壽木", "製寿衣", "斎醮", "安吟", "作灶", "上梁", "蓋屋", "堅柱上樑", "安門", "苫蓋", "放水", "伐木", "入宅", "移徒", "搬入"];

function day(month: number, d: number) {
  return calculateTakujitsuFull({ year: 2026, month, day: d, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
}

// 1. プロファイル
{
  const raw = ACTIVITY_PROFILES.find((p) => p.sourceType === "kyojin" && p.sourceName === "土王用事")!;
  check("1. 原典の土王用事は11件のまま", raw.unfavorableActivityIds.length === 11 && ORIGINAL_11.every((id) => raw.unfavorableActivityIds.includes(id)));
  const used = getActivityProfile("kyojin", "土王用事")!;
  check("1. 判定時の土王用事の忌は28件", used.unfavorableActivityIds.length === 28, String(used.unfavorableActivityIds.length));
  for (const id of ALL_DOYO) check(`1. 判定時の土王用事は ${id} を忌とする`, used.unfavorableActivityIds.includes(id));
  for (const id of NOT_DOYO) check(`1. 判定時の土王用事は ${id} を忌としない`, !used.unfavorableActivityIds.includes(id));
  check("1. 土王用事の展開はすべて忌", ACTIVITY_TERM_EXPANSIONS.filter((e) => e.sourceName === "土王用事").every((e) => e.sourceType === "kyojin" && e.polarity === "unfavorable"));
  // 他の神殺へ波及しない：土地展開（起基定硬など）は土王用事と土府系（土符・地嚢・小時。2026-10-24 監修判断）
  // だけ。それ以外は原典転記に「修造動土→修造・動土」「堅柱上樑→上梁」「立券交易→交易」の分割だけが加わる
  const LAND_GODS = ["土符", "地嚢", "小時"];
  const LAND_ONLY = [...PREVIOUS_EXPANSION, ...REQUIRED_10, ...ADDED_FROM_INVENTORY, ...ADDED_FROM_PENDING].filter((id) => id !== "修造" && id !== "動土");
  for (const p of ACTIVITY_PROFILES.filter((x) => x.sourceName !== "土王用事" && !LAND_GODS.includes(x.sourceName))) {
    const u = getActivityProfile(p.sourceType, p.sourceName)!;
    const allowed = (orig: string[], used: string[]) =>
      used.filter((id) => !orig.includes(id)).every((id) =>
        ((id === "修造" || id === "動土") && orig.includes("修造動土")) ||
        (id === "上梁" && orig.includes("堅柱上樑")) ||
        (id === "交易" && orig.includes("立券交易")));
    const ok = allowed(p.unfavorableActivityIds, u.unfavorableActivityIds) && allowed(p.favorableActivityIds, u.favorableActivityIds) &&
      LAND_ONLY.every((id) => p.unfavorableActivityIds.includes(id) || !u.unfavorableActivityIds.includes(id));
    if (!ok) check(`1. ${p.sourceType}:${p.sourceName} に土王用事の土地展開が波及していない`, false);
  }
  check("1. 土王用事・土府系以外の全プロファイルに土地展開は波及しない", true);
}

// 2. 「徳合・赦願があわさると尚忌む」（resolution No.21）は従来どおり増悪
{
  const r = resolveShinsatsuRelations({ kichijin: ["天徳合", "天赦"], kyojin: ["土王用事"] });
  const e = r.kyojin.find((x) => x.name === "土王用事");
  check("2. 土王用事＋徳合＋赦願 → aggravated（解除されない）", e?.status === "aggravated", e?.status);
}

// 3. 土用期間中（2026-10-24）：展開した用事すべてに土王用事の忌、吉に残らない
{
  const r = day(10, 24);
  check("3. 10/24 は土王用事が成立", r.shinsatsu.kyojin.includes("土王用事"));
  for (const id of ALL_DOYO) {
    const ev = r.activities.evaluations.find((e) => e.activityId === id);
    check(`3. 10/24 ${id} に土王用事の忌が付き、吉ではない`,
      ev !== undefined && ev.verdict !== "good" && ev.negativeSources.some((s) => s.sourceName === "土王用事"), ev?.verdict);
  }
  for (const id of NOT_DOYO) {
    const ev = r.activities.evaluations.find((e) => e.activityId === id);
    check(`3. 10/24 ${id} に土王用事の忌は付かない`, ev === undefined || !ev.negativeSources.some((s) => s.sourceName === "土王用事"));
  }
}

// 4. 土用期間外では、土王用事由来の忌が一切発生しない
for (const [m, d] of [[10, 19], [11, 8], [12, 1]] as const) {
  const r = day(m, d);
  const withDoyo = r.activities.evaluations.filter((e) => e.negativeSources.some((s) => s.sourceName === "土王用事"));
  check(`4. 2026-${m}-${d}（土用外）は土王用事の忌が0件`, !r.shinsatsu.kyojin.includes("土王用事") && withDoyo.length === 0, String(withDoyo.length));
}

// 4b. 造畜柵：土用中だけ土王用事の忌、土用外では土王用事由来の忌にならない
{
  const ev = day(10, 24).activities.evaluations.find((e) => e.activityId === "造畜柵");
  check("4b. 10/24 造畜柵は土王用事の忌で、吉ではない", ev !== undefined && ev.verdict !== "good" && ev.negativeSources.some((s) => s.sourceName === "土王用事"), ev?.verdict);
  for (const [m, d] of [[10, 19], [11, 8], [12, 1]] as const) {
    const e = day(m, d).activities.evaluations.find((x) => x.activityId === "造畜柵");
    check(`4b. 2026-${m}-${d}（土用外）造畜柵に土王用事の忌は付かない`, e === undefined || !e.negativeSources.some((s) => s.sourceName === "土王用事"));
  }
  // 他の神殺へ波及しない：原典で造畜柵を扱うプロファイルは判定時も原典どおり
  const others = ACTIVITY_PROFILES.filter((p) => p.sourceName !== "土王用事" &&
    (p.unfavorableActivityIds.includes("造畜柵") || p.favorableActivityIds.includes("造畜柵")));
  // 土府系（土符・地嚢・小時）は 2026-10-24 監修判断で土王用事と同じ土地展開を持つため除く
  check("4b. 造畜柵の展開は土王用事・土府系以外のプロファイルに加わらない",
    ACTIVITY_PROFILES.filter((p) => !["土王用事", "土符", "地嚢", "小時"].includes(p.sourceName)).every((p) => {
      const u = getActivityProfile(p.sourceType, p.sourceName)!;
      return u.unfavorableActivityIds.includes("造畜柵") === p.unfavorableActivityIds.includes("造畜柵") &&
        u.favorableActivityIds.includes("造畜柵") === p.favorableActivityIds.includes("造畜柵");
    }), `原典で造畜柵を扱う他プロファイル ${others.length}件`);
}

// 5. 一般向け /lucky-day：土用中の「適したこと」に土工事系が残らない
//    10/24 は女宿（剃頭以外すべて忌、2026-10-24 監修判断）で吉の用事が無いため、同じ土用中の 11/03 で確認する。
{
  const r = day(11, 3);
  const good = r.activities.evaluations.filter((e) => e.verdict === "good").map((e) => e.activityId);
  const { kept } = splitDoyoRecommendedIds(good, isDoyoDayFromKyojin(r.shinsatsu.kyojin));
  check("5. 11/03 の「適したこと」に土王用事の忌の用事が1件も残らない", kept.every((id) => !ALL_DOYO.includes(id)),
    kept.filter((id) => ALL_DOYO.includes(id)).join("・"));
  check("5. 11/03 造畜柵は「適したこと」に残らない", !kept.includes("造畜柵"));
  for (const id of ["移徒", "入宅", "搬入", "安吟"]) {
    check(`5. 11/03 ${id} は「適したこと」に残る`, kept.includes(id));
  }
}

console.log("[区分B] 土王用事の実務展開（土地を動かす行為）");
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
