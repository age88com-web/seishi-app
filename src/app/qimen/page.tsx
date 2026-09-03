"use client";

// src/app/qimen/page.tsx
//
// 奇門遁甲 UI（PC 表示のみ）。
// 排盤ロジックは一切持たず、既存の qimenEngine.calculate() を呼ぶだけ。
//
// 真太陽時 ON のときだけ、入力の壁時計時刻に
//   均時差 + 経度時差（標準子午線 135°E 基準、地図で選んだ経度を使用）
// を UI 層で加算してから calculate() へ渡す（排盤ロジックは不変更）。
// 緯度は将来の天文計算・七政四餘との共用のため保持のみ（計算には未使用）。

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { calculate, resolveKokuoForPalace } from "@/lib/qimen";
import type { QimenResult, KokuoEntry } from "@/lib/qimen";
import AppSwitcher from "@/components/AppSwitcher";
import { stripRuby } from "./stripRuby";
import "./print.css";

// Leaflet は window 依存のため SSR 無効で読み込む
const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div style={{ height: 300, width: 460, background: "#eee", border: "1px solid #999", borderRadius: 4 }} />,
});

// ---- 洛書九宮の配置 -----------------------------------------------------
const GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;
const PALACE_LABEL: Record<number, string> = {
  1: "坎一宮", 2: "坤二宮", 3: "震三宮", 4: "巽四宮", 5: "中五宮",
  6: "乾六宮", 7: "兌七宮", 8: "艮八宮", 9: "離九宮",
};

// 標準子午線（日本標準時）。真太陽時の経度時差の基準。
const STD_MERIDIAN = 135;
// 初期地点: 東京駅
const DEFAULT_LAT = 35.6812;
const DEFAULT_LNG = 139.7671;

