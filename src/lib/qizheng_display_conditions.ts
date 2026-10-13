// src/lib/qizheng_display_conditions.ts
// 七政四餘の解釈本文のうち「主文が星＋所在以外の条件を前提にしている」レコードの表示条件。
// - JSON 本文（modern_japanese / interpretation / source_text）は変更しない。ここで表示の可否だけを決める
// - 原文・現代語訳の両方を読んで登録した。ここに無いレコードは無条件（D）として従来どおり表示する
// - 条件は分岐（branches）ごとの AND。いずれかの分岐の条件がすべて「判定でき、かつ成立」したときだけ表示する
// - 原文に明示された分岐（昼生／夜生、男命／女命 など）だけを分岐とし、曖昧な条件を OR に緩めない
// - 判定できない条件（unknown）を含む分岐は成立しない（「確認できないから表示」にはしない）
// - 「廟旺」は廟または旺、「身命」は身宮または命宮として扱う（既存の条件付きルール JSON の
//   status:["廟","旺"]・palace_in:["命宮","身宮"] と、張果星宗総論の訳「身宮または命宮」に合わせる）
// - 「天元主」等は既存の年干命宮神殺（天元・地元・人元。getHenyou2ByStemAndMing の結果）でその星に当たるかで判定する

export type QzStatus = "旺" | "廟" | "陥";
export type QzMotion = "順" | "逆" | "留";

export type QzDisplayCond =
  | { k: "status"; in: QzStatus[] }                 // 対象星の旺廟陥
  | { k: "statusNot"; in: QzStatus[] }              // 対象星の旺廟陥がこれ以外（該当なしを含む）
  | { k: "otherStatusNot"; star: string; in: QzStatus[] } // 他の星の旺廟陥がこれ以外
  | { k: "motion"; in: QzMotion[] }                 // 対象星の順逆（既存記号 + / - / *）
  | { k: "birth"; v: "day" | "night" }              // 既存の昼夜判定
  | { k: "sex"; v: "男" | "女" }
  | { k: "yearStem"; in: string[] }
  | { k: "yearBranch"; in: string[] }
  | { k: "yearBranchNot"; in: string[] }
  | { k: "palace"; in: ("命宮" | "身宮")[] }        // 対象星の所在宮が命宮／身宮のいずれか
  | { k: "with"; stars: string[] }                  // 列挙した星がすべて同宮
  | { k: "without"; stars: string[] }               // 列挙した星がどれも同宮しない
  | { k: "alone" }                                  // 所在宮に対象星だけ
  | { k: "role"; name: "天元" | "地元" | "人元" }   // 対象星が年干命宮神殺の天元等に当たる（天元主等）
  | { k: "unknown"; kind: "B" | "C"; label: string }; // 判定できない条件（B：アプリに値なし／C：条件が曖昧）

export type QzDisplayClass = "A" | "B" | "C";

export type QzDisplayRule = {
  cls: QzDisplayClass;        // A：全条件判定可／B：一部条件の値がアプリに無い／C：条件が曖昧
  branches: QzDisplayCond[][]; // 分岐ごとの AND
  conditions: string;          // 原文・現代語訳から読み取った成立条件（監査用）
};

/** 判定に使う盤の既存値（すべて既存エンジンの結果。ここでは計算しない） */
export type QzDisplayContext = {
  star?: { key: string; motion?: string; status?: string } | null; // 対象星（zg キー）
  palaceName?: string;               // 対象星の所在宮（星盤表記）
  isShenPalace?: boolean;            // 対象星の所在宮が身宮か
  starsInPalace?: string[];          // 対象星の所在宮の星（zg キー）
  statusOf?: (key: string) => string; // 他の星の旺廟陥
  isDayBirth?: boolean;
  sex?: "男" | "女";
  yearStem?: string;
  yearBranch?: string;
  roles?: { name: string; starKey: string }[]; // 年干命宮神殺（天元・地元・人元 など）の対象星
};

