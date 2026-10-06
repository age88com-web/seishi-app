// src/app/api/clients/[id]/route.ts
//
// GET /api/clients/:id … 自分の顧客1件
// PUT /api/clients/:id … 自分の顧客1件を更新（本文は ClientInput）
// 取得・更新とも WHERE id = ? AND user_id = ?。他ユーザーの顧客は存在しないものとして 404 を返す。

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isTrustedOrigin } from "@/lib/auth/requestOrigin";
import { getClient, updateClient } from "@/lib/clients/db";
import { getRequestUserId } from "@/lib/clients/requestUser";
import { parseClientInput, rowToRecord } from "@/lib/clients/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

const NOT_FOUND = () => NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const userId = getRequestUserId(req);
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = parseId((await ctx.params).id);
  if (id === null) return NOT_FOUND();

  const row = getClient(userId, id);
  if (!row) return NOT_FOUND();
  return NextResponse.json({ client: rowToRecord(row) });
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  if (!isTrustedOrigin(req)) return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  const userId = getRequestUserId(req);
  if (userId === null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = parseId((await ctx.params).id);
  if (id === null) return NOT_FOUND();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }
  const parsed = parseClientInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const row = updateClient(userId, id, parsed.value);
  if (!row) return NOT_FOUND();
  return NextResponse.json({ client: rowToRecord(row) });
}
