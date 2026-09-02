// src/lib/qimen/kyokaku.ts
//
// 役割:
//   奇門遁甲「格局（凶格）」— 完成した排盤（各宮の 天盤干・地盤干・八門・八神・九星）と、
//   年干・月干・日干・時干支・陰陽遁・値符の宮から、該当する凶格を判定する。
//   吉格判定・九星単体の吉凶・格局同士の優先順位付けは行わない。
//
// jikaku.ts と別ファイルにした理由:
//   ・凶格は 吉格 と入力集合が異なる。歳格/月格/日格/悖格/五不遇時/時干入墓 は
//     年干・月干・日干・時干支を、伏吟格/反吟格 は陰陽遁と九星・八門・八神の定位を、
//     伏宮格/飛宮格/符勃格/飛悖格 は値符の宮を必要とする。
//     KyokakuInput にこれらを持たせると JikakuInput と別物になる。
//   ・jikaku.ts は既に確定済みの吉格判定であり、凶格追加のために触りたくない。
//   吉格・凶格を一括で扱いたい場合は、両モジュールを呼ぶ薄いラッパを別途用意する想定。
//
// 仕様の出典（唯一の根拠）:
//   docs/source/ に凶格の講義資料PDFが無いため、元Keynote「奇門遁甲講義案N.key」の
//   凶格スライド10枚の本文を直接デコードして確認したものを一次資料とする。
//     ・格局詳細（凶格１）Index/Slide-3952（青龍逃走・白虎猖狂・朱雀投江・騰蛇夭矯）
//     ・格局詳細（凶格２）Index/Slide-3999（熒入太白・太白入熒・大格・上格）
//     ・格局詳細（凶格３）Index/Slide-4046（刑格・奇格・歳格・月格・日格・時格）
//     ・格局詳細（凶格４）Index/Slide-4096（年悖格・月悖格・日悖格・時悖格・五不遇時）
//     ・格局詳細（凶格４続）Index/Slide-4143（五不遇時続き・時干入墓）
//     ・格局詳細（凶格５）Index/Slide-4190（伏干格＝日干格・飛干格・伏宮格天乙格・飛宮格天乙太白・戦格）
//     ・格局詳細（凶格６）Index/Slide-4239（符勃格・飛悖格・乙奇入墓・丙奇入墓・丁奇入墓）
//     ・格局詳細（凶格７）Index/Slide-4286（三奇受刑・六儀撃刑）
//     ・格局詳細（凶格８）Index/Slide-4333（伏吟格・反吟格・天網四張）
//     ・格局詳細（凶格９）Index/Slide-4380（地網遮蔽・門迫・宮迫）
//   docs/qimen-spec/12_格局（凶格）.md は補助資料。低解像度由来の誤り（例:「大格＝天盤庚が
//   地盤癸」「艮六宮」「五不遇時の対応表」等）を含むため採用しない。
//
// 各スライド本文の該当箇所（デコード原文、条件部分のみ）:
//   青龍逃走  天盤乙が地盤辛と同宮
//   白虎猖狂  天盤辛が地盤乙と同宮
//   朱雀投江  天盤丁が地盤癸と同宮
//   騰蛇夭矯  天盤癸が地丁と同宮
//   熒入太白  天盤丙が地盤庚と同宮
//   太白入熒  天盤庚が地盤丙と同宮
//   大格      天盤庚が地盤丙と同宮
//   上格      天盤庚が地盤壬と同宮
//   刑格      天盤庚が地盤己と同宮
//   奇格      天盤庚が地盤乙、丙、丁と同宮
//   歳格      天盤庚が地盤の年干に臨む
//   月格      天盤庚が地盤の月干に臨む
//   日格      天盤庚が地盤の日干に臨む　　別名（伏干格）
//   時格      天盤庚が地盤の時干に臨む　　別名（伏吟格）
//   年悖格    天盤丙奇が地盤の用事となる年干と同宮
//   月悖格    天盤丙奇が地盤の用事となる月干と同宮
//   日悖格    天盤丙奇が地盤の用事となる日干と同宮
//   時悖格    天盤丙奇が地盤の用事となる時干と同宮
//   五不遇時  用事の時干と日干が相剋。甲日庚午時、乙日辛巳時、丙日壬辰時、丁日癸卯時、
//             戊日甲寅時、己日乙丑時、庚日丙子時、辛日丁酉時、壬日戊申時、癸日己未時
//   時干入墓  丙戌時:天盤丙が乾六宮 / 壬辰時:天盤壬が巽四宮 / 癸未時:天盤癸が坤二宮 /
//             戊戌時:天盤戊が乾六宮 / 己丑時:天盤己が艮八宮 / 丁丑時:天盤丁が艮八宮
//   伏干格(日干格) 天盤の庚が地盤の日干に臨んで加わる
//   飛干格    天盤の日干が地盤の庚儀に臨んで加わる
//   伏宮格天乙格   天盤の庚が地盤の値符に臨む
//   飛宮格天乙太白 天盤の値符が地盤の庚に臨む
//   戦格      天盤庚と地盤庚の同宮
//   符勃格    天盤丙が地盤値符と同宮
//   飛悖格    天盤値符が地盤丙奇と同宮
//   乙奇入墓  天盤乙奇が坤二宮或いは乾六宮に臨む
//   丙奇入墓  天盤丙が乾六宮に臨む
//   丁奇入墓  天盤丁が艮宮（艮八宮）に臨む
//   三奇受刑  天盤乙が乾六宮または坤二宮に入宮／天盤丙が乾六宮に入宮／天盤丁が艮八宮に入宮
//   六儀撃刑  天盤戊が地盤震三宮／己が坤二宮／庚が艮八宮／辛が離九宮／壬が巽四宮／癸が巽四宮 に臨む
//   伏吟格    天盤九星・人盤八門が地盤定位から動かない（九星伏吟・値符伏吟・八門伏吟の三種）
//   反吟格    九星・八門・値符が相沖する地盤の定位（九星反吟・値符反吟・八門反吟の三種）
//   天網四張  天盤癸儀が地盤の用事となる時干に臨んで加わる
//   地網遮蔽  天盤壬が地盤の用事となる時干の宮に入宮
//   門迫      人盤八門が地盤九宮を剋す。休門が坤・艮宮、生死門が震巽宮、景門が坎宮、
//             開・驚門が離宮、傷・杜門が乾・兌宮
//   宮迫      地盤九宮が人盤八門を剋す。休門が離宮、死門が坎宮、傷・杜門が坤・艮宮、
//             開・驚門が震・巽宮、景門が乾・兌宮
//
// 推測しない範囲（TODO 参照）:
//   ・条件が本文どおり一致する別名格（太白入熒／大格、奇格の地盤丙、三奇受刑／各奇入墓 等）は
//     スライドの記載どおり別々の格として保持し、統合はしない。
//   ・六儀撃刑・時格の (甲子)(甲申)… や 六儀撃刑の旬注記、天網四張の高格／低格の区別は
//     本文に判定規則が無いため実装しない。
//   ・複数格が同時成立した場合の優先順位、吉格との相殺はスライドに記載が無いため付けない。

