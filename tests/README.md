# tests/

テスト用フレームワーク（Jest / Vitest 等）は未導入。各テストは `npx tsx` で直接実行する
自己完結スクリプト。終了コード 0 が PASS、非 0 が FAIL。

| ファイル | 内容 | 実行コマンド |
|---|---|---|
| `qimen_1080.manual.ts` | 奇門遁甲 排盤エンジンの **1080局 完全一致 回帰テスト**（地盤・旬首・天盤・九星・八門・八神）。検証データは `fixtures/qimen1080.json`（`docs/source/1080.pdf` からの機械転記・検証専用）。 | `npx tsx tests/qimen_1080.manual.ts` |
| `qimen_dingju_manreki.manual.ts` | 奇門遁甲「定局」（`dingju.ts`）の **effectiveTerm（符頭の15日連続系列＋二至の置閏判定）回帰テスト**。2018年大雪の置閏3日間などの固定代表ケース＋`奇門遁甲万年暦.xlsx`(2018〜2020年)全件（244件）との日単位一致（100%）を検証。詳細は `docs/qimen-dingju-effective-term.md`。 | `npx tsx tests/qimen_dingju_manreki.manual.ts` |
| `qimen_palace_materials.manual.ts` | 奇門遁甲 一宮分の判断材料集約（`src/lib/qimenMaterials/`）の確認。2025-01-01〜01-30 の2時間刻み360盤×9宮で、剋應が既存 `resolveKokuoForPalace()` と完全一致・キーがその宮の条件と一致・追加項目が元JSONの値そのもの・単体象意がその宮の要素だけ・格局の scope（palace／whole_chart）と網羅・伏吟反吟は九星／八門のみ紐付け（直符は紐付けない）・資料由来の文字列がすべて既存データに実在することを検証。 | `npx tsx tests/qimen_palace_materials.manual.ts` |
| `qimen_ai_materials.manual.ts` | 奇門遁甲 AI 入力専用データ（`src/lib/qimenAiMaterials/`）の確認。指定ケース（2025-01-01 15:00 陽遁7局 乾六宮）の剋應5件・格局5件・伏吟 linked／反吟 unlinked と条件文（六十日以内・「商」音（姓）の人・六里（2.4km）、十六里（6.4km））の保持、2025-01-01〜01-30 の360盤×9宮で ID の一意性・materialPath で引き直した値の完全一致・欠落重複なし・gate_notes／unlinked／旺衰表が主要材料に入らないこと、剋應本文のルビ行除去（除いた行はひらがな＋空白のみ・漢字は減らない・剋應データ全件で確認）、直符反吟の excluded が1件に整理されることを検証。 | `npx tsx tests/qimen_ai_materials.manual.ts` |
| `qimen_generation_view.manual.ts` | 奇門遁甲 文章生成用ビュー（`src/lib/qimenAiMaterials/generationView.ts`）の確認。指定ケース（2025-01-01 15:00 陽遁7局 乾六宮）の含める材料・除外する材料・条件文の保持、360盤×9宮で ID と並びが完全版と同一・値が完全版そのもの・除外項目と出典キー／出典文字列が無い・完全版を変更しない・全 ID から完全版の出典を辿れることを検証。 | `npx tsx tests/qimen_generation_view.manual.ts` |
| `qimen_generation_prompt.manual.ts` | 奇門遁甲 固定プロンプト生成器（`src/lib/qimenAiMaterials/generationPrompt.ts`、入力は Generation Plan）の確認。区切り行が各1回・順序どおり、固定命令は定数そのもの、MATERIALS を JSON として読み戻すと Plan と完全一致（ビューを直接入れていない）、ALLOWED IDS が Plan の ID と一致し入力外の ID が無い、section1〜4 の全 ID を含む、旧 section5（行動判断）と「800〜1200字」が無い、unclassified の扱いと依頼の必須文言を含む、除外項目・出典情報が無いことを指定ケースと360盤×9宮で検証。`--print` で指定ケースのプロンプト全文を出力。 | `npx tsx tests/qimen_generation_prompt.manual.ts` |
| `qimen_generation_plan.manual.ts` | 奇門遁甲 文章構成（`src/lib/qimenAiMaterials/generationPlan.ts`）の確認。指定ケース（2025-01-01 15:00 陽遁7局 乾六宮）の4区分の ID と内容、KAKU-W-001 と FYFY-001 が別項目で交差しないこと、360盤×9宮で全項目の ID と内容がビューの元項目と一致・成立済み材料が消失／重複なく1回ずつ・振り分けが規則どおり、FYFY の対応格局が0件／複数件のとき未分類に置くことを検証。`--print` で指定ケースの Plan 全文を出力。 | `npx tsx tests/qimen_generation_plan.manual.ts` |
| `qimen_display_text.manual.ts` | 奇門遁甲 表示用の PDF 途中改行処理（`src/lib/qimenAiMaterials/displayText.ts`）の確認。剋應データ全件で raw は不変・display は改行だけを除いたもの・除いた改行はテスト側で独立に書いた規則（直前行が全角換算34字以上／文末記号で終わらない／次行が空行・字下げ・※で始まらない）と一致、乾六宮の具体例と境界ケースを検証。 | `npx tsx tests/qimen_display_text.manual.ts` |
| `qimen_confirmed_materials.manual.ts` | 奇門遁甲 確定資料・統合解説用入力・統合解説用プロンプト（`confirmedMaterials.ts`・`synthesisInput.ts`・`synthesisPrompt.ts`）の確認。乾六宮の確定情報（FACT-009 六合・静應／動應・scope・detail・吉凶表記・対応格局）、360盤×9宮で Plan の全項目が同じ区分・順序で入り確定情報と原文が Plan の値そのもの・入力に渡さない情報が無い・MATERIALS が入力と一致、格局64格の象意のまとめ方（48格／16格）を検証。`--print-confirmed`・`--print-input`・`--print-prompt` で乾六宮の全文を出力。 | `npx tsx tests/qimen_confirmed_materials.manual.ts` |
| `qimen_synthesis_validation.manual.ts` | 奇門遁甲 AI 統合解説の検証器と組み立て（`synthesisValidation.ts`・`interpretationOutput.ts`）の確認。Qwen は呼ばず人工回答だけを使う。乾六宮の不正回答 A〜F と追加例が却下され正しい回答 G が通過すること、未実行・空回答・時間切れ・失敗は none／検証失敗は rejected／通過は ok でどれも確定資料が残ること、360盤×9宮で機械的に作った正しい回答が誤って却下されないことを検証。 | `npx tsx tests/qimen_synthesis_validation.manual.ts` |
| `qimen_judgment_display.manual.ts` | 奇門遁甲 確定判断材料の表示用構造（`src/lib/qimenAiMaterials/judgmentDisplay.ts`）の確認。AI は使わない。乾六宮の4グループと伏吟格の関連資料、360盤×9宮で成立済み材料がちょうど1回ずつ・グループが Plan の区分と一致・この宮と盤全体が混ざらない・関連資料は linkedKaku の親の下だけ・原文と出典が元と一致・入力不変、人工ケースで未確定・親の無い資料を推測でつながないことを検証。`--print` で乾六宮の完成データを出力。 | `npx tsx tests/qimen_judgment_display.manual.ts` |
| `qimen_judgment_summary.manual.ts` | 奇門遁甲 AI を使わない定型説明（`src/lib/qimenAiMaterials/judgmentSummary.ts`）の確認。360盤×9宮で定型説明用データの名称・順序・件数・内部 ID が表示用構造と一致、関連資料の文は relations がある親だけ、文章は決まった文型だけ（名称と件数を記号化して照合）、内部 ID・原文の断片・禁止語なし、0件は「今回の分類では〜はありません」だけ、乾六宮の完成文と人工の境界ケースを検証。`--print` で代表例の完成文を出力。 | `npx tsx tests/qimen_judgment_summary.manual.ts` |
| `liuren_textbook.manual.ts` | 六壬神課 起課エンジン（`src/lib/liuren/`）の回帰テスト。『六壬神課講座』掲載30例（`fixtures/liuren_textbook.json`）の四課・九宗法・三伝（講座に載っている項目のみ）を照合し、講座回答あり29例の一致を確認。E06は講座に結論がないため参考fixture。個別回帰：E09（涉害③は干上神）、E15・E17（八専＞遥剋）、E16（本文の三伝を採用）、日時入力（1994/10/9 午時）。 | `npx tsx tests/liuren_textbook.manual.ts` |
| `liuren_ui.manual.tsx` | 六壬神課 課式ページの表示部品（`src/app/liuren/LiurenChartView.tsx`）の照合テスト。講座例題（E01・E09・E15・E17・E19・E23・E24）を描画し、画面に出る四課・三伝・課体が `fixtures/liuren_textbook.json` と一致するかを確認。 | `npx tsx tests/liuren_ui.manual.tsx` |
| `liuren_exhaustive.manual.ts` | 六壬神課 起課エンジンの全件・確定仕様テスト。60日干支×天盤差12＝720件がすべてエラーなく三伝まで確定すること（未確定0）、伏吟60件の確定と三伝同一なし、確定実装仕様（伏吟の乙日・子卯互刑、別責の干合表・三合循環、比用で陰陽一致候補0件→涉害）で決まる24課、『六壬断案2』例37（午→卯→子）を確認。 | `npx tsx tests/liuren_exhaustive.manual.ts` |
| `liuren_benran720.manual.ts` | 六壬神課 起課エンジンと『七百二十課式便覧表』（`fixtures/liuren_benran720.json`、原資料から独立に書き写した720課）の全件照合。四課・三伝・十二天将・遁干の一致数を表示し、原資料との差が `fixtures/liuren_benran720_known_diffs.json` の記録どおりなら PASS（新しい差＝回帰、消えた差＝記録の見直し）。見直し後に記録を更新するときは `--update`。 | `npx tsx tests/liuren_benran720.manual.ts` |
| `liuren_interpretation_facts.manual.ts` | 六壬神課 解釈エンジンの FACT 層（`src/lib/liuren/interpretation/`）のテスト。720課すべてで基本・四課（天将・上神の六親・下賊/上剋/無剋）・三伝・空亡・天地盤・天将配置・課体（method / pattern / middleFinalEvidence / trace）が起課結果どおりに転記され、FACT 生成で起課結果が書き換わらないことを確認。三伝未確定（transmissions null）の安全な処理、生・剋・比和・冲・刑の関係判定（固定例）も確認。 | `npx tsx tests/liuren_interpretation_facts.manual.ts` |
| `liuren_interpretation_states.manual.ts` | 六壬神課 解釈エンジンの基礎状態（`src/lib/liuren/interpretation/states.ts`）のテスト。十二長生（五行生墓法・『六壬粹言』。木火土金水×12支、土は火に従う、甲乙〜壬癸が同じ配置で陰干逆行でないこと）、旺相休囚死（春夏秋冬・四季月の土旺）、月令12支（月将ではなく calendar.monthBranch から取ること）、五行墓庫（木未・火戌・土戌・金丑・水辰）、五行墓庫と十二長生の「墓」の分離を確認。 | `npx tsx tests/liuren_interpretation_states.manual.ts` |
| `liuren_interpretation_flow.manual.ts` | 六壬神課 解釈エンジンの三伝FLOW層（`src/lib/liuren/interpretation/flow.ts`）のテスト。進茹・退茹・その他（子亥の境界を含む）、三伝間・三伝→日干・日支の生剋と生／剋の連続（三伝遞生日干、日干から三伝へ）、旺相休囚死（月支あり／なし）、日干基準の十二長生（陰干も逆行しない）、空亡の位置、三伝未確定、720課で例外なし・起課結果不変を確認。 | `npx tsx tests/liuren_interpretation_flow.manual.ts` |
| `liuren_interpretation_combinations.manual.ts` | 六壬神課 解釈エンジン Phase 3C のテスト。六合・破・害（6組ずつ・正逆両方向・表の組だけ）、複合関係（寅亥・巳申＝合＋破など）、完全三合局（4局×6通りの並び、2支・別局は不成立）、退間（−2・−2。+2・+2 は「その他」）、五行墓庫への入墓（5五行×12支、十二長生の墓とは別の結果型）、三伝FLOWの三合と複合関係、720課の進退・完全三合局の件数を確認。 | `npx tsx tests/liuren_interpretation_combinations.manual.ts` |
| `liuren_interpretation_markers.manual.ts` | 六壬神課 解釈エンジン Phase 3D のテスト。進間（+2・+2 の12配列。進茹・退茹・退間は従来どおり）、日徳・日禄（十干すべて）、旬丁（六十甲子すべて。resolveXun の遁干と矛盾しない）、驛馬（十二日支すべて・既存 YIMA と一致）、四課上神・三伝への出現と空亡の保持、三伝未確定、720課の進退5分類と初伝の標識の件数を確認。 | `npx tsx tests/liuren_interpretation_markers.manual.ts` |
| `liuren_interpretation_patterns.manual.ts` | 六壬神課 解釈エンジン Phase 3E・3E-2（古典共通パターン層Ⅰ）のテスト。元胎（順＝生胎・逆＝病胎）・関隔が四孟・四仲の64通りのうち『六壬粹言』の列挙配列だけで成立すること、稼穡が三伝すべて辰戌丑未のとき成立し（重複支も含む。12³通りで確認）、subtype が『六壬粹言』の順3配列・逆2配列・general に分かれること、四絶（乙卯臨申・丁午臨亥・己午臨亥・辛酉臨寅・癸子臨巳。十干×天盤差12、陽干は不成立）、墓覆干頭（甲未・丙戌・戊戌・庚丑・壬辰。陰干・別の支は不成立）、720課の各パターン件数と general 稼穡の配列別件数を確認。 | `npx tsx tests/liuren_interpretation_patterns.manual.ts` |
| `liuren_interpretation_harmony.manual.ts` | 六壬神課 解釈エンジン Phase 3F（全局課・三合欠一神）のテスト。曲直・炎上・従革・潤下（各6通りの並び）、欠一神（各局で1支を欠く3通り・重複伝・三伝での位置）、完全三合・1支・別局の2支では欠一神にならないこと、欠けた支の盤上の位置（日支・四課上神・地盤支・日干上神・日支上神）、720課の全局4種（Phase 3C の完全三合局と一致）・欠一神の件数・位置別件数・実課例を確認。 | `npx tsx tests/liuren_interpretation_harmony.manual.ts` |
| `liuren_interpretation_state_flow.manual.ts` | 六壬神課 解釈エンジン Phase 3G（気勢の遷移）のテスト。十二長生 12×12 の順・逆の段数（墓→絶・絶→胎・胎→養・養→長生 の循環境界を含む）、三伝の十二長生の遷移（陰干も逆行しない）、旺相休囚死の遷移（月支なしは null）、遷移の検索、既存 FLOW を書き換えないこと、720課の連続順行・連続逆行（五行生墓法では支の差と一致）と旺相休囚死の変化の分布（720課×月支12）を確認。 | `npx tsx tests/liuren_interpretation_state_flow.manual.ts` |
| `liuren_interpretation_qi_state.manual.ts` | 六壬神課 解釈エンジン Phase 3H（気勢状態の分類）のテスト。十二長生12段階 → GrowthPhase（絶は renewingBoundary として独立）、各伝の growthStage・growthPhase・seasonalStrength・isVoid が既存 FLOW と一致（月支なしは null）、大分類の遷移と境目（飛び越し・逆向きは null）、既存 FLOW・stateFlow を書き換えないこと、720課×月支12 の growthPhase × 旺相休囚死 の組合せ・重要な交差・三伝配列の上位を確認。 | `npx tsx tests/liuren_interpretation_qi_state.manual.ts` |
| `liuren_interpretation_seasonal_timeline.manual.ts` | 六壬神課 解釈エンジン Phase 3I（時令の気勢タイムライン）のテスト。5五行×12月支＝60起点の前月・当月・翌月・翌々月が seasonalStrengthOf と一致すること、月令の循環（丑→寅など）・任意の offset、水の月令推移（戌→亥→子→丑）、三伝は地支自身の五行・日干は STEM_ELEMENT、既存 FLOW・stateFlow・qiState を書き換えないこと、720課×月支12 の current→next の組合せ（伝別・三伝合計・日干）を確認。 | `npx tsx tests/liuren_interpretation_seasonal_timeline.manual.ts` |
| `liuren_interpretation_seasonal_direction.manual.ts` | 六壬神課 解釈エンジン Phase 3J（季節内の進気・退気）のテスト。十二支×十二支＝144組の完全走査（advancing 4・retreating 4・none 136、五行・季節は8組だけ）、土支・同支は none、三伝2区間への適用（movementPattern から推測しない）と三伝未確定の null、既存 FLOW を書き換えないこと、720課の区間別件数と movementPattern とのクロス集計を確認。 | `npx tsx tests/liuren_interpretation_seasonal_direction.manual.ts` |
| `liuren_interpretation_day_stem_flow.manual.ts` | 六壬神課 解釈エンジン Phase 3K（三伝と日干の作用関係の集約 FACT）のテスト。720課×月支12 で各伝の支・五行・日干との関係（relationBetween の向き）・六親・日禄・日徳・旬丁・驛馬・空亡・十二長生・GrowthPhase・旺相休囚死、区間の季節内進気退気、movementPattern が既存の値と一致すること、三伝未確定の null、GrowthPhase 三伝配列が Phase 3H を再現すること、720課の各種集計とクロス監査を確認。 | `npx tsx tests/liuren_interpretation_day_stem_flow.manual.ts` |
| `liuren_interpretation_standing_path.manual.ts` | 六壬神課 解釈エンジン Phase 3L（干上の現在地と三伝の経路）のテスト。720課×月支12 で干上（一課上神）の支・五行・日干との関係・六親・日禄・日徳・旬丁・驛馬・空亡・十二長生・GrowthPhase・旺相休囚死が既存の値と一致し、path が Phase 3K と同じこと、古典4例（宜進格・不宜進格・宜退格・不宜退格）の再現と原文との照合、720課の干上の集計・干上→初伝/末伝の関係・禄と空亡の比較・4段階の並び・進茹退茹とのクロスを確認。 | `npx tsx tests/liuren_interpretation_standing_path.manual.ts` |
| `liuren_interpretation_void_structure.manual.ts` | 六壬神課 解釈エンジン Phase 3M-C（空亡の構造 FACT）のテスト。dayXunVoid（既存 isVoid）と seatedOnVoid（坐空＝支が加わる地盤支が旬空）を分離。古典例（丁巳・乙卯・壬子・甲午・丙午）の値、甲子日退間（戌→申→午）の末伝午が日旬空・坐空では表せない未実装領域であること、720課×月支12 で既存 isVoid と完全一致・三伝（Phase 3K）と干上（Phase 3L）の isSeatedOnVoid が一致すること、720課の位置別・組合せ・movementPattern 別の監査値を確認。 | `npx tsx tests/liuren_interpretation_void_structure.manual.ts` |
| `liuren_interpretation_direction_evidence.manual.ts` | 六壬神課 解釈エンジン Phase 3N（進退判断の材料 FACT）のテスト。720課×月支12 で DirectionEvidence（movementDirection・standing・path・末伝の空亡）が既存 FACT と一致すること、古典4例と丁巳日の FACT 出力（結論はコードで出さない）、720課の向き別の監査値を確認。 | `npx tsx tests/liuren_interpretation_direction_evidence.manual.ts` |
| `liuren_interpretation_standing_path_comparison.manual.ts` | 六壬神課 解釈エンジン Phase 3P（干上と三伝の比較 FACT）のテスト。古典5例の4段階（干上→初→中→末）の関係・六親・十二長生・日禄と空亡の位置の完全再現、720課×月支で比較 FACT が DirectionEvidence の値をそのまま参照・転記していること、720課の並びの種類数・位置の組合せ・日禄／帝旺と空亡のクロスを確認。 | `npx tsx tests/liuren_interpretation_standing_path_comparison.manual.ts` |
| `liuren_interpretation_path_internal_relations.manual.ts` | 六壬神課 解釈エンジン Phase 3R（干上・三伝の地点どうしの関係 FACT）のテスト。順方向6組（干上→初・中・末、初→中・末、中→末）の五行関係が relationBetween と一致し、隣接3組が同じオブジェクトで逆向きを保存しないこと、S5 甲午日（申の金が干上亥の水を生ずる）・古典例の6関係、D34・D54 で関係と空亡・六親・十二長生を別々に持つこと、三伝の生・剋の連続が Phase 3B の FLOW と一致すること、720課の連続・並び・movementPattern とのクロスを確認。 | `npx tsx tests/liuren_interpretation_path_internal_relations.manual.ts` |
| `liuren_interpretation_actualization.manual.ts` | 六壬神課 解釈エンジン Phase 3S（実現の制約 FACT）のテスト。この層は「その象意が存在するか」ではなく、「その象意が現実化・作用するときに古典上考慮される制約 FACT（旬空・坐空）が付いているか」を持つ（制約があるから作用しない、という判定はしない）。古典例（辛巳・庚辰・丁丑・丙午・癸亥・乙卯・壬子・甲午）の存在 FACT と制約、720課×月支で Phase 3P・3R だけから作られ元の isVoid・isSeatedOnVoid と一致すること、標識・十二長生・六親・日干との関係 × 制約、地点どうしの関係の両端の制約の監査値を確認。 | `npx tsx tests/liuren_interpretation_actualization.manual.ts` |
| `liuren_audit_semantic_roles.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3T の Semantic Role 層の設計監査。roles.ts が型だけ（実行時 export なし・評価語なし）であること、DOMAIN・subtype・goal・ROLE の整理、FACT → ROLE 候補の対応表（講座・断案2 の出典つきと、原典未確認の候補を区別）、古典例に手で付けた ROLE から Phase 3S の制約・Phase 3R の関係を FACT を書き換えずにたどれること、同じ位置・同じ六親が CONTEXT で別の ROLE になることを確認。ROLE の自動判定は実装していない。 | `npx tsx tests/liuren_audit_semantic_roles.manual.ts` |
| `liuren_interpretation_four_lessons_state.manual.ts` | 六壬神課 解釈エンジン Phase 3U（四課の状態 FACT）のテスト。720課×月支で一課の上神が干上（Phase 3L）と完全一致、二〜四課の上神の値が既存 FACT から直接求めた値と一致、制約（Phase 3S と同じ規則）・上神どうしの順方向6組・下神→上神（一課は干のまま）と既存の剋関係の整合、四課→三伝は保存せず必要時に求めること、家宅・転居・婚姻で ROLE を付けずに4課の状態が同じ形で取れること、720課の分布を確認。 | `npx tsx tests/liuren_interpretation_four_lessons_state.manual.ts` |
| `liuren_interpretation_day_branch_state.manual.ts` | 六壬神課 解釈エンジン Phase 3V（日支そのものの状態 FACT）のテスト。720課×月支で日支の各値が既存の関数から求めた値と一致し、三課の下神・地盤支と同じ支であること、坐空を付けず制約は旬空だけが対象であること、日支→四課上神・三伝の関係を必要時に求められること、家宅（日支・三課下神・三課上神の区別）と anchor（日干・日支の両方に到達）、720課の六親・十二長生・標識・旬空の件数を確認。日支を相手・宅・被告と固定しない。 | `npx tsx tests/liuren_interpretation_day_branch_state.manual.ts` |
| `liuren_interpretation_anchor_resolver.manual.ts` | 六壬神課 解釈エンジン Phase 3W（Board Anchor Resolver）のテスト。将来の経路は assignment.source（BoardAnchor）→ resolveAnchor → FACT → constraints → relations。720課×月支で10種類の anchor がすべて解決（7,200件）し、返る FACT が生成済みの FACT と同じオブジェクトであること、lesson1/standing・dayBranch/lesson3 を別の anchor として解決すること、relationBetweenAnchors が relationBetween と一致すること（四課は上神・下神を明示）、ROLE の source をそのまま渡せること（型は tsc で確認）、FACT を書き換えず CONTEXT に依存しないことを確認。 | `npx tsx tests/liuren_interpretation_anchor_resolver.manual.ts` |
| `liuren_audit_semantic_role_rules.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3X の Semantic Role Rule 基盤の監査。本番 registry（講座で読み方を確認できた12件）の ID 重複なし・ROLE/DOMAIN/subtype が既存の型・出典と確認状態の記録・未確認候補の非混入、全 source が720課で resolveAnchor により解決できること、試験（官鬼 AND 長生）・病（日干を剋す神）を宣言的 matcher で表せること（候補として registry 外）、照合が制約や地点どうしの生剋に依存しないことを確認。ROLE の一括割り当ては実装していない。 | `npx tsx tests/liuren_audit_semantic_role_rules.manual.ts` |
| `liuren_audit_initial_transmission_origin.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3Y の初伝の発用元の監査。起課エンジンが初伝の「支」だけを返し、どの課から選んだかを返さないことを、方式ごと（四課の候補から選ぶ・規則で一課/三課の上神・四課の上神ではない規則）に分類し、エンジンの判定関数と涉害の候補の記録を読んで、発用元の課が1つに決まるか（重複課）を720課で数える。trace の文章は読まない。本番 FACT は作っていない。 | `npx tsx tests/liuren_audit_initial_transmission_origin.manual.ts` |
| `liuren_interpretation_initial_transmission_origin.manual.ts` | 六壬神課 Phase 3Z（初伝の発用元メタデータ）のテスト。起課エンジンが初伝を決めた地点で記録した initialOrigin（uniqueLesson・ambiguousLessons・ruleLesson・derived）について、720課で origin.branch＝初伝・候補の課の上神＝初伝・derived に課なしを確認し、Phase 3Y の監査と1課ずつ一致すること（重複47課・伏吟 一課42/三課18・derived 47課）、BoardAnchor への変換（ambiguous は候補をすべて）、断案2 例35・43・50 の発用元、求財（講座 p62）の再監査件数を確認。三伝の決め方は変えていない（initialOrigin を除いた起課結果の SHA-256 は従来値のまま）。 | `npx tsx tests/liuren_interpretation_initial_transmission_origin.manual.ts` |
| `liuren_interpretation_site_state.manual.ts` | 六壬神課 Phase 4A（天盤支が乗る地盤位置での状態 SiteState）のテスト。720課の 干上・初中末・一〜四課上神 について、siteBranch＝plate.earthUnder[skyBranch]（坐空・四課の lowerBranch と同じ地盤支）、growthStageAtSite＝天盤支自身の五行を地盤支に当てた十二長生（五行生墓法）、structural＝relationBetween(天盤支, 地盤支)、伏吟の同一支も通常の FACT、anchor からの到達（日干・日支そのものは対象外）、既存の growthStage・制約・DayBranchState が変わらないことを確認し、丁亥日 初伝午（帝旺／午加亥＝絶）と分布を出力。吉凶・強弱・ROLE・DOMAIN・旺相休囚死は持たない。 | `npx tsx tests/liuren_interpretation_site_state.manual.ts` |
| `liuren_interpretation_heavenly_general_state.manual.ts` | 六壬神課 Phase 4B（天盤支に乗る天将 HeavenlyGeneralPositionState）のテスト。720課の 干上・一〜四課上神・初中末（5,760位置）で、天将＝起課エンジンの天将盤 generals.generalOn[天盤支]、四課（lessonGenerals・facts.lessons[].general）・三伝（transmissions[].general）の既存値と完全一致、同じ天盤支なら同じ天将であることを確認（補足として占時12支 8,640課でも確認）。anchor からの到達（日干・日支そのものは null）、SiteState・制約・既存 FACT が変わらないこと、『六壬断案２』本文で支と天将が明示された古典例（例35・37・41・43・46・48・49・51・54）との一致を確認し、分布と三伝の玄武・朱雀の件数を出力。吉凶・象意・ROLE・DOMAIN は持たない。 | `npx tsx tests/liuren_interpretation_heavenly_general_state.manual.ts` |
| `liuren_interpretation_heavenly_general_role_matcher.manual.ts` | 六壬神課 Phase 4C（RoleMatcher の heavenlyGeneral）のテスト。720課×10 anchor×12天将で、日干・日支そのものは常に false（日干の解決が持つ干上を代わりに使わない）、他の8位置は Phase 4B の天将 FACT と一致する1天将だけ true（誤陽性・取りこぼし0）、同じ天盤支なら同じ結果、旬空・坐空でも false にならないことを確認。既存 matcher との AND・matcherCount・CONTEXT は when 側だけで見ること、照合の前後で FACT・CONTEXT・ルールが変わらないこと、『六壬断案２』例35・41・43・48・54 の技術監査（天将盤の方式が違う8例は使わない）、本番 registry に天将のルールを追加していないことを確認。 | `npx tsx tests/liuren_interpretation_heavenly_general_role_matcher.manual.ts` |
| `liuren_audit_heavenly_general_usage.manual.ts` | 六壬神課 Phase 4D: 天将の断法での使われ方の監査（監査専用。本番コード・registry は変更しない）。『六壬断案２』例30〜56 の本文で天将名を含む142文すべてを、天将・支・位置・六親・併用 FACT・判断の種類・Rule 化の分類（A〜E）・支持の強さで記録し、天将盤がエンジンと一致する15例では支・位置・天将・六親をエンジンの FACT と照合、不一致12例は E（保留）、本文の「貴人」が昼夜貴人支を指す文はその支が NOBLE_DAY・NOBLE_NIGHT であることを確認して集計を出力。分析は docs/liuren-heavenly-general-usage-audit.md。 | `npx tsx tests/liuren_audit_heavenly_general_usage.manual.ts` |
| `liuren_interpretation_day_night_noble_branch.manual.ts` | 六壬神課 Phase 4E（日干の昼夜貴人支 DayNightNobleBranchState）のテスト。十二天将の貴人とは別の FACT として、起課エンジンが採用した貴人支（generals.nobleBranch）と昼夜区分（generals.dayOrNight）をそのまま持つことを、720課（占時子＝夜占）と占時12支 8,640課（昼占・夜占 各4,320）で確認（その天盤支に十二天将の貴人が乗る・貴人の位置はその下の地盤支）。日干別の昼・夜の貴人支を実測し、Phase 4D で昼夜貴人支と分類した13文を、採用された側・採用されなかった側（起課結果にない）に分けて再監査。昼夜貴人表の複製・ROLE・吉凶・DOMAIN・RoleMatcher への追加がないことも確認。 | `npx tsx tests/liuren_interpretation_day_night_noble_branch.manual.ts` |
| `liuren_interpretation_day_night_noble_branch_pair.manual.ts` | 六壬神課 Phase 4F（日干の昼貴人支・夜貴人支の対）のテスト。起課エンジンが参照用メタデータとして残した generals.nobleBranches（昼・夜）が720課・占時12支 8,640課すべてにあり、採用された側（nobleBranch）が昼占なら day・夜占なら night と同じ、noblePosition・天将盤は従来どおりであることを確認。解釈層の DayNightNobleBranchPairState から昼・夜・採用された側（Phase 4E の FACT のまま）へ到達でき、日干10干の対が Phase 4E の実測と一致、Phase 4D・4E の13文を A（採用側だけ）・B（昼夜両方）・C（採用されなかった側）・D（支なし）に再分類して、Phase 4E で表せなかった11文が必要な貴人支へ到達できることを確認。解釈層に昼夜貴人表・簾幕貴人の規則・ROLE・DOMAIN・吉凶がないことも確認。起課結果の legacy SHA-256 は initialOrigin と nobleBranches を除いて従来値のまま。 | `npx tsx tests/liuren_interpretation_day_night_noble_branch_pair.manual.ts` |
| `liuren_sha720.manual.ts` | 六壬神課 起課結果の SHA-256 監査（720課: 60日×天盤差12、占時子）。legacy/core（参照用メタデータ sanchuan.initialOrigin・generals.nobleBranches を除いた起課本体）が従来値 `9edc6b0a…a022`、extended（起課結果全体）が Phase 4F 以降の基準値 `1c21ce49…d70b`、nobleBranches だけを除くと Phase 3Z〜4E の履歴値 `216ae70e…f677` を再現することを確認。 | `npx tsx tests/liuren_sha720.manual.ts` |
| `liuren_interpretation_heavenly_general_attributes.manual.ts` | 六壬神課 Phase 4G（十二天将の固有属性 HeavenlyGeneralIntrinsicAttributes）のテスト。『六壬神課講座』p56「十二天将象意」表（列: 十二天将・所属干支・象意）をページ画像から転記し、所属干支（例: 貴人＝己丑土）の干・支・五行が FACT と12天将すべてで一致・重複欠落なし・干支と五行が整合することを確認。固有属性は占時12支 8,640課×8位置で盤によらず、位置 FACT（Phase 4B の天盤支）・加臨先（Phase 4A の siteBranch）・天盤支の五行と別の項目であること、anchor 経由で 位置→天将→固有属性 に到達できること（日干・日支は null）、Phase 4D の「所属五行・干支」11文と「加臨」23文の再照合、象意・生剋・吉凶・ROLE・DOMAIN を持たないことを確認。 | `npx tsx tests/liuren_interpretation_heavenly_general_attributes.manual.ts` |
| `liuren_interpretation_heavenly_general_placement.manual.ts` | 六壬神課 Phase 4H（天将の固有属性と、乗る天盤支・加臨先との関係 HeavenlyGeneralPlacementRelations）のテスト。五行どうしの関係関数が5×5の全組で relationBetween の五行部分と一致し逆向きも整合すること、占時12支 8,640課×8位置（69,120位置）で各項目が Phase 4A・4B・4G の FACT と一致し、天盤支の五行→天将の五行・地盤支の五行→天将の五行が五行の組合せと一致、所属支との一致件数（天盤支 6,168・地盤支 9,168）が Phase 4G を再現することを確認。天盤支と地盤支の取り違え（例37・43）、Phase 4D・4G の8文（30-3・34-3・37-2・43-6・47-3・53-4・54-2・54-5）の再照合、anchor 経由の到達、制約・解釈語・十二長生・旺衰・ROLE・DOMAIN がないことも確認。 | `npx tsx tests/liuren_interpretation_heavenly_general_placement.manual.ts` |
| `liuren_interpretation_heavenly_general_site_growth.manual.ts` | 六壬神課 Phase 4I（天将の固有五行を加臨先に当てた十二長生 HeavenlyGeneralSiteGrowthState）のテスト。12天将×12地盤支の144組が growthStageOf（六壬の五行生墓法。土は火に従う）・growthPhaseOf と一致すること、例37-2 の天后（水）が地盤酉で沐浴（本文の「敗」に当たる。FACT 名には使わない）、占時12支 8,640課×8位置（69,120位置）で天将・天将の五行・地盤支が Phase 4H と一致し、十二長生が天盤支・所属支・SiteState（天盤支の五行）の値と区別されることを確認して分布を出力。anchor 経由の到達（日干・日支は null）、制約で変わらないこと、例54-5 を根拠にしないこと（十二月の火は休）、次段階の候補の再調査、季節旺衰・解釈語・ROLE・DOMAIN がないことも確認。 | `npx tsx tests/liuren_interpretation_heavenly_general_site_growth.manual.ts` |
| `liuren_interpretation_yin_spirit.manual.ts` | 六壬神課 Phase 4J（四課の上神の陰神 YinSpiritState）のテスト。『六壬断案２』の用例（例32-3・55-3、例33・36・39・50 の陰神の文）で、陰神＝上神を地盤の位置としてその上に来る天盤支（plate.heavenOn[上神]。四課を作るのと同じ写像）になることを確認し、天将盤が一致する例だけ天将も照合。720課・占時12支 8,640課で、陰神の支・天将（generalOn）・天地盤の一対一・一課／三課の陰神＝二課／四課の上神・支差＝天地盤の差・伏吟は同じ支・返吟は冲の支を確認。公開 API が四課だけであること、五行・六親・他の FACT・意味づけ・ROLE・DOMAIN を持たないことも確認。 | `npx tsx tests/liuren_interpretation_yin_spirit.manual.ts` |
| `liuren_interpretation_derived_branch_day_stem.manual.ts` | 六壬神課 Phase 4K（任意の支と日干の関係 DerivedBranchDayStemState）のテスト。日干10干×12支の120組で、五行・日干関係（支→日干）・六親が既存の計算元（elementOf・relationBetween＋transmissionToDayStemRelation・起課エンジンの sixRelation）と一致し、720課で三伝（Phase 3K）・干上（3L）・四課上神（3U）・日支（3V）の既存値とも一致することを確認。占時12支 8,640課×4課の陰神（Phase 4J）すべてに YinSpiritState を変えずに使えることと分布、例50（陰神 辰と戊日干の「助関係」＝sameElement・兄弟）、例39-10（初伝戌の上神 申）、陰神の連鎖の監査、他の FACT・吉凶・独自の表を持たないことも確認。 | `npx tsx tests/liuren_interpretation_derived_branch_day_stem.manual.ts` |
| `liuren_interpretation_tai_sui.manual.ts` | 六壬神課 Phase 4L-1（太歳 TaiSuiState。『六壬神課講座』p65「太歳（年支）」）のテスト。12支を明示入力として渡すとそのまま保持し（年干などは持たない）、占時12支 8,640課でどの太歳を与えても起課結果・解釈 FACT が変わらないことを確認。太歳の支を上神（plate.heavenOn）・天将（Phase 4B）・日干との関係（Phase 4K）に渡せること、『六壬断案２』例52（太歳 酉＝一課上神・朱雀、太歳の上に日貴 亥）・例33（明示入力の太歳 午 の上）を確認。暦計算の年支は比較のための出力だけで使わず、年境界・未来の年の計算・ROLE・DOMAIN・吉凶を持たないことも確認。 | `npx tsx tests/liuren_interpretation_tai_sui.manual.ts` |
| `liuren_interpretation_natal_year.manual.ts` | 六壬神課 Phase 4L-2（本命・年命 NatalYearState。『六壬神課講座』p59「年命（生まれ年の干支）」）のテスト。六十干支60組すべてで作れ、六十干支にない60組は例外（起課エンジンの日干支の判定と120組すべてで一致）、人物ごとに別の値を作れること、太歳（Phase 4L-1）と別の FACT であることを確認。本命の支を上神（plate.heavenOn）・天将（Phase 4B）・日干との関係（Phase 4K）・十二長生・驛馬（yimaOf）に渡せることと、『六壬断案２』例41・42・44・46・47・49・51・53・54 の本命・年命（例49 は支だけ）を確認。占時12支 8,640課で起課結果・解釈 FACT が変わらないこと、生年月日・年境界・性別・年齢・行年・ROLE・DOMAIN・吉凶を持たないことも確認。 | `npx tsx tests/liuren_interpretation_natal_year.manual.ts` |
| `liuren_interpretation_person_context.manual.ts` | 六壬神課 Phase 4M（人物入力 InterpretationPerson と、InterpretationContext の persons・subjectPersonId・counterpartyPersonId）のテスト。1人（本命あり・なし）・2人（別の本命・同じ本命）を独立して保持でき、本命は Phase 4L-2 の NatalYearState をそのまま持つこと、重複 ID・参照切れの検出（重複した人物を探すと例外）、人物なしの既存 CONTEXT との互換、盤上の起点 subjectAnchor・counterpartyAnchor と別の項目であることを確認。例44 の本命の支を既存の関数（Phase 4K・上神・Phase 4B・十二長生・驛馬）に渡せること、太歳と別に保持できること、占時12支 8,640課で人物入力を変えても起課結果・解釈 FACT・本番 registry の ROLE 照合が変わらないこと、起課 FACT に人物を入れていないことも確認。 | `npx tsx tests/liuren_interpretation_person_context.manual.ts` |
| `liuren_interpretation_context_branch.manual.ts` | 六壬神課 Phase 4N（盤外の支 ContextBranchSource と resolveContextBranch）のテスト。人物の本命（personId で指定）と CONTEXT の太歳（taiSui）を出典つきで解決し、人物がいない・本命がない・太歳がないを区別すること（人物 ID の重複は Phase 4M と同じく例外）、同じ支でも出典（本命・太歳、別の人物）を区別できること、subjectPersonId・counterpartyPersonId から自動で選ばないことを確認。解決した支を Phase 4K・上神・Phase 4B・十二長生・驛馬に渡せること、既存の CONTEXT との互換、BoardAnchor・resolveAnchor・起課 FACT に混ぜていないこと、占時12支 8,640課で起課結果・解釈 FACT・本番 registry の ROLE 照合が変わらないことも確認。 | `npx tsx tests/liuren_interpretation_context_branch.manual.ts` |
| `liuren_interpretation_board_context_branch.manual.ts` | 六壬神課 Phase 4O（盤上の支と盤外の支の一致 BoardContextBranchComparison）のテスト。盤側は Phase 3W の RelationAnchor（四課は上神・下神を明示）を resolveAnchor で、盤外側は Phase 4N の resolveContextBranch で解決し、一致しなくても matches: false、解決できなければ理由つきの unresolved（dayStemIsStem・lessonLowerIsStem・personNotFound・natalYearMissing・taiSuiMissing）になることを確認。『六壬断案２』例53（初伝＝年命 辰）・例52（日上＝太歳 酉）は一致、例42（初伝は本命の上神）・例44（未の上 戌）は一致せず、例51（寅上辰）は anchor で表せないことを確認。出典の区別、720課×14 anchor×5 出典の照合、8,640課で起課結果が変わらないこと、上神・天将・六親などや ROLE・DOMAIN を持たないことも確認。 | `npx tsx tests/liuren_interpretation_board_context_branch.manual.ts` |
| `liuren_interpretation_context_branch_derivation.manual.ts` | 六壬神課 Phase 4P（盤外の支からの一段の派生 DerivedContextBranchSource・resolveDerivedContextBranch・compareBoardDerivedContextBranch）のテスト。占時12支 8,640課×12支で self・heavenOn・earthUnder が天地盤の写像どおりで、逆写像が両方向で成り立ち、起課結果が変わらないことを確認。盤外の支が解決できなければ Phase 4N の理由を持つこと、同じ支でも派生の種類・出典を区別すること、『六壬断案２』例42（本命 未 の heavenOn 子＝初伝。self は false・heavenOn は true）・例44（未上は戌）・例51（年命 辰 の earthUnder 寅）・例52（太歳 酉 の heavenOn 亥＝昼貴人支）・例33（太歳 午 の heavenOn 寅）、伏吟・返吟、派生した支を Phase 4K・4B・十二長生に渡せること、派生の種類に驛馬・天将・資料用語がないことも確認。 | `npx tsx tests/liuren_interpretation_context_branch_derivation.manual.ts` |
| `liuren_interpretation_identity_link.manual.ts` | 六壬神課 Phase 4R（IDENTITY 層: IdentityLink と collectIdentityLinks）のテスト。呼び出し側が渡した出典（人物の本命・太歳）について、Phase 4P の比較で一致した組だけをつながりとして集め、720課×3出典で比較の true の組と順序も含めて完全一致することを確認。解決できない出典は出典ごとに1件、干上と一課上神・同じ支の別の位置・伏吟の別の派生・同じ本命の別人物・本命と太歳は別のつながり、順序は決定的で二重に作らないことを確認。『六壬断案２』例53・42・44・51・52 のつながり、8,640課で起課結果・解釈 FACT が変わらないこと、六親・十二長生・天将・空亡・驛馬・吉凶・ROLE・自動選択を持たないことも確認。 | `npx tsx tests/liuren_interpretation_identity_link.manual.ts` |
| `liuren_interpretation_identity_link_facts.manual.ts` | 六壬神課 Phase 4S（IdentityLink のつながり先の既存 FACT を参照する resolveIdentityLinkFacts）のテスト。720課×3出典の全つながりで、位置の FACT が resolveAnchor の既存の状態そのもの（日支 DayBranchState・四課 FourLessonState と上神の DayStemStandingState・干上と三伝 PositionActualizationState）で、日干関係・六親（Phase 4K）・十二長生・旬空・坐空・旺衰・天将（Phase 4B。天盤支の位置だけ）が既存 FACT と一致することを確認。地盤側の位置（日支・四課下神）に天将・坐空を作らないこと、同じ支の別の位置の区別、元のつながりへの参照、『六壬断案２』例42・44・52・53・54、8,640課で起課結果が変わらないこと、驛馬・判断・ROLE・DOMAIN・独自の計算を持たないことも確認。 | `npx tsx tests/liuren_interpretation_identity_link_facts.manual.ts` |
| `liuren_interpretation_career_domain.manual.ts` | 六壬神課 Phase 5A（仕事・昇進・試験の DOMAIN 判断 evaluateCareerDomain）のテスト。追加した最小の FACT（三伝が通り過ぎる支・支の両隣）を720課で監査し、『六壬断案２』例43・51・52・53・54 を読み（軸・向き・推論レベル・出典）と要約まで確認（例53 登三天と日干の通り過ぎ・年命の初伝・子孫、例52 太歳と日貴、例51 昼夜貴人が年命をはさむ、例54 文試・武試で向きが変わる、例43 は行年を不足として明示）。官鬼の空・空でない、本命・太歳の有無、仕事と試験、goal で結論が固定されないこと、追い風と妨げが両方残ること、720課で全 subtype を評価できること、起課結果が変わらないこと、点数・断定・ROLE の割当がないことも確認。 | `npx tsx tests/liuren_interpretation_career_domain.manual.ts` |
| `liuren_interpretation_house_domain.manual.ts` | 六壬神課 Phase 5B（家宅・住居の DOMAIN 判断 evaluateHouseDomain。盤の入力は Phase 5A から切り出した `domainBoardInput.ts`）のテスト。干＝人・支＝宅（講座 p67）で、人と宅の関係（支来干上・干来支上・干支の生剋の向き）を要約の先頭に置き、人・家・家族・財の読みを topic で分ける。『六壬断案２』例42（天網自裏は住み続ければ妨げ・離れれば追い風、本命上の発用が空は星運不利、子未の六害）・例32（宅上の兄弟玄武、身の上の親族と天空、玄武の陰神の発用、財庫の空、行年は不足として明示）・例41、『六壬断案』例3・4・5・9・11・16・18・20・21・23 を確認。干支の生剋5種が各課で1つ、goal（maintain・move・release・acquire）で向きが変わること、本命・太歳の有無、720課×subtype 2×goal 5 で例外なく決定的・起課結果と FACT が変わらないこと、風水・点数・行年の計算・ROLE の割当がないこと、Phase 5A の判断が変わらないことも確認。 | `npx tsx tests/liuren_interpretation_house_domain.manual.ts` |
| `liuren_interpretation_travel_domain.manual.ts` | 六壬神課 Phase 5C（行人 evaluateTravelerDomain・出行 evaluateTravelDomain。移動 FACT は `movementFacts.ts`）のテスト。規則は『大六壬指南』行人章第十一・出行章第十、『御定六壬直指』行人・出行、『六壬心鏡』巻七 行人門、『六壬大全』逆十二格の原文・注に条件があるものだけ。『指南』行人 占験一〜四・増補占例一二、出行 占験一・増補占例一二 の三伝を再現して読みを確認する。9例は三伝一致（9例すべて）・課体名・占断一致を分けて表にし、占断は部分一致8・不一致1で完全再現とはしない（占験二の天将、占験三の天罡、出行占験一の課体名、斫輪・回環が未対応など）。監査として、日干を使う行人のルールはすべて「日干＝行人／問う人（『指南』増補）」の見方を持ち本命・類神を日干と同一視しないこと、古典の「陥」に坐空を当てず（初伝・中伝の坐空は保留）、坐空を読むのは占験一の「落空」を根拠にした末伝の1ルールだけであることも確認。行人と出行が別の規則表であること、goal（帰ってほしい／ほしくない・行きたい／行きたくない）で向きが変わり道中の災いは変わらないこと、驛馬・進茹退茹だけで決めないこと、旬空と坐空の区別、返吟の剛日は空でも妨げないこと、問う人と外出中の人物（travelerPersonId）を混同しないこと、類神（targetSymbol）の指定、720課×goal 5 で例外なく決定的・起課結果と FACT が変わらないこと、点数・行年の計算・ROLE の割当がないことも確認。 | `npx tsx tests/liuren_interpretation_travel_domain.manual.ts` |
| `liuren_interpretation_marriage_domain.manual.ts` | 六壬神課 Phase 5D（婚姻・男女関係 evaluateMarriageDomain）のテスト。規則は『大六壬指南』婚姻章第七、『御定六壬直指』婚姻、『六壬心鏡』巻五 婚姻門の原文・注に条件があるものだけ（増補・補談は規則の出典にしない）。人物は原典の男女（日・青龍＝男、支・天后＝女）で読み、問う人の側（subjectSide）は添え書きだけで、男女別の規則（夫が占えば財・妻が占えば鬼）は subjectSide がなければ判断しない。proposal（成立）と married（維持・離別）で規則が別で、dating・reunion・general は判断せず不足を返すこと、goal で向きが変わり離れる兆しを実際の離別と断定しないこと、空亡は旬空だけで坐空は保留、天将の並びが固定のため青龍・天后の乗神どうし（常に冲）と六合（媒）の規則は保留していることを確認。『指南』占験一（古典）・増補占例一二（現代）を三伝一致・天将一致・占断一致に分けて出力する。720課×subtype 5×goal 5×側 3 で例外なく決定的・起課結果と FACT が変わらないことも確認。 | `npx tsx tests/liuren_interpretation_marriage_domain.manual.ts` |
| `liuren_interpretation_illness_domain.manual.ts` | 六壬神課 Phase 5E（疾病・健康 evaluateIllnessDomain）のテスト。規則は『御定六壬直指』疾病、『大六壬指南』疾病章第九（歌訣・割注・占験）、『六壬心鏡』巻七 疾病門（本歌・郇注・引『入式』）、『六壬大全』鬼墓課、『六壬神課講座』p61・p63・p64・p66 に条件があるものだけ（増補課例は規則の出典にしない）。日＝病人・辰＝病は盤上の一般的な見方として扱い、病人の本命は patientPersonId の人物からだけ取る（問う人の本命を使わない）こと、本人の問い・代理の問いの区別、代理の問いの類神は targetSymbol で指定することを確認。要約が「古典の読み」と「実際の病状・診断・予後は確定できない」を分け、720課のどの要約にも死亡・余命・治療指示の語がないこと、白虎・官鬼だけで重いとしないこと、空亡は旬空だけで坐空は保留、空亡による凶意の軽減を作用の減少として扱うこと、日徳日禄の発用は『直指』の条件どおり（旬空でなければ吉、発用と病人の年命の上がともに旬空なら凶、片方だけなら凶としない）に読み『指南』占験七の禄馬（驛馬）の発用と吉凶両説にしないこと、『指南』の土の墓（辰）とエンジンの土の墓（戌）を混同せず土日は『指南』の墓・長生の規則（自墓伝生）を判断しないこと（収魂は保留）も確認。『指南』占験一〜八・増補課例を三伝一致・天将一致・検出した規則・占断に分けて出力する（三伝は9例一致、天将は5例一致、土の墓の方式の違いで占験六の収魂は再現しない）。720課×goal×人物×月支で例外なく決定的・起課結果と FACT が変わらないことも確認。 | `npx tsx tests/liuren_interpretation_illness_domain.manual.ts` |
| `liuren_interpretation_wealth_domain.manual.ts` | 六壬神課 Phase 5F（求財・財物 evaluateWealthDomain）のテスト。占的は求財 seekingWealth・売買 trading・索債 debtCollection を別の規則表で読み、貸借（lending・borrowing）・財物の保持（keeping）・未指定は判断せず不足を返す。規則は『御定六壬直指』財物（附占買賣を含む）・謀望、『大六壬指南』求財章第十六・買賣章第十七・討債章、『六壬心鏡』巻六 商賈門、『六壬大全』（殃咎課・鬼墓課・卷九・卷十の「財受夾克」）、『六壬神課講座』p62・p66 に条件があるものだけ（増補課例は規則の出典にしない）。財の象意・機会・取得・保持・取引の成立・物の貴賤・利益を段階として分け、象意（妻財）だけで取得としないこと、三伝がすべて財なら妨げ（以財化鬼）とすること、財を求める人の本命は wealthSeekerPersonId からだけ取ること、売買の側（tradeSide）と物の類神（targetSymbol）を推測せず、売る側・買う側で読みは変えず向きが変わるのは金銭・財物の移動に関わる読み（物の貴賤・積貨・買う物）だけで取引の成立・品質・障害は同じ向きであること、『大全』の夾克は取得（卷九「終不可得」）と保持（卷八・鬼墓課「財不由己費用」）を別の段階・別の出典で出すこと、以財化鬼は三伝の3つがすべて妻財のときだけであること、『指南』買賣章の「傳進當行間退止」は進茹・退間だけを読む部分実装であること、空亡は旬空だけで坐空は保留、金額・成立日を出さないことを確認。『指南』求財章の増補課例2件を四課・三伝・天将・財の類神・検出した規則・占断・結果に分けて出力し（四課・三伝は2例一致、天将は2例とも不一致）、『大全』の夾克の例が規則の盤で成立することも確認（独立した検証ではない）。720課×占的3×人物・側3×月支有無で例外なく決定的・起課結果と FACT が変わらないことも確認。 | `npx tsx tests/liuren_interpretation_wealth_domain.manual.ts` |
| `liuren_audit_lianru_void.manual.ts` | **監査（audit）用。本番の回帰テストではない。** 六壬神課 Phase 3M-A・3M-B の連茹空亡の古典構造監査。古典9例（壬子・甲午・丁巳・戊申・乙卯・甲子・丙午・甲申・丙辰）の日旬空・坐空・天空と、旬をたどる空亡の候補規則（R1〜R5）を並べ、720課での成立件数を出す。候補規則は本番に実装していない（研究資料）。 | `npx tsx tests/liuren_audit_lianru_void.manual.ts` |
| `shichusuimei_phase1.manual.ts` | 四柱推命 Phase 1 基礎計算エンジン（`src/lib/shichusuimei/`）の fixture 照合。`docs/shichusuimei-fixtures-candidate.json` の `needs_review: false` だけを正解として、命式4柱（地方真太陽時補正・23:00換日・時刻不明）、節入り境界、大運の並び、立運年齢、蔵干、通変星・五神、神煞（講座の印を含むこと）を照合。あわせて `data.ts` の表（p22・p23・p114・神煞表）が仕様書の転記と一致するかを確認。 | `npx tsx tests/shichusuimei_phase1.manual.ts` |
| `qizheng_display_conditions.manual.tsx` | 七政四餘の解釈本文の表示条件（`src/lib/qizheng_display_conditions.ts`）の確認。登録 ID がデータに実在・A／B／C と判定不能条件の整合、条件の種類ごと（旺廟陥・順逆・昼夜・同宮・宿・天元主・男女・年干支・命身宮・単独・判定不能）に成立時だけ表示、月孛官禄宮「廟の地で天元主となれば」が天元主でなければ非表示・廟＋天元主で表示（パネル描画でも確認）、変曜・宮位ルールの同宮星が AND、無条件の本文は常に表示、天囚「疾病宮」を疾厄宮として判定（JSON は不変）、地元「廟旺に吉」が廟または旺で成立、専論十主の全項目の分類（A 一般原則／B 条件付き／C 曖昧）と B は成立時だけ・C は出さないこと。`--print` で分類別の件数と一覧を出力。 | `npx tsx tests/qizheng_display_conditions.manual.tsx` |
| `qizheng_limit_rules_phase6.manual.tsx` | 七政四餘 行限ルール Phase 6（`src/lib/limit_rules.ts`）の確認。729件中 normal 400件が `docs/qizheng-limit-rules-normal-audit.md` に1回ずつ載り CONFIRMED が登録と一致・読み込みは normal だけ、新規ルール（限宿・限度主・星配置）の成立と1条件を外した不成立、第1限・小限・限度不明で限度系が出ない、lr_0550 が従来の判定と同じ、表示順、実在の日時9000件×命宮方式2モード（通常＝ASC 基準命度／古典＝calcMingDegreeFromSunLon。`tests/helpers/qizheng_sample_chart.ts` で画面と同じ手順）×11年齢で、命度・大限区切り・限宿・宿内度・限度主の照合、death_timing が出ない・成立例。`--print` で成立例を出力。 | `TZ=Asia/Tokyo npx tsx tests/qizheng_limit_rules_phase6.manual.tsx` |
| `qizheng_liunian.manual.tsx` | 七政四餘 行限と流年の連動（`src/lib/liunian.ts`）の確認。対象年＝出生年＋対象年齢（1984年生 42歳→2026年・43歳→2027年）、流年干支・太歳宮が共通暦エンジンの年干支（1900〜2100年で60年周期と一致）、大限・小限とも対象年齢の大限宮・小限宮のときだけ同じ対象年の流年を出す、流年神殺が対象年の年干・年支で既存エンジンを適用し出生時と別、行限パネルの「対象年・流年・太歳宮」表示。 | `npx tsx tests/qizheng_liunian.manual.tsx` |
| `qizheng_limit_rules_phase7b.manual.tsx` | 七政四餘 行限ルール Phase 7B（流年・太歳・流年神殺を使う通常ルール lr_0570・lr_0588）の確認。対象年齢の大限・小限だけで判定・対象年齢外の大限で出ない、流年神殺（対象年の年支）と出生時神殺を取り違えない、太歳宮、1条件を外すと出ない、神殺列挙は OR、第1限・小限で限度系が出ない、流年の有無で既存ルール（lr_0550・Phase 6B の11件）の結果が変わらない、death_timing が出ない、実在の日時3000件×命宮方式2モード（通常＝ASC 基準命度／古典）×6年齢の成立例。`--print` で成立例を出力。 | `TZ=Asia/Tokyo npx tsx tests/qizheng_limit_rules_phase7b.manual.tsx` |
| `qizheng_liuxing_phase9b.manual.tsx` | 七政四餘 行限 Phase 9B（指定日時の流星。`src/lib/liuxing.ts`）の確認。任意日時（1900〜2100年4000件）で十一曜の黄経・宮（branchFromLon）・宿と宿内度（lonToMansionDeg）・順逆（前日との算出黄経の差）、月孛が従来式（近地点＋180°）と一致し page.tsx と流星が同じ yueboLonDeg・motionFromLonChange を使う、未指定では流星を出さない・年単位の走査が無い、lr_0571（出生時に難星が命限に無く流星の難星が命宮・限宮）・lr_0576（流星の難星が命宮・限宮・対宮・三方）の成立と不成立、他の流星レコードを登録しない、流星の有無で既存ルールの結果が変わらない・death_timing が出ない、実在の日時（通常・古典）×大限・小限の成立例、パネルの流星一覧。`--print` で成立例を出力。 | `TZ=Asia/Tokyo npx tsx tests/qizheng_liuxing_phase9b.manual.tsx` |
| `qizheng_yangren_phase9d.manual.tsx` | 七政四餘 行限 Phase 9D（『張果星宗』羊刃詳解例による `src/lib/yangren.ts`）の確認。10干の刃宮・陽刃／陰刃・飛刃（刃宮の対宮。乙＝戌・癸＝未）・刃星（宮主）・刃度（刃宮側＋飛刃宮側の四度）が原典表どおり、既存神殺エンジンを使わず変更もしない、lr_0625（限宮が本人の刃宮。大限・小限、飛刃宮・流刃では出ない、昼夜で変わらない）・lr_0122（限宿が刃度。刃宮側・飛刃側とも成立、非刃度・第1限・小限・流刃では出ない）、出生年干の有無で既存ルールの結果が変わらない・death_timing が出ない、実在の日時（通常・古典）の成立例。`--print` で10干の一覧と成立例を出力。 | `TZ=Asia/Tokyo npx tsx tests/qizheng_yangren_phase9d.manual.tsx` |
| `qizheng_big_limit_age_select.manual.tsx` | 大限パネルの「この大限で見る年齢」（`src/lib/big_limit_ages.ts`）の確認。選択肢が既存の大限区間の整数年齢（35.5〜50.5→36〜50）、範囲内の対象年齢は選択状態・未入力／範囲外は「年齢を選択」、選んだ年齢で限宿・宿内度・限度主・対象年・流年・太歳宮が求まる（1984年生 42歳→2026年丙午午、43歳→2027年丁未未）、小限パネルには出さない。 | `npx tsx tests/qizheng_big_limit_age_select.manual.tsx` |
| `qizheng_ming_degree.manual.ts` | 七政四餘 命度の基準統一（`src/lib/ming_degree.ts`）の確認。命宮方式が新法（通常）なら ASC 基準の命度が従来の画面表示命度と完全一致、古典（月将＋時支）なら calcMingDegreeFromSunLon と完全一致（実在の日時1万通り）。page.tsx の命度は mingDegreeForMode の1か所だけで決まり、表示・命度宿・大限・ChartSVG（限度・流年・年齢選択）・印刷が同じ値を使うこと、calcMingDegreeFromSunLon の呼び出しが lib/ming_degree.ts だけであることをソースで照合。 | `npx tsx tests/qizheng_ming_degree.manual.ts` |
| `qizheng_ming_mansion_phase8.manual.tsx` | 七政四餘 命度宿（`src/lib/ming_mansion.ts`）と行限 Phase 8 の確認。通常（ASC 基準）で ASC 実黄経の宿＝内部の命度宿＝画面の「命度（宿度）」、古典（calcMingDegreeFromSunLon 基準）で命度の黄経の宿＝内部＝画面（各3000盤・100%）、旧換算表（branchFromLon と120°ずれ）との差の件数、画面・ChartSVG が lib の値だけを使うこと、命度宿を使う新規10件（行度假如・剋命度）の成立と1条件を外した不成立、第1限・小限で限度が必要なルールが出ない、実在の日時（両モード）で成立例・death_timing が出ない・既存ルールの結果が命度宿の有無で変わらない。`--print` で成立例を出力。 | `TZ=Asia/Tokyo npx tsx tests/qizheng_ming_mansion_phase8.manual.tsx` |
| `ziwei_phase1.manual.ts` | 紫微斗数 Phase 1 作盤エンジン（`src/lib/ziwei/`）の照合。`docs/ziwei-fixtures-candidate.json`・`fixtures/ziwei_hayami_1926_2000.json` の `needs_review: false` だけを正解として、完成命盤A・B（表2の全地点で陰暦・時支・五行局・命宮・身宮・十二宮・34星・四化・大限・数え年）、主星配置パターン12、陰暦変換例、早見表899点を照合。あわせて `docs/ziwei-basic-spec.md` の表3〜表14と全セル照合し、確定仕様の境界（時支・23時日替わり・閏月前半後半・サマータイム・§2.8の例）を確認。 | `npx tsx tests/ziwei_phase1.manual.ts` |
| `ziwei_minor_stars.manual.ts` | 紫微斗数の新規諸星（`src/lib/ziwei/minorStars`、`docs/ziwei-basic-spec.md` §37）の確認。既存34星の搭載状況と名前の重複なし・表9／表10／表12／表15と既存エンジンの全セル一致・転記表の並び（1セルずれ検出）・日系30日×12宮・天才／天寿144通り・博士／長生・旬空60干支・基礎編 S19 命盤B・全盤面（各星の宮数・十二神が12宮に1つずつ・ZiweiChart を変えない・力量／格局が変わらない）・新規象意が独自文。 | `npx tsx tests/ziwei_minor_stars.manual.ts` |
| `ziwei_pattern_minor_stars.manual.ts` | 新規諸星の格局への反映（`docs/ziwei-basic-spec.md` §37.5）。巨日同宮格の三台・八座（なし／三台のみ／八座のみ／両方／同宮は加会にしない・成立条件と状態が変わらない・補足の象意・印刷）、桃花犯主格の天喜・沐浴（星IDで参照・組合せ・needs_review のまま）、截空の表17・1宮、天刑廉貞が referenceOnly のまま、作盤・力量の回帰。 | `npx tsx tests/ziwei_pattern_minor_stars.manual.ts` |
| `shichusuimei_daiun.manual.ts` | 四柱推命 大運の詳細（`daiunDetails`・`detectLuckRelations`）。大運天干の通変星・大運支の蔵干と通変星・命式との干合／冲剋・支合（六合）／冲／三合／三会／半合／半会／刑（二刑・三刑・自刑）の検出、複数関係の併存、大運欄の柱名つき短縮表記を確認。 | `npx tsx tests/shichusuimei_daiun.manual.ts` |
| `shichusuimei_current_daiun.manual.ts` | 四柱推命 現在大運の判定（`MeishikiParts` の `currentKazoeAge`・`currentDaiunIndex`）。数え年の切替は立春（共通暦エンジン `findSolarTermCrossing` の太陽黄経315°）。立春の1分前・1分後で数え年が1つ変わること、元日〜立春前は前年扱い、立春で現在大運が切り替わる境界（1980/5/15生・男: 2026年 37〜46→47〜56、2036年 47〜56→57〜66）を確認。 | `npx tsx tests/shichusuimei_current_daiun.manual.ts` |
| `shichusuimei_kakkyoku.manual.ts` | 四柱推命 強弱・格局の補助判定（`src/lib/shichusuimei/kakkyoku/`）の照合。`docs/shichusuimei-kakkyoku-spec.md` §16 の safe 命例15件で、資料の身強・身弱が秀山式内格力量判定法（`elementForce`・KD27）の最終判定と一致するか、その他の格名（従格・従旺格・月刃格）がエンジンの候補一覧に含まれるかを確認（途中の三得は固定しない）。あわせて、得令・得地の確定規則（KD24）、秀山式の命例（9命例・イチロー時柱2通り・実例解説の内格4例）の五行力量・扶助率・建禄格／月刃格（KD21）、蔵干配分（KD28：3蔵干 60・20・20／2蔵干 70・30／1蔵干 100、化した支は化後の五行へ100%）、荒川静香（未解決の検証例）、画面・resolveEffectiveStrength・解釈入力が同じ秀山式を参照すること、地支の化（branchState）・時柱なしの参考判定・干合（合化候補／合去、年干対象外）・化格の補強（比和の天干・地支のみ。印・党多は参考情報）・月支関係の全件表示を確認。 | `npx tsx tests/shichusuimei_kakkyoku.manual.ts` |
| `ziwei_rule_interpretation.manual.ts` | 紫微斗数のアプリ内・資料ベース宮別解釈（`buildRuleBasedInterpretation`、`docs/ziwei-basic-spec.md` §21.12）の確認。命盤A・Bの全12宮 × 3段階で、同一入力で同一結果・全ての文に実在する元データ ID・文は固定の前置き＋資料の文だけ・一部一致／要確認の文と条件が成立していない文を本文に使わない・資料外の助言表現なし・brief ≤ standard ≤ detailed・A を本文に使う・文字数の上限を確認。 | `npx tsx tests/ziwei_rule_interpretation.manual.ts` |
| `ziwei_power.manual.ts` | 紫微斗数の星の力量・運命指数（`src/lib/ziwei/power.ts`、`docs/ziwei-basic-spec.md` §22）と力量の条件付き象意の判定の確認。表13の全372セル（入門・基礎編）・空欄と旺衰表の一致・旺衰との対応（参考）・命盤A/B の印刷値との照合（needs_review は差を記録）・段階の境界・648盤面・条件の登録と引用・成立／不成立／判定不能・前文と後続文の整合。 | `npx tsx tests/ziwei_power.manual.ts` |
| `ziwei_patterns.manual.ts` | 紫微斗数の格局判定（`src/lib/ziwei/patterns`、基礎２ 本編33格、`docs/ziwei-basic-spec.md` §23.4）の確認。33格の登録・全書52格は判定対象外・吉凶星の分類・三方四正＝三合2宮＋対宮・吉星／煞星条件・廟旺／落陥・宮指定なしの12宮走査・三奇嘉會（命宮／身宮・warning）・sourceConflict・天馬差・四化表の維持・命盤11盤の fixture（`tests/fixtures/ziwei_patterns_examples.json`）・確定仕様（§23.5）のケース（`tests/fixtures/ziwei_pattern_cases.json`。馬頭帯箭・英星入廟の同宮／冲／破・三奇の基準宮・石中隠玉の5星・紫府朝垣の OR・羊陀夾忌の affectedPalaces）。 | `npx tsx tests/ziwei_patterns.manual.ts` |
| `ziwei_advanced.manual.ts` | 紫微斗数の応用編・144命宮配置解釈（`src/lib/ziwei/meanings/advanced`、`docs/ziwei-basic-spec.md` §24）の確認。紫微星12支×命宮12支の144キー（重複・欠落なし・命盤から必ず1項目）・見出しの配置と既存エンジンの照合・借りる星・本文が資料の文のまま（欠落・生成文・処理記録なし）・男女・特定星・四化・同宮・条件成立／不成立／未判定・後続文が単独で出ない。 | `npx tsx tests/ziwei_advanced.manual.ts` |
| `ziwei_print.manual.ts` | 紫微斗数の印刷（`buildZiweiPrintData`・`ZiweiChartPrint`／`ZiweiInterpretationPrint`、盤印刷に文章なし・解釈印刷に命盤なし・`docs/ziwei-basic-spec.md` §25）の確認。12宮すべて・命宮だけに応用編・confirmed／要確認の格局・非表示の応用編の文を印刷しない・画面と同じ既存関数の結果・内部ID・資料名・ページ・計算式を印刷しない。 | `npx tsx tests/ziwei_print.manual.ts` |
| `qizheng_print.manual.ts` | 七政四餘の解釈印刷（十二宮。`buildQzPalacePrintData` → `PalacePrint`）の確認。12宮が命宮から順・画面の宮詳細パネル／ボタン／折りたたみを使わない・各宮の先頭に基本情報表・盤全体の格局を宮ごとに出さない・同じ宮の中で同じ文を2回出さない・節の順（鑑定要約→宮の解釈→星の解釈→変曜・神殺・補足）。 | `npx tsx tests/qizheng_print.manual.ts` |
| `ziwei_fortune.manual.ts` | 紫微斗数の行運四化（`src/lib/ziwei/fortune`・`palaceStems.ts`、`docs/ziwei-basic-spec.md` §26）の確認。宮干（基礎２ S37 五虎遁表・資料の命盤4つ）・大限四化／小限四化（宮・宮干・10干の四化が既存四化表と一致・所在宮）・数え年・生年四化を変えない・生年＋大限＋小限の重複を保持・基礎２ S38・S39 の大限例（`tests/fixtures/ziwei_fortune_examples.json`）。 | `npx tsx tests/ziwei_fortune.manual.ts` |
| `ziwei_fortune_context.manual.ts` | 紫微斗数の鑑定日の行運コンテキスト（`buildFortuneContext`・太歳宮・行運十二宮・行運格局、`docs/ziwei-basic-spec.md` §27）の確認。鑑定日（暦日・行運だけ変わる・本命盤と本命格局を変えない・旧正月前後）・大限開始前・太歳宮（陰暦年の年支・三方四正・四化）・行運十二宮・羊陀夾忌／刑忌夾印／三奇嘉會・基礎２ S38（丙寅〜己巳）・S39・小限は断定しない。 | `npx tsx tests/ziwei_fortune_context.manual.ts` |
| `ziwei_fortune_selection.manual.ts` | 紫微斗数の大限・小限の選択（`selectionFromDate`・`withMajor`・`withMinor`・`buildFortuneContextFor`、`docs/ziwei-basic-spec.md` §28）の確認。鑑定日→大限・小限の同期・手動の大限／小限変更で鑑定日を変えない・小限で別の大限へ自動切替・大限内の小限は維持・生年四化を変えない・大限／小限四化・同じ星への3層・行運格局が選択大限に追従・formationBasis・宮クリック用の明示的な入力。 | `npx tsx tests/ziwei_fortune_selection.manual.ts` |
| `ziwei_fortune_meanings.manual.ts` | 紫微斗数の大限・小限における星曜の象意（`src/lib/ziwei/meanings/fortune`、`docs/ziwei-basic-spec.md` §29）の確認。基礎編48文を1回ずつ・入門と1対1対応・資料の文のまま（訂正2件のみ）・群3つ・星名の正規化・強／弱／平の判定・太陰の星 OR 宮（宮が弱→成立、それ以外→未判定）・群の重複除外・大限上／小限上の宮名は palaceMap のまま・大限と小限で共通データ・本命盤を変えない・該当なし。 | `npx tsx tests/ziwei_fortune_meanings.manual.ts` |
| `ziwei_fortune_transformations.manual.ts` | 紫微斗数の行運四化象意（`src/lib/ziwei/meanings/fortune-transformations`、`docs/ziwei-basic-spec.md` §30）と星名「擎羊星」の統一の確認。4四化の基本象意・sourceScope の区別・命宮専用文を流用しない・大限／小限で共通データ・四化のある宮だけ欄を出す・同じ星の大限＋小限を統合しない・大限／小限の変更に追従・S39（天盤命宮の大限化忌）・宮力量／星曜象意／行運格局／盤面の四化の層を変えない・作盤・力量表・旺衰表・データの星名フィールドが擎羊星。 | `npx tsx tests/ziwei_fortune_transformations.manual.ts` |
| `ziwei_taisei_influence.manual.ts` | 紫微斗数の太歳による年運補助（`src/lib/ziwei/fortune/taiseiInfluence.ts`、`docs/ziwei-basic-spec.md` §31。重なりだけ）の確認。太歳宮・三合2宮・対宮・same_palace／trine／opposite の区別・四化3層（origin 保持）・星と吉凶分類・本命格局／行運格局との位置関係・小限を別層で保持・太歳層に増強判定を持たない（S33 は §32 の流年＝小限の層）・行運星曜象意／行運四化象意を変えない・S40 喜忌を太歳に当てない。 | `npx tsx tests/ziwei_taisei_influence.manual.ts` |
| `ziwei_fortune_year_rules.manual.ts` | 紫微斗数の S33 羊陀夾忌の流年（＝小限）ルール（`fortune/liunian.ts`、§32）と S40 四化星と宮の喜忌（`fortune/xijiEvaluate.ts`、§33）の確認。小限宮一致＋三合宮／対宮の小限化忌で成立・本宮だけ／小限宮違い／太歳宮だけ／対宮だけは不成立・本命／大限の origin・表示文は資料の文だけ。S40 の9干＋己 needs_review・大限／小限を別評価・生年四化を混ぜない・太歳に当てない・行運のタイプ未確定なら断定しない・読みを確定した場合の判定。 | `npx tsx tests/ziwei_fortune_year_rules.manual.ts` |
| `ziwei_year_index.manual.ts` | 紫微斗数の流年指数（`src/lib/ziwei/fortune/yearIndex.ts`、`docs/ziwei-basic-spec.md` §34）の確認。命盤A の手計算 fixture（`fixtures/ziwei_year_index_examples.json`）・式 大限×2＋小限・大限／小限の指数＝本命の宮の運命指数・小数の計算・大限開始前／範囲外は null・全年齢の系列に重複／欠落なし・小限の変更で指数と大限が追従・手動の選択と食い違っても年齢の大限・鑑定日を変えない・四化／太歳／喜忌／S33 を入れない・グラフ値＝計算値。 | `npx tsx tests/ziwei_year_index.manual.ts` |
| `ziwei_rewrite_integrity.manual.ts` | 紫微斗数の鑑定文の独自化（`docs/ziwei-basic-spec.md` §35）の確認。意味データの件数・ID・条件・星・宮・カテゴリ・タグが書き直し前と同じ・原文フィールドなし・表示文（象意データ・行運星曜象意・行運四化象意・格局象意・S33・S40・解釈本文・判断根拠）に原文との9字以上の一致なし（照合は原文の指紋 `fixtures/ziwei_rewrite_baseline.json`）・架空人物・物語・たとえ・原書引用の語なし・空文はイメージ文と前置き・断片だけ（各星の最初のイメージ文は表示）・行運星曜象意の条件と対応・格局の ID と出典・応用編144 が変わっていない。 | `npx tsx tests/ziwei_rewrite_integrity.manual.ts` |
| `ziwei_pattern_meanings.manual.ts` | 紫微斗数の格局の象意（`docs/ziwei-basic-spec.md` §36）。33格の象意データ（base・conditional・pending・男女・scope）、成立・要確認の格局に象意（要確認は「成立した場合の象意」）、男女条件・条件付き象意の出し分け、pending を出さない、warning・破格・S33 年運文を象意に混ぜない、宮名を差し込まない、本命と大限の区別（S38 の丙寅・丁卯・己巳）、原文フィールド・原文一致なし、印刷にも象意を出し資料名・IDを出さない。 | `npx tsx tests/ziwei_pattern_meanings.manual.ts` |
| `ziwei_ai_context.manual.ts` | 紫微斗数の AI 入力用象意選別（`buildAiMeaningContext`、`docs/ziwei-basic-spec.md` §21.10）の確認。命盤A・Bの全12宮で、件数の削減（命盤A 命宮は10〜20件）・先頭N件でないこと・星×宮が基本象意より先・完全一致の組み合わせだけ採用・一部一致と条件付きの文は参考扱い・三方四正の構造・needs_review（身宮）・出典・omittedCount を確認。 | `npx tsx tests/ziwei_ai_context.manual.ts` |
| `ziwei_meanings_context.manual.ts` | 紫微斗数の宮クリック時の象意コンテキスト（`buildPalaceMeaningContext`、`docs/ziwei-basic-spec.md` §21.9）の確認。命盤A・Bの全12宮で、宮の意味・宮内星の基本象意・星×宮・旺衰と四化・組み合わせ（資料に明記され盤面の星がそろうものだけ、命宮のみ）・三方四正4宮・出典の保持・重複を確認。 | `npx tsx tests/ziwei_meanings_context.manual.ts` |
| `natal_profile_adapters.manual.ts` | 命術3種の共通入力UI・共通出生地UIの確認。紫微斗数は旧UI（表2の地点を選択）の入力と、共通の出生地UIで確定した地点（表示名＋経度）から作る入力を比べ、表2と同じ時差の経度なら命盤が一致すること・時刻不明／出生地未確定／海外は作盤しないこと。四柱推命は旧UI（p22地点を選択）と、出生地の表示名から p22 を決める新方式で命式・格局判定が一致すること（市が p22 の地名なら表の値、そうでなければ経度。D7・D15）と表示名→p22 の判定。七政四餘は計算に使う date／time／lat／lon／sex が共通プロフィールの値そのものであること。 | `npx tsx tests/natal_profile_adapters.manual.ts` |
| `ziwei_longitude.manual.ts` | 紫微斗数の出生時刻補正を経度で行う方式（2026-10-02 仕様変更。`docs/ziwei-basic-spec.md` §2.7）の回帰テスト。時差＝(経度−135)×4分（秒まで）。表2の24地点で、表2と同じ時差になる経度なら秒まで一致すること（東京 +19分00秒・愛知 +7分40秒・大阪 +1分56秒・福岡 −18分24秒・沖縄 −29分20秒）、その経度の命盤が表2の地点名の命盤と一致すること（1926〜2000年の日時×24地点×男女。23時台・サマータイム期間を含む）、四捨五入・符号・サマータイム・不正な経度を確認。 | `npx tsx tests/ziwei_longitude.manual.ts` |
| `places_search.manual.ts` | 共通出生地UIの地点検索（`src/lib/places/`）の確認。住所表記の分解（都道府県・市区町村。四日市市・十日町市・政令市の区など）と自治体コードからの逆引き。`--live` で国土地理院・Photon を実際に呼び、候補が市区町村までで表示名・都道府県・市区町村・緯度・経度がそろうこと、「名古屋市中」で中区・中村区・中川区が出ることを確認（ネットワークが必要）。 | `npx tsx tests/places_search.manual.ts [--live]` |
| `clients_db.manual.ts` | 顧客DB（`src/lib/clients/db.ts`）と顧客API（`src/app/api/clients/*`）の確認。一時ディレクトリの新しいSQLiteで、新規登録・同じ id の更新（重複が増えない）、ユーザーA/Bのデータ分離（他ユーザーの id は DB関数・API とも取得／更新不可・404）、未ログイン 401・別Origin 403・入力検証 400、本文の user_id を無視、一括削除（DELETE /api/clients。1件・複数・全件、他ユーザーの id を混ぜても削除されない、不正な ids 400・未ログイン 401・別Origin 403、users／sessions の行が不変、削除後も保存・呼び出し可）、ローカル開発バイパス（NODE_ENV=development かつ SEISHI_DEV_AUTH_BYPASS=true のときだけ user_id=1。production では true でも 401）、既存 users／sessions の列が不変であることを検証。 | `npx tsx tests/clients_db.manual.ts` |
| `calendarEngine.manual.ts` | CalendarEngine.calculate() の代表ケース確認 | `npx tsx tests/calendarEngine.manual.ts` |
| `ganzhi_parity.manual.ts` | 旧 eto.ts と CalendarEngine の干支計算の互換性確認 | `TZ=Asia/Tokyo npx tsx tests/ganzhi_parity.manual.ts` |
| `kakkyoku_cases.ts` | 七政四餘 格局エンジンの動作確認 | `npx tsx tests/kakkyoku_cases.ts` |
| `takujitsu_full.manual.ts` | 擇日UI統合 wrapper（`calculateTakujitsuFull()`）の疎通テスト。暦→神殺→resolution→十二建除→二十八宿→用途判定まで一括で UI が必要な形の結果を返すことを確認。 | `npx tsx tests/takujitsu_full.manual.ts` |
| `takujitsu_search.manual.ts` | 「目的から良い日を探す」（`searchTakujitsuDays()`）・`calculateTakujitsu(input, calendar)` の後方互換・歸忌→忌移徒 の確認。30/90/366日検索の処理時間も出力。 | `npx tsx tests/takujitsu_search.manual.ts` |
| `monthly_schedule.manual.ts` | 擇日「月間行動予定」の表示用データ（`src/lib/takujitsu/monthly/`）が既存エンジンの直接呼び出し（`calculateTakujitsuFull`・`getJikaEntry`＋`classifyJikaTerm`・`calculateDailyDirections`）と一致することの回帰テスト。日曜〜土曜の週範囲（4〜6週）、OR 条件、謝土＝判定不能、最後の23:00＝翌日の子時、時家720全件の記号分布、2025年4月の重点7日（`docs/monthly-action-schedule-2025-04-distribution.md`）を確認。 | `npx tsx tests/monthly_schedule.manual.ts` |
| `monthly_schedule_pdf.manual.ts` | 月間行動予定 PDF（`src/lib/takujitsu/monthly/monthlySchedulePdf.ts`）の回帰テスト。A4横・1週1ページ（ページ数＝週数）、タイトル「○月の行動予定」、吉用事＝good のみ（△・mixed なし）、凶用事8件＋「その他すべて凶」、何事も宜しからず、表示対象外の用事が出ないこと、BIZ UDPゴシックの埋め込みを確認。引数に出力先ディレクトリを渡すと2025年4月のPDFを書き出す。 | `npx tsx tests/monthly_schedule_pdf.manual.ts [出力先]` |
| `takujitsu_personal_honmeisatsu_unit.manual.ts` | 年命による個人判定（`src/lib/takujitsu/personal/`）の単体テスト。`docs/source/本命殺.csv`（秀山確認済み・唯一の正本）60干支全件との完全一致、出生時刻の立春境界処理（時刻なし／立春を跨ぐ日／時刻ありでの確定）、personalResultがactivityResultに混入しないことを確認。 | `npx tsx tests/takujitsu_personal_honmeisatsu_unit.manual.ts` |
| `takujitsu_kichijin_group4_zhiri_fari_unit.manual.ts` | 日家凶神「制日」「伐日」（`docs/source/擇日テキスト.pdf` p.10「(18)寶義制専伐日」表の残り2列、`kichijinGroup4.ts`に追加実装）の単体テスト。60干支全件で制日12件・伐日12件の成立/不成立と、寶日・義日・専日との排他性（60干支が5種で過不足なく分割されること）を確認。 | `npx tsx tests/takujitsu_kichijin_group4_zhiri_fari_unit.manual.ts` |
| `lucky_day_member_auth.manual.ts` | 一般向け擇日サービス（`/lucky-day`）のWordPress + Paid Memberships Pro 会員認証（`src/lib/luckyDay/auth/`）の単体テスト。Next.js独自セッション（HMAC-SHA256）の署名/検証・改ざん拒否・期限切れ拒否、WordPress APIクライアント（`exchangeAuthCode`/`getMembershipStatus`、fetchをモックし実際のWordPressへは接続しない）のactive/level_id 2〜5判定（2=月額・3=年額・4=講座通常版・5=講座DVD版）とAPIエラー時のfail-safe、不正なauth code形式（64文字小文字16進数のみ）の拒否、開発専用オーバーライド`isDevPaidMemberOverrideEnabled()`（`NODE_ENV==="development"` AND `TAKUJITSU_DEV_PAID_MEMBER==="true"` の両方を満たす場合だけ有効。本番＝NODE_ENV!=="development"では絶対に有効化されないことを含む）、会員専用 質問サポートのWordPress APIクライアント（`getSupportStatus`/`submitSupportQuestion`、fetchをモック）の正常系・エラー時fail-safeを確認。実行には `--conditions=react-server` が必要（下記参照）。 | `npx tsx --conditions=react-server tests/lucky_day_member_auth.manual.ts` |
| `lucky_day_access_control.manual.ts` | 一般向け擇日サービス（`/lucky-day`）の無料/有料「入力可能範囲」判定（`src/lib/luckyDay/accessControl.ts`。Server Action `getDayDetailAction`/`searchDaysAction` が実際に使う判定そのもの）の単体テスト。無料は今日〜今日+30日のみ許可・有料は過去日を含め366日以内なら自由、という境界値（29/30/31日目、開始日>終了日、366/367日）を確認。 | `npx tsx tests/lucky_day_access_control.manual.ts` |
| `lucky_day_personal_access.manual.ts` | 一般向け擇日サービス（`/lucky-day`）「生年月日による個人忌日判定」の有料会員限定アクセス制御（`src/lib/luckyDay/personalJudgment.ts`。Server Actionが実際に使うゲート関数 `computePersonalResultForDay` そのもの）の単体テスト。個人忌日判定ロジック自体（相冲・三殺・三刑・箭刃、`src/lib/takujitsu/personal/`）は無変更のまま使い、無料/未ログイン（isPaid=false）では常にnullを返す（生年月日を直接送っても結果を取得できない）こと、有料＋有効な生年月日でのみ既存判定結果（該当あり／該当なし／立春境界で判定不能）がそのまま返ることを確認。 | `npx tsx tests/lucky_day_personal_access.manual.ts` |
| `lucky_day_support_validation.manual.ts` | 一般向け擇日サービス（`/lucky-day`）「会員専用 質問サポート」のNext.js側入力バリデーション（`src/lib/luckyDay/support.ts`）の単体テスト。質問本文の文字数上限・禁止制御文字、冪等キー（二重送信防止用）の形式、参考情報（日付/カテゴリー/用事）の部分的サニタイズを確認。月3回の実際の上限判定・二重送信の重複排除・PMPro再確認・メール送信はWordPress側の実装であり対象外（`tests/README.md`の`lucky_day_member_auth.manual.ts`の項も参照）。 | `npx tsx tests/lucky_day_support_validation.manual.ts` |

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

## qimen_dingju_manreki.manual.ts

### 目的

奇門遁甲「定局」(`dingju.ts`) が、天文学的な節入り瞬間そのものではなく、
**符頭の15日連続系列＋二至（冬至・夏至）の置閏判定**で「今有効な節気パターン
（effectiveTerm）」を決めていることを固定する回帰テスト。
詳細な仕様・検証根拠は `docs/qimen-dingju-effective-term.md` 参照。

### 実行

```
npx tsx tests/qimen_dingju_manreki.manual.ts
```

- 全一致: `ALL PASS` を表示して exit 0。
- 1件でも不一致: 不一致件数と内訳を表示して exit 1。

### 検証データ（fixtures/qimen_dingju_manreki.json）

- `docs/source/奇門遁甲万年暦.xlsx`（2018〜2020年、3シート）から**機械的に転記した
  検証専用 fixture**。仕様ではない。production コード（`dingju.ts`）は Excel を
  実行時に一切参照しない（Excel非依存）。
- 再生成: `python3 tests/fixtures/gen_qimen_dingju.py`（要 `pip install openpyxl`）。
- 干支セルのうち、①幹支の文字自体が不正、②幹支の陰陽パリティ不整合、
  ③前後の日から機械的に逆算した干支と矛盾する（単純な1文字転記ミス）、
  のいずれかに該当する9セルは検証対象から除外している（`_meta.excludedBadGanzhi`）。
  ③の手法は dingju.ts のロジックを一切参照せず、干支が暦日ごとに必ず+1ずつ進むという
  不変条件だけで機械的に検出している。
- 2018-11-23（己未）のみ、Excel記載の「陰3」ではなく `docs/source/局数.pdf` で
  二重確認済みの正しい値「陰2」を期待値として採用している（`_meta.overrides`）。

### 照合範囲

- 代表10ケース（2018年大雪の置閏3日間・冬至上元開始・Excel一致5日・
  PDF優先の1日）を dun・ju・yuan・effectiveTerm・isLeapRepeat まで固定アサーション。
- fixture 全244件を dun・ju の一致で一括回帰（244/244 = 100%一致）。

## lucky_day_member_auth.manual.ts

### 目的

一般向け擇日サービス（`/lucky-day`）のWordPress + Paid Memberships Pro
会員認証（`src/lib/luckyDay/auth/`）が、既存の専門家向け認証
（`src/lib/auth/`）・判定エンジンに一切影響を与えず、意図どおりに
動作することを固定する回帰テスト。

### 実行

```
npx tsx --conditions=react-server tests/lucky_day_member_auth.manual.ts
```

`--conditions=react-server` が必須。`session.ts`/`wordpress.ts`/`member.ts` は
いずれも `"server-only"` をimportしており、このパッケージは
package.jsonのexports条件で分岐する（Next.jsのServer Componentビルドが
使う `react-server` 条件では何もしないが、素のNode実行では
「Client Componentからimportされた」場合を想定した例外を投げる）。
Node起動時にこの条件を明示することで、意図どおりにimportできるようにする。

### 検証データ・方式

- WordPressへは一切接続しない。`globalThis.fetch` を一時的にモックし、
  `exchangeAuthCode()`/`getMembershipStatus()` が様々なレスポンス
  （正常・不正な形状・HTTPエラー・接続エラー・不正なJSON）に対して
  どう振る舞うかを検証する。
- `WORDPRESS_URL`・`TAKUJITSU_WP_USER`・`TAKUJITSU_WP_APP_PASSWORD`・
  `TAKUJITSU_SESSION_SECRET` は、このテストプロセス内だけのダミー値を
  スクリプト冒頭で設定する（実際の `.env.local`・本番環境には一切影響しない）。

### 照合範囲

- セッション: 署名・検証の往復、署名改ざん拒否、payload改ざん拒否、
  期限切れ拒否（`Date.now`を一時的に未来へ進めて検証）、不正な形式の拒否。
- auth code形式: 64文字英数字（`-`/`_`含む）のみ有効、それ以外
  （文字数違い・記号・空白・null/undefined・数値型・パス風文字列）は無効。
- `exchangeAuthCode()`: 正常応答・`valid:false`・型不正・HTTPエラー・
  ネットワークエラーのそれぞれで期待どおりの戻り値（成功時のみuserId、
  それ以外はnull）。
- `getMembershipStatus()`: `active:true`かつ`level_id`が2〜5の場合に
  正しく取得できること、期限切れ相当（`active:false`かつ`level_id:4`）は
  `active:false`のまま返ること、`active:false`の場合、HTTPエラー・接続エラー・
  不正なJSON・型不正のレスポンスがいずれも
  `{ active: false, levelId: null }`（fail-safe）に倒れること。
- `isPaidLevelId()`（`member.ts`。ID 2〜5のみ有料会員として認める唯一の
  判定箇所、4・5は2026-10-09追加）: 2〜5ではtrue、WordPress側が
  `active:true`と共に未知の`level_id`（例: 99）を返してきた場合や、
  境界値（0・1・6・null）ではfalseになること
  （＝ID 2〜5以外はfullAccessにしないことの確認）。
