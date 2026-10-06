"use client";

// src/app/takujitsu/page.tsx
//
// 擇日 UI（PC＋スマホ。UI統合 第2フェーズ）。
// ロジックは一切持たず、src/lib/takujitsu/full.ts の calculateTakujitsuFull() を
// 呼ぶだけ。occurrence / resolution / 十二建除 / 二十八宿 / ActivityProfile /
// 月破抑制 / 六黄道COMPOSITE のロジックは無変更。
// カテゴリ分類（activityCategories.ts）は UI／検索用メタデータで、
// 吉凶判定には一切使わない。

import { Fragment, useEffect, useMemo, useState } from "react";
import AppSwitcher from "@/components/AppSwitcher";
import MonthlyScheduleView from "./MonthlyScheduleView";
import "./print.css";
import "@/components/print/print.css";
import "./print/day-print.css";
import { PrintRoot, usePrintMode } from "@/components/print/PrintRoot";
import TakujitsuDayPrint from "./print/TakujitsuDayPrint";
import TakujitsuCandidatePrint from "./print/TakujitsuCandidatePrint";
import { buildTakujitsuCandidatePrintData } from "./print/candidatePrintData";
import { buildTakujitsuDayPrintData } from "./print/dayPrintData";
import { calculateTakujitsuFull, searchTakujitsuDays, TAKUJITSU_SEARCH_MAX_DAYS } from "@/lib/takujitsu";
import type { TakujitsuFullResult, TakujitsuSearchResult, TakujitsuSearchDay } from "@/lib/takujitsu";
import { ACTIVITY_BY_ID, ACTIVITY_DEFINITIONS, getHongshiNotesFor } from "@/lib/takujitsu/activity";
import type {
  ActivityEvaluation,
  ActivitySource,
  ActivitySuppression,
  ActivityVerdict,
} from "@/lib/takujitsu/activity";
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_COUNTS,
  categoryOf,
} from "@/lib/takujitsu/activity/activityCategories";
import type { ActivityCategory } from "@/lib/takujitsu/activity/activityCategories";
import type { ResolvedShinsatsuEntry } from "@/lib/takujitsu";
import { getJikaEntry, lookupShinsatsuProfile } from "@/lib/takujitsu/jika";
import { calculateDailyDirections } from "@/lib/takujitsu/dailyDirections";
import type { DailyDirections } from "@/lib/takujitsu/dailyDirections";
import { classifyJikaTerm, jikaHourState } from "@/lib/takujitsu/jika/hourClassification";
import type { JikaHourState } from "@/lib/takujitsu/jika/hourClassification";

// ---------------------------------------------------------------------------
const VERDICT_LABEL: Record<ActivityVerdict, string> = { good: "吉", bad: "凶", mixed: "吉凶混在", caution: "注意", neutral: "中立" };
const VERDICT_COLOR: Record<ActivityVerdict, string> = { good: "#1a7f37", bad: "#b02a37", mixed: "#8a6d00", caution: "#1f5f8b", neutral: "#666" };
const VERDICT_BG: Record<ActivityVerdict, string> = { good: "#e6f4ea", bad: "#fbeaec", mixed: "#fdf4e0", caution: "#e7f1f8", neutral: "#f0f0f0" };
// UI 上の並び順のみ（判定結果そのものの優先順位は不変）。
const VERDICT_ORDER: Record<ActivityVerdict, number> = { good: 0, mixed: 1, bad: 2, caution: 3, neutral: 4 };

const RES_STATUS_LABEL: Record<string, string> = {
  active: "", cancelled: "解除", reduced: "軽減", aggravated: "増悪", pending: "保留",
};


/**
 * 宜／忌の根拠を「名称だけ」の最小表示にする（開発・検証用の sourceType 内訳・
 * note・原典/docs ファイル名・「吉神○○の宜に従う」等は通常UIでは出さない）。
 *   神殺（吉神・凶神）: sourceName のみ
 *   十二建除        : 十二建除「成」
 *   二十八宿        : 二十八宿「角」
 * ※ positiveSources / negativeSources / note / resolutionStatus などの内部データは
 *   一切削除していない。ここは表示の絞り込みだけ。
 */
function sourceLabel(s: ActivitySource): string {
  if (s.sourceType === "jianchu") return `十二建除「${s.sourceName}」`;
  if (s.sourceType === "shuku28") return `二十八宿「${s.sourceName}」`;
  return s.sourceName;
}
const RES_STATUS_COLOR: Record<string, string> = {
  cancelled: "#1a7f37", reduced: "#8a6d00", aggravated: "#b02a37", pending: "#555",
};

// 2026-09-11追記（神殺クリック詳細フェーズ）:
//   resolutionのstatus（active/cancelled/reduced/aggravated/pending）を、
//   利用者向けの定型文へ変換するだけの表示専用ロジック。神殺の判定・
//   resolutionルール・解除条件そのものは一切変更しない。ここで使う文言は
//   status区分ごとの一般的な意味の説明であり、個別の神殺・日付固有の
//   理由づけはしていない（固有の理由は既存の e.reason／appliedRules の
//   note をそのまま表示するだけで、推測で追加しない）。
const RES_STATUS_EXPLANATION: Partial<Record<ResolvedShinsatsuEntry["status"], (name: string) => string>> = {
  cancelled: (name) => `この日は${name}に該当しますが、解除条件が成立しているため、${name}の凶作用は解除されています。`,
  reduced: (name) => `この日は${name}に該当しますが、条件により凶作用が弱められています（軽減）。`,
  aggravated: (name) => `この日は${name}に該当し、条件により凶作用がさらに強まっています（増悪）。`,
  pending: (name) => `この日は${name}に該当しますが、条件が競合している、または資料上一意に確定できないため、最終的な処理を保留しています。`,
};

// 2026-09-11追記（神殺解除説明 表示整形フェーズ）:
//   resolution/rules.ts のnoteに残る開発用の内部種別表記（(cancel)／(reduce)／
//   (aggravate)／(pending)、全角括弧「（）」表記を含む）を、UI表示の直前に
//   だけ取り除く。rules.ts側のnoteデータ・status・resolutionロジックは
//   変更しない（表示専用の文字列整形）。
function stripInternalKindTags(text: string): string {
  return text.replace(/[（(]\s*(cancel|reduce|aggravate|pending)\s*[）)]/gi, "").replace(/\s+([。、])/g, "$1");
}

// 2026-09-12追記（時間選択UIフェーズ）／2026-09-13整理:
//   擇日の日付選択に「時辰（時家）」を追加するための表示専用定数。
//   用途カード内の用途別時家判定UI（旧HourBreakdown）は2026-09-13に削除し、
//   ページ上部の独立した「時辰別吉凶（時家）」（JikaHourOverview）専用の
//   定数として残す。時家エンジン本体（evaluateJikaActivity等）は無変更。
const JIKA_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const JIKA_HOUR_RANGE: Record<string, string> = {
  子: "23-1時", 丑: "1-3時", 寅: "3-5時", 卯: "5-7時", 辰: "7-9時", 巳: "9-11時",
  午: "11-13時", 未: "13-15時", 申: "15-17時", 酉: "17-19時", 戌: "19-21時", 亥: "21-23時",
};
// 2026-09-13追記（奇門遁甲連携フェーズ）:
//   「この時辰の奇門遁甲を見る」ボタン用。時辰（2時間幅）の中央時刻を
//   奇門遁甲ページへ渡す代表時刻とする。子時は前日にまたがず、選択日の
//   00:00固定として扱う（日付を前日にずらさない）。
const JIKA_BRANCH_CENTER_TIME: Record<string, string> = {
  子: "00:00", 丑: "02:00", 寅: "04:00", 卯: "06:00", 辰: "08:00", 巳: "10:00",
  午: "12:00", 未: "14:00", 申: "16:00", 酉: "18:00", 戌: "20:00", 亥: "22:00",
};

// 時家の吉神／凶神の分類（classifyJikaTerm・jikaHourState ほか）は
// src/lib/takujitsu/jika/hourClassification.ts へ移動した（2026-09-27、
// 月間行動予定と共有するため。中身は無変更）。
const JIKA_HOUR_STATE_COLOR: Record<JikaHourState, string> = {
  吉神のみ: "#1a7f37", 凶神のみ: "#b02a37", 吉凶あり: "#8a6d00", 該当なし: "#666",
};
const JIKA_HOUR_STATE_BG: Record<JikaHourState, string> = {
  吉神のみ: "#e6f4ea", 凶神のみ: "#fbeaec", 吉凶あり: "#fdf4e0", 該当なし: "#f0f0f0",
};