// ---- 均時差（近似）: 真太陽時 ON のときだけ使用 -------------------------
function equationOfTimeMinutes(d: Date): number {
  const rad = Math.PI / 180;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = (d.getTime() - start) / 86_400_000;
  const B = rad * ((360 / 365) * (day - 81));
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

function pad(x: number): string {
  return String(x).padStart(2, "0");
}
function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

type Resolved = {
  year: number; month: number; day: number; hour: number; minute: number;
  shiftMin: number | null; // 真太陽時補正量（分）。OFF のとき null
};

function resolveTime(
  date: string, time: string, trueSolar: boolean, lng: number,
): Resolved | null {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if ([y, mo, d, h, mi].some((v) => !Number.isFinite(v))) return null;

  if (!trueSolar) {
    return { year: y, month: mo, day: d, hour: h, minute: mi, shiftMin: null };
  }
  const base = new Date(y, mo - 1, d, h, mi);
  const shiftMin = equationOfTimeMinutes(base) + (lng - STD_MERIDIAN) * 4;
  const t = new Date(base.getTime() + Math.round(shiftMin) * 60_000);
  return {
    year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate(),
    hour: t.getHours(), minute: t.getMinutes(),
    shiftMin: Math.round(shiftMin),
  };
}

// ---- 時辰（十二支）: 実用の時辰送り用。排盤ロジックには関与しない -------
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
type BranchName = (typeof BRANCHES)[number];

// 各時辰の代表時刻（時）。子は 00:00。
const REP_HOUR: Record<BranchName, number> = {
  子: 0, 丑: 2, 寅: 4, 卯: 6, 辰: 8, 巳: 10,
  午: 12, 未: 14, 申: 16, 酉: 18, 戌: 20, 亥: 22,
};

// 時（0–23）→ 時辰。23 時台は CalendarEngine の日干支境界（子初 23:00）に合わせて子時。
function branchOfHour(h: number): BranchName {
  if (!Number.isFinite(h)) return "子";
  if (h === 23 || h === 0) return "子";
  return BRANCHES[Math.floor((h + 1) / 2) % 12];
}

function fmtDate(t: Date): string {
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

// 時辰を 2 時間単位で前後へ。亥→翌日子、子→前日亥 のように日付も動かす。
// 23 時台（子時）は「翌日の丑 / 同日の亥」へ送る。
function shiftJichen(
  date: string, time: string, dir: 1 | -1,
): { date: string; time: string } | null {
  const [y, mo, d] = date.split("-").map(Number);
  const h = Number(time.split(":")[0]);
  if ([y, mo, d, h].some((v) => !Number.isFinite(v))) return null;

  const is23 = h === 23;
  const cur = branchOfHour(h);
  const idx = BRANCHES.indexOf(cur);
  const repTime = (b: BranchName) => `${pad(REP_HOUR[b])}:00`;

  if (dir === 1) {
    if (is23) return { date: fmtDate(new Date(y, mo - 1, d + 1)), time: repTime("丑") };
    if (cur === "亥") return { date: fmtDate(new Date(y, mo - 1, d + 1)), time: repTime("子") };
    return { date, time: repTime(BRANCHES[idx + 1]) };
  }
  if (is23) return { date, time: repTime("亥") };
  if (cur === "子") return { date: fmtDate(new Date(y, mo - 1, d - 1)), time: repTime("亥") };
  return { date, time: repTime(BRANCHES[idx - 1]) };
}

export default function QimenPage() {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("12:00");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [trueSolar, setTrueSolar] = useState(false);
  const [lat, setLat] = useState(DEFAULT_LAT); // 保持のみ（排盤計算には未使用）
  const [lng, setLng] = useState(DEFAULT_LNG);

  // 宮詳細: クリックで選択（同じ宮を再クリックで解除）。初期は未選択。
  const [selectedPalace, setSelectedPalace] = useState<number | null>(null);

  // ?ts=1 で真太陽時を初期 ON（共有 URL 用。ハイドレーション後に反映）
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("ts") === "1") setTrueSolar(true);
  }, []);

  // 場所検索（OSM Nominatim・無料・APIキー不要・ベストエフォート）
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setSearching(true);
    setSearchMsg(null);
    setHits([]);
    try {
      // Nominatim 利用規約: 1 req/sec 上限・対話利用のみ（本 UI は手動検索のみ）
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5" +
        "&accept-language=ja&countrycodes=jp&q=" +
        encodeURIComponent(query);
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const arr = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      if (arr.length === 0) {
        setSearchMsg("該当なし");
        return;
      }
      setHits(arr.map((a) => ({ name: a.display_name, lat: Number(a.lat), lon: Number(a.lon) })));
    } catch {
      setSearchMsg("検索できませんでした（OSM Nominatim）。地図クリックで指定してください。");
    } finally {
      setSearching(false);
    }
  }

  const resolved = useMemo(
    () => resolveTime(date, time, trueSolar, lng),
    [date, time, trueSolar, lng],
  );

  const { result, error } = useMemo((): { result: QimenResult | null; error: string | null } => {
    if (!resolved) return { result: null, error: "日付・時刻を入力してください" };
    try {
      const r = calculate({
        year: resolved.year, month: resolved.month, day: resolved.day,
        hour: resolved.hour, minute: resolved.minute, timezone,
      });
      return { result: r, error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [resolved, timezone]);

  const usedLabel = resolved
    ? `${resolved.year}-${pad(resolved.month)}-${pad(resolved.day)} ${pad(resolved.hour)}:${pad(resolved.minute)}`
    : "—";

  // 場所名（場所検索で選んだときに q へ入る）。取得できたときだけ印刷に出す。
  const placeName = q.trim();
  const shiftLabel =
    resolved && resolved.shiftMin !== null
      ? `${resolved.shiftMin >= 0 ? "+" : ""}${resolved.shiftMin}分`
      : "—";

  return (
    <>
      <AppSwitcher />
      <main style={S.page} className="qm-main">
      <h1 style={S.h1}>奇門遁甲 排盤</h1>

      {/* ---- 入力 ---- */}
      <section style={S.inputs}>
        <label style={S.field}>
          年月日
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input} />
        </label>
        <label style={S.field}>
          時分
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={S.input} />
        </label>
        <label style={S.field}>
          時辰
          <select
            value={branchOfHour(Number(time.split(":")[0]))}
            onChange={(e) => setTime(`${pad(REP_HOUR[e.target.value as BranchName])}:00`)}
            style={S.input}
          >
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{b}（{pad(REP_HOUR[b])}:00）</option>
            ))}
          </select>
        </label>
        <div style={{ ...S.field, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
          <button
            type="button"
            style={S.btn}
            onClick={() => {
              const s = shiftJichen(date, time, -1);
              if (s) { setDate(s.date); setTime(s.time); }
            }}
          >
            ← 前の時辰
          </button>
          <button
            type="button"
            style={S.btn}
            onClick={() => {
              const s = shiftJichen(date, time, 1);
              if (s) { setDate(s.date); setTime(s.time); }
            }}
          >
            次の時辰 →
          </button>
        </div>
        <label style={S.field}>
          タイムゾーン
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} style={S.input} />
        </label>
        <label style={{ ...S.field, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={trueSolar} onChange={(e) => setTrueSolar(e.target.checked)} />
          真太陽時（均時差＋経度時差）
        </label>
        <button
          type="button"
          className="qm-noprint"
          style={S.btn}
          onClick={() => window.print()}
          disabled={!result}
        >
          印刷
        </button>
      </section>

      {/* ---- 使用時刻の表示 ---- */}
      <div style={S.timeInfo}>
        <span>入力時刻：<b>{date} {time}</b></span>
        <span>
          排盤に使用：<b>{usedLabel}</b>
          {resolved && resolved.shiftMin !== null && (
            <span style={S.shiftNote}>
              （真太陽時補正 {resolved.shiftMin >= 0 ? "+" : ""}{resolved.shiftMin}分）
            </span>
          )}
          {resolved && resolved.shiftMin === null && <span style={S.shiftNote}>（入力どおり）</span>}
        </span>
      </div>

      {/* ---- 真太陽時 ON のとき: 地図＋緯度経度＋検索 ---- */}
      {trueSolar && (
        <section style={S.geoBox}>
          <form onSubmit={doSearch} style={S.searchRow}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="場所を検索（例: 岐阜市 / 東京駅 / 京都市）"
              style={{ ...S.input, width: 300 }}
            />
            <button type="submit" disabled={searching} style={S.btn}>
              {searching ? "検索中…" : "検索"}
            </button>
          </form>
          {searchMsg && <div style={S.searchMsg}>{searchMsg}</div>}
          {hits.length > 0 && (
            <ul style={S.hitList}>
              {hits.map((h, i) => (
                <li key={i}>
                  <button
                    style={S.hitBtn}
                    onClick={() => {
                      setLat(Number(h.lat.toFixed(5)));
                      setLng(Number(h.lon.toFixed(5)));
                      setHits([]);
                      setQ(h.name.split(",")[0]);
                    }}
                  >
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div style={S.mapAndCoords}>
            <MapPicker
              lat={lat}
              lng={lng}
              onPick={(la, lo) => {
                setLat(la);
                setLng(lo);
              }}
            />
            <div style={S.coords}>
              <label style={S.field}>
                緯度 latitude
                <input
                  type="number" step="0.00001" value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  style={{ ...S.input, width: 120 }}
                />
              </label>
              <label style={S.field}>
                経度 longitude
                <input
                  type="number" step="0.00001" value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                  style={{ ...S.input, width: 120 }}
                />
              </label>
              <div style={S.coordNote}>
                地図クリックで自動反映。手入力で微調整可。
                <br />経度は真太陽時補正に使用（基準 {STD_MERIDIAN}°E）。緯度は保持のみ。
              </div>
            </div>
          </div>
        </section>
      )}

      {error && <div style={S.error}>計算エラー: {error}</div>}

      {result && (
        <div style={S.layout}>
          {/* ---- 九宮盤（講義資料 p.34 準拠・変更禁止部分） ---- */}
          <div style={S.gridWrap}>
            <div style={S.grid} className="qm-grid">
              {GRID_ORDER.map((n) => (
                <PalaceCell
                  key={n}
                  n={n}
                  result={result}
                  selected={selectedPalace === n}
                  onSelect={() => setSelectedPalace((prev) => (prev === n ? null : n))}
                />
              ))}
            </div>
            <UnavailableNote result={result} />
          </div>

          {/* ---- 右サイド: 宮詳細 / 定局 / 値符・値使 / 全体格局（格局名のみ） ---- */}
          <aside style={S.side}>
            <Panel title="宮詳細">
              {selectedPalace === null ? (
                <div style={{ padding: "8px 10px", color: "#888", fontSize: 13 }}>
                  九宮盤の宮をクリックすると詳細を表示します。
                </div>
              ) : (
                <PalaceDetail result={result} palace={selectedPalace} />
              )}
            </Panel>

            <Panel title="定局">
              <Row k="遁 / 局 / 元" v={`${result.dingju.dun}　${result.dingju.ju}局　${result.dingju.yuan}`} />
              <Row k="節気" v={`${result.calendar.solarTerm}`} />
              <Row
                k="四柱"
                v={`${result.calendar.yearStem}${result.calendar.yearBranch}　${result.calendar.monthStem}${result.calendar.monthBranch}　${result.calendar.dayStem}${result.calendar.dayBranch}　${result.calendar.hourStem}${result.calendar.hourBranch}`}
              />
              <Row k="旬首 / 六儀" v={`${result.xunShou.xunShou}　（${result.xunShou.liuyi}）`} />
            </Panel>

            <Panel title="値符・値使">
              <Row k="値符（九星）" v={result.jiuXing ? `${result.jiuXing.zhifu.star}　＠${result.jiuXing.zhifu.palace}宮` : "—（未算出）"} />
              <Row k="値使（八門）" v={result.baMen ? `${result.baMen.zhishi.men}　＠${result.baMen.zhishi.palace}宮` : "—（未算出）"} />
              <Row k="直符（八神）" v={result.baShen ? `${result.baShen.zhifu.god}　＠${result.baShen.zhifu.palace}宮` : "—（未算出）"} />
            </Panel>

            {/* 盤外の「吉格一覧 / 凶格一覧」は今回は非表示（格局は九宮盤内と宮詳細に表示）。
                内部データ result.jikaku / result.kyokaku は保持したまま。 */}
          </aside>
        </div>
      )}

      {/* ---- 印刷専用ドキュメント（画面では非表示 / @media print でのみ表示） ---- */}
      {result && (
        <PrintDoc
          result={result}
          inputDateTime={`${date} ${time}`}
          usedLabel={usedLabel}
          placeName={placeName}
          lat={lat}
          lng={lng}
          trueSolar={trueSolar}
          shiftLabel={shiftLabel}
          selectedPalace={selectedPalace}
        />
      )}
      </main>
    </>
  );
}

// 印刷専用ドキュメント。画面には出さず（print.css で display:none）、
// @media print のときだけ A4 縦の鑑定書レイアウトで表示する。
// 排盤結果は既存 calculate() の戻り値のみを使う。
function PrintDoc({
  result,
  inputDateTime,
  usedLabel,
  placeName,
  lat,
  lng,
  trueSolar,
  shiftLabel,
  selectedPalace,
}: {
  result: QimenResult;
  inputDateTime: string;
  usedLabel: string;
  placeName: string;
  lat: number;
  lng: number;
  trueSolar: boolean;
  shiftLabel: string;
  selectedPalace: number | null;
}) {
  const c = result.calendar;
  return (
    <div className="qm-print-doc">
      <h1>奇門遁甲 排盤</h1>

      <section className="pd-block">
        <h2>基本情報</h2>
        <Row k="入力日時" v={inputDateTime} />
        <Row k="排盤使用日時" v={usedLabel} />
        {placeName && <Row k="場所" v={placeName} />}
        <Row k="緯度経度" v={`${lat}, ${lng}`} />
        <Row k="真太陽時" v={trueSolar ? "ON" : "OFF"} />
        <Row k="補正分" v={shiftLabel} />
      </section>

      <section className="pd-block">
        <h2>定局</h2>
        <Row k="遁 / 局 / 元" v={`${result.dingju.dun}　${result.dingju.ju}局　${result.dingju.yuan}`} />
        <Row k="節気" v={c.solarTerm} />
        <Row
          k="四柱"
          v={`${c.yearStem}${c.yearBranch}　${c.monthStem}${c.monthBranch}　${c.dayStem}${c.dayBranch}　${c.hourStem}${c.hourBranch}`}
        />
        <Row k="旬首 / 六儀" v={`${result.xunShou.xunShou}　（${result.xunShou.liuyi}）`} />
      </section>

      <section className="pd-block pd-grid">
        <h2>九宮盤</h2>
        <div style={S.grid} className="qm-grid">
          {GRID_ORDER.map((n) => (
            <PalaceCell key={n} n={n} result={result} selected={false} onSelect={() => {}} />
          ))}
        </div>
      </section>

      <section className="pd-block">
        <h2>値符・値使</h2>
        <Row
          k="値符（九星）"
          v={result.jiuXing ? `${result.jiuXing.zhifu.star}　＠${result.jiuXing.zhifu.palace}宮` : "—"}
        />
        <Row
          k="値使（八門）"
          v={result.baMen ? `${result.baMen.zhishi.men}　＠${result.baMen.zhishi.palace}宮` : "—"}
        />
        <Row
          k="直符（八神）"
          v={result.baShen ? `${result.baShen.zhifu.god}　＠${result.baShen.zhifu.palace}宮` : "—"}
        />
      </section>

      {/* 盤外の吉格 / 凶格一覧は非表示。格局は九宮盤の各宮内と、下の宮詳細に表示する。 */}

      {selectedPalace !== null && (
        <>
          {/* 1ページ目: 選択宮の基本詳細のみ（剋應本文は含めない） */}
          <section className="pd-block pd-palace-basic">
            <h2>宮詳細（{PALACE_LABEL[selectedPalace] ?? `宮${selectedPalace}`}）</h2>
            <PalaceDetailRows result={result} palace={selectedPalace} />
          </section>

          {/* 2ページ目以降: 剋應本文。該当なしの系統は省略。 */}
          <section className="pd-kokuo">
            <h2>剋應（{PALACE_LABEL[selectedPalace] ?? `宮${selectedPalace}`}）</h2>
            <PalaceKokuo result={result} palace={selectedPalace} hideEmpty />
          </section>
        </>
      )}
    </div>
  );
}

// 宮ごとに成立している格局（吉→凶の順・既存 matches の順序のまま）を最大5件抽出。
//   吉格 = result.jikaku.matches のうち palaces に当該宮を含むもの
//   凶格 = result.kyokaku.matches のうち palaces に当該宮を含むもの
//   palaces=[] の全盤成立格は宮には属さないため対象外。
type KakuItem = { name: string; kind: "ji" | "kyo" };

function palaceKaku(
  result: QimenResult,
  palace: number,
): { shown: KakuItem[]; more: number } {
  const list: KakuItem[] = [
    ...result.jikaku.matches
      .filter((m) => m.palaces.includes(palace))
      .map((m) => ({ name: m.name, kind: "ji" as const })),
    ...result.kyokaku.matches
      .filter((m) => m.palaces.includes(palace))
      .map((m) => ({ name: m.name, kind: "kyo" as const })),
  ];
  return { shown: list.slice(0, 5), more: Math.max(0, list.length - 5) };
}

function KakuList({ result, palace }: { result: QimenResult; palace: number }) {
  const { shown, more } = palaceKaku(result, palace);
  if (shown.length === 0) return null;
  return (
    <div style={S.kaku} className="qm-kaku">
      {shown.map((k, i) => (
        <span
          key={i}
          style={k.kind === "ji" ? S.kakuJi : S.kakuKyo}
          className={k.kind === "ji" ? "qm-kaku-ji" : "qm-kaku-kyo"}
        >
          {k.name}
        </span>
      ))}
      {more > 0 && (
        <span style={S.kakuMore} className="qm-kaku-more">+{more}</span>
      )}
    </div>
  );
}

// ==== 九宮盤（講義資料「排盤の完成」p.34 と同じレイアウト・変更禁止） ====
//   宮名（左上）／ 八門（中央）／ 天盤干（左）・九星（右）／ 地盤干（左）・八神（右）
//   中宮は地盤干のみ中央表示。色分けなし（講義資料はモノクロ）。
//   ↑ この6要素の配置は不変。下部の空き部分にだけ格局名（青=吉/赤=凶）を追加する。
function PalaceCell({
  n,
  result,
  selected,
  onSelect,
}: {
  n: number;
  result: QimenResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const p = result.palaces[n] ?? { jiuXing: [], baMen: [], baShen: [] };
  const isCenter = n === 5;
  return (
    <div
      style={{ ...S.cell, cursor: "pointer", ...(selected ? S.cellSelected : {}) }}
      className="qm-cell"
      onClick={onSelect}
    >
      <div style={S.cellLabel} className="qm-cl">{PALACE_LABEL[n]}</div>
      {isCenter ? (
        <div style={S.centerBody} className="qm-cb">
          <span style={S.stem} className="qm-st">{p.diPanStem ?? "—"}</span>
        </div>
      ) : (
        <>
          <div style={S.men} className="qm-mn">{p.baMen.join("・") || "—"}</div>
          <div style={S.dataRow} className="qm-dr">
            <span style={S.stem} className="qm-st">{p.tianPanStem ?? "—"}</span>
            <span style={S.starShen} className="qm-ss">{p.jiuXing.join("・") || "—"}</span>
          </div>
          <div style={S.dataRow} className="qm-dr">
            <span style={S.stem} className="qm-st">{p.diPanStem ?? "—"}</span>
            <span style={S.starShen} className="qm-ss">{p.baShen.join("・") || "—"}</span>
          </div>
        </>
      )}
      {/* 宮内の格局名（下部・空き部分）。中宮は成立格局があるときだけ出る。 */}
      <KakuList result={result} palace={n} />
    </div>
  );
}
// ==== 変更禁止部分ここまで ====

function UnavailableNote({ result }: { result: QimenResult }) {
  const errs = [
    result.tianPanError && `天盤: ${result.tianPanError}`,
    result.jiuXingError && `九星: ${result.jiuXingError}`,
    result.baMenError && `八門: ${result.baMenError}`,
    result.baShenError && `八神: ${result.baShenError}`,
  ].filter(Boolean) as string[];
  if (errs.length === 0) return null;
  return (
    <div style={S.warn}>
      一部の段が未算出です:
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {errs.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.panel} className="qm-panel">
      <div style={S.panelTitle} className="qm-panel-title">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={S.row} className="qm-row">
      <span style={S.rowK} className="qm-row-k">{k}</span>
      <span style={S.rowV} className="qm-row-v">{v}</span>
    </div>
  );
}

// 宮の方位（洛書九宮）
const DIRECTION: Record<number, string> = {
  1: "北", 2: "南西", 3: "東", 4: "南東", 5: "中央",
  6: "北西", 7: "西", 8: "北東", 9: "南",
};

// 宮詳細パネル本体。選択宮の情報のみを表示する。
//   吉格/凶格は「その宮で成立しているもの」だけを抽出（palaces に当該宮を含むもの）。
//   palaces=[] の全盤成立格は宮詳細には出さない（右側の一覧には従来どおり表示）。
//   中宮(5)は地盤干のみ基本表示。存在しない段は「—」。
// 選択宮の基本詳細（宮名〜凶格）。剋應は含めない。
//   中宮(5)は地盤干のみ基本表示。存在しない段は「—」。
function PalaceDetailRows({ result, palace }: { result: QimenResult; palace: number }) {
  const p = result.palaces[palace] ?? { jiuXing: [], baMen: [], baShen: [] };
  const isCenter = palace === 5;

  const jikaku = result.jikaku.matches
    .filter((m) => m.palaces.includes(palace))
    .map((m) => m.name);
  const kyokaku = result.kyokaku.matches
    .filter((m) => m.palaces.includes(palace))
    .map((m) => m.name);

  return (
    <div>
      <Row k="宮名" v={PALACE_LABEL[palace] ?? "—"} />
      <Row k="宮番号" v={String(palace)} />
      <Row k="方位" v={DIRECTION[palace] ?? "—"} />
      <Row k="八門" v={isCenter ? "—" : p.baMen.join("・") || "—"} />
      <Row k="九星" v={isCenter ? "—" : p.jiuXing.join("・") || "—"} />
      <Row k="八神" v={isCenter ? "—" : p.baShen.join("・") || "—"} />
      <Row k="天盤干" v={isCenter ? "—" : p.tianPanStem ?? "—"} />
      <Row k="地盤干" v={p.diPanStem ?? "—"} />
      <Row k="吉格" v={jikaku.join("・") || "—"} />
      <Row k="凶格" v={kyokaku.join("・") || "—"} />
    </div>
  );
}

// 選択宮の剋應5系統（資料本文をそのまま表示）。
//   hideEmpty=true のとき、該当なしの系統は行ごと省略する（印刷用）。
function PalaceKokuo({
  result,
  palace,
  hideEmpty = false,
}: {
  result: QimenResult;
  palace: number;
  hideEmpty?: boolean;
}) {
  // 剋應（docs/source/kokuoo のみが根拠）。中宮(5)は全て空で返る。
  const kokuo = resolveKokuoForPalace(result, palace);
  return (
    <div>
      <KokuoSection label="十干剋應" entries={kokuo.jikkan} hideEmpty={hideEmpty} />
      <KokuoSection label="八門剋應（門×門）" entries={kokuo.hachimonGate} hideEmpty={hideEmpty} />
      <KokuoSection label="八門剋應（門×三奇）" entries={kokuo.hachimonWonder} hideEmpty={hideEmpty} />
      <KokuoSection label="三奇到宮剋應" entries={kokuo.sankiTokyu} hideEmpty={hideEmpty} />
      <KokuoSection label="九星値時剋應" entries={kokuo.kyuseiJichi} hideEmpty={hideEmpty} />
    </div>
  );
}

// 画面用: 基本詳細 ＋ 剋應（該当なしは「—」表示）＋ 将来拡張枠。
function PalaceDetail({ result, palace }: { result: QimenResult; palace: number }) {
  return (
    <div>
      <PalaceDetailRows result={result} palace={palace} />

      {/* 剋應（資料本文をそのまま表示。該当が無ければ「—」） */}
      <div style={S.detailSubTitle} className="qm-subtitle">剋應</div>
      <PalaceKokuo result={result} palace={palace} />

      {/* 将来拡張枠（今回はロジック・仮データを作らない。印刷では非表示） */}
      <div className="qm-pd-future">
        <div style={S.detailSubTitle} className="qm-subtitle">象意・用神・判断（将来拡張）</div>
        <Row k="象意" v="未実装" />
        <Row k="用神" v="未実装" />
        <Row k="判断" v="未実装" />
      </div>
    </div>
  );
}

const KOKUO_TRADITION_LABEL: Record<string, string> = {
  kimon_tonkou_hiketsu_taizen: "奇門遁甲秘笈大全",
  tonkou_engi: "遁甲演義",
};

// 剋應1系統の表示。資料本文(body)をそのまま出す。
//   entries が空のとき: hideEmpty=false なら「—」、true なら何も描画しない。
function KokuoSection({
  label,
  entries,
  hideEmpty = false,
}: {
  label: string;
  entries: KokuoEntry[];
  hideEmpty?: boolean;
}) {
  if (entries.length === 0 && hideEmpty) return null;
  return (
    <div style={S.kokuoSection} className="qm-kokuo-section">
      <div style={S.kokuoLabel} className="qm-kokuo-label">{label}</div>
      {entries.length === 0 ? (
        <div style={S.kokuoEmpty} className="qm-kokuo-empty">—</div>
      ) : (
        entries.map((e) => {
          const meta = [
            e.name,
            e.fortuneRaw,
            e.mode === "static" ? "静應" : e.mode === "dynamic" ? "動應" : null,
            e.sourceTradition ? KOKUO_TRADITION_LABEL[e.sourceTradition] ?? e.sourceTradition : null,
          ].filter(Boolean).join(" / ");
          return (
            <div key={e.id} style={S.kokuoEntry} className="qm-kokuo-entry">
              {meta && <div style={S.kokuoMeta} className="qm-kokuo-meta">{meta}</div>}
              {/* 表示時のみルビ（ふりがな行）を除去。元データ・改行は変更しない。 */}
              <div style={S.kokuoBody} className="qm-kokuo-body">{stripRuby(e.body)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---- スタイル（シンプル） --------------------------------------------
const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "system-ui, 'Hiragino Sans', sans-serif", padding: 24, color: "#222", maxWidth: 1100 },
  h1: { fontSize: 20, margin: "0 0 16px" },
  inputs: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 },
  field: { display: "flex", flexDirection: "column", fontSize: 12, color: "#555", gap: 4 },
  input: { fontSize: 14, padding: "4px 6px", border: "1px solid #bbb", borderRadius: 4 },
  btn: { fontSize: 13, padding: "5px 12px", border: "1px solid #999", borderRadius: 4, background: "#f5f5f5", cursor: "pointer" },
  error: { background: "#fdecec", border: "1px solid #e0b4b4", color: "#a33", padding: "8px 12px", borderRadius: 4, marginBottom: 16 },
  layout: { display: "flex", gap: 24, alignItems: "flex-start" },

  timeInfo: { display: "flex", gap: 24, fontSize: 13, color: "#333", padding: "8px 0 12px" },
  shiftNote: { color: "#888", marginLeft: 4 },

  geoBox: { border: "1px solid #ddd", borderRadius: 6, padding: 12, marginBottom: 16, maxWidth: 720 },
  searchRow: { display: "flex", gap: 8, marginBottom: 8 },
  searchMsg: { fontSize: 12, color: "#a60", marginBottom: 6 },
  hitList: { listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 2 },
  hitBtn: { textAlign: "left", width: "100%", fontSize: 12, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 4, background: "#fafafa", cursor: "pointer" },
  mapAndCoords: { display: "flex", gap: 16, alignItems: "flex-start" },
  coords: { display: "flex", flexDirection: "column", gap: 10 },
  coordNote: { fontSize: 11, color: "#888", lineHeight: 1.5 },

  gridWrap: { flex: "0 0 auto" },
  // 画面: 各宮は 156px 正方形が基準。格局名が多い宮だけ行が縦に伸びる（minmax）。
  // 印刷は print.css が固定 41mm 角に上書きする。
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 156px)", gridTemplateRows: "repeat(3, minmax(156px, max-content))", border: "2px solid #333" },
  cell: { border: "1px solid #333", padding: "6px 10px", display: "flex", flexDirection: "column", justifyContent: "flex-start", position: "relative", color: "#222" },
  // 選択中の宮: レイアウトを崩さないモノクロ表現（内側2px枠＋淡いグレー）
  cellSelected: { background: "#ededed", boxShadow: "inset 0 0 0 2px #000" },
  cellLabel: { fontSize: 12, color: "#222" },
  men: { textAlign: "center", fontSize: 17, fontWeight: 700, color: "#222", margin: "10px 0 12px" },
  dataRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 15, marginTop: 4 },
  stem: { fontWeight: 700, fontSize: 17, color: "#222" },
  starShen: { fontSize: 14, color: "#222" },
  centerBody: { display: "flex", alignItems: "center", justifyContent: "center", flex: 1 },

  // 宮内の格局名（既存6要素より小さめ。下部の空き部分へ）
  kaku: { marginTop: "auto", paddingTop: 3, display: "flex", flexDirection: "column", gap: 0, lineHeight: 1.12, alignItems: "flex-start" },
  kakuJi: { fontSize: 10, color: "#1f5fbf" },   // 吉格 = 青
  kakuKyo: { fontSize: 10, color: "#b42318" },  // 凶格 = 赤
  kakuMore: { fontSize: 10, color: "#666" },

  warn: { marginTop: 8, fontSize: 12, color: "#a60", background: "#fff8e6", border: "1px solid #e5d29a", borderRadius: 4, padding: "6px 10px", maxWidth: 470 },

  side: { flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 14, minWidth: 320 },
  panel: { border: "1px solid #ddd", borderRadius: 6 },
  panelTitle: { background: "#f0f0f0", padding: "6px 10px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #ddd" },
  row: { display: "flex", gap: 10, padding: "5px 10px", fontSize: 13, borderBottom: "1px solid #f0f0f0" },
  rowK: { flex: "0 0 96px", color: "#888" },
  rowV: { flex: 1 },

  detailSubTitle: { fontSize: 11, color: "#999", padding: "8px 10px 2px", borderTop: "1px solid #eee" },

  kokuoSection: { padding: "6px 10px", borderBottom: "1px solid #f0f0f0" },
  kokuoLabel: { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  kokuoEmpty: { fontSize: 13, color: "#888" },
  kokuoEntry: { marginBottom: 8 },
  kokuoMeta: { fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 2 },
  kokuoBody: { fontSize: 12, color: "#444", whiteSpace: "pre-wrap", lineHeight: 1.6 },
};
