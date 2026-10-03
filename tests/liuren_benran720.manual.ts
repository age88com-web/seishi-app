// tests/liuren_benran720.manual.ts
//
// 六壬神課 起課エンジンと『七百二十課式便覧表』（tests/fixtures/liuren_benran720.json）の全件照合。
// 実行: npx tsx tests/liuren_benran720.manual.ts            … 照合（差の一覧が記録と同じなら PASS）
//       npx tsx tests/liuren_benran720.manual.ts --update   … 差の一覧の記録を書き直す（見直し後だけ使う）
//
// 比較項目: 四課（上神/下神）・三伝の支・十二天将（四課と三伝の夜将・昼将）・遁干（記号◎⊙の欄を除く）。
// 課格名・法名は概念や粒度が違うため一致率に含めず、別に集計して表示する。
//
// 原資料とエンジンの差は、原資料の誤植・内部矛盾と、計算規則の違いの両方を含む。
// どちらも自動では直さず、tests/fixtures/liuren_benran720_known_diffs.json に記録した差の一覧と
// 一致することを確認する（新しい差が出たらエンジンの回帰、差が消えたら記録の見直しが必要）。

import { readFileSync, writeFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { BRANCHES } from "../src/lib/eto";

type SrcRecord = {
  day: string; kyoku: number; offset: number; page: number; law: string; kaku: string[];
  lessons: { index: number; upper: string; lower: string; night: string; day: string }[];
  sanchuan: { branch: string; stemOrMark: string; night: string; day: string }[];
};

const FIXTURE = new URL("./fixtures/liuren_benran720.json", import.meta.url);
const KNOWN = new URL("./fixtures/liuren_benran720_known_diffs.json", import.meta.url);
const records: SrcRecord[] = JSON.parse(readFileSync(FIXTURE, "utf8")).records;

// 原資料は「騰蛇」、エンジンは「螣蛇」と表記する（同じ天将）
const general = (g: string) => g.replace("螣", "騰");
const LAW: Record<string, string> = {
  重審: "賊剋法", 元首: "賊剋法", 比用: "知一法", 涉害: "涉害法", 遥剋: "遙剋法",
  昴星: "昴星法", 別責: "別責法", 八専: "八專法", 伏吟: "伏吟法", 返吟: "返吟法",
};

function chart(r: SrcRecord, shi: Branch) {
  return calculateLiuren({
    dayStem: r.day[0] as Stem, dayBranch: r.day[1] as Branch, divinationBranch: shi,
    monthGeneral: BRANCHES[(BRANCHES.indexOf(shi) + r.offset) % 12],
  });
}

const diffs: string[] = [];
const count = { lessons: 0, sanchuan: 0, generals: 0, generalsTotal: 0, stems: 0, stemsTotal: 0, law: 0 };
for (const r of records) {
  const id = `${r.day}${r.kyoku}局`;
  const night = chart(r, "子"); // 夜占
  const day = chart(r, "午");   // 晝占
  const s = night.sanchuan;
  if (s.status !== "determined") { diffs.push(`${id} 三伝未確定`); continue; }

  const eL = night.lessons.map((l) => `${l.upper}/${l.lower}`);
  const sL = r.lessons.map((l) => `${l.upper}/${l.lower}`);
  if (eL.join() === sL.join()) count.lessons += 1;
  else diffs.push(`${id} 四課 原${sL.join(" ")} エ${eL.join(" ")}`);

  const eT = [s.initial, s.middle, s.final];
  const sT = r.sanchuan.map((t) => t.branch);
  if (eT.join() === sT.join()) count.sanchuan += 1;
  else diffs.push(`${id} 三伝 原${sT.join("")} エ${eT.join("")}`);

  const g = (src: string, eng: string, label: string) => {
    count.generalsTotal += 1;
    if (src === general(eng)) count.generals += 1;
    else diffs.push(`${id} ${label} 原${src} エ${general(eng)}`);
  };
  r.lessons.forEach((l, i) => {
    g(l.night, night.lessonGenerals[i], `${i + 1}課夜将`);
    g(l.day, day.lessonGenerals[i], `${i + 1}課昼将`);
  });
  r.sanchuan.forEach((t, i) => {
    const label = "初中末"[i];
    g(t.night, night.transmissions![i].general, `${label}伝夜将`);
    g(t.day, day.transmissions![i].general, `${label}伝昼将`);
    if (t.stemOrMark === "◎" || t.stemOrMark === "⊙") return;
    count.stemsTotal += 1;
    const e = night.transmissions![i].hiddenStem ?? "空亡";
    if (e === t.stemOrMark) count.stems += 1;
    else diffs.push(`${id} ${label}伝遁干 原${t.stemOrMark} エ${e}`);
  });
  if (LAW[s.method] === r.law) count.law += 1;
}

console.log(`四課   ${count.lessons}/${records.length}`);
console.log(`三伝   ${count.sanchuan}/${records.length}`);
console.log(`天将   ${count.generals}/${count.generalsTotal}`);
console.log(`遁干   ${count.stems}/${count.stemsTotal}（記号◎⊙の欄を除く）`);
console.log(`法名   ${count.law}/${records.length}（参考・一致率とは別集計）`);

if (process.argv.includes("--update")) {
  writeFileSync(KNOWN, JSON.stringify(diffs, null, 1) + "\n");
  console.log(`差の一覧を記録しました: ${diffs.length}件`);
  process.exit(0);
}

const known: string[] = JSON.parse(readFileSync(KNOWN, "utf8"));
const added = diffs.filter((d) => !known.includes(d));
const removed = known.filter((d) => !diffs.includes(d));
if (added.length || removed.length) {
  console.log(`FAIL: 記録と違う差があります（新しい差 ${added.length}件・消えた差 ${removed.length}件）`);
  added.forEach((d) => console.log(`  + ${d}`));
  removed.forEach((d) => console.log(`  - ${d}`));
  process.exit(1);
}
console.log(`ALL PASS（原資料との差 ${diffs.length}件は記録どおり）`);
