"use client";

// src/app/ziwei/InterpretationPanel.tsx
//
// 「解釈」。宮をクリックすると、buildRuleBasedInterpretation() が資料の文だけから組み立てた
// 宮別解釈をテーマ別に表示する（AI は使わない。同じ入力なら同じ文章）。
// 各節の「判断根拠」には、対象の星・宮・旺衰・力量の条件・同宮・加会・四化から作った説明を出す（§35）。
// 資料の原文・資料名・ページ・内部IDは表示しない（出典はデータに保持）。

import { useMemo, useState } from "react";
import { buildRuleBasedInterpretation } from "@/lib/ziwei/meanings";
import type { AiDetailLevel, PalaceMeaningContext } from "@/lib/ziwei/meanings";

const LEVELS: readonly AiDetailLevel[] = ["brief", "standard", "detailed"];
const LEVEL_LABEL: Readonly<Record<AiDetailLevel, string>> = {
  brief: "簡潔",
  standard: "標準",
  detailed: "詳細",
};

export default function InterpretationPanel({
  ctx,
}: {
  ctx: PalaceMeaningContext;
}) {
  const [level, setLevel] = useState<AiDetailLevel>("standard");
  const r = useMemo(
    () => buildRuleBasedInterpretation(ctx, { detailLevel: level }),
    [ctx, level],
  );

  return (
    <section className="zw-section zw-interp">
      <h2 className="zw-h2">
        解釈 — {r.palace.name}（{r.palace.branch}）
      </h2>
      <div className="zw-levels" role="group" aria-label="詳しさ">
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            className={lv === level ? "zw-level is-active" : "zw-level"}
            aria-pressed={lv === level}
            onClick={() => setLevel(lv)}
          >
            {LEVEL_LABEL[lv]}
          </button>
        ))}
      </div>

      {r.sections.every((sec) => sec.text === "") && (
        <div className="zw-mp-empty">この宮についての記述はありません</div>
      )}
      {r.sections
        .filter((sec) => sec.text !== "")
        .map((sec) => (
          <div key={sec.theme} className="zw-interp-sec">
            <h3 className="zw-interp-theme">{sec.theme}</h3>
            <p className="zw-interp-text">{sec.text}</p>
            <details className="zw-mp-more">
              <summary>判断根拠</summary>
              <ul className="zw-mp-list">
                {sec.basis.map((b) => (
                  <li key={b} className="zw-mp-item">
                    {b}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
    </section>
  );
}
