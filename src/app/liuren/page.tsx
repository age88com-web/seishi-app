"use client";

// src/app/liuren/page.tsx
//
// 六壬神課 課式作成 UI。
// 計算ロジックは一切持たず、src/lib/liuren の calculateLiurenAt() / calculateLiuren() を
// 呼び、結果を LiurenChartView で表示するだけ。占断（吉凶・類神・応期など）は扱わない。
//
// 入力:
//   日時入力（通常）: 年月日・時分 → 日干支・占時（時支）・月将（太陽黄経）を自動計算。
//     検証用に占時・月将を手動指定できる。
//   日干支を直接指定（講座例題の再現用）: 日干支・占時・月将を直接入れる。
//     年月日を経由しないので、暦変換と起課ロジックを切り分けて確認できる。
//
// URL で初期値を渡せる（検証用）:
//   /liuren?day=丙戌&shi=酉&jiang=子     … 日干支を直接指定
//   /liuren?date=1994-10-09&time=12:00   … 日時入力（shi / jiang を付けると手動指定）

import { useEffect, useMemo, useState } from "react";
import AppSwitcher from "@/components/AppSwitcher";
import { calculateLiuren, calculateLiurenAt } from "@/lib/liuren";
import type { Branch, LiurenChart, Stem } from "@/lib/liuren";
import { STEMS, BRANCHES } from "@/lib/eto";
import LiurenChartView from "./LiurenChartView";
import type { InfoRow } from "./LiurenChartView";
import "./liuren.css";

const SIXTY: readonly string[] = Array.from({ length: 60 }, (_, i) => `${STEMS[i % 10]}${BRANCHES[i % 12]}`);

function pad(x: number): string {
  return String(x).padStart(2, "0");
}
function nowParts(): { date: string; time: string } {
  const n = new Date();
  return {
    date: `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`,
    time: `${pad(n.getHours())}:${pad(n.getMinutes())}`,
  };
}
function isBranch(x: string | null): x is Branch {
  return !!x && (BRANCHES as readonly string[]).includes(x);
}

type Mode = "datetime" | "direct";
type Computed = { chart: LiurenChart; info: InfoRow[] } | { error: string };

type FormState = {
  mode: Mode;
  date: string;
  time: string;
  /** "" = 自動計算 */
  shiOverride: "" | Branch;
  jiangOverride: "" | Branch;
  directDay: string;
  directShi: Branch;
  directJiang: Branch;
};

const INITIAL_FORM: FormState = {
  mode: "datetime", date: "", time: "", shiOverride: "", jiangOverride: "",
  directDay: "甲子", directShi: "子", directJiang: "子",
};

/** 現在時刻と URL パラメータ（day / shi / jiang / date / time）から初期値を作る */
function formFromUrl(search: string): FormState {
  const q = new URLSearchParams(search);
  const now = nowParts();
  const day = q.get("day");
  const shi = q.get("shi");
  const jiang = q.get("jiang");
  const base: FormState = { ...INITIAL_FORM, date: q.get("date") ?? now.date, time: q.get("time") ?? now.time };
  if (day && SIXTY.includes(day)) {
    return {
      ...base, mode: "direct", directDay: day,
      directShi: isBranch(shi) ? shi : base.directShi,
      directJiang: isBranch(jiang) ? jiang : base.directJiang,
    };
  }
  return {
    ...base,
    shiOverride: isBranch(shi) ? shi : "",
    jiangOverride: isBranch(jiang) ? jiang : "",
  };
}

