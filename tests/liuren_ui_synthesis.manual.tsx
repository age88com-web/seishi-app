// tests/liuren_ui_synthesis.manual.tsx
//
// 六壬神課 Phase 5T（総合解釈の UI 接続・第1段階）のテスト。
// 実行: npx tsx tests/liuren_ui_synthesis.manual.tsx
//
//   src/app/liuren/synthesisAdapter.ts（起課結果 → FACT → 既存の DOMAIN 評価 → DomainSynthesis → 文章）と
//   src/app/liuren/synthesisDisplay.ts（通常表示・詳細表示の振り分け）・LiurenSynthesisView.tsx（表示部品）をサーバー側で描画して確かめる。
//   画面操作の確認はこのテストでは行わない。
//   盤はエンジンの起課結果を使う（古典の占験の再現ではない）。

import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, LiurenChart, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { evaluateTravelerDomain } from "../src/lib/liuren/interpretation/travelerDomain";
import { synthesizeDomainResult } from "../src/lib/liuren/interpretation/domainSynthesis";
import { summarizeDomainReadings } from "../src/lib/liuren/interpretation/domainResult";
import { narrateDomainSynthesis } from "../src/lib/liuren/interpretation/synthesisNarrative";
import type { NarrativeParagraph } from "../src/lib/liuren/interpretation/synthesisNarrative";
import { TRAVELER_DOMAIN_RULES } from "../src/lib/liuren/interpretation/travelerDomain";
import { buildLiurenSynthesisView, contextOf, labelOf, TOPIC_LABEL } from "../src/app/liuren/synthesisAdapter";
import { buildSynthesisDisplay, plainMissing } from "../src/app/liuren/synthesisDisplay";
import type { LiurenSynthesisView as View } from "../src/app/liuren/synthesisAdapter";
import LiurenSynthesisView from "../src/app/liuren/LiurenSynthesisView";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const chartOf = (day: string, jiang: string, shi = "子"): LiurenChart =>
  calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi as Branch, monthGeneral: jiang as Branch });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const html = (v: View) => renderToStaticMarkup(<LiurenSynthesisView view={v} />);
const between = (h: string, start: string, end?: string) => { const i = h.indexOf(start); if (i < 0) return ""; const j = end ? h.indexOf(end, i) : h.length; return h.slice(i, j < 0 ? h.length : j); };
const paras = (v: View): NarrativeParagraph[] => v.narrative.sections.flatMap((s) => [...s.paragraphs, ...(s.subsections ?? []).flatMap((x) => x.paragraphs)]);
const T = { id: "traveler" as const, goal: "return" as const };

// 1〜3. 起課 → DOMAIN → 総合 → 文章（既存の処理をそのまま呼ぶ）
{
  const chart = chartOf("甲子", "子"), v = buildLiurenSynthesisView(chart, "子", T)!;
  const facts = buildInterpretationFacts(chart), ctx = contextOf(T)!;
  check("1・2: 行人の盤から、既存の行人 DOMAIN の結果がそのまま作られる（再実装しない）", JSON.stringify(v.result) === JSON.stringify(evaluateTravelerDomain(facts, ctx, "子")));
  check("3: 総合結果・文章は Phase 5R・5S の関数の出力そのまま（表示のために作り直さない）",
    JSON.stringify(v.synthesis) === JSON.stringify(synthesizeDomainResult(v.result, { facts, context: ctx }))
    && JSON.stringify(v.narrative) === JSON.stringify(narrateDomainSynthesis(v.result, v.synthesis, ctx)));
  check("Context: 行人・subtype return・goal だけ（人物・本命・太歳・行年・類神は入れない）", JSON.stringify(ctx) === JSON.stringify({ domain: "traveler", subtype: "return", goal: "return" }));
  check("占的が未選択なら総合解釈を作らない", buildLiurenSynthesisView(chart, "子", { id: "", goal: "return" }) === null);
}

