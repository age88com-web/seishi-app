// tests/shichusuimei_kakkyoku.manual.ts
//
// 四柱推命 強弱・格局の補助判定（src/lib/shichusuimei/kakkyoku/）の照合テスト。
// 実行: npx tsx tests/shichusuimei_kakkyoku.manual.ts
//
// 照合方針（docs/shichusuimei-kakkyoku-spec.md §16・KD20・KD24・KD27）:
//   資料の命例（safe 15件）のうち「身強」「身弱」は、秀山式内格力量判定法（elementForce：KD27）の最終判定と一致するかを見る。
//   三得の候補（classificationCandidates）には要求しない（KD24-4）。
//   それ以外の格名は、エンジンの候補一覧に含まれるかだけを見る（contains）。
//   命例の得令・得勢・得地・三得類型・内格点数は正解値として固定しない（資料に記載がない）。ログには出す。
//   KD25（3命例の身強を資料誤記とした確定）は 2026-10-13 に撤回済み。3命例は資料どおり身強として照合する。
//   命例は仕様の検証用。命例に合わせて係数を調整しない（KD26-3）。
//   得令・得地の判定規則そのもの（KD24-1〜3）は、命例とは別に直接テストする。
//   needs_review の命例（Phase 1 D4 の人物）は照合しない。
//   あわせて、仕様上の不変条件（内格点数は外格判定のあと・内格の経路か内格候補があるときだけ、時柱なしは参考判定 など）を確認する。

import {
  assessKakkyoku,
  assessStrength,
  buildInterpretationInput,
  judgeSupportRatio,
  zokanShares,
  branchStates,
  EMPTY_DECISION,
  FINAL_PATTERN_OPTIONS,
  resolveEffectivePattern,
  resolveEffectiveStrength,
  FINAL_STRENGTH_OPTIONS,
} from "../src/lib/shichusuimei/kakkyoku";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import KakkyokuView from "../src/app/shichusuimei/KakkyokuView";
import type { Pillars } from "../src/lib/shichusuimei/kakkyoku";
import type { Branch, Stem } from "../src/lib/shichusuimei";
import { STEM_ELEMENT, zokanOf } from "../src/lib/shichusuimei";

const toPillars = (s: string): Pillars => {
  const [h, d, m, y] = s.split(" ");
  const pp = (x: string) => ({ stem: x[0] as Stem, branch: x[1] as Branch });
  return { 時: h === "-" ? null : pp(h), 日: pp(d), 月: pp(m), 年: pp(y) };
};

/** §16 の safe 命例（命式は 時・日・月・年） */
/** expected は資料の格名。notEngineChecked の格名は一般の成立条件が資料にないため照合しない（needs_review） */
const FIXTURES: {
  id: string;
  name: string;
  source: string;
  pillars: string;
  expected: string[];
  notEngineChecked?: string[];
}[] = [
  { id: "KK-F09", name: "シュワルツェネッガー", source: "p37・三p29", pillars: "戊寅 庚戌 丁未 丁亥", expected: ["身強"] },
  { id: "KK-F10", name: "佐野量子", source: "p38・三p30", pillars: "甲戌 甲子 庚申 戊申", expected: ["身弱"] },
  { id: "KK-E01", name: "張飛", source: "p39・三p31", pillars: "癸亥 癸亥 癸亥 癸亥", expected: ["従旺格"] },
  { id: "KK-F21", name: "千代の富士", source: "p80・三p72", pillars: "丙辰 癸巳 辛巳 乙未", expected: ["身弱"] },
  { id: "KK-F24", name: "釈由美子", source: "p87・三p79", pillars: "丙戌 乙巳 戊午 戊午", expected: ["従格"] },
  { id: "KK-F26", name: "堂本剛", source: "p92・三p84", pillars: "丁未 丁未 戊辰 己未", expected: ["従格"] },
  { id: "KK-F01", name: "松下幸之助", source: "p118・三p110", pillars: "丙辰 癸酉 乙亥 甲午", expected: ["身強"] },
  // ベッカム: 修正済みテキスト（伝統命理基礎編.key）の表記は「身強（月刃格）」（KD15-2）。
  // 月刃格は KD21 の成立条件で照合する（KD27-U4 で格局候補も KD21 に統一）
  { id: "KK-F13", name: "ベッカム", source: "伝統命理基礎編.key（修正済み）", pillars: "乙卯 戊申 庚辰 乙卯", expected: ["身強", "月刃格"] },
  { id: "KK-F14", name: "雛形あきこ", source: "三p36", pillars: "己巳 己丑 癸丑 丁巳", expected: ["従旺格"] },
  { id: "KK-F15", name: "ジョブズ", source: "三p37", pillars: "辛卯 丙辰 戊寅 乙未", expected: ["身強"] },
  { id: "KK-F16", name: "松坂大輔", source: "三p38", pillars: "己巳 己丑 乙酉 庚申", expected: ["身弱"] },
  { id: "KK-F17", name: "宇多田ヒカル", source: "三p39", pillars: "辛丑 丁未 癸丑 壬戌", expected: ["従格"] },
  { id: "KK-F06", name: "長嶋一茂", source: "三p56", pillars: "癸未 乙酉 己丑 乙巳", expected: ["身弱"] },
  { id: "KK-F07", name: "藤原紀香", source: "三p57", pillars: "庚午 甲申 甲午 辛亥", expected: ["身弱"] },
  // 羽生善治: 資料は「金の従旺格」。化格候補（乙庚→金・月支酉）と併存して判定する（KD22・KD23）
  { id: "KK-F08", name: "羽生善治", source: "三p58", pillars: "庚辰 庚戌 乙酉 庚戌", expected: ["従旺格"] },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: string) => {
  if (ok) pass += 1;
  else {
    fail += 1;
    failures.push(`- ${label}\n    ${detail}`);
  }
};

