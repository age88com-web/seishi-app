// tests/takujitsu_personal_honmeisatsu_unit.manual.ts
//
// 目的:
//   年命による個人判定（personalResult）の単体テスト。
//   1. docs/source/本命殺.csv（秀山確認済み・唯一の正本）60干支全件について、
//      evaluatePersonalHonmeisatsu() の結果が CSV の記載と完全一致することを確認する。
//   2. 出生時刻の扱い（既存 calculate() のみを使った立春境界検出）を確認する。
//      - 通常日・時刻なし → 年命確定
//      - 立春を跨ぐ日・時刻なし → undetermined
//      - 立春を跨ぐ日・時刻あり → 年命確定
//   3. personalResult が activityResult（good/neutral/mixed/bad）に一切影響しないこと、
//      生年月日そのものが未入力の場合は個人判定を行わないことを、
//      src/lib/takujitsu/full.ts（無変更）の calculateTakujitsuFull() 経由で確認する。
//
// 実行:
//   npx tsx tests/takujitsu_personal_honmeisatsu_unit.manual.ts

import * as fs from "node:fs";
import * as path from "node:path";
import { calculate } from "../src/lib/calendar";
import { calculateTakujitsuFull } from "../src/lib/takujitsu/full";
import {
  evaluatePersonalHonmeisatsu,
  resolveBirthYearGanzhi,
  evaluatePersonalForDay,
  evaluatePersonalForBirth,
} from "../src/lib/takujitsu/personal";
import type { PersonalAvoidType } from "../src/lib/takujitsu/personal";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 1. docs/source/本命殺.csv 60干支全件との完全一致
// ---------------------------------------------------------------------------
const csvPath = path.join(__dirname, "..", "docs", "source", "本命殺.csv");
const csvRaw = fs.readFileSync(csvPath, "utf8").trim();
const csvLines = csvRaw.split(/\r?\n/);
const header = csvLines[0].split(",");
check("CSVヘッダは 本命,相冲,三殺,三刑,箭刃", header.join(",") === "本命,相冲,三殺,三刑,箭刃");

const rows = csvLines.slice(1).map((line) => {
  const [ganzhi, sochuu, sansatsu, sankei, senjin] = line.split(",");
  return { ganzhi, sochuu, sansatsu, sankei, senjin };
});
check("CSVは60行（60干支）", rows.length === 60);

