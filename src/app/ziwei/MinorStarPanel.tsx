"use client";

// src/app/ziwei/MinorStarPanel.tsx
//
// 宮をクリックしたときの「諸星の基本象意」。その宮にある新規諸星（既存34星以外。§37）の
// 五行・陰陽と短い基本象意を出す。文は紫微諸星.pdf の一覧表から意味だけを取り出した独自文（原文・資料名は出さない）。
// 資料解釈（InterpretationPanel）・力量・格局とは別の欄で、運命指数・格局判定には使わない。

import type { Branch } from "@/lib/ziwei";
import { MINOR_STAR_MEANING_BY_ID } from "@/lib/ziwei/minorStars";
import type { MinorStarPlacement, StarFamily } from "@/lib/ziwei/minorStars";

const FAMILY_LABEL: Partial<Record<StarFamily, string>> = {
  birth_hour: "時系",
  birth_month: "月系",
  birth_day: "日系",
  year_stem: "年干系",
  year_branch: "年支系",
  ming_shen: "命宮基準",
  other: "空亡",
  boshi: "博士十二神",
  changsheng: "長生十二星",
};

export default function MinorStarPanel({
  branch,
  palaceName,
  minors,
}: {
  branch: Branch;
  palaceName: string;
  minors: MinorStarPlacement[];
}) {
  return (
    <section className="zw-section zw-minor-panel">
      <h2 className="zw-h2">
        諸星の基本象意 — {palaceName}（{branch}）
      </h2>
      {minors.length === 0 ? (
        <div className="zw-mp-empty">この宮に諸星はありません</div>
      ) : (
        <ul className="zw-minor-list">
          {minors.map((m) => {
            const mean = MINOR_STAR_MEANING_BY_ID.get(m.id);
            const ew = [mean?.element, mean?.yinYang].filter(Boolean).join("・");
            return (
              <li key={m.id} className="zw-minor-item">
                <span className="zw-minor-name">{m.name}</span>
                <span className="zw-minor-fam">
                  {FAMILY_LABEL[m.family] ?? ""}
                  {ew && `・${ew}`}
                </span>
                <span className="zw-minor-text">{mean?.text ?? ""}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="zw-minor-note">諸星は盤面表示と基本象意のみで、運命指数・格局の判定には含めていません。</p>
    </section>
  );
}
