// tests/takujitsu_evaluate_activities_unit.manual.ts
//
// 目的:
//   用途判定engine 第1フェーズ（src/lib/takujitsu/activity/evaluateActivities.ts）
//   の単体テスト。実データ（activityProfiles.ts）を使い、resolutionの
//   各status（active/cancelled/aggravated/reduced/pending）の扱い、
//   positiveSources/negativeSourcesの集約、verdict計算（多数決をしない
//   こと）を検証する。
//
// 実行:
//   npx tsx tests/takujitsu_evaluate_activities_unit.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import { evaluateActivities, computeVerdict } from "../src/lib/takujitsu/activity/evaluateActivities";
import { ACTIVITY_BY_ID } from "../src/lib/takujitsu/activity/activityDefinitions";
import { getActivityProfile } from "../src/lib/takujitsu/activity/activityProfiles";
import type { ResolvedShinsatsuEntry, ResolvedShinsatsuResult } from "../src/lib/takujitsu/resolution/types";
import type { JianchuResult } from "../src/lib/takujitsu/jianchu";
import type { Shuku28Info } from "../src/lib/takujitsu/shuku28";
import { calculateTakujitsu } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

function entry(name: string, status: ResolvedShinsatsuEntry["status"], reason?: string): ResolvedShinsatsuEntry {
  return { name, status, reason };
}

function resolution(kichijin: ResolvedShinsatsuEntry[], kyojin: ResolvedShinsatsuEntry[]): ResolvedShinsatsuResult {
  return {
    raw: { kichijin: kichijin.map((e) => e.name), kyojin: kyojin.map((e) => e.name) },
    kichijin,
    kyojin,
  };
}

const JIANCHU_JIAN: JianchuResult = { name: "建", reading: "たつじつ", meaning: "" };
const JIANCHU_CHU: JianchuResult = { name: "除", reading: "のぞくじつ", meaning: "" };
const JIANCHU_SHU: JianchuResult = { name: "執", reading: "しゅうじつ", meaning: "" };
const JIANCHU_KI: JianchuResult = { name: "危", reading: "あやぶじつ", meaning: "" };
const JIANCHU_SHUU: JianchuResult = { name: "収", reading: "しゅうじつ", meaning: "" };
const JIANCHU_SEI: JianchuResult = { name: "成", reading: "なるじつ", meaning: "" };
const SHUKU_KAKU: Shuku28Info = { lodge: "角" as Shuku28Info["lodge"], reading: "かく", meaning: "", shukuYo: "木" as Shuku28Info["shukuYo"] };

// -----------------------------------------------------------------------
// 1〜4. verdict計算の基本4分類（computeVerdictを直接検証）
// -----------------------------------------------------------------------
check("1. 宜だけ → good", computeVerdict(1, 0) === "good");
check("2. 忌だけ → bad", computeVerdict(0, 1) === "bad");
check("3. 宜＋忌 → mixed", computeVerdict(1, 1) === "mixed");
check("4. どちらもなし → neutral", computeVerdict(0, 0) === "neutral");

// -----------------------------------------------------------------------
// 5. cancelled凶神 → negativeに入らない（小時：忌＝修造動土・築堤防）
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小時", "cancelled")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("5. cancelled凶神の忌はnegativeSourcesに入らない（評価自体が存在しない）", ev === undefined);
}

// -----------------------------------------------------------------------
// 6. active凶神 → negativeに入る
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小時", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("6. active凶神の忌はnegativeSourcesに入る", !!ev && ev.negativeSources.length === 1);
  check("6. negativeSourcesのsourceNameが小時", ev?.negativeSources[0]?.sourceName === "小時");
  check("6. verdict=bad", ev?.verdict === "bad");
}

// -----------------------------------------------------------------------
// 7. aggravated凶神 → negativeに入りaggravated保持
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小時", "aggravated", "徳合や天赦が入ることで凶意が増す")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("7. aggravated凶神の忌はnegativeSourcesに入る", !!ev && ev.negativeSources.length === 1);
  check("7. resolutionStatus=aggravatedが保持される", ev?.negativeSources[0]?.resolutionStatus === "aggravated");
  check("7. noteに増悪理由が保持される", ev?.negativeSources[0]?.note === "徳合や天赦が入ることで凶意が増す");
}

// -----------------------------------------------------------------------
// 8. pending凶神 → pending情報を失わない
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小時", "pending", "複数の確定ルールが競合")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("8. pending凶神の忌は反映される（勝手に解除しない）", !!ev && ev.negativeSources.length === 1);
  check("8. resolutionStatus=pendingが保持される", ev?.negativeSources[0]?.resolutionStatus === "pending");
  check("8. hasPendingSource=true", ev?.hasPendingSource === true);
}

// -----------------------------------------------------------------------
// 9. ALL型吉神（positiveMode="all_except"）→ 例外以外の全用事がpositiveに入る
//    （天徳：「諸事皆宜、惟忌畋獵・取魚」。畋獵・取魚だけが例外＝positiveに
//    ならない。exceptionは「宜ではない」だけで「忌」でもない点も確認する）
// -----------------------------------------------------------------------
{
  const r = resolution([entry("天徳", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });

  const evOrdinary = result.evaluations.find((e) => e.activityId === "臨官");
  check("9. ALL型（天徳）：例外でない用事(臨官)はpositiveに入る", !!evOrdinary && evOrdinary.positiveSources.length === 1);
  check("9. sourceTypeはkichijin", evOrdinary?.positiveSources[0]?.sourceType === "kichijin");
  check("9. verdict=good", evOrdinary?.verdict === "good");

  const evException = result.evaluations.find((e) => e.activityId === "畋獵");
  check(
    "9. ALL型（天徳）：例外(畋獵)はpositiveに入らない（negativeにも入らない＝neutral）",
    evException === undefined || (evException.positiveSources.length === 0 && evException.negativeSources.length === 0),
  );
}

// -----------------------------------------------------------------------
// 10. EXCEPT型凶神（negativeMode="all_except"）→ 例外以外の全用事がnegativeに
//     入る。exceptionActivityIdsは「不忌」であり「宜」ではないため、他に
//     positiveの根拠が無い限りpositiveにはならない（月刑：exceptionの1つ
//     である「祭祀」で確認）。
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("月刑", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });

  const evOrdinary = result.evaluations.find((e) => e.activityId === "臨官");
  check("10. EXCEPT型（月刑）：例外でない用事(臨官)はnegativeに入る", !!evOrdinary && evOrdinary.negativeSources.length === 1);
  check("10. sourceTypeはkyojin", evOrdinary?.negativeSources[0]?.sourceType === "kyojin");
  check("10. verdict=bad", evOrdinary?.verdict === "bad");

  const evException = result.evaluations.find((e) => e.activityId === "祭祀");
  check(
    "10. EXCEPT型（月刑）：例外(祭祀)は不忌なだけでpositiveにはならない（他に宜の根拠が無ければneutral）",
    evException === undefined || (evException.positiveSources.length === 0 && evException.negativeSources.length === 0),
  );
}

