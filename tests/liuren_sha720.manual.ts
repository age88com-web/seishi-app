// tests/liuren_sha720.manual.ts
//
// 六壬神課 起課結果の SHA-256 監査（720課: 60日 × 天盤差12、占時子）。
// 実行: npx tsx tests/liuren_sha720.manual.ts
//
//   legacy/core … 起課本体だけ。後から足した参照用メタデータを除いて計算する
//                 （sanchuan.initialOrigin〔Phase 3Z〕・generals.nobleBranches〔Phase 4F〕）。Phase 3Z 以前から不変
//   extended    … 起課結果の JSON 全体。メタデータを足すと変わる
//     現在の基準値 … Phase 4F 以降
//     履歴値       … Phase 3Z〜4E（nobleBranches だけを除くと再現する）

import { createHash } from "node:crypto";
import { calculateLiuren } from "../src/lib/liuren";
import type { LiurenChart } from "../src/lib/liuren";
import { STEMS, BRANCHES } from "../src/lib/eto";

const LEGACY = "9edc6b0a190499ba48a8729c75e4721eb68e0298c68bc68f71df6f468333a022";
const EXTENDED = "1c21ce4915baa71c380db21ad90b3ef69ced9ca83d1ecd1b648990c37666d70b";
const EXTENDED_HISTORY = [
  { phase: "Phase 3Z〜4E（generals.nobleBranches なし）", hash: "216ae70ee06f2e9515018e6dbe322d7a785a3fb79e308b79ce802fc480f8f677" },
];

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const charts: LiurenChart[] = [];
for (let i = 0; i < 60; i++) for (let o = 0; o < 12; o++) {
  charts.push(calculateLiuren({ dayStem: STEMS[i % 10], dayBranch: BRANCHES[i % 12], divinationBranch: "子", monthGeneral: BRANCHES[o] }));
}
/** Phase 4F のメタデータ（generals.nobleBranches）を除く */
const withoutNobleBranches = (cs: LiurenChart[]) => cs.map((c) => {
  const { nobleBranches: _omit, ...generals } = c.generals;
  return { ...c, generals };
});
/** Phase 3Z のメタデータ（sanchuan.initialOrigin）を除く */
const withoutInitialOrigin = <T extends { sanchuan: LiurenChart["sanchuan"] }>(cs: T[]) => cs.map((c) => {
  if (c.sanchuan.status !== "determined") return c;
  const { initialOrigin: _omit, ...sanchuan } = c.sanchuan;
  return { ...c, sanchuan };
});

const legacy = sha(JSON.stringify(withoutInitialOrigin(withoutNobleBranches(charts))));
const extended = sha(JSON.stringify(charts));
const previous = sha(JSON.stringify(withoutNobleBranches(charts)));

const failures: string[] = [];
if (charts.length !== 720) failures.push(`  FAIL 720課: ${charts.length}`);
if (legacy !== LEGACY) failures.push(`  FAIL legacy/core: ${legacy}`);
if (extended !== EXTENDED) failures.push(`  FAIL extended: ${extended}`);
if (previous !== EXTENDED_HISTORY[0].hash) failures.push(`  FAIL ${EXTENDED_HISTORY[0].phase} の再現: ${previous}`);
console.log(`legacy/core ${legacy}`);
console.log(`extended    ${extended}`);
console.log(`nobleBranches を除く ${previous}（履歴値 ${EXTENDED_HISTORY[0].phase}）`);
console.log(`PASS ${4 - failures.length} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
