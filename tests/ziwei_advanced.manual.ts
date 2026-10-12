// tests/ziwei_advanced.manual.ts
//
// 応用編・144命宮配置解釈（src/lib/ziwei/meanings/advanced）の確認。docs/ziwei-basic-spec.md §24。
// 実行: npx tsx tests/ziwei_advanced.manual.ts
//
// 確認: 144キーの完全性（紫微星12支×命宮12支・重複0・欠落0・命盤から必ず1項目）・見出しの配置と既存エンジンの照合・
// 借りる星・本文が資料の文のまま（欠落なし・生成文なし・処理記録を含まない）・男女・特定星・四化・同宮・
// 条件成立／不成立／未判定・後続文が単独で出ない。

import fs from "node:fs";
import { calculateZiweiChart } from "../src/lib/ziwei";
import type { Branch, ZiweiChart, ZiweiInput } from "../src/lib/ziwei";
import {
  ADVANCED_ITEMS,
  ADVANCED_SOURCE_META,
  checkStructure,
  evaluateAdvancedInterpretation,
  getAdvancedInterpretation,
  getAdvancedItem,
} from "../src/lib/ziwei/meanings/advanced";
import type { AdvancedCondition, AdvancedInterpretation } from "../src/lib/ziwei/meanings/advanced";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const report: string[] = [];
const HB = "子丑寅卯辰巳午未申酉戌亥".split("") as Branch[];

// ---------------------------------------------------------------------------
// 1. 144キー
// ---------------------------------------------------------------------------
check("項目数 144", ADVANCED_ITEMS.length === 144);
const keys = new Set(ADVANCED_ITEMS.map((i) => `${i.ziweiBranch}|${i.mingBranch}`));
check("重複キー 0", keys.size === 144);
for (const z of HB) for (const m of HB) check(`キー ${z}×${m} がある`, getAdvancedItem(z, m)?.ziweiBranch === z && getAdvancedItem(z, m)?.mingBranch === m);
check("ID が一意", new Set(ADVANCED_ITEMS.map((i) => i.id)).size === 144);

// ---------------------------------------------------------------------------
// 2. 見出しの配置 ↔ 既存エンジン
// ---------------------------------------------------------------------------
const find0 = (id: string) => ADVANCED_ITEMS.find((i) => i.id === id)!;
const st = ADVANCED_ITEMS.map((i) => ({ i, c: checkStructure(i) }));
const statusCount = st.reduce<Record<string, number>>((a, x) => ({ ...a, [x.c.status]: (a[x.c.status] ?? 0) + 1 }), {});
check("配置の mismatch 0", !statusCount.mismatch, JSON.stringify(statusCount));
check("配置照合は144件すべて match", st.every((x) => x.c.status === "match"));
{
  const o3 = find0("OUYOU-003");
  check("OUYOU-003 = 紫微 子 × 命宮 寅", o3.ziweiBranch === "子" && o3.mingBranch === "寅" && getAdvancedItem("子", "寅")?.id === "OUYOU-003");
  check("OUYOU-003 の訂正記録（元の見出し「命宮は卯で破軍星」）", o3.sourceCorrection?.originalHeading === "命宮は卯で破軍星" && o3.sourceCorrection?.correctedBranch === "寅" && o3.heading === "命宮は寅で破軍星");
  check("紫微 子 × 命宮 卯 は OUYOU-004（主星なし）", getAdvancedItem("子", "卯")?.id === "OUYOU-004");
}
for (const { i, c } of st) {
  if (i.noMainStar) check(`${i.id} 主星なし・借りる星がエンジンの対宮の主星`, c.engineNoMainStar && [...i.borrowedStars].sort().join() === [...c.engineBorrowed].sort().join());
  else check(`${i.id} 主星がエンジンと一致`, !c.engineNoMainStar && [...i.displayedMainStars].sort().join() === [...c.engineMainStars].sort().join());
}
report.push(`配置照合: ${JSON.stringify(statusCount)}（主星なし ${ADVANCED_ITEMS.filter((i) => i.noMainStar).length} 項目）`);

