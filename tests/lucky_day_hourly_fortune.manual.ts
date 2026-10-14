// tests/lucky_day_hourly_fortune.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）の有料会員向け「時間の吉凶」
//   （src/lib/luckyDay/hourlyFortune.ts、ユーザー指示 2026-10-14）の検証。
//
//   1. 会員権限: 未ログイン・無料会員では計算されない（null）、
//      月額（ID 2）・年額（ID 3）・講座会員（ID 4・5）では今日・未来日とも
//      12時辰が返る（既存の member.active による有料判定のまま）。
//   2. 12時辰すべて・表示順・時間帯の文字列。
//   3. 月間行動予定（buildMonthlySchedule()、専門版と同じ既存関数）の
//      時間記号と、2026年の全日で一致する（60日干支すべてを含む）。
//   4. 720マス全体の記号分布が docs/monthly-action-schedule-engine-mapping.md
//      §9.2 の記録（◎163・○258・△117・▽99・▼23・勿用60）と一致する。
//      勿用は一般向け表示だけ「勿用／使用を避ける時間」（人間側決定 2026-10-14）。
//      月間行動予定側は「用いてもよい」のまま変わっていないことも確認する。
//   5. 日付境界: 日付Dの「23:00〜1:00」はDの日干支（前日23:00からDの子時）。
//   6. 返す内容に神殺名・件数を含めない。
//   7. 開発用オーバーライドは NODE_ENV==="production" では無効。
//
// 実行（member.ts が "server-only" を import するため react-server 条件が必要）:
//   npx tsx --conditions=react-server tests/lucky_day_hourly_fortune.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

import {
  buildLuckyDayHourlyFortune,
  computeHourlyFortuneForDay,
  LUCKY_DAY_HOUR_SLOTS,
} from "../src/lib/luckyDay/hourlyFortune";
import { isPaidLevelId, isDevPaidMemberOverrideEnabled } from "../src/lib/luckyDay/auth/member";
import { buildMonthlySchedule } from "../src/lib/takujitsu/monthly";
import { calculate as calculateCalendar } from "../src/lib/calendar";
import { getTodayInTokyo } from "../src/lib/luckyDay/today";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function ganzhiAt(year: number, month: number, day: number, hour: number, minute = 0): string {
  const c = calculateCalendar({ year, month, day, hour, minute, timezone: "Asia/Tokyo" });
  return c.dayStem + c.dayBranch;
}

/** getDayDetailAction() と同じく、その日の12:00基準の日干支。 */
function dayGanzhiOfIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return ganzhiAt(y, m, d, 12);
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 1. 会員権限
//    getDayDetailAction() は computeHourlyFortuneForDay(member.active, …) を
//    呼ぶ。member.active は getCurrentTakujitsuMember() で
//    「WordPressの active && isPaidLevelId(level_id)」のときだけ true。
// ---------------------------------------------------------------------------
const todayIso = getTodayInTokyo().iso;
const futureIso = addDaysIso(todayIso, 45);

function memberActive(wp: { active: boolean; levelId: number | null } | null): boolean {
  // null＝未ログイン（セッションなし。getCurrentTakujitsuMember は WordPress を呼ばず active:false）
  if (!wp) return false;
  return wp.active && isPaidLevelId(wp.levelId);
}

const cases: { label: string; wp: { active: boolean; levelId: number | null } | null; expectPaid: boolean }[] = [
  { label: "未ログイン", wp: null, expectPaid: false },
  { label: "無料会員（active:false, level_id:null）", wp: { active: false, levelId: null }, expectPaid: false },
  { label: "期限切れ（active:false, level_id:2）", wp: { active: false, levelId: 2 }, expectPaid: false },
  { label: "対象外レベル（active:true, level_id:1）", wp: { active: true, levelId: 1 }, expectPaid: false },
  { label: "月額会員（ID 2）", wp: { active: true, levelId: 2 }, expectPaid: true },
  { label: "年額会員（ID 3）", wp: { active: true, levelId: 3 }, expectPaid: true },
  // 講座会員も既存の member.active どおり利用可（人間側決定、2026-10-14）。
  { label: "講座会員 通常版（ID 4）", wp: { active: true, levelId: 4 }, expectPaid: true },
  { label: "講座会員 DVD版（ID 5）", wp: { active: true, levelId: 5 }, expectPaid: true },
  { label: "講座会員 期限切れ（active:false, level_id:4）", wp: { active: false, levelId: 4 }, expectPaid: false },
];

