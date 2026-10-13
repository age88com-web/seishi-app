// tests/qizheng_display_conditions.manual.tsx
//
// 七政四餘の解釈本文の表示条件（src/lib/qizheng_display_conditions.ts）の確認。
// 実行: npx tsx tests/qizheng_display_conditions.manual.tsx
//
// - 登録した ID がすべて既存データに実在すること（本文 JSON は変更しない）
// - 条件の種類ごと（旺廟陥・順逆・昼夜・同宮・宿・天元主・男女・年干支・命身宮・単独・判定不能）に
//   成立時だけ表示、1つでも不成立／判定不能なら非表示
// - 月孛 官禄宮「廟の地で天元主となれば」：天元主でなければ非表示、廟＋天元主で表示（パネル描画でも確認）
// - 条件付きルール（変曜・宮位ルール）の同宮星は AND
// - 未登録（無条件）の本文は従来どおり表示
// - 天囚「命宮や疾病宮」：疾病宮は判定上 疾厄宮／地元「廟旺に吉」：廟または旺で成立
// - 専論十主：全項目の分類（A 一般原則／B 条件付き／C 曖昧）、B は成立時だけ、C は出さない
// `--print` で分類別の件数と一覧を出力。

import { renderToStaticMarkup } from "react-dom/server";
import { QZ_DISPLAY_RULES, qzDisplayDecision, type QzDisplayContext } from "../src/lib/qizheng_display_conditions";
import { matchConditionalRules, matchPalaceStarRules, describeConditionalRule, evaluateTenLord, getQzById, TEN_LORD_RULE_CLASS } from "../src/lib/qizheng_interpretations";
import lordRules from "../docs/qizheng-data/qizheng_lord_rules_v1.json";
import PalaceDetailPanel, { type PalaceDetail, type PalaceDetailStar } from "../src/components/PalaceDetailPanel";
import zgGeneral from "../docs/qizheng-data/zhangguo_general_v1.json";
import zgBranch from "../docs/qizheng-data/zhangguo_branch_v1.json";
import zgMansion from "../docs/qizheng-data/zhangguo_mansion_v1.json";
import zgPalace from "../docs/qizheng-data/zhangguo_palace_v1.json";
import qzStarBasics from "../docs/qizheng-data/qizheng_star_basics_v1.json";
import qzStarBranch from "../docs/qizheng-data/qizheng_star_branch_v1.json";
import qzStarPalace from "../docs/qizheng-data/qizheng_star_palace_v1.json";
import qzMansionGroup from "../docs/qizheng-data/qizheng_star_mansion_group_v1.json";
import qzConj from "../docs/qizheng-data/qizheng_star_conjunction_v1.json";
import qzHenyou from "../docs/qizheng-data/qizheng_henyou_v1.json";
import qzShensha from "../docs/qizheng-data/qizheng_shensha_v1.json";

let fail = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) { fail++; console.log("NG", msg); }
};
const show = (id: string, ctx: QzDisplayContext) => qzDisplayDecision(id, ctx).show;

// ---------- 監査対象（画面に本文を出すデータ） ----------
type Rec = { id: string; category?: string };
const recs = (j: unknown) => (j as { records: Rec[] }).records;
const SOURCES: [string, Rec[]][] = [
  ["張果星宗 総論", recs(zgGeneral)],
  ["張果星宗 入宮（十二支）", recs(zgBranch)],
  ["張果星宗 躔宿", recs(zgMansion)],
  ["張果星宗 照宮", recs(zgPalace)],
  ["鑑定用資料 基本象意", recs(qzStarBasics).filter((r) => r.category === "star_basic")],
  ["鑑定用資料 日宮推命法", recs(qzStarBranch)],
  ["鑑定用資料 星曜照宮歌", recs(qzStarPalace).filter((r) => r.category === "star_palace")],
  ["鑑定用資料 七政と宿度", recs(qzMansionGroup).filter((r) => r.category === "star_mansion_group")],
  ["鑑定用資料 同宮", recs(qzConj)],
  ["鑑定用資料 変曜", recs(qzHenyou)],
  ["鑑定用資料 神殺", recs(qzShensha)],
];
const allIds = new Set(SOURCES.flatMap(([, rs]) => rs.map((r) => r.id)));

