// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { yearStemBranch, dayStemBranch, monthBranch } from "@/lib/eto";
import {
  sevenPlanetsLonDeg,
  lunarNodesMeanLonDeg,
  lunarPerigeeLonDeg,
  ziQiLonDeg,
  ascendantLonDeg,
  ascendantLonDeg_MORIA,
} from "@/lib/astro";
import {
  monthGeneralFromSunLon,
  hourBranchFromLocalDate,
  calcMingPalace,
  calcShenPalace_v2,
} from "@/lib/ming_shen";
import { buildBigLimits } from "@/lib/big_limit";
import { lonToMansionDeg } from "@/lib/mansions28";
import { calcJuniun } from "@/lib/juniun";
import { normalizeStarName } from "@/lib/ouboin";
import {
  getNenganPalaceShensha,
  getNenshiPalaceShensha,
  mergePalaceShensha
} from "@/lib/shensha_engine";
import { buildKakkyokuContext, evalKakkyoku } from "@/lib/kakkyoku_engine";
import SunCalc from "suncalc";
import { branchFromLon } from "@/lib/branch_from_lon";
import {
  invertHenyouForStem,
  HENYOU_MARK_TO_LABEL
} from "@/lib/henyou";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as BigLimit from "@/lib/big_limit";

function exportPDF() {
  window.print();
}

const ChartSVG = dynamic(() => import("@/components/ChartSVG"), { ssr: false });

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

function parseYMD(s: string): { y: number; m: string; d: string } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: m[2], d: m[3] };
}

