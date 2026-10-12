// src/lib/qimenMeaning/jiuXingMeaning.ts
//
// 役割:
//   九星（天蓬・天芮・天沖・天輔・天禽・天心・天柱・天任・天英）の象意データ。
//
// 唯一の仕様書:
//   docs/source/奇門遁甲講義案N.pdf（このPDF以外は一切参照していない）。
//     ・「基本象意４」p.38、「基本象意５（九星２）」p.39 … 九星の基本象意
//     ・「基本象意６」p.40 … 九星の旺相休囚死（各星ごとの、旺・相・休・囚・死
//       それぞれに対応する地支の組み合わせ）と、吉星／凶星それぞれについて
//       旺相休囚死がどう吉凶に影響するかの凡例
//   要約・補完・推測はしていない。判定ロジック（src/lib/qimen/ 配下）には
//   一切依存しない・変更しない、独立したデータベース。
//
// 箇条書きへの分割方法: baMenMeaning.ts と同じ方針
//   （句読点で分割するが、末尾の述語が直前の複数語全体にかかる場合は
//   その節をひとまとまりの1項目として扱う）。

/** 九星1件分の基本象意（p.38-39）。 */
export interface JiuXingMeaningEntry {
  name: string;
  /** 資料に付された吉凶ラベル（例: 凶星・病星 凶・吉星・大吉星・大吉・凶・吉・小凶）。原文のまま。 */
  fortuneLabel: string;
  basicMeaning: string[];
  sourcePage: number;
}

export const JIUXING_MEANING: readonly JiuXingMeaningEntry[] = [
  {
    name: "天蓬星",
    fortuneLabel: "凶星",
    basicMeaning: [
      "辺境を平定", "城", "池", "堤防の修理", "床板の修繕", "駐屯",
      "ビジネスで出張すると盗難、破財、病気",
      "生門、三奇と同宮すれば繁栄する",
    ],
    sourcePage: 38,
  },
  {
    name: "天芮星",
    fortuneLabel: "病星 凶",
    basicMeaning: [
      "先生から教えをうける", "会親友", "駐屯",
      "用兵、嫁娶、訴訟、引っ越し、修造には良くない",
    ],
    sourcePage: 38,
  },
  {
    name: "天沖星",
    fortuneLabel: "吉星",
    basicMeaning: ["出兵、征伐、交戦、前進、後退、時の声を上げるによい"],
    sourcePage: 38,
  },
  {
    name: "天輔星",
    fortuneLabel: "大吉星",
    basicMeaning: [
      "嫁娶、出行、商業、修造、征伐など百事に吉",
      "試験、文化教育事業の発展にも良い",
    ],
    sourcePage: 38,
  },
  {
    name: "天禽星",
    fortuneLabel: "大吉",
    basicMeaning: [
      "祭祀", "求福", "いやな人との交流を断つ", "計略だけで勝つ",
      "取り壊し", "引っ越し", "訴訟", "商業", "嫁娶", "修造", "埋葬など",
    ],
    sourcePage: 39,
  },
  {
    name: "天心星",
    fortuneLabel: "大吉",
    basicMeaning: [
      "病気の診断", "薬の処方など",
      "秋冬は嫁娶、征伐、訴訟",
      "祭祀、商業によいが、春夏は不利",
    ],
    sourcePage: 39,
  },
  {
    name: "天柱星",
    fortuneLabel: "凶",
    basicMeaning: [
      "軍隊の駐屯、物事を隠すのには使える",
      "嫁娶、修造、祭祀",
      "出兵、交戦すれば負ける",
      "商業や遠行すると破財",
      "予想外の災い",
    ],
    sourcePage: 39,
  },
  {
    name: "天任星",
    fortuneLabel: "吉",
    basicMeaning: ["謁見、商談、戦争、嫁娶、訴訟など百事皆吉"],
    sourcePage: 39,
  },
  {
    name: "天英星",
    fortuneLabel: "小凶",
    basicMeaning: [
      "社交、遠遊、お客を招待、享楽によい",
      "嫁娶、出兵、訴訟、建築、祭祀、商業には不利（血光の災い）",
    ],
    sourcePage: 39,
  },
];

/** 九星の旺相休囚死（p.40 表を転記）。列は資料そのままの区分。 */
export interface JiuXingWangShuaiRow {
  star: string;
  旺: string;
  相: string;
  休: string;
  囚: string;
  死: string;
}

export const JIUXING_WANGSHUAI: readonly JiuXingWangShuaiRow[] = [
  { star: "天蓬", 旺: "寅卯", 相: "亥子", 休: "巳午", 囚: "辰戌丑未", 死: "申酉" },
  { star: "天芮", 旺: "申酉", 相: "辰戌丑未", 休: "亥子", 囚: "寅卯", 死: "巳午" },
  { star: "天沖", 旺: "巳午", 相: "寅卯", 休: "辰戌丑未", 囚: "申酉", 死: "亥子" },
  { star: "天輔", 旺: "巳午", 相: "寅卯", 休: "辰戌丑未", 囚: "申酉", 死: "亥子" },
  { star: "天禽", 旺: "申酉", 相: "辰戌丑未", 休: "亥子", 囚: "寅卯", 死: "巳午" },
  { star: "天心", 旺: "亥子", 相: "申酉", 休: "寅卯", 囚: "巳午", 死: "辰戌丑未" },
  { star: "天柱", 旺: "亥子", 相: "申酉", 休: "寅卯", 囚: "巳午", 死: "辰戌丑未" },
  { star: "天任", 旺: "申酉", 相: "辰戌丑未", 休: "亥子", 囚: "寅卯", 死: "巳午" },
  { star: "天英", 旺: "辰戌丑未", 相: "巳午", 休: "申酉", 囚: "亥子", 死: "寅卯" },
];
export const JIUXING_WANGSHUAI_SOURCE_PAGE = 40;

/**
 * 九星の旺相休囚死が、星自身の吉星／凶星の別によってどう作用するかの凡例
 * （p.40 右側の凡例をそのまま転記）。
 */
export const JIUXING_WANGSHUAI_EFFECT: {
  吉星: { 旺: string; 相: string; "休・囚・死": string };
  凶星: { 旺: string; 相: string; "休・囚・死": string };
} = {
  吉星: { 旺: "大吉", 相: "増吉", "休・囚・死": "平か凶" },
  凶星: { 旺: "増増", 相: "増", "休・囚・死": "減凶" },
};

/**
 * p.38-39 の基本象意は「天蓬星」のように語尾へ「星」を付けて記載するが、
 * p.40 の旺相休囚死表や既存モジュール（jiuxing.ts の JiuXingStar 型）は
 * 「天蓬」のように「星」を付けない表記。どちらで渡しても同じ結果になる
 * よう、末尾の「星」を無視して照合する（表記ゆれの吸収であり、象意の
 * 内容自体は補完していない）。
 */
function bareStarName(name: string): string {
  return name.endsWith("星") ? name.slice(0, -1) : name;
}

/** 九星名（「天蓬」「天蓬星」いずれの表記でも可）から基本象意を引く。データが無ければ undefined。 */
export function lookupJiuXingMeaning(name: string): JiuXingMeaningEntry | undefined {
  const target = bareStarName(name);
  return JIUXING_MEANING.find((e) => bareStarName(e.name) === target);
}

/** 九星名から旺相休囚死（地支の組み合わせ）を引く。データが無ければ undefined。 */
export function lookupJiuXingWangShuai(star: string): JiuXingWangShuaiRow | undefined {
  return JIUXING_WANGSHUAI.find((r) => r.star === star);
}
