// tests/takujitsu_kyoushin_group6_unit.manual.ts
//
// 目的:
//   擇日「日家凶神」第6グループのうち、docs/source/擇日実例.pdf の
//   吉凶神煞一覧表（月令＋日辰だけの抽象参照表）では検証できない項目
//   （区分B）を、擇日テキストの規定そのものを期待値とした単体テストで
//   検証する。fixture照合できる月厭・厭對・受死日・刀砧日の一部は
//   tests/takujitsu_kyoushin_group6.manual.ts で別途検証済み。
//
// 農暦（lunarMonth/lunarDay）とmonthBranch（月令＝月建）の取り違え防止:
//   本ファイル末尾の「境界テスト」で、monthBranchとlunarMonthをわざと
//   食い違う値に設定し、monthBranch依存項目（受死日・刀砧日・四方耗）が
//   lunarMonthを無視してmonthBranchだけで判定していること、逆に
//   見出し「月令」の暦日表（長星・短星・天乙絶気など）が節月（monthBranch）で判定し、
//   月の明記が無い表（天空・地空・上兀・下兀）だけが lunarMonth で判定していることを
//   明示的に確認する（2026-10-06 監修確定）。
//
// 実行:
//   npx tsx tests/takujitsu_kyoushin_group6_unit.manual.ts

import { resolveKyoushinGroup6 } from "../src/lib/takujitsu";
import type { ShinsatsuInput } from "../src/lib/takujitsu";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, input: ShinsatsuInput, expectedIncludes: string[], expectedExcludes: string[] = []) {
  const actual = resolveKyoushinGroup6(input).kyojin;
  const missing = expectedIncludes.filter((n) => !actual.includes(n));
  const unexpected = expectedExcludes.filter((n) => actual.includes(n));
  if (missing.length === 0 && unexpected.length === 0) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(
      `  [${label}] 実測=${JSON.stringify(actual)} ` +
        `(不足=${JSON.stringify(missing)} / 余分=${JSON.stringify(unexpected)})`,
    );
  }
}

const BASE: ShinsatsuInput = { yearStem: "甲", monthBranch: "寅", dayStem: "甲", dayBranch: "子" };

console.log("[区分B] ロジック単体テスト（第6グループ：区分Aで検証できない残り項目）");
console.log("根拠: docs/source/擇日テキスト.pdf p.24・p.29-30・p.34・p.36-45\n");

// ---- 43）受死日（monthBranch固定表） ----
check("受死日：寅月戌日（該当）", { ...BASE, monthBranch: "寅", dayBranch: "戌" }, ["受死日"]);
check("受死日：寅月子日（非該当）", { ...BASE, monthBranch: "寅", dayBranch: "子" }, [], ["受死日"]);
check("受死日：卯月辰日（該当）", { ...BASE, monthBranch: "卯", dayBranch: "辰" }, ["受死日"]);

// ---- 52）刀砧日（季節monthBranch＋dayBranch） ----
check("刀砧日：春(卯月)亥日（該当）", { ...BASE, monthBranch: "卯", dayBranch: "亥" }, ["刀砧日"]);
check("刀砧日：春(卯月)子日（該当）", { ...BASE, monthBranch: "卯", dayBranch: "子" }, ["刀砧日"]);
check("刀砧日：春(卯月)寅日（非該当）", { ...BASE, monthBranch: "卯", dayBranch: "寅" }, [], ["刀砧日"]);
check("刀砧日：秋(酉月)巳日（該当）", { ...BASE, monthBranch: "酉", dayBranch: "巳" }, ["刀砧日"]);