import type { QimenResult, PalaceSummary } from "./qimenEngine";
import type { Dun } from "./dingju";
import type { DiPanStem } from "./dipan";
import type { BaMenName } from "./bamen";

/**
 * 宮番号 → 後天八卦。
 * 既存確定モジュール（jiuxing.ts / bamen.ts / bashen.ts）のRINGコメント
 * 「巽4→離9→坤2→兌7→乾6→坎1→艮8→震3」および dipan.ts の LUOSHU_GRID から
 * 再掲したもの（本ファイルでの新規推測ではない）。
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

/**
 * 九星の定位（jiuxing.ts の STAR_NATAL_POSITION の再掲）。
 */
const STAR_NATAL: Record<number, string> = {
  1: "天蓬",
  2: "天芮",
  3: "天沖",
  4: "天輔",
  5: "天禽",
  6: "天心",
  7: "天柱",
  8: "天任",
  9: "天英",
};

/**
 * 八門の定位（bamen.ts の BAMEN_NATAL_POSITION の再掲。中宮5は無位）。
 */
const MEN_NATAL: Record<number, BaMenName> = {
  1: "休門",
  2: "死門",
  3: "傷門",
  4: "杜門",
  6: "開門",
  7: "驚門",
  8: "生門",
  9: "景門",
};

