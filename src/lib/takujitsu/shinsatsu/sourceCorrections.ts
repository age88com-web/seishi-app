// src/lib/takujitsu/shinsatsu/sourceCorrections.ts
//
// 役割:
//   神殺の表で、コードが採用している値が『擇日テキスト.pdf』の印字（原文値）と
//   異なる箇所、または原文値に誤植の疑いがあるが原文どおり保持している箇所の台帳。
//   次の3つを明示的に分けて管理する。
//     ・原文値（sourceValue）   … 擇日テキスト.pdf の印字
//     ・採用値（adoptedValue）  … 今コードが判定に使っている値
//     ・監修候補値（candidateValue）… 誤植の疑いがある場合に、正しいかもしれない値（未確定。コードには使わない）
//   監修確定前は、誤植の疑いがあっても採用値＝原文値とし、候補値は台帳にだけ置く（黙って補正しない）。
//
// 運用:
//   ・神殺の表を原文と異なる値にする場合は、必ずここに1件追加する（黙って直さない）。
//   ・status が "監修未確認" のものは、実装者の判断で採用値を決めている（またはまだ原文どおり）。
//     監修で確定したら "監修確定" に変え、confirmedAt に日付を入れる。
//   ・誤植の疑いがあるが監修確定まで原文どおり保持しているものは kind "原文保持（誤植疑い）" とし、
//     adoptedValue を sourceValue と同じにする。
//   ・tests/takujitsu_source_corrections_unit.manual.ts が、各項目について
//     コードの判定が adoptedValue のとおりになっていることを確認する。
//
// 根拠: 2026-10-06 の原文照合監査（docs/takujitsu_source_audit_20261006.md）。

export type SourceCorrectionKind =
  /** 字形の誤植（成→戌、末→未、嘴→觜など）を正しい字に直して採用 */
  | "字形正規化"
  /** 原文の表で同じ値が重複して印字されているのを1つにまとめて採用 */
  | "重複除去"
  /** 原文の印字どおりでは表が成り立たないため、別の値に読み替えて採用 */
  | "読替"
  /** 誤植の疑いがあるが、監修確定まで原文どおり保持 */
  | "原文保持（誤植疑い）";

export type SourceCorrectionStatus = "監修未確認" | "監修確定";

export interface SourceCorrection {
  readonly id: string;
  readonly shinsatsu: string;
  /** 擇日テキスト.pdf の印刷ページと項目番号。 */
  readonly location: string;
  /** 原文の印字。 */
  readonly sourceValue: string;
  /** コードが採用している値（判定に使っている値）。 */
  readonly adoptedValue: string;
  /** 監修候補値（誤植の疑いがある場合の候補。未確定でコードには使わない）。 */
  readonly candidateValue?: string;
  /** 監修候補値の出所（擇日実例.pdf・表の規則性など）。 */
  readonly candidateBasis?: string;
  readonly kind: SourceCorrectionKind;
  readonly status: SourceCorrectionStatus;
  readonly confirmedAt?: string;
  readonly note?: string;
}

