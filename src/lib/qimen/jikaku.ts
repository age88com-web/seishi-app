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
//             → 監修確定: 値使門の宮の地盤に丁がある（坤二宮へ寄宮した地盤丁を含む）。
//               旬ごとの時干支の表は独立した追加条件として掛けない。
//   天遁      生門に天盤丙と地盤丁が同宮　または生門と天盤丙、地盤戊が同宮
//   地遁      開門と天盤乙と地盤己が同宮
//   人遁      休門と天盤丁に太陰が同宮
//   神遁      生門と天盤丙と九天が同宮
//   鬼遁      杜門と天盤丁と九地が同宮、開門と天盤乙に九地、休門と天盤丁に九地
//   風遁      休、開、生の三吉門と天盤乙が巽四宮に同宮
//   雲遁      休、開、生の三吉門と天盤乙地盤辛が同宮　または天盤乙と開門が坤二宮に同宮
//   龍遁      休、開、生の三吉門に天盤乙と地盤癸が同宮、または坎一で同宮
//   虎遁      休門または生門と天盤乙に地盤辛が同宮、または艮八で同宮
//             → 監修確定: docs/source/虎遁、龍遁.png（表 No.13）本文により「休門」のみ（生門は採用しない）
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
// 監修確定事項（2026-10-06）:
//   ・中宮の寄宮: 吉格も外周8宮のみで判定し、中宮5を独立した宮として判定しない。寄宮後の有効配置
//     （effectivePalaces.ts。坤二宮の地盤に中宮干、芮禽宮の天盤に中宮由来の干）を使い、干の条件は
//     「その宮の天盤干（地盤干）のいずれかが該当する」で判定する。
//   ・青龍返首: 「天盤の旬首六儀」は作盤上、時干の宮へ実際に転動された天盤干（tianpan.ts の回転で
//     置かれた干＝tianPanStems[0]）に限る。旬首六儀が中宮にある場合に天禽とともに芮禽宮へ寄宮した
//     中宮干は、青龍返首の天盤六儀としては扱わない（青龍返首の定義上の扱い。地盤丙は坤の寄宮干を含む）。
//   ・虎遁: docs/source/虎遁、龍遁.png（表 No.13）本文
//     「休門と天盤乙奇が地盤辛儀に臨む。或いは艮八宮に臨む」を正式根拠とし、
//     休門＋天盤乙＋（地盤辛 または 艮八宮）とする。講義PDF p49 の「生門」は採用しない。
//   ・龍遁: docs/source/虎遁、龍遁.png（表 No.12）の注記『御定奇門寶鑑』「休、開、生三吉門と天盤乙奇が地盤癸に臨む。或いは、
//     休、開、生三吉門と天盤乙奇が坎一宮に臨む」を正式仕様として維持する。1080.pdf は
//     「休門＋天盤乙＋（地盤癸 または 坎一宮）」で一致する（既知の定義差。tests/qimen_jikaku.manual.ts）。
//   ・玉女守門: 正式条件は「値使門の宮の地盤に丁がある」（『奇門寶鑑御定』系の条件「地盤六丁守直使之門」）。
//     坤二宮へ寄宮した地盤丁を含む。旬ごとの時干支の表（旧実装の旬条件）は独立した追加条件として
//     掛けない。1080.pdf と宮単位 136/0/0 で完全一致（tests/qimen_jikaku.manual.ts）。
//   ・五假: docs/source/五か.png（表 No.23〜27）＝講義PDF p51 ＝
//     本実装の定義を正式仕様として維持する。1080.pdf の五假ラベルは7件のみで別体系または限定的掲載の
//     可能性があり、合わせて変更しない。1080.pdf の「物假」と鬼假の対応は未確定。
//
// 推測しない範囲（TODO 参照）:
//   ・複数の吉格が同時成立した場合の優先順位はスライドに記載が無いため付けない。