/** 洛書九宮の外周8宮を時計回りにたどった順（bashen.ts 等の RING の再掲）。 */
const RING: readonly number[] = [4, 9, 2, 7, 6, 1, 8, 3];
/** 中宮5を除く外周8宮。 */
const OUTER: readonly number[] = [1, 2, 3, 4, 6, 7, 8, 9];

/** 環上で相沖（正反対、+4宮）の宮を返す。 */
function opposite(palace: number): number {
  const i = RING.indexOf(palace);
  if (i < 0) throw new Error(`宮${palace}は外周環に含まれません`);
  return RING[(i + 4) % 8];
}

/**
 * 八神「直符」の定位。bashen.ts 本文より
 * 「陽遁は直符が坎一宮」「陰遁は直符が離九宮」。
 */
function shenZhifuNatalPalace(dun: Dun): number {
  return dun === "陽遁" ? 1 : 9;
}

/** 五不遇時: 日干 → 用事の時干支（Slide-4096 本文の対応表）。 */
const FIVE_NOT_MET: Record<string, string> = {
  "甲": "庚午",
  "乙": "辛巳",
  "丙": "壬辰",
  "丁": "癸卯",
  "戊": "甲寅",
  "己": "乙丑",
  "庚": "丙子",
  "辛": "丁酉",
  "壬": "戊申",
  "癸": "己未",
};

/** 時干入墓: 用事の時干支 → [天盤干, 宮]（Slide-4143 本文の対応表）。 */
const HOUR_TOMB: Record<string, { stem: DiPanStem; palace: number }> = {
  "丙戌": { stem: "丙", palace: 6 },
  "壬辰": { stem: "壬", palace: 4 },
  "癸未": { stem: "癸", palace: 2 },
  "戊戌": { stem: "戊", palace: 6 },
  "己丑": { stem: "己", palace: 8 },
  "丁丑": { stem: "丁", palace: 8 },
};

/** 六儀撃刑: 天盤儀 → 臨むと成立する地盤宮（Slide-4286 本文）。 */
const SIX_YI_XING: Record<string, number> = {
  "戊": 3,
  "己": 2,
  "庚": 8,
  "辛": 9,
  "壬": 4,
  "癸": 4,
};

/**
 * 門迫: 八門 → その門にとって「門迫」となる宮の集合（Slide-4380 本文どおり。
 * 五行の再導出はせず本文の列挙をそのまま用いる）。
 */
const MEN_HAKU: Record<BaMenName, readonly number[]> = {
  "休門": [2, 8],
  "生門": [3, 4],
  "死門": [3, 4],
  "景門": [1],
  "開門": [9],
  "驚門": [9],
  "傷門": [6, 7],
  "杜門": [6, 7],
};

/**
 * 宮迫: 八門 → その門にとって「宮迫」となる宮の集合（Slide-4380 本文どおり）。
 */
const KYU_HAKU: Partial<Record<BaMenName, readonly number[]>> = {
  "休門": [9],
  "死門": [1],
  "傷門": [2, 8],
  "杜門": [2, 8],
  "開門": [3, 4],
  "驚門": [3, 4],
  "景門": [6, 7],
};

/** 判定に必要な排盤の段。未算出ならその格はスキップし unavailable に記録する。 */
type Segment = "天盤" | "八門" | "八神" | "九星" | "値符";

export interface KyokakuInput {
  /** 九宮(1〜9) → 地盤干・天盤干・八門・八神・九星。 */
  palaces: Record<number, PalaceSummary>;
  /** 陰陽遁（伏吟格/反吟格の値符定位の判定用）。 */
  dun: Dun;
  /** 用事の年干。calendar.yearStem をそのまま渡す。 */
  yearStem: string;
  /** 用事の月干。calendar.monthStem をそのまま渡す。 */
  monthStem: string;
  /** 用事の日干。calendar.dayStem をそのまま渡す。 */
  dayStem: string;
  /** 用事の時干。calendar.hourStem をそのまま渡す。 */
  hourStem: string;
  /** 用事の時干支（例: "庚午"）。 */
  hourGanzhi: string;
  /** 値符（九星値符＝八神直符、通常は同一宮）の宮。九星・八神とも未算出なら null。 */
  zhifuPalace: number | null;
}

