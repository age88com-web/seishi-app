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
import PalaceDetailPanel, { LimitDetailPanel, type LimitSelection, type PalaceDetail } from "@/components/PalaceDetailPanel";
import { PALACE_MAIN_STAR } from "@/lib/kakkyoku_engine";
import PalacePrint from "@/components/print/PalacePrint";
import { buildQzPalacePrintData } from "@/lib/qizheng_palace_print";
import { smallLimitAgesForBranch } from "@/lib/small_limit";
import { getBigLimitDegree } from "@/lib/big_limit_degree";
import { getLiunianForLimit } from "@/lib/liunian";
import { integerAgesOfBigLimit } from "@/lib/big_limit_ages";
import { mingMansionOf } from "@/lib/ming_mansion";

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
  palaceDetail?: boolean; // true のとき十二宮クリック＋宮詳細パネルを有効化
  mingDegree?: number; // アプリ共通の命度（命宮方式に応じて lib/ming_degree.ts で決めた値）。大限・限度・流年・年齢選択に使う
  targetAge?: number | null; // 対象年齢（既存入力そのまま）。大限パネルの限度計算用
  birthYear?: number | null; // 出生年（既存の出生日の西暦年）。行限パネルの流年（対象年＝出生年＋対象年齢）用
  onTargetAgeChange?: (age: number) => void; // 大限パネルの「この大限で見る年齢」で選んだ年齢を既存の対象年齢へ反映する
  isDayBirth?: boolean; // 宮詳細パネルの条件照合用（既存の昼夜判定結果）
  kakkyoku?: { good: string[]; bad: string[] } | null; // 宮詳細パネル用（既存の格局エンジン結果）
  interpretationOnly?: boolean; // 解釈印刷用：星盤を描かず、十二宮すべての印刷用鑑定データ（命宮から順）だけを出す
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

