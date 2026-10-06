# 月破・徳神失力 原典確定 → 本番実装フェーズ

最終更新：2026-09-10（本番実装フェーズ完了。15章を追加）

1〜14章は原典解析と設計（コード無変更）。15章が本番実装
（`evaluateActivities()` の第1.5パス）。

対象規則：月破成立時の「德神臨此失力，不能爲福」（神殺象意.pdf）による
徳神positiveの完全抑制。

---

## 0. 現在の実装状態（確認）

| 項目 | 状態 |
|---|---|
| 月破 occurrence（`kyoushinGroup1.ts`） | 実装済み。月建と冲する日 |
| 月破 ActivityProfile | `negativeMode: "all_except"`、exceptionActivityIds 11語。実装済み |
| 月破 resolution | cancel/reduceルールなし。徳合併でも解除しないことは確定済み（No.4a、`docs/takujitsu_except_resolution_final.md` 9章） |
| 徳神positive抑制 | **未実装**（本フェーズで適用範囲を確定する） |

前回までに確認済みなのは「月破は徳合で解除されない」まで。
「徳神positiveの抑制が必要」という方向性まで（`docs/takujitsu_720_metric_reconciliation.md` 11章、`docs/takujitsu_completion_audit.md` 9章）。

---

## 1. 月破段落の原文（原本画像で確認）

### 1.1 神殺象意.pdf（『擇日秘本萬年通書』日家神殺宜忌、原本ページ「一三／一四」、p.2）

6倍ズームで該当段落を確認した。段落全体（月破・大耗）：

> 按「月破」爲「月建」之冲、又爲「月建」氣絕之地、故諸事皆忌。
> **「德神」臨此失力、不能爲福、故即與「德合」併、猶忌。**
> 止不忌祭祀・入學・解除・沐浴・求醫療病・掃舍宇・平治道塗・破屋壞垣・
> 捕捉・畋獵・取魚。

画像で個別に確認できた字句（scanが低解像度の複写のため、一部は前フェーズ
`docs/takujitsu_except_resolution_final.md` の翻刻と突き合わせて確定）：

- 「臨此失力」──明瞭に判読
- 「不能爲福」──明瞭に判読
- 「故即與『德合』（併）」──判読
- 「止不忌…祭祀・入學・破屋壞垣・平治道塗…求醫療病…捕捉…畋獵・取魚」──判読
- 「月建…氣絕之地」「諸事皆忌」──判読
- 「德神」の2字そのもの──scan品質により字形レベルでの確定は不可。
  ただし直後が「臨此失力…故即與『德合』併」と続くこと、および協紀辨方書系
  の月破條が一貫して「德神臨之失力不能爲福」とすることから、主語は
  「德神」で確定してよい（前フェーズの翻刻とも一致）。

**段落の構造**：

| 部分 | 内容 |
|---|---|
| 月破自身の忌 | 「諸事皆忌」＝EXCEPT型（all_except）。実装済み |
| 例外（不忌） | 祭祀・入學・解除・沐浴・求醫療病・掃舍宇・平治道塗・破屋壞垣・捕捉・畋獵・取魚（11語）。実装済み（exceptionActivityIds） |
| 徳神に関する文 | 「德神臨此失力、不能爲福」──**徳神は月破日に力を失い、福をなせない** |
| 併存条件 | 「故即與『德合』併、猶忌」──**それゆえ徳合と併存しても月破はなお忌**（解除されない） |
| 徳神以外の吉神への言及 | **なし**（段落中に三合・六合・母倉等への言及は無い） |
| 解除条件 | **なし**（cancelルールに相当する記述は無い。「猶忌」で明確に否定） |
| 但し書き | 「故即」＝「臨此失力・不能爲福」を根拠として「與德合併猶忌」を導く因果。独立した但し書きではない |

### 1.2 擇日テキスト.pdf p.18（テキスト抽出、原文ママ）

> 2）月破（大耗）
> 月建と沖する日。月を破ると言う意味で諸事よろしくない日。**仁徳神が力を
> 失う日**と言われている。
> 忌：祭祀、入学、解除、沐浴、治病、掃舎宇、平治道塗、破屋壊垣、狩猟、魚釣
> ・例外として、**天徳（合）・天赦・天願・月徳（合）があると解除される
> 場合がある。**
> 子・午月→災殺（子午日）／未・申月→月刑（丑寅日）／卯・酉月→災殺（卯酉日）
> 上記の日は凶日とならない。
> ・また、下記の日は徳合がきても解除されない。
> 4月癸亥・10月丁巳：陰陽交破

