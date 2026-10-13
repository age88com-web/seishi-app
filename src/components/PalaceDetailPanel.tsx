// src/components/PalaceDetailPanel.tsx
// 星盤で選択した宮の鑑定表示（総合的な吉凶判定はしない。資料の内容を整理して表示する）。
// 表示順：1 鑑定要約／2 宮の基本意味／3 宮主による判断／4 入宮星／5 星の象意／6 同宮／7 変曜／8 神殺／9 格局／10 その他の該当判断
// 古典原文（source_text・原詩）は画面に表示しない（JSON には保持）。
"use client";

import React, { useEffect, useState } from "react";
import {
  getZgStarLayers,
  toZgPalace,
  toZgStarKey,
  type ZgRecord,
  type ZgStarLayers,
} from "@/lib/zhangguo_interpretations";
import {
  describeConditionalRule,
  getHenyouMeaning,
  getPalaceMeaning,
  getStarSupplements,
  lookupShensha,
  matchConditionalRules,
  rolesOfStar,
  type QzMatchContext,
  type QzRecord,
  type ShenshaOrigin,
  kakkyokuDisplayTexts,
  loadKakkyokuData,
  selectKakkyokuGeneralRules,
  type QzKakkyokuData,
  type QzKakkyokuRecord,
} from "@/lib/qizheng_interpretations";
import { loadNormalLimitRules, matchConfirmedLimitRules, type LimitRuleRecord } from "@/lib/limit_rules";
import type { BigLimitDegree } from "@/lib/big_limit_degree";
import type { Liunian } from "@/lib/liunian";
import { qzDisplayDecision } from "@/lib/qizheng_display_conditions";
import {
  buildQzPalaceReading,
  displayCtxFor,
  firstSentence,
  gateZgLayers,
  hiddenNote,
  MOTION_LABEL,
  ORIGIN_LABEL,
  plain,
  sentences,
  SEVEN_KEYS,
  starName,
  stateText,
  type QzSumBlock,
  type ZgHidden,
} from "@/lib/qizheng_palace_reading";

export type PalaceDetailStar = {
  key: string;      // bodies の id（sun 等）
  label: string;    // 星盤の星ラベル
  branch: string;   // 所在の十二支（既存 palaceFromLon）
  mansion: string;  // 宿（既存 lonToMansionDeg）
  motion: string;   // 既存の順逆記号（+ / - / *）
  status: string;   // 既存の旺廟陥（ouboin）
  extra: string;    // 既存の星一覧表の付記（入垣・昇殿 等）
};

export type PalaceDetailLord = { lordLabel: string; body: PalaceDetailStar | null } | null;
type HenyouItem = { raw: string; name: string; starLabel: string };
type Henyou2Item = { name: string; mark: string; origin: "henyou2_year_branch" | "henyou2_stem_ming"; starKey: string; starLabel: string };
type ShenshaItemT = { name: string; origins: ("year_stem" | "year_branch" | "month_branch")[] };

export type PalaceDetail = {
  branch: string;
  palaceName: string;
  isShenPalace: boolean;
  mingBranch: string;
  shenBranch: string;
  sex: "男" | "女";
  isDayBirth?: boolean;
  yearStem?: string;   // 既存の年干（解釈本文の表示条件の判定用）
  yearBranch?: string; // 既存の年支（同上）
  stars: PalaceDetailStar[];
  henyou: HenyouItem[];
  henyou2: Henyou2Item[];
  shensha: ShenshaItemT[];
  lord: PalaceDetailLord;
  mingLord: PalaceDetailLord;
  shenLord: PalaceDetailLord;
  kakkyoku: { good: string[]; bad: string[] } | null;
  palaceNameByBranch: Record<string, string>;
  allStars: PalaceDetailStar[];
  henyouByBranch: Record<string, HenyouItem[]>;
  henyou2All: Henyou2Item[];
  shenshaByBranch: Record<string, ShenshaItemT[]>;
};

// 星名・状態・表示条件などの補助関数と、宮詳細の鑑定内容の組み立ては lib/qizheng_palace_reading.ts（画面と解釈印刷で共用）

// ---------- 見た目 ----------
const C = {
  strongBar: "#2c4a7a",
  midBar: "#8a9bb8",
  border: "1px solid #ddd",
  match: "#1a4d8f",
};
const text14 = { fontSize: 14, lineHeight: 1.8 } as const;
const text13 = { fontSize: 13, lineHeight: 1.7 } as const;
const muted = { fontSize: 13, color: "#888" } as const;

function Section({ no, title, level, children }: { no: number; title: string; level: "strong" | "mid" | "detail"; children: React.ReactNode }) {
  const st =
    level === "strong"
      ? { fontSize: 15, fontWeight: 700, borderLeft: `4px solid ${C.strongBar}`, paddingLeft: 8, color: "#1d2b45" }
      : level === "mid"
      ? { fontSize: 14, fontWeight: 700, borderLeft: `3px solid ${C.midBar}`, paddingLeft: 8, color: "#333" }
      : { fontSize: 13, fontWeight: 700, borderLeft: "2px solid #ccc", paddingLeft: 8, color: "#666" };
  return (
    <div style={{ marginTop: level === "detail" ? 10 : 14 }}>
      <div style={{ ...st, marginBottom: 6 }}>{no}. {title}</div>
      <div style={{ paddingLeft: 4 }}>{children}</div>
    </div>
  );
}