console.log("四柱推命 強弱・格局 補助判定（資料の格名が候補に含まれるか）");
for (const f of FIXTURES) {
  const r = assessKakkyoku(toPillars(f.pillars));
  const names = r.candidates.filter((c) => c.status !== "not_applicable").map((c) => c.name);
  const s = r.strength;
  const ef = r.elementForce;
  const summary =
    `三得[${s.classificationCandidates.join("・")}] 令${s.tokurei.value} 勢${s.tokusei.value} 地${s.tokuchi.value}` +
    ` 党多${s.touta.level}(${s.touta.share.minPercent.toFixed(0)}〜${s.touta.share.maxPercent.toFixed(0)}%)` +
    ` 秀山式 扶助率${ef.supportRatioPercent.toFixed(1)}%・点数${ef.scoreJudgment}・格局${ef.monthPattern ?? "なし"}→${ef.finalJudgment}` +
    ` 経路${r.route} 候補[${names.join("・")}]`;
  for (const e of f.expected) {
    if (f.notEngineChecked?.includes(e)) {
      console.log(`  SKIP ${f.id} ${f.name}（${e}）照合対象外（needs_review。一般条件なし、または資料と確定規則の食い違い）`);
      continue;
    }
    const isStrength = e === "身強" || e === "身弱";
    // 身強・身弱は秀山式の最終判定で照合（KD20・KD24-4・KD27）。その他の格名は候補に含まれるか
    const ok = isStrength ? ef.finalJudgment === e : names.includes(e);
    console.log(`  ${ok ? "PASS" : "FAIL"} ${f.id} ${f.name}（${e}）${summary}`);
    check(`${f.id} ${f.name}（${f.source}）期待: ${e}`, ok, summary);
  }

  // 不変条件
  check(`${f.id} 内格補助は常に計算する（KD19）`, r.elementForce !== null, `route=${r.route}`);
  check(`${f.id} 画面・resolveEffectiveStrength・解釈入力が同じ秀山式を参照`,
    resolveEffectiveStrength(r, EMPTY_DECISION).value === ef.finalJudgment && resolveEffectiveStrength(r, EMPTY_DECISION).source === "elementForce" &&
      buildInterpretationInput(toPillars(f.pillars), r, EMPTY_DECISION).innerPattern.judgment === ef.finalJudgment &&
      renderToStaticMarkup(createElement(KakkyokuView, { k: r, decision: EMPTY_DECISION, onDecisionChange: () => {} })).includes(`：${ef.finalJudgment}</div>`),
    ef.finalJudgment);
  // 格局候補の月刃格・建禄格と強弱判定側の KD21 が同じ（KD27-U4）
  check(`${f.id} 格局候補と強弱判定の KD21 が一致`,
    (["月刃格", "建禄格"] as const).every((n) => (r.candidates.find((c) => c.name === n)?.status === "candidate") === (ef.monthPattern === n)),
    `${ef.monthPattern} / ${r.candidates.filter((c) => ["月刃格", "建禄格"].includes(c.name)).map((c) => `${c.name}:${c.status}`).join(" ")}`);
  check(`${f.id} 最終判断は術者`, r.finalJudgment === "requires_practitioner_judgment", "");
}

// ベッカム: 資料の表記（KD15-2）。KD25 は撤回済み
{
  const b = FIXTURES.find((f) => f.name === "ベッカム")!;
  check("ベッカム: 資料の表記は身強・月刃格（KD15-2）", !b.expected.includes("身弱") && b.expected.includes("身強") && b.expected.includes("月刃格"), JSON.stringify(b.expected));
  const kb = assessKakkyoku(toPillars(b.pillars));
  check("ベッカム: 点数は身弱・月刃格で最終身強（KD27-7・KD28）", kb.elementForce.scoreJudgment === "身弱" && kb.elementForce.monthPattern === "月刃格" && kb.elementForce.finalJudgment === "身強", "");
}

// 得地のみ（20%）は弱側 → 身弱候補
{
  const r = assessKakkyoku(toPillars("丙辰 癸巳 辛巳 乙未")); // 千代の富士
  check("20%: 類型は弱（得地のみ）", r.strength.classificationCandidates.includes("弱（得地のみ）"), r.strength.classificationCandidates.join("・"));
}

// 時柱なし（参考判定）
{
  const r = assessKakkyoku(toPillars("- 丁巳 甲辰 丁亥"));
  check("時柱なし: referenceOnly", r.referenceOnly, "");
  check("時柱なし: candidate を出さない", r.candidates.every((c) => c.status !== "candidate"), r.candidates.map((c) => `${c.name}:${c.status}`).join(" "));
  check("時柱なし: 内格力量も referenceOnly", r.elementForce.referenceOnly, "");
}

// 干合・化格（KD23）: 月支条件で再評価（命例に合わせた特例はない）
{
  const cls = (s: string, pos: "日干-月干" | "日干-時干") => assessKakkyoku(toPillars(s)).hehua.find((x) => x.position === pos)!;
  const moe = cls("甲子 己亥 丙午 丁巳", "日干-時干"); // 山口もえ（D4 人物）: 甲己→土・月支午
  check("化格: 山口もえ 甲己→土・月支午は辰戌丑未外 → 合去", moe.stemCombination === "hequ" && moe.monthCondition === false, JSON.stringify(moe));
  const habu = cls("庚辰 庚戌 乙酉 庚戌", "日干-月干"); // 羽生善治: 乙庚→金・月支酉
  check("化格: 羽生善治 乙庚→金・月支酉 → 化格候補（補強あり）", habu.stemCombination === "hehuaCandidateSupported" && habu.monthCondition === true, JSON.stringify(habu));
  check("化格: 補強に干合の2干自身（日干庚・月干乙）を数えない", !habu.supports.some((x) => x.includes("日干") || x.includes("月干")), habu.supports.join("／"));
  const jobs = cls("辛卯 丙辰 戊寅 乙未", "日干-時干"); // ジョブズ: 丙辛→水・月支寅
  check("化格: ジョブズ 丙辛→水・月支寅 → 合去", jobs.stemCombination === "hequ", JSON.stringify(jobs));
  const mj = cls("癸亥 戊寅 庚申 戊戌", "日干-時干"); // マイケル・ジャクソン（D4 人物）: 戊癸→火・月支申
  check("化格: マイケル 戊癸→火・月支申 → 合去", mj.stemCombination === "hequ", JSON.stringify(mj));
  for (const [n, h] of [["山口もえ", moe], ["羽生善治", habu], ["ジョブズ", jobs], ["マイケル", mj]] as const) {
    console.log(`  化格 ${n}: ${h.stems?.join("")}→${h.transformElement} 月支${h.monthBranch} ${h.stemCombination} 補強[${h.supports.join("／")}] 月支関係[${h.monthRelations.join("・")}]`);
  }
  const yearOnly = assessKakkyoku(toPillars("丙寅 甲子 丙寅 己亥")); // 日干甲と年干己の干合のみ
  check("干合: 年干との干合は対象外", yearOnly.hehua.every((x) => x.stemCombination === "none"), JSON.stringify(yearOnly.hehua));

  // 5組の月支対応（日干−時干の干合で、月支だけを変える）
  const TABLE: [string, string, string, string][] = [
    ["甲", "己", "土", "辰戌丑未"],
    ["乙", "庚", "金", "巳酉丑"],
    ["丙", "辛", "水", "申子辰"],
    ["丁", "壬", "木", "亥卯未"],
    ["戊", "癸", "火", "寅午戌"],
  ];
  for (const [d, h, x, ok] of TABLE) {
    for (const m of "子丑寅卯辰巳午未申酉戌亥") {
      const r = cls(`${h}子 ${d}子 丙${m} 丙子`, "日干-時干");
      const expectOk = ok.includes(m);
      const good = r.transformElement === x && r.monthCondition === expectOk &&
        (expectOk ? r.stemCombination === "hehuaCandidate" || r.stemCombination === "hehuaCandidateSupported" : r.stemCombination === "hequ");
      check(`月支対応: ${d}${h}化${x}・${m}月 → ${expectOk ? "月支条件成立（化格候補）" : "不成立（合去）"}`, good, JSON.stringify(r));
    }
  }

  // 酉月の甲己: 土の天干・地支があっても月支条件を飛び越えない
  const yu = cls("己未 甲戌 戊酉 己丑", "日干-時干");
  check("甲己・酉月: 土の天干・地支があっても合去", yu.stemCombination === "hequ" && yu.supports.length === 0, JSON.stringify(yu));
  const yuK = assessKakkyoku(toPillars("己未 甲戌 戊酉 己丑"));
  check("甲己・酉月: 化格候補にしない", yuK.candidates.some((c) => c.name === "化格" && c.status === "not_applicable" && !c.uiVisible), "");
  // 月支関係は事実だけ返す（成否を決めない）
  const rel = cls("己未 甲辰 戊辰 丙戌", "日干-時干"); // 月支辰・年支戌（隣接の冲）
  check("月支関係: 冲を事実として返し、化格候補のまま", rel.monthCondition === true && rel.monthRelations.some((x) => x.endsWith("冲")) && rel.stemCombination !== "hequ", JSON.stringify(rel));

  // 補強＝化す五行と比和する天干・地支だけ（印・党多は参考情報）
  const stemSup = cls("己卯 甲子 丙辰 戊寅", "日干-時干"); // 甲己→土・月支辰。年干戊（土）
  check("補強1: 月支条件成立＋比和天干 → 化格候補（補強あり）",
    stemSup.stemCombination === "hehuaCandidateSupported" && stemSup.supports.length === 1 && stemSup.supports[0].includes("比和する天干：年干戊"), JSON.stringify(stemSup));
  const brSup = cls("己卯 甲子 庚辰 辛丑", "日干-時干"); // 年支丑（土）
  check("補強2: 月支条件成立＋比和地支 → 化格候補（補強あり）",
    brSup.stemCombination === "hehuaCandidateSupported" && brSup.supports.length === 1 && brSup.supports[0].includes("比和する地支：年支丑"), JSON.stringify(brSup));
  const inOnly = cls("己卯 甲子 丙辰 丙寅", "日干-時干"); // 火（印）の天干だけ
  check("補強3: 月支条件成立＋印だけ → 化格候補・補強ありにしない",
    inOnly.stemCombination === "hehuaCandidate" && inOnly.supports.length === 0 && inOnly.references.some((x) => x.includes("土を生じる火")), JSON.stringify(inOnly));
  const toutaOnly = cls("己巳 甲午 丙辰 丙午", "日干-時干"); // 火（印）が多い。土は干合の己と月支辰だけ
  check("補強4: 月支条件成立＋党多だけ → 化格候補・補強ありにしない",
    toutaOnly.stemCombination === "hehuaCandidate" && toutaOnly.supports.length === 0 && toutaOnly.references.some((x) => x.includes("比劫＋印") && x.includes("党多")), JSON.stringify(toutaOnly));
  const both = cls("丙子 辛酉 壬辰 庚申", "日干-時干"); // 丙辛→水・月支辰。申子辰三合＋辰酉六合（月支−日支）
  check("月支関係5: 三合と六合を両方表示（優先順位で消さない）",
    both.monthCondition === true && both.monthRelations.includes("申子辰三合") && both.monthRelations.includes("辰酉六合"), JSON.stringify(both.monthRelations));
  const bothK = assessKakkyoku(toPillars("丙子 辛酉 壬辰 庚申"));
  const kaka = bothK.candidates.find((c) => c.name === "化格")!;
  check("月支関係5: 化格候補の注記にも両方出る", kaka.status === "candidate" && kaka.notes.some((n) => n.includes("申子辰三合") && n.includes("辰酉六合")), kaka.notes.join("／"));
  const ngSup = cls("己卯 甲子 戊酉 戊辰", "日干-時干"); // 月支酉。年干戊・月干戊・年支辰（土）
  check("補強6: 月支条件不成立＋比和天干 → 合去（補強・参考を出さない）",
    ngSup.stemCombination === "hequ" && ngSup.supports.length === 0 && ngSup.references.length === 0 && ngSup.monthRelations.length === 0, JSON.stringify(ngSup));
  check("行運補強: 原局とは別項目（未実装のため null）", [stemSup, inOnly, ngSup].every((h) => h.luckSupport === null), "");
}

