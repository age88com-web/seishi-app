// src/lib/liuren/interpretation/roles.ts
//
// 役割（Phase 3T。型の設計だけで、判定ロジックは持たない）:
//   盤上の FACT と、問う内容ごとの解釈（DOMAIN）の間に置く ROLE 層の型。
//   「この問占では、盤上のどの FACT を何の役割として読むか」を、根拠つきで表すための入れ物。
//
//   依存の向き: FACT → ROLE → DOMAIN の解釈。ROLE は FACT を書き換えない（参照するだけ）。
//   六親（官鬼・妻財など）や標識（日禄・驛馬など）は ROLE そのものではなく、ROLE を決める材料。
//     例: 官鬼は、問う内容によって官職・試験の官星・病因・訴訟の官府などと読まれ得る（固定の変換はしない）。
//   ROLE は意味上の担当だけを表し、吉凶・有利不利を持たない。1地点に複数の ROLE を付けてよい。
//   確からしさは数値にせず、direct / combined / inferred の区分で持つ。
//
//   ROLE を自動で割り当てる関数（assignRoles）はまだ実装しない（下の AssignRoles は型だけ）。

import type { Branch, HeavenlyGeneral } from "../types";
import type { ComparisonPosition, InterpretationFacts, NatalYearState, StandingPathActualization, TaiSuiState } from "./types";

// ---- CONTEXT（問う内容） ----

/** 問う内容の大分類（判断ロジックはまだない） */
export type InterpretationDomain =
  | "wealth"         // 求財
  | "work"           // 仕事・官職
  | "exam"           // 試験
  | "house"          // 家宅
  | "marriage"       // 婚姻
  | "travel"         // 自分が出行する
  | "traveler"       // 外出中の人が帰るか（行人）
  | "lostItem"       // 失物
  | "theft"          // 盗難
  | "litigation"     // 訴訟
  | "illness"        // 病
  | "pregnancy"      // 妊娠（維持）
  | "childbirth"     // 出産
  | "missingPerson"  // 失踪・尋人
  | "weather";       // 天候

/** DOMAIN ごとの小分類（同じ DOMAIN でも読み方が変わるものを分ける） */
export interface DomainSubtypes {
  /**
   * Phase 5F: seekingWealth（求財。財を得られるか）・trading（売買・取引）。debtCollection（索債・債権回収）は
   * 『指南』討債章の条件が確定できる個別規則だけを読む。lending・borrowing（貸借）・keeping（財物の保持）は
   * 専用の規則が取得資料で確定できないので未対応（判断せず不足として返す）。general は問いの種類が未指定。
   */
  wealth: "general" | "seekingWealth" | "trading" | "debtCollection" | "lending" | "borrowing" | "keeping";
  work: "employment" | "jobChange" | "promotion" | "transfer" | "currentWork" | "resignation" | "independence";
  /** 文試（civil）・武試（military）は『六壬断案２』例54 で評価が分かれる（Phase 5A） */
  exam: "general" | "civil" | "military";
  house: "residence" | "moving";
  /**
   * Phase 5D: proposal（縁談・婚姻が成立するか）・married（夫婦関係が続くか・離別に向かうか）。
   * dating（交際）・reunion（復縁）は古典の婚姻門に専用の規則がないので未対応（判断せず不足として返す）。general は問いの種類が未指定。
   */
  marriage: "general" | "proposal" | "married" | "dating" | "reunion";
  travel: "departure";
  traveler: "return";
  /**
   * Phase 5H: lostProperty（なくした物を探す。『御定六壬直指』遺失）・theft（盗難。『直指』盗賊・『大六壬指南』賊盗章・
   * 『六壬心鏡』亡盗門の占盗賊）・recovery（失物・盗品が戻るか。lossCause で遺失か盗難かを指定し、その章の規則だけで読む）。
   * 『直指』は遺失と盗賊を別の章にしているので、規則表も分ける。general は問いの種類が未指定（判断せず不足として返す）。
   */
  lostItem: "general" | "lostProperty" | "theft" | "recovery";
  /** Phase 5H では使わない（盗難は lostItem の subtype theft で読む） */
  theft: "general";
  /**
   * Phase 5G: litigation（官に訴える訴訟・裁判）・dispute（当事者間の争い）・settlement（和解・争いの収束）。
   * 古典の「訟」は官に訴える争いなので、官府・主客の輸贏の規則は litigation だけで読み、dispute は「凡占・諸占」として
   * 書かれた規則だけで読む。拘禁・出獄・刑罰の種類は占的として扱わない。general は問いの種類が未指定（判断せず不足として返す）。
   */
  litigation: "general" | "litigation" | "dispute" | "settlement";
  illness: "general";
  pregnancy: "maintain";
  childbirth: "delivery";
  missingPerson: "general";
  weather: "general";
}
export type DomainSubtype<D extends InterpretationDomain = InterpretationDomain> = DomainSubtypes[D];