// 1) 登録 ID は実在し、分岐が空でない
for (const [id, rule] of Object.entries(QZ_DISPLAY_RULES)) {
  check(allIds.has(id), `登録 ID がデータに無い: ${id}`);
  check(rule.branches.length > 0 && rule.branches.every((b) => b.length > 0), `分岐が空: ${id}`);
  // 分類と条件の整合：A は判定不能条件を含まない／B・C は判定不能条件を含む
  const unknowns = rule.branches.flat().filter((c) => c.k === "unknown");
  if (rule.cls === "A") check(unknowns.length === 0, `A なのに判定不能条件がある: ${id}`);
  else check(unknowns.length > 0, `${rule.cls} なのに判定不能条件が無い: ${id}`);
}

// ---------- 2) 条件の種類ごとの成立／不成立 ----------
const base: QzDisplayContext = {
  palaceName: "官禄宮", isShenPalace: false, starsInPalace: [], isDayBirth: true, sex: "男",
  yearStem: "甲", yearBranch: "子", roles: [], statusOf: () => "",
};
const ctx = (o: Partial<QzDisplayContext>): QzDisplayContext => ({ ...base, ...o });
const yb = (status: string) => ({ key: "yuebo", motion: "-", status });

// 月孛 官禄宮：廟 AND 天元主
{
  const id = "yuebo_palace_官祿宮";
  const tenOther = [{ name: "天元", starKey: "mars" }];
  const tenYuebo = [{ name: "天元", starKey: "yuebo" }];
  check(!show(id, ctx({ star: yb(""), starsInPalace: ["yuebo"], roles: tenOther })), "月孛官禄：廟でも天元主でもない → 非表示");
  check(!show(id, ctx({ star: yb("廟"), starsInPalace: ["yuebo"], roles: tenOther })), "月孛官禄：廟だが天元主でない → 非表示");
  check(!show(id, ctx({ star: yb(""), starsInPalace: ["yuebo"], roles: tenYuebo })), "月孛官禄：天元主だが廟でない → 非表示");
  check(!show(id, ctx({ star: yb("旺"), starsInPalace: ["yuebo"], roles: tenYuebo })), "月孛官禄：旺は廟ではない → 非表示");
  check(!show(id, ctx({ star: yb("廟"), starsInPalace: ["yuebo"], roles: undefined })), "月孛官禄：天元の値が無い → 非表示");
  check(show(id, ctx({ star: yb("廟"), starsInPalace: ["yuebo"], roles: tenYuebo })), "月孛官禄：廟＋天元主 → 表示");
  check(!show(id, ctx({ star: yb("廟"), starsInPalace: ["yuebo"], roles: [{ name: "地元", starKey: "yuebo" }] })), "月孛官禄：地元主は天元主ではない → 非表示");
}
// 旺廟陥（廟旺＝廟または旺）
{
  const id = "jupiter_palace_財帛宮";
  check(show(id, ctx({ star: { key: "jupiter", status: "旺" } })), "木星財帛：旺 → 表示");
  check(show(id, ctx({ star: { key: "jupiter", status: "廟" } })), "木星財帛：廟 → 表示");
  check(!show(id, ctx({ star: { key: "jupiter", status: "陥" } })), "木星財帛：陥 → 非表示");
  check(!show(id, ctx({ star: { key: "jupiter", status: "" } })), "木星財帛：該当なし → 非表示");
  check(show("ketu_palace_福德宮", ctx({ star: { key: "ketu", status: "旺" } })), "計都福徳：旺 → 表示");
  check(!show("ketu_palace_福德宮", ctx({ star: { key: "ketu", status: "廟" } })), "計都福徳：廟は旺ではない → 非表示");
}
// 順逆（神殺 天元「順ならば吉、逆留陥を忌む」）
{
  const id = "qz_shensha_ym_天元";
  check(show(id, ctx({ star: { key: "jupiter", motion: "+", status: "" } })), "天元：順 → 表示");
  check(show(id, ctx({ star: { key: "jupiter", motion: "-", status: "" } })), "天元：逆 → 表示");
  check(show(id, ctx({ star: { key: "jupiter", motion: "", status: "陥" } })), "天元：陥 → 表示");
  check(!show(id, ctx({ star: { key: "jupiter", motion: "", status: "" } })), "天元：順逆・陥とも不明 → 非表示");
}
// 昼夜（躔宿・入宮）
{
  check(show("sun_mansion_心", ctx({ isDayBirth: true })), "太陽心宿：昼生 → 表示");
  check(!show("sun_mansion_心", ctx({ isDayBirth: false })), "太陽心宿：夜生 → 非表示");
  check(!show("sun_mansion_心", ctx({ isDayBirth: undefined })), "太陽心宿：昼夜不明 → 非表示");
  check(show("moon_mansion_井", ctx({ isDayBirth: false })), "太陰井宿：夜生 → 表示");
  check(!show("moon_mansion_井", ctx({ isDayBirth: true })), "太陰井宿：昼生 → 非表示");
  check(show("sun_branch_子", ctx({ isDayBirth: false })) && show("sun_branch_子", ctx({ isDayBirth: true })), "太陽子宮：昼夜の分岐がどちらも明記 → 表示");
  check(!show("sun_branch_子", ctx({ isDayBirth: undefined })), "太陽子宮：昼夜不明 → 非表示");
  check(show("qz_conj_土計", ctx({ isDayBirth: false })) && !show("qz_conj_土計", ctx({ isDayBirth: true })), "同宮 土計：夜生だけ表示");
}
// 同宮（列挙星はすべて）
{
  check(show("moon_branch_辰", ctx({ star: { key: "moon" }, starsInPalace: ["moon", "venus"] })), "太陰辰宮：金星同宮 → 表示");
  check(!show("moon_branch_辰", ctx({ star: { key: "moon" }, starsInPalace: ["moon"] })), "太陰辰宮：金星なし → 非表示");
  check(!show("rahu_branch_辰", ctx({ star: { key: "rahu" }, starsInPalace: ["rahu", "mars"] })), "羅喉辰宮：火星だけ（金星なし） → 非表示");
  check(show("rahu_branch_辰", ctx({ star: { key: "rahu" }, starsInPalace: ["rahu", "mars", "venus"] })), "羅喉辰宮：火星・金星とも同宮 → 表示");
  check(show("sun_palace_男女宮", ctx({ star: { key: "sun" }, starsInPalace: ["sun"] })), "太陽男女宮：単独 → 表示");
  check(!show("sun_palace_男女宮", ctx({ star: { key: "sun" }, starsInPalace: ["sun", "jupiter"] })), "太陽男女宮：単独でなく吉星判定不能 → 非表示");
  check(!show("venus_branch_申", ctx({ star: { key: "venus" }, yearStem: "庚", starsInPalace: ["venus", "mars"] })), "金星申宮：庚年だが火星同宮 → 非表示");
  check(show("venus_branch_申", ctx({ star: { key: "venus" }, yearStem: "庚", starsInPalace: ["venus"] })), "金星申宮：庚年で羅火なし → 表示");
}
// 宿（宿の本文に付いた条件：旺廟・命宮・男女）
{
  check(show("ketu_mansion_婁", ctx({ star: { key: "ketu", status: "旺" } })), "計都婁宿：旺 → 表示");
  check(!show("ketu_mansion_婁", ctx({ star: { key: "ketu", status: "" } })), "計都婁宿：旺廟でない → 非表示");
  check(show("ketu_mansion_柳", ctx({ palaceName: "命宮" })) && !show("ketu_mansion_柳", ctx({ palaceName: "財帛宮" })), "計都柳宿：命宮だけ表示");
  check(show("yuebo_mansion_房", ctx({ palaceName: "財帛宮", isShenPalace: true })), "月孛房宿：身宮 → 表示");
  check(!show("yuebo_mansion_房", ctx({ palaceName: "財帛宮", isShenPalace: false })), "月孛房宿：身命でない → 非表示");
  check(show("venus_mansion_鬼", ctx({ sex: "女" })) && !show("venus_mansion_鬼", ctx({ sex: "男" })), "金星鬼宿：女命だけ表示");
}
// 年干・年支・他星の状態
{
  check(show("jupiter_branch_寅", ctx({ yearStem: "丙" })) && !show("jupiter_branch_寅", ctx({ yearStem: "乙" })), "木星寅宮：甲丙年だけ表示");
  check(!show("jupiter_branch_寅", ctx({ yearStem: undefined })), "木星寅宮：年干不明 → 非表示");
  check(show("rahu_mansion_女", ctx({ yearBranch: "午" })) && show("rahu_mansion_女", ctx({ yearBranch: "子" })), "羅喉女宿：午亥年／その他の分岐が明記 → 表示");
  check(!show("rahu_mansion_女", ctx({ yearBranch: undefined })), "羅喉女宿：年支不明 → 非表示");
  check(show("sun_branch_未", ctx({ statusOf: (k) => (k === "moon" ? "旺" : "") })), "太陽未宮：太陰が陥でない → 表示");
  check(!show("sun_branch_未", ctx({ statusOf: (k) => (k === "moon" ? "陥" : "") })), "太陽未宮：太陰が陥 → 非表示");
  check(!show("sun_branch_未", ctx({ statusOf: undefined })), "太陽未宮：太陰の状態不明 → 非表示");
}
// 神殺（男女）
{
  check(show("qz_shensha_yb_palace_太陽", ctx({ sex: "男" })) && !show("qz_shensha_yb_palace_太陽", ctx({ sex: "女" })), "神殺 太陽：男命だけ");
  check(show("qz_shensha_yb_palace_寡宿", ctx({ sex: "女" })) && !show("qz_shensha_yb_palace_寡宿", ctx({ sex: "男" })), "神殺 寡宿：女命だけ");
}
// 判定不能（B・C）を含む分岐は成立しない
{
  const everything = ctx({ star: { key: "sun", status: "廟", motion: "+" }, starsInPalace: ["sun", "jupiter", "venus", "mercury"], isShenPalace: true, palaceName: "命宮" });
  for (const id of ["sun_palace_遷移宮", "sun_palace_福德宮", "saturn_palace_男女宮", "ketu_mansion_亢", "qz_conj_孛羅", "sun_palace_財帛宮"]) {
    check(!show(id, everything), `判定不能条件だけの分岐 → 非表示: ${id}`);
  }
  // C の中でも判定できる分岐（昼夜）だけは、その分岐が成立すれば表示
  check(show("qz_conj_計火", ctx({ isDayBirth: true })), "同宮 計火：昼生の分岐は判定可 → 表示");
  check(!show("qz_conj_計火", ctx({ isDayBirth: false })), "同宮 計火：夜生は廟旺（どの星か不明）が要る → 非表示");
}
// 未登録（無条件）の本文は常に表示
{
  const unregistered = [...allIds].filter((id) => !QZ_DISPLAY_RULES[id]);
  const empty: QzDisplayContext = {};
  check(unregistered.every((id) => show(id, empty)), "無条件の本文は判定値が無くても表示");
  check(qzDisplayDecision("sun_general", empty).rule === null, "総論は無条件");
}

