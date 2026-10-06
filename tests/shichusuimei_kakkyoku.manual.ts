// tests/shichusuimei_kakkyoku.manual.ts
//
// 四柱推命 強弱・格局の補助判定（src/lib/shichusuimei/kakkyoku/）の照合テスト。
// 実行: npx tsx tests/shichusuimei_kakkyoku.manual.ts
//
// 照合方針（docs/shichusuimei-kakkyoku-spec.md §16）:
//   資料の命例（safe 15件）の格名が、エンジンの候補一覧に含まれるかだけを見る（contains）。
//   途中の得令・得勢・得地や内格点数は正解値として固定しない（資料に記載がない）。
//   needs_review の命例（Phase 1 D4 の人物）は照合しない。
//   あわせて、仕様上の不変条件（内格点数は外格判定のあと・内格の経路か内格候補があるときだけ、時柱なしは参考判定 など）を確認する。

import {
  assessKakkyoku,
  buildInterpretationInput,
  calculateInnerScore,
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

const toPillars = (s: string): Pillars => {
  const [h, d, m, y] = s.split(" ");
  const pp = (x: string) => ({ stem: x[0] as Stem, branch: x[1] as Branch });
  return { 時: h === "-" ? null : pp(h), 日: pp(d), 月: pp(m), 年: pp(y) };
};

/** §16 の safe 命例（命式は 時・日・月・年） */
/** expected は資料の格名。engineCheck: false の格名は一般の成立条件が資料にないため照合しない（needs_review） */
const FIXTURES: { id: string; name: string; source: string; pillars: string; expected: string[]; notEngineChecked?: string[] }[] = [
  { id: "KK-F09", name: "シュワルツェネッガー", source: "p37・三p29", pillars: "戊寅 庚戌 丁未 丁亥", expected: ["身強"] },
  { id: "KK-F10", name: "佐野量子", source: "p38・三p30", pillars: "甲戌 甲子 庚申 戊申", expected: ["身弱"] },
  { id: "KK-E01", name: "張飛", source: "p39・三p31", pillars: "癸亥 癸亥 癸亥 癸亥", expected: ["従旺格"] },
  { id: "KK-F21", name: "千代の富士", source: "p80・三p72", pillars: "丙辰 癸巳 辛巳 乙未", expected: ["身弱"] },
  { id: "KK-F24", name: "釈由美子", source: "p87・三p79", pillars: "丙戌 乙巳 戊午 戊午", expected: ["従格"] },
  { id: "KK-F26", name: "堂本剛", source: "p92・三p84", pillars: "丁未 丁未 戊辰 己未", expected: ["従格"] },
  { id: "KK-F01", name: "松下幸之助", source: "p118・三p110", pillars: "丙辰 癸酉 乙亥 甲午", expected: ["身強"] },
  // ベッカム: 旧資料（三p35）の「身弱」は誤り。修正済みテキスト（伝統命理基礎編.key）の「身強（月刃格）」を正本とする
  { id: "KK-F13", name: "ベッカム", source: "伝統命理基礎編.key（修正済み）", pillars: "乙卯 戊申 庚辰 乙卯", expected: ["身強", "月刃格"], notEngineChecked: ["月刃格"] },
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
  const summary =
    `類型[${s.classificationCandidates.join("・")}] 令${s.tokurei.value} 勢${s.tokusei.value} 地${s.tokuchi.value}` +
    ` 党多${s.touta.level}(${s.touta.share.minPercent.toFixed(0)}〜${s.touta.share.maxPercent.toFixed(0)}%) 経路${r.route} 候補[${names.join("・")}]`;
  for (const e of f.expected) {
    if (f.notEngineChecked?.includes(e)) {
      console.log(`  SKIP ${f.id} ${f.name}（${e}）照合対象外（needs_review。一般条件なし、または資料と確定規則の食い違い）`);
      continue;
    }
    console.log(`  ${names.includes(e) ? "PASS" : "FAIL"} ${f.id} ${f.name}（${e}）${summary}`);
    check(`${f.id} ${f.name}（${f.source}）期待: ${e}`, names.includes(e), summary);
  }

  // 不変条件
  check(`${f.id} 内格補助は常に計算する（KD19）`, r.innerScore !== null, `route=${r.route}`);
  check(`${f.id} 最終判断は術者`, r.finalJudgment === "requires_practitioner_judgment", "");
}

// ベッカム: 旧「身弱」fixture が残っていない
{
  const b = FIXTURES.find((f) => f.name === "ベッカム")!;
  check("ベッカム: 期待値は身強・月刃格（旧「身弱」なし）", !b.expected.includes("身弱") && b.expected.includes("身強") && b.expected.includes("月刃格"), JSON.stringify(b.expected));
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
  check("時柱なし: 内格点数も referenceOnly", r.innerScore === null || r.innerScore.referenceOnly, "");
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

// 内格点数: 半合は化五行で計算、月支は半合では化さない
{
  const a = calculateInnerScore(toPillars("丙辰 甲子 丁卯 庚午"), false); // 日支子・時支辰（隣接・旺支子）で半合 → 水
  const st = (sc: typeof a, k: string) => sc.branchStates.find((x) => x.pillar === k)!;
  check("半合: 日支子→水", st(a, "日").transformedTo === "水", JSON.stringify(st(a, "日")));
  check("半合: 時支辰→水（化五行で計算）", st(a, "時").transformedTo === "水", JSON.stringify(st(a, "時")));
  // 時干丙が時支辰から受ける点: 化五行 水（本気）は火と無関係、元の本気以外 乙（木→火を生じる）1×1/3、癸 0 → 1/3
  const hour = a.byStem.find((x) => x.pillar === "時")!;
  const fromOthers = calculateInnerScore(toPillars("丙辰 甲寅 丁卯 庚午"), false).byStem.find((x) => x.pillar === "時")!;
  console.log(`  内格: 半合あり 時干丙 地支から ${hour.fromBranches.toFixed(3)}／半合なし（日支寅） ${fromOthers.fromBranches.toFixed(3)}`);
  const b = calculateInnerScore(toPillars("丙寅 甲申 丙子 庚午"), false); // 月支子・日支申で半合、月支は化さない
  check("月支は半合では化さない", st(b, "月").transformedTo === null, JSON.stringify(st(b, "月")));
  check("月支と半合した日支申は化す（水）", st(b, "日").transformedTo === "水", JSON.stringify(st(b, "日")));
}

// 内格補助の判定軸（KD17）: 比劫＋印 対 食傷＋財＋官（貴乃花光司の命式）
{
  const r = assessKakkyoku(toPillars("辛巳 乙亥 戊申 壬子"));
  const s = r.innerScore!;
  check("内格補助: 内格の経路", r.route === "naikaku" && s !== null, r.route);
  check("内格補助: 比劫＋印 13.25", Math.abs(s.supportingSide.points - 13.25) < 1e-9, String(s.supportingSide.points));
  check("内格補助: 食傷＋財＋官 10.5", Math.abs(s.weakeningSide.points - 10.5) < 1e-9, String(s.weakeningSide.points));
  check("内格補助: 身強（日干単独点ではなく比劫＋印で比較）", s.judgment === "身強", s.judgment);
  check("内格補助: 比劫＋印は木・水", s.supportingSide.elements.join("") === "木水", s.supportingSide.elements.join(""));
  const st = (k: string) => s.branchStates.find((x) => x.pillar === k)!;
  check("申子半合: 年支子は水（化）", st("年").transformedTo === "水" && st("年").relations.some((x) => x.startsWith("半合")), JSON.stringify(st("年")));
  check("申子半合: 月支申は化さない（月支は三合のみ）", st("月").transformedTo === null && st("月").relations.some((x) => x.startsWith("半合")), JSON.stringify(st("月")));
  check("根拠: 年柱壬子・日支亥・申子半合の水", ["年柱 壬子", "日支 亥", "半合"].every((k) => s.helps.some((h) => h.includes(k))), s.helps.join("／"));
  console.log(`  内格補助 貴乃花: ${s.judgment} 比劫＋印 ${s.supportingSide.points} / 食傷＋財＋官 ${s.weakeningSide.points} 日干 ${s.dayMaster.points}  根拠: ${s.helps.join("／")}`);
}

// 化格候補でも他の格局の判定を止めない（KD22・KD23）
{
  const habu = assessKakkyoku(toPillars("庚辰 庚戌 乙酉 庚戌")); // 乙庚→金・月支酉
  const vis = habu.candidates.filter((c) => c.uiVisible).map((c) => c.name);
  check("化格候補: 化格は candidate（自動確定しない）", habu.candidates.some((c) => c.name === "化格" && c.status === "candidate"), vis.join("・"));
  check("化格候補: 従旺格も併存", vis.includes("化格") && vis.includes("従旺格"), vis.join("・"));
  check("化格候補: 内格補助は計算し参考扱い", habu.innerScore !== null && habu.innerScoreScope === "withGaikakuCandidates", String(habu.innerScoreScope));
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
  check("月刃格・建禄格は画面に出さない", !r.candidates.some((c) => ["月刃格", "建禄格"].includes(c.name) && c.uiVisible), "");
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

// 強弱表示の一本化と術者最終強弱（KD20）: 貴乃花光司（三得は弱側・内格補助は身強）
{
  const pillars = toPillars("辛巳 乙亥 戊申 壬子");
  const k = assessKakkyoku(pillars);
  check("格局候補欄に身強・身弱を出さない", !k.candidates.some((c) => (c.name === "身強" || c.name === "身弱") && c.uiVisible), "");
  check("三得類型は材料として残る", k.strength.classificationCandidates.includes("弱（得地のみ）"), k.strength.classificationCandidates.join("・"));
  check("内格補助は身強（三得と食い違ってもエラーにならない）", k.innerScore.judgment === "身強", k.innerScore.judgment);
  const html = renderToStaticMarkup(createElement(KakkyokuView, { k, decision: EMPTY_DECISION, onDecisionChange: () => {} }));
  const kakuBox = html.slice(html.indexOf("格局候補（機械判定）"), html.indexOf("内格補助</h3>"));
  check("UI: 格局候補欄に身強・身弱が出ない", !/身強|身弱/.test(kakuBox), kakuBox.replace(/<[^>]+>/g, " ").slice(0, 120));
  check("UI: 三得・力量欄に三得では弱側", html.includes("三得では弱側"), "");
  check("UI: 内格補助欄に身強", html.includes("内格補助：身強"), "");
  check("UI: 最終強弱の選択欄", html.includes("最終強弱") && FINAL_STRENGTH_OPTIONS.every((o) => html.includes(`>${o}</option>`)), "");
  // 優先順位: 術者最終強弱 ＞ 内格補助 ＞ 三得
  const none = resolveEffectiveStrength(k, EMPTY_DECISION);
  check("最終強弱 未入力: 内格補助を採用", none.source === "innerScore" && none.value === "身強", JSON.stringify(none));
  const chosen = resolveEffectiveStrength(k, { ...EMPTY_DECISION, finalStrength: "身弱" });
  check("最終強弱 選択: 術者を優先", chosen.source === "practitioner" && chosen.value === "身弱", JSON.stringify(chosen));
  const hold = resolveEffectiveStrength(k, { ...EMPTY_DECISION, finalStrength: "保留" });
  check("最終強弱 保留: 内格補助へ（保留を記録）", hold.source === "innerScore" && hold.practitionerDeferred === true, JSON.stringify(hold));
  const input = buildInterpretationInput(pillars, k, { ...EMPTY_DECISION, finalPattern: "内格", finalStrength: "身強" });
  check("格局と強弱を別々に確定", input.finalPattern.name === "内格" && input.finalStrength.value === "身強" && input.practitionerDecision.finalStrength === "身強", "");
}

console.log(`\n合計: PASS ${pass} / FAIL ${fail}`);
if (failures.length) {
  console.log("\nFAIL 一覧");
  console.log(failures.join("\n"));
  process.exit(1);
}