const day = (): QzDisplayCond => ({ k: "birth", v: "day" });
const night = (): QzDisplayCond => ({ k: "birth", v: "night" });
const MW: QzStatus[] = ["廟", "旺"];
const B = (label: string): QzDisplayCond => ({ k: "unknown", kind: "B", label });
const Cn = (label: string): QzDisplayCond => ({ k: "unknown", kind: "C", label });

export const QZ_DISPLAY_RULES: Readonly<Record<string, QzDisplayRule>> = {
  // ===== 張果星宗 照宮（zhangguo_palace_v1）=====
  "sun_palace_財帛宮": { cls: "C", branches: [[Cn("陽宮（範囲が資料に未定義）"), day()], [Cn("陽宮（範囲が資料に未定義）"), night()]], conditions: "陽宮であること（日居財帛要陽宮）＋昼生は福／夜生は凶" },
  "sun_palace_男女宮": { cls: "C", branches: [[{ k: "alone" }], [Cn("吉星の輔佐（吉星の範囲が未定義）")]], conditions: "太陽が単独（獨行）なら子に不利／吉星が輔佐すれば二男が貴" },
  "sun_palace_遷移宮": { cls: "C", branches: [[Cn("周囲に凶曜がない（凶曜の範囲が未定義）")]], conditions: "周囲に凶曜がない" },
  "sun_palace_福德宮": { cls: "C", branches: [[Cn("吉星を得る（吉星の範囲が未定義）")]], conditions: "吉星を得る" },
  "moon_palace_官祿宮": { cls: "A", branches: [[{ k: "palace", in: ["身宮"] }]], conditions: "官禄宮が身宮（太陰官祿作身宮）" },
  "jupiter_palace_財帛宮": { cls: "A", branches: [[{ k: "status", in: MW }]], conditions: "木星が廟旺" },
  "jupiter_palace_兄弟宮": { cls: "C", branches: [[Cn("吉星と会う（吉星・会の範囲が未定義）")]], conditions: "吉星と会えば良い／悪曜が混じれば分散" },
  "jupiter_palace_遷移宮": { cls: "C", branches: [[Cn("得地（定義が資料にない）")]], conditions: "木星が得地" },
  "mars_palace_福德宮": { cls: "C", branches: [[night(), { k: "status", in: MW }], [day(), Cn("水星の剋（剋の判定方法が未定義）")]], conditions: "夜生かつ廟旺なら福／昼生で水星の剋なら破敗" },
  "mars_palace_妻妾宮": { cls: "A", branches: [[{ k: "sex", v: "男" }], [{ k: "sex", v: "女" }]], conditions: "男命は剋妻／女命は夫星として判断" },
  "saturn_palace_男女宮": { cls: "C", branches: [[Cn("陽宮（範囲が資料に未定義）")]], conditions: "土星が陽宮" },
  "saturn_palace_妻妾宮": { cls: "C", branches: [[night()], [Cn("坎宮など条件が良い")]], conditions: "夜生は忌む／坎宮など条件が良ければ吉" },
  "saturn_palace_疾厄宮": { cls: "C", branches: [[Cn("凶星が強く作用（凶星の範囲が未定義）")]], conditions: "凶星が強く作用" },
  "saturn_palace_福德宮": { cls: "C", branches: [[Cn("生旺の地（定義が資料にない）")]], conditions: "生旺の地を得る" },
  "saturn_palace_相貌宮": { cls: "C", branches: [[Cn("凶勢が強い"), B("運限が弱い（運限の強弱判定なし）")]], conditions: "凶勢を強め、運限も弱い" },
  "venus_palace_妻妾宮": { cls: "C", branches: [[Cn("高強（定義が資料にない）"), { k: "status", in: MW }]], conditions: "高強かつ廟旺" },
  "venus_palace_遷移宮": { cls: "C", branches: [[Cn("得地（定義が資料にない）")]], conditions: "金星が得地" },
  "mercury_palace_田宅宮": { cls: "C", branches: [[Cn("強宮（田宅宮の扱いが資料で不定）"), Cn("刑忌の照らしがない")]], conditions: "強宮に入り刑忌の照らしがない" },
  "mercury_palace_遷移宮": { cls: "C", branches: [[Cn("命宮との関係が良い"), Cn("悪星の犯しがない")]], conditions: "命宮との関係が良く悪星の犯しがない" },
  "yuebo_palace_官祿宮": { cls: "A", branches: [[{ k: "status", in: ["廟"] }, { k: "role", name: "天元" }]], conditions: "月孛が廟（廟方）かつ天元主（作天元主）" },
  "rahu_palace_妻妾宮": { cls: "C", branches: [[Cn("高強を得ない（定義が資料にない）")]], conditions: "高強を得ない" },
  "ketu_palace_遷移宮": { cls: "A", branches: [[{ k: "status", in: MW }], [{ k: "statusNot", in: MW }]], conditions: "廟旺なら吉／そうでなければ危険" },
  "ketu_palace_福德宮": { cls: "A", branches: [[{ k: "status", in: ["旺"] }]], conditions: "計都が旺（現代語訳「旺を得ると」・原注「旺宮招吉」）" },

  // ===== 張果星宗 躔宿（zhangguo_mansion_v1）=====
  "sun_mansion_心": { cls: "A", branches: [[day()]], conditions: "昼生（白日生人）" },
  "sun_mansion_尾": { cls: "A", branches: [[day()], [night()]], conditions: "昼生は富裕／夜生は卑俗" },
  "sun_mansion_壁": { cls: "C", branches: [[Cn("水金連・皓魄相同（他星との関係か不明）")]], conditions: "水金の清明を得る（条件か描写か不明）" },
  "sun_mansion_星": { cls: "C", branches: [[B("三方の主曜が旺強（三方主曜の判定なし）")]], conditions: "三方の主曜が旺強" },
  "moon_mansion_胃": { cls: "C", branches: [[Cn("特定の度（十度之中の範囲が不明）")]], conditions: "胃宿の特定の度" },
  "moon_mansion_井": { cls: "A", branches: [[night()]], conditions: "夜生" },
  "venus_mansion_鬼": { cls: "A", branches: [[{ k: "sex", v: "女" }]], conditions: "女命（婦女逢之）" },
  "saturn_mansion_尾": { cls: "C", branches: [[Cn("百六の時"), Cn("忌星となる")]], conditions: "百六の時には助け／忌星となれば寿を損なう" },
  "saturn_mansion_婁": { cls: "C", branches: [[Cn("木星と相逢（会の範囲が不明）")]], conditions: "木星の助けの有無" },
  "yuebo_mansion_房": { cls: "A", branches: [[{ k: "palace", in: ["身宮", "命宮"] }]], conditions: "身命にある" },
  "yuebo_mansion_危": { cls: "A", branches: [[{ k: "palace", in: ["命宮"] }]], conditions: "命にある" },
  "rahu_mansion_箕": { cls: "A", branches: [[{ k: "status", in: MW }]], conditions: "廟旺" },
  "rahu_mansion_女": { cls: "A", branches: [[{ k: "yearBranch", in: ["午", "亥"] }], [{ k: "yearBranchNot", in: ["午", "亥"] }]], conditions: "午・亥年生まれ／その他" },
  "rahu_mansion_虚": { cls: "C", branches: [[Cn("甲命（年干か不明）")], [{ k: "palace", in: ["身宮", "命宮"] }]], conditions: "甲命なら侯位／身命なら衣食旺盛" },
  "rahu_mansion_觜": { cls: "C", branches: [[Cn("亥命（年支か命宮か不明）")]], conditions: "亥命" },
  "ketu_mansion_角": { cls: "C", branches: [[Cn("五星が会う（範囲が不明）")]], conditions: "五星逢之" },
  "ketu_mansion_亢": { cls: "B", branches: [[B("軍人か否か（職業の情報なし）")]], conditions: "軍陣では功／軍人でなければ凶" },
  "ketu_mansion_氐": { cls: "C", branches: [[Cn("東出・十度之中"), Cn("命宮に対する")]], conditions: "東出・特定の度、命宮に対する" },
  "ketu_mansion_女": { cls: "C", branches: [[Cn("福として働く")]], conditions: "福として働けば／度初にあれば" },
  "ketu_mansion_壁": { cls: "C", branches: [[Cn("壁宿4〜10度・正廟（度数の数え方が不明）")]], conditions: "壁宿4〜10度の正廟" },
  "ketu_mansion_奎": { cls: "C", branches: [[Cn("木星・月が会う（会の範囲が不明）")], [Cn("火土が会う（会の範囲が不明）")]], conditions: "木月が会えば近帝／火土が会えば凶" },
  "ketu_mansion_婁": { cls: "A", branches: [[{ k: "status", in: MW }]], conditions: "旺廟" },
  "ketu_mansion_胃": { cls: "C", branches: [[day(), Cn("火星が加わる（加の範囲が不明）")]], conditions: "昼生で火星が加わる" },
  "ketu_mansion_参": { cls: "C", branches: [[Cn("水宿相逢（水星か水宿か不明）")], [B("庶俗（身分の情報なし）")]], conditions: "水星と会えば美官／庶俗では毒悪" },
  "ketu_mansion_井": { cls: "C", branches: [[Cn("命度（範囲が不明）")], [Cn("官禄の旺宮（範囲が不明）")]], conditions: "命度なら凶／官禄の旺宮なら威権" },
  "ketu_mansion_柳": { cls: "A", branches: [[{ k: "palace", in: ["命宮"] }]], conditions: "命にある" },
  "ziqi_mansion_星": { cls: "B", branches: [[{ k: "palace", in: ["命宮"] }], [B("僧道（職業の情報なし）")]], conditions: "命にあれば孤独／僧道なら長寿" },
  "ziqi_mansion_翼": { cls: "B", branches: [[{ k: "palace", in: ["命宮"] }], [B("僧道（職業の情報なし）")]], conditions: "命宮にあれば孤高／僧道なら自在" },

  // ===== 張果星宗 入宮（zhangguo_branch_v1）=====
  "sun_branch_子": { cls: "A", branches: [[night()], [day()]], conditions: "夜生は吉／昼生は無成" },
  "sun_branch_丑": { cls: "C", branches: [[Cn("官禄の地を照らす（照臨の範囲が不明）")]], conditions: "官禄の地を照らす" },
  "sun_branch_未": { cls: "A", branches: [[{ k: "otherStatusNot", star: "moon", in: ["陥"] }]], conditions: "太陰が落陥していない" },
  "sun_branch_申": { cls: "A", branches: [[day()]], conditions: "昼生（誕晝）" },
  "sun_branch_酉": { cls: "A", branches: [[night()], [day()]], conditions: "夜生は亨通／昼生は無力" },
  "sun_branch_戌": { cls: "C", branches: [[Cn("太陰と会照（会照の範囲が不明）")]], conditions: "太陰と会照" },
  "moon_branch_丑": { cls: "C", branches: [[Cn("己・癸年生まれ（原文は「巳癸」で干が確定しない）")]], conditions: "己（原文は巳）・癸の人" },
  "moon_branch_寅": { cls: "C", branches: [[day()], [Cn("望で計都・火星に侵される（侵の範囲が不明）")]], conditions: "昼生は月光が暗い／望でも計火に侵されれば濁る" },
  "moon_branch_辰": { cls: "A", branches: [[{ k: "with", stars: ["venus"] }]], conditions: "金星と同宮" },
  "moon_branch_申": { cls: "A", branches: [[{ k: "with", stars: ["mercury"] }]], conditions: "水星と同居（同宮）" },
  "jupiter_branch_子": { cls: "C", branches: [[Cn("吉曜／凶星に変化（範囲が不明）")]], conditions: "吉曜に化せば無害／凶星に化せば不生" },
  "jupiter_branch_寅": { cls: "A", branches: [[{ k: "yearStem", in: ["甲", "丙"] }]], conditions: "甲・丙年生まれ" },
  "jupiter_branch_巳": { cls: "C", branches: [[Cn("水星と相逢（会の範囲が不明）")], [{ k: "yearStem", in: ["丙", "庚"] }]], conditions: "水星と会えば富足／丙・庚年生まれ" },
  "mars_branch_巳": { cls: "C", branches: [[Cn("水星と同行（同行の範囲が不明）")]], conditions: "水星と同行" },
  "saturn_branch_卯": { cls: "C", branches: [[Cn("火星と相逢（会の範囲が不明）")], [{ k: "yearStem", in: ["壬"] }]], conditions: "火星と会えば慶／壬年生まれは刑害" },
  "saturn_branch_午": { cls: "A", branches: [[night()], [day()]], conditions: "夜生でも福／昼生は大貴" },
  "venus_branch_巳": { cls: "A", branches: [[{ k: "with", stars: ["mercury"] }]], conditions: "水星と同宮" },
  "venus_branch_未": { cls: "A", branches: [[{ k: "with", stars: ["mercury"] }], [{ k: "yearStem", in: ["丙", "丁"] }]], conditions: "水星と同宮／丙・丁年生まれ" },
  "venus_branch_申": { cls: "A", branches: [[{ k: "yearStem", in: ["庚", "辛"] }, { k: "without", stars: ["rahu", "mars"] }]], conditions: "庚・辛年生まれ、かつ羅喉・火星が同宮しない" },
  "mercury_branch_辰": { cls: "C", branches: [[Cn("金星と同行（同行の範囲が不明）")], [{ k: "palace", in: ["命宮"] }]], conditions: "金星と同行／命に得る" },
  "mercury_branch_午": { cls: "C", branches: [[Cn("太陽と同行（同行の範囲が不明）")], [Cn("官禄主に変化")]], conditions: "太陽と同行／官禄主に化す" },
  "mercury_branch_未": { cls: "A", branches: [[{ k: "with", stars: ["moon"] }]], conditions: "太陰と同宮" },
  "yuebo_branch_寅": { cls: "C", branches: [[{ k: "yearStem", in: ["癸", "乙"] }], [Cn("官禄として働く")]], conditions: "癸・乙年生まれ／官禄となれば" },
  "yuebo_branch_辰": { cls: "C", branches: [[{ k: "with", stars: ["venus"] }], [Cn("水星と同行（同行の範囲が不明）")]], conditions: "金星と同宮／水星と同行" },
  "rahu_branch_丑": { cls: "C", branches: [[Cn("官禄として働く"), Cn("凶宿がない")]], conditions: "官禄となり凶宿がない" },
  "rahu_branch_辰": { cls: "A", branches: [[{ k: "with", stars: ["mars", "venus"] }]], conditions: "火星・金星が会舎（同宮）" },
  "rahu_branch_未": { cls: "C", branches: [[{ k: "with", stars: ["moon"] }], [Cn("木星と相会（会の範囲が不明）")]], conditions: "太陰と同宮／木星と会う" },
  "ketu_branch_申": { cls: "A", branches: [[{ k: "with", stars: ["mercury"] }]], conditions: "水星と同居（同宮）" },
  "ketu_branch_酉": { cls: "C", branches: [[{ k: "yearStem", in: ["丁", "壬"] }], [Cn("金命（定義が不明）")]], conditions: "丁・壬年生まれ／金命" },

  // ===== 七政四餘鑑定用資料 日宮推命法（qizheng_star_branch_v1）=====
  "qz_starbranch_sun_戌": { cls: "A", branches: [[{ k: "with", stars: ["moon"] }]], conditions: "月と同宮" },
  "qz_starbranch_sun_酉": { cls: "A", branches: [[night()], [day()]], conditions: "夜生まれ／昼生まれ" },
  "qz_starbranch_sun_申": { cls: "A", branches: [[day()]], conditions: "昼生まれ" },
  "qz_starbranch_sun_未": { cls: "A", branches: [[{ k: "otherStatusNot", star: "moon", in: ["陥"] }]], conditions: "月に落陥がない" },
  "qz_starbranch_sun_丑": { cls: "C", branches: [[Cn("臨官禄の地に照らす（範囲が不明）")]], conditions: "臨官禄の地に照らす" },
  "qz_starbranch_sun_子": { cls: "A", branches: [[night()], [day()]], conditions: "夜生まれ／昼生まれ" },

  // ===== 七政四餘鑑定用資料 同宮（qizheng_star_conjunction_v1）=====
  "qz_conj_月孛": { cls: "A", branches: [[night()], [day()]], conditions: "夜生／昼生" },
  "qz_conj_月計": { cls: "A", branches: [[night()], [day()]], conditions: "同上（月孛と同じ：夜生／昼生）" },
  "qz_conj_木羅": { cls: "C", branches: [[Cn("陽宮")], [Cn("陰宮")]], conditions: "陽宮なら福厚／陰宮なら悪死" },
  "qz_conj_火羅": { cls: "A", branches: [[day()], [night()]], conditions: "昼は凶／夜生は官位" },
  "qz_conj_土紫": { cls: "A", branches: [[day()], [night()]], conditions: "昼生は貴顕／夜生は貧苦" },
  "qz_conj_土計": { cls: "A", branches: [[night()]], conditions: "夜生" },
  "qz_conj_孛土": { cls: "A", branches: [[night()]], conditions: "夜生" },
  "qz_conj_孛羅": { cls: "C", branches: [[Cn("廟旺（どの星か不明）")]], conditions: "廟旺" },
  "qz_conj_羅土": { cls: "C", branches: [[Cn("廟旺で順行（どの星か不明）")]], conditions: "廟旺で順行／夜は忌む／土が逆行なら凶" },
  "qz_conj_羅紫": { cls: "C", branches: [[Cn("旺（どの星か不明）")]], conditions: "旺なら清職／旺でなければ" },
  "qz_conj_計木紫": { cls: "C", branches: [[Cn("旺（どの星か不明）")]], conditions: "旺" },
  "qz_conj_計金孛": { cls: "C", branches: [[night(), Cn("旺（どの星か不明）")], [day()]], conditions: "夜生で旺なら武職貴顕／昼生は犯刑" },
  "qz_conj_計土": { cls: "A", branches: [[day()], [night()]], conditions: "昼生／夜生" },
  "qz_conj_計火": { cls: "C", branches: [[night(), Cn("廟旺（どの星か不明）")], [day()]], conditions: "夜生で廟旺なら威権／昼生は凶曜" },
  "qz_conj_紫計": { cls: "A", branches: [[night()], [day()]], conditions: "夜生／昼生" },

  // ===== 七政四餘鑑定用資料 神殺（qizheng_shensha_v1）=====
  "qz_shensha_yb_palace_太陽": { cls: "A", branches: [[{ k: "sex", v: "男" }]], conditions: "男命" },
  "qz_shensha_yb_palace_太陰": { cls: "A", branches: [[{ k: "sex", v: "女" }]], conditions: "女命" },
  "qz_shensha_yb_palace_孤辰": { cls: "A", branches: [[{ k: "sex", v: "男" }]], conditions: "男命" },
  "qz_shensha_yb_palace_寡宿": { cls: "A", branches: [[{ k: "sex", v: "女" }]], conditions: "女命" },
  "qz_shensha_ym_天経": { cls: "A", branches: [[{ k: "palace", in: ["身宮", "命宮"] }]], conditions: "身命にある" },
  "qz_shensha_ym_地緯": { cls: "A", branches: [[{ k: "palace", in: ["身宮", "命宮"] }]], conditions: "天経に同じ（身命にある）" },
  "qz_shensha_ym_天元": { cls: "A", branches: [[{ k: "motion", in: ["順"] }], [{ k: "motion", in: ["逆"] }], [{ k: "motion", in: ["留"] }], [{ k: "status", in: ["陥"] }]], conditions: "順なら吉／逆・留・陥を忌む" },
  "qz_shensha_ym_地元": { cls: "A", branches: [[{ k: "status", in: MW }]], conditions: "廟旺" },
  "qz_shensha_ym_人元": { cls: "A", branches: [[{ k: "status", in: ["旺"] }]], conditions: "旺" },
};

