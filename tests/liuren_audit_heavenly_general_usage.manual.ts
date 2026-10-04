// tests/liuren_audit_heavenly_general_usage.manual.ts
//
// 六壬神課 Phase 4D: 天将の断法での使われ方の監査（監査専用。本番コード・本番 registry は変更しない）。
// 実行: npx tsx tests/liuren_audit_heavenly_general_usage.manual.ts
//
//   資料: A『六壬断案２』例30〜56 の本文（天将名を含む142文すべて） ／ B『六壬神課講座』p56・p58・p59・p60・p66・p67
//   （『六壬断案』〔1〕は抽出テキストの文字が欠けているため今回の集計に入れない）
//   1文ずつ、天将・支・位置・六親・併用 FACT・判断の種類・Rule 化の分類（A〜E）・資料の支持の強さを記録する。
//   天将名から意味を引く辞書は作らない。記録は「その文で何と組み合わせて何を判断したか」だけ。
//
//   照合（この監査で確かめること）:
//     1. 断案の天将盤がエンジン（講座の方式）と一致する例では、記録した 支・位置・天将・六親 がエンジンの FACT と同じ
//     2. 天将盤が一致しない例（貴人方式の差）は class E とし、エンジンでの照合をしない
//     3. 本文の「貴人」が天将ではなく日干の昼夜貴人支を指す文は、その支が NOBLE_DAY・NOBLE_NIGHT のどちらかであること
//     4. 記録の数（142文）・分類の集計

