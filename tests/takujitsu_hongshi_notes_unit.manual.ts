// tests/takujitsu_hongshi_notes_unit.manual.ts
//
// 目的:
//   洪氏錦嚢「解除・緩和条件」補足表示フェーズ（2026-09-11）の単体テスト。
//   docs/takujitsu_hongshi_activity_mapping.md で「表示可能」と確認した32件が
//   正しくHONGSHI_NOTESに登録され、getHongshiNotesFor()が仕様どおり
//   （吉凶混在時・該当凶神が一致する時だけ）補足を返すことを確認する。
//
//   これは最終吉凶判定ではない。HONGSHI_NOTES／getHongshiNotesFor()は
//   ActivityProfile・resolution・occurrence detectionを一切変更・参照しない
//   独立した表示専用データ・関数である。
//
// 実行:
//   npx tsx tests/takujitsu_hongshi_notes_unit.manual.ts

import { ACTIVITY_BY_ID, HONGSHI_NOTES, getHongshiNotesFor } from "../src/lib/takujitsu/activity";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

// 実装済みkyojin名ロスター（src/lib/takujitsu/shinsatsu/*.tsのkyojin.push(...)全66種と
// 完全一致するもののみ。docs/takujitsu_hongshi_activity_mapping.md §2の突合結果と同じ
// 基準で、表記ゆれ・別体系神殺名は含めない）。
const IMPLEMENTED_KYOJIN = new Set([
  "上兀", "上朔", "下兀", "九焦", "九空", "五墓", "五虚", "伏斷日", "八専", "八節日", "八風",
  "兵禁", "冰消瓦碎", "冰消瓦解", "刀砧日", "劫殺", "厭對", "受死日", "周堂殺", "四不詳",
  "四忌", "四撃", "四方耗", "四窮", "四絶", "四耗", "四離", "四廢", "土王用事", "土符",
  "地嚢", "地空", "埋兒凶宿", "大時", "大煞", "大空亡", "天乙絶気", "天吏", "天空", "天賊",
  "小時", "小空亡", "小耗", "往亡", "揚公忌", "月刑", "月厭", "月害", "月忌日", "月殺",
  "月破", "横天朱雀", "歸忌", "死気", "死神", "氣往亡", "災殺", "無禄", "瘟入", "瘟出",
  "短星", "血支", "觸水龍", "遊禍", "長星", "龍禁",
]);

// 1. 件数 = 32件（docs/takujitsu_hongshi_activity_mapping.md §3で確認した件数）
check(`HONGSHI_NOTES件数 = 32 (実際: ${HONGSHI_NOTES.length})`, HONGSHI_NOTES.length === 32);

// 2. 全件のactivityIdが現行95 ActivityDefinition内に存在すること
for (const note of HONGSHI_NOTES) {
  check(`${note.activityId}: ActivityDefinitionに存在する`, ACTIVITY_BY_ID[note.activityId] !== undefined);
}

// 3. 登録神殺名（unfavorableGod）が現行kyojin実装ロスターと完全一致すること
for (const note of HONGSHI_NOTES) {
  check(
    `${note.activityId}×${note.unfavorableGod}: unfavorableGodが実装済みkyojinロスターに存在する`,
    IMPLEMENTED_KYOJIN.has(note.unfavorableGod),
  );
}

// 4. conditionText・sourceText・sourcePageが空でないこと
for (const note of HONGSHI_NOTES) {
  check(`${note.activityId}×${note.unfavorableGod}: conditionTextが空でない`, note.conditionText.trim().length > 0);
  check(`${note.activityId}×${note.unfavorableGod}: sourceTextが空でない`, note.sourceText.trim().length > 0);
  check(`${note.activityId}×${note.unfavorableGod}: sourcePageが空でない`, note.sourcePage.trim().length > 0);
}

// 5. 用事別の内訳がdocs/takujitsu_hongshi_activity_mapping.md §3と一致すること
const countByActivity = new Map<string, number>();
for (const note of HONGSHI_NOTES) {
  countByActivity.set(note.activityId, (countByActivity.get(note.activityId) ?? 0) + 1);
}
const expectedCounts: [string, number][] = [
  ["動土", 1],
  ["堅柱上樑", 1],
  ["蓋屋", 1],
  ["開市", 13],
  ["上官赴任", 5],
  ["結婚納采", 9],
  ["安床", 2],
];
for (const [id, n] of expectedCounts) {
  check(`${id}: 件数 = ${n} (実際: ${countByActivity.get(id) ?? 0})`, (countByActivity.get(id) ?? 0) === n);
}
check("安葬は0件（登録なし）", !countByActivity.has("安葬"));
check("対応用事の種類数 = 7件", countByActivity.size === 7);