// 地支の化（KD13・KD14。branchState.ts）: 半合（旺支を含む隣接の2支）は化五行。月支も半合なら化す（KD13-12。2026-10-14）
{
  const st = (pillars: string, k: string) => branchStates(toPillars(pillars)).find((x) => x.pillar === k)!;
  const a = "丙辰 甲子 丁卯 庚午"; // 日支子・時支辰（隣接・旺支子）で半合 → 水
  check("半合: 日支子→水", st(a, "日").transformedTo === "水", JSON.stringify(st(a, "日")));
  check("半合: 時支辰→水", st(a, "時").transformedTo === "水", JSON.stringify(st(a, "時")));
  const b = "丙寅 甲申 丙子 庚午"; // 月支子・日支申で半合（月支子は年支午と冲もあるが、冲より半合が優先）
  check("月支も半合で化す（月支子→水）", st(b, "月").transformedTo === "水", JSON.stringify(st(b, "月")));
  check("月支と半合した日支申は化す（水）", st(b, "日").transformedTo === "水", JSON.stringify(st(b, "日")));
  const t = "辛巳 乙亥 戊申 壬子"; // 貴乃花光司: 年支子・月支申の申子半合（旺支子を含む・隣接）
  check("申子半合: 年支子は水（化）", st(t, "年").transformedTo === "水" && st(t, "年").relations.some((x) => x.startsWith("半合")), JSON.stringify(st(t, "年")));
  check("申子半合: 月支申も水（化）", st(t, "月").transformedTo === "水" && st(t, "月").relations.some((x) => x.startsWith("半合")), JSON.stringify(st(t, "月")));
  // 月支の半合: 通根は元の蔵干（月支申は水に化しても、蔵干庚があるので時干辛の根に数える）
  const tk = assessKakkyoku(toPillars(t)).elementForce;
  check("月支が半合で化しても根は元の蔵干（時干辛の根に月支申）", tk.stems.find((x) => x.pillar === "時")!.roots.includes("月"), JSON.stringify(tk.stems.find((x) => x.pillar === "時")));
  check("月支が半合で化すと化後の五行へ100%（月支申 5点→水）", (() => { const m = tk.branches.find((x) => x.pillar === "月")!; return m.shares.length === 1 && m.shares[0].element === "水" && m.shares[0].points === 5; })(), "");
  // 旺支を欠く2支（申辰・亥未・寅戌・巳丑）は隣接していても半合にしない（月支を含む）
  for (const [pillars, label] of [["丙辰 甲申 丙午 庚午", "申辰"], ["丙未 甲亥 丙午 庚午", "亥未"], ["丙戌 甲寅 丙子 庚子", "寅戌"], ["丙丑 甲巳 丙午 庚午", "巳丑"], ["丙丑 甲戌 丙寅 庚子", "月支寅・日支戌"], ["丙午 甲丑 丙巳 庚子", "月支巳・日支丑"]] as const) {
    const sts = branchStates(toPillars(pillars));
    check(`旺支欠如: ${label} は半合にしない・化さない`, sts.every((x) => !x.relations.some((r) => r.startsWith("半合"))) && sts.filter((x) => ["日", "時", "月"].includes(x.pillar)).every((x) => x.transformedTo === null || x.relations.some((r) => /^(三合|三会|半会)/.test(r))), JSON.stringify(sts.map((x) => [x.pillar, x.branch, x.relations, x.transformedTo])));
  }
  // 半合は隣接のみ（年支申・日支子は月支を挟むので半合にしない）。三合は離れていても化す
  const far = branchStates(toPillars("丙午 甲子 丙寅 庚申"));
  check("半合は隣接のみ（年支申・日支子は化さない）", far.every((x) => x.transformedTo === null), JSON.stringify(far.map((x) => [x.pillar, x.transformedTo])));
  const sanFar = branchStates(toPillars("丙辰 甲午 丙子 庚申")); // 申子辰（年・月・時）。日支午は子と冲
  check("三合は離れていても化す（申子辰）", ["年", "月", "時"].every((k) => sanFar.find((x) => x.pillar === k)!.transformedTo === "水"), JSON.stringify(sanFar.map((x) => [x.pillar, x.transformedTo])));
  // 月支で半合と半会が競合し化五行が複数なら、他の地支と同じく化さない（実例3: 月支丑は子丑の半会＝水・丑酉の半合＝金）
  const j3 = branchStates(toPillars("戊辰 己酉 癸丑 壬子")).find((x) => x.pillar === "月")!;
  check("月支の半合と半会が別五行で競合 → 化さない", j3.transformedTo === null && j3.notes.some((n) => n.includes("複数")), JSON.stringify(j3));
  // 争合・双合（KD13-13）: 半合の2支のどちらかが命式内の別の支とも半合を作るなら化さない（隣接していない相手も数える）
  const sano = branchStates(toPillars("甲戌 甲子 庚申 戊申")); // 佐野量子: 年支申・月支申・日支子 → 子を2つの申が取り合う
  check("争合: 佐野量子 月支申・日支子は化さない", ["月", "日"].every((k) => { const x = sano.find((y) => y.pillar === k)!; return x.transformedTo === null && x.relations.some((r) => r.includes("争合")) && x.notes.some((n) => n.includes("争合")); }), JSON.stringify(sano));
  const sanoK = assessKakkyoku(toPillars("甲戌 甲子 庚申 戊申")).elementForce;
  check("争合: 佐野量子は化水前の力量で 32.8% 身弱", sanoK.supportRatioPercent.toFixed(1) === "32.8" && sanoK.finalJudgment === "身弱", `${sanoK.supportRatioPercent}`);
  const taka = branchStates(toPillars(t)); // 貴乃花: 子と申は一対一（亥・巳は半合の相手にならない）
  check("争合でない: 貴乃花 年支子・月支申は一対一の半合で化す", taka.every((x) => !x.relations.some((r) => r.includes("争合"))) && st(t, "年").transformedTo === "水" && st(t, "月").transformedTo === "水", "");
  const both = branchStates(toPillars("丙寅 甲申 丙子 庚申")); // 年支申・月支子・日支申（両隣の申が子を取り合う）
  check("争合: 両隣の申が月支子を取り合う → 3支とも化さない", both.filter((x) => x.pillar !== "時").every((x) => x.transformedTo === null), JSON.stringify(both.map((x) => [x.pillar, x.relations, x.transformedTo])));
  // 半会だけの月支は化さない（現行のまま）: 月支子・日支丑の子丑半会
  const hk = branchStates(toPillars("丙午 甲丑 丙子 庚午")).find((x) => x.pillar === "月")!;
  check("月支は半会では化さない（現行のまま）", hk.transformedTo === null && hk.relations.some((r) => r.startsWith("半会")), JSON.stringify(hk));
  const r = assessKakkyoku(toPillars(t));
  check("貴乃花光司: 内格の経路", r.route === "naikaku", r.route);
}

