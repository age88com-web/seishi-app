import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  // Nominatim（OSM）: User-Agent を付けないと拒否されることがある
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "json",
      limit: "1",
    }).toString();

  const r = await fetch(url, {
    headers: {
      "User-Agent": "seishi-app/0.1 (local dev)",
      "Accept-Language": "ja",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json(
      { error: `upstream ${r.status}`, detail: text.slice(0, 300) },
      { status: 502 }
    );
  }

  const arr = (await r.json()) as any[];

  if (!Array.isArray(arr) || arr.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const item = arr[0];
  const lat = Number(item.lat);
  const lon = Number(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "bad response", item }, { status: 502 });
  }

  return NextResponse.json({
    lat,
    lon,
    display_name: String(item.display_name || q),
  });
}