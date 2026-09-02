// src/lib/qimen/jikaku.ts
//
// 役割:
//   奇門遁甲「格局（吉格）」— 完成した排盤（各宮の 天盤干・地盤干・八門・八神）と、
//   用事の時干支の六儀（旬首）・人盤値使門の宮から、該当する吉格を判定する。
//   凶格判定・九星の吉凶・格局同士の優先順位付けは行わない。
//
// 仕様の出典（唯一の根拠）:
//   元Keynote「奇門遁甲講義案N.key」の吉格スライド5枚の本文を直接デコードして
//   確認したもの。
//     ・格局詳細（吉格）    Index/Slide-3717（青龍返首・飛鳥跌穴・玉女守門・天遁・地遁）
//     ・格局詳細２（吉格）  Index/Slide-3764（人遁・神遁・鬼遁・風遁・雲遁）
//     ・格局詳細３（吉格）  Index/Slide-3811（龍遁・虎遁・乙奇得使・丙奇得使・丁奇得使・乙奇升殿）
//     ・格局詳細４（吉格）  Index/Slide-3858（丙奇升殿・丁奇升殿・真詐・重詐・休詐）
//     ・格局詳細５（吉格）  Index/Slide-3905（天假・地假・人假・神假・鬼假）※「五假」
//   docs/qimen-spec/11_格局（吉格）.md は補助資料。低解像度の判読に基づく誤りを
//   含むため（例: Slide-3905 を「五遁」と誤記、同名格の重複記載など）、
//   本ファイルでは元Keynote本文のみを最優先の仕様とし、spec の記述は採用しない。
//
// 各スライド本文の該当箇所（デコード原文）:
//   青龍返首  用事の時干支の六儀（旬首）となる天盤と地盤丙が同宮する
//   飛鳥跌穴  天盤丙と用事の時干支の六儀（旬首）となる地盤が同宮
//   玉女守門  人盤値使門に地盤丁が同宮。
//             さらに旬ごとの用事の時干支の対応（ユーザー確定仕様）:
//               甲子旬→庚午 / 甲戌旬→己卯 / 甲申旬→戊子 /
//               甲午旬→丁酉 / 甲辰旬→丙午 / 甲寅旬→乙卯
//   天遁      生門に天盤丙と地盤丁が同宮　または生門と天盤丙、地盤戊が同宮
//   地遁      開門と天盤乙と地盤己が同宮
//   人遁      休門と天盤丁に太陰が同宮
//   神遁      生門と天盤丙と九天が同宮
//   鬼遁      杜門と天盤丁と九地が同宮、開門と天盤乙に九地、休門と天盤丁に九地
//   風遁      休、開、生の三吉門と天盤乙が巽四宮に同宮
//   雲遁      休、開、生の三吉門と天盤乙地盤辛が同宮　または天盤乙と開門が坤二宮に同宮
//   龍遁      休、開、生の三吉門に天盤乙と地盤癸が同宮、または坎一で同宮
//   虎遁      休門または生門と天盤乙に地盤辛が同宮、または艮八で同宮
//   乙奇得使  天盤乙が地盤己（甲戌）或いは辛（甲午）と同宮
//   丙奇得使  天盤丙が地盤戊（甲子）或いは庚（甲申）と同宮
//   丁奇得使  天盤丁が地盤壬（甲辰）或いは癸（甲寅）と同宮
//   乙奇升殿  天盤乙が震三宮に入宮
//   丙奇升殿  天盤丙が離九宮に入宮
//   丁奇升殿  天盤丁が兌七宮に入宮
//   真詐      開、休、生の三吉門と天盤乙、丙、丁の三奇が太陰の宮に同宮
//   重詐      開、休、生の三吉門と天盤乙、丙、丁の三奇が九地の宮に同宮
//   休詐      開、休、生の三吉門と天盤乙、丙、丁の三奇が六合の宮に同宮
//   天假      景門と天盤乙、丙、丁の三奇が九天と同宮
//   地假      杜門と天盤丁、己、癸が九地、太陰或いは六合の宮に同宮
//   人假      驚門と天盤壬が九天の宮に同宮
//   神假      傷門と天盤丁、己、癸が九地或いは六合と同宮
//   鬼假      死門と天盤丁、己、癸が九地と同宮
//
// 判定に使用しない要素:
//   吉格スライド本文は九星に一切言及していないため、九星は判定に用いない。
//
// 推測しない範囲（TODO 参照）:
//   ・複数の吉格が同時成立した場合の優先順位はスライドに記載が無いため付けない。