/**
 * 問う人がその対象に対して望むこと（DOMAIN とは独立に持つ。同じ対象でも望みによって評価が逆転する）。
 */
export type InterpretationGoal =
  | "acquire" | "preserve" | "maintain" | "release" | "separate" | "move" | "return"
  | "recover" | "control" | "reconcile" | "discover" | "avoid";

/** 盤上で、問う人・相手などを表す起点（日干＝原告のような固定はせず、CONTEXT で指定できるようにする） */
export type BoardAnchor =
  | { kind: "dayStem" }
  | { kind: "dayBranch" }
  | { kind: "lesson"; index: 1 | 2 | 3 | 4 }
  | { kind: "position"; position: ComparisonPosition };

// ---- 人物（Phase 4M）。問占に関わる人物の入力。盤上の起点（BoardAnchor）とも ROLE とも別の概念 ----

/** 人物の識別子（同じ CONTEXT の中で人物を区別するだけ。実名は持たない） */
export type PersonContextId = string;

/**
 * 問占に関わる人物（問う人・相手など）。本命・年命は人物ごとに違う属性なので、ここに持つ。
 * 起課の FACT（LiurenChart・InterpretationFacts）には入れない。太歳（時間側の FACT）は持たない。
 * 生年月日・性別・年齢・行年・実名・ROLE は持たない。
 */
export interface InterpretationPerson {
  id: PersonContextId;
  /** 本命・年命（Phase 4L-2）。分からなければ省く */
  natalYear?: NatalYearState;
}

