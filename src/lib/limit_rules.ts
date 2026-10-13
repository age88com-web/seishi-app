// src/lib/limit_rules.ts
// 行限ルール（qizheng_limit_rules_v1_ja.json）のうち、現行アプリの既存値だけで判定できるものを判定する。
// - 「行限で星に逢う」は『張果星宗』統論限説「凡限本宮見星災福應十分，對照七分、三合四分」により、
//   現在の限宮（本宮）に出生時の星があることで判定する（対照・三合は扱わない）
// - sensitivity = "death_timing" のレコードは保持・表示しない
// - JSON の内容は加工しない（表示は modern_japanese をそのまま使う）
// - 限宿・限度主を使うルールは、大限の第2限以降（big_limit_degree.ts で限度が求まる場合）だけで判定する。
//   第1限・小限には限度が無いので成立しない
// - 通常400件の分類（CONFIRMED／PARTIAL／THEORY／AMBIGUOUS）は docs/qizheng-limit-rules-normal-audit.md
// - 原典（『張果星宗』行限各節）の用例による読み（Phase 6B）：
//   ・星の列挙（「木氣」「火羅計」等）は該当星の列挙＝いずれか一星で成立（OR）。
//     根拠：餘奴傷主論「凡日度單羅計木氣犯者」（一星ずつ）、限度宜忌「羅計犯度」「計羅犯度」（羅喉・計都は常に対衝で同じ宿に入れない）、
//     複数星の同在を求めるときは「木氣同躔」「金月同躔」のように「同躔」と明記されること
//   ・「犯度」＝その星がその度（宿）に躔ること。根拠：划度元奧經「划度者則四餘犯本主度也，如孛犯四水度」、
//     餘奴傷主論「氣躔角斗奎井木度…謂之餘奴犯主」、「土月度者即土月所躔之度者也」
//   ・「同躔」＝星同士が同じ宿に躔ること（限宿との関係ではない）。根拠：「木氣同躔」「金月同躔」「月躔金、金躔月」
// - 流年（Phase 7B）：流年神殺は lib/liunian.ts（対象年の年干・年支で既存の神殺エンジン）の値だけを使い、出生時神殺と混ぜない。
//   流年ルールは、クリックした大限・小限が対象年齢の宮のとき（annual が渡されたとき）だけ判定する。
//   原典の語：歳駕＝太歳（太歲歌「駕為太歲」。既存エンジンも歳駕＝流年の年支の宮）、歳星＝納音（「納音所屬即是歲星」、未実装）、
//   流星＝流年の星曜（神煞露「流星乃流歲之曜」、未実装）

export type LimitRuleRecord = {
  id: string;
  subject: string;
  scope: "big_limit" | "small_limit" | "both";
  sensitivity: "normal" | "death_timing";
  modern_japanese: string;
};

let normalRulesPromise: Promise<Map<string, LimitRuleRecord>> | null = null;

/** 通常（normal）の行限ルールだけを読み込む（death_timing は除外） */
export function loadNormalLimitRules(): Promise<Map<string, LimitRuleRecord>> {
  if (!normalRulesPromise) {
    normalRulesPromise = import("../../docs/qizheng-data/qizheng_limit_rules_v1_ja.json").then((m) => {
      const recs = ((m as any).default ?? m).records as LimitRuleRecord[];
      return new Map(recs.filter((r) => r.sensitivity === "normal").map((r) => [r.id, r]));
    });
  }
  return normalRulesPromise;
}

export type BodyAtBranch = { id: string; label: string; branch: string; mansion?: string };

// lr_0550（論限附餘）向明：夜生人見火金月當限，日生人見日木土火氣當限
const LR0550_NIGHT = ["mars", "venus", "moon"];
const LR0550_DAY = ["sun", "jupiter", "saturn", "mars", "ziqi"];

/**
 * lr_0550「向明」：現在の限宮（本宮）に、昼生まれなら太陽・木星・土星・火星・紫炁、
 * 夜生まれなら火星・金星・太陰のいずれかが出生時にあれば該当。該当した星を返す（なければ空）
 */
export function matchLr0550(limitBranch: string | null | undefined, isDayBirth: boolean, bodies: BodyAtBranch[]): BodyAtBranch[] {
  if (!limitBranch) return [];
  const targets = isDayBirth ? LR0550_DAY : LR0550_NIGHT;
  return bodies.filter((b) => targets.includes(b.id) && b.branch === limitBranch);
}

