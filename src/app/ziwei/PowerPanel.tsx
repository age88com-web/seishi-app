"use client";

// src/app/ziwei/PowerPanel.tsx
//
// 「星の力量・運命指数」（§22）。宮をクリックすると、その宮の星の力量と宮の運命指数（段階）を表示する。
// 計算の根拠・使用表・出典・計算式は表示しない（計算は calculateChartPower。データには保持）。

import type { PalaceMeaningContext } from "@/lib/ziwei/meanings";

const short = (s: string) => s.replace(/星$/, "");

export default function PowerPanel({ ctx }: { ctx: PalaceMeaningContext }) {
  const p = ctx.power.palace;
  return (
    <section className="zw-section zw-power-panel">
      <h2 className="zw-h2">
        星の力量・運命指数 — {p.palace}（{p.branch}）
      </h2>
      <table className="zw-kv zw-power-table">
        <tbody>
          {p.stars.map((s) => (
            <tr key={`${s.star}${s.attachedTo ?? ""}`}>
              <td>{s.attachedTo ? `${short(s.star)}（${short(s.attachedTo)}）` : s.star}</td>
              <td>{s.finalPower}</td>
            </tr>
          ))}
          {p.stars.length === 0 && (
            <tr>
              <td colSpan={2}>力量のある星なし</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="zw-power-sum">
        宮の運命指数　<strong>{p.index.toFixed(1)}　{p.grade}</strong>
      </div>
    </section>
  );
}