export const SOURCE_CORRECTIONS: readonly SourceCorrection[] = [
  // ---- 字形正規化（コードが原文を黙って直していたもの。2026-10-06 に台帳化） ----
  { id: "fujiang-4-bingxu", shinsatsu: "不將", location: "p.13-14 (24) 四月", sourceValue: "丙成", adoptedValue: "丙戌", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-4-jiaxu", shinsatsu: "不將", location: "p.13-14 (24) 四月", sourceValue: "甲成", adoptedValue: "甲戌", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-4-wuxu", shinsatsu: "不將", location: "p.13-14 (24) 四月", sourceValue: "戊成", adoptedValue: "戊戌", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-5-guiwei", shinsatsu: "不將", location: "p.13-14 (24) 五月", sourceValue: "癸末", adoptedValue: "癸未", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-6-yiwei", shinsatsu: "不將", location: "p.13-14 (24) 六月", sourceValue: "乙末", adoptedValue: "乙未", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-7-yiwei", shinsatsu: "不將", location: "p.13-14 (24) 七月", sourceValue: "乙末", adoptedValue: "乙未", kind: "字形正規化", status: "監修未確認" },
  { id: "fujiang-8-guiwei", shinsatsu: "不將", location: "p.13-14 (24) 八月", sourceValue: "癸末", adoptedValue: "癸未", kind: "字形正規化", status: "監修未確認" },
  { id: "qisheng-yiwei", shinsatsu: "七聖", location: "p.18 (41) 20番目", sourceValue: "乙末", adoptedValue: "乙未", kind: "字形正規化", status: "監修未確認" },
  { id: "jingui-si", shinsatsu: "金匱", location: "p.15 (28) 月令巳", sourceValue: "成", adoptedValue: "戌", kind: "字形正規化", status: "監修未確認" },
  { id: "jingui-hai", shinsatsu: "金匱", location: "p.15 (28) 月令亥", sourceValue: "成", adoptedValue: "戌", kind: "字形正規化", status: "監修未確認" },
  { id: "siming-shen", shinsatsu: "司命", location: "p.15 (28) 月令申", sourceValue: "成", adoptedValue: "戌", kind: "字形正規化", status: "監修未確認" },
  { id: "fudanri-you", shinsatsu: "伏斷日", location: "p.40 (44) 酉", sourceValue: "嘴", adoptedValue: "觜", kind: "字形正規化", status: "監修未確認", note: "二十八宿の表記（CalendarEngine 側の宿名）に合わせた異体字の統一。" },

  // ---- 重複除去 ----
  { id: "tianfu-jisi-dup", shinsatsu: "天福", location: "p.18 (39)", sourceValue: "己巳（2回印字、計10セル）", adoptedValue: "己巳（1回、計9干支）", kind: "重複除去", status: "監修未確認", note: "判定結果は変わらない。2つ目の己巳が別の干支の誤植である可能性は未確認。" },

  // ---- 読替：なし（2026-10-06 に天空・地空の卯年の読替を撤回し、原文保持へ移した） ----

  // ---- 原文保持（誤植疑い）：監修確定まで原文どおり ----
  { id: "shenzai-gengwu", shinsatsu: "神在", location: "p.18 (40)", sourceValue: "庚戊", adoptedValue: "庚戊", candidateValue: "庚戌", candidateBasis: "戊と戌の字形の類似（推定。他の候補もありうる）", kind: "原文保持（誤植疑い）", status: "監修未確認", note: "干支として成り立たないため、この1件は成立しない。" },
  { id: "bingxiao-wajie-chouwei-10", shinsatsu: "冰消瓦解", location: "p.39 (42) 丑未年 十月", sourceValue: "1,9,15,21,27", adoptedValue: "1,9,15,21,27", candidateValue: "3,9,15,21,27", candidateBasis: "表の他の72セルはすべて6日おきの等差（規則性からの推定）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "bingxiao-wajie-maoyou-2", shinsatsu: "冰消瓦解", location: "p.39 (42) 卯酉年 二月", sourceValue: "1,9,15,21,27", adoptedValue: "1,9,15,21,27", candidateValue: "3,9,15,21,27", candidateBasis: "表の他の72セルはすべて6日おきの等差（規則性からの推定）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "xiawu-yang-39", shinsatsu: "下兀", location: "p.37 (39) 陽年 三・九月 赤口(下兀)", sourceValue: "4,10,16,22,23", adoptedValue: "4,10,16,22,23", candidateValue: "4,10,16,22,28", candidateBasis: "表の他のセルはすべて6日おきの等差（規則性からの推定）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "xiawu-yin-612", shinsatsu: "下兀", location: "p.37 (39) 陰年 六・十二月 赤口(下兀)", sourceValue: "4,10,16,22,29", adoptedValue: "4,10,16,22,29", candidateValue: "4,10,16,22,28", candidateBasis: "表の他のセルはすべて6日おきの等差（規則性からの推定）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "wenru-wenchu-3", shinsatsu: "瘟入・瘟出", location: "p.38 (41) 三月", sourceValue: "瘟入3・瘟出4", adoptedValue: "瘟入3・瘟出4", candidateValue: "瘟入3・瘟出6 または 瘟入1・瘟出4", candidateBasis: "他の11か月は瘟出＝瘟入＋3（どちらが誤りかは規則性からは決まらない）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "changxing-9", shinsatsu: "長星", location: "p.34 (29) 九月", sourceValue: "4", adoptedValue: "4", candidateValue: "3・4", candidateBasis: "擇日実例.pdf の九月（寒露〜霜降）の見出しに「三日四日長星」とある（採用資料2）", kind: "原文保持（誤植疑い）", status: "監修未確認" },
  { id: "tiankong-mao-row6", shinsatsu: "天空・地空", location: "p.42 (47) 卯年の列・地空「4,12,20,28」／天空「8,16,24」の行", sourceValue: "四月・十月・二月", adoptedValue: "四月・十月・二月", candidateValue: "四月・十二月", candidateBasis: "印字どおりでは卯年の二月・十月が2行に重なり十二月がどの行にも無い。他の列はこの行が「四月・十二月」型", kind: "原文保持（誤植疑い）", status: "監修未確認", note: "2026-10-06 まではコードが黙って十二月と読み替えていた。監修確定まで原文どおりに戻した（卯年の二月・十月は2行の両方に該当、十二月は該当なし）。" },
];
