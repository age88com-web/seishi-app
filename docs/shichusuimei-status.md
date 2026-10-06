# 四柱推命 現状記録

- 記録日: 2026-10-06
- ブランチ: `claude/sleepy-ptolemy-ouwv1l`（origin/main は丸ごと merge していない）

## 結論

**四柱推命本体は動作確認済み。顧客保存・読み込みは依存不足のため保留。**

## 四柱推命本体（動作確認済み）

| 項目 | 結果 |
|---|---|
| `/shichusuimei` 単体ビルド | 成功（擇日の画面と `src/app/api/clients` を一時的に外し、型チェックの範囲を絞って確認） |
| `tests/shichusuimei_phase1.manual.ts` | 139件 PASS |
| `tests/shichusuimei_daiun.manual.ts` | 34件 PASS |
| `tests/shichusuimei_kakkyoku.manual.ts` | 178件 PASS |
| TypeScript | 四柱推命（`src/lib/shichusuimei`・`src/app/shichusuimei`）・出生情報・出生地検索はエラーなし |
| eslint | 四柱推命と取り込んだ依存は指摘なし |
| 画面 | 既定入力（1990-01-01 12:00 東京）で計算し、命式・大運・格局・補正情報・干支関係が表示されることを確認（ブラウザエラーなし） |

取り込んだ依存（四柱推命の import を追跡した最小限）:

- origin/main から: `src/lib/liuren/constants.ts`・`types.ts`、`src/components/AppSwitcher.tsx`・`.css`
- cherry-pick: `a8fbd02`（natalProfile・NatalProfileForm・print）、`f39c845`（BirthplaceInput・clients）、`1081a42`（places・`/api/places`）、`6e0a9d8`（clients API・auth）
- 共通 CalendarEngine の公開窓口から `findSolarTermCrossing` を再 export（仕様 D12。節入り計算ロジックは変更なし）

## 保留事項

| 項目 | 状態 | 理由 |
|---|---|---|
| 顧客保存・読み込み | **保留** | `better-sqlite3` が `package.json`・lockfile・`node_modules` に無い。認証の入口（`src/proxy.ts`）・`src/app/api/auth/*`・ログイン画面が無い。`DB_PATH` の設定が必要。いずれも追加・変更しない（2026-10-06 指示） |
| 通常の全体ビルド | 失敗のまま | 擇日の二十八宿（`LODGE_28`・`SEVEN_LUMINARIES`・`resolveShukuYo`）が共通暦に無い（以前から）。`better-sqlite3` 不足 |
| `src/components/print/PalacePrint.tsx` | 未対応 | `src/lib/print/palacePrint.ts` が無い。四柱推命画面からは使われていない |
| 出生地検索 | 未確認 | 外部の国土地理院 API がクラウド環境のネットワーク制限で止められるため。コード上の問題は確認していない |
| 占術切り替え | 未対応 | AppSwitcher に四柱推命・擇日が並んでいない |

## 四柱推命ロジックの保留（追加・変更しない）

- KD23-U5（月支の本気が印で、印・比劫が多い場合も化する）
- 十二運
- 行運補強（`luckSupport` は常に null）
- 化格の下位名称
- 蔵干の比和を補強に含めるか
- 空亡・命宮・胎元（仕様上 Phase 1 対象外）
