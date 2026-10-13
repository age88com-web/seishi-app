// tests/qizheng_print.manual.ts
//
// 七政四餘の解釈印刷（十二宮。ChartSVG interpretationOnly → lib/qizheng_palace_print.ts → components/print/PalacePrint.tsx）の確認。
// 実行: npx tsx tests/qizheng_print.manual.ts
//
// 確認: 12宮が命宮から順にすべてある・画面の宮詳細パネル（zg-palace-panel）・ボタン・折りたたみを使っていない・
// 各宮の先頭に基本情報表・盤全体の格局を宮ごとに出さない・同じ宮の中で同じ文（段落・箇条）を2回出さない・
// 画面の鑑定要約にある「該当する判断」は印刷にも残っている（重複整理で落としていない）。

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculate } from "../src/lib/calendar";
import { sevenPlanetsLonDeg, lunarNodesMeanLonDeg, lunarPerigeeLonDeg, ziQiLonDeg } from "../src/lib/astro";
import { monthGeneralFromSunLon, calcMingPalace, calcShenPalace_v2 } from "../src/lib/ming_shen";
import * as BigLimit from "../src/lib/big_limit";
import { calcJuniun } from "../src/lib/juniun";
import ChartSVG from "../src/components/ChartSVG";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
}
const ORDER = ["命宮", "相貌宮", "福徳宮", "官禄宮", "遷移宮", "疾厄宮", "夫妻宮", "奴僕宮", "男女宮", "田宅宮", "兄弟宮", "財帛宮"];
const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();

const cases: [string, string, "男" | "女"][] = [];
for (let y = 1935; y <= 2015; y += 8) cases.push([`${y}-0${(y % 9) + 1}-1${y % 9}`, `${String(y % 24).padStart(2, "0")}:2${y % 6}`, y % 2 ? "男" : "女"]);

for (const [ds, ts, sex] of cases) {
  const d = new Date(`${ds}T${ts}`);
  const cal = calculate({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() });
  const b = sevenPlanetsLonDeg(d) as { id: string; label: string; lonDeg: number }[];
  const n = lunarNodesMeanLonDeg(d);
  b.push({ id: "rahu", label: "羅喉", lonDeg: n.rahu }, { id: "ketu", label: "計都", lonDeg: n.ketu });
  b.push({ id: "yuebo", label: "月孛", lonDeg: ((lunarPerigeeLonDeg(d) + 180) % 360 + 360) % 360 }, { id: "ziqi", label: "紫炁", lonDeg: ziQiLonDeg(d) });
  const sun = b.find((x) => x.id === "sun")!.lonDeg, moon = b.find((x) => x.id === "moon")!.lonDeg;
  const ming = calcMingPalace(monthGeneralFromSunLon(sun), cal.hourBranch);
  const shen = calcShenPalace_v2(monthGeneralFromSunLon(moon), cal.hourBranch);
  const md = BigLimit.calcMingDegreeFromSunLon(sun);
  const html = renderToStaticMarkup(createElement(ChartSVG as never, {
    sex, yearStem: cal.yearStem, yearBranch: cal.yearBranch, monthBranch: cal.monthBranch, bodies: b.map((x) => ({ ...x, motion: "+" })),
    mingBranch: ming, shenBranch: shen, bigLimits: BigLimit.buildBigLimits(ming as never, md), juniunMap: calcJuniun(cal.yearStem + cal.yearBranch),
    mingDegree: md, targetAge: 40, isDayBirth: true, kakkyoku: { good: ["土星升殿"], bad: ["土水相激"] }, interpretationOnly: true,
  } as never));
  const tag = `${ds} ${ts}`;
  const palaces = html.split('<section class="pp-palace').slice(1);
  check(`${tag} 12宮`, palaces.length === 12, String(palaces.length));
  check(`${tag} 命宮から順`, palaces.map((p) => /pp-title">([^<]+)</.exec(p)?.[1]).join() === ORDER.join());
  check(`${tag} 画面パネル・ボタンを使わない`, !/zg-palace-panel|<button|▼|▶/.test(html));
  check(`${tag} 宮ごとに格局を出さない`, !/盤全体で成立している|格局の判断原則|【土星升殿】/.test(html));
  for (const p of palaces) {
    const name = /pp-title">([^<]+)</.exec(p)?.[1] ?? "?";
    check(`${tag} ${name} 先頭に基本情報表`, /^[^]*?<\/h2><table class="pp-table">/.test(p) && p.includes("<th>宮名</th>") && p.includes("<th>宮位置</th>"));
    const units = [...p.matchAll(/<p class="pp-text">([^]*?)<\/p>|<li>([^]*?)<\/li>/g)].map((m) => strip(m[1] ?? m[2] ?? "")).filter(Boolean);
    const dup = units.filter((u, i) => units.indexOf(u) !== i);
    check(`${tag} ${name} 同じ文を2回出さない`, dup.length === 0, dup[0]?.slice(0, 40));
    check(`${tag} ${name} 節の順（要約→宮→星→補足）`, (() => {
      const idx = ["鑑定要約", "宮の解釈", "星の解釈", "変曜・神殺・補足"].map((t) => p.indexOf(`pp-h3">${t}<`)).filter((i) => i >= 0);
      return idx.every((v, i) => i === 0 || v > idx[i - 1]);
    })());
  }
}

const fail = failures.length;
console.log(`七政四餘 解釈印刷: ${pass} / ${pass + fail} PASS`);
if (fail) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
