// tests/lucky_day_member_auth.manual.ts
//
// 目的:
//   一般向け擇日サービス（/lucky-day）のWordPress + Paid Memberships Pro
//   会員認証（src/lib/luckyDay/auth/ 配下）の単体テスト。
//
//   ・Next.js独自セッション（session.ts）の署名・検証・改ざん拒否・期限切れ拒否
//   ・WordPress APIクライアント（wordpress.ts）のexchangeAuthCode/
//     getMembershipStatus（fetchをモックし、実際のWordPressへは接続しない）
//   ・ID 2〜5のみを有料会員として認める判定（member.ts の isPaidLevelId。
//     ID 2=月額・3=年額・4=講座通常版・5=講座DVD版、4・5は2026-10-09追加）
//   ・不正な認証コード形式の拒否（isValidAuthCode）
//
//   既存の専門家向け認証（src/lib/auth/）・判定エンジン・擇日ロジックは
//   一切変更・参照しない、独立したテスト。
//
// 重要（実行方法）:
//   session.ts / wordpress.ts / member.ts はいずれも "server-only" を
//   importしている。"server-only" パッケージは package.json の exports
//   条件で分岐しており、Node（tsx）から素で実行すると常に例外を投げる
//   default 条件（Client Componentからのimportを想定した挙動）に解決されて
//   しまう。Next.jsのServer Componentビルドが使う "react-server" 条件を
//   Node起動時に明示することで、意図どおり（何もしない）に解決させる。
//
//   実行:
//     npx tsx --conditions=react-server tests/lucky_day_member_auth.manual.ts
//
// 終了コード: 全一致なら 0、1件でも不一致なら 1。

// WordPress関連の環境変数はfetchをモックするため実際には使われないが、
// requireWordPressUrl()/basicAuthHeader() が「未設定」として例外を投げない
// よう、テスト専用のダミー値を設定する（本物の秘密値ではない。
// .env.local・本番環境には一切影響しない、このプロセス内だけの値）。
process.env.WORDPRESS_URL = "https://example.invalid";
process.env.TAKUJITSU_WP_USER = "test-user";
process.env.TAKUJITSU_WP_APP_PASSWORD = "test-app-password";
// セッション署名用の秘密値も同様にテスト専用のダミー値。
process.env.TAKUJITSU_SESSION_SECRET = "test-secret-for-unit-tests-only-not-a-real-value";

import {
  createMemberSessionToken,
  verifyMemberSessionToken,
} from "../src/lib/luckyDay/auth/session";
import {
  exchangeAuthCode,
  getMembershipStatus,
  isValidAuthCode,
  getSupportStatus,
  submitSupportQuestion,
} from "../src/lib/luckyDay/auth/wordpress";
import { isPaidLevelId, isDevPaidMemberOverrideEnabled } from "../src/lib/luckyDay/auth/member";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, cond: boolean) {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(`  ${label}`);
  }
}

