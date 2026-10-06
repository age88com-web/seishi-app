// src/lib/takujitsu/jika/hourClassification.ts
//
// 役割:
//   時家720表の1マス（getJikaEntry().normalizedTerms）に含まれる語を
//   「吉神／凶神／独立」に分類する表と、その件数から時辰の状態を返す関数。
//
// 由来（2026-09-27、月間行動予定フェーズ）:
//   src/app/takujitsu/page.tsx 内にあった分類（JIKA_KICHIJIN_NAMES・
//   JIKA_KYOUJIN_NAMES・JIKA_ALIAS_CATEGORY・classifyJikaTerm・jikaHourState）を、
//   月間行動予定（src/lib/takujitsu/monthly/）と共有するため、中身を一切変えずに
//   そのまま移動した（docs/monthly-action-schedule-engine-mapping.md §9）。
//   分類語・分類結果・状態の判定は移動前と同一。page.tsx は本ファイルを import する。

// 2026-09-13追記（時辰別吉凶レイアウトフェーズ）:
//   「日付を選んだ直後に、その日12時辰の吉凶がまず目に入る」構成にするための
//   用途非依存の一覧・詳細表示。ここでの「吉神／凶神」分類は新しい判定では
//   なく、docs/takujitsu_jika_shinsatsu_names_audit.md 13.1節（吉神42語）・
//   13.2節（凶神25語）・13.3節／15章（略記・複合表記・種別未特定の総称表現の
//   対応、いずれも確定済み）をそのまま転記したもの。神殺の「存在種別」を
//   数えるだけであり、用事別の吉凶判定（evaluateJikaActivity）や109用事
//   mapping・点数化・ランキング・相殺・優先順位とは無関係。
export const JIKA_KICHIJIN_NAMES = new Set<string>([
  "長生", "帝旺", "馬元", "驛馬", "祿元", "六合", "五合", "喜神", "三合", "羅天大進",
  "羅紋", "祿貴", "交馳", "陰陽喜人", "天乙喜人", "福星貴人", "天官貴人", "太陰吉時", "太陽", "天赦",
  "國印五符", "唐符五符", "天寶黃道", "青龍黃道", "鳳鸞黃道", "司命黃道", "少微黃道", "玉堂黃道",
  "寶光黃道", "天德黃道", "福德黃道", "金匱黃道", "左輔黃道", "明堂黃道", "武曲", "貪狼", "左輔",
  "木星", "金星", "水星", "傳送", "功曹",
  // 2026-09-13追記：「進貴」はユーザー原本確認により「羅紋」の略記ではなく
  // 「羅紋交貴」という単一の神殺名であることが確定した（分割しない）。
  "羅紋交貴",
  // 2026-09-13追記：「進祿」も同様に「祿貴」の略記ではなく「祿貴交馳」と
  // いう単一の神殺名であることが確定した（分割しない）。
  "祿貴交馳",
]);
export const JIKA_KYOUJIN_NAMES = new Set<string>([
  "朱雀黑道", "白虎黑道", "元武黑道", "勾陳黑道", "天刑黑道", "天牢黑道", "下食凶時", "天狗凶時",
  "地兵凶時", "天兵凶時", "暗天賊時", "路空亡時", "截空亡時", "日相沖破", "時相沖破",
  "五不遇", "五鬼時", "雷兵時", "日害時", "日刑時", "日殺時", "日建時", "旬空時", "六戊時", "大退時",
]);
// 720表側の略記・複合表記・「種別未特定」総称表現 → 吉神／凶神（13.3節・15章）。
// 「種別未特定」表現は、対応しうる正式名称が複数あっても、そのいずれもが
// 同じ種別（吉神または凶神）に属することが既に確定しているため、種別だけは
// 一意に判定できる（個別の正式名称までは特定していない）。
export const JIKA_ALIAS_CATEGORY: Record<string, "吉" | "凶"> = {
  "右弼→左輔": "吉", "左輔(右弼)": "吉", "退時→大退時": "凶",
  "羅天大進(大進)": "吉",
  "國印五符(國印)": "吉", "唐符五符(唐符)": "吉",
  "天狗凶時+下食凶時(狗食)": "凶",
  "寶光黃道／天德黃道(要再確認)": "吉",
  "五符(種別未特定)": "吉",
};

export function classifyJikaTerm(name: string): "吉" | "凶" | "独立" {
  if (JIKA_KICHIJIN_NAMES.has(name)) return "吉";
  if (JIKA_KYOUJIN_NAMES.has(name)) return "凶";
  const alias = JIKA_ALIAS_CATEGORY[name];
  if (alias) return alias;
  return "独立"; // 独立時家用語（交貴・日祿・比肩など）・指示文（同類相資等）
}

export type JikaHourState = "吉神のみ" | "凶神のみ" | "吉凶あり" | "該当なし";
export function jikaHourState(kichi: number, kyo: number): JikaHourState {
  if (kichi > 0 && kyo > 0) return "吉凶あり";
  if (kichi > 0) return "吉神のみ";
  if (kyo > 0) return "凶神のみ";
  return "該当なし";
}
