// src/app/ziwei/print/ZiweiInterpretationPrint.tsx
//
// /ziwei の「解釈を印刷」（A4縦・複数ページ）。命盤は出さず、紫微斗数全体の鑑定書として文章を出す。
// 内容は既存の計算・象意DBの結果だけ（AI は使わない。新しい解釈文は作らない）:
//   1. タイトル・基本情報
//   2. 運命指数 … 画面の行運欄と同じグラフ部品（YearIndexChart）と同じ系列（buildYearFortuneIndexSeries）・12宮の運命指数
//   3. 格局 … 盤全体の格局を1回だけ（成立・条件一致・要確認の一覧 → 各格局の象意・注意・影響が及ぶ宮・成立根拠）
//   4. 十二宮の解説 … 命宮から命盤の宮順で12宮すべて。各宮は新しいページから、宮固有の内容だけ。
//      印刷用鑑定データ（lib/ziwei/print/palacePrintData.ts）を共通の印刷専用レイアウト（PalacePrint）で並べる。
//      格局の説明は繰り返さない。
//   5. 大限 … 既存の大限表の全大限（年齢・大限の宮・画面と同じ行運星曜象意〔LimitBlock〕・行運格局〔FortunePattern〕）
//   6. 小限 … 全年齢の小限の宮（位置）と、鑑定日の小限1年分の解釈（画面と同じ LimitBlock）
// 資料名・ページ・内部ID・開発情報は出さない。
// 将来 AI 解釈を足す場合は、palacePrintData.ts で各宮の sections に節を追加する。

import type { PrintPattern, ZiweiPrintData } from "@/lib/ziwei/print/printData";
import type { ZiweiFortunePrintData } from "@/lib/ziwei/print/fortunePrintData";
import { PrintHeader } from "@/components/print/PrintRoot";
import PalacePrint from "@/components/print/PalacePrint";
import { buildZiweiPalacePrintData } from "@/lib/ziwei/print/palacePrintData";
import YearIndexChart from "../YearIndexChart";
import { LimitBlock } from "../FortuneStarPanel";
import { FortunePattern } from "../FortunePanel";