// 化格候補でも他の格局の判定を止めない（KD22・KD23）
{
  const habu = assessKakkyoku(toPillars("庚辰 庚戌 乙酉 庚戌")); // 乙庚→金・月支酉
  const vis = habu.candidates.filter((c) => c.uiVisible).map((c) => c.name);
  check("化格候補: 化格は candidate（自動確定しない）", habu.candidates.some((c) => c.name === "化格" && c.status === "candidate"), vis.join("・"));
  check("化格候補: 従旺格も併存", vis.includes("化格") && vis.includes("従旺格"), vis.join("・"));
  check("化格候補: 内格補助は計算し参考扱い", habu.elementForce !== null && habu.innerPatternScope === "withGaikakuCandidates", String(habu.innerPatternScope));
  check("化格候補: エンジンは1つを自動選択しない", habu.enginePattern === null, JSON.stringify(habu.enginePattern));
}

// 従格の一次除外: 日主に明確な根（月・日・時支の本気が同五行）
{
  const r = assessKakkyoku(toPillars("丙午 壬子 丙午 丙午")); // 日主壬・日支子（水）
  const ju = r.candidates.find((c) => c.name === "従格");
  check("日支に日主の強根: 従格候補にしない", !!ju && ju.status === "not_applicable" && !ju.uiVisible, JSON.stringify(ju));
  check("日支に日主の強根: 従財・従殺・従児も出さない", !r.candidates.some((c) => ["従財格", "従殺格", "従児格"].includes(c.name) && c.uiVisible), "");
}

// 化格未成立なら通常の判定へ（貴乃花光司）
{
  const r = assessKakkyoku(toPillars("辛巳 乙亥 戊申 壬子"));
  check("化格未成立: 通常どおり内格へ", r.route === "naikaku" && r.enginePattern?.name === "内格", r.candidates.map((c) => `${c.name}:${c.status}`).join(" "));
  check("KD21 非成立（日干乙・月支申）: 月刃格・建禄格は出さない", !r.candidates.some((c) => ["月刃格", "建禄格"].includes(c.name) && c.uiVisible), "");
  const ms = assessKakkyoku(toPillars("丙辰 癸酉 乙亥 甲午")); // 松下幸之助（癸・亥）
  const sw = assessKakkyoku(toPillars("戊寅 庚戌 丁未 丁亥")); // シュワルツェネッガー（庚・未）
  check("KD21 成立: 月刃格を候補として画面に出す", ms.candidates.some((c) => c.name === "月刃格" && c.status === "candidate" && c.uiVisible) && !ms.candidates.some((c) => c.name === "建禄格" && c.uiVisible), "");
  check("KD21 成立: 建禄格を候補として画面に出す", sw.candidates.some((c) => c.name === "建禄格" && c.status === "candidate" && c.uiVisible) && !sw.candidates.some((c) => c.name === "月刃格" && c.uiVisible), "");
  check("KD21 候補は外格の引き金にしない（内格へ）", sw.route === "naikaku", sw.route);
}