export interface KyokakuMatch {
  /** 凶格名（講義スライドの表記そのまま）。 */
  name: string;
  /** 成立した宮の番号（1〜9）。盤全体で成立する格（伏吟格・反吟格）は空配列。昇順。 */
  palaces: number[];
  /** 下位分類など（例: 六儀撃刑の「戊儀撃刑」、伏吟格の「九星伏吟・八門伏吟」）。 */
  detail?: string;
  /** 講義スライドに記載された象意・凶となる事柄（原文ママ）。 */
  meaning: string;
  /** 典拠スライド。 */
  source: string;
}

export interface KyokakuResult {
  /** 該当した凶格（スライドの記載順）。 */
  matches: KyokakuMatch[];
  /** 判定に必要だが未算出だった段。ここに載る段を必要とする格は判定していない。 */
  unavailable: Segment[];
}

// --- 宮ごとのアクセサ -----------------------------------------------------

function tp(p: PalaceSummary | undefined): DiPanStem | undefined {
  return p?.tianPanStem;
}
function dp(p: PalaceSummary | undefined): DiPanStem | undefined {
  return p?.diPanStem;
}
function hasStar(p: PalaceSummary | undefined, star: string): boolean {
  return !!p && p.jiuXing.includes(star as PalaceSummary["jiuXing"][number]);
}
function hasMen(p: PalaceSummary | undefined, men: BaMenName): boolean {
  return !!p && p.baMen.includes(men);
}
function hasZhifuShen(p: PalaceSummary | undefined): boolean {
  return !!p && p.baShen.includes("直符");
}

// --- 段の可用性チェック --------------------------------------------------

function segmentAvailable(seg: Segment, input: KyokakuInput): boolean {
  const list = Object.values(input.palaces);
  switch (seg) {
    case "天盤":
      return list.some((p) => p.tianPanStem !== undefined);
    case "八門":
      return list.some((p) => p.baMen.length > 0);
    case "八神":
      return list.some((p) => p.baShen.length > 0);
    case "九星":
      return list.some((p) => p.jiuXing.length > 0);
    case "値符":
      return input.zhifuPalace !== null;
  }
}

// --- 盤全体の伏吟／反吟の判定 ------------------------------------------

function jiuxingFuyin(palaces: Record<number, PalaceSummary>): boolean {
  return OUTER.every((p) => hasStar(palaces[p], STAR_NATAL[p]));
}
function jiuxingFanyin(palaces: Record<number, PalaceSummary>): boolean {
  return OUTER.every((p) => hasStar(palaces[p], STAR_NATAL[opposite(p)]));
}
function bamenFuyin(palaces: Record<number, PalaceSummary>): boolean {
  return OUTER.every((p) => hasMen(palaces[p], MEN_NATAL[p]));
}
function bamenFanyin(palaces: Record<number, PalaceSummary>): boolean {
  return OUTER.every((p) => hasMen(palaces[p], MEN_NATAL[opposite(p)]));
}
function zhifuFuyin(palaces: Record<number, PalaceSummary>, dun: Dun): boolean {
  return hasZhifuShen(palaces[shenZhifuNatalPalace(dun)]);
}
function zhifuFanyin(palaces: Record<number, PalaceSummary>, dun: Dun): boolean {
  return hasZhifuShen(palaces[opposite(shenZhifuNatalPalace(dun))]);
}

// --- 凶格ルール ---------------------------------------------------------

interface Rule {
  name: string;
  meaning: string;
  source: string;
  needs: readonly Segment[];
  /** 成立した宮番号を返す（宮を持たない格は [] を返し always=true のとき成立とみなす）。 */
  match: (input: KyokakuInput) => number[];
  /** true を返すと「盤全体で成立（palaces=[]）」として matches に載せる。 */
  board?: (input: KyokakuInput) => { hit: boolean; detail?: string };
  detail?: (input: KyokakuInput, palaces: number[]) => string | undefined;
}

function scan(
  input: KyokakuInput,
  pred: (p: PalaceSummary | undefined, palace: number, input: KyokakuInput) => boolean,
): number[] {
  const out: number[] = [];
  for (let palace = 1; palace <= 9; palace += 1) {
    if (pred(input.palaces[palace], palace, input)) out.push(palace);
  }
  return out;
}

