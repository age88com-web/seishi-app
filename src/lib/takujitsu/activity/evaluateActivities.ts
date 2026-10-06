// src/lib/takujitsu/activity/evaluateActivities.ts
//
// 役割:
//   用途判定engine 第1フェーズ。その日に成立している吉神・凶神・
//   十二建除・二十八宿の象意（ActivityProfile）から、各用事について
//   「宜とする根拠」「忌とする根拠」を集約する。
//
//   十二建除「収」× 月恩／四相／時徳 クロス条件（2026-09-10追加）: 収が
//   成立し、かつ同日に 月恩・四相・時徳 のいずれかが成立していれば「修倉庫」を
//   宜とする（神殺象意.pdf 収日「與『月恩』『四相』『時德』併，宜修倉庫」）。
//   sourceType は "jianchu"（十二建除の条件付き宜）。
//   docs/takujitsu_jianchu_seasonal_rules.md。
//
//   第1.5パス（2026-09-10追加）: 月破成立日は GEPPO_DEITY_SET の徳神
//   （天徳・天徳合・月徳・月徳合・天赦・天願）が「德神臨此失力、不能爲福」
//   （神殺象意.pdf 月破）＝宜を生む力を失うため、第1パスで生成した
//   これら徳神の favorable(宜) contribution を除外する。抑制した事実は
//   ActivityEvaluationResult.suppressions に保持し、raw occurrence
//   （ShinsatsuResult.kichijin）は変更しない。
//   docs/takujitsu_geppo_deity_suppression_analysis.md。
//
//   第2パス（2026-09-10追加）: COMPOSITE型（六黄道の青龍・明堂・寶光・玉堂の4神。
//   司命は監修確定 2026-10-06 により対象外＝一般的な吉日を示す吉神）は、第1パス（＋第1.5パスの抑制後）で確定した他の吉神由来
//   positive・他の凶神由来negative（resolution適用後の有効な忌のみ）を、
//   自身の宜/忌としても追従させる（神殺象意.pdf「與吉神併則從所宜、與凶神
//   併則從所忌」。docs/takujitsu_liuhuangdao_composite_analysis.md）。金匱は
//   原文の列挙に含まれないため追従しない。第1.5パスで抑制された徳神
//   positiveは pass1 スナップショットに存在しないため、六黄道が復活させない。
//
// 唯一の仕様根拠:
//   docs/takujitsu_activity_rules.md
//   docs/takujitsu_resolution_rules.md
//
// 今回作らないもの（ユーザー指示、2026-09-09）:
//   ・独自の総合吉凶ルール・優先順位・点数化・ランキング
//   ・擇日象意.pdf 720行との本格照合（擇日象意.pdfは答え合わせ資料。
//     今回のロジックの仕様としては使わない）
//   ・カレンダーUI、目的から最良日を検索する機能
//
// 既存コード保護:
//   CalendarEngine・吉神/凶神occurrenceロジック・resolutionルール・
//   jianchu成立ロジック・shuku28宿値日ロジックは一切変更していない。
//   本ファイルはそれらの出力（ResolvedShinsatsuResult・JianchuResult・
//   Shuku28Info）を読み取るだけの新規レイヤー。

import type { ResolvedShinsatsuEntry, ResolvedShinsatsuResult } from "../resolution/types";
import type { JianchuResult } from "../jianchu";
import type { Shuku28Info } from "../shuku28";
import { getActivityProfile } from "./activityProfiles";
import { ACTIVITY_BY_ID } from "./activityDefinitions";
import type {
  ActivityEvaluation,
  ActivityEvaluationResult,
  ActivityProfile,
  ActivitySource,
  ActivitySourceType,
  ActivitySuppression,
  ActivityVerdict,
  ResolutionStatusLike,
  UnresolvedActivityRestriction,
} from "./types";