function PatternDetail({ p }: { p: PrintPattern }) {
  return (
    <div className="zwp-pattern">
      {/* 格局名・成立箇所・象意は離さない（注意・成立根拠は次ページへ続いてよい） */}
      <div className="zwp-pattern-head">
        <div className="zwp-pattern-name">
          {p.name}
          <span className={p.label === "成立" ? "zwp-label" : "zwp-label zwp-label-review"}>{p.label}</span>
          <span className="zwp-pattern-at">成立箇所：{p.palaces}</span>
        </div>
        {p.meanings.length > 0 && (
          <div className="zwp-pattern-body">
            <div className="zwp-k">{p.label === "成立" ? "象意" : "成立した場合の象意"}</div>
            <div className="zwp-text zwp-lines">
              {p.meanings.map((m, i) => (
                <div key={i}>{m}</div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="zwp-pattern-body">
        {p.warnings.length > 0 && (
          <>
            <div className="zwp-k">注意</div>
            <ul>
              {p.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </>
        )}
        {p.affected.length > 0 && (
          <>
            <div className="zwp-k">影響が及ぶ宮</div>
            <ul>
              {p.affected.map((a, i) => (
                <li key={i}>
                  {a.palace}（{a.note}）
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="zwp-k">成立根拠</div>
        <ul>
          {p.reasons.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ZiweiInterpretationPrint({ data, fortune }: { data: ZiweiPrintData; fortune: ZiweiFortunePrintData }) {
  const h = data.header;
  const { confirmed, review } = data.patterns;
  // 格局の象意の文は1回だけ印刷する（本命の格局欄 → 大限の行運格局の順。既出なら参照の注記にする）
  const printedMeaning = new Map<string, string>();
  for (const p of [...confirmed, ...review]) for (const m of p.meanings) if (!printedMeaning.has(m)) printedMeaning.set(m, "「格局」欄");
  const fortuneMeanings = (meanings: string[], here: string): { lines: string[]; note: string | null } => {
    const seen = [...new Set(meanings.map((m) => printedMeaning.get(m)).filter((x): x is string => !!x))];
    const lines = meanings.filter((m) => !printedMeaning.has(m));
    for (const m of lines) printedMeaning.set(m, here);
    return { lines, note: seen.length ? `${lines.length ? "ほかの象意" : "象意"}は${seen.join("・")}と同じ` : null };
  };
  return (
    <div className="zw-print-interp pp-doc">
      <PrintHeader
        title="紫微斗数"
        info={h}
        extra={[
          ["命宮", h.mingPalace],
          ["身宮", h.shenPalace],
          ["五行局", h.bureau],
        ]}
      />

      {/* ---- 2. 運命指数 ---- */}
      <section className="zwp-section">
        <h2 className="zwp-h1">運命指数</h2>
        <div className="zwp-graph">
          <YearIndexChart series={fortune.yearIndexSeries} selectedAge={null} />
          <div className="zwp-note">横軸＝数え年、縦軸＝流年指数（大限運命指数×２＋小限運命指数）。大限開始前は線を描かない。</div>
        </div>
        <table className="zwp-index-table">
          <thead>
            <tr>
              {data.board.map((p) => (
                <th key={p.branch}>
                  {p.name}
                  <span className="zwp-sub">（{p.branch}）</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {data.board.map((p) => (
                <td key={p.branch}>
                  {p.index.toFixed(1)}
                  <div className="zwp-sub">{p.grade}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      {/* ---- 3. 格局（盤全体。1回だけ） ---- */}
      <section className="zwp-section zwp-patterns">
        <h2 className="zwp-h1">格局</h2>
        <div className="zwp-pattern-list">
          <div>
            <span className="zwp-k-inline">成立</span>
            {confirmed.length ? confirmed.map((p) => `${p.name}（${p.palaces}）`).join("　") : "なし"}
          </div>
          {review.length > 0 && (
            <div>
              <span className="zwp-k-inline">条件一致・要確認</span>
              {review.map((p) => `${p.name}（${p.palaces}）`).join("　")}
            </div>
          )}
        </div>
        {confirmed.map((p) => (
          <PatternDetail key={p.name} p={p} />
        ))}
        {review.map((p) => (
          <PatternDetail key={p.name} p={p} />
        ))}
      </section>

      {/* ---- 4. 十二宮の解説 ---- */}
      <section className="zwp-section zwp-details">
        <h2 className="zwp-h1">十二宮の解説</h2>
        {data.palaces.map((p) => (
          <PalacePrint key={p.branch} data={buildZiweiPalacePrintData(p)} />
        ))}
      </section>

      {/* ---- 5. 大限 ---- */}
      <section className="zwp-section zwp-fortune">
        <h2 className="zwp-h1">大限</h2>
        <table className="zwp-limit-table">
          <thead>
            <tr>
              <th>年齢</th>
              <th>大限の宮</th>
              <th>運命指数</th>
            </tr>
          </thead>
          <tbody>
            {fortune.majors.map((m) => (
              <tr key={m.startAge}>
                <td>
                  {m.startAge}〜{m.endAge}歳
                </td>
                <td>
                  {m.stem}
                  {m.branch}（本命の{m.natalPalace}）
                </td>
                <td>
                  {m.index.toFixed(1)}　{m.grade}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fortune.majors.map((m) => (
          <div key={m.startAge} className="zwp-limit">
            <h3 className="zwp-h2">
              大限 {m.startAge}〜{m.endAge}歳　{m.stem}
              {m.branch}（本命の{m.natalPalace}）
            </h3>
            {m.star ? <LimitBlock r={m.star} t={m.hua} xiji={m.xiji} /> : <p className="zwp-text">この大限の行運星曜象意はありません。</p>}
            {m.patterns.length > 0 && (
              <div className="zwp-limit-patterns">
                <h4 className="zwp-h4">この大限の行運格局</h4>
                {m.patterns.map((p) => (
                  <FortunePattern key={p.id} p={p} printMeanings={fortuneMeanings(p.meanings, `大限 ${m.startAge}〜${m.endAge}歳の欄`)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ---- 6. 小限 ---- */}
      <section className="zwp-section zwp-fortune">
        <h2 className="zwp-h1">小限</h2>
        <table className="zwp-limit-table">
          <thead>
            <tr>
              <th>小限の宮</th>
              <th>数え年</th>
            </tr>
          </thead>
          <tbody>
            {fortune.minorTable.map((r) => (
              <tr key={r.branch}>
                <td>
                  {r.palace}（{r.branch}）
                </td>
                <td className="zwp-ages">{r.ages.join("・")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fortune.currentMinor ? (
          <div className="zwp-limit">
            <h3 className="zwp-h2">
              鑑定日（{fortune.currentMinor.appraisalDate.replaceAll("-", "/")}）の小限　{fortune.currentMinor.age}歳
              {fortune.currentMinor.branch}（本命の{fortune.currentMinor.natalPalace}）
            </h3>
            {fortune.currentMinor.star ? (
              <LimitBlock r={fortune.currentMinor.star} t={fortune.currentMinor.hua} xiji={fortune.currentMinor.xiji} effects={fortune.currentMinor.effects} />
            ) : (
              <p className="zwp-text">この小限の行運星曜象意はありません。</p>
            )}
          </div>
        ) : (
          <p className="zwp-text">鑑定日の小限はありません。</p>
        )}
      </section>
    </div>
  );
}
