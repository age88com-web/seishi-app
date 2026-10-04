# tests/

テスト用フレームワーク（Jest / Vitest 等）は未導入。各テストは `npx tsx` で直接実行する
自己完結スクリプト。終了コード 0 が PASS、非 0 が FAIL。

| ファイル | 内容 | 実行コマンド |
|---|---|---|
| `qimen_1080.manual.ts` | 奇門遁甲 排盤エンジンの **1080局 完全一致 回帰テスト**（地盤・旬首・天盤・九星・八門・八神）。検証データは `fixtures/qimen1080.json`（`docs/source/1080.pdf` からの機械転記・検証専用）。 | `npx tsx tests/qimen_1080.manual.ts` |
| `calendarEngine.manual.ts` | CalendarEngine.calculate() の代表ケース確認 | `npx tsx tests/calendarEngine.manual.ts` |
| `ganzhi_parity.manual.ts` | 旧 eto.ts と CalendarEngine の干支計算の互換性確認 | `TZ=Asia/Tokyo npx tsx tests/ganzhi_parity.manual.ts` |
| `kakkyoku_cases.ts` | 七政四餘 格局エンジンの動作確認 | `npx tsx tests/kakkyoku_cases.ts` |
| `liuren_interpretation_void_structure.manual.ts` | 六壬神課 解釈エンジン Phase 3M-C（空亡の構造 FACT）のテスト。dayXunVoid（既存 isVoid）と seatedOnVoid（坐空＝支が加わる地盤支が旬空）を分離。古典例（丁巳・乙卯・壬子・甲午・丙午）の値、甲子日退間（戌→申→午）の末伝午が日旬空・坐空では表せない未実装領域であること、720課×月支12 で既存 isVoid と完全一致・三伝（Phase 3K）と干上（Phase 3L）の isSeatedOnVoid が一致すること、720課の位置別・組合せ・movementPattern 別の監査値を確認。 | `npx tsx tests/liuren_interpretation_void_structure.manual.ts` |
| `liuren_interpretation_direction_evidence.manual.ts` | 六壬神課 解釈エンジン Phase 3N（進退判断の材料 FACT）のテスト。720課×月支12 で DirectionEvidence（movementDirection・standing・path・末伝の空亡）が既存 FACT と一致すること、古典4例と丁巳日の FACT 出力（結論はコードで出さない）、720課の向き別の監査値を確認。 | `npx tsx tests/liuren_interpretation_direction_evidence.manual.ts` |
| `liuren_interpretation_standing_path_comparison.manual.ts` | 六壬神課 解釈エンジン Phase 3P（干上と三伝の比較 FACT）のテスト。古典5例の4段階（干上→初→中→末）の関係・六親・十二長生・日禄と空亡の位置の完全再現、720課×月支で比較 FACT が DirectionEvidence の値をそのまま参照・転記していること、720課の並びの種類数・位置の組合せ・日禄／帝旺と空亡のクロスを確認。 | `npx tsx tests/liuren_interpretation_standing_path_comparison.manual.ts` |
| `liuren_interpretation_path_internal_relations.manual.ts` | 六壬神課 解釈エンジン Phase 3R（干上・三伝の地点どうしの関係 FACT）のテスト。順方向6組（干上→初・中・末、初→中・末、中→末）の五行関係が relationBetween と一致し、隣接3組が同じオブジェクトで逆向きを保存しないこと、S5 甲午日（申の金が干上亥の水を生ずる）・古典例の6関係、D34・D54 で関係と空亡・六親・十二長生を別々に持つこと、三伝の生・剋の連続が Phase 3B の FLOW と一致すること、720課の連続・並び・movementPattern とのクロスを確認。 | `npx tsx tests/liuren_interpretation_path_internal_relations.manual.ts` |
| `liuren_interpretation_actualization.manual.ts` | 六壬神課 解釈エンジン Phase 3S（実現の制約 FACT）のテスト。この層は「その象意が存在するか」ではなく、「その象意が現実化・作用するときに古典上考慮される制約 FACT（旬空・坐空）が付いているか」を持つ（制約があるから作用しない、という判定はしない）。古典例（辛巳・庚辰・丁丑・丙午・癸亥・乙卯・壬子・甲午）の存在 FACT と制約、720課×月支で Phase 3P・3R だけから作られ元の isVoid・isSeatedOnVoid と一致すること、標識・十二長生・六親・日干との関係 × 制約、地点どうしの関係の両端の制約の監査値を確認。 | `npx tsx tests/liuren_interpretation_actualization.manual.ts` |
| `liuren_audit_semantic_roles.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3T の Semantic Role 層の設計監査。roles.ts が型だけ（実行時 export なし・評価語なし）であること、DOMAIN・subtype・goal・ROLE の整理、FACT → ROLE 候補の対応表（講座・断案2 の出典つきと、原典未確認の候補を区別）、古典例に手で付けた ROLE から Phase 3S の制約・Phase 3R の関係を FACT を書き換えずにたどれること、同じ位置・同じ六親が CONTEXT で別の ROLE になることを確認。ROLE の自動判定は実装していない。 | `npx tsx tests/liuren_audit_semantic_roles.manual.ts` |
| `liuren_interpretation_four_lessons_state.manual.ts` | 六壬神課 解釈エンジン Phase 3U（四課の状態 FACT）のテスト。720課×月支で一課の上神が干上（Phase 3L）と完全一致、二〜四課の上神の値が既存 FACT から直接求めた値と一致、制約（Phase 3S と同じ規則）・上神どうしの順方向6組・下神→上神（一課は干のまま）と既存の剋関係の整合、四課→三伝は保存せず必要時に求めること、家宅・転居・婚姻で ROLE を付けずに4課の状態が同じ形で取れること、720課の分布を確認。 | `npx tsx tests/liuren_interpretation_four_lessons_state.manual.ts` |
| `liuren_interpretation_day_branch_state.manual.ts` | 六壬神課 解釈エンジン Phase 3V（日支そのものの状態 FACT）のテスト。720課×月支で日支の各値が既存の関数から求めた値と一致し、三課の下神・地盤支と同じ支であること、坐空を付けず制約は旬空だけが対象であること、日支→四課上神・三伝の関係を必要時に求められること、家宅（日支・三課下神・三課上神の区別）と anchor（日干・日支の両方に到達）、720課の六親・十二長生・標識・旬空の件数を確認。日支を相手・宅・被告と固定しない。 | `npx tsx tests/liuren_interpretation_day_branch_state.manual.ts` |
| `liuren_interpretation_anchor_resolver.manual.ts` | 六壬神課 解釈エンジン Phase 3W（Board Anchor Resolver）のテスト。将来の経路は assignment.source（BoardAnchor）→ resolveAnchor → FACT → constraints → relations。720課×月支で10種類の anchor がすべて解決（7,200件）し、返る FACT が生成済みの FACT と同じオブジェクトであること、lesson1/standing・dayBranch/lesson3 を別の anchor として解決すること、relationBetweenAnchors が relationBetween と一致すること（四課は上神・下神を明示）、ROLE の source をそのまま渡せること（型は tsc で確認）、FACT を書き換えず CONTEXT に依存しないことを確認。 | `npx tsx tests/liuren_interpretation_anchor_resolver.manual.ts` |
| `liuren_audit_lianru_void.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3M-A・3M-B の連茹空亡の古典構造監査。古典9例（壬子・甲午・丁巳・戊申・乙卯・甲子・丙午・甲申・丙辰）の日旬空・坐空・天空と、旬をたどる空亡の候補規則（R1〜R5）を並べ、720課での成立件数を出す。候補規則は本番に実装していない（研究資料）。 | `npx tsx tests/liuren_audit_lianru_void.manual.ts` |