// ---- 25）上朔（p.32「陰暦の1日で新月をいう。」＋年干の表） ----
check("上朔：甲年癸亥日・陰暦1日（該当）", { ...BASE, yearStem: "甲", dayStem: "癸", dayBranch: "亥", lunarDay: 1 }, ["上朔"]);
check("上朔：甲年癸丑日・陰暦1日（非該当）", { ...BASE, yearStem: "甲", dayStem: "癸", dayBranch: "丑", lunarDay: 1 }, [], ["上朔"]);
check("上朔：庚年己亥日・陰暦1日（該当）", { ...BASE, yearStem: "庚", dayStem: "己", dayBranch: "亥", lunarDay: 1 }, ["上朔"]);
check("上朔：甲年癸亥日・陰暦2日（陰暦1日でないため非該当）", { ...BASE, yearStem: "甲", dayStem: "癸", dayBranch: "亥", lunarDay: 2 }, [], ["上朔"]);
check("上朔：甲年癸亥日・陰暦日なし（判定不能のため非該当）", { ...BASE, yearStem: "甲", dayStem: "癸", dayBranch: "亥" }, [], ["上朔"]);

// ---- 27）月忌日（lunarDayのみ） ----
check("月忌日：lunarDay=14（該当）", { ...BASE, lunarDay: 14 }, ["月忌日"]);
check("月忌日：lunarDay=15（非該当）", { ...BASE, lunarDay: 15 }, [], ["月忌日"]);

// ---- 36）横天朱雀（lunarDayのみ） ----
check("横天朱雀：lunarDay=17（該当）", { ...BASE, lunarDay: 17 }, ["横天朱雀"]);
check("横天朱雀：lunarDay=18（非該当）", { ...BASE, lunarDay: 18 }, [], ["横天朱雀"]);

// ---- 38）四不詳（lunarDayのみ） ----
check("四不詳：lunarDay=19（該当）", { ...BASE, lunarDay: 19 }, ["四不詳"]);
check("四不詳：lunarDay=20（非該当）", { ...BASE, lunarDay: 20 }, [], ["四不詳"]);

// ---- 45）周堂殺（lunarDayのみ、諸家周堂は対象外） ----
check("周堂殺：lunarDay=23（該当）", { ...BASE, lunarDay: 23 }, ["周堂殺"]);
check("周堂殺：lunarDay=24（非該当）", { ...BASE, lunarDay: 24 }, [], ["周堂殺"]);

// ---- 53）龍禁（lunarDayのみ） ----
check("龍禁：lunarDay=26（該当）", { ...BASE, lunarDay: 26 }, ["龍禁"]);
check("龍禁：lunarDay=27（非該当）", { ...BASE, lunarDay: 27 }, [], ["龍禁"]);

// ---- 29）長星・短星（節月ごと。八月は長星2値・短星2値。監修確定 2026-10-06） ----
check("長星：正月lunarDay=7（該当）", { ...BASE, monthBranch: "寅", lunarDay: 7 }, ["長星"]);
check("長星：正月lunarDay=8（非該当）", { ...BASE, monthBranch: "寅", lunarDay: 8 }, [], ["長星"]);
check("長星：八月lunarDay=2（該当・複数値の1つ目）", { ...BASE, monthBranch: "酉", lunarDay: 2 }, ["長星"]);
check("長星：八月lunarDay=5（該当・複数値の2つ目）", { ...BASE, monthBranch: "酉", lunarDay: 5 }, ["長星"]);
check("短星：九月lunarDay=16（該当・複数値の1つ目）", { ...BASE, monthBranch: "戌", lunarDay: 16 }, ["短星"]);
check("短星：九月lunarDay=17（該当・複数値の2つ目）", { ...BASE, monthBranch: "戌", lunarDay: 17 }, ["短星"]);
check("短星：九月lunarDay=15（非該当）", { ...BASE, monthBranch: "戌", lunarDay: 15 }, [], ["短星"]);

// ---- 35）揚公忌（節月ごと。七月は2値） ----
check("揚公忌：正月lunarDay=13（該当）", { ...BASE, monthBranch: "寅", lunarDay: 13 }, ["揚公忌"]);
check("揚公忌：七月lunarDay=1（該当・複数値の1つ目）", { ...BASE, monthBranch: "申", lunarDay: 1 }, ["揚公忌"]);
check("揚公忌：七月lunarDay=29（該当・複数値の2つ目）", { ...BASE, monthBranch: "申", lunarDay: 29 }, ["揚公忌"]);
check("揚公忌：七月lunarDay=15（非該当）", { ...BASE, monthBranch: "申", lunarDay: 15 }, [], ["揚公忌"]);

