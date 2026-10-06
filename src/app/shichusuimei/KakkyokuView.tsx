// src/app/shichusuimei/KakkyokuView.tsx
//
// 強弱・格局の補助判定の表示（術者向けの短い根拠表示）。
// ① エンジン判定（格局候補）② 内格補助 ③ 術者最終判断 を分けて表示する（KD19）。
// 計算は src/lib/shichusuimei/kakkyoku に任せ、ここでは並べるだけ。最終判断は術者。

import { FINAL_PATTERN_OPTIONS, FINAL_STRENGTH_OPTIONS, santokuSideOf } from "@/lib/shichusuimei/kakkyoku";
import type {
  CandidateStatus,
  FinalPatternOption,
  FinalStrengthOption,
  KakkyokuResult,
  PractitionerDecision,
  Tristate,
} from "@/lib/shichusuimei/kakkyoku";

const MARK: Record<Tristate, string> = { yes: "○", no: "×", undetermined: "△" };
const TOUTA: Record<string, string> = { touta: "党多", notTouta: "党多ではない", borderline: "境界" };
const STATUS: Record<CandidateStatus, string> = {
  confirmed_by_engine: "成立（機械判定）",
  candidate: "候補",
  provisional: "参考候補",
  needs_review: "要確認",
  not_applicable: "対象外",
};
const pct = (a: number, b: number) => `${a.toFixed(0)}〜${b.toFixed(0)}%`;
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function KakkyokuView({
  k,
  decision,
  onDecisionChange,
}: {
  k: KakkyokuResult;
  decision: PractitionerDecision;
  onDecisionChange: (d: PractitionerDecision) => void;
}) {
  const s = k.strength;
  const cls = s.classification ?? s.classificationCandidates.join("・");
  const fb = s.forceBalance.byElement;
  const notes = [...s.weakeningFactors, ...s.reviewNotes];
  const shown = k.candidates.filter((c) => c.uiVisible);
  const inner = k.innerScore;

  return (
    <section className="sc-section">
      {k.referenceOnly && <div className="sc-ref">出生時刻不明のため、強弱・格局は参考判定です</div>}
      <div className="sc-kk">
        <div className="sc-kk-box">
          <h3 className="sc-h3">三得・力量</h3>
          <div className="sc-kk-main">
            三得：{cls}
            {s.classification ? "" : "（候補）"}
          </div>
          <div>三得では{santokuSideOf(s.classificationCandidates)}</div>
          <div>
            得令 {MARK[s.tokurei.value]}　得勢 {MARK[s.tokusei.value]}　得地 {MARK[s.tokuchi.value]}
          </div>
          <div>
            党多：{TOUTA[s.touta.level]}（比劫＋印 {pct(s.touta.share.minPercent, s.touta.share.maxPercent)}）
          </div>
          <div className="sc-muted">
            力量 木{fb.木.min}〜{fb.木.max} 火{fb.火.min}〜{fb.火.max} 土{fb.土.min}〜{fb.土.max} 金{fb.金.min}〜{fb.金.max} 水{fb.水.min}〜{fb.水.max}
          </div>
          <div className="sc-muted">根：{s.rootStrength}</div>
          {notes.map((n) => (
            <div key={n} className="sc-kk-note">補足：{n}</div>
          ))}
        </div>

        <div className="sc-kk-box">
          <h3 className="sc-h3">格局候補（機械判定）</h3>
          {shown.map((c) => (
            <div key={c.name + (c.subName ?? "")}>
              <b>{c.subName ? `${c.name}（${c.subName}）` : c.name}</b>：{STATUS[c.status]}
              <span className="sc-muted">　{c.basis.join("／")}</span>
              {c.notes.map((n) => (
                <div key={n} className="sc-kk-note">{n}</div>
              ))}
            </div>
          ))}
          {k.hehua
            .filter((h) => h.stemCombination !== "none")
            .map((h) => (
              <div key={h.position} className="sc-kk-hehua">
                <div>干合：{h.stems!.join("")}（{h.position}）</div>
                <div>化五行：{h.transformElement}</div>
                <div>月支：{h.monthBranch}</div>
                <div>
                  月支条件：{h.monthCondition ? "成立" : "不成立"}
                  <span className="sc-muted">（{h.requiredMonthBranches!.join("・")}）</span>
                </div>
                {h.monthCondition ? (
                  <>
                    <div>補強：{h.supports.length ? h.supports.join("／") : "なし"}</div>
                    {h.references.length > 0 && (
                      <div className="sc-muted">参考（補強に数えない）：{h.references.join("／")}</div>
                    )}
                    {h.monthRelations.length ? (
                      <div>
                        月支関係（要術者判断）：
                        {h.monthRelations.map((r) => (
                          <div key={r}>・{r}</div>
                        ))}
                      </div>
                    ) : (
                      <div>月支関係：なし</div>
                    )}
                    <div>判定：{h.stemCombination === "hehuaCandidateSupported" ? "化格候補（補強あり）" : "化格候補"}</div>
                    <div>最終判断：術者</div>
                  </>
                ) : (
                  <div>判定：合去</div>
                )}
              </div>
            ))}
          <div className="sc-kk-final">
            {k.route === "naikaku" ? "外格候補なし → 内格" : "外格・特殊格局候補あり（要術者確認）"}
          </div>
        </div>

        <div className="sc-kk-box">
          <h3 className="sc-h3">内格補助</h3>
          {inner && (
            <>
              <div className="sc-kk-main">
                {k.innerScoreScope === "naikaku" ? "内格補助" : "内格として見る場合"}：{inner.judgment}
              </div>
              {k.innerScoreScope !== "naikaku" && <div className="sc-muted">内格補助点は参考（外格・特殊格局候補あり）</div>}
              <div>比劫＋印：{num(inner.supportingSide.points)}</div>
              <div>食傷＋財＋官：{num(inner.weakeningSide.points)}</div>
              <div>
                {inner.judgment === "身強" ? "日主側が優勢" : inner.judgment === "身弱" ? "反対側が優勢" : "拮抗"}
              </div>
              {inner.helps.length > 0 && (
                <div>
                  主な助け：
                  {inner.helps.map((h) => (
                    <div key={h} className="sc-kk-help">・{h}</div>
                  ))}
                </div>
              )}
              <div className="sc-muted">
                五行 木 {num(inner.byElement.木)} / 火 {num(inner.byElement.火)} / 土 {num(inner.byElement.土)} / 金 {num(inner.byElement.金)} / 水 {num(inner.byElement.水)}
              </div>
              <div className="sc-muted">
                日干（{inner.dayMaster.stem}）：{num(inner.dayMaster.points)}（計算の一要素）
              </div>
              <div className="sc-muted">
                {inner.byStem.map((x) => `${x.pillar}干${x.stem} ${num(x.total)}`).join("　")}
              </div>
              <div className="sc-kk-final">最終判断：術者</div>
            </>
          )}
        </div>
      </div>

      <DecisionPrint decision={decision} />
      <div className="sc-kk-box sc-kk-decision sc-no-print">
        <h3 className="sc-h3">術者最終判断</h3>
        <label className="sc-field">
          最終格局
          <select
            className="sc-input"
            value={decision.finalPattern ?? ""}
            onChange={(e) =>
              onDecisionChange({ ...decision, finalPattern: (e.target.value || null) as FinalPatternOption | null })
            }
          >
            <option value="">（未選択）</option>
            {FINAL_PATTERN_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="sc-field">
          最終強弱
          <select
            className="sc-input"
            value={decision.finalStrength ?? ""}
            onChange={(e) =>
              onDecisionChange({ ...decision, finalStrength: (e.target.value || null) as FinalStrengthOption | null })
            }
          >
            <option value="">（未選択）</option>
            {FINAL_STRENGTH_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        {decision.finalPattern === "その他" && (
          <label className="sc-field">
            格局名
            <input
              className="sc-input"
              value={decision.otherText}
              onChange={(e) => onDecisionChange({ ...decision, otherText: e.target.value })}
            />
          </label>
        )}
        {decision.finalPattern && (
          <label className="sc-field">
            表示名（任意）
            <input
              className="sc-input"
              placeholder="例: 一行得気格（潤下格）"
              value={decision.finalPatternLabel}
              onChange={(e) => onDecisionChange({ ...decision, finalPatternLabel: e.target.value })}
            />
          </label>
        )}
        <label className="sc-field">
          メモ
          <input className="sc-input" value={decision.note} onChange={(e) => onDecisionChange({ ...decision, note: e.target.value })} />
        </label>
      </div>
    </section>
  );
}

/** 印刷用の術者最終判断（入力欄の代わりに、入力済みの項目だけを文で出す） */
export function DecisionPrint({ decision: d }: { decision: PractitionerDecision }) {
  const rows: [string, string][] = [];
  if (d.finalPattern) {
    rows.push(["最終格局", d.finalPattern === "その他" && d.otherText.trim() ? `その他（${d.otherText.trim()}）` : d.finalPattern]);
  }
  if (d.finalPattern && d.finalPatternLabel.trim()) rows.push(["表示名", d.finalPatternLabel.trim()]);
  if (d.finalStrength) rows.push(["最終強弱", d.finalStrength]);
  if (d.note.trim()) rows.push(["メモ", d.note.trim()]);
  return (
    <div className="sc-kk-box sc-print-only sc-kk-decision-print">
      <h3 className="sc-h3">術者最終判断</h3>
      {rows.length === 0 ? (
        <div className="sc-muted">未記入</div>
      ) : (
        rows.map(([k, v]) => (
          <div key={k}>
            <span className="sc-print-key">{k}</span>
            {v}
          </div>
        ))
      )}
    </div>
  );
}
