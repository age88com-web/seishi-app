// src/lib/eto.ts
export const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"] as const;
export const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"] as const;

export type Stem = typeof STEMS[number];
export type Branch = typeof BRANCHES[number];

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function ymdUTC(d: Date): { y: number; m: number; d: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function dateUTCFromYMD(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

/**
 * 日の切替は「子初（23:00）」。
 * 23:00 以降は翌日扱いとして日干支を計算する。
 */
function civilDateForDayPillar(local: Date): { y: number; m: number; d: number } {
  const ymd = ymdUTC(local);
  const h = local.getHours();
  if (h >= 23) {
    const t = new Date(dateUTCFromYMD(ymd.y, ymd.m, ymd.d) + 24 * 3600 * 1000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  return ymd;
}

/**
 * 日干支
 * アンカー: 1984-02-02 = 丙寅（ユーザー確認済み）
 */
export function dayStemBranch(local: Date): { stem: Stem; branch: Branch } {
  const anchorYMD = { y: 1984, m: 2, d: 2 };
  const anchorIndex = 2; // 丙寅は六十干支インデックス2

  const tgt = civilDateForDayPillar(local);

  const days = Math.round(
    (dateUTCFromYMD(tgt.y, tgt.m, tgt.d) - dateUTCFromYMD(anchorYMD.y, anchorYMD.m, anchorYMD.d))
      / (24 * 3600 * 1000)
  );

  const idx = mod(anchorIndex + days, 60);
  const stem = STEMS[idx % 10];
  const branch = BRANCHES[idx % 12];
  return { stem, branch };
}

/**
 * 年干支（立春基準の簡易版）
 * 1984-02-04 以降を甲子年の基準にする
 * 立春前は前年として扱う
 */
export function yearStemBranch(local: Date): { stem: Stem; branch: Branch } {
  const y = local.getFullYear();
  const m = local.getMonth() + 1;
  const d = local.getDate();

  // 簡易立春境界：2月4日
  const springPassed = (m > 2) || (m === 2 && d >= 4);
  const targetYear = springPassed ? y : y - 1;

  const idx = mod(targetYear - 1984, 60);
  return { stem: STEMS[idx % 10], branch: BRANCHES[idx % 12] };
}

/**
 * 月支（節入り基準の簡易版）
 * 境界日は日本で一般的な節入り日を固定で採用
 *
 * 寅月: 立春   2/4 〜
 * 卯月: 啓蟄   3/6 〜
 * 辰月: 清明   4/5 〜
 * 巳月: 立夏   5/6 〜
 * 午月: 芒種   6/6 〜
 * 未月: 小暑   7/7 〜
 * 申月: 立秋   8/8 〜
 * 酉月: 白露   9/8 〜
 * 戌月: 寒露  10/8 〜
 * 亥月: 立冬  11/7 〜
 * 子月: 大雪  12/7 〜
 * 丑月: 小寒   1/6 〜
 *
 * ※厳密な節入り時刻ではなく「日付固定」の簡易版
 * ※従来の「西暦月=月支」よりは大幅に正確
 */
export function monthBranch(local: Date): Branch {
  const m = local.getMonth() + 1;
  const d = local.getDate();

  if ((m === 2 && d >= 4) || (m === 3 && d <= 5)) return "寅";
  if ((m === 3 && d >= 6) || (m === 4 && d <= 4)) return "卯";
  if ((m === 4 && d >= 5) || (m === 5 && d <= 5)) return "辰";
  if ((m === 5 && d >= 6) || (m === 6 && d <= 5)) return "巳";
  if ((m === 6 && d >= 6) || (m === 7 && d <= 6)) return "午";
  if ((m === 7 && d >= 7) || (m === 8 && d <= 7)) return "未";
  if ((m === 8 && d >= 8) || (m === 9 && d <= 7)) return "申";
  if ((m === 9 && d >= 8) || (m === 10 && d <= 7)) return "酉";
  if ((m === 10 && d >= 8) || (m === 11 && d <= 6)) return "戌";
  if ((m === 11 && d >= 7) || (m === 12 && d <= 6)) return "亥";
  if ((m === 12 && d >= 7) || (m === 1 && d <= 5)) return "子";
  return "丑"; // 1/6〜2/3
}
