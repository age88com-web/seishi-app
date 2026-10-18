// tests/liuren_ui_person_inputs.manual.tsx
//
// 六壬神課 Phase 5U（追加情報の入力基盤 src/app/liuren/personInputs.ts・LiurenQuestionInputs.tsx）のテスト。
// 実行: npx tsx tests/liuren_ui_person_inputs.manual.tsx
//
//   入力値 → 既存の InterpretationContext への変換と、既存の行人 DOMAIN の結果の変化を確かめる（画面操作の確認ではない）。
//   盤はエンジンの起課結果を使う（古典の占験の再現ではない）。

import { renderToStaticMarkup } from "react-dom/server";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, LiurenChart, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { evaluateTravelerDomain } from "../src/lib/liuren/interpretation/travelerDomain";
import { maleXingNianOf } from "../src/lib/liuren/interpretation/xingNian";
import type { InterpretationContext } from "../src/lib/liuren/interpretation/roles";
import { buildLiurenSynthesisView, contextOf } from "../src/app/liuren/synthesisAdapter";
import { buildSynthesisDisplay } from "../src/app/liuren/synthesisDisplay";
import { contextWithInputs, EMPTY_INPUTS, parseReckonedAge, reckonedAgeYearNotice, SIXTY } from "../src/app/liuren/personInputs";
import type { QuestionInputs } from "../src/app/liuren/personInputs";
import LiurenQuestionInputs from "../src/app/liuren/LiurenQuestionInputs";
import LiurenSynthesisView from "../src/app/liuren/LiurenSynthesisView";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const chartOf = (day: string, jiang: string): LiurenChart =>
  calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: "子", monthGeneral: jiang as Branch });
const T = { id: "traveler" as const, goal: "return" as const };
const base = contextOf(T)!;
const inp = (p: Partial<{ natal: string; sex: "" | "male" | "female"; reckonedAge: string }> = {}, extra: Partial<QuestionInputs> = {}): QuestionInputs =>
  ({ persons: { traveler: { natal: "", sex: "", reckonedAge: "", ...p } }, subjectIsTarget: false, symbol: "", ...extra });
const view = (day: string, jiang: string, i: QuestionInputs, mb: Branch | null = null) => buildLiurenSynthesisView(chartOf(day, jiang), mb, T, i)!;
const keys = (v: ReturnType<typeof view>) => v.result.missing.map((m) => m.key);
const rules = (v: ReturnType<typeof view>) => v.result.readings.map((r) => r.ruleId);
/** 追加情報で評価できるようになる行人の規則（travelerDomain.ts で本命・類神・行年を条件にする規則） */
const INPUT_RULES = ["traveler.natalInitial", "traveler.xuanwuYimaOnStem", "traveler.symbolOnSite", "traveler.symbolInBoard", "traveler.symbolVoid", "traveler.xingNianSkyEarth", "traveler.xingNianUpperInTransmissions"];
const textOf = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
/** 通常表示の部分（main の開始タグの後から、詳細の details の開始タグの前まで） */
const mainOf = (h: string) => { const i = h.indexOf('data-testid="liuren-synthesis-main">'), j = h.indexOf("<details", i); return h.slice(i + 'data-testid="liuren-synthesis-main">'.length, j); };

// 1. 未入力は従来どおり
{
  check("未入力: Context は Phase 5T と同じ（人物・行年・類神を入れない）", JSON.stringify(contextWithInputs(base, EMPTY_INPUTS).context) === JSON.stringify(base)
    && JSON.stringify(contextWithInputs(base, inp()).context) === JSON.stringify(base));
  const v = view("甲子", "子", EMPTY_INPUTS);
  check("未入力: 行人の本命・行年・類神は従来どおり不足", ["travelerNatalYear", "xingNian", "targetSymbol"].every((k) => keys(v).includes(k)));
  check("未入力: 結果は Phase 5T（追加情報なし）と同じ", JSON.stringify(v.result) === JSON.stringify(buildLiurenSynthesisView(chartOf("甲子", "子"), null, T)!.result));
}

// 2. 人物: 問う人と行人を区別し、同一人物は明示したときだけ
{
  const sep = contextWithInputs(base, inp({ natal: "甲子" })).context;
  check("1: 既定では行人だけを人物にし、問う人の ID は入れない（同一人物にしない）", sep.travelerPersonId !== undefined && sep.subjectPersonId === undefined && sep.persons!.length === 1 && sep.persons![0].id === sep.travelerPersonId);
  const same = contextWithInputs(base, inp({ natal: "甲子" }, { subjectIsTarget: true })).context;
  check("2: 「問う人が行人本人」と明示したときだけ、問う人と行人を同じ人物 ID にする", same.subjectPersonId !== undefined && same.subjectPersonId === same.travelerPersonId && same.persons!.length === 1);
  const sameOnly = contextWithInputs(base, inp({}, { subjectIsTarget: true })).context;
  check("2: 本人と明示しただけでは本命・行年を作らない", sameOnly.persons![0].natalYear === undefined && sameOnly.xingNianInputs === undefined);
  check("内部 ID は画面に入力させない（入力値に ID の欄がない）", !("id" in inp().persons.traveler!));
  const other = contextWithInputs({ domain: "illness" } as InterpretationContext, inp({ natal: "甲子", sex: "male", reckonedAge: "30" }, { symbol: "general:天后" })).context;
  check("占的の入力項目がない DOMAIN では Context を変えない（他の占的に人物情報が混ざらない）", JSON.stringify(other) === JSON.stringify({ domain: "illness" }));
}

