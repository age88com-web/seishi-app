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
