"use client";

// src/app/ziwei/FortuneStarPanel.tsx
//
// 宮クリック時の「行運の星曜象意」（docs/ziwei-basic-spec.md §29）。本命の解釈の後・力量内訳の前に置く。
// 選択中の大限・小限で、この宮が何宮に当たるか（大限上・小限上の宮名）と、この宮の星の行運星曜象意を出す。
// 文は資料の文のまま。条件付きの文は、巡る宮の力量で成立したものだけ出す（平の宮では強・弱どちらも出さない）。
// 各ブロックの最後に、この宮に付いた大限四化・小限四化の象意（§30。共通の四化象意データ。四化がなければ欄を出さない）。
// 宮が太歳宮・太歳の三合宮・対宮なら【太歳との関係】（§31。関係だけ）。
// 行運の宮（大限宮・小限宮）をクリックしたとき、S40 の喜忌が資料上成立していれば「行運の喜忌」（§33）。
// 小限ブロックに、S33 羊陀夾忌の流年（＝小限）の作用が成立したときだけ「年運上の作用」（§32）。
// 資料名・内部ID・未判定などの開発情報は表示しない（データには保持）。

import { useMemo } from "react";
import { buildFortuneContextFor, buildFortunePalaceContext, parseAppraisalDate } from "@/lib/ziwei/fortune";
import type { FortuneSelection, LimitXijiResult, LiunianEffect } from "@/lib/ziwei/fortune";
import { buildFortuneStarMeaningContext } from "@/lib/ziwei/meanings/fortune";
import type { FortunePalaceStarInterpretation, FortuneStarCondition } from "@/lib/ziwei/meanings/fortune";
import { buildFortuneTransformationContext } from "@/lib/ziwei/meanings/fortune-transformations";
import type { FortuneTransformationSection } from "@/lib/ziwei/meanings/fortune-transformations";
import type { ZiweiChart } from "@/lib/ziwei";

const short = (s: string) => s.replace(/星$/, "") || s;
const COND_LABEL: Readonly<Record<FortuneStarCondition["kind"], string>> = {
  palacePowerStrong: "宮の力量が強い",
  palacePowerWeak: "宮の力量が弱い",
  starOrPalaceWeak: "宮の力量が弱い",
};