// 3. 本命
{
  let natalSeen = false, removedOk = true, onlyNatal = true;
  for (let i = 0; i < 60 && !natalSeen; i++) for (let o = 0; o < 12 && !natalSeen; o++) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, j = BRANCHES[o];
    const init = buildInterpretationFacts(chartOf(day, j)).transmissions![0].branch;
    const natal = SIXTY.find((g) => g[1] === init)!;
    const a = view(day, j, EMPTY_INPUTS), b = view(day, j, inp({ natal })), c = view(day, j, inp());
    if (!rules(b).includes("traveler.natalInitial")) continue;
    natalSeen = !rules(a).includes("traveler.natalInitial") && !keys(b).includes("travelerNatalYear") && keys(a).includes("travelerNatalYear");
    if (JSON.stringify(c.result) !== JSON.stringify(a.result)) removedOk = false;
    if (JSON.stringify(rules(b).filter((r) => r !== "traveler.natalInitial" && r !== "traveler.xuanwuYimaOnStem")) !== JSON.stringify(rules(a))) onlyNatal = false;
    if (natalSeen) console.log(`  本命: ${day}日 ${j}将・行人の本命 ${natal}（初伝 ${init}）→「${b.result.readings.find((r) => r.ruleId === "traveler.natalInitial")!.label}」が成立`);
  }
  check("3: 行人の本命を入力すると、本命の規則（本命が初伝）が評価され、不足から外れる", natalSeen);
  check("7: 本命を消すと、元の結果（不足）に戻る", removedOk);
  check("10: 本命の入力で変わるのは本命の規則だけ", onlyNatal);
}

// 4〜6. 行年
{
  const m = view("甲子", "子", inp({ sex: "male", reckonedAge: "38" }));
  const x = maleXingNianOf(38);
  check("4: 男性・数え38 → 既存の行年 FACT（一歳＝丙寅）で行年を求め、行年の規則が評価される", !keys(m).includes("xingNian") && rules(m).includes("traveler.xingNianSkyEarth")
    && m.result.readings.find((r) => r.ruleId === "traveler.xingNianSkyEarth")!.detected.includes(`行人の行年 ${x.branch}（数え38）`));
  const f = view("甲子", "子", inp({ sex: "female", reckonedAge: "38" }));
  check("5: 女性 → 男性の算法を当てはめず、行年は不足（女性の行年は起例が資料にない）", keys(f).includes("xingNian") && !rules(f).some((r) => r.startsWith("traveler.xingNian"))
    && f.result.missing.find((k) => k.key === "xingNian")!.detail.includes("女性の行年は起例が資料にないので求めない"));
  const na = view("甲子", "子", inp({ sex: "male" }));
  check("6: 数え年が未入力 → 行年を推測しない（不足）", keys(na).includes("xingNian") && na.result.missing.find((k) => k.key === "xingNian")!.detail.includes("数え年が指定されていない") && !rules(na).some((r) => r.startsWith("traveler.xingNian")));
  const ns = view("甲子", "子", inp({ reckonedAge: "38" }));
  check("性別が未入力 → 男性の算法を当てはめない（不足）", ns.result.missing.find((k) => k.key === "xingNian")!.detail.includes("性別が指定されていない") && !rules(ns).some((r) => r.startsWith("traveler.xingNian")));
  check("不正な数え年（文字・0・小数・151）は使わず、日本語の理由を返す", ["abc", "0", "1.5", "151", "-3"].every((s) => parseReckonedAge(s) === "invalid")
    && parseReckonedAge("３８") === 38 && parseReckonedAge("") === null);
  const bad = view("甲子", "子", inp({ sex: "male", reckonedAge: "abc" }));
  check("不正な数え年 → 行年は不足のまま・警告を出す", keys(bad).includes("xingNian") && bad.warnings.some((w) => w.field === "reckonedAge"));
  const removed = view("甲子", "子", inp({ sex: "", reckonedAge: "" }));
  check("7: 性別・数え年を消すと、元の結果に戻る", JSON.stringify(removed.result) === JSON.stringify(view("甲子", "子", EMPTY_INPUTS).result));
}

// 類神
{
  const s = view("甲子", "子", inp({}, { symbol: "general:天后" }));
  check("類神（天后）を指定すると類神の不足が外れ、規則は類神の位置で評価される", !keys(s).includes("targetSymbol") && JSON.stringify(s.context.targetSymbol) === JSON.stringify({ kind: "general", general: "天后" }));
  const bad = contextWithInputs(base, inp({}, { symbol: "general:XYZ" }));
  check("不正な類神は使わず、警告を出す", bad.context.targetSymbol === undefined && bad.warnings.some((w) => w.field === "symbol"));
}

