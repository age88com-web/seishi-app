// src/app/shichusuimei/profileAdapter.ts
//
// 共通プロフィール（CommonNatalProfile）＋四柱推命固有設定 → ShichusuimeiInput。
// 生年月日・時刻の解釈は共通化前のページ内 compute() と同じ（エンジンの入力型・地方真太陽時の計算は変更しない）。
//   - 出生地は共通の出生地UIで確定した地点（表示名・経度）を使う。p22 地点の選択欄は廃止した（2026-10-02）。
//   - 地域時差は仕様 D7 のとおり: 出生地の市が p22 の表の地名と一致すれば表の値（p22Name を渡す）、
//     表にない地点は経度から計算（エンジンが longitude から求める）。金沢は D15 により表を使わない。
//   - 標準時UTCオフセット（海外出生）は四柱推命固有の補正設定としてページ側に持つ。

import { P22_REGIONAL_DIFF_AS_PRINTED, P22_EXCLUDED_FROM_CALCULATION } from "@/lib/shichusuimei";
import type { BirthPlace, ShichusuimeiInput } from "@/lib/shichusuimei";
import { createPageSettings } from "@/lib/natalProfile/pageSettings";
import type { CommonNatalProfile } from "@/lib/natalProfile/types";

export const P22_NAMES = Object.keys(P22_REGIONAL_DIFF_AS_PRINTED).filter(
  (n) => !P22_EXCLUDED_FROM_CALCULATION.includes(n),
);

/** 四柱推命固有の設定 */
export interface ShichusuimeiSettings {
  /** 標準時UTCオフセット（時間・文字列のまま）。"" は Asia/Tokyo なら +9 */
  standardOffset: string;
}

export const shichusuimeiSettings = createPageSettings<ShichusuimeiSettings>(
  "seishi_shichusuimei_settings_v1",
  { standardOffset: "" },
  (o, d) => ({
    standardOffset: typeof o.standardOffset === "string" ? o.standardOffset : d.standardOffset,
  }),
);

const PREFECTURE = /^(北海道|東京都|京都府|大阪府|.{2,3}?県)/;

/**
 * 出生地（共通の出生地UIの表示名。例:「愛知県名古屋市中区」）に対応する p22 の地名。なければ null。
 *   - 都道府県の後ろが「（p22の地名）市」で始まれば、その地名（名古屋市中区 → 名古屋）。
 *   - 東京都の特別区（23区）と、東京都だけの表記（都庁＝新宿区の位置）は「東京」。
 *   - 海外・表にない市町村は null（経度から計算する）。
 */
export function p22NameForBirthPlace(birthPlace: string): string | null {
  const s = birthPlace.replace(/[\s　]/g, "");
  const m = PREFECTURE.exec(s);
  if (!m) return null;
  const rest = s.slice(m[1].length);
  if (m[1] === "東京都" && (rest === "" || /^[^市町村]+区/.test(rest))) return "東京";
  return P22_NAMES.find((n) => rest.startsWith(`${n}市`)) ?? null;
}

export function profileToShichusuimeiInput(
  p: CommonNatalProfile,
  s: ShichusuimeiSettings,
): { input: ShichusuimeiInput } | { error: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthDate);
  if (!d) return { error: "生年月日を入力してください" };
  const t = /^(\d{2}):(\d{2})$/.exec(p.birthTime);
  if (!p.birthTimeUnknown && !t) return { error: "出生時刻を入力してください（不明なら「時刻不明」）" };
  const place: BirthPlace = { timeZone: p.timeZone.trim() };
  const p22Name = p22NameForBirthPlace(p.birthPlace);
  if (p22Name) place.p22Name = p22Name;
  if (p.longitude !== null) {
    if (!Number.isFinite(p.longitude)) return { error: "経度が数値ではありません" };
    place.longitude = p.longitude;
  }
  if (s.standardOffset.trim() !== "") {
    const off = Number(s.standardOffset);
    if (!Number.isFinite(off)) return { error: "標準時UTCオフセットが数値ではありません" };
    place.standardOffsetMinutes = Math.round(off * 60);
  }
  return {
    input: {
      birth: {
        year: Number(d[1]),
        month: Number(d[2]),
        day: Number(d[3]),
        hour: p.birthTimeUnknown ? null : Number(t![1]),
        minute: p.birthTimeUnknown ? 0 : Number(t![2]),
      },
      place,
      sex: p.gender === "male" ? "M" : "F",
    },
  };
}