// ---------------------------------------------------------------------------
// 3. 本文が資料の文のまま
// ---------------------------------------------------------------------------
const md = fs.readFileSync("docs/source/ziwei_ouyou_rewritten.md", "utf8");
const bodyMd = md.split("\n# 処理記録")[0];
const mdParas = new Set(bodyMd.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith(">")));
const allParas = ADVANCED_ITEMS.flatMap((i) => i.paragraphs);
check("段落数が資料と同じ", allParas.length === mdParas.size, `${allParas.length}/${mdParas.size}`);
check("すべての段落が資料の段落", allParas.every((p) => mdParas.has(p.text)));
check("資料のすべての段落がデータにある（本文欠落なし）", [...mdParas].every((t) => allParas.some((p) => p.text === t)));
check("文をつなげると段落", allParas.every((p) => p.sentences.map((s) => s.text).join("") === p.text));
check("処理記録を本文に含めない", !allParas.some((p) => /処理記録|OCR|要確認|誤植|編集方針/.test(p.text)));
check("処理記録は meta に保持", ADVANCED_SOURCE_META.processingRecord.startsWith("# 処理記録") && ADVANCED_SOURCE_META.processingRecord.includes("47"));
for (const i of ADVANCED_ITEMS) check(`${i.id} 本文あり`, i.paragraphs.length > 0);

// ---------------------------------------------------------------------------
// 4. 実際の命盤（144配置 × 男女）
// ---------------------------------------------------------------------------
const charts = new Map<string, ZiweiInput>();
for (let y = 1930; y <= 2010 && charts.size < 144; y += 1) {
  for (let m = 1; m <= 12; m += 1) {
    for (const d of [3, 11, 19, 27]) {
      for (const h of [1, 5, 9, 13, 17, 21]) {
        const inp: ZiweiInput = { birth: { year: y, month: m, day: d, hour: h, minute: 10 }, place: "東京", sex: "male" };
        const c = calculateZiweiChart(inp);
        const k = `${c.starPositions["紫微星"]}|${c.mingPalace}`;
        if (!charts.has(k)) charts.set(k, inp);
      }
    }
  }
}
check("命盤から144配置すべてが現れる", charts.size === 144, `${charts.size}`);

const condStats = { total: 0, byKind: {} as Record<string, number>, met: 0, notMet: 0, pending: 0 };
let luckyAlways = 0;
let luckyConds = 0;
const seen = { genderHidden: 0, starMet: new Set<string>(), starNotMet: new Set<string>(), followerChecked: 0 };
const evals: { r: AdvancedInterpretation; sex: string; chart: ZiweiChart }[] = [];
for (const [k, inp] of charts) {
  for (const sex of ["male", "female"] as const) {
    const chart = calculateZiweiChart({ ...inp, sex });
    const r = getAdvancedInterpretation(chart);
    evals.push({ r, sex, chart });
    check(`${k} ${sex} 項目を1つ取得`, r.item.ziweiBranch === chart.starPositions["紫微星"] && r.item.mingBranch === chart.mingPalace);
    const byId = new Map(r.sentences.map((s) => [s.id, s]));
    for (const s of r.sentences) {
      // 男女
      if (s.gender && s.gender !== sex && s.shown) check(`${k} ${sex} ${s.id} 異性の文を出さない`, false);
      if (s.hiddenReason === "gender") seen.genderHidden += 1;
      // 条件
      if (s.result === "pending" && s.shown) check(`${k} ${s.id} 未判定を出さない`, false);
      if (s.result === "notMet" && s.shown) check(`${k} ${s.id} 不成立を出さない`, false);
      if (s.result === "unconditional" && !s.gender && !s.shown) check(`${k} ${s.id} 無条件・男女共通は出す`, false);
      // 後続文
      if (s.blockOf) {
        const lead = byId.get(s.blockOf)!;
        seen.followerChecked += 1;
        if (s.shown !== lead.shown) check(`${k} ${sex} ${s.id} 後続文は先頭の文と一緒`, false, `${s.shown}/${lead.shown}`);
      }
      for (const c of s.conditionResults) {
        if (c.condition.kind === "stars") (c.result === "met" ? seen.starMet : seen.starNotMet).add(`${c.condition.relation}:${c.condition.stars.join("")}`);
      }
    }
    // 表示段落は資料の文を順につなげただけ
    for (const p of r.paragraphs) {
      const src = r.item.paragraphs.find((x) => x.id === p.id)!;
      const expect = src.sentences.filter((x) => p.sentenceIds.includes(x.id)).map((x) => x.text).join("");
      if (p.text !== expect || !p.sentenceIds.every((id) => byId.get(id)!.shown)) check(`${k} ${p.id} 表示本文は資料の文だけ`, false);
    }
  }
}
check("男女で非表示になる文がある", seen.genderHidden > 0);
check("後続文の整合を確認した", seen.followerChecked > 0);