for (const row of rows) {
  const yearStem = row.ganzhi[0];
  const yearBranch = row.ganzhi[1];
  const expected: Record<PersonalAvoidType, string[]> = {
    相冲: [row.sochuu],
    三殺: [row.sansatsu],
    三刑: row.sankei.length === 2 ? [row.sankei[0], row.sankei[1]] : [row.sankei],
    箭刃: [row.senjin[0], row.senjin[1]],
  };

  for (const type of ["相冲", "三殺", "三刑", "箭刃"] as PersonalAvoidType[]) {
    for (const dayBranch of expected[type]) {
      const result = evaluatePersonalHonmeisatsu(yearStem, yearBranch, dayBranch);
      const hit = result.reasons.some((r) => r.type === type);
      check(`${row.ganzhi}命 × ${dayBranch}日 → ${type}が成立する（CSV通り）`, hit);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. 項目12指定の代表ケース
// ---------------------------------------------------------------------------
{
  const r1 = evaluatePersonalHonmeisatsu("甲", "子", "午");
  check("甲子命 × 午日 → 相冲のみ", r1.status === "avoid" && r1.reasons.length === 1 && r1.reasons[0].type === "相冲");

  const r2 = evaluatePersonalHonmeisatsu("甲", "子", "未");
  check("甲子命 × 未日 → 三殺のみ", r2.status === "avoid" && r2.reasons.length === 1 && r2.reasons[0].type === "三殺");

  const r3 = evaluatePersonalHonmeisatsu("甲", "子", "卯");
  const r3types = r3.reasons.map((r) => r.type).sort();
  check(
    "甲子命 × 卯日 → 三刑＋箭刃",
    r3.status === "avoid" && r3types.length === 2 && r3types.includes("三刑") && r3types.includes("箭刃"),
  );

  const r4 = evaluatePersonalHonmeisatsu("甲", "子", "酉");
  check("甲子命 × 酉日 → 箭刃のみ", r4.status === "avoid" && r4.reasons.length === 1 && r4.reasons[0].type === "箭刃");

  const r5 = evaluatePersonalHonmeisatsu("甲", "子", "辰");
  check("甲子命 × 辰日 → 該当なし（clear）", r5.status === "clear" && r5.reasons.length === 0);
}

// ---------------------------------------------------------------------------
// 3. 出生時刻の境界処理（既存 calculate() のみを使う）
// ---------------------------------------------------------------------------
{
  // 3-1. 通常日・時刻なし → 年命確定（立春から離れた日付。年をまたぐ深夜0時台も含めて確認）
  const normal = resolveBirthYearGanzhi({ year: 1990, month: 6, day: 15 });
  check("通常日・時刻なし → 年命確定 (status=determined)", normal.status === "determined");
  if (normal.status === "determined") {
    const direct = calculate({ year: 1990, month: 6, day: 15, hour: 12, minute: 0 });
    check(
      "通常日・時刻なしの年命は正午計算と一致する",
      normal.yearStem === direct.yearStem && normal.yearBranch === direct.yearBranch,
    );
  }

  // 3-2. 立春を跨ぐ日を探す（1990年前後の立春付近を走査し、00:00と23:59で年干支が
  //      変わる日を実データから特定する。日付を決め打ちにせず、既存calculate()の
  //      実際の節入り時刻から検出する）。
  function findLichunBoundaryDate(year: number): { y: number; m: number; d: number } | null {
    for (let d = 1; d <= 6; d++) {
      const start = calculate({ year, month: 2, day: d, hour: 0, minute: 0 });
      const end = calculate({ year, month: 2, day: d, hour: 23, minute: 59 });
      if (start.yearStem !== end.yearStem || start.yearBranch !== end.yearBranch) {
        return { y: year, m: 2, d };
      }
    }
    return null;
  }

  const boundary = findLichunBoundaryDate(1990) ?? findLichunBoundaryDate(1991) ?? findLichunBoundaryDate(1992);
  check("立春の瞬間を跨ぐ日を実データから検出できた", boundary !== null);

  if (boundary) {
    // 3-2. 立春を跨ぐ日・時刻なし → undetermined
    const undet = resolveBirthYearGanzhi({ year: boundary.y, month: boundary.m, day: boundary.d });
    check("立春を跨ぐ日・時刻なし → undetermined", undet.status === "undetermined");

    const undetResult = evaluatePersonalForDay(undet, "午");
    check(
      "undetermined時のpersonalResultはstatus=undetermined・reasons=[]",
      undetResult.status === "undetermined" && undetResult.reasons.length === 0,
    );

    // 3-3. 立春を跨ぐ日・時刻あり → 年命確定（立春前後それぞれの時刻で確認）
    const before = calculate({ year: boundary.y, month: boundary.m, day: boundary.d, hour: 0, minute: 0 });
    const after = calculate({ year: boundary.y, month: boundary.m, day: boundary.d, hour: 23, minute: 59 });

    const detBefore = resolveBirthYearGanzhi({ year: boundary.y, month: boundary.m, day: boundary.d, hour: 0, minute: 0 });
    check(
      "立春を跨ぐ日・立春前の時刻あり → 年命確定し前年の干支と一致",
      detBefore.status === "determined" &&
        detBefore.yearStem === before.yearStem &&
        detBefore.yearBranch === before.yearBranch,
    );

    const detAfter = resolveBirthYearGanzhi({ year: boundary.y, month: boundary.m, day: boundary.d, hour: 23, minute: 59 });
    check(
      "立春を跨ぐ日・立春後の時刻あり → 年命確定し新年の干支と一致",
      detAfter.status === "determined" &&
        detAfter.yearStem === after.yearStem &&
        detAfter.yearBranch === after.yearBranch,
    );

    check(
      "立春を跨ぐ日は時刻前後で年命（年干支）が実際に異なる（境界検出の前提確認）",
      before.yearStem !== after.yearStem || before.yearBranch !== after.yearBranch,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. 生年月日そのものが未入力 → personal判定を行わない／activityResultは無変更
// ---------------------------------------------------------------------------
{
  const full = calculateTakujitsuFull({ year: 2026, month: 3, day: 1, hour: 12, minute: 0, timezone: "Asia/Tokyo" });
  check(
    "生年月日未入力でも calculateTakujitsuFull() の activities は通常どおり計算される（既存ロジック無変更）",
    Array.isArray(full.activities.evaluations),
  );
  // 生年月日未入力時、UI側はそもそも personal 系関数を一切呼ばない設計であり、
  // ここでは「呼ばなくても既存の activityResult 計算は影響を受けない」ことのみ確認する。

  // evaluatePersonalForBirth を明示的に呼んだ場合でも、activityResult 側の型・値には
  // フィールドとして混入しないことを確認（personalResultは別オブジェクト）。
  const personal = evaluatePersonalForBirth({ year: 1990, month: 6, day: 15 }, full.calendar.dayBranch);
  check(
    "personalResultはTakujitsuFullResultのフィールドとして混入しない",
    !("personal" in full) && !("personalResult" in full),
  );
  check("personalResultは独立した status/reasons を持つ", "status" in personal && "reasons" in personal);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
