// tests/qizheng_ming_degree.manual.ts
//
// 七政四餘：命度の基準統一（src/lib/ming_degree.ts）の確認。
// 実行: npx tsx tests/qizheng_ming_degree.manual.ts
//
// - 通常（命宮方式＝新法）：共通の命度＝ASC 基準の命度（従来の画面表示「命度」と同じ式）
// - 古典（「古典」チェックあり：月将＋時支の命宮）：共通の命度＝calcMingDegreeFromSunLon。チェックなし（初期値）は通常＝ASC
// - 実在の日時で ASC・太陽黄経を計算し、両モードで完全一致（=== で比較）
// - page.tsx の命度は mingDegreeForMode の1か所だけで決まり、表示（命度・命度宿）・大限・限度・流年・年齢選択・印刷が同じ値を使う
// - calcMingDegreeFromSunLon をアプリ側で直接呼ぶのは lib/ming_degree.ts だけ（大限内部で勝手に使わない）

import fs from "fs";
import path from "path";
import { ascMingDegree, mingDegreeForMode } from "../src/lib/ming_degree";
import { calcMingDegreeFromSunLon } from "../src/lib/big_limit";
import { sunLonDeg, ascendantLonDeg_MORIA } from "../src/lib/astro";
import { branchFromLon } from "../src/lib/branch_from_lon";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("NG", msg); } };

// 従来の page.tsx の画面表示命度（修正前の式をそのまま写したもの）
const ORDER = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
const oldDisplayed = (ascLon: number, mingBranch: string) => {
  const i = ORDER.indexOf(mingBranch);
  let x = (ascLon - (i >= 0 ? i * 30 : 0)) % 30;
  return x < 0 ? x + 30 : x;
};

// 実在の日時（東京）で両モードを照合
const start = Date.UTC(1940, 0, 1, 0, 0);
let n = 0;
for (let k = 0; k < 5000; k++) {
  const d = new Date(start + k * 5.37 * 86400000 + (k % 24) * 3600000);
  const sunLon = sunLonDeg(d);
  const ascLon = ascendantLonDeg_MORIA(d, 35.6895, -139.6917); // 画面と同じ ASC（-lon 側を採用）
  for (const mingBranch of [branchFromLon(ascLon), ORDER[k % 12]]) {
    n++;
    const normal = mingDegreeForMode("handen", { ascLon, sunLon, mingBranch });
    const classic = mingDegreeForMode("getsu", { ascLon, sunLon, mingBranch });
    check(normal === oldDisplayed(ascLon, mingBranch) && normal === ascMingDegree(ascLon, mingBranch), `通常：画面表示命度と内部命度が一致 #${k}`);
    check(classic === calcMingDegreeFromSunLon(sunLon), `古典：calcMingDegreeFromSunLon と内部命度が一致 #${k}`);
    check(normal >= 0 && normal < 30 && classic >= 0 && classic < 30, "命度は 0〜30");
  }
}

// page.tsx：命度は1か所で決め、表示・大限・印刷が同じ変数を使う
const page = fs.readFileSync(path.join(__dirname, "../src/app/page.tsx"), "utf8");
check((page.match(/mingDegreeForMode\(/g) ?? []).length === 1, "page.tsx で命度を決めるのは mingDegreeForMode の1か所だけ");
check(/const mingDegree = mingDegreeForMode\(mingMode, \{ ascLon, sunLon, mingBranch \}\)/.test(page), "命宮方式（mingMode）で通常／古典を切り替える");
check(!/calcMingDegreeFromSunLon\(/.test(page), "page.tsx は calcMingDegreeFromSunLon を直接呼ばない");
check(!/\bmingDeg\b/.test(page.replace(/mingDeg: mingDegree/, "")), "旧来の別系統の命度変数（mingDeg）が残っていない");
check(/`\$\{mingBranch\}\$\{mingDegree\.toFixed\(2\)\}°`/.test(page), "画面表示「命度」は mingDegree");
check(/mingMansionOf\(mingBranch, mingDegree\)/.test(page), "命度宿は mingDegree から求める（lib/ming_mansion.ts）");
check(/buildBigLimits\(mingBranch as any, mingDegree\)/.test(page) && /getCurrentBigLimit\(mingBranch as any, mingDegree, targetAge\)/.test(page), "大限（盤面・上部サマリー）は mingDegree");
check(/mingDegree=\{mingDegree\}/.test(page), "ChartSVG（限度・流年・年齢選択）へ mingDegree を渡す");
check(/chart=\{\{ \.\.\.printChart, mingDegree,/.test(page), "解釈印刷へ mingDegree を渡す");

// 「古典」チェックボックス：チェックなし＝通常（handen：ASC）が初期値、チェックあり＝古典（getsu：月将＋時支・calcMingDegreeFromSunLon）
check(/useState<"getsu" \| "handen">\("handen"\)/.test(page), "初期状態（チェックなし）は通常（ASC）");
check(/checked=\{mingMode === "getsu"\}/.test(page), "チェックあり＝古典");
check(/setMingMode\(e\.target\.checked \? "getsu" : "handen"\)/.test(page), "チェックで古典、外すと通常");
check(/mingMode === "handen" \? mingBranchHanden : mingBranchGetsu/.test(page), "通常＝ASC 命宮、古典＝月将＋時支の命宮");
check(/\["命宮方式", mingMode === "handen" \? "通常（ASC＝命度）" : "古典（月将＋時支）"\]/.test(page), "印刷のモード名");

// アプリ側（src/）で calcMingDegreeFromSunLon を呼ぶのは lib/ming_degree.ts だけ
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const callers = walk(path.join(__dirname, "../src")).filter((f) => /calcMingDegreeFromSunLon\(/.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(path.join(__dirname, ".."), f)).sort();
check(JSON.stringify(callers) === JSON.stringify(["src/lib/big_limit.ts", "src/lib/ming_degree.ts"]), `calcMingDegreeFromSunLon の呼び出し元: ${callers.join(", ")}`);
// ChartSVG は命度を自分で計算せず、渡された props.mingDegree だけを使う
const chart = fs.readFileSync(path.join(__dirname, "../src/components/ChartSVG.tsx"), "utf8");
check(!/calcMingDegreeFromSunLon|ascMingDegree|mingDegreeForMode/.test(chart), "ChartSVG は命度を独自に計算しない");

if (fail) { console.log(`FAIL ${fail}`); process.exit(1); }
console.log(`PASS（実在の日時 ${n} 通り）`);