import type { QimenResult } from "./qimenEngine";
import type { EffectivePalace } from "./effectivePalaces";
import { OUTER_PALACES } from "./effectivePalaces";
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
  /**
   * 寄宮後の有効配置（外周8宮のみ。effectivePalaces.ts）。坤二宮・芮禽宮は複数干を持ちうる。
   * 九星は吉格判定に使用しない。
   */
  palaces: Record<number, EffectivePalace>;
  /** 用事の時干支の六儀（旬首）。xunShou.liuyi をそのまま渡す。 */
  liuyi: DiPanStem;
  /** 人盤の値使門が配置された宮（玉女守門の判定用）。八門が未算出なら null。 */
  zhishiPalace: number | null;
}

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

/** 天盤干のいずれかが stem か（芮禽宮では中宮由来の天盤干を含む）。 */
function tp(p: EffectivePalace | undefined, stem: string): boolean {
  return !!p && p.tianPanStems.some((s) => s === stem);
}
/** 地盤干のいずれかが stem か（坤二宮では中宮から寄宮した地盤干を含む）。 */
function dp(p: EffectivePalace | undefined, stem: string): boolean {
  return !!p && p.diPanStems.some((s) => s === stem);
}
/** 作盤上その宮へ転動された天盤干（寄宮した中宮由来の干を除く）。青龍返首で使う。 */
function rotatedTianPan(p: EffectivePalace | undefined): DiPanStem | undefined {
  return p?.tianPanStems[0];
}
function hasMen(p: EffectivePalace | undefined, men: BaMenName): boolean {
  return !!p && p.baMen.includes(men);
}
function hasAnyMen(p: EffectivePalace | undefined, list: readonly BaMenName[]): boolean {
  return !!p && list.some((m) => p.baMen.includes(m));
}
function hasShen(p: EffectivePalace | undefined, shen: BaShenName): boolean {
  return !!p && p.baShen.includes(shen);
}
function hasAnyShen(p: EffectivePalace | undefined, list: readonly BaShenName[]): boolean {
  return !!p && list.some((s) => p.baShen.includes(s));
}
function tpIsAny(p: EffectivePalace | undefined, list: readonly DiPanStem[]): boolean {
  return !!p && p.tianPanStems.some((s) => list.includes(s));
}

// --- 段の可用性チェック ----------------------------------------------------