function TransformationBlock({ t }: { t: FortuneTransformationSection }) {
  return (
    <div className="zw-fstar-hua">
      <h4 className="zw-fstar-sub">{t.origin === "major" ? "大限四化" : "小限四化"}</h4>
      {t.items.map((it) => (
        <div key={`${it.star}${it.type}`} className="zw-fstar-star">
          <div className="zw-fstar-name">
            {it.star}　<span className={`zw-fhua ${t.origin === "major" ? "zw-fhua-major" : "zw-fhua-minor"}`}>{it.label}</span>
          </div>
          <ul className="zw-mp-list">
            {[...it.coreMeanings, ...it.fortuneTexts].map((m) => (
              <li key={m} className="zw-mp-item">
                {m}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** 大限・小限1つ分の行運星曜象意（画面と解釈印刷で共用） */
export function LimitBlock({
  r,
  t,
  xiji,
  effects = [],
  natalPalace,
}: {
  r: FortunePalaceStarInterpretation;
  t: FortuneTransformationSection | null;
  xiji: LimitXijiResult | null;
  effects?: LiunianEffect[];
  natalPalace?: string | null;
}) {
  const isMajor = r.limitType === "major";
  const title = isMajor ? `【大限 ${r.ageRange[0]}〜${r.ageRange[1]}歳】` : `【小限 ${r.ageRange[0]}歳】`;
  const shown = r.meanings.map((m) => ({ m, lines: m.lines.filter((l) => l.shown) })).filter((x) => x.lines.length > 0);
  return (
    <div className={`zw-fstar-block ${isMajor ? "is-major" : "is-minor"}`}>
      <h3 className="zw-fstar-title">
        {title}
        <span className="zw-fstar-palace">
          {isMajor ? "大限宮" : "小限宮"}：{natalPalace ?? r.fortunePalace}（{r.branch}）
        </span>
      </h3>
      <div className="zw-fstar-meta">
        宮の星：{r.stars.length ? r.stars.map(short).join("・") : "なし"}　巡る宮の力量：{r.palacePower.grade}（運命指数{" "}
        {r.palacePower.index.toFixed(1)}）
      </div>
      <h4 className="zw-fstar-sub">星曜象意</h4>
      {shown.length === 0 && <div className="zw-mp-empty">該当する行運星曜象意はありません</div>}
      {shown.map(({ m, lines }) => (
        <div key={m.item.id} className="zw-fstar-star">
          <div className="zw-fstar-name">{m.label}</div>
          <ul className="zw-mp-list">
            {lines.map((l) => (
              <li key={l.id} className="zw-mp-item">
                {l.condition && <span className="zw-fstar-cond">{COND_LABEL[l.condition.kind]}</span>}
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {t && <TransformationBlock t={t} />}
      {xiji?.status === "applies" && xiji.branch === r.branch && (
        <div className="zw-fstar-hua">
          <h4 className="zw-fstar-sub">行運の喜忌</h4>
          <ul className="zw-mp-list">
            <li className="zw-mp-item">{xiji.displayText}</li>
          </ul>
        </div>
      )}
      {effects.length > 0 && (
        <div className="zw-fstar-hua">
          <h4 className="zw-fstar-sub">年運上の作用</h4>
          <ul className="zw-mp-list">
            {effects.map((e) => (
              <li key={e.rule} className="zw-mp-item">
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function FortuneStarPanel({
  chart,
  selection,
}: {
  chart: ZiweiChart;
  selection: FortuneSelection;
}) {
  const r = useMemo(() => {
    const d = parseAppraisalDate(selection.appraisalDate);
    if (!d) return null;

    // 大限・小限の実際の所在宮を、それぞれ独立して取得する。
    // 本命盤で最後にクリックした宮には依存しない。
    const fortune = buildFortuneContextFor(chart, d, selection);

    const input = {
      appraisalDate: d,
      majorStartAge: selection.majorStartAge,
      minorAge: selection.minorAge,
    };

    const majorBranch = fortune.majorLimit?.palaceBranch ?? null;
    const minorBranch = fortune.minorLimit?.palaceBranch ?? null;

    const majorCtx = majorBranch
      ? buildFortunePalaceContext(chart, input, majorBranch)
      : null;

    const minorCtx = minorBranch
      ? buildFortunePalaceContext(chart, input, minorBranch)
      : null;

    const majorMeaning = majorCtx
      ? buildFortuneStarMeaningContext(chart, majorCtx).major
      : null;

    const minorMeaning = minorCtx
      ? buildFortuneStarMeaningContext(chart, minorCtx).minor
      : null;

    return {
      major: majorMeaning,
      minor: minorMeaning,
      hua: {
        major: majorCtx
          ? buildFortuneTransformationContext(majorCtx).major
          : null,
        minor: minorCtx
          ? buildFortuneTransformationContext(minorCtx).minor
          : null,
      },
      majorXiji: fortune.majorXiji,
      minorXiji: fortune.minorXiji,
      liunianEffects: minorCtx?.liunianEffects ?? [],
      majorNatalPalace: majorCtx?.natalPalace ?? null,
      minorNatalPalace: minorCtx?.natalPalace ?? null,
    };
  }, [chart, selection]);

  if (!r) return null;

  return (
    <section className="zw-section zw-interp zw-fstar">
      <h2 className="zw-h2">行運の星曜象意</h2>

      {r.major ? (
        <LimitBlock
          r={r.major}
          t={r.hua.major}
          xiji={r.majorXiji}
          natalPalace={r.majorNatalPalace}
        />
      ) : (
        <div className="zw-mp-empty">選択中の大限はありません</div>
      )}

      {r.minor ? (
        <LimitBlock
          r={r.minor}
          t={r.hua.minor}
          xiji={r.minorXiji}
          effects={r.liunianEffects}
          natalPalace={r.minorNatalPalace}
        />
      ) : (
        <div className="zw-mp-empty">選択中の小限はありません</div>
      )}
    </section>
  );
}