// -----------------------------------------------------------------------
// 10b. 凶神が明示的favorableを持つ場合、EXCEPT型の全体忌スイープと共存し
//      mixedになりうる（勝手に相殺しない）ことの確認（月厭：favorable=祈福
//      だが「祈福」はexceptionActivityIdsに含まれないため、all_exceptの
//      忌スイープにも同時に該当する）。
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("月厭", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "祈福");
  check("10b. 月厭(祈福)：positiveSourcesに月厭由来のfavorableが入る", !!ev && ev.positiveSources.length === 1);
  check("10b. 月厭(祈福)：negativeSourcesにも同じ月厭由来のall_exceptが入る", !!ev && ev.negativeSources.length === 1);
  check("10b. verdict=mixed（勝手に相殺しない）", ev?.verdict === "mixed");
}

// -----------------------------------------------------------------------
// 10c. 凶神が持つ宜（LIST型） → positiveに入る（天乙絶気：宜＝埋坑・作厠・安碓磑）
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("天乙絶気", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "埋坑");
  check("10c. 凶神(天乙絶気)の宜がpositiveSourcesに入る", !!ev && ev.positiveSources.length === 1);
  check("10c. sourceTypeはkyojin", ev?.positiveSources[0]?.sourceType === "kyojin");
  check("10c. verdict=good（凶神由来でも宜はgood）", ev?.verdict === "good");
}

// -----------------------------------------------------------------------
// 10d. 小時のreducedStillUnfavorableActivityIds → resolutionが"reduced"でも
//      修造動土・伐木だけは忌が残る（他の忌項目は反映されない）
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小時", "reduced", "與徳合等併、止忌動土、餘則不忌")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const evStill = result.evaluations.find((e) => e.activityId === "修造動土");
  check("10d. reduced小時：修造動土は忌のまま残る", !!evStill && evStill.negativeSources.length === 1);
  check("10d. verdict=bad", evStill?.verdict === "bad");
  const evReleased = result.evaluations.find((e) => e.activityId === "開倉庫");
  check("10d. reduced小時：開倉庫（残存忌に含まれない）は忌が反映されない", evReleased === undefined);
  check("10d. reduced小時：残存忌が明確なのでunresolvedRestrictionsは増えない", result.unresolvedRestrictions.length === 0);
}

// -----------------------------------------------------------------------
// 11. 十二建除の宜・忌 → 正しく反映
// -----------------------------------------------------------------------
{
  const r = resolution([], []);
  const resultJian = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN }); // 建：忌=伐木
  const evBad = resultJian.evaluations.find((e) => e.activityId === "伐木");
  check("11. 建（十二建除）の忌=伐木が反映される", evBad?.verdict === "bad" && evBad?.negativeSources[0]?.sourceType === "jianchu");

  const resultChu = evaluateActivities({ resolution: r, buildingDay: JIANCHU_CHU }); // 除：宜=解除,治病,沐浴,開運祈願
  const evGood = resultChu.evaluations.find((e) => e.activityId === "解除");
  check("11. 除（十二建除）の宜=解除が反映される", evGood?.verdict === "good" && evGood?.positiveSources[0]?.sourceType === "jianchu");
}

// -----------------------------------------------------------------------
// 12. 二十八宿の宜・忌 → 正しく反映
// -----------------------------------------------------------------------
{
  const r = resolution([], []);
  // 角：宜=衣類裁断/酒造り/井戸掘り、忌=埋葬（原典用事クリーンアップで
  // 衣類裁断→裁衣、酒造り→醞釀、井戸掘り→開井、埋葬→安葬へ統合済み）
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN, shuku28: SHUKU_KAKU });
  const evGood = result.evaluations.find((e) => e.activityId === "裁衣");
  const evBad = result.evaluations.find((e) => e.activityId === "安葬");
  check("12. 角（二十八宿）の宜=裁衣が反映される", evGood?.verdict === "good" && evGood?.positiveSources.some((s) => s.sourceType === "shuku28"));
  check("12. 角（二十八宿）の忌=安葬が反映される", evBad?.verdict === "bad" && evBad?.negativeSources.some((s) => s.sourceType === "shuku28"));
}

