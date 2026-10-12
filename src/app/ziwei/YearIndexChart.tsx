"use client";

// src/app/ziwei/YearIndexChart.tsx
//
// 流年指数の推移（docs/ziwei-basic-spec.md §34。入門 p.100「流年指数を算出し、表にし、グラフを描く」）。
// 横軸＝数え年、縦軸＝流年指数の1本の折れ線。値は buildYearFortuneIndexSeries の結果をそのまま描く（ここで計算しない）。
// 計算できない年齢（大限開始前）は線を描かない。吉凶の色分け・区切りは付けない。
// 選択中の小限の年齢を縦線と点で示し、年齢の位置を押すとその年齢の小限を選ぶ（鑑定日は変えない）。
// 解釈印刷でも同じ部品を使う（onSelectAge を渡さない＝押す領域なし・selectedAge は null）。

import type { YearFortuneIndex } from "@/lib/ziwei/fortune";

const W = 760;
const H = 190;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

export default function YearIndexChart({
  series,
  selectedAge,
  onSelectAge,
}: {
  series: YearFortuneIndex[];
  selectedAge: number | null;
  onSelectAge?: (age: number) => void;
}) {
  const vals = series.filter((s) => s.yearIndex !== null).map((s) => s.yearIndex!);
  if (vals.length === 0) return null;
  const minAge = series[0].age;
  const maxAge = series[series.length - 1].age;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (age: number) => PAD.l + ((age - minAge) / (maxAge - minAge || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  // 計算できない年齢で線を切る
  const segments: string[] = [];
  let cur: string[] = [];
  for (const s of series) {
    if (s.yearIndex === null) {
      if (cur.length) segments.push(cur.join(" "));
      cur = [];
    } else cur.push(`${x(s.age).toFixed(1)},${y(s.yearIndex).toFixed(1)}`);
  }
  if (cur.length) segments.push(cur.join(" "));
  const sel = selectedAge !== null ? series.find((s) => s.age === selectedAge) : undefined;
  const ticks = series.filter((s) => s.age === minAge || s.age % 10 === 0).map((s) => s.age);
  const step = (W - PAD.l - PAD.r) / (maxAge - minAge || 1);

  return (
    <div className="zw-yearindex">
      <h3 className="zw-mp-h3">流年指数の推移</h3>
      <svg className="zw-yearindex-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="流年指数の推移（横軸 数え年・縦軸 流年指数）">
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="zw-yi-axis" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="zw-yi-axis" />
        <text x={PAD.l - 4} y={y(hi) + 4} className="zw-yi-label" textAnchor="end">
          {hi.toFixed(1)}
        </text>
        <text x={PAD.l - 4} y={y(lo) + 4} className="zw-yi-label" textAnchor="end">
          {lo.toFixed(1)}
        </text>
        {ticks.map((a) => (
          <text key={a} x={x(a)} y={H - 8} className="zw-yi-label" textAnchor="middle">
            {a}
          </text>
        ))}
        {segments.map((pts, i) => (
          <polyline key={i} points={pts} className="zw-yi-line" />
        ))}
        {sel && (
          <g>
            <line x1={x(sel.age)} y1={PAD.t} x2={x(sel.age)} y2={H - PAD.b} className="zw-yi-sel" />
            {sel.yearIndex !== null && <circle cx={x(sel.age)} cy={y(sel.yearIndex)} r={4} className="zw-yi-dot" />}
          </g>
        )}
        {onSelectAge && series.map((s) => (
          <rect
            key={s.age}
            x={x(s.age) - step / 2}
            y={PAD.t}
            width={step}
            height={H - PAD.t - PAD.b}
            className="zw-yi-hit"
            data-age={s.age}
            onClick={() => onSelectAge(s.age)}
          >
            <title>{`${s.age}歳　流年指数 ${s.yearIndex === null ? "—" : s.yearIndex.toFixed(1)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="zw-yi-note">
        {sel ? `${sel.age}歳　流年指数 ${sel.yearIndex === null ? "—（大限開始前）" : sel.yearIndex.toFixed(1)}` : ""}
      </div>
    </div>
  );
}
