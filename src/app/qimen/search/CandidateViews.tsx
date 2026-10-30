"use client";

// src/app/qimen/search/CandidateViews.tsx
//
// 吉格日時検索の鑑定情報表示（Phase 4A・2026-10-16）。
//   ・PalaceSummaryBlock … 検索結果カード内の成立宮ごとの要約（方位・八門・九星・八神・干・吉格・凶格）
//   ・CandidateDetailView … 詳細展開（剋應5系統・婚姻に関する参考情報）
//   ・CompareTable        … 比較候補の比較表（画面・印刷共通）
//   表示する値は src/lib/qimenSearch/candidateInfo.ts が既存の計算結果・剋應・象意データから
//   並べたものだけで、新しい象意・判定・点数は作らない。

import { calculate } from "@/lib/qimen";
import { stripRuby } from "../stripRuby";
import type { KokuoEntry } from "@/lib/qimen";
import {
  buildCandidateDetail,
  flattenKokuo,
  kokuoCategoryLabel,
  kokuoShortLabel,
  KOKUO_TRADITION_LABEL,
  palaceDirectionLabel,
  stemLabel,
} from "@/lib/qimenSearch/candidateInfo";
import type { CandidateDetail, MarriageReference, PalaceSummaryInfo } from "@/lib/qimenSearch/candidateInfo";
import type { QimenSearchHit } from "@/lib/qimenSearch/types";

function pad(x: number): string {
  return String(x).padStart(2, "0");
}
export function hitDateTimeLabel(hit: Pick<QimenSearchHit, "year" | "month" | "day" | "hour" | "minute">): string {
  return `${hit.year}-${pad(hit.month)}-${pad(hit.day)} ${pad(hit.hour)}:${pad(hit.minute)}`;
}

/** 比較候補（日時×宮）。 */
export interface CompareCandidate {
  key: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timezone: string;
  palace: number;
}

export function candidateKey(hit: Pick<QimenSearchHit, "year" | "month" | "day" | "hour" | "minute">, palace: number): string {
  return `${hitDateTimeLabel(hit)}|${palace}`;
}

/** 候補の日時の盤を再計算して、宮の鑑定情報一式を作る（既存の calculate と剋應参照を呼ぶだけ）。 */
export function loadCandidateDetail(c: Pick<CompareCandidate, "year" | "month" | "day" | "hour" | "minute" | "timezone" | "palace">): CandidateDetail | null {
  try {
    const result = calculate({ year: c.year, month: c.month, day: c.day, hour: c.hour, minute: c.minute, timezone: c.timezone });
    return buildCandidateDetail(result, c.palace);
  } catch {
    return null;
  }
}

const join = (xs: string[]) => (xs.length > 0 ? xs.join("・") : "—");

/** 検索結果カード内の、成立宮1つ分の要約。 */
export function PalaceSummaryBlock({
  s,
  checked,
  onToggleCompare,
}: {
  s: PalaceSummaryInfo;
  checked: boolean;
  onToggleCompare: () => void;
}) {
  return (
    <div style={V.palaceBlock}>
      <div style={V.palaceHead}>
        <span style={V.palaceName}>{palaceDirectionLabel(s.palace)}</span>
        <label style={V.compareLabel}>
          <input type="checkbox" checked={checked} onChange={onToggleCompare} />
          比較に追加
        </label>
      </div>
      <div style={V.line}>
        八門 {join(s.baMen)}／九星 {join(s.jiuXing)}／八神 {join(s.baShen)}
      </div>
      <div style={V.line}>
        天盤 {stemLabel(s.tianPanStem, null)}／地盤 {stemLabel(s.diPanStem, s.diPanLodged)}
      </div>
      <div style={V.line}>
        <span style={V.ji}>吉格</span> {join(s.jikaku)}
      </div>
      <div style={V.line}>
        <span style={V.kyo}>凶格</span> {join(s.kyokaku)}
      </div>
    </div>
  );
}