// -----------------------------------------------------------------------
// 13. 同じ用事に複数source → 全source保持（修造：天徳・月徳ともに宜）
// -----------------------------------------------------------------------
{
  const r = resolution([entry("天徳", "active"), entry("月徳", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造");
  check("13. 修造のpositiveSourcesが2件（天徳・月徳）", ev?.positiveSources.length === 2);
  const names = ev?.positiveSources.map((s) => s.sourceName).sort();
  check("13. sourceNameが天徳・月徳の両方", JSON.stringify(names) === JSON.stringify(["天徳", "月徳"]));
}

// -----------------------------------------------------------------------
// 14. source数で多数決しない（移徒：忌5件 vs 宜1件でもmixed。bad化しない）
// -----------------------------------------------------------------------
{
  const r = resolution(
    [entry("月恩", "active")], // 宜=移徒 を含む
    [
      entry("月厭", "active"),
      entry("瘟入", "active"),
      entry("瘟出", "active"),
      entry("八節日", "active"),
      entry("横天朱雀", "active"),
    ], // いずれも忌=移徒 を含む（5件）
  );
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "移徒");
  check("14. 忌5件・宜1件でもverdictはbadにならずmixed（件数で多数決しない）", ev?.verdict === "mixed");
  check("14. negativeSourcesは5件すべて保持される", ev?.negativeSources.length === 5);
  check("14. positiveSourcesは1件保持される", ev?.positiveSources.length === 1);
}

// -----------------------------------------------------------------------
// 15. ActivityDefinitionに存在しないID → 0
// -----------------------------------------------------------------------
{
  const real = calculateTakujitsu({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 });
  const result = evaluateActivities({
    resolution: real.resolution,
    buildingDay: real.buildingDay,
    shuku28: real.shuku28,
  });
  const invalidIds = result.evaluations.filter((e) => !ACTIVITY_BY_ID[e.activityId]);
  check("15. ActivityDefinitionに存在しないIDの評価件数=0", invalidIds.length === 0);
  check("15. 実データ経由でも1件以上の評価が生成される（配線確認）", result.evaluations.length > 0);
}

// -----------------------------------------------------------------------
// 16. 十二建除の季節限定宜（執・危・収、2026-09-09追加）
// -----------------------------------------------------------------------
{
  const r = resolution([], []);

  // 執日：常時宜（捕捉）は季節に関係なく反映される。
  const shuNoSeason = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU });
  check("16. 執日：solarTerm省略でも常時宜(捕捉)は反映される", shuNoSeason.evaluations.find((e) => e.activityId === "捕捉")?.verdict === "good");
  check("16. 執日：solarTerm省略なら季節宜(畋獵)は反映されない", shuNoSeason.evaluations.find((e) => e.activityId === "畋獵") === undefined);

  // 執日：霜降後、立春前 → 畋獵が宜になる（境界の開始側=霜降を含む）。
  const shuSoukou = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "霜降" });
  const evTaryou = shuSoukou.evaluations.find((e) => e.activityId === "畋獵");
  check("16. 執日：霜降 → 畋獵が宜になる（境界の開始側を含む）", evTaryou?.verdict === "good");
  check("16. 執日：畋獵のsourceにsourceType=jianchu・sourceName=執が入る", evTaryou?.positiveSources[0]?.sourceType === "jianchu" && evTaryou?.positiveSources[0]?.sourceName === "執");
  check("16. 執日：畋獵のnoteに季節条件の説明が入る（後でUI説明可能）", evTaryou?.positiveSources[0]?.note === "霜降後、立春前");

  // 執日：大寒（範囲の終端側）でもまだ範囲内。
  const shuDaikan = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "大寒" });
  check("16. 執日：大寒（範囲の終端側）でも畋獵が宜になる", shuDaikan.evaluations.find((e) => e.activityId === "畋獵")?.verdict === "good");

  // 執日：立春（終了境界そのもの）は範囲外＝畋獵は宜にならない。
  const shuRisshun = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "立春" });
  check("16. 執日：立春（終了境界）は畋獵の範囲外", shuRisshun.evaluations.find((e) => e.activityId === "畋獵") === undefined);
  check("16. 執日：立春でも常時宜(捕捉)は反映される", shuRisshun.evaluations.find((e) => e.activityId === "捕捉")?.verdict === "good");

  // 執日：雨水後、立夏前 → 取魚が宜になる。
  const shuUsui = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "雨水" });
  check("16. 執日：雨水 → 取魚が宜になる", shuUsui.evaluations.find((e) => e.activityId === "取魚")?.verdict === "good");
  const shuKokuu = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "穀雨" });
  check("16. 執日：穀雨（範囲の終端側）でも取魚が宜になる", shuKokuu.evaluations.find((e) => e.activityId === "取魚")?.verdict === "good");
  const shuRikka = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "立夏" });
  check("16. 執日：立夏（終了境界）は取魚の範囲外", shuRikka.evaluations.find((e) => e.activityId === "取魚") === undefined);

  // 執日：どちらの季節区間にも属さない節気（夏至）では畋獵も取魚も宜にならない。
  const shuGeshi = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHU, solarTerm: "夏至" });
  check("16. 執日：夏至（どちらの区間でもない）では畋獵は宜にならない", shuGeshi.evaluations.find((e) => e.activityId === "畋獵") === undefined);
  check("16. 執日：夏至では取魚も宜にならない", shuGeshi.evaluations.find((e) => e.activityId === "取魚") === undefined);
  check("16. 執日：夏至でも常時宜(捕捉)は反映される", shuGeshi.evaluations.find((e) => e.activityId === "捕捉")?.verdict === "good");

  // 危日：執日より狭い「立冬後、立春前」だけが伐木の季節宜。霜降は
  // 畋獵の区間には入るが伐木の区間にはまだ入らない（境界の違いを確認）。
  const kiSoukou = evaluateActivities({ resolution: r, buildingDay: JIANCHU_KI, solarTerm: "霜降" });
  check("16. 危日：霜降では畋獵は宜になる", kiSoukou.evaluations.find((e) => e.activityId === "畋獵")?.verdict === "good");
  check("16. 危日：霜降ではまだ伐木は宜にならない（立冬後より狭い区間）", kiSoukou.evaluations.find((e) => e.activityId === "伐木") === undefined);
  const kiRittou = evaluateActivities({ resolution: r, buildingDay: JIANCHU_KI, solarTerm: "立冬" });
  check("16. 危日：立冬からは伐木が宜になる", kiRittou.evaluations.find((e) => e.activityId === "伐木")?.verdict === "good");
  check("16. 危日：立冬でも常時宜(安床)は反映される", kiRittou.evaluations.find((e) => e.activityId === "安床")?.verdict === "good");
  // 旧id「乗船」は原典用事クリーンアップで「乗船渡水」へ統合済み
  check("16. 危日：常時忌(乗船渡水)は季節に関係なく反映される", kiRittou.evaluations.find((e) => e.activityId === "乗船渡水")?.verdict === "bad");

  // 収日：常時宜（進人口・納財・捕捉・納畜）＋季節宜（畋獵・取魚）。
  const shuuSoukou = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU, solarTerm: "小寒" });
  check("16. 収日：小寒 → 畋獵が宜になる", shuuSoukou.evaluations.find((e) => e.activityId === "畋獵")?.verdict === "good");
  check("16. 収日：常時宜(納畜)は季節に関係なく反映される", shuuSoukou.evaluations.find((e) => e.activityId === "納畜")?.verdict === "good");
  const shuuNoSeason = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU, solarTerm: "芒種" });
  check("16. 収日：芒種（どちらの区間でもない）では畋獵は宜にならない", shuuNoSeason.evaluations.find((e) => e.activityId === "畋獵") === undefined);
  check("16. 収日：芒種でも常時宜(進人口)は反映される", shuuNoSeason.evaluations.find((e) => e.activityId === "進人口")?.verdict === "good");
}