export default function LiurenPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const { mode, date, time, shiOverride, jiangOverride, directDay, directShi, directJiang } = form;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 初期値（現在時刻）と URL パラメータ。window を使うためマウント後に1回だけ設定する
  // （サーバー描画との hydration 不一致を避ける。奇門遁甲ページと同じ方式）。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時の初期値設定のみ
    setForm(formFromUrl(window.location.search));
  }, []);

  const computed = useMemo<Computed | null>(() => {
    try {
      if (mode === "direct") {
        const chart = calculateLiuren({
          dayStem: directDay[0] as Stem,
          dayBranch: directDay[1] as Branch,
          divinationBranch: directShi,
          monthGeneral: directJiang,
        });
        return {
          chart,
          info: orderInfo(
            { label: "日時", value: "—" },
            { label: "日干支", value: directDay },
            { label: "月将", value: `${directJiang}` },
            { label: "占時", value: `${directShi}` },
            chart,
          ),
        };
      }
      const [y, mo, d] = date.split("-").map(Number);
      const [h, mi] = time.split(":").map(Number);
      if ([y, mo, d, h, mi].some((v) => !Number.isFinite(v))) return null;
      const r = calculateLiurenAt({
        year: y, month: mo, day: d, hour: h, minute: mi, timezone: "Asia/Tokyo",
        divinationBranch: shiOverride || undefined,
        monthGeneral: jiangOverride || undefined,
      });
      const c = r.calendar;
      return {
        chart: r.chart,
        info: orderInfo(
          { label: "日時", value: `${y}/${mo}/${d} ${pad(h)}:${pad(mi)}（日本時間）` },
          { label: "年月日干支", value: `${c.yearStem}${c.yearBranch}年 ${c.monthStem}${c.monthBranch}月 ${c.dayStem}${c.dayBranch}日` },
          { label: "月将", value: jiangOverride ? `${jiangOverride}（指定）` : `${r.chart.input.monthGeneral}（${r.zhongqi}）` },
          { label: "占時", value: shiOverride ? `${shiOverride}（指定）` : r.chart.input.divinationBranch },
          r.chart,
        ),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [mode, date, time, shiOverride, jiangOverride, directDay, directShi, directJiang]);

  return (
    <>
      <AppSwitcher />
      <main className="lr-page">
        <div className="lr-head">
          <h1 className="lr-h1">六壬神課 課式</h1>
          <button type="button" className="lr-print-btn" onClick={() => window.print()}>
            印刷
          </button>
        </div>
        {/* 印刷時だけ出す小さなタイトル */}
        <p className="lr-print-title">六壬神課</p>

        <div className="lr-mode" role="tablist" aria-label="入力方法">
          <button type="button" role="tab" aria-selected={mode === "datetime"}
            className={mode === "datetime" ? "lr-tab is-active" : "lr-tab"} onClick={() => update("mode", "datetime")}>
            日時で作成
          </button>
          <button type="button" role="tab" aria-selected={mode === "direct"}
            className={mode === "direct" ? "lr-tab is-active" : "lr-tab"} onClick={() => update("mode", "direct")}>
            日干支で作成
          </button>
        </div>

        {mode === "datetime" ? (
          <section className="lr-inputs">
            <label className="lr-field">
              年月日
              <input type="date" value={date} onChange={(e) => update("date", e.target.value)} className="lr-input" />
            </label>
            <label className="lr-field">
              時分
              <input type="time" value={time} onChange={(e) => update("time", e.target.value)} className="lr-input" />
            </label>
            <details className="lr-override">
              <summary>占時・月将を指定</summary>
              <div className="lr-inputs">
                <label className="lr-field">
                  占時
                  <select value={shiOverride} onChange={(e) => update("shiOverride", e.target.value as "" | Branch)} className="lr-input">
                    <option value="">自動</option>
                    {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label className="lr-field">
                  月将
                  <select value={jiangOverride} onChange={(e) => update("jiangOverride", e.target.value as "" | Branch)} className="lr-input">
                    <option value="">自動</option>
                    {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>
            </details>
          </section>
        ) : (
          <section className="lr-inputs">
            <label className="lr-field">
              日干支
              <select value={directDay} onChange={(e) => update("directDay", e.target.value)} className="lr-input">
                {SIXTY.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="lr-field">
              占時
              <select value={directShi} onChange={(e) => update("directShi", e.target.value as Branch)} className="lr-input">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="lr-field">
              月将
              <select value={directJiang} onChange={(e) => update("directJiang", e.target.value as Branch)} className="lr-input">
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </section>
        )}


        {computed && "error" in computed && <p className="lr-error">計算できませんでした：{computed.error}</p>}
        {computed && "chart" in computed && <LiurenChartView chart={computed.chart} info={computed.info} />}
      </main>
    </>
  );
}

/**
 * 基本情報の並び（2項目ずつ1行の表にする）:
 *   日時 | 日干支 / 月将 | 占時 / 空亡 | 昼夜 / 貴人
 */
function orderInfo(when: InfoRow, day: InfoRow, jiang: InfoRow, shi: InfoRow, chart: LiurenChart): InfoRow[] {
  const g = chart.generals;
  return [
    when, day,
    jiang, shi,
    { label: "空亡", value: `${chart.xun.voidBranches.join("")}（${chart.xun.xunHead}旬）` },
    { label: "昼夜", value: g.dayOrNight },
    { label: "貴人", value: `${g.dayOrNight}貴人 ${g.nobleBranch}（地盤 ${g.noblePosition}・${g.direction}布）` },
  ];
}