function KokuoList({ entries }: { entries: KokuoEntry[] }) {
  if (entries.length === 0) return <div style={V.muted}>剋應：該当なし</div>;
  return (
    <ul style={V.list}>
      {entries.map((e) => (
        <li key={`${e.category}-${e.id}-${e.mode ?? ""}`} style={V.listItem}>
          <div style={V.itemHead}>
            {kokuoCategoryLabel(e.category)}：{kokuoShortLabel(e)}
            {e.fortuneRaw ? `（${e.fortuneRaw}）` : ""}
            {e.mode ? ` ${e.mode === "static" ? "静應" : "動應"}` : ""}
            {e.sourceTradition ? ` ${KOKUO_TRADITION_LABEL[e.sourceTradition] ?? e.sourceTradition}` : ""}
          </div>
          {/* 表示時のみルビ（ふりがな行）を除去（/qimen の宮詳細と同じ）。元データは変更しない。 */}
          <div style={V.body}>{stripRuby(e.body)}</div>
          <div style={V.source}>出典：{e.source.document} {e.source.printedPages}</div>
        </li>
      ))}
    </ul>
  );
}

export function MarriageList({ refs }: { refs: MarriageReference[] }) {
  if (refs.length === 0) return <div style={V.muted}>婚姻・嫁娶に関する記述：なし</div>;
  return (
    <ul style={V.list}>
      {refs.map((r, i) => (
        <li key={i} style={V.listItem}>
          <div style={V.itemHead}>
            {r.category}：{r.name}
            {r.fortuneLabel ? `（${r.fortuneLabel}）` : ""}
          </div>
          <div style={V.body}>
            {r.texts.map((t, ti) => {
              // 剋應本文だけ表示時にルビ行を除去する（象意の箇条書きはそのまま）。
              const shown = r.category.includes("剋應") ? stripRuby(t) : t;
              return (
                <span key={ti}>
                  {ti > 0 && "、"}
                  {r.matchedTexts.includes(t) ? <mark style={V.mark}>{shown}</mark> : shown}
                </span>
              );
            })}
          </div>
          <div style={V.source}>出典：{r.source}</div>
        </li>
      ))}
    </ul>
  );
}

/** 詳細展開: 宮ごとの剋應・盤全体の凶格・婚姻に関する参考情報。 */
export function CandidateDetailView({
  hit,
  palace,
  showMarriage,
}: {
  hit: QimenSearchHit;
  palace: number;
  showMarriage: boolean;
}) {
  const d = loadCandidateDetail({ ...hit, palace });
  if (!d) return <div style={V.muted}>この日時の盤を算出できませんでした。</div>;
  return (
    <div style={V.detail}>
      <div style={V.detailTitle}>{palaceDirectionLabel(palace)} の詳細</div>
      <KokuoList entries={flattenKokuo(d.kokuo)} />
      {showMarriage && (
        <>
          <div style={V.subTitle}>婚姻に関する参考情報（資料の記述。適否の判定ではありません）</div>
          <MarriageList refs={d.marriage} />
        </>
      )}
    </div>
  );
}