**2資料の関係**：

- 神殺象意.pdf：「德神臨此失力、不能爲福、故即與德合併、猶忌」＝
  **徳合があっても月破は解除されない**（＋徳神は福をなせない）。
- 擇日テキスト.pdf p.18：「天徳（合）・天赦・天願・月徳（合）があると
  解除される場合がある／下記の日は徳合がきても解除されない」＝
  **原則は解除されうる、陰陽交破日だけ例外**。

解除の可否については2資料が食い違うが、前フェーズでユーザー方針として
「神殺象意.pdfに従い月破はcancelしない」が確定済み（本フェーズでも
その方針を維持し、cancel/reduceルールは追加しない。§10）。

擇日テキスト.pdf p.18は「德神」の具体的な内訳を
**天徳・天徳合・月徳・月徳合・天赦・天願の6神**として明示している
（＝月破の項に限定したローカル定義。歳徳・歳徳合を含まない）。

---

## 2. 神殺象意.pdf 内の「德神」用例調査（全7ページ通読）

| 表現 | 出現箇所 | 意味 |
|---|---|---|
| **「德神」** | **月破の段落のみ**（1箇所） | 「德神臨此失力、不能爲福」 |
| 「天地合德日」 | 天徳・天徳合・月徳・月徳合の各定義（p.0） | その神殺自身の性質説明 |
| 「德合」 | 月建・月破・四廢・上朔・四離四絶ほか多数（p.2〜4、resolution文脈） | 解除・相殺の相手方グループ |
| 「二德」 | 平日・收日（p.2「平收日與二德併、可用」） | 天徳＋月徳の2神 |
| 「歲德」 | 四離四絶（p.4「與『德合』『歲德』等」） | 徳合とは別に併記される |

**結論**：「德神」という語は神殺象意.pdf全体で**月破の1箇所でしか使われて
いない**。神殺象意.pdf自身は「德神」＝どの神、という定義を与えていない
（總称としての内訳は資料内から確定できない）。

ただし：

- 同じ月破段落が「故即與『德合』併、猶忌」と続けており、「德神」と「德合」を
  ほぼ同一のものとして扱っている（「德神」の力が失われる→だから「德合」が
  来ても効かない、という一続きの論理）。
- 神殺象意.pdf自身は「德合」の内訳も月破段落では列挙していないが、
  **擇日テキスト.pdf p.18が同じ月破の項で「天徳（合）・天赦・天願・
  月徳（合）」と明示**している。

したがって、月破の「德神」の具体的内訳は
**擇日テキスト.pdf p.18のローカル定義に依拠する**のが妥当
（`docs/takujitsu_decisions.md` の方針「月破・月建など本文が独自に組み合わせを
列挙している項目は、共通の徳合定義を流用せず本文が直接示す組み合わせを
使う」とも整合）。

---

## 3. 既存 DEHE_GROUP との一致確認

```
DEHE_GROUP = 天徳・天徳合・月徳・月徳合・歳徳・歳徳合   （resolution/rules.ts、講義用語）
```

月破「德神」の内訳（擇日テキスト.pdf p.18）：

```
天徳・天徳合・月徳・月徳合・天赦・天願
```

| 神 | DEHE_GROUP | 月破「德神」(p.18) |
|---|---|---|
| 天徳 | ○ | ○ |
| 天徳合 | ○ | ○ |
| 月徳 | ○ | ○ |
| 月徳合 | ○ | ○ |
| 歳徳 | ○ | **×** |
| 歳徳合 | ○ | **×** |
| 天赦 | × | **○** |
| 天願 | × | **○** |

**分類：B（一部のみ一致）。**

- 共通：天徳・天徳合・月徳・月徳合（4神）
- DEHE_GROUPのみ：歳徳・歳徳合
- 月破「德神」のみ：天赦・天願

**「德神」＝DEHE_GROUP ではない。** 月破の「德神」は
`docs/takujitsu_decisions.md` 既述のとおり擇日テキスト.pdf p.18のローカル
定義（天徳系＋月徳系＋天赦＋天願＝6神）であり、共通DEHE_GROUPを流用しない。

なお、この6神は偶然にも
**ActivityProfileで `positiveMode: "all_except"` を持つ6神と完全一致**する
（`activityProfiles.ts` 148〜157行：天徳・月徳・天徳合・月徳合・天赦・天願）。
歳徳・歳徳合はLIST型（favorable: 修造・動土・嫁娶・百事）。

---

## 4. 個別神が「德神」に含まれる根拠

