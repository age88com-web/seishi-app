"use client";

// src/app/ziwei/PatternPanel.tsx
//
// 「格局」欄（基礎２ 本編33格。docs/ziwei-basic-spec.md §23）。盤面の下に常に表示する。
//   成立 … 格局名・成立箇所・象意（常時表示）・注意（破格しやすい等）・影響が及ぶ宮・成立根拠（折りたたみ）
//   条件一致・要確認 … 条件には一致するが資料上の問題が残るもの（成立とは断定しない。象意は「成立した場合の象意」）
// 資料名・ページ・内部ID・開発用の判定一覧は表示しない（データには保持）。

import { useMemo } from "react";
import { evaluatePatterns, patternCautions } from "@/lib/ziwei/patterns";
import type { PatternResult } from "@/lib/ziwei/patterns";
import type { ZiweiChart } from "@/lib/ziwei";

const palaces = (p: PatternResult) => p.matchedPalaces.map((m) => `${m.palace}（${m.branch}）`).join("・");

function PatternItem({ p, review }: { p: PatternResult; review: boolean }) {
  const cautions = patternCautions(p);
  return (
    <div className="zw-pattern-item">
      <div className="zw-pattern-name">
        {p.name}
        <span className={review ? "zw-pattern-status" : "zw-pattern-status is-ok"}>{review ? "条件一致・要確認" : "成立"}</span>
      </div>
      <div className="zw-pattern-at">成立箇所：{palaces(p)}</div>
      {p.meanings.length > 0 && (
        <div className="zw-pattern-meaning">
          <div className="zw-pattern-k">{review ? "成立した場合の象意" : "象意"}</div>
          {p.meanings.map((m, i) => (
            <p key={i} className="zw-pattern-text">
              {m}
            </p>
          ))}
        </div>
      )}
      {cautions.length > 0 && (
        <div className="zw-pattern-meaning">
          <div className="zw-pattern-k">注意</div>
          {cautions.map((c, i) => (
            <div key={i} className="zw-pattern-warn">
              {c}
            </div>
          ))}
        </div>
      )}
      {p.affectedPalaces.map((a, i) => (
        <div key={`a${i}`} className="zw-pattern-affected">
          影響が及ぶ宮：{a.palace}（{a.branch}）— {a.note}
        </div>
      ))}
      <details className="zw-mp-more">
        <summary>成立根拠</summary>
        <ul className="zw-mp-list">
          {p.reasons.map((x, i) => (
            <li key={i} className="zw-mp-item">
              ・{x}
            </li>
          ))}
          {/* 補足（成立条件ではない吉意。§37.5） */}
          {p.enhancementConditions
            .filter((e) => e.result === "applies")
            .map((e, i) => (
              <li key={`e${i}`} className="zw-mp-item">
                ・補足 {e.text}: {e.detail}
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}

export default function PatternPanel({ chart }: { chart: ZiweiChart }) {
  const r = useMemo(() => evaluatePatterns(chart), [chart]);
  return (
    <section className="zw-section zw-pattern">
      <h2 className="zw-h2">格局</h2>
      {r.confirmed.length === 0 && <div className="zw-mp-empty">成立した格局はありません</div>}
      {r.confirmed.map((p) => (
        <PatternItem key={p.id} p={p} review={false} />
      ))}
      {r.matchedNeedsReview.length > 0 && (
        <div className="zw-pattern-review">
          <h3 className="zw-mp-h3">条件一致・要確認（成立とは断定しない）</h3>
          {r.matchedNeedsReview.map((p) => (
            <PatternItem key={p.id} p={p} review />
          ))}
        </div>
      )}
    </section>
  );
}
