// src/lib/places/search.ts
//
// 出生地の候補検索（サーバー側。/api/places から呼ぶ）。
//   - 国内（日本語の入力）: 国土地理院の住所検索 API。住所（市区町村・町名）の結果だけを候補にする
//     （施設名・山・川などは除く）。ただし「名古屋市中川区役所」「加美町役場」のように市区町村の役所・役場は、
//     その市区町村の代表地点として候補にする（国土地理院の市区町村の位置も役所の位置）。
//     候補は市区町村まで（町名・大字までの表記は出さない。2026-10-02 ユーザー指示「市まででいい」）。
//   - 海外（日本語を含まない入力）または国内で見つからないとき: Photon（OpenStreetMap）の都市検索。
//     Nominatim は利用規約で入力途中の候補表示（オートコンプリート）が禁止されているため使わない。
// 結果は地点情報（表示名・都道府県・市区町村・緯度・経度・国）だけ。時差の計算はしない。

import { municipalityByCode, parseJapaneseAddress } from "./japaneseAddress";
import type { BirthplaceInfo } from "./types";

export const PLACE_QUERY_MAX = 60;
const MAX_RESULTS = 8;
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const USER_AGENT = "seishi-app/0.1 (birthplace search)";

const JAPANESE = /[぀-ヿ㐀-鿿]/;

const cache = new Map<string, { at: number; value: BirthplaceInfo[] }>();

type GsiFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { title?: string; addressCode?: string };
};

async function searchGsi(q: string): Promise<BirthplaceInfo[]> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!r.ok) throw new Error(`gsi ${r.status}`);
  const arr = (await r.json()) as GsiFeature[];
  const found: BirthplaceInfo[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(arr) ? arr : []) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const code = f.properties?.addressCode ?? "";
    let title = (f.properties?.title ?? "").trim();
    let parts = null as ReturnType<typeof parseJapaneseAddress>;
    if (code === "") {
      // 住所の結果（addressCode が空）
      parts = parseJapaneseAddress(title);
    } else {
      // 施設の結果は、その市区町村の役所・役場だけを市区町村の代表地点として使う
      const muni = municipalityByCode(code);
      if (!muni || !/^(.+)(役所|役場)$/.test(title) || title.replace(/(役所|役場)$/, "") !== muni.municipality) continue;
      title = `${muni.prefecture}${muni.municipality}`;
      parts = { ...muni, rest: "" };
    }
    // 市区町村（または都道府県）までの表記だけ。町名・大字まである表記は除く
    if (!parts || parts.rest !== "" || !title || seen.has(title)) continue;
    seen.add(title);
    found.push({
      displayName: title,
      prefecture: parts.prefecture,
      municipality: parts.municipality,
      latitude: lat as number,
      longitude: lon as number,
      countryCode: "JP",
    });
  }
  return found.slice(0, MAX_RESULTS);
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; state?: string; country?: string; countrycode?: string };
};

async function searchPhoton(q: string): Promise<BirthplaceInfo[]> {
  const params = new URLSearchParams({ q, limit: String(MAX_RESULTS), lang: JAPANESE.test(q) ? "default" : "en" });
  for (const layer of ["city", "district", "county", "state"]) params.append("layer", layer);
  const r = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  const j = (await r.json()) as { features?: PhotonFeature[] };
  const out: BirthplaceInfo[] = [];
  const seen = new Set<string>();
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const name = (p.name ?? "").trim();
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const parts = [name, p.state, p.country].filter((x): x is string => !!x && x.trim() !== "");
    const displayName = [...new Set(parts)].join(", ");
    if (seen.has(displayName)) continue;
    seen.add(displayName);
    out.push({
      displayName,
      prefecture: p.state ?? "",
      municipality: name,
      latitude: lat as number,
      longitude: lon as number,
      countryCode: (p.countrycode ?? "").toUpperCase(),
    });
  }
  return out;
}

export async function searchBirthplaces(query: string): Promise<BirthplaceInfo[]> {
  const q = query.trim();
  if (!q) return [];
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value: BirthplaceInfo[] = [];
  if (JAPANESE.test(q)) value = await searchGsi(q);
  if (value.length === 0) value = await searchPhoton(q);

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(q, { at: Date.now(), value });
  return value;
}
