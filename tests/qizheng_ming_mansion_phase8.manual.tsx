// tests/qizheng_ming_mansion_phase8.manual.tsx
//
// 七政四餘：命度宿（src/lib/ming_mansion.ts）と行限 Phase 8（命度宿を使う通常ルール）の確認。
// 実行: TZ=Asia/Tokyo npx tsx tests/qizheng_ming_mansion_phase8.manual.tsx   （--print で成立例を出力）
//
// A. 命度宿
//   - 通常（ASC 基準）：ASC 実黄経から直接求めた宿 ＝ 内部の命度宿 ＝ 画面の「命度（宿度）」（3000盤・100%）
//   - 古典（calcMingDegreeFromSunLon 基準）：命度の黄経の宿 ＝ 内部 ＝ 画面（3000盤・100%）
//   - 旧換算表（午＝0°…、branchFromLon と120°ずれ）との差の件数
//   - 画面・ChartSVG が lib の値だけを使う（ソース照合）
// B. Phase 8 の新規ルール：成立／1条件を外すと不成立、第1限・小限で出ない
// C. 実在の日時（両モード）：成立例、第1限・小限、death_timing、既存ルール（lr_0550・Phase 6B・7B）の結果が命度宿の有無で変わらない

import fs from "fs";
import path from "path";
import { mingMansionOf, mingMansionText } from "../src/lib/ming_mansion";
import { palaceLowLon } from "../src/lib/big_limit_degree";
import { lonToMansionDeg } from "../src/lib/mansions28";
import { calcMingDegreeFromSunLon } from "../src/lib/big_limit";
import * as BigLimit from "../src/lib/big_limit";
import { getBigLimitDegree } from "../src/lib/big_limit_degree";
import { getCurrentSmallLimitBranch } from "../src/lib/small_limit";
import { getLiunianForLimit } from "../src/lib/liunian";
import { CONFIRMED_LIMIT_RULES, loadNormalLimitRules, matchConfirmedLimitRules, type AnnualInput, type LimitRuleInput } from "../src/lib/limit_rules";
import allRulesJson from "../docs/qizheng-data/qizheng_limit_rules_v1_ja.json";
import { sampleChart } from "./helpers/qizheng_sample_chart";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; if (fail < 30) console.log("NG", msg); } };
const PRINT = process.argv.includes("--print");
const ALL = (allRulesJson as unknown as { records: { id: string; sensitivity: string }[] }).records;
const deathIds = new Set(ALL.filter((r) => r.sensitivity === "death_timing").map((r) => r.id));
const NEW_IDS = ["lr_0019", "lr_0021", "lr_0024", "lr_0027", "lr_0028", "lr_0032", "lr_0037", "lr_0038", "lr_0041", "lr_0699"];
const DEGREE_IDS = CONFIRMED_LIMIT_RULES.filter((r) => r.needsDegree).map((r) => r.id);

// 修正前の画面の換算表（page.tsx の旧 branchStartLon30：午＝0°…。branchFromLon と120°ずれていた）
const OLD_START: Record<string, number> = { 寅: 240, 卯: 270, 辰: 300, 巳: 330, 午: 0, 未: 30, 申: 60, 酉: 90, 戌: 120, 亥: 150, 子: 180, 丑: 210 };
const n360 = (x: number) => ((x % 360) + 360) % 360;
const oldText = (mingBranch: string, deg: number) => {
  const m = lonToMansionDeg(n360(OLD_START[mingBranch] + deg))!;
  return `${m.mansion.label}${m.degInMansion.toFixed(2)}°`;
};