// ---------- 大限・小限パネル用：CONFIRMED ルールの判定 ----------
// A1通常候補56件の精査結果（docs/qizheng-limit-rules-a1-review.md）のうち CONFIRMED のものだけを登録する。
// PARTIAL / THEORY / AMBIGUOUS と death_timing は登録しない（登録外の id は判定・表示されない）。

export type LimitKind = "big" | "small";

export type LimitRuleInput = {
  type: LimitKind;
  /** クリックした大限宮・小限宮の十二支 */
  branch: string;
  isDayBirth: boolean;
  /** 出生時の十一曜とその十二支・宿（既存の星配置） */
  bodies: BodyAtBranch[];
  /** 大限の限度（第2限以降で対象年齢の大限のときだけ。既存 getBigLimitDegree の結果）。無ければ限度系ルールは成立しない */
  degree?: { limitOrder: number; mansion: string; degreeLord: string | null } | null;
  /** 命宮の十二支（「守命限」「戌上安命」の判定用） */
  mingBranch?: string;
  /** 命度宿（lib/ming_mansion.ts。命宮方式に応じた共通命度から既存の二十八宿計算で求めた値。画面の「命度（宿度）」と同じ） */
  mingMansion?: string | null;
  /** 流年（クリックした宮が対象年齢の大限・小限宮のときだけ。lib/liunian.ts の結果）。無ければ流年ルールは成立しない */
  annual?: AnnualInput | null;
};

export type AnnualInput = {
  targetYear: number;
  stem: string;          // 流年の年干
  branch: string;        // 流年の年支
  taisuiBranch: string;  // 太歳宮（＝流年の年支）
  /** 流年神殺：宮（十二支）→ 神殺名（対象年の年干・年支で既存エンジンを適用したもの。出生時神殺とは別） */
  shensha: { year_stem: Partial<Record<string, string[]>>; year_branch: Partial<Record<string, string[]>> };
};

// 原文の神殺名 → 既存エンジンの神殺名（異体字だけの違い）
const SHENSHA_ALIAS: Record<string, string> = { 黃幡: "黄旙", 黄幡: "黄旙" };
const engineName = (n: string) => SHENSHA_ALIAS[n] ?? n;
/** 流年神殺（年支系）のうち、宮 branch にある列挙名（原文表記） */
function annualShenshaAt(a: AnnualInput, branch: string, names: string[]): string[] {
  const at = a.shensha.year_branch[branch] ?? [];
  return names.filter((n) => at.includes(engineName(n)));
}

const STAR_JA: Record<string, string> = {
  sun: "太陽", moon: "太陰", jupiter: "木星", mars: "火星", saturn: "土星", venus: "金星",
  mercury: "水星", ziqi: "紫炁", yuebo: "月孛", rahu: "羅喉", ketu: "計都",
};
const ja = (ids: string[]) => ids.map((x) => STAR_JA[x] ?? x).join("・");
const bodyOf = (i: LimitRuleInput, id: string) => i.bodies.find((b) => b.id === id);
/** 限度がある（大限・第2限以降）ときだけ返す */
const degreeOf = (i: LimitRuleInput) => (i.type === "big" && i.degree && i.degree.limitOrder >= 2 && i.degree.mansion ? i.degree : null);

/**
 * 限宿が mansion で、列挙した星のいずれかが出生時にその宿に躔る（原文の「忌○○犯度」）。
 * 列挙は該当星の列挙（OR）。限宿条件と犯度条件の2条件がともに成立したときだけ返す
 */
function starsInLimitMansion(i: LimitRuleInput, mansion: string, stars: string[]): LimitMatchResult | null {
  const d = degreeOf(i);
  if (!d || d.mansion !== mansion) return null;
  const hit = stars.map((id) => bodyOf(i, id)).filter((b): b is BodyAtBranch => !!b && !!b.mansion && b.mansion === d.mansion);
  if (hit.length === 0) return null;
  return { stars: hit, basis: `限宿＝${d.mansion}宿、出生時の${ja(hit.map((b) => b.id))}が${d.mansion}宿にある` };
}

export type LimitMatchResult = { stars: BodyAtBranch[]; basis?: string };

