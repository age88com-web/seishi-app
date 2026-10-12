// src/app/ziwei/print/ZiweiChartPrint.tsx
//
// /ziwei の「盤を印刷」（A4横1枚）。上部に基本情報を2行でコンパクトに置き、その下を12宮命盤に使う。
// 解釈の文章は出さない。内容は buildZiweiPrintData()（既存の作盤・力量の結果を集めたもの）だけを使う。
// 盤の中身（星・旺衰・力量・四化・運命指数・大限）は従来の印刷用命盤（.zwp-board）のまま。大きさだけ紙面に合わせる。
// A4横は盤印刷のときだけ（page.tsx の PrintRoot page で指定）。解釈印刷・他の術はA4縦のまま。

import type { Branch } from "@/lib/ziwei";
import type { PrintStar, ZiweiPrintData } from "@/lib/ziwei/print/printData";
import { PrintSheet } from "@/components/print/PrintRoot";

const GRID: Readonly<Record<Branch, { row: number; col: number }>> = {
  巳: { row: 1, col: 1 },
  午: { row: 1, col: 2 },
  未: { row: 1, col: 3 },
  申: { row: 1, col: 4 },
  辰: { row: 2, col: 1 },
  酉: { row: 2, col: 4 },
  卯: { row: 3, col: 1 },
  戌: { row: 3, col: 4 },
  寅: { row: 4, col: 1 },
  丑: { row: 4, col: 2 },
  子: { row: 4, col: 3 },
  亥: { row: 4, col: 4 },
};

function Star({ s }: { s: PrintStar }) {
  return (
    <span className={s.isMain ? "zwp-star zwp-main" : "zwp-star"}>
      {s.name}
      {s.strength && <span className="zwp-st">{s.strength}</span>}
      {s.power !== null && <span className="zwp-pw">{s.power}</span>}
      {s.hua.map((h) => (
        <span key={h.kind} className="zwp-hua">
          {h.kind.replace(/^化/, "")}
        </span>
      ))}
    </span>
  );
}

export default function ZiweiChartPrint({ data }: { data: ZiweiPrintData }) {
  const h = data.header;
  const line2: [string, string][] = [
    ["陰暦", h.lunar],
    ["命宮", h.mingPalace],
    ["身宮", h.shenPalace],
    ["五行局", h.bureau],
  ];
  return (
    <PrintSheet className="zw-chart-sheet">
      <div className="zw-print-chart">
        {/* 基本情報（2行） */}
        <header className="zwc-head">
          <div className="zwc-line1">
            <span className="zwc-title">紫微斗数</span>
            {h.name && <span className="zwc-name">{h.name}</span>}
            <span>
              {h.birthDate} {h.birthTime}
            </span>
            <span>{h.sex}</span>
            <span>{h.place}</span>
          </div>
          <div className="zwc-line2">
            {line2.map(([k, v]) => (
              <span key={k}>
                <b>{k}</b> {v}
              </span>
            ))}
          </div>
        </header>

        <div className="zwp-board">
          {data.board.map((p) => (
            <div key={p.branch} className={p.name === "命宮" ? "zwp-cell zwp-ming" : "zwp-cell"} style={{ gridRow: GRID[p.branch].row, gridColumn: GRID[p.branch].col }}>
              <div className="zwp-stars">
                {p.mains.map((s) => (
                  <Star key={s.name} s={s} />
                ))}
              </div>
              <div className="zwp-stars zwp-subs">
                {p.subs.map((s) => (
                  <Star key={s.name} s={s} />
                ))}
              </div>
              {/* 新規諸星（§37）: 雑曜は小さく、十二神等はさらに小さく */}
              <div className="zwp-stars zwp-minors">
                {p.minors.map((n) => (
                  <span key={n} className="zwp-mstar">
                    {n}
                  </span>
                ))}
              </div>
              <div className="zwp-stars zwp-cycles">
                {p.cycles.map((n, i) => (
                  <span key={`${n}${i}`} className="zwp-cstar">
                    {n}
                  </span>
                ))}
              </div>
              <div className="zwp-foot">
                <div className="zwp-name">
                  <span>
                    {p.name}
                    {p.isShenPalace && <span className="zwp-shen">身宮</span>}
                  </span>
                  <span className="zwp-branch">{p.branch}</span>
                </div>
                <div className="zwp-meta">
                  <span>
                    運命指数 {p.index.toFixed(1)} {p.grade}
                  </span>
                  <span>大限 {p.dayun}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="zwp-center" style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}>
            <div className="zwp-legend">
              <div className="zwp-masters">
                <b>命主</b> {data.masters.mingZhu}　<b>身主</b> {data.masters.shenZhu}
              </div>
              <div>星名のあとの1字＝旺衰（廟・旺・得・利・平・不・陥）</div>
              <div>数字＝星の力量</div>
              <div>枠つきの1字＝四化（禄・権・科・忌）</div>
              <div>運命指数＝宮の運命指数と段階</div>
              <div>小さい文字＝雑曜、最小の文字＝十二神等</div>
            </div>
          </div>
        </div>
      </div>
    </PrintSheet>
  );
}
