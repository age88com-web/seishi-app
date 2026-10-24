// tests/lucky_day_analytics.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）の GA4 計測（src/lib/luckyDay/analytics.ts、
//   ユーザー指示 2026-10-20）の検証。
//   1. 初期化スクリプト: config は1回だけ（page_view の二重送信なし）・測定ID・
//      cookie_domain/cookie_flags が fengshui.jp 側と同じ。
//   2. page_location: パスと utm_* 等だけを残し、それ以外のクエリ・ハッシュを除く。
//   3. sendTakujitsuEvent: イベント名だけを送る（パラメータなし）。
//   4. 送信箇所: 4種類のイベントが LuckyDayClient.tsx の決まった操作にだけある。
//   5. 計測範囲: GA4 を読み込むのは /lucky-day のレイアウトだけ。
//
// 実行:
//   npx tsx tests/lucky_day_analytics.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { buildGa4InitScript, GA4_MEASUREMENT_ID, sendTakujitsuEvent } from "../src/lib/luckyDay/analytics";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** 初期化スクリプトを仮の window で実行し、dataLayer に積まれたコマンドを返す。 */
function runInit(href: string): unknown[][] {
  // ブラウザと同じく window をグローバルオブジェクトそのものにする
  const window: Record<string, unknown> = { location: { href }, URL, URLSearchParams, Date };
  window.window = window;
  vm.runInContext(buildGa4InitScript(), vm.createContext(window));
  return (window.dataLayer as ArrayLike<unknown>[]).map((a) => Array.from(a));
}

// ---------------------------------------------------------------------------
// 1. 初期化スクリプト
// ---------------------------------------------------------------------------
const cmds = runInit("https://app.fengshui.jp/lucky-day");
const configs = cmds.filter((c) => c[0] === "config");
check("config は1回だけ", configs.length === 1, JSON.stringify(configs));
check("測定ID", configs[0]?.[1] === "G-QJTBLF194P" && GA4_MEASUREMENT_ID === "G-QJTBLF194P");
const cfg = configs[0]?.[2] as Record<string, unknown> | undefined;
check("cookie_domain は fengshui.jp（本サイトと同じ）", cfg?.cookie_domain === "fengshui.jp");
check("cookie_flags は本サイトと同じ", cfg?.cookie_flags === "samesite=none;secure");
check("send_page_view を無効化していない（config の page_view 1回を使う）", cfg?.send_page_view === undefined);
check("初期化スクリプトで event を送っていない", !cmds.some((c) => c[0] === "event"));
check("set は config より前", cmds.findIndex((c) => c[0] === "set") < cmds.findIndex((c) => c[0] === "config"));

// ---------------------------------------------------------------------------
// 2. page_location
// ---------------------------------------------------------------------------
function pageLocationOf(href: string): unknown {
  const set = runInit(href).find((c) => c[0] === "set");
  return (set?.[1] as Record<string, unknown> | undefined)?.page_location;
}
check("クエリ無し", pageLocationOf("https://app.fengshui.jp/lucky-day") === "https://app.fengshui.jp/lucky-day");
check(
  "個人を識別しうるクエリ・ハッシュを除く",
  pageLocationOf("https://app.fengshui.jp/lucky-day?email=a%40example.com&user_id=12&code=abc&birth=1980-01-01#x") ===
    "https://app.fengshui.jp/lucky-day",
);
check(
  "utm_* と gclid は残す",
  pageLocationOf("https://app.fengshui.jp/lucky-day?utm_source=fengshui&token=zzz&utm_campaign=c1&gclid=g") ===
    "https://app.fengshui.jp/lucky-day?utm_source=fengshui&utm_campaign=c1&gclid=g",
);

// ---------------------------------------------------------------------------
// 3. sendTakujitsuEvent
// ---------------------------------------------------------------------------
const calls: unknown[][] = [];
(globalThis as Record<string, unknown>).window = { gtag: (...a: unknown[]) => calls.push(a), setTimeout };
for (const name of ["takujitsu_app_open", "takujitsu_date_search", "takujitsu_plan_click", "takujitsu_course_click"] as const) {
  calls.length = 0;
  sendTakujitsuEvent(name);
  check(`${name}: イベント名だけを送る`, calls.length === 1 && calls[0].length === 2 && calls[0][0] === "event" && calls[0][1] === name, JSON.stringify(calls));
}
delete (globalThis as Record<string, unknown>).window;

// ---------------------------------------------------------------------------
// 4. 送信箇所（LuckyDayClient.tsx）
// ---------------------------------------------------------------------------
const root = path.resolve(__dirname, "..");
const client = fs.readFileSync(path.join(root, "src/app/lucky-day/LuckyDayClient.tsx"), "utf8");
const countOf = (name: string) => client.split(`sendTakujitsuEvent("${name}")`).length - 1;
check("takujitsu_app_open は1箇所", countOf("takujitsu_app_open") === 1);
check("takujitsu_date_search は1箇所（runSearch）", countOf("takujitsu_date_search") === 1);
check("takujitsu_plan_click は4箇所（プランへのリンク）", countOf("takujitsu_plan_click") === 4);
check("takujitsu_course_click は1箇所（講座案内のリンク）", countOf("takujitsu_course_click") === 1);
const runSearchBody = client.slice(client.indexOf("async function runSearch()"), client.indexOf("const res = await searchDaysAction("));
check("date_search は入力チェック通過後・検索実行の直前", runSearchBody.includes('sendTakujitsuEvent("takujitsu_date_search")') && runSearchBody.lastIndexOf("return;") < runSearchBody.indexOf("takujitsu_date_search"));
check("app_open は送信済みフラグで1回だけ", /if \(appOpenSent\) return;\s*appOpenSent = true;\s*sendTakujitsuEvent\("takujitsu_app_open"\)/.test(client));
const courseLink = client.slice(client.indexOf('className="ld-course-invite-link"'), client.indexOf("擇日入門通信講座の詳細を見る"));
check("course_click は講座リンクの onClick", courseLink.includes('sendTakujitsuEvent("takujitsu_course_click")'));
check("LuckyDayClient で gtag・dataLayer を直接呼んでいない", !/\bgtag\(|dataLayer/.test(client));
check("イベントにパラメータを付けていない", !/sendTakujitsuEvent\("[a-z_]+",/.test(client));

// ---------------------------------------------------------------------------
// 5. 計測範囲（GA4 の読み込みは /lucky-day のレイアウトだけ）
// ---------------------------------------------------------------------------
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}
const loaders = walk(path.join(root, "src"))
  .filter((f) => /googletagmanager\.com\/gtag|\{buildGa4InitScript\(\)\}/.test(fs.readFileSync(f, "utf8")))
  .map((f) => path.relative(root, f));
check("gtag.js を読み込むのは src/app/lucky-day/layout.tsx だけ", loaders.length === 1 && loaders[0] === "src/app/lucky-day/layout.tsx", loaders.join(", "));
const rootLayout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
check("ルートレイアウトに GA4 が無い", !/gtag|G-QJTBLF194P|analytics/.test(rootLayout));

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) process.exit(1);
