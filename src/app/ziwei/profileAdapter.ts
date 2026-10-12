// src/app/ziwei/profileAdapter.ts
//
// 共通プロフィール（CommonNatalProfile）→ ZiweiInput。
// 出生地は共通の出生地UIで確定した地点の「経度」を紫微斗数エンジンへ渡す（ZiweiLongitudePlace）。
// 時差の計算（(経度−135)×4分・サマータイム）は紫微斗数エンジン（src/lib/ziwei/timeCorrection.ts）が行い、
// 四柱推命・七政四餘の補正処理は使わない（2026-10-02 仕様変更。表2の24地点からの選択は廃止）。

import type { ZiweiInput } from "@/lib/ziwei";
import type { CommonNatalProfile } from "@/lib/natalProfile/types";

/** 紫微斗数は日本国内の出生のみ（出生時刻は日本標準時の法定時刻。§2.7 旧U18） */
const JAPAN_TIME_ZONE = "Asia/Tokyo";

export function profileToZiweiInput(p: CommonNatalProfile): { input: ZiweiInput } | { error: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthDate);
  if (!d) return { error: "生年月日を入力してください" };
  if (p.birthTimeUnknown) return { error: "紫微斗数は出生時刻が必要です（時刻不明では作盤できません）" };
  const t = /^(\d{2}):(\d{2})$/.exec(p.birthTime);
  if (!t) return { error: "出生時刻を入力してください" };
  if (p.longitude === null || !p.birthPlace.trim()) return { error: "出生地を入力し、候補から選んでください" };
  if (p.timeZone.trim() !== JAPAN_TIME_ZONE) return { error: "紫微斗数は日本国内の出生のみ作盤できます" };
  return {
    input: {
      birth: {
        year: Number(d[1]),
        month: Number(d[2]),
        day: Number(d[3]),
        hour: Number(t[1]),
        minute: Number(t[2]),
      },
      place: { name: p.birthPlace.trim(), longitude: p.longitude },
      sex: p.gender,
    },
  };
}