export default function Home() {

  const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

  // 名前
  const [name, setName] = useState("");
  
    // ▼ 追加：男女
  const [sex, setSex] = useState<"男" | "女">("男");
  const [mingMode, setMingMode] = useState<"getsu" | "handen">("getsu");

  // 日付・時刻（ピッカー）
  const [date, setDate] = useState("1990-01-01");
  const [time, setTime] = useState("12:00");
  
  // 手動優先（初期だけ自動で入れる）
  const [isDayBirth, setIsDayBirth] = useState<boolean>(true);
  const [isDayBirthManual, setIsDayBirthManual] = useState<boolean>(false);


  // 年（手入力：途中入力で落ちないよう string）
  const [yearStr, setYearStr] = useState("1990");

  // 地名入力
  const [place, setPlace] = useState("東京都");
  const [kakkyokuLimit, setKakkyokuLimit] = useState<8 | 20>(8);
  const [placeMsg, setPlaceMsg] = useState<string>("");

  // 緯度経度
  const [lon, setLon] = useState(139.6917);
  const [lat, setLat] = useState(35.6895);
  
  useEffect(() => {
  try {
    const s = localStorage.getItem("seishi_inputs");
    if (!s) return;
    const v = JSON.parse(s);
    if (typeof v.date === "string") setDate(v.date);
    if (typeof v.time === "string") setTime(v.time);
    if (typeof v.yearStr === "string") setYearStr(v.yearStr);
    if (typeof v.place === "string") setPlace(v.place);
    if (typeof v.lat === "number") setLat(v.lat);
    if (typeof v.lon === "number") setLon(v.lon);
  } catch {}
}, []);

  // --- 年手入力 → date の年へ反映（4桁になった時だけ） ---
  useEffect(() => {
    if (!/^\d{4}$/.test(yearStr)) return;
    const p = parseYMD(date);
    if (!p) return;
    const next = `${yearStr}-${p.m}-${p.d}`;
    if (next !== date) setDate(next);
  }, [yearStr, date]);

  // --- date ピッカーで年が変わったら yearStr を追随 ---
  useEffect(() => {
    const p = parseYMD(date);
    if (!p) return;
    const y = String(clampInt(p.y, 1, 9999)).padStart(4, "0");
    if (y !== yearStr) setYearStr(y);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
  try {
    localStorage.setItem(
      "seishi_inputs",
      JSON.stringify({ date, time, yearStr, place, lat, lon })
    );
  } catch {}
}, [date, time, yearStr, place, lat, lon]);

  async function resolvePlace() {
    setPlaceMsg("検索中…");
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(place)}`, { cache: "no-store" });
      const j = await r.json();

      if (!r.ok) {
        setPlaceMsg(j && j.error ? `見つかりません: ${j.error}` : "見つかりません");
        return;
      }

      const newLat = Number(j.lat);
      const newLon = Number(j.lon);
      if (!Number.isFinite(newLat) || !Number.isFinite(newLon)) {
        setPlaceMsg("緯度経度の形式が不正です");
        return;
      }

      setLat(newLat);
      setLon(newLon);

      const disp = j.displayName ? String(j.displayName) : "OK";
      setPlaceMsg(`OK: ${disp}（lat ${newLat.toFixed(4)}, lon ${newLon.toFixed(4)}）`);
    } catch (e: any) {
      console.error("[place search error]", e);
setPlaceMsg("検索に失敗しました");
    }
  }

  // 入力日時（ローカル）
  const dObj = useMemo(() => new Date(date + "T" + time), [date, time]);

  // ===== 真太陽時（MORIA表記に合わせる：標準子午線135E + 均時差）=====
  function equationOfTimeMinutes(d: Date): number {
    const rad = Math.PI / 180;
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const diff = d.getTime() - start;
    const day = diff / 86400000;
    const B = rad * ((360 / 365) * (day - 81));
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }

  const trueSolarDate = useMemo(() => {
    const stdMeridian = 135; // JST
    const lonCorrMin = (lon - stdMeridian) * 4; // 1deg=4min
    const eqtMin = equationOfTimeMinutes(dObj);
    return new Date(dObj.getTime() + (lonCorrMin + eqtMin) * 60000);
  }, [dObj, lon]);

  // ===== ASC（比較用に両方出す）=====
  const ascLonPlus = useMemo(() => ascendantLonDeg_MORIA(trueSolarDate, lat, lon), [trueSolarDate, lat, lon]);
  const ascLonMinus = useMemo(() => ascendantLonDeg_MORIA(trueSolarDate, lat, -lon), [trueSolarDate, lat, lon]);

  // いま採用するASC（暫定：-lon 側）
  const ascLon = ascLonMinus;

  useEffect(() => {
    console.log("[ASC] local ISO =", dObj.toISOString());
    console.log("[ASC] true solar ISO =", trueSolarDate.toISOString());
    console.log("[ASC] lat/lon =", lat, lon);
    console.log("[ASC] ASC(+lon) =", ascLonPlus);
    console.log("[ASC] ASC(-lon) =", ascLonMinus);
  }, [dObj, trueSolarDate, lat, lon, ascLonPlus, ascLonMinus]);
  
  // 日干支の切替：子初(23:00)で日替わり
  // 日干支の切替：子初(23:00)で日替わり
  const dForDay = useMemo(() => {
    if (!dObj) return null as Date | null;
    const d = new Date(dObj.getTime());
    if (d.getHours() >= 23) d.setHours(d.getHours() + 1);
    return d;
  }, [dObj]);
  
  // 日の出・日の入り（昼夜判定用）
  // 日の出・日の入り（昼夜判定用）
  const sunTimes = useMemo(() => {
    if (!dObj) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return SunCalc.getTimes(dObj, lat, lon);
  }, [dObj, lat, lon]);

  const autoIsDayBirth = useMemo(() => {
    if (!sunTimes || !dObj) return true; // デフォルトは昼
    return dObj >= (sunTimes as any).sunrise && dObj < (sunTimes as any).sunset;
  }, [sunTimes, dObj]);

  // 初回＆自動更新（手動で触ったら以後固定）
  useEffect(() => {
    if (isDayBirthManual) return;
    setIsDayBirth(autoIsDayBirth);
  }, [autoIsDayBirth, isDayBirthManual]);


  const bodies = useMemo(() => {
    const b = sevenPlanetsLonDeg(dObj) as any[];

    const nodes = lunarNodesMeanLonDeg(dObj);
    b.push({ id: "rahu", label: "羅喉", lonDeg: nodes.rahu });
    b.push({ id: "ketu", label: "計都", lonDeg: nodes.ketu });

    // 月孛（近地点黄経 + 180°）
    const perigee = lunarPerigeeLonDeg(dObj);
    b.push({
      id: "yuebo",
      label: "月孛",
      lonDeg: ((perigee + 180) % 360 + 360) % 360,
    });

    // 紫炁
    b.push({ id: "ziqi", label: "紫炁", lonDeg: ziQiLonDeg(dObj) });

    return b;
  }, [dObj]);
  
  // 前日の星位置
const prevBodies = useMemo(() => {
  const d = new Date(dObj);
  d.setDate(d.getDate() - 1);
  return sevenPlanetsLonDeg(d) as any[];
}, [dObj]);

// 順逆判定
function getMotion(curr: number, prev: number) {
  let diff = curr - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  if (Math.abs(diff) < 0.01) return "*";
  if (diff > 0) return "+";
  return "-";
}

// motion付き
const bodiesWithMotion = useMemo(() => {
  return bodies.map((b, i) => {
    const prev = prevBodies[i];

    const currLon =
      typeof b?.lonDeg === "number" ? b.lonDeg :
      typeof b?.lon === "number" ? b.lon :
      0;

    const prevLon =
      typeof prev?.lonDeg === "number" ? prev.lonDeg :
      typeof prev?.lon === "number" ? prev.lon :
      currLon;

    return {
      ...b,
      motion: getMotion(currLon, prevLon),
    };
  });
}, [bodies, prevBodies]);
  
  useEffect(() => {
  console.table(
    (bodies as any[]).map((b) => ({
      id: b.id,
      label: b.label,
      lonDeg: b.lonDeg,
      type: typeof b.lonDeg,
      date,
      time,
      lat,
      lon,
      dObj: dObj.toISOString(),
    }))
  );
}, [bodies, date, time, lat, lon, dObj]);

  function pickLon(want: "sun" | "moon"): number {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i] as any;
      const id = b.id || "";
      const key = b.key || "";
      const label = b.label || "";
      if (want === "sun") {
        if (id === "sun" || key === "sun" || label === "太陽" || label === "日") return b.lonDeg;
      }
      if (want === "moon") {
        if (id === "moon" || key === "moon" || label === "太陰" || label === "月") return b.lonDeg;
      }
    }
    return 0;
  }

  const sunLon = pickLon("sun");
  const moonLon = pickLon("moon");

  const monthGeneral = monthGeneralFromSunLon(sunLon);
  const hourBr = hourBranchFromLocalDate(dObj);
  const mingBranchGetsu = useMemo(() => calcMingPalace(monthGeneral, hourBr), [monthGeneral, hourBr]);
const mingBranchHanden = useMemo(() => branchFromLon(ascLonMinus) as any, [ascLonMinus]);

const mingBranch = useMemo(
  () => (mingMode === "handen" ? mingBranchHanden : mingBranchGetsu),
  [mingMode, mingBranchHanden, mingBranchGetsu]
);  
  const y = yearStemBranch(dObj);
　const yearGanzhi = y.stem + y.branch;

console.log("yearGanzhi =", yearGanzhi);



　const juniunMap = useMemo(
  () => calcJuniun(yearGanzhi, mingBranch),
  [yearGanzhi, mingBranch]
);

  const moonPalace = monthGeneralFromSunLon(moonLon);
  const shenBranch = calcShenPalace_v2(moonPalace, hourBr);

  // 大限（既存）
  const mingDegree = BigLimit.calcMingDegreeFromSunLon(sunLon);

const bigLimits = BigLimit.buildBigLimits(mingBranch as any, mingDegree);

  const day = dayStemBranch(dForDay);
  const mBr = monthBranch(dObj);

  // ===== 命度（七政四餘・正規）=====

// 太陽の宮内度数（0–30）
function degInPalace(lon: number): number {
  return ((lon % 30) + 30) % 30;
}

// 命宮の開始黄経（寅=0, 卯=30, ...）
function branchStartLon(branch: string): number {
  const order = ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"];
  const i = order.indexOf(branch);
  return i >= 0 ? i * 30 : 0;
}

// 0..30 正規化
function norm30(x: number): number {
  x = x % 30;
  return x < 0 ? x + 30 : x;
}

// 旧命度の基準＝ASC（黄経）

// 命度の「度数」＝ASCを命宮の宮内度数へ落とす（ここが本体）
const mingDeg = useMemo(() => {
  const start = branchStartLon(mingBranch);
  return norm30(ascLon - start);
}, [ascLon, mingBranch]);

// （任意）命度を宿度でも出すなら：ASCそのものを宿へ変換
const ming28 = useMemo(() => lonToMansionDeg(ascLon), [ascLon]);

// 命度（十二宮表記）
const mingdoText = useMemo(() => {
  return `${mingBranch}${mingDeg.toFixed(2)}°`;
}, [mingBranch, mingDeg]);

// ===== 命度（宿度表記：いまの命度を二十八宿へ変換）=====
// 命度の本体は「命宮 + 宮内度数(mingDeg)」なので、黄経へ戻して宿に変換する

// 0°＝戌/亥境（＝亥宮の開始）を前提にする並び
const BRANCH_BY_30_FROM_0 = ["亥","子","丑","寅","卯","辰","巳","午","未","申","酉","戌"] as const;

function branchStartLon30(branch: string): number {
  const table: Record<string, number> = {
    "寅": 240,
    "卯": 270,
    "辰": 300,
    "巳": 330,
    "午": 0,
    "未": 30,
    "申": 60,
    "酉": 90,
    "戌": 120,
    "亥": 150,
    "子": 180,
    "丑": 210,
  };
  return table[branch] ?? 0;
}

function norm360(x: number) {
  x = x % 360;
  return x < 0 ? x + 360 : x;
}

// 「いまの命度」を黄経へ戻す（命宮の開始黄経 + 命宮内度数）
const mingLonForMansion = useMemo(() => {
  const start = branchStartLon30(mingBranch);
  return norm360(start + mingDeg);
}, [mingBranch, mingDeg]);

// その黄経を二十八宿へ
const ming28ForMingdo = useMemo(() => {
  return lonToMansionDeg(mingLonForMansion);
}, [mingLonForMansion]);

// 表示文字列（宿度）
const mingdoTextMansion = useMemo(() => {
  if (!ming28ForMingdo) return "—";
  return `${ming28ForMingdo.mansion.label}${ming28ForMingdo.degInMansion.toFixed(2)}°`;
}, [ming28ForMingdo]);

  const nameLine = name.trim() ? `姓名：${name.trim()}` : "";
  const kakkyokuResult = useMemo(() => {

  if (typeof window === "undefined") {
    return { good: [], bad: [] } as any;
  }

  try {
      
      const shenShaByPalace = mergePalaceShensha(
  getNenganPalaceShensha(y?.stem as any, mingBranch as any),
  getNenshiPalaceShensha(y?.branch as any, mingBranch as any)
);

const shenshaMerged = shenShaByPalace;
      
      
    const ctx = buildKakkyokuContext({
      sex,
      isDayBirth,
      yearStem: y?.stem as any,
      yearBranch: y?.branch as any,
      monthBranch: mBr as any,
      mingBranch: mingBranchHanden as any,
      shenBranch: shenBranch as any,
      mingDeg: mingDeg,
      bodies: bodies as any,
      shenShaByPalace: shenShaByPalace as any,
    } as any);

    console.log("CTX", ctx);

    return evalKakkyoku(ctx as any) as any;

  } catch (e: any) {

    console.error("[kakkyoku] catch:", e);

    return {
      good: ["（catch） エラー"],
      bad: ["（catch） エラー"],
    } as any;

  }

}, [sex, isDayBirth, y, mBr, mingBranch, shenBranch, mingDeg, bodies]);

const shenShaByPalace = mergePalaceShensha(
  getNenganPalaceShensha(y?.stem as any),
  getNenshiPalaceShensha(y?.branch as any)
);

 return (
  <main style={{ padding: 18 }}>
  
  <style jsx global>{`
  @media print {
    @page {
      size: A4 portrait;
      margin: 8mm;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body * {
      visibility: hidden !important;
    }

    #pdf-chart-wrap,
    #pdf-chart-wrap * {
      visibility: visible !important;
    }

    #pdf-chart-wrap {
      position: static !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      box-sizing: border-box !important;
    }

    #pdf-chart-wrap svg {
      display: block !important;
      width: 190mm !important;
      height: 190mm !important;
      margin: 0 auto !important;
    }

    .pdf-page-break {
      break-before: page;
      page-break-before: always;
      height: 0;
    }

    button,
    input,
    select,
    textarea {
      display: none !important;
    }
  }