// 条件の統計（盤面によらない）
for (const i of ADVANCED_ITEMS) {
  for (const s of i.paragraphs.flatMap((p) => p.sentences)) {
    for (const c of s.conditions) {
      condStats.total += 1;
      const key = c.kind === "starGroup" ? `${c.group}${c.negate ? "（否定）" : ""}・${c.relation}` : c.kind === "stars" ? `特定の星・${c.relation}` : c.kind === "pending" ? `未判定: ${c.term}` : `時期: ${c.phrase}`;
      condStats.byKind[key] = (condStats.byKind[key] ?? 0) + 1;
    }
  }
}
// 吉星の条件が命宮の三方四正の主星（盤面によらず固定）だけで常に成立するか
for (const { r } of evals.filter((e) => e.sex === "male")) {
  for (const s of r.sentences) {
    for (const c of s.conditionResults) {
      const cond = c.condition as AdvancedCondition;
      if (cond.kind === "starGroup" && cond.group === "吉星" && !cond.negate) {
        luckyConds += 1;
        if (/（[子丑寅卯辰巳午未申酉戌亥]）/.test(c.detail) && /(紫微|天機|太陽|武曲|天同|天府|太陰|天相|天梁)（/.test(c.detail)) luckyAlways += 1;
      }
    }
  }
}
const resultCount = evals.flatMap((e) => e.r.sentences).reduce<Record<string, number>>((a, s) => ({ ...a, [s.result]: (a[s.result] ?? 0) + 1 }), {});
report.push(`条件 ${condStats.total} 件の種類: ${Object.entries(condStats.byKind).map(([k, n]) => `${k} ${n}`).join("・")}`);
report.push(`288盤面（144配置×男女）の文の判定: ${JSON.stringify(resultCount)}・男女で非表示 ${seen.genderHidden}`);
report.push(`吉星の条件（${luckyConds} 判定）のうち、命宮の三方四正の主星（吉星）だけで成立したもの ${luckyAlways}`);

