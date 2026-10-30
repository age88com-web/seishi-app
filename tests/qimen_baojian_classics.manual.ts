// tests/qimen_baojian_classics.manual.ts
//
// 奇門遁甲 Phase 5B『御定奇門寶鑑』格局原典データ（src/lib/qimenClassics）の確認。
//   ・3節の原文（簡体字・繁體字表示）が、保存した取得テキスト（docs/source/baojian）と一字一句一致する。
//   ・規則16件・批判3件の根拠の句が、その節の原文に含まれる。
//   ・二吉四凶6格・勃格飛伏4分類・刑破4規則が原典どおり登録されている。
//   ・成立判定は登録していない（autoJudgement.enabled は false、甲を含む／相加は理由を明記）。
//   ・現行格局名・剋應 ID の参照先が存在し、上下が一致すると書いた剋應は ID の干の順と合う。
//   ・剋應の本文を複製していない。格局判定（src/lib/qimen）から参照していない。
// 実行: npx tsx tests/qimen_baojian_classics.manual.ts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BAOJIAN_CRITIQUES,
  BAOJIAN_RULES,
  BAOJIAN_SECTIONS,
  lookupClassicCritiquesByAppKaku,
  lookupClassicRulesByAppKaku,
  lookupClassicRulesByKokuoId,
} from "@/lib/qimenClassics";
import { JIKAKU_NAMES, KYOKAKU_NAMES } from "@/lib/qimenSearch/formats";

let checks = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures.push(`${label} ${detail}`);
}

const ROOT = join(__dirname, "..");
const source = readFileSync(join(ROOT, "docs/source/baojian/奇門寶鑑御定_巻一_格局3節_wikisource.md"), "utf8");
const partA = source.slice(source.indexOf("## A."), source.indexOf("## B."));
const partB = source.slice(source.indexOf("## B."), source.indexOf("## 参考"));
const kokuo = JSON.parse(readFileSync(join(ROOT, "src/lib/qimen/kokuo/data/jikkan.json"), "utf8"));
const kokuoEntries: { id: string; body: string }[] = kokuo.entries ?? kokuo;
const kokuoIds = new Set(kokuoEntries.map((e) => e.id));
const appKaku = new Set([...JIKAKU_NAMES, ...KYOKAKU_NAMES]);

// 1) 節と原文
check("節数", BAOJIAN_SECTIONS.length === 3, String(BAOJIAN_SECTIONS.length));
check("節名", JSON.stringify(BAOJIAN_SECTIONS.map((s) => s.title)) === JSON.stringify(["釋勃格飛伏", "釋庚丙同刑異破", "釋二吉四凶"]));
for (const s of BAOJIAN_SECTIONS) {
  check(`${s.title} 見出しが取得テキストにある`, partA.includes(`【${s.titleSimplified}】`) && partB.includes(`【${s.title}】`));
  for (const p of s.originalSimplified) check(`${s.title} 簡体字原文が取得テキストと一致`, partA.includes(p), p.slice(0, 20));
  for (const p of s.originalTraditional) check(`${s.title} 繁體字原文が取得テキストと一致`, partB.includes(p), p.slice(0, 20));
  check(`${s.title} 原文と訳の段落数`, s.originalSimplified.length === s.originalTraditional.length && s.translationJa.length === s.originalTraditional.length);
  check(`${s.title} 出典URL`, s.sources.some((x) => x.url.includes("wikisource")) && s.sources.some((x) => x.url.includes("ctext") && x.status.startsWith("未照合")));
  for (const n of s.textNotes) check(`${s.title} 異同の箇所が原文にある`, s.originalTraditional.join("").includes(n.location) && s.originalSimplified.join("").includes(n.simplified), n.location);
}
const sectionText = (id: string) => BAOJIAN_SECTIONS.find((s) => s.id === id)!.originalTraditional.join("");

