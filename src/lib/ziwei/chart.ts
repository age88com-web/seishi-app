// src/lib/ziwei/chart.ts
//
// 紫微斗数 Phase 1 の作盤（§1 の12手順）。正本: docs/ziwei-basic-spec.md
//
//   1. 出生時刻の補正（§2.7）→ 作盤日（§2.5）→ 固定UTC+8基準の陰暦（§2.1）→ 閏月の前半・後半（§2.4）
//   2. 命宮・身宮（§3・§4）
//   3. 十二宮（§5）
//   4. 五行局（§6）
//   5. 紫微星（§7）
//   6〜10. 十四主星・時系・月系・年干系（四化を含む）・年支系（§8〜§12）
//   11. 大限（§13）
//   12. 小限（§14）

import type { Palace, PlacedStar, TransformationKind, WallClock, ZiweiChart, ZiweiInput } from "./types";
import { PLACED_STARS } from "./data";
import { correctBirthTime } from "./timeCorrection";
import { birthMonthOf, judgeLeapHalf, lunarDateOf, resolveChartDate, secondsOfDay } from "./lunisolar";
import { arrangePalaces, hourBranchOf, mingPalaceOf, shenPalaceOf } from "./palaces";
import { fiveElementBureauOf, ziweiStarOf } from "./fiveElementBureau";
import { placeStars } from "./stars";
import { transformationsOf } from "./transformations";
import { dayunOf } from "./dayun";
import { xiaoxianOf } from "./xiaoxian";

export function calculateZiweiChart(input: ZiweiInput): ZiweiChart {
  const legal: WallClock = { ...input.birth, second: input.birth.second ?? 0 };

  // 手順1（§2.8）: 補正済み時刻 → 作盤日 → 陰暦 → 閏月の前半・後半
  const timeCorrection = correctBirthTime(legal, input.place);
  const corrected = timeCorrection.corrected;
  const { chartDate, advancedAt23 } = resolveChartDate(corrected);
  const lunar = lunarDateOf(chartDate);
  const leapHalf = judgeLeapHalf(lunar, corrected, advancedAt23);
  const birthMonth = birthMonthOf(lunar, leapHalf);
  const birthDay = lunar.day;
  const hourBranch = hourBranchOf(secondsOfDay(corrected));
  const { yearStem, yearBranch } = lunar;

  // 手順2〜5
  const mingPalace = mingPalaceOf(birthMonth, hourBranch);
  const shenPalace = shenPalaceOf(birthMonth, hourBranch);
  const bureau = fiveElementBureauOf(yearStem, mingPalace);
  const ziwei = ziweiStarOf(bureau, birthDay);

  // 手順6〜10
  const starPositions = placeStars({ ziwei, hourBranch, birthMonth, yearStem, yearBranch });
  const transformations = transformationsOf(yearStem, starPositions);

  // 手順11〜12
  const dayun = dayunOf({ yearStem, sex: input.sex, bureau, mingPalace });
  const xiaoxian = xiaoxianOf(yearBranch, input.sex);

  const palaces: Palace[] = arrangePalaces(mingPalace).map(({ name, branch }) => {
    const period = dayun.periods.find((p) => p.branch === branch)!;
    return {
      name,
      branch,
      isShenPalace: branch === shenPalace,
      stars: PLACED_STARS.filter((s: PlacedStar) => starPositions[s] === branch),
      transformations: transformations
        .filter((t) => t.branch === branch)
        .map((t): TransformationKind => t.kind),
      dayun: { startAge: period.startAge, endAge: period.endAge },
    };
  });

  return {
    timeCorrection,
    chartDate,
    advancedAt23,
    lunar,
    leapHalf,
    birthMonth,
    birthDay,
    hourBranch,
    yearStem,
    yearBranch,
    sex: input.sex,
    mingPalace,
    shenPalace,
    bureau,
    palaces,
    starPositions,
    transformations,
    dayun,
    xiaoxian,
  };
}
