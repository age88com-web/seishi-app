// src/lib/takujitsu/shinsatsu/kyoushinGroup6.ts
//
// 役割:
//   擇日「日家凶神」1〜53番の全件棚卸しで回収した、判定式が本文だけで
//   確定できるにもかかわらず未実装だった残りの凶神をまとめて実装する。
//   既存の CalendarEngine / lunisolar / jianchu / shuku28 / 吉神Group1〜6 /
//   凶神Group1〜5 は一切変更していない。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf「日家凶神」章1〜53番（このPDF以外は
//   一切参照していない）。要約・補完・推測はしていない。
//
// 今回追加した項目と根拠ページ（すべてPyMuPDF座標抽出で確認済み）:
//   ・8）月厭・厭對（招搖）        p.24（月刑の表の直前に別領域で存在。
//     フォントのCID起因で「厭」の字が「མ」に文字化けしているが、
//     座標上は明確に別表であることを確認した）
//   ・25）上朔                    p.29
//   ・27）月忌日                  p.30
//   ・29）長星・短星              p.34
//   ・35）揚公忌                  p.36
//   ・36）横天朱雀                p.36
//   ・38）四不詳                  p.37
//   ・39）上兀（留紳）・下兀（赤口） p.37-38
//   ・41）瘟星入出日（瘟入・瘟出）  p.38
//   ・42）冰消瓦解・冰消瓦碎       p.39
//   ・43）受死日                  p.40
//   ・44）伏斷日・埋兒凶宿（真滅没・密日・裁衣吉凶宿は今回対象外。後述）p.40-41
//   ・45）周堂殺（諸家周堂は今回対象外。後述）p.42
//   ・47）天空・地空              p.42
//   ・48）大空亡・小空亡          p.43
//   ・49）天乙絶気                p.43
//   ・50）四方耗                  p.44
//   ・52）刀砧日                  p.45
//   ・53）龍禁                    p.45
//
// 判定キーについて（ユーザー指示どおり統一していない。それぞれ本文の
// 表の構造をそのまま使う）:
//   ・monthBranch（月令＝月建）固定表: 月厭・厭對・受死日
//   ・monthBranch三合トリオ（季節）: 四方耗・刀砧日
//   ・dayStem＋dayBranch（日干支）固定列挙: なし（本グループでは無し）
//   ・yearStem固定表＋lunarDay＝1: 上朔（2026-10-06 本文「陰暦の1日で新月をいう」を条件に追加）
//   ・yearBranch陰陽（子寅辰午申戌＝陽／丑卯巳未酉亥＝陰）＋lunarMonth
//     ペア月グループ: 上兀（留紳）・下兀（赤口）
//   ・yearBranch六冲グループ（子午/丑未/寅申/卯酉/辰戌/巳亥）＋lunarMonth
//     ＋lunarDay: 冰消瓦解
//   ・yearBranch8グループ（戌亥/酉/未申/午/辰巳/卯/丑寅/子）＋lunarMonth
//     ＋lunarDay: 天空・地空
//   ・lunarMonthのみ＋lunarDay: 長星・短星・揚公忌・冰消瓦碎・大空亡・
//     小空亡・天乙絶気
//   ・lunarDayのみ（月に無関係）: 月忌日・横天朱雀・四不詳・周堂殺・龍禁
//   ・dayBranch＋二十八宿(lodge28): 伏斷日
//   ・lodge28固定列挙: 埋兒凶宿
//
// 「月令」表記の読み方について（重要。今回の棚卸しで確立した判断基準）:
//   本文には「月令」の見出しで「正・二・三…十二」という序数表記を使う
//   表が複数あるが、出力する値の種類によって実際に意味する暦が異なる。
//     ・出力が地支（例：受死日の「正→戌」）の表 → 正=寅・二=卯…という
//       標準対応で monthBranch（節月支）を指す。これは凶神第1〜4グループ
//       の歸忌（孟月＝正・四・七・十月→丑日 等）で確立済みの読み方と同じ
//       （歸忌はmonthBranchで実装され実例PDFとほぼ完全一致しているため、
//       この読み方の妥当性は既に検証済み）。
//     ・出力が暦日番号（1〜30。例：長星の「正→7」）の表 → 農暦月
//       （lunarMonth）＋農暦日（lunarDay）を指す。49）天乙絶気の本文
//       ワークサンプル「卯月で…旧暦の2月7日は…天乙絶気となる」が
//       「卯月＝旧暦2月」と明示しており、暦日番号を出力する表が真の
//       農暦（lunarMonth基準）であることを裏付けている。
//   この基準に基づき、本ファイルでは地支出力の表は monthBranch、
//   暦日番号出力の表は lunarMonth＋lunarDay で実装している。
//
// 天乙絶気の再検討について（凶神第5グループの記載を訂正）:
//   凶神第5グループのコメントでは「天乙絶気はmonthBranchだけで確定できる
//   固定表」としていたが、本グループでの再確認（上記のワークサンプル）に
//   より、実際は農暦月（lunarMonth）＋農暦日（lunarDay）を基準とする表
//   であると判断を改めた。凶神第5グループのファイル自体は変更していない
//   （コメントの記載のみが対象で、ロジックは元々実装されていなかった）。
//
// 満日（天狗、5番）について:
//   凶神第1グループで既に調査済みで、本文の説明（「戊の日の満日のみ」）と
//   擇日実例.pdfの内容が一致しないため保留と判定されている
//   （src/lib/takujitsu/shinsatsu/kyoushinGroup1.ts 参照）。今回の棚卸しで
//   再確認したが、新たな判定式は本文からは確定できないため、保留を維持し
//   本グループでは実装しない（重複調査のみ行い、再実装はしない）。
//
// 解除条件として記録した事項（今回は実装しない。将来の「神殺解除・相殺」
// フェーズ用の記録のみ）:
//   ・月厭・厭對: 「徳合、赦願が一緒になれば解除される」（p.24本文）。
//   ・受死日以外は本文に明示的な解除記載なし（上朔・月忌日・長星短星等は
//     本文に解除条件の記載自体が無い）。
//
// 保留（今回実装しない。理由を明記）:
//   ・32）伏社: 本文を再確認したが、「忌：」の記載および成立条件（何日を
//     もって忌とするかの判定式）が依然として本文中に見当たらない。夏至後
//     の庚日（初伏・中伏・末伏）、二分前後の戊日（春社・秋社）という
//     「起点」の説明はあるが、それ自体が凶神として成立する条件（忌む対象
//     の行為）が本文に無いため、判定式が確定できず保留を維持する。
//   ・33）朔・弦・望・十五日: 朔（lunarDay===1相当）・十五日
//     （lunarDay===15）は既存情報だけで判定できるが、上弦・下弦・望は
//     月相角度（0/90/180/270度）が必要で、CalendarEngineには朔（newMoon）
//     の時刻しかなく、上弦・下弦・望を求める公式APIが無い。本文は
//     「朔・弦・望・十五日」を１つの「忌：求医療病」でまとめて説明して
//     おり、単独の暦注として個別に切り出して良いか本文からは断定できない
//     （「望と十五日は重ならない時もある」との記載もあり、5つの概念を
//     安易に統合しない）。このグループを実装するためだけにCalendarEngine
//     やastro.tsを変更することはせず、今回は5つ全体を保留とし、
//     朔・弦・望・十五日専用の将来フェーズで扱う。
//   ・34）百忌日（彭祖忌）: 本文自体が「非常に多くなるため信用できず
//     気にする必要はない」と明記しているため実装対象外とする。
//   ・37）探病忌日: 本文自体が「非常に迷信的要素が強いため気にしなくて
//     良い」と明記しているため実装対象外とする。
//   ・44）真滅没・密日: 朔が角宿・望が牛宿・盈（十五日）が牛宿・弦が虚宿・
//     虚（旧暦29日）が鬼宿・晦（旧暦30日）が婁宿となる日、という判定式
//     だが、望・弦は33）と同じ理由（月相角度が不足）で判定できないため
//     保留する。
//   ・44）裁衣吉凶宿: 二十八宿ごとの吉凶一覧表はあるが、「裁衣」という
//     単一の活動専用の参照表であり、他の項目のような「この日は凶神が
//     成立する／しない」という一般的な占的とは性質が異なる（部分的な
//     用途限定の吉凶表）。汎用的な凶神一覧に混ぜることはせず、今回は
//     実装対象外として記録のみに留める。
//   ・45）諸家周堂: 本文が「信用できず気にする必要はない」と明記して
//     いるため実装対象外とする（周堂殺は同じ項目内だが本文中でこの
//     文言の直前に位置し、周堂殺自身への言及かどうか断定できないため、
//     周堂殺は実装対象に含めつつ、諸家周堂だけを除外した）。
//   ・46）食神殺（食主）: 本文自体が「諸家周堂殺などと似た理論で
//     信憑性がない」と明記しているため実装対象外とする。
//   ・51）山痕・田痕・水痕・金痕・土痕・土公占・驚走殺: PyMuPDF座標抽出で
//     確認したところ、7項目×大月/小月の14列の日数リストが列ごとに
//     要素数が不揃いで、列の境界を機械的に一意に確定できなかった
//     （原本画像でも確認が必要な水準の複雑さ）。また「大月／小月」
//     （その農暦月が30日か29日か）はCalendarEngineに専用フィールドが
//     無く、newMoonTime/nextNewMoonTimeの差から新たに導出する必要がある。
//     推測で列を確定させることはできないため、今回は保留とする。
//
// 検証区分:
//   月厭・厭對・受死日・四方耗・刀砧日は monthBranch＋dayBranch で
//   決まるため区分A（実例PDF照合対象）。それ以外（yearStem/yearBranch・
//   lunarMonth・lunarDay・二十八宿を使うもの）はいずれも擇日実例.pdfの
//   吉凶神煞一覧表（月令＋日辰の抽象的な参照表で実際の年月日を持たない）
//   では検証できないため区分B（擇日テキストの規定そのものを期待値とした
//   単体テストのみで検証）。

