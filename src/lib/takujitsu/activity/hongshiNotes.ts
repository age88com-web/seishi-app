// src/lib/takujitsu/activity/hongshiNotes.ts
//
// 役割:
//   洪氏錦嚢による「解除・緩和条件」補足表示フェーズ（2026-09-11）。
//   docs/takujitsu_hongshi_jinnang_audit.md／docs/takujitsu_hongshi_jishin_definition.md／
//   docs/takujitsu_hongshi_activity_mapping.md の調査で「現行アプリで表示可能」と
//   確認できた32件だけを、独立した表示専用データとして保持する。
//
// 重要（ユーザー指示、2026-09-11）:
//   ・これは「原典による補足情報」であり、最終的な吉凶判定ではない。
//   ・既存の ActivityProfile／resolution／occurrence detection（神殺・十二建除・
//     二十八宿）は一切参照・変更しない。このファイルは`evaluateActivities()`の
//     出力（ActivityEvaluation）を読み取り専用で受け取るだけ。
//   ・洪氏錦嚢の「吉神にあえば」「問題ない」等の条件文は、アプリ側で「満たした／
//     解除済み」と判定しない。conditionTextは原文の意味を変えずそのまま保持し、
//     UI側もそのまま表示するだけにする（吉神の有無・数を自動判定しない）。
//   ・推測による追加は禁止。docs/takujitsu_hongshi_activity_mapping.md §3で
//     「表示可能」と確認した32件のみを登録する（COMPOUND／NO_MATCH・未実装神殺・
//     絶対禁止（「用いてはいけない」「大凶」）の記述は対象外）。
//   ・2026-10-26：五離の実装に伴い、結婚納采×五離を監修決定で追加した（33件）。
//   ・2026-10-26 監修決定：洪氏錦嚢にのみ用事別の注意・可否があり、擇日テキスト・神殺象意・
//     協紀辨方書の基本RULEに該当忌がないものは、データには保持するが画面表示しない。
//     基本判定上その神殺が実際にその用事を忌む場合だけ注記を表示する（getHongshiNotesFor の
//     条件3）。該当：天賊×動土・天賊×堅柱上樑・天賊×蓋屋・天賊×開市・天賊×結婚納采・
//     天賊×安床・刀砧日×安床（基本RULEの忌は天賊＝修倉庫・出貨財・遠行・開倉庫、
//     刀砧日＝伐木・牧養・納畜・造畜柵）。
//
// 出典: docs/source/擇日テキスト.pdf 印字ページ47〜64「洪氏錦嚢 解説」章。

/** 洪氏錦嚢の「用事×凶神」1件分の補足情報（表示専用）。判定結果は持たない。 */
export interface HongshiNote {
  /** 対応するActivityDefinition.id（95件のいずれか）。 */
  activityId: string;
  /** この補足が対象とする凶神名（occurrence detectionのkyojin名と完全一致）。 */
  unfavorableGod: string;
  /** 原文の条件表現（意味を変えず保持。「解除済み」等への言い換えはしない）。 */
  conditionText: string;
  /** 出典ページ（擇日テキスト.pdfの印字ページ番号）。 */
  sourcePage: string;
  /** 原文の該当行（複数神殺が併記された行はそのまま保持）。 */
  sourceText: string;
}