## qimen_1080.manual.ts

### 目的

「1080局すべてが `docs/source/1080.pdf` と完全一致」する現状を回帰テストとして固定する。
奇門遁甲の排盤ロジック（`src/lib/qimen/` 配下）を変更してこの一致が壊れると FAIL する。

### 実行

```
npx tsx tests/qimen_1080.manual.ts
```

- 全一致: `1080 / 1080 PASS` を表示して exit 0。
- 1件でも不一致: 「局番号・項目・期待値・実測値」を一覧表示して exit 1。

### 検証データ（fixtures/qimen1080.json）

- `docs/source/1080.pdf`（呉煒維 制作／山道帰一 監修「陰陽遁1080局 奇門遁甲格局総覧」）から
  **PyMuPDF で機械的に転記した検証専用 fixture**。仕様書ではない。
- **奇門遁甲ロジックの逆算・変更に使ってはならない**（1080.pdf は検証データであって仕様ではない）。
- 再生成: `python3 tests/fixtures/gen_qimen1080.py`（要 `pip install pymupdf`）。
  1080.pdf を差し替えた場合や抽出ロジックを直した場合のみ実行する。
- 詳細は `qimen1080.json` の `_meta` フィールド参照。

### 照合範囲

局・時干支を fixture から直接与えて、排盤6モジュールを駆動して照合する:

- `dipan.ts` … 地盤（9宮）
- `xunshou.ts` … 旬首（1080.pdf に旬首欄は無いため、時干支から 60干支の旬の先頭として
  算出した期待値と照合）
- `tianpan.ts` … 天盤（9宮）
- `jiuxing.ts` … 九星（9宮）＋ 値符（星・宮）
- `bamen.ts` … 八門（外周8宮）＋ 値使（門・宮）
- `bashen.ts` … 八神（外周8宮）

`dingju.ts` / `CalendarEngine` / `qimenEngine.ts` は「日時→局／排盤」の入口で、1080.pdf は
(局, 時干支) を索引に持つためこの fixture からは直接駆動できない。`qimenEngine.calculate()` は
上記6モジュールをこの順で呼ぶ薄い統合層であり、本テストはその中核を全数で固定している。
日時→排盤の疎通は `calendarEngine.manual.ts` 等が担保する。