// 小耗・復日・五離 occurrence 完成フェーズ（2026-09-09）での追記:
//   docs/source/神殺象意.pdf（『擇日秘本萬年通書』日家神殺宜忌、原本画像
//   確認）を確認したところ、[小耗]の項に「按「小耗」為「舊月破」，又為
//   本月「閉日」之沖，故所忌如此」という成立条件の記述があった。
//   「本月の閉日の沖（対冲の地支）」＝十二直（十二建除）で「執」に
//   あたる日と数学的に等価（閉のstatusIndex=11、沖=+6で17≡5、
//   執のstatusIndex=5と一致。「舊月破（先月の月破）」でも同様に
//   monthBranch-1+6=monthBranch+5となり同じ結論）。既存の凍結済み
//   resolveJianchu()（src/lib/takujitsu/jianchu.ts、無変更）をそのまま
//   呼び出して判定する。擇日実例.pdf720行中、kyojinの残差テキストに
//   「小耗」が出現する58行全てで一致（TP=58/FN=0）、不一致は「中耗」と
//   表記された2行のみ（「小」→「中」のOCR起因の異体誤読の可能性が高い、
//   docs/takujitsu_xiaohao_fuyi_wuli_verification.md参照）。
//   復日・五離については、擇日テキスト.pdf・神殺象意.pdfのいずれにも
//   成立条件（判定式）の記述が見つからず、忌の列挙のみが記載されている
//   ため、今回は実装しない（推測で720行から逆算しない、DEFERREDのまま
//   維持）。