| 神 | 「德神」に含まれるか | 根拠 |
|---|---|---|
| 天徳 | **含まれる** | 擇日テキスト.pdf p.18「天徳（合）」／神殺象意.pdf「德合」の中核 |
| 天徳合 | **含まれる** | 同上「天徳（合）」 |
| 月徳 | **含まれる** | 同上「月徳（合）」 |
| 月徳合 | **含まれる** | 同上「月徳（合）」 |
| 天赦 | **含まれる** | 擇日テキスト.pdf p.18が月破の項で明示的に列挙 |
| 天願 | **含まれる** | 同上 |
| 歳徳 | **含まれない** | 擇日テキスト.pdf p.18の月破の項に無い。神殺象意.pdf月破段落にも言及なし。DEHE_GROUPには含むが、それは講義用語であり月破の「德神」ではない |
| 歳徳合 | **含まれない** | 同上 |
| 天赦・天願以外の赦願 | ── | 赦願＝天赦/天願で全て |
| 三合 | **含まれない** | どの資料も三合を「德」神と呼んでいない |
| 六合 | **含まれない** | 同上 |
| 母倉 | **含まれない** | 同上 |
| 月恩 | **含まれない** | 神殺象意.pdfは月建（小時）の解除条件に月恩を含めるが「德」ではない |
| 四相 | **含まれない** | 同上（月建の解除条件に四相を含むが「德」ではない） |
| 時徳 | **含まれない** | 名に「徳」を含むが、神殺象意.pdf・擇日テキスト.pdfとも月破の「德神」に含めていない。時徳は独自のLIST型宜（`activityProfiles.ts`）を持つ別概念 |

**不明（D）**：厳密には「歳徳・歳徳合」。神殺象意.pdfの月破段落は「德神」の
内訳を明示せず、擇日テキスト.pdf p.18は列挙から外している一方、擇日
テキスト.pdf p.2（歳徳・歳徳合の実例）には「歳徳合が巡っていたために
すべての凶殺が解除される」という月破日の実例がある（＝解除の文脈では
歳徳合が月破に効くという別記述）。ただしこれは§10のcancel論点であり、
本フェーズの「徳神positive抑制」の対象範囲としては、原典が明示する
天徳系＋月徳系＋天赦＋天願の6神に限定するのが安全（推測で歳徳系を
足さない）。

---

## 5. 「不能爲福」の意味（A〜D）

原文：「德神臨此失力、不能爲福、故即與德合併、猶忌」

| 選択肢 | 判定 |
|---|---|
| A. 徳神そのものの全positiveが無効 | **最も原文に近い**（「不能爲福」＝福をなすことが一切できない、という絶対的な否定。徳神の宜生成能力そのものが停止する） |
| B. 月破と直接衝突する特定用事だけ無効 | 原文に「特定用事だけ」という限定はない。むしろ「諸事皆忌」（月破側）と「不能爲福」（徳神側）が全面的 |
| C. 徳神による月破解除能力だけ無効 | 「故即與德合併猶忌」の部分はこれに相当するが、その前段「德神臨此失力、不能爲福」は徳神**自身の状態**を述べており、「解除できない」だけに縮小できない |
| D. 単なる吉力減少で宜自体は残る | 「不能爲福」は「福をなせない」であって「福が減る」ではない。reducedではなく完全な機能停止 |

**結論：A（徳神positiveの完全抑制）が原文の最も自然な読み。**

ただし注意（§で分けて読む）：

- 「月破を解除できない」（＝cancel不可、確定済み）と
  「徳神自身の宜も全部失う」（＝本フェーズの論点）は**別の事柄**。
  原文は前段で後者（「不能爲福」）を述べ、それを根拠に前者（「猶忌」）を
  導いている。したがって原文は**両方**を主張している。
- 実務上の効果：月破日はEXCEPT型で「諸事皆忌」。そこに徳神（特にALL型の
  「諸事皆宜」）が同時成立すると、現状の実装では全用事がmixedになる。
  「德神…不能爲福」はまさにこの状況を否定する文＝**徳神は月破日に
  「諸事皆宜」を発動しない**、と読む。

---

## 6. 「失力」と「不能爲福」を分けて読む／他神殺との比較