`}</style>
  
    <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>

      {/* 名前入力 */}
      <div style={{ fontSize: 16, lineHeight: 1.4 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前（任意）"
          aria-label="名前"
        />
      </div>

      {/* 男女・昼夜 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <label style={{ minWidth: 64 }}>性別</label>
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value as "男" | "女")}
          style={{ fontSize: 16, padding: "6px 10px" }}
        >
          <option value="男">男</option>
          <option value="女">女</option>
        </select>

        <label>
          昼夜：
          <select
            value={isDayBirth ? "day" : "night"}
            onChange={(e) => {
  setIsDayBirthManual(true);
  setIsDayBirth(e.target.value === "day");
}}
          >
            <option value="day">昼生れ</option>
            <option value="night">夜生れ</option>
          </select>
        </label>
      </div>

      {/* 年 */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          value={yearStr}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
            setYearStr(v);
          }}
          inputMode="numeric"
          aria-label="西暦年"
          style={{ width: 110 }}
        />
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          （年を変えると日付の年だけ差し替え）
        </div>
      </div>

      {/* 日付・時刻 */}
      <div style={{ display: "flex", gap: 10 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>

      {/* 出生地 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="出生地（例：岐阜市 / 東京都 / Sapporo）"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={resolvePlace}>
          地名→緯度経度
        </button>
      </div>

      <div style={{ fontSize: 13 }}>
        {placeMsg ? placeMsg : `lat ${lat}, lon ${lon}`}
      </div>

      {/* 緯度経度 */}
      <div style={{ display: "flex", gap: 10 }}>
        <input value={String(lat)} onChange={(e) => setLat(Number(e.target.value))} />
        <input value={String(lon)} onChange={(e) => setLon(Number(e.target.value))} />
      </div>

      {/* 命宮方式（古法 / ASC） */}
      <div style={{ marginTop: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={mingMode === "handen"}
            onChange={(e) => setMingMode(e.target.checked ? "handen" : "getsu")}
          />
          命宮方式：{mingMode === "handen" ? "新法（ASC＝命度）" : "月将＋時支（古法）"}
        </label>
      </div>
    </div>
    
<button onClick={() => exportPDF(kakkyokuResult, y)} style={{
    marginTop: 10,
    padding: "6px 14px",
    fontSize: 14,
    cursor: "pointer"
  }}
>
  PDF出力
</button>   

<div id="pdf-only" style={{display:"none"}}>
  <div style={{width:"210mm",padding:"10mm",background:"#fff"}}>

    <div style={{textAlign:"center",marginBottom:"10mm"}}>
      <ChartSVG
        yearStem={y.stem as any}
        yearBranch={y.branch as any}
        bodies={bodiesWithMotion as any}
        mingBranch={mingBranch as any}
        shenBranch={shenBranch as any}
        bigLimits={bigLimits}
        juniunMap={juniunMap}
        centerTitle="七政四餘"
        monthBranch={mBr as any}
        centerLines={[
          ...(nameLine ? [nameLine] : []),
          `日：${day.stem}${day.branch}`,
          `月支：${mBr}`,
          `命宮：${mingBranch}　身宮：${shenBranch}`,
        ]}
      />
    </div>

  </div>
</div> 

   {/* 星盤 */}
<div id="pdf-chart-wrap"
  style={{
    width: "1120px",
    background: "#fff",
    padding: "24px 28px",
    boxSizing: "border-box",
  }}
>
  <ChartSVG
    yearStem={y.stem as any}
    yearBranch={y.branch as any}
    bodies={bodiesWithMotion as any}
    mingBranch={mingBranch as any}
    shenBranch={shenBranch as any}
    bigLimits={bigLimits as any}
    juniunMap={juniunMap}
    centerTitle="七政四餘"
    monthBranch={mBr as any}
    centerLines={[
      ...(nameLine ? [nameLine] : []),
      `日：${day.stem}${day.branch}`,
      `月支：${mBr}`,
      `命宮：${mingBranch}　身宮：${shenBranch}`,
      `古法:${mingBranchGetsu} / 　ASC:${mingBranchHanden}`,
      `命度：${mingdoText}`,
      `命度（宿度）：${mingdoTextMansion}`,
    ]}
  />
  
    <div className="pdf-page-break"></div>
  
{mounted && (
  <>
    
    {/* 格局 */}
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px #ccc",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>格局</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 12,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* 吉 */}
        <div
          style={{
            minWidth: 0,
            borderRadius: 8,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "inset 0 0 0 1px #ddd",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              padding: "8px 10px",
              borderBottom: "1px solid #eee",
              position: "sticky",
              top: 0,
              background: "#fff",
              zIndex: 1,
            }}
          >
            吉
          </div>

          <div style={{ marginBottom: 8, padding: "8px 10px 0" }}>
            <button onClick={() => setKakkyokuLimit(8)} disabled={kakkyokuLimit === 8}>
              上位8
            </button>
            <button
              onClick={() => setKakkyokuLimit(20)}
              disabled={kakkyokuLimit === 20}
              style={{ marginLeft: 8 }}
            >
              上位20
            </button>
          </div>

          <ul
            style={{
              paddingLeft: 18,
              margin: 0,
              paddingTop: 8,
              paddingBottom: 10,
              paddingRight: 10,
              maxHeight: 220,
              overflowY: "auto",
              overflowWrap: "anywhere",
            }}
          >
            {Array.from(new Set((kakkyokuResult?.good ?? []).filter(Boolean)))
              .slice(0, kakkyokuLimit)
              .map((name, i) => (
                <li key={`kg-${name}-${i}`}>{name}</li>
              ))}
          </ul>
        </div>

        {/* 凶 */}
        <div
          style={{
            minWidth: 0,
            borderRadius: 8,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "inset 0 0 0 1px #ddd",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              padding: "8px 10px",
              borderBottom: "1px solid #eee",
              position: "sticky",
              top: 0,
              background: "#fff",
              zIndex: 1,
            }}
          >
            凶
          </div>

          <ul
            style={{
              paddingLeft: 18,
              margin: 0,
              paddingTop: 8,
              paddingBottom: 10,
              paddingRight: 10,
              maxHeight: 220,
              overflowY: "auto",
              overflowWrap: "anywhere",
            }}
          >
            {Array.from(new Set((kakkyokuResult?.bad ?? []).filter(Boolean)))
              .slice(0, 8)
              .map((name, i) => (
                <li key={`kb-${name}-${i}`}>{name}</li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  </>
)} 
</div>
</main>
);
}