// 3層の分離と術者最終判断（KD19）
{
  const pillars = toPillars("辛巳 乙亥 戊申 壬子"); // 貴乃花光司（外格候補なし → 内格）
  const k = assessKakkyoku(pillars);
  // 未入力: エラーにならず、エンジン判定を参考として返す
  const none = resolveEffectivePattern(k, EMPTY_DECISION);
  check("術者未入力: エンジン判定を参考", none.source === "engine" && none.name === "内格", JSON.stringify(none));
  // 選択: 術者の判断を最優先
  const chosen = resolveEffectivePattern(k, { ...EMPTY_DECISION, finalPattern: "内格" });
  check("術者が選択: 術者判断を最優先", chosen.source === "practitioner" && chosen.name === "内格", JSON.stringify(chosen));
  // その他: 自由入力
  const other = resolveEffectivePattern(k, { ...EMPTY_DECISION, finalPattern: "その他", otherText: "仮従格" });
  check("その他: 自由入力を採用", other.source === "practitioner" && other.name === "仮従格", JSON.stringify(other));
  const otherEmpty = resolveEffectivePattern(k, { ...EMPTY_DECISION, finalPattern: "その他" });
  check("その他・未入力: エンジン判定に戻る", otherEmpty.source === "engine", JSON.stringify(otherEmpty));
  const labeled = resolveEffectivePattern(k, { ...EMPTY_DECISION, finalPattern: "一行得気格", finalPatternLabel: "一行得気格（潤下格）" });
  check("表示名: finalPatternLabel を採用", labeled.name === "一行得気格（潤下格）", JSON.stringify(labeled));
  // 別データ
  const d = { ...EMPTY_DECISION, finalPattern: "化格" as const, note: "月令重視" };
  const input = buildInterpretationInput(pillars, k, d);
  check("機械判定と術者判断は別データ", input.engine.pattern?.name === "内格" && input.practitionerDecision.finalPattern === "化格" && input.finalPattern.name === "化格", JSON.stringify(input.finalPattern));
  check("内格補助も別データで渡る", !!input.innerPattern.judgment, "");
  check("選択肢は既存仕様の名称＋その他", FINAL_PATTERN_OPTIONS.length === 13 && FINAL_PATTERN_OPTIONS.includes("化格") && FINAL_PATTERN_OPTIONS.includes("その他"), "");

  // 画面: 化格候補でも内格補助（参考）と術者最終判断欄が出る。断定表示はしない
  const html = renderToStaticMarkup(createElement(KakkyokuView, { k, decision: EMPTY_DECISION, onDecisionChange: () => {} }));
  const kHabu = assessKakkyoku(toPillars("庚辰 庚戌 乙酉 庚戌"));
  const htmlHabu = renderToStaticMarkup(createElement(KakkyokuView, { k: kHabu, decision: EMPTY_DECISION, onDecisionChange: () => {} }));
  const textHabu = htmlHabu.replace(/<[^>]+>/g, "");
  check("UI: 化格候補の表示（月支条件・月支関係・補強・最終判断）", ["化五行：金", "月支：酉", "月支条件：成立", "月支関係：", "補強：", "判定：化格候補（補強あり）", "最終判断：術者"].every((x) => textHabu.includes(x)), textHabu.slice(0, 300));
  check("UI: 合化成立・機械判定の断定表示なし", !textHabu.includes("合化成立") && !textHabu.includes("成立（機械判定）") && !textHabu.includes("化格優先"), "");
  check("UI: 化格候補でも内格補助を表示（参考）", textHabu.includes("内格として見る場合") && textHabu.includes("内格補助点は参考"), "");
  const kYu = assessKakkyoku(toPillars("己未 甲戌 戊酉 己丑"));
  const textYu = renderToStaticMarkup(createElement(KakkyokuView, { k: kYu, decision: EMPTY_DECISION, onDecisionChange: () => {} })).replace(/<[^>]+>/g, "");
  check("UI: 酉月の甲己は月支条件不成立・合去", ["干合：甲己（日干-時干）", "化五行：土", "月支：酉", "月支条件：不成立", "判定：合去"].every((x) => textYu.includes(x)) && !textYu.includes("合化成立"), textYu.slice(0, 300));
  check("UI: 術者最終判断の選択欄", html.includes("術者最終判断") && FINAL_PATTERN_OPTIONS.every((o) => html.includes(`>${o}</option>`)), "");
  const htmlOther = renderToStaticMarkup(createElement(KakkyokuView, { k, decision: { ...EMPTY_DECISION, finalPattern: "その他" }, onDecisionChange: () => {} }));
  check("UI: その他を選ぶと自由入力欄", htmlOther.includes("格局名"), "");
  const gai = assessKakkyoku(toPillars("丙戌 乙巳 戊午 戊午")); // 釈由美子（外格候補あり）
  const htmlGai = renderToStaticMarkup(createElement(KakkyokuView, { k: gai, decision: EMPTY_DECISION, onDecisionChange: () => {} }));
  check("UI: 外格候補ありでも内格補助を表示", htmlGai.includes("内格として見る場合"), "");
}

// 強弱表示の一本化と術者最終強弱（KD20・KD27）: 貴乃花光司（資料に身強・身弱の記載なし。秀山式は申子半合で月支も化水し 73.4% で身強）
{
  const pillars = toPillars("辛巳 乙亥 戊申 壬子");
  const k = assessKakkyoku(pillars);
  check("格局候補欄に身強・身弱を出さない", !k.candidates.some((c) => (c.name === "身強" || c.name === "身弱") && c.uiVisible), "");
  check("三得類型は材料として残る", k.strength.classificationCandidates.includes("弱（得地のみ）"), k.strength.classificationCandidates.join("・"));
  check("内格補助は秀山式（貴乃花 73.4% → 身強）", k.elementForce.finalJudgment === "身強" && k.elementForce.supportRatioPercent.toFixed(1) === "73.4", `${k.elementForce.supportRatioPercent}`);
  const jobsK = assessKakkyoku(toPillars("辛卯 丙辰 戊寅 乙未")); // ジョブズ（三得は弱側・秀山式は身強）
  check("三得と内格補助が食い違ってもエラーにならない（KD20-4）", jobsK.strength.classificationCandidates.includes("弱（得地のみ）") && jobsK.elementForce.finalJudgment === "身強", "");
  const html = renderToStaticMarkup(createElement(KakkyokuView, { k, decision: EMPTY_DECISION, onDecisionChange: () => {} }));
  const kakuBox = html.slice(html.indexOf("格局候補（機械判定）"), html.indexOf("内格補助</h3>"));
  check("UI: 格局候補欄に身強・身弱が出ない", !/身強|身弱/.test(kakuBox), kakuBox.replace(/<[^>]+>/g, " ").slice(0, 120));
  check("UI: 三得・力量欄に三得では弱側", html.includes("三得では弱側"), "");
  check("UI: 内格補助欄に秀山式の判定と扶助率", html.includes("内格補助：身強") && html.includes("扶助率：73.4%"), "");
  check("UI: 内格補助欄に蔵干比率の注記", html.includes("地支力量は蔵干比率（本気60%・残り20%・20%／2蔵干は70%・30%）"), "");
  check("UI: 最終強弱の選択欄", html.includes("最終強弱") && FINAL_STRENGTH_OPTIONS.every((o) => html.includes(`>${o}</option>`)), "");
  // 優先順位: 術者最終強弱 ＞ 秀山式内格力量判定法（KD27）
  const none = resolveEffectiveStrength(k, EMPTY_DECISION);
  check("最終強弱 未入力: 秀山式（elementForce）を採用", none.source === "elementForce" && none.value === "身強", JSON.stringify(none));
  const chosen = resolveEffectiveStrength(k, { ...EMPTY_DECISION, finalStrength: "身弱" });
  check("最終強弱 選択: 術者を優先", chosen.source === "practitioner" && chosen.value === "身弱", JSON.stringify(chosen));
  const hold = resolveEffectiveStrength(k, { ...EMPTY_DECISION, finalStrength: "保留" });
  check("最終強弱 保留: 秀山式へ（保留を記録）", hold.source === "elementForce" && hold.practitionerDeferred === true, JSON.stringify(hold));
  const input = buildInterpretationInput(pillars, k, { ...EMPTY_DECISION, finalPattern: "内格", finalStrength: "身強" });
  check("格局と強弱を別々に確定", input.finalPattern.name === "内格" && input.finalStrength.value === "身強" && input.practitionerDecision.finalStrength === "身強", "");
}

