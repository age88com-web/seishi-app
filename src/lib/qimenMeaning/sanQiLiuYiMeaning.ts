// src/lib/qimenMeaning/sanQiLiuYiMeaning.ts
//
// 役割:
//   三奇（乙奇・丙奇・丁奇。甲を含む）・六儀（戊・己・庚・辛・壬・癸儀）の
//   象意データ。
//
// 唯一の仕様書:
//   docs/source/奇門遁甲講義案N.pdf（このPDF以外は一切参照していない）。
//     ・「三奇の象意」p.44 … 甲・乙奇・丙奇・丁奇
//     ・「六儀の象意」p.45、「六儀の象意２」p.46 … 戊儀・己儀・庚儀・辛儀・
//       壬儀・癸儀
//   要約・補完・推測はしていない。判定ロジック（src/lib/qimen/ 配下）には
//   一切依存しない・変更しない、独立したデータベース。
//
// 旺衰について（重要・意図的に未実装）:
//   p.46 に「地盤の三奇六儀と天盤の三奇六儀は、干同士の旺衰が存在する。
//   別紙参照」とあるが、その「別紙」は本PDFに含まれていない。一次資料が
//   無い以上、三奇六儀の旺衰データは実装しない（推測で補わない）。
//
// フィールドについて:
//   資料は 甲 以外の各干について「性格／身体／色／味／人物」の5区分と、
//   区分の並びの末尾に置かれた1行の付記（体質・体格に関する短評、または
//   「◯◯を求めるに吉」等の一言）を持つ。甲だけはこの区分を持たず、
//   本文が地の文のまま記載されているため basicMeaning のみを用いる。

export interface SanQiLiuYiEntry {
  name: string;
  /** 甲のみ使用。区分の無い地の文の箇条書き。 */
  basicMeaning?: string[];
  /** 性格 */
  personality?: string[];
  /** 身体 */
  body?: string[];
  /** 身体欄の末尾に付記された短評（例:「体質は柔らかい」「重厚な体格」）。 */
  bodyNote?: string;
  /** 色 */
  color?: string[];
  /** 味 */
  taste?: string[];
  /** 人物 */
  people?: string[];
  /** 人物欄の末尾に付記された「◯◯を求めるに吉」等の一言。 */
  aspiration?: string;
  sourcePage: number;
}

/** 三奇（p.44）。甲は三奇六儀を組成する源だが隠遁するため実際には用いられない。 */
export const SANQI_MEANING: readonly SanQiLiuYiEntry[] = [
  {
    name: "甲",
    basicMeaning: [
      "三奇六儀を組成する源が甲", "しかし隠されているため用いられない",
      "功名を求める", "目上からの引き立て", "昇進など",
    ],
    sourcePage: 44,
  },
  {
    name: "乙奇",
    personality: ["従順", "世情に頼る"],
    body: ["肝", "首", "肩"],
    bodyNote: "体質は柔らかい",
    color: ["碧", "淡い緑"],
    taste: ["酸味", "甘み"],
    people: ["医師", "権威ある女人", "妻子"],
    aspiration: "安定を求めるに吉",
    sourcePage: 44,
  },
  {
    name: "丙奇",
    personality: ["剛烈", "清廉", "逸材"],
    body: ["小腸", "肩", "額"],
    color: ["紫", "赤"],
    taste: ["酸味", "甘み"],
    people: ["権威ある人"],
    aspiration: "求財に吉",
    sourcePage: 44,
  },
  {
    name: "丁奇",
    personality: ["温和", "策略家"],
    body: ["心臓", "胸", "舌"],
    bodyNote: "重厚な体格",
    color: ["淡い紅色"],
    taste: ["苦味"],
    people: ["役人", "占い師", "運転手"],
    aspiration: "求知（学問、名声）",
    sourcePage: 44,
  },
];

/** 六儀（p.45-46）。 */
export const LIUYI_MEANING: readonly SanQiLiuYiEntry[] = [
  {
    name: "戊儀",
    personality: ["剛烈", "いらいら"],
    body: ["胃", "あばら", "鼻"],
    bodyNote: "秀麗で清らか",
    color: ["濃い黄色"],
    taste: ["甘み", "辛味"],
    people: ["お金持ち", "詩人", "教師"],
    aspiration: "信用を求めるに吉",
    sourcePage: 45,
  },
  {
    name: "己儀",
    personality: ["温和"],
    body: ["脾臓", "へその廻り", "顔"],
    color: ["黄色"],
    taste: ["甘味"],
    people: ["技芸", "芸能人", "ダンサー"],
    aspiration: "求情（愛情、人気）",
    sourcePage: 45,
  },
  {
    name: "庚儀",
    personality: ["剛建", "鋭利"],
    body: ["大腸", "臍", "筋肉"],
    color: ["白"],
    taste: ["辛味"],
    people: ["賊人", "夫", "仇", "警察", "巫女", "スパイ"],
    aspiration: "求寿（健康、長寿）",
    sourcePage: 45,
  },
  {
    name: "辛儀",
    personality: ["忠誠", "物腰が柔らかい"],
    body: ["肺", "胸", "股"],
    color: ["淡白色"],
    taste: ["苦味", "辛味"],
    people: ["罪人", "農民", "大工", "信者"],
    aspiration: "求道（修業、信仰）",
    sourcePage: 45,
  },
  {
    name: "壬儀",
    personality: ["剛柔"],
    body: ["膀胱", "三焦", "すね"],
    color: ["濃い黒"],
    taste: ["塩辛味"],
    people: ["戦士", "盗賊", "料理人"],
    aspiration: "求勝（勝負、ギャンブル）",
    sourcePage: 46,
  },
  {
    name: "癸儀",
    personality: ["陰柔", "浅はか"],
    body: ["腎臓", "心包", "足"],
    color: ["薄い黒"],
    taste: ["塩辛味"],
    people: ["死体", "犯人", "スパイ", "探偵"],
    aspiration: "求定（隠遁、埋葬）",
    sourcePage: 46,
  },
];

/**
 * 干単体（例: 地盤干・天盤干の "乙" "戊"）でも、資料表記（"乙奇" "戊儀"）
 * でも同じ結果になるよう、末尾の「奇」「儀」を無視して照合する
 * （表記ゆれの吸収であり、象意の内容自体は補完していない）。
 */
function bareStem(name: string): string {
  return name.replace(/[奇儀]$/, "");
}

/** 三奇・六儀を通した名称検索（干単体・"○奇"/"○儀" 表記のいずれも可）。データが無ければ undefined。 */
export function lookupSanQiLiuYiMeaning(name: string): SanQiLiuYiEntry | undefined {
  const target = bareStem(name);
  return [...SANQI_MEANING, ...LIUYI_MEANING].find((e) => bareStem(e.name) === target);
}