// 大限・小限ラベルの体裁（盤の補助情報として小さめ）
const LIMIT_FONT = 9;
const LIMIT_BOX_H = 11;

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

  // 大限・小限ラベル：宮名（既存位置）の上下に2段で置く（宮名の位置は動かさない）。
  // 十二宮リング内側の円（r12Inner）と中央円（rCenter）の間に収め、他宮の宮名・ラベルとも重ならない位置を
  // 宮名に近い順に探す
  type Box = { x0: number; y0: number; x1: number; y1: number };
  type LimitLabel = { text: string; w: number; x: number; y: number };
  // 文字幅の見積もり（全角 1em・数字とダッシュ 0.55em・句読点と空白 0.3em）＋左右余白
  const limitTextW = (t: string) =>
    [...t].reduce((w, ch) => w + LIMIT_FONT * (/[.,\s]/.test(ch) ? 0.3 : /[\x21-\x7e–]/.test(ch) ? 0.55 : 1), 0) + 6;
  const PALACE_NAME_FONT = 13;
  const nameBox = (nx: number, ny: number, name: string): Box => {
    const w = [...name].length * PALACE_NAME_FONT;
    return { x0: nx - w / 2, x1: nx + w / 2, y0: ny - 7, y1: ny + 7 };
  };
  const boxesOverlap = (a: Box, b: Box, m = 3) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;
  function layoutAllLimitLabels(entries: { branch: string; nx: number; ny: number; name: string; bigText: string; smallText: string }[]) {
    const rMax = r12Inner - 5, rMin = rCenter + 3;
    const names = entries.map((e) => nameBox(e.nx, e.ny, e.name));
    const placed: Box[] = [];
    const out: Record<string, { big: LimitLabel | null; small: LimitLabel | null }> = {};
    const inRing = (bx: Box) => {
      const corners = [[bx.x0, bx.y0], [bx.x1, bx.y0], [bx.x0, bx.y1], [bx.x1, bx.y1]];
      if (corners.some(([x, y]) => Math.hypot(x - cx, y - cy) > rMax)) return false;
      const qx = Math.max(bx.x0, Math.min(cx, bx.x1)), qy = Math.max(bx.y0, Math.min(cy, bx.y1));
      return Math.hypot(qx - cx, qy - cy) >= rMin;
    };
    for (const [ei, e] of entries.entries()) {
      const items = [e.bigText, e.smallText].map((t) => ({ text: t, w: t ? limitTextW(t) : 0 }));
      const step = LIMIT_BOX_H + 1;
      const nb = nameBox(e.nx, e.ny, e.name);
      const below = [nb.y1 + 1 + LIMIT_BOX_H / 2, nb.y1 + 1 + LIMIT_BOX_H / 2 + step];
      const above = [nb.y0 - 1 - LIMIT_BOX_H / 2 - step, nb.y0 - 1 - LIMIT_BOX_H / 2];
      const orders = e.ny < cy ? [below, above] : [above, below];
      const dirC = e.nx < cx ? 1 : -1; // 中心方向を優先
      const dxs: number[] = [0];
      for (let d = 1; d <= 70; d++) dxs.push(dirC * d, -dirC * d);
      let chosen: { x: number; ys: number[] } | null = null;
      search: for (const dx of dxs) {
        for (const ys of orders) {
          const x = e.nx + dx;
          const bxs = items.map((it, i) => (it.text ? { x0: x - it.w / 2, x1: x + it.w / 2, y0: ys[i] - LIMIT_BOX_H / 2, y1: ys[i] + LIMIT_BOX_H / 2 } : null)).filter(Boolean) as Box[];
          if (!bxs.every(inRing)) continue;
          // 自宮の宮名とは接してよい（重なりのみ不可）。他宮の宮名・配置済みラベルとは余白を取る
          if (bxs.some((bx) => boxesOverlap(bx, nb, 0) || names.some((n, j) => j !== ei && boxesOverlap(bx, n)) || placed.some((pb) => boxesOverlap(bx, pb)))) continue;
          chosen = { x, ys };
          placed.push(...bxs);
          break search;
        }
      }
      const c = chosen ?? { x: e.nx, ys: orders[0] };
      out[e.branch] = {
        big: items[0].text ? { text: items[0].text, w: items[0].w, x: c.x, y: c.ys[0] } : null,
        small: items[1].text ? { text: items[1].text, w: items[1].w, x: c.x, y: c.ys[1] } : null,
      };
    }
    return out;
  }

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

  // ===== 宮クリック（宮詳細パネル）=====
  const [selectedBranch, setSelectedBranch] = React.useState<string | null>(null);
  // 大限・小限ラベルのクリック（行限パネル）。宮本体クリックとは別の状態で持つ
  const [selectedLimit, setSelectedLimit] = React.useState<LimitSelection | null>(null);

  const henyouByPalace = useMemo(
    () => buildHenyouByPalace(yearStem as any, bodies as any, BRANCHES_B) as Record<string, string[]>,
    [yearStem, bodies]
  );

  // ===== 星一覧表の行データ（表と宮詳細パネルで共有。計算内容は従来の表と同一）=====
  const starRows = useMemo(() => {
  // 1) 表に出す星の並び（必要なら並び替えてOK）
  const ORDER = ["日","月","水","金","火","木","土","羅喉","計都","月孛","紫炁"] as const;

  // 2) 表の行データ作成
  return (bodies as any[])
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
  }, [bodies, ouboinMap, props.monthBranch]);

  // 神殺の出どころ（既存の3関数の結果を合流前のまま保持。合流結果 shenshaMerged と同じ入力）
  const shenshaSources = useMemo(() => ({
    year_stem: (yearStem ? getNenganPalaceShensha(yearStem) : {}) as Partial<PalaceMap>,
    year_branch: (yearBranch ? getNenshiPalaceShensha(yearBranch) : {}) as Partial<PalaceMap>,
    month_branch: (monthBranch ? getMonthBranchPalaceShensha(monthBranch) : {}) as Record<string, string[]>,
  }), [yearStem, yearBranch, monthBranch]);

  // 星に付く変曜系（既存の getHenyou2* の結果。henyou2Items と同じ対象名）
  const henyou2List = useMemo(() => {
    const out: { name: string; mark: string; origin: "henyou2_year_branch" | "henyou2_stem_ming" }[] = [];
    for (const name of ["爵星", "産星", "血支", "血忌", "馬元", "天馬", "地駅"] as const) {
      const mark = getHenyou2ByYearBranch(name, yearBranch as any);
      if (mark) out.push({ name, mark: String(mark), origin: "henyou2_year_branch" });
    }
    for (const name of ["天経", "地緯", "天元", "地元", "人元", "職元", "局主"] as const) {
      const mark = getHenyou2ByStemAndMing(name, yearStem as any, mingBranch as any);
      if (mark) out.push({ name, mark: String(mark), origin: "henyou2_stem_ming" });
    }
    return out;
  }, [yearStem, yearBranch, mingBranch]);

  // 指定した宮の詳細データ（宮本体クリックと大限・小限クリックで共用）
  const buildPalaceDetail = React.useCallback((targetBranch: string): PalaceDetail | null => {
    const pc = palaceCenters.find((p) => p.branch === targetBranch);
    if (!pc) return null;

    // 星の所在・宿・状態はすべて既存結果（palaceFromLon / lonToMansionDeg / 星一覧表の行）から
    const rowByKey = new Map((starRows as any[]).map((r) => [String(r.key), r]));
    const starInfo = (b: any) => {
      const lon = ((Number(b?.lonDeg) % 360) + 360) % 360;
      const m = lonToMansionDeg(lon) as any;
      const row = rowByKey.get(String(b?.id ?? b?.label ?? ""));
      return {
        key: String(b?.id ?? b?.label ?? ""),
        label: String(b?.label ?? "").trim(),
        branch: Number.isFinite(lon) ? palaceFromLon(lon) : "",
        mansion: String(m?.mansion?.label ?? ""),
        motion: String(row?.motion ?? ""),
        status: String(row?.status ?? ""),
        extra: String(row?.extra ?? ""),
      };
    };
    const all = (bodies as any[]).map(starInfo);
    const ORDER = ["日","月","水","金","火","木","土","羅喉","計都","月孛","紫炁"];
    const stars = all
      .filter((s) => s.branch === targetBranch)
      .sort((a, b) => {
        const ai = ORDER.indexOf(a.label);
        const bi = ORDER.indexOf(b.label);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

    // 変曜（十干変曜）：buildHenyouByPalace の「天禄(木星)」形式
    const parseHenyou = (raw: string) => {
      const m = /^(.+?)\((.+)\)$/.exec(raw);
      return { raw, name: m ? m[1] : raw, starLabel: m ? m[2] : "" };
    };
    const henyou = (henyouByPalace?.[pc.branch] ?? []).map(parseHenyou);

    // 星に付く変曜系：対象の星が当宮にあるものだけ
    const MARK_TO_ID: Record<string, string> = { 日:"sun", 月:"moon", 木:"jupiter", 火:"mars", 土:"saturn", 金:"venus", 水:"mercury", 気:"ziqi", 孛:"yuebo", 羅:"rahu", 計:"ketu" };
    const henyou2 = henyou2List
      .map((h) => ({ ...h, starKey: MARK_TO_ID[h.mark] ?? "", starLabel: HENYOU_MARK_TO_LABEL[h.mark as keyof typeof HENYOU_MARK_TO_LABEL] ?? h.mark }))
      .filter((h) => stars.some((s) => s.key === h.starKey));

    // 神殺：合流後の名称と、その出どころ（年干／年支／月支）
    const shenshaAt = (br: string) =>
      (((shenshaMerged as any)?.[br] ?? []) as string[]).map((name) => ({
        name,
        origins: (["year_stem", "year_branch", "month_branch"] as const).filter((o) =>
          ((shenshaSources[o] as any)?.[br] ?? []).includes(name)
        ),
      }));
    const shensha = shenshaAt(pc.branch);

    // 宮主（既存の十二宮主星表 PALACE_MAIN_STAR）
    const lordOf = (br: string) => {
      const label = PALACE_MAIN_STAR[br];
      const b = (bodies as any[]).find((x) => String(x?.label ?? "").trim() === label);
      return label ? { lordLabel: String(label), body: b ? starInfo(b) : null } : null;
    };
    const lord = lordOf(pc.branch);
    const mingLord = mingBranch ? lordOf(mingBranch) : null;
    const shenLord = shenBranch ? lordOf(shenBranch) : null;

    return {
      branch: pc.branch,
      palaceName: pc.palaceName,
      isShenPalace: !!shenBranch && pc.branch === shenBranch,
      mingBranch: String(mingBranch ?? ""),
      shenBranch: String(shenBranch ?? ""),
      sex: props.sex,
      isDayBirth: props.isDayBirth,
      // 解釈本文の表示条件（年干・年支で分かれる文）の判定用。既存の年干支をそのまま渡す
      yearStem: yearStem ? String(yearStem) : undefined,
      yearBranch: yearBranch ? String(yearBranch) : undefined,
      stars,
      henyou,
      henyou2,
      shensha,
      lord,
      mingLord,
      shenLord,
      kakkyoku: props.kakkyoku ?? null,
      // 宮主星の所在宮を参照するための全体データ（いずれも既存結果をそのまま並べ替えたもの）
      palaceNameByBranch: Object.fromEntries(palaceCenters.map((p) => [p.branch, p.palaceName])),
      allStars: all,
      henyouByBranch: Object.fromEntries(BRANCHES_B.map((br) => [br, (henyouByPalace?.[br] ?? []).map(parseHenyou)])),
      henyou2All: henyou2List.map((h) => ({ ...h, starKey: MARK_TO_ID[h.mark] ?? "", starLabel: HENYOU_MARK_TO_LABEL[h.mark as keyof typeof HENYOU_MARK_TO_LABEL] ?? h.mark })),
      shenshaByBranch: Object.fromEntries(BRANCHES_B.map((br) => [br, shenshaAt(br)])),
    };
  }, [props.sex, props.isDayBirth, props.kakkyoku, palaceCenters, bodies, starRows,
      henyouByPalace, henyou2List, shenshaMerged, shenshaSources, mingBranch, shenBranch, yearStem, yearBranch]);

  const selectedDetail = useMemo(
    () => (props.palaceDetail && selectedBranch ? buildPalaceDetail(selectedBranch) : null),
    [props.palaceDetail, selectedBranch, buildPalaceDetail]
  );
  const limitDetail = useMemo(
    () => (props.palaceDetail && selectedLimit ? buildPalaceDetail(selectedLimit.branch) : null),
    [props.palaceDetail, selectedLimit, buildPalaceDetail]
  );

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

  // 解釈印刷：星盤は描かず、十二宮の印刷用鑑定データ（buildQzPalacePrintData。宮詳細と同じ buildPalaceDetail の結果から作る）を
  // 印刷専用レイアウト（PalacePrint）で命宮から順に並べる。画面の宮詳細パネルは使わない。盤全体の格局は各宮に出さない
  if (props.interpretationOnly) {
    const ordered = palaceCenters
      .slice()
      .sort((a, b) => PALACE_NAMES.indexOf(a.palaceName) - PALACE_NAMES.indexOf(b.palaceName));
    return (
      <>
        {ordered.map((p) => {
          const d = buildPalaceDetail(p.branch);
          return d ? <PalacePrint key={p.branch} data={buildQzPalacePrintData(d)} /> : null;
        })}
      </>
    );
  }

  // 左端で星名が切れる対策（viewBox を左に広げる）
  const padL = 60;
　const padR = 500;   // 右側の余白（表用）
  return (
    <>
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
        {(() => {
          // 宮名の位置（下の描画と同じ既存計算）
          const namePos = (p: (typeof palaceCenters)[number]) => {
            const q = polar(cx, cy, rPalaceName, angleFromLonCCW(p.centerLon));
            return pushToCenterIfLowerHalf(q.x, q.y, cx, cy, 22);
          };
          // 大限：既存の bigLimits／小限：0歳＝命宮として逆行（規則は lib/small_limit.ts に一本化）
          const limitLayout = layoutAllLimitLabels(palaceCenters.map((p) => {
            const pn = namePos(p);
            const dTxt = bigLimits ? (bigLimits as any)[p.branch] : "";
            return { branch: p.branch, nx: pn.x, ny: pn.y, name: p.palaceName, bigText: dTxt ? `大限 ${dTxt}` : "", smallText: `小限 ${smallLimitAgesForBranch(mingBranch, p.branch).join(",")}` };
          }));
          return palaceCenters.map((p) => {
          const ang = angleFromLonCCW(p.centerLon);

          const pb = polar(cx, cy, rBranchLabel, ang);

          let pn = polar(cx, cy, rPalaceName, ang);
          pn = pushToCenterIfLowerHalf(pn.x, pn.y, cx, cy, 22);

          const lay = limitLayout[p.branch];
          const dTxt = bigLimits ? String((bigLimits as any)[p.branch] ?? "") : "";
          const sAges = smallLimitAgesForBranch(mingBranch, p.branch);
          const clickable = !!props.palaceDetail;
          const bigSel = selectedLimit?.type === "big" && selectedLimit.branch === p.branch;
          const smallSel = selectedLimit?.type === "small" && selectedLimit.branch === p.branch;
          // 宮本体のクリックへ伝播させない
          const onLimitClick = (sel: LimitSelection) => (e: React.MouseEvent) => {
            e.stopPropagation();
            setSelectedBranch(null);
            setSelectedLimit(sel);
          };

          return (
            <g key={`lab-${p.branch}`}>
              <text x={pb.x} y={pb.y} fontSize={18} textAnchor="middle" dominantBaseline="middle">
                {p.branch}
              </text>

              <text x={pn.x} y={pn.y} fontSize={13} textAnchor="middle" dominantBaseline="middle">
                {p.palaceName}
              </text>

              {/* 大限・小限：それぞれ独立した g（後から個別に onClick を付けられる） */}
              {lay.big ? (
                <g className="big-limit-label" data-branch={p.branch}
                  {...(clickable ? { style: { cursor: "pointer" }, onClick: onLimitClick({ type: "big", branch: p.branch, ageRange: dTxt }) } : {})}>
                  <rect x={lay.big.x - lay.big.w / 2} y={lay.big.y - LIMIT_BOX_H / 2} width={lay.big.w} height={LIMIT_BOX_H} rx={2}
                    fill={bigSel ? "#dfe7f5" : "#f4f6fb"} stroke={bigSel ? "#466ec8" : "#b9c3d6"} strokeWidth={bigSel ? 1.4 : 0.6} />
                  <text x={lay.big.x} y={lay.big.y + 0.5} fontSize={LIMIT_FONT} fill="#333" fontWeight={bigSel ? 700 : undefined} textAnchor="middle" dominantBaseline="middle">{lay.big.text}</text>
                </g>
              ) : null}
              {lay.small ? (
                <g className="small-limit-label" data-branch={p.branch}
                  {...(clickable ? { style: { cursor: "pointer" }, onClick: onLimitClick({ type: "small", branch: p.branch, ages: sAges }) } : {})}>
                  <rect x={lay.small.x - lay.small.w / 2} y={lay.small.y - LIMIT_BOX_H / 2} width={lay.small.w} height={LIMIT_BOX_H} rx={2}
                    fill={smallSel ? "#eef2f9" : "#fff"} stroke={smallSel ? "#466ec8" : "#c8c8c8"} strokeWidth={smallSel ? 1.4 : 0.6} />
                  <text x={lay.small.x} y={lay.small.y + 0.5} fontSize={LIMIT_FONT} fill={smallSel ? "#333" : "#555"} fontWeight={smallSel ? 700 : undefined} textAnchor="middle" dominantBaseline="middle">{lay.small.text}</text>
                </g>
              ) : null}
            </g>
          );
          });
        })()}
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
  // 1)・2) 表の行データは starRows（useMemo）で作成済み
  const rows = starRows;

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
</g>

      {/* 十二宮クリック領域（宮詳細パネル用・最前面の透明扇形） */}
      {props.palaceDetail && (
        <g className="zg-palace-hit">
          {palaceCenters.map((p) => {
            // 中心角±15°＝宮の境界線と一致
            const a0 = angleFromLonCCW(p.centerLon - 15);
            const a1 = angleFromLonCCW(p.centerLon + 15);
            const o0 = polar(cx, cy, r12Outer, a0);
            const o1 = polar(cx, cy, r12Outer, a1);
            const i1 = polar(cx, cy, r12Inner, a1);
            const i0 = polar(cx, cy, r12Inner, a0);
            const d = [
              `M ${o0.x} ${o0.y}`,
              `A ${r12Outer} ${r12Outer} 0 0 1 ${o1.x} ${o1.y}`,
              `L ${i1.x} ${i1.y}`,
              `A ${r12Inner} ${r12Inner} 0 0 0 ${i0.x} ${i0.y}`,
              "Z",
            ].join(" ");
            const selected = selectedBranch === p.branch;
            return (
              <path
                key={`hit-${p.branch}`}
                d={d}
                fill={selected ? "rgba(70,110,200,0.10)" : "transparent"}
                stroke={selected ? "rgba(70,110,200,0.6)" : "none"}
                strokeWidth={selected ? 1.5 : 0}
                style={{ cursor: "pointer" }}
                onClick={() => { setSelectedLimit(null); setSelectedBranch(p.branch); }}
              >
                <title>{`${p.palaceName}　${p.branch}`}</title>
              </path>
            );
          })}
        </g>
      )}
    </svg>
    {selectedDetail && <PalaceDetailPanel key={selectedDetail.branch} detail={selectedDetail} />}
    {selectedLimit && limitDetail && (
      <LimitDetailPanel
        key={`${selectedLimit.type}-${selectedLimit.branch}`}
        selection={selectedLimit}
        detail={limitDetail}
        bigDegree={selectedLimit.type === "big" && props.mingDegree != null
          ? getBigLimitDegree({ mingBranch: mingBranch as any, mingDegree: props.mingDegree, targetAge: props.targetAge, clickedBranch: selectedLimit.branch })
          : null}
        liunian={getLiunianForLimit({ birthYear: props.birthYear, targetAge: props.targetAge, selection: selectedLimit, mingBranch, mingDegree: props.mingDegree })}
        mingMansion={mingMansionOf(mingBranch, props.mingDegree)?.mansion ?? null}
        bigAgeSelect={selectedLimit.type === "big" && props.onTargetAgeChange
          ? (() => {
              // 選択肢はこの大限に入る整数年齢。既存の対象年齢が範囲内ならそれを選択状態にし、範囲外・未入力なら未選択
              const ages = integerAgesOfBigLimit(mingBranch, props.mingDegree, selectedLimit.branch);
              const cur = props.targetAge ?? null;
              return { ages, value: cur != null && ages.includes(cur) ? cur : null, onChange: props.onTargetAgeChange };
            })()
          : null}
      />
    )}
    </>
  );
}