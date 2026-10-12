"use client";

// src/app/ziwei/FortunePanel.tsx
//
// 「行運」欄（docs/ziwei-basic-spec.md §27・§28）。選択状態は page.tsx が持つ（鑑定日・選択中の大限・選択中の小限）。
//   鑑定日を変える → その日の大限・小限に同期（太歳宮は鑑定日だけで決まる）
//   小限のプルダウン → 小限だけ変える（その年齢を含む大限へ合わせる。鑑定日は変えない）
// 大限四化・小限四化は盤面の星の横に表示するので、ここでは一覧にしない。
// 行運の格局は選択中の大限で判定したものだけ（小限の格局は needs_review のため表示しない）。
// 太歳宮は本命の宮名と、折りたたみで三方四正（三合宮・対宮）を出す（§31。重なりの判定は taiseiInfluence で行う）。
// 大限・小限の運命指数と流年指数（§34。値は fortune.yearIndex＝選択中の小限の年齢から求めたもの）、流年指数の推移グラフ。

import { useMemo } from "react";
import { buildYearFortuneIndexSeries, minorAgeOptions } from "@/lib/ziwei/fortune";
import YearIndexChart from "./YearIndexChart";
import type { FortuneContext, FortunePatternResult, FortuneSelection } from "@/lib/ziwei/fortune";
import type { ZiweiChart } from "@/lib/ziwei";

/**
 * 行運の格局1件（画面と解釈印刷で共用）。
 * printMeanings は解釈印刷用：すでに印刷済みの象意の文を除いた文（lines）と、除いた文の参照先の注記（note）。画面では渡さない。
 */
export function FortunePattern({ p, printMeanings }: { p: FortunePatternResult; printMeanings?: { lines: string[]; note: string | null } }) {
  const lines = printMeanings ? printMeanings.lines : p.meanings;
  return (
    <div className="zw-pattern-item">
      <div className="zw-pattern-name">
        {p.name}
        <span className="zw-pattern-status is-ok">成立</span>
        <span className="zw-pattern-palaces">
          大限：{p.limit.stem}
          {p.limit.branch}
        </span>
      </div>
      <ul className="zw-mp-list">
        {p.matchedPalaces.map((m) => (
          <li key={m.branch} className="zw-mp-item">
            成立箇所：大限{m.fortunePalace}（本命の{m.natalPalace}・{m.branch}）
          </li>
        ))}
        {p.reasons.map((r, i) => (
          <li key={`r${i}`} className="zw-mp-item">
            ・{r}
          </li>
        ))}
      </ul>
      {p.meanings.length > 0 && (
        <div className="zw-pattern-meaning">
          <div className="zw-pattern-k">象意（この大限）</div>
          {lines.map((m, i) => (
            <p key={i} className="zw-pattern-text">
              {m}
            </p>
          ))}
          {printMeanings?.note && <p className="zw-pattern-text">{printMeanings.note}</p>}
        </div>
      )}
      {p.warningConditions.some((w) => w.result === "applies") && (
        <div className="zw-pattern-meaning">
          <div className="zw-pattern-k">注意</div>
          {p.warningConditions
            .filter((w) => w.result === "applies")
            .map((w, i) => (
              <div key={`w${i}`} className="zw-pattern-warn">
                {w.text}（{w.detail}）
              </div>
            ))}
        </div>
      )}
      {p.affectedPalaces.map((a) => (
        <div key={a.branch} className="zw-pattern-affected">
          影響が及ぶ宮: 大限{a.fortunePalace}（本命の{a.natalPalace}・{a.branch}）— {a.note}
        </div>
      ))}
    </div>
  );
}