import { resolveJianchu } from "../jianchu";
import type { ShinsatsuInput, ShinsatsuResult } from "../types";

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

/** ［区分A］8）月厭（p.24）。月令（monthBranch）ごとに固定1地支。 */
const GETSUEN: Record<string, string> = {
  寅: "戌", 卯: "酉", 辰: "申", 巳: "未", 午: "午", 未: "巳",
  申: "辰", 酉: "卯", 戌: "寅", 亥: "丑", 子: "子", 丑: "亥",
};

/**
 * ［区分A］8）厭對（招搖、p.24）。月令ごとに固定1地支。
 * 本文の「厭對（招搖）六儀と同じ」のとおり、25）六儀（p.14、
 * 吉神第4グループ kichijinGroup4.ts で実装済み）と同一の値になっている
 * ことを座標抽出で確認済み（値をそのまま再掲するだけで、
 * kichijinGroup4.ts のロジックは呼び出さない＝再実装ではない）。
 */
const ENTAI: Record<string, string> = {
  寅: "辰", 卯: "卯", 辰: "寅", 巳: "丑", 午: "子", 未: "亥",
  申: "戌", 酉: "酉", 戌: "申", 亥: "未", 子: "午", 丑: "巳",
};

/** ［区分A］43）受死日（p.40）。月令ごとに固定1地支。 */
const JUSHIBI: Record<string, string> = {
  寅: "戌", 卯: "辰", 辰: "亥", 巳: "巳", 午: "子", 未: "午",
  申: "丑", 酉: "未", 戌: "寅", 亥: "申", 子: "卯", 丑: "酉",
};

