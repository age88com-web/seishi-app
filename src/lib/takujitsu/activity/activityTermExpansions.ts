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
//   ・2026-10-24 の全神殺監査（P1-5）で、原典語「修造動土」を持つ神殺・十二建除に修造・動土の展開を
//     登録した（建築は自動継承しない）。
//   ・同日の監修判断で、土王用事と同じ「土地を動かす行為全般」の展開を土符・地嚢・月建（小時＝土府）にも
//     登録し、堅柱上樑の忌を上梁へ、立券交易の忌を交易へ一方向に展開した（宜には広げない）。
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
  // 以下、原典語「修造動土」の修造・動土への分割（2026-10-24 決定の原則を全神殺監査 P1-5 で適用）
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「忌…修造動土」。軽減後は象意「止忌動土」により動土だけ残す（reducedStillUnfavorableActivityIds）。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "血支",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "擇日テキスト6）「興造動土」・神殺象意〔閉日〕〔血支〕「忌…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "大時",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔大時〕「忌…修造動土」（修造は擇日テキスト11）「増改築」により既に登録済み）。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "天吏",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔天吏〕「忌同大時」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔土符〕〔地囊〕「忌…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔土符〕〔地囊〕「忌…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kyojin",
    sourceName: "五墓",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔五墓〕「忌…修造動土」（修造は擇日テキスト19）により既に登録済み）。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "jianchu",
    sourceName: "開",
    polarity: "favorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔開日〕「宜…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kichijin",
    sourceName: "四相",
    polarity: "favorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔月恩〕〔四相〕〔時德〕「宜…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kichijin",
    sourceName: "時徳",
    polarity: "favorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔月恩〕〔四相〕〔時德〕「宜…修造動土」。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  {
    sourceType: "kichijin",
    sourceName: "三合",
    polarity: "favorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["修造", "動土"],
    basis: "神殺象意〔三合〕「宜…修造動土」（修造は既に登録済み）。原文が修造動土と一続きで規定し、修造・動土を区別する規定が無いため、2026-10-24 決定の原則により同じ適否とする。",
  },
  // 以下、土府系（土符・地嚢・小時）への土地展開（2026-10-24 監修判断。土王用事と同じ対象）
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["起基定硬", "埋坑", "作厠", "修宅日", "造畜柵", "建築"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "開渠穿井",
    expandedActivityIds: ["開井", "溝渠"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "平治道塗",
    expandedActivityIds: ["開道"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "修補垣牆",
    expandedActivityIds: ["築垣", "補垣塞穴"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "修倉庫",
    expandedActivityIds: ["造倉庫"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "土符",
    polarity: "unfavorable",
    sourceTerm: "破土",
    expandedActivityIds: ["啓攢", "啓墳"],
    basis: "擇日テキスト15）土符「建築全般…最も忌むのは破土、井戸掘り・開渠・補垣」・神殺象意〔土符〕〔地囊〕。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["起基定硬", "埋坑", "作厠", "修宅日", "造畜柵", "建築"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "開渠穿井",
    expandedActivityIds: ["開井", "溝渠"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "平治道塗",
    expandedActivityIds: ["開道"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "修補垣牆",
    expandedActivityIds: ["築垣", "補垣塞穴"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "修倉庫",
    expandedActivityIds: ["造倉庫"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "地嚢",
    polarity: "unfavorable",
    sourceTerm: "破土",
    expandedActivityIds: ["啓攢", "啓墳"],
    basis: "神殺象意〔土符〕〔地囊〕（土符と同一）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "修造動土",
    expandedActivityIds: ["起基定硬", "埋坑", "作厠", "修宅日", "造畜柵", "建築"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "開渠穿井",
    expandedActivityIds: ["開井", "溝渠"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "平治道塗",
    expandedActivityIds: ["開道"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "修補垣牆",
    expandedActivityIds: ["築垣", "補垣塞穴"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "修倉庫",
    expandedActivityIds: ["造倉庫"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "破土",
    expandedActivityIds: ["啓攢", "啓墳"],
    basis: "神殺象意〔月建〕〔小時〕〔土府〕「又爲土府，專忌…」（徳合などでの軽減後は動土だけ残す）。土地そのものを動かす行為全般を忌む、土王用事と同じ展開（2026-10-24 監修判断）。",
  },
  // 以下、堅柱上樑の忌を上梁へ（上梁は堅柱上樑に含まれる。一方向、2026-10-24 監修判断）
  {
    sourceType: "kyojin",
    sourceName: "小時",
    polarity: "unfavorable",
    sourceTerm: "堅柱上樑",
    expandedActivityIds: ["上梁"],
    basis: "上梁（梁を渡す）は堅柱上樑（用事便覧34 竪柱上梁「建前の上棟式、屋根の梁を渡す日」）に含まれるため、堅柱上樑の忌を上梁にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "血支",
    polarity: "unfavorable",
    sourceTerm: "堅柱上樑",
    expandedActivityIds: ["上梁"],
    basis: "上梁（梁を渡す）は堅柱上樑（用事便覧34 竪柱上梁「建前の上棟式、屋根の梁を渡す日」）に含まれるため、堅柱上樑の忌を上梁にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "大時",
    polarity: "unfavorable",
    sourceTerm: "堅柱上樑",
    expandedActivityIds: ["上梁"],
    basis: "上梁（梁を渡す）は堅柱上樑（用事便覧34 竪柱上梁「建前の上棟式、屋根の梁を渡す日」）に含まれるため、堅柱上樑の忌を上梁にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "天吏",
    polarity: "unfavorable",
    sourceTerm: "堅柱上樑",
    expandedActivityIds: ["上梁"],
    basis: "上梁（梁を渡す）は堅柱上樑（用事便覧34 竪柱上梁「建前の上棟式、屋根の梁を渡す日」）に含まれるため、堅柱上樑の忌を上梁にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "天空",
    polarity: "unfavorable",
    sourceTerm: "堅柱上樑",
    expandedActivityIds: ["上梁"],
    basis: "上梁（梁を渡す）は堅柱上樑（用事便覧34 竪柱上梁「建前の上棟式、屋根の梁を渡す日」）に含まれるため、堅柱上樑の忌を上梁にも適用する（2026-10-24 監修判断）。",
  },
  // 以下、立券交易の忌を交易へ（一方向、2026-10-24 監修判断）
  {
    sourceType: "kyojin",
    sourceName: "大時",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "天吏",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "四耗",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "小耗",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "四窮",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "五墓",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "九空",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "月害",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "八節日（二至二分）",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "四方耗",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "長星",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "短星",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断）。",
  },
  {
    sourceType: "kyojin",
    sourceName: "五離",
    polarity: "unfavorable",
    sourceTerm: "立券交易",
    expandedActivityIds: ["交易"],
    basis: "立券交易の忌を交易（売買・取引）にも適用する（2026-10-24 監修判断を、2026-10-26 追加の五離にも同じく適用）。",
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