// 行度假如（巻十六）の「○○安命以○為主」：原文に列挙された命度宿（原文どおりの宿名。宿境界はアプリの二十八宿計算）
const MING_SETS = {
  木: ["角", "斗", "奎", "井"],                               // 「角斗奎井安命以木為主」
  金: ["亢", "牛", "婁", "鬼"],                               // 「亢牛婁鬼安命以金為主」
  土: ["氐", "柳", "胃", "女"],                               // 「氐柳胃女安命以土為主」
  日火: ["房", "虚", "昴", "星", "尾", "觜", "室", "翼"],      // 「房虛昴星尾觜室翼安命皆以日火為主」（lr_0035）
  月水: ["心", "危", "畢", "張", "箕", "壁", "参", "軫"],      // 「心危畢張箕壁參軫安命、皆以月水為主」（lr_0039）
} as const;
const LORD_DEGREE_JA: Record<string, string> = { sun: "日", moon: "月", jupiter: "木", mars: "火", saturn: "土", venus: "金", mercury: "水" };
/** 命度宿が mingSet にあり、限度主（限宿の度グループ）が lords のいずれか（「行四○度」）。限度が要るので大限の第2限以降だけ */
function mingAndLimitDegree(i: LimitRuleInput, setName: keyof typeof MING_SETS, lords: string[]): LimitMatchResult | null {
  const d = degreeOf(i);
  const mm = i.mingMansion;
  if (!d || !mm || !d.degreeLord) return null;
  if (!(MING_SETS[setName] as readonly string[]).includes(mm) || !lords.includes(d.degreeLord)) return null;
  return { stars: [], basis: `命度宿＝${mm}宿（${MING_SETS[setName].join("")}に安命）、限宿＝${d.mansion}宿（四${LORD_DEGREE_JA[d.degreeLord]}度）` };
}


type ConfirmedLimitRule = {
  id: string;
  /** JSON の scope と一致させる（大限・小限への接続はこれに従う） */
  scope: "big_limit" | "small_limit" | "both";
  /** 表示順の区分：1 限宮主＋限度主／2 限度主／3 限宿／4 星配置／5 その他（データに優先順の指定はない） */
  order: 1 | 2 | 3 | 4 | 5;
  /** 限宿・限度主を使う（大限の第2限以降だけで成立） */
  needsDegree: boolean;
  /** 流年（対象年・流年干支・太歳・流年神殺）を使う（対象年齢の大限・小限だけで成立） */
  needsAnnual?: boolean;
  /** 判定に使う既存値（追跡用。画面には出さない） */
  uses: string[];
  /** 成立条件（追跡用。画面には出さない） */
  condition: string;
  /** 成立した場合は該当した星と根拠（null なら不成立） */
  match: (input: LimitRuleInput) => LimitMatchResult | null;
};

/** 行度假如：命度宿（安命の宿）と限の行く度（限度主） */
const mingDegreeRule = (id: string, setName: keyof typeof MING_SETS, lords: string[], condition: string): ConfirmedLimitRule => ({
  id, scope: "both", order: 2, needsDegree: true,
  uses: ["命度宿", "限度主（限宿の度グループ）"],
  condition,
  match: (i) => mingAndLimitDegree(i, setName, lords),
});

/** 限度宜忌：限宿が mansion で、列挙した星のいずれかがその宿にある（犯度） */
const degreeAvoid = (id: string, mansion: string, stars: string[], condition: string): ConfirmedLimitRule => ({
  id, scope: "both", order: 3, needsDegree: true,
  uses: ["限宿", "出生時の星の宿"],
  condition,
  match: (i) => starsInLimitMansion(i, mansion, stars),
});