export interface InterpretationContext<D extends InterpretationDomain = InterpretationDomain> {
  domain: D;
  subtype?: DomainSubtype<D>;
  /** 問う人から見て、主体（self）を盤上のどこで見るか。未指定なら DOMAIN の慣例に任せる（訴訟の先訴・後訴など） */
  subjectAnchor?: BoardAnchor;
  /** 相手（counterparty）を盤上のどこで見るか */
  counterpartyAnchor?: BoardAnchor;
  /** 問う対象の説明（自由記述。判定には使わない） */
  targetLabel?: string;
  goal?: InterpretationGoal;
  /** 現在の状況の説明（自由記述。例: 現在勤務中・すでに妊娠中） */
  currentState?: string;
  /** 問占に関わる人物（Phase 4M）。ID は重複させない（validateInterpretationPersons で確かめる） */
  persons?: readonly InterpretationPerson[];
  /** 問う人（主体）にあたる人物の ID。盤上の起点 subjectAnchor とは別。ROLE を自動では付けない */
  subjectPersonId?: PersonContextId;
  /** 相手にあたる人物の ID。盤上の起点 counterpartyAnchor とは別 */
  counterpartyPersonId?: PersonContextId;
  /** 太歳（Phase 4L-1。時間側の FACT）。人物（persons）には入れない。年・暦の値はここに持たない */
  taiSui?: TaiSuiState;
  /**
   * 外出中の人物（行人）の ID（Phase 5C。行人 DOMAIN で使う）。問う人（subjectPersonId）とは別に持つ。
   * 行人の本命・年命はこの人物の natalYear から取る。
   */
  travelerPersonId?: PersonContextId;
  /**
   * 問う対象の類神（Phase 5C）。どの天将・支を類神とするかは問う人が指定する（自動では決めない）。
   * 例: 『六壬心鏡』行人門「天后神后是妻姬」なら妻を天后で見る。
   */
  targetSymbol?: TargetSymbol;
  /**
   * 問う人が、古典の婚姻占の男女（夫・妻）のどちらの側か（Phase 5D。婚姻 DOMAIN で使う）。
   * 古典は男女で類神を分ける（『御定六壬直指』婚姻「青龍為男，天后為女，日為男，支為女」）。問う人・相手の指定とは別に持ち、
   * 分からなければ省く（男女別の規則は判断せず不足として返す。類神を推測で置き換えない）。
   */
  subjectSide?: "male" | "female";
  /**
   * 病人（病気について占われる人物）の ID（Phase 5E。疾病 DOMAIN で使う）。問う人（subjectPersonId）とは別に持つ。
   * 病人の本命・年命はこの人物の natalYear からだけ取る（問う人の本命を病人の本命として自動では使わない）。
   * 問う人本人が病人なら subjectPersonId と同じ ID を入れる。
   */
  patientPersonId?: PersonContextId;
  /**
   * 財を求める人物の ID（Phase 5F。求財 DOMAIN で使う）。問う人（subjectPersonId）とは別に持つ。
   * 財を求める人の本命・年命はこの人物の natalYear からだけ取る。問う人本人が求めるなら subjectPersonId と同じ ID を入れる。
   */
  wealthSeekerPersonId?: PersonContextId;
  /**
   * 問う人が取引のどちら側か（Phase 5F。売買 DOMAIN で使う）。『御定六壬直指』附占買賣「買貨時則為貨物，賣貨時則為主顧」のように
   * 古典は買う場合と売る場合で発用の意味を分ける。分からなければ省く（推測しない。買う側・売る側で向きが分かれる読みは向きを決めない）。
   * 人物の Identity（subjectPersonId・counterpartyPersonId）とは別の属性で、古典の類神ではない。
   */
  tradeSide?: "buyer" | "seller";
  /**
   * 争いの当事者として見る人物の ID（Phase 5G。訴訟 DOMAIN で使う）。問う人（subjectPersonId）とは別に持つ。
   * 問う人本人が当事者なら subjectPersonId と同じ ID を入れる。相手方は counterpartyPersonId（古典の主客に自動では割り当てない）。
   */
  litigantPersonId?: PersonContextId;
  /**
   * 当事者（litigantPersonId）の、古典の主客を決める立場（Phase 5G）。
   *   『大六壬指南』占訟章「占訟日辰分主客（日為客，辰為主，先動為客後應為主）」、
   *   『六壬心鏡』官訟門《入式》注「先論尊卑主客，以日干為尊為客，支神為卑為主。若外人論其先後，以日干為客，乃先起之人；支辰為主，乃後對之人」。
   *   precedence（先後）: initiator＝先に動いた側（客・日）／respondent＝後で応じた側（主・辰）
   *   rank（尊卑。『心鏡』だけ）: senior＝尊（客・日）／junior＝卑（主・辰）
   * 先後と尊卑は別の原典方式として両方持てる（『指南』の規則は先後だけで読む）。両方あって客・主が食い違えば、一方を優先せず向きを決めない。
   * 分からなければ省く（主客で向きが分かれる読みは向きを決めない）。現実の原告・被告（legalPosition）から自動では決めない。
   */
  litigationStanding?: { precedence?: "initiator" | "respondent"; rank?: "senior" | "junior" };
  /** 当事者の現実の訴訟上の立場（Phase 5G）。要約に書くだけで、古典の主客（先後・尊卑）には対応させない */
  legalPosition?: "plaintiff" | "defendant";
  /**
   * なくした物・盗まれた物の所有者の ID（Phase 5H。失物 DOMAIN で使う）。問う人（subjectPersonId）とは別に持つ。
   * 古典は日干を失主（所有者）とする（『直指』盗賊「以日干為失主」）。所有者本人が問うなら subjectPersonId と同じ ID を入れる。
   * 盗人は人物として持たない（古典の玄武・盗神は盤上の類神で、実在の人物を推定しない）。
   */
  ownerPersonId?: PersonContextId;
  /**
   * 失った原因の指定（Phase 5H。recovery で使う）。misplaced＝置き忘れ・紛失（『直指』遺失の章で読む）、stolen＝盗難（盗賊の章で読む）。
   * 分からなければ省く（recovery は判断せず不足として返す。lostProperty で遺失・盗難の兆候を読む）。
   */
  lossCause?: "misplaced" | "stolen";
}

