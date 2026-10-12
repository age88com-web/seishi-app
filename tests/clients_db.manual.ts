// tests/clients_db.manual.ts
//
// 顧客DB（src/lib/clients/db.ts）と顧客API（src/app/api/clients/*）の確認。
//   - 一時ディレクトリの新しいSQLiteファイルを DB_PATH にして実行する（本番・開発DBには触れない）。
//   - 新規登録・同じ id の更新（重複レコードが増えない）・一覧の並び。
//   - ユーザーA/Bのデータ分離: 他ユーザーの id では取得・更新できない（DB関数・API とも 404）。
//   - 未ログインは 401、別Originからの POST/PUT は 403、入力検証は 400。
//   - 一括削除（DELETE /api/clients）: 1件・複数件・全件、他ユーザーの id を混ぜても削除されない、
//     不正な ids は 400・未ログイン 401・別Origin 403、users / sessions の行が変わらない、削除後も保存・呼び出しできる。
//   - 既存の users / sessions テーブルの列が変わっていないこと。
//
// 実行: npx tsx tests/clients_db.manual.ts

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "seishi-clients-test-"));
process.env.DB_PATH = join(dir, "auth.test.sqlite3");

let failures = 0;
let checks = 0;
function check(cond: boolean, label: string, detail?: unknown): void {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.error(`NG: ${label}`, detail ?? "");
  }
}

