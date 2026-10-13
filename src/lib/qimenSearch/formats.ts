// src/lib/qimenSearch/formats.ts
//
// 役割:
//   検索条件 UI で選択できる格局名の一覧。
//
// 出典と注意:
//   jikaku.ts / kyokaku.ts は判定ルール（RULES 配列）を外部へ export していない
//   （src/lib/qimen/ は本機能の開発方針により変更禁止）。そのため、両ファイル内の
//   各ルールの `name:` フィールドを機械的に書き写した固定リストとしてここに持つ。
//   判定ロジックそのものはこの一覧を経由せず、実行時の
//   result.jikaku.matches[].name / result.kyokaku.matches[].name と照合するだけで、
//   この一覧はあくまで UI 表示・選択用のカタログである。
//   jikaku.ts / kyokaku.ts にルールが追加・改名された場合はこの一覧も追従が必要。

import type { QimenFormatOption } from "./types";

/** 吉格（jikaku.ts の RULES と同順） */
export const JIKAKU_NAMES: readonly string[] = [
  "青龍返首",
  "飛鳥跌穴",
  "玉女守門",
  "天遁",
  "地遁",
  "人遁",
  "神遁",
  "鬼遁",
  "風遁",
  "雲遁",
  "龍遁",
  "虎遁",
  "乙奇得使",
  "丙奇得使",
  "丁奇得使",
  "乙奇升殿",
  "丙奇升殿",
  "丁奇升殿",
  "真詐",
  "重詐",
  "休詐",
  "天假",
  "地假",
  "人假",
  "神假",
  "鬼假",
] as const;

/** 凶格（kyokaku.ts の RULES と同順） */
export const KYOKAKU_NAMES: readonly string[] = [
  "青龍逃走",
  "白虎猖狂",
  "朱雀投江",
  "騰蛇夭矯",
  "熒入太白",
  "太白入熒",
  "大格",
  "上格",
  "刑格",
  "奇格",
  "歳格",
  "月格",
  "日格",
  "時格",
  "年悖格",
  "月悖格",
  "日悖格",
  "時悖格",
  "五不遇時",
  "時干入墓",
  "伏干格",
  "飛干格",
  "伏宮格天乙格",
  "飛宮格天乙太白",
  "戦格",
  "符勃格",
  "飛悖格",
  "乙奇入墓",
  "丙奇入墓",
  "丁奇入墓",
  "三奇受刑",
  "六儀撃刑",
  "伏吟格",
  "反吟格",
  "天網四張",
  "地網遮蔽",
  "門迫",
  "宮迫",
] as const;

export const JIKAKU_FORMAT_OPTIONS: readonly QimenFormatOption[] = JIKAKU_NAMES.map(
  (name) => ({ category: "jikaku" as const, name }),
);

export const KYOKAKU_FORMAT_OPTIONS: readonly QimenFormatOption[] = KYOKAKU_NAMES.map(
  (name) => ({ category: "kyokaku" as const, name }),
);
