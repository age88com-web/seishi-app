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
//     符勃格/飛悖格 は値符の宮を、伏宮格/飛宮格 は旬首六儀を必要とする。
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
//   docs/qimen-spec/12_格局（凶格）.md は補助資料。低解像度由来の誤り（例:「艮六宮」
//   「五不遇時の対応表」等）を含むため採用しない。
//   ただし大格は、講義案Nの「天盤庚が地盤丙」（太白入熒と同条件）を訂正し、剋應（庚×癸の注記
//   「大格：天盤庚儀が地盤癸に臨んで加わる」）・1080.pdf・旧仕様書の「天盤庚が地盤癸」を採用する
//   （中宮寄宮 Phase 3J-2・2026-10-16・ユーザー承認）。
//
// 各スライド本文の該当箇所（デコード原文、条件部分のみ）:
//   青龍逃走  天盤乙が地盤辛と同宮
//   白虎猖狂  天盤辛が地盤乙と同宮
//   朱雀投江  天盤丁が地盤癸と同宮
//   騰蛇夭矯  天盤癸が地丁と同宮
//   熒入太白  天盤丙が地盤庚と同宮
//   太白入熒  天盤庚が地盤丙と同宮
//   大格      天盤庚が地盤丙と同宮 → 天盤庚が地盤癸と同宮に訂正（Phase 3J-2）
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
//   伏宮格天乙格   天盤の庚が地盤の値符に臨む（地盤の値符＝地盤の旬首六儀。講義案 p.32・Phase 3J-2）
//   飛宮格天乙太白 天盤の値符が地盤の庚に臨む（天盤の値符＝天盤の旬首六儀。Phase 3J-2）
//   戦格      天盤庚と地盤庚の同宮
//   符勃格    天盤丙が地盤値符と同宮 → 天盤丙が値符の九星と同宮（Phase 3L。凶格例.pdf 192〜193頁）
//   飛悖格    天盤値符が地盤丙奇と同宮 → 地盤丙が値符の九星と同宮（Phase 3L。凶格例.pdf 194頁）
//             （旧仕様の「旬首が甲申の時のみ」は凶格例.pdf の実例（甲戌旬・甲辰旬）と矛盾するため撤廃）
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
//             開・驚門が震・巽宮、景門が乾・兌宮（本文に生門の記載なし）
//
//   【方針】門迫／宮迫は Slide-4380（講義案N.pdf 61頁）の記載を仕様として採用する。
//   docs/source/1080.pdf 全1080局の実例照合では、この2格の名称・対応が本文と入れ替わって
//   見える形（門迫1560件が本文の宮迫と、宮迫1560件が本文の門迫と、生門→坎一宮1件を除いて
//   一致）を示しており、一時的に1080.pdf側に合わせて本表を書き換えたことがあるが、
//   本プロジェクトは「講義テキスト＝仕様、1080.pdf＝検証資料」を優先原則とするため、
//   最終的に講義案N.pdf 61頁の原文どおりに戻した（1080.pdf側の実例体系とは異なる状態を
//   意図的に維持している。1080.pdf基準へ再度合わせないこと）。
//
// 推測しない範囲（TODO 参照）:
//   ・条件が本文どおり一致する別名格（奇格の地盤丙、三奇受刑／各奇入墓 等）は
//     スライドの記載どおり別々の格として保持し、統合はしない。
//   ・六儀撃刑・時格の (甲子)(甲申)… や 六儀撃刑の旬注記は本文に判定規則が無いため実装しない。
//   ・天網四張の高格／低格（低格＝坎1・坤2・震3・巽4宮、高格＝中5・乾6・兌7・艮8・離9宮）は
//     講義案N.pdfの本文には無く、追加資料により確定した区分を detail 表示にのみ用いる
//     （成立条件自体は追加資料でも変更なし）。
//   ・複数格が同時成立した場合の優先順位、吉格との相殺はスライドに記載が無いため付けない。

