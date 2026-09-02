// src/components/ChartSVG.tsx

import React, { useMemo } from "react";
import { NYUUEN_MAP, SYOUDEN_MAP, KIRAKU_MAP, type Palace as StarPalace } from "@/lib/nyuuen_syouden_kiraku";
import { SHITTEN_MAP } from "@/lib/shitten";
import { angleFromLon, angleFromLonCCW, polar } from "@/lib/geom";
import { parseOuboinCSV } from "@/lib/ouboin";
import type { BodyPoint } from "@/lib/types";
import {
  getNenganPalaceShensha,
  getNenshiPalaceShensha,
  mergePalaceShensha,
} from "@/lib/shensha_engine";
import type { PalaceMap } from "@/lib/shensha_engine";
import { MONTH_BRANCH_TO_PALACE } from "@/lib/shensha_tables";
import type { Stem, Branch as ShenshaBranch } from "@/lib/shensha_tables";
import type { BigLimitMap } from "@/lib/big_limit";
import {
  buildHenyouByPalace,
  getHenyou2ByYearBranch,
  getHenyou2ByStemAndMing,
  HENYOU_MARK_TO_LABEL,
} from "@/lib/henyou";
import {
  MANSIONS_28,
  mansionGroupDividerIndices,
  JIAO_START_LON_DEG,
  norm360,
} from "@/lib/mansions28";
import { lonToMansionDeg } from "@/lib/mansions28";
import { normalizeStarKey } from "@/lib/star_key";
import { JOREI_BY_MONTH_BRANCH, SHITSUGAI_MAP } from "@/lib/jorei_shitsugai";
import { KOKU_MAP } from "@/lib/koku_rei_eiki";

const PLOT_OFFSET_DEG = -120; // 度数リングと同じ値

const plotLon = (lonDeg: number) => norm360(lonDeg + PLOT_OFFSET_DEG);

const plotAngCCW = (lonDeg: number) => {
  // 0°（春分点）を上(12時)に置き、黄経が増えるほど反時計回り(CCW)に進む
  const lon = plotLon(lonDeg);
  return ((-90 - lon) * Math.PI) / 180;
};
const plotAngCW  = (lonDeg: number) => angleFromLon(plotLon(lonDeg));

const mansionAng = (lonDeg: number) => {
  // 二十八宿：角宿開始(JIAO_START_LON_DEG=203°)を絶対黄経として、そのまま反時計回り(CCW)に進行
  return plotAngCCW(lonDeg);
};

type Props = {
  yearStem?: Stem;
  yearBranch?: ShenshaBranch;
  monthBranch?: ShenshaBranch;
  bodies?: BodyPoint[];
  centerTitle?: string;
  centerLines?: string[];
  mingBranch: string;
  shenBranch: string; // 受け口だけ残す（現状は描画未使用）
  bigLimits?: BigLimitMap; // 各宮に D... を表示
　juniunMap?: Record<string, string> | null;
  age?: number; // 互換用（使わない）
  sex: "男" | "女"; 
};

// 七政用（資料に合わせた宮名）
const PALACE_NAMES = [
  "命宮",
  "相貌宮",
  "福徳宮",
  "官禄宮",
  "遷移宮",
  "疾厄宮",
  "夫妻宮",
  "奴僕宮",
  "男女宮",
  "田宅宮",
  "兄弟宮",
  "財帛宮",
] as const;

// B基準（0°=戌）十二支順
const BRANCHES_B = ["戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉"] as const;

// 子宮が真下になるように 180° 回転（子が午位置に出る問題の補正）
const PALACE_LON_OFFSET = 90;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function indexOfBranchB(br: string): number {
  for (let i = 0; i < BRANCHES_B.length; i++) {
    if (BRANCHES_B[i] === br) return i;
  }
  return 0;
}

function getMonthBranchPalaceShensha(monthBranch?: ShenshaBranch) {
  const out: Record<string, string[]> = {};
  if (!monthBranch) return out;

  for (const [name, table] of Object.entries(MONTH_BRANCH_TO_PALACE)) {
    const palace = table[monthBranch];
    if (!palace) continue;
    (out[palace] ||= []).push(name);
  }

  return out;
}