// 3〜5. 表示（通常表示・詳細表示）
const mainOf = (h: string) => { const m = between(h, 'data-testid="liuren-synthesis-main"', 'data-testid="liuren-synthesis-detail"'); return m.slice(m.indexOf(">") + 1, m.lastIndexOf("<")); };
const textOf = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
const REVERSED = "帰ることを望まない問いでは逆向き";
{
  const v = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", T)!, h = html(v), main = mainOf(h), detail = between(h, 'data-testid="liuren-synthesis-detail"');
  const d = buildSynthesisDisplay(v);
  check("1: 通常表示の文字に英字（内部識別子・axis・topic・goal・FACT・rule ID など）が一つもない", !/[A-Za-z]/.test(textOf(main)), (textOf(main).match(/[A-Za-z][A-Za-z.]*/g) ?? []).slice(0, 5).join(","));
  check("2: 通常表示に「規則 ID」「FACT」「推論レベル」などの開発用の項目がない", !/規則 ID|FACT|推論レベル|確実性/.test(textOf(main)));
  check("3: 通常表示は「帰還についての判断」から始まり、占的・問いの目的を日本語で出す", d.sections[0].heading === "帰還についての判断" && textOf(main).includes("行人（外出中の人が帰るか）") && textOf(main).includes("帰ることを望む"));
  const itemIdx = d.sections.filter((x) => x.id !== "divergent" && x.id !== "missing").flatMap((x) => x.items.flatMap((i) => i.readingIndexes)).sort((a, b) => a - b);
  check("4: すべての読みが通常表示にちょうど1回ずつ出る（読みを落とさない・重ねない）", itemIdx.join() === v.result.readings.map((_, k) => k).join());
  let verbatim = true;
  for (const x of d.sections) for (const it of x.items) for (const k of it.readingIndexes) {
    if (x.id === "divergent") continue;
    const rd = v.result.readings[k];
    if (!it.sentence.includes(rd.detected) || !it.sentence.includes(`「${rd.label}」`) || (rd.directionNote && rd.directionNote !== REVERSED && !it.sentence.includes(rd.directionNote))) verbatim = false;
  }
  check("4: 各文は、元の読みの盤の配置（detected）・古典の読み（label）・補足（directionNote）をそのまま含む（言い換えない）", verbatim);
  check("8: 総合解釈に表（table）を使わない", !h.includes("<table"));
  check("詳細表示（details の中）に、読みごとの詳細・判断間の関係・不足の内部キーがある", ["readings-detail", "relations", "missing-detail"].every((x) => detail.includes(`data-section="${x}"`)));
  check("6: 詳細表示に、すべての読みの規則 ID・盤の配置・内部 FACT・出典の原文が残る",
    v.result.readings.every((rd, i) => { const card = between(detail, `data-reading-index="${i}"`, "</dl>"); return card.includes(rd.ruleId) && card.includes(esc(rd.detected))
      && rd.evidence.every((e) => card.includes(esc(`${e.fact}｜${e.detail}`))) && rd.citations.every((c) => card.includes(esc(c.quote)) && card.includes(esc(c.source))); }));
  check("詳細表示に推論レベル・判断の確実性が出る", detail.includes("推論レベル") && detail.includes("判断の確実性"));
  check("詳細は <details> の中に描画され、閉じても DOM に残る（情報を落とさない）", detail.startsWith('data-testid="liuren-synthesis-detail"') && detail.length > 1000);
  check("通常表示に点数・吉凶・応期の判断を出さない（注記の否定文だけ）", !/点数:|吉凶:|応期:|score/.test(h) && textOf(main).includes("時期（応期）は出しません"));
}
// 5. 帰還を促す要素・妨げる要素（振り分けは DOMAIN の向きのまま）と、問いの目的による違い
{
  let bothSeen = 0, mapOk = true, goalSame = true, conflictsOk = true, noAscii = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 2) {
    const chart = chartOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]), mb = BRANCHES[(i + o) % 12] as Branch;
    const v = buildLiurenSynthesisView(chart, mb, T)!, va = buildLiurenSynthesisView(chart, mb, { id: "traveler", goal: "avoid" })!;
    const d = buildSynthesisDisplay(v), da = buildSynthesisDisplay(va);
    const sec = (x: typeof d, id: string) => x.sections.find((y) => y.id === id)?.items.flatMap((it) => it.readingIndexes) ?? [];
    const back = (k: number) => ["relation", "return", "obstacle"].includes(v.result.readings[k].topic ?? "");
    if (sec(d, "promote").some((k) => !back(k) || v.result.readings[k].direction !== "favoring") || sec(d, "hinder").some((k) => !back(k) || v.result.readings[k].direction !== "hindering")) mapOk = false;
    if (sec(d, "movement").some((k) => v.result.readings[k].topic !== "movement") || sec(d, "safety").some((k) => v.result.readings[k].topic !== "safety")) mapOk = false;
    const ids = (x: typeof d, vv: View, id: string) => sec(x, id).map((k) => vv.result.readings[k].ruleId).sort().join();
    if (["promote", "hinder", "reference"].some((id) => ids(d, v, id) !== ids(da, va, id))) goalSame = false;
    if (sec(d, "promote").length && sec(d, "hinder").length) bothSeen += 1;
    if ((d.sections.find((y) => y.id === "divergent")?.items.length ?? 0) !== v.synthesis.relations.conflicting.length) conflictsOk = false;
    for (const x of [v, va]) if (/[A-Za-z]/.test(textOf(mainOf(html(x))))) noAscii = false;
  }
  check("5: 帰還を促す要素＝帰還に関する論点の追い風、妨げる要素＝妨げ（goal return では DOMAIN の向きのまま）。移動状況・道中の安全は論点どおり", mapOk);
  check("5: 帰還を促す要素と妨げる要素が両方ある盤では、両方の見出しを出す（相殺しない）", bothSeen > 0, `${bothSeen}`);
  check("問いの目的（帰ることを望まない）でも、帰還を促す・妨げる要素に振り分けられる規則は同じ（DOMAIN の反転の注記どおりに戻すだけ）", goalSame);
  check("読みが分かれている点（対立）は、総合結果の対立の数だけ両方の読みを名指しして出す", conflictsOk);
  check("1: 60日×月将6通り×目的2通りのすべての盤で、通常表示に英字が出ない", noAscii);
  // 表示層の振り分けは見出しのためだけ: DOMAIN の向きを書き換えず、画面に出す「問いの目的に対する向き」は DOMAIN の向きと一致する
  let dirOk = true, unchanged = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) for (const goal of ["return", "avoid"] as const) {
    const vv = buildLiurenSynthesisView(chartOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]), BRANCHES[(i + o) % 12] as Branch, { id: "traveler", goal })!;
    const before = JSON.stringify([vv.result, vv.synthesis]), dd = buildSynthesisDisplay(vv);
    if (JSON.stringify([vv.result, vv.synthesis]) !== before) unchanged = false;
    const want = (id: string) => (id === "promote" ? (goal === "return" ? "favoring" : "hindering") : (goal === "return" ? "hindering" : "favoring"));
    for (const id of ["promote", "hinder"]) for (const it of dd.sections.find((x) => x.id === id)?.items ?? []) for (const k of it.readingIndexes) if (vv.result.readings[k].direction !== want(id)) dirOk = false;
    const lead = (id: string) => dd.sections.find((x) => x.id === id)?.lead ?? "";
    if (goal === "avoid" && ((dd.sections.some((x) => x.id === "promote") && !lead("promote").includes("妨げになる読み")) || (dd.sections.some((x) => x.id === "hinder") && !lead("hinder").includes("追い風になる読み")))) dirOk = false;
    if (dd.details.some((x) => !x.direction.startsWith({ favoring: "追い風", hindering: "妨げ", neutral: "向きを決めない" }[vv.result.readings[x.index].direction]))) dirOk = false;
    for (const it of dd.sections.find((x) => x.id === "other")?.items ?? []) for (const k of it.readingIndexes) if (!it.tags.includes({ favoring: "追い風", hindering: "妨げ", neutral: "向きを決めない" }[vv.result.readings[k].direction])) dirOk = false;
  }
  check("目的が「帰ることを望まない」でも DOMAIN の向きは書き換えない。見出しの下と詳細に示す「問いの目的に対する追い風・妨げ」は DOMAIN の向きと一致する（return: 促す＝追い風・妨げる＝妨げ／avoid: 促す＝妨げ・妨げる＝追い風）",
    dirOk && unchanged);
  const va = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", { id: "traveler", goal: "avoid" })!, da = buildSynthesisDisplay(va);
  check("目的が「帰ることを望まない」ときは、促す・妨げる要素の見出しの下に、目的から見た向きを日本語で添える",
    (da.sections.find((x) => x.id === "hinder")?.lead ?? "").includes("追い風になる読み") && da.facts.some((f) => f.value === "帰ることを望まない"));
}