async function main() {
  const { NextRequest } = await import("next/server");
  const authDb = await import("../src/lib/auth/db");
  const { SESSION_COOKIE_NAME } = await import("../src/lib/auth/session");
  const clientsDb = await import("../src/lib/clients/db");
  const listRoute = await import("../src/app/api/clients/route");
  const itemRoute = await import("../src/app/api/clients/[id]/route");
  const { parseClientInput } = await import("../src/lib/clients/types");

  // ---- 既存テーブルの列（変更していないこと） ----
  const db = authDb.getDb();
  const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  const usersColsBefore = cols("users");
  const sessionsColsBefore = cols("sessions");

  const userA = authDb.createUser({ email: "a@example.com", passwordHash: "x", isAdmin: true });
  const userB = authDb.createUser({ email: "b@example.com", passwordHash: "x", isAdmin: true });
  const sessA = authDb.createSession(userA).id;
  const sessB = authDb.createSession(userB).id;

  const base = {
    name: "山田太郎",
    birthDate: "1980-01-01",
    birthTime: "12:30",
    birthTimeUnknown: false,
    gender: "male" as const,
    birthPlace: "東京都",
    latitude: 35.6895,
    longitude: 139.6917,
    timeZone: "Asia/Tokyo",
  };

  // ---- DB関数 ----
  const a1 = clientsDb.createClient(userA, base);
  const a2 = clientsDb.createClient(userA, { ...base, name: "佐藤花子", gender: "female", birthTime: null, birthTimeUnknown: true });
  const b1 = clientsDb.createClient(userB, { ...base, name: "B社顧客" });
  check(a1.user_id === userA && b1.user_id === userB, "user_id が保存される");
  check(a2.birth_time === null && a2.birth_time_unknown === 1, "時刻不明は birth_time NULL");
  check(clientsDb.listClients(userA).length === 2, "Aの一覧は2件");
  check(clientsDb.listClients(userB).map((r) => r.id).join() === String(b1.id), "Bの一覧はBの1件だけ");
  check(clientsDb.getClient(userB, a1.id) === undefined, "BはAの顧客を取得できない");
  check(clientsDb.updateClient(userB, a1.id, { ...base, name: "乗っ取り" }) === undefined, "BはAの顧客を更新できない");
  check(clientsDb.getClient(userA, a1.id)?.name === "山田太郎", "Aの顧客は変わっていない");

  const before = clientsDb.listClients(userA).length;
  await new Promise((res) => setTimeout(res, 5)); // 作成と更新の時刻を分ける
  const upd = clientsDb.updateClient(userA, a1.id, { ...base, name: "山田太郎（改）", birthPlace: "大阪府" });
  check(upd?.id === a1.id && upd?.name === "山田太郎（改）" && upd?.birth_place === "大阪府", "同じ id を更新");
  check(clientsDb.listClients(userA).length === before, "更新でレコードが増えない");
  check(upd !== undefined && upd.created_at === a1.created_at, "更新で created_at は変わらない");
  check(clientsDb.listClients(userA)[0].id === a1.id, "一覧は更新日時の新しい順");

  // ---- API ----
  const ORIGIN = "http://localhost:3000";
  const req = (path: string, init: { method?: string; session?: string; body?: unknown; origin?: string } = {}) => {
    const headers = new Headers({ host: "localhost:3000" });
    if (init.session) headers.set("cookie", `${SESSION_COOKIE_NAME}=${init.session}`);
    if (init.body !== undefined) headers.set("content-type", "application/json");
    if (init.origin) headers.set("origin", init.origin);
    return new NextRequest(`${ORIGIN}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  };
  const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

  let r = await listRoute.GET(req("/api/clients"));
  check(r.status === 401, "未ログインの一覧は 401", r.status);
  r = await itemRoute.GET(req(`/api/clients/${a1.id}`), ctx(a1.id));
  check(r.status === 401, "未ログインの取得は 401", r.status);
  r = await listRoute.GET(req("/api/clients", { session: "invalid" }));
  check(r.status === 401, "無効セッションは 401", r.status);

  r = await listRoute.GET(req("/api/clients", { session: sessB }));
  const listB = (await r.json()) as { clients: { id: number; name: string }[] };
  check(r.status === 200 && listB.clients.length === 1 && listB.clients[0].id === b1.id, "API: Bの一覧はBの顧客だけ", listB);
  check(!JSON.stringify(listB).includes("user_id"), "API: user_id を返さない");

  r = await itemRoute.GET(req(`/api/clients/${a1.id}`, { session: sessB }), ctx(a1.id));
  check(r.status === 404, "API: BがAの顧客を取得 → 404", r.status);
  r = await itemRoute.PUT(req(`/api/clients/${a1.id}`, { method: "PUT", session: sessB, body: { ...base, name: "x" } }), ctx(a1.id));
  check(r.status === 404, "API: BがAの顧客を更新 → 404", r.status);
  check(clientsDb.getClient(userA, a1.id)?.name === "山田太郎（改）", "API: 他ユーザーの更新は反映されない");

  r = await itemRoute.GET(req(`/api/clients/${a1.id}`, { session: sessA }), ctx(a1.id));
  const gotA = (await r.json()) as { client: { id: number; name: string } };
  check(r.status === 200 && gotA.client.id === a1.id, "API: Aは自分の顧客を取得できる");
  r = await itemRoute.GET(req(`/api/clients/abc`, { session: sessA }), ctx("abc"));
  check(r.status === 404, "API: 不正な id は 404", r.status);

  // 新規 → 更新（重複が増えない）
  r = await listRoute.POST(req("/api/clients", { method: "POST", session: sessA, body: { ...base, name: "新規太郎" }, origin: ORIGIN }));
  const created = (await r.json()) as { client: { id: number } };
  check(r.status === 201 && created.client.id > 0, "API: 新規登録 201", r.status);
  const countAfterCreate = clientsDb.listClients(userA).length;
  for (let i = 0; i < 3; i += 1) {
    r = await itemRoute.PUT(
      req(`/api/clients/${created.client.id}`, { method: "PUT", session: sessA, body: { ...base, name: `新規太郎${i}` }, origin: ORIGIN }),
      ctx(created.client.id),
    );
    check(r.status === 200, `API: 更新 ${i}`, r.status);
  }
  check(clientsDb.listClients(userA).length === countAfterCreate, "API: 繰り返し保存しても件数が増えない");
  check(clientsDb.getClient(userA, created.client.id)?.name === "新規太郎2", "API: 最後の保存内容になる");

  // POST の user_id は本文ではなくセッションから
  r = await listRoute.POST(req("/api/clients", { method: "POST", session: sessB, body: { ...base, user_id: userA, userId: userA }, origin: ORIGIN }));
  const smuggled = (await r.json()) as { client: { id: number } };
  check(clientsDb.getClient(userB, smuggled.client.id) !== undefined && clientsDb.getClient(userA, smuggled.client.id) === undefined, "API: 本文の user_id は無視");

  r = await listRoute.POST(req("/api/clients", { method: "POST", session: sessA, body: base, origin: "https://evil.example" }));
  check(r.status === 403, "API: 別Originの POST は 403", r.status);
  r = await itemRoute.PUT(req(`/api/clients/${a1.id}`, { method: "PUT", session: sessA, body: base, origin: "https://evil.example" }), ctx(a1.id));
  check(r.status === 403, "API: 別Originの PUT は 403", r.status);
  r = await listRoute.POST(req("/api/clients", { method: "POST", session: sessA, body: { ...base, name: "  " }, origin: ORIGIN }));
  check(r.status === 400, "API: 姓名が空は 400", r.status);

  // ---- ローカル開発専用バイパス（proxy.ts と同じ条件） ----
  const env = process.env as Record<string, string | undefined>;
  const savedEnv = { NODE_ENV: env.NODE_ENV, BYPASS: env.SEISHI_DEV_AUTH_BYPASS };
  const setEnv = (nodeEnv: string | undefined, bypass: string | undefined) => {
    if (nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = nodeEnv;
    if (bypass === undefined) delete env.SEISHI_DEV_AUTH_BYPASS;
    else env.SEISHI_DEV_AUTH_BYPASS = bypass;
  };
  setEnv("production", "true");
  r = await listRoute.GET(req("/api/clients"));
  check(r.status === 401, "バイパス: production では SEISHI_DEV_AUTH_BYPASS=true でもセッション無しは 401", r.status);
  setEnv("development", "false");
  r = await listRoute.GET(req("/api/clients"));
  check(r.status === 401, "バイパス: development でもフラグが true 以外なら 401", r.status);
  setEnv("development", "true");
  r = await listRoute.GET(req("/api/clients"));
  const devList = (await r.json()) as { clients: { id: number }[] };
  check(
    r.status === 200 && devList.clients.length === clientsDb.listClients(userA).length && userA === 1,
    "バイパス: development かつ true なら user_id=1 の一覧",
    { status: r.status, userA },
  );
  r = await listRoute.POST(req("/api/clients", { method: "POST", body: { ...base, name: "開発バイパス" }, origin: ORIGIN }));
  const devCreated = (await r.json()) as { client: { id: number } };
  check(r.status === 201 && clientsDb.getClient(1, devCreated.client.id) !== undefined, "バイパス: 保存は user_id=1 に紐づく");
  setEnv(savedEnv.NODE_ENV, savedEnv.BYPASS);

  // ---- 一括削除 ----
  {
    const snapshot = (t: string) => JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
    const usersBefore = snapshot("users");
    const sessionsBefore = snapshot("sessions");
    const mk = (userId: number, name: string) => clientsDb.createClient(userId, { ...base, name }).id;
    const del = (ids: unknown, session: string | undefined, origin: string | undefined = ORIGIN) =>
      listRoute.DELETE(req("/api/clients", { method: "DELETE", session, body: { ids }, origin }));
    const idsOf = (u: number) => clientsDb.listClients(u).map((c) => c.id);

    // DB関数: 他ユーザー・存在しない id は削除されない
    const x1 = mk(userA, "削除1");
    const xb = mk(userB, "B削除対象外");
    check(
      JSON.stringify(clientsDb.deleteClients(userA, [x1, xb, 999999, x1])) === JSON.stringify([x1]),
      "DB: 自分の id だけ削除（他ユーザー・存在しない id・重複は無視）",
    );
    check(clientsDb.getClient(userB, xb) !== undefined, "DB: 他ユーザーの顧客は残る");
    check(clientsDb.deleteClients(userB, []).length === 0, "DB: 空配列は何もしない");

    // API: 1件
    const one = mk(userA, "1件削除");
    r = await del([one], sessA);
    let j = (await r.json()) as { deletedIds: number[]; deleted: number };
    check(r.status === 200 && j.deleted === 1 && j.deletedIds[0] === one, "API: 1件削除", j);
    check(!idsOf(userA).includes(one), "API: 1件削除後に一覧へ残らない");

    // API: 複数件＋他ユーザーの id を混ぜる
    const m1 = mk(userA, "複数1");
    const m2 = mk(userA, "複数2");
    const keep = mk(userA, "残す");
    const bIdsBefore = idsOf(userB);
    r = await del([m1, m2, ...bIdsBefore], sessA);
    j = (await r.json()) as { deletedIds: number[]; deleted: number };
    check(r.status === 200 && JSON.stringify(j.deletedIds) === JSON.stringify([m1, m2].sort((a, b) => a - b)), "API: 複数件削除（他ユーザーの id は含まれない）", j);
    check(JSON.stringify(idsOf(userB)) === JSON.stringify(bIdsBefore), "API: 他ユーザーの顧客は1件も削除されない");
    check(idsOf(userA).includes(keep) && !idsOf(userA).includes(m1) && !idsOf(userA).includes(m2), "API: 選んだものだけ消え、他は残る");

    // API: 他ユーザーの id だけ → 0件
    r = await del(bIdsBefore, sessA);
    j = (await r.json()) as { deletedIds: number[]; deleted: number };
    check(r.status === 200 && j.deleted === 0 && JSON.stringify(idsOf(userB)) === JSON.stringify(bIdsBefore), "API: 他ユーザーの id だけなら0件");

    // API: 入力・認証・Origin
    for (const bad of [[], [0], [-1], [1.5], ["1"], null, "1,2"]) {
      r = await del(bad, sessA);
      check(r.status === 400, `API: 不正な ids ${JSON.stringify(bad)} は 400`, r.status);
    }
    r = await del(Array.from({ length: 501 }, (_, i) => i + 1), sessA);
    check(r.status === 400, "API: 501件以上は 400");
    const countA = idsOf(userA).length;
    r = await del([keep], undefined);
    check(r.status === 401 && idsOf(userA).length === countA, "API: 未ログインは 401 で削除しない");
    r = await del([keep], sessA, "https://evil.example");
    check(r.status === 403 && idsOf(userA).includes(keep), "API: 別Originは 403 で削除しない");

    // API: 全件（一覧の id をすべて）
    r = await del(idsOf(userA), sessA);
    j = (await r.json()) as { deletedIds: number[]; deleted: number };
    check(r.status === 200 && j.deleted === countA && idsOf(userA).length === 0, "API: 全選択で全件削除", j);
    check(JSON.stringify(idsOf(userB)) === JSON.stringify(bIdsBefore), "API: 全件削除でも他ユーザーの顧客は残る");

    // users / sessions は変わらない
    check(snapshot("users") === usersBefore, "削除: users は変化しない");
    check(snapshot("sessions") === sessionsBefore, "削除: sessions は変化しない");

    // 削除後も保存・呼び出しは従来どおり
    r = await listRoute.POST(req("/api/clients", { method: "POST", session: sessA, body: { ...base, name: "削除後の新規" }, origin: ORIGIN }));
    const again = (await r.json()) as { client: { id: number } };
    check(r.status === 201, "削除後: 新規保存できる");
    r = await itemRoute.PUT(
      req(`/api/clients/${again.client.id}`, { method: "PUT", session: sessA, body: { ...base, name: "削除後の更新" }, origin: ORIGIN }),
      ctx(again.client.id),
    );
    check(r.status === 200, "削除後: 更新できる");
    r = await itemRoute.GET(req(`/api/clients/${again.client.id}`, { session: sessA }), ctx(again.client.id));
    const got = (await r.json()) as { client: { name: string } };
    check(r.status === 200 && got.client.name === "削除後の更新", "削除後: 呼び出しできる");
  }

  // ---- 入力検証 ----
  check(!parseClientInput({ ...base, birthDate: "1980-02-30" }).ok, "検証: 存在しない日付");
  check(!parseClientInput({ ...base, birthTime: "25:00" }).ok, "検証: 不正な時刻");
  check(parseClientInput({ ...base, birthTime: "xx", birthTimeUnknown: true }).ok, "検証: 時刻不明なら時刻は見ない");
  check(!parseClientInput({ ...base, gender: "other" }).ok, "検証: 性別");
  check(!parseClientInput({ ...base, latitude: 91 }).ok, "検証: 緯度範囲");
  check(parseClientInput({ ...base, latitude: null, longitude: null }).ok, "検証: 緯度経度なしは可");

  // ---- 既存テーブル ----
  check(cols("users").join() === usersColsBefore.join(), "users の列は変わらない");
  check(cols("sessions").join() === sessionsColsBefore.join(), "sessions の列は変わらない");
  const fk = db.prepare("PRAGMA foreign_key_list(clients)").all() as { table: string; from: string }[];
  check(fk.some((f) => f.table === "users" && f.from === "user_id"), "clients.user_id → users.id の外部キー");
}

main()
  .catch((e) => {
    failures += 1;
    console.error(e);
  })
  .finally(() => {
    rmSync(dir, { recursive: true, force: true });
    console.log(`${checks - failures}/${checks} OK`);
    if (failures > 0) {
      console.error(`FAIL: ${failures}`);
      process.exit(1);
    }
    console.log("PASS");
  });