export const CONFIRMED_LIMIT_RULES: readonly ConfirmedLimitRule[] = [
  {
    id: "lr_0550",
    scope: "both", // 原文「一行限須要向明」：行限一般（大限・小限の別なし）
    order: 4, needsDegree: false,
    uses: ["限宮の十二支", "出生時の十一曜の十二支", "昼夜"],
    condition: "限の宮に、昼生まれなら太陽・木星・土星・火星・紫炁、夜生まれなら火星・金星・太陰のいずれかが出生時にある",
    match: (i) => {
      const m = matchLr0550(i.branch, i.isDayBirth, i.bodies);
      return m.length ? { stars: m } : null; // 該当表示は従来どおり（画面側の既存文言）
    },
  },
  // ----- 限宿：限度宜忌（解救の条件「互之」「有○可解」を含むものは登録しない） -----
  degreeAvoid("lr_0155", "星", ["jupiter", "ziqi"], "限宿が星宿で、木星または紫炁が星宿にある（「星日忌木氣犯度」）"),
  degreeAvoid("lr_0163", "奎", ["venus", "ziqi"], "限宿が奎宿で、金星または紫炁が奎宿にある（「奎木忌金氣犯度」）"),
  degreeAvoid("lr_0164", "井", ["ziqi", "venus"], "限宿が井宿で、紫炁または金星が井宿にある（「井木忌氣金犯度」）"),
  degreeAvoid("lr_0165", "尾", ["rahu", "mercury"], "限宿が尾宿で、羅喉または水星が尾宿にある（「尾火忌羅水」）"),
  degreeAvoid("lr_0167", "觜", ["saturn", "ketu", "yuebo"], "限宿が觜宿で、土星・計都・月孛のいずれかが觜宿にある（「觜火忌土計孛」。同形の翼火「忌土計孛」に合わせて読む）"),
  degreeAvoid("lr_0169", "女", ["jupiter", "ziqi"], "限宿が女宿で、木星または紫炁が女宿にある（「女土忌木氣」）"),
  // 「氐土忌羅氣，水犯度倒限」は「忌羅氣／水犯度倒限」とも「忌羅氣水犯度，倒限」とも読める。本文（倒限を含む）が
  // どちらの読みでも成り立つ水星だけで判定する
  degreeAvoid("lr_0170", "氐", ["mercury"], "限宿が氐宿で、水星が氐宿にある（句読が二通りに読めるため、どちらの読みでも倒限となる水星で判定）"),
  degreeAvoid("lr_0172", "柳", ["jupiter", "ziqi"], "限宿が柳宿で、木星または紫炁が柳宿にある（「柳土忌木氣犯度」）"),
  degreeAvoid("lr_0174", "牛", ["ziqi"], "限宿が牛宿で、紫炁が牛宿にある（「牛金忌氣」）"),
  // 「軫水忌土，計犯度倒限」も同様に二通りに読めるため、どちらの読みでも倒限となる計都で判定する
  degreeAvoid("lr_0180", "軫", ["ketu"], "限宿が軫宿で、計都が軫宿にある（句読が二通りに読めるため、どちらの読みでも倒限となる計都で判定）"),
  // ----- 命度宿＋限度主：行度假如（巻十六）。命の条件は同じ「假如」段落の冒頭、または「此論四○四○度」の明記による -----
  mingDegreeRule("lr_0019", "木", ["mercury"], "命度宿が角・斗・奎・井（以木為主）で、限が四水度（箕・壁・参・軫）を行く（原文の「或逢水孛」は「逢」の範囲が不明なので判定しない）"),
  mingDegreeRule("lr_0021", "木", ["moon"], "lr_0019 と同じ段落（木を主とする命）：命度宿が角・斗・奎・井で、限が四月度（心・危・畢・張）を行く"),
  mingDegreeRule("lr_0024", "木", ["sun"], "lr_0019 と同じ段落（木を主とする命）：命度宿が角・斗・奎・井で、限が四日度（房・虚・昴・星）を行く"),
  mingDegreeRule("lr_0027", "金", ["saturn"], "命度宿が亢・牛・婁・鬼（以金為主）で、限が四土度（氐・女・胃・柳）を行く"),
  mingDegreeRule("lr_0028", "金", ["sun"], "lr_0027 と同じ段落（金を主とする命）：命度宿が亢・牛・婁・鬼で、限が四日度を行く"),
  mingDegreeRule("lr_0032", "土", ["mars", "sun"], "命度宿が氐・柳・胃・女（以土為主）で、限が四火度または四日度を行く（「行四火四日度」）"),
  mingDegreeRule("lr_0037", "日火", ["saturn"], "lr_0035（房虚昴星尾觜室翼安命、日火を主とする）の段落：命度宿がその8宿で、限が四土度を行く"),
  mingDegreeRule("lr_0038", "日火", ["venus"], "「此論四日四火度」：命度宿が房・虚・昴・星・尾・觜・室・翼で、限が四金度（亢・牛・婁・鬼）を行く"),
  mingDegreeRule("lr_0041", "月水", ["sun"], "「此論四月四水度」：命度宿が心・危・畢・張・箕・壁・参・軫で、限が四日度を行く"),
  {
    id: "lr_0699", scope: "both", order: 3, needsDegree: true,
    uses: ["命宮の十二支", "命度宿", "限宿"],
    condition: "命宮が戌で命度宿が婁、限宿が箕（「戌上婁度安命，忌行箕風」）。前半の「丑上安命，女初女一度，限行斗一…」は宿内度の数え方が要るので判定しない",
    match: (i) => {
      const d = degreeOf(i);
      if (!d || i.mingBranch !== "戌" || i.mingMansion !== "婁" || d.mansion !== "箕") return null;
      return { stars: [], basis: "命宮＝戌、命度宿＝婁宿、限宿＝箕宿" };
    },
  },
  // ----- 流年神殺：流年論・流年都天賦 -----
  {
    id: "lr_0570", scope: "both", order: 5, needsDegree: false, needsAnnual: true,
    uses: ["流年神殺（年支系：喪門・白虎）", "限宮の十二支", "命宮の十二支"],
    condition: "流年の喪門または白虎が限宮または命宮にある（「有喪門、白虎守命限，則有孝服」。前段の天官符・地官符は「干涉」の範囲と地官符の対応が不明なので判定しない）",
    match: (i) => {
      const a = i.annual;
      if (!a) return null;
      const lim = annualShenshaAt(a, i.branch, ["喪門", "白虎"]);
      if (lim.length) return { stars: [], basis: `太歳＝${a.taisuiBranch}、流年神殺＝${lim.join("・")}が限宮（${i.branch}）にある` };
      const ming = i.mingBranch ? annualShenshaAt(a, i.mingBranch, ["喪門", "白虎"]) : [];
      if (ming.length) return { stars: [], basis: `太歳＝${a.taisuiBranch}、流年神殺＝${ming.join("・")}が命宮（${i.mingBranch}）にある` };
      return null;
    },
  },
  {
    id: "lr_0588", scope: "both", order: 5, needsDegree: false, needsAnnual: true,
    uses: ["流年神殺（年支系：豹尾・黄旙）", "限宮の十二支"],
    condition: "流年の豹尾または黄幡（既存エンジンの表記は黄旙）が限宮にある（「豹尾、黃幡臨限程則纏綿有病」。他の句は所在が書かれていないか範囲が不明なので判定しない）",
    match: (i) => {
      const a = i.annual;
      if (!a) return null;
      const lim = annualShenshaAt(a, i.branch, ["豹尾", "黃幡"]);
      return lim.length ? { stars: [], basis: `太歳＝${a.taisuiBranch}、流年神殺＝${lim.join("・")}が限宮（${i.branch}）にある` } : null;
    },
  },
  // ----- 星配置（限宮） -----
  {
    id: "lr_0633", scope: "both", order: 4, needsDegree: false,
    uses: ["限宮の十二支", "出生時の星の十二支"],
    condition: "限宮に、出生時の太陽または太陰がある（「從來日月是尊星、限見無非福祿榮」。日・月それぞれが尊星）",
    match: (i) => {
      const m = ["sun", "moon"].map((id) => bodyOf(i, id)).filter((b): b is BodyAtBranch => !!b && b.branch === i.branch);
      return m.length ? { stars: m, basis: `限宮＝${i.branch}宮に、出生時の${ja(m.map((b) => b.id))}がある` } : null;
    },
  },
];