/** 比較表（画面・印刷共通）。 */
export function CompareTable({
  candidates,
  onRemove,
  showMarriage,
  forPrint = false,
}: {
  candidates: CompareCandidate[];
  onRemove?: (key: string) => void;
  showMarriage: boolean;
  forPrint?: boolean;
}) {
  const rows = candidates.map((c) => ({ c, d: loadCandidateDetail(c) }));
  return (
    <>
      <table style={forPrint ? undefined : V.table} className="qms-compare-table">
        <thead>
          <tr>
            {["日時", "方位・宮", "八門", "九星", "八神", "天盤干", "地盤干", "吉格", "凶格", "盤全体の凶格", "剋應"].map((h) => (
              <th key={h} style={forPrint ? undefined : V.th}>{h}</th>
            ))}
            {!forPrint && onRemove && <th style={V.th} />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, d }) => (
            <tr key={c.key}>
              <td style={forPrint ? undefined : V.td}>{hitDateTimeLabel(c)}</td>
              <td style={forPrint ? undefined : V.td}>{palaceDirectionLabel(c.palace)}</td>
              {d ? (
                <>
                  <td style={forPrint ? undefined : V.td}>{join(d.baMen)}</td>
                  <td style={forPrint ? undefined : V.td}>{join(d.jiuXing)}</td>
                  <td style={forPrint ? undefined : V.td}>{join(d.baShen)}</td>
                  <td style={forPrint ? undefined : V.td}>{stemLabel(d.tianPanStem, null)}</td>
                  <td style={forPrint ? undefined : V.td}>{stemLabel(d.diPanStem, d.diPanLodged)}</td>
                  <td style={forPrint ? undefined : V.td}>{join(d.jikaku)}</td>
                  <td style={forPrint ? undefined : V.td}>{join(d.kyokaku)}</td>
                  <td style={forPrint ? undefined : V.td}>{join(d.boardWide)}</td>
                  <td style={forPrint ? undefined : V.td}>
                    {flattenKokuo(d.kokuo).length === 0
                      ? "—"
                      : flattenKokuo(d.kokuo).map((e) => (
                          <div key={`${e.category}-${e.id}-${e.mode ?? ""}`}>
                            {kokuoShortLabel(e)}
                            {e.fortuneRaw ? `（${e.fortuneRaw}）` : ""}
                            {e.mode ? ` ${e.mode === "static" ? "静應" : "動應"}` : ""}
                          </div>
                        ))}
                  </td>
                </>
              ) : (
                <td style={forPrint ? undefined : V.td} colSpan={9}>この日時の盤を算出できませんでした。</td>
              )}
              {!forPrint && onRemove && (
                <td style={V.td}>
                  <button type="button" style={V.smallBtn} onClick={() => onRemove(c.key)}>
                    外す
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {showMarriage && (
        <div className="qms-compare-marriage">
          <div style={forPrint ? undefined : V.subTitle} className="qms-compare-subtitle">
            婚姻に関する参考情報（資料の記述。適否の判定ではありません）
          </div>
          {rows.map(({ c, d }) => (
            <div key={c.key} className="qms-compare-marriage-item">
              <div style={forPrint ? undefined : V.itemHead}>
                {hitDateTimeLabel(c)} {palaceDirectionLabel(c.palace)}
              </div>
              {d ? <MarriageList refs={d.marriage} /> : <div>—</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const V: Record<string, React.CSSProperties> = {
  palaceBlock: { borderTop: "1px dashed #ddd", paddingTop: 6, display: "flex", flexDirection: "column", gap: 2 },
  palaceHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  palaceName: { fontWeight: 600, fontSize: 13 },
  compareLabel: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555", cursor: "pointer" },
  line: { fontSize: 12, color: "#333", lineHeight: 1.6 },
  ji: { color: "#1d4ed8", fontWeight: 600 },
  kyo: { color: "#b42318", fontWeight: 600 },
  muted: { fontSize: 12, color: "#777" },
  detail: { borderTop: "1px solid #eee", paddingTop: 6, marginTop: 4 },
  detailTitle: { fontSize: 12, fontWeight: 600, marginBottom: 4 },
  subTitle: { fontSize: 12, fontWeight: 600, margin: "8px 0 4px" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  listItem: { fontSize: 12, lineHeight: 1.5 },
  itemHead: { fontWeight: 600 },
  body: { color: "#333", whiteSpace: "pre-wrap" },
  source: { color: "#888", fontSize: 11 },
  mark: { background: "#fff3bf", padding: "0 1px" },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 12 },
  th: { border: "1px solid #ccc", background: "#f5f5f5", padding: "4px 6px", textAlign: "left", whiteSpace: "nowrap" },
  td: { border: "1px solid #ddd", padding: "4px 6px", verticalAlign: "top" },
  smallBtn: { fontSize: 12, padding: "2px 8px", border: "1px solid #999", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" },
};
