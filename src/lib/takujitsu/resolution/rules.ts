// src/lib/takujitsu/resolution/rules.ts
//
// 役割:
//   docs/takujitsu_resolution_rules.md の「ルールNo.」と1対1対応する
//   ResolutionRule の宣言的な一覧。判定ロジック（if文の直書き）ではなく
//   データとして持つことで、本文の根拠・保留理由をコードにも残す。
//
// 唯一の仕様根拠:
//   docs/source/擇日テキスト.pdf
//   docs/takujitsu_resolution_rules.md
//   docs/takujitsu_decisions.md
//
// 「pending」の扱いについて（重要）:
//   pending: true のルールは、条件が成立していても resolve.ts 側で
//   実際の状態変化（cancelled/reduced/aggravated）を発生させない
//   （appliedRules には記録されるが、statusは変えない）。
//   pending: false は「本文から条件が一義的に確定している」ルールにのみ
//   立てる。
//
// 第2実装フェーズ（2026-09-09）での更新:
//   第1フェーズで pending:true のまま据え置いていた9ルール
//   （No.7・8・12・14・17・18・19・20・21＝分析報告で「複合条件の
//   解釈確定が前提」とされたもの）を、docs/takujitsu_decisions.md で
//   確定済みの用語定義（徳合＝天徳/天徳合/月徳/月徳合/歳徳/歳徳合の
//   いずれか、赦願＝天赦/天願のいずれか、六合＝吉神「六合」の成立）を
//   使って再判定した。
//     ・「・」で並列列挙されているだけで、本文に「一緒になれば」
//       「合わさると」「あわさると」「と」のような同時成立を明示する
//       表現が無いもの（No.14・17）→ OR のまま。
//     ・本文が明示的に同時成立を示す表現を使っているもの
//       （No.8「一緒になれば」、No.12「合わさると」、No.18「と」、
//       No.20・21「あわさると」）→ AND のまま維持。
//   上記の判断はすでに requires/combine としてコードに記録済みだった
//   （第1フェーズ時点で解釈自体は確定していたため）。今回はこれらの
//   解釈を運用に反映してよいと判断し、pending を false に変更した
//   （No.8・12・14・17・18・20・21の7ルール）。
//   残る2ルール（No.7・19）は、徳合・赦願・六合の定義とは別の理由
//   （No.7＝本文末尾の「など」が非網羅的、No.19＝「月建」条件の意味が
//   未確定）でなお曖昧さが残るため、pending:true のまま維持している。
//
// 今回スキーマに乗らないため rules.ts に含めていないルール
// （docs/takujitsu_resolution_rules.md にのみ記録。理由も記載。
// 第2実装フェーズでも対象外のまま）:
//   ・No.1 歳徳合→全凶殺解除: 対象が「すべての凶殺」という総称で、
//     targets を有限リストとして列挙できない。かつ実例（アネクドート）
//     ベースで判定式ではない。
//   ・No.2 歳徳・歳徳合→月殺等: 同上（実例ベース）。
//   ・No.4a 月破×徳合: 神殺象意.pdf原本画像で確認（docs/takujitsu_except_resolution_final.md）
//     「德神臨此失力，不能爲福，故即與『德合』併，猶忌」＝徳合と併存しても
//     徳神の方が力を失うため月破は一切解除されない。解除ルールとして
//     実装すべき内容が無い（cancel/reduceルールを追加しない、というのが
//     確定した結論）。月破のActivityProfileはnegativeMode:"all_except"で
//     独立して表現する（resolution層のルールとしては何も追加しない）。
//   ・No.4b 月破の構造的例外: 「解除ルール」ではなく月破自身の
//     occurrence（成立条件）に内在する除外規定の可能性が高く、他の
//     神殺の有無で判定する本ルールエンジンの形（target×requires）に
//     そもそも当てはまらない。3種類の解釈のどれが正しいかも未確定。
//   ・No.4c 月破の徳合免疫日: 判定に必要なのが「他の神殺の有無」ではなく
//     「対象日自身の月令・日干支が特定の値と一致するか」であり、
//     occurrence名の配列だけを見る本エンジンの入力（ShinsatsuResultの
//     みを受け取るresolve()）では判定できない。
//   ・No.5 死神の「吉星が多ければ」: 具体的な吉神名も閾値も本文に無い。
//   ・No.6 満日（天狗）: 2026-10-06 に occurrence（戊の日の満日）を実装し、
//     「歳徳・月徳が同宮すれば忌まない」を本ファイルに追加した（下記 id "6"）。
//   ・No.13a 四撃〜五虚×土旺: 2026-10-06 監修確定（土旺＝土王用事の期間）により
//     本ファイルに追加した（下記 id "13a"）。
//   ・No.15 五墓×月徳（条件付き解除）: 条件が「月徳の成立」だけでなく
//     「monthBranchが午または子であること」も必要だが、本エンジンは
//     occurrence名の配列（ShinsatsuResult）だけを入力としており、
//     monthBranchを参照できない。月令情報を resolve() に渡す設計変更が
//     必要なため、今回は対象外とし、docs側にのみ記録する
//     （将来、resolve() の入力を拡張する際に追加する）。