/** 季節トリオ（寅午戌＝春、巳酉丑ではなく後述の四方耗独自グループに使用）。 */
const SEASON_TRIOS: readonly (readonly string[])[] = [
  ["寅", "午", "戌"],
  ["卯", "未", "亥"],
  ["辰", "申", "子"],
  ["巳", "酉", "丑"],
];

/** ［区分A］50）四方耗（p.44）。monthBranchの三合トリオごとに固定1暦日番号（lunarDay）。 */
const SHIHOMOU_BY_TRIO: readonly number[] = [2, 3, 4, 5];

/** ［区分A］52）刀砧日（p.45）。季節（monthBranch三支）ごとに固定2地支。 */
const TOCHINBI_SEASON_GROUPS: readonly (readonly string[])[] = [
  ["寅", "卯", "辰"],
  ["巳", "午", "未"],
  ["申", "酉", "戌"],
  ["亥", "子", "丑"],
];
const TOCHINBI_BY_SEASON: readonly (readonly string[])[] = [
  ["亥", "子"],
  ["寅", "卯"],
  ["巳", "午"],
  ["申", "酉"],
];

/** ［区分B］25）上朔（印刷 p.32）。yearStemごとに固定1干支。陰暦（農暦）の1日であることも条件（本文）。 */
const JOSAKU_BY_YEARSTEM: Record<string, string> = {
  甲: "癸亥", 乙: "己巳", 丙: "乙亥", 丁: "辛巳", 戊: "丁亥",
  己: "癸巳", 庚: "己亥", 辛: "乙巳", 壬: "辛亥", 癸: "丁巳",
};

/** ［区分B］27）月忌日（p.30）。lunarDayのみ（月に無関係）。 */
const GETSUKIBI_DAYS: readonly number[] = [5, 14, 23];

/** ［区分B］36）横天朱雀（p.36）。lunarDayのみ。 */
const OTENSUZAKU_DAYS: readonly number[] = [1, 9, 17, 25];

/** ［区分B］38）四不詳（p.37）。lunarDayのみ。 */
const SHIFUSHOU_DAYS: readonly number[] = [4, 7, 16, 19, 28];

/** ［区分B］45）周堂殺（p.42）。lunarDayのみ（諸家周堂は対象外）。 */
const SHUUDOUSATSU_DAYS: readonly number[] = [1, 7, 9, 15, 17, 23, 25];

/** ［区分B］53）龍禁（p.45）。lunarDayのみ。 */
const RYUUKIN_DAYS: readonly number[] = [2, 8, 14, 20, 26];

/**
 * ［区分B］29）長星・短星（p.34）。lunarMonth（1〜12）ごとに固定の
 * 暦日番号（複数の場合あり。八月の長星は2・5の2値、八月・九月の短星は
 * 18・19、16・17の2値。原本のまま、推測で1値に絞らない）。
 */