import type { QimenResult, PalaceSummary } from "./qimenEngine";
import type { DiPanStem } from "./dipan";
import type { BaMenName } from "./bamen";
import type { BaShenName } from "./bashen";

/** 三吉門（スライド本文「休、開、生の三吉門」）。 */
const SANKICHIMON: readonly BaMenName[] = ["休門", "開門", "生門"];

/** 三奇（スライド本文「天盤乙、丙、丁の三奇」）。 */
const SANKI: readonly DiPanStem[] = ["乙", "丙", "丁"];

/**
 * 宮番号 → 後天八卦。
 * 既存確定モジュール（jiuxing.ts / bamen.ts / bashen.ts）のRINGコメント
 * 「巽4→離9→坤2→兌7→乾6→坎1→艮8→震3」および dipan.ts の LUOSHU_GRID から
 * そのまま再掲したもの（本ファイルでの新規推測ではない）。
 */
const PALACE_TRIGRAM: Record<number, string> = {
  1: "坎",
  2: "坤",
  3: "震",
  4: "巽",
  6: "乾",
  7: "兌",
  8: "艮",
  9: "離",
};

/** 判定に必要な排盤の段。未算出ならその格はスキップし unavailable に記録する。 */
type Segment = "天盤" | "八門" | "八神" | "人盤値使門";

export interface JikakuInput {
  /** 九宮(1〜9) → 地盤干・天盤干・八門・八神（九星は吉格判定に使用しない）。 */
  palaces: Record<number, PalaceSummary>;
  /** 用事の時干支の六儀（旬首）。xunShou.liuyi をそのまま渡す。 */
  liuyi: DiPanStem;
  /** 人盤の値使門が配置された宮（玉女守門の判定用）。八門が未算出なら null。 */
  zhishiPalace: number | null;
  /** 旬首の干支（例: "甲子"）。玉女守門の旬条件の判定用。xunShou.xunShou をそのまま渡す。 */
  xunShou: string;
  /** 用事の時干支（例: "庚午"）。玉女守門の旬条件の判定用。 */
  hourGanzhi: string;
}

/** 玉女守門: 旬首の干支 → その旬で玉女守門が成立する用事の時干支（ユーザー確定仕様）。 */
const GYOJO_SHUMON_XUN_TABLE: Record<string, string> = {
  "甲子": "庚午",
  "甲戌": "己卯",
  "甲申": "戊子",
  "甲午": "丁酉",
  "甲辰": "丙午",
  "甲寅": "乙卯",
};

export interface JikakuMatch {
  /** 吉格名（講義スライドの表記そのまま）。 */
  name: string;
  /** 成立した宮の番号（1〜9）。宮ごとに別々に成立した場合は複数入る。昇順。 */
  palaces: number[];
  /** 講義スライドに記載された象意・宜しい事柄（原文ママ）。 */
  meaning: string;
  /** 典拠スライド。 */
  source: string;
}

export interface JikakuResult {
  /** 該当した吉格（スライドの記載順）。 */
  matches: JikakuMatch[];
  /** 判定に必要だが未算出だった段。ここに載る段を必要とする格は判定していない。 */
  unavailable: Segment[];
}

// --- 宮ごとのアクセサ -------------------------------------------------------

function tpStem(p: PalaceSummary | undefined): DiPanStem | undefined {
  return p?.tianPanStem;
}
function dpStem(p: PalaceSummary | undefined): DiPanStem | undefined {
  return p?.diPanStem;
}
function hasMen(p: PalaceSummary | undefined, men: BaMenName): boolean {
  return !!p && p.baMen.includes(men);
}
function hasAnyMen(p: PalaceSummary | undefined, list: readonly BaMenName[]): boolean {
  return !!p && list.some((m) => p.baMen.includes(m));
}
function hasShen(p: PalaceSummary | undefined, shen: BaShenName): boolean {
  return !!p && p.baShen.includes(shen);
}
function hasAnyShen(p: PalaceSummary | undefined, list: readonly BaShenName[]): boolean {
  return !!p && list.some((s) => p.baShen.includes(s));
}
function tpIsAny(p: PalaceSummary | undefined, list: readonly DiPanStem[]): boolean {
  const s = tpStem(p);
  return s !== undefined && list.includes(s);
}