function segmentAvailable(seg: Segment, input: JikakuInput): boolean {
  const list = Object.values(input.palaces);
  switch (seg) {
    case "天盤":
      return list.some((p) => p.tianPanStems.length > 0);
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

/** 外周8宮を走査し、述語が真の宮番号を返す（中宮5は独立した宮として判定しない）。 */
function scan(
  input: JikakuInput,
  pred: (p: EffectivePalace | undefined, palace: number, input: JikakuInput) => boolean,
): number[] {
  const out: number[] = [];
  for (const palace of OUTER_PALACES) {
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
    // 監修確定（2026-10-06）: 天盤の旬首六儀は、時干の宮へ実際に転動された天盤干に限る。
    // 芮禽宮へ寄宮した中宮由来の干は使わない。地盤丙は坤二宮の寄宮干を含む。
    match: (input) =>
      scan(input, (p) => rotatedTianPan(p) === input.liuyi && dp(p, "丙")),
  },
  {
    name: "飛鳥跌穴",
    meaning: "就職、訴訟、遷移、求財、建築、婚姻、百事皆吉",
    source: S1,
    needs: ["天盤"],
    // 「天盤丙と用事の時干支の六儀（旬首）となる地盤が同宮」
    match: (input) =>
      scan(input, (p) => tp(p, "丙") && dp(p, input.liuyi)),
  },
  {
    name: "玉女守門",
    meaning: "宴会、喜び事、女性の結婚",
    source: S1,
    needs: ["人盤値使門"],
    // 「値使門の宮の地盤に丁がある」（坤二宮へ寄宮した地盤丁を含む。監修確定 2026-10-06）。
    // 旬ごとの時干支の表は追加条件として掛けない。
    match: (input) => {
      const zp = input.zhishiPalace;
      if (zp === null) return [];
      return dp(input.palaces[zp], "丁") ? [zp] : [];
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
          tp(p, "丙") &&
          (dp(p, "丁") || dp(p, "戊")),
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
        (p) => hasMen(p, "開門") && tp(p, "乙") && dp(p, "己"),
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
        (p) => hasMen(p, "休門") && tp(p, "丁") && hasShen(p, "太陰"),
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
        (p) => hasMen(p, "生門") && tp(p, "丙") && hasShen(p, "九天"),
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
          (hasMen(p, "杜門") && tp(p, "丁") && hasShen(p, "九地")) ||
          (hasMen(p, "開門") && tp(p, "乙") && hasShen(p, "九地")) ||
          (hasMen(p, "休門") && tp(p, "丁") && hasShen(p, "九地")),
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
          palace === 4 && hasAnyMen(p, SANKICHIMON) && tp(p, "乙"),
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
          (hasAnyMen(p, SANKICHIMON) && tp(p, "乙") && dp(p, "辛")) ||
          (palace === 2 && tp(p, "乙") && hasMen(p, "開門")),
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
          (hasAnyMen(p, SANKICHIMON) && tp(p, "乙") && dp(p, "癸")) ||
          (palace === 1 && hasAnyMen(p, SANKICHIMON) && tp(p, "乙")),
      ),
  },
  {
    name: "虎遁",
    meaning: "駐屯地の建立、隠れる、リフォーム、力ずくで物事を運ぶに良い",
    source: S3,
    needs: ["天盤", "八門"],
    // 監修確定（2026-10-06）: docs/source/虎遁、龍遁.png（表 No.13）本文
    // 「休門と天盤乙奇が地盤辛儀に臨む。或いは艮八宮に臨む」により、休門のみ（講義PDF p49 の生門は不採用）:
    //   条件A: 休門 ＋ 天盤乙 ＋ 地盤辛 が同宮（任意の宮）
    //   条件B: 休門 ＋ 天盤乙 が艮八宮(8)で同宮（地盤辛は不要）
    match: (input) =>
      scan(
        input,
        (p, palace) =>
          (hasMen(p, "休門") && tp(p, "乙") && dp(p, "辛")) ||
          (palace === 8 && hasMen(p, "休門") && tp(p, "乙")),
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
        (p) => tp(p, "乙") && (dp(p, "己") || dp(p, "辛")),
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
        (p) => tp(p, "丙") && (dp(p, "戊") || dp(p, "庚")),
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
        (p) => tp(p, "丁") && (dp(p, "壬") || dp(p, "癸")),
      ),
  },
  {
    name: "乙奇升殿",
    meaning: "旅行、就職、埋葬、遷移、建築、買い物",
    source: S3,
    needs: ["天盤"],
    // 「天盤乙が震三宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 3 && tp(p, "乙")),
  },

  // --- 格局詳細４（吉格） ---------------------------------------------
  {
    name: "丙奇升殿",
    meaning: "就職、交易、借貸、訴訟、建築、買い物、遷移、男性の婚約、埋葬",
    source: S4,
    needs: ["天盤"],
    // 「天盤丙が離九宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 9 && tp(p, "丙")),
  },
  {
    name: "丁奇升殿",
    meaning: "就職、埋葬、談合、交渉、遷移、建築、買い物、女性の婚約",
    source: S4,
    needs: ["天盤"],
    // 「天盤丁が兌七宮に入宮」
    match: (input) => scan(input, (p, palace) => palace === 7 && tp(p, "丁")),
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
        (p) => hasMen(p, "驚門") && tp(p, "壬") && hasShen(p, "九天"),
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
 * 寄宮後の有効配置（effectivePalaces）で判定する。
 */
export function resolveJikakuFromQimen(qimen: QimenResult): JikakuResult {
  return resolveJikaku({
    palaces: qimen.effectivePalaces.palaces,
    liuyi: qimen.xunShou.liuyi as DiPanStem,
    zhishiPalace: qimen.baMen?.zhishi.palace ?? null,
  });
}

/** 参照用（描画・凶格実装などで使う想定）。本ファイル内の判定では未使用。 */
export { PALACE_TRIGRAM, SANKICHIMON, SANKI };
