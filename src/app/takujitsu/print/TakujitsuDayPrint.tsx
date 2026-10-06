// src/app/takujitsu/print/TakujitsuDayPrint.tsx
//
// 擇日「日付を見る」の印刷専用レイアウト（A4縦・複数ページ）。画面のカード・ボタン・折りたたみは使わない。
// データは dayPrintData.ts（既存の計算結果を集めたもの）。複数日を渡した場合は、各日を新しいページから始める。
// 1日の構成（2ページ固定）:
//   1ページ目: 日付・暦情報 → 吉神 → 凶神 → 吉の用事 → 吉凶混在の用事 → 凶の用事 → 用途限定の残存忌
//   2ページ目: 方位（九宮3×3・南が上） → 時間（12時辰を6列×2段）   ※方位の直前で必ず改ページ
// 神殺名は吉神＝濃い青・凶神＝濃い赤の太字（説明文は通常色）。
// 吉凶は色だけに頼らず［吉］［凶］の文字でも示す（白黒印刷でも判別できる）。

import { PrintSheet } from "@/components/print/PrintRoot";
import type { PrintActivityNames, PrintShinsatsu, TakujitsuDayPrintData } from "./dayPrintData";

/** 時家の判定（既存の分類）の短い表記 */
const SHORT: Record<string, { label: string; cls: string }> = {
  吉神のみ: { label: "吉", cls: "tdp-good" },
  凶神のみ: { label: "凶", cls: "tdp-bad" },
  吉凶あり: { label: "吉凶", cls: "tdp-mixed" },
  該当なし: { label: "―", cls: "tdp-neutral" },
  勿用: { label: "勿用", cls: "tdp-bad" },
};