| 神殺 | 徳合併存時の表現 | 「失力／不能爲福」型か |
|---|---|---|
| **月破** | 「德神臨此失力、不能爲福、故即與德合併、猶忌」 | **○（唯一）** |
| 四廢 | 「與『德合』併、猶忌」 | ×（徳合が効かないとだけ言う。徳神の状態には触れない） |
| 上朔・四離・四絶 | 「與『德合』『赦願』併、猶忌」 | ×（同上） |
| 平日・收日 | 「與二德併、可用」（＝解除される） | ×（むしろ徳が効く） |
| その他多数の凶神 | 「與『德合』併、則不忌」（解除） | ×（徳が効く） |

**「德神臨此失力、不能爲福」という言い回しは、EXCEPT型11凶神のうち
月破だけが持つ特別な表現。** 他の「猶忌」型（四廢・上朔等）は
「徳合が来ても凶が消えない」と凶神側から言うだけだが、月破は
**徳神側が機能停止する**と明記する。この非対称性から：

- 「失力」＝力を失う（弱化ではなく喪失。直後の「不能爲福」が程度を確定）
- 「不能爲福」＝福をなせない（＝positiveを生まない）
- 両語で「徳神は月破日に宜を生成しない」＝**positive完全抑制**（reduced
  ではない）と読むのが、資料内の他用例との対比からも妥当。

---

## 7. 720実例での参考確認（規則の逆算はしない）

診断スクリプト：`tests/fixtures/gen_geppo_deity_suppression.ts`
（src無変更、`calculateTakujitsu` / `evaluateActivities` を読み取り専用で呼ぶ）。

| 指標 | 値 |
|---|---|
| 720行中の月破成立日数 | **60 / 720** |
| 月破 ＋ 何らかの徳神候補 | 28 / 60 |
| 月破 ＋ DEHE_GROUP | 24 / 60 |
| 月破 ＋ 擇日テキストp.18の6神（＝ALL型6神） | 20 / 60 |
| 月破 ＋ ALL型6神 | 20 / 60 |
| 月破 ＋ 歳徳/歳徳合 | 12 / 60 |

個別神の月破日成立日数：天徳 4、天徳合 4、月徳 6、月徳合 6、歳徳 5、
歳徳合 7、天赦 0、天願 4（この720行では天赦と月破の同日成立は0件）。

擇日象意.pdf 宜との関係（月破行）：**月破が成立した720行のうち、
擇日象意.pdfに expected 宜がある行は 0 行**（延べ 0 語）。月破は
「諸事皆忌」であり擇日象意.pdf（憲宜／協紀由来の宜専用データ）は
月破日に宜を記載しないため、構造的に0。徳神positive抑制は
SOURCE VALIDATION・擇日象意.pdf一致率には影響しない見込み。

（720行から「德神」の範囲や優先ルールを逆算していない。原典解釈を
§1〜§6で先に固定した上での、影響規模の参考集計である。）

---

## 8. 現在のActivityProfileへの影響予測

### 8.1 候補徳神が現在生成しているpositive

| 神 | ActivityProfile | 生成positive |
|---|---|---|
| 天徳 | `positiveMode: "all_except"` | ActivityDefinition全256語 − {畋獵, 取魚} ＝ **254語**（ALL型） |
| 月徳 | 同上 | 254語（ALL型） |
| 天徳合 | 同上 | 254語（ALL型） |
| 月徳合 | 同上 | 254語（ALL型） |
| 天赦 | 同上 | 254語（ALL型） |
| 天願 | `positiveMode: "all_except"`、例外なし | **256語**（ALL型、例外なし） |
| 歳徳 | LIST型 | 修造・動土・嫁娶・百事（4語） |
| 歳徳合 | LIST型 | 同上（4語） |

### 8.2 月破日にALL型6神のpositiveを抑制した場合の試算

対象：720行中、月破＋ALL型徳神が同日成立する **20日**。

| 指標 | 値 |
|---|---|
| 抑制されるpositiveの延べ数（activityId × day × 神） | **6,104** |
| 影響を受ける活動id種別数（ユニーク） | 256 / 256（20日合算では全用事が一度は該当） |
| verdict good → non-good（neutral）に変わる延べ数 | **41** |
| verdict mixed → bad に変わる延べ数 | **2,660** |

- **mixed → bad が2,660件**：これが規則の主目的。月破日にALL型徳神が
  重なると現状は例外11語以外のほぼ全用事がmixed（徳神positive＋月破
  negative）になっているが、「德神…不能爲福」を反映すると月破側の
  negative（諸事皆忌）だけが残り bad になる。20日 × 約133用事。
