// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { calculate } from "@/lib/calendar";
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
  calcMingPalace,
  calcShenPalace_v2,
} from "@/lib/ming_shen";
import { buildBigLimits } from "@/lib/big_limit";
import { mingDegreeForMode } from "@/lib/ming_degree";
import { mingMansionOf, mingMansionText } from "@/lib/ming_mansion";
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
import AppSwitcher from "@/components/AppSwitcher";
import NatalProfileForm from "@/components/NatalProfileForm";
import { useNatalProfile } from "@/lib/natalProfile/store";
import { profileToQizhengInput } from "./qizhengProfileAdapter";
import { getCurrentSmallLimitBranch } from "@/lib/small_limit";
import { loadNormalLimitRules, matchLr0550, type LimitRuleRecord } from "@/lib/limit_rules";
import { PALACE_MAIN_STAR } from "@/lib/kakkyoku_engine";
import { PrintRoot, usePrintMode, type PrintHeaderInfo } from "@/components/print/PrintRoot";
import QizhengChartPrint, { type QizhengChartProps } from "@/components/qizheng/QizhengChartPrint";
import QizhengInterpretationPrint from "@/components/qizheng/QizhengInterpretationPrint";
import "@/components/print/print.css";

const ChartSVG = dynamic(() => import("@/components/ChartSVG"), { ssr: false });

export default function Home() {

  const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

  // 姓名・性別・生年月日・出生時刻・出生地・緯度経度は3術共通のプロフィール（共通入力UIで編集）
  const { profile, hydrated, revision } = useNatalProfile();
  const { name, sex, date, time, lat, lon, unavailable } = profileToQizhengInput(profile);
  // 印刷（盤＝A4縦1枚／解釈＝文章のみ）。印刷専用レイアウトは画面の下の PrintRoot
  const printAs = usePrintMode();

  // ▼ 七政四餘固有の設定
  // 命宮方式：「古典」チェックなし＝通常（handen：ASC 基準の命宮・命度）／チェックあり＝古典（getsu：月将＋時支の命宮・calcMingDegreeFromSunLon の命度）
  const [mingMode, setMingMode] = useState<"getsu" | "handen">("handen");

  // 手動優先（初期だけ自動で入れる）
  const [isDayBirth, setIsDayBirth] = useState<boolean>(true);
  const [isDayBirthManual, setIsDayBirthManual] = useState<boolean>(false);
  // 別の人物（顧客）を読み込んだら昼夜は自動判定に戻す
  const [manualRevision, setManualRevision] = useState(revision);
  if (manualRevision !== revision) {
    setManualRevision(revision);
    setIsDayBirthManual(false);
  }


  const [kakkyokuLimit, setKakkyokuLimit] = useState<8 | 20>(8);

  // 行限（検証用）：対象年齢（整数）。西暦年からの自動計算はしない
  const [targetAgeStr, setTargetAgeStr] = useState("");
  const targetAge = /^\d+$/.test(targetAgeStr) ? Number(targetAgeStr) : null;

  // 入力日時（ローカル）
  const dObj = useMemo(() => new Date(date + "T" + time), [date, time]);

  // 干支を CalendarEngine に一元化。
  // 入力は現在 eto.ts に渡しているのと同じ dObj のローカル値をそのまま渡す。
  // （timezone・入力値は変更しない）
  const cal = useMemo(
    () =>
      calculate({
        year: dObj.getFullYear(),
        month: dObj.getMonth() + 1,
        day: dObj.getDate(),
        hour: dObj.getHours(),
        minute: dObj.getMinutes(),
      }),
    [dObj]
  );

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
  }, [dObj, trueSolarDate, lat, lon, ascLonPlus, ascLonMinus]);
  
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
  // 時支は共通暦エンジン CalendarEngine の出力を使用（hourBranchFromLocalDate は廃止）
  const hourBr = cal.hourBranch;
  const mingBranchGetsu = useMemo(() => calcMingPalace(monthGeneral, hourBr), [monthGeneral, hourBr]);
const mingBranchHanden = useMemo(() => branchFromLon(ascLonMinus) as any, [ascLonMinus]);

const mingBranch = useMemo(
  () => (mingMode === "handen" ? mingBranchHanden : mingBranchGetsu),
  [mingMode, mingBranchHanden, mingBranchGetsu]
);  
  const y = { stem: cal.yearStem, branch: cal.yearBranch };