// -----------------------------------------------------------------------
// getHongshiNotesFor() の表示条件テスト（ActivityEvaluation相当のオブジェクトで検証）
// -----------------------------------------------------------------------

type Ev = { activityId: string; positiveSources: { sourceName: string }[]; negativeSources: { sourceName: string }[] };

// 6. 吉凶混在でない場合は表示されない（宜のみ）
{
  const ev: Ev = { activityId: "開市", positiveSources: [{ sourceName: "民日" }], negativeSources: [] };
  check("6. 宜のみ（吉凶混在でない）: 補足は0件", getHongshiNotesFor(ev).length === 0);
}

// 7. 吉凶混在でない場合は表示されない（忌のみ）
{
  const ev: Ev = { activityId: "開市", positiveSources: [], negativeSources: [{ sourceName: "劫殺" }] };
  check("7. 忌のみ（吉凶混在でない）: 補足は0件", getHongshiNotesFor(ev).length === 0);
}

// 8. 吉凶混在でも、該当する凶神が無ければ表示されない
{
  const ev: Ev = {
    activityId: "開市",
    positiveSources: [{ sourceName: "民日" }],
    negativeSources: [{ sourceName: "四忌" }], // HONGSHI_NOTESに開市×四忌の登録なし
  };
  check("8. 該当凶神なし: 補足は0件", getHongshiNotesFor(ev).length === 0);
}

// 9. HONGSHI_NOTESに登録の無いactivityIdでは表示されない（吉凶混在でも）
{
  const ev: Ev = {
    activityId: "祭祀",
    positiveSources: [{ sourceName: "普護" }],
    negativeSources: [{ sourceName: "月破" }],
  };
  check("9. 未登録activityId: 補足は0件", getHongshiNotesFor(ev).length === 0);
}

// 10. 吉凶混在＋該当凶神が一致する場合だけ表示される（単一該当）
{
  const ev: Ev = {
    activityId: "動土",
    positiveSources: [{ sourceName: "月徳" }],
    negativeSources: [{ sourceName: "天賊" }],
  };
  const notes = getHongshiNotesFor(ev);
  check("10. 動土×天賊: 補足1件", notes.length === 1);
  check("10. conditionTextが原文のまま", notes[0]?.conditionText === "吉神に押さえられれば良い");
  check("10. unfavorableGodが天賊", notes[0]?.unfavorableGod === "天賊");
}

// 11. 複数該当する場合は複数表示される（開市×劫殺・災殺・月殺が同時発生）
{
  const ev: Ev = {
    activityId: "開市",
    positiveSources: [{ sourceName: "民日" }],
    negativeSources: [{ sourceName: "劫殺" }, { sourceName: "災殺" }, { sourceName: "月殺" }],
  };
  const notes = getHongshiNotesFor(ev);
  check("11. 開市×(劫殺,災殺,月殺): 補足3件", notes.length === 3);
  const gods = notes.map((n) => n.unfavorableGod).sort();
  check("11. 対象神殺が(劫殺,災殺,月殺)と一致", JSON.stringify(gods) === JSON.stringify(["劫殺", "災殺", "月殺"].sort()));
}

// 12. 安葬（登録0件）は吉凶混在＋実在の凶神があっても常に0件
{
  const ev: Ev = {
    activityId: "安葬",
    positiveSources: [{ sourceName: "鳴吠" }],
    negativeSources: [{ sourceName: "月破" }],
  };
  check("12. 安葬は常に補足0件", getHongshiNotesFor(ev).length === 0);
}

// 13. アプリ側は条件充足・解除判定をしない（conditionTextをそのまま返すだけ）ことの確認
//     ＝ 返り値に verdict や resolved 等の判定フィールドが無いことを型レベルで保証
//     （HongshiNoteの型定義自体が activityId/unfavorableGod/conditionText/sourcePage/
//     sourceText のみを持つことは types上確認済み。ここでは値として不要な判定語
//     （「解除済み」「使用可」等）がconditionTextに含まれていないことを確認する）。
for (const note of HONGSHI_NOTES) {
  check(
    `${note.activityId}×${note.unfavorableGod}: conditionTextに断定的な判定語が含まれない`,
    !note.conditionText.includes("解除済み") && !note.conditionText.includes("使用可"),
  );
}

console.log("[区分B] ロジック単体テスト（洪氏錦嚢補足 hongshiNotes）");
console.log("根拠: docs/takujitsu_hongshi_activity_mapping.md §3\n");
console.log(`完全一致: ${pass} / ${pass + fail}`);
console.log(`不一致:   ${fail} / ${pass + fail}`);

if (fail > 0) {
  console.log("\n--- 不一致明細 ---");
  for (const f of failures) console.log(f);
  console.log(`\n${fail} 件 FAIL`);
  process.exit(1);
}

console.log(`\n${pass} / ${pass + fail} PASS`);
process.exit(0);