const S1 = "格局詳細（凶格１） / Slide-3952";
const S2 = "格局詳細（凶格２） / Slide-3999";
const S3 = "格局詳細（凶格３） / Slide-4046";
const S4 = "格局詳細（凶格４） / Slide-4096・4143";
const S5 = "格局詳細（凶格５） / Slide-4190";
const S6 = "格局詳細（凶格６） / Slide-4239";
const S7 = "格局詳細（凶格７） / Slide-4286";
const S8 = "格局詳細（凶格８） / Slide-4333";
const S9 = "格局詳細（凶格９） / Slide-4380";

const RULES: readonly Rule[] = [
  // --- 凶格１ -------------------------------------------------------
  {
    name: "青龍逃走",
    meaning: "挙兵すれば主客ともに傷つく。商売では破財、百事の凶となる。",
    source: S1,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "乙" && dp(p) === "辛"),
  },
  {
    name: "白虎猖狂",
    meaning:
      "挙事（武装発起・暴動）すれば主客ともに傷つく驚恐のことがあり、遠行では災禍が多い、婚姻・修造は大凶",
    source: S1,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "辛" && dp(p) === "乙"),
  },
  {
    name: "朱雀投江",
    meaning:
      "文書に関係、音信が途絶え訴訟や口舌、或いは驚恐の怪異、奸謀や詭詐（偽り、嘘）、百事に凶",
    source: S1,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丁" && dp(p) === "癸"),
  },
  {
    name: "騰蛇夭矯",
    meaning:
      "百事に不利、いらぬことに驚き心理は安寧できず、文書（訴状）や訴訟がある。",
    source: S1,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "癸" && dp(p) === "丁"),
  },

  // --- 凶格２ -------------------------------------------------------
  {
    name: "熒入太白",
    meaning: "退避するのが良い。進撃は最悪",
    source: S2,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丙" && dp(p) === "庚"),
  },
  {
    name: "太白入熒",
    meaning: "客を利して主に不利。盗賊や強盗を防ぎ、固守するのが吉。",
    source: S2,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === "丙"),
  },
  {
    name: "大格",
    meaning:
      "百事が凶。求人は失敗し、商売は破財、出行して車は破れ馬は死ぬ。ただ犯罪者を逮捕するのに良い",
    source: S2,
    needs: ["天盤"],
    // 本文どおり「天盤庚が地盤丙」。太白入熒 と条件が一致する（TODO 参照）。
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === "丙"),
  },
  {
    name: "上格",
    meaning: "出行すれば道に迷い、求謀は得られず、破財や疾病。",
    source: S2,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === "壬"),
  },

  // --- 凶格３ -------------------------------------------------------
  {
    name: "刑格",
    meaning: "訴訟、受刑、商売の破財、出行しては病気になる",
    source: S3,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === "己"),
  },
  {
    name: "奇格",
    meaning: "出行、用兵は全て大凶。",
    source: S3,
    needs: ["天盤"],
    match: (i) =>
      scan(i, (p) => tp(p) === "庚" && (dp(p) === "乙" || dp(p) === "丙" || dp(p) === "丁")),
  },
  {
    name: "歳格",
    meaning:
      "この時、行軍、遠行、謀事はみな不利である。ただ盜賊を逮捕するか或いは行方不明者を捜索するのは良い",
    source: S3,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === i.yearStem),
  },
  {
    name: "月格",
    meaning:
      "この時、行軍、遠行、謀事はみな不利である。ただ盜賊を逮捕するか或いは行方不明者を捜索するのは良い",
    source: S3,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === i.monthStem),
  },
  {
    name: "日格",
    meaning:
      "この時、行軍、遠行、謀事はみな不利である。ただ盜賊を逮捕するか或いは行方不明者を捜索するのは良い",
    source: S3,
    needs: ["天盤"],
    // 本文「別名（伏干格）」。凶格５の「伏干格＝日干格」も条件が同一（天盤庚＋地盤日干）。
    detail: () => "別名: 伏干格・日干格",
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === i.dayStem),
  },
  {
    name: "時格",
    meaning:
      "この時、行軍、遠行、謀事はみな不利である。ただ盜賊を逮捕するか或いは行方不明者を捜索するのは良い",
    source: S3,
    needs: ["天盤"],
    // 本文「別名（伏吟格）」。凶格８の構造的な伏吟格とは別物（同名・TODO 参照）。
    detail: () => "別名: 伏吟格（凶格８の伏吟格とは別）",
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === i.hourStem),
  },

  // --- 凶格４ -------------------------------------------------------
  {
    name: "年悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丙" && dp(p) === i.yearStem),
  },
  {
    name: "月悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丙" && dp(p) === i.monthStem),
  },
  {
    name: "日悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丙" && dp(p) === i.dayStem),
  },
  {
    name: "時悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "丙" && dp(p) === i.hourStem),
  },
  {
    name: "五不遇時",
    meaning:
      "多くのことが手順どおり進まない。はかどらない。ただしすべて凶とは限らない",
    source: S4,
    needs: [],
    // 用事の時干と日干が相剋。日干 → 時干支 の対応表と一致するとき成立（盤に依らない）。
    match: () => [],
    board: (i) => ({ hit: FIVE_NOT_MET[i.dayStem] === i.hourGanzhi }),
  },
  {
    name: "時干入墓",
    meaning: "用いるべきではない。大凶となる。",
    source: S4,
    needs: ["天盤"],
    match: (i) => {
      const e = HOUR_TOMB[i.hourGanzhi];
      if (!e) return [];
      return tp(i.palaces[e.palace]) === e.stem ? [e.palace] : [];
    },
  },

  // --- 凶格５ -------------------------------------------------------
  {
    name: "伏干格",
    meaning:
      "主客みな傷つく。最も被害が甚大なのが主であり、不利であり大凶となる。",
    source: S5,
    needs: ["天盤"],
    // 「天盤の庚が地盤の日干に臨んで加わる」。本文「日干格」は同義。
    // 凶格３の「日格（別名 伏干格）」と条件が一致する（TODO 参照）。
    detail: () => "別名: 日干格",
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === i.dayStem),
  },
  {
    name: "飛干格",
    meaning: "大凶となり、主客は両者ともに傷つく。万事に不利である。",
    source: S5,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === i.dayStem && dp(p) === "庚"),
  },
  {
    name: "伏宮格天乙格",
    meaning:
      "大凶となり、主客はみな不利である。求人しても得られず、人を待っても来ない。出行しては路上で盜賊に遭遇する。または車は壊れ馬は死ぬ。百事が思うように行かない。",
    source: S5,
    needs: ["天盤", "値符"],
    // 「天盤の庚が地盤の値符に臨む」＝ 値符の宮の天盤干が庚。
    match: (i) =>
      i.zhifuPalace !== null && tp(i.palaces[i.zhifuPalace]) === "庚"
        ? [i.zhifuPalace]
        : [],
  },
  {
    name: "飛宮格天乙太白",
    meaning: "作戦は失敗し敗れ去る。大将は生け捕りにされ、商売したら破財する",
    source: S5,
    needs: ["天盤", "値符"],
    // 「天盤の値符が地盤の庚に臨む」＝ 値符の宮の地盤干が庚。
    match: (i) =>
      i.zhifuPalace !== null && dp(i.palaces[i.zhifuPalace]) === "庚"
        ? [i.zhifuPalace]
        : [],
  },
  {
    name: "戦格",
    meaning: "突然の災いや事故、命の危険、行き詰まり、損失",
    source: S5,
    needs: ["天盤"],
    match: (i) => scan(i, (p) => tp(p) === "庚" && dp(p) === "庚"),
  },

  // --- 凶格６ -------------------------------------------------------
  {
    name: "符勃格",
    meaning: "主に投降、悖逆（正しい道に背く）、大凶である。",
    source: S6,
    needs: ["天盤", "値符"],
    // 「天盤丙が地盤値符と同宮」＝ 値符の宮の天盤干が丙。
    match: (i) =>
      i.zhifuPalace !== null && tp(i.palaces[i.zhifuPalace]) === "丙"
        ? [i.zhifuPalace]
        : [],
  },
  {
    name: "飛悖格",
    meaning: "主に投降、悖逆、大凶",
    source: S6,
    needs: ["天盤", "値符"],
    // 「天盤値符が地盤丙奇と同宮」＝ 値符の宮の地盤干が丙。
    match: (i) =>
      i.zhifuPalace !== null && dp(i.palaces[i.zhifuPalace]) === "丙"
        ? [i.zhifuPalace]
        : [],
  },
  {
    name: "乙奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => scan(i, (p, palace) => tp(p) === "乙" && (palace === 2 || palace === 6)),
  },
  {
    name: "丙奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => scan(i, (p, palace) => tp(p) === "丙" && palace === 6),
  },
  {
    name: "丁奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => scan(i, (p, palace) => tp(p) === "丁" && palace === 8),
  },

  // --- 凶格７ -------------------------------------------------------
  {
    name: "三奇受刑",
    meaning: "行動すべきではない。さもなくば大凶",
    source: S7,
    needs: ["天盤"],
    match: (i) =>
      scan(
        i,
        (p, palace) =>
          (tp(p) === "乙" && (palace === 6 || palace === 2)) ||
          (tp(p) === "丙" && palace === 6) ||
          (tp(p) === "丁" && palace === 8),
      ),
  },
  {
    name: "六儀撃刑",
    meaning:
      "極凶である。動けば必ず災や傷を負う。もし天網四張格に遭えば、必ず逮捕され投獄される災いの象意",
    source: S7,
    needs: ["天盤"],
    match: (i) =>
      scan(i, (p, palace) => {
        const s = tp(p);
        return s !== undefined && SIX_YI_XING[s] === palace;
      }),
    detail: (i, palaces) => {
      const label: Record<string, string> = {
        "戊": "戊儀撃刑",
        "己": "己儀撃刑",
        "庚": "庚儀撃刑",
        "辛": "辛儀撃刑",
        "壬": "壬儀撃刑",
        "癸": "癸儀撃刑",
      };
      const hit = palaces
        .map((pl) => tp(i.palaces[pl]))
        .filter((s): s is DiPanStem => s !== undefined)
        .map((s) => label[s]);
      return hit.length > 0 ? Array.from(new Set(hit)).join("・") : undefined;
    },
  },

  // --- 凶格８ -------------------------------------------------------
  {
    name: "伏吟格",
    meaning: "用兵は凶、財貨を収束させるのに良い",
    source: S8,
    needs: [],
    match: () => [],
    board: (i) => {
      const v: string[] = [];
      if (segmentAvailable("九星", i) && jiuxingFuyin(i.palaces)) v.push("九星伏吟");
      // 値符伏吟: 八神「直符」が定位（陽遁=坎一/陰遁=離九）にあること。
      // 「値符」を八神直符と解釈している（TODO 参照）。
      if (segmentAvailable("八神", i) && zhifuFuyin(i.palaces, i.dun)) v.push("値符伏吟");
      if (segmentAvailable("八門", i) && bamenFuyin(i.palaces)) v.push("八門伏吟");
      return { hit: v.length > 0, detail: v.join("・") };
    },
  },
  {
    name: "反吟格",
    meaning:
      "出行すれば目的は中途半端で終わる。大事をしようと始めても終わりがない泥沼。長患いし回復の見込みなし。結婚は成立せず、求財は損をして悔しい思いをする。",
    source: S8,
    needs: [],
    match: () => [],
    board: (i) => {
      const v: string[] = [];
      if (segmentAvailable("九星", i) && jiuxingFanyin(i.palaces)) v.push("九星反吟");
      // 値符反吟: 八神「直符」が定位の相沖宮にあること（TODO 参照）。
      if (segmentAvailable("八神", i) && zhifuFanyin(i.palaces, i.dun)) v.push("値符反吟");
      if (segmentAvailable("八門", i) && bamenFanyin(i.palaces)) v.push("八門反吟");
      return { hit: v.length > 0, detail: v.join("・") };
    },
  },
  {
    name: "天網四張",
    meaning:
      "天網高格は作用を起こさない。妨げにはならず。天網が低格ならばはって進むことができる。（高格／低格の区別は本文に規則が無く未判定）",
    source: S8,
    needs: ["天盤"],
    // 「天盤癸儀が地盤の用事となる時干に臨んで加わる」
    match: (i) => scan(i, (p) => tp(p) === "癸" && dp(p) === i.hourStem),
  },

  // --- 凶格９ -------------------------------------------------------
  {
    name: "地網遮蔽",
    meaning: "出兵、出行は宜しからざる。",
    source: S9,
    needs: ["天盤"],
    // 「天盤壬が地盤の用事となる時干の宮に入宮」
    match: (i) => scan(i, (p) => tp(p) === "壬" && dp(p) === i.hourStem),
  },
  {
    name: "門迫",
    meaning: "凶が迫ってきて、主には特に凶である。",
    source: S9,
    needs: ["八門"],
    match: (i) =>
      scan(i, (p, palace) => {
        if (!p) return false;
        return p.baMen.some((m) => (MEN_HAKU[m] ?? []).includes(palace));
      }),
    detail: (i, palaces) => {
      const hit: string[] = [];
      for (const pl of palaces) {
        for (const m of i.palaces[pl]?.baMen ?? []) {
          if ((MEN_HAKU[m] ?? []).includes(pl)) hit.push(`${m}@${pl}宮`);
        }
      }
      return hit.length > 0 ? hit.join("・") : undefined;
    },
  },
  {
    name: "宮迫",
    meaning: "吉は迫ってきて、凶とはならず",
    source: S9,
    needs: ["八門"],
    match: (i) =>
      scan(i, (p, palace) => {
        if (!p) return false;
        return p.baMen.some((m) => (KYU_HAKU[m] ?? []).includes(palace));
      }),
    detail: (i, palaces) => {
      const hit: string[] = [];
      for (const pl of palaces) {
        for (const m of i.palaces[pl]?.baMen ?? []) {
          if ((KYU_HAKU[m] ?? []).includes(pl)) hit.push(`${m}@${pl}宮`);
        }
      }
      return hit.length > 0 ? hit.join("・") : undefined;
    },
  },
];

