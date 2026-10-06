// src/app/shichusuimei/print/ShichusuimeiChartPrint.tsx
//
// 四柱推命の「命式を印刷」＝鑑定表（A4縦1枚）。手書きの鑑定表（docs/source/赤上様.pdf）の一覧性を参考にした印刷専用レイアウト。
//   見出し（姓名・生年月日時・性別・出生地・地方真太陽時）
//   → 上段: 命式（罫線の表。通変・天干・地支・蔵干と通変・神煞）＋ 鑑定情報（順逆・立運・命式内の関係・三得・格局候補）
//          ＋ 内格補助の点数表（既存 innerScore の値：比劫・印・食傷・財・官・合計・判定）
//   → 中段: 大運10本（右から左。1本＝1列で、年齢・干支・天干通変・蔵干と通変・神煞・命式との関係を完結）
//   → 下段: 書き込み用の罫線
// 術者最終判断（画面の入力欄）は印刷しない。
// 計算はしない（calculateShichusuimei・assessKakkyoku の結果を並べるだけ）。画面の部品とは別の印刷専用のDOM。

import type { PillarKey, Relation, ShichusuimeiResult, StemWithTsuhen } from "@/lib/shichusuimei";
import { STEM_ELEMENT } from "@/lib/shichusuimei";
import { CONTROLS, GENERATES } from "@/lib/shichusuimei/data";
import type { Element } from "@/lib/shichusuimei";
import { BRANCH_ELEMENT } from "@/lib/shichusuimei/kakkyoku/common";
import type { InnerPatternScore, KakkyokuResult } from "@/lib/shichusuimei/kakkyoku";
import { PrintHeader, PrintSheet, type PrintHeaderInfo } from "@/components/print/PrintRoot";
import { hitName, LUCK_REL_SHORT, luckRelationItems, luckRelationLabel, pillarShinsatsu } from "../MeishikiParts";

const STATUS: Record<string, string> = {
  confirmed_by_engine: "成立",
  candidate: "候補",
  provisional: "参考候補",
  needs_review: "要確認",
  not_applicable: "対象外",
};

/** 命式の並び（右から年・月・日・時。手書きの鑑定表と同じく左が時柱） */
const NATAL_KEYS: readonly PillarKey[] = ["時", "日", "月", "年"];
const PILLAR_ORDER: readonly PillarKey[] = ["年", "月", "日", "時"];

/** 命式内の関係の短い表記（例: 月日支冲・年月干合） */
function natalRelationLabel(x: Relation): string {
  const keys = [...new Set(x.members.map((m) => m.pillar))].sort((a, b) => PILLAR_ORDER.indexOf(a) - PILLAR_ORDER.indexOf(b));
  const sankei = x.type === "三刑" && !x.complete ? "(2支)" : "";
  return `${keys.join("")}${x.members[0].part}${LUCK_REL_SHORT[x.type]}${sankei}`;
}

function Zokan({ zokan }: { zokan: StemWithTsuhen[] }) {
  return (
    <>
      {zokan.map((z) => (
        <div key={z.stem} className="kt-zokan-row">
          <span className="kt-zokan-stem">{z.stem}</span>
          <span className="kt-zokan-tsuhen">{z.tsuhen}</span>
        </div>
      ))}
    </>
  );
}