// ---------------------------------------------------------------------------
// 5. 個別の条件（成立・不成立・未判定）
// ---------------------------------------------------------------------------
const find = (id: string) => ADVANCED_ITEMS.find((i) => i.id === id)!;
const sentenceIn = (r: AdvancedInterpretation, part: string) => r.sentences.find((s) => s.text.includes(part))!;
const byItem = (id: string) => evals.filter((e) => e.r.item.id === id);
// 特定星（同宮）: 139 火星または擎羊星が同宮
{
  const i = find("OUYOU-139");
  const variants: { met: boolean; ok: boolean }[] = [];
  for (let y = 1930; y <= 2010; y += 1) {
    for (const h of [1, 5, 9, 13, 17, 21]) {
      for (const m of [1, 4, 7, 10]) {
        const c = calculateZiweiChart({ birth: { year: y, month: m, day: 15, hour: h, minute: 10 }, place: "東京", sex: "male" });
        if (c.starPositions["紫微星"] !== i.ziweiBranch || c.mingPalace !== i.mingBranch) continue;
        const r = evaluateAdvancedInterpretation(i, c);
        const s = sentenceIn(r, "火星または擎羊星が同宮すれば");
        const actual = c.starPositions["火星"] === c.mingPalace || c.starPositions["擎羊星"] === c.mingPalace;
        variants.push({ met: s.result === "met", ok: (s.result === "met") === actual && s.shown === actual });
      }
    }
  }
  check("OUYOU-139 火星・擎羊の同宮で成立する盤面がある", variants.some((v) => v.met));
  check("OUYOU-139 同宮しない盤面では不成立", variants.some((v) => !v.met));
  check("OUYOU-139 同宮の判定と表示が作盤結果どおり", variants.every((v) => v.ok));
}
// 四化: 9 化権・化禄に会う、14 禄存や化禄に会う（その配置の盤面を広く探す）
for (const [id, part, test] of [
  ["OUYOU-009", "化権・化禄に会えば", (c: ZiweiChart, area: Branch[]) => ["化権星", "化禄星"].every((k) => area.includes(c.transformations.find((t) => t.kind === k)!.branch))],
  ["OUYOU-014", "禄存や化禄に会う", (c: ZiweiChart, area: Branch[]) => area.includes(c.starPositions["禄存星"]) || area.includes(c.transformations.find((t) => t.kind === "化禄星")!.branch)],
] as const) {
  const i = find(id);
  const res: { hua: boolean; ok: boolean }[] = [];
  for (let y = 1930; y <= 2012; y += 1) {
    for (const m of [1, 3, 5, 7, 9, 11]) {
      for (const d of [2, 16]) {
        for (const h of [1, 5, 9, 13, 17, 21]) {
          const c = calculateZiweiChart({ birth: { year: y, month: m, day: d, hour: h, minute: 10 }, place: "東京", sex: "male" });
          if (c.starPositions["紫微星"] !== i.ziweiBranch || c.mingPalace !== i.mingBranch) continue;
          const r = evaluateAdvancedInterpretation(i, c);
          const own = r.sentences.find((x) => x.text.includes(part))!;
          const cr = own.conditionResults.find((x) => x.condition.kind === "stars")!;
          // 会う＝命宮と三方四正（三合2宮＋対宮）
          const k = HB.indexOf(c.mingPalace);
          const sf = [c.mingPalace, HB[(k + 6) % 12], HB[(k + 4) % 12], HB[(k + 8) % 12]];
          const actual = test(c, sf);
          res.push({ hua: cr.result === "met", ok: (cr.result === "met") === actual });
        }
      }
    }
  }
  check(`${id} 四化の条件が成立する盤面がある`, res.some((x) => x.hua), `${res.length} 盤面`);
  check(`${id} 四化の条件が不成立の盤面がある`, res.some((x) => !x.hua));
  check(`${id} 四化の判定が作盤結果どおり`, res.every((x) => x.ok));
}
check("特定星の条件が成立・不成立とも現れる", seen.starMet.size > 0 && seen.starNotMet.size > 0);
// 128 太陽と太陰が命宮にある場合（配置上つねに成立）
for (const e of byItem("OUYOU-128")) check(`OUYOU-128 ${e.sex} 太陽・太陰が命宮で成立`, sentenceIn(e.r, "太陽と太陰が命宮にある場合").result === "met");
// 未判定: 桃花・禄星・昼夜・悪い流年は表示しない
for (const e of evals) {
  for (const s of e.r.sentences) {
    if (/桃花の星|桃花系|禄星|昼生まれ|夜生まれ|悪い流年|貴人/.test(s.text) && s.result !== "notMet" && s.shown) check(`${s.id} 定義のない語の条件を表示しない`, false);
  }
}
// 男女: 40 女命の段落は女性だけ・男命の文は男性だけ
for (const e of byItem("OUYOU-044")) {
  const male = sentenceIn(e.r, "男命は優しく善良な妻と縁がある");
  const female = sentenceIn(e.r, "女命は思いやりのある夫と結婚しやすく");
  check(`OUYOU-044 ${e.sex} 男命の文`, male.shown === (e.sex === "male"));
  check(`OUYOU-044 ${e.sex} 女命の文`, female.shown === (e.sex === "female"));
}
// 男女共通（男女とも）は両方に出す
for (const e of byItem("OUYOU-073")) check(`OUYOU-073 ${e.sex} 「男女とも」は両方に出す`, sentenceIn(e.r, "ただし男女とも早婚は凶となる").shown);
// 後続文: 49「その場合は人生の苦労が増える」は先頭（禄星＝未判定）と一緒に非表示
for (const e of byItem("OUYOU-049")) {
  const lead = sentenceIn(e.r, "禄星がなく、さらに凶星が加会すると");
  const f = sentenceIn(e.r, "その場合は人生の苦労が増える");
  check(`OUYOU-049 ${e.sex} 後続文は先頭と一緒`, f.blockOf === lead.id && f.shown === lead.shown && !f.shown);
}
// 格局名は本文のまま・リンクだけ
check("格局との関係（桃花犯主格・巨日同宮格・機月同梁格）", find("OUYOU-118").sourceRelations.some((r) => r.patternId === "K2-31") && find("OUYOU-063").sourceRelations.some((r) => r.patternId === "K2-11") && find("OUYOU-065").sourceRelations.some((r) => r.patternId === "K2-09"));

