// src/app/api/places/route.ts
//
// GET /api/places?q=名古屋市中 … 出生地の候補（BirthplaceInfo[]）を返す。共通出生地UI（BirthplaceInput）から呼ぶ。
// 認証は src/proxy.ts の既定どおり（ログイン必須）。外部検索の詳細は src/lib/places/search.ts。

import { NextResponse } from "next/server";
import { PLACE_QUERY_MAX, searchBirthplaces } from "@/lib/places/search";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ places: [] });
  if (q.length > PLACE_QUERY_MAX) return NextResponse.json({ error: "検索語が長すぎます" }, { status: 400 });
  try {
    return NextResponse.json({ places: await searchBirthplaces(q) });
  } catch {
    return NextResponse.json({ error: "地名検索に失敗しました" }, { status: 502 });
  }
}