// ---------- 3) 条件付きルール（変曜・宮位ルール）の同宮星は AND ----------
{
  const mc = (stars: string[]) => ({ chartPalaceName: "財帛宮", isShenPalace: false, sex: "男" as const, starsInPalace: stars, isDayBirth: true });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  // 天暗「日月と同宮を忌む」＝太陽 OR 太陰と同宮（ユーザー確認済み）
  const tenan = (stars: string[]) => ids(matchConditionalRules("henyou", "天暗", mc(stars))).includes("qz_cond_henyou_天暗_2");
  check(tenan(["sun"]), "天暗：太陽と同宮 → 該当");
  check(tenan(["moon"]), "天暗：太陰と同宮 → 該当");
  check(tenan(["sun", "moon"]), "天暗：日月とも同宮 → 該当");
  check(tenan(["sun", "jupiter"]), "天暗：太陽＋他星 → 該当");
  check(!tenan([]), "天暗：単独 → 非該当");
  check(!tenan(["jupiter", "mars"]), "天暗：日月以外の星だけ → 非該当");
  check(ids(matchConditionalRules("henyou", "天権", { ...mc(["sun"]), chartPalaceName: "命宮" })).includes("qz_cond_henyou_天権_1"), "天権：命宮で太陽同宮 → 該当");
  const frag = (b: string, st: string[]) => matchPalaceStarRules(b, st, true).map((m) => m.rule.source_fragment);
  check(!frag("辰", ["jupiter", "saturn"]).some((f) => f.includes("土星計都がある場合")), "歩天経訣 辰酉：土星だけ（計都なし） → 非該当");
  check(frag("辰", ["jupiter", "saturn", "ketu"]).some((f) => f.includes("土星計都がある場合")), "歩天経訣 辰酉：土星・計都とも → 該当");
}