/** 類神の指定（天将か支） */
export type TargetSymbol = { kind: "general"; general: HeavenlyGeneral } | { kind: "branch"; branch: Branch };

// ---- 盤外の支（Phase 4N）。CONTEXT から得る支を、出典つきで参照する。BoardAnchor（盤上の位置）とは別の型 ----

/** 盤外の支の出典。人物の本命は personId で指定する（subjectPersonId などから自動では選ばない） */
export type ContextBranchSource =
  | { kind: "personNatalYear"; personId: PersonContextId }
  | { kind: "taiSui" };

/** 解決できた盤外の支（出典つき。生年干などは持たない） */
export interface ContextBranchResolution {
  status: "resolved";
  source: ContextBranchSource;
  branch: Branch;
}

/** 解決できなかった理由（人物がいない・本命がない・太歳がないを区別する） */
export interface ContextBranchUnresolved {
  status: "unresolved";
  source: ContextBranchSource;
  reason: "personNotFound" | "natalYearMissing" | "taiSuiMissing";
}

// ---- ROLE ----

/** 抽象的な ROLE（DOMAIN 固有の名詞は持たない。例外は婚姻の新郎側・新婦側で、講座 p62 の位置づけをそのまま持つ） */
export type SemanticRole =
  | "self"          // 主体・問う人
  | "counterparty"  // 相手
  | "groomSide"     // 婚姻の新郎側（講座 p62。問う人とは限らない）
  | "brideSide"     // 婚姻の新婦側（講座 p62。問う人とは限らない）
  | "target"        // 目的・対象
  | "resource"      // 財・禄など、得たり保ったりする資源
  | "authority"     // 官・上位者・官府
  | "document"      // 文書・書類・印綬
  | "movement"      // 移動・動き
  | "origin"        // 移動の出発点（転居の旧宅など）
  | "destination"   // 移動の行き先（転居の新宅など）
  | "environment"   // 主体・相手を取り巻く環境・条件
  | "obstacle"      // 妨げ
  | "support"       // 支え・助け
  | "process"       // 経過
  | "outcome";      // 結果

/** ROLE を付けた根拠の種類 */
export type RoleEvidenceKind =
  | "boardPosition"   // 日干・日支・四課・三伝などの位置（例: 末伝＝結果）
  | "sixRelation"     // 六親（例: 妻財）
  | "marker"          // 日禄・日徳・旬丁・驛馬
  | "heavenlyGeneral" // 天将
  | "pattern"         // PATTERN 層（PATTERN は根拠の1つで、結論ではない）
  | "context"         // 問う内容・目的・現状
  | "classicalRule";  // 古典に明記された読み方

/** 根拠の強さ（数値にしない） */
export type RoleConfidence =
  | "direct"     // 1つの FACT から直接（例: 妻財だから財の候補）
  | "combined"   // 複数の FACT と CONTEXT の組合せ（例: 妻財＋発用＋求財）
  | "inferred";  // 複数の条件から推定したもの

export interface RoleEvidence {
  kind: RoleEvidenceKind;
  /** 何を見たか（例: "sixRelation=妻財"、"position=final"） */
  detail: string;
  /** 古典の出典（ある場合。例: "講座 p62"） */
  citation?: string;
}

/** ROLE を付ける盤上の対象 */
export type RoleSource = BoardAnchor;

/** ROLE の割り当て1件（FACT は参照するだけで、書き換えない） */
export interface SemanticRoleAssignment {
  role: SemanticRole;
  source: RoleSource;
  evidence: readonly RoleEvidence[];
  confidence: RoleConfidence;
}

/**
 * 将来の割り当て API（型だけ。まだ実装しない）。
 * 戻り値の source が position のときは、StandingPathActualization（Phase 3S）の同じ position の状態と、
 * その position を端点とする internalRelations（Phase 3R）をそのまま参照できる。
 */
export type AssignRoles = (
  facts: InterpretationFacts,
  context: InterpretationContext,
  actualization: StandingPathActualization | null,
) => readonly SemanticRoleAssignment[];
