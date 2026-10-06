// src/lib/takujitsu/dailyDirections.ts
//
// 役割:
//   日盤吉凶方位（喜神・財神・太歳遊方・五鬼）を、日干支から算出する。
//
// 唯一の仕様根拠:
//   docs/source/日盤吉凶方位.txt
//   一般的な方位理論・他流派・ネット情報からの補完は行っていない。
//
// 方針（重要）:
//   これは「日盤」の吉凶方位であり、時辰（時家）に応じて変化しない。
//   同じ日であれば12時辰すべてで共通の値を返す（時辰を引数に取らない）。
//   既存の時家720表（src/lib/takujitsu/jika）・擇日（日家）判定
//   （src/lib/takujitsu）・時家用事別判定（evaluateJikaActivity）には
//   一切変更を加えていない。本モジュールは日干支のみを入力とする
//   独立した純粋関数である。
//
//   喜神／財神／五鬼の方位表記（「東南」「南東」など）は、
//   docs/source/日盤吉凶方位.txt の原文表記をそのまま用いており、
//   統一表記への正規化は行っていない（喜神は「東南」、財神・五鬼は
//   「南東」のように、原文どおり語順が異なる場合がある）。

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

export type XishenDirection = "東北" | "西北" | "西南" | "南" | "東南";
export type CaishenDirection = "北東" | "南東" | "北" | "東" | "南";
export type WuguiDirection = "南東" | "北東" | "北" | "北西" | "南西";
/** 太歳遊方。休止日（原表で言及されない期間）は null（＝「遊方なし」）。 */
export type TaisuiDirection = "東" | "南" | "中宮" | "西" | "北" | null;

export interface DailyDirections {
  /** 喜神方位（日干判定）。 */
  xishen: XishenDirection;
  /** 財神方位（日干判定）。 */
  caishen: CaishenDirection;
  /** 太歳遊方（六十甲子の周期判定）。休止日は null。 */
  taisui: TaisuiDirection;
  /** 五鬼方位（日干判定）。 */
  wugui: WuguiDirection;
}

// --- 喜神（日干判定） ------------------------------------------------------
const XISHEN_BY_STEM: Record<string, XishenDirection> = {
  甲: "東北", 己: "東北",
  乙: "西北", 庚: "西北",
  丙: "西南", 辛: "西南",
  丁: "南", 壬: "南",
  戊: "東南", 癸: "東南",
};

// --- 財神（日干判定） ------------------------------------------------------
// 2026-09-13訂正: docs/source/日盤吉凶方位.txt の財神部分を訂正版に更新済み。
const CAISHEN_BY_STEM: Record<string, CaishenDirection> = {
  甲: "北東", 乙: "北東",
  丙: "南東", 丁: "南東",
  戊: "北", 己: "北",
  庚: "東", 辛: "東",
  壬: "南", 癸: "南",
};

// --- 五鬼（日干判定） ------------------------------------------------------
const WUGUI_BY_STEM: Record<string, WuguiDirection> = {
  甲: "南東", 己: "南東",
  乙: "北東", 庚: "北東",
  丙: "北", 辛: "北",
  丁: "北西", 壬: "北西",
  戊: "南西", 癸: "南西",
};

/**
 * 日干支を六十甲子中のインデックス（0〜59、0＝甲子）に変換する。
 * 干支の組み合わせが不正（十干・十二支の陰陽が一致しない等）な場合は例外を投げる
 * （六十干支は本来この60通りしか存在しないため、本来あり得ない入力エラー）。
 */
function sexagenaryIndex(dayGanzhi: string): number {
  const stem = dayGanzhi[0];
  const branch = dayGanzhi[1];
  const stemIdx = STEMS.indexOf(stem);
  const branchIdx = BRANCHES.indexOf(branch);
  if (stemIdx === -1 || branchIdx === -1 || dayGanzhi.length !== 2) {
    throw new Error(`不正な日干支です: ${dayGanzhi}`);
  }
  for (let n = 0; n < 60; n++) {
    if (n % 10 === stemIdx && n % 12 === branchIdx) return n;
  }
  throw new Error(`六十干支に存在しない組み合わせです: ${dayGanzhi}`);
}

// --- 太歳遊方（六十甲子の周期判定） -----------------------------------------
// 「5日間ある方位を巡る → 7日間休む」の12日周期を5回繰り返す（docs/source/日盤吉凶方位.txt）。
// index 0-4=東, 5-11=休, 12-16=南, 17-23=休, 24-28=中宮, 29-35=休,
// 36-40=西, 41-47=休, 48-52=北, 53-59=休。
const TAISUI_CYCLE: readonly TaisuiDirection[] = ["東", "南", "中宮", "西", "北"];

function taisuiForIndex(index: number): TaisuiDirection {
  const cyclePos = index % 12; // 12日周期内の位置（0〜11）
  const cycleNumber = Math.floor(index / 12); // 何巡目か（0〜4）
  if (cyclePos >= 5) return null; // 7日間の休止
  return TAISUI_CYCLE[cycleNumber];
}

/**
 * 日干支から日盤吉凶方位（喜神・財神・太歳遊方・五鬼）を算出する。
 * 時辰（時家）には依存しない純粋関数。同じ日であれば戻り値は常に同じ。
 *
 * @param dayGanzhi 日干支（例: "甲子"）。
 */
export function calculateDailyDirections(dayGanzhi: string): DailyDirections {
  const stem = dayGanzhi[0];
  const xishen = XISHEN_BY_STEM[stem];
  const caishen = CAISHEN_BY_STEM[stem];
  const wugui = WUGUI_BY_STEM[stem];
  if (!xishen || !caishen || !wugui) {
    throw new Error(`不正な日干です: ${dayGanzhi}`);
  }
  const taisui = taisuiForIndex(sexagenaryIndex(dayGanzhi));
  return { xishen, caishen, taisui, wugui };
}