const CHOUSEI_BY_MONTH: readonly (readonly number[])[] = [
  [7], [4], [1], [9], [15], [10], [8], [2, 5], [4], [1], [12], [9],
];
const TANSEI_BY_MONTH: readonly (readonly number[])[] = [
  [21], [19], [16], [25], [25], [20], [22], [18, 19], [16, 17], [14], [22], [25],
];

/**
 * ［区分B］35）揚公忌（p.36）。lunarMonthごとに固定の暦日番号
 * （七月のみ1・29の2値）。
 */
const YOUKOUKI_BY_MONTH: readonly (readonly number[])[] = [
  [13], [11], [9], [7], [5], [3], [1, 29], [27], [25], [23], [21], [19],
];

/**
 * ［区分B］42）冰消瓦解（p.39）。yearBranchの六冲グループ（子午/丑未/
 * 寅申/卯酉/辰戌/巳亥）×lunarMonthごとに固定5暦日番号。
 * 丑未年の十月「1,9,15,21,27」・卯酉年の二月「1,9,15,21,27」は、
 * 他の月から推測される規則的な数列（丑未年十月なら本来3,9,15,21,27、
 * 卯酉年二月なら本来2,8,14,20,26）から外れた原本のままの値
 * （座標抽出で確認済み。転記ミスではなく原本の印字をそのまま採用し、
 * 規則性に合わせて「訂正」はしていない）。
 */
const HYOUSHOUGAKAI_GROUPS: Record<string, readonly (readonly number[])[]> = {
  子午: [
    [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28],
    [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30],
    [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26],
  ],
  丑未: [
    [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27],
    [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29],
    [4, 10, 16, 22, 28], [1, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25],
  ],
  寅申: [
    [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26],
    [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28],
    [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30],
  ],
  卯酉: [
    [4, 10, 16, 22, 28], [1, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25],
    [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27],
    [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29],
  ],
  辰戌: [
    [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30],
    [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26],
    [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28],
  ],
  巳亥: [
    [2, 8, 14, 20, 26], [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29],
    [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25],
    [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 28], [3, 9, 15, 21, 27],
  ],
};
const YEARBRANCH_TO_HYOUSHOUGAKAI_GROUP: Record<string, string> = {
  子: "子午", 午: "子午", 丑: "丑未", 未: "丑未", 寅: "寅申", 申: "寅申",
  卯: "卯酉", 酉: "卯酉", 辰: "辰戌", 戌: "辰戌", 巳: "巳亥", 亥: "巳亥",
};

/** ［区分B］42）冰消瓦碎（p.39）。lunarMonthごとに固定1暦日番号。 */
const HYOUSHOUGASAI_BY_MONTH: readonly number[] = [7, 8, 6, 7, 5, 6, 4, 5, 3, 4, 2, 3];

/**
 * ［区分B］48）大空亡・小空亡（p.43）。lunarMonthごとに固定4暦日番号
 * （8ヶ月周期。正月〜八月の8パターンを九月〜十二月が繰り返す）。
 */
const DAIKUUBOU_BY_MONTH: readonly (readonly number[])[] = [
  [6, 14, 22, 30], [5, 13, 21, 29], [4, 12, 20, 28], [3, 11, 19, 27],
  [2, 10, 18, 26], [1, 9, 17, 25], [8, 16, 24], [7, 15, 23],
  [6, 14, 22, 30], [5, 13, 21, 29], [4, 12, 20, 28], [3, 11, 19, 27],
];
const SHOUKUUBOU_BY_MONTH: readonly (readonly number[])[] = [
  [2, 10, 18, 26], [1, 9, 17, 25], [8, 16, 24], [7, 15, 23],
  [6, 14, 22, 30], [5, 13, 21, 29], [4, 12, 20, 28], [3, 11, 19, 27],
  [2, 10, 18, 26], [1, 9, 17, 25], [8, 16, 24], [7, 15, 23],
];