function Accordion({ title, children, sub, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; sub?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: C.border, borderRadius: 4, marginBottom: 6, background: "#fff" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 10px", background: open ? "#f4f6fb" : "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
      >
        {open ? "▼" : "▶"} {title}
        {sub ? <span style={{ fontWeight: 400, fontSize: 12, color: "#666", marginLeft: 8 }}>{sub}</span> : null}
      </button>
      {open && <div style={{ padding: "0 10px 6px" }}>{children}</div>}
    </div>
  );
}

// ---------- 星の4層（張果星宗） ----------
function ZgBlock({ title, rec, hidden }: { title: string; rec: ZgRecord | null; hidden?: string }) {
  return (
    <div style={{ borderTop: "1px solid #eee", padding: "5px 0" }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#555" }}>【{title}】</div>
      {rec ? <div style={text13}>{rec.modern_japanese}</div> : <div style={muted}>{hidden !== undefined ? hiddenNote(hidden) : "該当データなし"}</div>}
    </div>
  );
}
function ZgLayers({ layers, hidden = {}, branch, mansion, palace }: { layers: ZgStarLayers; hidden?: ZgHidden; branch: string; mansion: string; palace: string }) {
  return (
    <>
      <ZgBlock title="総論" rec={layers.general} hidden={hidden.general} />
      <ZgBlock title={`十二支宮（${branch}）`} rec={layers.branch} hidden={hidden.branch} />
      <ZgBlock title={`躔宿（${mansion || "—"}）`} rec={layers.mansion} hidden={hidden.mansion} />
      <ZgBlock title={`照宮（${palace}）`} rec={layers.palace} hidden={hidden.palace} />
    </>
  );
}

// 入宮星の4層：星そのもの → 実際の所在十二支宮 → 実際の躔宿 → 選択中の宮位。データのない層は出さない
function StarZgLayers({ layers, hidden = {}, branch, mansion, palaceLabel }: { layers: ZgStarLayers; hidden?: ZgHidden; branch: string; mansion: string; palaceLabel: string }) {
  const rows: [string, ZgRecord | null, string | undefined][] = [
    ["星の総論", layers.general, hidden.general],
    [`${branch}宮にある場合`, layers.branch, hidden.branch],
    [`${mansion}宿にある場合`, layers.mansion, hidden.mansion],
    [`${palaceLabel}にある場合`, layers.palace, hidden.palace],
  ];
  return (
    <>
      {rows.filter(([, rec, h]) => rec || h !== undefined).map(([title, rec, h]) => (
        <div key={title} data-testid={rec ? "star-layer" : "star-layer-hidden"} style={{ borderTop: "1px solid #eee", padding: "5px 0" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#555" }}>・{title}</div>
          {rec ? <div style={text13}>{rec.modern_japanese}</div> : <div style={muted}>{hiddenNote(h ?? "")}</div>}
        </div>
      ))}
    </>
  );
}

function QzBlock({ title, rec }: { title: string; rec: QzRecord }) {
  return (
    <div style={{ borderTop: "1px solid #eee", padding: "5px 0" }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#555" }}>【{title}】</div>
      <div style={text13}>{rec.interpretation ?? <span style={muted}>（資料に記述なし）</span>}</div>
    </div>
  );
}

function StarAccordion({ star, detail }: { star: PalaceDetailStar; detail: PalaceDetail }) {
  const key = toZgStarKey(star.key) ?? toZgStarKey(star.label);
  const zgPalace = toZgPalace(detail.palaceName);
  // branch・mansion は選択宮ではなく、その星が実際にある十二支・宿（盤の既存値）で照合する
  // 解釈本文の表示条件は、その星の実際の所在（選択宮）の既存値で判定する
  const dctx = displayCtxFor(detail, star, detail.branch);
  const raw = key ? getZgStarLayers({ star: key, branch: star.branch, mansion: star.mansion, palace: zgPalace }) : null;
  const gated = raw ? gateZgLayers(raw, dctx) : null;
  const layers = gated?.layers ?? null;
  const supplements = key
    ? getStarSupplements({ star: key, branch: detail.branch, mansion: star.mansion, chartPalaceName: detail.palaceName })
        .filter((s) => qzDisplayDecision(s.rec.id, dctx).show)
    : [];
  return (
    <Accordion defaultOpen title={starName(star.label)} sub={[raw?.general?.classical_name, star.mansion ? `${star.mansion}宿` : ""].filter(Boolean).join("　")}>
      {layers ? <StarZgLayers layers={layers} hidden={gated?.hidden} branch={star.branch} mansion={star.mansion} palaceLabel={detail.palaceName} /> : <div style={muted}>該当データなし</div>}
      {supplements.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <Accordion title="補助資料（七政四餘鑑定用資料）" sub={`${supplements.length}件`}>
            {supplements.map((s) => <QzBlock key={s.rec.id} title={s.label} rec={s.rec} />)}
          </Accordion>
        </div>
      )}
    </Accordion>
  );
}

// ---------- 変曜・神殺 ----------
function HenyouList({ items, items2, ctx, stars, detail }: { items: HenyouItem[]; items2: Henyou2Item[]; ctx: QzMatchContext; stars: PalaceDetailStar[]; detail: PalaceDetail }) {
  if (items.length === 0 && items2.length === 0) return <div style={muted}>なし</div>;
  return (
    <>
      {items.map((h) => {
        const rec = getHenyouMeaning(h.name);
        const conds = matchConditionalRules("henyou", h.name, ctx);
        return (
          <div key={h.raw} style={{ padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
            <div style={text14}>
              <b>{h.name}</b><span style={{ fontSize: 12, color: "#666" }}>（{h.starLabel}）</span>
              {rec ? <span>　{rec.interpretation}</span> : <span style={muted}>　資料に該当なし</span>}
            </div>
            {conds.map((c) => <div key={c.id} style={{ fontSize: 13, color: C.match }}>この宮での条件：{describeConditionalRule(c)}</div>)}
          </div>
        );
      })}
      {items2.map((h) => {
        const lk = lookupShensha(h.name, [h.origin]);
        const st = stars.find((s) => s.key === h.starKey);
        const conds = matchConditionalRules("shensha", h.name, ctx, {
          motion: SEVEN_KEYS.includes(h.starKey) ? st?.motion : undefined,
          status: st?.status,
        });
        // 神殺の意味が条件付き（例：天経「身命なら貴」）なら、付いている星の所在で成立を確認できたときだけ表示
        const dctx = displayCtxFor(detail, st ?? null, detail.branch);
        const shown = lk.records.filter((r) => qzDisplayDecision(r.id, dctx).show);
        const hiddenRecs = lk.records.filter((r) => !shown.includes(r));
        return (
          <div key={`${h.origin}-${h.name}`} style={{ padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
            <div style={text14}>
              <b>{h.name}</b><span style={{ fontSize: 12, color: "#666" }}>（{h.starLabel}）</span>
              {shown.length > 0 && <span>　{shown.map((r) => r.interpretation ?? "（記載なし）").join(" ／ ")}</span>}
              {hiddenRecs.length > 0 && <span style={muted}>　{hiddenRecs.map((r) => hiddenNote(qzDisplayDecision(r.id, dctx).rule?.conditions ?? "")).join(" ／ ")}</span>}
              {lk.records.length === 0 && <span style={muted}>　資料に該当なし</span>}
              <span style={{ fontSize: 11, color: "#999", marginLeft: 6 }}>{ORIGIN_LABEL[h.origin]}</span>
            </div>
            {conds.map((c) => <div key={c.id} style={{ fontSize: 13, color: C.match }}>条件一致：{describeConditionalRule(c)}</div>)}
          </div>
        );
      })}
    </>
  );
}

function ShenshaList({ items, ctx, detail, compact = false }: { items: ShenshaItemT[]; ctx: QzMatchContext; detail: PalaceDetail; compact?: boolean }) {
  if (items.length === 0) return <div style={muted}>なし</div>;
  return (
    <>
      {items.map((s) => {
        const lk = lookupShensha(s.name, s.origins as ShenshaOrigin[]);
        const conds = matchConditionalRules("shensha", s.name, ctx);
        // 神殺の意味が条件付き（例：太陽「男に吉」）なら、成立を確認できたときだけ表示
        const dctx = displayCtxFor(detail, null, detail.branch);
        const shown = lk.records.filter((r) => qzDisplayDecision(r.id, dctx).show);
        const hiddenRecs = lk.records.filter((r) => !shown.includes(r));
        return (
          <div key={s.name} style={{ padding: compact ? "1px 0" : "3px 0", borderTop: compact ? "none" : "1px solid #f2f2f2" }}>
            <div style={compact ? text13 : text14}>
              <b>{s.name}</b>
              {shown.length > 0 && <span>　{shown.map((r) => r.interpretation ?? "（資料に意味の記載なし）").join(" ／ ")}</span>}
              {hiddenRecs.length > 0 && <span style={muted}>　{hiddenRecs.map((r) => hiddenNote(qzDisplayDecision(r.id, dctx).rule?.conditions ?? "")).join(" ／ ")}</span>}
              {lk.records.length === 0 && lk.candidates.length === 0 && <span style={muted}>　資料に該当なし</span>}
              {lk.candidates.length > 0 && (
                <span style={{ fontSize: 12, color: "#a06000" }}>
                  　系統未確定（候補：{lk.candidates.map((c) => `${c.shensha_table_label}「${c.interpretation ?? "記載なし"}」`).join("／")}）
                </span>
              )}
            </div>
            {conds.map((c) => <div key={c.id} style={{ fontSize: 13, color: C.match }}>条件一致：{describeConditionalRule(c)}</div>)}
          </div>
        );
      })}
    </>
  );
}

// ---------- 格局（盤全体で成立。既存格局エンジンの結果に資料の文を対応させるだけ） ----------
export type KakkyokuInput = { good: string[]; bad: string[] } | null | undefined;
/** 格局の表示データ（画面の「9. 格局」と解釈印刷の格局欄で共用） */
export function useKakkyokuView(kakkyoku: KakkyokuInput) {
  // 格局の日本語データ（約1.4MB）はパネル表示時に読み込む
  const [kkData, setKkData] = useState<QzKakkyokuData | null>(null);
  useEffect(() => {
    let alive = true;
    loadKakkyokuData().then((d) => { if (alive) setKkData(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // 既存格局エンジンの成立結果（吉凶もエンジンの値）。エラー表示用の名称は別扱い
  const kkRaw = [
    ...(kakkyoku?.good ?? []).map((name) => ({ name: String(name), luck: "吉" as const })),
    ...(kakkyoku?.bad ?? []).map((name) => ({ name: String(name), luck: "凶" as const })),
  ];
  const kkSeen = new Set<string>();
  const kkItems = kkRaw.filter((k) => {
    const key = `${k.luck}:${k.name}`;
    if (!k.name || k.name.startsWith("（") || kkSeen.has(key)) return false;
    kkSeen.add(key);
    return true;
  });
  const kkHasError = kkRaw.some((k) => k.name.startsWith("（"));
  const kkView = kkItems.map((k) => {
    const recs: QzKakkyokuRecord[] = kkData?.connectedByAppName.get(k.name) ?? [];
    // 同じ格局名に資料の複数節が対応する場合、同一内容は1回だけ表示
    const groups: { sections: string[]; meaning: string | null; condition: string | null; labeled: boolean }[] = [];
    for (const r of recs) {
      const t = kakkyokuDisplayTexts(r);
      const g = groups.find((x) => x.meaning === t.meaning && x.condition === t.condition);
      if (g) { if (!g.sections.includes(r.section)) g.sections.push(r.section); }
      else groups.push({ sections: [r.section], ...t, labeled: !!r.modern_japanese });
    }
    return { ...k, cls: kkData?.classByAppName.get(k.name) ?? null, recs, groups };
  });
  const kkGeneral = kkData ? selectKakkyokuGeneralRules(kkData, kkView.flatMap((k) => k.recs)) : [];
  return { kkData, kkItems, kkHasError, kkView, kkGeneral };
}
type KakkyokuViewData = ReturnType<typeof useKakkyokuView>;

function KakkyokuBody({ v }: { v: KakkyokuViewData }) {
  const { kkData, kkItems, kkHasError, kkView, kkGeneral } = v;
  return (
    <>
        {kkItems.length === 0 ? (
          <div style={muted}>{kkHasError ? "格局の判定でエラーが出ている（既存エンジン）" : "盤全体で成立している格局はない"}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
              盤全体で成立している格局（既存格局エンジンの結果。宮との対応データがないため、この宮に限定しない）
            </div>
            {!kkData && <div style={muted}>資料データを読み込み中…</div>}
            {kkView.map((k) => (
              <div key={`${k.luck}-${k.name}`} style={{ border: C.border, borderRadius: 4, background: "#fff", padding: "5px 10px", marginBottom: 5 }}>
                <div style={text14}>
                  <b>【{k.name}】</b>
                  <span style={{ marginLeft: 8, fontSize: 12, padding: "0 6px", borderRadius: 3, background: k.luck === "吉" ? "#e7f3ea" : "#f8e9e7", color: k.luck === "吉" ? "#2d6a3a" : "#8a3a2e" }}>{k.luck}</span>
                  {k.groups.length > 0 && <span style={{ fontSize: 11, color: "#999", marginLeft: 8 }}>{[...new Set(k.groups.flatMap((g) => g.sections))].join("・")}</span>}
                </div>
                {kkData && k.groups.length === 0 && (
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {k.cls === "C" ? "資料との対応は要確認のため、象意は表示しない" : k.cls === "D" ? "資料に該当する格局名なし" : "資料との対応表に未登録のため、象意は表示しない"}
                  </div>
                )}
                {k.groups.map((g, i) => (
                  <div key={i} style={{ borderTop: i ? "1px dashed #eee" : "none", paddingTop: i ? 3 : 0 }}>
                    {g.meaning && <div style={text13}>{g.labeled ? "象意：" : ""}{g.meaning}</div>}
                    {g.condition && <div style={text13}>成立条件：{g.condition}</div>}
                  </div>
                ))}
              </div>
            ))}
            {kkGeneral.length > 0 && (
              <Accordion title="格局の判断原則" sub={`${kkGeneral.length}件`}>
                {kkGeneral.map((g) => (
                  <div key={g.id} style={{ ...text13, padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
                    {g.modern_japanese}
                  </div>
                ))}
              </Accordion>
            )}
          </>
        )}
    </>
  );
}

// ---------- 本体 ----------
export default function PalaceDetailPanel({ detail }: { detail: PalaceDetail }) {
  const kk = useKakkyokuView(detail.kakkyoku);
  const { kkItems, kkView } = kk;
  const r = buildQzPalaceReading(detail);
  const {
    P, meaning, ctx, lord, lb, lordName, lordKey, lordPalaceName, lordInThisPalace, lordGated, lordLayers, lordStarRules,
    tenLords, tenLordPrinciples, guard, conj, roles, roleRule, starRuleMatches, m24, starLabelByKey, isMing, hasStars,
    lordCondLines, lordMatchedCount,
  } = r;
  const summary: QzSumBlock[] = [...r.summary];
  const para = (text: string, tag: QzSumBlock["tag"]) => summary.push({ kind: "p", text, tag });

  // 8. 格局（盤全体で成立。A・B で資料に接続したものだけ、最大3件）
  {
    const withText = kkView.filter((k) => k.groups.some((g) => g.meaning || g.condition));
    const pick = [...withText.filter((k) => k.recs.some((r) => r.modern_japanese)), ...withText.filter((k) => !k.recs.some((r) => r.modern_japanese))].slice(0, 3);
    for (const k of pick) {
      const r = k.recs.find((x) => x.modern_japanese) ?? k.recs[0];
      // 要約では出典説明（『張果星宗』では「○○」に収められる。）だけ表示から外す（データは変更しない）
      const ds = plain(sentences(r.display_summary ?? "", 2).replace(/『張果星宗』では「[^」]*」に収められる。/g, ""));
      if (ds) para(`格局では「${k.name}」（${k.luck}）が盤全体で成立している。${ds}。`, "kakkyoku");
    }
    const rest = kkItems.length - pick.length;
    if (kkItems.length > 0 && rest > 0) {
      para(pick.length > 0 ? `このほか${rest}件の格局が成立している（詳細は格局欄）。` : `格局は盤全体で${kkItems.length}件成立している（詳細は格局欄）。`, "kakkyoku");
    }
  }

  // 宮主に関して資料の条件に該当した判断文（入宮星の有無にかかわらず表示する）
  const lordMatchedRules = (
    <>
      {tenLords.flatMap((t) => t.ev.matched.map((m, i) => (
        <div key={`${t.rec.id}-${i}`} style={{ ...text13, color: C.match }}>
          専論十主（{t.rec.name}）：{m.rule.source_fragment}<span style={{ color: "#666" }}>　［一致：{m.reason}］</span>
        </div>
      )))}
      {guard.map((g, i) => (
        <div key={`gd-${i}`} style={{ ...text13, color: C.match }}>
          主星守宮歌：{g.rule.source_fragment}<span style={{ color: "#666" }}>　［一致：{g.matched}］</span>
        </div>
      ))}
      {lordCondLines.map((t, i) => (
        <div key={`lc-${i}`} style={{ ...text13, color: C.match }}>{t}</div>
      ))}
      {lordStarRules.map((m, i) => (
        <div key={`lr-${i}`} style={{ ...text13, color: C.match }}>
          {m.rec.name}：{m.rule.source_fragment}<span style={{ color: "#666" }}>　［一致：{lordName}が{lb?.branch}宮］</span>
        </div>
      ))}
    </>
  );

  const LordRow = ({ title, l }: { title: string; l: PalaceDetailLord }) => {
    const b = l?.body;
    return (
      <div style={text14}>
        <b>{title}</b>：{l ? starName(l.lordLabel) : "—"}
        {b && <span style={{ color: "#444" }}>　{detail.palaceNameByBranch[b.branch]}（{b.branch}）・{b.mansion}宿{stateText(b) ? `・${stateText(b)}` : ""}</span>}
      </div>
    );
  };

  return (
    <div className="zg-palace-panel" style={{ marginTop: 12, maxWidth: 980, padding: "10px 14px", border: C.border, borderRadius: 6, background: "#fcfcfc", boxSizing: "border-box" }}>
      {/* 印刷物は従来どおり（パネルと選択ハイライトは印刷しない） */}
      <style>{`@media print { .zg-palace-panel, .zg-palace-hit { display: none !important; } }`}</style>

      <div style={{ fontWeight: 700, fontSize: 17, color: "#1d2b45" }}>
        【{P}　{detail.branch}】{detail.isShenPalace ? <span style={{ fontSize: 13, fontWeight: 400 }}>（身宮）</span> : null}
      </div>

      {/* 1. 鑑定要約 */}
      <Section no={1} title="鑑定要約" level="strong">
        <div style={{ background: "#f3f6fb", border: "1px solid #d6dfee", borderRadius: 4, padding: "8px 12px" }}>
          {summary.map((b, i) =>
            b.kind === "p" ? (
              <p key={i} style={{ ...text14, margin: "3px 0" }}>{b.text}</p>
            ) : (
              <div key={i} style={{ margin: "4px 0" }}>
                <div style={text14}>{b.title}</div>
                <ul style={{ margin: "1px 0 2px", paddingLeft: 20 }}>
                  {b.items.map((it, k) => <li key={k} style={text13}>{it}</li>)}
                </ul>
              </div>
            )
          )}
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>吉凶の総合判定はしていません</div>
      </Section>

      {/* 2. 宮の基本意味 */}
      <Section no={2} title="宮の基本意味" level="strong">
        {meaning ? <div style={text14}>{meaning.interpretation}</div> : <div style={muted}>該当データなし</div>}
      </Section>

      {/* 3. 宮主：入宮星がある宮は状態のみ（簡潔）、空宮は従来どおり宮主による判断 */}
      {hasStars ? (
        <Section no={3} title="宮主の状態" level="mid">
          {lord ? (
            <>
              <div style={text14} data-testid="lord-state">
                宮主：<b>{lordName}</b>
                {lb ? `｜${lordPalaceName}（${lb.branch}）・${lb.mansion}宿｜${[lb.status, MOTION_LABEL[lb.motion], lb.extra].filter(Boolean).join("・") || "旺廟陥の該当なし"}` : "｜盤上に宮主星が見つからない"}
                {lordInThisPalace ? "（この宮に入っている）" : ""}
              </div>
              {(isMing || detail.isShenPalace) && (
                <div style={{ marginTop: 2 }}>
                  <LordRow title="命主" l={detail.mingLord} />
                  <LordRow title="身主" l={detail.shenLord} />
                </div>
              )}
              {lordMatchedCount > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>宮主に関する資料ルールの該当</div>
                  {lordMatchedRules}
                </div>
              )}
            </>
          ) : (
            <div style={muted}>既存の宮主表に該当なし</div>
          )}
        </Section>
      ) : (
      <Section no={3} title="宮主による判断" level="strong">
        <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
          宮主として参照する星（{lordInThisPalace ? "この宮に入っている" : "この宮には入っていない"}）
        </div>
        {lord ? (
          <div style={{ border: C.border, borderRadius: 4, background: "#fff", padding: "6px 10px" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>宮主：{lordName}</div>
            {lb ? (
              <table style={{ fontSize: 13, borderCollapse: "collapse", marginTop: 2 }}>
                <tbody>
                  {[
                    ["所在の十二支", lb.branch],
                    ["所在の十二宮", lordPalaceName],
                    ["二十八宿", lb.mansion ? `${lb.mansion}宿` : "—"],
                    ["旺廟陥", lb.status || "—"],
                    ["入垣・昇殿等", lb.extra || "—"],
                    ["順逆（伏は既存判定なし）", MOTION_LABEL[lb.motion] ?? "—"],
                  ].map(([k, v]) => (
                    <tr key={k}><td style={{ color: "#666", paddingRight: 12 }}>{k}</td><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={muted}>盤上に宮主星が見つからない</div>
            )}

            {/* 宮主自身の変曜は一覧表示しない。資料の条件付きルールに該当した判断文だけを下の資料ルールに載せる */}
            {(tenLordPrinciples.length > 0 || lordMatchedCount > 0) && (
              <>
                <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>宮主に適用される資料ルール</div>
                {lordMatchedRules}
                {/* 専論十主は一般原則（A）だけを条件判定なしで出す。条件付き（B）は成立時だけ上に、曖昧（C）は出さない */}
                {tenLordPrinciples.length > 0 && (
                  <Accordion title="専論十主の一般原則" sub={tenLordPrinciples.map((t) => t.rec.name).join("・")}>
                    {tenLordPrinciples.map((t) => (
                      <div key={t.rec.id} style={{ ...text13, padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
                        <b>{t.rec.name}</b>
                        <ul style={{ margin: "2px 0", paddingLeft: 18 }}>
                          {t.ev.principles.map((r, i) => <li key={i}>{r.source_fragment}</li>)}
                        </ul>
                      </div>
                    ))}
                  </Accordion>
                )}
              </>
            )}

            {(isMing || detail.isShenPalace) && (
              <div style={{ marginTop: 6 }}>
                <LordRow title="命主" l={detail.mingLord} />
                <LordRow title="身主" l={detail.shenLord} />
                <div style={{ fontSize: 11, color: "#999" }}>度主は既存コードに命度の宿の主星データがないため表示しない</div>
              </div>
            )}

            {lordLayers && lb && (
              <div style={{ marginTop: 6 }}>
                <Accordion title={`宮主星（${lordName}）の象意`} sub="張果星宗（所在の十二支・宿・宮で参照）">
                  <ZgLayers layers={lordLayers} hidden={lordGated?.hidden} branch={lb.branch} mansion={lb.mansion} palace={toZgPalace(lordPalaceName) ?? lordPalaceName} />
                </Accordion>
              </div>
            )}
          </div>
        ) : (
          <div style={muted}>既存の宮主表に該当なし</div>
        )}
      </Section>
      )}

      {/* 4. 入宮星 */}
      <Section no={4} title="入宮星" level="strong">
        <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>この宮に実際に入っている星</div>
        {detail.stars.length === 0 ? (
          <div style={text14}>なし（十一曜は入っていない。上の宮主を中心に見る）</div>
        ) : (
          detail.stars.map((s) => (
            <div key={s.key} style={text14}>
              ・<b>{starName(s.label)}</b>
              <span style={{ fontSize: 13, color: "#555" }}>　{s.mansion}宿{stateText(s) ? `・${stateText(s)}` : ""}{toZgStarKey(s.key) === lordKey ? "（宮主）" : ""}</span>
            </div>
          ))
        )}
      </Section>

      {/* 5. 星の象意 */}
      {detail.stars.length > 0 && (
        <Section no={5} title="星の象意" level="detail">
          {detail.stars.map((s) => <StarAccordion key={s.key} star={s} detail={detail} />)}
        </Section>
      )}

      {/* 6. 同宮 */}
      {conj.length > 0 && (
        <Section no={6} title="同宮" level="detail">
          <Accordion title="同宮の象意" sub={`${conj.length}件`}>
            {conj.map((c) => (
              <QzBlock key={c.id} title={(c.members ?? []).map((k) => starLabelByKey.get(k) ?? k).join("＋")} rec={c} />
            ))}
          </Accordion>
        </Section>
      )}

      {/* 7. 変曜 */}
      <Section no={7} title="変曜" level="mid">
        <HenyouList items={detail.henyou} items2={detail.henyou2} ctx={ctx} stars={detail.stars} detail={detail} />
      </Section>

      {/* 8. 神殺 */}
      <Section no={8} title="神殺" level="mid">
        <ShenshaList items={detail.shensha} ctx={ctx} detail={detail} />
      </Section>

      {/* 9. 格局 */}
      <Section no={9} title="格局" level="mid">
        <KakkyokuBody v={kk} />
      </Section>

      {/* 10. その他の該当判断 */}
      <Section no={10} title="その他の該当判断" level="detail">
        <Accordion title="宮位・二十四要法などの該当" sub={`${starRuleMatches.length + m24.length}件一致`}>
          {roles?.roles && (
            <div style={{ ...text13, padding: "3px 0" }}>
              当宮の主星・喜忌（資料の表）：{Object.entries(roles.roles).map(([k, v]) => `${k} ${v.raw}`).join("　")}
              {detail.stars.length > 0 && (
                <div>
                  入宮星の役割：
                  {detail.stars.map((s) => {
                    const r = rolesOfStar(roles, toZgStarKey(s.key) ?? s.key);
                    return `${s.label}＝${r.length ? r.join("・") : "表に該当なし"}`;
                  }).join("　")}
                </div>
              )}
              {roleRule && <div style={{ color: "#666" }}>{roleRule.interpretation}</div>}
            </div>
          )}
          {starRuleMatches.map((m, i) => (
            <div key={`sr-${i}`} style={{ ...text13, padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
              <b>{starLabelByKey.get(m.star) ?? m.star}</b>：{m.rule.source_fragment}
              <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>{m.rec.name}</span>
            </div>
          ))}
          {m24.map((m, i) => (
            <div key={`m24-${i}`} style={{ ...text13, padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
              <b>{m.rec.name}</b><span style={{ color: C.match, marginLeft: 6 }}>（{m.reason}）</span>
              {m.rule ? <div>{m.rule.source_fragment}</div> : <div>{firstSentence((m.rec.interpretation ?? "").split("\n").slice(1).join("").trim())}</div>}
            </div>
          ))}
          {starRuleMatches.length + m24.length === 0 && !roles?.roles && <div style={muted}>該当なし</div>}
        </Accordion>
      </Section>
    </div>
  );
}

// ---------- 行限パネル（大限・小限をクリックしたとき） ----------
// 行限専用の象意は資料にないため、宮の基本意味・入宮星・この宮の変曜・この宮の神殺を既存データのまま表示する
// （行限ルール・限度・流年などはまだ扱わない）
// 限度主（七政キー）→ 星盤の星記号
const DEGREE_LORD_MARK: Record<string, string> = { sun: "日", moon: "月", jupiter: "木", mars: "火", saturn: "土", venus: "金", mercury: "水" };

export type LimitSelection =
  | { type: "big"; branch: string; ageRange: string }
  | { type: "small"; branch: string; ages: number[] };

export function LimitDetailPanel({ selection, detail, bigDegree = null, liunian = null, bigAgeSelect = null, mingMansion = null }: {
  selection: LimitSelection; detail: PalaceDetail; bigDegree?: BigLimitDegree | null; liunian?: Liunian | null;
  /** 命度宿（lib/ming_mansion.ts。画面の「命度（宿度）」と同じ値）。行限ルールの判定入力に渡すだけ */
  mingMansion?: string | null;
  /** 大限パネルの「この大限で見る年齢」：選択肢・現在値（既存の対象年齢が範囲内のときだけ）・選択時に既存の対象年齢を更新する関数 */
  bigAgeSelect?: { ages: number[]; value: number | null; onChange: (age: number) => void } | null;
}) {
  const P = detail.palaceName;
  const meaning = getPalaceMeaning(P);
  const starKeys = detail.stars.map((s) => toZgStarKey(s.key) ?? s.key);
  const ctx: QzMatchContext = { chartPalaceName: P, isShenPalace: detail.isShenPalace, sex: detail.sex, starsInPalace: starKeys, isDayBirth: detail.isDayBirth };
  const lordName = detail.lord ? starName(detail.lord.lordLabel) : "";
  const isBig = selection.type === "big";
  // 行限の判断：CONFIRMED ルールだけを lib/limit_rules.ts で判定（death_timing は読み込み時点で除外）
  const [limitRules, setLimitRules] = useState<Map<string, LimitRuleRecord> | null>(null);
  useEffect(() => {
    let alive = true;
    loadNormalLimitRules().then((m) => { if (alive) setLimitRules(m); });
    return () => { alive = false; };
  }, []);
  // 昼夜が渡されていない場合は判定しない（推測で補わない）
  const limitMatches = limitRules && typeof detail.isDayBirth === "boolean"
    ? matchConfirmedLimitRules(
        { type: selection.type, branch: detail.branch, isDayBirth: detail.isDayBirth,
          bodies: detail.allStars.map((s) => ({ id: s.key, label: s.label, branch: s.branch, mansion: s.mansion })),
          // 限宿・限度主は大限の第2限以降で求まったときだけ渡す（判定は lib/limit_rules.ts）
          degree: selection.type === "big" && bigDegree?.available
            ? { limitOrder: bigDegree.limitOrder, mansion: bigDegree.mansion, degreeLord: bigDegree.degreeLord?.star ?? null }
            : null,
          mingBranch: detail.mingBranch,
          mingMansion,
          // 流年は対象年齢の大限・小限宮のときだけ求まっている（lib/liunian.ts）。それ以外は流年ルールを判定しない
          annual: liunian?.available
            ? { targetYear: liunian.targetYear, stem: liunian.stem, branch: liunian.branch, taisuiBranch: liunian.taisuiBranch, shensha: liunian.shensha }
            : null },
        limitRules
      )
    : [];
  return (
    <div className="zg-limit-panel" data-limit-type={selection.type} style={{ marginTop: 12, maxWidth: 980, padding: "10px 14px", border: C.border, borderRadius: 6, background: "#fcfcfc", boxSizing: "border-box" }}>
      <style>{`@media print { .zg-limit-panel { display: none !important; } }`}</style>
      <div style={{ fontWeight: 700, fontSize: 17, color: "#1d2b45" }}>【{isBig ? "大限" : "小限"}】</div>
      <div style={{ ...text14, marginTop: 4 }} data-testid="limit-facts">
        {selection.type === "big" ? (
          <>
            <div>年齢範囲：{selection.ageRange}歳</div>
            {bigAgeSelect && bigAgeSelect.ages.length > 0 && (
              <div data-testid="big-limit-age-select">
                <label>
                  この大限で見る年齢：
                  <select
                    value={bigAgeSelect.value != null ? String(bigAgeSelect.value) : ""}
                    onChange={(e) => { if (e.target.value !== "") bigAgeSelect.onChange(Number(e.target.value)); }}
                    aria-label="この大限で見る年齢"
                    style={{ fontSize: 14 }}
                  >
                    {bigAgeSelect.value == null && <option value="">年齢を選択</option>}
                    {bigAgeSelect.ages.map((a) => <option key={a} value={String(a)}>{a}歳</option>)}
                  </select>
                </label>
              </div>
            )}
          </>
        ) : (
          <div>
            年齢：{selection.ages.join("・")}歳
            <span style={{ fontSize: 12, color: "#666", marginLeft: 6 }}>（盤面に表示している小限年齢。12年ごとに同じ宮）</span>
          </div>
        )}
        <div>宮：{P}（{detail.branch}）</div>
        <div>限宮主：{lordName || "既存の宮主表から求められない"}</div>
        {/* 限度（第2限以降・対象年齢がこの大限内のときだけ。第1限は未確定のため出さない） */}
        {isBig && bigDegree?.available && (
          <div data-testid="big-limit-degree" style={{ marginTop: 2 }}>
            <div>対象年齢 {bigDegree.targetAge}歳の限度（第{bigDegree.limitOrder}限）</div>
            <div>限宿：{bigDegree.mansion}宿　宿内度：{bigDegree.mansionDegree.toFixed(1)}度</div>
            <div>限度主：{bigDegree.degreeLord ? starName(DEGREE_LORD_MARK[bigDegree.degreeLord.star] ?? bigDegree.degreeLord.star) : "—"}</div>
          </div>
        )}
        {/* 流年（対象年＝出生年＋対象年齢。この宮が対象年齢の大限宮・小限宮のときだけ。計算は lib/liunian.ts） */}
        {liunian?.available ? (
          <div data-testid="liunian" style={{ marginTop: 2 }}>
            <div>対象年：{liunian.targetYear}年（{liunian.targetAge}歳）</div>
            <div>流年：{liunian.ganzhi}</div>
            <div>太歳宮：{liunian.taisuiBranch}</div>
          </div>
        ) : liunian && liunian.reason === "not_target_limit" ? (
          <div data-testid="liunian" style={{ ...muted, marginTop: 2 }}>流年：この宮は対象年齢の{isBig ? "大限" : "小限"}宮ではないため表示しない</div>
        ) : liunian && liunian.reason === "no_target_age" ? (
          <div data-testid="liunian" style={{ ...muted, marginTop: 2 }}>流年：対象年齢が未入力のため表示しない</div>
        ) : null}
      </div>

      <Section no={1} title="宮の基本意味" level="mid">
        {meaning?.interpretation
          ? <div style={text14}>{P}は、{meaning.interpretation.replace(/。$/, "")}を見る宮。</div>
          : <div style={muted}>なし</div>}
      </Section>

      <Section no={2} title="入宮星" level="mid">
        {detail.stars.length === 0 ? (
          <div style={muted}>なし（十一曜は入っていない）</div>
        ) : (
          detail.stars.map((s) => (
            <div key={s.key} style={text14}>
              ・<b>{starName(s.label)}</b>
              <span style={{ fontSize: 13, color: "#555" }}>　{s.mansion}宿{stateText(s) ? `・${stateText(s)}` : ""}</span>
            </div>
          ))
        )}
      </Section>

      <Section no={3} title="この宮の変曜" level="mid">
        <HenyouList items={detail.henyou} items2={detail.henyou2} ctx={ctx} stars={detail.stars} detail={detail} />
      </Section>

      <Section no={4} title="この宮の神殺" level="mid">
        <ShenshaList items={detail.shensha} ctx={ctx} detail={detail} />
      </Section>

      {limitMatches.length > 0 && (
        <Section no={5} title="行限の判断" level="mid">
          {limitMatches.map((m) => (
            <div key={m.rec.id} data-testid="limit-rule" style={{ padding: "3px 0", borderTop: "1px solid #f2f2f2" }}>
              <div style={text14}>・{m.rec.modern_japanese}</div>
              <div style={{ fontSize: 13, color: C.match }}>
                {m.basis
                  ? `該当：${m.basis}`
                  : <>該当：この宮に出生時の{m.matched.map((b) => starName(b.label)).join("・")}がある（{detail.isDayBirth ? "昼" : "夜"}生まれ）</>}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
