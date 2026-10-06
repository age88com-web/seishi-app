// src/lib/clients/types.ts
//
// 顧客（clients テーブル）の型と入力検証。
// サーバー（API・DB）とブラウザ（共通入力UI・顧客管理ページ）の両方から読むため、
// Node 専用モジュールは import しない。
//
// 保存するのは顧客の基本プロフィールだけ。命盤計算結果・格局判定・術者判断・AI解釈・印刷結果は
// 保存しない（将来は clients.id を参照する別テーブル（鑑定履歴など）を追加する）。

import type { CommonNatalProfile, NatalGender } from "../natalProfile/types";

/** DB の行（snake_case のまま） */
export interface ClientRow {
  id: number;
  user_id: number;
  name: string;
  birth_date: string;
  birth_time: string | null;
  birth_time_unknown: 0 | 1;
  gender: NatalGender;
  birth_place: string;
  latitude: number | null;
  longitude: number | null;
  time_zone: string;
  created_at: string;
  updated_at: string;
}

/** API が返す顧客（user_id は返さない） */
export interface ClientRecord {
  id: number;
  name: string;
  birthDate: string;
  birthTime: string | null;
  birthTimeUnknown: boolean;
  gender: NatalGender;
  birthPlace: string;
  latitude: number | null;
  longitude: number | null;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
}

/** 保存・更新の入力（API の本文） */
export interface ClientInput {
  name: string;
  birthDate: string;
  birthTime: string | null;
  birthTimeUnknown: boolean;
  gender: NatalGender;
  birthPlace: string;
  latitude: number | null;
  longitude: number | null;
  timeZone: string;
}

export const CLIENT_NAME_MAX = 100;
const BIRTH_PLACE_MAX = 200;
const TIME_ZONE_MAX = 64;

export function rowToRecord(r: ClientRow): ClientRecord {
  return {
    id: r.id,
    name: r.name,
    birthDate: r.birth_date,
    birthTime: r.birth_time,
    birthTimeUnknown: r.birth_time_unknown === 1,
    gender: r.gender,
    birthPlace: r.birth_place,
    latitude: r.latitude,
    longitude: r.longitude,
    timeZone: r.time_zone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function profileToClientInput(p: CommonNatalProfile): ClientInput {
  return {
    name: p.name.trim(),
    birthDate: p.birthDate,
    birthTime: p.birthTimeUnknown ? null : p.birthTime,
    birthTimeUnknown: p.birthTimeUnknown,
    gender: p.gender,
    birthPlace: p.birthPlace.trim(),
    latitude: p.latitude,
    longitude: p.longitude,
    timeZone: p.timeZone.trim(),
  };
}

/** 時刻不明の顧客は入力欄の時刻を既定値（12:00）にする */
export function recordToProfile(c: ClientRecord): CommonNatalProfile {
  return {
    clientId: c.id,
    name: c.name,
    birthDate: c.birthDate,
    birthTime: c.birthTime ?? "12:00",
    birthTimeUnknown: c.birthTimeUnknown,
    gender: c.gender,
    birthPlace: c.birthPlace,
    latitude: c.latitude,
    longitude: c.longitude,
    timeZone: c.timeZone,
  };
}

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function optCoord(v: unknown, limit: number): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > limit) return undefined;
  return v;
}

/** API 本文を検証する。失敗時は日本語のエラーメッセージを返す */
export function parseClientInput(body: unknown): { ok: true; value: ClientInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "入力が不正です" };
  const o = body as Record<string, unknown>;

  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return { ok: false, error: "姓名を入力してください" };
  if (name.length > CLIENT_NAME_MAX) return { ok: false, error: `姓名は${CLIENT_NAME_MAX}文字以内にしてください` };

  const birthDate = typeof o.birthDate === "string" ? o.birthDate : "";
  if (!isValidDate(birthDate)) return { ok: false, error: "生年月日が不正です" };

  const birthTimeUnknown = o.birthTimeUnknown === true;
  let birthTime: string | null = null;
  if (!birthTimeUnknown) {
    if (typeof o.birthTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(o.birthTime)) {
      return { ok: false, error: "出生時刻が不正です（不明なら「時刻不明」）" };
    }
    birthTime = o.birthTime;
  }

  if (o.gender !== "male" && o.gender !== "female") return { ok: false, error: "性別が不正です" };

  const birthPlace = typeof o.birthPlace === "string" ? o.birthPlace.trim() : "";
  if (birthPlace.length > BIRTH_PLACE_MAX) return { ok: false, error: "出生地が長すぎます" };

  const latitude = optCoord(o.latitude, 90);
  const longitude = optCoord(o.longitude, 180);
  if (latitude === undefined) return { ok: false, error: "緯度が不正です" };
  if (longitude === undefined) return { ok: false, error: "経度が不正です" };

  const timeZone = typeof o.timeZone === "string" ? o.timeZone.trim() : "";
  if (!timeZone || timeZone.length > TIME_ZONE_MAX) return { ok: false, error: "タイムゾーンが不正です" };

  return {
    ok: true,
    value: { name, birthDate, birthTime, birthTimeUnknown, gender: o.gender, birthPlace, latitude, longitude, timeZone },
  };
}