/**
 * 月破専用の徳神集合（2026-09-10、月破・徳神positive抑制フェーズ）。
 * 神殺象意.pdf月破「德神臨此失力、不能爲福」の「德神」＝擇日テキスト.pdf p.18
 * の月破ローカル定義「天徳（合）・天赦・天願・月徳（合）」。
 *
 * 重要: resolution/rules.ts の DEHE_GROUP（天徳/天徳合/月徳/月徳合/歳徳/
 * 歳徳合）を流用しない。DEHE_GROUP は歳徳・歳徳合を含み天赦・天願を含まない
 * ため、月破の「德神」とは一致しない（分類B＝一部のみ一致。
 * docs/takujitsu_geppo_deity_suppression_analysis.md 3章）。歳徳・歳徳合は
 * 推測で追加しない。偶然この6神は ActivityProfile で positiveMode:"all_except"
 * を持つ6神と完全一致する。
 */
const GEPPO_DEITY_SET: ReadonlySet<string> = new Set([
  "天徳",
  "天徳合",
  "月徳",
  "月徳合",
  "天赦",
  "天願",
]);

/** 月破positive抑制の理由文言（原典。神殺象意.pdf 月破）。 */
const GEPPO_SUPPRESSION_REASON = "德神臨此失力、不能爲福";

/** ActivityDefinition全件のid一覧（all_exceptモードの展開に使う）。 */
const ALL_ACTIVITY_IDS: string[] = Object.keys(ACTIVITY_BY_ID);

/**
 * ActivityProfile.favorableActivityIds の実効値を返す。
 * positiveMode==="all_except" の場合、ActivityDefinition全件から
 * positiveExceptionActivityIdsを除いた集合を返す（docs/takujitsu_except_resolution_final.md
 * 5章「諸事皆宜、惟忌〇〇」構造）。
 */
function resolveFavorableIds(profile: ActivityProfile): string[] {
  if (profile.positiveMode === "all_except") {
    const exceptions = new Set(profile.positiveExceptionActivityIds ?? []);
    return ALL_ACTIVITY_IDS.filter((id) => !exceptions.has(id));
  }
  return profile.favorableActivityIds;
}

/**
 * ActivityProfile.unfavorableActivityIds の実効値を返す。
 * negativeMode==="all_except" の場合、ActivityDefinition全件から
 * exceptionActivityIdsを除いた集合を返す（docs/takujitsu_except_resolution_final.md
 * 1〜4章「止不忌〇〇、餘事皆忌」構造）。exceptionActivityIdsは「不忌」であり
 * 「宜」ではないため、この関数はfavorable側には一切影響しない
 * （resolveFavorableIdsとは完全に独立）。
 */
function resolveUnfavorableIds(profile: ActivityProfile): string[] {
  if (profile.negativeMode === "all_except") {
    const exceptions = new Set(profile.exceptionActivityIds ?? []);
    return ALL_ACTIVITY_IDS.filter((id) => !exceptions.has(id));
  }
  return profile.unfavorableActivityIds;
}

export interface EvaluateActivitiesInput {
  /** 神殺解除・相殺・増悪レイヤーの適用結果（calculateTakujitsu().resolution）。 */
  resolution: ResolvedShinsatsuResult;
  /** その日の十二建除（calculateTakujitsu().buildingDay）。 */
  buildingDay: JianchuResult;
  /** その日の二十八宿（calculateTakujitsu().shuku28）。未算出の場合は省略可。 */
  shuku28?: Shuku28Info;
  /**
   * その日の二十四節気名（CalendarResult.solarTerm、2026-09-09追加）。
   * 執・危・収のように季節限定の宜/忌（ActivityProfile.seasonalRules）
   * を持つ十二建除の判定にのみ使う。省略した場合、季節限定の宜/忌は
   * 反映されない（既存の呼び出し側との後方互換のため任意項目にした。
   * monthBranch・lunarMonthではなくsolarTermを使う理由は
   * docs/takujitsu_jianchu_seasonal_rules.md参照）。
   */
  solarTerm?: string;
}

interface RawContribution {
  activityId: string;
  favorable: boolean;
  source: ActivitySource;
}