import type { QimenResult, PalaceSummary } from "./qimenEngine";
import {
  judgedPalaces,
  stemPairs,
  tianPanStems,
  diPanStems,
  roleStems,
  BASIC_PAIR_POLICY,
  FUGONG_POLICY,
  KAKU_SCAN_POLICY,
  XUNSHOU_ROLE_POLICY,
} from "./stemAccess";
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
 * 門迫: 八門 → その門にとって「門迫」となる宮の集合（Slide-4380＝講義案N.pdf 61頁の
 * 本文どおり。1080.pdfの実例体系とは異なるが、本プロジェクトは講義テキストを仕様として
 * 優先するため、この対応表を仕様とする。1080.pdf側に再び合わせて変更しないこと）。
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
 * 宮迫: 八門 → その門にとって「宮迫」となる宮の集合（Slide-4380＝講義案N.pdf 61頁の
 * 本文どおり。本文に生門の記載が無いため、生門は含めない＝推測で補わない）。
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
  /** 用事の時干支の旬首（例: "甲申"）。xunShou.xunShou をそのまま渡す（現在は判定に使っていない。符勃格・飛悖格の甲申旬限定は Phase 3L で撤廃）。 */
  xunShou: string;
  /** 用事の時干支の旬首六儀（例: "庚"）。xunShou.liuyi をそのまま渡す（伏宮格・飛宮格の値符用）。 */
  liuyi: DiPanStem;
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

/**
 * 判定対象の宮を走査し、述語が真の宮番号を返す。
 * 中五宮は独立した成立宮にしない（講義案 p.10「中五は無位で坤二に寄宮する」。
 * stemAccess.ts の KAKU_SCAN_POLICY）。中五宮の干のデータ自体は削除しない。
 */
function scan(
  input: KyokakuInput,
  pred: (p: PalaceSummary | undefined, palace: number, input: KyokakuInput) => boolean,
): number[] {
  return judgedPalaces(KAKU_SCAN_POLICY).filter((palace) => pred(input.palaces[palace], palace, input));
}

/**
 * 天盤干×地盤干の組み合わせだけで成立する格局の判定。寄宮干も含めて判定する
 * （stemAccess.ts の BASIC_PAIR_POLICY）。適用する格局:
 *   ・中宮寄宮 Phase 3A（2026-10-16）: 青龍逃走・白虎猖狂・朱雀投江・騰蛇夭矯・熒入太白・太白入熒
 *   ・中宮寄宮 Phase 3B（2026-10-16）: 刑格
 *   ・中宮寄宮 Phase 3C（2026-10-16）: 上格・奇格・戦格
 *   ・通常天盤干×通常地盤干／通常天盤干×地盤寄宮干（坤二宮）／天盤寄宮干（芮禽宮）×通常地盤干
 *   ・天盤寄宮干×地盤寄宮干（どちらも中五宮の干）は判定しない。中五宮は成立宮にしない。
 *     戦格（庚×庚）でも、中五宮の庚どうしを坤二宮・芮禽宮へ移して成立させることはない。
 * di に複数の干を渡した場合は、そのいずれかと同宮すれば成立（奇格の地盤乙・丙・丁）。
 */
function pairScan(input: KyokakuInput, tian: DiPanStem, di: DiPanStem | readonly DiPanStem[]): number[] {
  const dis: readonly DiPanStem[] = typeof di === "string" ? [di] : di;
  return judgedPalaces(BASIC_PAIR_POLICY).filter(
    (palace) =>
      stemPairs(input.palaces[palace], (t, d) => t === tian && dis.includes(d), BASIC_PAIR_POLICY).length > 0,
  );
}

/**
 * 天盤干と宮だけで成立する格局の判定（中宮寄宮 Phase 3I・2026-10-16）。適用する格局:
 *   乙奇入墓・丙奇入墓・丁奇入墓・三奇受刑・六儀撃刑。
 *   年・月・日・時悖格（Phase 4C）も、天盤丙の側だけこの関数で寄宮干を含め、地盤の用事の干は通常干で見る。
 *   ・天盤干は芮禽同居宮の寄宮干（天禽が帯同する中五宮の干）も含める（BASIC_PAIR_POLICY の天盤側）。
 *   ・地盤干は条件に含まないため、地盤寄宮干は参照しない。
 *   ・宮番号・刑・入墓の条件は講義案Nのまま変えない。中五宮は成立宮にしない。
 */
