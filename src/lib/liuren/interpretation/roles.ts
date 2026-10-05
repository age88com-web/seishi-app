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

import type { ComparisonPosition, InterpretationFacts, NatalYearState, StandingPathActualization } from "./types";

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
  wealth: "general";
  work: "employment" | "jobChange" | "promotion" | "transfer" | "currentWork" | "resignation" | "independence";
  exam: "general";
  house: "residence" | "moving";
  marriage: "general";
  travel: "departure";
  traveler: "return";
  lostItem: "general";
  theft: "general";
  litigation: "general";
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
}

// ---- ROLE ----

/** 抽象的な ROLE（DOMAIN 固有の名詞は持たない） */
export type SemanticRole =
  | "self"          // 主体・問う人
  | "counterparty"  // 相手
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
