"use client";

// src/app/lucky-day/TravelMonthlyCard.tsx
//
// 役割:
//   一般向け擇日サービスの「海外旅行・観光の吉日」月間一覧（専用ページ /lucky-day/travel に置く。
//   ページの見出し・説明文はページ側が持つ）。判定は Server Action
//   （getTravelMonthAction → travelJudgment.ts）が行い、ここは表示だけを担う。
//   月切替・詳細の開閉・根拠表示・スタイルは新車の月間一覧（NewCarMonthlyCard.tsx）と同じものを使い、
//   列は「日付／旅行の出発」の2列にする。
//
// 無料/有料:
//   無料版で表示できない日はサーバーが locked として返す（判定データは届かない）。
//   月の切替範囲は無料版の範囲（今日〜今日+30日）を含む月に限るが、これは UI ヒントで、
//   実際の制限はサーバー側にある。
//
// 個人の忌日（2026-10-27）:
//   birth（有料会員がページで入力した生年月日）を Server Action に渡し、サーバーが既存の個人判定を
//   付けて返す。一覧は travelDisplayStatus()（一般の判定 → 個人の忌日）で表示し、
//   詳細では一般の旅行判定と個人の忌日を分けて表示する。

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTravelMonthAction } from "@/lib/luckyDay/travelActions";
import type { TravelMonth } from "@/lib/luckyDay/travelMonth";
import { shiftYearMonth, NEW_CAR_MIN_YEAR, NEW_CAR_MAX_YEAR } from "@/lib/luckyDay/newCarMonth";
import {
  TRAVEL_DISPLAY_LABEL,
  TRAVEL_DISPLAY_SYMBOL,
  TRAVEL_EXCLUSION_NAMES,
  TRAVEL_STATUS_LABEL,
  describeTravelDay,
  describeTravelPersonal,
  travelDisplayStatus,
  travelDisplayTag,
} from "@/lib/luckyDay/travelJudgment";
import type { TravelDayJudgment } from "@/lib/luckyDay/travelJudgment";
import type { LuckyDayBirthInput } from "@/lib/luckyDay/personalJudgment";
import type { PersonalTakujitsuResult } from "@/lib/takujitsu/personal";
import { parseIsoDate, WEEKDAY_JA_SHORT } from "@/lib/luckyDay";
import { NEW_CAR_CSS, SourceCell } from "./NewCarMonthlyCard";

function TravelDayDetail({ j, personal }: { j: TravelDayJudgment; personal: PersonalTakujitsuResult | null }) {
  const { year, month, day } = parseIsoDate(j.dateIso);
  const personalText = describeTravelPersonal(j, personal);
  return (
    <div className="ld-newcar-detail">
      <p className="ld-newcar-detail-date">
        {year}年{month}月{day}日（{WEEKDAY_JA_SHORT[j.weekday]}）・日干支：{j.dayStem}
        {j.dayBranch}
      </p>
      <p className="ld-newcar-detail-line">{describeTravelDay(j)}</p>
      {personalText && <p className="ld-newcar-detail-line">個人の忌日：{personalText}</p>}
      <dl className="ld-newcar-detail-list">
        <dt>旅行の出発</dt>
        <dd>{TRAVEL_STATUS_LABEL[j.status]}</dd>
        {personal && (
          <>
            <dt>個人の忌日</dt>
            <dd>
              {personal.status === "avoid"
                ? `該当（${personal.reasons.map((r) => r.type).join("・")}）`
                : personal.status === "clear"
                  ? "該当なし"
                  : "判定できません"}
            </dd>
          </>
        )}
        <dt>遠行の宜</dt>
        <SourceCell sources={j.positiveSources} followers={j.positiveFollowers} />
        <dt>遠行の忌</dt>
        <SourceCell sources={j.negativeSources} followers={j.negativeFollowers} />
        {TRAVEL_EXCLUSION_NAMES.map((n) => (
          <ExclusionRow key={n} name={n} on={j.exclusions.includes(n)} />
        ))}
        <dt>追加除外</dt>
        <dd>{j.exclusions.length === 0 ? "なし" : j.exclusions.join("・")}</dd>
      </dl>
    </div>
  );
}

