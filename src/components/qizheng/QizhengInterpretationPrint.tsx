"use client";

// src/components/qizheng/QizhengInterpretationPrint.tsx
//
// 七政四餘の「解釈を印刷」（A4縦・複数ページ・上下30mm／左右22mm）。星盤は出さず、鑑定書として文章を並べる。
// 画面の詳細パネルの DOM は使わない（既存の計算・資料の結果から作った印刷用データを印刷専用レイアウトで並べる）:
//   1. タイトル・基本情報
//   2. 格局（盤全体。ここに1回だけ）：吉格・凶格（画面と同じ件数）→ 各格局の資料の文 → 格局の判断原則
//      （画面の「9. 格局」と同じ useKakkyokuView の結果）→ 行限判断（対象年齢を入力しているときだけ）
//   3. 十二宮の解釈：各宮は新しいページから。基本情報表 → 鑑定要約 → 宮の解釈 → 星の解釈 → 変曜・神殺・補足
//      （lib/qizheng_palace_print.ts の buildQzPalacePrintData。ChartSVG の interpretationOnly で十二宮ぶん作る）

import dynamic from "next/dynamic";
import { PrintHeader, type PrintHeaderInfo } from "@/components/print/PrintRoot";
import { useKakkyokuView } from "@/components/PalaceDetailPanel";
import type { QizhengChartProps } from "./QizhengChartPrint";
import "./qizheng-print.css";

const ChartSVG = dynamic(() => import("@/components/ChartSVG"), { ssr: false });

const CLS_NOTE: Record<string, string> = {
  C: "資料との対応は要確認のため、象意は表示しない",
  D: "資料に該当する格局名なし",
};

/** 盤全体の格局（画面の「9. 格局」と同じデータを鑑定書の体裁で） */
function KakkyokuPrint({ kakkyoku }: { kakkyoku: QizhengChartProps["kakkyoku"] }) {
  const { kkData, kkItems, kkHasError, kkView, kkGeneral } = useKakkyokuView(kakkyoku);
  if (kkItems.length === 0) {
    return <p className="pp-text">{kkHasError ? "格局の判定でエラーが出ている（既存エンジン）" : "盤全体で成立している格局はない"}</p>;
  }
  return (
    <>
      <p className="pp-note">盤全体で成立している格局（既存格局エンジンの結果。宮との対応データがないため、特定の宮に限定しない）</p>
      {kkView.map((k) => (
        <div key={`${k.luck}-${k.name}`} className="pp-block pp-keep">
          <h4 className="pp-h4">
            {k.name}
            <span className="pp-mark">{k.luck}</span>
            {k.groups.length > 0 && <span className="pp-sub">{[...new Set(k.groups.flatMap((g) => g.sections))].join("・")}</span>}
          </h4>
          {kkData && k.groups.length === 0 && <p className="pp-note">{CLS_NOTE[k.cls ?? ""] ?? "資料との対応表に未登録のため、象意は表示しない"}</p>}
          {k.groups.map((g, i) => (
            <div key={i}>
              {g.meaning && <p className="pp-text">{g.labeled ? "象意：" : ""}{g.meaning}</p>}
              {g.condition && <p className="pp-text">成立条件：{g.condition}</p>}
            </div>
          ))}
        </div>
      ))}
      {kkGeneral.length > 0 && (
        <div className="pp-block">
          <h4 className="pp-h4">格局の判断原則</h4>
          <ul className="pp-list">
            {kkGeneral.map((g) => (
              <li key={g.id}>{g.modern_japanese}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function QizhengInterpretationPrint({
  info,
  extra,
  chart,
  good,
  bad,
  limitLines,
}: {
  info: PrintHeaderInfo;
  extra: [string, string][];
  /** 十二宮の印刷用データの材料（盤印刷と同じ入力に、命度・対象年齢・昼夜・格局結果を加えたもの） */
  chart: QizhengChartProps;
  /** 格局（画面と同じ件数に絞ったもの） */
  good: string[];
  bad: string[];
  /** 行限判断（画面と同じ文。対象年齢未入力・該当なしなら空） */
  limitLines: string[];
}) {
  return (
    <div className="qz-print-interp pp-doc">
      {/* 解釈印刷のタイトルは「七政四餘」だけ（氏名はタイトル横に出さない） */}
      <PrintHeader title="七政四餘" info={{ ...info, name: null }} extra={extra} />

      <h2 className="pp-h2">格局</h2>
      <table className="pp-table pp-kk-table">
        <thead>
          <tr>
            <th>吉格</th>
            <th>凶格</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{good.length ? good.join("・") : "なし"}</td>
            <td>{bad.length ? bad.join("・") : "なし"}</td>
          </tr>
        </tbody>
      </table>
      <h3 className="pp-h3">格局の説明・判断原則</h3>
      <KakkyokuPrint kakkyoku={chart.kakkyoku} />

      {limitLines.length > 0 && (
        <>
          <h3 className="pp-h3">行限判断</h3>
          <ul className="pp-list">
            {limitLines.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}

      <div className="qz-print-palaces">
        <ChartSVG {...chart} interpretationOnly />
      </div>
    </div>
  );
}