// 下半分だけ中心側へ押す（上半分はそのまま）
function pushToCenterIfLowerHalf(
  x: number,
  y: number,
  cx: number,
  cy: number,
  amount: number
) {
  if (y < cy) return { x, y }; // 上半分はそのまま

  const vx = cx - x;
  const vy = cy - y;
  const len = Math.hypot(vx, vy) || 1;

  return {
    x: x + (vx / len) * amount,
    y: y + (vy / len) * amount,
  };
}

// 黄経 → 十二宮（子丑寅…）へ変換
function palaceFromLon(lonDeg: number): string {
  const lon = ((lonDeg % 360) + 360) % 360;

  if (lon >= 240 && lon < 270) return "寅";
  if (lon >= 210 && lon < 240) return "卯";
  if (lon >= 180 && lon < 210) return "辰";
  if (lon >= 150 && lon < 180) return "巳";
  if (lon >= 120 && lon < 150) return "午";
  if (lon >= 90  && lon < 120) return "未";
  if (lon >= 60  && lon < 90 ) return "申";
  if (lon >= 30  && lon < 60 ) return "酉";
  if (lon >= 0   && lon < 30 ) return "戌";
  if (lon >= 330 && lon < 360) return "亥";
  if (lon >= 300 && lon < 330) return "子";
  if (lon >= 270 && lon < 300) return "丑";

  return "";
}

function ouboinKey(label: string): string {
  const s = String(label || "").trim();

  // 表記ゆれ対策
  if (s === "日" || s === "太陽") return "日";
  if (s === "月" || s === "太陰") return "月";
  if (s === "水" || s === "水星") return "水";
  if (s === "金" || s === "金星") return "金";
  if (s === "火" || s === "火星") return "火";
  if (s === "木" || s === "木星") return "木";
  if (s === "土" || s === "土星") return "土";

  return s;
}

export default function ChartSVG(props: Props) {
  const [ouboinMap, setOuboinMap] = React.useState<any>(null);

React.useEffect(() => {
  fetch("/data/ouboin.csv")
    .then(r => r.text())
    .then(csv => {
      const map = parseOuboinCSV(csv);
      setOuboinMap(map);
    });
}, []);
  const {
    yearStem,
    yearBranch,
    monthBranch,
    bodies = [],
    mingBranch,
    shenBranch,
    bigLimits,
    juniunMap,
    centerTitle,
    centerLines = [],

  } = props;

console.log("juniunMap in ChartSVG =", juniunMap);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _shen = shenBranch;

  const W = 980;
  const H = 980;
  const cx = W / 2;
  const cy = H / 2;
  
  const norm360 = (x: number) => ((x % 360) + 360) % 360;

  // --- Radii layout ---
  const rTickOuter = 455; // 度目盛り外側

  // 二十八宿リング
  const rMansionOuter = 410;
  const mansionWidth = 18;
  const rMansionInner = rMansionOuter - mansionWidth;

  // 十二宮リング（外側を二十八宿リングまで）
  const r12Outer = rMansionInner;
  const r12Inner = 245;

  const rCenter = 165;

  // 星：度目盛りの外にドット／さらに外に名称
  const rBodyDot = rTickOuter + 4;
  const rBodyLabel = rBodyDot + 18;

  // 十二支と宮名（ここは“基本半径”）
  const rBranchLabel = r12Outer - 10; // 十二支（外寄り）
  const rPalaceName = r12Inner - 20;  // 宮名（内寄り）

  // 神殺（宮内の中間あたり）
  const rShensha = r12Inner + (r12Outer - r12Inner) * 0.58;
  const shenshaPushToCenter = 28;

  // 二十八宿の区切り線
  const mansionDividers = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < (MANSIONS_28 as any).length; i++) {
      out.push((MANSIONS_28 as any)[i].startLonDeg);
    }
    return out;
  }, []);
  const mansionThickIdx = new Set(Array.isArray(mansionGroupDividerIndices) ? mansionGroupDividerIndices : []);

  const shenshaByPalace = useMemo(() => {
  const a: Partial<PalaceMap> = yearStem ? getNenganPalaceShensha(yearStem) : {};
  const b: Partial<PalaceMap> = yearBranch ? getNenshiPalaceShensha(yearBranch) : {};
  const c: Partial<PalaceMap> = monthBranch ? getMonthBranchPalaceShensha(monthBranch) : {};

  return mergePalaceShensha(
    mergePalaceShensha(a, b),
    c
  );
}, [yearStem, yearBranch, monthBranch]);
  