function tianScan(input: KyokakuInput, pred: (tian: DiPanStem, palace: number) => boolean): number[] {
  return judgedPalaces(BASIC_PAIR_POLICY).filter((palace) =>
    tianPanStems(input.palaces[palace], BASIC_PAIR_POLICY).some((e) => pred(e.stem, palace)),
  );
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
    match: (i) => pairScan(i, "乙", "辛"),
  },
  {
    name: "白虎猖狂",
    meaning:
      "挙事（武装発起・暴動）すれば主客ともに傷つく驚恐のことがあり、遠行では災禍が多い、婚姻・修造は大凶",
    source: S1,
    needs: ["天盤"],
    match: (i) => pairScan(i, "辛", "乙"),
  },
  {
    name: "朱雀投江",
    meaning:
      "文書に関係、音信が途絶え訴訟や口舌、或いは驚恐の怪異、奸謀や詭詐（偽り、嘘）、百事に凶",
    source: S1,
    needs: ["天盤"],
    match: (i) => pairScan(i, "丁", "癸"),
  },
  {
    name: "騰蛇夭矯",
    meaning:
      "百事に不利、いらぬことに驚き心理は安寧できず、文書（訴状）や訴訟がある。",
    source: S1,
    needs: ["天盤"],
    match: (i) => pairScan(i, "癸", "丁"),
  },

  // --- 凶格２ -------------------------------------------------------
  {
    name: "熒入太白",
    meaning: "退避するのが良い。進撃は最悪",
    source: S2,
    needs: ["天盤"],
    match: (i) => pairScan(i, "丙", "庚"),
  },
  {
    name: "太白入熒",
    meaning: "客を利して主に不利。盗賊や強盗を防ぎ、固守するのが吉。",
    source: S2,
    needs: ["天盤"],
    match: (i) => pairScan(i, "庚", "丙"),
  },
  {
    name: "大格",
    meaning:
      "百事が凶。求人は失敗し、商売は破財、出行して車は破れ馬は死ぬ。ただ犯罪者を逮捕するのに良い",
    source: S2,
    needs: ["天盤"],
    // 「天盤庚が地盤癸」（講義案Nの「地盤丙」を訂正。剋應の注記・1080.pdf・旧仕様書。Phase 3J-2）。
    // 寄宮干を含めて判定（BASIC_PAIR_POLICY）。寄宮干どうしは除外・中五宮は成立宮にしない。
    match: (i) => pairScan(i, "庚", "癸"),
  },
  {
    name: "上格",
    meaning: "出行すれば道に迷い、求謀は得られず、破財や疾病。",
    source: S2,
    needs: ["天盤"],
    // 1080.pdf では同じ条件（天盤庚＋地盤壬）を「小格」と表記する。名称は講義案Nのまま。
    match: (i) => pairScan(i, "庚", "壬"),
  },

  // --- 凶格３ -------------------------------------------------------
  {
    name: "刑格",
    meaning: "訴訟、受刑、商売の破財、出行しては病気になる",
    source: S3,
    needs: ["天盤"],
    match: (i) => pairScan(i, "庚", "己"),
  },
  {
    name: "奇格",
    meaning: "出行、用兵は全て大凶。",
    source: S3,
    needs: ["天盤"],
    match: (i) => pairScan(i, "庚", ["乙", "丙", "丁"]),
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
  // 年・月・日・時悖格（中宮寄宮 Phase 4C・2026-10-16）: 天盤丙は芮禽同居宮の天盤寄宮干（天禽が帯同する
  // 中五宮の干）も含める（tianScan）。地盤の用事の干は通常干のみ（坤二宮の地盤寄宮干は使わない）。
  // 根拠: 凶格例.pdf 190〜191頁『景祐遁甲符應經』原註の時悖格の例（陽遁七局丁未時、中五宮の六丙が天芮・天禽に
  // 帯同して巽四宮の地盤丁に臨む）。地盤寄宮干を用事の干とする例は資料に無く、1080.pdf「時勃」も付けない。
  // 甲の年・月・日・時干は従来どおり地盤に無いため成立しない（甲を旬首六儀・戊とみなす扱いは原典未確定で採らない）。
  {
    name: "年悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丙" && dp(i.palaces[palace]) === i.yearStem),
  },
  {
    name: "月悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丙" && dp(i.palaces[palace]) === i.monthStem),
  },
  {
    name: "日悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丙" && dp(i.palaces[palace]) === i.dayStem),
  },
  {
    name: "時悖格",
    meaning: "大凶で、些細なことでもまた災禍の発端になる",
    source: S4,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丙" && dp(i.palaces[palace]) === i.hourStem),
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
    needs: ["天盤"],
    // 「天盤の庚が地盤の値符に臨む」＝ 天盤庚が地盤の旬首六儀と同宮（Phase 3J-2）。
    // 天盤庚は芮禽同居宮の寄宮干も、地盤の旬首六儀は坤二宮の寄宮干も含める。
    // この格に限り寄宮干どうしの組み合わせも成立させる（FUGONG_POLICY）。中五宮は成立宮にしない。
    match: (i) =>
      judgedPalaces(FUGONG_POLICY).filter(
        (palace) =>
          stemPairs(i.palaces[palace], (t, d) => t === "庚" && d === i.liuyi, FUGONG_POLICY).length > 0,
      ),
  },
  {
    name: "飛宮格天乙太白",
    meaning: "作戦は失敗し敗れ去る。大将は生け捕りにされ、商売したら破財する",
    source: S5,
    needs: ["天盤"],
    // 「天盤の値符が地盤の庚に臨む」＝ 天盤の旬首六儀が地盤庚と同宮（Phase 3J-2）。
    // 天盤の旬首六儀は通常干のみ（天禽が帯同する寄宮干に旬首の役割を付けない）。
    // 地盤庚は坤二宮の寄宮干も含める（XUNSHOU_ROLE_POLICY）。中五宮は成立宮にしない。
    match: (i) =>
      judgedPalaces(XUNSHOU_ROLE_POLICY).filter((palace) => {
        const p = i.palaces[palace];
        return (
          roleStems(p, "tianPan", XUNSHOU_ROLE_POLICY).some((t) => t.stem === i.liuyi) &&
          diPanStems(p, XUNSHOU_ROLE_POLICY).some((d) => d.stem === "庚")
        );
      }),
  },
  {
    name: "戦格",
    meaning: "突然の災いや事故、命の危険、行き詰まり、損失",
    source: S5,
    needs: ["天盤"],
    match: (i) => pairScan(i, "庚", "庚"),
  },

  // --- 凶格６ -------------------------------------------------------
  {
    name: "符勃格",
    meaning: "主に投降、悖逆（正しい道に背く）、大凶である。",
    source: S6,
    needs: ["天盤", "値符"],
    // 「天盤丙が値符の九星と同宮」（中宮寄宮 Phase 3L・2026-10-16。凶格例.pdf 192〜193頁の陰遁三局丙子時）。
    // 値符の宮は九星値符の宮（値符が天禽なら天芮と同居する宮）。天盤丙は芮禽同居宮の
    // 天盤寄宮干（天禽が帯同する中五宮の干）も含める。中五宮は成立宮にしない。旬の限定なし。
    match: (i) => {
      const zp = i.zhifuPalace;
      if (zp === null || !judgedPalaces(BASIC_PAIR_POLICY).includes(zp)) return [];
      return tianPanStems(i.palaces[zp], BASIC_PAIR_POLICY).some((e) => e.stem === "丙") ? [zp] : [];
    },
  },
  {
    name: "飛悖格",
    meaning: "主に投降、悖逆、大凶",
    source: S6,
    needs: ["天盤", "値符"],
    // 「地盤丙が値符の九星と同宮」（中宮寄宮 Phase 3L・2026-10-16。凶格例.pdf 194頁の陽遁一局丙午時）。
    // 値符の宮は九星値符の宮（値符が天禽なら天芮と同居する宮）。地盤丙は坤二宮の
    // 地盤寄宮干（中五宮の地盤干）も含める。中五宮は成立宮にしない。旬の限定なし。
    // 旬首六儀の干の役割は使わない（青龍返首・飛鳥跌穴の Phase 3G の扱いとは独立）。
    match: (i) => {
      const zp = i.zhifuPalace;
      if (zp === null || !judgedPalaces(BASIC_PAIR_POLICY).includes(zp)) return [];
      return diPanStems(i.palaces[zp], BASIC_PAIR_POLICY).some((e) => e.stem === "丙") ? [zp] : [];
    },
  },
  {
    name: "乙奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "乙" && (palace === 2 || palace === 6)),
  },
  {
    name: "丙奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丙" && palace === 6),
  },
  {
    name: "丁奇入墓",
    meaning:
      "百事に宜しからざる。謀事は尽き果て吉を不吉にする。凶を凶とはせず。無力の象意。",
    source: S6,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => t === "丁" && palace === 8),
  },

  // --- 凶格７ -------------------------------------------------------
  {
    name: "三奇受刑",
    meaning: "行動すべきではない。さもなくば大凶",
    source: S7,
    needs: ["天盤"],
    match: (i) =>
      tianScan(
        i,
        (t, palace) =>
          (t === "乙" && (palace === 6 || palace === 2)) ||
          (t === "丙" && palace === 6) ||
          (t === "丁" && palace === 8),
      ),
  },
  {
    name: "六儀撃刑",
    meaning:
      "極凶である。動けば必ず災や傷を負う。もし天網四張格に遭えば、必ず逮捕され投獄される災いの象意",
    source: S7,
    needs: ["天盤"],
    match: (i) => tianScan(i, (t, palace) => SIX_YI_XING[t] === palace),
    detail: (i, palaces) => {
      const label: Record<string, string> = {
        "戊": "戊儀撃刑",
        "己": "己儀撃刑",
        "庚": "庚儀撃刑",
        "辛": "辛儀撃刑",
        "壬": "壬儀撃刑",
        "癸": "癸儀撃刑",
      };
      // 寄宮干で成立した宮では、条件を満たした干（通常干または寄宮干）だけを表示する。
      const hit = palaces.flatMap((pl) =>
        tianPanStems(i.palaces[pl], BASIC_PAIR_POLICY)
          .filter((e) => SIX_YI_XING[e.stem] === pl)
          .map((e) => label[e.stem]),
      );
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
      // 直符伏吟: 八神「直符」が定位（陽遁=坎一/陰遁=離九）にあること。
      // 講義案N.pdfの原文表記は「値符伏吟」だが、追加図版により八神の「直符」を
      // 指すことが確定したため、表示名は「直符伏吟」とする（判定ロジックは無変更）。
      if (segmentAvailable("八神", i) && zhifuFuyin(i.palaces, i.dun)) v.push("直符伏吟");
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
      // 直符反吟: 八神「直符」が定位の相沖宮にあること。表示名の由来は直符伏吟と同じ
      // （講義案N.pdfの表記「値符反吟」→追加図版により「直符反吟」に変更。判定は無変更）。
      if (segmentAvailable("八神", i) && zhifuFanyin(i.palaces, i.dun)) v.push("直符反吟");
      if (segmentAvailable("八門", i) && bamenFanyin(i.palaces)) v.push("八門反吟");
      return { hit: v.length > 0, detail: v.join("・") };
    },
  },
  {
    name: "天網四張",
    meaning:
      "天網高格は作用を起こさない。妨げにはならず。天網が低格ならばはって進むことができる。",
    source: S8,
    needs: ["天盤"],
    // 「天盤癸儀が地盤の用事となる時干に臨んで加わる」（成立条件は無変更）。
    match: (i) => scan(i, (p) => tp(p) === "癸" && dp(p) === i.hourStem),
    // 追加資料により、低格＝坎1・坤2・震3・巽4宮、高格＝中5・乾6・兌7・艮8・離9宮と
    // 確定したため、成立宮からどちらかを表示する（成立条件自体は変更しない）。
    detail: (_i, palaces) => {
      const low = palaces.some((p) => p >= 1 && p <= 4);
      const high = palaces.some((p) => p === 5 || (p >= 6 && p <= 9));
      const labels: string[] = [];
      if (low) labels.push("天網低格");
      if (high) labels.push("天網高格");
      return labels.length > 0 ? labels.join("・") : undefined;
    },
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
    xunShou: qimen.xunShou.xunShou,
    liuyi: qimen.xunShou.liuyi as DiPanStem,
  });
}

/** 参照用（描画・他モジュールで使う想定）。本ファイル内の判定では PALACE_TRIGRAM は未使用。 */
export { PALACE_TRIGRAM };
