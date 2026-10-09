// src/app/lucky-day/page.tsx
//
// 役割:
//   一般向け擇日サービス（/lucky-day）のエントリーポイント。Server Component。
//
// 2026-09-19（WordPress会員認証追加）:
//   これまでこのファイル自体がClient Component（"use client"）だったが、
//   会員状態（getCurrentTakujitsuMember()）はサーバー専用モジュール
//   （next/headersのcookies()を使う）のため、Client Componentから直接
//   呼び出せない。既存のUI・状態・ロジックはすべて
//   src/app/lucky-day/LuckyDayClient.tsx（旧page.tsxの内容そのまま＋
//   会員状態表示だけを追加）へ移し、このファイルは
//   「会員状態を取得してpropsとして渡すだけ」の薄いServer Componentに
//   した。判定ロジック・擇日エンジン・検索ロジックはここでは一切扱わない。
//
// 重要:
//   getCurrentTakujitsuMember() が next/headers の cookies() を呼ぶため、
//   このページは（環境変数の設定有無に関わらず）動的レンダリングになる。
//   WordPress通信・セッション検証に失敗した場合も、getCurrentTakujitsuMember()
//   側でフェイルセーフに { authenticated: false, active: false, levelId: null }
//   を返すため、このページ自体がエラーになることはない
//   （＝環境変数未設定でも /lucky-day は従来どおり表示できる）。

import { getCurrentTakujitsuMember, isDevPaidMemberOverrideEnabled } from "@/lib/luckyDay/auth/member";
import LuckyDayClient from "./LuckyDayClient";

export default async function LuckyDayPage() {
  const memberStatus = await getCurrentTakujitsuMember();
  // 開発専用オーバーライド（ユーザー指示、2026-09-20）。
  // isDevPaidMemberOverrideEnabled()は process.env.NODE_ENV==="development"
  // かつ process.env.TAKUJITSU_DEV_PAID_MEMBER==="true" の場合だけtrueになる
  // （src/lib/luckyDay/auth/member.ts）。ここでは秘密値そのものではなく、
  // 導出済みのboolean 1個だけをClient Componentへ渡す
  // （devModeActive自体はUI表示用の値で、セキュリティ境界ではない。
  // 実際のアクセス許可はServer Action側がgetCurrentTakujitsuMember()を
  // 呼び直して独立に再確認する）。
  const devModeActive = isDevPaidMemberOverrideEnabled();
  return <LuckyDayClient memberStatus={memberStatus} devModeActive={devModeActive} />;
}
