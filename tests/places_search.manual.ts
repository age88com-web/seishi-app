// tests/places_search.manual.ts
//
// 共通出生地UIの地点検索（src/lib/places/）の確認。
//   - 住所表記の分解（都道府県・市区町村。国土地理院の市区町村一覧で最長一致）: 名前に市・町・村を含む自治体、
//     政令市の区、郡を省いた町村、都道府県だけの表記、海外表記。
//   - 自治体コード → 都道府県・市区町村（同名の市が別の県にある場合もコードで区別できる）。
//   - `--live` を付けると外部の検索（国土地理院・Photon）を実際に呼び、候補が市区町村までで
//     表示名・都道府県・市区町村・緯度・経度がそろうことを確認する（ネットワークが必要）。
//
// 実行: npx tsx tests/places_search.manual.ts [--live]

import { municipalityByCode, parseJapaneseAddress } from "../src/lib/places/japaneseAddress";
import { searchBirthplaces } from "../src/lib/places/search";

let failures = 0;
let checks = 0;
function check(cond: boolean, label: string, detail?: unknown): void {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`NG: ${label}`, detail ?? "");
  }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const PARSE: [string, { prefecture: string; municipality: string; rest: string } | null][] = [
  ["愛知県名古屋市中区", { prefecture: "愛知県", municipality: "名古屋市中区", rest: "" }],
  ["愛知県名古屋市中川区", { prefecture: "愛知県", municipality: "名古屋市中川区", rest: "" }],
  ["三重県四日市市", { prefecture: "三重県", municipality: "四日市市", rest: "" }],
  ["新潟県十日町市", { prefecture: "新潟県", municipality: "十日町市", rest: "" }],
  ["東京都東村山市", { prefecture: "東京都", municipality: "東村山市", rest: "" }],
  ["東京都新宿区", { prefecture: "東京都", municipality: "新宿区", rest: "" }],
  ["北海道札幌市", { prefecture: "北海道", municipality: "札幌市", rest: "" }],
  ["京都府京都市", { prefecture: "京都府", municipality: "京都市", rest: "" }],
  ["神奈川県横浜市中区", { prefecture: "神奈川県", municipality: "横浜市中区", rest: "" }],
  ["宮城県加美町八王子", { prefecture: "宮城県", municipality: "加美町", rest: "八王子" }],
  ["東京都", { prefecture: "東京都", municipality: "", rest: "" }],
  ["London, England, United Kingdom", null],
  ["名古屋市中区", null],
];
for (const [text, want] of PARSE) {
  check(same(parseJapaneseAddress(text), want), `分解 ${text}`, parseJapaneseAddress(text));
}
check(same(municipalityByCode("23110"), { prefecture: "愛知県", municipality: "名古屋市中川区" }), "コード 23110");
check(same(municipalityByCode("13206"), { prefecture: "東京都", municipality: "府中市" }), "コード 13206（東京都府中市）");
check(same(municipalityByCode("34208"), { prefecture: "広島県", municipality: "府中市" }), "コード 34208（広島県府中市）");
check(same(municipalityByCode("01100"), { prefecture: "北海道", municipality: "札幌市" }), "先頭0付きのコード");
check(municipalityByCode("99999") === null, "存在しないコード");

async function live(): Promise<void> {
  const expectFirst: [string, string][] = [
    ["名古屋市中区", "愛知県名古屋市中区"],
    ["八王子", "東京都八王子市"],
    ["四日市", "三重県四日市市"],
    ["那覇", "沖縄県那覇市"],
    ["London", "London, England, United Kingdom"],
  ];
  for (const [q, first] of expectFirst) {
    const r = await searchBirthplaces(q);
    check(r[0]?.displayName === first, `検索 ${q} → 先頭 ${first}`, r.map((x) => x.displayName));
    for (const p of r) {
      check(
        Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.displayName !== "" && p.countryCode !== "",
        `検索 ${q}: 地点情報がそろう ${p.displayName}`,
      );
      if (p.countryCode === "JP") {
        const parts = parseJapaneseAddress(p.displayName);
        check(parts !== null && parts.rest === "", `検索 ${q}: 市区町村まで ${p.displayName}`);
      }
    }
  }
  const nakas = (await searchBirthplaces("名古屋市中")).map((x) => x.displayName);
  check(
    ["愛知県名古屋市中区", "愛知県名古屋市中村区", "愛知県名古屋市中川区"].every((n) => nakas.includes(n)),
    "入力途中（名古屋市中）で中区・中村区・中川区が候補に出る",
    nakas,
  );
}

(process.argv.includes("--live") ? live() : Promise.resolve())
  .catch((e) => {
    failures += 1;
    console.error(e);
  })
  .finally(() => {
    console.log(`${checks - failures}/${checks} OK`);
    if (failures > 0) {
      console.error(`FAIL: ${failures}`);
      process.exit(1);
    }
    console.log("PASS");
  });
