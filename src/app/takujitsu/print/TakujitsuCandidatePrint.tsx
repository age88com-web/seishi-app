// src/app/takujitsu/print/TakujitsuCandidatePrint.tsx
//
// 擇日「良い日を探す」の候補日印刷（A4縦）。候補日を比較するための一覧表（カード形式にしない）。
// 1候補日＝3行のまとまり:
//   1行目: 日付｜曜｜日干支｜十二直｜二十八宿｜判定（選んだ用途）｜吉神｜凶神
//   2行目: 吉の用事 ／ 吉凶混在の用事 ／ 凶の用事（名前だけ）
//   3行目: 吉方位（喜神・財神）／吉時（時家で吉神のみの時辰）
// データは candidatePrintData.ts（既存の検索結果と既存の計算結果を集めたもの）。

import type { TakujitsuCandidatePrintData } from "./candidatePrintData";

const TONE: Record<string, string> = { good: "tdp-good", mixed: "tdp-mixed", bad: "tdp-bad", caution: "tdp-caution", neutral: "tdp-neutral" };

export default function TakujitsuCandidatePrint({ data }: { data: TakujitsuCandidatePrintData }) {
  return (
    <div className="tdp tcp">
      <header className="tdp-head">
        <div className="tdp-title">擇日候補日</div>
        <div className="tdp-date">{data.activityName}</div>
      </header>
      <table className="tdp-table tdp-kv tcp-meta">
        <tbody>
          <tr>
            <th>期間</th>
            <td>{data.period}</td>
            <th>計算基準時刻</th>
            <td>{data.baseTime}</td>
          </tr>
          <tr>
            <th>候補</th>
            <td colSpan={3}>
              吉 {data.counts.good}日 ／ 吉凶混在 {data.counts.mixed}日（判定は「{data.activityName}」についての判定）
            </td>
          </tr>
        </tbody>
      </table>

      {data.days.length === 0 ? (
        <p className="tdp-text">吉・吉凶混在の候補日はありません。</p>
      ) : (
        <table className="tdp-table tcp-list">
          <colgroup>
            <col style={{ width: "21mm" }} />
            <col style={{ width: "6mm" }} />
            <col style={{ width: "10mm" }} />
            <col style={{ width: "10mm" }} />
            <col style={{ width: "12mm" }} />
            <col style={{ width: "19mm" }} />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>日付</th>
              <th>曜</th>
              <th>日干支</th>
              <th>十二直</th>
              <th>二十八宿</th>
              <th>判定</th>
              <th>吉神</th>
              <th>凶神</th>
            </tr>
          </thead>
          {data.days.map((d) => (
            <tbody key={d.date} className="tcp-day">
              <tr className="tcp-r1">
                <td className="tdp-nowrap">{d.date}</td>
                <td className="tdp-c">{d.weekday}</td>
                <td className="tdp-c">{d.dayGanzhi}</td>
                <td className="tdp-c">{d.buildingDay}</td>
                <td className="tdp-c">{d.shuku28}</td>
                <td className={`tdp-nowrap ${TONE[d.verdict]}`}>［{d.verdictLabel}］</td>
                <td>{d.kichijin.join("・") || "―"}</td>
                <td>{d.kyojin.join("・") || "―"}</td>
              </tr>
              <tr className="tcp-r2">
                <td colSpan={8}>
                  <span className="tcp-k tdp-good">吉</span>
                  {d.activities.good.join("・") || "―"}
                  <span className="tcp-k tdp-mixed">吉凶混在</span>
                  {d.activities.mixed.join("・") || "―"}
                  <span className="tcp-k tdp-bad">凶</span>
                  {d.activities.bad.join("・") || "―"}
                </td>
              </tr>
              <tr className="tcp-r3">
                <td colSpan={8}>
                  <span className="tcp-k">吉方位</span>
                  {d.goodDirections.join("・")}
                  <span className="tcp-k">吉時</span>
                  {d.goodHours.length ? d.goodHours.map((b) => `${b}時`).join("・") : "―"}
                </td>
              </tr>
            </tbody>
          ))}
        </table>
      )}
    </div>
  );
}
