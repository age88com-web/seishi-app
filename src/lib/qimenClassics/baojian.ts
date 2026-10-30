// src/lib/qimenClassics/baojian.ts
//
// 『御定奇門寶鑑』巻一の格局3節（釋勃格飛伏・釋庚丙同刑異破・釋二吉四凶）の原典解釈データ
// （Phase 5B・2026-10-19）。
//
// 出典:
//   ・ウィキソース「奇門寶鑑御定」（簡体字の原データ。action=raw で取得。最終更新 2024-01-09）
//     https://zh.wikisource.org/zh-hant/奇門寶鑑御定
//   ・取得した文字列は docs/source/baojian/奇門寶鑑御定_巻一_格局3節_wikisource.md に加工せず保存。
//     originalSimplified / originalTraditional はそのファイルから段落ごとに転記した（手入力していない）。
//   ・ctext（https://ctext.org/wiki.pl?chapter=250961&if=gb）は自動取得を禁止しているため取得・照合していない。
//   ・Phase 5C（2026-10-23）: 影印本（故宮珍本叢刊第431冊）と照合し、各節の facsimile に影印本の読みと異同を記録
//     （baojianFacsimile.ts）。originalSimplified / originalTraditional / translationJa は電子テキストに基づくまま。
//
// 方針:
//   ・原文と現代語訳を分けて持つ。訳は直訳で、原典に無い解釈を補わない（〔　〕は文法上の補い）。
//   ・成立判定は登録しない（autoJudgement.enabled は常に false）。現行64格局の判定・排盤・検索・表示は変更しない。
//   ・剋應の本文は複製せず、剋應 ID（src/lib/qimen/kokuo/data/jikkan.json）で参照する。
//   ・現行格局とは名称だけで同一視しない。対応は ClassicAppRelation.relation で種類を明示する。

import {
  FACSIMILE_431,
  FACSIMILE_BOGEFEIFU,
  FACSIMILE_ERJI_SIXIONG,
  FACSIMILE_GENGBING_XING_PO,
} from "./baojianFacsimile";
import type { ClassicCritique, ClassicRule, ClassicSection } from "./types";

const WIKISOURCE: ClassicSection["sources"][number] = {
  label: "ウィキソース「奇門寶鑑御定」",
  url: "https://zh.wikisource.org/zh-hant/奇門寶鑑御定",
  status: "取得済み（2026-10-19）。簡体字の原データと繁體字表示（自動変換）を保存",
};
const CTEXT: ClassicSection["sources"][number] = {
  label: "中國哲學書電子化計劃（ctext）",
  url: "https://ctext.org/wiki.pl?chapter=250961&if=gb",
  status: "未照合（サイトが自動取得を禁止しているため取得していない）",
};
const VERIFICATION_FACSIMILE =
  "ウィキソースの電子テキストで原文を登録（Phase 5B）。影印本（故宮珍本叢刊第431冊）と照合済み（Phase 5C・2026-10-23）。原文は電子テキストのまま変えず、影印本の読みと異同は facsimile に記録。ctext は未照合";

const NO_AUTO_STEM = "天盤・地盤の上下関係と中宮寄宮の扱いを原典で確認するまで、成立判定を登録しない";
const NO_AUTO_MUTUAL = "原文が「相加」で上下関係を確定できないため、成立判定を登録しない";
const NO_AUTO_JIA = "甲を含む。六甲と旬首六儀（遁甲）の対応が確定するまで成立判定を登録しない";