　const yearGanzhi = y.stem + y.branch;




　const juniunMap = useMemo(
  () => calcJuniun(yearGanzhi),
  [yearGanzhi]
);

  const moonPalace = monthGeneralFromSunLon(moonLon);
  const shenBranch = calcShenPalace_v2(moonPalace, hourBr);

  // 命度（アプリ全体で共通の1つの値）：通常（ASC＝命度）なら ASC 基準、古典（月将＋時支）なら calcMingDegreeFromSunLon。
  // 表示・命度宿・大限・限度・流年・年齢選択・印刷はすべてこの mingDegree を使う（lib/ming_degree.ts）
  const mingDegree = mingDegreeForMode(mingMode, { ascLon, sunLon, mingBranch });

  // 大限（既存の計算に共通の命度を渡す）

const bigLimits = BigLimit.buildBigLimits(mingBranch as any, mingDegree);

// 対象年齢の大限宮・小限宮（既存の大限・小限の規則をそのまま使用）と、その宮主（既存の宮主表）
const curBigLimit = targetAge != null ? BigLimit.getCurrentBigLimit(mingBranch as any, mingDegree, targetAge) : null;
const curSmallBranch = targetAge != null ? getCurrentSmallLimitBranch(mingBranch, targetAge) : null;
const starNameOf = (mark?: string) => (mark ? (HENYOU_MARK_TO_LABEL as any)[mark] ?? mark : "—");

// 行限ルール（検証表示）：通常（normal）のみ読み込み、death_timing は扱わない
const [limitRules, setLimitRules] = useState<Map<string, LimitRuleRecord> | null>(null);
useEffect(() => {
  if (targetAge == null || limitRules) return;
  let alive = true;
  loadNormalLimitRules().then((m) => { if (alive) setLimitRules(m); }).catch(() => {});
  return () => { alive = false; };
}, [targetAge, limitRules]);
// 出生時の各星の所在支（既存の branchFromLon）
const bodiesAtBranch = (bodies as any[]).map((b) => ({ id: String(b.id), label: String(b.label), branch: branchFromLon(Number(b.lonDeg)) }));
const lr0550Big = curBigLimit ? matchLr0550(curBigLimit.branch, isDayBirth, bodiesAtBranch) : [];
const lr0550Small = curSmallBranch ? matchLr0550(curSmallBranch, isDayBirth, bodiesAtBranch) : [];
const lr0550 = limitRules?.get("lr_0550") ?? null;

  const day = { stem: cal.dayStem, branch: cal.dayBranch };
  const mBr = cal.monthBranch;

  // ===== 命度（七政四餘・正規）=====

// 太陽の宮内度数（0–30）
function degInPalace(lon: number): number {
  return ((lon % 30) + 30) % 30;
}

// 命度の値は上の mingDegree（命宮方式に応じた共通の命度）を使う

// （任意）命度を宿度でも出すなら：ASCそのものを宿へ変換
const ming28 = useMemo(() => lonToMansionDeg(ascLon), [ascLon]);

// 命度（十二宮表記）
const mingdoText = useMemo(() => {
  return `${mingBranch}${mingDegree.toFixed(2)}°`;
}, [mingBranch, mingDegree]);

// ===== 命度（宿度表記）=====
// 命宮の黄経範囲（branchFromLon と同じ割り付け）＋命度 → 既存 lonToMansionDeg（lib/ming_mansion.ts）。
// 行限ルールの命度宿も同じ関数の値を使う
const mingMansion = useMemo(() => mingMansionOf(mingBranch, mingDegree), [mingBranch, mingDegree]);
const mingdoTextMansion = mingMansionText(mingMansion);

  const nameLine = name.trim() ? `姓名：${name.trim()}` : "";
  const kakkyokuResult = useMemo(() => {

  if (typeof window === "undefined") {
    return { good: [], bad: [] } as any;
  }

  try {
      
      const shenShaByPalace = mergePalaceShensha(
  getNenganPalaceShensha(y?.stem as any),
  getNenshiPalaceShensha(y?.branch as any)
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
      mingDeg: mingDegree, // buildKakkyokuContext は命度を使っていない（格局の結果は変わらない）
      bodies: bodies as any,
      shenShaByPalace: shenShaByPalace as any,
    } as any);


    return evalKakkyoku(ctx as any) as any;

  } catch (e: any) {

    console.error("[kakkyoku] catch:", e);

    return {
      good: ["（catch） エラー"],
      bad: ["（catch） エラー"],
    } as any;

  }

}, [sex, isDayBirth, y, mBr, mingBranch, shenBranch, mingDegree, bodies]);

