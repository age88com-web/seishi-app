// src/components/print/PalacePrint.tsx
//
// 解釈印刷の1宮分（印刷専用レイアウト）。PalacePrintData（lib/print/palacePrint.ts）を鑑定書の体裁で並べるだけ。
// 宮は新しいページから：宮の見出し → 基本情報一覧表 → ■ 節 →（◆ 小見出し）本文・箇条・表。
// スタイルは print.css の .pp-*。

import type { PalacePrintData, PrintBlock } from "@/lib/print/palacePrint";

function Block({ b }: { b: PrintBlock }) {
  return (
    <div className="pp-block">
      {b.heading && (
        <h4 className="pp-h4">
          {b.heading}
          {b.sub && <span className="pp-sub">{b.sub}</span>}
        </h4>
      )}
      {b.rows && b.rows.length > 0 && (
        <table className="pp-table pp-table-inner">
          <tbody>
            {b.rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {b.paragraphs?.map((p, i) => (
        <div key={i} className="pp-para">
          {p.label && <div className="pp-label">{p.label}</div>}
          <p className="pp-text">{p.text}</p>
        </div>
      ))}
      {b.items && b.items.length > 0 && (
        <ul className="pp-list">
          {b.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PalacePrint({ data, className }: { data: PalacePrintData; className?: string }) {
  return (
    <section className={className ? `pp-palace ${className}` : "pp-palace"}>
      <h2 className="pp-title">
        {data.palaceName}
        {data.titleSub && <span className="pp-title-sub">{data.titleSub}</span>}
        {data.isShenPalace && <span className="pp-shen">身宮</span>}
      </h2>
      <table className="pp-table">
        <tbody>
          {data.summaryTable.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.sections.map((s) => (
        <div key={s.title} className="pp-section">
          <h3 className="pp-h3">{s.title}</h3>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </div>
      ))}
    </section>
  );
}
