"use client";

// src/app/ziwei/AdvancedPanel.tsx
//
// 「応用編解釈」（命宮をクリックしたとき）。docs/ziwei-basic-spec.md §24。
// 紫微星の支 × 命宮の支 の項目を、条件を反映して表示する（資料の文のまま。条件が成立した文と無条件の文だけ）。
// 資料名・内部ID・条件未判定などの開発情報は表示しない（データには保持）。

import { useMemo } from "react";
import { getAdvancedInterpretation } from "@/lib/ziwei/meanings/advanced";
import type { ZiweiChart } from "@/lib/ziwei";

export default function AdvancedPanel({ chart }: { chart: ZiweiChart }) {
  const r = useMemo(() => getAdvancedInterpretation(chart), [chart]);
  const it = r.item;
  const layout = it.noMainStar ? `主星なし（対宮の${it.borrowedStars.join("・")}を借りる）` : it.displayedMainStars.join("・");
  return (
    <section className="zw-section zw-interp zw-advanced">
      <h2 className="zw-h2">応用編解釈</h2>
      <dl className="zw-advanced-head">
        <div>
          <dt>紫微星</dt>
          <dd>{it.ziweiBranch}宮</dd>
        </div>
        <div>
          <dt>命宮</dt>
          <dd>{it.mingBranch}宮</dd>
        </div>
        <div>
          <dt>配置</dt>
          <dd>{layout}</dd>
        </div>
      </dl>
      {r.paragraphs.map((p) => (
        <p key={p.id} className="zw-interp-text zw-advanced-p">
          {p.text}
        </p>
      ))}
    </section>
  );
}