export const BAOJIAN_SECTIONS: readonly ClassicSection[] = [
  {
    id: "baojian-1-bogefeifu",
    title: "釋勃格飛伏",
    titleSimplified: "释勃格飞伏",
    location: "巻一 釋義",
    originalSimplified: [
      "丙为勃，凡丙加庚为勃飞，亦名伏干。庚加丙为勃伏，亦名飞干。干者；庚为岁月日时干也。凡勃飞凶应在内，故曰：伏干。勃伏凶应在外，故曰：飞干。",
      "庚为格，凡庚加甲为格飞，亦名伏干。甲加庚为格伏，亦名飞干。干之义与勃同。",
      "诸书浑言勃格，与岁月日时干互相加临为飞伏，非也。尝考经注；勃者乱逆也，格者闭塞也。",
      "飞者见于上也。伏者隐于下也。甲为十干之长，庚来相制，甲不能用，如政令之闭塞也。故以庚为甲之格。甲畏于庚，以乙合庚，庚贪合而受制于丙，如制伏乱逆也。故以丙为庚之勃，若浑言岁月日时干，是以反首跌穴，亦为勃伏勃飞矣！故揭经义以明之。",
    ],
    originalTraditional: [
      "丙為勃，凡丙加庚為勃飛，亦名伏干。庚加丙為勃伏，亦名飛干。干者；庚為歲月日時干也。凡勃飛凶應在內，故曰：伏干。勃伏凶應在外，故曰：飛干。",
      "庚為格，凡庚加甲為格飛，亦名伏干。甲加庚為格伏，亦名飛干。干之義與勃同。",
      "諸書渾言勃格，與歲月日時干互相加臨為飛伏，非也。嘗考經注；勃者亂逆也，格者閉塞也。",
      "飛者見於上也。伏者隱於下也。甲為十干之長，庚來相制，甲不能用，如政令之閉塞也。故以庚為甲之格。甲畏於庚，以乙合庚，庚貪合而受制於丙，如制伏亂逆也。故以丙為庚之勃，若渾言歲月日時干，是以反首跌穴，亦為勃伏勃飛矣！故揭經義以明之。",
    ],
    translationJa: [
      "丙を「勃」とする。およそ丙が庚に加わるのを「勃飛」とし、「伏干」ともいう。庚が丙に加わるのを「勃伏」とし、「飛干」ともいう。「干」とは、庚を歳・月・日・時の干とすることである。およそ勃飛は凶の応が内にあるので「伏干」という。勃伏は凶の応が外にあるので「飛干」という。【訳注】「干者；庚為歲月日時干也」は勃（丙）の段にあるが、両版とも「庚」で、文意は確定できない。",
      "庚を「格」とする。およそ庚が甲に加わるのを「格飛」とし、「伏干」ともいう。甲が庚に加わるのを「格伏」とし、「飛干」ともいう。「干」の意味は勃と同じである。",
      "諸書は勃・格をひとまとめに言い、歳・月・日・時の干と互いに加臨するのを飛・伏とするが、誤りである。かつて経の注を調べると、勃とは乱逆であり、格とは閉塞である。",
      "飛とは上に現れることであり、伏とは下に隠れることである。甲は十干の長であるが、庚が来て制すると甲は用をなせず、政令が閉塞するようなものである。ゆえに庚を甲の格とする。甲は庚を畏れ、乙をもって庚と合わせ、庚は合を貪って丙に制せられる。乱逆を制伏するようなものである。ゆえに丙を庚の勃とする。もし歳・月・日・時の干をひとまとめに言うならば、反首（返首）・跌穴もまた勃伏・勃飛となってしまう。ゆえに経の義を掲げてこれを明らかにする。",
    ],
    textNotes: [
      {
        location: "干者；庚為歲月日時干也",
        simplified: "干者；庚为岁月日时干也",
        traditionalDisplay: "干者；庚為歲月日時干也",
        note: "勃（丙）を説く段落にあるが「庚」と書かれている。両版で同じ。誤写の可能性はあるが訂正しない。",
      },
      {
        location: "是以反首跌穴",
        simplified: "是以反首跌穴",
        traditionalDisplay: "是以反首跌穴",
        note: "「反首」は青龍返首（凡例では「龍回首」）を指すとみられるが、原文の字のまま記録する。",
      },
    ],
    sources: [WIKISOURCE, CTEXT, FACSIMILE_431],
    verification: VERIFICATION_FACSIMILE,
    facsimile: FACSIMILE_BOGEFEIFU,
  },
  {
    id: "baojian-1-gengbing-xing-po",
    title: "釋庚丙同刑異破",
    titleSimplified: "释庚丙同刑异破",
    location: "巻一 釋義",
    originalSimplified: [
      "庚加癸为刑，丙加己为刑，盗气同也。庚丁相加为破，丙壬相加为破，冲制异也。凡值此时，不利有为。诸书以庚加癸为大格，加壬为小格，加己为刑格，加三奇为奇格。尝考经中以庚丙为格勃者，以庚为甲之杀，丙为庚之杀。后制前为格，前制后为勃，所谓同干异支者也。同干异支者，以同旬干支合论也。如甲子旬，庚为甲之杀，丙为庚之杀，其干之为杀则同，而庚所加者午，午与子对冲，故曰：勃。相克又相谋，则隔塞甚矣！故注为闭塞也。相合又相制，则勃逆甚矣！故注为乱逆也。干以盗气为刑。支以前四位为刑。庚加癸为第四干。丙加巳为第四干。干同则支同，故曰：同刑也。阳干以后四支为破，阴干以前四支为破。庚加丁为后四，丁加庚为前四，是庚之干支自相同，干逢克则破，支逢冲则破，壬丙相加为克，子午寅申辰戌相加为冲，是丙之干支自相同，故曰：异破也。若以庚加壬癸为大小格，加己为刑格，则其于义不通矣！奇格者；谓奇有三格也。庚丙相加为贼格，庚丁相加为破格，庚乙相加为合格。所云格者，乃格局之格，非格对之格也。后人缘有庚为格之义，遂不考经，而以庚加三奇为奇格，误矣！或曰支何以前四位为刑也。盖以盗气为刑也。曰戊己非巳午之盗气，四季非四生之盗气，何以皆谓之刑也。盖戊己藏于巳午，四季墓于四生，各从其类盗气也。曰三刑之位何居也，孟为生刑，仲为旺刑，季为墓刑，故曰三刑也。墓刑亦名自刑，以其同类，反从四生自相盗气也。别有三刑，见六壬式中。",
    ],
    originalTraditional: [
      "庚加癸為刑，丙加己為刑，盜氣同也。庚丁相加為破，丙壬相加為破，沖制異也。凡值此時，不利有為。諸書以庚加癸為大格，加壬為小格，加己為刑格，加三奇為奇格。嘗考經中以庚丙為格勃者，以庚為甲之殺，丙為庚之殺。後制前為格，前制後為勃，所謂同干異支者也。同干異支者，以同旬干支合論也。如甲子旬，庚為甲之殺，丙為庚之殺，其干之為殺則同，而庚所加者午，午與子對沖，故曰：勃。相剋又相謀，則隔塞甚矣！故注為閉塞也。相合又相制，則勃逆甚矣！故注為亂逆也。干以盜氣為刑。支以前四位為刑。庚加癸為第四干。丙加巳為第四干。干同則支同，故曰：同刑也。陽干以後四支為破，陰乾以前四支為破。庚加丁為後四，丁加庚為前四，是庚之干支自相同，干逢克則破，支逢沖則破，壬丙相加為克，子午寅申辰戌相加為沖，是丙之干支自相同，故曰：異破也。若以庚加壬癸為大小格，加己為刑格，則其於義不通矣！奇格者；謂奇有三格也。庚丙相加為賊格，庚丁相加為破格，庚乙相加為合格。所云格者，乃格局之格，非格對之格也。後人緣有庚為格之義，遂不考經，而以庚加三奇為奇格，誤矣！或曰支何以前四位為刑也。蓋以盜氣為刑也。曰戊己非巳午之盜氣，四季非四生之盜氣，何以皆謂之刑也。蓋戊己藏於巳午，四季墓於四生，各從其類盜氣也。曰三刑之位何居也，孟為生刑，仲為旺刑，季為墓刑，故曰三刑也。墓刑亦名自刑，以其同類，反從四生自相盜氣也。別有三刑，見六壬式中。",
    ],
    translationJa: [
      "庚が癸に加わるのを刑とし、丙が己に加わるのを刑とする。盗気である点は同じである。庚と丁が相加わるのを破とし、丙と壬が相加わるのを破とする。沖・制である点が異なる。およそこの時に当たれば、事を為すに不利である。諸書は、庚が癸に加わるのを大格、壬に加わるのを小格、己に加わるのを刑格、三奇に加わるのを奇格とする。かつて経を調べると、庚・丙を格・勃とするのは、庚を甲の殺とし、丙を庚の殺とするからである。後が前を制するのを格とし、前が後を制するのを勃とする。いわゆる「同干異支」である。同干異支とは、同じ旬の干支を合わせて論じることである。たとえば甲子旬では、庚は甲の殺、丙は庚の殺であり、干が殺となる点は同じであるが、庚が加わるのは午であり、午と子は対沖する。ゆえに「勃」という。相剋し、また相謀れば、隔塞が甚だしい。ゆえに注は閉塞とする。相合し、また相制すれば、勃逆が甚だしい。ゆえに注は乱逆とする。干は盗気をもって刑とし、支は前四位をもって刑とする。庚が癸に加わるのは第四干である。丙が巳に加わるのは第四干である。干が同じなら支も同じである。ゆえに「同刑」という。陽干は後四支をもって破とし、陰干は前四支をもって破とする。庚が丁に加わるのは後四、丁が庚に加わるのは前四であり、これは庚の干支が自ずから相同じものである。干は剋に逢えば破れ、支は沖に逢えば破れる。壬と丙が相加わるのは剋であり、子午・寅申・辰戌が相加わるのは沖である。これは丙の干支が自ずから相同じものである。ゆえに「異破」という。もし庚が壬・癸に加わるのを大格・小格とし、己に加わるのを刑格とするならば、その義は通らない。奇格とは、奇に三つの格があることをいう。庚と丙が相加わるのを賊格、庚と丁が相加わるのを破格、庚と乙が相加わるのを合格とする。ここでいう格は格局の格であって、格対の格ではない。後人は庚を格とする義があることによって経を考えず、庚が三奇に加わるのを奇格としたが、誤りである。ある人が問う、支はなぜ前四位を刑とするのか。思うに盗気を刑とするのである。〔また〕問う、戊己は巳午の盗気ではなく、四季は四生の盗気ではないのに、なぜいずれも刑というのか。思うに戊己は巳午に蔵し、四季は四生に墓するので、それぞれその類に従って盗気となるのである。〔また〕問う、三刑の位はどこにあるのか。孟を生刑、仲を旺刑、季を墓刑とする。ゆえに三刑という。墓刑は自刑ともいう。その同類が、かえって四生から自ら相盗気するからである。別に三刑があり、六壬式の中に見える。【訳注】「丙加巳為第四干」の「巳」は、前文の「丙加己」と第四干の数え方（丙→丁→戊→己）から「己」の誤写の可能性があるが、原文のまま訳した。",
    ],
    textNotes: [
      {
        location: "丙加巳為第四干",
        simplified: "丙加巳为第四干",
        traditionalDisplay: "丙加巳為第四干",
        note: "前文は「丙加己為刑」。丙から数えて第四干は己（丙・丁・戊・己）であり、「巳」は「己」の誤写の可能性がある。両版で同じ。訂正しない。",
      },
      {
        location: "陰乾以前四支為破",
        simplified: "阴干以前四支为破",
        traditionalDisplay: "陰乾以前四支為破",
        note: "繁體字表示の自動変換誤り（「干」→「乾」）。原データ（簡体字）は「阴干」。本データの繁體字原文は取得したまま保存する。",
      },
      {
        location: "干逢克則破",
        simplified: "干逢克则破",
        traditionalDisplay: "干逢克則破",
        note: "同じ節の他の箇所は「相剋」（簡体字では「相克」）。表記の揺れとして記録する。",
      },
    ],
    sources: [WIKISOURCE, CTEXT, FACSIMILE_431],
    verification: VERIFICATION_FACSIMILE,
    facsimile: FACSIMILE_GENGBING_XING_PO,
  },
  {
    id: "baojian-1-erji-sixiong",
    title: "釋二吉四凶",
    titleSimplified: "释二吉四凶",
    location: "巻一 釋義",
    originalSimplified: [
      "丁甲相加，为阴阳化气。丁乙相加，为龙凤呈祥。凡值此二格，利为百事。甲乙相加，为二龙战野，庚辛相加，为二虎争雄，甲戊相加，为青龙困顿，庚壬相加，为白虎迍邅。凡值此四格，百事不利。",
      "化气呈祥二格，一切谋为俱吉。不必合奇门亦吉，故曰：二吉。龙战困顿下诸格，若得太阴合奇门盖之，避其方，乘奇门而出犹可谋为。",
    ],
    originalTraditional: [
      "丁甲相加，為陰陽化氣。丁乙相加，為龍鳳呈祥。凡值此二格，利為百事。甲乙相加，為二龍戰野，庚辛相加，為二虎爭雄，甲戊相加，為青龍困頓，庚壬相加，為白虎迍邅。凡值此四格，百事不利。",
      "化氣呈祥二格，一切謀為俱吉。不必合奇門亦吉，故曰：二吉。龍戰困頓下諸格，若得太陰合奇門蓋之，避其方，乘奇門而出猶可謀為。",
    ],
    translationJa: [
      "丁と甲が相加わるのを陰陽化気とする。丁と乙が相加わるのを龍鳳呈祥とする。およそこの二格に当たれば、百事を為すに利がある。甲と乙が相加わるのを二龍戦野、庚と辛が相加わるのを二虎争雄、甲と戊が相加わるのを青龍困頓、庚と壬が相加わるのを白虎迍邅とする。およそこの四格に当たれば、百事に不利である。",
      "化気・呈祥の二格は、一切の謀為がいずれも吉である。必ずしも奇門に合わなくても吉である。ゆえに「二吉」という。龍戦・困頓以下の諸格は、もし太陰を得て奇門に合い、これを覆うならば、その方を避け、奇門に乗じて出れば、なお謀為することができる。",
    ],
    textNotes: [],
    sources: [WIKISOURCE, CTEXT, FACSIMILE_431],
    verification: VERIFICATION_FACSIMILE,
    facsimile: FACSIMILE_ERJI_SIXIONG,
  },
];