/**
 * 凶格判定: 完成した排盤・年月日時干・陰陽遁・値符の宮から、該当する凶格を返す。
 * 吉格・九星単体の吉凶・格局同士の優先順位は扱わない。
 */
export function resolveKyokaku(input: KyokakuInput): KyokakuResult {
  const unavailable = new Set<Segment>();
  const matches: KyokakuMatch[] = [];

  for (const rule of RULES) {
    const missing = rule.needs.filter((seg) => !segmentAvailable(seg, input));
    if (missing.length > 0) {
      for (const seg of missing) unavailable.add(seg);
      continue;
    }

    if (rule.board) {
      const { hit, detail } = rule.board(input);
      if (hit) {
        matches.push({
          name: rule.name,
          palaces: [],
          detail: detail && detail.length > 0 ? detail : undefined,
          meaning: rule.meaning,
          source: rule.source,
        });
      }
      continue;
    }

    const palaces = Array.from(new Set(rule.match(input))).sort((a, b) => a - b);
    if (palaces.length > 0) {
      matches.push({
        name: rule.name,
        palaces,
        detail: rule.detail?.(input, palaces),
        meaning: rule.meaning,
        source: rule.source,
      });
    }
  }

  return { matches, unavailable: Array.from(unavailable) };
}

/**
 * QimenResult（qimenEngine.calculate() の戻り値）から直接凶格判定を行う薄いラッパ。
 * qimenEngine 側は一切変更しない。
 * 値符の宮は 九星値符 を優先し、無ければ 八神直符 を用いる（両者は通常同一宮）。
 */
export function resolveKyokakuFromQimen(qimen: QimenResult): KyokakuResult {
  return resolveKyokaku({
    palaces: qimen.palaces,
    dun: qimen.dingju.dun,
    yearStem: qimen.calendar.yearStem,
    monthStem: qimen.calendar.monthStem,
    dayStem: qimen.calendar.dayStem,
    hourStem: qimen.calendar.hourStem,
    hourGanzhi: `${qimen.calendar.hourStem}${qimen.calendar.hourBranch}`,
    zhifuPalace: qimen.jiuXing?.zhifu.palace ?? qimen.baShen?.zhifu.palace ?? null,
  });
}

/** 参照用（描画・他モジュールで使う想定）。本ファイル内の判定では PALACE_TRIGRAM は未使用。 */
export { PALACE_TRIGRAM };