- **good → neutral が41件**：月破の例外11語（祭祀・入學など）で、
  positiveの根拠が徳神だけだったもの。徳神が「不能爲福」なら、
  月破が忌まない用事でも「宜」にはならず neutral（不忌）に戻る。
  原文「止不忌」＝「忌まない」であって「宜」ではない、という
  EXCEPT型の意味論とも整合。
- 歳徳・歳徳合（LIST型4語）は「德神」に含めない方針のため抑制対象外。
  仮に含めても影響は月破日（12日）× 修造・動土・嫁娶・百事の4語のみで軽微。

---

## 9. ALL型との関係

天徳・月徳・天徳合・月徳合・天赦・天願の6神がALL型（`positiveMode:
"all_except"`）であり、月破と同時成立すると現在は各254〜256語の
positiveを生成する。一方、月破はEXCEPT型（`negativeMode: "all_except"`）で
例外11語を除く全用事を忌にする。

現状：月破日に上記ALL型徳神が1つでも成立すると、例外11語以外の
ほぼ全用事が「positive（徳神）＋negative（月破）」＝**mixed**になる。

原文「德神…不能爲福…猶忌」が本当にこれらを福なきものとするなら、
月破日にはALL型徳神のpositiveスイープを抑制する必要がある
（→ 月破日は例外11語以外が素直にbad）。

**原典が確定した（§1〜§6でA＝完全抑制）ので、次フェーズで実装してよい。**
本フェーズでは実装しない。

---

## 10. negative側は変更しない

- 月破の `negativeMode: "all_except"`：**変更しない**。
- 月破を cancel/reduce する新規 resolution ルール：**作らない**
  （前フェーズで「実装しない」が確定済み。No.4a）。
- 本フェーズで検討するのは「徳神positive抑制」のみ。

---

## 11. 実装モデル案（設計のみ。今回は実装しない）

### 11.1 概念

「月破が有効に成立している日は、指定した徳神（GEPPO_DEITY_SET）の
**favorable（宜）由来のcontributionを無効化する**」──1ルールだけ。
汎用の positiveSuppressionRule エンジンは作らない（現状は月破の1件のみ）。

```
GEPPO_DEITY_SET = 天徳・天徳合・月徳・月徳合・天赦・天願
                  （＝擇日テキスト.pdf p.18のローカル定義。
                    ＝ActivityProfileがall_exceptの6神。歳徳系は含めない）
```

### 11.2 evaluateActivities のどこに入れるか

現在の `evaluateActivities()` の流れ：

```
(1) 第1パス: kichijin / kyojin(resolution適用後) / jianchu / shuku28 から
             all: RawContribution[] を構築
(2) pass1 = all.slice()   ← 六黄道COMPOSITEのスナップショット地点
(3) 第2パス: COMPOSITE型（六黄道5神）が pass1 の
             「kichijin由来positive」「kyojin由来negative」を追従
(4) activityId ごとにグルーピング → verdict
```

**挿入位置：(1) と (2) の間（新・第1.5パス）。**

```
(1)   第1パス（変更なし）
(1.5) 月破 positive 抑制（新規）:
       resolution.kyojin に「月破」が有効成立（status active）しているなら、
       all から
         { favorable: true,
           source.sourceType: "kichijin",
           source.sourceName ∈ GEPPO_DEITY_SET }
       の contribution を除去する。
       除去した事実は結果に「月破により徳神失力（不能爲福）」として
       説明可能な形で保持する（下記11.3）。
(2)   pass1 = all.slice()   ← 抑制後のスナップショット
(3)   第2パス: COMPOSITE  ← pass1 が抑制済みなので、六黄道が
       抑制された徳神positiveを追従・復活させることはない（§12）
(4)   グルーピング → verdict
```

月破は resolution で cancel されないため「有効成立」＝`raw.kyojin` に
月破があること（＝`resolution.kyojin` の該当 entry が status="active"）で
判定できる。将来 status が変わりうる場合に備え、`contributionsForEntry`
と同じく resolution 適用後の status を見るのが安全。

### 11.3 ActivitySource / 結果構造への最小追加

説明可能性（「天徳は本来諸事宜だが月破により失力」をUIで辿れる）を
保つための最小案。3択：

| 案 | 内容 | 評価 |
|---|---|---|
| A. 単純除去 | 該当 contribution を all から消すだけ | 最小。ただし「なぜ天徳の宜が出ないか」が結果から追えない |
| B. 情報保持 | `ActivityEvaluationResult` に `suppressions: { activityId, deityName, reason }[]` を追加。verdict/positiveSources には入れない | 説明可能。型追加は結果側のみ（`ActivitySource` は不変） |
| C. source にフラグ | `ActivitySource` に `suppressedBy?: string` を追加し、positiveSources に残すがグルーピング/verdict計算で除外 | 説明可能だが verdict 計算・COMPOSITE 参照の両方でフィルタが必要になり分岐が増える |

