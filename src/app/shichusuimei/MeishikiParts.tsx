// src/app/shichusuimei/MeishikiParts.tsx
//
// 命式（四柱・蔵干・通変・神煞）と大運（通変・蔵干・神煞・命式との干支関係）の表示部品。通常画面と「命式を印刷」で同じものを使う。
// 計算はしない（calculateShichusuimei() の結果を並べるだけ）。

import { findSolarTermCrossing } from "@/lib/calendar";
import type { LuckRelation, PillarKey, ShichusuimeiResult, ShinsatsuHit } from "@/lib/shichusuimei";

const PILLAR_KEYS: readonly PillarKey[] = ["時", "日", "月", "年"];

export function hitName(h: ShinsatsuHit): string {
  return `${h.name}${h.subType ? `（${h.subType}）` : ""}`;
}

/** 柱ごとの神煞（同じ神煞が干・支の両方にあっても名前は1つにまとめる） */
export function pillarShinsatsu(r: ShichusuimeiResult, k: PillarKey): string[] {
  const names = r.shinsatsu
    .filter((h) => h.position.kind === "pillar" && h.position.pillar === k)
    .map(hitName);
  return [...new Set(names)];
}

export const LUCK_REL_SHORT: Record<LuckRelation["type"], string> = {
  干合: "合", 冲剋: "冲剋",
  支合: "六合", 冲: "冲", 三合: "三合", 三会: "三会", 半合: "半合", 半会: "半会", 二刑: "刑", 三刑: "三刑", 自刑: "自刑",
};

/** 大運と命式の関係の短い表記（例: 月干合・日支冲・月日支三合）。命式のどの柱との関係かを必ず付ける */
export function luckRelationLabel(x: LuckRelation): string {
  const order: readonly PillarKey[] = ["年", "月", "日", "時"];
  const natal = [...x.natal].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("");
  return `${natal}${x.part}${LUCK_REL_SHORT[x.type]}`;
}

export function luckRelationTitle(x: LuckRelation): string {
  const el = x.tableElement ? `（${x.tableElement}）` : "";
  const sankei = x.type === "三刑" ? (x.complete ? "（3支そろう）" : "（2支のみ）") : "";
  return `${x.type}${el}${sankei}`;
}

/** 干・支ごとの関係（同じ表記は1つにまとめる。複数の関係はすべて並べる） */
export function luckRelationItems(relations: LuckRelation[], part: "干" | "支"): LuckRelation[] {
  const seen = new Set<string>();
  return relations.filter((x) => {
    if (x.part !== part) return false;
    const key = luckRelationLabel(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 立春（太陽黄経315°）の瞬間。その年の3月1日より前で最も近い通過を共通暦エンジンで求める */
function risshunOf(year: number): Date {
  return findSolarTermCrossing(new Date(Date.UTC(year, 2, 1)), 315);
}

/**
 * 現在の数え年（D23。現在大運の判定用）。年の切替は立春:
 * 今年の立春以降は 現在年−出生年+1、立春より前は前年扱いで 現在年−出生年。
 */
export function currentKazoeAge(r: ShichusuimeiResult, today: Date = new Date()): number {
  const year = today.getFullYear();
  const y = today.getTime() < risshunOf(year).getTime() ? year - 1 : year;
  return y - r.meishiki.birthStandardDate.year + 1;
}

/**
 * 現在入っている大運の index（既存の大運期間 ageFrom〜ageTo に現在の数え年が入るもの）。
 * 大運の範囲外（出生前・最後の大運より後）は null。大運の計算はしない。
 */
export function currentDaiunIndex(r: ShichusuimeiResult, today: Date = new Date()): number | null {
  const age = currentKazoeAge(r, today);
  return r.daiun.periods.find((p) => p.ageFrom <= age && age <= p.ageTo)?.index ?? null;
}

function LuckRelations({ relations }: { relations: LuckRelation[] }) {
  const line = (part: "干" | "支") => {
    const items = luckRelationItems(relations, part);
    return (
      <div className="sc-luck-rel-line">
        <span className="sc-muted">{part}：</span>
        {items.length === 0 ? (
          <span className="sc-muted">—</span>
        ) : (
          items.map((x) => (
            <span key={luckRelationLabel(x)} className="sc-luck-rel-item" title={luckRelationTitle(x)}>
              {luckRelationLabel(x)}
            </span>
          ))
        )}
      </div>
    );
  };
  return (
    <div className="sc-luck-rel">
      {line("干")}
      {line("支")}
    </div>
  );
}

function ShinsatsuTags({ names }: { names: string[] }) {
  if (names.length === 0) return <div className="sc-tags sc-muted">—</div>;
  return (
    <div className="sc-tags">
      {names.map((n) => (
        <span key={n} className="sc-tag">{n}</span>
      ))}
    </div>
  );
}

/** 命式：四柱（通変・天干・地支・蔵干と通変・神煞） */
export function PillarsView({ r }: { r: ShichusuimeiResult }) {
  return (
    <section className="sc-section">
      <h2 className="sc-h2">命式</h2>
      <div className="sc-pillars">
        {PILLAR_KEYS.map((k) => {
          const p = r.meishiki.pillars[k];
          const d = r.details[k];
          return (
            <div key={k} className="sc-pillar">
              <div className="sc-pillar-label">{k}柱</div>
              <div className="sc-tsuhen">{d ? (d.isDayMaster ? "日主" : d.stemTsuhen) : " "}</div>
              <div className="sc-char">{p ? p.stem : "—"}</div>
              <div className="sc-char">{p ? p.branch : "—"}</div>
              <div className="sc-zokan">
                {d
                  ? d.zokan.map((z) => (
                      <div key={z.stem}>
                        {z.stem}<span className="sc-muted"> {z.tsuhen}</span>
                      </div>
                    ))
                  : null}
              </div>
              {p ? <ShinsatsuTags names={pillarShinsatsu(r, k)} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 大運（干支・年齢・天干通変星・蔵干と通変星・神煞・命式との干支関係） */
export function DaiunView({ r }: { r: ShichusuimeiResult }) {
  const current = currentDaiunIndex(r);
  return (
    <section className="sc-section">
      <h2 className="sc-h2">
        大運<span className="sc-h2-sub">立運{r.daiun.startAge}歳</span>
        {current !== null && <span className="sc-h2-sub">現在 数え年{currentKazoeAge(r)}歳（色付き＝現在の大運）</span>}
      </h2>
      <div className="sc-daiun">
        {r.daiun.periods.map((p) => {
          const d = r.daiunDetails[p.index];
          return (
            <div key={p.index} className={`sc-pillar sc-luck${p.index === current ? " sc-luck-current" : ""}`}>
              <div className="sc-char">{p.pillar.stem}</div>
              <div className="sc-char">{p.pillar.branch}</div>
              <div className="sc-age">{p.ageFrom}〜{p.ageTo}歳</div>
              <div className="sc-tsuhen sc-luck-tsuhen">{d.stemTsuhen}</div>
              <div className="sc-zokan">
                {d.zokan.map((z) => (
                  <div key={z.stem}>
                    {z.stem}<span className="sc-muted"> {z.tsuhen}</span>
                  </div>
                ))}
              </div>
              <ShinsatsuTags names={[...new Set(d.shinsatsu.map(hitName))]} />
              <LuckRelations relations={d.relations} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
