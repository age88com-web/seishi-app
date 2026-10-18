// src/app/liuren/LiurenSynthesisView.tsx
//
// 六壬神課 総合解釈の表示（Phase 5T）。
// synthesisAdapter.ts が作った総合解釈を、synthesisDisplay.ts で通常表示・詳細表示に振り分けて描画するだけ。計算・判断・文章の生成はしない。
// hooks を使わない純粋な表示部品（サーバー側で描画してテストできる。LiurenChartView と同じ方式）。
//
// 通常表示: 占的・問いの目的・意味ごとの見出しと日本語の文・判断に必要な追加情報（内部識別子を出さない）
// 詳細表示（<details>。閉じても DOM に残る）: 読みごとの技術情報（規則 ID・軸・論点・向き・推論レベル・確実性・盤の配置・FACT・出典の原文）と判断間の関係
// 表は使わず、見出しと文・項目を縦に並べる（狭い画面でも折り返しが崩れない）。

import { buildSynthesisDisplay } from "./synthesisDisplay";
import type { LiurenSynthesisView as View } from "./synthesisAdapter";

export default function LiurenSynthesisView({ view }: { view: View }) {
  const d = buildSynthesisDisplay(view);
  return (
    <section className="lr-synth" data-testid="liuren-synthesis" data-domain={view.synthesis.domain}>
      <div data-testid="liuren-synthesis-main">
        <h2 className="lr-synth-h2">{d.title}</h2>
        <dl className="lr-synth-facts">
          {d.facts.map((f) => (
            <div key={f.label} className="lr-synth-fact"><dt>{f.label}</dt><dd>{f.value}</dd></div>
          ))}
        </dl>
        <p className="lr-synth-note">成立した古典の規則の読みを、意味ごとに整理して示します。吉凶の点数や成否の断定、時期（応期）は出しません。</p>
        {d.sections.map((s) => (
          <div key={s.id} className="lr-synth-sec" data-section={s.id}>
            <h3>{s.heading}</h3>
            {s.lead && <p className="lr-synth-lead">{s.lead}</p>}
            {s.items.length > 0 && (
              <ul className="lr-synth-list">
                {s.items.map((it, i) => (
                  <li key={i} className="lr-synth-item" data-reading-indexes={it.readingIndexes.join(",")}>
                    <p className="lr-synth-sentence">{it.sentence}</p>
                    {it.tags.length > 0 && <p className="lr-synth-tags">{it.tags.join("・")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <details className="lr-synth-detail" data-testid="liuren-synthesis-detail">
        <summary>詳細（古典の出典・原文・判断規則・盤の配置・技術情報）</summary>
        {d.details.length > 0 && (
          <div className="lr-synth-sec" data-section="readings-detail">
            <h3>読みごとの詳細</h3>
            {d.details.map((r) => (
              <div key={r.index} className="lr-synth-card" data-reading-index={r.index}>
                <h4>{r.label}</h4>
                <dl className="lr-synth-kv">
                  <div><dt>根拠となる盤上の配置</dt><dd>{r.detected}</dd></div>
                  {r.directionNote && <div><dt>規則の補足</dt><dd>{r.directionNote}</dd></div>}
                  <div><dt>問いの目的に対する向き</dt><dd>{r.direction}</dd></div>
                  {r.citations.map((c, i) => (
                    <div key={i}><dt>出典{r.citations.length > 1 ? ` ${i + 1}` : ""}</dt><dd>{c.source} {c.locator}（{c.layer}）<span className="lr-synth-quote">「{c.quote}」</span></dd></div>
                  ))}
                  <div><dt>推論レベル</dt><dd>{r.level}</dd></div>
                  <div><dt>判断の確実性</dt><dd>{r.certainty}</dd></div>
                  <div><dt>規則 ID</dt><dd className="lr-synth-code">{r.ruleId}</dd></div>
                  <div><dt>判断軸</dt><dd>{r.axis}</dd></div>
                  <div><dt>論点</dt><dd>{r.topic}</dd></div>
                  <div><dt>内部 FACT</dt><dd className="lr-synth-code">{r.evidence.join("・")}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        )}
        {d.relations.length > 0 && (
          <div className="lr-synth-sec" data-section="relations">
            <h3>判断間の関係（技術情報）</h3>
            {d.relations.map((p, i) => (
              <div key={i} className="lr-synth-card" data-rule-ids={p.ruleIds.join(",")}>
                <p className="lr-synth-sentence">{p.text}</p>
                <dl className="lr-synth-kv">
                  <div><dt>判断の確実性</dt><dd>{p.certainty}</dd></div>
                  {p.ruleIds.length > 0 && <div><dt>規則 ID</dt><dd className="lr-synth-code">{p.ruleIds.join("・")}</dd></div>}
                </dl>
              </div>
            ))}
          </div>
        )}
        {d.missingKeys.length > 0 && (
          <div className="lr-synth-sec" data-section="missing-detail">
            <h3>不足の内部キー</h3>
            <dl className="lr-synth-kv">
              {d.missingKeys.map((m) => <div key={m.key}><dt className="lr-synth-code">{m.key}</dt><dd>{m.detail}</dd></div>)}
            </dl>
          </div>
        )}
      </details>
    </section>
  );
}
