// src/lib/mansions28.ts
// 二十八宿（実幅）を黄経(0..360)上に割り当てるユーティリティ。
// 角宿の開始黄経を JIAO_START_LON_DEG で指定し、以降は宿幅の累積で startLonDeg を自動計算します。

export type Mansion28 = {
  key: string;
  label: string;       // 宿名（例: "角"）
  widthDeg: number;    // 宿の実幅（度）
  startLonDeg: number; // その宿の開始黄経（0..360）
};

export type MansionDegResult = {
  mansion: Mansion28;
  degInMansion: number; // 宿内度数（0..widthDeg）
  mansionIndex: number;
  startLonDeg: number;
  endLonDeg: number;
};

// 角宿開始をここで決める（希望値）
export const JIAO_START_LON_DEG = 188;

// 正規化（0..360）
export function norm360(x: number): number {
  const v = x % 360;
  return v < 0 ? v + 360 : v;
}

type Mansion28Base = {
  key: string;
  label: string;
  widthDeg: number;
};

const MANSIONS_28_BASE: Mansion28Base[] = [
  { key: "JIAO",  label: "角", widthDeg: 12 },
  { key: "KANG",  label: "亢", widthDeg: 9 },
  { key: "DI",    label: "氐", widthDeg: 17 },
  { key: "FANG",  label: "房", widthDeg: 6 },
  { key: "XIN",   label: "心", widthDeg: 6 },
  { key: "WEI",   label: "尾", widthDeg: 18 },
  { key: "JI",    label: "箕", widthDeg: 11 },

  { key: "DOU",   label: "斗", widthDeg: 24 },
  { key: "NIU",   label: "牛", widthDeg: 7 },
  { key: "NV",    label: "女", widthDeg: 12 },
  { key: "XU",    label: "虚", widthDeg: 10 },
  { key: "WEI2",  label: "危", widthDeg: 15 },
  { key: "SHI",   label: "室", widthDeg: 17 },
  { key: "BI",    label: "壁", widthDeg: 8 },

  { key: "KUI",   label: "奎", widthDeg: 17 },
  { key: "LOU",   label: "婁", widthDeg: 12 },
  { key: "WEI3",  label: "胃", widthDeg: 15 },
  { key: "MAO",   label: "昴", widthDeg: 11 },
  { key: "BI2",   label: "畢", widthDeg: 17 },
  { key: "ZUI",   label: "觜", widthDeg: 1 },
  { key: "SHEN",  label: "参", widthDeg: 10 },

  { key: "JING",  label: "井", widthDeg: 31 },
  { key: "GUI",   label: "鬼", widthDeg: 3 },
  { key: "LIU",   label: "柳", widthDeg: 14 },
  { key: "XING",  label: "星", widthDeg: 6 },
  { key: "ZHANG", label: "張", widthDeg: 16 },
  { key: "YI",    label: "翼", widthDeg: 19 },
  { key: "ZHEN",  label: "軫", widthDeg: 17 },
];

// startLonDeg を自動計算した最終配列（合計 360° 前提）
export const MANSIONS_28: Mansion28[] = (() => {
  let cur = norm360(JIAO_START_LON_DEG);
  return MANSIONS_28_BASE.map((m) => {
    const out: Mansion28 = { ...m, startLonDeg: cur };
    cur = norm360(cur + m.widthDeg);
    return out;
  });
})();

// 太い区切り線のインデックス（ChartSVG 側は「関数」として呼ぶ想定）
export function mansionGroupDividerIndices(): number[] {
  return [0, 7, 14, 21];
}

/**
 * 黄経 → 「宿」＋「宿内度数」
 * ※入力 lonDeg は “絶対黄経(0..360)” として扱う（ChartSVG の描画と一致）
 */
export function lonToMansionDeg(lonDeg: number): MansionDegResult | null {
  if (!Number.isFinite(lonDeg)) return null;
  const lon = norm360(lonDeg);

  for (let i = 0; i < MANSIONS_28.length; i++) {
    const m = MANSIONS_28[i];

    const startAbs = norm360(m.startLonDeg);
    const endAbsRaw = m.startLonDeg + m.widthDeg; // 360 を跨ぐ可能性あり
    const endAbs = norm360(endAbsRaw);

    const inRange =
      endAbsRaw <= 360
        ? lon >= startAbs && lon < endAbs
        : lon >= startAbs || lon < endAbs;

    if (inRange) {
      const degIn = lon >= startAbs ? lon - startAbs : lon + 360 - startAbs;
      return {
        mansion: m,
        degInMansion: degIn,
        mansionIndex: i,
        startLonDeg: startAbs,
        endLonDeg: endAbs,
      };
    }
  }

  // 定義ミス保険（通常ここには来ない）
  const m0 = MANSIONS_28[0];
  return {
    mansion: m0,
    degInMansion: 0,
    mansionIndex: 0,
    startLonDeg: norm360(m0.startLonDeg),
    endLonDeg: norm360(m0.startLonDeg + m0.widthDeg),
  };
}
