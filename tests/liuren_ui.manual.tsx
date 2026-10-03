// tests/liuren_ui.manual.tsx
//
// 六壬神課 課式ページの表示部品（src/app/liuren/LiurenChartView.tsx）の照合テスト。
// 講座例題を calculateLiuren() で起課し、実際に画面へ出す HTML を描画して、
// 表示された四課・三伝・課体が tests/fixtures/liuren_textbook.json と一致するかを確認する。
// 実行: npx tsx tests/liuren_ui.manual.tsx
//
// 画面上の四課は講座と同じ「四課 三課 二課 一課」の順で並ぶため、読み取った値を
// 一課→四課に並べ直して照合する。

import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./fixtures/liuren_textbook.json";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, Stem } from "../src/lib/liuren";
import { BRANCHES } from "../src/lib/eto";
import LiurenChartView from "../src/app/liuren/LiurenChartView";

type Case = (typeof fixture.cases)[number] & {
  divinationBranch?: string;
  monthGeneral?: string;
  expected: Record<string, unknown>;
};

// 必須確認7例と、そのとき画面に出るべき課体
const REQUIRED: readonly [string, string][] = [
  ["E01", "賊剋（重審課）"],
  ["E09", "涉害（綴瑕格）"],
  ["E15", "八専"],
  ["E17", "八専（独足格）"],
  ["E19", "伏吟（自任格）"],
  ["E23", "返吟（無依格）"],
  ["E24", "返吟（無親格）"],
];

function all(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => m[1]);
}

let fail = 0;
for (const [id, method] of REQUIRED) {
  const c = fixture.cases.find((x) => x.id === id) as Case;
  // 月将・占時の記載がない例は、差分が同じになる組（占時子）で入力する（Phase 2 テストと同じ）
  const divinationBranch = (c.divinationBranch ?? "子") as Branch;
  const monthGeneral = (c.monthGeneral ?? BRANCHES[c.offset]) as Branch;
  const chart = calculateLiuren({
    dayStem: c.day[0] as Stem, dayBranch: c.day[1] as Branch, divinationBranch, monthGeneral,
  });
  const html = renderToStaticMarkup(<LiurenChartView chart={chart} info={[]} />);

  // 画面の四課（左から 四課 三課 二課 一課）
  const uppers = all(html, /class="lr-upper" data-lesson="\d">([^<]+)</g);
  const lowers = all(html, /class="lr-lower">([^<]+?)(?:<|$)/g);
  const shownLessons = [3, 2, 1, 0].map((k) => `${uppers[k]}/${lowers[k]}`);
  const shownSanchuan = all(html, /class="lr-branch" data-transmission="\d">([^<]+)</g);
  const shownMethod = (html.match(/data-testid="liuren-method">([^<]+)</) ?? [])[1];

  const exp = c.expected as { initial?: string; middle?: string; final?: string };
  const wantSanchuan = [exp.initial, exp.middle, exp.final];
  const checkedPositions = wantSanchuan.map((v) => v !== undefined);
  const lessonsOk = JSON.stringify(shownLessons) === JSON.stringify(c.lessons);
  const sanchuanOk = wantSanchuan.every((v, i) => v === undefined || v === shownSanchuan[i]);
  const methodOk = shownMethod === method;
  const ok = lessonsOk && sanchuanOk && methodOk;
  if (!ok) fail += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${id} ${c.day} 占時${divinationBranch} 月将${monthGeneral}` +
      ` | 四課 ${shownLessons.join(" ")} ${lessonsOk ? "○" : "×"}` +
      ` | 三伝 ${shownSanchuan.join("")}（照合 ${checkedPositions.map((b) => (b ? "有" : "無")).join("")}）${sanchuanOk ? "○" : "×"}` +
      ` | 課体 ${shownMethod} ${methodOk ? "○" : "×"}`,
  );
}

if (fail > 0) {
  console.log(`FAIL: ${fail}`);
  process.exit(1);
}
console.log("ALL PASS");
