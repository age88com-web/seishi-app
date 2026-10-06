// src/lib/takujitsu/monthly/monthlyActivities.ts
//
// 役割:
//   月間行動予定に載せる「表示用事」の一覧（表示名 → 既存 activityId）。
//   判定は一切持たない。既存の evaluateActivities() の verdict を引くための
//   対応表だけを置く。
//
// 仕様根拠（人間側で確定済み）:
//   docs/monthly-action-schedule-engine-mapping.md
//     §5.2（24件）・§5.3（11用事の確定対応）・§5.5（OR 条件）・
//     §5.6（お墓の工事＝謝土、判定データなし）・§6A（主要用事の暫定12件）
//
// 並び順:
//   主要用事（暫定12件、人間側が提示した順）を先に、その後に §5.2 の残り、
//   §5.3 の残りの順。並び順は表示上のもので、判定には影響しない。
//
// 注意:
//   ・主要用事は暫定リスト（最終リストは人間が確定する）。
//   ・activityId は追加していない。「謝土」は109 activityId に存在しないため
//     judgeable: false とし、吉凶の判定に使わない。2026-09-27 人間側決定により、
//     判定できない用事は月間行動予定（画面・PDF）に一切表示しない（「判定不能」欄も作らない）。
//     対応（お墓の工事＝謝土）の記録としてだけ残している。
//   ・工事関係の細かい用事（建築・動土・上梁・修補垣牆・安吟など、109用事の
//     「建築・工事」の大半）は月間行動予定の表示対象に入れない。人間側で採用した
//     代表用事（工事始め・取り壊し・倉庫の修繕・倉庫のオープン）だけを載せる。
//     表示対象は31件（docs/monthly-action-schedule-engine-mapping.md §5.7）。

import { ACTIVITY_BY_ID } from "../activity/activityDefinitions";

export interface MonthlyActivityItem {
  /** 月間行動予定での表示名（旧PDFの一般語）。 */
  label: string;
  /**
   * 既存 activityId。2件以上ある場合は OR 条件（どちらか片方でも成立すれば
   * その表示用事が成立する。§5.5）。
   */
  activityIds: readonly string[];
  /** 主要用事（暫定）か。 */
  main: boolean;
  /**
   * 既存エンジンで吉凶を判定できるか。false の用事（謝土）は、吉用事・
   * 凶用事のどちらにも入れず、月間行動予定には表示しない。
   */
  judgeable: boolean;
}

function item(label: string, activityIds: string[], main = false, judgeable = true): MonthlyActivityItem {
  return { label, activityIds, main, judgeable };
}

export const MONTHLY_ACTIVITY_ITEMS: readonly MonthlyActivityItem[] = [
  // 主要用事（暫定12件。§6A）
  item("祭祀", ["祭祀"], true),
  item("参拝", ["祈福"], true),
  item("工事始め", ["修造動土"], true),
  item("取り壊し", ["破屋壊垣"], true),
  item("倉庫の修繕", ["修倉庫"], true),
  item("倉庫のオープン", ["開倉庫"], true),
  item("開店", ["開市"], true),
  item("契約", ["立券交易"], true),
  item("結婚", ["結婚姻"], true),
  item("結納", ["納采"], true),
  item("お出かけ", ["出行"], true),
  item("宴会", ["宴會"], true),

  // §5.2 の残り
  item("引っ越し", ["移徒"]),
  item("病気治療", ["求醫療病"]),
  item("針治療", ["鍼灸"]),
  item("お墓の掃除", ["掃舎宇"]),
  item("洋服のオーダー", ["裁衣"]),
  item("木を切る", ["伐木"]),
  // 「塀や垣根の修理」（修補垣牆）・「アプローチや路盤の工事」（安吟）は、
  // 2026-09-27 人間側決定により工事関係の専門的な用事（B）として表示対象から外した。
  item("魚釣り", ["取魚"]),
  item("乗船", ["乗船渡水"]),
  item("種まき", ["栽種"]),
  item("害虫駆除", ["捕捉"]),
  item("除霊", ["解除"]),
  item("ネイル", ["整手足甲"]),
  item("海外旅行", ["遠行"]),

  // §5.3 の残り
  item("温泉浴", ["沐浴"]),
  item("支払い", ["納財"]),
  item("葬儀", ["安葬"]),
  item("理美容", ["剃頭", "整容"]),
  item("家畜の手入れ", ["牧養"]),
  item("ペットの手入れ", ["養育", "納畜"]),
  item("お墓の工事", ["謝土"], false, false),
];

// 判定対象の activityId が既存の109件に実在することを起動時に確認する
// （対応表の書き間違いで、黙って neutral 扱いになるのを防ぐ）。
for (const it of MONTHLY_ACTIVITY_ITEMS) {
  if (!it.judgeable) continue;
  for (const id of it.activityIds) {
    if (!ACTIVITY_BY_ID[id]) {
      throw new Error(`月間行動予定の表示用事「${it.label}」の activityId「${id}」が既存の用事定義に存在しません`);
    }
  }
}
