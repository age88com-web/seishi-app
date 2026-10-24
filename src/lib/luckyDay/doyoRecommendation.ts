// src/lib/luckyDay/doyoRecommendation.ts
//
// 役割:
//   一般向け擇日サービス（/lucky-day）専用の「土用中の推薦除外」ルール。
//   土用入り日・土用中・土用明け日に、建築・土地・住宅工事系の用事を
//   「適したこと」「適した日」として勧めないための表示フィルター。
//
// 重要（ユーザー指示、2026-10-24）:
//   ・これは吉凶判定の変更ではない。擇日エンジン（src/lib/takujitsu）の
//     宜忌・verdict、プロ向け /takujitsu の表示は一切変えない。
//   ・除外した用事・日を「凶」へ移さない。「適したこと」「適した日」から
//     外すだけで、元の判定はそのまま保持する。
//   ・土用間日など未採用のルールは入れない。
//   ・このファイルは判定エンジンを import しない（クライアントからも使うため）。
//     土用かどうかは呼び出し側がエンジンの結果から渡す
//     （指定日＝その日の凶神に土王用事があるか、検索＝searchDaysAction が
//     resolveDoyoDayStatus で求めた日付一覧）。
//
// 対象用事の決め方:
//   purposeMapping.ts の「新築・建築」「リフォーム・修理・外構」「土地・土木・水工事」と
//   activityGroups.ts の「住まい・建築」から、建築・住宅工事・土を動かす工事の用事を
//   抽出し、葬儀側の破土（埋葬のために土を掘る）と、一般向け表示が
//   「キッチン（かまど）を設置・工事する」である作灶を加えた。
//   次は対象外とした:
//     ・移徒・入宅・搬入・伐木（土を動かさない）
//     ・安吟（洪氏錦嚢「安吟忌例」が「土府」「土符」問題ないと明記しているため、
//       一般向けでもこの原典上の例外を残す）

/** 土用中に一般向けの推薦から除外する用事（ActivityDefinition id）。 */
export const LUCKY_DAY_DOYO_EXCLUDED_ACTIVITY_IDS: readonly string[] = [
  // 新築・建築（purposeMapping "housing-build"）
  "建築", "動土", "修造動土", "起基定硬", "上梁", "安門",
  // リフォーム・修理・外構（purposeMapping "housing-renovate"。修造動土は上と重複）
  "修宅日", "修造", "破屋壊垣", "修飾垣墻", "作厠",
  // 土地・土木・水工事（purposeMapping "housing-land"。動土は上と重複、伐木は対象外）
  "平治道塗",
  // 「住まい・建築」グループの工事系（purposeMapping には無いもの。安吟は対象外）
  "堅柱上樑", "蓋屋", "修補垣牆", "築垣", "開井", "溝渠", "開道", "埋坑",
  "造倉庫", "苫蓋", "放水", "補垣塞穴", "築堤防", "開渠穿井", "安碓磑", "修倉庫",
  // 葬儀・墓・供養のうち土を掘るもの
  "破土",
  // 一般向け表示が「キッチン（かまど）を設置・工事する」のため（2026-10-24 追加）
  "作灶",
];

const EXCLUDED_SET: ReadonlySet<string> = new Set(LUCKY_DAY_DOYO_EXCLUDED_ACTIVITY_IDS);

/** 推薦から除外した用事が1件以上あるときに表示する注意文。 */
export const LUCKY_DAY_DOYO_NOTICE = "土用期間中のため、建築・工事関係の一部はおすすめから除外しています。";

/** 用事が土用中の推薦除外対象か。 */
export function isDoyoRecommendationExcluded(activityId: string): boolean {
  return EXCLUDED_SET.has(activityId);
}

/**
 * 指定日の凶神一覧（エンジンの shinsatsu.kyojin）から、その日が土用にかかるかを返す。
 * 土王用事は日単位で「その日の一部でも土用」なら成立する（土用入り日・土用中・土用明け日）。
 */
export function isDoyoDayFromKyojin(kyojin: readonly string[]): boolean {
  return kyojin.includes("土王用事");
}

/**
 * 「適したこと」の用事一覧から、土用中の推薦除外対象を外す。
 * 土用でない日はそのまま返す。excluded は外した用事（凶へは移さない）。
 */
export function splitDoyoRecommendedIds(
  goodIds: readonly string[],
  isDoyoDay: boolean,
): { kept: string[]; excluded: string[] } {
  if (!isDoyoDay) return { kept: [...goodIds], excluded: [] };
  const kept: string[] = [];
  const excluded: string[] = [];
  for (const id of goodIds) (isDoyoRecommendationExcluded(id) ? excluded : kept).push(id);
  return { kept, excluded };
}

/**
 * 「目的から吉日を探す」の「適した日」から、土用にかかる日を外す（対象用事の場合だけ）。
 * doyoDates は "YYYY-MM-DD" の集合。excludedCount は外した日数（凶へは移さない）。
 */
export function splitDoyoRecommendedDays<T extends { year: number; month: number; day: number }>(
  goodDays: readonly T[],
  activityId: string,
  doyoDates: ReadonlySet<string>,
): { kept: T[]; excludedCount: number } {
  if (!isDoyoRecommendationExcluded(activityId)) return { kept: [...goodDays], excludedCount: 0 };
  const kept: T[] = [];
  let excludedCount = 0;
  for (const d of goodDays) {
    const iso = `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    if (doyoDates.has(iso)) excludedCount += 1;
    else kept.push(d);
  }
  return { kept, excludedCount };
}
