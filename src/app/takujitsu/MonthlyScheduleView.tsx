"use client";

// src/app/takujitsu/MonthlyScheduleView.tsx
//
// 擇日「月間行動予定」タブ（画面表示のみ。PDF生成・印刷レイアウトは未実装）。
// 表示用データは src/lib/takujitsu/monthly/ の buildMonthlySchedule() が作る。
// この画面は表示だけを担い、擇日判定・神殺・resolution・用事判定は一切持たない。
//
// 仕様: docs/monthly-action-schedule-pdf-spec.md、
//       docs/monthly-action-schedule-engine-mapping.md（§7〜§10）

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  buildMonthlySchedule,
  BAD_LIST_DISPLAY_LIMIT,
  MONTHLY_BASE_HOUR,
  MONTHLY_HOUR_LABELS,
} from "@/lib/takujitsu/monthly";
import type { MonthlyActivityResult, MonthlyDay, MonthlySchedule } from "@/lib/takujitsu/monthly";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const VERDICT_JA: Record<string, string> = { good: "吉", mixed: "混在", bad: "凶", caution: "注意", neutral: "中立" };

/** public/fonts の TTF を読み込み、jsPDF に渡す base64 にする。 */
async function fetchFontBase64(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`フォントを読み込めませんでした: ${path}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function currentYearMonth(): { year: number; month: number } {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

/** 日付見出し。旧PDFと同じく、月が変わる日（1日）だけ「月/日」にする。 */
function dayHeading(d: MonthlyDay): string {
  const md = d.day === 1 ? `${d.month}/${d.day}` : `${d.day}`;
  return `${md}（${WEEKDAY[d.weekday]}）`;
}

/** 週タブの日付範囲（例「3/30〜4/5」）。 */
function weekRangeLabel(week: MonthlyDay[]): string {
  const a = week[0];
  const b = week[week.length - 1];
  return `${a.month}/${a.day}〜${b.month}/${b.day}`;
}

function ActivityName({ a }: { a: MonthlyActivityResult }) {
  const orDetail =
    a.item.activityIds.length > 1
      ? `（${a.idVerdicts.map((x) => `${x.activityId}:${VERDICT_JA[x.verdict]}`).join("／")}）`
      : `（${a.item.activityIds[0]}）`;
  return (
    <span className={a.item.main ? "tj-ms-main" : undefined} title={`activityId ${orDetail}`}>
      {a.item.label}
    </span>
  );
}

function joinNames(list: MonthlyActivityResult[]) {
  return list.map((a, i) => (
    <Fragment key={a.item.label}>
      {i > 0 && "、"}
      <ActivityName a={a} />
    </Fragment>
  ));
}

// 吉用事欄: good だけを表示する（mixed・neutral は表示しない。2026-09-27 人間側決定）。
// mixed は既存エンジンの判定としては保持しており、「確認用の詳細」でだけ件数と名前を出す。
function GoodCell({ d, debug }: { d: MonthlyDay; debug: boolean }) {
  const strong = d.nanigoto.strongKyojin.map((k) => `${k.name}(${k.status})`).join("・");
  const debugBlock = debug && (
    <div className="tj-ms-debug">
      {d.nanigoto.strongKyojin.length > 0 && (
        <div>
          強い凶神: {strong}／主要用事の吉: {d.nanigoto.mainGood.join("・") || "なし"}
        </div>
      )}
      {d.nanigoto.show && d.good.length > 0 && <div>吉（非表示）: {joinNames(d.good)}</div>}
      <div>mixed（月間表では非表示）{d.mixed.length}件{d.mixed.length > 0 && <>: {joinNames(d.mixed)}</>}</div>
    </div>
  );
  if (d.nanigoto.show) {
    return (
      <>
        <div className="tj-ms-special">何事も宜しからず</div>
        {debugBlock}
      </>
    );
  }
  return (
    <>
      {d.good.length > 0 ? joinNames(d.good) : <span className="tj-ms-none">―</span>}
      {debugBlock}
    </>
  );
}

// 凶用事欄: BAD_LIST_DISPLAY_LIMIT 件までは個別に表示し、それを超える分は
// 「その他すべて凶」とまとめる（表示上の省略。計算結果は変えない）。
function BadCell({ d, debug }: { d: MonthlyDay; debug: boolean }) {
  const full = d.bad.length > 0 ? joinNames(d.bad) : <span className="tj-ms-none">―</span>;
  if (d.nanigoto.show) {
    return (
      <>
        <span className="tj-ms-none">（何事も宜しからず）</span>
        {debug && <div className="tj-ms-debug">凶 {d.bad.length}件: {full}</div>}
      </>
    );
  }
  if (d.badAbbreviated) {
    return (
      <>
        {joinNames(d.bad.slice(0, BAD_LIST_DISPLAY_LIMIT))}、<span className="tj-ms-special-bad">その他すべて凶</span>
        {debug && <div className="tj-ms-debug">凶 {d.bad.length}件: {full}</div>}
      </>
    );
  }
  return <>{full}</>;
}

function WeekTable({ week, debug }: { week: MonthlyDay[]; debug: boolean }) {
  return (
    <div className="tj-ms-scroll">
      <table className="tj-ms-table">
        <thead>
          <tr>
            <th className="tj-ms-rowh">吉凶/時間</th>
            {week.map((d) => (
              <th key={d.iso} className={d.inTargetMonth ? "" : "tj-ms-out"}>
                <div>{dayHeading(d)}</div>
                <div className="tj-ms-sub">
                  {d.dayGanzhi}・{d.buildingDay}・{d.shuku28 ?? "―"}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="tj-ms-good-row">
            <th className="tj-ms-rowh tj-ms-rowh-good">吉用事</th>
            {week.map((d) => (
              <td key={d.iso} className={`tj-ms-list ${d.inTargetMonth ? "" : "tj-ms-out"}`}>
                <GoodCell d={d} debug={debug} />
              </td>
            ))}
          </tr>
          <tr className="tj-ms-bad-row">
            <th className="tj-ms-rowh tj-ms-rowh-bad">凶用事</th>
            {week.map((d) => (
              <td key={d.iso} className={`tj-ms-list ${d.inTargetMonth ? "" : "tj-ms-out"}`}>
                <BadCell d={d} debug={debug} />
              </td>
            ))}
          </tr>
          <tr>
            <th className="tj-ms-rowh tj-ms-rowh-good">吉方</th>
            {week.map((d) => (
              <td key={d.iso} className="tj-ms-dir">
                {d.goodDirections.map((x) => (
                  <div key={x.name}>
                    {x.name} {x.direction}
                  </div>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th className="tj-ms-rowh tj-ms-rowh-bad">凶方</th>
            {week.map((d) => (
              <td key={d.iso} className="tj-ms-dir">
                {d.badDirections.map((x) => (
                  <div key={x.name} className={x.direction ? "" : "tj-ms-none"}>
                    {x.name} {x.direction ?? "なし"}
                  </div>
                ))}
              </td>
            ))}
          </tr>
          {MONTHLY_HOUR_LABELS.map((label, hi) => (
            <tr key={`${label}-${hi}`} className={hi % 2 === 1 ? "tj-ms-alt" : ""}>
              <th className="tj-ms-rowh tj-ms-hour">{label}</th>
              {week.map((d) => {
                const h = d.hours[hi];
                return (
                  <td
                    key={d.iso}
                    className={`tj-ms-sym ${h.isMuyo ? "tj-ms-muyo" : ""}`}
                    title={`${h.dayGanzhi}日 ${h.hourGanzhi}時 吉神${h.kichi}・凶神${h.kyo}${h.isMuyo ? "（勿用）" : ""}`}
                  >
                    {h.symbol}
                    {debug && (
                      <span className="tj-ms-debug-inline">
                        {" "}
                        {h.hourGanzhi} {h.kichi}/{h.kyo}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonthlyScheduleView({ timezone }: { timezone: string }) {
  const [year, setYear] = useState<number>(() => currentYearMonth().year);
  const [month, setMonth] = useState<number>(() => currentYearMonth().month);
  const [debug, setDebug] = useState(false);
  // 「確認用の詳細を表示」は開発・検証用。通常画面には出さず、URL に
  // ?monthlyDebug=1 を付けたときだけチェックボックスを表示する（2026-09-27）。
  const [showDebugToggle] = useState<boolean>(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("monthlyDebug"),
  );
  // 表示中の週（0 始まり）。年・月を変えたら第1週に戻す。
  const [weekIndex, setWeekIndex] = useState(0);
  const [pdfState, setPdfState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  function selectYearMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
    setWeekIndex(0);
  }

  const result = useMemo<{ data: MonthlySchedule | null; error: string | null }>(() => {
    try {
      return { data: buildMonthlySchedule(year, month, timezone || "Asia/Tokyo"), error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [year, month, timezone]);

  useEffect(() => {
    document.title = `擇日 月間行動予定 ${year}年${month}月`;
    return () => {
      document.title = "擇日";
    };
  }, [year, month]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    selectYearMonth(d.getFullYear(), d.getMonth() + 1);
  }

  const data = result.data;

  // PDF出力: 画面と同じ計算結果（data）を使い、対象月の全週を1つのPDFにする。
  // jsPDF とフォントは、ボタンを押したときにだけ読み込む。
  async function exportPdf() {
    if (!data) return;
    setPdfState({ busy: true, error: null });
    try {
      const [{ createMonthlySchedulePdf, monthlySchedulePdfFileName }, regular, bold] = await Promise.all([
        import("@/lib/takujitsu/monthly/monthlySchedulePdf"),
        fetchFontBase64("/fonts/BIZUDPGothic-Regular.ttf"),
        fetchFontBase64("/fonts/BIZUDPGothic-Bold.ttf"),
      ]);
      const doc = createMonthlySchedulePdf(data, { regular, bold });
      doc.save(monthlySchedulePdfFileName(data.year, data.month));
      setPdfState({ busy: false, error: null });
    } catch (e) {
      setPdfState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const currentWeek = data ? Math.min(weekIndex, data.weeks.length - 1) : 0;
  const range =
    data && data.weeks.length > 0
      ? `${data.weeks[0][0].iso} 〜 ${data.weeks[data.weeks.length - 1][6].iso}（${data.weeks.length}週）`
      : "";

  return (
    <>
      <style>{MS_CSS}</style>
      <section className="tj-panel tj-noprint">
        <div className="tj-inputs">
          <label className="tj-field">
            <span className="tj-label">年</span>
            <input
              type="number"
              className="tj-input tj-ms-year"
              value={year}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1900 && n <= 2100) selectYearMonth(n, month);
              }}
            />
          </label>
          <label className="tj-field">
            <span className="tj-label">月</span>
            <select className="tj-input" value={month} onChange={(e) => selectYearMonth(year, Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
          <div className="tj-ms-nav">
            <button type="button" className="tj-ms-btn" onClick={() => shiftMonth(-1)}>
              前の月
            </button>
            <button type="button" className="tj-ms-btn" onClick={() => shiftMonth(1)}>
              次の月
            </button>
          </div>
          <button
            type="button"
            className="tj-ms-btn tj-ms-pdf"
            onClick={exportPdf}
            disabled={!data || pdfState.busy}
          >
            {pdfState.busy ? "PDF作成中…" : "PDF出力"}
          </button>
          {showDebugToggle && (
            <label className="tj-ms-check">
              <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
              確認用の詳細を表示
            </label>
          )}
        </div>
      </section>

      {result.error && <p className="tj-error">エラー: {result.error}</p>}
      {pdfState.error && <p className="tj-error">PDF出力エラー: {pdfState.error}</p>}

      {data && (
        <section className="tj-panel">
          <h2 className="tj-h2">
            {data.year}年{data.month}月 行動予定
          </h2>
          <p className="tj-ms-meta">
            掲載期間 {range}／各日 {MONTHLY_BASE_HOUR}:00（{data.timezone}）で計算
          </p>

          {/* 週タブ（日曜〜土曜。月をまたぐ日も含む）。計算は1か月分をまとめて行い、表示する週だけを切り替える。 */}
          <div className="tj-ms-weektabs" role="tablist" aria-label="表示する週">
            {data.weeks.map((w, i) => (
              <button
                key={w[0].iso}
                type="button"
                role="tab"
                aria-selected={i === currentWeek}
                className={`tj-ms-weektab ${i === currentWeek ? "is-active" : ""}`}
                onClick={() => setWeekIndex(i)}
              >
                <span className="tj-ms-weektab-no">第{i + 1}週</span>
                <span className="tj-ms-weektab-range">{weekRangeLabel(w)}</span>
              </button>
            ))}
          </div>

          {data.weeks[currentWeek] && <WeekTable week={data.weeks[currentWeek]} debug={debug} />}

          {/* 利用者向けの短い凡例だけを置く（開発・検証用の解説は 2026-09-27 に削除）。 */}
          <div className="tj-ms-legend">
            <div>
              <b>吉用事</b>: その日に適した用事（太字は主要な用事）／<b>凶用事</b>: その日に避けたい用事（多い日は「その他すべて凶」とまとめて表示）
            </div>
            <div>
              <b>吉方</b>: 喜神・財神／<b>凶方</b>: 太歳遊方・五鬼（太歳遊方がない日は「なし」）
            </div>
            <div>
              <b>時間帯</b>: ◎ 吉神のみ／○ 吉神が多い／△ 吉神と凶神が同数／▽ 凶神が多い／▼ 凶神のみ。最初の23:00は当日、最後の23:00は翌日の子時。
            </div>
          </div>
        </section>
      )}
    </>
  );
}

const MS_CSS = `
.tj-wrap.tj-mode-monthly { max-width: 1400px; }
.tj-ms-year { width: 90px; }
.tj-ms-nav { display: flex; gap: 6px; }
.tj-ms-btn { font-size: 13px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; background: #f7f7f7; cursor: pointer; }
.tj-ms-pdf { background: #333; color: #fff; border-color: #333; }
.tj-ms-pdf:disabled { opacity: .6; cursor: default; }
.tj-ms-check { font-size: 13px; display: flex; align-items: center; gap: 4px; color: #555; }
.tj-ms-meta { font-size: 12px; color: #777; margin: 0 0 10px; }
.tj-ms-scroll { overflow-x: auto; margin: 0 0 18px; }
.tj-ms-weektabs { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; margin: 0 0 12px; padding-bottom: 2px; }
.tj-ms-weektab { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 14px; border: 1px solid #ccc; border-radius: 6px; background: #f2f2f2; color: #555; cursor: pointer; font-size: 12px; line-height: 1.3; }
.tj-ms-weektab-no { font-weight: 700; font-size: 13px; }
.tj-ms-weektab.is-active { background: #333; border-color: #333; color: #fff; }
.tj-ms-table { border-collapse: collapse; width: 100%; min-width: 980px; table-layout: fixed; font-size: 12px; }
.tj-ms-table th, .tj-ms-table td { border: 1px solid #ddd; padding: 4px 5px; vertical-align: top; }
.tj-ms-table thead th { background: #a6a6a6; color: #fff; font-size: 13px; text-align: center; }
.tj-ms-table thead th.tj-ms-out { background: #c4c4c4; }
.tj-ms-sub { font-size: 10px; font-weight: 400; opacity: .9; }
.tj-ms-rowh { width: 72px; background: #fafafa; color: #555; font-size: 12px; text-align: center; white-space: nowrap; }
.tj-ms-rowh-good { color: #333; }
.tj-ms-rowh-bad { color: #d0021b; }
.tj-ms-list { line-height: 1.55; }
.tj-ms-good-row td { background: #fff; }
.tj-ms-bad-row td { background: #f4f4f4; }
.tj-ms-out { color: #888; }
.tj-ms-main { font-weight: 700; }
.tj-ms-none { color: #aaa; }
.tj-ms-special { font-weight: 700; color: #b02a37; }
.tj-ms-special-bad { font-weight: 700; }
.tj-ms-dir { font-size: 11px; line-height: 1.5; }
.tj-ms-hour { color: #777; text-align: right; }
.tj-ms-sym { text-align: center; }
.tj-ms-muyo { font-size: 11px; }
.tj-ms-alt td, .tj-ms-alt th { background: #f4f4f4; }
.tj-ms-debug { margin-top: 4px; padding-top: 3px; border-top: 1px dashed #ccc; font-size: 10px; color: #666; }
.tj-ms-debug-inline { font-size: 9px; color: #999; }
.tj-ms-legend { font-size: 11px; color: #555; line-height: 1.7; border-top: 1px solid #eee; padding-top: 8px; }
`;