// -----------------------------------------------------------------------
// 17. 小耗cancelled時のnegativeSources抑制（No.22、2026-09-09追加）：
//     小耗由来の忌は消えるが、他の凶神（血支）由来の忌は影響を受けない。
// -----------------------------------------------------------------------
{
  const r = resolution([], [entry("小耗", "cancelled", "徳合または天願により解除"), entry("血支", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });

  const evXiuCangku = result.evaluations.find((e) => e.activityId === "修倉庫");
  check(
    "17. 小耗cancelled：修倉庫（小耗のみが忌の根拠）はnegativeSourcesに入らない",
    evXiuCangku === undefined || evXiuCangku.negativeSources.length === 0,
  );

  const evAnchuang = result.evaluations.find((e) => e.activityId === "安床");
  check("17. 小耗cancelled：他凶神(血支)由来の安床の忌は抑制されない", evAnchuang?.verdict === "bad");
  check("17. 安床のnegativeSourcesは血支由来", evAnchuang?.negativeSources[0]?.sourceName === "血支");
}

// -----------------------------------------------------------------------
// No.10 大時・天吏（reduced）の特殊対応：unresolvedActivityRestriction
// -----------------------------------------------------------------------
{
  const reason = "大時（大敗咸池）・天吏（致死）：徳合・天赦にて解除するが、攻めであるビジネスは凶のまま";
  const r = resolution([], [entry("大時", "reduced", reason)]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "出軍");
  check("No.10: reduced状態では原典の忌（出軍等）は反映しない", ev === undefined);
  check("No.10: unresolvedRestrictionsに生テキストが保持される", result.unresolvedRestrictions.length === 1);
  check("No.10: unresolvedRestrictionsのsourceNameが大時", result.unresolvedRestrictions[0]?.sourceName === "大時");
  check("No.10: unresolvedRestrictionsのdescriptionが原文と一致", result.unresolvedRestrictions[0]?.description === reason);
  check("No.10: resolutionStatus=reducedが保持される", result.unresolvedRestrictions[0]?.resolutionStatus === "reduced");
}

// -----------------------------------------------------------------------
// 六黄道COMPOSITE型（青龍・明堂・寶光・玉堂・司命の5神。金匱は対象外）
// 神殺象意.pdf「爲六黄道日，與吉神併則從所宜，與凶神併則從所忌」
// docs/takujitsu_liuhuangdao_composite_analysis.md
// -----------------------------------------------------------------------

// D. 青龍単独 → 家族会議・遠行はpositive／その他にCOMPOSITE由来の宜忌を出さない
{
  const r = resolution([entry("青龍", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
  const enkou = result.evaluations.find((e) => e.activityId === "遠行");
  check("D. 青龍単独：家族会議はpositive（LIST型維持）", kaigi?.verdict === "good" && kaigi.positiveSources.some((s) => s.sourceName === "青龍"));
  check("D. 青龍単独：遠行はpositive（LIST型維持）", enkou?.verdict === "good" && enkou.positiveSources.some((s) => s.sourceName === "青龍"));
  const seiryuElsewhere = result.evaluations.filter(
    (e) => e.activityId !== "家族会議" && e.activityId !== "遠行" &&
      [...e.positiveSources, ...e.negativeSources].some((s) => s.sourceName === "青龍"),
  );
  check("D. 青龍単独：家族会議・遠行以外に青龍由来の宜忌は生成されない", seiryuElsewhere.length === 0);
}

// E. 金匱単独 → 家族会議・遠行はpositive／その他は生成しない
{
  const r = resolution([entry("金匱", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
  const enkou = result.evaluations.find((e) => e.activityId === "遠行");
  check("E. 金匱単独：家族会議はpositive", kaigi?.verdict === "good" && kaigi.positiveSources.some((s) => s.sourceName === "金匱"));
  check("E. 金匱単独：遠行はpositive", enkou?.verdict === "good" && enkou.positiveSources.some((s) => s.sourceName === "金匱"));
  const kinkiElsewhere = result.evaluations.filter(
    (e) => e.activityId !== "家族会議" && e.activityId !== "遠行" &&
      [...e.positiveSources, ...e.negativeSources].some((s) => s.sourceName === "金匱"),
  );
  check("E. 金匱単独：家族会議・遠行以外に金匱由来の宜忌は生成されない", kinkiElsewhere.length === 0);
}

// F. 金匱＋三合 → 金匱は三合の宜を追従しない（COMPOSITE化していない）。
//    ただし家族会議・遠行は金匱自身のLIST型宜として残る。
{
  const r = resolution([entry("金匱", "active"), entry("三合", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const saii = result.evaluations.find((e) => e.activityId === "裁衣"); // 三合が宜
  check("F. 金匱＋三合：裁衣のpositiveSourcesに三合は入る", !!saii && saii.positiveSources.some((s) => s.sourceName === "三合"));
  check("F. 金匱＋三合：裁衣のpositiveSourcesに金匱は入らない（追従しない）", !!saii && !saii.positiveSources.some((s) => s.sourceName === "金匱"));
  const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
  check("F. 金匱＋三合：家族会議は金匱のLIST型宜として残る", kaigi?.positiveSources.some((s) => s.sourceName === "金匱") === true);
}

// L. 家族会議・遠行 → 六黄道のうち司命を除く5神で既存positiveが維持されている
//    （司命は監修確定 2026-10-06 により個別用事に展開しない。下の S を参照）
{
  for (const name of ["青龍", "明堂", "金匱", "寶光", "玉堂"]) {
    const r = resolution([entry(name, "active")], []);
    const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
    const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
    const enkou = result.evaluations.find((e) => e.activityId === "遠行");
    check(`L. ${name}：家族会議がpositive維持`, kaigi?.verdict === "good" && kaigi.positiveSources.some((s) => s.sourceName === name));
    check(`L. ${name}：遠行がpositive維持`, enkou?.verdict === "good" && enkou.positiveSources.some((s) => s.sourceName === name));
  }
}

// G. 青龍＋三合 → 三合の宜を青龍が追従（source両方保持・青龍にcomposite note）
{
  const r = resolution([entry("青龍", "active"), entry("三合", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const saii = result.evaluations.find((e) => e.activityId === "裁衣");
  check("G. 青龍＋三合：裁衣のpositiveSourcesに三合・青龍の両方が入る",
    !!saii && saii.positiveSources.some((s) => s.sourceName === "三合") && saii.positiveSources.some((s) => s.sourceName === "青龍"));
  const seiryuSrc = saii?.positiveSources.find((s) => s.sourceName === "青龍");
  check("G. 青龍sourceのnoteが「吉神「三合」の宜に従う」", seiryuSrc?.note === "吉神「三合」の宜に従う");
  check("G. 裁衣のverdict=good", saii?.verdict === "good");
  // 二重加点しない: 青龍sourceは1件だけ
  check("G. 裁衣のpositiveSourcesに青龍は1件だけ（二重加点なし）",
    (saii?.positiveSources.filter((s) => s.sourceName === "青龍").length ?? 0) === 1);
}

// H. 青龍＋active凶神（小時：忌＝修造動土）→ 青龍が凶神の忌を追従
{
  const r = resolution([entry("青龍", "active")], [entry("小時", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("H. 青龍＋小時：修造動土のnegativeSourcesに小時・青龍の両方が入る",
    !!ev && ev.negativeSources.some((s) => s.sourceName === "小時") && ev.negativeSources.some((s) => s.sourceName === "青龍"));
  const seiryuSrc = ev?.negativeSources.find((s) => s.sourceName === "青龍");
  check("H. 青龍sourceのnoteが「凶神「小時」の忌に従う」", seiryuSrc?.note === "凶神「小時」の忌に従う");
  check("H. 修造動土のverdict=bad", ev?.verdict === "bad");
}

// I. 青龍＋cancelled凶神 → cancelledの忌を青龍が復活させない
{
  const r = resolution([entry("青龍", "active")], [entry("小時", "cancelled", "徳合により解除")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "修造動土");
  check("I. 青龍＋小時cancelled：修造動土の忌は復活しない（評価自体が無い）", ev === undefined);
}

// I2. 青龍＋reduced凶神（小時 reduced）→ resolution後に残った忌だけを青龍が追従
{
  const r = resolution([entry("青龍", "active")], [entry("小時", "reduced", "與徳合等併、止忌動土、餘則不忌")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const still = result.evaluations.find((e) => e.activityId === "修造動土"); // 残存忌
  check("I2. reduced小時：修造動土のnegativeSourcesに青龍も入る", !!still && still.negativeSources.some((s) => s.sourceName === "青龍"));
  const released = result.evaluations.find((e) => e.activityId === "開倉庫"); // 解除された忌
  check("I2. reduced小時：開倉庫（解除された忌）は青龍も追従しない", released === undefined);
}

// J. 青龍＋吉神positive＋凶神negativeが同じ用事 → mixed（双方保持）
{
  const r = resolution([entry("青龍", "active"), entry("三合", "active")], [entry("土王用事", "active")]); // 裁衣: 三合=宜, 土王用事=忌
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const ev = result.evaluations.find((e) => e.activityId === "裁衣");
  check("J. 裁衣のverdict=mixed（原典にない優先順位を作らない）", ev?.verdict === "mixed");
  check("J. 裁衣のpositiveSourcesに青龍（三合追従）", ev?.positiveSources.some((s) => s.sourceName === "青龍") === true);
  check("J. 裁衣のnegativeSourcesに青龍（土王用事追従）", ev?.negativeSources.some((s) => s.sourceName === "青龍") === true);
}

// K. 十二建除・二十八宿はCOMPOSITEの参照対象外
{
  const rJian = resolution([entry("青龍", "active")], []);
  const resJian = evaluateActivities({ resolution: rJian, buildingDay: JIANCHU_JIAN }); // 建: 忌=伐木
  const batsuboku = resJian.evaluations.find((e) => e.activityId === "伐木");
  check("K. 建の忌=伐木に青龍は追従しない（十二建除は参照対象外）",
    !!batsuboku && !batsuboku.negativeSources.some((s) => s.sourceName === "青龍"));
  const resChu = evaluateActivities({ resolution: rJian, buildingDay: JIANCHU_CHU }); // 除: 宜=解除
  const kaijo = resChu.evaluations.find((e) => e.activityId === "解除");
  check("K. 除の宜=解除に青龍は追従しない（十二建除は参照対象外）",
    !!kaijo && !kaijo.positiveSources.some((s) => s.sourceName === "青龍"));
  const resShuku = evaluateActivities({ resolution: rJian, buildingDay: JIANCHU_JIAN, shuku28: SHUKU_KAKU }); // 角: 宜=裁衣（旧id「衣類裁断」はクリーンアップで統合済み）
  const isai = resShuku.evaluations.find((e) => e.activityId === "裁衣");
  check("K. 二十八宿(角)の宜=裁衣に青龍は追従しない（二十八宿は参照対象外）",
    !!isai && !isai.positiveSources.some((s) => s.sourceName === "青龍"));
}

// M. COMPOSITE同士を再帰的にコピーしない（青龍＋明堂）
{
  const r = resolution([entry("青龍", "active"), entry("明堂", "active"), entry("三合", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
  // 家族会議は青龍・明堂それぞれのLIST型として1件ずつ（互いに追従して増えない）
  check("M. 家族会議のpositiveSourcesは青龍1件・明堂1件のみ（COMPOSITE再帰なし）",
    (kaigi?.positiveSources.filter((s) => s.sourceName === "青龍").length ?? 0) === 1 &&
    (kaigi?.positiveSources.filter((s) => s.sourceName === "明堂").length ?? 0) === 1);
  // 裁衣（三合の宜）は青龍・明堂ともに追従する（吉神＝三合を参照。互いは参照しない）
  const saii = result.evaluations.find((e) => e.activityId === "裁衣");
  check("M. 裁衣に青龍・明堂の両方がcomposite追従（参照元は三合、互いではない）",
    !!saii && saii.positiveSources.some((s) => s.sourceName === "青龍" && s.note === "吉神「三合」の宜に従う") &&
    saii.positiveSources.some((s) => s.sourceName === "明堂" && s.note === "吉神「三合」の宜に従う"));
}

// S. 司命（監修確定 2026-10-06）：一般的な吉日を示す吉神。個別用事の宜忌に展開せず、
//    他の吉神の宜・凶神の忌にも追従しない。
{
  const alone = evaluateActivities({ resolution: resolution([entry("司命", "active")], []), buildingDay: JIANCHU_JIAN });
  check("S. 司命単独：個別用事に司命由来の宜忌が1件も出ない",
    !alone.evaluations.some((e) => [...e.positiveSources, ...e.negativeSources].some((s) => s.sourceName === "司命")));
  const withOthers = evaluateActivities({
    resolution: resolution([entry("司命", "active"), entry("三合", "active")], [entry("月殺", "active")]),
    buildingDay: JIANCHU_JIAN,
  });
  check("S. 司命＋三合＋月殺：司命は三合の宜にも月殺の忌にも追従しない",
    !withOthers.evaluations.some((e) => [...e.positiveSources, ...e.negativeSources].some((s) => s.sourceName === "司命")));
  check("S. 司命のプロファイルは一般吉日（generalAuspiciousDay）で、composite を持たない",
    getActivityProfile("kichijin", "司命")?.generalAuspiciousDay === true && getActivityProfile("kichijin", "司命")?.composite !== true);
}

// N. COMPOSITE不成立日は第2パスが何もしない（金匱＋三合と同じくregression）
{
  const r = resolution([entry("三合", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const compositeSrc = result.evaluations.some((e) =>
    [...e.positiveSources, ...e.negativeSources].some((s) =>
      ["青龍", "明堂", "寶光", "玉堂", "司命"].includes(s.sourceName)));
  check("N. 六黄道神が1つも成立していない日はCOMPOSITE由来sourceが一切出ない", compositeSrc === false);
}

// -----------------------------------------------------------------------
// 月破・徳神positive抑制（第1.5パス。2026-09-10）
// 神殺象意.pdf 月破「德神臨此失力、不能爲福、故即與德合併、猶忌」
// GEPPO_DEITY_SET = 天徳・天徳合・月徳・月徳合・天赦・天願（6神）
// docs/takujitsu_geppo_deity_suppression_analysis.md
// -----------------------------------------------------------------------

// 抑制対象6神それぞれ: 月破＋当該徳神 → その徳神のpositiveが全抑制される
for (const deity of ["天徳", "天徳合", "月徳", "月徳合", "天赦", "天願"]) {
  const r = resolution([entry(deity, "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  // 非例外語（臨官）: 徳神positiveが消え、月破negativeだけ残る → bad
  const kekkon = result.evaluations.find((e) => e.activityId === "臨官");
  check(`月破＋${deity}：臨官に${deity}のpositiveが残らない`,
    !kekkon || !kekkon.positiveSources.some((s) => s.sourceName === deity));
  check(`月破＋${deity}：臨官はbad（月破negativeのみ）`, kekkon?.verdict === "bad");
  // どの用事にもこの徳神のpositive sourceは出ない
  const anyDeityPos = result.evaluations.some((e) => e.positiveSources.some((s) => s.sourceName === deity));
  check(`月破＋${deity}：${deity}由来のpositiveが1件も残らない（全抑制）`, anyDeityPos === false);
  // suppression情報
  const supp = result.suppressions.find((s) => s.sourceName === deity);
  check(`月破＋${deity}：suppressionsに${deity}のエントリがある`, !!supp);
  check(`月破＋${deity}：suppressedByNameが月破`, supp?.suppressedByName === "月破");
  check(`月破＋${deity}：reasonが原典文言`, supp?.reason === "德神臨此失力、不能爲福");
  check(`月破＋${deity}：activityIdsに臨官が含まれる`, (supp?.activityIds ?? []).includes("臨官"));
}

// G. 月破＋歳徳 → 歳徳positive（LIST型）は残る（歳徳はGEPPO_DEITY_SETではない）
{
  const r = resolution([entry("歳徳", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const shuzo = result.evaluations.find((e) => e.activityId === "修造"); // 歳徳の宜
  check("G. 月破＋歳徳：修造のpositiveSourcesに歳徳が残る", shuzo?.positiveSources.some((s) => s.sourceName === "歳徳") === true);
  check("G. 月破＋歳徳：修造はmixed（歳徳宜＋月破忌）", shuzo?.verdict === "mixed");
  check("G. 月破＋歳徳：suppressionsは空（歳徳は抑制対象外）", result.suppressions.length === 0);
}

// H. 月破＋歳徳合 → 歳徳合positiveは残る
{
  const r = resolution([entry("歳徳合", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const shuzo = result.evaluations.find((e) => e.activityId === "修造");
  check("H. 月破＋歳徳合：修造のpositiveSourcesに歳徳合が残る", shuzo?.positiveSources.some((s) => s.sourceName === "歳徳合") === true);
  check("H. 月破＋歳徳合：suppressionsは空", result.suppressions.length === 0);
}

// I. 月破＋三合 → 三合positiveは残る
{
  const r = resolution([entry("三合", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const saii = result.evaluations.find((e) => e.activityId === "裁衣"); // 三合の宜
  check("I. 月破＋三合：裁衣のpositiveSourcesに三合が残る", saii?.positiveSources.some((s) => s.sourceName === "三合") === true);
  check("I. 月破＋三合：裁衣はmixed", saii?.verdict === "mixed");
  check("I. 月破＋三合：suppressionsは空", result.suppressions.length === 0);
}

// J. 月破＋天徳＋青龍 → 天徳positive抑制／青龍は天徳positiveを追従しない
{
  const r = resolution([entry("天徳", "active"), entry("青龍", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kekkon = result.evaluations.find((e) => e.activityId === "臨官");
  check("J. 月破＋天徳＋青龍：臨官に天徳positiveが残らない", !kekkon || !kekkon.positiveSources.some((s) => s.sourceName === "天徳"));
  check("J. 月破＋天徳＋青龍：臨官に青龍positiveが残らない（抑制済みを復活させない）",
    !kekkon || !kekkon.positiveSources.some((s) => s.sourceName === "青龍"));
  check("J. 月破＋天徳＋青龍：臨官はbad", kekkon?.verdict === "bad");
  // 青龍のLIST宜（家族会議）は残る（青龍はGEPPO_DEITY_SETでない）
  const kaigi = result.evaluations.find((e) => e.activityId === "家族会議");
  check("J. 月破＋天徳＋青龍：青龍の家族会議positiveは残る", kaigi?.positiveSources.some((s) => s.sourceName === "青龍") === true);
}

// K. 月破＋三合＋青龍 → 三合positive維持／青龍は三合positiveへ追従
{
  const r = resolution([entry("三合", "active"), entry("青龍", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const saii = result.evaluations.find((e) => e.activityId === "裁衣");
  check("K. 月破＋三合＋青龍：裁衣に三合positiveが残る", saii?.positiveSources.some((s) => s.sourceName === "三合") === true);
  check("K. 月破＋三合＋青龍：裁衣に青龍positive（三合追従）が入る",
    saii?.positiveSources.some((s) => s.sourceName === "青龍" && s.note === "吉神「三合」の宜に従う") === true);
  check("K. 月破＋三合＋青龍：裁衣はmixed", saii?.verdict === "mixed");
}

// L. 月破例外語（祭祀）→ 月破negativeなし＋徳神positive抑制 → 他positiveなければneutral（評価なし）
{
  const r = resolution([entry("天徳", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const saishi = result.evaluations.find((e) => e.activityId === "祭祀");
  check("L. 月破＋天徳：祭祀（月破例外語）は天徳抑制でpositive無し・月破忌も無し → 評価が生成されない（neutral）",
    saishi === undefined || (saishi.positiveSources.length === 0 && saishi.negativeSources.length === 0));
  check("L. 月破＋天徳：suppressions.activityIdsに祭祀が含まれる（天徳は祭祀を宜にしていた）",
    (result.suppressions.find((s) => s.sourceName === "天徳")?.activityIds ?? []).includes("祭祀"));
}

// M. 月破非例外語（臨官）→ 月破negativeあり＋徳神positive抑制 → bad
{
  const r = resolution([entry("月徳", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kekkon = result.evaluations.find((e) => e.activityId === "臨官");
  check("M. 月破＋月徳：臨官は月破negativeのみ残りbad", kekkon?.verdict === "bad");
  check("M. 月破＋月徳：臨官のnegativeSourcesに月破", kekkon?.negativeSources.some((s) => s.sourceName === "月破") === true);
}

// N. raw occurrence（resolution.raw.kichijin）は保持される（抑制はevaluation層のみ）
{
  const r = resolution([entry("天徳", "active")], [entry("月破", "active")]);
  check("N. 抑制してもraw.kichijinに天徳は残っている", r.raw.kichijin.includes("天徳"));
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  check("N. 抑制はevaluation層のみ：suppressionsに天徳、raw未変更", result.suppressions.some((s) => s.sourceName === "天徳"));
}

// O. suppression情報の形（O）
{
  const r = resolution([entry("天願", "active"), entry("月徳", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  check("O. suppressionsは2件（天願・月徳）", result.suppressions.length === 2);
  const names = result.suppressions.map((s) => s.sourceName).sort();
  check("O. suppressionsのsourceNameが月徳・天願", JSON.stringify(names) === JSON.stringify(["天願", "月徳"].sort()));
  for (const s of result.suppressions) {
    check(`O. ${s.sourceName}: sourceType=kichijin`, s.sourceType === "kichijin");
    check(`O. ${s.sourceName}: suppressedByType=kyojin`, s.suppressedByType === "kyojin");
    check(`O. ${s.sourceName}: activityIdsが非空`, s.activityIds.length > 0);
  }
}

// P. 月破なし＋天徳 → 従来どおりpositive（抑制されない）
{
  const r = resolution([entry("天徳", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kekkon = result.evaluations.find((e) => e.activityId === "臨官");
  check("P. 月破なし＋天徳：臨官はgood（天徳positive）", kekkon?.verdict === "good" && kekkon.positiveSources.some((s) => s.sourceName === "天徳"));
  check("P. 月破なし：suppressionsは空", result.suppressions.length === 0);
}

// Q. 月破がcancelled（防御的：将来cancelled月破が生じても抑制しない）
{
  const r = resolution([entry("天徳", "active")], [entry("月破", "cancelled", "（仮想）")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN });
  const kekkon = result.evaluations.find((e) => e.activityId === "臨官");
  check("Q. cancelled月破：天徳positiveは抑制されない", kekkon?.positiveSources.some((s) => s.sourceName === "天徳") === true);
  check("Q. cancelled月破：suppressionsは空", result.suppressions.length === 0);
}

// -----------------------------------------------------------------------
// 十二建除「収」× 月恩／四相／時徳 → 修倉庫 クロス条件（2026-09-10）
// 神殺象意.pdf 収日「與『月恩』『四相』『時德』併，宜修倉庫」
// 収 AND (月恩 OR 四相 OR 時徳)。docs/takujitsu_jianchu_seasonal_rules.md
// -----------------------------------------------------------------------

// A. 収単独（月恩・四相・時徳なし）→ 修倉庫はこの規則でpositiveにならない
{
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("A. 収単独：修倉庫は評価が生成されない（クロス条件未成立）", xiu === undefined);
}

// B. 収＋月恩 → 修倉庫 positive（jianchu由来、note「月恩と併して宜」）
{
  const r = resolution([entry("月恩", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("B. 収＋月恩：修倉庫はgood", xiu?.verdict === "good");
  const src = xiu?.positiveSources.find((s) => s.sourceName === "収");
  check("B. 収＋月恩：positiveSourcesに収(sourceType=jianchu)", src?.sourceType === "jianchu");
  check("B. 収＋月恩：noteが「月恩と併して宜」", src?.note === "月恩と併して宜");
}

// C. 収＋四相
{
  const r = resolution([entry("四相", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const src = result.evaluations.find((e) => e.activityId === "修倉庫")?.positiveSources.find((s) => s.sourceName === "収");
  check("C. 収＋四相：修倉庫にjianchu:収", src?.sourceType === "jianchu");
  check("C. 収＋四相：noteが「四相と併して宜」", src?.note === "四相と併して宜");
}

// D. 収＋時徳
{
  const r = resolution([entry("時徳", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const src = result.evaluations.find((e) => e.activityId === "修倉庫")?.positiveSources.find((s) => s.sourceName === "収");
  check("D. 収＋時徳：修倉庫にjianchu:収", src?.sourceType === "jianchu");
  check("D. 収＋時徳：noteが「時徳と併して宜」", src?.note === "時徳と併して宜");
}

// E. 収＋月恩＋四相 → positive、収source 1件のみ（二重加点なし）、noteに両方
{
  const r = resolution([entry("月恩", "active"), entry("四相", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("E. 収＋月恩＋四相：修倉庫はgood", xiu?.verdict === "good");
  check("E. 収＋月恩＋四相：収sourceは1件のみ（二重加点なし）",
    (xiu?.positiveSources.filter((s) => s.sourceName === "収").length ?? 0) === 1);
  check("E. 収＋月恩＋四相：noteに両方の吉神名", xiu?.positiveSources.find((s) => s.sourceName === "収")?.note === "月恩・四相と併して宜");
}

// F. 収＋3神全部
{
  const r = resolution([entry("月恩", "active"), entry("四相", "active"), entry("時徳", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("F. 収＋3神：修倉庫はgood・収source1件", xiu?.verdict === "good" &&
    (xiu?.positiveSources.filter((s) => s.sourceName === "収").length ?? 0) === 1);
  check("F. 収＋3神：noteに3神列挙", xiu?.positiveSources.find((s) => s.sourceName === "収")?.note === "月恩・四相・時徳と併して宜");
}

// G/H/I. 吉神だけ（収でない日）→ このクロス規則の修倉庫positiveは出ない
for (const deity of ["月恩", "四相", "時徳"]) {
  const r = resolution([entry(deity, "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_JIAN }); // 建（収ではない）
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  const hasShuCross = !!xiu && xiu.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "収");
  check(`G/H/I. ${deity}のみ（建日）：収クロス由来の修倉庫positiveは出ない`, hasShuCross === false);
}

// J. 収＋月恩＋月破 → 収クロスpositive維持、月破negativeでmixed（抑制対象外）
{
  const r = resolution([entry("月恩", "active")], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("J. 収＋月恩＋月破：修倉庫のpositiveSourcesに収が残る（月破抑制対象外）",
    xiu?.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "収") === true);
  check("J. 収＋月恩＋月破：修倉庫のnegativeSourcesに月破", xiu?.negativeSources.some((s) => s.sourceName === "月破") === true);
  check("J. 収＋月恩＋月破：verdict=mixed", xiu?.verdict === "mixed");
  check("J. 収＋月恩＋月破：suppressionsに収は含まれない（jianchuは抑制されない）",
    !result.suppressions.some((s) => s.sourceName === "収"));
}

// K. 収＋月恩＋青龍 → 修倉庫に青龍COMPOSITE sourceは付かない（jianchu由来は追従しない）
{
  const r = resolution([entry("月恩", "active"), entry("青龍", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const xiu = result.evaluations.find((e) => e.activityId === "修倉庫");
  check("K. 収＋月恩＋青龍：修倉庫はgood（収クロス）", xiu?.verdict === "good");
  check("K. 収＋月恩＋青龍：修倉庫のpositiveSourcesに青龍は付かない（六黄道はjianchu由来を追従しない）",
    !xiu?.positiveSources.some((s) => s.sourceName === "青龍"));
}

// L. 既存の収の常時宜（進人口・納財・捕捉・納畜）が維持される
{
  const r = resolution([entry("月恩", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  for (const id of ["進人口", "納財", "捕捉", "納畜"]) {
    const ev = result.evaluations.find((e) => e.activityId === id);
    check(`L. 収：${id}が収のpositiveとして維持`, ev?.verdict === "good" && ev.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "収"));
  }
}

// M. 720実例検証フェーズ（2026-09-11）で「結婚式→結婚姻」統合を取り消し。
//    収日は神殺象意.pdf側に婚姻系用事の記載が無く（JIANCHU_SOURCE["収"]に
//    婚姻語なし）、擇日象意720件でも結婚姻が一度も出現しないため、収の
//    favorableActivityIdsから結婚姻の参照を削除した（別用事へ移植していない）。
//    docs/takujitsu_activity_source_layer_validation.md参照。
{
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU });
  const kekkonin = result.evaluations.find((e) => e.activityId === "結婚姻");
  check(
    "M. 収：結婚姻は収のpositiveSourceを持たない（結婚式→結婚姻の付け替えを取り消し済み）",
    !kekkonin?.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "収"),
  );
}

// M. 既存の収の季節限定宜（畋獵・取魚）が維持される
{
  const r = resolution([], []);
  const soukou = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU, solarTerm: "霜降" });
  check("M. 収＋霜降：畋獵がgood（季節規則維持）", soukou.evaluations.find((e) => e.activityId === "畋獵")?.verdict === "good");
  const usui = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SHUU, solarTerm: "雨水" });
  check("M. 収＋雨水：取魚がgood（季節規則維持）", usui.evaluations.find((e) => e.activityId === "取魚")?.verdict === "good");
}

// -----------------------------------------------------------------------
// 十二建除「成」C案（7語 union、2026-09-10）
// 12建除.pdf ⑨成日「全てに吉。特に婚姻・結婚・結納」＋
// 神殺象意.pdf 成日「宜入學、移徙、築堤防、開市」の union（LIST型）
// docs/takujitsu_jianchu_cheng_conflict_analysis.md
//
// 2026-09-11追記（原典用事クリーンアップ フェーズ）: 元の7語のうち
// 「婚姻」「結婚」は同一原典用事「結婚姻」へ、「結納」は「結婚納采」へ
// 統合された（docs/takujitsu_original_activity_cleanup.md）。成の
// favorableActivityIds は ["結婚姻","結婚納采","入学","移徒","築堤防","開市"]
// の6語（婚姻・結婚の重複統合で7→6。unionという設計は不変、ALL型化もして
// いない）。
// -----------------------------------------------------------------------

// 2026-09-11 Numbers表判断反映フェーズで「入学→入学求師」統合済みのため、
// 成のpositive対象も入学求師に差し替え。
const SEI_ACTIVITIES = ["結婚姻", "結婚納采", "入学求師", "移徒", "築堤防", "開市"];

// A〜F. 成単独 → 6語それぞれが positive（jianchu:成）
for (const id of SEI_ACTIVITIES) {
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  const ev = result.evaluations.find((e) => e.activityId === id);
  check(`成単独：${id}がgood`, ev?.verdict === "good");
  check(`成単独：${id}のpositiveSourcesにjianchu:成`,
    ev?.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "成") === true);
}

// H. 6語すべて sourceType="jianchu"・sourceName="成"（他sourceが無い成単独で確認）
{
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  const seiPos = result.evaluations
    .filter((e) => e.positiveSources.some((s) => s.sourceName === "成"))
    .map((e) => e.activityId)
    .sort();
  check("H. 成単独：成由来positiveはちょうど6語（婚姻・結婚の統合で7→6）",
    JSON.stringify(seiPos) === JSON.stringify([...SEI_ACTIVITIES].sort()));
  const allSeiJianchu = result.evaluations.every((e) =>
    e.positiveSources.filter((s) => s.sourceName === "成").every((s) => s.sourceType === "jianchu"));
  check("H. 成由来sourceはすべてsourceType=jianchu", allSeiJianchu);
}

// I. ALL型にしていない（成単独で6語以外はpositiveにならない＝評価件数が6）
{
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  check("I. 成単独：評価は6語のみ（ALL型化していない）", result.evaluations.length === 6);
  check("I. 成単独：全174語がgoodにならない", result.evaluations.length < 50);
}

// J. 成＋月破 → 同一用事に月破negativeがあれば mixed（成positiveは抑制されない）
{
  const r = resolution([], [entry("月破", "active")]);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  const kekkon = result.evaluations.find((e) => e.activityId === "結婚姻"); // 月破all_except（結婚姻は例外語でない）
  check("J. 成＋月破：結婚姻のpositiveSourcesに成が残る（月破抑制対象外＝jianchu）",
    kekkon?.positiveSources.some((s) => s.sourceType === "jianchu" && s.sourceName === "成") === true);
  check("J. 成＋月破：結婚姻のnegativeSourcesに月破", kekkon?.negativeSources.some((s) => s.sourceName === "月破") === true);
  check("J. 成＋月破：verdict=mixed", kekkon?.verdict === "mixed");
  check("J. 成＋月破：suppressionsに成は含まれない", !result.suppressions.some((s) => s.sourceName === "成"));
}

// K. 成＋青龍 → 成由来positiveに青龍COMPOSITE sourceが付かない（jianchu由来は追従しない）
{
  const r = resolution([entry("青龍", "active")], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  for (const id of ["結婚姻", "入学", "築堤防", "開市"]) {
    const ev = result.evaluations.find((e) => e.activityId === id);
    check(`K. 成＋青龍：${id}のpositiveSourcesに青龍は付かない`,
      !ev?.positiveSources.some((s) => s.sourceName === "青龍"));
  }
}

// L. 統合先の結婚姻・結婚納采が引き続きgood（C案の追加分は置換ではなく維持）
{
  const r = resolution([], []);
  const result = evaluateActivities({ resolution: r, buildingDay: JIANCHU_SEI });
  for (const id of ["結婚姻", "結婚納采"]) {
    check(`L. 成：統合先 ${id} が維持されている`,
      result.evaluations.find((e) => e.activityId === id)?.verdict === "good");
  }
  // 旧id（婚姻・結婚・結納）は原典用事クリーンアップで削除済みのため存在しない
  for (const oldId of ["婚姻", "結婚", "結納"]) {
    check(`L. 成：旧id ${oldId} は削除済みで評価に出ない`,
      result.evaluations.find((e) => e.activityId === oldId) === undefined);
  }
}

console.log("[区分B] ロジック単体テスト（用途判定engine 第1フェーズ evaluateActivities）");
console.log("根拠: docs/takujitsu_activity_rules.md ＋ docs/takujitsu_resolution_rules.md\n");
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