// ---- 50）四方耗（monthBranch三合トリオ＋lunarDay） ----
check("四方耗：寅午戌月lunarDay=2（該当）", { ...BASE, monthBranch: "午", lunarDay: 2 }, ["四方耗"]);
check("四方耗：寅午戌月lunarDay=3（非該当）", { ...BASE, monthBranch: "午", lunarDay: 3 }, [], ["四方耗"]);
check("四方耗：巳酉丑月lunarDay=5（該当）", { ...BASE, monthBranch: "酉", lunarDay: 5 }, ["四方耗"]);

// ---- 42）冰消瓦解（yearBranch六冲グループ＋節月＋lunarDay） ----
check("冰消瓦解：子午年正月lunarDay=1（該当）", { ...BASE, yearBranch: "子", monthBranch: "寅", lunarDay: 1 }, ["冰消瓦解"]);
check("冰消瓦解：子午年正月lunarDay=2（非該当）", { ...BASE, yearBranch: "午", monthBranch: "寅", lunarDay: 2 }, [], ["冰消瓦解"]);
check(
  "冰消瓦解：丑未年十月lunarDay=1（原本の不規則値・該当）",
  { ...BASE, yearBranch: "未", monthBranch: "亥", lunarDay: 1 },
  ["冰消瓦解"],
);
check(
  "冰消瓦解：丑未年十月lunarDay=3（規則性から推測される値だが原本にはない・非該当）",
  { ...BASE, yearBranch: "丑", monthBranch: "亥", lunarDay: 3 },
  [],
  ["冰消瓦解"],
);

// ---- 42）冰消瓦碎（節月＋lunarDay） ----
check("冰消瓦碎：正月lunarDay=7（該当）", { ...BASE, monthBranch: "寅", lunarDay: 7 }, ["冰消瓦碎"]);
check("冰消瓦碎：正月lunarDay=8（非該当）", { ...BASE, monthBranch: "寅", lunarDay: 8 }, [], ["冰消瓦碎"]);

// ---- 48）大空亡・小空亡（節月＋lunarDay） ----
check("大空亡：正月lunarDay=30（該当）", { ...BASE, monthBranch: "寅", lunarDay: 30 }, ["大空亡"]);
check("大空亡：正月lunarDay=26（該当は小空亡のみ）", { ...BASE, monthBranch: "寅", lunarDay: 26 }, ["小空亡"], ["大空亡"]);
check("小空亡：正月lunarDay=2（該当）", { ...BASE, monthBranch: "寅", lunarDay: 2 }, ["小空亡"]);
check("大空亡・小空亡：正月lunarDay=11（いずれも非該当）", { ...BASE, monthBranch: "寅", lunarDay: 11 }, [], ["大空亡", "小空亡"]);

// ---- 49）天乙絶気（節月ごとに固定lunarDay。監修確定で節月） ----
// 本文の実例「卯月で…七日目」＝節月 卯（二月）→ lunarDay=7。
check("天乙絶気：本文実例どおり卯月,lunarDay=7（該当）", { ...BASE, monthBranch: "卯", lunarDay: 7 }, ["天乙絶気"]);
check("天乙絶気：卯月,lunarDay=6（非該当）", { ...BASE, monthBranch: "卯", lunarDay: 6 }, [], ["天乙絶気"]);
check("天乙絶気：丑月(十二月),lunarDay=17（該当）", { ...BASE, monthBranch: "丑", lunarDay: 17 }, ["天乙絶気"]);