/**
 * 1つの神殺エントリ（吉神または凶神。resolution適用後）から、その日の
 * 宜/忌の根拠を組み立てる。
 *
 * resolution適用方針（ユーザー指示）:
 *   active     : 忌を通常反映
 *   cancelled  : その凶神由来の忌を反映しない（宜は引き続き反映する。
 *                cancelledは「凶意の解除」であって「宜の否定」ではない）
 *   aggravated : 忌を反映し、sourceにaggravated情報を保持
 *   reduced    : 原典で解除された範囲（＝ActivityProfileにマッピング済みの
 *                忌）は反映しない。ただし解除条件のnote（reason）に
 *                用途限定で残る忌の記述がある場合、unresolvedRestrictions
 *                側に保持する（具体的な用事へは勝手にマッピングしない）
 *   pending    : 勝手に解除せず、pending情報を保持した状態で忌を反映する
 */
function contributionsForEntry(
  sourceType: ActivitySourceType,
  entry: ResolvedShinsatsuEntry,
  applyResolution: boolean,
): { contributions: RawContribution[]; restriction?: UnresolvedActivityRestriction } {
  const profile = getActivityProfile(sourceType, entry.name);
  if (!profile) return { contributions: [] };

  const status: ResolutionStatusLike | undefined = applyResolution ? entry.status : undefined;
  const baseSource = (): ActivitySource => ({
    sourceType,
    sourceName: entry.name,
    resolutionStatus: status,
    // resolution固有の理由（entry.reason。例：aggravated/pendingの根拠）が
    // あればそちらを優先する。無ければActivityProfileの一般的な注記
    // （notes）にフォールバックする（その日固有の説明の方が一般的な
    // 象意注記より具体的で有用なため）。
    note: entry.reason ?? profile.notes,
    ...(profile.weakInfluence ? { weak: true } : {}),
  });

  const contributions: RawContribution[] = [];

  // 宜（favorable）はresolutionのcancel/reduceの対象外（凶意の解除・軽減は
  // 忌にのみ関係する）。今回のActivityProfileでfavorableを持つ凶神は
  // 月厭・天乙絶気のみで、いずれもresolutionルールの対象外（cancel/reduce/
  // aggravateの targets に含まれない）だが、将来targetsに追加された場合も
  // 安全なように、favorableは常に反映する。
  for (const id of resolveFavorableIds(profile)) {
    contributions.push({ activityId: id, favorable: true, source: baseSource() });
  }

  let restriction: UnresolvedActivityRestriction | undefined;

  // 原典が用事単位で解除不可と明記した忌（nonReleasableUnfavorableActivityIds）は、
  // cancelled／reduced でも残す（元々の忌集合に含まれるものだけ）。
  const pushNonReleasable = () => {
    const ids = profile.nonReleasableUnfavorableActivityIds;
    if (!ids || ids.length === 0) return;
    const unfavSet = new Set(resolveUnfavorableIds(profile));
    for (const id of ids) {
      if (unfavSet.has(id) && !contributions.some((c) => !c.favorable && c.activityId === id)) {
        contributions.push({ activityId: id, favorable: false, source: baseSource() });
      }
    }
  };

  if (applyResolution && status === "cancelled") {
    // 忌は反映しない（解除不可の個別禁止だけ残す）。
    pushNonReleasable();
  } else if (applyResolution && status === "reduced") {
    // 原典が用事単位で残存忌を明記している場合（例：小時＝月建の
    // 「與徳合等併、止忌動土、餘則不忌」）は、その用事だけ忌を反映する
    // （かつ元々の忌集合に含まれるものだけに限定する防御的フィルタ）。
    const stillUnfavorable = profile.reducedStillUnfavorableActivityIds;
    if (stillUnfavorable && stillUnfavorable.length > 0) {
      const unfavSet = new Set(resolveUnfavorableIds(profile));
      for (const id of stillUnfavorable) {
        if (unfavSet.has(id)) {
          contributions.push({ activityId: id, favorable: false, source: baseSource() });
        }
      }
    } else if (entry.reason) {
      // 具体的な用事へのマッピングが無い場合は、従来どおり生テキストを
      // unresolvedRestrictionsへ保持する（勝手にマッピングしない）。
      restriction = {
        sourceType,
        sourceName: entry.name,
        resolutionStatus: status,
        description: entry.reason,
      };
    }
    pushNonReleasable();
  } else {
    // active / aggravated / pending / (resolution非適用の吉神・十二建除・二十八宿)
    for (const id of resolveUnfavorableIds(profile)) {
      contributions.push({ activityId: id, favorable: false, source: baseSource() });
    }
  }

  return { contributions, restriction };
}