export type LimitRuleMatch = { rec: LimitRuleRecord; matched: BodyAtBranch[]; basis?: string; order: number };

const scopeAllows = (scope: ConfirmedLimitRule["scope"], type: LimitKind) =>
  scope === "both" || (type === "big" ? scope === "big_limit" : scope === "small_limit");

/**
 * クリックした大限宮・小限宮について、CONFIRMED ルールのうち成立したものを返す。
 * normalRules は loadNormalLimitRules() の結果（death_timing は含まれない）。
 * JSON 側の scope・sensitivity と登録内容が食い違う場合は出さない。
 */
export function matchConfirmedLimitRules(input: LimitRuleInput, normalRules: Map<string, LimitRuleRecord>): LimitRuleMatch[] {
  const out: LimitRuleMatch[] = [];
  for (const r of CONFIRMED_LIMIT_RULES) {
    const rec = normalRules.get(r.id);
    if (!rec || rec.sensitivity !== "normal" || rec.scope !== r.scope) continue;
    if (!scopeAllows(r.scope, input.type)) continue;
    if (r.needsDegree && !degreeOf(input)) continue; // 第1限・小限・限度不明では限度系ルールを出さない
    if (r.needsAnnual && !input.annual) continue;   // 対象年齢の大限・小限でなければ流年ルールを出さない
    const m = r.match(input);
    if (m) out.push({ rec, matched: m.stars, basis: m.basis, order: r.order });
  }
  // 表示順：1 限宮主＋限度主／2 限度主／3 限宿／4 星配置／5 その他（同区分は ID 順）
  return out.sort((a, b) => a.order - b.order || a.rec.id.localeCompare(b.rec.id));
}