export const HONGSHI_NOTES: HongshiNote[] = [
  // --- 動土（動土平基忌例） ---
  { activityId: "動土", unfavorableGod: "天賊", conditionText: "吉神に押さえられれば良い", sourcePage: "印字p.47", sourceText: "「天賊」吉神に押さえられれば良い。" },

  // --- 堅柱上樑（竪柱上梁忌例） ---
  { activityId: "堅柱上樑", unfavorableGod: "天賊", conditionText: "吉神があれば良い", sourcePage: "印字p.49", sourceText: "「天賊」吉神があれば良い。" },

  // --- 蓋屋（蓋屋合脊忌例） ---
  { activityId: "蓋屋", unfavorableGod: "天賊", conditionText: "吉神に抑えられれば良い", sourcePage: "印字p.50", sourceText: "「天賊」吉神に抑えられれば良い。" },

  // --- 開市（開帳店肆忌例） ---
  { activityId: "開市", unfavorableGod: "劫殺", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.55", sourceText: "「劫殺」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "災殺", conditionText: "問題ない", sourcePage: "印字p.55", sourceText: "「災殺」「月殺」問題ない。" },
  { activityId: "開市", unfavorableGod: "月殺", conditionText: "問題ない", sourcePage: "印字p.55", sourceText: "「災殺」「月殺」問題ない。" },
  { activityId: "開市", unfavorableGod: "月刑", conditionText: "問題ない", sourcePage: "印字p.55", sourceText: "「月刑」「月厭」「月害」問題ない。" },
  { activityId: "開市", unfavorableGod: "月厭", conditionText: "問題ない", sourcePage: "印字p.55", sourceText: "「月刑」「月厭」「月害」問題ない。" },
  { activityId: "開市", unfavorableGod: "月害", conditionText: "問題ない", sourcePage: "印字p.55", sourceText: "「月刑」「月厭」「月害」問題ない。" },
  { activityId: "開市", unfavorableGod: "大時", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.55", sourceText: "「大時」「天吏」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "天吏", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.55", sourceText: "「大時」「天吏」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "小耗", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.56", sourceText: "「小耗」「四窮」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "四窮", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.56", sourceText: "「小耗」「四窮」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "天賊", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.56", sourceText: "「天賊」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "五墓", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.56", sourceText: "「五墓」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "開市", unfavorableGod: "九空", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.56", sourceText: "「九空」吉神にあうなど条件が合えば用いて良い。" },

  // --- 上官赴任（上官赴任忌例） ---
  { activityId: "上官赴任", unfavorableGod: "天吏", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.60", sourceText: "「伏罪」「徒隷」「天吏」「天獄」「牢日」「獄日」「刑獄」「殃敗」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "上官赴任", unfavorableGod: "五墓", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.61", sourceText: "「上下兀」「九土鬼」「五墓」「天瘟」「月忌」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "上官赴任", unfavorableGod: "月殺", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.61", sourceText: "「敗亡猖鬼」「満日」「月殺」「月刑」「月厭」「大吏」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "上官赴任", unfavorableGod: "月刑", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.61", sourceText: "「敗亡猖鬼」「満日」「月殺」「月刑」「月厭」「大吏」吉神にあうなど条件が合えば用いて良い。" },
  { activityId: "上官赴任", unfavorableGod: "月厭", conditionText: "吉神にあうなど条件が合えば用いて良い", sourcePage: "印字p.61", sourceText: "「敗亡猖鬼」「満日」「月殺」「月刑」「月厭」「大吏」吉神にあうなど条件が合えば用いて良い。" },

  // --- 結婚納采（結婚納采忌例） ---
  { activityId: "結婚納采", unfavorableGod: "月刑", conditionText: "問題ない", sourcePage: "印字p.61", sourceText: "「月刑」問題ない。" },
  { activityId: "結婚納采", unfavorableGod: "天賊", conditionText: "吉神に制御されれば使える", sourcePage: "印字p.61", sourceText: "「天賊」吉神に制御されれば使える。" },
  { activityId: "結婚納采", unfavorableGod: "劫殺", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「劫殺」用いて良い。" },
  { activityId: "結婚納采", unfavorableGod: "月殺", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月殺」用いて良い。" },
  { activityId: "結婚納采", unfavorableGod: "月害", conditionText: "問題ない", sourcePage: "印字p.62", sourceText: "「月害」問題ない。" },
  { activityId: "結婚納采", unfavorableGod: "月厭", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月厭」「大時」「大吏」「五墓」「五離」「八専日」用いて良い。" },
  { activityId: "結婚納采", unfavorableGod: "大時", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月厭」「大時」「大吏」「五墓」「五離」「八専日」用いて良い。" },
  { activityId: "結婚納采", unfavorableGod: "天吏", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月厭」「大時」「大吏」「五墓」「五離」「八専日」用いて良い。" },
  { activityId: "結婚納采", unfavorableGod: "五墓", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月厭」「大時」「大吏」「五墓」「五離」「八専日」用いて良い。" },
  // 五離：2026-10-26 の五離実装に伴い、洪氏錦嚢の source-specific な補足・異説として追加（監修決定）。
  // 五離の基本RULE（activityProfiles.ts）や解除条件（resolution/rules.ts No.28）には反映しない。
  { activityId: "結婚納采", unfavorableGod: "五離", conditionText: "用いて良い", sourcePage: "印字p.62", sourceText: "「月厭」「大時」「大吏」「五墓」「五離」「八専日」用いて良い。" },

  // --- 安床（安床忌例） ---
  { activityId: "安床", unfavorableGod: "天賊", conditionText: "吉神に抑えられれば良い", sourcePage: "印字p.64", sourceText: "「天賊」吉神に抑えられれば良い。" },
  { activityId: "安床", unfavorableGod: "刀砧日", conditionText: "問題ない", sourcePage: "印字p.64", sourceText: "「刀砧日」問題ない。" },
];

/**
 * 洪氏注記の検索だけで使う語彙対応（2026-10-26 監修決定）。洪氏錦嚢の用事語
 * 「結婚納采」は、内部 activity では「結婚姻」「納采」に分かれて登録されている
 * （神殺象意の「結婚納采」を既存 profile が結婚姻・納采として転記しているため）。
 * 洪氏の注記をそのどちらを見ているときにも引けるようにするための対応で、
 * ActivityDefinition・ActivityProfile・resolution には一切使わない。
 */
export const HONGSHI_ACTIVITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  結婚納采: ["結婚姻", "納采"],
};

/** 洪氏注記の用事語（note.activityId）が、表示中の activityId に当たるか。 */
function hongshiActivityMatches(noteActivityId: string, activityId: string): boolean {
  return noteActivityId === activityId || (HONGSHI_ACTIVITY_ALIASES[noteActivityId]?.includes(activityId) ?? false);
}

/**
 * ある ActivityEvaluation（1用事・1日分の判定結果）に対して表示すべき洪氏錦嚢の
 * 補足を返す。以下をすべて満たす場合のみ返す（1件でも欠ければ空配列）。
 *   1. その用事が「吉凶混在」（positiveSources・negativeSourcesの両方が1件以上）
 *   2. HONGSHI_NOTESにそのactivityIdの登録がある（HONGSHI_ACTIVITY_ALIASES で
 *      「結婚納采」は「結婚姻」「納采」にも当てる）
 *   3. その日実際に成立している凶神（negativeSources[].sourceName）が
 *      unfavorableGodと一致する
 * 「吉神にあえば」等の条件を満たしたかどうかはここでも判定しない
 * （conditionTextをそのまま返すだけ）。
 */
export function getHongshiNotesFor(evaluation: {
  activityId: string;
  positiveSources: readonly { sourceName: string }[];
  negativeSources: readonly { sourceName: string }[];
}): HongshiNote[] {
  if (evaluation.positiveSources.length === 0 || evaluation.negativeSources.length === 0) {
    return [];
  }
  const activeGods = new Set(evaluation.negativeSources.map((s) => s.sourceName));
  return HONGSHI_NOTES.filter(
    (note) => hongshiActivityMatches(note.activityId, evaluation.activityId) && activeGods.has(note.unfavorableGod),
  );
}
