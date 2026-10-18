// tests/liuren_interpretation_basic_readings.manual.ts
//
// 六壬神課 基本判断（BASIC READING。src/lib/liuren/interpretation/basicReadings.ts）のテスト。
// 実行: npx tsx tests/liuren_interpretation_basic_readings.manual.ts
//
//   1. 検証用の架空の盤（乙丑日・月将辰・占時戌・返吟 無依格・三伝 戌→辰→戌・旬空 戌亥。実占例ではない）
//   2. 720課: 読みは講座の文の引用・出典の頁つき・評価は講座が明示した語だけ・DOMAIN の向きを持たない・FACT を書き換えない
//   3. 空亡: 旬空・坐空・天空を区別し、三伝全部空亡は旬空だけで判定（坐空を含む場合は保留）
//   4. 応期: 初伝が月建・日支・太歳のときだけ。初伝が空亡ならその事実を併記
//   5. 既存機能: DOMAIN は基本判断を使わない（374規則の出力は変えない）・『大全』の規則は入れない

import { readFileSync, readdirSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { basicReadingsOf, BASIC_READING_RULE_IDS } from "../src/lib/liuren/interpretation/basicReadings";
import type { BasicReadingResult } from "../src/lib/liuren/interpretation/basicReadings";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: string, shi = "子") =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi as Branch, monthGeneral: jiang as Branch }));
const get = (r: BasicReadingResult, id: string) => r.readings.find((x) => x.id === id) ?? null;
const heldOf = (r: BasicReadingResult, id: string) => r.held.find((x) => x.id === id) ?? null;

// ---- 1. 検証用の架空の盤 ----
{
  const f = factsOf("乙丑", "辰", "戌"), r = basicReadingsOf(f, "戌");
  check("盤: 返吟（無依格）・三伝 戌→辰→戌", f.sanchuan.status === "determined" && f.sanchuan.method === "返吟" && f.transmissions!.map((t) => t.branch).join("") === "戌辰戌");
  check("1. 初伝 戌 の空亡を認識し、講座64頁「事の発端がはっきりせず、無意味になることもある」を出す", get(r, "basic.initial.void")?.citations[0].page === "p64" && get(r, "basic.initial.void")!.reading === "事の発端がはっきりせず、無意味になることもある。");
  check("2. 末伝 戌 の空亡を認識し、講座59頁「終わりはすっきりしないものになりがち」を出す（回収困難とは書かない）",
    get(r, "basic.void.final")?.citations[0].page === "p59" && !JSON.stringify(r).includes("回収困難"));
  check("空亡の区別: 初伝・末伝は旬空（浮天空亡）、中伝は坐空（落底空亡）", get(r, "basic.void.kind.initial")!.detected.includes("旬空") && get(r, "basic.void.kind.middle")!.detected.includes("坐空")
    && get(r, "basic.void.kind.final")!.detected.includes("旬空"));
  check("三伝全部空亡: 中伝が坐空なので判定せず保留（坐空を含めるかは原典で確認まで）", !get(r, "basic.void.allTransmissions") && heldOf(r, "basic.void.allTransmissions")?.reason.includes("坐空") === true);
  const fy = get(r, "basic.lessonForm.fanyin");
  check("返吟: 講座38頁の定義と53頁の冲の象意を出し、返吟そのものの象意（『大全』）は出さない", !!fy && fy.citations.map((c) => c.page).join() === "p38,p53" && !JSON.stringify(r).includes("往来") && !JSON.stringify(r).includes("往來"));
  check("初伝が冲を受ける読みは、相手が講座に書かれていないので保留", heldOf(r, "basic.initial.harmed") !== null && !get(r, "basic.initial.harmed"));
  const tm = get(r, "basic.timing.month");
  check("応期: 初伝 戌 が月建 戌 → 「事は１ヶ月以内にはっきりする」（講座65頁）。初伝の空亡を併記し、達成時期と断定しない",
    tm?.reading === "事は１ヶ月以内にはっきりする。" && tm.note!.includes("旬空") && tm.note!.includes("目的の達成時期とは断定しない"));
  check("応期: 月支がなければ月建の応期を出さない", !get(basicReadingsOf(f, null), "basic.timing.month"));
  check("根拠のない発見日・方位を作らない（日付・方位の語がない）", !/発見日|[0-9０-９]+日|東|西|南|北/.test(r.readings.map((x) => x.reading + (x.note ?? "")).join("")));
  check("三伝の役割: roleRules.ts の汎用 ROLE 規則（初伝・末伝）と講座58頁の中伝を出す", get(r, "basic.role.initial")!.citations[0].quote.includes("general.initial.process")
    && get(r, "basic.role.final")!.citations[0].quote.includes("general.final.outcome") && get(r, "basic.role.middle")!.citations[0].page === "p58");
  check("占時: 戌は日干 乙 の財・寄宮 辰 と冲・日支 丑 と刑・旬空（講座60頁）", ["basic.divination.wealth", "basic.divination.lodgingOuter", "basic.divination.branchInner", "basic.divination.void"].every((id) => get(r, id)?.citations[0].page === "p60"));
  console.log(`  架空の盤（乙丑日 辰将 戌時・月支戌）: 基本判断 ${r.readings.length} 件・保留 ${r.held.length} 件`);
}

