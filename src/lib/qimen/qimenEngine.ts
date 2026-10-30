// src/lib/qimen/qimenEngine.ts
//
// 役割:
//   奇門遁甲の統合エンジン。CalendarEngine の結果を起点に、
//   定局 → 地盤 → 旬首 → 天盤 → 九星 → 八門 → 八神 → 格局（吉格・凶格） を
//   順番に呼び出し、1回の calculate() で完成した奇門時盤データを返す。
//   各既存モジュールの内部ロジックは一切変更せず、呼び出して結果を
//   まとめるだけの薄い統合層とする。
//   格局判定は jikaku.ts（吉格）／kyokaku.ts（凶格）へ委譲する。両モジュールの
//   *FromQimen ラッパに、排盤まで組み立てた QimenResult を渡して結果を得る。
//
// 仕様の出典:
//   docs/qimen-spec/10_排盤完成.md、および元Keynote
//   「奇門遁甲講義案N.key」の「排盤の完成」スライド（Index/Slide-3001）を
//   直接デコードして確認した。同スライドの完成図には
//   門(八門)／六儀三奇の固定対応干+九星／地盤干+八神 の3段が示されており、
//   天盤は表示されていなかったが、天盤は既存モジュール(tianpan.ts)として
//   既に確定済みのため、統合結果には含める。
//
//   完成図の八門の並びは、講義資料PDF「奇門遁甲講義案八門.pdf」28〜29ページの
//   具体的な導出手順（①〜⑤）から確定した bamen.ts の結果と、
//   洛書九宮の対向宮（環の反対側）の関係でずれていた。bamen.ts は手順を
//   数値で完全に検証済みであるため変更せず、この食い違いは事実としてのみ記録する。
//
// 新たに判明した未対応ケース（時干が甲になる場合）:
//   地盤には六儀三奇(戊己庚辛壬癸丁丙乙)の9干のみが存在し、甲は存在しない。
//   時干が甲のとき、tianpan.ts / jiuxing.ts / bamen.ts / bashen.ts は
//   いずれも「地盤に時干が見つかりません」で例外を投げる（この統合作業で
//   初めて発覚した。60干支のうち甲が時干になるのは1/10の頻度で発生する）。
//   「甲は旬首の六儀(liuyi)の宮に隠れる」という一般論はあるが、この
//   ルール自体は今回参照した講義スライド（地盤・天盤・九星・八門・八神の
//   各章、および排盤の完成）のどこにも明記されておらず、推測で補うことは
//   しない。既存モジュールも変更しない。そのためこの統合層では、
//   各モジュールが例外を投げた場合はその段のみ未算出（null）として扱い、
//   統合処理全体は止めずに、算出できた段だけを返す。

import { calculate as calculateCalendar } from "../calendar";
import type { CalendarInput, CalendarResult } from "../calendar";
import type { Stem, Branch } from "../eto";

import { resolveDingju } from "./dingju";
import type { DingjuResult } from "./dingju";

import { resolveDiPan } from "./dipan";
import type { DiPanResult, DiPanStem } from "./dipan";

import { resolveXunShou } from "./xunshou";
import type { XunShouResult } from "./xunshou";

import { resolveTianPan } from "./tianpan";
import type { TianPanResult } from "./tianpan";

import { resolveJiuXing } from "./jiuxing";
import type { JiuXingResult, JiuXingStar } from "./jiuxing";

import { resolveBaMen } from "./bamen";
import type { BaMenResult, BaMenName } from "./bamen";

import { resolveBaShen } from "./bashen";
import type { BaShenResult, BaShenName } from "./bashen";

import { resolveJikakuFromQimen } from "./jikaku";
import type { JikakuResult } from "./jikaku";

import { resolveKyokakuFromQimen } from "./kyokaku";
import type { KyokakuResult } from "./kyokaku";

import { resolveCenterLodging, lodgedStemsAt, resolveQinCompanion, qinCompanionAt } from "./stemAccess";
import type { CenterLodging, LodgedStem, QinCompanionStem } from "./stemAccess";

export interface PalaceSummary {
  diPanStem?: DiPanStem;
  tianPanStem?: DiPanStem;
  jiuXing: JiuXingStar[];
  baMen: BaMenName[];
  baShen: BaShenName[];
  /**
   * 地盤の寄宮干（坤二宮のみ）＝中五宮の地盤干。diPanStem は変更しない。
   * 追加のみの項目で、現在の格局判定は参照しない（stemAccess.ts 参照）。
   */
  diPanLodged?: LodgedStem;
  /**
   * 天禽帯同干（天禽・天芮が配置された宮のみ）＝天禽・天芮に伴って運行する中五宮の地盤干。
   * 格局判定専用（stemAccess.ts）。天盤の通常干 tianPanStem とは別物で、盤面・宮詳細・検索候補・
   * 比較・印刷には表示しない。剋應にも使わない（2026-10-30 監修者の正式決定）。
   */
  qinCompanion?: QinCompanionStem;
}