/** 必須除外（月破・歸忌・往亡）1件分の成立有無。 */
function ExclusionRow({ name, on }: { name: string; on: boolean }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{on ? "成立" : "なし"}</dd>
    </>
  );
}

function StatusCell({ j, personal }: { j: TravelDayJudgment; personal: PersonalTakujitsuResult | null }) {
  const status = travelDisplayStatus(j, personal);
  const tag = travelDisplayTag(j, personal);
  return (
    <span className="ld-newcar-status" data-status={status} aria-label={TRAVEL_DISPLAY_LABEL[status]}>
      <span className="ld-newcar-symbol">{TRAVEL_DISPLAY_SYMBOL[status]}</span>
      {tag && <span className="ld-newcar-tag">{tag}</span>}
    </span>
  );
}

export default function TravelMonthlyCard({
  todayIso,
  freeMaxDateIso,
  isPaid,
  paywall,
  birth = null,
}: {
  todayIso: string;
  freeMaxDateIso: string;
  isPaid: boolean;
  /** 無料版の範囲外の日があるときに表示する既存の有料案内。 */
  paywall: ReactNode;
  /** 有料会員が入力した生年月日（未入力は null）。個人判定はサーバー側で有料会員のときだけ行う。 */
  birth?: LuckyDayBirthInput | null;
}) {
  const today = parseIsoDate(todayIso);
  const [ym, setYm] = useState({ year: today.year, month: today.month });
  // 取得したデータは「年月＋生年月日」のキーと組で持ち、条件が変わったら古い結果を表示しない。
  const [data, setData] = useState<{ key: string; month: TravelMonth } | null>(null);
  // 取得に失敗した条件のキー。表示中の条件と一致するときだけエラーを出す。
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const birthKey = birth ? `${birth.year}-${birth.month}-${birth.day}` : "";
  const queryKey = `${ym.year}-${ym.month}|${birthKey}`;

  useEffect(() => {
    let cancelled = false;
    const key = queryKey;
    getTravelMonthAction(ym.year, ym.month, birth ?? undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setData({ key, month: res.data });
        else setErrorKey(key);
      })
      .catch(() => {
        if (!cancelled) setErrorKey(key);
      });
    return () => {
      cancelled = true;
    };
    // birth は birthKey（queryKey）で比較する（オブジェクトの同一性では判定しない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const shown = data && data.key === queryKey ? data.month : null;
  const error = errorKey === queryKey ? "吉日の一覧を取得できませんでした。" : null;
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
    <section className="ld-card ld-newcar-card ld-travel-card">
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
            <span>旅行の出発</span>
          </div>
          {shown.days.map((d) => {
            const { day } = parseIsoDate(d.dateIso);
            const dateLabel = (
              <span className="ld-newcar-date" data-weekday={d.weekday}>
                {ym.month}月{day}日（{WEEKDAY_JA_SHORT[d.weekday]}）
              </span>
            );
            if (d.locked) {
              return (
                <div className="ld-newcar-row is-locked" key={d.dateIso}>
                  {dateLabel}
                  <span className="ld-newcar-locked">会員限定</span>
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
                  <StatusCell j={d.judgment} personal={d.personal} />
                </button>
                {open && <TravelDayDetail j={d.judgment} personal={d.personal} />}
              </div>
            );
          })}
        </div>
      )}

      {shown?.hasLockedDays && !isPaid && paywall}

      <style>{NEW_CAR_CSS + TRAVEL_CSS}</style>
    </section>
  );
}

// 新車の一覧（3列）と同じスタイルを使い、列数だけ2列にする。
const TRAVEL_CSS = `
.ld-travel-card .ld-newcar-row { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
.ld-travel-card .ld-newcar-locked { grid-column: 2 / 3; }
`;