// 2) 規則
check("規則数", BAOJIAN_RULES.length === 16, String(BAOJIAN_RULES.length));
check("規則IDの重複なし", new Set(BAOJIAN_RULES.map((r) => r.id)).size === BAOJIAN_RULES.length);
for (const r of BAOJIAN_RULES) {
  const t = sectionText(r.sectionId);
  check(`${r.name} 根拠の句が原文にある`, t.includes(r.originalPhrase), r.originalPhrase);
  check(`${r.name} 吉凶の句が原文にある`, r.fortunePhrase === null ? r.fortune === "記載なし" : t.includes(r.fortunePhrase));
  for (const c of r.cautions) check(`${r.name} 注意事項が原文にある`, t.includes(c.original), c.original);
  check(`${r.name} 成立判定は登録しない`, r.autoJudgement.enabled === false && r.autoJudgement.reason.length > 0);
  const hasJia = r.combination.first === "甲" || r.combination.second === "甲";
  if (hasJia) check(`${r.name} 甲を含む理由`, r.autoJudgement.reason.includes("甲"));
  if (r.combination.order === "相加（上下未確定）") {
    check(`${r.name} 相加は上下未確定`, r.originalPhrase.includes("相加") && r.autoJudgement.reason.includes("相加"));
  } else {
    check(`${r.name} 上加下の句`, r.originalPhrase.includes(`${r.combination.first}加${r.combination.second}`));
  }
  for (const a of r.appRelations) {
    if (a.kind === "現行格局") check(`${r.name} 現行格局 ${a.target} が存在`, appKaku.has(a.target));
    else {
      check(`${r.name} 剋應 ${a.target} が存在`, kokuoIds.has(a.target));
      const [, up, down] = a.target.split("-");
      const norm = (x: string) => (x === "甲" ? "戊" : x);
      const pair = [norm(r.combination.first), norm(r.combination.second)];
      if (a.relation === "同じ干の組み合わせ（上下も一致）") check(`${r.name} 剋應 ${a.target} 上下一致`, up === r.combination.first && down === r.combination.second);
      else check(`${r.name} 剋應 ${a.target} 干が対応`, (up === pair[0] && down === pair[1]) || (up === pair[1] && down === pair[0]));
    }
  }
}
const names = (cat: string) => BAOJIAN_RULES.filter((r) => r.category === cat).map((r) => r.name);
check("二吉", JSON.stringify(names("二吉")) === JSON.stringify(["陰陽化氣", "龍鳳呈祥"]));
check("四凶", JSON.stringify(names("四凶")) === JSON.stringify(["二龍戰野", "二虎爭雄", "青龍困頓", "白虎迍邅"]));
check("二吉は吉・四凶は凶", BAOJIAN_RULES.filter((r) => r.category === "二吉").every((r) => r.fortune === "吉") && BAOJIAN_RULES.filter((r) => r.category === "四凶").every((r) => r.fortune === "凶"));
const combo = (n: string) => { const r = BAOJIAN_RULES.find((x) => x.name === n)!; return `${r.combination.first}${r.combination.order === "上加下" ? "加" : "・"}${r.combination.second}`; };
check("勃格飛伏4分類", combo("勃飛") === "丙加庚" && combo("勃伏") === "庚加丙" && combo("格飛") === "庚加甲" && combo("格伏") === "甲加庚");
check("刑破", combo("刑（庚加癸）") === "庚加癸" && combo("刑（丙加己）") === "丙加己" && combo("破（庚丁相加）") === "庚・丁" && combo("破（丙壬相加）") === "丙・壬");

// 3) 批判
check("批判3件", BAOJIAN_CRITIQUES.length === 3);
for (const c of BAOJIAN_CRITIQUES) {
  const t = sectionText(c.sectionId);
  for (const part of c.originalPhrase.split("……")) check(`${c.id} 原文の句`, t.includes(part), part.slice(0, 20));
  for (const k of c.affectedAppKaku) check(`${c.id} 現行格局 ${k} が存在`, appKaku.has(k));
}

// 4) 参照関数
check("大格 → 刑（庚加癸）", lookupClassicRulesByAppKaku("大格").map((x) => x.rule.name).join() === "刑（庚加癸）");
check("大格 → 批判", lookupClassicCritiquesByAppKaku("大格").length === 1);
check("剋應 jikkan-丙-庚 → 勃飛", lookupClassicRulesByKokuoId("jikkan-丙-庚").map((x) => x.rule.name).join() === "勃飛");
check("青龍返首・飛鳥跌穴は名称で結び付けない", lookupClassicRulesByAppKaku("青龍返首").length === 0 && lookupClassicRulesByAppKaku("飛鳥跌穴").length === 0);

// 5) 剋應本文を複製していない・格局判定から参照していない
const dataSrc = readFileSync(join(ROOT, "src/lib/qimenClassics/baojian.ts"), "utf8");
check("剋應本文を複製していない", kokuoEntries.every((e) => {
  const body = e.body.replace(/\s/g, "");
  for (let i = 0; i + 20 <= body.length; i += 10) if (dataSrc.includes(body.slice(i, i + 20))) return false;
  return true;
}));
const qimenDir = join(ROOT, "src/lib/qimen");
const qimenFiles = readdirSync(qimenDir).filter((f) => f.endsWith(".ts"));
check("格局判定から参照していない", qimenFiles.every((f) => !readFileSync(join(qimenDir, f), "utf8").includes("qimenClassics")));

if (failures.length > 0) {
  console.error(failures.slice(0, 20).join("\n"));
  console.error(`FAIL ${failures.length} / ${checks}`);
  process.exit(1);
}
console.log(`${checks} checks PASS 節=${BAOJIAN_SECTIONS.length} 規則=${BAOJIAN_RULES.length} 批判=${BAOJIAN_CRITIQUES.length}`);