// --- 段の可用性チェック ----------------------------------------------------

function segmentAvailable(seg: Segment, input: JikakuInput): boolean {
  const list = Object.values(input.palaces);
  switch (seg) {
    case "天盤":
      return list.some((p) => p.tianPanStem !== undefined);
    case "八門":
      return list.some((p) => p.baMen.length > 0);
    case "八神":
      return list.some((p) => p.baShen.length > 0);
    case "人盤値使門":
      return input.zhishiPalace !== null;
  }
}

// --- 吉格ルール -----------------------------------------------------------

interface Rule {
  name: string;
  meaning: string;
  source: string;
  /** この格の判定に必要な段。 */
  needs: readonly Segment[];
  /** 成立した宮番号を返す（重複可、呼び出し側で整列・一意化する）。 */
  match: (input: JikakuInput) => number[];
}

/** 1〜9宮を走査し、述語が真の宮番号を返す。 */
function scan(
  input: JikakuInput,
  pred: (p: PalaceSummary | undefined, palace: number, input: JikakuInput) => boolean,
): number[] {
  const out: number[] = [];
  for (let palace = 1; palace <= 9; palace += 1) {
    if (pred(input.palaces[palace], palace, input)) out.push(palace);
  }
  return out;
}

const S1 = "格局詳細（吉格） / Slide-3717";
const S2 = "格局詳細２（吉格） / Slide-3764";
const S3 = "格局詳細３（吉格） / Slide-3811";
const S4 = "格局詳細４（吉格） / Slide-3858";
const S5 = "格局詳細５（吉格）＝五假 / Slide-3905";