/**
 * 「時辰別吉凶（時家）」ブロック。用事を選ぶ前に、まずその日12時辰の
 * 神殺の有無（吉神のみ／凶神のみ／吉凶あり／該当なし）を一覧できるようにする。
 * 720表引き（getJikaEntry）のみを使い、用事別判定（evaluateJikaActivity）
 * ・擇日（日家）側のロジックには一切触れない。
 *
 * レイアウトは「上段：12時辰一覧／中段：選択中の時辰の詳細／右側（下段）：
 * 日盤吉凶方位（喜神・財神・太歳遊方・五鬼）」の3分割。日盤吉凶方位は
 * calculateDailyDirections（src/lib/takujitsu/dailyDirections.ts）を
 * dayGanzhi のみで呼び出しており、選択中の時辰（selected）には依存しない
 * （同じ日であれば12時辰すべて共通）。方位円の描画はまだ実装していない
 * （文字表示のみ）。
 */
// 2026-09-13追記（方位円表示フェーズ）:
//   calculateDailyDirections() が返す方位文字列（「東南」「南東」など、
//   docs/source/日盤吉凶方位.txt の原文表記のまま）を、八方位＋中宮の
//   9マスのどこに置くかを決めるための表示専用マッピング。
//   「東南」と「南東」はどちらも南東の位置を指す同じ方位であり、
//   これは新しい方位判定ではなく、既存の方位文字列を盤面のどこに
//   描画するかという純粋なレイアウト上の対応づけにすぎない
//   （calculateDailyDirections 自体は一切変更していない）。
type WheelSlot = "NW" | "N" | "NE" | "W" | "CENTER" | "E" | "SW" | "S" | "SE";
const DIRECTION_TO_SLOT: Record<string, WheelSlot> = {
  北: "N", 南: "S", 東: "E", 西: "W",
  東北: "NE", 北東: "NE",
  東南: "SE", 南東: "SE",
  西南: "SW", 南西: "SW",
  西北: "NW", 北西: "NW",
  中宮: "CENTER",
};
const WHEEL_SLOT_LABEL: Record<WheelSlot, string> = {
  NW: "北西", N: "北", NE: "北東", W: "西", CENTER: "中宮", E: "東", SW: "南西", S: "南", SE: "南東",
};
// 3x3盤面の並び順（北を上に描く一般的な八方位盤の配置）。
const WHEEL_LAYOUT: WheelSlot[] = ["NW", "N", "NE", "W", "CENTER", "E", "SW", "S", "SE"];

interface WheelMarker {
  label: string;
  tone: "good" | "bad";
}

/**
 * 日盤吉凶方位を八方位＋中宮の盤面（3×3）として表示する。
 * calculateDailyDirections() の戻り値をそのまま盤面上に配置するだけで、
 * 新しい方位判定・点数化・ランキング・時辰による変化は一切行わない。
 * 太歳遊方が休止日（null）の場合は盤面に何も置かない（文字表示側の
 * 「遊方なし」はそのまま残す）。
 */
