// tests/liuren_interpretation_natal_year.manual.ts
//
// 六壬神課 Phase 4L-2（本命・年命 NatalYearState。人物の生年干支）のテスト。
// 実行: npx tsx tests/liuren_interpretation_natal_year.manual.ts
//
//   1. 六十干支60組すべてで作れ、干・支をそのまま保持する。六十干支にない60組は例外（起課エンジンの日干支と同じ規則）
//   2. 人物ごとに別の値を作れる（共有の状態を持たない）。太歳（Phase 4L-1）とは別の FACT
//   3. 本命の支を既存の関数に渡せる: 上神（plate.heavenOn）・天将（Phase 4B）・日干との関係（Phase 4K）・十二長生・驛馬（yimaOf）
//   4. 『六壬断案２』例41・42・44・46・47・49・51・53・54 の本命・年命（例49 は生年干がないので支だけ照合）
//   5. 占時12支 8,640課で、どの本命を与えても起課結果・解釈 FACT が変わらない
//   6. 生年月日・年境界・性別・年齢・行年・上神・天将・六親・十二長生・空亡・驛馬・ROLE・DOMAIN・吉凶を持たない

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { anchorResolutionContextOf } from "../src/lib/liuren/interpretation/anchorResolver";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { derivedBranchDayStemStateOf } from "../src/lib/liuren/interpretation/derivedBranchDayStem";
import { growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { yimaOf } from "../src/lib/liuren/interpretation/markers";
import { natalYearStateOf } from "../src/lib/liuren/interpretation/natalYear";
import { taiSuiStateOf } from "../src/lib/liuren/interpretation/taiSui";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const factsOf = (day: string, jiang: Branch, shi: Branch) =>
  buildInterpretationFacts(calculateLiuren({ dayStem: day[0] as Stem, dayBranch: day[1] as Branch, divinationBranch: shi, monthGeneral: jiang }));
/** 起課エンジンが受け付ける日干支か（六十干支の判定を起課エンジンに任せる） */
const engineAccepts = (s: Stem, b: Branch) => {
  try { calculateLiuren({ dayStem: s, dayBranch: b, divinationBranch: "子", monthGeneral: "子" }); return true; } catch { return false; }
};

// ---- 1. 六十干支と不正な組 ----
let valid = 0, invalid = 0, agree = 0;
for (const s of STEMS) for (const b of BRANCHES) {
  let state: ReturnType<typeof natalYearStateOf> | null = null;
  try { state = natalYearStateOf(s, b); } catch { state = null; }
  if (state) {
    valid += 1;
    if (state.kind !== "natalYear" || state.stem !== s || state.branch !== b || Object.keys(state).join() !== "kind,stem,branch") check(`${s}${b} 保持`, false);
  } else invalid += 1;
  if ((state !== null) === engineAccepts(s, b)) agree += 1;
}
const sixty = Array.from({ length: 60 }, (_, i) => `${STEMS[i % 10]}${BRANCHES[i % 12]}`);
check("六十干支60組すべてで作れる", sixty.every((gz) => { try { natalYearStateOf(gz[0] as Stem, gz[1] as Branch); return true; } catch { return false; } }));
check("干×支120組のうち、作れるのは60組・例外は60組", valid === 60 && invalid === 60, `${valid} / ${invalid}`);
check("受け付ける組は起課エンジンの日干支の判定と120組すべてで同じ", agree === 120, String(agree));

// ---- 2. 人物ごとの値・太歳との区別 ----
{
  const a = natalYearStateOf("己", "巳");
  const b = natalYearStateOf("辛", "未");
  check("人物ごとに別の値を作れ、互いに影響しない", a.branch === "巳" && b.branch === "未" && a !== b && natalYearStateOf("己", "巳").branch === "巳");
  const t = taiSuiStateOf("巳");
  check("同じ支でも太歳とは別の FACT（kind が違い、生年干を持つのは本命だけ）", t.branch === a.branch && (t.kind as string) !== (a.kind as string) && !("stem" in t));
}

// ---- 3・4. 断例 ----
const lines: string[] = [];
{
  // 例41 戊申日 未将酉時「本人の年命は巳でこれは戊の寄宮」（己巳命）
  const n = natalYearStateOf("己", "巳");
  check("例41 己巳命 → 年命 巳", n.stem === "己" && n.branch === "巳");
  lines.push(`例41: 己巳命 → 年命 ${n.branch}（「戊の寄宮」は実装しない）`);
}
{
  // 例42 甲寅日 未将寅時「本命は墓から来て身となり…本命上が発用となり、空亡」「本命が未で日干の墓」（辛未生）
  const f = factsOf("甲寅", "未", "寅");
  const n = natalYearStateOf("辛", "未");
  const over = f.plate.heavenOn[n.branch];
  check("例42 辛未生 → 本命 未、未は日干甲の墓（十二長生。既存の関数）", n.branch === "未" && growthStageOfStem("甲", n.branch) === "墓");
  check("例42 本命の上 plate.heavenOn[未]＝子＝初伝（発用）で、子は旬空", over === "子" && f.transmissions![0].branch === over && f.transmissions![0].isVoid);
  lines.push(`例42: 辛未生 → 本命 ${n.branch}（甲の${growthStageOfStem("甲", n.branch)}） 本命の上 ${over}＝初伝・旬空 ${f.transmissions![0].isVoid}`);
}
{
  // 例44 庚辰日 子将酉時「未は本命で貴人がついており、未上は戌」（己未生。天将盤はエンジンと一致する例）
  const f = factsOf("庚辰", "子", "酉");
  const n = natalYearStateOf("己", "未");
  check("例44 己未生 → 本命 未、本命の支に乗る天将は貴人（断案の盤もエンジンも）", n.branch === "未" && heavenlyGeneralStateOf(f, n.branch).general === "貴人");
  check("例44 本命の上 plate.heavenOn[未]＝戌", f.plate.heavenOn[n.branch] === "戌");
  lines.push(`例44: 己未生 → 本命 ${n.branch} 天将 ${heavenlyGeneralStateOf(f, n.branch).general} 上 ${f.plate.heavenOn[n.branch]}`);
}
{
  const n = natalYearStateOf("辛", "卯");
  check("例46 辛卯生 → 本命 卯（「東方」は実装しない）", n.branch === "卯");
  lines.push(`例46: 辛卯生 → 本命 ${n.branch}`);
}
{
  // 例47 丙寅日 亥将申時「本命の駅馬は長生」（戊子生）
  const n = natalYearStateOf("戊", "子");
  const yima = yimaOf(n.branch);
  check("例47 戊子生 → 本命 子、既存の yimaOf（基準の支から驛馬）に本命の支を渡すと 寅、寅は日干丙の長生", n.branch === "子" && yima === "寅" && growthStageOfStem("丙", yima) === "長生");
  lines.push(`例47: 戊子生 → 本命 ${n.branch} の驛馬 ${yima}（yimaOf を再利用。丙の${growthStageOfStem("丙", yima)}）`);
}
{
  // 例49 己卯日 午将丑時「本命酉で螣蛇」（生年干の記載なし → 支だけを照合し、NatalYearState は作らない）
  const f = factsOf("己卯", "午", "丑");
  check("例49 本命 酉（支だけ）に乗る天将は螣蛇（天将盤はエンジンと一致する例）", heavenlyGeneralStateOf(f, "酉").general === "螣蛇");
  lines.push("例49: 本命 酉（生年干の記載なし。支だけ照合） 天将 螣蛇");
}
{
  // 例51 癸亥日 未将巳時「寅上辰は年命」（戊辰生）
  const f = factsOf("癸亥", "未", "巳");
  const n = natalYearStateOf("戊", "辰");
  check("例51 戊辰生 → 年命 辰、辰は寅の上（plate.earthUnder[辰]＝寅）", n.branch === "辰" && f.plate.earthUnder[n.branch] === "寅");
  lines.push(`例51: 戊辰生 → 年命 ${n.branch}（地盤 ${f.plate.earthUnder[n.branch]} の上）`);
}
{
  // 例53 丙子日 卯将丑時「辰が年命であり、丙火の子孫」「初伝は年命辰」（戊辰生）
  const f = factsOf("丙子", "卯", "丑");
  const n = natalYearStateOf("戊", "辰");
  const d = derivedBranchDayStemStateOf(f, n.branch);
  check("例53 戊辰生 → 年命 辰、丙から見て dayStemGeneratesTransmission・子孫（本文「丙火の子孫」）", d.relationToDayStem === "dayStemGeneratesTransmission" && d.sixRelation === "子孫");
  check("例53 初伝は年命の辰", f.transmissions![0].branch === n.branch);
  lines.push(`例53: 戊辰生 → 年命 ${n.branch} ${d.relationToDayStem}・${d.sixRelation} 初伝 ${f.transmissions![0].branch}`);
}
{
  // 例54 庚辰日 子将子時「官鬼ですが、年命でありさらに日干の長生で学堂」（丁巳生）
  const f = factsOf("庚辰", "子", "子");
  const n = natalYearStateOf("丁", "巳");
  const d = derivedBranchDayStemStateOf(f, n.branch);
  check("例54 丁巳生 → 年命 巳、庚から見て transmissionOvercomesDayStem・官鬼", d.relationToDayStem === "transmissionOvercomesDayStem" && d.sixRelation === "官鬼");
  check("例54 巳は日干庚の長生（既存の十二長生で本文「日干の長生」を再現）", growthStageOfStem("庚", n.branch) === "長生");
  lines.push(`例54: 丁巳生 → 年命 ${n.branch} ${d.relationToDayStem}・${d.sixRelation}・庚の${growthStageOfStem("庚", n.branch)}`);
}

// ---- 5. 起課・解釈 FACT が変わらない ----
let charts = 0, changed = 0;
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) for (const shi of BRANCHES) {
  const input = { dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: shi, monthGeneral: BRANCHES[o] };
  const chart = calculateLiuren(input);
  const before = JSON.stringify(chart);
  const facts = buildInterpretationFacts(chart);
  const ctxBefore = shi === "子" ? JSON.stringify(anchorResolutionContextOf(facts)) : "";
  for (const gz of sixty) {
    const n = natalYearStateOf(gz[0] as Stem, gz[1] as Branch);
    void facts.plate.heavenOn[n.branch];
    void heavenlyGeneralStateOf(facts, n.branch);
    void derivedBranchDayStemStateOf(facts, n.branch);
  }
  charts += 1;
  if (JSON.stringify(chart) !== before || JSON.stringify(calculateLiuren(input)) !== before) changed += 1;
  if (shi === "子" && JSON.stringify(anchorResolutionContextOf(facts)) !== ctxBefore) changed += 1;
}
check("8,640課（うち720課は占時子）で、60干支どの本命を与えても起課結果・解釈 FACT が変わらない", charts === 8640 && changed === 0, `${charts} / ${changed}`);

