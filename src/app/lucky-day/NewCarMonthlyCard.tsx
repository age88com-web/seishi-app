"use client";

// src/app/lucky-day/NewCarMonthlyCard.tsx
//
// 役割:
//   一般向け擇日サービスの「新車購入・納車の吉日」月間一覧（専用ページ /lucky-day/car に置く。
//   ページの見出し・説明文はページ側が持つ）。判定は Server Action
//   （getNewCarMonthAction → newCarJudgment.ts）が行い、ここは表示だけを担う。
//
// 無料/有料:
//   無料版で表示できない日はサーバーが locked として返す（判定データは届かない）。
//   月の切替範囲は無料版の範囲（今日〜今日+30日）を含む月に限るが、これは UI ヒントで、
//   実際の制限はサーバー側にある。

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getNewCarMonthAction } from "@/lib/luckyDay/newCarActions";
import type { NewCarMonth } from "@/lib/luckyDay/newCarMonth";
import { shiftYearMonth, NEW_CAR_MIN_YEAR, NEW_CAR_MAX_YEAR } from "@/lib/luckyDay/newCarMonth";
import {
  NEW_CAR_STATUS_LABEL,
  NEW_CAR_STATUS_SYMBOL,
  describeNewCarDay,
  newCarStatusTag,
} from "@/lib/luckyDay/newCarJudgment";
import type { NewCarDayJudgment, NewCarFollowerView, NewCarPartJudgment, NewCarSourceView } from "@/lib/luckyDay/newCarJudgment";
import { parseIsoDate, WEEKDAY_JA_SHORT } from "@/lib/luckyDay";

const RESOLUTION_STATUS_LABEL: Record<string, string> = {
  reduced: "軽減",
  cancelled: "解除",
  aggravated: "増悪",
  pending: "未確定",
};

function sourceList(sources: NewCarSourceView[]): string {
  if (sources.length === 0) return "なし";
  return sources
    .map((s) => (s.resolutionStatus ? `${s.name}（${RESOLUTION_STATUS_LABEL[s.resolutionStatus] ?? s.resolutionStatus}）` : s.name))
    .join("・");
}

/** 直接の根拠を並べ、六黄道・六黒道の追従分は「○○に追従」と別に添える。 */
export function SourceCell({ sources, followers }: { sources: NewCarSourceView[]; followers: NewCarFollowerView[] }) {
  return (
    <dd>
      {sourceList(sources)}
      {followers.map((f) => (
        <span className="ld-newcar-follower" key={f.name}>
          {f.name}は{f.follows.join("・")}に追従
        </span>
      ))}
    </dd>
  );
}

function StatusCell({ part }: { part: NewCarPartJudgment }) {
  const tag = newCarStatusTag(part);
  return (
    <span className="ld-newcar-status" data-status={part.status} aria-label={NEW_CAR_STATUS_LABEL[part.status]}>
      <span className="ld-newcar-symbol">{NEW_CAR_STATUS_SYMBOL[part.status]}</span>
      {tag && <span className="ld-newcar-tag">{tag}</span>}
    </span>
  );
}

function NewCarDayDetail({ j }: { j: NewCarDayJudgment }) {
  const { year, month, day } = parseIsoDate(j.dateIso);
  const extra = [...new Set([...j.buy.exclusions, ...j.delivery.exclusions])];
  return (
    <div className="ld-newcar-detail">
      <p className="ld-newcar-detail-date">
        {year}年{month}月{day}日（{WEEKDAY_JA_SHORT[j.weekday]}）・日干支：{j.dayStem}
        {j.dayBranch}
      </p>
      {describeNewCarDay(j).map((line) => (
        <p className="ld-newcar-detail-line" key={line}>
          {line}
        </p>
      ))}
      <dl className="ld-newcar-detail-list">
        <dt>新車購入</dt>
        <dd>{NEW_CAR_STATUS_LABEL[j.buy.status]}</dd>
        <dt>納車</dt>
        <dd>{NEW_CAR_STATUS_LABEL[j.delivery.status]}</dd>
        <dt>立券交易の宜</dt>
        <SourceCell sources={j.buy.positiveSources} followers={j.buy.positiveFollowers} />
        <dt>立券交易の忌</dt>
        <SourceCell sources={j.buy.negativeSources} followers={j.buy.negativeFollowers} />
        <dt>出行の宜</dt>
        <SourceCell sources={j.delivery.positiveSources} followers={j.delivery.positiveFollowers} />
        <dt>出行の忌</dt>
        <SourceCell sources={j.delivery.negativeSources} followers={j.delivery.negativeFollowers} />
        <dt>月破</dt>
        <dd>{j.geppa ? "成立" : "なし"}</dd>
        <dt>長星・短星</dt>
        <dd>{j.chousei || j.tansei ? `${[j.chousei && "長星", j.tansei && "短星"].filter(Boolean).join("・")}が成立` : "なし"}</dd>
        <dt>追加除外</dt>
        <dd>
          {extra.length === 0
            ? "なし"
            : [
                j.geppa && "月破（購入・納車とも）",
                j.chousei && "長星（購入のみ）",
                j.tansei && "短星（購入のみ）",
              ]
                .filter(Boolean)
                .join("・")}
        </dd>
      </dl>
    </div>
  );
}

