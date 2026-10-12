"use client";

// src/lib/natalProfile/saveClient.ts
//
// 共通プロフィールを顧客DBへ保存する（共通入力UIの「保存」と、四柱推命の「命式を印刷」で共用）。
//   - client_id なし→新規登録（POST /api/clients）、あり→同じ client_id を更新（PUT /api/clients/:id）。
//   - 成功したら共通プロフィールに client_id を設定する（次の保存は更新になる）。
//   - 保存中にもう一度呼ばれたら、同じ保存の結果を返す（連打・2つのボタンからの同時保存で新規登録が2件にならないように）。

import { getNatalProfile, setNatalClientId } from "./store";
import { profileToClientInput } from "../clients/types";
import type { ClientRecord } from "../clients/types";

export async function readError(r: Response, fallback: string): Promise<string> {
  if (r.status === 401) return "ログインが必要です（/login からログインしてください）";
  try {
    const j = await r.json();
    if (j && typeof j.error === "string") return j.error;
  } catch {}
  return fallback;
}

export type SaveClientResult = { created: boolean; client: ClientRecord };

let inFlight: Promise<SaveClientResult> | null = null;

/** 現在の共通プロフィールを保存する。失敗時は日本語のメッセージで reject する */
export function saveNatalProfileToClients(): Promise<SaveClientResult> {
  if (inFlight) return inFlight;
  const profile = getNatalProfile();
  const id = profile.clientId;
  inFlight = (async () => {
    const r = await fetch(id === null ? "/api/clients" : `/api/clients/${id}`, {
      method: id === null ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileToClientInput(profile)),
    });
    if (!r.ok) throw new Error(await readError(r, "保存に失敗しました"));
    const j = (await r.json()) as { client: ClientRecord };
    setNatalClientId(j.client.id);
    return { created: id === null, client: j.client };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