// ---- 6. コード ----
{
  const strip = (p: string) => readFileSync(p, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  const code = strip("src/lib/liuren/interpretation/natalYear.ts");
  const hit = ["calendar", "birth", "立春", "gender", "sex", "age", "行年", "heavenOn", "general", "sixRelation", "growth", "void", "yima", "personal",
    "role", "domain", "InterpretationContext", "吉", "凶", "SIXTY", "六十干支表"].filter((w) => code.includes(w));
  check("natalYear.ts に生年月日・年境界・性別・年齢・行年・他の FACT・共有状態・ROLE・DOMAIN・吉凶・独自の干支表がない", hit.length === 0, hit.join(","));
  const t = readFileSync("src/lib/liuren/interpretation/types.ts", "utf8").split("export interface NatalYearState")[1].split("}")[0];
  check("NatalYearState の型は kind・stem・branch だけ", !/gender|age|upper|general|sixRelation|growth|yima|birthDate/.test(t));
  check("BenMing・NianMing の重複 FACT がない", !/BenMing|NianMing/.test(readFileSync("src/lib/liuren/interpretation/types.ts", "utf8")));
  check("起課エンジン・InterpretationFacts・RoleMatcher に本命を入れていない",
    !/natalYear|NatalYear|本命|年命/.test(strip("src/lib/liuren/liurenEngine.ts") + strip("src/lib/liuren/types.ts") + strip("src/lib/liuren/interpretation/facts.ts") + strip("src/lib/liuren/interpretation/roleRules.ts")));
}

console.log("断例:");
for (const l of lines) console.log(`  ${l}`);
console.log(`干×支120組: 作れる ${valid} ／ 例外 ${invalid}（起課エンジンの判定と ${agree}/120 一致）`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
