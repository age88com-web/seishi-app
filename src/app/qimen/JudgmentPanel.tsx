// src/app/qimen/JudgmentPanel.tsx
//
// 宮詳細の「成立している判断材料」と「この宮の判断材料について」（AI を使わない定型説明）。
//   既存のパイプラインを呼んで表示するだけで、分類・名称・原文・関連資料の結び付けは一切作り直さない。
//     buildQimenPalaceMaterials → serializeQimenAiInput → View → Plan → buildConfirmedMaterials
//     → buildJudgmentDisplay → buildJudgmentSummary → renderJudgmentSummaryText
//   内部 ID は表示しない（React の key にだけ使う）。
//   関連資料は buildJudgmentDisplay が related に置いたものだけを親の直下に出す（UI 側で推測して接続しない）。
//   0件のグループは一覧では省略し、定型説明側は judgmentSummary の文（「今回の分類では〜はありません」）のまま出す。
//   見た目は page.tsx の宮詳細（剋應・象意カード）と同じ値を使う。

import { useMemo } from "react";
import type { QimenResult } from "@/lib/qimen";
import { buildQimenPalaceMaterials } from "@/lib/qimenMaterials";
import {
  serializeQimenAiInput,
  buildQimenGenerationView,
  buildQimenGenerationPlan,
  buildConfirmedMaterials,
  buildJudgmentDisplay,
  buildJudgmentSummary,
  renderJudgmentSummaryText,
} from "@/lib/qimenAiMaterials";
import type { JudgmentGroupKey, JudgmentItem, QimenJudgmentDisplay } from "@/lib/qimenAiMaterials";

const GROUP_ORDER: JudgmentGroupKey[] = ["favorable", "cautionPalace", "cautionWholeChart", "unclassifiedKokuo"];

/** 選択宮の確定判断材料（表示用構造）と定型説明の段落を作る。AI は使わない。 */
export function buildPalaceJudgment(result: QimenResult, palace: number): {
  display: QimenJudgmentDisplay;
  paragraphs: string[];
} {
  const full = serializeQimenAiInput(buildQimenPalaceMaterials(result, palace));
  const plan = buildQimenGenerationPlan(buildQimenGenerationView(full));
  const confirmed = buildConfirmedMaterials(plan);
  const display = buildJudgmentDisplay({ plan, confirmed, full });
  const { paragraphs } = renderJudgmentSummaryText(buildJudgmentSummary(display));
  return { display, paragraphs };
}

/** 材料の補助情報（種類・吉凶・範囲・内訳・静動・組み合わせ）。既存の値だけを並べる。 */
function itemMeta(i: JudgmentItem): string {
  return [
    i.type,
    // 格局は fortune が「吉格／凶格」で種類と同じになるため重ねて出さない
    i.fortune && i.fortune !== i.type ? i.fortune : null,
    i.scope,
    i.detail ? `内訳：${i.detail}` : null,
    i.judgeDetail ? `判定の内訳：${i.judgeDetail}` : null,
    i.mode,
    i.combination,
  ].filter(Boolean).join(" / ");
}

/** 原文（sourceText.display）。複数ある場合だけ各原文の見出しを付ける。 */
function SourceTexts({ item }: { item: JudgmentItem }) {
  const multi = item.sourceText.length > 1;
  return (
    <>
      {item.sourceText.map((t, idx) => (
        <div key={idx} style={J.sourceBlock}>
          {multi && <div style={J.sourceLabel}>{t.label}</div>}
          <div style={J.body} className="qm-kokuo-body">{t.display}</div>
        </div>
      ))}
    </>
  );
}

function JudgmentEntry({ item }: { item: JudgmentItem }) {
  return (
    <div style={J.entry} className="qm-kokuo-entry">
      <div style={J.name} className="qm-kokuo-meta">{item.label}</div>
      <div style={J.meta}>{itemMeta(item)}</div>
      <SourceTexts item={item} />
      {item.related.map((r) => (
        <div key={r.id} style={J.related}>
          <div style={J.relatedTitle}>関連資料：{r.label}</div>
          <div style={J.meta}>{itemMeta(r)}</div>
          <SourceTexts item={r} />
        </div>
      ))}
    </div>
  );
}

export default function JudgmentPanel({ result, palace }: { result: QimenResult; palace: number }) {
  const built = useMemo(() => {
    try {
      return { ok: true as const, ...buildPalaceJudgment(result, palace) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [result, palace]);

  if (!built.ok) {
    return (
      <>
        <div style={J.subTitle} className="qm-subtitle">成立している判断材料</div>
        <div style={J.section}>
          <div style={J.empty}>判断材料を作成できませんでした: {built.error}</div>
        </div>
      </>
    );
  }

  const { display, paragraphs } = built;
  const groups = GROUP_ORDER.map((k) => display.groups[k]).filter((g) => g.items.length > 0);

  return (
    <>
      <div style={J.subTitle} className="qm-subtitle">成立している判断材料</div>
      {groups.length === 0 && display.unlinked.length === 0 ? (
        <div style={J.section}>
          <div style={J.empty}>—</div>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.title} style={J.section} className="qm-kokuo-section">
              <div style={J.groupTitle} className="qm-kokuo-label">【{g.title}】</div>
              {g.items.map((i) => <JudgmentEntry key={i.id} item={i} />)}
            </div>
          ))}
          {/* 対応格局を確定できなかった関連資料（既存ロジックでつながなかったもの）。どの材料にも接続しない。 */}
          {display.unlinked.length > 0 && (
            <div style={J.section} className="qm-kokuo-section">
              <div style={J.groupTitle} className="qm-kokuo-label">【対応する格局を確定できなかった関連資料】</div>
              {display.unlinked.map((u) => <JudgmentEntry key={u.item.id} item={u.item} />)}
            </div>
          )}
        </>
      )}

      <div style={J.subTitle} className="qm-subtitle">この宮の判断材料について</div>
      <div style={J.section}>
        {paragraphs.map((p, idx) => (
          <p key={idx} style={J.paragraph}>{p}</p>
        ))}
      </div>
    </>
  );
}

// page.tsx の宮詳細（detailSubTitle / kokuoSection / kokuoLabel / kokuoMeta / kokuoBody）と同じ値。
const J: Record<string, React.CSSProperties> = {
  subTitle: { fontSize: 11, color: "#999", padding: "8px 10px 2px", borderTop: "1px solid #eee" },
  section: { padding: "6px 10px", borderBottom: "1px solid #f0f0f0" },
  groupTitle: { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  empty: { fontSize: 13, color: "#888" },
  entry: { marginBottom: 10 },
  name: { fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 1 },
  meta: { fontSize: 11, color: "#888", marginBottom: 2 },
  sourceBlock: { marginTop: 2 },
  sourceLabel: { fontSize: 11, color: "#555" },
  body: { fontSize: 12, color: "#444", whiteSpace: "pre-wrap", lineHeight: 1.6 },
  related: { marginTop: 6, marginLeft: 10, paddingLeft: 8, borderLeft: "2px solid #e5e5e5" },
  relatedTitle: { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 1 },
  paragraph: { fontSize: 12, color: "#444", lineHeight: 1.7, margin: "0 0 6px" },
};