// ---- 2〜4. 720課 ----
{
  let quoted = true, paged = true, evalOk = true, noDirection = true, unchanged = true, deterministic = true, idsKnown = true, onlyKoza = true;
  let allVoidSeen = 0, allVoidHeld = 0, allVoidOk = true, timingOk = true, voidNoteOk = true, hasAny = true;
  const EVAL_OK = new Set(["吉", "凶", "よくない", "概して吉", "動くに吉", "後で動いた方が吉", "順調", "不利"]);
  const known = new Set(BASIC_READING_RULE_IDS);
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, f = factsOf(day, BRANCHES[o]), mb = BRANCHES[(i + o) % 12] as Branch, before = JSON.stringify(f);
    const r = basicReadingsOf(f, mb), r2 = basicReadingsOf(f, mb);
    if (JSON.stringify(f) !== before) unchanged = false;
    if (JSON.stringify(r) !== JSON.stringify(r2)) deterministic = false;
    if (!r.readings.length) hasAny = false;
    for (const x of r.readings) {
      if ("direction" in x) noDirection = false;
      if (!x.citations.length || x.citations.some((c) => c.source !== "『六壬神課講座』")) onlyKoza = false;
      if (x.citations.some((c) => !/^p\d+(・p\d+)?$/.test(c.page))) paged = false;
      if (x.category !== "role" && x.category !== "symbolism" && !x.citations.some((c) => c.quote.includes(x.reading.replace(/。$/, "")))) quoted = false;
      if (x.evaluation !== null && !EVAL_OK.has(x.evaluation)) evalOk = false;
      const base = x.id.replace(/\.(initial|middle|final|im|mf)$/, "");
      if (!known.has(x.id) && !known.has(base) && !x.id.startsWith("basic.relation.") && !x.id.startsWith("basic.symbolism")) idsKnown = false;
    }
    const ts = f.transmissions!, v = f.xun.voidBranches, sky = ts.filter((t) => f.generals.generalOn[t.branch] === "天空").length;
    const xun = ts.map((t) => v.includes(t.branch)), seat = ts.map((t) => !v.includes(t.branch) && v.includes(f.plate.earthUnder[t.branch]));
    const all = get(r, "basic.void.allTransmissions"), hd = heldOf(r, "basic.void.allTransmissions");
    if (all) { allVoidSeen += 1; if (!xun.every(Boolean) && !(sky === 1 && ts.every((t, k) => xun[k] || f.generals.generalOn[t.branch] === "天空"))) allVoidOk = false; }
    if (hd) { allVoidHeld += 1; if (!seat.some(Boolean) || all) allVoidOk = false; }
    const I = ts[0].branch;
    if (!!get(r, "basic.timing.month") !== (I === mb) || !!get(r, "basic.timing.dayBranch") !== (I === day[1]) || get(r, "basic.timing.taiSui")) timingOk = false;
    for (const x of r.readings.filter((y) => y.category === "timing")) if (v.includes(I) !== x.note!.includes("旬空")) voidNoteOk = false;
  }
  check("720課: どの盤にも基本判断がある（占的別規則が成立しなくても出せる）", hasAny);
  check("720課: 読みは講座の文をそのまま引用する（役割・象意を除き、出典の原文に読みの文が含まれる）", quoted);
  check("720課: 出典はすべて『六壬神課講座』で頁つき（『大全』の規則は入れない）", onlyKoza && paged);
  check("720課: 評価は講座が明示した語だけ（吉・凶・よくない・概して吉・動くに吉・後で動いた方が吉・順調・不利）", evalOk);
  check("720課: 基本判断は占的の向き（direction）を持たない", noDirection);
  check("720課: 登録した規則 ID だけを出す", idsKnown);
  check("720課: FACT を書き換えず、同じ入力で同じ結果", unchanged && deterministic);
  check("三伝全部空亡: 旬空だけ（または天空1つと旬空）で成立した盤だけ読みを出し、坐空を含む盤は保留", allVoidOk && allVoidHeld > 0, `成立 ${allVoidSeen}・保留 ${allVoidHeld}`);
  check("応期: 月建・日支に当たる盤だけに出し、太歳は入力がなければ出さない", timingOk);
  check("応期: 初伝が空亡かどうかを但し書きに正しく併記する", voidNoteOk);
  const f = factsOf("甲子", "子"), I = f.transmissions![0].branch;
  check("応期: 太歳を明示入力し、初伝が太歳なら「事は１年以内にはっきりする」", get(basicReadingsOf(f, null, { taiSui: taiSuiStateOf(I) }), "basic.timing.taiSui")?.reading === "事は１年以内にはっきりする。"
    && !get(basicReadingsOf(f, null, { taiSui: taiSuiStateOf(BRANCHES[(BRANCHES.indexOf(I) + 1) % 12] as Branch) }), "basic.timing.taiSui"));
}

// ---- 5. 既存機能 ----
{
  const dir = "src/lib/liuren/interpretation";
  const users = readdirSync(dir).filter((x) => x.endsWith(".ts") && x !== "basicReadings.ts" && /from "\.\/basicReadings"/.test(readFileSync(`${dir}/${x}`, "utf8")));
  check("DOMAIN・総合・文章化の lib は基本判断を使わない（374規則の出力は変えない。画面の adapter からだけ使う）", users.length === 0, users.join(","));
  const code = readFileSync(`${dir}/basicReadings.ts`, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  check("基本判断は起課を呼ばず、点数・総合吉凶を持たない", !/calculateLiuren|score/.test(code));
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