export interface QimenResult {
  calendar: CalendarResult;
  dingju: DingjuResult;
  diPan: DiPanResult;
  xunShou: XunShouResult;
  /** 該当モジュールが例外を投げた場合は null（未算出）。理由は対応する *Error に入る。 */
  tianPan: TianPanResult | null;
  tianPanError: string | null;
  jiuXing: JiuXingResult | null;
  jiuXingError: string | null;
  baMen: BaMenResult | null;
  baMenError: string | null;
  baShen: BaShenResult | null;
  baShenError: string | null;
  /** 九宮(1〜9)ごとに、地盤・天盤・九星・八門・八神をまとめた最終的な式盤。 */
  palaces: Record<number, PalaceSummary>;
  /** 中宮寄宮の情報（中五宮の地盤干の寄宮先＝坤二宮）。天盤の寄宮は無い。 */
  centerLodging: CenterLodging;
  /** 天禽帯同干（格局判定専用・表示しない）。九星が未算出なら null。 */
  qinCompanion: QinCompanionStem | null;
  /** 吉格判定（jikaku.ts）。天盤・八門・八神が未算出の格は unavailable に載る。 */
  jikaku: JikakuResult;
  /** 凶格判定（kyokaku.ts）。同上。 */
  kyokaku: KyokakuResult;
}

function tryRun<T>(fn: () => T): [T, null] | [null, string] {
  try {
    return [fn(), null];
  } catch (e) {
    return [null, e instanceof Error ? e.message : String(e)];
  }
}

/**
 * 奇門遁甲: CalendarEngine の入力から、定局・地盤・旬首・天盤・九星・八門・八神を
 * 順番に呼び出し、完成した奇門時盤データを返す。格局判定は行わない。
 */
export function calculate(input: CalendarInput): QimenResult {
  // 1. CalendarEngine
  const calendar = calculateCalendar(input);
  const hourStem = calendar.hourStem as Stem;
  const hourBranch = calendar.hourBranch as Branch;

  // 2. 定局（天文学的な節入り瞬間ではなく、符頭の15日連続系列＋二至の置閏判定で
  //    「今有効な節気パターン」を決める。詳細は dingju.ts 冒頭コメント参照）
  const dingju = resolveDingju({
    localYear: input.year,
    localMonth: input.month,
    localDay: input.day,
    localHour: input.hour,
    timezone: input.timezone,
    dayStem: calendar.dayStem as Stem,
    dayBranch: calendar.dayBranch as Branch,
  });

  // 3. 地盤
  const diPan = resolveDiPan({ dun: dingju.dun, ju: dingju.ju });

  // 4. 旬首
  const xunShou = resolveXunShou({ hourStem, hourBranch });
  const liuyi = xunShou.liuyi as DiPanStem;

  // 5. 天盤
  const [tianPan, tianPanError] = tryRun(() =>
    resolveTianPan({ diPan, hourStem, liuyi }),
  );

  // 6. 九星
  const [jiuXing, jiuXingError] = tryRun(() =>
    resolveJiuXing({ diPan, liuyi, hourStem }),
  );

  // 7. 八門
  const [baMen, baMenError] = tryRun(() =>
    resolveBaMen({ diPan, dun: dingju.dun, liuyi, xunShou: xunShou.xunShou, hourStem, hourBranch }),
  );

  // 8. 八神
  const [baShen, baShenError] = tryRun(() =>
    resolveBaShen({ diPan, dun: dingju.dun, hourStem, liuyi }),
  );

  // 9. 中宮寄宮の情報（既存の排盤結果を読むだけ。配置計算は変更しない）
  const centerLodging = resolveCenterLodging({ diPan });
  //    天禽帯同干（格局判定専用。天盤の通常干とは別に持ち、表示しない）
  const qinCompanion = resolveQinCompanion({ diPan, jiuXing });

  // 10. 九宮ごとに重ね合わせる（未算出の段は空として扱う）。
  //     寄宮干は既存の干を上書きせず、該当する宮にだけ別項目として付ける。
  const palaces: Record<number, PalaceSummary> = {};
  for (let palace = 1; palace <= 9; palace += 1) {
    palaces[palace] = {
      diPanStem: diPan[palace],
      tianPanStem: tianPan?.[palace],
      jiuXing: jiuXing?.jiuXing[palace] ?? [],
      baMen: baMen?.baMen[palace] ?? [],
      baShen: baShen?.baShen[palace] ?? [],
      // 天盤の中宮(5)は干を持たない（tianpan.ts。天盤には地盤由来の寄宮干が存在しない）。
      ...lodgedStemsAt(centerLodging, palace),
      ...qinCompanionAt(qinCompanion, palace),
    };
  }

  // 11. 格局（吉格・凶格）: 排盤まで組み立てた QimenResult を jikaku.ts / kyokaku.ts の
  //     *FromQimen ラッパに渡して判定する。両ラッパは QimenResult の
  //     palaces / xunShou / baMen / baShen / jiuXing / calendar / dingju のみ参照する
  //     （地盤寄宮干 diPanLodged・天禽帯同干 qinCompanion は stemAccess.ts の方針に従って参照する）。
  const base: Omit<QimenResult, "jikaku" | "kyokaku"> = {
    calendar,
    dingju,
    diPan,
    xunShou,
    tianPan,
    tianPanError,
    jiuXing,
    jiuXingError,
    baMen,
    baMenError,
    baShen,
    baShenError,
    palaces,
    centerLodging,
    qinCompanion,
  };

  const jikaku = resolveJikakuFromQimen(base as QimenResult);
  const kyokaku = resolveKyokakuFromQimen(base as QimenResult);

  return { ...base, jikaku, kyokaku };
}