// 得令・得地の確定規則（KD24-1〜3）の直接テスト。命例ではなく規則そのものを確認する
{
  console.log("\n得令・得地（KD24）");
  // 地支の五行（＝本気の五行。KD14-1）。エンジンの表とは独立にテスト側で持つ
  const BR_EL: Record<string, string> = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
  const hasEl = (b: string, el: string) => zokanOf(b as Branch).stems.some((z) => STEM_ELEMENT[z] === el);
  const st = (pillars: string) => assessStrength(toPillars(pillars));

  // 得令 yes: 月支の本気と日干が同じ五行（日干甲・月支寅＝木）
  const reiYes = st("丙寅 甲子 丙寅 甲子");
  check("得令 yes: 日干甲・月支寅（同じ木）", reiYes.tokurei.value === "yes", JSON.stringify(reiYes.tokurei));
  // 得令 no: 月支が印であるだけ（日干庚・月支未＝土生金／日干甲・月支子＝水生木）
  const reiIn1 = st("丙子 庚午 癸未 甲子");
  check("得令 no: 日干庚・月支未（印）", reiIn1.tokurei.value === "no" && !reiIn1.tokurei.undeterminedReason, JSON.stringify(reiIn1.tokurei));
  const reiIn2 = st("丙寅 甲午 丙子 甲子");
  check("得令 no: 日干甲・月支子（印）", reiIn2.tokurei.value === "no" && !reiIn2.tokurei.undeterminedReason, JSON.stringify(reiIn2.tokurei));

  // 得地 yes: 月支だけに根（日干甲。月支卯に木、年支子・日支申・時支午に木なし）
  const onlyMonth = "庚午 甲申 丁卯 壬子";
  const om = toPillars(onlyMonth);
  check("前提: 根が月支だけ", hasEl(om.月.branch, "木") && [om.年, om.日, om.時!].every((x) => !hasEl(x.branch, "木")), onlyMonth);
  const chiMonth = st(onlyMonth);
  check("得地 yes: 月支だけに根", chiMonth.tokuchi.value === "yes" && chiMonth.tokuchi.evidence.join("").includes("月支卯"), JSON.stringify(chiMonth.tokuchi));
  // 得地 no: 印の蔵干しかない（日干甲。子・申に水はあるが木はない）
  const onlyIn = "甲子 甲申 壬申 庚子";
  const oi = toPillars(onlyIn);
  check("前提: 印（水）の蔵干だけ", [oi.年, oi.月, oi.日, oi.時!].every((x) => hasEl(x.branch, "水") && !hasEl(x.branch, "木")), onlyIn);
  const chiIn = st(onlyIn);
  check("得地 no: 印の蔵干しかない", chiIn.tokuchi.value === "no" && !chiIn.tokuchi.undeterminedReason, JSON.stringify(chiIn.tokuchi));

  // 時柱なし: 根が時支寅だけの命式は、時柱があれば yes・なければ no。月支だけの根は時柱なしでも yes
  const withHour = st("丙寅 甲申 丙子 庚申");
  const noHour = st("- 甲申 丙子 庚申");
  check("時柱あり: 時支寅の根で得地 yes", withHour.tokuchi.value === "yes", JSON.stringify(withHour.tokuchi));
  check("時柱なし: 年・月・日支に根がなく得地 no", noHour.tokuchi.value === "no", JSON.stringify(noHour.tokuchi));
  const noHourMonth = st("- 甲申 丁卯 壬子");
  check("時柱なし: 月支だけの根で得地 yes・得令は月支で判定", noHourMonth.tokuchi.value === "yes" && noHourMonth.tokurei.value === "yes", JSON.stringify([noHourMonth.tokurei, noHourMonth.tokuchi]));

  // 全組み合わせ: 得令・得地は undetermined を返さず、規則どおりの yes / no になる
  // 日干10 × 月支12 × 日支12 × 時支（なし＋12）。年支は月支・日支から回す
  const BR = "子丑寅卯辰巳午未申酉戌亥";
  let n = 0;
  let undetermined = 0;
  const wrong: string[] = [];
  for (const d of "甲乙丙丁戊己庚辛壬癸") {
    const el = STEM_ELEMENT[d as Stem];
    for (let mi = 0; mi < 12; mi++) for (let di = 0; di < 12; di++) for (let hi = -1; hi < 12; hi++) {
      const m = BR[mi];
      const db = BR[di];
      const y = BR[(mi + di) % 12];
      const h = hi < 0 ? null : BR[hi];
      const r = st(`${h ? `丙${h}` : "-"} ${d}${db} 丙${m} 丙${y}`);
      n += 1;
      if (r.tokurei.value === "undetermined" || r.tokuchi.value === "undetermined") undetermined += 1;
      const reiWant = BR_EL[m] === el ? "yes" : "no";
      const chiWant = [m, db, y, ...(h ? [h] : [])].some((b) => hasEl(b, el)) ? "yes" : "no";
      if ((r.tokurei.value !== reiWant || r.tokuchi.value !== chiWant) && wrong.length < 5) wrong.push(`${h ?? "-"}${d}${db}${m}${y} 令${r.tokurei.value}/${reiWant} 地${r.tokuchi.value}/${chiWant}`);
    }
  }
  console.log(`  全組み合わせ ${n} 件: undetermined ${undetermined} 件・規則との不一致 ${wrong.length} 件`);
  check("全組み合わせ: 得令・得地が undetermined を返さない", undetermined === 0, `${undetermined}/${n}`);
  check("全組み合わせ: 得令・得地が規則どおり", wrong.length === 0, wrong.join("／"));
}