// ---------- 3b) 宮名の正規化（疾病宮→疾厄宮）・地元「廟旺に吉」 ----------
{
  const mc = (palace: string) => ({ chartPalaceName: palace, isShenPalace: false, sex: "男" as const, starsInPalace: [], isDayBirth: true });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  check(ids(matchConditionalRules("henyou", "天囚", mc("疾厄宮"))).includes("qz_cond_henyou_天囚_1"), "天囚：疾厄宮（資料表記は疾病宮）→ 該当");
  check(ids(matchConditionalRules("henyou", "天囚", mc("命宮"))).includes("qz_cond_henyou_天囚_1"), "天囚：命宮 → 該当");
  check(!ids(matchConditionalRules("henyou", "天囚", mc("財帛宮"))).includes("qz_cond_henyou_天囚_1"), "天囚：財帛宮 → 非該当");
  check(JSON.stringify(getQzById("qz_cond_henyou_天囚_1")?.conditions).includes("疾病宮"), "天囚：JSON の表記（疾病宮）は変更していない");
  const dg = (status: string) => ids(matchConditionalRules("shensha", "地元", mc("財帛宮"), { status })).includes("qz_cond_ym_地元_1");
  check(dg("廟"), "地元「廟旺に吉」：廟 → 該当");
  check(dg("旺"), "地元「廟旺に吉」：旺 → 該当");
  check(!dg("陥"), "地元「廟旺に吉」：陥 → 非該当");
  check(!dg(""), "地元「廟旺に吉」：旺廟陥の該当なし → 非該当");
  check(!ids(matchConditionalRules("shensha", "地元", mc("財帛宮"))).includes("qz_cond_ym_地元_1"), "地元「廟旺に吉」：星の状態が無い → 非該当");
  const d = describeConditionalRule(getQzById("qz_cond_ym_地元_1")!);
  check(!d.includes("廟旺にある") && d.includes("廟・旺"), `地元の表示文が宮の条件にならない: ${d}`);
  // 宮の範囲が未定義の語（強宮・弱宮）は従来どおり判定しない
  check(!ids(matchConditionalRules("henyou", "天蔭", mc("兄弟宮"))).includes("qz_cond_henyou_天蔭_2"), "天蔭「弱宮を忌む」：弱宮の範囲が未定義 → 非該当のまま");
}