/** ［区分B］49）天乙絶気（p.43）。lunarMonthごとに固定1暦日番号（lunarDay）。 */
const TENOTSUZEKKI_BY_MONTH: readonly number[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** ［区分B］41）瘟星入出日（瘟入・瘟出、p.38）。lunarMonthごとに固定1暦日番号。 */
const ONNYUU_BY_MONTH: readonly number[] = [6, 5, 3, 25, 24, 23, 20, 27, 17, 13, 12, 11];
const ONSHUTSU_BY_MONTH: readonly number[] = [9, 8, 4, 28, 27, 26, 23, 30, 20, 16, 15, 14];

/**
 * ［区分B］47）天空・地空（p.42）。yearBranchの8グループ（戌亥/酉/未申/
 * 午/辰巳/卯/丑寅/子）ごとに、lunarMonthを8で割った位置（バンド）に応じて
 * 固定の暦日番号リストが割り当てられる（PyMuPDF座標抽出で確認済み。
 * 8バンド分の値自体は年グループに関わらず共通で、年グループごとに
 * 「どの月がバンド0に当たるか」の開始月だけが異なるという構造を
 * 座標データから直接検証している。数式は原本の値を機械的に再現する
 * ためだけのものであり、推測で作った規則ではない）。
 */
const CHIKUU_BANDS: readonly (readonly number[])[] = [
  [1, 9, 17, 25], [8, 16, 24], [7, 15, 23], [6, 14, 22, 30],
  [5, 13, 21, 29], [4, 12, 20, 28], [3, 11, 19, 27], [2, 10, 18, 26],
];
const TENKUU_BANDS: readonly (readonly number[])[] = [
  [5, 13, 21, 29], [4, 12, 20, 28], [3, 11, 19, 27], [2, 10, 18, 26],
  [1, 9, 17, 25], [8, 16, 24], [7, 15, 23], [6, 14, 22, 30],
];
/** バンド0（CHIKUU_BANDS[0]/TENKUU_BANDS[0]）に当たる開始月（1〜12）。 */
const TENKUU_START_MONTH_BY_BRANCH: Record<string, number> = {
  子: 1, 丑: 8, 寅: 8, 卯: 7, 辰: 6, 巳: 6, 午: 5, 未: 4, 申: 4, 酉: 3, 戌: 2, 亥: 2,
};
function tenkuuBandIndex(lunarMonth: number, yearBranch: string): number {
  const start = TENKUU_START_MONTH_BY_BRANCH[yearBranch];
  return ((lunarMonth - start) % 8 + 8) % 8;
}

/**
 * ［区分B］39）上兀（留紳）・下兀（赤口）（p.37-38）。yearBranchの陰陽
 * （子寅辰午申戌＝陽年、丑卯巳未酉亥＝陰年）×lunarMonthの月ペア
 * グループ（正七/二八/三九/四十/五十一/六十二）ごとに固定5暦日番号。
 * 大安・空亡・小吉・㏿喜（福喜）の4列は同じ表内にあるが、項目39自身の
 * 名称（上兀＝留紳、下兀＝赤口）ではないため対象外（記録のみ）。
 * 三・九月陽年の下兀「4,10,16,22,23」・六・十二月陽年の下兀
 * 「4,10,16,22,29」は、他の月から推測される規則的な数列（本来28）から
 * 外れた原本のままの値（座標抽出で確認済み。訂正はしていない）。
 */
const YOUNEN_BRANCHES = new Set(["子", "寅", "辰", "午", "申", "戌"]);
function isYounen(yearBranch: string): boolean {
  return YOUNEN_BRANCHES.has(yearBranch);
}
/** 月ペアグループのインデックス（0〜5）。正七=0,二八=1,三九=2,四十=3,五十一=4,六十二=5。 */
function monthPairGroupIndex(lunarMonth: number): number {
  return (lunarMonth - 1) % 6;
}
const JOUKOTSU_YOUNEN_BY_GROUP: readonly (readonly number[])[] = [
  [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26],
  [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29],
];
const JOUKOTSU_INNEN_BY_GROUP: readonly (readonly number[])[] = [
  [1, 7, 13, 19, 25], [6, 12, 18, 24, 30], [5, 11, 17, 23, 29],
  [4, 10, 16, 22, 28], [3, 9, 15, 21, 27], [2, 8, 14, 20, 26],
];
const GEKOTSU_YOUNEN_BY_GROUP: readonly (readonly number[])[] = [
  [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 23],
  [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25],
];
const GEKOTSU_INNEN_BY_GROUP: readonly (readonly number[])[] = [
  [3, 9, 15, 21, 27], [2, 8, 14, 20, 26], [1, 7, 13, 19, 25],
  [6, 12, 18, 24, 30], [5, 11, 17, 23, 29], [4, 10, 16, 22, 29],
];

/**
 * ［区分A］44）伏斷日（p.40-41）。dayBranchごとに固定1宿（lodge28）。
 * 原本は「酉が嘴宿」と表記するが、CalendarEngine（shukuYo.ts の
 * LODGE_28）の正式表記「觜」の異体字（嘴／觜、字形類似）と判断し、
 * コード上は CalendarEngine 側の表記「觜」で統一する。
 */
const FUKUDANBI_LODGE_BY_DAYBRANCH: Record<string, string> = {
  子: "虚", 丑: "斗", 寅: "室", 卯: "女", 辰: "箕", 巳: "房",
  午: "角", 未: "張", 申: "鬼", 酉: "觜", 戌: "胃", 亥: "壁",
};

/** ［区分B］44）埋兒凶宿（p.41）。lodge28の固定列挙。 */
const MAIJIKYOUSHUKU_LODGES: readonly string[] = ["心", "昴", "箕", "婁", "奎", "尾", "参", "危"];

function seasonTrioIndexOf(monthBranch: string): number {
  return SEASON_TRIOS.findIndex((g) => g.includes(monthBranch));
}
function tochinbiSeasonIndexOf(monthBranch: string): number {
  return TOCHINBI_SEASON_GROUPS.findIndex((g) => g.includes(monthBranch));
}

/**
 * 「日家凶神」第6グループ（凶神1〜53番の全件棚卸しで回収した残り項目）を
 * 判定する。吉神は今回対象外のため kichijin は常に空配列。
 */
export function resolveKyoushinGroup6(input: ShinsatsuInput): ShinsatsuResult {
  const { yearStem, yearBranch, monthBranch, dayBranch, lunarMonth, lunarDay, lodge28 } = input;
  const kyojin: string[] = [];

  // 8）月厭・厭對 / 43）受死日（monthBranch固定表）
  if (GETSUEN[monthBranch] === dayBranch) kyojin.push("月厭");
  if (ENTAI[monthBranch] === dayBranch) kyojin.push("厭對");
  if (JUSHIBI[monthBranch] === dayBranch) kyojin.push("受死日");

  // 小耗（monthBranch＋dayBranch。神殺象意.pdf「為『舊月破』、又為本月
  // 『閉日』之沖」＝十二直「執」と等価。既存の凍結済みresolveJianchu()を
  // 呼び出すだけで、jianchu.ts自体は変更していない）
  if (resolveJianchu({ monthBranch, dayBranch }).name === "執") kyojin.push("小耗");

  // 50）四方耗（monthBranch三合トリオ＋lunarDay）
  const trioIdx = seasonTrioIndexOf(monthBranch);
  if (trioIdx !== -1 && lunarDay !== undefined && lunarDay === SHIHOMOU_BY_TRIO[trioIdx]) {
    kyojin.push("四方耗");
  }

  // 52）刀砧日（季節monthBranch＋dayBranch）
  const seasonIdx = tochinbiSeasonIndexOf(monthBranch);
  if (seasonIdx !== -1 && TOCHINBI_BY_SEASON[seasonIdx].includes(dayBranch)) {
    kyojin.push("刀砧日");
  }

  // 44）伏斷日（dayBranch＋lodge28）
  if (lodge28 !== undefined && FUKUDANBI_LODGE_BY_DAYBRANCH[dayBranch] === lodge28) {
    kyojin.push("伏斷日");
  }
  // 44）埋兒凶宿（lodge28固定列挙）
  if (lodge28 !== undefined && MAIJIKYOUSHUKU_LODGES.includes(lodge28)) {
    kyojin.push("埋兒凶宿");
  }

  // 25）上朔（p.32「陰暦の1日で新月をいう。」＋年干の表）。
  // 年干の表の日干支であり、かつ陰暦（農暦）の1日であるときに成立する
  // （本文の「陰暦の1日」を条件として実装。lunarDay が無い入力では成立させない）。
  const { dayStem } = input;
  if (lunarDay === 1 && JOSAKU_BY_YEARSTEM[yearStem] === `${dayStem}${dayBranch}`) kyojin.push("上朔");

  // lunarDayのみで決まる項目
  if (lunarDay !== undefined) {
    if (GETSUKIBI_DAYS.includes(lunarDay)) kyojin.push("月忌日");
    if (OTENSUZAKU_DAYS.includes(lunarDay)) kyojin.push("横天朱雀");
    if (SHIFUSHOU_DAYS.includes(lunarDay)) kyojin.push("四不詳");
    if (SHUUDOUSATSU_DAYS.includes(lunarDay)) kyojin.push("周堂殺");
    if (RYUUKIN_DAYS.includes(lunarDay)) kyojin.push("龍禁");
  }

  // lunarMonth＋lunarDayで決まる項目
  if (lunarMonth !== undefined && lunarDay !== undefined) {
    const mi = lunarMonth - 1;
    if (mi >= 0 && mi < 12) {
      if (CHOUSEI_BY_MONTH[mi].includes(lunarDay)) kyojin.push("長星");
      if (TANSEI_BY_MONTH[mi].includes(lunarDay)) kyojin.push("短星");
      if (YOUKOUKI_BY_MONTH[mi].includes(lunarDay)) kyojin.push("揚公忌");
      if (HYOUSHOUGASAI_BY_MONTH[mi] === lunarDay) kyojin.push("冰消瓦碎");
      if (DAIKUUBOU_BY_MONTH[mi].includes(lunarDay)) kyojin.push("大空亡");
      if (SHOUKUUBOU_BY_MONTH[mi].includes(lunarDay)) kyojin.push("小空亡");
      if (TENOTSUZEKKI_BY_MONTH[mi] === lunarDay) kyojin.push("天乙絶気");
      if (ONNYUU_BY_MONTH[mi] === lunarDay) kyojin.push("瘟入");
      if (ONSHUTSU_BY_MONTH[mi] === lunarDay) kyojin.push("瘟出");
    }

    // 42）冰消瓦解（yearBranch六冲グループ＋lunarMonth＋lunarDay）
    if (yearBranch !== undefined) {
      const group = YEARBRANCH_TO_HYOUSHOUGAKAI_GROUP[yearBranch];
      const list = group !== undefined && mi >= 0 && mi < 12 ? HYOUSHOUGAKAI_GROUPS[group][mi] : undefined;
      if (list !== undefined && list.includes(lunarDay)) kyojin.push("冰消瓦解");
    }

    // 47）天空・地空（yearBranch8グループ＋lunarMonthバンド＋lunarDay）
    if (yearBranch !== undefined && TENKUU_START_MONTH_BY_BRANCH[yearBranch] !== undefined) {
      const band = tenkuuBandIndex(lunarMonth, yearBranch);
      if (CHIKUU_BANDS[band].includes(lunarDay)) kyojin.push("地空");
      if (TENKUU_BANDS[band].includes(lunarDay)) kyojin.push("天空");
    }

    // 39）上兀（留紳）・下兀（赤口）（yearBranch陰陽＋月ペアグループ＋lunarDay）
    if (yearBranch !== undefined) {
      const g = monthPairGroupIndex(lunarMonth);
      const younen = isYounen(yearBranch);
      const joukotsuList = younen ? JOUKOTSU_YOUNEN_BY_GROUP[g] : JOUKOTSU_INNEN_BY_GROUP[g];
      const gekotsuList = younen ? GEKOTSU_YOUNEN_BY_GROUP[g] : GEKOTSU_INNEN_BY_GROUP[g];
      if (joukotsuList.includes(lunarDay)) kyojin.push("上兀");
      if (gekotsuList.includes(lunarDay)) kyojin.push("下兀");
    }
  }

  return { kichijin: [], kyojin };
}