// 9・10. 無関係な規則は変わらない・別人物が混ざらない（720課）
{
  const full = inp({ natal: "丙寅", sex: "male", reckonedAge: "45" }, { symbol: "general:天后" });
  let unrelated = true, someNew = 0, noAscii = true, sameRemoved = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) {
    const day = `${STEMS[i % 10]}${BRANCHES[i % 12]}`, j = BRANCHES[o], mb = BRANCHES[(i + o) % 12] as Branch;
    const a = view(day, j, EMPTY_INPUTS, mb), b = view(day, j, full, mb);
    const strip = (v: typeof a) => v.result.readings.filter((r) => !INPUT_RULES.includes(r.ruleId));
    if (JSON.stringify(strip(a)) !== JSON.stringify(strip(b))) unrelated = false;
    if (rules(b).some((r) => INPUT_RULES.includes(r))) someNew += 1;
    const facts = buildInterpretationFacts(chartOf(day, j));
    if (JSON.stringify(b.result) !== JSON.stringify(evaluateTravelerDomain(facts, b.context, mb))) unrelated = false;
    if (/[A-Za-z]/.test(textOf(mainOf(renderToStaticMarkup(<LiurenSynthesisView view={b} />))))) noAscii = false;
    if (JSON.stringify(view(day, j, EMPTY_INPUTS, mb).result) !== JSON.stringify(a.result)) sameRemoved = false;
  }
  check("10: 追加情報と関係しない規則の読みは、入力の前後で同じ（DOMAIN の評価関数の出力そのまま）", unrelated);
  check("追加情報で評価できるようになった規則が成立する盤がある", someNew > 0, `${someNew}`);
  check("8: 同じ盤・入力からは同じ結果（入力を空に戻せば元の結果）", sameRemoved);
  check("11: 追加情報を入れても、通常表示に英字（内部識別子）が出ない", noAscii);
  const b = view("甲子", "子", full);
  check("通常表示の問いの情報に、入力の要約を日本語で出す（内部 ID を出さない）", buildSynthesisDisplay(b).facts.some((f) => f.label === "行人の本命" && f.value === "丙寅")
    && buildSynthesisDisplay(b).facts.some((f) => f.value === "男性・数え45歳") && !JSON.stringify(buildSynthesisDisplay(b).facts).includes("p-"));
}

// 入力欄の表示
{
  const h = renderToStaticMarkup(<LiurenQuestionInputs domain="traveler" value={EMPTY_INPUTS} warnings={[]} onChange={() => {}} />);
  check("入力欄: 行人の本命・性別・数え年・類神・本人の確認だけを、日本語で「任意」と明示して出す",
    ["行人の本命（生年干支・任意）", "行人の性別（行年用・任意）", "行人の数え年（行年用・任意）", "類神（任意）", "問う人が行人本人である", "追加情報（すべて任意）"].every((x) => h.includes(x)));
  check("入力欄: 表示文字に英字・内部 ID がない", !/[A-Za-z]/.test(textOf(h)) && !h.includes("p-traveler"));
  check("入力欄: 入力項目のない占的では何も出さない", renderToStaticMarkup(<LiurenQuestionInputs domain="illness" value={EMPTY_INPUTS} warnings={[]} onChange={() => {}} />) === "");
  check("入力欄: 問う人の本命の欄はない（行人の規則が使わない）", !h.includes("問う人の本命"));
}

// 数え年の再確認（入力確認のためだけ。数え年は計算・変更しない）
{
  const n = reckonedAgeYearNotice(2026, 2027, "38");
  check("数え年の再確認: 入力時と占う日時の西暦年が違えば、確認を促す日本語の文を返す", !!n && n.includes("西暦2026年→2027年") && n.includes("自動では変えません") && !/[A-Za-z]/.test(n));
  check("数え年の再確認: 同じ年・年が分からない（日干支の直接指定）・数え年なしでは出さない（推測しない）",
    reckonedAgeYearNotice(2026, 2026, "38") === null && reckonedAgeYearNotice(null, 2027, "38") === null && reckonedAgeYearNotice(2026, null, "38") === null && reckonedAgeYearNotice(2026, 2027, "") === null);
  const h = renderToStaticMarkup(<LiurenQuestionInputs domain="traveler" value={inp({ sex: "male", reckonedAge: "38" })} warnings={[]} onChange={() => {}} ageNotice={n} />);
  check("数え年の再確認: 入力欄に表示し、入力値（数え年）はそのまま", h.includes('data-testid="liuren-age-notice"') && h.includes('value="38"'));
  check("数え年の再確認: 再確認の文があっても DOMAIN の結果は入力値どおり（数え年を変えない）",
    JSON.stringify(view("甲子", "子", inp({ sex: "male", reckonedAge: "38" })).result) === JSON.stringify(evaluateTravelerDomain(buildInterpretationFacts(chartOf("甲子", "子")), contextWithInputs(base, inp({ sex: "male", reckonedAge: "38" })).context, null)));
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