const RULES: readonly Rule[] = [
  // --- 格局詳細（吉格） -------------------------------------------------
  {
    name: "青龍返首",
    meaning: "就職、訴訟、遷移、求財、建築、男性の結婚、百事皆吉",
    source: S1,
    needs: ["天盤"],
    // 「用事の時干支の六儀（旬首）となる天盤と地盤丙が同宮する」
    match: (input) =>
      scan(input, (p) => tpStem(p) === input.liuyi && dpStem(p) === "丙"),
  },
  {
    name: "飛鳥跌穴",
    meaning: "就職、訴訟、遷移、求財、建築、婚姻、百事皆吉",
    source: S1,
    needs: ["天盤"],
    // 「天盤丙と用事の時干支の六儀（旬首）となる地盤が同宮」
    match: (input) =>
      scan(input, (p) => tpStem(p) === "丙" && dpStem(p) === input.liuyi),
  },
  {
    name: "玉女守門",
    meaning: "宴会、喜び事、女性の結婚",
    source: S1,
    needs: ["人盤値使門"],
    // 主条件「人盤値使門の宮に地盤丁が同宮」＋ 旬条件（旬首の干支に対応する用事の
    // 時干支と一致すること）の両方を満たすときに成立させる。
    match: (input) => {
      const zp = input.zhishiPalace;
      if (zp === null) return [];
      // 主条件: 値使門の宮に地盤丁
      if (dpStem(input.palaces[zp]) !== "丁") return [];
      // 旬条件: 旬首の干支 → 対応する用事の時干支に一致
      const expectedHour = GYOJO_SHUMON_XUN_TABLE[input.xunShou];
      if (expectedHour === undefined || expectedHour !== input.hourGanzhi) return [];
      return [zp];
    },
  },
  {
    name: "天遁",
    meaning: "行軍、戦争、上訴、求官、商売、求財、婚姻など",
    source: S1,
    needs: ["天盤", "八門"],
    // 「生門に天盤丙と地盤丁が同宮　または生門と天盤丙、地盤戊が同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasMen(p, "生門") &&
          tpStem(p) === "丙" &&
          (dpStem(p) === "丁" || dpStem(p) === "戊"),
      ),
  },
  {
    name: "地遁",
    meaning: "建築、修造、遁甲造作のリセット",
    source: S1,
    needs: ["天盤", "八門"],
    // 「開門と天盤乙と地盤己が同宮」
    match: (input) =>
      scan(
        input,
        (p) => hasMen(p, "開門") && tpStem(p) === "乙" && dpStem(p) === "己",
      ),
  },

  // --- 格局詳細２（吉格） ---------------------------------------------
  {
    name: "人遁",
    meaning: "探索、潜伏、和平交渉、求賢、結婚、交易など",
    source: S2,
    needs: ["天盤", "八門", "八神"],
    // 「休門と天盤丁に太陰が同宮」
    match: (input) =>
      scan(
        input,
        (p) => hasMen(p, "休門") && tpStem(p) === "丁" && hasShen(p, "太陰"),
      ),
  },
  {
    name: "神遁",
    meaning: "財、物質的に自分の実力以上のものが手にはいる",
    source: S2,
    needs: ["天盤", "八門", "八神"],
    // 「生門と天盤丙と九天が同宮」
    match: (input) =>
      scan(
        input,
        (p) => hasMen(p, "生門") && tpStem(p) === "丙" && hasShen(p, "九天"),
      ),
  },
  {
    name: "鬼遁",
    meaning: "不意打ち、革新的なアイデア、クリエイティブ",
    source: S2,
    needs: ["天盤", "八門", "八神"],
    // 「杜門と天盤丁と九地が同宮、開門と天盤乙に九地、休門と天盤丁に九地」
    match: (input) =>
      scan(
        input,
        (p) =>
          (hasMen(p, "杜門") && tpStem(p) === "丁" && hasShen(p, "九地")) ||
          (hasMen(p, "開門") && tpStem(p) === "乙" && hasShen(p, "九地")) ||
          (hasMen(p, "休門") && tpStem(p) === "丁" && hasShen(p, "九地")),
      ),
  },
  {
    name: "風遁",
    meaning: "順調、スムーズ、放送、広報、広告などで良い結果をえる",
    source: S2,
    needs: ["天盤", "八門"],
    // 「休、開、生の三吉門と天盤乙が巽四宮に同宮」
    match: (input) =>
      scan(
        input,
        (p, palace) =>
          palace === 4 && hasAnyMen(p, SANKICHIMON) && tpStem(p) === "乙",
      ),
  },
  {
    name: "雲遁",
    meaning: "求雨、とりでを作る、権謀術数を用いて良い結果を得る",
    source: S2,
    needs: ["天盤", "八門"],
    // 「休、開、生の三吉門と天盤乙地盤辛が同宮　または天盤乙と開門が坤二宮に同宮」
    match: (input) =>
      scan(
        input,
        (p, palace) =>
          (hasAnyMen(p, SANKICHIMON) && tpStem(p) === "乙" && dpStem(p) === "辛") ||
          (palace === 2 && tpStem(p) === "乙" && hasMen(p, "開門")),
      ),
  },

  // --- 格局詳細３（吉格） ---------------------------------------------
  {
    name: "龍遁",
    meaning: "敵を逮捕、橋の修理、井戸を掘る、釣りやマリンスポーツ",
    source: S3,
    needs: ["天盤", "八門"],
    // スライド本文「休、開、生の三吉門に天盤乙と地盤癸が同宮、または坎一で同宮」を、
    // ユーザー確定仕様により次の2条件に確定:
    //   条件A: 休/開/生門 ＋ 天盤乙 ＋ 地盤癸 が同宮（任意の宮）
    //   条件B: 休/開/生門 ＋ 天盤乙 が坎一宮(1)で同宮（地盤癸は不要）
    match: (input) =>
      scan(
        input,
        (p, palace) =>
          (hasAnyMen(p, SANKICHIMON) && tpStem(p) === "乙" && dpStem(p) === "癸") ||
          (palace === 1 && hasAnyMen(p, SANKICHIMON) && tpStem(p) === "乙"),
      ),
  },
  {
    name: "虎遁",
    meaning: "駐屯地の建立、隠れる、リフォーム、力ずくで物事を運ぶに良い",
    source: S3,
    needs: ["天盤", "八門"],
    // スライド本文「休門または生門と天盤乙に地盤辛が同宮、または艮八で同宮」を、
    // ユーザー確定仕様により次の2条件に確定:
    //   条件A: 休門 or 生門 ＋ 天盤乙 ＋ 地盤辛 が同宮（任意の宮）
    //   条件B: 休門 ＋ 天盤乙 が艮八宮(8)で同宮（地盤辛は不要。条件Bは休門のみ）
    match: (input) =>
      scan(
        input,
        (p, palace) =>
          ((hasMen(p, "休門") || hasMen(p, "生門")) &&
            tpStem(p) === "乙" &&
            dpStem(p) === "辛") ||
          (palace === 8 && hasMen(p, "休門") && tpStem(p) === "乙"),
      ),
  },
  {
    name: "乙奇得使",
    meaning: "結婚、埋葬、就職、旅行、遷移、建築、購入、娯楽、試験、財にかかわる事",
    source: S3,
    needs: ["天盤"],
    // 「天盤乙が地盤己（甲戌）或いは辛（甲午）と同宮」
    match: (input) =>
      scan(
        input,
        (p) => tpStem(p) === "乙" && (dpStem(p) === "己" || dpStem(p) === "辛"),
      ),
  },
  {
    name: "丙奇得使",
    meaning: "治病、埋葬、就職、交易、借貸、訴訟、建築、買い物、求財と富",
    source: S3,
    needs: ["天盤"],
    // 「天盤丙が地盤戊（甲子）或いは庚（甲申）と同宮」
    match: (input) =>
      scan(
        input,
        (p) => tpStem(p) === "丙" && (dpStem(p) === "戊" || dpStem(p) === "庚"),
      ),
  },
  {
    name: "丁奇得使",
    meaning: "就職、埋葬、訪問、談合、交渉、建築、買い物、金に関係した競争事に強い",
    source: S3,
    needs: ["天盤"],
    // 「天盤丁が地盤壬（甲辰）或いは癸（甲寅）と同宮」
    match: (input) =>
      scan(
        input,
        (p) => tpStem(p) === "丁" && (dpStem(p) === "壬" || dpStem(p) === "癸"),
      ),
  },
  {
    name: "乙奇升殿",
    meaning: "旅行、就職、埋葬、遷移、建築、買い物",
    source: S3,
    needs: ["天盤"],
    // 「天盤乙が震三宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 3 && tpStem(p) === "乙"),
  },

  // --- 格局詳細４（吉格） ---------------------------------------------
  {
    name: "丙奇升殿",
    meaning: "就職、交易、借貸、訴訟、建築、買い物、遷移、男性の婚約、埋葬",
    source: S4,
    needs: ["天盤"],
    // 「天盤丙が離九宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 9 && tpStem(p) === "丙"),
  },
  {
    name: "丁奇升殿",
    meaning: "就職、埋葬、談合、交渉、遷移、建築、買い物、女性の婚約",
    source: S4,
    needs: ["天盤"],
    // 「天盤丁が兌七宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 7 && tpStem(p) === "丁"),
  },
  {
    name: "真詐",
    meaning: "施恩（恩を施す）、隠遯、求仙、祈祀（祭祀）に宜しい",
    source: S4,
    needs: ["天盤", "八門", "八神"],
    // 「開、休、生の三吉門と天盤乙、丙、丁の三奇が太陰の宮に同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasAnyMen(p, SANKICHIMON) && tpIsAny(p, SANKI) && hasShen(p, "太陰"),
      ),
  },
  {
    name: "重詐",
    meaning: "納財、官職を授ける、任職（就任）、添人口（出産）に宜しい",
    source: S4,
    needs: ["天盤", "八門", "八神"],
    // 「開、休、生の三吉門と天盤乙、丙、丁の三奇が九地の宮に同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasAnyMen(p, SANKICHIMON) && tpIsAny(p, SANKI) && hasShen(p, "九地"),
      ),
  },
  {
    name: "休詐",
    meaning: "医薬、祭祀に宜しい",
    source: S4,
    needs: ["天盤", "八門", "八神"],
    // 「開、休、生の三吉門と天盤乙、丙、丁の三奇が六合の宮に同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasAnyMen(p, SANKICHIMON) && tpIsAny(p, SANKI) && hasShen(p, "六合"),
      ),
  },

  // --- 格局詳細５（吉格）＝五假 -------------------------------------
  {
    name: "天假",
    meaning: "苦言を呈する、請求に良い",
    source: S5,
    needs: ["天盤", "八門", "八神"],
    // 「景門と天盤乙、丙、丁の三奇が九天と同宮」
    match: (input) =>
      scan(
        input,
        (p) => hasMen(p, "景門") && tpIsAny(p, SANKI) && hasShen(p, "九天"),
      ),
  },
  {
    name: "地假",
    meaning: "潜伏、偵察、避難、逃亡するのに良い",
    source: S5,
    needs: ["天盤", "八門", "八神"],
    // 「杜門と天盤丁、己、癸が九地、太陰或いは六合の宮に同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasMen(p, "杜門") &&
          tpIsAny(p, ["丁", "己", "癸"]) &&
          hasAnyShen(p, ["九地", "太陰", "六合"]),
      ),
  },
  {
    name: "人假",
    meaning: "逮捕、逃亡するのに宜しい。太白入焚とあえば必ず逃亡者を捕まえる。",
    source: S5,
    needs: ["天盤", "八門", "八神"],
    // 「驚門と天盤壬が九天の宮に同宮」
    match: (input) =>
      scan(
        input,
        (p) => hasMen(p, "驚門") && tpStem(p) === "壬" && hasShen(p, "九天"),
      ),
  },
  {
    name: "神假",
    meaning: "埋葬、埋蔵（倉庫）、祈祷、借金を取り立てる、逮捕する、交易",
    source: S5,
    needs: ["天盤", "八門", "八神"],
    // 「傷門と天盤丁、己、癸が九地或いは六合と同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasMen(p, "傷門") &&
          tpIsAny(p, ["丁", "己", "癸"]) &&
          hasAnyShen(p, ["九地", "六合"]),
      ),
  },
  {
    name: "鬼假",
    meaning: "亡霊の除霊、民をなだめる、破土、修墓、伐邪、狩猟",
    source: S5,
    needs: ["天盤", "八門", "八神"],
    // 「死門と天盤丁、己、癸が九地と同宮」
    match: (input) =>
      scan(
        input,
        (p) =>
          hasMen(p, "死門") &&
          tpIsAny(p, ["丁", "己", "癸"]) &&
          hasShen(p, "九地"),
      ),
  },
];