const shenshaMerged = useMemo(() => {
  return shenshaByPalace as any;
}, [shenshaByPalace]);

  const henyou2Items = useMemo(() => {
    const out: string[] = [];

    const pushYearBranch = (name: "爵星" | "産星" | "血支" | "血忌" | "馬元" | "天馬" | "地駅") => {
      const mark = getHenyou2ByYearBranch(name, yearBranch as any);
      if (!mark) return;
      const star = HENYOU_MARK_TO_LABEL[mark as keyof typeof HENYOU_MARK_TO_LABEL] ?? mark;
      out.push(`${name}(${star})`);
    };
    
      const henyou1Items: string[] = [];

    const pushStemMing = (name: "天経" | "地緯" | "天元" | "地元" | "人元" | "職元" | "局主") => {
      const mark = getHenyou2ByStemAndMing(name, yearStem as any, mingBranch as any);
      if (!mark) return;
      const star = HENYOU_MARK_TO_LABEL[mark as keyof typeof HENYOU_MARK_TO_LABEL] ?? mark;
      out.push(`${name}(${star})`);
    };

    pushYearBranch("爵星");
    pushYearBranch("産星");
    pushYearBranch("血支");
    pushYearBranch("血忌");
    pushYearBranch("馬元");
    pushYearBranch("天馬");
    pushYearBranch("地駅");

    pushStemMing("天経");
    pushStemMing("地緯");
    pushStemMing("天元");
    pushStemMing("地元");
    pushStemMing("人元");
    pushStemMing("職元");
    pushStemMing("局主");

    return out;
  }, [yearStem, yearBranch, mingBranch]);
  
  const henyou1Items = (() => {
  const byPalace = buildHenyouByPalace(
    yearStem as any,
    bodies as any,
    BRANCHES_B
  ) as Record<string, string[]>;

  const out: string[] = [];

  for (let i = 0; i < BRANCHES_B.length; i++) {
    const br = BRANCHES_B[i];
    const arr = byPalace?.[br] ?? [];
    for (let j = 0; j < arr.length; j++) {
      out.push(arr[j]);
    }
  }

  return out;
})();

  // 命宮に合わせて宮名を回転（命宮確定に追随）
  const palaceCenters = useMemo(() => {
    const mingIdx = indexOfBranchB(mingBranch);
    return BRANCHES_B.map((br, i) => {
      const palaceName = PALACE_NAMES[(i - mingIdx + 12) % 12];
      return { branch: br, palaceName, centerLon: norm360(i * 30 + 15 + PALACE_LON_OFFSET) };
    });
  }, [mingBranch]);
  
  function tickLen(deg: number) {
    const d = ((deg % 360) + 360) % 360;
    if (d % 30 === 0) return 18;
    if (d % 10 === 0) return 12;
    if (d % 5 === 0) return 8;
    return 4;
  }

  function renderShenshaForBranch(branch: string, centerLon: number) {
    const items = (shenshaMerged as any)[branch] as string[] | undefined;
  if (!items || items.length === 0) return null;

   // 神殺はそのまま表示する
const filtered = items;
if (filtered.length === 0) return null;

    const perLine = 3;
    const lines = chunk(filtered, perLine).slice(0, 10);

    const count = filtered.length;
    const fontSize = count > 24 ? 9 : count > 18 ? 10 : count > 12 ? 11 : 12;
    const lineH = fontSize + 2;

    const ang = angleFromLonCCW(centerLon);
    const p0 = polar(cx, cy, rShensha, ang);

    // 中心側へ少し押して安定
    const vx0 = cx - p0.x;
    const vy0 = cy - p0.y;
    const len0 = Math.hypot(vx0, vy0) || 1;
    
const sideBranches = ["辰", "卯", "酉", "戌"];
const isSide = sideBranches.includes(branch);

// 亥宮・寅宮だけ少し下へ逃がす
const lowerBranches = ["亥", "寅"];
const yOffset = lowerBranches.includes(branch) ? 12 : 0;

const push = shenshaPushToCenter + (isSide ? 22 : 0);

const x = p0.x + (vx0 / len0) * push + (isSide ? (p0.x < cx ? -2 : 2) : 0);
const y = p0.y + (vy0 / len0) * push + yOffset;

const textAnchor = isSide ? (p0.x < cx ? "end" : "start") : "middle";

    const yStart = y - ((lines.length - 1) * lineH) / 2;

    return (
      <text
        key={`sh-${branch}`}
        x={x}
        y={yStart}
        fontSize={fontSize}
        textAnchor={textAnchor}
        dominantBaseline="middle"
      >
        {lines.map((ln, i) => (
  <tspan key={i} x={x} dy={i === 0 ? 0 : lineH}>
    {ln.map((item, j) => {
      // 変曜星（最優先：凶神殺判定より先）
      // "天刑(金星)" のように括弧付きで星名が入る場合も変曜星として扱う。
      // 半角() と 全角（）の両方に対応。
      const isHenyou =
        item.startsWith("【変曜】") ||
        /[（(](?:太陽|月|水星|金星|火星|木星|土星|羅喉|計都|月孛|紫気)[）)]\s*$/.test(item);

      if (isHenyou) {
        return (
          <tspan
            key={j}
            fill="blue"
            fontWeight="bold"
          >
            {(item.startsWith("【変曜】") ? item.replace("【変曜】", "") : item) + " "}
          </tspan>
        );
      }


      // 通常神殺
      return <tspan key={j}>{item + " "}</tspan>;
    })}
  </tspan>
))}
      </text>
    );
  }

  // 左端で星名が切れる対策（viewBox を左に広げる）
  const padL = 60;