const S1 = "baojian-1-bogefeifu";
const S2 = "baojian-1-gengbing-xing-po";
const S3 = "baojian-1-erji-sixiong";

const XING_PO_CAUTION = { original: "凡值此時，不利有為。", ja: "およそこの時に当たれば、事を為すに不利である。" };
const SIXIONG_CAUTION = {
  original: "龍戰困頓下諸格，若得太陰合奇門蓋之，避其方，乘奇門而出猶可謀為。",
  ja: "龍戦・困頓以下の諸格は、もし太陰を得て奇門に合い、これを覆うならば、その方を避け、奇門に乗じて出れば、なお謀為することができる。",
};

export const BAOJIAN_RULES: readonly ClassicRule[] = [
  // ---- 釋勃格飛伏 ----
  {
    id: "baojian-bofei",
    sectionId: S1,
    name: "勃飛",
    aliases: ["伏干"],
    category: "勃（丙）",
    combination: { order: "上加下", first: "丙", second: "庚" },
    originalPhrase: "凡丙加庚為勃飛，亦名伏干。",
    fortune: "凶",
    fortunePhrase: "凡勃飛凶應在內，故曰：伏干。",
    cautions: [{ original: "凡勃飛凶應在內", ja: "勃飛は凶の応が内にある" }],
    appRelations: [
      { kind: "現行格局", target: "熒入太白", relation: "同じ干の組み合わせ（上下も一致）", note: "現行は天盤丙×地盤庚。原典の当節は天盤・地盤の語を用いない。" },
      { kind: "現行格局", target: "伏干格", relation: "名称のみ共通（定義が異なる）", note: "現行の伏干格は天盤庚×地盤の日干。原典の「伏干」は丙加庚の別名。" },
      { kind: "剋應", target: "jikkan-丙-庚", relation: "同じ干の組み合わせ（上下も一致）", note: "十干剋應「熒入太白」。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_STEM },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-bofu",
    sectionId: S1,
    name: "勃伏",
    aliases: ["飛干"],
    category: "勃（丙）",
    combination: { order: "上加下", first: "庚", second: "丙" },
    originalPhrase: "庚加丙為勃伏，亦名飛干。",
    fortune: "凶",
    fortunePhrase: "勃伏凶應在外，故曰：飛干。",
    cautions: [{ original: "勃伏凶應在外", ja: "勃伏は凶の応が外にある" }],
    appRelations: [
      { kind: "現行格局", target: "太白入熒", relation: "同じ干の組み合わせ（上下も一致）", note: "現行は天盤庚×地盤丙。" },
      { kind: "現行格局", target: "飛干格", relation: "名称のみ共通（定義が異なる）", note: "現行の飛干格は天盤の日干×地盤庚。原典の「飛干」は庚加丙の別名。" },
      { kind: "現行格局", target: "飛悖格", relation: "名称のみ共通（定義が異なる）", note: "現行の飛悖格は値符の九星の宮の地盤丙（Phase 3L）。名称の「悖／勃」だけで同一視しない。" },
      { kind: "剋應", target: "jikkan-庚-丙", relation: "同じ干の組み合わせ（上下も一致）", note: "十干剋應「太白入熒」。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_STEM },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-gefei",
    sectionId: S1,
    name: "格飛",
    aliases: ["伏干"],
    category: "格（庚）",
    combination: { order: "上加下", first: "庚", second: "甲" },
    originalPhrase: "凡庚加甲為格飛，亦名伏干。",
    fortune: "記載なし",
    fortunePhrase: null,
    cautions: [{ original: "干之義與勃同。", ja: "「干」の意味は勃と同じである。" }],
    appRelations: [
      { kind: "現行格局", target: "伏宮格天乙格", relation: "甲を旬首六儀とみなせば構造が近い（未確定）", note: "現行の伏宮格は天盤庚×地盤の旬首六儀（Phase 3J-2）。甲と旬首六儀の対応は原典で未確定。" },
      { kind: "剋應", target: "jikkan-庚-戊", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「天乙伏宮」。剋應は甲を常に戊として扱う。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_JIA },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-gefu",
    sectionId: S1,
    name: "格伏",
    aliases: ["飛干"],
    category: "格（庚）",
    combination: { order: "上加下", first: "甲", second: "庚" },
    originalPhrase: "甲加庚為格伏，亦名飛干。",
    fortune: "記載なし",
    fortunePhrase: null,
    cautions: [{ original: "干之義與勃同。", ja: "「干」の意味は勃と同じである。" }],
    appRelations: [
      { kind: "現行格局", target: "飛宮格天乙太白", relation: "甲を旬首六儀とみなせば構造が近い（未確定）", note: "現行の飛宮格は天盤の旬首六儀×地盤庚（Phase 3J-2）。甲と旬首六儀の対応は原典で未確定。" },
      { kind: "剋應", target: "jikkan-戊-庚", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「値符飛宮」。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_JIA },
    status: VERIFICATION_FACSIMILE,
  },

  // ---- 釋庚丙同刑異破 ----
  {
    id: "baojian-xing-geng-gui",
    sectionId: S2,
    name: "刑（庚加癸）",
    aliases: [],
    category: "刑",
    combination: { order: "上加下", first: "庚", second: "癸" },
    originalPhrase: "庚加癸為刑",
    fortune: "不利",
    fortunePhrase: "凡值此時，不利有為。",
    cautions: [XING_PO_CAUTION],
    appRelations: [
      { kind: "現行格局", target: "大格", relation: "同じ干の組み合わせ（上下も一致）", note: "現行の大格は天盤庚×地盤癸（Phase 3J-2）。原典は「庚加癸を大格とする」諸書の説を義が通らないと批判している。" },
      { kind: "剋應", target: "jikkan-庚-癸", relation: "同じ干の組み合わせ（上下も一致）", note: "十干剋應「太白沖刑」（注に大格）。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_STEM },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-xing-bing-ji",
    sectionId: S2,
    name: "刑（丙加己）",
    aliases: [],
    category: "刑",
    combination: { order: "上加下", first: "丙", second: "己" },
    originalPhrase: "丙加己為刑",
    fortune: "不利",
    fortunePhrase: "凡值此時，不利有為。",
    cautions: [XING_PO_CAUTION],
    appRelations: [
      { kind: "剋應", target: "jikkan-丙-己", relation: "同じ干の組み合わせ（上下も一致）", note: "十干剋應「火悖入刑」。現行格局に同じ組み合わせの格は無い（刑格は天盤庚×地盤己で別）。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_STEM },
    status: `${VERIFICATION_FACSIMILE}。後文の「丙加巳為第四干」は「巳」の字に疑義あり（textNotes）。影印本も己・巳の字形を書き分けず未解消`,
  },
  {
    id: "baojian-po-geng-ding",
    sectionId: S2,
    name: "破（庚丁相加）",
    aliases: ["破格"],
    category: "破",
    combination: { order: "相加（上下未確定）", first: "庚", second: "丁" },
    originalPhrase: "庚丁相加為破",
    fortune: "不利",
    fortunePhrase: "凡值此時，不利有為。",
    cautions: [XING_PO_CAUTION],
    appRelations: [
      { kind: "現行格局", target: "奇格", relation: "一部が同じ干の組み合わせ", note: "現行の奇格は天盤庚×地盤乙・丙・丁。原典は「庚丁相加為破格」とし、奇格の定義を批判している。" },
      { kind: "剋應", target: "jikkan-庚-丁", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「太白受刑」。" },
      { kind: "剋應", target: "jikkan-丁-庚", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「玉女刑殺」。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_MUTUAL },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-po-bing-ren",
    sectionId: S2,
    name: "破（丙壬相加）",
    aliases: [],
    category: "破",
    combination: { order: "相加（上下未確定）", first: "丙", second: "壬" },
    originalPhrase: "丙壬相加為破",
    fortune: "不利",
    fortunePhrase: "凡值此時，不利有為。",
    cautions: [XING_PO_CAUTION],
    appRelations: [
      { kind: "剋應", target: "jikkan-丙-壬", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「火入天羅」。" },
      { kind: "剋應", target: "jikkan-壬-丙", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「水蛇入火」。現行格局に同じ組み合わせの格は無い。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_MUTUAL },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-zeige",
    sectionId: S2,
    name: "賊格",
    aliases: [],
    category: "奇の三格",
    combination: { order: "相加（上下未確定）", first: "庚", second: "丙" },
    originalPhrase: "庚丙相加為賊格",
    fortune: "記載なし",
    fortunePhrase: null,
    cautions: [{ original: "所云格者，乃格局之格，非格對之格也。", ja: "ここでいう格は格局の格であって、格対の格ではない。" }],
    appRelations: [
      { kind: "現行格局", target: "太白入熒", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "現行は天盤庚×地盤丙。" },
      { kind: "現行格局", target: "熒入太白", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "現行は天盤丙×地盤庚。" },
      { kind: "現行格局", target: "奇格", relation: "一部が同じ干の組み合わせ", note: "現行の奇格の地盤丙の分岐。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_MUTUAL },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-hege",
    sectionId: S2,
    name: "合格",
    aliases: [],
    category: "奇の三格",
    combination: { order: "相加（上下未確定）", first: "庚", second: "乙" },
    originalPhrase: "庚乙相加為合格",
    fortune: "記載なし",
    fortunePhrase: null,
    cautions: [{ original: "所云格者，乃格局之格，非格對之格也。", ja: "ここでいう格は格局の格であって、格対の格ではない。" }],
    appRelations: [
      { kind: "現行格局", target: "奇格", relation: "一部が同じ干の組み合わせ", note: "現行の奇格の地盤乙の分岐。" },
      { kind: "剋應", target: "jikkan-庚-乙", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「太白逢星」。" },
      { kind: "剋應", target: "jikkan-乙-庚", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「日奇被刑」。" },
    ],
    autoJudgement: { enabled: false, reason: NO_AUTO_MUTUAL },
    status: VERIFICATION_FACSIMILE,
  },

  // ---- 釋二吉四凶 ----
  {
    id: "baojian-yinyang-huaqi",
    sectionId: S3,
    name: "陰陽化氣",
    aliases: [],
    category: "二吉",
    combination: { order: "相加（上下未確定）", first: "丁", second: "甲" },
    originalPhrase: "丁甲相加，為陰陽化氣。",
    fortune: "吉",
    fortunePhrase: "凡值此二格，利為百事。",
    cautions: [{ original: "化氣呈祥二格，一切謀為俱吉。不必合奇門亦吉，故曰：二吉。", ja: "化気・呈祥の二格は、一切の謀為がいずれも吉である。必ずしも奇門に合わなくても吉である。ゆえに「二吉」という。" }],
    appRelations: [
      { kind: "剋應", target: "jikkan-丁-戊", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「青龍転光」。" },
      { kind: "剋應", target: "jikkan-戊-丁", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「青龍耀明」。現行格局に対応する格は無い。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_JIA}。${NO_AUTO_MUTUAL}` },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-longfeng-chengxiang",
    sectionId: S3,
    name: "龍鳳呈祥",
    aliases: [],
    category: "二吉",
    combination: { order: "相加（上下未確定）", first: "丁", second: "乙" },
    originalPhrase: "丁乙相加，為龍鳳呈祥。",
    fortune: "吉",
    fortunePhrase: "凡值此二格，利為百事。",
    cautions: [{ original: "化氣呈祥二格，一切謀為俱吉。不必合奇門亦吉，故曰：二吉。", ja: "化気・呈祥の二格は、一切の謀為がいずれも吉である。必ずしも奇門に合わなくても吉である。ゆえに「二吉」という。" }],
    appRelations: [
      { kind: "剋應", target: "jikkan-丁-乙", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「玉女奇生」。" },
      { kind: "剋應", target: "jikkan-乙-丁", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「奇儀相佐」。現行格局に同じ組み合わせの格は無い。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_MUTUAL}。${NO_AUTO_STEM}` },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-erlong-zhanye",
    sectionId: S3,
    name: "二龍戰野",
    aliases: [],
    category: "四凶",
    combination: { order: "相加（上下未確定）", first: "甲", second: "乙" },
    originalPhrase: "甲乙相加，為二龍戰野",
    fortune: "凶",
    fortunePhrase: "凡值此四格，百事不利。",
    cautions: [SIXIONG_CAUTION],
    appRelations: [
      { kind: "剋應", target: "jikkan-戊-乙", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「青龍和會」。" },
      { kind: "剋應", target: "jikkan-乙-戊", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「陰害陽門」。現行格局に対応する格は無い。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_JIA}。${NO_AUTO_MUTUAL}` },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-erhu-zhengxiong",
    sectionId: S3,
    name: "二虎爭雄",
    aliases: [],
    category: "四凶",
    combination: { order: "相加（上下未確定）", first: "庚", second: "辛" },
    originalPhrase: "庚辛相加，為二虎爭雄",
    fortune: "凶",
    fortunePhrase: "凡值此四格，百事不利。",
    cautions: [SIXIONG_CAUTION],
    appRelations: [
      { kind: "剋應", target: "jikkan-庚-辛", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「太白重鋒」。" },
      { kind: "剋應", target: "jikkan-辛-庚", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「白虎出力」。現行格局に同じ組み合わせの格は無い。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_MUTUAL}。${NO_AUTO_STEM}` },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-qinglong-kundun",
    sectionId: S3,
    name: "青龍困頓",
    aliases: [],
    category: "四凶",
    combination: { order: "相加（上下未確定）", first: "甲", second: "戊" },
    originalPhrase: "甲戊相加，為青龍困頓",
    fortune: "凶",
    fortunePhrase: "凡值此四格，百事不利。",
    cautions: [SIXIONG_CAUTION],
    appRelations: [
      { kind: "剋應", target: "jikkan-戊-戊", relation: "甲を戊とみなした場合の組み合わせ（剋應の正規化）", note: "十干剋應「青龍伏吟」。甲を戊とみなすと戊戊になるため、甲と戊を区別する原典の組み合わせとは一致しない可能性がある。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_JIA}。${NO_AUTO_MUTUAL}` },
    status: VERIFICATION_FACSIMILE,
  },
  {
    id: "baojian-baihu-zhunzhan",
    sectionId: S3,
    name: "白虎迍邅",
    aliases: [],
    category: "四凶",
    combination: { order: "相加（上下未確定）", first: "庚", second: "壬" },
    originalPhrase: "庚壬相加，為白虎迍邅。",
    fortune: "凶",
    fortunePhrase: "凡值此四格，百事不利。",
    cautions: [SIXIONG_CAUTION],
    appRelations: [
      { kind: "現行格局", target: "上格", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "現行の上格は天盤庚×地盤壬（1080.pdf では小格）。原典は「庚加壬を小格とする」諸書の説を批判している。" },
      { kind: "剋應", target: "jikkan-庚-壬", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「太白退位」（注に上格）。" },
      { kind: "剋應", target: "jikkan-壬-庚", relation: "同じ干の組み合わせ（原典の上下が未確定）", note: "十干剋應「太白擒蛇」。" },
    ],
    autoJudgement: { enabled: false, reason: `${NO_AUTO_MUTUAL}。${NO_AUTO_STEM}` },
    status: VERIFICATION_FACSIMILE,
  },
];

export const BAOJIAN_CRITIQUES: readonly ClassicCritique[] = [
  {
    id: "baojian-critique-bofeifu",
    sectionId: S1,
    criticizedView: "勃・格をひとまとめにし、歳・月・日・時の干と互いに加臨するものを飛・伏とする説",
    originalPhrase: "諸書渾言勃格，與歲月日時干互相加臨為飛伏，非也。……若渾言歲月日時干，是以反首跌穴，亦為勃伏勃飛矣！",
    ja: "諸書は勃・格をひとまとめに言い、歳・月・日・時の干と互いに加臨するのを飛・伏とするが、誤りである。……もし歳・月・日・時の干をひとまとめに言うならば、反首（返首）・跌穴もまた勃伏・勃飛となってしまう。",
    affectedAppKaku: ["歳格", "月格", "日格", "時格", "伏干格", "飛干格", "年悖格", "月悖格", "日悖格", "時悖格"],
  },
  {
    id: "baojian-critique-dage",
    sectionId: S2,
    criticizedView: "庚加癸を大格、庚加壬を小格、庚加己を刑格とする説",
    originalPhrase: "諸書以庚加癸為大格，加壬為小格，加己為刑格……若以庚加壬癸為大小格，加己為刑格，則其於義不通矣！",
    ja: "諸書は庚が癸に加わるのを大格、壬に加わるのを小格、己に加わるのを刑格とする。……もし庚が壬・癸に加わるのを大格・小格とし、己に加わるのを刑格とするならば、その義は通らない。",
    affectedAppKaku: ["大格", "上格", "刑格"],
  },
  {
    id: "baojian-critique-qige",
    sectionId: S2,
    criticizedView: "庚が三奇に加わるのを奇格とする説",
    originalPhrase: "後人緣有庚為格之義，遂不考經，而以庚加三奇為奇格，誤矣！",
    ja: "後人は庚を格とする義があることによって経を考えず、庚が三奇に加わるのを奇格としたが、誤りである。",
    affectedAppKaku: ["奇格"],
  },
];
