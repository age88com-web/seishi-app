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
// 土王用事の実務展開（2026-10-24 人間側決定、秀山式の実務解釈）:
//   土王用事は「土を掘る・削る・盛る・基礎を造る・土地を造成する・井戸や溝を掘る・
//   墓地を掘削または施工するなど、土地そのものを動かす行為全般」を忌む。原典の11件
//   （ACTIVITY_PROFILES）は変更せず、土地を動かす表示用事を、最も近い原典語からの
//   展開として土王用事にだけ登録する。他の神殺へは波及させない。
//   墓関係は「墓を開く・墓穴を掘る」行為（啓攢・啓墳）だけを含め、儀礼としての
//   安葬・掃舎宇などは含めない。安吟は洪氏錦嚢「安吟忌例」が土府・土符を問題ないと
//   するため含めない。
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
  // 以下、土王用事の実務展開（土地そのものを動かす行為。2026-10-24 人間側決定）
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["起基定硬", "埋坑", "作厠", "修宅日"],
    basis:
      "土王用事は土地を動かす行為全般を忌む（秀山式の実務解釈、2026-10-24）。基礎工事（起基定硬）・" +
      "杭打ち（埋坑）・便所の造作（作厠）は土を動かす工事。修宅日は家の修理で修造と同義であり、" +
      "洪氏錦嚢「修宅日忌例」も土府・土符（土王用事は神殺象意で「義同土府」）を用いないとする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["造畜柵"],
    basis:
      "家畜用の柵を造る（造畜柵）は、杭・柱を地面へ設置する工事を含むため、土地を動かす行為として" +
      "土王用事の忌とする（秀山式の実務解釈、2026-10-24 人間側決定）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "開渠穿井",
    expandedActivityIds: ["開井", "溝渠"],
    basis: "井戸を掘る（開井）・溝や水路を造る（溝渠）は、原典の開渠穿井と同種の掘削（2026-10-24）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "平治道塗",
    expandedActivityIds: ["開道"],
    basis: "道路・通路を開く（開道）は、原典の平治道塗と同種の道路工事（2026-10-24）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "修飾垣墻",
    expandedActivityIds: ["築垣", "修補垣牆", "補垣塞穴"],
    basis:
      "塀・垣の造作と修理、壁や道の穴を埋める作業は、原典の修飾垣墻と同種（2026-10-24）。" +
      "神殺象意〔土王用事〕は同じ項目を「修補垣牆」と書く。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "修倉庫",
    expandedActivityIds: ["造倉庫"],
    basis: "倉庫を新しく造る（造倉庫）は、原典の修倉庫と同種の倉庫の造作（2026-10-24）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土王用事",
    polarity: "unfavorable",
    sourceTerm: "破土",
    expandedActivityIds: ["啓攢", "啓墳"],
    basis:
      "改葬のため墓を開く（啓攢）・墓を開く（啓墳）は、原典の破土と同じく墓地の土を動かす行為" +
      "（2026-10-24）。儀礼としての安葬は含めない。",
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