　const padR = 500;   // 右側の余白（表用）
  return (
    <svg width={W + padR} height={H} viewBox={`${-padL} 0 ${W + padL + padR} ${H}`}>
      {/* 度目盛り */}
      <g>
        <circle cx={cx} cy={cy} r={rTickOuter} fill="none" stroke="black" strokeWidth={1} />
        {Array.from({ length: 360 }).map((_, d) => {
          const ang = plotAngCCW(d);
          const p1 = polar(cx, cy, rTickOuter, ang);
          const p2 = polar(cx, cy, rTickOuter - tickLen(d), ang);
          const sw = d % 30 === 0 ? 2 : d % 10 === 0 ? 1.5 : 1;
          return (
            <line
              key={d}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="black"
              strokeWidth={sw}
            />
          );
        })}
      </g>
      
      {/* Degree numbers (every 10°) */}
      <g>
  {Array.from({ length: 36 }).map((_, i) => {
    const deg = i * 10; // 0,10,...,350（黄経そのまま）
    const ang = plotAngCCW(deg);
    const p = polar(cx, cy, rTickOuter - 25, ang);

    return (
      <text
        key={`deg-${deg}`}
        x={p.x}
        y={p.y}
        fontSize={10}
        fill="black"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {deg}°
      </text>
    );
  })}
</g>
  
  // ラベル衝突回避（角度が近いときだけ外側へ逃がす）
const placedLabelLons: number[] = []; // 描画順で記録
const MIN_GAP_DEG = 6;                // 近い判定（調整OK）
const STEP_R = 10;                    // 逃がす量（調整OK）
<g>
  {bodies.map((b) => {
    // 1) lonDeg を数値化 → 0..360 に正規化（ここが月孛対策の核心）
    const raw = (b as any).lonDeg;
    const lon = ((Number(raw) % 360) + 360) % 360;

    // NaN など壊れ値は描画しない（これで「彼方へ飛ぶ」を確実に防ぐ）
    if (!Number.isFinite(lon)) return null;

    const ang = plotAngCCW(lon);

    // 4) 左右でアンカーを変える（文字が円の外に向くように）
    const anchor = lon > 90 && lon < 270 ? "end" : "start";
    
    const palace = palaceFromLon(lon);
    
    function normalizeStarName(label: string): string {
  const map: Record<string,string> = {
    "日": "日",
    "太陽": "日",

    "月": "月",
    "太陰": "月",

    "水": "水",
    "水星": "水",

    "金": "金",
    "金星": "金",

    "火": "火",
    "火星": "火",

    "木": "木",
    "木星": "木",

    "土": "土",
    "土星": "土",

    "羅喉": "羅劫",
    "羅劫": "羅劫",

    "計都": "計都",
    "月孛": "月孛",
    "紫炁": "紫炁",
    "紫気": "紫炁",
  };

  return map[label] ?? label;
}

// ★dot / lab をこの場で必ず定義する
const dot = polar(cx, cy, rBodyDot, ang);
const lab = polar(cx, cy, rBodyLabel, ang);

    return (
      <g key={b.id}>
        <circle cx={dot.x} cy={dot.y} r={3} fill="black" />
        <text
          x={lab.x}
          y={lab.y}
          fontSize={12}
          textAnchor={anchor}
          dominantBaseline="middle"
        >
         {b.label}
        </text>
      </g>
    );
  })}
</g>

      {/* 二十八宿リング */}
      <g>
        <circle cx={cx} cy={cy} r={rMansionOuter} fill="none" stroke="black" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={rMansionInner} fill="none" stroke="black" strokeWidth={1} />

        {/* 区切り線（7分割は太線） */}
{mansionDividers.map((lon, i) => {
  // 宿名と同じ角度系に揃える（ここがズレの原因）
  
  const ang = mansionAng(lon);

  const p1 = polar(cx, cy, rMansionOuter, ang);
  const p2 = polar(cx, cy, rMansionInner, ang);

  const sw = mansionThickIdx.has(i) ? 2.5 : 1;

  return (
    <line
      key={`mdiv-${i}`}
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="black"
      strokeWidth={sw}
    />
  );
})}

        {/* 宿名 */}
        {(MANSIONS_28 as any).map((m: any, i: number) => {
          const next = (MANSIONS_28 as any)[(i + 1) % (MANSIONS_28 as any).length];
          const start = m.startLonDeg as number;
          const rawEnd = next.startLonDeg as number;
          const end = rawEnd > start ? rawEnd : rawEnd + 360;
          const mid = (start + end) / 2;
          const midNorm = ((mid % 360) + 360) % 360;
　　　　　　const ang = mansionAng(midNorm);
          const p = polar(cx, cy, (rMansionOuter + rMansionInner) / 2, ang);

          return (
            <text
              key={`m-${i}-${m.name}`}
              x={p.x}
              y={p.y}
              fontSize={11}
              fill="black"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {(m.name ?? m.label ?? "")}
            </text>
          );
        })}
      </g>

      {/* 十二宮リング */}
      <g>
        <circle cx={cx} cy={cy} r={r12Outer} fill="none" stroke="black" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={r12Inner} fill="none" stroke="black" strokeWidth={1} />

        {/* 宮の境界線 */}
{BRANCHES_B.map((_, i) => {
  const lon = i * 30;                 // ←これが無いのが原因
  const ang = plotAngCW(lon);  
  const p1 = polar(cx, cy, r12Outer, ang);
  const p2 = polar(cx, cy, r12Inner, ang);
  return (
    <line
      key={`pdiv-${i}`}
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="black"
      strokeWidth={1}
    />
  );
})}

{/* 十二運表示 */}
{juniunMap &&
  palaceCenters.map((p) => {
    const ang = angleFromLonCCW(p.centerLon);
    const pos = polar(cx, cy, r12Inner + 10, ang);

    const label = juniunMap[p.branch];
    if (!label) return null;

    return (
      <text
        key={`juniun-${p.branch}`}
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fontWeight="bold"
        fill="#1a237e"
      >
        {label}
      </text>
    );
  })}


        {/* 十二支 + 宮名 + 大限 + 小限（下半分だけ中心側へ押す） */}
        {palaceCenters.map((p) => {
          const ang = angleFromLonCCW(p.centerLon);

          const pb = polar(cx, cy, rBranchLabel, ang);

          let pn = polar(cx, cy, rPalaceName, ang);
          pn = pushToCenterIfLowerHalf(pn.x, pn.y, cx, cy, 22);

          // 大限
          const dTxt = bigLimits ? (bigLimits as any)[p.branch] : "";

          // 小限：命宮を S1 として、逆行で S2,S3...
         const mingIdx = indexOfBranchB(mingBranch);
const curIdx  = indexOfBranchB(p.branch);

// 反時計回りに命宮から何宮進んだか（0..11）
const k = (mingIdx - curIdx + 12) % 12;

// 3つ表示：その宮に入る年（12年周期で同じ宮に戻る）
const s1  = 1  + k;
const s13 = 13 + k;
const s25 = 25 + k;

const sTxt = `S${s1},S${s13},S${s25}`;

          return (
            <g key={`lab-${p.branch}`}>
              <text x={pb.x} y={pb.y} fontSize={18} textAnchor="middle" dominantBaseline="middle">
                {p.branch}
              </text>

              <text x={pn.x} y={pn.y} fontSize={13} textAnchor="middle" dominantBaseline="middle">
                {p.palaceName}
              </text>

              {dTxt ? (
                <text x={pn.x} y={pn.y + 16} fontSize={12} textAnchor="middle" dominantBaseline="middle">
                  {"D" + dTxt}
                </text>
              ) : null}

              <text x={pn.x} y={pn.y + 32} fontSize={11} textAnchor="middle" dominantBaseline="middle">
                {sTxt}
              </text>
            </g>
          );
        })}
      </g>

      {/* 神殺 */}
      <g>{palaceCenters.map((p) => renderShenshaForBranch(p.branch, p.centerLon))}</g>

      {/* 中央（重なり防止：内容量で自動レイアウト） */}
      <g>
        <circle cx={cx} cy={cy} r={rCenter} fill="none" stroke="black" strokeWidth={1} />

        {(() => {
          const titleFont = 16;
          const lineFont = 12;
          const lineGap = 16;

          const hasTitle = !!centerTitle;
          const lines = [...(centerLines ?? [])];
          if (yearStem && yearBranch) lines.push(`年：${yearStem}${yearBranch}`);

          const titleH = hasTitle ? 22 : 0;
          const bodyH = lines.length * lineGap;

          const totalH = titleH + bodyH;
          const yTop = cy - totalH / 2;

          const yTitle = yTop + (hasTitle ? 10 : 0);
          const yBody0 = yTop + titleH + 8;

          return (
            <>
              {hasTitle ? (
                <text x={cx} y={yTitle} fontSize={titleFont} textAnchor="middle" dominantBaseline="middle">
                  {centerTitle}
                </text>
              ) : null}

              {lines.map((ln, i) => (
                <text key={i} x={cx} y={yBody0 + i * lineGap} fontSize={lineFont} textAnchor="middle" dominantBaseline="middle">
                  {ln}
                </text>
              ))}
            </>
          );
        })()}
      </g>
      
      {/* ===== 星一覧（盤の外・左下）===== */}
{(() => {
  // 1) 表に出す星の並び（必要なら並び替えてOK）
  const ORDER = ["日","月","水","金","火","木","土","羅喉","計都","月孛","紫炁"] as const;

  // 2) 表の行データ作成
  const rows = (bodies as any[])
    .slice()
    .sort((a, b) => {
      const ai = ORDER.indexOf((a?.label ?? "").trim() as any);
      const bi = ORDER.indexOf((b?.label ?? "").trim() as any);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    
   .map((b) => {
  const label = String(b?.label ?? "").trim();
  const lon = ((Number(b?.lonDeg) % 360) + 360) % 360;
  const palace = palaceFromLon(lon);

  const status = (ouboinMap?.[ouboinKey(label)]?.[palace] ?? "") as string;

  const starKey = normalizeStarKey(label);

  const joureiStar = JOREI_BY_MONTH_BRANCH[
    String(props.monthBranch || "").trim() as keyof typeof JOREI_BY_MONTH_BRANCH
  ];
  const jourei = starKey && joureiStar && starKey === joureiStar ? "乗令" : "";

  const shitsugai = SHITSUGAI_MAP[starKey]?.includes(palace) ? "失垣" : "";

  const m = lonToMansionDeg(lon) as any;
  const mansionText = m ? `${m.mansion.label}${Number(m.degInMansion).toFixed(2)}°` : "";
  const mansion = m?.mansion?.label;

  const shitten =
    mansion && SHITTEN_MAP[starKey as keyof typeof SHITTEN_MAP]?.includes(mansion)
      ? "失躔"
      : "";

  const nyuuen = NYUUEN_MAP[starKey as keyof typeof NYUUEN_MAP]?.includes(palace as StarPalace) ? "入垣" : "";
  const syouden = SYOUDEN_MAP[starKey as keyof typeof SYOUDEN_MAP]?.includes(palace as StarPalace) ? "昇殿" : "";
  const kiraku = KIRAKU_MAP[starKey as keyof typeof KIRAKU_MAP]?.[palace as StarPalace] ?? "";
  const kokuList = KOKU_MAP[starKey as keyof typeof KOKU_MAP]?.[palace as StarPalace] ?? [];
　const kokuText = kokuList.join("");
  function placeLabelNoOverlap(
  cx: number,
  cy: number,
  baseR: number,
  ang: number,
  placed: { x: number; y: number }[],
  stepR = 10,
  maxTries = 10,
  minDist = 14
) {
  for (let t = 0; t <= maxTries; t++) {
    const r = baseR + t * stepR;
    const p = polar(cx, cy, r, ang);
    const hit = placed.some(q => {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      
      const dot = polar(cx, cy, r, ang);
const lab = polar(cx, cy, r + 14, ang);

      return dx * dx + dy * dy < minDist * minDist;
    });
    if (!hit) return { p, r };
  }
  const p = polar(cx, cy, baseR + maxTries * stepR, ang);
  return { p, r: baseR + maxTries * stepR };
}

  const extra = [jourei, shitsugai, shitten, nyuuen, syouden, kiraku,
  kokuText]
    .filter(Boolean)
    .join(" ");

  return {
    key: String(b?.id ?? label),
    label,
    motion: String(b?.motion ?? ""),
    palace,
    status,
    extra,
    lonText: Number.isFinite(lon) ? lon.toFixed(2) : "",
    mansionText,
  };
})

  // 3) 表のレイアウト（左下）
  const tableW = 260;

// 星盤（外円）の右外へ逃がす
const x0 = cx + r12Outer + 20;
const y0 = cy + r12Outer - 150;
  const lineH = 16;
  const colX = {
    name: 0,
    palace: 56,
    status: 92,
    lon: 170,
    mansion: 235,
    nyuuen: 160,
    syouden: 210,
    kiraku: 260,
  };

  return (
    <g>
      {/* 背景（任意） */}
      <rect
        x={x0 - 8}
        y={y0 - 18}
        width={360}
        height={Math.max(60, (rows.length + 1) * lineH + 22)}
        fill="white"
        opacity={0.85}
        stroke="black"
        strokeWidth={0.5}
      />

      {/* 見出し */}
      <text x={x0} y={y0} fontSize={12} fontWeight="bold">
      
        星名・  十二宮・ 旺廟入垣昇殿・ 黄経 ・・・宿度
      </text>

      {/* 行 */}
      {rows.map((r, i) => (
  <g key={`starrow-${r.key}-${i}`}>
    <text x={x0 + colX.name} y={y0 + (i + 1) * lineH} fontSize={12}>
      {r.label}{r.motion && `(${r.motion})`}
    </text>

    <text x={x0 + colX.palace} y={y0 + (i + 1) * lineH} fontSize={12}>
      {r.palace}
    </text>

    <text
      x={x0 + colX.status}
      y={y0 + (i + 1) * lineH}
      fontSize={12}
      fontWeight="bold"
    >
      {r.status}
      {r.extra && (
        <tspan dx={6} fontSize={11} fontWeight="normal">
          {r.extra}
        </tspan>
      )}
    </text>

    <text x={x0 + colX.lon} y={y0 + (i + 1) * lineH} fontSize={12}>
      {r.lonText}
    </text>

    <text x={x0 + colX.mansion} y={y0 + (i + 1) * lineH} fontSize={12}>
      {r.mansionText}
    </text>
  </g>
))}
    </g>
  );
})()}
{/* ================================ */}
             {/* 変曜 欄外表示 */}
<g>
  <text
    x={cx + 420}
    y={40}
    fontSize={14}
    fontWeight="bold"
    fill="#333"
  >
    変曜
  </text>

  {henyou1Items.map((txt, i) => (
    <text
      key={`henyou1-side-${i}`}
      x={cx + 420}
      y={60 + i * 16}
      fontSize={12}
      fill="#333"
    >
      {txt}
    </text>
  ))}

  <text
    x={cx + 600}
    y={40}
    fontSize={14}
    fontWeight="bold"
    fill="#333"
  >
  </text>

  {henyou2Items.map((txt, i) => (
    <text
      key={`henyou2-side-${i}`}
      x={cx + 600}
      y={60 + i * 16}
      fontSize={12}
      fill="#333"
    >
      {txt}
    </text>
  ))}
</g>    </svg>
  );
}