import { readFileSync } from "node:fs";
import { calculateLiuren } from "../src/lib/liuren";
import type { Branch, HeavenlyGeneral, SixRelation, Stem } from "../src/lib/liuren";
import { GENERALS, NOBLE_DAY, NOBLE_NIGHT } from "../src/lib/liuren/constants";
import { buildInterpretationFacts } from "../src/lib/liuren/interpretation/facts";
import { heavenlyGeneralStateOf } from "../src/lib/liuren/interpretation/heavenlyGeneralState";
import { siteStateOf } from "../src/lib/liuren/interpretation/siteState";
import { growthStageOfStem } from "../src/lib/liuren/interpretation/states";
import { isSeatedOnVoid } from "../src/lib/liuren/interpretation/voidStructure";
import type { InterpretationFacts } from "../src/lib/liuren/interpretation/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) pass += 1;
  else failures.push(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

// ---- 例ごとの盤と問占 ----
type Domain = "house" | "work" | "exam" | "unclassified";
interface Example {
  /** 起課の入力（見出しまたは本文の日時）。例45 は「亦得此課」で例44 と同じ課 */
  day: string; jiang: Branch; shi: Branch;
  /** 断案の天将盤（三伝・四課の天将）がエンジンと一致するか（Phase 4B・4D の照合） */
  board: "match" | "mismatch";
  domain: Domain;
  /** 問占の原題 */
  question: string;
  /** 断案の盤の注記 */
  note?: string;
}
const EX: Record<number, Example> = {
  30: { day: "甲寅", jiang: "未", shi: "午", board: "mismatch", domain: "house", question: "占家宅" },
  31: { day: "癸丑", jiang: "亥", shi: "未", board: "mismatch", domain: "house", question: "占家宅", note: "三伝の支から違う（本文の日時と盤が合わない）" },
  32: { day: "戊申", jiang: "巳", shi: "卯", board: "match", domain: "house", question: "占家宅" },
  33: { day: "壬午", jiang: "辰", shi: "申", board: "mismatch", domain: "house", question: "占家宅", note: "本文に新法の注" },
  34: { day: "丙午", jiang: "卯", shi: "申", board: "mismatch", domain: "house", question: "占宅", note: "本文に新法の注" },
  35: { day: "丁卯", jiang: "子", shi: "卯", board: "match", domain: "house", question: "占家宅" },
  36: { day: "庚戌", jiang: "亥", shi: "酉", board: "mismatch", domain: "house", question: "占宅基" },
  37: { day: "癸酉", jiang: "巳", shi: "申", board: "match", domain: "house", question: "占宅" },
  38: { day: "己巳", jiang: "午", shi: "酉", board: "mismatch", domain: "house", question: "占宅", note: "三伝の課式も起課と合わない（Phase 3Z で照合対象外）" },
  39: { day: "壬寅", jiang: "子", shi: "寅", board: "mismatch", domain: "unclassified", question: "占墳地" },
  40: { day: "癸卯", jiang: "辰", shi: "卯", board: "mismatch", domain: "unclassified", question: "占墳地" },
  41: { day: "戊申", jiang: "未", shi: "酉", board: "match", domain: "house", question: "占宅" },
  42: { day: "甲寅", jiang: "未", shi: "寅", board: "mismatch", domain: "house", question: "占宅" },
  43: { day: "丁丑", jiang: "午", shi: "未", board: "match", domain: "work", question: "占前程" },
  44: { day: "庚辰", jiang: "子", shi: "酉", board: "match", domain: "exam", question: "占応試" },
  45: { day: "庚辰", jiang: "子", shi: "酉", board: "match", domain: "work", question: "占前程（亦得此課）" },
  46: { day: "戊辰", jiang: "未", shi: "巳", board: "match", domain: "work", question: "占前程" },
  47: { day: "丙寅", jiang: "亥", shi: "申", board: "mismatch", domain: "work", question: "占前程仕進", note: "本文に新法の注" },
  48: { day: "庚戌", jiang: "亥", shi: "辰", board: "match", domain: "work", question: "占前程" },
  49: { day: "己卯", jiang: "午", shi: "丑", board: "match", domain: "work", question: "占前程" },
  50: { day: "戊寅", jiang: "申", shi: "未", board: "match", domain: "work", question: "占前程" },
  51: { day: "癸亥", jiang: "未", shi: "巳", board: "match", domain: "exam", question: "占科試" },
  52: { day: "丁丑", jiang: "午", shi: "辰", board: "match", domain: "work", question: "占前程" },
  53: { day: "丙子", jiang: "卯", shi: "丑", board: "mismatch", domain: "work", question: "占昇遷" },
  54: { day: "庚辰", jiang: "子", shi: "子", board: "match", domain: "exam", question: "占武試" },
  55: { day: "戊申", jiang: "酉", shi: "申", board: "match", domain: "exam", question: "占比試弓馬取功名" },
  56: { day: "壬午", jiang: "寅", shi: "寅", board: "mismatch", domain: "work", question: "占前程", note: "本文に新法の注" },
};

// ---- 1文ずつの記録 ----
type Pos = "standing" | "lesson1" | "lesson2" | "lesson3" | "lesson4" | "initial" | "middle" | "final";
/** 本文で天将と一緒に判断材料になっているもの */
type Combo =
  | "六親" | "支" | "支の五行" | "十二長生" | "旬空" | "坐空" | "位置" | "他天将" | "加臨（地盤支）" | "生剋・冲合刑害"
  | "日禄・羊刃・驛馬" | "神殺（死気・桃花・死神など）" | "年命・行年・太歳" | "月" | "陰神" | "天将の所属五行・干支"
  | "課格" | "遁干" | "天将の順序" | "天将が三伝にない" | "問占（DOMAIN）";
/** 本文が導いたもの */
type Judge = "存在" | "状態" | "人物" | "行為" | "場所" | "時期" | "成否" | "吉凶";
/**
 * usage        … 天将を判断に使っている
 * meta         … 天将盤の方式の注記（新法・昼夜逆など）。判断ではない
 * nobleBranch  … 本文の「貴人」が天将でなく日干の昼夜貴人支（天乙貴人の支）を指す
 * person       … 本文の「貴人」が人物（高貴な人）を指す
 */
type Kind = "usage" | "meta" | "nobleBranch" | "person";
/**
 * Rule 化の分類（Phase 4D の依頼の A〜E）
 *   A 現在の FACT だけで Rule 化できる ／ B FACT の追加が要る ／ C DOMAIN 判断層で扱う
 *   D 一例だけで一般化できない ／ E 天将盤の方式差のため保留
 */
type RuleClass = "A" | "B" | "C" | "D" | "E" | "-";
interface Rec {
  id: string;
  ex: number;
  layer: "原文" | "訳注";
  kind: Kind;
  generals: HeavenlyGeneral[];
  branch?: Branch;
  pos?: Pos[];
  six?: SixRelation;
  combos: Combo[];
  judge: Judge[];
  /** 本文の要旨（判断の内容。象意の一般化はしない） */
  gist: string;
  /** 本文がその占で担わせた役割として明示しているときだけ（推測では付けない） */
  role?: { role: "support" | "authority"; level: "direct" | "combined" | "inferred"; note: string };
  cls: RuleClass;
  level: "direct" | "combined" | "inferred" | "-";
  /** 位置表記が盤と合わないなど */
  caution?: string;
}
const R = (id: string, layer: Rec["layer"], kind: Kind, generals: HeavenlyGeneral[], at: { b?: Branch; p?: Pos[]; six?: SixRelation },
  combos: Combo[], judge: Judge[], gist: string, cls: RuleClass, level: Rec["level"], extra: Partial<Rec> = {}): Rec =>
  ({ id, ex: Number(id.split("-")[0]), layer, kind, generals, branch: at.b, pos: at.p, six: at.six, combos, judge, gist, cls, level, ...extra });

const RECS: Rec[] = [
  // 例30 占家宅（天将盤不一致）
  R("30-1", "原文", "usage", ["六合"], { b: "辰", p: ["initial"], six: "妻財" }, ["加臨（地盤支）", "生剋・冲合刑害", "位置"], ["状態"], "辰加卯の六害を六合が封じる", "E", "inferred"),
  R("30-2", "原文", "usage", ["勾陳"], { b: "巳", p: ["middle"] }, ["加臨（地盤支）", "位置"], ["状態"], "巳加辰（勾地網）を勾陳が押さえ込む", "E", "inferred"),
  R("30-3", "訳注", "usage", ["青龍"], { b: "午", p: ["final"] }, ["支", "支の五行", "天将の所属五行・干支"], ["状態", "成否"], "木神の青龍が午につく＝焼身、財を減らす", "E", "inferred"),
  R("30-4", "訳注", "usage", ["六合"], { b: "辰" }, ["生剋・冲合刑害"], ["状態"], "六合が六害を封じ込める（30-1 の解説）", "E", "inferred"),
  R("30-5", "訳注", "usage", ["勾陳"], { b: "巳" }, ["加臨（地盤支）"], ["人物", "状態"], "辰上の巳を囚人とし勾陳が抑える（30-2 の解説）", "E", "inferred"),
  // 例31 占家宅（盤が本文の日時と合わない）
  R("31-1", "原文", "usage", ["螣蛇"], { b: "午", p: ["initial"] }, ["支"], ["人物", "状態"], "婦人の産後癲癇を螣蛇の騒擾とする（前文で午＝心・血脈）", "E", "inferred"),
  R("31-2", "原文", "usage", ["天后"], { b: "辰", p: ["final"] }, ["支"], ["人物", "吉凶"], "天后が辰に乗る＝毀粧、婦人に悪い", "E", "inferred"),
  // 例32 占家宅（一致）
  R("32-1", "原文", "usage", ["天后"], { b: "子", p: ["initial", "lesson4"], six: "妻財" }, ["支", "位置"], ["人物"], "初伝の子を子息、天后を少女とする（支と天将で別の人物）", "D", "combined"),
  R("32-2", "原文", "usage", ["玄武"], { b: "戌", p: ["lesson3"], six: "兄弟" }, ["位置", "六親", "年命・行年・太歳"], ["人物", "行為"], "宅上の戌が玄武、子供らは家を出てそれぞれ財産を取っていく（行年上の破敗と併せて）", "D", "combined"),
  R("32-3", "原文", "usage", ["玄武"], { b: "戌", p: ["lesson3"] }, ["陰神", "位置"], ["存在"], "四課（子）が発用、これは玄武（三課戌）の陰神", "B", "combined"),
  R("32-4", "訳注", "usage", ["天空"], { b: "未", p: ["lesson1"], six: "兄弟" }, ["六親", "位置"], ["人物", "状態"], "未（兄弟）を親族とみれば天空がつき、親族が徐々に減る", "D", "inferred"),
  // 例33 占家宅（新法）
  R("33-1", "原文", "usage", ["白虎"], { b: "寅" }, ["加臨（地盤支）", "神殺（死気・桃花・死神など）", "月"], ["存在"], "八月の雷殺の戌に寅が加わり白虎＝雷の怒り", "E", "inferred"),
  R("33-2", "訳注", "meta", [], {}, [], [], "新法と昼夜逆貴人の注記", "-", "-"),
  R("33-3", "訳注", "usage", ["白虎"], { b: "戌" }, ["加臨（地盤支）"], ["存在"], "寅に戌が加わる白虎なので雷の被害（33-1 の読み替え）", "E", "inferred"),
  R("33-4", "訳注", "usage", ["六合", "朱雀"], { b: "寅", p: ["lesson3"] }, ["支の五行", "天将の所属五行・干支", "位置", "課格"], ["存在"], "支上の寅に六合で木が重なる・卯の類神に朱雀＝雷", "E", "inferred"),
  R("33-5", "訳注", "usage", ["朱雀", "白虎"], { b: "卯" }, ["陰神", "年命・行年・太歳", "他天将"], ["行為", "時期"], "行年未の陰神卯が朱雀＝訴訟、午の陰神が白虎", "E", "inferred"),
  // 例34 占宅（新法）
  R("34-1", "訳注", "meta", [], {}, [], [], "新法とは昼夜貴人が逆の注記", "-", "-"),
  R("34-2", "訳注", "usage", ["螣蛇"], { b: "子", p: ["lesson1"], six: "官鬼" }, ["六親", "位置"], ["吉凶"], "干上子は官鬼螣蛇で凶神", "E", "inferred"),
  R("34-3", "訳注", "usage", ["螣蛇"], { b: "子", p: ["initial"], six: "官鬼" }, ["加臨（地盤支）", "天将の所属五行・干支", "位置"], ["吉凶"], "子は巳（螣蛇の所属）上で螣蛇＝両蛇夾鬼、発用で凶", "E", "inferred"),
  R("34-4", "訳注", "usage", ["六合"], { b: "寅", p: ["final"], six: "父母" }, ["十二長生", "旬空", "生剋・冲合刑害"], ["吉凶", "状態"], "寅は長生・六合は吉将だが空亡で丙を生ずる力がない", "E", "inferred"),
  R("34-5", "訳注", "usage", ["貴人", "白虎"], { b: "亥" }, ["年命・行年・太歳", "日禄・羊刃・驛馬", "六親"], ["時期", "吉凶"], "己未年の行年亥は貴人、亥上午は白虎で羊刃＝妻財に不利", "E", "inferred"),
  R("34-6", "訳注", "usage", ["太常"], { b: "未" }, ["年命・行年・太歳"], ["存在", "時期"], "庚申年の行年子の上の未が太常＝葬式の象", "E", "inferred"),
  // 例35 占家宅（一致）
  R("35-1", "原文", "usage", ["螣蛇"], { b: "子", p: ["initial", "lesson3"], six: "官鬼" }, ["位置"], ["存在"], "子は螣蛇で宅に入り発用", "C", "combined"),
  R("35-2", "原文", "usage", ["白虎", "螣蛇"], { b: "午", p: ["final"] }, ["加臨（地盤支）", "他天将", "位置"], ["存在", "場所"], "白虎が午に乗り酉上で末伝＝蛇虎が二八の門（卯酉）に加わる、葬儀が重なる", "B", "combined"),
  R("35-3", "原文", "usage", ["白虎"], { b: "午", p: ["final"] }, ["神殺（死気・桃花・死神など）", "月", "位置"], ["存在"], "白虎が死気（正月の死気＝午）に乗じて末伝", "B", "combined"),
  R("35-4", "原文", "usage", ["螣蛇", "白虎"], { b: "子" }, ["支", "他天将"], ["場所"], "子午は道路神で螣蛇・白虎が乗じる", "D", "combined"),
  R("35-5", "訳注", "usage", ["螣蛇"], { b: "子", p: ["lesson3", "initial"], six: "官鬼" }, ["六親", "位置"], ["吉凶"], "三課が発用で官鬼螣蛇、家は不吉（家宅占）", "C", "combined"),
  // 例36 占宅基（天将盤不一致）
  R("36-1", "原文", "usage", ["天后"], { p: ["lesson3"] }, ["位置", "天将の所属五行・干支"], ["場所"], "宅上に天后＝前に水", "E", "inferred"),
  R("36-2", "原文", "usage", ["螣蛇"], {}, ["支"], ["場所"], "東南（両所の風路）を螣蛇が騒がす", "E", "inferred"),
  R("36-3", "原文", "usage", ["六合"], { b: "辰", p: ["final"] }, ["支", "位置"], ["人物"], "末伝辰は軍卒僕従、六合が乗じるから", "E", "inferred"),
  R("36-4", "訳注", "usage", ["白虎"], { b: "申" }, ["加臨（地盤支）"], ["場所"], "戌が申に加わり申に白虎＝家が道路に面する", "E", "inferred"),
  R("36-5", "訳注", "usage", ["天后"], { b: "子" }, ["支"], ["人物"], "子に天后＝女が多い", "E", "inferred"),
  R("36-6", "訳注", "usage", ["青龍"], { b: "午" }, ["支"], ["場所"], "青龍は午で辰方東南", "E", "inferred"),
  // 例37 占宅（一致）
  R("37-1", "原文", "usage", ["天后"], { b: "午", p: ["initial", "lesson3"], six: "妻財" }, ["加臨（地盤支）", "位置"], ["存在"], "午が酉に加わり天后で発用", "D", "combined"),
  R("37-2", "原文", "usage", ["天后"], { b: "午", p: ["initial"] }, ["加臨（地盤支）", "天将の所属五行・干支", "十二長生"], ["状態"], "午火は酉で光なく、天后は水で敗（酉）の上", "B", "combined"),
  R("37-3", "原文", "usage", ["青龍"], { b: "子", p: ["final"], six: "兄弟" }, ["加臨（地盤支）", "生剋・冲合刑害", "支の五行", "位置"], ["状態", "行為"], "子が青龍で卯に加わる＝無礼の刑、青龍が水に乗る＝脚浮", "A", "combined"),
  R("37-4", "訳注", "usage", ["天后"], { b: "午" }, ["神殺（死気・桃花・死神など）"], ["人物"], "日支酉の沐浴桃花は午で天后がつく", "B", "inferred"),
  R("37-5", "訳注", "usage", ["青龍"], { b: "子" }, ["支"], ["状態", "吉凶"], "青龍が子に乗る＝入海、普通は悪くないがこの課ではよくない", "D", "inferred"),
  R("37-6", "訳注", "usage", ["白虎"], { b: "戌", p: ["lesson1"], six: "官鬼" }, ["六親", "位置"], ["時期"], "戌は官鬼白虎で物事がすぐ表れる（原文「戌が日上に加わって動きをつかさどる」）", "D", "inferred"),
  // 例38 占宅（天将盤・課式とも不一致）
  R("38-1", "原文", "usage", ["勾陳"], { b: "申", p: ["initial"] }, ["加臨（地盤支）", "位置"], ["存在"], "申が発用で勾陳、巳に加わる", "E", "inferred"),
  R("38-2", "原文", "usage", ["勾陳"], { b: "申" }, ["支", "課格"], ["状態"], "申は骨歯、勾陳は折損、三伝は破", "E", "inferred"),
  R("38-3", "訳注", "usage", ["天后"], { b: "丑", p: ["lesson2"], six: "兄弟" }, ["六親", "位置"], ["人物"], "二課の天后が女性、丑は兄弟で姉妹", "E", "inferred"),
  R("38-4", "訳注", "usage", ["勾陳"], {}, ["問占（DOMAIN）"], ["行為"], "勾陳は家宅占では修造", "E", "inferred"),
  // 例39 占墳地（天将盤不一致）
  R("39-1", "原文", "usage", ["白虎"], {}, ["位置"], ["場所"], "右に両重の白虎（地形）", "E", "inferred"),
  R("39-2", "原文", "usage", ["白虎"], {}, ["位置"], ["場所"], "右に両重の白虎、山は右より来る", "E", "inferred"),
  R("39-3", "原文", "usage", ["白虎"], { b: "申" }, ["支", "加臨（地盤支）"], ["場所"], "申を白虎とし、午が加わるのも虎", "E", "inferred"),
  R("39-4", "原文", "usage", ["玄武", "六合"], { b: "子" }, ["支", "他天将", "六親"], ["人物"], "子午が玄武・六合＝子孫は邪淫", "E", "inferred"),
  R("39-5", "原文", "usage", ["天空"], { b: "酉" }, ["支"], ["人物", "行為"], "壬日は酉が天空＝酒敗、子孫は酒家に雇われる", "E", "inferred"),
  R("39-6", "訳注", "usage", ["青龍"], { b: "寅", p: ["lesson4"] }, ["陰神", "位置"], ["場所"], "四課の青龍が寅の陰神で発用＝艮山行龍", "E", "inferred"),
  R("39-7", "訳注", "usage", ["青龍"], {}, ["位置"], ["場所"], "穴に落ちて青龍に至らない", "E", "inferred"),
  R("39-8", "訳注", "usage", ["白虎"], { b: "申" }, ["天将の所属五行・干支", "支"], ["場所"], "申に白虎が乗る、または申金自体が白虎（所属庚申）", "E", "inferred"),
  R("39-9", "訳注", "usage", ["天后", "玄武"], { b: "午", p: ["final"], six: "妻財" }, ["旬空", "六親", "他天将"], ["人物"], "天后の辰は空亡、末伝午は財（婦女子）で玄武＝別離・娼妓", "E", "inferred"),
  R("39-10", "訳注", "usage", ["白虎"], { b: "申" }, ["陰神", "位置"], ["場所"], "初伝戌（墳墓の土）の上神が申で白虎", "E", "inferred"),
  R("39-11", "訳注", "usage", ["白虎"], {}, [], ["存在"], "白虎には蟻の意味があると註にある", "E", "inferred"),
  // 例40 占墳地（天将盤不一致）
  R("40-1", "原文", "person", [], {}, [], ["人物"], "必ず貴人（高貴な人物）が出る", "-", "-"),
  R("40-2", "原文", "usage", ["天空"], { b: "酉" }, ["加臨（地盤支）", "支"], ["場所"], "戌が酉に加わり、酉は天空＝虚墳", "E", "inferred"),
  R("40-3", "原文", "usage", ["貴人"], { b: "卯", six: "子孫" }, ["六親"], ["人物"], "卯は子孫で貴人とし脱気とはしない", "E", "inferred"),
  R("40-4", "原文", "usage", ["貴人"], {}, ["位置"], ["存在"], "宅は貴人を得る", "E", "inferred"),
  R("40-5", "原文", "usage", ["貴人"], { b: "卯", six: "子孫" }, ["六親", "生剋・冲合刑害"], ["人物"], "癸は卯を脱気とみず、子孫に貴人が出る", "E", "inferred"),
  R("40-6", "原文", "person", [], {}, ["支"], ["人物"], "巳は双女、故に二人の貴人（人物）が出る", "-", "-"),
  R("40-7", "訳注", "usage", ["螣蛇"], { b: "辰", p: ["lesson3"], six: "官鬼" }, ["六親", "旬空", "位置"], ["吉凶"], "支上は螣蛇官鬼で悪そうだが空亡で凶意が減る", "E", "inferred"),
  R("40-8", "訳注", "usage", ["六合"], { b: "午", p: ["final"], six: "妻財" }, ["六親", "旬空", "位置"], ["存在"], "初伝中伝は空亡で末伝が財で六合", "E", "inferred"),
  R("40-9", "訳注", "usage", ["六合"], {}, ["問占（DOMAIN）"], ["行為"], "六合は交易、金を払って（墓地を）手に入れる", "E", "inferred"),
  R("40-10", "訳注", "usage", ["青龍"], { b: "申" }, ["十二長生", "加臨（地盤支）"], ["吉凶"], "申は水の長生で青龍が乗り未に臨むので吉", "E", "inferred"),
  R("40-11", "訳注", "meta", ["青龍", "貴人"], {}, [], [], "卯が貴人の場合の青龍は申（天将盤の方式の検討）", "-", "-"),
  R("40-12", "訳注", "usage", ["朱雀"], { b: "巳" }, ["支"], ["存在"], "巳に朱雀、朱雀は文書を示す", "E", "inferred"),
  // 例41 占宅（一致）
  R("41-1", "原文", "usage", ["勾陳"], { b: "卯", p: ["lesson1"], six: "官鬼" }, ["旬空", "生剋・冲合刑害", "位置"], ["状態"], "日上神は空亡で日を剋し勾陳", "D", "combined"),
  R("41-2", "原文", "usage", ["螣蛇"], { b: "午", p: ["lesson3"], six: "父母" }, ["日禄・羊刃・驛馬", "位置"], ["行為"], "宅上午は螣蛇が羊刃を帯びる＝家人が家で争いバラバラ", "B", "combined"),
  R("41-3", "原文", "usage", ["天空"], { b: "丑", p: ["initial"], six: "兄弟" }, ["加臨（地盤支）", "支", "位置"], ["状態", "場所"], "初伝丑は天空で卯上＝泥土が門を塞ぐ", "D", "combined"),
  R("41-4", "原文", "usage", ["太陰"], { b: "酉", p: ["final"] }, [], ["人物"], "太陰は若い婦人が家を仕切ることを表す", "D", "inferred", { caution: "原文はどの位置の太陰かを書かない。訳注 41-7 が末伝酉と読む" }),
  R("41-5", "訳注", "usage", ["螣蛇"], { b: "午", p: ["lesson3"], six: "父母" }, ["生剋・冲合刑害", "位置"], ["行為"], "日支申は支上午螣蛇に剋される＝早晩争いごと", "A", "combined"),
  R("41-6", "訳注", "usage", ["太陰"], {}, ["支", "位置"], ["人物", "状態"], "亥および支上太陰は女性器＝こしけ", "D", "inferred", { caution: "エンジン・断案の盤とも支上（三課上神）は午螣蛇で、太陰は末伝酉。位置の表記が盤と合わない" }),
  R("41-7", "訳注", "usage", ["太陰"], { b: "酉", p: ["final"], six: "子孫" }, ["生剋・冲合刑害", "位置"], ["人物"], "酉は太陰で婦人、卯と冲で日支申を助ける＝婦人が家を仕切る", "D", "combined"),
  R("41-8", "訳注", "usage", ["勾陳"], {}, ["年命・行年・太歳"], ["存在"], "勾陳は旧事、年命巳は戊の寄宮＝旧事が身にふりかかる", "B", "inferred"),
  // 例42 占宅（天将盤不一致）
  R("42-1", "訳注", "usage", ["青龍"], { b: "子", p: ["initial"] }, ["旬空", "位置"], ["成否"], "青龍は仕官を示すが空亡、中伝に至っても先々いいことがない", "E", "inferred"),
  // 例43 占前程（一致）
  R("43-1", "原文", "usage", ["白虎"], { b: "午", p: ["standing"], six: "兄弟" }, ["日禄・羊刃・驛馬", "年命・行年・太歳", "位置"], ["成否"], "午は丁の建禄で干上、行年とも白虎だが催官符使とする", "D", "combined",
    { role: { role: "authority", level: "inferred", note: "催官符使（任官を促す使い）。ROLE としての明示はない" } }),
  R("43-2", "原文", "usage", ["貴人"], { b: "亥", p: ["middle"] }, ["遁干", "課格"], ["状態"], "貴人は三奇（遁干）の中にあり前後に挟まれる", "B", "combined"),
  R("43-3", "原文", "usage", ["螣蛇"], { b: "子", p: ["initial"] }, ["天将の順序", "他天将"], ["吉凶"], "ここで螣蛇は吉将、前一先鋒（貴人の前一）", "D", "combined"),
  R("43-4", "訳注", "usage", ["螣蛇"], { b: "子", p: ["lesson3", "initial"], six: "官鬼" }, ["六親", "位置"], ["吉凶"], "螣蛇が支上初伝で官鬼螣蛇、いかにも悪そう", "C", "combined"),
  R("43-5", "訳注", "usage", ["螣蛇"], { b: "子", p: ["initial"], six: "官鬼" }, ["生剋・冲合刑害", "加臨（地盤支）"], ["吉凶"], "官鬼螣蛇は剋冲で凶意を解く（干上午と冲、地盤丑が剋）", "A", "combined"),
  R("43-6", "訳注", "usage", ["白虎"], { b: "午", p: ["standing"] }, ["支の五行", "天将の所属五行・干支", "位置"], ["吉凶", "状態"], "白虎が干上、午火が白虎（金）を抑えるので凶意なく権威の象徴", "B", "combined"),
  R("43-7", "訳注", "usage", ["天空"], { b: "巳", p: ["lesson2"] }, ["問占（DOMAIN）"], ["状態"], "天空は奉書の神で身を助ける", "C", "inferred",
    { role: { role: "support", level: "inferred", note: "「身を助ける」は訳注の読み。試験・前程の文脈（43-8）" } }),
  R("43-8", "訳注", "usage", ["天空"], {}, ["問占（DOMAIN）"], ["吉凶"], "天空は凶神だが試験においては吉神", "C", "inferred"),
  R("43-9", "訳注", "usage", ["貴人"], { b: "亥", p: ["middle", "lesson4"], six: "官鬼" }, ["支"], ["成否"], "亥に貴人＝貴人登天門で高位につく", "D", "combined"),
  R("43-10", "訳注", "usage", ["螣蛇"], { b: "子", p: ["initial"] }, ["生剋・冲合刑害", "他天将"], ["吉凶"], "末伝戌が子土螣蛇を剋し、干上午と火局、終わりもよい", "A", "combined", { caution: "本文は「子土螣蛇」と書く（子の五行は水）" }),
  // 例44 占応試（一致）
  R("44-1", "原文", "usage", ["勾陳"], { b: "亥", p: ["standing"], six: "子孫" }, ["位置", "問占（DOMAIN）"], ["成否"], "勾陳を得るので（試験に）落ちることはない", "C", "inferred"),
  R("44-2", "原文", "usage", ["勾陳"], { b: "亥", p: ["standing"] }, ["支", "位置"], ["状態"], "亥は水道、勾陳は滞神で日上＝本身は下痢の病", "D", "combined"),
  R("44-3", "原文", "usage", ["白虎"], { b: "寅", p: ["initial"], six: "妻財" }, ["六親", "月", "生剋・冲合刑害"], ["人物", "時期"], "庚は寅を妻とし、盗気の上、十月に臨んで白虎が加わり妻を喪う", "D", "combined"),
  R("44-4", "訳注", "usage", ["勾陳"], {}, ["六親", "問占（DOMAIN）"], ["存在"], "官に対する勾陳は印綬（断は下せない）", "C", "inferred"),
  R("44-5", "訳注", "usage", ["貴人"], { b: "未", p: ["lesson3"], six: "父母" }, ["年命・行年・太歳"], ["人物"], "未は本命で貴人、未の貴人は息子と考えられる", "B", "inferred"),
  // 例46 占前程（一致）
  R("46-1", "原文", "usage", ["天后"], { b: "子", p: ["final"], six: "妻財" }, ["六親", "坐空", "神殺（死気・桃花・死神など）", "位置"], ["人物", "時期"], "末伝は妻爻で空亡に坐し、天后穢神＝出産で亡くなる", "B", "combined"),
  R("46-2", "訳注", "usage", ["天后"], { b: "子", p: ["final"] }, ["神殺（死気・桃花・死神など）", "月", "加臨（地盤支）"], ["状態"], "天后穢神は六月の死神戌の上に天后があることか（訳者も推測）", "B", "inferred"),
  // 例47 占前程仕進（新法）
  R("47-1", "原文", "usage", ["六合"], { b: "申", p: ["initial"] }, ["加臨（地盤支）"], ["状態"], "六合が地を得ていない", "E", "inferred"),
  R("47-2", "原文", "usage", ["貴人"], { b: "亥" }, ["位置", "月"], ["成否", "時期"], "月将貴人が時上に乗じて身に臨み伝をなす＝四年後に立身出世", "E", "inferred"),
  R("47-3", "原文", "usage", ["玄武"], { b: "寅", p: ["final"] }, ["加臨（地盤支）", "天将の所属五行・干支", "月"], ["状態"], "玄武は本家（亥）に帰り黒殺となる", "E", "inferred"),
  R("47-4", "訳注", "meta", [], {}, [], [], "新法とは昼夜貴人が逆の注記", "-", "-"),
  R("47-5", "訳注", "nobleBranch", ["貴人"], { b: "亥" }, ["旬空"], ["存在"], "いわゆる簾幕貴人で、貴人であることにかわりない", "E", "inferred"),
  R("47-6", "訳注", "nobleBranch", ["貴人"], { b: "亥", p: ["middle"] }, ["旬空", "位置"], ["存在"], "中伝亥は空亡だが月将で簾幕貴人", "E", "inferred"),
  R("47-7", "訳注", "usage", ["玄武"], { p: ["final"] }, ["位置"], ["吉凶"], "末伝が玄武でも必ず凶ではない、配合がよければ官旺運（本書の注）", "E", "inferred"),
  R("47-8", "訳注", "meta", ["螣蛇", "白虎"], {}, [], [], "新法では申は螣蛇・寅は白虎（天将盤の方式の比較）", "-", "-"),
  // 例48 占前程（一致）
  R("48-1", "訳注", "usage", ["六合"], { b: "戌", p: ["initial"], six: "父母" }, ["生剋・冲合刑害", "位置"], ["吉凶", "成否"], "初伝は戌土六合で庚金を生ずるので凶というほどではない", "A", "combined"),
  R("48-2", "訳注", "usage", ["太常"], { b: "巳", p: ["middle"], six: "官鬼" }, ["六親", "位置"], ["行為"], "巳は官鬼で太常＝商売を表す", "D", "inferred"),
  // 例49 占前程（一致）
  R("49-1", "原文", "usage", ["玄武"], { b: "巳", p: ["initial"], six: "父母" }, ["日禄・羊刃・驛馬", "生剋・冲合刑害", "位置"], ["状態"], "初伝は破で玄武、驛馬でもある", "D", "combined"),
  R("49-2", "原文", "nobleBranch", ["貴人", "勾陳"], { b: "子", p: ["lesson1"] }, ["旬空", "位置"], ["存在"], "身宅みな貴人（己の昼夜貴人支 子・申）、子は勾陳、申は空亡", "B", "combined"),
  R("49-3", "原文", "nobleBranch", ["貴人"], { b: "申", p: ["lesson3"] }, ["旬空", "位置"], ["存在"], "申は空亡で夜貴人となり宅にある", "B", "combined"),
  R("49-4", "原文", "usage", ["玄武"], { b: "巳", p: ["lesson2", "initial"] }, ["加臨（地盤支）", "支の五行", "位置"], ["行為"], "身に玄武が乗じて子に加わり、上は火下は水、玄武は賊＝走範", "A", "combined", { caution: "「身」は干上（一課子）ではなく、その上の巳（二課・初伝）" }),
  R("49-5", "原文", "usage", ["白虎"], { b: "卯", p: ["final"], six: "官鬼" }, ["加臨（地盤支）", "課格"], ["状態"], "卯が白虎で戌に加わる＝破模", "A", "combined"),
  R("49-6", "訳注", "usage", ["螣蛇"], { b: "酉" }, ["年命・行年・太歳"], ["存在"], "本命酉で螣蛇＝鶏が驚く", "B", "inferred"),
  R("49-7", "訳注", "usage", ["太常"], {}, ["課格", "天将が三伝にない"], ["成否"], "巳戌卯は鋳印乗軒課、太常があれば吉だが吉将がないので鋳印課とはいえない", "D", "combined"),
  R("49-8", "訳注", "usage", ["白虎"], { b: "卯", p: ["final"], six: "官鬼" }, ["六親", "位置"], ["存在"], "末伝が官鬼白虎＝（現代なら）交通事故の恐れ", "D", "inferred"),
  // 例51 占科試（一致）
  R("51-1", "原文", "nobleBranch", ["太陰", "貴人"], { b: "卯", p: ["lesson1", "middle"] }, ["位置"], ["状態"], "太陰が卯（癸の夜貴人支）に乗じて幕貴、日干に加わる。日貴（巳）は末伝", "B", "combined"),
  R("51-2", "原文", "nobleBranch", ["貴人"], { b: "辰" }, ["年命・行年・太歳"], ["成否"], "寅上辰は年命、昼夜貴人（卯・巳）がはさむ＝必ず及第", "B", "combined"),
  R("51-3", "訳注", "nobleBranch", ["貴人"], {}, ["位置"], ["成否"], "昼夜貴人が一課二課と中伝末伝にあり合格は疑いない", "B", "combined"),
  // 例52 占前程（一致）
  R("52-1", "原文", "nobleBranch", ["貴人"], {}, [], ["状態"], "満局みな貴人（丁の昼夜貴人支 亥・酉）、多くは謀", "B", "combined"),
  R("52-2", "原文", "usage", ["朱雀"], { b: "酉", p: ["standing"], six: "妻財" }, ["年命・行年・太歳", "位置"], ["行為", "成否"], "日上に太歳（酉）が来て朱雀＝上申書、何の益もない", "B", "combined"),
  R("52-3", "原文", "usage", ["朱雀"], { b: "酉", p: ["standing"] }, ["年命・行年・太歳", "位置"], ["行為"], "日上太歳が朱雀＝上申書を欲する", "B", "combined"),
  R("52-4", "原文", "nobleBranch", ["貴人"], {}, ["位置"], ["成否"], "三伝日上ともに貴人、貴が多いのは貴としない", "B", "combined"),
  R("52-5", "原文", "nobleBranch", ["貴人"], { b: "酉", p: ["standing"] }, ["生剋・冲合刑害"], ["状態"], "酉が日上に加わり、それに貴人を加えて、かえって申を剋する", "B", "inferred"),
  R("52-6", "訳注", "nobleBranch", ["貴人"], {}, ["位置"], ["状態"], "一課二課ともに昼夜貴人", "B", "combined"),
  R("52-7", "訳注", "nobleBranch", ["貴人"], { b: "酉", p: ["standing"] }, ["旬空", "位置"], ["状態"], "干上は空亡で貴人は落空", "B", "combined"),
  R("52-8", "訳注", "usage", ["朱雀"], { b: "酉", p: ["standing"], six: "妻財" }, ["六親"], ["人物"], "財に朱雀＝派手な妾", "D", "combined"),
  R("52-9", "訳注", "nobleBranch", ["貴人"], {}, [], ["状態"], "貴人が多くても貴とはいえない、行いが悪ければ貴人が働かない", "D", "inferred"),
  // 例53 占昇遷（天将盤不一致）
  R("53-1", "原文", "usage", ["白虎"], { b: "寅", p: ["lesson3"], six: "父母" }, ["六親", "位置"], ["人物"], "白虎が宅にあり、父母が乗ずる", "E", "inferred"),
  R("53-2", "訳注", "usage", ["青龍", "螣蛇"], { p: ["initial", "final"] }, ["旬空", "他天将", "位置"], ["成否"], "末伝空亡、青龍が螣蛇になる＝竜頭蛇尾", "E", "inferred"),
  R("53-3", "訳注", "usage", ["白虎"], { b: "寅" }, ["生剋・冲合刑害"], ["状態"], "白虎寅と冲", "E", "inferred"),
  R("53-4", "訳注", "usage", ["白虎"], {}, ["天将の所属五行・干支", "生剋・冲合刑害"], ["状態"], "棺が白虎（金神）に剋され朽ちている", "E", "inferred"),
  R("53-5", "訳注", "usage", ["青龍", "螣蛇"], { b: "辰", p: ["initial", "final"], six: "子孫" }, ["六親", "他天将", "位置"], ["成否"], "子孫の辰が青龍、末伝は螣蛇＝竜頭蛇尾", "E", "inferred"),
  // 例54 占武試（一致）
  R("54-1", "原文", "usage", ["太常"], {}, ["日禄・羊刃・驛馬", "旬空", "天将が三伝にない", "問占（DOMAIN）"], ["成否"], "庚禄申は空、太常は入伝せず、よって武は不可", "C", "combined"),
  R("54-2", "原文", "usage", ["青龍", "天后"], { b: "寅", p: ["middle"], six: "妻財" }, ["天将の所属五行・干支", "加臨（地盤支）"], ["状態"], "寅上青龍は入廟（青龍の所属甲寅）、天后は恩沢の神", "B", "combined",
    { role: { role: "support", level: "inferred", note: "「天后は恩沢の神」。どの位置の天后を指すか本文は書かない（盤では初伝・一課・二課の申）" } }),
  R("54-3", "原文", "usage", ["朱雀"], { b: "巳", p: ["final"], six: "官鬼" }, ["六親", "十二長生", "位置", "問占（DOMAIN）"], ["成否"], "末伝巳は朱雀で長生、官星学堂、故に科甲", "C", "combined"),
  R("54-4", "訳注", "usage", ["朱雀"], { b: "巳", p: ["final"] }, ["問占（DOMAIN）", "位置"], ["成否"], "武でなく文なのは末伝巳が朱雀だから", "C", "combined"),
  R("54-5", "訳注", "usage", ["朱雀"], { b: "巳", p: ["final"] }, ["天将の所属五行・干支", "支の五行"], ["状態"], "朱雀は文章で、巳火に旺じる", "B", "combined"),
  // 例55 占比試弓馬取功名（一致）
  R("55-1", "原文", "usage", ["青龍"], { b: "午", p: ["standing", "final"], six: "父母" }, ["日禄・羊刃・驛馬", "位置"], ["成否", "人物"], "陽刃午は青龍で、少しばかり兵部の好意を得る", "B", "combined",
    { role: { role: "support", level: "inferred", note: "「兵部の好意」。ROLE としての明示はない" } }),
  R("55-2", "原文", "usage", ["玄武"], { b: "戌", p: ["initial"], six: "兄弟" }, ["生剋・冲合刑害", "位置"], ["状態"], "初伝戌は玄武で六害（戌加酉）", "A", "combined"),
  R("55-3", "訳注", "usage", ["玄武", "太常"], { b: "戌", p: ["lesson4"] }, ["他天将", "陰神"], ["状態", "存在"], "酉が太常で衣服、その上神戌が玄武で汚れ", "B", "combined"),
  R("55-4", "訳注", "usage", ["青龍"], { b: "午", p: ["final"], six: "父母" }, ["日禄・羊刃・驛馬", "生剋・冲合刑害", "位置"], ["成否"], "末伝午は陽刃でも青龍で日干を生じ、わずかに利", "B", "combined"),
  // 例56 占前程（新法）
  R("56-1", "原文", "usage", ["太常"], { b: "亥", p: ["standing"] }, ["日禄・羊刃・驛馬", "位置"], ["状態"], "日干が禄をいただき太常を兼ねる", "E", "inferred"),
  R("56-2", "原文", "usage", ["玄武"], { b: "子" }, ["月", "神殺（死気・桃花・死神など）"], ["存在"], "月建の一つ先の子に玄武、これは天医", "E", "inferred"),
  R("56-3", "原文", "usage", ["六合", "天后"], { b: "午" }, ["年命・行年・太歳"], ["存在"], "行年午と冲、午は六合で、昼貴人ならば天后", "E", "inferred"),
  R("56-4", "原文", "usage", ["玄武", "六合", "天后"], {}, ["他天将"], ["人物"], "玄武・六合・天后がそろう＝貪色不正", "E", "inferred"),
  R("56-5", "訳注", "meta", [], {}, [], [], "新法では夜貴人が巳で昼夜逆の注記", "-", "-"),
  R("56-6", "訳注", "meta", ["天空", "天后", "青龍"], {}, [], [], "新法での配置（亥天空・午天后・子青龍）", "-", "-"),
];

/** 講座（B）の天将の記述（ページ画像で確認） */
const KOZA = [
  { page: "p56", gist: "十二天将象意の表（各天将に所属干支と、10前後の象意語・色・数を並べる）。占目・位置・六親との組合せは書かない" },
  { page: "p58", gist: "発端門（初伝）: 初伝自体の十二天将や、初伝と日干・一課・三課などの関係をみて事件のきっかけを知る" },
  { page: "p59", gist: "帰計門（末伝）: 末伝が空亡だったり天空だったりすると、終わりはすっきりしない" },
  { page: "p60", gist: "占時の見方: 占時が空亡なら十二天将の象意を空しくする。占時の六親・十二天将はその象意が占おうとすることに直結することが多い" },
  { page: "p66", gist: "空亡: 三伝が全部空亡、または一つが天空で他が空亡なら得るものがない（悪いこと・心配事もなくなる場合もある）" },
  { page: "p67", gist: "判断の基本: 一課・三課の強弱、三伝との関係、天将の吉凶・象意、各種神殺から推測する（天将は材料の一つ）" },
];

// ---- 照合 ----
const POS_BRANCH = (f: InterpretationFacts, p: Pos): Branch => {
  switch (p) {
    case "standing": case "lesson1": return f.lessons[0].upper;
    case "lesson2": return f.lessons[1].upper;
    case "lesson3": return f.lessons[2].upper;
    case "lesson4": return f.lessons[3].upper;
    case "initial": return f.transmissions![0].branch;
    case "middle": return f.transmissions![1].branch;
    case "final": return f.transmissions![2].branch;
  }
};
const factsOf = (n: number) => {
  const e = EX[n];
  return buildInterpretationFacts(calculateLiuren({ dayStem: e.day[0] as Stem, dayBranch: e.day[1] as Branch, divinationBranch: e.shi, monthGeneral: e.jiang }));
};

// 1. 記録の数（断案２の本文で天将名を含む文。抽出テキストで数えた 142文）
check("記録は断案２の天将名を含む142文すべて", RECS.length === 142, String(RECS.length));
check("記録の ID は重複しない", new Set(RECS.map((r) => r.id)).size === RECS.length);
for (const [n, k] of Object.entries(RECS.reduce((o, r) => ({ ...o, [r.ex]: (o[r.ex] ?? 0) + 1 }), {} as Record<number, number>))) {
  const ids = RECS.filter((r) => r.ex === Number(n)).map((r) => Number(r.id.split("-")[1]));
  if (ids.join() !== Array.from({ length: k }, (_, i) => i + 1).join()) check(`例${n} の文番号が連番`, false, ids.join());
}

// 2. 天将盤が一致する例: 支・位置・天将・六親をエンジンの FACT と照合
let verified = 0;
for (const r of RECS) {
  const e = EX[r.ex];
  if (!e) { check(`${r.id} 例の盤`, false); continue; }
  if (e.board === "mismatch") {
    if (r.kind !== "meta" && r.kind !== "person" && r.cls !== "E") check(`${r.id} 天将盤不一致の例は E`, false, r.cls);
    continue;
  }
  if (r.cls === "E") check(`${r.id} 天将盤が一致する例を E にしない`, false);
  if (r.kind !== "usage" || !r.pos || !r.branch) continue;
  const f = factsOf(r.ex);
  for (const p of r.pos) {
    const b = POS_BRANCH(f, p);
    if (b !== r.branch) { check(`${r.id} ${p} の支`, false, `${b} / ${r.branch}`); continue; }
    const g = heavenlyGeneralStateOf(f, b).general;
    if (!r.generals.includes(g)) check(`${r.id} ${p} ${b} の天将`, false, `${g} / ${r.generals.join("・")}`);
    if (r.six) {
      const six = p === "initial" || p === "middle" || p === "final"
        ? f.transmissions![["initial", "middle", "final"].indexOf(p)].relation
        : f.lessons[p === "standing" ? 0 : Number(p.slice(-1)) - 1].relation;
      if (six !== r.six) check(`${r.id} ${p} の六親`, false, `${six} / ${r.six}`);
    }
    verified += 1;
  }
}
check("天将盤が一致する例の位置・支・天将・六親を照合した", verified > 0, String(verified));

// 個別の FACT（本文の判断材料が既存 FACT で表せるか）
{
  const f35 = factsOf(35);
  check("例35 末伝午は酉上（SiteState の siteBranch＝酉）", siteStateOf(f35, "午").siteBranch === "酉");
  check("例35 末伝午の十二長生（日干丁基準）は帝旺で、本文の「死気」は十二長生・旺相休囚死ではない（正月の神殺）", growthStageOfStem("丁", "午") === "帝旺");
  const f37 = factsOf(37);
  check("例37 子加卯は刑（SiteState の structural に punishes）", siteStateOf(f37, "子").structural.relations.includes("punishes"));
  const f41 = factsOf(41);
  check("例41 初伝丑は卯上（siteBranch＝卯）", siteStateOf(f41, "丑").siteBranch === "卯");
  check("例41 三課上神午は日支申を剋す", f41.lessons[2].upper === "午" && f41.basic.dayBranch === "申");
  const f43 = factsOf(43);
  check("例43 初伝子は地盤丑に剋される（SiteState: 子→丑 overcomeBy）", siteStateOf(f43, "子").relation === "overcomeBy");
  const f46 = factsOf(46);
  check("例46 末伝子（妻財・天后）は坐空（地盤戌が旬空）", isSeatedOnVoid(f46, "子") && f46.transmissions![2].relation === "妻財" && heavenlyGeneralStateOf(f46, "子").general === "天后");
  const f49 = factsOf(49);
  check("例49 初伝巳は驛馬（日支卯の驛馬＝巳）・地盤子（上は火・下は水）", f49.transmissions![0].branch === "巳" && siteStateOf(f49, "巳").siteBranch === "子");
  check("例49 末伝卯は戌上で六合（SiteState: combines）", siteStateOf(f49, "卯").structural.relations.includes("combines"));
  const f54 = factsOf(54);
  check("例54 末伝巳＝官鬼・長生・朱雀", f54.transmissions![2].relation === "官鬼" && growthStageOfStem("庚", "巳") === "長生" && heavenlyGeneralStateOf(f54, "巳").general === "朱雀");
  check("例54 太常は三伝にない（「太常は入伝せず」）", f54.transmissions!.every((t) => t.general !== "太常"));
  const f55 = factsOf(55);
  check("例55 初伝戌は酉上で六害（SiteState: harms）", siteStateOf(f55, "戌").structural.relations.includes("harms"));
}

// 3. 本文の「貴人」が昼夜貴人支を指す文: その支は NOBLE_DAY・NOBLE_NIGHT のどちらか
for (const r of RECS.filter((x) => x.kind === "nobleBranch" && x.branch && EX[x.ex].board === "match")) {
  const stem = EX[r.ex].day[0] as Stem;
  const nobles = [NOBLE_DAY[stem], NOBLE_NIGHT[stem]];
  // 例51-2 の辰は「昼夜貴人がはさむ年命」なので、はさむ側（卯・巳）を見る
  const target = r.id === "51-2" ? null : r.branch!;
  if (target && !nobles.includes(target)) check(`${r.id} ${target} は ${stem} の昼夜貴人支（${nobles.join("・")}）`, false);
}
check("例49 己の昼夜貴人支は子・申（身宅みな貴人）", [NOBLE_DAY.己, NOBLE_NIGHT.己].join() === "子,申");
check("例51 癸の昼夜貴人支は巳・卯（辰をはさむ）", [NOBLE_DAY.癸, NOBLE_NIGHT.癸].sort().join() === ["卯", "巳"].sort().join());
check("例52 丁の昼夜貴人支は亥・酉（満局みな貴人）", [NOBLE_DAY.丁, NOBLE_NIGHT.丁].join() === "亥,酉");
{
  // 例51・52 の「昼夜貴人が一課二課」は天将の貴人ではない（天将の貴人は1支だけ）
  const f51 = factsOf(51);
  check("例51 一課卯の天将は太陰（「昼夜貴人」は天将の貴人ではない）", heavenlyGeneralStateOf(f51, f51.lessons[0].upper).general === "太陰");
  const f52 = factsOf(52);
  check("例52 一課酉の天将は朱雀（「昼夜貴人」は天将の貴人ではない）", heavenlyGeneralStateOf(f52, f52.lessons[0].upper).general === "朱雀");
}

// 4. 分類の整合: ROLE 候補は direct にしない・本番 registry は変えていない
check("ROLE 候補はすべて inferred（資料が ROLE を直接は書かない）", RECS.every((r) => !r.role || r.role.level === "inferred"));
check("一例しかない記録を direct にしない（direct は0件）", RECS.every((r) => r.level !== "direct"));
{
  const src = readFileSync("src/lib/liuren/interpretation/roleRules.ts", "utf8");
  check("本番 registry に天将のルールを追加していない", !/kind: "heavenlyGeneral", value/.test(src.split("SEMANTIC_ROLE_RULES")[1] ?? ""));
}

// ---- 集計 ----
const usage = RECS.filter((r) => r.kind === "usage" || r.kind === "nobleBranch");
const byGeneral: Record<string, number> = {};
const byGeneralUsage: Record<string, number> = {};
for (const r of RECS) for (const g of r.generals) inc(byGeneral, g);
for (const r of RECS.filter((x) => x.kind === "usage")) for (const g of r.generals) inc(byGeneralUsage, g);
const byKind: Record<string, number> = {};
const byLayer: Record<string, number> = {};
const byDomain: Record<string, number> = {};
const byPos: Record<string, number> = {};
const byCombo: Record<string, number> = {};
const byJudge: Record<string, number> = {};
const byClass: Record<string, number> = {};
const byLevel: Record<string, number> = {};
const byBoard: Record<string, number> = {};
for (const r of RECS) {
  inc(byKind, r.kind); inc(byLayer, r.layer);
  if (r.kind === "meta" || r.kind === "person") continue;
  inc(byDomain, EX[r.ex].domain); inc(byClass, r.cls); inc(byLevel, r.level); inc(byBoard, EX[r.ex].board);
  for (const p of r.pos ?? ["位置の明示なし"]) inc(byPos, p);
  for (const c of r.combos) inc(byCombo, c);
  for (const j of r.judge) inc(byJudge, j);
}
const alone = usage.filter((r) => r.combos.length === 0 || r.combos.every((c) => c === "問占（DOMAIN）"));
const fmt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v}`).join(" ");
console.log(`記録 ${RECS.length}文: ${fmt(byKind)} ／ ${fmt(byLayer)}`);
console.log(`天将別（記録に出る天将名。meta 含む）: ${GENERALS.map((g) => `${g}${byGeneral[g] ?? 0}`).join(" ")}`);
console.log(`天将別（usage のみ）: ${GENERALS.map((g) => `${g}${byGeneralUsage[g] ?? 0}`).join(" ")}`);
console.log(`DOMAIN 別: ${fmt(byDomain)} ／ 天将盤 ${fmt(byBoard)}`);
console.log(`位置別: ${fmt(byPos)}`);
console.log(`併用 FACT: ${fmt(byCombo)}`);
console.log(`判断の種類: ${fmt(byJudge)}`);
console.log(`Rule 化の分類: ${fmt(byClass)} ／ 支持の強さ: ${fmt(byLevel)}`);
console.log(`天将以外の併用がない（単独に見える）文: ${alone.map((r) => r.id).join(" ")}`);
console.log(`ROLE 候補: ${RECS.filter((r) => r.role).map((r) => `${r.id} ${r.generals.join("・")}→${r.role!.role}`).join(" ／ ")}`);
console.log(`講座: ${KOZA.map((k) => k.page).join("・")}`);
console.log(`エンジンで照合した位置: ${verified}`);
console.log(`PASS ${pass} / FAIL ${failures.length}`);
if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("ALL PASS");