async function main() {
  // ---------- A. 命度宿 ----------
  const start = Date.UTC(1940, 0, 1, 3, 0);
  const stat = { normal: 0, normalOk: 0, classic: 0, classicOk: 0, normalChanged: 0, classicChanged: 0 };
  for (let k = 0; k < 3000; k++) {
    const d = new Date(start + k * 7.13 * 86400000 + (k % 24) * 3600000);
    // 通常：ASC 実黄経の宿 ＝ 内部 ＝ 表示
    const n = sampleChart(d, "handen");
    const direct = lonToMansionDeg(n.ascLon)!;
    const mm = mingMansionOf(n.mingBranch, n.mingDegree);
    const directText = `${direct.mansion.label}${direct.degInMansion.toFixed(2)}°`;
    stat.normal++;
    const okN = !!mm && mm.mansion === direct.mansion.label && Math.abs(mm.degInMansion - direct.degInMansion) < 1e-9 && mingMansionText(mm) === directText;
    if (okN) stat.normalOk++; else check(false, `通常：ASC の宿 ${directText} / 内部 ${mingMansionText(mm)}（${d.toISOString()}）`);
    if (oldText(n.mingBranch, n.mingDegree) !== mingMansionText(mm)) stat.normalChanged++;
    // 古典：calcMingDegreeFromSunLon 基準の命度の宿 ＝ 内部 ＝ 表示
    const c = sampleChart(d, "getsu");
    check(c.mingDegree === calcMingDegreeFromSunLon(c.sunLon), "古典の命度＝calcMingDegreeFromSunLon");
    const cLon = n360(palaceLowLon(c.mingBranch)! + calcMingDegreeFromSunLon(c.sunLon));
    const cDirect = lonToMansionDeg(cLon)!;
    const cm = mingMansionOf(c.mingBranch, c.mingDegree);
    stat.classic++;
    const okC = !!cm && cm.mansion === cDirect.mansion.label && Math.abs(cm.degInMansion - cDirect.degInMansion) < 1e-9 && mingMansionText(cm) === `${cDirect.mansion.label}${cDirect.degInMansion.toFixed(2)}°`;
    if (okC) stat.classicOk++; else check(false, `古典：命度の宿 / 内部 ${mingMansionText(cm)}（${d.toISOString()}）`);
    if (oldText(c.mingBranch, c.mingDegree) !== mingMansionText(cm)) stat.classicChanged++;
    // 命度主は既存の宿度主対応（限度主と同じ）
    check(!!mm?.degreeLord && !!cm?.degreeLord, "命度主が求まる");
  }
  check(stat.normalOk === stat.normal && stat.classicOk === stat.classic, `一致率 通常 ${stat.normalOk}/${stat.normal}・古典 ${stat.classicOk}/${stat.classic}`);

  // ソース照合：画面・ChartSVG は lib の値だけを使う（旧換算表は残っていない）
  const page = fs.readFileSync(path.join(__dirname, "../src/app/page.tsx"), "utf8");
  check(/const mingMansion = useMemo\(\(\) => mingMansionOf\(mingBranch, mingDegree\), \[mingBranch, mingDegree\]\);/.test(page), "画面の命度宿は mingMansionOf(命宮, 共通命度)");
  check(/const mingdoTextMansion = mingMansionText\(mingMansion\);/.test(page), "画面の「命度（宿度）」は mingMansionText");
  check(!/branchStartLon30|"午": 0/.test(page), "旧換算表（午＝0°）が残っていない");
  const chart = fs.readFileSync(path.join(__dirname, "../src/components/ChartSVG.tsx"), "utf8");
  check(/mingMansion=\{mingMansionOf\(mingBranch, props\.mingDegree\)\?\.mansion \?\? null\}/.test(chart), "行限パネルへ同じ lib の命度宿を渡す");

  // ---------- B. Phase 8 の新規ルール ----------
  const normal = await loadNormalLimitRules();
  check(NEW_IDS.every((id) => CONFIRMED_LIMIT_RULES.some((r) => r.id === id && r.needsDegree)), "新規10件が登録され、限度が必要");
  const ids = (i: LimitRuleInput) => matchConfirmedLimitRules(i, normal).map((m) => m.rec.id);
  const deg = (mansion: string, lord: string, limitOrder = 3) => ({ limitOrder, mansion, degreeLord: lord });
  const base = (o: Partial<LimitRuleInput>): LimitRuleInput => ({ type: "big", branch: "寅", isDayBirth: true, bodies: [], degree: null, mingBranch: "子", mingMansion: null, ...o });
  const cases: [string, string, string, string, string][] = [
    // id, 命度宿（成立）, 限宿（成立）, 限度主, 命度宿（不成立）
    ["lr_0019", "斗", "箕", "mercury", "亢"],
    ["lr_0021", "井", "心", "moon", "女"],
    ["lr_0024", "角", "房", "sun", "星"],
    ["lr_0027", "婁", "女", "saturn", "奎"],
    ["lr_0028", "鬼", "昴", "sun", "柳"],
    ["lr_0032", "胃", "尾", "mars", "畢"],
    ["lr_0037", "尾", "柳", "saturn", "心"],
    ["lr_0038", "昴", "牛", "venus", "危"],
    ["lr_0041", "軫", "虚", "sun", "角"],
  ];
  for (const [id, mOk, lim, lord, mNg] of cases) {
    const ok = base({ mingMansion: mOk, degree: deg(lim, lord) });
    check(ids(ok).includes(id), `${id}：命度宿${mOk}・限宿${lim} → 成立`);
    check(!ids({ ...ok, mingMansion: mNg }).includes(id), `${id}：命度宿が${mNg}（命の条件が欠ける）→ 不成立`);
    check(!ids({ ...ok, mingMansion: null }).includes(id), `${id}：命度宿なし → 不成立`);
    const otherLord = "jupiter"; // 新規ルールのどれも「行四木度」を条件にしない
    check(!ids({ ...ok, degree: deg(lim, otherLord) }).includes(id), `${id}：限度主が違う（限の条件が欠ける）→ 不成立`);
    check(!ids({ ...ok, degree: deg(lim, lord, 1) }).includes(id), `${id}：第1限扱い → 不成立`);
    check(!ids({ ...ok, degree: null }).includes(id), `${id}：限度なし → 不成立`);
    check(!ids({ ...ok, type: "small" }).includes(id), `${id}：小限 → 不成立`);
  }
  check(ids(base({ mingMansion: "胃", degree: deg("房", "sun") })).includes("lr_0032"), "lr_0032：四日度でも成立（四火四日度）");
  const c699 = base({ mingBranch: "戌", mingMansion: "婁", degree: deg("箕", "mercury") });
  check(ids(c699).includes("lr_0699"), "lr_0699：命宮戌・命度宿婁・限宿箕 → 成立");
  check(!ids({ ...c699, mingBranch: "酉" }).includes("lr_0699"), "lr_0699：命宮が戌でない → 不成立");
  check(!ids({ ...c699, mingMansion: "胃" }).includes("lr_0699"), "lr_0699：命度宿が婁でない → 不成立");
  check(!ids({ ...c699, degree: deg("壁", "mercury") }).includes("lr_0699"), "lr_0699：限宿が箕でない → 不成立");
  const m19 = matchConfirmedLimitRules(base({ mingMansion: "斗", degree: deg("箕", "mercury") }), normal).find((m) => m.rec.id === "lr_0019");
  check(m19?.basis === "命度宿＝斗宿（角斗奎井に安命）、限宿＝箕宿（四水度）", `該当表示: ${m19?.basis}`);

  // ---------- C. 実在の日時（通常・古典の両モード）----------
  const found = new Map<string, string>();
  const annualOf = (l: ReturnType<typeof getLiunianForLimit>): AnnualInput | null =>
    l.available ? { targetYear: l.targetYear, stem: l.stem, branch: l.branch, taisuiBranch: l.taisuiBranch, shensha: l.shensha } : null;
  let firstLimit = 0, smallChecks = 0, bigChecks = 0;
  for (let k = 0; k < 2500; k++) {
    const d = new Date(Date.UTC(1935, 0, 1, 3, 0) + k * 13.07 * 86400000);
    for (const mode of ["getsu", "handen"] as const) {
      const c = sampleChart(d, mode);
      const mm = mingMansionOf(c.mingBranch, c.mingDegree)?.mansion ?? null;
      for (const age of [8, 15, 23, 31, 38, 46, 53, 61, 68, 76]) {
        const span = BigLimit.getCurrentBigLimit(c.mingBranch as any, c.mingDegree, age);
        if (!span) continue;
        const bd = getBigLimitDegree({ mingBranch: c.mingBranch as any, mingDegree: c.mingDegree, targetAge: age, clickedBranch: span.branch });
        const degree = bd.available ? { limitOrder: bd.limitOrder, mansion: bd.mansion, degreeLord: bd.degreeLord?.star ?? null } : null;
        const annual = annualOf(getLiunianForLimit({ birthYear: c.birthYear, targetAge: age, selection: { type: "big", branch: span.branch }, mingBranch: c.mingBranch, mingDegree: c.mingDegree }));
        const input: LimitRuleInput = { type: "big", branch: span.branch, isDayBirth: c.isDayBirth, bodies: c.bodies, degree, mingBranch: c.mingBranch, mingMansion: mm, annual };
        const ms = matchConfirmedLimitRules(input, normal);
        bigChecks++;
        check(ms.every((m) => !deathIds.has(m.rec.id)), "death_timing が出ない");
        // 既存ルール（lr_0550・Phase 6B・7B）は命度宿の有無で結果が変わらない
        const without = matchConfirmedLimitRules({ ...input, mingMansion: null }, normal).map((m) => m.rec.id);
        check(JSON.stringify(ms.map((m) => m.rec.id).filter((x) => !NEW_IDS.includes(x))) === JSON.stringify(without), "既存ルールの結果は命度宿の有無で同じ");
        if (span.order === 0) { firstLimit++; check(!ms.some((m) => DEGREE_IDS.includes(m.rec.id)), "第1限で限度が必要なルールが出ない"); }
        for (const m of ms) if (NEW_IDS.includes(m.rec.id) && !found.has(`${m.rec.id}|${mode}`)) {
          found.set(`${m.rec.id}|${mode}`, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 東京・命宮${c.mingBranch}・命度${c.mingDegree.toFixed(2)}（${mm}宿）・${age}歳 大限${span.branch}宮（第${span.order + 1}限）／該当：${m.basis}`);
        }
        const sb = getCurrentSmallLimitBranch(c.mingBranch, age)!;
        const sm = matchConfirmedLimitRules({ ...input, type: "small", branch: sb }, normal);
        smallChecks++;
        check(!sm.some((m) => DEGREE_IDS.includes(m.rec.id)), "小限で限度が必要なルールが出ない（限度を渡しても）");
        check(sm.every((m) => !deathIds.has(m.rec.id)), "小限で death_timing が出ない");
      }
    }
  }
  for (const mode of ["getsu", "handen"]) check(NEW_IDS.some((id) => found.has(`${id}|${mode}`)), `${mode === "handen" ? "通常" : "古典"}モードで新規ルールが成立`);

  if (PRINT) {
    console.log(`命度宿：通常 ${stat.normalOk}/${stat.normal} 一致・古典 ${stat.classicOk}/${stat.classic} 一致／旧換算表と表示が変わる盤 通常 ${stat.normalChanged}・古典 ${stat.classicChanged}`);
    console.log(`行限：大限 ${bigChecks}（第1限 ${firstLimit}）・小限 ${smallChecks}`);
    for (const mode of ["handen", "getsu"]) {
      console.log(mode === "handen" ? "== 通常（ASC 基準） ==" : "== 古典（calcMingDegreeFromSunLon） ==");
      for (const id of NEW_IDS) console.log(id, found.get(`${id}|${mode}`) ?? "（この走査では成立例なし）");
    }
  }
  if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
  console.log("PASS");
}
main();
