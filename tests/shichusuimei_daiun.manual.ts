// tests/shichusuimei_daiun.manual.ts
//
// 四柱推命 大運の詳細（daiunDetails・detectLuckRelations）と大運欄・印刷の表示の確認。
// 実行: npx tsx tests/shichusuimei_daiun.manual.ts
//
// 期待値は講座の表（p68〜77・p114）と格局仕様（KD12-10・KD13）から手で置いたもの。

import { calculateShichusuimei, daiunDetails, detectLuckRelations } from "../src/lib/shichusuimei";
import type { LuckRelation, Pillar } from "../src/lib/shichusuimei";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DaiunView } from "../src/app/shichusuimei/MeishikiParts";
import type { Branch, Stem } from "../src/lib/shichusuimei";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : `  ${detail}`}`);
}
const pp = (x: string): Pillar => ({ stem: x[0] as Stem, branch: x[1] as Branch });
/** "時 日 月 年" */
const natal = (s: string) => {
  const [h, d, m, y] = s.split(" ");
  return { 時: h === "-" ? null : pp(h), 日: pp(d), 月: pp(m), 年: pp(y) };
};
const has = (xs: LuckRelation[], type: LuckRelation["type"], natalKeys: string) =>
  xs.some((x) => x.type === type && [...x.natal].sort().join("") === [...natalKeys].sort().join(""));
const show = (xs: LuckRelation[]) => xs.map((x) => `${x.natal.join("")}${x.part}${x.type}`).join(" ");

console.log("四柱推命 大運の詳細");

// 命式: 時丙辰 日甲午 月己卯 年庚申 ／ 大運 甲戌
{
  const n = natal("丙辰 甲午 己卯 庚申");
  const rel = detectLuckRelations(n, pp("甲戌"));
  check("天干: 大運甲と月干己 → 干合（化 土）", rel.some((x) => x.type === "干合" && x.natal[0] === "月" && x.tableElement === "土"), show(rel));
  check("天干: 大運甲と年干庚 → 冲剋", has(rel, "冲剋", "年"), show(rel));
  check("天干: 干合の組（甲己）は冲剋にしない", !has(rel, "冲剋", "月"), show(rel));
  check("天干: 日干甲（同五行）・時干丙（相生）は関係なし", !rel.some((x) => x.part === "干" && (x.natal.includes("日") || x.natal.includes("時"))), show(rel));
  check("地支: 大運戌と月支卯 → 六合（支合）", has(rel, "支合", "月"), show(rel));
  check("地支: 大運戌と時支辰 → 冲", has(rel, "冲", "時"), show(rel));
  check("地支: 大運戌と日支午 → 半合（火）", rel.some((x) => x.type === "半合" && x.natal[0] === "日" && x.tableElement === "火"), show(rel));
  check("地支: 大運戌と年支申 → 半会（金）", rel.some((x) => x.type === "半会" && x.natal[0] === "年" && x.tableElement === "金"), show(rel));
  check("複数関係の併存: 支合・冲・半合・半会を1つに絞らない",
    ["支合", "冲", "半合", "半会"].every((t) => rel.some((x) => x.part === "支" && x.type === t)), show(rel));
}

// 三合・三会（大運支＋命式2支で3支そろう）と、同じ支への複数関係
{
  const rel = detectLuckRelations(natal("甲子 甲寅 丙午 甲辰"), pp("甲戌")); // 寅午戌・辰戌冲
  check("三合: 大運戌＋日支寅・月支午 → 三合（火局）", rel.some((x) => x.type === "三合" && has([x], "三合", "日月") && x.tableElement === "火局"), show(rel));
  check("三合と半合を両方出す（優先順位で消さない）", has(rel, "三合", "日月") && has(rel, "半合", "月"), show(rel));
  check("三合と冲が同時にあれば両方", has(rel, "三合", "日月") && has(rel, "冲", "年"), show(rel));
  const kai = detectLuckRelations(natal("甲子 甲寅 乙卯 甲午"), pp("甲辰")); // 寅卯辰
  check("三会: 大運辰＋日支寅・月支卯 → 三会（木）", kai.some((x) => x.type === "三会" && has([x], "三会", "日月") && x.tableElement === "木"), show(kai));
}

// 刑（既存の自刑・二刑・三刑の表だけ）
{
  const a = detectLuckRelations(natal("甲子 甲寅 甲申 甲辰"), pp("甲巳"));
  check("三刑: 大運巳＋日支寅・月支申 → 3支そろう", a.some((x) => x.type === "三刑" && has([x], "三刑", "日月") && x.complete === true), show(a));
  const b = detectLuckRelations(natal("甲卯 甲戌 甲辰 甲午"), pp("甲子"));
  check("二刑: 大運子と時支卯", has(b, "二刑", "時"), show(b));
  check("冲: 大運子と年支午", has(b, "冲", "年"), show(b));
  const c = detectLuckRelations(natal("甲子 甲寅 甲午 甲辰"), pp("甲午"));
  check("自刑: 大運午と月支午（辰午酉亥のみ）", has(c, "自刑", "月"), show(c));
  const d = detectLuckRelations(natal("甲子 甲寅 甲子 甲辰"), pp("甲寅"));
  check("自刑: 寅は表にないので出さない", !d.some((x) => x.type === "自刑"), show(d));
}

// 時柱なし: 時柱との関係を出さない
{
  const rel = detectLuckRelations(natal("- 甲午 己卯 庚申"), pp("甲子"));
  check("時柱なし: 時との関係なし", rel.every((x) => !x.natal.includes("時")), show(rel));
}

// 計算結果に入る大運の詳細（日干基準の通変星・蔵干）
{
  const r = calculateShichusuimei({
    birth: { year: 1990, month: 5, day: 15, hour: 10, minute: 30 },
    place: { timeZone: "Asia/Tokyo", p22Name: "東京" },
    sex: "M",
  });
  const day = r.meishiki.pillars.日.stem;
  check("大運の詳細: 大運と同じ本数・同じ順", r.daiunDetails.length === r.daiun.periods.length &&
    r.daiunDetails.every((d, i) => d.index === r.daiun.periods[i].index && d.pillar.stem === r.daiun.periods[i].pillar.stem && d.pillar.branch === r.daiun.periods[i].pillar.branch));
  console.log(`  日干 ${day}／大運 ${r.daiunDetails.map((d) => `${d.pillar.stem}${d.pillar.branch}(${d.stemTsuhen})`).join(" ")}`);
  check("大運の神煞: 既存の神煞（大運分）と一致", r.daiunDetails.every((d) =>
    JSON.stringify(d.shinsatsu) === JSON.stringify(r.shinsatsu.filter((h) => h.position.kind === "luck" && h.position.luckIndex === d.index))));
  check("daiunDetails() の再計算と一致", JSON.stringify(daiunDetails(r.meishiki, r.daiun, r.shinsatsu)) === JSON.stringify(r.daiunDetails));

  // 日干甲の固定例: 大運天干の通変星・寅の蔵干（p114 の記載順）と通変星
  const m = { ...r.meishiki, pillars: { 時: pp("丙辰"), 日: pp("甲午"), 月: pp("己卯"), 年: pp("庚申") } };
  const fixed = daiunDetails(m, { ...r.daiun, periods: [{ index: 0, pillar: pp("丙寅"), ageFrom: 1, ageTo: 10 }, { index: 1, pillar: pp("辛酉"), ageFrom: 11, ageTo: 20 }] }, []);
  check("大運天干の通変星: 日干甲・大運丙 → 食神", fixed[0].stemTsuhen === "食神", fixed[0].stemTsuhen);
  check("大運天干の通変星: 日干甲・大運辛 → 正官", fixed[1].stemTsuhen === "正官", fixed[1].stemTsuhen);
  check("大運支の蔵干: 寅 → 甲・丙・戊（p114 の順）", fixed[0].zokan.map((z) => z.stem).join("") === "甲丙戊", JSON.stringify(fixed[0].zokan));
  check("蔵干の通変星: 甲 比肩／丙 食神／戊 偏財", fixed[0].zokan.map((z) => z.tsuhen).join("・") === "比肩・食神・偏財", JSON.stringify(fixed[0].zokan));
  check("大運支の蔵干: 酉 → 辛 正官", fixed[1].zokan.length === 1 && fixed[1].zokan[0].stem === "辛" && fixed[1].zokan[0].tsuhen === "正官", JSON.stringify(fixed[1].zokan));

  // 表示: 柱名つきの短い表記で、複数関係を全部出す
  const view = { ...r, meishiki: m, daiun: { ...r.daiun, periods: [{ index: 0, pillar: pp("甲戌"), ageFrom: 1, ageTo: 10 }] } };
  const html = renderToStaticMarkup(createElement(DaiunView, { r: { ...view, daiunDetails: daiunDetails(m, view.daiun, []) } }));
  for (const label of ["月干合", "年干冲剋", "月支六合", "時支冲", "日支半合", "年支半会", "比肩"]) {
    check(`表示: 「${label}」`, html.includes(label), "");
  }
}

console.log(`\n合計: PASS ${pass} / FAIL ${fail}`);
if (fail > 0) process.exitCode = 1;