const shenShaByPalace = mergePalaceShensha(
  getNenganPalaceShensha(y?.stem as any),
  getNenshiPalaceShensha(y?.branch as any)
);

// 行限判断（画面表示と解釈印刷で共用）
const limitJudgement = targetAge != null && lr0550 && (lr0550Big.length > 0 || lr0550Small.length > 0) ? (
          <div style={{ fontSize: 13, lineHeight: 1.6, width: "100%" }} data-testid="limit-judgement">
            <b>行限判断</b>
            {lr0550Big.length > 0 && (
              <div data-testid="limit-judgement-big">
                大限：向明（{lr0550Big.map((b) => b.label).join("・")}）　{lr0550.modern_japanese}
              </div>
            )}
            {lr0550Small.length > 0 && (
              <div data-testid="limit-judgement-small">
                小限：向明（{lr0550Small.map((b) => b.label).join("・")}）　{lr0550.modern_japanese}
              </div>
            )}
          </div>
) : null;

// ===== 印刷用（画面と同じ計算結果を渡すだけ）=====
// 行限判断（画面の limitJudgement と同じ文）
const limitLines =
  targetAge != null && lr0550
    ? [
        ...(lr0550Big.length > 0 ? [`大限：向明（${lr0550Big.map((b) => b.label).join("・")}）　${lr0550.modern_japanese}`] : []),
        ...(lr0550Small.length > 0 ? [`小限：向明（${lr0550Small.map((b) => b.label).join("・")}）　${lr0550.modern_japanese}`] : []),
      ]
    : [];