import type { RequiresGroup, ResolutionRule } from "./types";

/** 徳合（docs/takujitsu_decisions.md で確定）＝天徳 OR 天徳合 OR 月徳 OR 月徳合 OR 歳徳 OR 歳徳合。 */
export const DEHE_GROUP = ["天徳", "天徳合", "月徳", "月徳合", "歳徳", "歳徳合"] as const;
/** 赦願（docs/takujitsu_decisions.md で確定）＝天赦 OR 天願。 */
export const SHAGAN_GROUP = ["天赦", "天願"] as const;

function anyOf(names: readonly string[]): RequiresGroup {
  return { names, mode: "any" };
}

export const RESOLUTION_RULES: readonly ResolutionRule[] = [
  // ==== pending: false（本文から条件が一義的に確定しているルール） ====

  // -- 第1実装フェーズで確定済み --
  {
    id: "3",
    targets: ["小時"],
    // p.18本文が直接列挙する独自セット（月恩・四相を含み、天願・歳徳・
    // 歳徳合を含まない）。共通のDEHE_GROUPとは異なるためそのまま列挙する。
    requires: [anyOf(["天徳", "天徳合", "天赦", "月徳", "月徳合", "月恩", "四相"])],
    combine: "any",
    kind: "reduce",
    pending: false,
    page: "p.18",
    note:
      "月建（小時・土府）：神殺象意.pdf原本画像で確認（docs/takujitsu_except_resolution_final.md）" +
      "「與『天德』『月德』『天德合』『月德合』『天赦』『月恩』『四相』併，止忌動土，餘則不忌」" +
      "＝完全解除ではなく、修造動土・伐木の2件だけは条件成立後も忌のまま残る（reduce）。" +
      "残存する2件はActivityProfile（小時）のreducedStillUnfavorableActivityIdsで表現する。",
  },
  {
    id: "9a",
    targets: ["月刑"],
    requires: [anyOf(DEHE_GROUP)],
    combine: "any",
    kind: "cancel",
    pending: false,
    page: "p.21",
    note: "月刑：徳合が来た場合は解除される。",
  },
  {
    id: "9b",
    targets: ["月刑"],
    requires: [anyOf(["月破"])],
    combine: "any",
    kind: "aggravate",
    pending: false,
    page: "p.21",
    note: "月刑：月破がきた場合は凶意が増す（凶神同士の相互作用。吉神は絡まない）。",
  },
  {
    id: "10",
    targets: ["大時", "天吏"],
    requires: [anyOf([...DEHE_GROUP, "天赦"])],
    combine: "any",
    kind: "reduce",
    pending: false,
    page: "p.22",
    note:
      "大時（大敗咸池）・天吏（致死）：徳合・天赦にて解除するが、攻めであるビジネスは凶のまま" +
      "（本文が明確に完全解除と書き分けているためreducedを使用）。用途限定の残存凶性は" +
      "用途判定フェーズで扱う。",
  },
  {
    id: "11",
    targets: ["遊禍"],
    requires: [anyOf([...DEHE_GROUP, "天赦"])],
    combine: "any",
    kind: "aggravate",
    pending: false,
    page: "p.23",
    note: "遊禍：徳合や天赦が入ることで、さらに凶意が増す（旺じてしまうため。解除役が逆に強める例外）。",
  },
  {
    id: "13b",
    targets: ["四撃", "四忌", "四窮", "五虚"],
    requires: [anyOf([...DEHE_GROUP, "六合"])],
    combine: "any",
    kind: "cancel",
    pending: false,
    page: "p.26",
    note:
      "四撃・四忌・四窮・五虚：徳合・六合が来れば解除される。四耗・四廢は神殺象意.pdf原本画像の" +
      "確認（docs/takujitsu_except_resolution_final.md）により本ルールの対象から除外した" +
      "（四耗は独自のルール13cへ分離、四廢は徳合併でも「猶忌」＝一切解除されないため対象外）。" +
      "四撃は神殺象意.pdfに独立entryとして見当たらなかったが、既存資料（擇日テキスト.pdf）に" +
      "明記の根拠があるため本ルールの対象のまま維持する（要再確認事項として保留メモを残す）。",
  },
  {
    id: "13a",
    targets: ["四撃", "四耗", "四廢", "四忌", "四窮", "五虚"],
    requires: [anyOf(["土王用事"])],
    combine: "any",
    kind: "aggravate",
    pending: false,
    page: "p.28",
    note:
      "四撃・四耗・四廢・四忌・四窮・五虚：「土旺が重なると更に忌む」（項目18の見出し）。" +
      "監修確定（2026-10-06）により「土旺」＝土王用事（土用）の期間とする" +
      "（土王用事は kyoushinGroup5.ts で四立の18日前〜四立の前日の期間として判定）。",
  },
  {
    id: "6",
    targets: ["天狗"],
    requires: [anyOf(["歳徳", "月徳"])],
    combine: "any",
    kind: "cancel",
    pending: false,
    page: "p.22",
    note: "満日（天狗）：「歳徳・月徳が同宮すれば忌まない」。",
  },
  {
    id: "13c",
    targets: ["四耗"],
    requires: [anyOf(DEHE_GROUP), anyOf(["三合"])],
    combine: "all",
    kind: "cancel",
    pending: false,
    page: "p.26",
    note:
      "四耗：神殺象意.pdf原本画像で確認（docs/takujitsu_except_resolution_final.md）" +
      "「與『德合』『三合』併，則不忌」＝徳合と三合の両方が揃った場合のみ解除される" +
      "（旧13bの徳合・六合ORから分離し、徳合AND三合の専用ルールへ変更）。",
  },
  {
    id: "16",
    targets: ["八風"],
    requires: [anyOf([...DEHE_GROUP, "六合"])],
    combine: "any",
    kind: "cancel",
    pending: false,
    page: "p.27",
    note: "八風：徳合・六合がくれば解除される（協紀辨方書からの引用）。",
  },

  // -- 第2実装フェーズで新たに確定・有効化（2026-09-09） --
  {
    id: "8",
    targets: ["月厭", "厭對"],
    requires: [anyOf(DEHE_GROUP), anyOf(SHAGAN_GROUP)],
    combine: "all",
    kind: "cancel",
    pending: false,
    page: "p.20",
    note:
      "月厭・厭對：「徳合、赦願が一緒になれば解除される」。本文が「一緒になれば」と同時成立を" +
      "明示しているためAND＝徳合(OR6) AND 赦願(OR2)。",
  },
  {
    id: "12",
    targets: ["土符"],
    requires: [anyOf(DEHE_GROUP), anyOf(SHAGAN_GROUP)],
    combine: "all",
    kind: "aggravate",
    pending: false,
    page: "p.24",
    note:
      "土符：「徳合・赦願が合わさるとさらに凶」。本文が「合わさると」と同時成立を明示している" +
      "ためAND＝徳合(OR6) AND 赦願(OR2)。",
  },
  {
    id: "14",
    targets: ["氣往亡"],
    requires: [anyOf(DEHE_GROUP), anyOf(SHAGAN_GROUP)],
    combine: "any",
    kind: "aggravate",
    pending: false,
    page: "p.25-26",
    note:
      "氣往亡：「徳合・赦願が来たら更に忌む」。「・」による並列列挙で同時成立を示す表現が" +
      "無いためOR＝徳合(OR6) OR 赦願(OR2)。",
  },
  {
    id: "17",
    targets: ["觸水龍"],
    requires: [anyOf(DEHE_GROUP), anyOf(["天願"])],
    combine: "any",
    kind: "aggravate",
    pending: false,
    page: "p.27",
    note:
      "觸水龍：「徳合・天願がくると更に忌む」。「・」による並列列挙で同時成立を示す表現が" +
      "無いためOR＝徳合(OR6) OR 天願単独（赦願＝天赦/天願のペアではなく天願そのもの）。",
  },
  {
    id: "18",
    targets: ["四離", "四絶"],
    requires: [anyOf(DEHE_GROUP), anyOf(["天願"])],
    combine: "all",
    kind: "aggravate",
    pending: false,
    page: "p.30",
    note:
      "四離・四絶：「徳合と天願がきたら尚忌む」。本文が明示的に「と」で結んでいるためAND" +
      "＝徳合(OR6) AND 天願単独。",
  },
  {
    id: "20",
    targets: ["八節日"],
    requires: [anyOf(DEHE_GROUP), anyOf(SHAGAN_GROUP)],
    combine: "all",
    kind: "aggravate",
    pending: false,
    page: "p.31",
    note:
      "八節日：「徳合・赦願があわさると尚忌む」。本文が「あわさると」と同時成立を明示している" +
      "ためAND＝徳合(OR6) AND 赦願(OR2)。",
  },
  {
    id: "21",
    targets: ["土王用事"],
    requires: [anyOf(DEHE_GROUP), anyOf(SHAGAN_GROUP)],
    combine: "all",
    kind: "aggravate",
    pending: false,
    page: "p.31",
    note:
      "土王用事：「徳合・赦願があわさると尚忌む」。本文が「あわさると」と同時成立を明示している" +
      "ためAND＝徳合(OR6) AND 赦願(OR2)。",
  },

  // -- 小耗・復日・五離occurrence完成フェーズ以降に神殺象意.pdfで新規確認
  //    （擇日テキスト.pdfの元の1〜21番の棚卸しには無かった対象。IDは
  //    既存の21番から連番で採番し、擇日テキスト.pdf由来のNo.1〜21とは
  //    出典が異なることを明示する） --
  {
    id: "22",
    targets: ["小耗"],
    // p.15-16「與『德合』『天願』併，則貪合忘沖，故不忌」。原文は「德合」
    // 「天願」の2語のみを個別に引用符で列挙しており、「等」「など」に
    // 相当する非限定表現は無い（条件集合を閉じてよい）。天赦は明記されて
    // いないため赦願(SHAGAN_GROUP)ではなく天願単独を使う（No.17・18と
    // 同じ判断基準）。
    requires: [anyOf(DEHE_GROUP), anyOf(["天願"])],
    combine: "any",
    kind: "cancel",
    pending: false,
    page: "神殺象意.pdf（docs/takujitsu_xiaohao_fuyi_wuli_verification.md参照）",
    note:
      "小耗：「德合または天願と併すれば、[小耗の起点である]沖を忘れて合を貪る＝不忌」。" +
      "一部用事だけの軽減ではなく、忌全体（修倉庫・出貨財・立券交易・納財・開倉庫・開市）が" +
      "解除される（cancel）。",
  },

  // ==== pending: true（徳合・赦願・六合とは別の曖昧さが残るため保留を維持） ====

  {
    id: "7",
    targets: ["血支"],
    requires: [anyOf(["歳徳", "歳徳合", "月徳", "月徳合"]), anyOf(SHAGAN_GROUP)],
    combine: "any",
    kind: "cancel",
    pending: true,
    page: "p.20",
    note:
      "閉日（血支）：「歳徳・(歳徳)合、月徳・(月徳)合、赦願など」。文末の「など」が非網羅的で" +
      "範囲を確定できないため保留（徳合・赦願・六合の定義確定とは別の理由）。",
  },
  {
    id: "19",
    targets: ["九空"],
    requires: [anyOf(["六合", ...DEHE_GROUP])],
    combine: "any",
    kind: "cancel",
    pending: true,
    page: "p.28",
    note:
      "九空：「六合・月建（地支の蔵干が合となるため冲が解除）・徳合がくれば解除」。" +
      "六合・徳合の部分は確定しているが、「月建」条件の意味が未確定のため本ルール全体を保留する" +
      "（月建条件はrequiresに含めていない＝未確定分は反映していない。徳合・赦願・六合の定義確定" +
      "とは別の理由）。",
  },
];
