// tests/shichusuimei_phase1.manual.ts
//
// 四柱推命 Phase 1 基礎計算エンジン（src/lib/shichusuimei/）の fixture 照合テスト。
// 実行: npx tsx tests/shichusuimei_phase1.manual.ts
//
// 照合方針:
//   docs/shichusuimei-fixtures-candidate.json のうち needs_review: false のものだけを正解として使う。
//   needs_review: true は読み込まない（D4・D21・D26）。
//   出生地が都道府県名・不明の国内例は、fixture の d7.placeDiffMin（講座 p22 の範囲）の
//   すべての整数分で講座の時柱と一致することを確認する（地名→p22 地点の対応は推測しない）。
//   オーストラリア出生（p37）は東部・中部・西部の3つの標準時で確認する（代表地点の経度は概略値）。
//   あわせて、src/lib/shichusuimei/data.ts の表が仕様書の転記（p22・p23・p114・神煞表）と一致するかを確認する。

import { readFileSync } from "node:fs";
import fixture from "../docs/shichusuimei-fixtures-candidate.json";
import {
  calculateMeishiki,
  calculateShichusuimei,
  daiunDirection,
  daiunPillars,
  goshinOfElement,
  judgeShinsatsu,
  tsuhenOf,
  zokanOf,
} from "../src/lib/shichusuimei";
import type {
  BirthDateTime,
  BirthPlace,
  Branch,
  Element,
  GoshinName,
  Pillar,
  Sex,
  ShinsatsuHit,
  Stem,
} from "../src/lib/shichusuimei";
import * as data from "../src/lib/shichusuimei/data";

// ---------------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------------

interface Failure {
  category: string;
  id: string;
  expected: unknown;
  actual: unknown;
  spec: string;
}
const counts = new Map<string, { pass: number; fail: number }>();
const failures: Failure[] = [];

function record(category: string, id: string, ok: boolean, expected: unknown, actual: unknown, spec: string) {
  const c = counts.get(category) ?? { pass: 0, fail: 0 };
  if (ok) c.pass += 1;
  else {
    c.fail += 1;
    failures.push({ category, id, expected, actual, spec });
  }
  counts.set(category, c);
}

function safe<T extends { needs_review?: boolean }>(xs: readonly T[]): T[] {
  return xs.filter((x) => x.needs_review === false);
}

// ---------------------------------------------------------------------------
// 入力の組み立て
// ---------------------------------------------------------------------------

const toPillar = (s: string): Pillar => ({ stem: s[0] as Stem, branch: s[1] as Branch });
const fmt = (p: Pillar | null) => (p ? `${p.stem}${p.branch}` : null);