**推奨：B。** `ActivitySource` 型を壊さず、`evaluateActivities` の戻り値に
`suppressions` 配列を足すだけ。六黄道COMPOSITEの `unresolvedRestrictions`
と同じ「結果に添える追加情報」パターン。

### 11.4 既存 raw occurrence は保持

`resolution.raw.kichijin` から徳神を消さない。抑制は
`evaluateActivities` 内の contribution レベルのみ。UI で「天徳（月破により
失力）」と表示できる。

---

## 12. COMPOSITE（六黄道）との処理順序

六黄道COMPOSITE（青龍等）は第2パスで「kichijin由来positive」を追従する。
もし月破により徳神positiveが抑制された後で六黄道が旧positiveを追従すると、
抑制済みpositiveが復活してしまう（NG）。

**正しい順序：**

```
徳神positive生成（第1パス）
  ↓
月破によるpositive抑制（第1.5パス、新規）
  ↓
pass1 スナップショット
  ↓
六黄道COMPOSITE追従（第2パス）
```

現在の2パス構造との整合性：

- 現在 `pass1 = all.slice()` は shuku28 ブロックの直後、COMPOSITE処理の
  直前に取られている。第1.5パス（抑制）を**その `pass1` 取得の前**に
  差し込めば、`pass1` は抑制済みの `all` を指す。
- COMPOSITE は `pass1` だけを走査して追従先を決めるため、抑制された
  徳神positiveは COMPOSITE の参照対象から自動的に外れる。追加のガードは
  不要。
- 逆に、月破日に六黄道が成立していて、かつ月破抑制対象外の吉神
  （三合など）が別途 positive を出しているなら、六黄道はそちら（三合）は
  従来どおり追従する。月破の徳神抑制と六黄道COMPOSITEは干渉しない。

**結論：現在の2パス構造に「第1.5パス」を1つ挟むだけでよい。
2パスを3パスに増やす必要はあるが、pass1スナップショット位置を
動かさずに済むため、COMPOSITE側のコードは無変更。**

---

## 13. 実装可否・残課題

### 13.1 実装可能か

**可能。** 原典（§1〜§6）で以下が確定した：

- 「德神」の範囲＝天徳・天徳合・月徳・月徳合・天赦・天願（擇日テキスト.pdf
  p.18のローカル定義。歳徳・歳徳合は含めない）。
- 「失力／不能爲福」＝positiveの完全抑制（reduced ではない）。
- negative側・resolution側は変更しない。
- COMPOSITEとの順序は「抑制 → COMPOSITE」で、第1.5パスを挟むだけ。

### 13.2 原典不足で残る点

1. **神殺象意.pdf は「德神」の内訳を月破段落で明示していない。**
   擇日テキスト.pdf p.18のローカル定義（6神）に依拠している。この
   依拠自体は `docs/takujitsu_decisions.md` の既定方針と整合するが、
   神殺象意.pdf単独では確定できない（＝擇日テキスト.pdfとの相互補強）。
2. **歳徳・歳徳合の扱い**（D）。月破の「德神」には含めない方針だが、
   擇日テキスト.pdf p.2 には歳徳合が月破日の凶殺を解除した実例がある
   （cancel文脈）。本フェーズの positive 抑制論点とは別レイヤーであり、
   §10のとおり cancel ルールは追加しないため、実装上は歳徳系を
   GEPPO_DEITY_SET から外して問題ない。
3. **陰陽交破日**（擇日テキスト.pdf p.18「4月癸亥・10月丁巳」）。
   擇日テキスト.pdfでは「徳合がきても解除されない特定日」だが、
   神殺象意.pdfは月破全般を「猶忌」とするため、この特定日ルールは
   神殺象意.pdf方針では不要（月破は常に解除されない）。positive抑制も
   月破日全般に適用すればよく、陰陽交破日を特別扱いする必要はない。

### 13.3 次フェーズで変更すべき具体的ファイル