function ShinsatsuSection({ title, items, tone }: { title: string; items: PrintShinsatsu[]; tone: "good" | "bad" }) {
  const withReason = items.filter((x) => x.reason);
  return (
    <section className="tdp-sec">
      <h3 className="tdp-h3">
        {title}
        <span className="tdp-count">{items.length}件</span>
      </h3>
      {items.length === 0 ? (
        <p className="tdp-text">なし</p>
      ) : (
        <ul className={`tdp-names tdp-names-${tone}`}>
          {items.map((x) => (
            <li key={x.name} className={x.status === "解除" ? "is-cancelled" : undefined}>
              <span className="tdp-sname">{x.name}</span>
              {x.status && <span className="tdp-status">［{x.status}］</span>}
            </li>
          ))}
        </ul>
      )}
      {withReason.length > 0 && (
        <ul className={`tdp-reasons tdp-names-${tone}`}>
          {withReason.map((x) => (
            <li key={x.name}>
              <span className="tdp-sname">{x.name}</span>［{x.status}］：{x.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 吉／吉凶混在／凶／注意の用事（名前だけを続けて並べる） */
export function ActivityLines({ a }: { a: PrintActivityNames }) {
  const rows: [string, string[], string][] = [
    ["吉の用事", a.good, "tdp-good"],
    ["吉凶混在の用事", a.mixed, "tdp-mixed"],
    ["凶の用事", a.bad, "tdp-bad"],
    ["注意の用事", a.caution, "tdp-caution"],
  ];
  return (
    <>
      {rows.map(([title, names, cls]) => (
        <section key={title} className="tdp-sec">
          <h3 className="tdp-h3">
            <span className={cls}>{title}</span>
            <span className="tdp-count">{names.length}件</span>
          </h3>
          <p className="tdp-flow">{names.length ? names.join("・") : "なし"}</p>
        </section>
      ))}
    </>
  );
}

function Day({ d }: { d: TakujitsuDayPrintData }) {
  return (
    <article className="tdp-day">
      {/* 1ページ目（暦情報〜用事・残存忌）。内容が多い日だけ既存の PrintSheet が全体を縮小して必ず1ページに収める */}
      <PrintSheet className="tdp-sheet1">
        <header className="tdp-head">
          <div className="tdp-title">擇日</div>
          <div className="tdp-date">
            {d.date.replaceAll("-", "/")}（{d.weekday}）
          </div>
        </header>

        {/* 1. 日付・基本暦情報 */}
        <section className="tdp-sec">
          <h3 className="tdp-h3">暦情報</h3>
          <table className="tdp-table tdp-kv">
            <tbody>
              {d.calendar.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 2・3. 吉神・凶神（全件・別セクション） */}
        <ShinsatsuSection title="吉神" items={d.kichijin} tone="good" />
        <ShinsatsuSection title="凶神" items={d.kyojin} tone="bad" />

        {/* 6〜8. 用事（判定別。用事名を「・」区切りで続けて並べる。中立は出さない） */}
        <ActivityLines a={d.activities} />

        {d.restrictions.length > 0 && (
          <section className="tdp-sec">
            <h3 className="tdp-h3">用途限定の残存忌</h3>
            <ul className="tdp-reasons">
              {d.restrictions.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}
      </PrintSheet>

      {/* 2ページ目：方位・時間の吉凶確認ページ（方位の直前で必ず改ページ） */}
      <div className="tdp-page2">
        <header className="tdp-head tdp-head2">
          <div className="tdp-title">擇日</div>
          <div className="tdp-date">
            {d.date.replaceAll("-", "/")}（{d.weekday}）
          </div>
          <div className="tdp-head2-sub">方位・時間の吉凶</div>
        </header>
        {/* 4. 方位（九宮 3×3：巽・離・坤／震・中・兌／艮・坎・乾） */}
        <section className="tdp-sec tdp-keep">
          <h3 className="tdp-h3">
            方位（日盤吉凶方位）<span className="tdp-count">南が上</span>
          </h3>
          <div className="tdp-palace-row">
          <div className="tdp-palace">
            {d.palace.map((c) => (
              <div key={c.trigram} className={c.trigram === "中" ? "tdp-pcell tdp-pcenter" : "tdp-pcell"}>
                <div className="tdp-ptri">
                  {c.trigram}
                  {c.direction && <span className="tdp-pdir">{c.direction}</span>}
                </div>
                {c.marks.map((m) => (
                  <div key={m.label} className={m.tone === "吉" ? "tdp-good" : "tdp-bad"}>
                    {m.label}
                    <span className="tdp-ptone">［{m.tone}］</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {d.taisuiRest && <p className="tdp-note">太歳遊方：この日は遊方なし（休止日）</p>}
          </div>
        </section>

        {/* 5. 時間（時家・12時辰を 6列×2段で横並び） */}
        <section className="tdp-sec tdp-keep">
          <h3 className="tdp-h3">
            時間（時辰別吉凶・時家）
            <span className="tdp-count">判定：吉＝吉神のみ／凶＝凶神のみ／吉凶＝吉凶あり／―＝該当なし／勿用</span>
          </h3>
          <div className="tdp-hgrid">
            {d.hours.map((h) => {
              const short = SHORT[h.state];
              return (
                <div key={h.branch} className="tdp-hcell">
                  <div className="tdp-hbranch">{h.branch}</div>
                  <div className="tdp-htime">{h.time}</div>
                  <div className="tdp-hganzhi">{h.ganzhi}</div>
                  <div className={`tdp-hstate ${short.cls}`}>{short.label}</div>
                  {h.kichi.length > 0 && (
                    <div className="tdp-hnames">
                      <span className="tdp-hk tdp-good">吉</span>
                      {h.kichi.join("・")}
                    </div>
                  )}
                  {h.kyo.length > 0 && (
                    <div className="tdp-hnames">
                      <span className="tdp-hk tdp-bad">凶</span>
                      {h.kyo.join("・")}
                    </div>
                  )}
                  {h.other.length > 0 && (
                    <div className="tdp-hnames">
                      <span className="tdp-hk">他</span>
                      {h.other.join("・")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </article>
  );
}

export default function TakujitsuDayPrint({ days }: { days: TakujitsuDayPrintData[] }) {
  return (
    <div className="tdp">
      {days.map((d) => (
        <Day key={d.date} d={d} />
      ))}
    </div>
  );
}