// ---------- 3c) 専論十主 ----------
{
  const tl = (lordRules as unknown as { records: { id: string; category: string; rules?: unknown[] }[] }).records.filter((r) => r.category === "ten_lords");
  const keys = tl.flatMap((r) => (r.rules ?? []).map((_, i) => `${r.id}#${i}`));
  check(keys.length === Object.keys(TEN_LORD_RULE_CLASS).length && keys.every((k) => TEN_LORD_RULE_CLASS[k]), "専論十主：全項目が分類済み");
  const PMS: Record<string, string> = { 子: "土", 丑: "土", 寅: "木", 卯: "火", 辰: "金", 巳: "水", 午: "日", 未: "月", 申: "水", 酉: "金", 戌: "火", 亥: "木" };
  const PN: Record<string, string> = { 子: "命宮", 丑: "相貌宮", 寅: "福徳宮", 卯: "官禄宮", 辰: "遷移宮", 巳: "疾厄宮", 午: "夫妻宮", 未: "奴僕宮", 申: "男女宮", 酉: "田宅宮", 戌: "兄弟宮", 亥: "財帛宮" };
  const ev = (id: string, lordLabel: string, lordBranch: string, lordStatus = "") => evaluateTenLord(getQzById(id)!, {
    lordLabel, lordBranch, lordStatus, mingBranch: "子", palaceLordOf: (b) => PMS[b] ?? "",
    starBranchOf: () => "", starStatusOf: () => "", palaceNameOf: (b) => PN[b] ?? "",
  });
  const aRules = Object.entries(TEN_LORD_RULE_CLASS).filter(([, v]) => v.cls === "A").map(([k]) => k);
  // 一般原則（A）は条件判定なしで残る（今回の資料では該当0件）。B・C は原則欄に出ない
  for (const r of tl) {
    const e = ev(r.id, "木", "寅");
    const expectA = (r.rules ?? []).filter((_, i) => aRules.includes(`${r.id}#${i}`)).length;
    check(e.principles.length === expectA, `専論十主 ${r.id}：原則欄は A だけ`);
  }
  // B：成立時だけ
  check(ev("qz_lord_財主", "木", "寅").matched.length === 1, "財主：帰垣（木が寅）→ 該当");
  check(ev("qz_lord_財主", "木", "卯").matched.length === 0, "財主：帰垣でない → 非該当");
  check(ev("qz_lord_財主", "木", "卯", "陥").matched.some((m) => m.rule.result === "貧乏"), "財主：陥 → 該当");
  check(ev("qz_lord_妻主", "火", "卯", "陥").matched.length === 1, "妻主：陥（陥または地喪星）→ 該当");
  check(ev("qz_lord_身主", "火", "卯").matched.some((m) => m.reason.includes("七強宮")), "身主：官禄宮（七強宮）→ 該当");
  check(ev("qz_lord_身主", "火", "戌").matched.some((m) => m.reason.includes("閑宮")), "身主：兄弟宮（閑宮）→ 該当");
  check(ev("qz_lord_身主", "火", "辰").matched.length === 0, "身主：遷移宮 → 非該当");
  // C：どんな状態でも出ない
  for (const id of ["qz_lord_命主", "qz_lord_男主", "qz_lord_禄主"]) {
    for (const st of ["旺", "廟", "陥", ""]) {
      const e = ev(id, "木", "寅", st);
      check(e.matched.length === 0 && e.principles.length === 0, `専論十主 ${id}（C のみ）：${st || "状態なし"}でも出ない`);
    }
  }
}