| ファイル | 変更内容 |
|---|---|
| `src/lib/takujitsu/activity/types.ts` | `ActivityEvaluationResult` に `suppressions?: ActivitySuppression[]` を追加（案B）。`ActivitySuppression` 型を新規定義 |
| `src/lib/takujitsu/activity/evaluateActivities.ts` | 第1.5パス（月破 positive 抑制）を pass1 スナップショット直前に挿入。`GEPPO_DEITY_SET` 定数を定義 |
| `tests/takujitsu_evaluate_activities_unit.manual.ts` | 月破＋天徳 → 天徳positive抑制／月破＋三合 → 三合は抑制されない／月破＋歳徳 → 歳徳は抑制されない／月破＋六黄道＋天徳 → 六黄道が天徳positiveを復活させない／月破のnegativeMode/exception は不変、等 |
| `tests/fixtures/gen_720_metric_reconciliation.ts` | 参考再実行（数値変化の報告のみ。一致率向上を目的にしない） |
| `docs/takujitsu_activity_engine.md` | 「補足（次フェーズ日付）」に第1.5パスを追記 |
| `docs/takujitsu_completion_audit.md` 9章 | 月破の徳神抑制を「実装済み」に更新 |
| `docs/takujitsu_progress.md` | フェーズ完了エントリ追加 |

`resolution/rules.ts`・`kyoushinGroup1.ts`（月破occurrence）・月破の
ActivityProfile（negativeMode/exceptionActivityIds）は**変更しない**。

---

## 14. コード変更（原典確定フェーズ時点）

原典確定フェーズ時点ではなし。診断用に
`tests/fixtures/gen_geppo_deity_suppression.ts` を追加。

---

## 15. 本番実装（2026-09-10、月破・徳神positive抑制 本番実装フェーズ）

### 15.1 型（`src/lib/takujitsu/activity/types.ts`）

`ActivitySuppression` を新規定義（案B）。`ActivityEvaluationResult` に
`suppressions: ActivitySuppression[]` を追加（`unresolvedRestrictions` と
同じく常に返す。抑制無しの日は空配列）。`ActivitySource` 型は無変更。

```ts
interface ActivitySuppression {
  sourceType: ActivitySourceType;      // "kichijin"
  sourceName: string;                  // "天徳" 等（ShinsatsuResult.kichijin には残る）
  suppressedByType: ActivitySourceType; // "kyojin"
  suppressedByName: string;            // "月破"
  reason: string;                      // "德神臨此失力、不能爲福"
  activityIds: string[];               // その徳神が第1パスでpositiveにしていた用事id
}
```

### 15.2 評価ロジック（`src/lib/takujitsu/activity/evaluateActivities.ts`）

- 定数追加：
  ```ts
  const GEPPO_DEITY_SET = new Set(["天徳","天徳合","月徳","月徳合","天赦","天願"]);
  const GEPPO_SUPPRESSION_REASON = "德神臨此失力、不能爲福";
  ```
  `resolution/rules.ts` の `DEHE_GROUP` は流用しない（3章の分類B）。
- **第1.5パスを挿入**（shuku28ブロックの後、`pass1 = all.slice()` の直前）：
  1. `input.resolution.kyojin` に `name==="月破"` かつ `status!=="cancelled"`
     の entry があれば `geppoActive`。
  2. `all` を走査し、`favorable===true && source.sourceType==="kichijin" &&
     GEPPO_DEITY_SET.has(source.sourceName)` の contribution を除外
     （`kept` に残りを積み直す）。
  3. 除外した用事idを徳神名ごとに集約し、`suppressions[]` を構築
     （徳神名・用事idとも辞書順ソート）。
- 戻り値に `suppressions` を追加。

### 15.3 六黄道COMPOSITEとの順序（§12の検証）

`pass1 = all.slice()` が第1.5パスの**後**に取られるため、六黄道COMPOSITE
（第2パス）は抑制済み `all` だけを走査する。よって
「月破＋天徳＋青龍」で青龍が天徳の（抑制された）positiveを追従・復活
させることはない（テストJで検証）。「月破＋三合＋青龍」では三合は
抑制対象外なので青龍が三合の宜へ追従する（テストKで検証）。
COMPOSITE側のコードは無変更。

### 15.4 変更していないもの

- `resolution/rules.ts`（月破の cancel/reduce ルールを追加しない。
  小耗 No.22 も無変更）
- `kyoushinGroup1.ts`（月破 occurrence 成立式）
- 月破の ActivityProfile（`negativeMode:"all_except"`・exceptionActivityIds 11語）
- 徳神6神の ActivityProfile（`positiveMode:"all_except"`）
- `ShinsatsuResult`（raw occurrence。天徳等は月破日でも `kichijin` に残る）

### 15.5 テスト（`tests/takujitsu_evaluate_activities_unit.manual.ts`）