function computeVerdict(positiveCount: number, negativeCount: number): ActivityVerdict {
  if (positiveCount > 0 && negativeCount > 0) return "mixed";
  if (positiveCount > 0) return "good";
  if (negativeCount > 0) return "bad";
  return "neutral";
}

/**
 * その日に成立している吉神・凶神・十二建除・二十八宿の象意から、
 * 用事ごとの宜/忌の根拠を集約する。
 *
 * 重要: positive/negativeの件数比較による多数決はしない
 *  （「吉神の数が多いから吉」「凶神の数が多いから凶」という独自判定は禁止）。
 *  verdictは「positiveSourcesが1件でもあるか」「negativeSourcesが1件でも
 *  あるか」という事実の有無だけで決まる。
 */
export function evaluateActivities(input: EvaluateActivitiesInput): ActivityEvaluationResult {
  const all: RawContribution[] = [];
  const unresolvedRestrictions: UnresolvedActivityRestriction[] = [];

  for (const entry of input.resolution.kichijin) {
    // 吉神はresolutionルールの対象になり得ない（RESOLUTION_RULESのtargetsは
    // すべて凶神）ため、statusは常にactiveだが、将来の拡張に備えて
    // resolutionStatusとしてはそのまま保持する（cancel/reduce相当の分岐は
    // 通らない＝忌は常に反映される）。
    const { contributions } = contributionsForEntry("kichijin", entry, false);
    all.push(...contributions);
  }

  for (const entry of input.resolution.kyojin) {
    const { contributions, restriction } = contributionsForEntry("kyojin", entry, true);
    all.push(...contributions);
    if (restriction) unresolvedRestrictions.push(restriction);
  }

  const jianchuProfile = getActivityProfile("jianchu", input.buildingDay.name);
  if (jianchuProfile) {
    const source: ActivitySource = {
      sourceType: "jianchu",
      sourceName: input.buildingDay.name,
      note: jianchuProfile.notes,
    };
    for (const id of resolveFavorableIds(jianchuProfile)) all.push({ activityId: id, favorable: true, source });
    for (const id of resolveUnfavorableIds(jianchuProfile)) all.push({ activityId: id, favorable: false, source });

    // 季節限定の宜/忌（執・危・収。2026-09-09追加）。通常の宜/忌とは
    // 独立に評価し、互いを上書きしない（同じ用事に通常忌と季節宜が
    // 同時に成立する場合はmixedのまま。勝手に優先順位を作らない）。
    if (input.solarTerm && jianchuProfile.seasonalRules) {
      for (const rule of jianchuProfile.seasonalRules) {
        if (!rule.solarTerms.includes(input.solarTerm)) continue;
        const seasonalSource: ActivitySource = {
          sourceType: "jianchu",
          sourceName: input.buildingDay.name,
          note: rule.label,
        };
        for (const id of rule.favorableActivityIds ?? []) {
          all.push({ activityId: id, favorable: true, source: seasonalSource });
        }
        for (const id of rule.unfavorableActivityIds ?? []) {
          all.push({ activityId: id, favorable: false, source: seasonalSource });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 十二建除「収」× 月恩／四相／時徳 クロス条件（2026-09-10）
  //
  // 神殺象意.pdf 収日「宜進人口，納財，捕捉，納畜（義取諸收）。…與『月恩』
  // 『四相』『時德』併，宜修倉庫」。収が成立し、かつ同日に 月恩・四相・時徳 の
  // いずれか1つ以上が成立していれば「修倉庫」を宜とする
  // ＝ 収 AND (月恩 OR 四相 OR 時徳)。
  //
  // 方針（docs/takujitsu_jianchu_seasonal_rules.md）:
  //   ・原文「與 A B C 併」はブラケット列挙＋併存語のみで、共起（AND）を
  //     示す「一齊」「皆」「俱」等の語が無いため OR として扱う（月建（小時）
  //     の「與『天德』…『月恩』『四相』併，止忌動土」を anyOf で扱う既存
  //     resolution 実装と同じ判断基準。docs/takujitsu_resolution_rules.md
  //     1.4節。原本画像でも「時德」の直後は「併」で、皆/俱/同時 の語は無い）。
  //   ・sourceType は "jianchu"、sourceName は "収"。十二建除「収」の条件付き
  //     宜であって月恩・四相・時徳自身の宜ではないため、六黄道COMPOSITE
  //     （kichijin由来positiveのみ追従）はこの修倉庫positiveを追従しない。
  //   ・「修倉庫」を収の通常 favorableActivityIds には入れない（収単独では
  //     宜にならない）。月恩・四相・時徳の各 ActivityProfile にも入れない。
  //   ・月破の徳神positive抑制（第1.5パス）の対象ではない（sourceTypeが
  //     jianchuで、GEPPO_DEITY_SET由来のkichijin positiveではない）。月破が
  //     同日に「修倉庫」を忌にする場合は positive(収クロス)＋negative(月破)を
  //     双方保持し mixed（原典にない優先順位を付けない）。
  //   ・二重加点しない：複数の吉神が揃っても収sourceは1件だけ積み、note に
  //     成立した吉神名を列挙する。
  // -------------------------------------------------------------------------
  if (input.buildingDay.name === "収") {
    const activeTriggers = ["月恩", "四相", "時徳"].filter((n) =>
      input.resolution.kichijin.some((e) => e.name === n),
    );
    if (activeTriggers.length > 0 && ACTIVITY_BY_ID["修倉庫"]) {
      all.push({
        activityId: "修倉庫",
        favorable: true,
        source: {
          sourceType: "jianchu",
          sourceName: "収",
          note: `${activeTriggers.join("・")}と併して宜`,
        },
      });
    }
  }

  if (input.shuku28) {
    const shukuProfile = getActivityProfile("shuku28", input.shuku28.lodge);
    if (shukuProfile) {
      const source: ActivitySource = {
        sourceType: "shuku28",
        sourceName: input.shuku28.lodge,
        note: shukuProfile.notes,
      };
      for (const id of resolveFavorableIds(shukuProfile)) all.push({ activityId: id, favorable: true, source });
      for (const id of resolveUnfavorableIds(shukuProfile)) all.push({ activityId: id, favorable: false, source });
    }
  }

  // -------------------------------------------------------------------------
  // 第1.5パス: 月破による徳神positive抑制
  //
  // 神殺象意.pdf 月破「德神臨此失力、不能爲福、故即與德合併、猶忌」。
  // 月破成立日は GEPPO_DEITY_SET の徳神（天徳・天徳合・月徳・月徳合・天赦・
  // 天願）の「福をなす力」が失われる＝これら徳神が第1パスで生成した
  // favorable(宜) contribution を all から除外する。
  //
  // 方針（docs/takujitsu_geppo_deity_suppression_analysis.md、原典確定済み）:
  //   ・対象は sourceType==="kichijin" かつ sourceName∈GEPPO_DEITY_SET
  //     かつ favorable===true の contribution のみ。
  //   ・negative contribution・他吉神positive・十二建除・二十八宿には
  //     一切触れない。
  //   ・ActivityProfile（月破の negativeMode="all_except"、徳神6神の
  //     positiveMode="all_except"）は書き換えず、この日の評価結果だけを
  //     抑制する（evaluateActivities上のクロス参照規則）。
  //   ・月破のraw occurrence・resolution・cancelルールは変更しない。
  //     月破は現仕様でcancelされないため、resolution.kyojin に月破が
  //     status!=="cancelled" で存在すれば「有効成立」とみなす（raw occurrence
  //     だけを見ない＝将来 cancelled 月破が生じたらその日は抑制しない）。
  //   ・抑制した事実は suppressions[] に保持し、raw occurrence
  //     （ShinsatsuResult.kichijin）からは削除しない（二層構造）。
  //   ・第2パス（六黄道COMPOSITE）は下の pass1 スナップショット（＝抑制後の
  //     all）だけを走査するため、抑制された徳神positiveを追従・復活させない。
  //   ・月破の例外11語（exceptionActivityIds）は「不忌」であって「宜」では
  //     ないため、徳神positiveも抑制されると neutral になり得る（正しい。
  //     例外語をpositiveへ変換しない）。
  // -------------------------------------------------------------------------
  const suppressions: ActivitySuppression[] = [];
  const geppoActive = input.resolution.kyojin.some(
    (e) => e.name === "月破" && e.status !== "cancelled",
  );
  if (geppoActive) {
    const suppressedByDeity = new Map<string, Set<string>>();
    const kept: RawContribution[] = [];
    for (const c of all) {
      if (
        c.favorable &&
        c.source.sourceType === "kichijin" &&
        GEPPO_DEITY_SET.has(c.source.sourceName)
      ) {
        const set = suppressedByDeity.get(c.source.sourceName) ?? new Set<string>();
        set.add(c.activityId);
        suppressedByDeity.set(c.source.sourceName, set);
        continue; // このcontributionは除外
      }
      kept.push(c);
    }
    if (suppressedByDeity.size > 0) {
      all.length = 0;
      all.push(...kept);
      for (const [deityName, ids] of suppressedByDeity) {
        suppressions.push({
          sourceType: "kichijin",
          sourceName: deityName,
          suppressedByType: "kyojin",
          suppressedByName: "月破",
          reason: GEPPO_SUPPRESSION_REASON,
          activityIds: [...ids].sort((a, b) => a.localeCompare(b, "ja")),
        });
      }
      suppressions.sort((a, b) => a.sourceName.localeCompare(b.sourceName, "ja"));
    }
  }

  // -------------------------------------------------------------------------
  // 第2パス: COMPOSITE型（六黄道の青龍・明堂・寶光・玉堂の4神。司命は 2026-10-06 監修確定で対象外）
  //
  // 神殺象意.pdf「〔青龍〕〔明堂〕〔寶光〕〔玉堂〕〔司命〕爲六黄道日，與吉神
  // 併，則從所宜，與凶神併，則從所忌」。同日に成立している他の吉神由来の
  // 有効なpositive・他の凶神由来の有効なnegativeを、そのCOMPOSITE型神自身の
  // 宜/忌としても追従させる。
  //
  // 方針（docs/takujitsu_liuhuangdao_composite_analysis.md、ユーザー確定
  // 2026-09-10）:
  //   ・参照対象は第1パスで積まれた kichijin由来positive / kyojin由来
  //     negative のみ。kichijin由来negative・kyojin由来positive・十二建除・
  //     二十八宿は追従しない（原文が「神」と呼ぶ対象＝吉神・凶神に一致）。
  //   ・kyojin由来negativeは第1パスの時点で resolution 適用後の有効な忌
  //     だけが積まれている（cancelledは0件、reducedはreducedStill
  //     UnfavorableActivityIdsのみ）。したがってcancelledの忌をCOMPOSITEが
  //     復活させることはない。
  //   ・COMPOSITE型神自身のcontribution（第1パスのLIST型「家族会議・遠行」
  //     を含む）は参照しない＝COMPOSITE同士を再帰的にコピーしない。
  //     第1パスのスナップショット（pass1）だけを走査し、第2パスで追加した
  //     contributionは再走査しないため、連鎖は原理的に起きない。
  //   ・COMPOSITE単独成立（他の吉神・凶神からその用事への宜忌が無い）の
  //     場合、COMPOSITE自身からpositive/negativeを新規生成しない。
  //   ・二重加点しない: 同じ(用事, 宜/忌)にそのCOMPOSITE型神のsourceを
  //     複数積まない（元々のLIST型で既にある分・複数の参照元がある分とも
  //     1件に集約する。verdictは件数ではなく有無で決まるため判定は不変）。
  // -------------------------------------------------------------------------
  const pass1: RawContribution[] = all.slice();
  const compositeGods = input.resolution.kichijin.filter((e) => {
    const p = getActivityProfile("kichijin", e.name);
    return p?.composite === true;
  });
  for (const god of compositeGods) {
    // このCOMPOSITE型神が第1パスで既に積んでいる(用事|宜忌)キー（LIST型
    // 「家族会議・遠行」等）。二重加点を避けるための除外集合。
    const already = new Set<string>();
    for (const c of pass1) {
      if (c.source.sourceType === "kichijin" && c.source.sourceName === god.name) {
        already.add(`${c.activityId} ${c.favorable}`);
      }
    }
    for (const c of pass1) {
      // 追従対象は「吉神由来positive」または「凶神由来negative」のみ。
      const isKichijinPositive = c.source.sourceType === "kichijin" && c.favorable;
      const isKyojinNegative = c.source.sourceType === "kyojin" && !c.favorable;
      if (!isKichijinPositive && !isKyojinNegative) continue;
      // 参照元が別のCOMPOSITE型神なら追従しない（再帰コピー防止）。
      if (c.source.sourceType === "kichijin") {
        const refProfile = getActivityProfile("kichijin", c.source.sourceName);
        if (refProfile?.composite) continue;
      }
      const key = `${c.activityId} ${c.favorable}`;
      if (already.has(key)) continue;
      already.add(key);
      all.push({
        activityId: c.activityId,
        favorable: c.favorable,
        source: {
          sourceType: "kichijin",
          sourceName: god.name,
          note: c.favorable
            ? `吉神「${c.source.sourceName}」の宜に従う`
            : `凶神「${c.source.sourceName}」の忌に従う`,
        },
      });
    }
  }

  // activityIdごとにグルーピング。ActivityDefinitionに存在しないIDは
  // ActivityProfile側の誤りが将来混入しても評価結果に出さない（防御的フィルタ）。
  const byId = new Map<string, { positive: ActivitySource[]; negative: ActivitySource[] }>();
  for (const c of all) {
    if (!ACTIVITY_BY_ID[c.activityId]) continue;
    const bucket = byId.get(c.activityId) ?? { positive: [], negative: [] };
    if (c.favorable) bucket.positive.push(c.source);
    else bucket.negative.push(c.source);
    byId.set(c.activityId, bucket);
  }

  const evaluations: ActivityEvaluation[] = [];
  for (const [activityId, { positive, negative }] of byId) {
    const hasPendingSource =
      positive.some((s) => s.resolutionStatus === "pending") ||
      negative.some((s) => s.resolutionStatus === "pending");
    evaluations.push({
      activityId,
      positiveSources: positive,
      negativeSources: negative,
      verdict: computeVerdict(positive.length, negative.length),
      hasPendingSource,
    });
  }

  // activityId順（安定した出力順にするため、辞書順ソート）。
  evaluations.sort((a, b) => a.activityId.localeCompare(b.activityId, "ja"));

  return { evaluations, unresolvedRestrictions, suppressions };
}

// テスト・上位レイヤーから直接使えるように、verdict計算部分も公開する
// （positive/negativeの件数だけを渡す純粋関数。多数決はしない＝件数の
// 大小比較ではなく「1件以上あるか」だけを見る、という仕様そのものを
// 単体テストで直接検証できるようにするため）。
export { computeVerdict };
