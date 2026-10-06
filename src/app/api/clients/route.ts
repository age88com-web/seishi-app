// src/app/api/clients/route.ts
//
// GET    /api/clients … ログイン中ユーザーの顧客一覧
// POST   /api/clients … 顧客の新規登録（本文は ClientInput）
// DELETE /api/clients … 顧客の一括削除（本文は { "ids": [1, 2, 3] }）。自分の顧客だけが削除され、
//                       他ユーザーの id・存在しない id は無視する（応答の deletedIds に入らない）
// user_id は必ずセッションから求め、本文やクエリの値は使わない。

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTrustedOrigin } from "@/lib/auth/requestOrigin";
import { createClient, deleteClients, DELETE_CLIENTS_MAX, listClients } from "@/lib/clients/db";
import { getRequestUserId } from "@/lib/clients/requestUser";
import { parseClientInput, rowToRecord } from "@/lib/clients/types";

export const runtime = "nodejs";

export function GET(req: NextRequest): NextResponse {
  const userId = getRequestUserId(req);
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ clients: listClients(userId).map(rowToRecord) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const userId = getRequestUserId(req);
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const parsed = parseClientInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  return NextResponse.json({ client: rowToRecord(createClient(userId, parsed.value)) }, { status: 201 });
}

/** 本文の ids を検証する（正の整数の配列・1〜DELETE_CLIENTS_MAX 件・重複は1つにまとめる） */
function parseIds(body: unknown): number[] | string {
  const ids = body && typeof body === "object" ? (body as { ids?: unknown }).ids : undefined;
  if (!Array.isArray(ids) || ids.length === 0) return "削除する顧客を選んでください";
  if (!ids.every((x) => typeof x === "number" && Number.isSafeInteger(x) && x > 0)) return "顧客IDが不正です";
  const unique = [...new Set(ids as number[])];
  if (unique.length > DELETE_CLIENTS_MAX) return `一度に削除できるのは${DELETE_CLIENTS_MAX}件までです`;
  return unique;
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const userId = getRequestUserId(req);
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const ids = parseIds(body);
  if (typeof ids === "string") return NextResponse.json({ error: ids }, { status: 400 });

  const deletedIds = deleteClients(userId, ids);
  return NextResponse.json({ deletedIds, deleted: deletedIds.length });
}