/** globalThis.fetch を一時的に差し替えて実行するヘルパー（実際の通信はしない）。 */
async function withMockFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function main() {
  // -------------------------------------------------------------------------
  // 1. セッション署名・検証
  // -------------------------------------------------------------------------
  {
    const token = createMemberSessionToken(42);
    check("セッショントークンが payload.signature 形式である", token.includes(".") && token.split(".").length === 2);

    const verified = verifyMemberSessionToken(token);
    check("正常なトークンの検証が成功する", verified !== null);
    check("userIdが一致する", verified?.userId === 42);
    check("issuedAtが数値である", typeof verified?.issuedAt === "number");
    check("expiresAtがissuedAtより後である", (verified?.expiresAt ?? 0) > (verified?.issuedAt ?? 0));
  }

  // 改ざんsession拒否（署名部分を破壊）
  {
    const token = createMemberSessionToken(1);
    const [payloadB64, signature] = token.split(".");
    const tamperedSignature = signature.slice(0, -4) + "xxxx";
    const tampered = `${payloadB64}.${tamperedSignature}`;
    check("署名を改ざんしたトークンは拒否される", verifyMemberSessionToken(tampered) === null);
  }

  // 改ざんsession拒否（payload部分を書き換えて別userIdになりすまそうとする）
  {
    const token = createMemberSessionToken(1);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ userId: 999, issuedAt: Date.now(), expiresAt: Date.now() + 999999 }), "utf8").toString("base64url");
    const forged = `${forgedPayload}.${signature}`;
    check("payloadを書き換えたトークン（署名不一致）は拒否される", verifyMemberSessionToken(forged) === null);
  }

  // 期限切れsession拒否（Date.nowを未来に進めて検証する）
  {
    const token = createMemberSessionToken(7);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 25 * 60 * 60 * 1000; // 25時間後（TTL=24時間を超過）
      check("期限切れトークンは拒否される", verifyMemberSessionToken(token) === null);
    } finally {
      Date.now = realNow;
    }
  }

  // 不正な形式のトークン
  check("空文字トークンは拒否される", verifyMemberSessionToken("") === null);
  check("undefinedトークンは拒否される", verifyMemberSessionToken(undefined) === null);
  check("ドット無しトークンは拒否される", verifyMemberSessionToken("not-a-valid-token") === null);
  check("署名部分が空のトークンは拒否される", verifyMemberSessionToken("abcdef.") === null);

  // -------------------------------------------------------------------------
  // 2. 不正なauth codeの拒否（isValidAuthCode）
  //
  // WordPress側仕様（2026-09-19確認）: bin2hex(random_bytes(32)) で生成し、
  // /exchange でも ^[a-f0-9]{64}$ で検証している。Next.js側もこれと
  // 完全に一致させる（64文字・小文字16進数のみ）。
  // -------------------------------------------------------------------------
  const VALID_CODE = "a".repeat(64);
  const VALID_HEX_CODE = "0123456789abcdef".repeat(4); // 64文字、0-9a-f全種を含む
  check("正常な64文字hexは有効", isValidAuthCode(VALID_CODE));
  check("0-9a-f全種を含む64文字hexは有効", isValidAuthCode(VALID_HEX_CODE));
  check("大文字A-Fを含む場合は無効", !isValidAuthCode("A".repeat(64)));
  check("大文字A-Fを1文字でも含む場合は無効", !isValidAuthCode("a".repeat(63) + "F"));
  check("g-zを含む場合は無効", !isValidAuthCode("a".repeat(63) + "g"));
  check("g-zを含む場合は無効(z)", !isValidAuthCode("a".repeat(63) + "z"));
  check("-を含む場合は無効", !isValidAuthCode("a".repeat(63) + "-"));
  check("_を含む場合は無効", !isValidAuthCode("a".repeat(63) + "_"));
  check("63文字（短すぎ）は無効", !isValidAuthCode("a".repeat(63)));
  check("65文字（長すぎ）は無効", !isValidAuthCode("a".repeat(65)));
  check("空文字は無効", !isValidAuthCode(""));
  check("nullは無効", !isValidAuthCode(null));
  check("undefinedは無効", !isValidAuthCode(undefined));
  check("数値は無効", !isValidAuthCode(12345));
  check("記号を含むcodeは無効", !isValidAuthCode("a".repeat(63) + "!"));
  check("スペースを含むcodeは無効", !isValidAuthCode("a".repeat(63) + " "));
  check("クエリインジェクション風の値は無効", !isValidAuthCode("../../etc/passwd" + "a".repeat(48)));

  // -------------------------------------------------------------------------
  // 3. exchangeAuthCode（fetchをモック、実際の通信はしない）
  // -------------------------------------------------------------------------
  await withMockFetch(
    async () => jsonResponse({ valid: true, user_id: 4 }),
    async () => {
      const result = await exchangeAuthCode(VALID_CODE);
      check("exchange成功時にuserIdを取得できる", result?.userId === 4);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ valid: false }),
    async () => {
      const result = await exchangeAuthCode(VALID_CODE);
      check("valid:falseのレスポンスはnullを返す", result === null);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ valid: true, user_id: "4" }), // user_idが文字列（型不正）
    async () => {
      const result = await exchangeAuthCode(VALID_CODE);
      check("user_idが数値でない不正レスポンスはnullを返す", result === null);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ error: "invalid code" }, 400),
    async () => {
      const result = await exchangeAuthCode(VALID_CODE);
      check("HTTPエラー時のexchangeはnullを返す", result === null);
    },
  );

  await withMockFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const result = await exchangeAuthCode(VALID_CODE);
      check("ネットワークエラー時のexchangeはnullを返す", result === null);
    },
  );

  // -------------------------------------------------------------------------
  // 4. getMembershipStatus（fetchをモック）
  // -------------------------------------------------------------------------
  await withMockFetch(
    async () => jsonResponse({ active: true, level_id: 2 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("active=true, level_id=2 を正しく取得できる", status.active === true && status.levelId === 2);
      check("level_id=2はisPaidLevelIdでtrue", isPaidLevelId(status.levelId));
    },
  );

  await withMockFetch(
    async () => jsonResponse({ active: true, level_id: 3 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("active=true, level_id=3 を正しく取得できる", status.active === true && status.levelId === 3);
      check("level_id=3はisPaidLevelIdでtrue", isPaidLevelId(status.levelId));
    },
  );

  await withMockFetch(
    async () => jsonResponse({ active: true, level_id: 4 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("active=true, level_id=4 を正しく取得できる", status.active === true && status.levelId === 4);
      check("level_id=4（講座 通常版）はisPaidLevelIdでtrue", isPaidLevelId(status.levelId));
    },
  );

  await withMockFetch(
    async () => jsonResponse({ active: true, level_id: 5 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("active=true, level_id=5 を正しく取得できる", status.active === true && status.levelId === 5);
      check("level_id=5（講座 DVD版）はisPaidLevelIdでtrue", isPaidLevelId(status.levelId));
    },
  );

  // 有効期限切れはWordPress側が active:false を返す（Next.js側は期限日を
  // 独自に判定しない）。level_idが講座ID（4）のまま返ってきた場合でも、
  // getMembershipStatusは生の値を返し、getCurrentTakujitsuMember()の
  // 「active && isPaidLevelId」でactive:falseになる前提を確認する。
  await withMockFetch(
    async () => jsonResponse({ active: false, level_id: 4 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("期限切れ相当（active=false, level_id=4）はactive:falseのまま返る", status.active === false && status.levelId === 4);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ active: false, level_id: null }),
    async () => {
      const status = await getMembershipStatus(4);
      check("active=false を正しく取得できる", status.active === false && status.levelId === null);
    },
  );

  // ID 2〜5以外はfullAccessにしない（WordPress側がactive:trueかつ未知のlevel_idを
  // 返してきても、最終判断（isPaidLevelId）はfullAccessにしないことを確認）。
  await withMockFetch(
    async () => jsonResponse({ active: true, level_id: 99 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("level_id=99（未知）でもgetMembershipStatus自体は生の値を返す", status.active === true && status.levelId === 99);
      check("level_id=99はisPaidLevelIdでfalse（ID2〜5以外はfullAccessにしない）", !isPaidLevelId(status.levelId));
    },
  );

  // 境界値: 2〜5の前後（1・6）・0・nullはいずれも有料会員にしない。
  for (const lv of [0, 1, 6, null]) {
    check(`level_id=${lv}はisPaidLevelIdでfalse`, !isPaidLevelId(lv));
  }

  await withMockFetch(
    async () => jsonResponse({ error: "server error" }, 500),
    async () => {
      const status = await getMembershipStatus(4);
      check("WordPress APIがHTTPエラーの場合はactive:falseに倒れる", status.active === false && status.levelId === null);
    },
  );

  await withMockFetch(
    async () => {
      throw new Error("connection refused");
    },
    async () => {
      const status = await getMembershipStatus(4);
      check("WordPress APIへの接続自体に失敗した場合もactive:falseに倒れる", status.active === false && status.levelId === null);
    },
  );

  await withMockFetch(
    async () => new Response("not json", { status: 200 }),
    async () => {
      const status = await getMembershipStatus(4);
      check("不正なJSONレスポンスの場合もactive:falseに倒れる", status.active === false && status.levelId === null);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ active: "yes", level_id: 2 }), // activeが文字列（型不正）
    async () => {
      const status = await getMembershipStatus(4);
      check("activeが真偽値でない不正レスポンスもactive:falseに倒れる", status.active === false && status.levelId === null);
    },
  );

  check("userId<=0はAPIを呼ばずactive:falseに倒れる", (await getMembershipStatus(0)).active === false);
  check("userIdが非整数の場合もactive:falseに倒れる", (await getMembershipStatus(1.5)).active === false);

  // -------------------------------------------------------------------------
  // 5. isDevPaidMemberOverrideEnabled（開発専用オーバーライド、ユーザー指示
  //    2026-09-20）。本番環境で絶対に有効にならないことを保証する、
  //    NODE_ENV==="development" AND TAKUJITSU_DEV_PAID_MEMBER==="true" の
  //    AND条件を確認する。process.envを一時的に書き換え、テスト後に
  //    必ず元の値へ戻す。
  // -------------------------------------------------------------------------
  {
    // @types/node は process.env.NODE_ENV を readonly として型付けしている
    // ため、テスト内で一時的に差し替えるには可変な参照にキャストする
    // （実行時の挙動には影響しない、型チェックのための回避）。
    const mutableEnv = process.env as { NODE_ENV?: string; TAKUJITSU_DEV_PAID_MEMBER?: string };
    const originalNodeEnv = mutableEnv.NODE_ENV;
    const originalDevFlag = mutableEnv.TAKUJITSU_DEV_PAID_MEMBER;
    try {
      mutableEnv.NODE_ENV = "development";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "true";
      check(
        "development + \"true\" の両方が揃った場合だけ有効",
        isDevPaidMemberOverrideEnabled() === true,
      );

      mutableEnv.NODE_ENV = "production";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "true";
      check(
        "production環境では、フラグがtrueでも絶対に有効にならない（本番安全性の核心）",
        isDevPaidMemberOverrideEnabled() === false,
      );

      mutableEnv.NODE_ENV = "development";
      delete mutableEnv.TAKUJITSU_DEV_PAID_MEMBER;
      check(
        "developmentでもフラグ未設定なら無効",
        isDevPaidMemberOverrideEnabled() === false,
      );

      mutableEnv.NODE_ENV = "development";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "false";
      check(
        "developmentでもフラグが\"false\"なら無効",
        isDevPaidMemberOverrideEnabled() === false,
      );

      mutableEnv.NODE_ENV = "development";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "TRUE"; // 大文字は不一致
      check(
        "フラグは文字列\"true\"との完全一致のみ有効（大文字\"TRUE\"は無効）",
        isDevPaidMemberOverrideEnabled() === false,
      );

      mutableEnv.NODE_ENV = "development";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "1";
      check(
        "フラグが\"1\"（truthyだが\"true\"と不一致）でも無効",
        isDevPaidMemberOverrideEnabled() === false,
      );

      mutableEnv.NODE_ENV = "test";
      mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = "true";
      check(
        "NODE_ENVが\"development\"以外（例:\"test\"）なら、フラグがtrueでも無効",
        isDevPaidMemberOverrideEnabled() === false,
      );
    } finally {
      // テスト専用の一時的な書き換えを必ず元に戻す（他のテストへの影響防止）。
      if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = originalNodeEnv;
      if (originalDevFlag === undefined) delete mutableEnv.TAKUJITSU_DEV_PAID_MEMBER;
      else mutableEnv.TAKUJITSU_DEV_PAID_MEMBER = originalDevFlag;
    }
  }

  // -------------------------------------------------------------------------
  // 6. 会員専用 質問サポート（getSupportStatus/submitSupportQuestion、
  //    2026-09-20追加）。fetchをモックし、実際のWordPressへは接続しない。
  //    月3回の判定・二重送信防止・PMPro再確認・メール送信自体は
  //    WordPress側の実装であり、ここではNext.js側クライアント関数が
  //    WordPressのレスポンスを正しく中継・検証することだけを確認する。
  // -------------------------------------------------------------------------
  await withMockFetch(
    async () => jsonResponse({ used: 1, limit: 3, remaining: 2, month: "2026-09" }),
    async () => {
      const status = await getSupportStatus(4);
      check(
        "getSupportStatus: 正常レスポンスをそのまま返す",
        status?.used === 1 && status?.limit === 3 && status?.remaining === 2 && status?.month === "2026-09",
      );
    },
  );

  await withMockFetch(
    async () => jsonResponse({ used: "1", limit: 3, remaining: 2, month: "2026-09" }), // used が文字列（型不正）
    async () => {
      const status = await getSupportStatus(4);
      check("getSupportStatus: 不正な形のレスポンスはnullを返す", status === null);
    },
  );

  await withMockFetch(
    async () => jsonResponse({ error: "server error" }, 500),
    async () => {
      const status = await getSupportStatus(4);
      check("getSupportStatus: HTTPエラー時はnullを返す", status === null);
    },
  );

  await withMockFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const status = await getSupportStatus(4);
      check("getSupportStatus: 通信失敗時はnullを返す", status === null);
    },
  );

  check(
    "getSupportStatus: userId<=0はAPIを呼ばずnullを返す",
    (await getSupportStatus(0)) === null,
  );

  await withMockFetch(
    async () => jsonResponse({ ok: true, used: 2, limit: 3, remaining: 1 }),
    async () => {
      const result = await submitSupportQuestion(4, "a".repeat(36), "アプリの使い方について教えてください");
      check(
        "submitSupportQuestion: 成功レスポンスをそのまま返す",
        result.ok === true && result.ok && result.used === 2 && result.limit === 3 && result.remaining === 1,
      );
    },
  );

  await withMockFetch(
    async () => jsonResponse({ ok: false, reason: "limit_reached" }, 429),
    async () => {
      const result = await submitSupportQuestion(4, "a".repeat(36), "質問です");
      check(
        "submitSupportQuestion: limit_reachedをそのまま中継する",
        result.ok === false && !result.ok && result.reason === "limit_reached",
      );
    },
  );

  await withMockFetch(
    async () => jsonResponse({ ok: false, reason: "mail_failed" }, 502),
    async () => {
      const result = await submitSupportQuestion(4, "a".repeat(36), "質問です");
      check(
        "submitSupportQuestion: mail_failedをそのまま中継する（回数消費の可否はWordPress側の責務）",
        result.ok === false && !result.ok && result.reason === "mail_failed",
      );
    },
  );

  await withMockFetch(
    async () => jsonResponse({ ok: false, reason: "not_a_known_reason" }, 400),
    async () => {
      const result = await submitSupportQuestion(4, "a".repeat(36), "質問です");
      check(
        "submitSupportQuestion: 未知のreason値はnetwork_errorに丸める（型を保証する）",
        result.ok === false && !result.ok && result.reason === "network_error",
      );
    },
  );

  await withMockFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const result = await submitSupportQuestion(4, "a".repeat(36), "質問です");
      check(
        "submitSupportQuestion: 通信失敗時はnetwork_errorを返す",
        result.ok === false && !result.ok && result.reason === "network_error",
      );
    },
  );

  check(
    "submitSupportQuestion: userId<=0はAPIを呼ばずinvalid_inputを返す",
    (await submitSupportQuestion(0, "a".repeat(36), "質問です")).ok === false,
  );

  // -------------------------------------------------------------------------
  console.log(`\n${pass} / ${pass + fail} PASS`);
  if (fail > 0) {
    console.log("FAILURES:");
    for (const f of failures) console.log(f);
    process.exit(1);
  }
}

main();