export default function FortunePanel({
  chart,
  fortune,
  selection,
  onDateChange,
  onMinorChange,
  onReset,
}: {
  chart: ZiweiChart;
  fortune: FortuneContext | null;
  selection: FortuneSelection;
  onDateChange: (date: string) => void;
  onMinorChange: (age: number) => void;
  onReset: () => void;
}) {
  const options = minorAgeOptions(chart);
  const series = useMemo(() => buildYearFortuneIndexSeries(chart), [chart]);
  const yi = fortune?.yearIndex ?? null;
  const major = fortune?.majorPatterns.filter((p) => p.status === "confirmed") ?? [];
  const dateMajor = fortune ? (chart.dayun.periods.find((p) => fortune.kazoeAge >= p.startAge && fortune.kazoeAge <= p.endAge)?.startAge ?? null) : null;
  const synced =
    fortune !== null && selection.minorAge === (fortune.kazoeAge >= 1 ? fortune.kazoeAge : null) && selection.majorStartAge === dateMajor;

  return (
    <section className="zw-section zw-fortune">
      <h2 className="zw-h2">行運</h2>
      <div className="zw-fortune-controls">
        <label className="zw-field zw-fortune-date">
          鑑定日
          <input className="zw-input" type="date" value={selection.appraisalDate} onChange={(e) => onDateChange(e.target.value)} />
        </label>
        {!synced && fortune && (
          <button type="button" className="zw-level" onClick={onReset}>
            鑑定日の行運に戻す
          </button>
        )}
      </div>
      {!fortune && <div className="zw-mp-empty">鑑定日を入力してください</div>}
      {fortune && (
        <dl className="zw-fortune-list">
          <div>
            <dt>数え年</dt>
            <dd>
              {fortune.kazoeAge >= 1 ? `${fortune.kazoeAge}歳` : "出生前"}
              <span className="zw-fortune-at">（鑑定日）</span>
            </dd>
          </div>
          <div>
            <dt>大限</dt>
            <dd>
              {fortune.majorLimit
                ? `${fortune.majorLimit.ageRange![0]}〜${fortune.majorLimit.ageRange![1]}歳　${fortune.majorLimit.palaceStem}${fortune.majorLimit.palaceBranch}（${fortune.majorLimit.palaceName}）`
                : fortune.majorLimitStatus === "beforeFirst"
                  ? "大限開始前"
                  : fortune.majorLimitStatus === "afterLast"
                    ? "大限表の範囲外"
                    : "—"}
              {yi?.major && <span className="zw-fortune-idx">運命指数 {yi.major.destinyIndex.toFixed(1)}</span>}
              <span className="zw-fortune-at">（盤面の大限の年齢を押して選択）</span>
            </dd>
          </div>
          <div>
            <dt>小限</dt>
            <dd>
              <select
                className="zw-input zw-fortune-minor"
                value={selection.minorAge ?? ""}
                onChange={(e) => e.target.value && onMinorChange(Number(e.target.value))}
                aria-label="小限の数え年"
              >
                {selection.minorAge === null && <option value="">—</option>}
                {options.map((a) => (
                  <option key={a} value={a}>
                    {a}歳
                  </option>
                ))}
              </select>
              {fortune.minorLimit && (
                <>
                  {" "}
                  {fortune.minorLimit.palaceName}（{fortune.minorLimit.palaceStem}
                  {fortune.minorLimit.palaceBranch}）
                </>
              )}
              {yi?.minor && <span className="zw-fortune-idx">運命指数 {yi.minor.destinyIndex.toFixed(1)}</span>}
            </dd>
          </div>
          <div>
            <dt>流年指数</dt>
            <dd>{yi ? (yi.yearIndex === null ? "—（大限開始前）" : yi.yearIndex.toFixed(1)) : "—"}</dd>
          </div>
          <div>
            <dt>太歳宮</dt>
            <dd>
              {fortune.taisei.branch}宮（本命の{fortune.taisei.palace}）
              <span className="zw-fortune-at">
                {" "}
                {fortune.taisei.yearStem}
                {fortune.taisei.yearBranch}年（鑑定日）
              </span>
              <details className="zw-mp-more zw-taisei-sf">
                <summary>太歳の三方四正</summary>
                <ul className="zw-mp-list">
                  {[...fortune.taiseiInfluence.sanfangSizheng.trines, fortune.taiseiInfluence.sanfangSizheng.opposite].map((c) => (
                    <li key={c.palace.branch} className="zw-mp-item">
                      {c.palace.relation === "trine" ? "三合宮" : "対宮"}：{c.palace.branch}宮（本命の{c.palace.natalPalace}）
                    </li>
                  ))}
                </ul>
              </details>
            </dd>
          </div>
          <div>
            <dt>盤面の四化</dt>
            <dd className="zw-fortune-legend">
              <span className="zw-hua">禄</span> 生年　<span className="zw-fhua zw-fhua-major">大禄</span> 選択中の大限
              <span className="zw-fhua zw-fhua-minor">小禄</span> 選択中の小限
            </dd>
          </div>
        </dl>
      )}
      {fortune && <YearIndexChart series={series} selectedAge={selection.minorAge} onSelectAge={onMinorChange} />}
      {major.length > 0 && (
        <div className="zw-fortune-patterns">
          <h3 className="zw-mp-h3">行運の格局</h3>
          {major.map((p) => (
            <FortunePattern key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