export default function NewCarMonthlyCard({
  todayIso,
  freeMaxDateIso,
  isPaid,
  paywall,
}: {
  todayIso: string;
  freeMaxDateIso: string;
  isPaid: boolean;
  /** 無料版の範囲外の日があるときに表示する既存の有料案内。 */
  paywall: ReactNode;
}) {
  const today = parseIsoDate(todayIso);
  const [ym, setYm] = useState({ year: today.year, month: today.month });
  const [data, setData] = useState<NewCarMonth | null>(null);
  // 取得に失敗した年月（"YYYY-M"）。表示中の年月と一致するときだけエラーを出す。
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const ymKey = `${ym.year}-${ym.month}`;

  useEffect(() => {
    let cancelled = false;
    const key = `${ym.year}-${ym.month}`;
    getNewCarMonthAction(ym.year, ym.month)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData(res.data);
        else setErrorKey(key);
      })
      .catch(() => {
        if (!cancelled) setErrorKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [ym.year, ym.month]);

  const shown = data && data.year === ym.year && data.month === ym.month ? data : null;
  const error = errorKey === ymKey ? "吉日の一覧を取得できませんでした。" : null;
  const loading = !shown && !error;

  // 月の切替範囲（UI ヒント）。無料版は今日〜今日+30日を含む月だけ。
  const freeMax = parseIsoDate(freeMaxDateIso);
  const idx = (y: number, m: number) => y * 12 + m;
  const minIdx = isPaid ? idx(NEW_CAR_MIN_YEAR, 1) : idx(today.year, today.month);
  const maxIdx = isPaid ? idx(NEW_CAR_MAX_YEAR, 12) : idx(freeMax.year, freeMax.month);
  const curIdx = idx(ym.year, ym.month);
  const move = (delta: number) => {
    setSelectedIso(null);
    setYm((cur) => shiftYearMonth(cur.year, cur.month, delta));
  };

  return (
    <section className="ld-card ld-newcar-card">
      <div className="ld-newcar-nav">
        <button type="button" className="ld-newcar-navbtn" onClick={() => move(-1)} disabled={curIdx <= minIdx || loading}>
          ← 前月
        </button>
        <span className="ld-newcar-month">
          {ym.year}年{ym.month}月
        </span>
        <button type="button" className="ld-newcar-navbtn" onClick={() => move(1)} disabled={curIdx >= maxIdx || loading}>
          翌月 →
        </button>
      </div>

      <p className="ld-newcar-legend">◎ 吉日　△ 宜忌が競合　— 推奨対象外　？ 吉凶未確定</p>

      {error && <p className="ld-error">{error}</p>}
      {loading && !shown && <p className="ld-loading">読み込み中…</p>}

      {shown && (
        <div className="ld-newcar-table">
          <div className="ld-newcar-row ld-newcar-head">
            <span>日付</span>
            <span>新車購入</span>
            <span>納車</span>
          </div>
          {shown.days.map((d) => {
            const { day } = parseIsoDate(d.dateIso);
            const dateLabel = (
              <span className="ld-newcar-date" data-weekday={d.weekday}>
                {ym.month}月{day}日（{WEEKDAY_JA_SHORT[d.weekday]}）
                {!d.locked && d.judgment.bothGood && <span className="ld-newcar-both">ともに吉</span>}
              </span>
            );
            if (d.locked) {
              return (
                <div className="ld-newcar-row is-locked" key={d.dateIso}>
                  {dateLabel}
                  <span className="ld-newcar-locked">
                    会員限定
                  </span>
                </div>
              );
            }
            const open = selectedIso === d.dateIso;
            return (
              <div key={d.dateIso}>
                <button
                  type="button"
                 
                  className={`ld-newcar-row ld-newcar-rowbtn${open ? " is-open" : ""}${d.dateIso === todayIso ? " is-today" : ""}`}
                  aria-expanded={open}
                  onClick={() => setSelectedIso(open ? null : d.dateIso)}
                >
                  {dateLabel}
                  <StatusCell part={d.judgment.buy} />
                  <StatusCell part={d.judgment.delivery} />
                </button>
                {open && <NewCarDayDetail j={d.judgment} />}
              </div>
            );
          })}
        </div>
      )}

      {shown?.hasLockedDays && !isPaid && paywall}

      <style>{NEW_CAR_CSS}</style>
    </section>
  );
}

export const NEW_CAR_CSS = `
.ld-newcar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0;
}
.ld-newcar-month { font-size: 15px; font-weight: 700; color: #263a33; }
.ld-newcar-navbtn {
  appearance: none;
  border: 1px solid #d9d4c4;
  background: #ffffff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  color: #3a5568;
  cursor: pointer;
}
.ld-newcar-navbtn:disabled { color: #b8b4a8; cursor: default; }
.ld-newcar-legend { margin: 0 0 8px; font-size: 12px; color: #6a675e; }
.ld-newcar-table { border-top: 1px solid #e7e3d9; }
.ld-newcar-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 6px 4px;
  border: none;
  border-bottom: 1px solid #efece3;
  background: none;
  font: inherit;
  font-size: 13px;
  color: inherit;
  text-align: left;
}
.ld-newcar-head { font-size: 12px; font-weight: 700; color: #6a675e; min-height: 32px; }
.ld-newcar-head span:not(:first-child), .ld-newcar-status, .ld-newcar-locked { text-align: center; }
.ld-newcar-rowbtn { cursor: pointer; }
.ld-newcar-rowbtn:hover, .ld-newcar-rowbtn.is-open { background: #f4f2e9; }
.ld-newcar-rowbtn.is-today .ld-newcar-date { font-weight: 700; }
.ld-newcar-date { min-width: 0; overflow-wrap: anywhere; }
.ld-newcar-date[data-weekday="0"] { color: #8a3b2b; }
.ld-newcar-date[data-weekday="6"] { color: #3a5568; }
.ld-newcar-both {
  display: inline-block;
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e6f4ea;
  color: #1a7f37;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.ld-newcar-status { display: flex; flex-direction: column; align-items: center; line-height: 1.3; }
.ld-newcar-symbol { font-size: 16px; font-weight: 700; color: #8a8677; }
.ld-newcar-status[data-status="good"] .ld-newcar-symbol { color: #1a7f37; }
.ld-newcar-status[data-status="mixed"] .ld-newcar-symbol { color: #7a5b0a; }
.ld-newcar-tag { font-size: 10.5px; color: #8a3b2b; }
.ld-newcar-row.is-locked { color: #b8b4a8; }
.ld-newcar-locked { grid-column: 2 / 4; font-size: 12px; }
.ld-newcar-detail {
  padding: 10px 12px 12px;
  border-bottom: 1px solid #efece3;
  background: #fbfaf5;
  font-size: 13px;
}
.ld-newcar-detail-date { margin: 0 0 6px; font-weight: 700; color: #263a33; }
.ld-newcar-detail-line { margin: 0 0 4px; }
.ld-newcar-detail-list {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 10px;
  margin: 8px 0 0;
  font-size: 12px;
  color: #55524b;
}
.ld-newcar-detail-list dt { font-weight: 700; color: #6a675e; }
.ld-newcar-detail-list dd { margin: 0; overflow-wrap: anywhere; }
.ld-newcar-follower { display: block; font-size: 11.5px; color: #8a8677; }
@media (min-width: 900px) {
  .ld-newcar-card { max-width: 720px; margin-left: auto; margin-right: auto; }
  .ld-newcar-row { font-size: 14px; padding: 6px 12px; }
}
`;