// 吉星の定義は入門 p.15 のまま（主星を含む。2026-10-01 確定）: 三方四正の主星だけで成立する例がある
check("吉星の条件が主星（入門 p.15 の吉星）で成立する", luckyAlways > 0);
// 人生時期の文（若い頃・中年以降・四十歳前後・晩年 など）は条件にせず通常表示
{
  let n = 0;
  for (const e of evals) {
    for (const s of e.r.sentences) {
      if (/若い頃|若年期|中年以降|中年頃|四十歳|四十代|晩年/.test(s.text) && s.result === "unconditional" && !s.gender) {
        n += 1;
        if (!s.shown) check(`${s.id} 人生時期の文は通常表示`, false);
      }
    }
  }
  check("人生時期の文を通常表示として確認した", n > 0, `${n}`);
}
// 悪い流年は非表示
for (const e of byItem("OUYOU-023")) check(`OUYOU-023 ${e.sex} 悪い流年の文は非表示`, !sentenceIn(e.r, "悪い流年には").shown && sentenceIn(e.r, "悪い流年には").result === "pending");
// 文の途中から条件が付く文は文全体で表示／非表示（文を分割しない）
for (const e of byItem("OUYOU-063")) {
  const s = sentenceIn(e.r, "特に昼生まれは運が良い");
  check(`OUYOU-063 ${e.sex} 文途中の条件（昼生まれ）は文全体を非表示`, !s.shown && s.text.startsWith("故郷を離れて"));
}
for (const e of byItem("OUYOU-069")) {
  const s = sentenceIn(e.r, "比較的良い格局を形成しやすく、吉星が会照すれば");
  check(`OUYOU-069 ${e.sex} 文途中の条件（吉星が会照）は文全体で表示`, s.shown === (s.result === "met") && e.r.paragraphs.some((p) => p.text.includes(s.text)) === s.shown);
}
// 未定義の語は conditionPending（吉星の助け・補佐を含む）
for (const i of ADVANCED_ITEMS) {
  for (const s of i.paragraphs.flatMap((p) => p.sentences)) {
    for (const c of s.conditions) {
      if (c.kind === "pending" && !/禄星|桃花|貴人|昼生まれ|吉星の|吉星が多く|吉星だけ|吉星（特に|加わる|見る/.test(c.term)) check(`${s.id} 想定外の未判定: ${c.term}`, false);
    }
  }
}

// 命盤A
const chartA = calculateZiweiChart({ birth: { year: 1955, month: 10, day: 16, hour: 15, minute: 55 }, place: "東京", sex: "female" });
const rA = getAdvancedInterpretation(chartA);
check("命盤A は紫微午×命宮寅（OUYOU-075）", rA.item.id === "OUYOU-075");
report.push(`命盤A: ${rA.item.id}「${rA.item.heading}」表示 ${rA.counts.shown}/${rA.counts.sentences} 文`);

const fail = failures.length;
console.log(report.join("\n"));
console.log(`\n応用編: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