// ---------- 4) パネル描画：月孛 官禄宮 ----------
const TARGET = "月孛が官禄宮にあり、廟の地で天元主となれば";
const PALACES = ["命宮", "兄弟宮", "夫妻宮", "男女宮", "財帛宮", "疾厄宮", "遷移宮", "奴僕宮", "官禄宮", "田宅宮", "福徳宮", "相貌宮"];
const BR = [..."子丑寅卯辰巳午未申酉戌亥"];
function chart(o: { status: string; tenyuan: string; sex?: "男" | "女"; isDayBirth?: boolean }): PalaceDetail {
  // 命宮を子に置き、十二宮を逆行で配する（官禄宮＝卯）。月孛は官禄宮に置く（旺廟陥は引数で指定）
  const palaceNameByBranch: Record<string, string> = {};
  BR.forEach((b, i) => { palaceNameByBranch[b] = PALACES[(12 - i) % 12]; });
  const guan = BR.find((b) => palaceNameByBranch[b] === "官禄宮")!;
  const star = (key: string, label: string, branch: string, status = "", motion = "+"): PalaceDetailStar =>
    ({ key, label, branch, mansion: "心", motion, status, extra: "" });
  const yuebo = star("yuebo", "月孛", guan, o.status, "-");
  const all = [yuebo, star("sun", "日", "午"), star("moon", "月", "子"), star("mars", "火", "申")];
  const TEN_MARK: Record<string, string> = { yuebo: "孛", mars: "火" };
  return {
    branch: guan, palaceName: "官禄宮", isShenPalace: false, mingBranch: "子", shenBranch: "午",
    sex: o.sex ?? "男", isDayBirth: o.isDayBirth ?? true, yearStem: "甲", yearBranch: "子",
    stars: [yuebo], henyou: [], henyou2: [], shensha: [], lord: null, mingLord: null, shenLord: null, kakkyoku: null,
    palaceNameByBranch, allStars: all,
    henyouByBranch: {}, henyou2All: [{ name: "天元", mark: TEN_MARK[o.tenyuan], origin: "henyou2_stem_ming", starKey: o.tenyuan, starLabel: o.tenyuan === "yuebo" ? "月孛" : "火星" }],
    shenshaByBranch: {},
  };
}
{
  const html = (d: PalaceDetail) => renderToStaticMarkup(<PalaceDetailPanel detail={d} />);
  const notTen = html(chart({ status: "", tenyuan: "mars" }));
  check(!notTen.includes(TARGET), "パネル：月孛官禄・天元主でない → 本文が要約にも詳細にも出ない");
  check(notTen.includes("資料の成立条件（月孛が廟（廟方）かつ天元主（作天元主））をこの盤で確認できないため表示しない"), "パネル：非表示の理由を表示");
  check(notTen.includes("月孛が官禄宮にあり") === false, "パネル：要約の照宮文にも出ない");
  const miaoNotTen = html(chart({ status: "廟", tenyuan: "mars" }));
  check(!miaoNotTen.includes(TARGET), "パネル：廟だが天元主でない → 非表示");
  const full = html(chart({ status: "廟", tenyuan: "yuebo" }));
  check(full.includes(TARGET), "パネル：廟＋天元主 → 表示");
  // 無条件の層（総論・躔宿）は従来どおり出る
  check(notTen.includes("月孛が心宿にあると"), "パネル：無条件の躔宿（月孛心宿）は表示のまま");
  check(notTen.includes("月孛は水の余気"), "パネル：無条件の総論（月孛）は表示のまま");
}

// ---------- 件数 ----------
const byCls: Record<string, string[]> = { A: [], B: [], C: [] };
for (const [id, r] of Object.entries(QZ_DISPLAY_RULES)) byCls[r.cls].push(id);
const total = allIds.size;
const conditional = Object.keys(QZ_DISPLAY_RULES).length;
if (process.argv.includes("--print")) {
  for (const [name, rs] of SOURCES) {
    const c = rs.filter((r) => QZ_DISPLAY_RULES[r.id]);
    console.log(`${name}: ${rs.length}件（条件付き ${c.length}件：A ${c.filter((r) => QZ_DISPLAY_RULES[r.id].cls === "A").length}／B ${c.filter((r) => QZ_DISPLAY_RULES[r.id].cls === "B").length}／C ${c.filter((r) => QZ_DISPLAY_RULES[r.id].cls === "C").length}）`);
  }
  for (const k of ["A", "B", "C"]) console.log(`${k}: ${byCls[k].join(" ")}`);
}
console.log(`監査対象 ${total}件 / 条件付き ${conditional}件（A ${byCls.A.length}・B ${byCls.B.length}・C ${byCls.C.length}）/ 無条件 D ${total - conditional}件`);
if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
console.log("PASS");