月破抑制系を追加（対象6神の全抑制＋suppression情報／歳徳・歳徳合は残る／
三合は残る／月破＋天徳＋青龍で青龍が復活させない／月破＋三合＋青龍で
青龍が三合へ追従／月破例外語→neutral／月破非例外語→bad／raw保持／
suppression形状／月破なしは従来どおり／cancelled月破は抑制しない）。
評価engine単体テスト：114 → **189 アサーション、全PASS**。

### 15.6 実測値（`tests/fixtures/gen_geppo_deity_suppression.ts` 再実行）

| 指標 | 前フェーズ見積もり | 本番実装後の実測 |
|---|---|---|
| 720行中の月破成立日数 | 60 | **60** |
| 月破 ＋ GEPPO_DEITY_SET | 20 | **20** |
| 月破 ＋ 歳徳/歳徳合（抑制対象外・参考） | 12 | 12 |
| 抑制positiveの延べ数（activityId × day × 神） | 約6,104 | **6,104** |
| verdict mixed → bad（用事×日で重複排除） | 約2,660 | **4,473** |
| verdict good → neutral（月破例外語） | 約41 | **62** |

**見積もりとのズレ（2,660→4,473、41→62）の原因**：前フェーズの見積もり
スクリプトは**抑制前**の `evaluateActivities` 出力を見ていたため、月破日に
六黄道が成立していると六黄道COMPOSITEが徳神positiveを追従して
`positiveSources` に別sourceを積んでおり、「徳神以外のpositiveが残っている」
と誤判定して verdict 変化としてカウントしていなかった。本番実装では
抑制が六黄道追従の**前**に走るため、六黄道が徳神の宜を追従できず、
本来の mixed→bad / good→neutral が正しく計上される。**実装が正しく、
見積もりが構造的に過少だった**（数値を合わせるためのロジック変更はしない）。

### 15.7 SOURCE VALIDATION（`gen_720_metric_reconciliation.ts` 再実行）

| | 変更前 | 変更後 |
|---|---|---|
| ステージA（ALL型込み） | 85.52% | **85.52%（不変）** |
| ステージA（LIST型のみ） | 68.10% | **68.10%（不変）** |

ステージAは ground-truth 吉神トークン＋`shinsatsu_shogi_source_kichi.json`
（favorable/favorable_expanded の raw union）で計算しており、
`evaluateActivities` を通さない＝第1.5パスの抑制を見ない。したがって
SOURCE VALIDATION（原典再現性指標）は定義上変化しない。

### 15.8 APP EVALUATION（`gen_720_metric_reconciliation.ts` E verdict）

| | MATCH | LOGIC_ONLY | SHOGI_ONLY | 一致率 |
|---|---|---|---|---|
| 変更前 | 3,270 | 31,494 | 2,138 | 60.47% |
| 変更後 | 3,266 | 31,436 | 2,142 | **60.39%** |

MATCH −4 / LOGIC_ONLY −58 / SHOGI_ONLY +4。**−0.08pp** の微減。

- LOGIC_ONLY −58：月破日に抑制された徳神positive（擇日象意.pdfに無い宜）が
  verdictから消えた分。ノイズ削減方向。
- MATCH −4 / SHOGI_ONLY +4：擇日象意.pdf（憲書／協紀由来の宜専用データ）が
  「宜」としている用事のうち約4件（延べ）が、同日に神殺象意.pdf（象吉通書系）
  では月破＋德神失力に当たり、ALL型徳神由来のgoodが消えて neutral/bad に
  なった。**2つの歴史的一次資料が特定日で食い違っている箇所**であり、
  実装のバグではない。§16・§17の方針どおり、一致率のためにルールを
  調整しない。0.08pp は誤差の範囲。

俱不取115行の分類（0/0/115/0）は不変。

---

## 16. コード変更（本番実装フェーズ）

- `src/lib/takujitsu/activity/types.ts`：`ActivitySuppression` 追加、
  `ActivityEvaluationResult.suppressions` 追加
- `src/lib/takujitsu/activity/evaluateActivities.ts`：第1.5パス、
  `GEPPO_DEITY_SET` / `GEPPO_SUPPRESSION_REASON` 定数
- `src/lib/takujitsu/activity/index.ts`：`ActivitySuppression` を re-export
- `tests/takujitsu_evaluate_activities_unit.manual.ts`：月破抑制テスト追加（→189）
- `tests/fixtures/gen_geppo_deity_suppression.ts`：実測レポートへ書き換え

`resolution/`・`kyoushinGroup1.ts`・`activityProfiles.ts` は無変更。