function parseBirth(s: string | null): BirthDateTime {
  if (s === null) throw new Error("birth is missing");
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!m) throw new Error(`bad birth ${s}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] === undefined ? null : Number(m[4]),
    minute: m[5] === undefined ? 0 : Number(m[5]),
  };
}

const JAPAN: BirthPlace = { timeZone: "Asia/Tokyo" };

/** p37「オーストラリア」: 西部・中部・東部の標準時（代表地点の経度は概略値） */
const AUSTRALIA: { label: string; place: BirthPlace }[] = [
  { label: "Perth", place: { timeZone: "Australia/Perth", standardOffsetMinutes: 480, longitude: 115.86 } },
  { label: "Adelaide", place: { timeZone: "Australia/Adelaide", standardOffsetMinutes: 570, longitude: 138.6 } },
  { label: "Sydney", place: { timeZone: "Australia/Sydney", standardOffsetMinutes: 600, longitude: 151.21 } },
];

/** p43「イギリス」: 標準時 GMT（夏時間は IANA の履歴で戻す）。立運・年月柱には地域時差を使わない */
const UK: BirthPlace = { timeZone: "Europe/London", standardOffsetMinutes: 0, regionalDiffMinutes: 0 };

/** 年柱・月柱・立運だけを見る照合用の出生地（地方真太陽時は結果に影響しない） */
function placeForCalendarOnly(place: string | null): { label: string; place: BirthPlace }[] {
  if (place?.startsWith("オーストラリア")) return AUSTRALIA;
  if (place === "イギリス") return [{ label: "UK", place: UK }];
  return [{ label: "JP", place: { ...JAPAN, regionalDiffMinutes: 0 } }];
}

// ---------------------------------------------------------------------------
// 0. データ転記照合（data.ts ⇔ 仕様書の JSON ブロック）
// ---------------------------------------------------------------------------

function specJsonBlocks(): unknown[] {
  const md = readFileSync(new URL("../docs/shichusuimei-basic-spec.md", import.meta.url), "utf8");
  // matchedBy の説明用ブロック（JSON 行の列挙）など、単一の JSON でないブロックは読み飛ばす
  return [...md.matchAll(/```json\n([\s\S]*?)\n```/g)].flatMap((m) => {
    try {
      return [JSON.parse(m[1])];
    } catch {
      return [];
    }
  });
}

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

{
  const blocks = specJsonBlocks() as Record<string, unknown>[];
  const p22 = blocks.find((b) => String(b.source).startsWith("p22"))!;
  const p23 = blocks.find((b) => String(b.source).startsWith("p23"))!;
  const p114 = blocks.find((b) => b.source === "p114")!;
  const shinsatsu = blocks.find((b) => Array.isArray(b)) as unknown as {
    id: string;
    table: unknown;
  }[];

  record("データ転記", "p22", eq(p22.data, data.P22_REGIONAL_DIFF_AS_PRINTED), p22.data, data.P22_REGIONAL_DIFF_AS_PRINTED, "D7・D15");
  const p23Actual = Object.fromEntries(Object.entries(data.P23_EQUATION_OF_TIME).map(([k, v]) => [k, v]));
  record("データ転記", "p23", eq(p23.byMonth, p23Actual), p23.byMonth, p23Actual, "D9・D28");
  const zokanActual = Object.fromEntries(Object.entries(data.ZOKAN).map(([k, v]) => [k, v.stems]));
  record("データ転記", "p114", eq(p114.zokan, zokanActual), p114.zokan, zokanActual, "D18");

  const tentokuTable: Record<string, string> = { ...data.TENTOKU };
  const tenraTable = Object.fromEntries(data.TENRA_CHIMO);
  const actualTables: Record<string, unknown> = {
    kijin: data.KIJIN,
    tentoku: tentokuTable,
    gettoku: data.GETTOKU,
    ekiba: data.EKIBA,
    toka: data.TOKA,
    bunsho: data.BUNSHO,
    kagai: data.KAGAI,
    koshin_kashuku: data.KOSHIN_KASHUKU,
    roku: data.ROKU,
    yojin: data.YOJIN,
    tenra_chimo: tenraTable,
    kaiko: data.KAIKO,
    bojin: data.BOJIN,
    sansatsu: data.SANSATSU_DIRECTION_ONLY.table,
  };
  for (const s of shinsatsu) {
    const actual = actualTables[s.id];
    const sortKeys = (o: unknown) =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.fromEntries(Object.entries(o as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
        : o;
    record("データ転記", `神煞表 ${s.id}`, eq(sortKeys(s.table), sortKeys(actual)), s.table, actual, "D1・D5");
  }
}

// ---------------------------------------------------------------------------
// 1. 命式（meishiki）
// ---------------------------------------------------------------------------

for (const f of safe(fixture.meishiki)) {
  const birth = parseBirth(f.input.birth);
  const expected = f.expected.pillars;
  const cases: { label: string; place: BirthPlace }[] = [];
  if (birth.hour === null) {
    cases.push({ label: "時刻不明", place: JAPAN });
  } else if (f.input.place?.startsWith("オーストラリア")) {
    cases.push(...AUSTRALIA);
  } else {
    const [lo, hi] = (f as { d7: { placeDiffMin: number[] } }).d7.placeDiffMin;
    for (let d = lo; d <= hi; d += 1) cases.push({ label: `地域時差${d}分`, place: { ...JAPAN, regionalDiffMinutes: d } });
  }
  const mismatches: string[] = [];
  let actualSample: unknown = null;
  for (const c of cases) {
    const m = calculateMeishiki(birth, c.place);
    const actual = { 時: fmt(m.pillars.時), 日: fmt(m.pillars.日), 月: fmt(m.pillars.月), 年: fmt(m.pillars.年) };
    actualSample ??= actual;
    if (!eq(actual, expected)) {
      mismatches.push(`${c.label}: ${JSON.stringify(actual)}（補正後 ${m.timeCorrection?.localApparentSolarTime ?? "-"}）`);
    }
  }
  record(
    "命式",
    `${f.id} ${f.name}（${cases.length}通り）`,
    mismatches.length === 0,
    expected,
    mismatches.length ? mismatches : actualSample,
    "D3・D7・D8・D10・D29",
  );
}

// ---------------------------------------------------------------------------
// 2. 節入り境界（年柱・月柱）
// ---------------------------------------------------------------------------

for (const f of safe(fixture.setsuiriBoundary)) {
  const birth = parseBirth(f.input.birth);
  for (const c of placeForCalendarOnly(f.input.place)) {
    const m = calculateMeishiki(birth, c.place);
    const actual = { yearPillar: fmt(m.pillars.年), monthPillar: fmt(m.pillars.月) };
    record("節入り境界", `${f.id} ${f.name} [${c.label}]`, eq(actual, f.expected), f.expected, actual, "D10・D13");
  }
}

// ---------------------------------------------------------------------------
// 3. 大運の並び（順逆・干支）
// ---------------------------------------------------------------------------

for (const f of safe(fixture.daiun.sequence)) {
  const direction = daiunDirection(f.input.yearStem as Stem, f.input.sex as Sex);
  const luck = daiunPillars(toPillar(f.input.monthPillar), direction, f.expected.luck.length).map(fmt);
  const actual = { direction, luck };
  record("大運の並び", `${f.id} ${f.name}`, eq(actual, f.expected), f.expected, actual, "p28");
}

// ---------------------------------------------------------------------------
// 4. 立運年齢
// ---------------------------------------------------------------------------

for (const f of safe(fixture.daiun.startAge)) {
  const birth = parseBirth(f.input.birth);
  for (const c of placeForCalendarOnly(f.input.place)) {
    const r = calculateShichusuimei({ birth, place: c.place, sex: f.input.sex as Sex });
    const actual = { startAge: r.daiun.startAge };
    record(
      "立運年齢",
      `${f.id} ${f.name} [${c.label}]`,
      eq(actual, f.expected) && fmt(r.meishiki.pillars.年)![0] === f.input.yearStem,
      f.expected,
      { ...actual, days: r.daiun.days, jie: r.daiun.jie, yearStem: r.meishiki.pillars.年.stem },
      "D11・D12・D17・D26・D27",
    );
  }
}

// ---------------------------------------------------------------------------
// 5. 蔵干
// ---------------------------------------------------------------------------

for (const f of safe(fixture.zokan)) {
  if (f.kind === "table") {
    const input = f.input as { branch: Branch };
    const e = zokanOf(input.branch);
    const actual = { zokan: e.stems, roles: e.roles };
    record("蔵干", f.id, eq(actual, f.expected), f.expected, actual, "D18");
  } else {
    const input = f.input as { branches: Record<string, Branch> };
    const actual = { zokan: Object.fromEntries(Object.entries(input.branches).map(([k, b]) => [k, zokanOf(b).stems])) };
    record("蔵干", `${f.id} ${f.name ?? ""}`, eq(actual, f.expected), f.expected, actual, "D18");
  }
}

// ---------------------------------------------------------------------------
// 6. 通変星（p105）・五神（命式図の五行ラベル）
// ---------------------------------------------------------------------------

/** 命式図の五行ラベル（講座の表記）と五神（p57）の対応。比劫＝比肩、食傷＝食神、印＝印綬と表記されている */
const PRINTED_LABEL_TO_GOSHIN: Record<string, GoshinName> = {
  比肩: "比劫",
  食神: "食傷",
  財: "財",
  官: "官",
  印綬: "印",
};

for (const f of safe(fixture.tsuhen)) {
  if (f.kind === "tsuhen") {
    const input = f.input as { dayStem: Stem; target: Stem };
    const actual = { tsuhen: tsuhenOf(input.dayStem, input.target) };
    record("通変星", f.id, eq(actual, f.expected), f.expected, actual, "D2");
  } else {
    const input = f.input as { dayStem: Stem };
    const labels = (f.expected as { elementLabelsAsPrinted: Record<Element, string> }).elementLabelsAsPrinted;
    const expected = Object.fromEntries(Object.entries(labels).map(([el, label]) => [el, PRINTED_LABEL_TO_GOSHIN[label]]));
    const actual = Object.fromEntries(Object.keys(labels).map((el) => [el, goshinOfElement(input.dayStem, el as Element)]));
    record("五神", `${f.id} ${f.name ?? ""}`, eq(actual, expected), expected, actual, "D2（p57）");
  }
}

// ---------------------------------------------------------------------------
// 7. 神煞（講座の印が含まれていること。印以外の該当は検証しない）
// ---------------------------------------------------------------------------

function positionLabel(h: ShinsatsuHit): string {
  if (h.position.kind === "luck") return `大運${h.position.branch}`;
  return `${h.position.pillar}${h.position.part}`;
}

for (const f of safe(fixture.shinsatsu)) {
  const p = f.input.pillars;
  const hits = judgeShinsatsu({
    pillars: { 時: p.時 ? toPillar(p.時) : null, 日: toPillar(p.日), 月: toPillar(p.月), 年: toPillar(p.年) },
    luck: f.input.luck ? f.input.luck.map(toPillar) : undefined,
  });
  const relevant = hits.filter((h) => h.name === f.shinsatsu && (f.subType === null || h.subType === f.subType));
  const missing = f.expected.mustInclude.filter(
    (e) =>
      !relevant.some(
        (h) => positionLabel(h) === e.position && eq([...h.matchedBy].sort(), [...e.matchedBy].sort()),
      ),
  );
  record(
    "神煞",
    f.id,
    missing.length === 0,
    f.expected.mustInclude,
    relevant.map((h) => ({ position: positionLabel(h), matchedBy: h.matchedBy })),
    "D1・D5・D24",
  );
}

// ---------------------------------------------------------------------------
// 結果
// ---------------------------------------------------------------------------

let totalPass = 0;
let totalFail = 0;
console.log("四柱推命 Phase 1 fixture 照合（needs_review: false のみ）");
for (const [category, c] of counts) {
  console.log(`  ${category}: PASS ${c.pass} / FAIL ${c.fail}`);
  totalPass += c.pass;
  totalFail += c.fail;
}
console.log(`  合計: PASS ${totalPass} / FAIL ${totalFail}`);

if (failures.length > 0) {
  console.log("\nFAIL 一覧");
  for (const x of failures) {
    console.log(`- [${x.category}] ${x.id}（${x.spec}）`);
    console.log(`    期待値: ${JSON.stringify(x.expected)}`);
    console.log(`    計算値: ${JSON.stringify(x.actual)}`);
  }
  process.exit(1);
}