// 6・7. 人物・行年
{
  const v = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", T)!, h = html(v);
  check("6: 人物の入力がないので、問う人・行人の対応を作らない（participants 空・人物の段落なし）",
    Object.keys(v.synthesis.participants).length === 0 && !h.includes("人物:") && v.result.missing.some((m) => m.key === "travelerNatalYear"));
  check("7: 行年の入力がなくても表示でき、「判断に必要な追加情報」に日本語で出す（括弧書きの英字の識別子だけを除く）", v.result.missing.some((m) => m.key === "xingNian" || m.key === "xingNianUnresolved")
    && v.result.missing.every((m) => mainOf(h).includes(esc(plainMissing(m.detail)))) && plainMissing("外出中の人物（travelerPersonId）の本命がない") === "外出中の人物の本命がない"
    && plainMissing("対象の人物 ID が指定されていない") === "対象の人物が指定されていない");
}

// 8. 0件
{
  const empty = summarizeDomainReadings("traveler", "return", "return", [], [{ key: "transmissions", detail: "三伝が未確定なので判断できない" }], "行人");
  const s = synthesizeDomainResult(empty);
  const v: View = { context: contextOf(T)!, monthBranch: null, result: empty, synthesis: s, narrative: narrateDomainSynthesis(empty, s) };
  let h = "", err = "";
  try { h = html(v); } catch (e) { err = String(e); }
  check("8: 読みが0件（人工の DomainResult）でもエラーにならず、「成立した読みはありません」と不足だけを出す",
    !err && h.includes("成立した読みはありません") && !h.includes('data-section="promote"') && !h.includes('data-section="hinder"') && h.includes("三伝が未確定"), err);
}