// 秀山式内格力量判定法（KD27）。命例に合わせて係数を変えない（KD26-3）
{
  console.log("\n秀山式内格力量判定法（KD27・蔵干配分 KD28）");
  type El = "木" | "火" | "土" | "金" | "水";
  // 期待値は KD27・KD28 の式（地支 月5・他2 を蔵干へ配分〔3蔵干 本気60・残り20・20／2蔵干 70・30／1蔵干 100、化した支は化後の五行へ100〕
  // × 旺相休囚死、天干 1 × 通根補正）を手で当てはめた値。[木, 火, 土, 金, 水]
  const CASES: { name: string; pillars: string; forces: number[]; ratio: number; score: string; monthPattern: string | null; source: string }[] = [
    { name: "松下幸之助", pillars: "丙辰 癸酉 乙亥 甲午", forces: [5.375, 1.95, 1.35, 2, 7.35], ratio: 51.9, score: "境界", monthPattern: "月刃格", source: "身強" },
    { name: "シュワルツェネッガー", pillars: "戊寅 庚戌 丁未 丁亥", forces: [2.1, 4.8, 8.4, 1.75, 0.7], ratio: 57.2, score: "身強", monthPattern: "建禄格", source: "身強" },
    { name: "ベッカム", pillars: "乙卯 戊申 庚辰 乙卯", forces: [6.75, 0, 6.6, 2.75, 0.7], ratio: 39.3, score: "身弱", monthPattern: "月刃格", source: "身強" },
    { name: "ジョブズ", pillars: "辛卯 丙辰 戊寅 乙未", forces: [12.6, 3.25, 2.6, 1, 0], ratio: 81.5, score: "身強", monthPattern: "建禄格", source: "身強" },
    { name: "佐野量子", pillars: "甲戌 甲子 庚申 戊申", forces: [2, 0.3, 4.1, 8.4, 4.25], ratio: 32.8, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "千代の富士", pillars: "丙辰 癸巳 辛巳 乙未", forces: [1.9, 10.8, 3.25, 2.2, 1.55], ratio: 19.0, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "松坂大輔", pillars: "己巳 己丑 乙酉 庚申", forces: [1, 0, 3, 18, 0], ratio: 13.6, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "長嶋一茂", pillars: "癸未 乙酉 己丑 乙巳", forces: [2.8, 0.4, 3.3, 11.25, 1.5], ratio: 22.3, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "藤原紀香", pillars: "庚午 甲申 甲午 辛亥", forces: [3.1, 7.35, 3.125, 3.1, 1.35], ratio: 24.7, score: "身弱", monthPattern: null, source: "身弱" },
    // イチロー（D4。時柱は資料で癸巳と壬辰の2通り）
    { name: "イチロー（時柱癸巳）", pillars: "癸巳 辛卯 壬戌 癸丑", forces: [1.5, 2.2, 6.9, 3.75, 3.95], ratio: 58.2, score: "身強", monthPattern: "建禄格", source: "身強" },
    { name: "イチロー（時柱壬辰）", pillars: "壬辰 辛卯 壬戌 癸丑", forces: [3, 1, 6.3, 3.25, 4.7], ratio: 52.3, score: "境界", monthPattern: "建禄格", source: "身強" },
    // 四柱推命実例解説テキスト.pptx の内格4例（左から時・日・月・年）
    { name: "実例1", pillars: "丁巳 戊子 戊子 乙亥", forces: [1.25, 1.85, 2.8, 0.4, 13.5], ratio: 23.5, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "実例2", pillars: "辛卯 丙寅 丙子 己酉", forces: [5, 2.5, 1.25, 3.25, 7.5], ratio: 38.5, score: "身弱", monthPattern: null, source: "身弱" },
    { name: "実例3", pillars: "戊辰 己酉 癸丑 壬子", forces: [0.3, 0, 9.3, 3.75, 4.7], ratio: 51.5, score: "境界", monthPattern: "月刃格", source: "身強" },
    { name: "実例4", pillars: "壬寅 丁巳 壬申 己酉", forces: [0.6, 2.7, 3.3, 8.1, 4.25], ratio: 17.4, score: "身弱", monthPattern: null, source: "身弱" },
  ];
  const ELS: El[] = ["木", "火", "土", "金", "水"];
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
  for (const c of CASES) {
    const k = assessKakkyoku(toPillars(c.pillars));
    const e = k.elementForce;
    const forces = ELS.map((el) => e.byElement[el].total);
    const line =
      `五行[${ELS.map((el, i) => `${el}${+forces[i].toFixed(3)}`).join(" ")}] 扶助${+e.supportingSide.points.toFixed(3)} 反対${+e.weakeningSide.points.toFixed(3)}` +
      ` 扶助率${e.supportRatioPercent.toFixed(1)}% 点数${e.scoreJudgment} 格局${e.monthPattern ?? "なし"} 最終${e.finalJudgment}（${e.finalSource}） 資料${c.source}`;
    console.log(`  ${e.finalJudgment === c.source ? "一致" : "不一致"} ${c.name} ${line}`);
    check(`KD27 ${c.name}: 五行力量`, ELS.every((_, i) => near(forces[i], c.forces[i])), line);
    check(`KD27 ${c.name}: 扶助側＋反対側＝総力量`, near(e.supportingSide.points + e.weakeningSide.points, e.totalPoints), line);
    check(`KD27 ${c.name}: 扶助率`, near(+e.supportRatioPercent.toFixed(1), c.ratio), line);
    check(`KD27 ${c.name}: 点数判定`, e.scoreJudgment === c.score, line);
    check(`KD27 ${c.name}: 建禄格・月刃格`, e.monthPattern === c.monthPattern, line);
    check(`KD27 ${c.name}: 最終判定が資料（${c.source}）と一致`, e.finalJudgment === c.source, line);
  }

  // 境界値: ちょうど55%は身強・ちょうど45%は身弱
  check("KD27 判定: 55% ちょうどは身強", judgeSupportRatio(11, 20) === "身強", judgeSupportRatio(11, 20));
  check("KD27 判定: 45% ちょうどは身弱", judgeSupportRatio(9, 20) === "身弱", judgeSupportRatio(9, 20));
  check("KD27 判定: 45%超〜55%未満は境界", judgeSupportRatio(9.01, 20) === "境界" && judgeSupportRatio(10.99, 20) === "境界", "");

  const mats = assessKakkyoku(toPillars("丙辰 癸酉 乙亥 甲午")).elementForce; // 松下幸之助
  // 同じ地支を天干の本数分だけ重複計上しない（木の天干2本でも、木の地支力量は蔵干配分の分だけ）
  check("KD27 重複計上なし: 地支は各1回", mats.branches.length === 4 && near(ELS.reduce((a, el) => a + mats.byElement[el].branch, 0), mats.branches.reduce((a, b) => a + b.force, 0)), "");
  // 木の地支力量＝月支亥の甲（5×0.3×相1.25＝1.875）＋時支辰の乙（2×0.2×相1.25＝0.5）。天干の本数では増えない
  check("KD27 重複計上なし: 木の天干2本でも木の地支力量は蔵干の分だけ", near(mats.byElement.木.branch, 2.375) && mats.stems.filter((x) => x.element === "木").length === 2, JSON.stringify(mats.byElement.木));
  // 月支に通根は2根相当（×1.5）。×1.25 の二重加点はしない
  const kui = mats.stems.find((x) => x.pillar === "日")!;
  check("KD27 通根: 月支に通根は ×1.5（二重加点なし）", kui.rootLevel === "month" && kui.multiplier === 1.5, JSON.stringify(kui));
  const hei = mats.stems.find((x) => x.pillar === "時")!;
  check("KD27 通根: 1根は ×1.25（自柱以外の年支午）", hei.rootLevel === "one" && hei.multiplier === 1.25 && hei.roots.join("") === "年", JSON.stringify(hei));
  // 六合・冲の減衰（旧 ×1/2）を使わない: 酉辰の六合でも日支酉は 2×休1.0＝2
  const yu = mats.branches.find((b) => b.pillar === "日")!;
  check("KD27 六合: 減衰なし（酉辰の六合でも 2）", near(yu.force, 2), JSON.stringify(yu));
  // 季節係数は天干に掛けない（天干の力は通根補正だけ）
  check("KD27 天干に季節係数を掛けない", mats.stems.every((x) => x.force === x.multiplier), JSON.stringify(mats.stems.map((x) => x.force)));
  // 化: 既存の確定ロジックで化した地支は化後の五行（ジョブズ 寅卯辰の三会で日支辰→木。月支寅は三合以外で化さない）
  const jobs = assessKakkyoku(toPillars("辛卯 丙辰 戊寅 乙未")).elementForce;
  const jd = jobs.branches.find((b) => b.pillar === "日")!;
  check("KD27 化: ジョブズ 日支辰は三会で木", jd.element === "木" && jd.originalElement === "土", JSON.stringify(jd));
  // KD27-U2: 化した地支も根は元の蔵干で見る（辰は木に化しても蔵干戊があるので月干戊の根に数える）
  const wu = jobs.stems.find((x) => x.pillar === "月")!;
  check("KD27-U2 化した地支の根は元の蔵干（月干戊の根に日支辰を含む）", wu.element === "土" && wu.roots.includes("日"), JSON.stringify(wu));
  // 印の蔵干は根にしない（日干甲・地支に水だけ）
  const inOnly = assessKakkyoku(toPillars("甲子 甲申 壬申 庚子")).elementForce;
  check("KD27 通根: 印の蔵干だけなら根なし", inOnly.stems.find((x) => x.pillar === "日")!.rootLevel === "none", "");
  // 五季の表（KD27-1）
  const SEASON: [string, Record<El, string>][] = [
    ["寅卯", { 木: "旺", 火: "相", 水: "休", 金: "囚", 土: "死" }],
    ["巳午", { 火: "旺", 土: "相", 木: "休", 水: "囚", 金: "死" }],
    ["申酉", { 金: "旺", 水: "相", 土: "休", 火: "囚", 木: "死" }],
    ["亥子", { 水: "旺", 木: "相", 金: "休", 土: "囚", 火: "死" }],
    ["辰戌丑未", { 土: "旺", 金: "相", 火: "休", 木: "囚", 水: "死" }],
  ];
  const COEF: Record<string, number> = { 旺: 1.5, 相: 1.25, 休: 1.0, 囚: 0.75, 死: 0.5 };
  const seasonOk = SEASON.every(([brs, table]) =>
    [...brs].every((b) => {
      const r = assessKakkyoku(toPillars(`甲子 甲子 甲${b} 甲子`)).elementForce;
      return ELS.every((el) => r.seasonal[el].state === table[el] && r.seasonal[el].coefficient === COEF[table[el]]);
    }),
  );
  check("KD27 五季の旺相休囚死と係数（辰戌丑未は月全体を土旺）", seasonOk, "");
  // 境界帯は補助判断材料を持つ（数値にはしない）。実例3（51.5%）
  const border = assessKakkyoku(toPillars("戊辰 己酉 癸丑 壬子")).elementForce;
  check("KD27-U3 境界: 得令・得勢・得地・党多・会合・合冲を補助判断材料として保持",
    border.scoreJudgment === "境界" && ["得令", "得勢", "得地", "党多", "会合", "干合"].every((h) => border.borderlineMaterials.some((x) => x.startsWith(h))),
    border.borderlineMaterials.join("／"));
  console.log(`  境界の補助判断材料（実例3）: ${border.borderlineMaterials.join("／")}`);
  check("KD27 境界外は補助判断材料なし", jobs.scoreJudgment === "身強" && jobs.borderlineMaterials.length === 0, "");
  // 蔵干配分（KD28）: 3蔵干 本気60・残り20・20（中気・余気を区別しない）／2蔵干 70・30／1蔵干 100。本気は地支と同じ五行
  const shares = (b: string) => zokanShares(b as Branch).map((x) => `${x.stem}${x.ratio}`).join(" ");
  check("KD28 3蔵干: 未は己0.6・丁0.2・乙0.2", shares("未") === "己0.6 丁0.2 乙0.2", shares("未"));
  check("KD28 2蔵干: 亥は壬0.7・甲0.3／午は丁0.7・己0.3", shares("亥") === "壬0.7 甲0.3" && shares("午") === "丁0.7 己0.3", `${shares("亥")} / ${shares("午")}`);
  check("KD28 1蔵干: 子は癸1", shares("子") === "癸1", shares("子"));
  check("KD28 12支すべて配分の合計が1", ([..."子丑寅卯辰巳午未申酉戌亥"] as Branch[]).every((b) => near(zokanShares(b).reduce((a, x) => a + x.ratio, 0), 1)), "");
  // シュワルツェネッガー: 月支未（5点）→ 己3・丁1・乙1、通常支寅（2点）→ 甲1.2・丙0.4・戊0.4（季節係数の前）
  const schw = assessKakkyoku(toPillars("戊寅 庚戌 丁未 丁亥")).elementForce;
  const pts = (k: string) => schw.branches.find((b) => b.pillar === k)!.shares.map((x) => `${x.stem}${+x.points.toFixed(3)}`).join(" ");
  check("KD28 月支未5点: 己3・丁1・乙1", pts("月") === "己3 丁1 乙1", pts("月"));
  check("KD28 通常支寅2点: 甲1.2・丙0.4・戊0.4", pts("時") === "甲1.2 丙0.4 戊0.4", pts("時"));
  check("KD28 季節係数は配分後の各蔵干の五行で掛ける", schw.branches.every((b) => b.shares.every((x) => x.coefficient === schw.seasonal[x.element].coefficient && near(x.force, x.points * x.coefficient))), "");
  // 化した支は蔵干配分せず化後の五行へ100%（ジョブズ 日支辰→木）
  check("KD28 化した支は化後の五行へ100%", jd.shares.length === 1 && jd.shares[0].stem === null && jd.shares[0].element === "木" && jd.shares[0].ratio === 1, JSON.stringify(jd.shares));
  // 荒川静香（D4）: 資料は身強だが秀山式は身弱（未解決の検証例。係数・閾値は合わせない）
  const arakawa = assessKakkyoku(toPillars("壬辰 辛巳 庚子 辛酉")).elementForce;
  console.log(`  参考 荒川静香（D4・資料は身強・未解決）: 扶助率${arakawa.supportRatioPercent.toFixed(1)}% 点数${arakawa.scoreJudgment} 格局${arakawa.monthPattern ?? "なし"} 最終${arakawa.finalJudgment}`);
  check("荒川静香（未解決の検証例）: 43.1%・身弱のまま（資料に合わせない）", arakawa.supportRatioPercent.toFixed(1) === "43.1" && arakawa.finalJudgment === "身弱", "");
  // 時柱なし: 三柱で計算し参考判定
  const noHour = assessKakkyoku(toPillars("- 癸酉 乙亥 甲午")).elementForce;
  check("KD27 時柱なし: 地支3・天干3・referenceOnly", noHour.branches.length === 3 && noHour.stems.length === 3 && noHour.referenceOnly, "");
}

console.log(`\n合計: PASS ${pass} / FAIL ${fail}`);
if (failures.length) {
  console.log("\nFAIL 一覧");
  console.log(failures.join("\n"));
  process.exit(1);
}
