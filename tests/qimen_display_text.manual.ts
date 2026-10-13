// tests/qimen_display_text.manual.ts
//
// 表示用の PDF 途中改行処理（src/lib/qimenAiMaterials/displayText.ts、toDisplayText）の確認。
// 実行: npx tsx tests/qimen_display_text.manual.ts
//
// 剋應データ全件（本文 523 件＋九星値時の星別総論、いずれもルビ除去後）について:
//   ・raw は入力そのまま
//   ・display は raw から改行だけを取り除いたもの（他の文字は1字も変わらない）
//   ・取り除いた改行は、テスト側で独立に書いた規則（直前行が全角換算34字以上・文末記号で終わらない・
//     次行が空行／字下げ／※で始まらない）をすべて満たす。残した改行は満たさない
//   ・字下げの段落・※注記・空行は残る
// あわせて、乾六宮の3本文（KOKUO-001・003・005 の元データ）の具体例と、人工的な境界ケースを確認する。

import { readFileSync } from "node:fs";
import { stripRubyLines } from "../src/lib/qimenAiMaterials/ruby";
import { toDisplayText, PDF_FULL_LINE_WIDTH } from "../src/lib/qimenAiMaterials";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (ok) pass += 1;
  else if (failures.length < 50) failures.push(label);
}

// テスト側の独立実装
const width = (s: string) => [...s].reduce((a, c) => a + ((c.codePointAt(0) ?? 0) < 0x7f ? 0.5 : 1), 0);
function shouldJoin(prev: string, next: string): boolean {
  const p = prev.replace(/\s+$/, "");
  if (p === "" || next === "") return false;
  if (width(prev) < 34) return false;
  if (["。", "」", "』", "）", ")", "！", "？", "!", "?"].includes(p[p.length - 1])) return false;
  if (/^[\s　※]/.test(next)) return false;
  return true;
}

check("幅の閾値は34", PDF_FULL_LINE_WIDTH === 34);

let bodies = 0;
let contexts = 0;
let joinedBodies = 0;
let joinedContexts = 0;
let keptIndent = 0;
let keptNote = 0;
for (const name of ["jikkan", "hachimon", "kyusei_jichi", "sanki_tokyu"]) {
  const data = JSON.parse(readFileSync(`src/lib/qimen/kokuo/data/${name}.json`, "utf8"));
  const texts: { id: string; text: string; context: boolean }[] =
    data.entries.map((e: { id: string; body: string }) => ({ id: e.id, text: e.body, context: false }));
  if (data.context_blocks) {
    for (const blocks of Object.values(data.context_blocks) as { heading: string; body: string }[][]) {
      for (const b of blocks) texts.push({ id: b.heading, text: b.body, context: true });
    }
  }
  for (const { id, text, context } of texts) {
    const raw = stripRubyLines(text).text;
    const d = toDisplayText(raw);
    if (context) contexts += 1; else bodies += 1;
    check(`${id} raw はそのまま`, d.raw === raw);
    check(`${id} 改行以外は同一`, d.display.replace(/\n/g, "") === raw.replace(/\n/g, ""));
    // 改行ごとに、残したか取り除いたかをテスト側の規則と照合
    const lines = raw.split("\n");
    let expected = lines[0];
    let joins = 0;
    for (let i = 1; i < lines.length; i += 1) {
      const j = shouldJoin(lines[i - 1], lines[i]);
      if (j) joins += 1;
      else if (/^[\s　]/.test(lines[i]) && lines[i].trim() !== "") keptIndent += 1;
      else if (lines[i].startsWith("※")) keptNote += 1;
      expected += (j ? "" : "\n") + lines[i];
    }
    check(`${id} 規則どおり`, d.display === expected && d.joinedLineBreaks === joins);
    if (context) joinedContexts += joins; else joinedBodies += joins;
  }
}
check("本文523件", bodies === 523);

// 乾六宮の具体例（元データの本文）
const sanki = JSON.parse(readFileSync("src/lib/qimen/kokuo/data/sanki_tokyu.json", "utf8")).entries.find((e: { id: string }) => e.id === "sanki-乙-乾");
const d5 = toDisplayText(stripRubyLines(sanki.body).text).display;
check("KOKUO-005: 発展す／る がつながる", d5.includes("財産を手に入れ、大きく発展する。") && !d5.includes("発展す\nる"));
check("KOKUO-005: 見出し行と字下げ段落は残る", d5.startsWith("乙奇到乾宮\n 乙奇が乾宮に到れば") && d5.includes("\n 黄色い服を着た人"));
const jikkan = JSON.parse(readFileSync("src/lib/qimen/kokuo/data/jikkan.json", "utf8")).entries.find((e: { id: string }) => e.id === "jikkan-乙-乙");
const d1 = toDisplayText(stripRubyLines(jikkan.body).text).display;
check("KOKUO-001: わきま／えて がつながる", d1.includes("安分守己（自分の身の程をわきまえて生き、高望みしないこと）") && !d1.includes("\n"));
const hachimon = JSON.parse(readFileSync("src/lib/qimen/kokuo/data/hachimon.json", "utf8")).entries.find((e: { id: string }) => e.id === "hachimon-dynamic-開門-開門");
const d3 = toDisplayText(stripRubyLines(hachimon.body).text).display;
check("KOKUO-003: 貴／人に会う がつながる", d3.includes("十六里（6.4km）進めば、貴人に会う。") && !d3.includes("\n"));

// 人工的な境界ケース
const full = "あ".repeat(34);
check("幅いっぱい・語中 → つなぐ", toDisplayText(`${full}\nい`).display === `${full}い`);
check("幅33 → 残す", toDisplayText(`${"あ".repeat(33)}\nい`).display === `${"あ".repeat(33)}\nい`);
check("句点で終わる → 残す", toDisplayText(`${"あ".repeat(33)}。\nい`).display === `${"あ".repeat(33)}。\nい`);
check("閉じ括弧で終わる → 残す", toDisplayText(`${"あ".repeat(33)}）\nい`).display === `${"あ".repeat(33)}）\nい`);
check("次行が字下げ → 残す", toDisplayText(`${full}\n い`).display === `${full}\n い`);
check("次行が全角空白 → 残す", toDisplayText(`${full}\n　い`).display === `${full}\n　い`);
check("次行が※ → 残す", toDisplayText(`${full}\n※注`).display === `${full}\n※注`);
check("次行が空行 → 残す", toDisplayText(`${full}\n\nい`).display === `${full}\n\nい`);
check("ASCII は0.5字", toDisplayText(`${"あ".repeat(33)}ab\nい`).display === `${"あ".repeat(33)}abい`
  && toDisplayText(`${"あ".repeat(33)}a\nい`).display === `${"あ".repeat(33)}a\nい`);

console.log(`本文 ${bodies} 件でつないだ改行 ${joinedBodies} ／ 星別総論 ${contexts} 件でつないだ改行 ${joinedContexts}`);
console.log(`残した改行のうち 字下げ段落 ${keptIndent} ／ ※注記 ${keptNote}`);
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length}件`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`${pass} checks PASS`);