function Tags({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="kt-none">—</span>;
  return (
    <>
      {names.map((n) => (
        <span key={n} className="kt-tag">{n}</span>
      ))}
    </>
  );
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * 内格補助の点数表。値はすべて既存の innerScore（五行別の点・比劫＋印・食傷＋財＋官・判定）のまま。
 * 五行を比劫・印・食傷・財・官に当てるのは既存の五行の生剋表（GENERATES・CONTROLS）と、innerScore の比劫・印の五行による。
 */
function InnerScoreTable({ inner }: { inner: InnerPatternScore }) {
  const [hikou, in_] = inner.supportingSide.elements;
  const shokushou = GENERATES[hikou];
  const zai = CONTROLS[hikou];
  const kan = (Object.keys(CONTROLS) as Element[]).find((e) => CONTROLS[e] === hikou)!;
  const pt = (e: Element) => num(inner.byElement[e]);
  const left: [string, Element][] = [["比劫", hikou], ["印", in_]];
  const right: [string, Element][] = [["食傷", shokushou], ["財", zai], ["官", kan]];
  return (
    <table className="kt-table kt-inner">
      <colgroup>
        <col style={{ width: "24%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "38%" }} />
        <col style={{ width: "22%" }} />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={4}>内格補助</th>
        </tr>
      </thead>
      <tbody>
        {right.map((rr, i) => {
          const l = left[i];
          return (
            <tr key={rr[0]}>
              <th>{l ? `${l[0]}（${l[1]}）` : ""}</th>
              <td>{l ? pt(l[1]) : ""}</td>
              <th>{rr[0]}（{rr[1]}）</th>
              <td>{pt(rr[1])}</td>
            </tr>
          );
        })}
        <tr className="kt-inner-sum">
          <th>比劫＋印</th>
          <td>{num(inner.supportingSide.points)}</td>
          <th>食傷＋財＋官</th>
          <td>{num(inner.weakeningSide.points)}</td>
        </tr>
        <tr className="kt-inner-judge">
          <th>判定</th>
          <td colSpan={3}>
            <b>{inner.judgment}</b>
            <span className="kt-sub">（比劫＋印 と 食傷＋財＋官 の比較）</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function ShichusuimeiChartPrint({
  info,
  r,
  k,
}: {
  info: PrintHeaderInfo;
  r: ShichusuimeiResult;
  k: KakkyokuResult;
}) {
  const tc = r.meishiki.timeCorrection;
  const extra: [string, string][] = tc
    ? [["地方真太陽時", `${tc.localApparentSolarTime.slice(0, 10)} ${tc.localApparentSolarTime.slice(11, 16)}`]]
    : [["地方真太陽時", "時刻不明のため補正なし（時柱なし）"]];
  if (tc?.dayChangedAt23) extra.push(["23:00換日", "あり（日柱は翌日）"]);
  const s = k.strength;
  const cls = s.classification ?? `${s.classificationCandidates.join("・")}（候補）`;
  const shown = k.candidates.filter((c) => c.uiVisible);
  const natalRel = [...new Set(r.relations.map(natalRelationLabel))];
  // 第1大運を右端に置く（右から左）
  const lucks = [...r.daiun.periods].reverse();

  return (
    <PrintSheet className="kt-print-sheet">
      <div className="kt-sheet">
        <PrintHeader title="四柱推命 鑑定表" info={info} extra={extra} />

        <div className="kt-top">
          {/* 命式 */}
          <table className="kt-table kt-natal">
            <thead>
              <tr>
                {NATAL_KEYS.map((key) => (
                  <th key={key}>{key}柱</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="kt-row-tsuhen">
                {NATAL_KEYS.map((key) => {
                  const d = r.details[key];
                  return <td key={key}>{d ? (d.isDayMaster ? "日主" : d.stemTsuhen) : ""}</td>;
                })}
              </tr>
              <tr className="kt-row-kanshi">
                {NATAL_KEYS.map((key) => {
                  const p = r.meishiki.pillars[key];
                  return (
                    <td key={key}>
                      {p ? (
                        <>
                          <div className="kt-char">{p.stem}<span className="kt-el">{STEM_ELEMENT[p.stem]}</span></div>
                          <div className="kt-char">{p.branch}<span className="kt-el">{BRANCH_ELEMENT[p.branch]}</span></div>
                        </>
                      ) : (
                        <div className="kt-char kt-none">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="kt-row-zokan">
                {NATAL_KEYS.map((key) => {
                  const d = r.details[key];
                  return <td key={key}>{d ? <Zokan zokan={d.zokan} /> : null}</td>;
                })}
              </tr>
              <tr className="kt-row-tags">
                {NATAL_KEYS.map((key) => (
                  <td key={key}>{r.meishiki.pillars[key] ? <Tags names={pillarShinsatsu(r, key)} /> : null}</td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* 鑑定情報（既存の計算結果だけ） */}
          <div className="kt-info">
            <table className="kt-table kt-kv">
              <tbody>
                <tr>
                  <th>運行</th>
                  <td>{r.daiun.direction === "forward" ? "順行" : "逆行"}　立運 <b>{r.daiun.startAge}歳</b></td>
                </tr>
                <tr>
                  <th>命式内</th>
                  <td>{natalRel.length ? natalRel.join("・") : "—"}</td>
                </tr>
                <tr>
                  <th>三得</th>
                  <td>{cls}</td>
                </tr>
                <tr>
                  <th>格局</th>
                  <td>
                    {shown.length
                      ? shown.map((c) => `${c.subName ? `${c.name}（${c.subName}）` : c.name}${c.status === "candidate" ? "" : `(${STATUS[c.status] ?? c.status})`}`).join("・")
                      : "—"}
                    <span className="kt-sub">　{k.route === "naikaku" ? "外格候補なし → 内格" : "外格候補あり"}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            {k.innerScore && <InnerScoreTable inner={k.innerScore} />}
          </div>
        </div>

        {/* 大運 */}
        <div className="kt-daiun-head">
          <b>大運</b>
          <span className="kt-sub">　{r.daiun.direction === "forward" ? "順行" : "逆行"}・立運{r.daiun.startAge}歳（右から第1大運）</span>
        </div>
        <table className="kt-table kt-daiun">
          <tbody>
            <tr className="kt-row-age">
              {lucks.map((p) => (
                <td key={p.index}>{p.ageFrom}〜{p.ageTo}</td>
              ))}
            </tr>
            <tr className="kt-row-kanshi">
              {lucks.map((p) => (
                <td key={p.index}>
                  <div className="kt-char">{p.pillar.stem}<span className="kt-el">{STEM_ELEMENT[p.pillar.stem]}</span></div>
                  <div className="kt-char">{p.pillar.branch}<span className="kt-el">{BRANCH_ELEMENT[p.pillar.branch]}</span></div>
                </td>
              ))}
            </tr>
            <tr className="kt-row-tsuhen">
              {lucks.map((p) => (
                <td key={p.index}>{r.daiunDetails[p.index].stemTsuhen}</td>
              ))}
            </tr>
            <tr className="kt-row-zokan">
              {lucks.map((p) => (
                <td key={p.index}><Zokan zokan={r.daiunDetails[p.index].zokan} /></td>
              ))}
            </tr>
            <tr className="kt-row-tags">
              {lucks.map((p) => (
                <td key={p.index}><Tags names={[...new Set(r.daiunDetails[p.index].shinsatsu.map(hitName))]} /></td>
              ))}
            </tr>
            {(["干", "支"] as const).map((part) => (
              <tr key={part} className={`kt-row-rel kt-row-rel-${part === "干" ? "stem" : "branch"}`}>
                {lucks.map((p) => {
                  const items = luckRelationItems(r.daiunDetails[p.index].relations, part);
                  return (
                    <td key={p.index}>
                      <div className="kt-rel-head">{part}</div>
                      {items.length ? items.map((x) => <div key={luckRelationLabel(x)}>{luckRelationLabel(x)}</div>) : <span className="kt-none">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 書き込み欄（罫線） */}
        <div className="kt-memo">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="kt-memo-line" />
          ))}
        </div>
      </div>
    </PrintSheet>
  );
}
