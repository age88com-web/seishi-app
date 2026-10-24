// src/lib/takujitsu/activity/activityTermExpansions.ts
//
// 役割:
//   原典の一続きの用事語（例：「修造動土」）に付いた宜忌を、アプリ側で分割・
//   派生させた表示用事（例：「修造」「動土」「建築」）へ展開するための対応表。
//   ACTIVITY_PROFILES（原典の転記）は変更せず、getActivityProfile() が
//   プロファイルを引くときにだけこの表を適用する。
//
// 正式方針（2026-10-24 人間側決定）:
//   ・原文が「修造動土」と一続きで規定している場合 → 原則「修造」「動土」にも同じ適否。
//   ・原文が「修造」「動土」を個別に区別している場合 → その個別規定を優先する。
//   ・「建築」→ 修造動土のルールを自動継承しない。神殺・規則ごとに根拠がある場合だけ含める。
//   ・親子関係による無条件継承はしない。神殺×宜忌×原典用事ごとに1件ずつ登録する。
//   ・現在の登録は土王用事のみ。他の神殺は全神殺の対応監査の後に個別に追加する。
//
// 用語の関係（docs/takujitsu_decisions.md 2026-10-24 の項）:
//   ・月恩で、協紀（神殺象意.pdf）「宜…修造動土…」を擇日テキスト.pdf が
//     「修造・動土…」と2語に分けて訳している。
//   ・用事便覧.pdf は「修造動土」（#32）だけを定義している。
//   ・「建築」は擇日テキスト.pdf の日本語で、古典語の対応は無い
//     （金堂「建築、修造」、土符「建築全般」）。

import type { ActivityProfile } from "./types";

export interface ActivityTermExpansion {
  /** 展開を適用する神殺・十二建除・二十八宿（ActivityProfile と同じキー）。 */
  sourceType: ActivityProfile["sourceType"];
  sourceName: string;
  /** 宜側（favorableActivityIds）か忌側（unfavorableActivityIds）か。 */
  polarity: "favorable" | "unfavorable";
  /** 原典の一続きの用事語（そのプロファイルの該当配列に含まれていなければならない）。 */
  sourceTerm: string;
  /** 展開先の表示用事（ActivityDefinition id）。 */
  expandedActivityIds: string[];
  /** 展開の根拠（資料・人間側決定）。 */
  basis: string;
}

export const ACTIVITY_TERM_EXPANSIONS: readonly ActivityTermExpansion[] = [
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土", "建築"],
    basis:
      "擇日テキスト.pdf p.34・神殺象意.pdf〔土王用事〕は「修造動土」と一続きで忌とし、" +
      "修造・動土を区別する規定は無い。修造・動土は修造動土の分割用事、建築は土王用事について" +
      "含めると人間側で決定（2026-10-24）。",
  },
];

/**
 * profile に該当する展開を適用したプロファイルを返す（該当が無ければ profile をそのまま返す）。
 * 展開先が既に同じ配列にある場合は重複させない。展開元の用事語が該当配列に無い登録は
 * 原典との対応が崩れているため例外とする。
 */
export function applyTermExpansions(profile: ActivityProfile): ActivityProfile {
  const expansions = ACTIVITY_TERM_EXPANSIONS.filter(
    (e) => e.sourceType === profile.sourceType && e.sourceName === profile.sourceName,
  );
  if (expansions.length === 0) return profile;

  const favorable = [...profile.favorableActivityIds];
  const unfavorable = [...profile.unfavorableActivityIds];
  for (const e of expansions) {
    const target = e.polarity === "favorable" ? favorable : unfavorable;
    if (!target.includes(e.sourceTerm)) {
      throw new Error(
        `ACTIVITY_TERM_EXPANSIONS: ${e.sourceType}:${e.sourceName} の ${e.polarity} に「${e.sourceTerm}」がありません`,
      );
    }
    for (const id of e.expandedActivityIds) {
      if (!target.includes(id)) target.push(id);
    }
  }
  return { ...profile, favorableActivityIds: favorable, unfavorableActivityIds: unfavorable };
}