const MOTION_FROM_MARK: Record<string, QzMotion> = { "+": "順", "-": "逆", "*": "留" };

/** 1条件の成否。判定に必要な値が無ければ false（成立扱いにしない） */
function condHolds(c: QzDisplayCond, ctx: QzDisplayContext): boolean {
  const st = ctx.star?.status ?? "";
  const inPalace = ctx.starsInPalace ?? [];
  switch (c.k) {
    case "status": return !!ctx.star && (c.in as string[]).includes(st);
    case "statusNot": return !!ctx.star && !(c.in as string[]).includes(st);
    case "otherStatusNot": {
      if (!ctx.statusOf) return false;
      return !(c.in as string[]).includes(ctx.statusOf(c.star) ?? "");
    }
    case "motion": {
      const m = MOTION_FROM_MARK[ctx.star?.motion ?? ""];
      return !!m && c.in.includes(m);
    }
    case "birth": return typeof ctx.isDayBirth === "boolean" && ctx.isDayBirth === (c.v === "day");
    case "sex": return !!ctx.sex && ctx.sex === c.v;
    case "yearStem": return !!ctx.yearStem && c.in.includes(ctx.yearStem);
    case "yearBranch": return !!ctx.yearBranch && c.in.includes(ctx.yearBranch);
    case "yearBranchNot": return !!ctx.yearBranch && !c.in.includes(ctx.yearBranch);
    case "palace": {
      if (!ctx.palaceName) return false;
      return c.in.some((p) => (p === "命宮" ? ctx.palaceName === "命宮" : ctx.isShenPalace === true));
    }
    case "with": return !!ctx.starsInPalace && c.stars.every((s) => inPalace.includes(s));
    case "without": return !!ctx.starsInPalace && c.stars.every((s) => !inPalace.includes(s));
    case "alone": return !!ctx.star && !!ctx.starsInPalace && inPalace.length === 1 && inPalace[0] === ctx.star.key;
    case "role": return !!ctx.star && !!ctx.roles && ctx.roles.some((r) => r.name === c.name && r.starKey === ctx.star!.key);
    case "unknown": return false;
  }
}

export type QzDisplayDecision = { show: boolean; rule: QzDisplayRule | null };

/** レコード ID の表示可否。登録の無い（無条件の）レコードは常に表示 */
export function qzDisplayDecision(id: string, ctx: QzDisplayContext): QzDisplayDecision {
  const rule = QZ_DISPLAY_RULES[id] ?? null;
  if (!rule) return { show: true, rule: null };
  const show = rule.branches.some((br) => br.length > 0 && br.every((c) => condHolds(c, ctx)));
  return { show, rule };
}

export function qzShouldDisplay(id: string, ctx: QzDisplayContext): boolean {
  return qzDisplayDecision(id, ctx).show;
}