for (const c of cases) {
  const active = memberActive(c.wp);
  for (const [dayLabel, iso] of [
    ["今日", todayIso],
    ["未来日", futureIso],
  ] as const) {
    const hours = computeHourlyFortuneForDay(active, dayGanzhiOfIso(iso));
    if (c.expectPaid) {
      check(`${c.label}: ${dayLabel}（${iso}）の時間の吉凶を取得できる`, Array.isArray(hours) && hours.length === 12);
    } else {
      check(`${c.label}: ${dayLabel}（${iso}）の時間の吉凶は取得できない（null）`, hours === null);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. 12時辰・表示順・時間帯
// ---------------------------------------------------------------------------
const EXPECTED_RANGES = [
  "23:00〜1:00", "1:00〜3:00", "3:00〜5:00", "5:00〜7:00", "7:00〜9:00", "9:00〜11:00",
  "11:00〜13:00", "13:00〜15:00", "15:00〜17:00", "17:00〜19:00", "19:00〜21:00", "21:00〜23:00",
];
const EXPECTED_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const sample = buildLuckyDayHourlyFortune(dayGanzhiOfIso(todayIso));
check("12時辰すべてを返す", sample.length === 12);
check("時間帯の文字列と順序", JSON.stringify(sample.map((h) => h.range)) === JSON.stringify(EXPECTED_RANGES));
check("時支の順序（子〜亥）", JSON.stringify(sample.map((h) => h.hourBranch)) === JSON.stringify(EXPECTED_BRANCHES));
check("LUCKY_DAY_HOUR_SLOTS も12件", LUCKY_DAY_HOUR_SLOTS.length === 12);
check(
  "すべての時辰に記号と説明がある",
  sample.every((h) => typeof h.symbol === "string" && h.symbol.length > 0 && h.description.length > 0),
);

// ---------------------------------------------------------------------------
// 3. 月間行動予定（専門版と同じ既存関数）との一致（2026年の全日）
// ---------------------------------------------------------------------------
let comparedDays = 0;
let mismatches = 0;
const ganzhiSeen = new Set<string>();
for (let month = 1; month <= 12; month++) {
  const schedule = buildMonthlySchedule(2026, month);
  for (const week of schedule.weeks) {
    for (const day of week) {
      if (!day.inTargetMonth) continue;
      comparedDays++;
      ganzhiSeen.add(day.dayGanzhi);
      const mine = buildLuckyDayHourlyFortune(day.dayGanzhi);
      // 月間行動予定の1〜12行目（13行目は翌日の子時なので対象外）。
      for (let i = 0; i < 12; i++) {
        const m = day.hours[i];
        // 勿用マスは月間行動予定「用いてもよい」⇔ /lucky-day「勿用」（表示文言だけの読み替え）。
        const expected = m.symbol === "用いてもよい" ? "勿用" : m.symbol;
        if (m.hourBranch !== mine[i].hourBranch || expected !== mine[i].symbol || m.dayGanzhi !== day.dayGanzhi) {
          mismatches++;
          if (mismatches <= 5) {
            console.log(`  不一致 ${day.iso} ${m.hourBranch}: 月間=${m.symbol} / lucky-day=${mine[i].symbol}`);
          }
        }
      }
    }
  }
}
check("2026年の全365日を比較した", comparedDays === 365, `compared=${comparedDays}`);
check("比較した日に60日干支すべてが含まれる", ganzhiSeen.size === 60, `seen=${ganzhiSeen.size}`);
check("月間行動予定の時間記号と全時辰で一致する", mismatches === 0, `mismatches=${mismatches}`);

// ---------------------------------------------------------------------------
// 4. 720マス全体の記号分布（§9.2 の記録と一致）
// ---------------------------------------------------------------------------
const dist: Record<string, number> = {};
for (const gz of ganzhiSeen) {
  for (const h of buildLuckyDayHourlyFortune(gz)) dist[h.symbol] = (dist[h.symbol] ?? 0) + 1;
}
const EXPECTED_DIST: Record<string, number> = { "◎": 163, "○": 258, "△": 117, "▽": 99, "▼": 23, "勿用": 60 };
check(
  "720マスの記号分布が §9.2 の記録と一致",
  JSON.stringify(Object.keys(EXPECTED_DIST).map((k) => dist[k] ?? 0)) ===
    JSON.stringify(Object.values(EXPECTED_DIST)),
  JSON.stringify(dist),
);
check("勿用マスは新しい吉凶に変換せず「勿用」と表示（60マス）", dist["勿用"] === 60);
check("「用いてもよい」は一般向けには出さない", dist["用いてもよい"] === undefined);
{
  const muyo = [...ganzhiSeen].flatMap((gz) => buildLuckyDayHourlyFortune(gz)).filter((h) => h.symbol === "勿用");
  check("勿用の説明はすべて「使用を避ける時間」", muyo.length === 60 && muyo.every((h) => h.description === "使用を避ける時間"));
  check(
    "説明文に「用いてもよい」を含めない",
    [...ganzhiSeen].flatMap((gz) => buildLuckyDayHourlyFortune(gz)).every((h) => !h.description.includes("用いてもよい")),
  );
  const monthlyMuyo = buildMonthlySchedule(2026, 1).weeks.flat().flatMap((d) => d.hours).filter((h) => h.isMuyo);
  check(
    "月間行動予定の勿用マスは従来どおり「用いてもよい」（専門版側は変更なし）",
    monthlyMuyo.length > 0 && monthlyMuyo.every((h) => h.symbol === "用いてもよい"),
  );
}

// ---------------------------------------------------------------------------
// 5. 日付境界（子初23:00で日干支が切り替わる）
// ---------------------------------------------------------------------------
for (const iso of ["2026-01-01", "2026-02-28", "2026-03-01", "2026-12-31", todayIso]) {
  const [y, m, d] = iso.split("-").map(Number);
  const prev = addDaysIso(iso, -1).split("-").map(Number);
  const dGz = dayGanzhiOfIso(iso);
  const prev2330 = ganzhiAt(prev[0], prev[1], prev[2], 23, 30);
  const prev2230 = ganzhiAt(prev[0], prev[1], prev[2], 22, 30);
  const d0030 = ganzhiAt(y, m, d, 0, 30);
  check(`${iso}: 前日23:30はDの日干支（Dの子時に入る）`, prev2330 === dGz, `${prev2330} vs ${dGz}`);
  check(`${iso}: D当日0:30もDの日干支`, d0030 === dGz);
  check(`${iso}: 前日22:30は前日の日干支（境界は23:00）`, prev2230 !== dGz);
  const sub = buildLuckyDayHourlyFortune(dGz)[0];
  const monthly = buildMonthlySchedule(y, m).weeks.flat().find((x) => x.iso === iso)!;
  check(`${iso}: 23:00〜1:00 は月間行動予定の1行目（当日の子時）と同じ`, sub.symbol === monthly.hours[0].symbol);
}

// ---------------------------------------------------------------------------
// 6. 神殺名・件数をクライアントへ渡さない
// ---------------------------------------------------------------------------
check(
  "返す項目は range・hourBranch・symbol・description だけ",
  sample.every((h) => JSON.stringify(Object.keys(h).sort()) === JSON.stringify(["description", "hourBranch", "range", "symbol"])),
);

// ---------------------------------------------------------------------------
// 7. 開発用オーバーライド（本番では無効）
// ---------------------------------------------------------------------------
const env = process.env as Record<string, string | undefined>;
const savedNodeEnv = env.NODE_ENV;
const savedOverride = env.TAKUJITSU_DEV_PAID_MEMBER;
try {
  env.TAKUJITSU_DEV_PAID_MEMBER = "true";
  env.NODE_ENV = "production";
  check("NODE_ENV=production では TAKUJITSU_DEV_PAID_MEMBER=true でも無効", isDevPaidMemberOverrideEnabled() === false);
  env.NODE_ENV = "development";
  check("NODE_ENV=development かつ true のときだけ有効", isDevPaidMemberOverrideEnabled() === true);
} finally {
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
  if (savedOverride === undefined) delete env.TAKUJITSU_DEV_PAID_MEMBER;
  else env.TAKUJITSU_DEV_PAID_MEMBER = savedOverride;
}

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) process.exit(1);