// 9・10. 盤・占的が変われば作り直す（状態を持たない）
{
  const a = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", T)!, b = buildLiurenSynthesisView(chartOf("乙丑", "辰"), "巳", T)!;
  check("10: 別の盤からは、その盤の読みだけで作る（前の盤の読みが混ざらない）", JSON.stringify(a.narrative) !== JSON.stringify(b.narrative)
    && b.result.readings.every((r) => html(b).includes(esc(r.detected))) && JSON.stringify(b.result) === JSON.stringify(evaluateTravelerDomain(buildInterpretationFacts(chartOf("乙丑", "辰")), contextOf(T)!, "巳")));
  const av = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", { id: "traveler", goal: "avoid" })!;
  check("9: 問いの目的を変えると、その目的の DOMAIN 結果で作り直す（帰ることを望まない問いでは向きが逆）",
    av.result.goal === "avoid" && av.result.readings.some((r) => r.directionNote === "帰ることを望まない問いでは逆向き"));
  check("月支なし（日干支の直接指定）でも作れる", buildLiurenSynthesisView(chartOf("甲子", "子"), null, T) !== null);
  // 月支: なければ月建の神煞を使う読みを成立させない（既存の DOMAIN の扱いのまま。推測しない）。あれば渡した月支そのものを使う
  let noMonthOk = true, withMonthSeen = 0, sameAsDomain = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 3) {
    const chart = chartOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]), mb = BRANCHES[(i + o) % 12] as Branch;
    const none = buildLiurenSynthesisView(chart, null, T)!, withM = buildLiurenSynthesisView(chart, mb, T)!;
    if (none.monthBranch !== null || none.result.readings.some((r) => r.evidence.some((e) => e.fact.startsWith("monthlySpirit.")))) noMonthOk = false;
    if (withM.result.readings.some((r) => r.evidence.some((e) => e.fact.startsWith("monthlySpirit.")))) withMonthSeen += 1;
    if (JSON.stringify(withM.result) !== JSON.stringify(evaluateTravelerDomain(buildInterpretationFacts(chart), contextOf(T)!, mb))) sameAsDomain = false;
  }
  check("月支なし: 月建の神煞（天馬など）を使う読みは一つも成立しない（月支を推測しない）", noMonthOk);
  check("月支あり: 渡した月支で既存の DOMAIN と同じ結果（月建の神煞の読みも成立しうる）", sameAsDomain && withMonthSeen > 0, `${withMonthSeen}`);
  const page = readFileSync("src/app/liuren/page.tsx", "utf8");
  check("ページ: 日干支の直接指定では月支を null、日時入力では暦の月支（calendar.monthBranch）だけを渡す（算法を持たない）",
    page.includes("monthBranch: null,") && page.includes("monthBranch: isBranch(c.monthBranch) ? c.monthBranch : null,") && !/monthBranch\s*=|shift\(|BRANCHES\[\(/.test(page.slice(page.indexOf("const computed"), page.indexOf("// 総合解釈:"))));
}

// 6. 表示名（UI 層）
{
  const topics = new Set(TRAVELER_DOMAIN_RULES.map((r) => r.reading.topic).filter(Boolean) as string[]);
  check("表示名: 行人の規則の topic（5種）すべてに表示名があり、表示名の表は UI 層だけ", [...topics].every((t) => TOPIC_LABEL.traveler[t]) && topics.size === 5);
  check("表示名: 表にない識別子は訳さずそのまま", labelOf(TOPIC_LABEL, "traveler", "unknownTopic") === "unknownTopic" && labelOf(TOPIC_LABEL, "wealth", "capture") === "capture");
  const v = buildLiurenSynthesisView(chartOf("甲子", "子"), "子", T)!, h = html(v);
  check("表示名: 通常表示は日本語だけ。識別子つきの表示名（「帰還の動き（return）」）は詳細表示の技術情報だけ。文章化の本文の識別子は変えない",
    !mainOf(h).includes("（return）") && between(h, 'data-testid="liuren-synthesis-detail"').includes("帰還の動き（return）") && paras(v).some((p) => p.text.includes("論点 return")));
  const lib = ["synthesisNarrative.ts", "domainSynthesis.ts"].map((f) => readFileSync(`src/lib/liuren/interpretation/${f}`, "utf8")).join("");
  check("表示名は総合・文章化の lib に置かない（行人 DOMAIN の規則・識別子も変えない）", !lib.includes("帰還の動き") && !lib.includes("TOPIC_LABEL")
    && !readFileSync("src/lib/liuren/interpretation/travelerDomain.ts", "utf8").includes("TOPIC_LABEL"));
}

// 11・12. 既存の表示・他の占的
{
  const page = readFileSync("src/app/liuren/page.tsx", "utf8");
  const qSelect = between(page, 'data-testid="liuren-question"', "</select>");
  check("12: 画面で選べる占的は行人だけ（他の占的の表示を加えない）", [...qSelect.matchAll(/<option value="(\w*)">/g)].map((m) => m[1]).join() === ",traveler");
  check("11: 盤の表示部品（LiurenChartView）は総合解釈を参照しない", !readFileSync("src/app/liuren/LiurenChartView.tsx", "utf8").includes("Synthesis"));
  const css = readFileSync("src/app/liuren/liuren.css", "utf8");
  check("印刷: 総合解釈と占的の選択は印刷に出さない（課式の印刷レイアウトを変えない）", /\.lr-question, \.lr-synth \{ display: none !important; \}/.test(css));
  let ok = true;
  for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o += 4) {
    const chart = chartOf(`${STEMS[i % 10]}${BRANCHES[i % 12]}`, BRANCHES[o]);
    for (const mb of [null, BRANCHES[(i + o) % 12] as Branch]) {
      try { const v = buildLiurenSynthesisView(chart, mb, T)!; if (!html(v).includes('data-testid="liuren-synthesis"')) ok = false; } catch { ok = false; }
    }
  }
  check("行人: 60日×月将3通り×月支あり/なし の盤すべてで、エラーなく描画できる", ok);
}

console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