const printInfo: PrintHeaderInfo = {
  name: name.trim() || null,
  birthDate: date.replaceAll("-", "/"),
  birthTime: profile.birthTimeUnknown ? "不明" : time,
  sex,
  place: profile.birthPlace.trim(),
};
const printExtra: [string, string][] = [
  ["昼夜", isDayBirth ? "昼生れ" : "夜生れ"],
  ["命宮方式", mingMode === "handen" ? "通常（ASC＝命度）" : "古典（月将＋時支）"],
  ["命宮", mingBranch],
  ["身宮", shenBranch],
  ["命度", `${mingdoText}（${mingdoTextMansion}）`],
];
const printChart: QizhengChartProps = {
  sex,
  yearStem: y.stem as any,
  yearBranch: y.branch as any,
  bodies: bodiesWithMotion as any,
  mingBranch: mingBranch as any,
  shenBranch: shenBranch as any,
  bigLimits: bigLimits as any,
  juniunMap,
  centerTitle: "七政四餘",
  monthBranch: mBr as any,
  centerLines: [
    ...(nameLine ? [nameLine] : []),
    `日：${day.stem}${day.branch}`,
    `月支：${mBr}`,
    `命宮：${mingBranch}　身宮：${shenBranch}`,
    `古典:${mingBranchGetsu} / 　ASC:${mingBranchHanden}`,
    `命度：${mingdoText}`,
    `命度（宿度）：${mingdoTextMansion}`,
  ],
};
const printGood = Array.from(new Set(((kakkyokuResult?.good ?? []) as string[]).filter(Boolean))).slice(0, kakkyokuLimit).map(String);
const printBad = Array.from(new Set(((kakkyokuResult?.bad ?? []) as string[]).filter(Boolean))).slice(0, 8).map(String);

 return (
  <>
  <AppSwitcher />
  <main style={{ padding: 18 }}>

  
    {/* 1. 共通人物入力UI（3術共通） */}
    <NatalProfileForm />

    {/* 2. 七政四餘固有の設定 */}
    <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>

      {/* 七政四餘固有の設定: 昼夜 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
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

      {/* 行限（検証用）：対象年齢 → 現在の大限宮・小限宮 */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          対象年齢：
          <input
            value={targetAgeStr}
            onChange={(e) => setTargetAgeStr(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            inputMode="numeric"
            aria-label="対象年齢"
            style={{ width: 60 }}
          />
          歳
        </label>
        {targetAge != null && (
          <div style={{ fontSize: 13, lineHeight: 1.6 }} data-testid="limit-summary">
            対象年齢：{targetAge}歳　
            大限：{curBigLimit ? `${curBigLimit.palaceName}（${curBigLimit.branch}）` : "範囲外"}　
            大限宮主：{curBigLimit ? starNameOf(PALACE_MAIN_STAR[curBigLimit.branch]) : "—"}　
            小限：{curSmallBranch ? `${BigLimit.palaceNameOfBranch(mingBranch as any, curSmallBranch)}（${curSmallBranch}）` : "—"}　
            小限宮主：{curSmallBranch ? starNameOf(PALACE_MAIN_STAR[curSmallBranch]) : "—"}
          </div>
        )}
        {limitJudgement}
      </div>

      {/* 命宮方式（古典 / ASC） */}
      <div style={{ marginTop: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={mingMode === "getsu"}
            onChange={(e) => setMingMode(e.target.checked ? "getsu" : "handen")}
          />
          古典（月将＋時支の命宮・太陽基準の命度）
          <span style={{ fontSize: 12, color: "#666" }}>　現在：{mingMode === "handen" ? "通常（ASC＝命度）" : "古典（月将＋時支）"}</span>
        </label>
      </div>
    </div>
    
{hydrated && !unavailable && (
  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
    <button onClick={() => printAs("chart")} style={{ padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>
      盤を印刷
    </button>
    <button onClick={() => printAs("interpretation")} style={{ padding: "6px 14px", fontSize: 14, cursor: "pointer" }}>
      解釈を印刷
    </button>
  </div>
)}

{/* 3. 星盤・格局（出生時刻・緯度経度がそろっているときだけ） */}
{hydrated && unavailable && (
  <div style={{ marginTop: 12, padding: "6px 10px", border: "1px solid #e0b4b4", background: "#fdecec", color: "#a33", borderRadius: 4, fontSize: 13, maxWidth: 760 }}>
    {unavailable}
  </div>
)}
{hydrated && !unavailable && (
<>

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
    sex={sex}
    yearStem={y.stem as any}
    yearBranch={y.branch as any}
    bodies={bodiesWithMotion as any}
    mingBranch={mingBranch as any}
    shenBranch={shenBranch as any}
    bigLimits={bigLimits as any}
    juniunMap={juniunMap}
    centerTitle="七政四餘"
    monthBranch={mBr as any}
    palaceDetail
    mingDegree={mingDegree}
    targetAge={targetAge}
    birthYear={dObj.getFullYear()}
    onTargetAgeChange={(a) => setTargetAgeStr(String(a))}
    isDayBirth={isDayBirth}
    kakkyoku={kakkyokuResult}
    centerLines={[
      ...(nameLine ? [nameLine] : []),
      `日：${day.stem}${day.branch}`,
      `月支：${mBr}`,
      `命宮：${mingBranch}　身宮：${shenBranch}`,
      `古典:${mingBranchGetsu} / 　ASC:${mingBranchHanden}`,
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
                <li key={`kg-${String(name)}-${i}`}>{String(name)}</li>
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
                <li key={`kb-${String(name)}-${i}`}>{String(name)}</li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  </>
)}
</div>

{/* 印刷専用レイアウト（画面には出さない）：盤＝A4縦1枚／解釈＝星盤なし・文章のみ */}
{mounted && (
  <>
    {/* 盤印刷は A4縦・上14mm・左右18mm・下20mm（有効紙面 174mm×263mm。上はさらにシート側で 10mm の空白帯＝qizheng-print.css） */}
    <PrintRoot kind="chart" className="qz-print-portrait" page="size: A4 portrait; margin: 14mm 18mm 20mm 18mm;">
      <QizhengChartPrint info={printInfo} extra={printExtra} chart={printChart} good={printGood} bad={printBad} />
    </PrintRoot>
    {/* 解釈印刷は上下30mm・左右22mm（全ページ） */}
    <PrintRoot kind="interpretation" page="size: A4 portrait; margin: 30mm 22mm 30mm 22mm;">
      <QizhengInterpretationPrint
        info={printInfo}
        extra={printExtra}
        chart={{ ...printChart, mingDegree, targetAge, isDayBirth, kakkyoku: kakkyokuResult }}
        good={printGood}
        bad={printBad}
        limitLines={limitLines}
      />
    </PrintRoot>
  </>
)}
</>
)}

</main>
  </>
);
}
