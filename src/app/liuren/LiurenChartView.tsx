// src/app/liuren/LiurenChartView.tsx
//
// 六壬神課の課式表示（三伝・四課・天地盤・課体）。
// 表示だけを担い、計算は一切しない。src/lib/liuren の calculateLiuren() /
// calculateLiurenAt() が返した LiurenChart をそのまま描画する。
// hooks を使わない純粋な表示コンポーネントなので、講座例題の照合テストから
// サーバー側で描画して検証できる（tests/liuren_ui.manual.tsx）。
//
// レイアウト: PC は左カラム（上＝三伝、下＝四課）＋右カラム（天地盤）。
//            狭い画面では 三伝 → 四課 → 天地盤 の順に縦に並ぶ（liuren.css）。
//
// 画面には課式そのものだけを出す。判定過程（sanchuan.trace）・出典・計算方法の説明は
// 内部データとして残すが表示しない。
//
// 神煞は課式画面には表示しない（空亡は遁干欄の ○ と天地盤の ○ で示す）。

import type { Branch, LiurenChart, TransmissionDetail } from "@/lib/liuren";
import { methodLabelText } from "./methodLabel";

/** 基本情報の表示行（ページ側で入力方法に応じて組み立てる） */
export type InfoRow = { label: string; value: string };

// 天地盤の表示位置（4×4 の外周。中央 2×2 は説明欄）。講座 p8 の地盤配置
//   巳 午 未 申
//   辰       酉
//   卯       戌
//   寅 丑 子 亥
const RING: readonly { earth: Branch; row: number; col: number }[] = [
  { earth: "巳", row: 1, col: 1 }, { earth: "午", row: 1, col: 2 },
  { earth: "未", row: 1, col: 3 }, { earth: "申", row: 1, col: 4 },
  { earth: "辰", row: 2, col: 1 }, { earth: "酉", row: 2, col: 4 },
  { earth: "卯", row: 3, col: 1 }, { earth: "戌", row: 3, col: 4 },
  { earth: "寅", row: 4, col: 1 }, { earth: "丑", row: 4, col: 2 },
  { earth: "子", row: 4, col: 3 }, { earth: "亥", row: 4, col: 4 },
];

const LESSON_ORDER = [3, 2, 1, 0] as const; // 四課 三課 二課 一課（講座と同じ並び）
const LESSON_LABEL = ["一課", "二課", "三課", "四課"] as const;
const LESSON_SUB = ["干上神", "", "支上神", ""] as const;
const TRANSMISSION_LABEL = ["初伝", "中伝", "末伝"] as const;


export default function LiurenChartView({ chart, info }: { chart: LiurenChart; info: readonly InfoRow[] }) {
  const { plate, lessons, generals, lessonGenerals, transmissions, xun } = chart;
  const voids = xun.voidBranches as readonly Branch[];

  return (
    <div className="lr-chart" data-testid="liuren-chart">
      {/* ---- 基本情報（項目名｜値｜項目名｜値 の小さな表。狭い画面では 項目名｜値 の2列） ---- */}
      <dl className="lr-info" aria-label="基本情報">
        {info.map((r) => (
          <div key={r.label} className="lr-info-row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="lr-main">
        <div className="lr-left">
          {/* ---- 三伝 ---- */}
          <section className="lr-section">
            <h2 className="lr-h2">
              三伝
              <span className="lr-h2-method">
                課体：<span className="lr-method" data-testid="liuren-method">{methodLabelText(chart.sanchuan)}</span>
              </span>
            </h2>
            {transmissions ? (
              <table className="lr-table lr-transmissions" data-testid="liuren-transmissions">
                <thead>
                  <tr><th /><th>遁干</th><th>支</th><th>天将</th><th>六親</th></tr>
                </thead>
                <tbody>
                  {transmissions.map((t: TransmissionDetail, i) => (
                    <tr key={TRANSMISSION_LABEL[i]}>
                      <th>{TRANSMISSION_LABEL[i]}</th>
                      <td>{t.isVoid ? <span title="空亡のため遁干なし">○</span> : t.hiddenStem}</td>
                      <td className="lr-branch" data-transmission={i}>{t.branch}</td>
                      <td>{t.general}</td>
                      <td>{t.relation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="lr-warn">三伝未確定</p>
            )}
          </section>

          {/* ---- 四課 ---- */}
          <section className="lr-section">
            <h2 className="lr-h2">四課</h2>
            <table className="lr-table lr-lessons" data-testid="liuren-lessons">
              <thead>
                <tr>
                  <th />
                  {LESSON_ORDER.map((i) => (
                    <th key={i}>
                      {LESSON_LABEL[i]}
                      {/* 補助表示のない課も同じ高さの行を確保して、課名の位置を揃える */}
                      <span className="lr-th-sub">{LESSON_SUB[i] || "\u00a0"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>天将</th>
                  {LESSON_ORDER.map((i) => <td key={i} className="lr-general">{lessonGenerals[i]}</td>)}
                </tr>
                <tr>
                  <th>上神</th>
                  {LESSON_ORDER.map((i) => <td key={i} className="lr-upper" data-lesson={i + 1}>{lessons[i].upper}</td>)}
                </tr>
                <tr>
                  <th>下神</th>
                  {LESSON_ORDER.map((i) => (
                    <td key={i} className="lr-lower">
                      {lessons[i].lower}
                      <span className="lr-th-sub">{i === 0 ? `寄宮 ${lessons[0].lowerBranch}` : "\u00a0"}</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* ---- 天地盤 ---- */}
        <section className="lr-section lr-right">
          <h2 className="lr-h2">天地盤</h2>
          <div className="lr-plate" data-testid="liuren-plate">
            {RING.map(({ earth, row, col }) => {
              const heaven = plate.heavenOn[earth];
              const general = generals.generalOn[heaven];
              return (
                <div
                  key={earth}
                  className={generals.noblePosition === earth ? "lr-cell is-noble" : "lr-cell"}
                  style={{ gridRow: row, gridColumn: col }}
                  data-earth={earth}
                  data-heaven={heaven}
                  data-general={general}
                >
                  <span className="lr-cell-general">{general}</span>
                  <span className="lr-cell-heaven">
                    {heaven}
                    {voids.includes(heaven) && <span className="lr-void-mark" title="空亡">○</span>}
                  </span>
                  <span className="lr-cell-earth">地 {earth}</span>
                </div>
              );
            })}
            <div className="lr-plate-center" style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}>
              <div>月将 <strong>{chart.input.monthGeneral}</strong></div>
              <div>加 占時 <strong>{chart.input.divinationBranch}</strong></div>
              <div className="lr-muted">
                {plate.offset === 0 ? "伏吟（天盤＝地盤）" : plate.offset === 6 ? "返吟（天地相冲）" : `天盤＝地盤＋${plate.offset}`}
              </div>
              <div className="lr-muted">
                {generals.dayOrNight}貴人 {generals.nobleBranch}・{generals.direction}布
              </div>
            </div>
          </div>
          <p className="lr-note">○＝空亡　太枠＝貴人</p>
        </section>
      </div>

    </div>
  );
}