// ---- 41）瘟星入出日（瘟入・瘟出、節月ごと） ----
check("瘟入：正月lunarDay=6（該当）", { ...BASE, monthBranch: "寅", lunarDay: 6 }, ["瘟入"]);
check("瘟出：正月lunarDay=9（該当）", { ...BASE, monthBranch: "寅", lunarDay: 9 }, ["瘟出"]);
check("瘟入：正月lunarDay=9（非該当・瘟出の値と混同していない）", { ...BASE, monthBranch: "寅", lunarDay: 9 }, [], ["瘟入"]);
check("瘟入：四月lunarDay=25（該当）", { ...BASE, monthBranch: "巳", lunarDay: 25 }, ["瘟入"]);

// ---- 47）天空・地空（yearBranch8グループ＋lunarMonthバンド＋lunarDay） ----
check("地空：子年正月lunarDay=1（該当）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 1 }, ["地空"]);
check("天空：子年正月lunarDay=5（該当）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 5 }, ["天空"]);
check("地空：子年正月lunarDay=5（非該当・天空の値なので混同していない）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 5 }, [], ["地空"]);
check("地空：戌亥年正月lunarDay=1（開始月がずれるため非該当）", { ...BASE, yearBranch: "戌", lunarMonth: 1, lunarDay: 1 }, [], ["地空"]);
check("地空：戌亥年二月lunarDay=1（戌亥年はband0が二月のため該当）", { ...BASE, yearBranch: "亥", lunarMonth: 2, lunarDay: 1 }, ["地空"]);
// 卯年は原文 p.42 の印字どおり（「四月・十月・二月」の行。監修確定まで補正しない）
check("地空：卯年十月lunarDay=6（6,14,22,30 の行・該当）", { ...BASE, yearBranch: "卯", lunarMonth: 10, lunarDay: 6 }, ["地空"]);
check("地空：卯年十月lunarDay=4（印字どおり 4,12,20,28 の行にも該当）", { ...BASE, yearBranch: "卯", lunarMonth: 10, lunarDay: 4 }, ["地空"]);
check("天空：卯年二月lunarDay=8（印字どおり 8,16,24 の行にも該当）", { ...BASE, yearBranch: "卯", lunarMonth: 2, lunarDay: 8 }, ["天空"]);
check("地空：卯年十二月lunarDay=4（印字では十二月がどの行にも無いため非該当）", { ...BASE, yearBranch: "卯", lunarMonth: 12, lunarDay: 4 }, [], ["地空"]);
check("天空：卯年十二月lunarDay=8（同上・非該当）", { ...BASE, yearBranch: "卯", lunarMonth: 12, lunarDay: 8 }, [], ["天空"]);

// ---- 39）上兀（留紳）・下兀（赤口）（yearBranch陰陽＋月ペアグループ＋lunarDay） ----
check("上兀：陽年(子)正月lunarDay=4（該当）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 4 }, ["上兀"]);
check("下兀：陽年(子)正月lunarDay=6（該当）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 6 }, ["下兀"]);
check("上兀：陰年(丑)正月lunarDay=1（該当・陽年とは異なる列）", { ...BASE, yearBranch: "丑", lunarMonth: 1, lunarDay: 1 }, ["上兀"]);
check("下兀：陰年(丑)正月lunarDay=3（該当）", { ...BASE, yearBranch: "丑", lunarMonth: 1, lunarDay: 3 }, ["下兀"]);
check("上兀：陽年(子)正月lunarDay=1（非該当・陰年の値なので混同していない）", { ...BASE, yearBranch: "子", lunarMonth: 1, lunarDay: 1 }, [], ["上兀"]);
check("下兀：陽年(子)三月lunarDay=23（原本の不規則値・該当）", { ...BASE, yearBranch: "子", lunarMonth: 3, lunarDay: 23 }, ["下兀"]);

// ---- 44）伏斷日（dayBranch＋lodge28） ----
check("伏斷日：子日で虚宿（該当）", { ...BASE, dayBranch: "子", lodge28: "虚" }, ["伏斷日"]);
check("伏斷日：子日で斗宿（非該当）", { ...BASE, dayBranch: "子", lodge28: "斗" }, [], ["伏斷日"]);
check("伏斷日：酉日で觜宿（該当・原本表記「嘴」はCalendarEngineの「觜」に統一）", { ...BASE, dayBranch: "酉", lodge28: "觜" }, ["伏斷日"]);

// ---- 44）埋兒凶宿（lodge28固定列挙） ----
check("埋兒凶宿：心宿（該当）", { ...BASE, lodge28: "心" }, ["埋兒凶宿"]);
check("埋兒凶宿：角宿（非該当）", { ...BASE, lodge28: "角" }, [], ["埋兒凶宿"]);

// ---- 8）月厭・厭對（monthBranch固定表） ----
check("月厭：寅月戌日（該当）", { ...BASE, monthBranch: "寅", dayBranch: "戌" }, ["月厭"]);
check("厭對：寅月辰日（該当）", { ...BASE, monthBranch: "寅", dayBranch: "辰" }, ["厭對"]);
check("月厭：寅月子日（非該当）", { ...BASE, monthBranch: "寅", dayBranch: "子" }, [], ["月厭"]);

// ---- 小耗（monthBranch＋dayBranch。十二直「執」と等価。2026-09-09追加） ----
check("小耗：寅月未日（十二直「執」＝該当）", { ...BASE, monthBranch: "寅", dayBranch: "未" }, ["小耗"]);
check("小耗：寅月子日（十二直「開」＝非該当）", { ...BASE, monthBranch: "寅", dayBranch: "子" }, [], ["小耗"]);
check("小耗：卯月申日（十二直「執」＝該当）", { ...BASE, monthBranch: "卯", dayBranch: "申" }, ["小耗"]);
check("小耗：卯月未日（十二直「定」＝非該当）", { ...BASE, monthBranch: "卯", dayBranch: "未" }, [], ["小耗"]);

// ---- 境界テスト：monthBranch（節月）と lunarMonth（農暦月）の取り違え防止 ----
// monthBranch=子（十一月）と lunarMonth=6 をわざと食い違わせ、各項目が期待どおりの軸だけを
// 見ていることを確認する（2026-10-06 監修確定：見出し「月令」の表と天乙絶気は節月、
// 月の明記が無い天空・地空・上兀・下兀は農暦月のまま）。
const MIXED: ShinsatsuInput = { yearStem: "甲", yearBranch: "子", monthBranch: "子", dayStem: "甲", dayBranch: "卯", lunarMonth: 6, lunarDay: 10 };
// 受死日はmonthBranch=子→卯。dayBranch=卯なので該当するはず（lunarMonth=6は無視）。
check("境界：受死日はmonthBranchだけを見る（lunarMonthを無視）", MIXED, ["受死日"]);
// 長星は節月 子（十一月）→12。lunarDay=10 は農暦月6（→10）の値なので非該当になるはず。
check("境界：長星は節月だけを見る（lunarMonth=6 の値 10 では成立しない）", MIXED, [], ["長星"]);
check("境界：長星は節月 子（十一月）→ lunarDay=12 で成立", { ...MIXED, lunarDay: 12 }, ["長星"]);
// 四方耗はmonthBranch=子（辰申子トリオ、lunarDay=4が正）。lunarDay=10では非該当。
check("境界：四方耗はmonthBranchのトリオで判定し、lunarMonthの値では判定しない", MIXED, [], ["四方耗"]);
// 天乙絶気は節月 子（十一月）→16。lunarMonth=6 の値（11）では成立しない。
check("境界：天乙絶気は節月だけを見る（lunarMonth=6 の値 11 では成立しない）", { ...MIXED, lunarDay: 11 }, [], ["天乙絶気"]);
check("境界：天乙絶気は節月 子（十一月）→ lunarDay=16 で成立", { ...MIXED, lunarDay: 16 }, ["天乙絶気"]);
// 上兀は農暦月のまま（監修保留）。子年（陽年）六月＝第6組の上兀は 5,11,17,23,29。
check("境界：上兀は農暦月（6）で判定（節月 子＝十一月の値 6,12… では成立しない）", { ...MIXED, lunarDay: 11 }, ["上兀"]);

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