function DirectionWheel({ directions }: { directions: DailyDirections }) {
  const bySlot = new Map<WheelSlot, WheelMarker[]>();
  function place(directionValue: string | null, marker: WheelMarker) {
    if (!directionValue) return; // 太歳遊方の休止日は盤面に表示しない
    const slot = DIRECTION_TO_SLOT[directionValue];
    if (!slot) return;
    const list = bySlot.get(slot);
    if (list) list.push(marker);
    else bySlot.set(slot, [marker]);
  }
  place(directions.xishen, { label: "喜神", tone: "good" });
  place(directions.caishen, { label: "財神", tone: "good" });
  place(directions.taisui, { label: "太歳", tone: "bad" });
  place(directions.wugui, { label: "五鬼", tone: "bad" });

  return (
    <div className="tj-dwheel" role="img" aria-label="日盤吉凶方位（八方位盤）">
      {WHEEL_LAYOUT.map((slot) => {
        const markers = bySlot.get(slot) ?? [];
        return (
          <div key={slot} className={`tj-dwheel-cell ${slot === "CENTER" ? "tj-dwheel-center" : ""}`}>
            <div className="tj-dwheel-name">{WHEEL_SLOT_LABEL[slot]}</div>
            {markers.length > 0 && (
              <div className="tj-dwheel-markers">
                {markers.map((m, i) => (
                  <span key={i} className={`tj-dwheel-marker tj-dwheel-marker-${m.tone}`}>
                    {m.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 吉神／凶神タグ1件。原資料（時家宜忌マスター）に対応する記述が
 * 一意に見つかる場合だけクリックで展開でき、原文（rawText）を表示する。
 * 一般知識からの説明文は一切作成しない（lookupShinsatsuProfile が
 * 既存データから見つけた原文をそのまま表示するだけ）。
 * 「種別未特定」表現など対応が一意に定まらない神殺名は、展開できない
 * 通常のタグとして表示する（推測で埋めない）。
 */
function JikaShinsatsuTag({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const profile = useMemo(() => lookupShinsatsuProfile(name), [name]);

  if (!profile) {
    return (
      <li className="tj-tag-wrap">
        <span className="tj-tag">{name}</span>
      </li>
    );
  }

  return (
    <li className={`tj-tag-wrap ${open ? "tj-tag-wrap-open" : ""}`}>
      <button
        type="button"
        className="tj-tag tj-tag-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {name}
      </button>
      {open && (
        <div className="tj-shinsatsu-detail">
          <p className="tj-shinsatsu-detail-reason">{profile.rawText}</p>
        </div>
      )}
    </li>
  );
}

function JikaHourOverview({
  dayGanzhi, date, timezone,
}: {
  dayGanzhi: string;
  /** 擇日画面で選択中の日付（YYYY-MM-DD）。奇門遁甲への引き継ぎに使う。 */
  date: string;
  /** 擇日画面で選択中のタイムゾーン。奇門遁甲への引き継ぎに使う。 */
  timezone: string;
}) {
  const [selected, setSelected] = useState<string>(JIKA_BRANCHES[0]);

  const hours = useMemo(
    () =>
      JIKA_BRANCHES.map((b) => {
        const entry = getJikaEntry(dayGanzhi, b);
        const terms = entry?.normalizedTerms ?? [];
        const kichi = terms.filter((t) => classifyJikaTerm(t) === "吉").length;
        const kyo = terms.filter((t) => classifyJikaTerm(t) === "凶").length;
        return { branch: b, entry, kichi, kyo, state: jikaHourState(kichi, kyo) };
      }),
    [dayGanzhi],
  );

  // 日盤吉凶方位（喜神・財神・太歳遊方・五鬼）。時辰（selected）には依存しない
  // ＝同じ日であれば12時辰すべて共通（docs/source/日盤吉凶方位.txt）。
  const directions = useMemo(() => calculateDailyDirections(dayGanzhi), [dayGanzhi]);

  const current = hours.find((h) => h.branch === selected) ?? hours[0];
  const currentTerms = current.entry?.normalizedTerms ?? [];
  const currentKichi = currentTerms.filter((t) => classifyJikaTerm(t) === "吉");
  const currentKyo = currentTerms.filter((t) => classifyJikaTerm(t) === "凶");

  return (
    <section className="tj-panel tj-jikahour tj-noprint">
      <h2 className="tj-h2">時辰別吉凶（時家）</h2>

      <div className="tj-jikahour-layout">
        <div className="tj-jikahour-main">
          {/* 上段：12時辰一覧 */}
          <div className="tj-jikahour-row">
            {hours.map((h) => (
              <button
                key={h.branch}
                type="button"
                className={`tj-jikahour-card ${h.branch === selected ? "is-selected" : ""}`}
                onClick={() => setSelected(h.branch)}
                aria-pressed={h.branch === selected}
              >
                <span className="tj-jikahour-branch">{h.branch}</span>
                <span className="tj-jikahour-range">{JIKA_HOUR_RANGE[h.branch]}</span>
                <span className="tj-jikahour-ganzhi">{h.entry?.hourGanzhi ?? "―"}</span>
                <span className="tj-jikahour-counts">吉{h.kichi}・凶{h.kyo}</span>
                <span
                  className="tj-jikahour-state"
                  style={{ color: JIKA_HOUR_STATE_COLOR[h.state], backgroundColor: JIKA_HOUR_STATE_BG[h.state] }}
                >
                  {h.state}
                </span>
              </button>
            ))}
          </div>

          {/* 中段：選択した時辰の詳細 */}
          <div className="tj-jikahour-detail">
            <div className="tj-jikahour-detail-h">
              {current.branch}時（{JIKA_HOUR_RANGE[current.branch]}）
              <span className="tj-jikahour-detail-ganzhi">{current.entry?.hourGanzhi ?? "―"}</span>
            </div>

            <div className="tj-jikahour-detail-grid">
              <div>
                <div className="tj-jikahour-detail-k">吉神（{currentKichi.length}）</div>
                {currentKichi.length > 0 ? (
                  <ul className="tj-tags tj-tags-good">
                    {currentKichi.map((t, i) => (
                      <JikaShinsatsuTag key={`${t}-${i}`} name={t} />
                    ))}
                  </ul>
                ) : (
                  <p className="tj-dash">―</p>
                )}
              </div>
              <div>
                <div className="tj-jikahour-detail-k">凶神（{currentKyo.length}）</div>
                {currentKyo.length > 0 ? (
                  <ul className="tj-tags tj-tags-bad">
                    {currentKyo.map((t, i) => (
                      <JikaShinsatsuTag key={`${t}-${i}`} name={t} />
                    ))}
                  </ul>
                ) : (
                  <p className="tj-dash">―</p>
                )}
              </div>
            </div>

            {/* 選択時辰の中央時刻で奇門遁甲へ引き継ぐ（既存の?date=&time=クエリ方式を利用）。
                子時は日付を前日にずらさず、選択日の00:00として扱う。 */}
            <a
              className="tj-jikahour-qimen-link"
              href={`/qimen?date=${encodeURIComponent(date)}&time=${encodeURIComponent(JIKA_BRANCH_CENTER_TIME[current.branch])}&timezone=${encodeURIComponent(timezone)}`}
            >
              この時辰の奇門遁甲を見る
            </a>
          </div>
        </div>

        {/* 右側（狭幅では下段）：日盤吉凶方位（喜神・財神・太歳遊方・五鬼）。
            docs/source/日盤吉凶方位.txt にもとづく日盤の方位であり、時辰
            （selected）には依存しない。calculateDailyDirections() の値は
            方位円（DirectionWheel）内のバッジ表示のみで示す（文字一覧は
            2026-09-13に削除。方位判定ロジックの変更・追加は行っていない）。 */}
        <div className="tj-jikahour-side">
          <div className="tj-jikahour-side-h">吉凶方位（日盤）</div>
          <DirectionWheel directions={directions} />
        </div>
      </div>
    </section>
  );
}

// ActivityDefinition の並び（同じ判定内での安定ソートに使う）。
const DEF_ORDER: Map<string, number> = new Map(ACTIVITY_DEFINITIONS.map((d, i) => [d.id, i]));

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/** ActivityDefinition の表示名（原典表記 ＋ あれば現代語）。 */
function activityLabel(id: string): { main: string; sub: string | null } {
  const def = ACTIVITY_BY_ID[id];
  if (!def) return { main: id, sub: null };
  const sub = def.modernName && def.modernName !== def.canonicalName ? def.modernName : null;
  return { main: def.canonicalName, sub };
}
/** 文字検索の対象文字列（原典語＋現代語）。 */
function searchHaystack(id: string): string {
  const def = ACTIVITY_BY_ID[id];
  if (!def) return id;
  return `${def.canonicalName} ${def.modernName ?? ""} ${def.description ?? ""}`;
}

type Filter = "all" | "good" | "bad" | "mixed" | "caution";
type CatFilter = ActivityCategory | "すべて";
type Mode = "date" | "search" | "monthly";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ---------------------------------------------------------------------------
export default function TakujitsuPage() {
  const [mode, setMode] = useState<Mode>("date");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [filter, setFilter] = useState<Filter>("all");
  const [catFilter, setCatFilter] = useState<CatFilter>("すべて");
  const [search, setSearch] = useState("");
  const [showNeutral, setShowNeutral] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const result = useMemo<{ data: TakujitsuFullResult | null; error: string | null }>(() => {
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    if ([y, mo, d, h, mi].some((v) => !Number.isFinite(v))) {
      return { data: null, error: "日付・時刻を入力してください" };
    }
    try {
      const data = calculateTakujitsuFull({
        year: y, month: mo, day: d, hour: h, minute: mi,
        timezone: timezone || "Asia/Tokyo",
      });
      return { data, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [date, time, timezone]);

  const data = result.data;
  // 印刷（日付を見る）：選んだ日の印刷用データ（既存の計算結果を集めるだけ）。印刷専用レイアウトは下の PrintRoot
  const printAs = usePrintMode("interpretation");
  const printDays = useMemo(
    () => (data ? [buildTakujitsuDayPrintData({ date, time, timezone: timezone || "Asia/Tokyo", data })] : []),
    [data, date, time, timezone],
  );

  // 印刷時のブラウザ既定タイトル（＝出力ヘッダ／保存PDF名）。
  // 単日表示は「擇日 YYYY-MM-DD」。検索結果は SearchView 側で
  // 「擇日候補日 <用途> <期間>」に設定する（mode==="search" ではここは触らない）。
  // layout.tsx の metadata（SSR の <title>擇日</title>）は壊さず、クライアントで補う。
  useEffect(() => {
    if (mode === "date") document.title = `擇日 ${date}`;
    return () => { document.title = "擇日"; };
  }, [mode, date]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activities: ActivityEvaluation[] = useMemo(
    () => data?.activities.evaluations ?? [],
    [data],
  );

  const counts = useMemo(() => ({
    good: activities.filter((e) => e.verdict === "good").length,
    bad: activities.filter((e) => e.verdict === "bad").length,
    mixed: activities.filter((e) => e.verdict === "mixed").length,
    caution: activities.filter((e) => e.verdict === "caution").length,
    neutral: activities.filter((e) => e.verdict === "neutral").length,
  }), [activities]);

  const q = search.trim();
  const filtered = useMemo(() => {
    const list = activities.filter((e) => {
      if (!showNeutral && e.verdict === "neutral") return false;
      if (filter === "good" && e.verdict !== "good") return false;
      if (filter === "bad" && e.verdict !== "bad") return false;
      if (filter === "mixed" && e.verdict !== "mixed") return false;
      if (filter === "caution" && e.verdict !== "caution") return false;
      if (catFilter !== "すべて" && categoryOf(e.activityId) !== catFilter) return false;
      if (q && !searchHaystack(e.activityId).includes(q)) return false;
      return true;
    });
    // UI 上の並び: 吉 → 吉凶混在 → 凶 → 中立。同判定内は ActivityDefinition 順。
    return [...list].sort((a, b) => {
      const v = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
      if (v !== 0) return v;
      return (DEF_ORDER.get(a.activityId) ?? 9999) - (DEF_ORDER.get(b.activityId) ?? 9999);
    });
  }, [activities, showNeutral, filter, catFilter, q]);

  // 判定別に4ブロックへ再分類（判定ロジックは不変。verdict で振り分けるだけ）。
  const groups = useMemo(() => ({
    good: filtered.filter((e) => e.verdict === "good"),
    bad: filtered.filter((e) => e.verdict === "bad"),
    mixed: filtered.filter((e) => e.verdict === "mixed"),
    caution: filtered.filter((e) => e.verdict === "caution"),
    neutral: filtered.filter((e) => e.verdict === "neutral"),
  }), [filtered]);
  // カテゴリ・吉凶・検索いずれかが有効な間は、絞り込み結果を全件表示する。
  const forceAll = catFilter !== "すべて" || filter !== "all" || q.length > 0;

  function suppressionsFor(activityId: string) {
    return (data?.activities.suppressions ?? []).filter((s) => s.activityIds.includes(activityId));
  }

  function openDay(iso: string) {
    setDate(iso);
    setExpanded(new Set());
    setMode("date");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  return (
    <div className="tj-root">
      <style>{CSS}</style>
      <div className="tj-noprint">
        <AppSwitcher />
      </div>

      <div className={`tj-wrap tj-mode-${mode}`}>
        <h1 className="tj-h1">擇日</h1>

        {/* ---- モード切替 ---- */}
        <div className="tj-modes tj-noprint">
          <button className={`tj-mode ${mode === "date" ? "is-active" : ""}`} onClick={() => setMode("date")}>
            日付を見る
          </button>
          <button className={`tj-mode ${mode === "search" ? "is-active" : ""}`} onClick={() => setMode("search")}>
            良い日を探す
          </button>
          <button className={`tj-mode ${mode === "monthly" ? "is-active" : ""}`} onClick={() => setMode("monthly")}>
            月間行動予定
          </button>
        </div>

        {mode === "search" && <SearchView timezone={timezone} onOpenDay={openDay} />}

        {/* 月間行動予定（2026-09-27追加。表示のみ。判定は既存エンジンの結果を振り分けるだけ） */}
        {mode === "monthly" && <MonthlyScheduleView timezone={timezone} />}

        {mode === "date" && (
        <>
        {/* ---- 入力（印刷しない） ---- */}
        <section className="tj-panel tj-noprint">
          <div className="tj-print-row">
            <button className="tj-print-btn" onClick={() => printAs("interpretation")}>印刷</button>
          </div>
          <div className="tj-inputs">
            <label className="tj-field">
              <span className="tj-label">日付</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="tj-input" />
            </label>
            <label className="tj-field">
              <span className="tj-label">時刻</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="tj-input" />
            </label>
            <label className="tj-field">
              <span className="tj-label">タイムゾーン</span>
              <input
                type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)}
                className="tj-input tj-input-tz" placeholder="Asia/Tokyo"
              />
            </label>
          </div>
        </section>

        {result.error && <p className="tj-error">エラー: {result.error}</p>}

        {data && (
          <>
            {/* ---- 今日の概要 ---- */}
            <section className="tj-panel tj-summary">
              <div className="tj-summary-grid">
                <div><span className="tj-sm-k">日付</span><span className="tj-sm-v">{date}</span></div>
                <div><span className="tj-sm-k">十二建除</span><span className="tj-sm-v">{data.buildingDay.name}</span></div>
                <div><span className="tj-sm-k">二十八宿</span><span className="tj-sm-v">{data.shuku28?.lodge ?? "―"}</span></div>
                <div><span className="tj-sm-k">吉神</span><span className="tj-sm-v">{data.resolution.kichijin.length}神</span></div>
                <div><span className="tj-sm-k">凶神</span><span className="tj-sm-v">{data.resolution.kyojin.length}神</span></div>
              </div>
              <div className="tj-summary-verdicts">
                <span className="tj-vpill" style={{ color: VERDICT_COLOR.good, backgroundColor: VERDICT_BG.good }}>吉 {counts.good}</span>
                <span className="tj-vpill" style={{ color: VERDICT_COLOR.mixed, backgroundColor: VERDICT_BG.mixed }}>吉凶混在 {counts.mixed}</span>
                <span className="tj-vpill" style={{ color: VERDICT_COLOR.bad, backgroundColor: VERDICT_BG.bad }}>凶 {counts.bad}</span>
                <span className="tj-vpill" style={{ color: VERDICT_COLOR.caution, backgroundColor: VERDICT_BG.caution }}>注意 {counts.caution}</span>
                <span className="tj-vpill" style={{ color: VERDICT_COLOR.neutral, backgroundColor: VERDICT_BG.neutral }}>中立 {counts.neutral}</span>
              </div>
            </section>

            {/* ---- 時辰別吉凶（時家） ---- */}
            <JikaHourOverview
              dayGanzhi={`${data.calendar.dayStem}${data.calendar.dayBranch}`}
              date={date}
              timezone={timezone}
            />

            {/* ---- 暦情報 ---- */}
            <section className="tj-panel">
              <h2 className="tj-h2">暦情報</h2>
              <div className="tj-kv-grid">
                <Kv k="西暦" v={`${date} ${time}`} />
                <Kv k="干支（年）" v={`${data.calendar.yearStem}${data.calendar.yearBranch}`} />
                <Kv k="干支（月）" v={`${data.calendar.monthStem}${data.calendar.monthBranch}`} />
                <Kv k="干支（日）" v={`${data.calendar.dayStem}${data.calendar.dayBranch}`} />
                <Kv k="干支（時）" v={`${data.calendar.hourStem}${data.calendar.hourBranch}`} />
                <Kv k="節気" v={data.calendar.solarTerm} />
                <Kv
                  k="農暦"
                  v={data.calendar.lunarMonth != null
                    ? `${data.calendar.isLeapMonth ? "閏" : ""}${data.calendar.lunarMonth}月${data.calendar.lunarDay ?? ""}日`
                    : "―"}
                />
                <Kv k="十二建除" v={`${data.buildingDay.name}（${data.buildingDay.reading}）`} />
                <Kv k="二十八宿" v={data.shuku28 ? `${data.shuku28.lodge}（${data.shuku28.reading}／${data.shuku28.shukuYo}）` : "―"} />
              </div>
            </section>

            {/* ---- 神殺 ---- */}
            <section className="tj-panel">
              <h2 className="tj-h2">神殺</h2>
              <div className="tj-shinsatsu-grid">
                <div>
                  <h3 className="tj-h3">吉神（{data.resolution.kichijin.length}）</h3>
                  <ShinsatsuList entries={data.resolution.kichijin} tone="good" />
                </div>
                <div>
                  <h3 className="tj-h3">凶神（{data.resolution.kyojin.length}）</h3>
                  <ShinsatsuList entries={data.resolution.kyojin} tone="bad" />
                </div>
              </div>
            </section>

            {/* ---- 用途判定 ---- */}
            <section className="tj-panel tj-activities">
              <h2 className="tj-h2">用途判定</h2>

              {/* 目的（カテゴリ）から選ぶ */}
              <div className="tj-filter-row tj-noprint">
                <span className="tj-filter-cap">目的</span>
                <button
                  onClick={() => setCatFilter("すべて")}
                  className={`tj-chip ${catFilter === "すべて" ? "is-active" : ""}`}
                >
                  すべて
                </button>
                {ACTIVITY_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className={`tj-chip ${catFilter === c ? "is-active" : ""}`}
                  >
                    {c}（{CATEGORY_COUNTS[c]}）
                  </button>
                ))}
              </div>

              {/* 吉凶フィルタ ＋ 文字検索 */}
              <div className="tj-filter-row tj-noprint">
                <span className="tj-filter-cap">吉凶</span>
                {(
                  [
                    ["all", `すべて（${counts.good + counts.bad + counts.mixed + counts.caution}）`],
                    ["good", `吉（${counts.good}）`],
                    ["mixed", `吉凶混在（${counts.mixed}）`],
                    ["bad", `凶（${counts.bad}）`],
                    ["caution", `注意（${counts.caution}）`],
                  ] as [Filter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`tj-chip ${filter === key ? "is-active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
                <label className="tj-neutral-toggle">
                  <input type="checkbox" checked={showNeutral} onChange={(e) => setShowNeutral(e.target.checked)} />
                  中立（{counts.neutral}）も表示
                </label>
              </div>

              <div className="tj-search-row tj-noprint">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="用途を検索（例：結婚 / かしゅ / 開市）"
                  className="tj-search"
                />
                {(catFilter !== "すべて" || filter !== "all" || q) && (
                  <button
                    className="tj-clear"
                    onClick={() => { setCatFilter("すべて"); setFilter("all"); setSearch(""); }}
                  >
                    条件クリア
                  </button>
                )}
                <span className="tj-count">{filtered.length} 件</span>
              </div>

              {filtered.length === 0 && <p className="tj-empty">該当する用途がありません。</p>}

              {filtered.length > 0 && (
                <div className="tj-vblocks">
                  {groups.good.length > 0 && (
                    <VerdictBlock verdict="good" items={groups.good} expanded={expanded}
                      onToggle={toggle} suppressionsFor={suppressionsFor} forceAll={forceAll} />
                  )}
                  {groups.bad.length > 0 && (
                    <VerdictBlock verdict="bad" items={groups.bad} expanded={expanded}
                      onToggle={toggle} suppressionsFor={suppressionsFor} forceAll={forceAll} />
                  )}
                  {groups.mixed.length > 0 && (
                    <VerdictBlock verdict="mixed" items={groups.mixed} expanded={expanded}
                      onToggle={toggle} suppressionsFor={suppressionsFor} forceAll={forceAll} />
                  )}
                  {groups.caution.length > 0 && (
                    <VerdictBlock verdict="caution" items={groups.caution} expanded={expanded}
                      onToggle={toggle} suppressionsFor={suppressionsFor} forceAll={forceAll} />
                  )}
                  {showNeutral && (
                    <VerdictBlock verdict="neutral" items={groups.neutral} expanded={expanded}
                      onToggle={toggle} suppressionsFor={suppressionsFor} forceAll={forceAll} />
                  )}
                </div>
              )}
            </section>

            {data.activities.unresolvedRestrictions.length > 0 && (
              <section className="tj-panel">
                <h2 className="tj-h2">用途限定の残存忌</h2>
                <ul className="tj-restrict">
                  {data.activities.unresolvedRestrictions.map((r, i) => (
                    <li key={i}>
                      {r.sourceName}（{RES_STATUS_LABEL[r.resolutionStatus] || r.resolutionStatus}）: {r.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 印刷専用フッター（画面では非表示） */}
            <div className="tj-print-foot">擇日 ／ {date}</div>

            {/* 印刷専用レイアウト（画面には出さない。A4縦・上下30mm／左右22mm。選んだ日だけ・日ごとに新しいページ） */}
            <PrintRoot kind="interpretation" className="tdp-measurable" page="size: A4 portrait; margin: 30mm 22mm 30mm 22mm;">
              <TakujitsuDayPrint days={printDays} />
            </PrintRoot>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// 良い日を探す（期間検索）
// ===========================================================================
function SearchView({ timezone, onOpenDay }: { timezone: string; onOpenDay: (iso: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerCat, setPickerCat] = useState<CatFilter>("すべて");
  const [pickerQ, setPickerQ] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(() => addDaysISO(todayISO(), 89));
  const [showBad, setShowBad] = useState(false);
  const [showNeutral, setShowNeutral] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [res, setRes] = useState<{ data: TakujitsuSearchResult | null; error: string | null; ms: number }>(
    { data: null, error: null, ms: 0 },
  );

  const pq = pickerQ.trim();
  const pickerList = useMemo(() => {
    return ACTIVITY_DEFINITIONS.filter((d) => {
      if (pickerCat !== "すべて" && categoryOf(d.id) !== pickerCat) return false;
      if (pq && !`${d.canonicalName} ${d.modernName ?? ""} ${d.description ?? ""}`.includes(pq)) return false;
      return true;
    });
  }, [pickerCat, pq]);

  function runSearch() {
    if (!selected) return;
    const t0 = performance.now();
    try {
      const data = searchTakujitsuDays({ activityId: selected, from, to, timezone });
      setRes({ data, error: null, ms: performance.now() - t0 });
    } catch (e) {
      setRes({ data: null, error: e instanceof Error ? e.message : String(e), ms: performance.now() - t0 });
    }
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 表示対象の日（verdict フィルタ）→ 月別グループ
  const data = res.data;
  const months = useMemo(() => {
    const visible = (data?.days ?? []).filter((d) => {
      if (d.verdict === "good" || d.verdict === "mixed") return true;
      if (d.verdict === "bad") return showBad;
      // 注意（弱い神殺だけの忌）は凶ではないが候補（吉・吉凶混在）でもないため、中立と同じく表示切替に従う
      return showNeutral; // caution / neutral
    });
    const map = new Map<string, TakujitsuSearchDay[]>();
    for (const d of visible) {
      const key = `${d.year}-${pad(d.month)}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push(d);
    }
    return [...map.entries()];
  }, [data, showBad, showNeutral]);

  const selDef = selected ? ACTIVITY_BY_ID[selected] : null;
  // 候補日の印刷（一覧表）：検索結果の候補日（吉・吉凶混在）について既存の計算結果を集めた印刷用データ
  const printAs = usePrintMode("interpretation");
  const candidatePrint = useMemo(
    () =>
      res.data
        ? buildTakujitsuCandidatePrintData({
            search: res.data,
            activityName: ACTIVITY_BY_ID[res.data.activityId]?.canonicalName ?? res.data.activityId,
            timezone,
          })
        : null,
    [res.data, timezone],
  );

  // 検索結果印刷時のブラウザ既定タイトル。
  // 例：「擇日候補日 嫁娶 2026-10-01〜2026-12-31」。
  useEffect(() => {
    if (data && selected) {
      const nm = ACTIVITY_BY_ID[selected]?.canonicalName ?? selected;
      const f = data.from, t = data.to;
      document.title = `擇日候補日 ${nm} ${f.year}-${pad(f.month)}-${pad(f.day)}〜${t.year}-${pad(t.month)}-${pad(t.day)}`;
    } else {
      document.title = "擇日";
    }
    return () => { document.title = "擇日"; };
  }, [data, selected]);

  return (
    <>
      {/* ---- 用途を選ぶ（印刷しない） ---- */}
      <section className="tj-panel tj-noprint">
        <h2 className="tj-h2">1. 用途を選ぶ</h2>
        {selDef ? (
          <div className="tj-sel">
            <span className="tj-sel-name">
              {selDef.canonicalName}
              {selDef.modernName && selDef.modernName !== selDef.canonicalName && (
                <span className="tj-name-sub">（{selDef.modernName}）</span>
              )}
              <span className="tj-cat">{categoryOf(selDef.id)}</span>
            </span>
            <button className="tj-clear" onClick={() => setSelected(null)}>選び直す</button>
          </div>
        ) : (
          <>
            <div className="tj-filter-row">
              <span className="tj-filter-cap">目的</span>
              <button onClick={() => setPickerCat("すべて")} className={`tj-chip ${pickerCat === "すべて" ? "is-active" : ""}`}>すべて</button>
              {ACTIVITY_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setPickerCat(c)} className={`tj-chip ${pickerCat === c ? "is-active" : ""}`}>
                  {c}（{CATEGORY_COUNTS[c]}）
                </button>
              ))}
            </div>
            <div className="tj-search-row">
              <input
                type="search" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)}
                placeholder="用途を検索（例：結婚 / かしゅ / 開市）" className="tj-search"
              />
              <span className="tj-count">{pickerList.length} 件</span>
            </div>
            <ul className="tj-picker">
              {pickerList.slice(0, 120).map((d) => (
                <li key={d.id}>
                  <button className="tj-picker-item" onClick={() => setSelected(d.id)}>
                    {d.canonicalName}
                    {d.modernName && d.modernName !== d.canonicalName && <span className="tj-name-sub">（{d.modernName}）</span>}
                    <span className="tj-cat">{categoryOf(d.id)}</span>
                  </button>
                </li>
              ))}
              {pickerList.length > 120 && <li className="tj-note">ほか {pickerList.length - 120} 件（絞り込んでください）</li>}
            </ul>
          </>
        )}
      </section>

      {/* ---- 期間を指定（印刷しない） ---- */}
      <section className="tj-panel tj-noprint">
        <h2 className="tj-h2">2. 期間を指定して探す</h2>
        <div className="tj-inputs">
          <label className="tj-field">
            <span className="tj-label">開始日</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tj-input" />
          </label>
          <label className="tj-field">
            <span className="tj-label">終了日</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tj-input" />
          </label>
          <button className="tj-run" disabled={!selected} onClick={runSearch}>この用途の良い日を探す</button>
        </div>
        <p className="tj-note">
          計算基準時刻：正午 12:00（日単位検索。子初 23:00 の日柱境界を跨がない固定値。時刻の擇定は別機能）。
          検索期間は最大 {TAKUJITSU_SEARCH_MAX_DAYS} 日。
        </p>
        {res.error && <p className="tj-error">エラー: {res.error}</p>}
      </section>

      {/* ---- 結果（画面用。印刷は下の印刷専用の候補日一覧 TakujitsuCandidatePrint を使う） ---- */}
      {data && (
        <section className="tj-panel tj-noprint">
          <div className="tj-print-row">
            <button className="tj-print-btn" onClick={() => printAs("interpretation")}>候補日を印刷</button>
          </div>
          <h2 className="tj-h2">
            候補日（{data.from.year}/{data.from.month}/{data.from.day} 〜 {data.to.year}/{data.to.month}/{data.to.day}）
          </h2>
          <p className="tj-note">
            {data.days.length} 日を評価（{res.ms.toFixed(0)} ms）。
            これは既存の用途判定（吉神・凶神・十二建除・二十八宿）を日ごとに実行し、
            <strong>「吉」または「吉凶混在」になる日</strong>を候補として表示するものです。
            神殺の数による独自の順位付けはしていません。
          </p>
          <div className="tj-filter-row">
            <span className="tj-vpill" style={{ color: VERDICT_COLOR.good, backgroundColor: VERDICT_BG.good }}>
              吉 {data.days.filter((d) => d.verdict === "good").length}
            </span>
            <span className="tj-vpill" style={{ color: VERDICT_COLOR.mixed, backgroundColor: VERDICT_BG.mixed }}>
              吉凶混在 {data.days.filter((d) => d.verdict === "mixed").length}
            </span>
            <span className="tj-vpill" style={{ color: VERDICT_COLOR.bad, backgroundColor: VERDICT_BG.bad }}>
              凶 {data.days.filter((d) => d.verdict === "bad").length}
            </span>
            <span className="tj-vpill" style={{ color: VERDICT_COLOR.caution, backgroundColor: VERDICT_BG.caution }}>
              注意 {data.days.filter((d) => d.verdict === "caution").length}
            </span>
            <span className="tj-vpill" style={{ color: VERDICT_COLOR.neutral, backgroundColor: VERDICT_BG.neutral }}>
              中立 {data.days.filter((d) => d.verdict === "neutral").length}
            </span>
            <label className="tj-neutral-toggle">
              <input type="checkbox" checked={showBad} onChange={(e) => setShowBad(e.target.checked)} />凶も表示
            </label>
            <label className="tj-neutral-toggle">
              <input type="checkbox" checked={showNeutral} onChange={(e) => setShowNeutral(e.target.checked)} />注意・中立も表示
            </label>
          </div>

          {months.length === 0 && <p className="tj-empty">条件に合う候補日がありません。</p>}

          {months.map(([mkey, mdays]) => (
            <div key={mkey} className="tj-month">
              <div className="tj-month-h">
                {mkey.split("-")[0]}年{Number(mkey.split("-")[1])}月
                <span className="tj-month-count">
                  吉 {mdays.filter((d) => d.verdict === "good").length}／
                  吉凶混在 {mdays.filter((d) => d.verdict === "mixed").length}
                  {showBad && <>／凶 {mdays.filter((d) => d.verdict === "bad").length}</>}
                  {showNeutral && <>／注意 {mdays.filter((d) => d.verdict === "caution").length}／中立 {mdays.filter((d) => d.verdict === "neutral").length}</>}
                </span>
              </div>
              <ul className="tj-list">
                {mdays.map((d) => {
                  const key = `${d.year}-${d.month}-${d.day}`;
                  const iso = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
                  const isOpen = expanded.has(key);
                  return (
                    <li key={key} className="tj-li">
                      <div className="tj-card">
                        <button className="tj-card-main" onClick={() => toggle(key)}>
                          <span className="tj-caret">{isOpen ? "▾" : "▸"}</span>
                          <span
                            className="tj-verdict"
                            style={{ color: VERDICT_COLOR[d.verdict], backgroundColor: VERDICT_BG[d.verdict] }}
                          >
                            {VERDICT_LABEL[d.verdict]}
                          </span>
                          <span className="tj-card-date">
                            {d.year}年{d.month}月{d.day}日（{WEEKDAY[d.weekday]}）
                            <span className="tj-card-meta">
                              {d.dayStem}{d.dayBranch}日 ／ 十二建除：{d.buildingDay} ／ 二十八宿：{d.shuku28 ?? "―"}
                            </span>
                          </span>
                        </button>
                        <button className="tj-card-open" onClick={() => onOpenDay(iso)}>この日を見る</button>
                      </div>

                      {isOpen && (
                        <div className="tj-detail">
                          {d.evaluation && d.evaluation.verdict === "mixed" && (
                            <p className="tj-mixed-warn">
                              ※ この日は「吉凶混在」です。宜の根拠と忌の根拠の両方があります（吉日ではありません）。
                            </p>
                          )}
                          {d.evaluation && d.evaluation.positiveSources.length > 0 && (
                            <SourceBlock title="宜（良いとする根拠）" tone="good" sources={d.evaluation.positiveSources} />
                          )}
                          {d.evaluation && d.evaluation.negativeSources.length > 0 && (
                            <SourceBlock title="忌（避けるべきとする根拠）" tone="bad" sources={d.evaluation.negativeSources} />
                          )}
                          {!d.evaluation && (
                            <p className="tj-note">この用途について、この日に言及する神殺・十二建除・二十八宿はありません（中立）。</p>
                          )}
                          {d.suppressions.length > 0 && (
                            <div className="tj-supp">
                              <div className="tj-supp-h">抑制</div>
                              {d.suppressions.map((s, i) => (
                                <div key={i} className="tj-supp-item">
                                  {s.suppressedByName}により{s.sourceName}を抑制
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* ---- 印刷専用：候補日一覧（画面では非表示 / @media print でのみ表示） ---- */}
      {/* 候補日の印刷専用レイアウト（画面には出さない。A4縦・上下30mm／左右22mm。候補日を比較する一覧表） */}
      {candidatePrint && (
        <PrintRoot kind="interpretation" page="size: A4 portrait; margin: 30mm 22mm 30mm 22mm;">
          <TakujitsuCandidatePrint data={candidatePrint} />
        </PrintRoot>
      )}
    </>
  );
}

// ===========================================================================
// 印刷専用：期間検索の候補日一覧（A4）。
//   - 画面には出さない（print.css で display:none、@media print で block）。
//   - 印刷対象は good / mixed のみ（画面の「凶も表示」「中立も表示」に関係なく固定）。
//     engine 結果を削っているのではなく、印刷表示だけの制御。
//   - 各日の宜／忌は既存 positiveSources / negativeSources の sourceName を
//     並べるだけ（新しい判定・スコア・順位付けは一切しない）。
//   - 並び順は searchTakujitsuDays() / 既存 months グルーピングのまま。
// ===========================================================================

// ---------------------------------------------------------------------------
// 用途判定を「吉／凶／吉凶混在／中立」の4ブロックへまとめて表示する。
// 判定（verdict）は evaluateActivities() の結果そのまま。ここでは並べ替えず
// verdict で振り分け、カード状に複数列で並べるだけ（表示専用）。
const VBLOCK_LIMIT = 15;

function VerdictBlock({
  verdict, items, expanded, onToggle, suppressionsFor, forceAll,
}: {
  verdict: ActivityVerdict;
  items: ActivityEvaluation[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  suppressionsFor: (id: string) => ActivitySuppression[];
  forceAll: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  // 画面上は最初の VBLOCK_LIMIT 件だけ見せるが、DOM には常に全件を描画する。
  // → 印刷（@media print で tj-vcard-of を再表示）で必ず全件出せる。
  const all = forceAll || showAll;
  const hidden = all ? 0 : Math.max(0, items.length - VBLOCK_LIMIT);

  return (
    <div className={`tj-vblock tj-vblock-${verdict}`}>
      <h3 className="tj-vblock-h" style={{ color: VERDICT_COLOR[verdict] }}>
        {VERDICT_LABEL[verdict]}の用事（{items.length}件）
      </h3>
      {items.length === 0 ? (
        <p className="tj-vblock-empty">該当なし</p>
      ) : (
        <>
          <div className="tj-vgrid">
            {items.map((ev, idx) => {
              const isOpen = expanded.has(ev.activityId);
              const screenHidden = !all && idx >= VBLOCK_LIMIT;
              const { main, sub } = activityLabel(ev.activityId);
              const supp = suppressionsFor(ev.activityId);
              const hongshiNotes = getHongshiNotesFor(ev);
              return (
                <Fragment key={ev.activityId}>
                  <button
                    className={`tj-vcard ${isOpen ? "is-open" : ""} ${screenHidden ? "tj-vcard-of" : ""}`}
                    onClick={() => onToggle(ev.activityId)}
                  >
                    <span className="tj-vcard-name">
                      <span className="tj-vcard-caret">{isOpen ? "▾" : "▸"}</span>
                      {main}
                      {ev.hasPendingSource && <span className="tj-vcard-pending">保留</span>}
                    </span>
                    {sub && <span className="tj-vcard-sub">{sub}</span>}
                    <span className="tj-vcard-cat">
                      {categoryOf(ev.activityId)}
                      <span className="tj-vcard-yg">宜{ev.positiveSources.length}・忌{ev.negativeSources.length}</span>
                    </span>
                  </button>

                  {isOpen && !screenHidden && (
                    <div className="tj-vdetail">
                      <div className="tj-vdetail-h">
                        {main}{sub ? `（${sub}）` : ""}
                        <span className="tj-cat">{categoryOf(ev.activityId)}</span>
                      </div>
                      {ACTIVITY_BY_ID[ev.activityId]?.modernLabel && (
                        <p className="tj-vmodern">{ACTIVITY_BY_ID[ev.activityId]?.modernLabel}</p>
                      )}
                      {ev.positiveSources.length > 0 && (
                        <SourceBlock title="宜（良いとする根拠）" tone="good" sources={ev.positiveSources} />
                      )}
                      {ev.negativeSources.length > 0 && (
                        <SourceBlock title="忌（避けるべきとする根拠）" tone="bad" sources={ev.negativeSources} />
                      )}
                      {hongshiNotes.length > 0 && (
                        <div className="tj-hongshi">
                          <div className="tj-hongshi-h">洪氏錦嚢による補足</div>
                          {hongshiNotes.map((note, i) => (
                            <p key={i} className="tj-hongshi-item">
                              洪氏錦嚢では「{note.unfavorableGod}」について、{note.conditionText}とされています。
                            </p>
                          ))}
                        </div>
                      )}
                      {ev.positiveSources.length === 0 && ev.negativeSources.length === 0 && (
                        <p className="tj-note">
                          この用途に言及する神殺・十二建除・二十八宿はありません（中立）。
                        </p>
                      )}
                      {supp.length > 0 && (
                        <div className="tj-supp">
                          <div className="tj-supp-h">抑制</div>
                          {supp.map((s, i) => (
                            <div key={i} className="tj-supp-item">
                              {s.suppressedByName}により{s.sourceName}を抑制
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
          {!all && hidden > 0 && (
            <button className="tj-vmore tj-noprint" onClick={() => setShowAll(true)}>
              他 {hidden} 件を表示
            </button>
          )}
          {!forceAll && showAll && items.length > VBLOCK_LIMIT && (
            <button className="tj-vmore tj-noprint" onClick={() => setShowAll(false)}>
              折りたたむ
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="tj-kv">
      <span className="tj-kv-k">{k}</span>
      <span className="tj-kv-v">{v}</span>
    </div>
  );
}

const RELATION_KIND_LABEL: Record<string, string> = { cancel: "解除", reduce: "軽減", aggravate: "増悪" };

function ShinsatsuList({ entries, tone }: { entries: readonly ResolvedShinsatsuEntry[]; tone: "good" | "bad" }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (entries.length === 0) return <p className="tj-dash">―</p>;

  function toggle(name: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <ul className={`tj-tags tj-tags-${tone}`}>
      {entries.map((e) => {
        const statusLabel = RES_STATUS_LABEL[e.status] || "";
        const explain = RES_STATUS_EXPLANATION[e.status];
        const isOpen = open.has(e.name);
        return (
          <li key={e.name} className={`tj-tag-wrap ${isOpen ? "tj-tag-wrap-open" : ""}`}>
            {statusLabel && explain ? (
              <button
                type="button"
                className={`tj-tag tj-tag-btn ${e.status === "cancelled" ? "is-cancelled" : ""}`}
                onClick={() => toggle(e.name)}
                aria-expanded={isOpen}
              >
                {e.name}
                <span className="tj-tag-status" style={{ color: RES_STATUS_COLOR[e.status] || "#555" }}>
                  ［{statusLabel}］
                </span>
              </button>
            ) : (
              <span className={`tj-tag ${e.status === "cancelled" ? "is-cancelled" : ""}`}>
                {e.name}
                {statusLabel && (
                  <span className="tj-tag-status" style={{ color: RES_STATUS_COLOR[e.status] || "#555" }}>
                    ［{statusLabel}］
                  </span>
                )}
              </span>
            )}
            {isOpen && explain && (
              <div className="tj-shinsatsu-detail">
                <p className="tj-shinsatsu-detail-headline">{explain(e.name)}</p>
                {(e.reason || e.note) && (
                  <p className="tj-shinsatsu-detail-reason">{stripInternalKindTags(e.reason || e.note || "")}</p>
                )}
                {e.appliedRules && e.appliedRules.length > 1 && (
                  <ul className="tj-shinsatsu-detail-rules">
                    {e.appliedRules.map((r, i) => (
                      <li key={i}>
                        {RELATION_KIND_LABEL[r.kind] || r.kind}
                        {r.pending ? "（保留扱い）" : ""}
                        {r.note ? `：${stripInternalKindTags(r.note)}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SourceBlock({
  title, tone, sources,
}: { title: string; tone: "good" | "bad"; sources: ActivitySource[] }) {
  // 名称のみ（＋非activeなresolution状態だけ短く）。同名は1回に。
  const seen = new Set<string>();
  const items: { label: string; status?: string }[] = [];
  for (const s of sources) {
    const label = sourceLabel(s);
    const status = s.resolutionStatus && s.resolutionStatus !== "active"
      ? (RES_STATUS_LABEL[s.resolutionStatus] || s.resolutionStatus)
      : undefined;
    const key = `${label}|${status ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label, status });
  }
  return (
    <div className="tj-sb">
      <div className="tj-sb-h" style={{ color: tone === "good" ? "#1a7f37" : "#b02a37" }}>{title}</div>
      <ul className="tj-sb-list">
        {items.map((it, i) => (
          <li key={i}>
            <span className="tj-sb-name">{it.label}</span>
            {it.status && <span className="tj-sb-status">［{it.status}］</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
const CSS = `
.tj-root { font-family: system-ui, "Hiragino Sans", sans-serif; color: #222; }
.tj-wrap { max-width: 1080px; margin: 0 auto; padding: 16px 20px 60px; }
.tj-h1 { font-size: 20px; margin: 8px 0 16px; }
.tj-panel { border: 1px solid #e2e2e2; border-radius: 6px; padding: 14px 16px; margin: 12px 0; background: #fff; }
.tj-h2 { font-size: 15px; margin: 0 0 10px; border-bottom: 2px solid #333; padding-bottom: 4px; }
.tj-h3 { font-size: 13px; margin: 0 0 6px; color: #555; }
.tj-note { font-size: 11px; color: #888; margin-top: 8px; }
.tj-error { color: #b02a37; font-size: 13px; }
.tj-dash { font-size: 13px; color: #aaa; }
.tj-empty { font-size: 13px; color: #888; }

.tj-inputs { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-end; }
.tj-field { display: flex; flex-direction: column; gap: 3px; }
.tj-label { font-size: 11px; color: #888; }
.tj-input { font-size: 14px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
.tj-input-tz { width: 160px; }

.tj-print-row { margin-bottom: 10px; }
.tj-print-btn { font-size: 13px; font-weight: 700; padding: 7px 18px; border: 1px solid #333; border-radius: 5px; background: #333; color: #fff; cursor: pointer; }
.tj-print-btn:hover { background: #000; }
.tj-print-foot { display: none; }

.tj-summary { background: #fbfbfb; }
.tj-summary-grid { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 8px; }
.tj-summary-grid > div { font-size: 13px; }
.tj-sm-k { color: #888; margin-right: 6px; }
.tj-sm-v { font-weight: 700; }
.tj-summary-verdicts { display: flex; flex-wrap: wrap; gap: 8px; }
.tj-vpill { font-size: 13px; font-weight: 700; padding: 2px 12px; border-radius: 12px; }

.tj-kv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 16px; }
.tj-kv { font-size: 13px; }
.tj-kv-k { color: #888; display: block; }
.tj-kv-v { font-weight: 600; }

.tj-shinsatsu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tj-tags { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tj-tag { font-size: 13px; padding: 3px 9px; border-radius: 4px; border: 1px solid; }
.tj-tags-good .tj-tag { border-color: #bcdcc6; background: #eef7f1; }
.tj-tags-bad .tj-tag { border-color: #e6c2c6; background: #fceff0; }
.tj-tag.is-cancelled { text-decoration: line-through; opacity: 0.65; }
.tj-tag-status { margin-left: 5px; font-size: 11px; font-weight: 700; }
.tj-tag-wrap { display: flex; flex-direction: column; align-items: flex-start; }
.tj-tag-wrap-open { flex-basis: 100%; }
.tj-tag-btn { appearance: none; -webkit-appearance: none; font: inherit; cursor: pointer; }
.tj-tag-btn:hover { filter: brightness(0.97); }
.tj-shinsatsu-detail { margin-top: 4px; padding: 7px 10px; background: #fff; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; line-height: 1.6; max-width: 100%; word-break: break-word; }
.tj-shinsatsu-detail-headline { margin: 0 0 4px; font-weight: 600; color: #333; }
.tj-shinsatsu-detail-reason { margin: 0; color: #555; }
.tj-shinsatsu-detail-rules { margin: 6px 0 0; padding-left: 16px; font-size: 11.5px; color: #666; }

.tj-filter-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.tj-filter-cap { font-size: 11px; color: #999; min-width: 30px; }
.tj-chip { font-size: 12px; padding: 4px 11px; border: 1px solid #ccc; border-radius: 14px; background: #fff; cursor: pointer; color: #555; line-height: 1.4; }
.tj-chip:hover { border-color: #999; }
.tj-chip.is-active { background: #333; color: #fff; border-color: #333; font-weight: 700; }
.tj-neutral-toggle { font-size: 12px; color: #555; margin-left: 8px; display: flex; align-items: center; gap: 4px; }

.tj-search-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 10px; }
.tj-search { flex: 1; min-width: 220px; font-size: 14px; padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; }
.tj-clear { font-size: 12px; padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; background: #f6f6f6; cursor: pointer; }
.tj-count { font-size: 12px; color: #999; }

.tj-list { list-style: none; margin: 0; padding: 0; }
.tj-li { border-bottom: 1px solid #eee; }
.tj-row { width: 100%; text-align: left; background: none; border: none; padding: 10px 4px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 14px; }
.tj-row:hover { background: #f8f8f8; }
.tj-caret { color: #999; width: 12px; flex: none; }
.tj-verdict { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px; min-width: 60px; text-align: center; flex: none; }
.tj-name { flex: 1; min-width: 0; }
.tj-name-sub { color: #777; font-size: 12px; }
.tj-cat { display: inline-block; margin-left: 8px; font-size: 10px; color: #999; border: 1px solid #ddd; border-radius: 3px; padding: 0 5px; vertical-align: middle; }
.tj-pending { font-size: 11px; color: #555; flex: none; }
.tj-yg { font-size: 11px; color: #999; flex: none; }

.tj-detail { padding: 0 4px 12px 34px; font-size: 13px; }
.tj-sb { margin-top: 6px; }
.tj-sb-h { font-weight: 700; margin-bottom: 3px; }
.tj-sb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3px 16px; }
.tj-sb-list li { display: inline-flex; align-items: baseline; }
.tj-sb-name { font-weight: 600; }
.tj-sb-status { margin-left: 3px; font-size: 11px; font-weight: 700; color: #8a6d00; }
.tj-supp { margin-top: 8px; }
.tj-supp-h { font-weight: 700; color: #8a6d00; margin-bottom: 2px; }
.tj-supp-item { color: #8a6d00; margin-left: 8px; }
.tj-restrict { margin: 0; padding-left: 18px; font-size: 13px; }

/* --- 用途判定：判定別ブロック --- */
.tj-vblocks { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.tj-vblock { border: 1px solid; border-radius: 6px; padding: 12px 14px; }
.tj-vblock-good { background: #f1f8f3; border-color: #cfe6d6; }
.tj-vblock-bad { background: #fcf1f2; border-color: #eccdd1; }
.tj-vblock-mixed { background: #fdf7ec; border-color: #ecdcbf; }
.tj-vblock-neutral { background: #f5f5f5; border-color: #e2e2e2; }
.tj-vblock-h { font-size: 14px; font-weight: 700; margin: 0 0 10px; }
.tj-vblock-empty { font-size: 12px; color: #999; margin: 0; }
.tj-vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; align-items: start; }
.tj-vcard { text-align: left; background: #fff; border: 1px solid #e0e0e0; border-radius: 5px; padding: 7px 9px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; font: inherit; }
/* 画面では最初の15件超は隠す（DOM には残す → 印刷時に @media print で全件表示）。 */
.tj-vcard-of { display: none; }
.tj-vcard:hover { border-color: #999; }
.tj-vcard.is-open { border-color: #333; box-shadow: 0 0 0 1px #333 inset; }
.tj-vcard-name { font-size: 13px; font-weight: 600; color: #222; }
.tj-vcard-caret { color: #999; font-size: 11px; margin-right: 4px; }
.tj-vcard-pending { margin-left: 6px; font-size: 10px; font-weight: 700; color: #8a6d00; }
.tj-vcard-sub { font-size: 11px; color: #777; }
.tj-vcard-cat { font-size: 10px; color: #999; display: flex; flex-wrap: wrap; gap: 2px 8px; }
.tj-vcard-yg { color: #aaa; }
.tj-vdetail { grid-column: 1 / -1; background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 10px 12px; font-size: 13px; margin-bottom: 2px; }
.tj-vdetail-h { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.tj-vmodern { margin: 0 0 8px; padding: 6px 10px; background: #f5f6f8; border-radius: 4px; font-size: 12.5px; line-height: 1.5; color: #444; word-break: break-word; }
.tj-hongshi { margin-top: 8px; padding: 6px 10px; background: #fbf6ec; border: 1px solid #e6d9bd; border-radius: 4px; }
.tj-hongshi-h { font-weight: 700; font-size: 11.5px; color: #8a6d00; margin-bottom: 4px; }
.tj-hongshi-item { margin: 0 0 4px; font-size: 12px; line-height: 1.5; color: #5a4a1e; word-break: break-word; }
.tj-hongshi-item:last-child { margin-bottom: 0; }
.tj-vmore { margin-top: 10px; font-size: 12px; padding: 5px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
.tj-vmore:hover { border-color: #999; }

/* --- 時辰別吉凶（時家）：日付選択直後に見える概要ブロック --- */
.tj-jikahour-layout { display: grid; grid-template-columns: 1fr 260px; gap: 14px; align-items: start; }
.tj-jikahour-main { min-width: 0; }
.tj-jikahour-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 10px; -webkit-overflow-scrolling: touch; }
.tj-jikahour-card {
  flex: 0 0 auto; width: 96px; text-align: left; display: flex; flex-direction: column; gap: 2px;
  border: 1px solid #ddd; border-radius: 6px; padding: 7px 8px; background: #fff; cursor: pointer; font: inherit;
}
.tj-jikahour-card:hover { border-color: #999; }
.tj-jikahour-card.is-selected { border-color: #333; box-shadow: 0 0 0 2px #333 inset; background: #fafafa; }
.tj-jikahour-branch { font-size: 18px; font-weight: 700; line-height: 1; }
.tj-jikahour-range { font-size: 10px; color: #888; }
.tj-jikahour-ganzhi { font-size: 11px; color: #666; }
.tj-jikahour-counts { font-size: 11px; color: #666; }
.tj-jikahour-state { display: inline-block; margin-top: 2px; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }
.tj-jikahour-detail { border: 1px solid #e2e2e2; border-radius: 6px; padding: 10px 12px; background: #fbfbfb; }
.tj-jikahour-detail-h { font-size: 14px; font-weight: 700; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.tj-jikahour-detail-ganzhi { font-size: 12px; color: #666; font-weight: 400; }
.tj-jikahour-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 8px; }
.tj-jikahour-detail-k { font-size: 11px; color: #888; margin-bottom: 3px; }
.tj-jikahour-qimen-link {
  display: inline-block; font-size: 12px; padding: 4px 10px; border: 1px solid #ccc; border-radius: 4px;
  background: #f6f6f6; color: #333; text-decoration: none; cursor: pointer;
}
.tj-jikahour-qimen-link:hover { border-color: #999; background: #eee; }
.tj-jikahour-side { border: 1px dashed #ddd; border-radius: 6px; padding: 10px 12px; background: #fbfbfb; }
.tj-jikahour-side-h { font-size: 12px; font-weight: 700; color: #888; margin-bottom: 8px; }

/* --- 方位円（八方位＋中宮の3×3盤面） --- */
.tj-dwheel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; aspect-ratio: 1 / 1; }
.tj-dwheel-cell {
  border: 1px solid #ddd; border-radius: 6px; background: #fff; padding: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-width: 0; min-height: 0;
}
.tj-dwheel-center { background: #f2f2f2; border-style: dashed; }
.tj-dwheel-name { font-size: 10.5px; color: #888; font-weight: 700; }
.tj-dwheel-markers { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
.tj-dwheel-marker { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 8px; white-space: nowrap; }
.tj-dwheel-marker-good { color: #1a7f37; background: #e6f4ea; }
.tj-dwheel-marker-bad { color: #b02a37; background: #fbeaec; }

/* --- モード切替・検索 --- */
.tj-modes { display: flex; gap: 6px; margin: 8px 0 4px; }
.tj-mode { font-size: 13px; padding: 7px 16px; border: 1px solid #ccc; border-bottom: none; border-radius: 6px 6px 0 0; background: #f2f2f2; cursor: pointer; color: #555; }
.tj-mode.is-active { background: #fff; color: #111; font-weight: 700; border-color: #333; }
.tj-sel { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 15px; }
.tj-sel-name { font-weight: 700; }
.tj-picker { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tj-picker-item { font-size: 13px; padding: 5px 11px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; cursor: pointer; }
.tj-picker-item:hover { border-color: #999; background: #f0f0f0; }
.tj-run { font-size: 14px; font-weight: 700; padding: 8px 18px; border: 1px solid #1a7f37; border-radius: 5px; background: #1a7f37; color: #fff; cursor: pointer; align-self: flex-end; }
.tj-run:disabled { background: #bbb; border-color: #bbb; cursor: not-allowed; }
.tj-month { margin-top: 14px; }
.tj-month-h { font-size: 14px; font-weight: 700; padding: 6px 4px; border-bottom: 2px solid #ccc; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
.tj-month-count { font-size: 12px; font-weight: 400; color: #777; }
.tj-card { display: flex; align-items: stretch; gap: 6px; }
.tj-card-main { flex: 1; min-width: 0; text-align: left; background: none; border: none; padding: 10px 4px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 14px; }
.tj-card-main:hover { background: #f8f8f8; }
.tj-card-date { flex: 1; min-width: 0; }
.tj-card-meta { display: block; font-size: 11px; color: #888; margin-top: 2px; }
.tj-card-open { flex: none; font-size: 12px; padding: 4px 10px; border: 1px solid #ccc; border-radius: 4px; background: #f6f6f6; cursor: pointer; align-self: center; }
.tj-mixed-warn { color: #8a6d00; font-size: 12px; margin: 0 0 6px; }

@media (max-width: 640px) {
  .tj-wrap { padding: 12px 12px 48px; }
  .tj-inputs { gap: 12px; flex-direction: column; align-items: stretch; }
  .tj-field { width: 100%; }
  .tj-input, .tj-input-tz { width: 100%; box-sizing: border-box; }
  .tj-run { align-self: stretch; }
  .tj-shinsatsu-grid { grid-template-columns: 1fr; gap: 12px; }
  .tj-kv-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .tj-row { padding: 12px 2px; flex-wrap: wrap; gap: 6px 10px; }
  .tj-name { flex-basis: 100%; order: 3; }
  .tj-yg { order: 4; }
  .tj-pending { order: 5; }
  .tj-cat { margin-left: 6px; }
  .tj-detail { padding-left: 18px; }
  .tj-filter-cap { min-width: 0; }
  .tj-card { flex-direction: column; gap: 0; }
  .tj-card-main { flex-wrap: wrap; }
  .tj-card-date { flex-basis: 100%; order: 3; }
  .tj-card-open { align-self: flex-start; margin: 0 0 8px 34px; }
  .tj-vgrid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .tj-jikahour-layout { grid-template-columns: 1fr; }
  .tj-jikahour-card { width: 82px; }
  .tj-jikahour-detail-grid { grid-template-columns: 1fr; }
  .tj-dwheel { max-width: 260px; margin-left: auto; margin-right: auto; }
}
`;
