"use client";

// src/app/qimen/MapPicker.tsx
//
// 真太陽時補正用の地点選択マップ。
//   - 地図ライブラリ: Leaflet 1.9.4（BSD-2-Clause、APIキー不要）
//   - タイル: OpenStreetMap 公式タイル（無料・要帰属表示。低頻度の対話利用の範囲）
//   - 排盤ロジックには一切関与しない。緯度・経度を親へ渡すだけ。
//
// SSR 不可（window 依存）のため、呼び出し側で next/dynamic({ ssr: false }) 経由で読み込む。

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  /** 地図クリック時に呼ばれる。小数5桁に丸めた緯度経度。 */
  onPick: (lat: number, lng: number) => void;
};

export default function MapPicker({ lat, lng, onPick }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // マウント時に一度だけ生成
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { attributionControl: true }).setView([lat, lng], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    const marker = L.circleMarker([lat, lng], {
      radius: 8,
      color: "#c00",
      weight: 2,
      fillColor: "#f66",
      fillOpacity: 0.9,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      onPickRef.current(
        Number(e.latlng.lat.toFixed(5)),
        Number(e.latlng.lng.toFixed(5)),
      );
    });
    mapRef.current = map;
    markerRef.current = marker;
    // 表示直後にサイズ確定させる
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部（検索・手入力）で緯度経度が変わったらマーカーと中心を追従
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    markerRef.current?.setLatLng([lat, lng]);
    mapRef.current?.panTo([lat, lng]);
  }, [lat, lng]);

  return (
    <div
      ref={elRef}
      style={{ height: 300, width: 460, border: "1px solid #999", borderRadius: 4 }}
    />
  );
}