/**
 * 吉格判定: 完成した排盤（palaces）・旬首の六儀（liuyi）・人盤値使門の宮から、
 * 該当する吉格を返す。凶格・九星の吉凶・格局同士の優先順位は扱わない。
 */
export function resolveJikaku(input: JikakuInput): JikakuResult {
  const unavailable = new Set<Segment>();
  const matches: JikakuMatch[] = [];

  for (const rule of RULES) {
    const missing = rule.needs.filter((seg) => !segmentAvailable(seg, input));
    if (missing.length > 0) {
      for (const seg of missing) unavailable.add(seg);
      continue;
    }

    const palaces = Array.from(new Set(rule.match(input))).sort((a, b) => a - b);
    if (palaces.length > 0) {
      matches.push({
        name: rule.name,
        palaces,
        meaning: rule.meaning,
        source: rule.source,
      });
    }
  }

  return { matches, unavailable: Array.from(unavailable) };
}

/**
 * QimenResult（qimenEngine.calculate() の戻り値）から直接吉格判定を行う薄いラッパ。
 * qimenEngine 側は一切変更しない。
 */
export function resolveJikakuFromQimen(qimen: QimenResult): JikakuResult {
  return resolveJikaku({
    palaces: qimen.palaces,
    liuyi: qimen.xunShou.liuyi as DiPanStem,
    zhishiPalace: qimen.baMen?.zhishi.palace ?? null,
    xunShou: qimen.xunShou.xunShou,
    hourGanzhi: `${qimen.calendar.hourStem}${qimen.calendar.hourBranch}`,
  });
}

/** 参照用（描画・凶格実装などで使う想定）。本ファイル内の判定では未使用。 */
export { PALACE_TRIGRAM, SANKICHIMON, SANKI };
