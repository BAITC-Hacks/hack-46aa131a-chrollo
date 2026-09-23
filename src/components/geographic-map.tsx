"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, Minus, Plus } from "@phosphor-icons/react";
import type * as Leaflet from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import geography from "@/data/astana-districts.json";
import type { DistrictId } from "@/lib/data";
import { format, signed } from "@/lib/engine";

interface DistrictFeature {
  id: DistrictId;
  name: string;
  labelPosition: [number, number];
  osmRelations: number[];
}
interface DistrictValue {
  id: DistrictId;
  name: string;
  value: number;
  delta: number;
}
// Checked-in geometry is validated by prepare-map.py and the geography regression test.
const features = geography as unknown as FeatureCollection<Geometry, DistrictFeature>;
const CITY_VIEW: Leaflet.LatLngBoundsExpression = [
  [51.045, 71.255],
  [51.245, 71.655],
];
const color = (value: number) =>
  value < 40 ? "#d99c75" : value < 50 ? "#d6c6a2" : value < 60 ? "#95b6a0" : "#508c73";

export function GeographicMap({
  districts,
  selected,
  metricLabel,
  onSelect,
}: {
  districts: DistrictValue[];
  selected: DistrictId;
  metricLabel: string;
  onSelect: (id: DistrictId) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layers = useRef(new Map<DistrictId, Leaflet.Path>());
  const markers = useRef(new Map<DistrictId, Leaflet.Marker>());
  const leaflet = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let instance: Leaflet.Map | undefined;
    async function start() {
      const L = await import("leaflet");
      if (cancelled || !host.current) return;
      leaflet.current = L;
      const map = L.map(host.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        zoomSnap: 0.25,
        minZoom: 9,
        maxZoom: 17,
        attributionControl: true,
      }).setView([51.145, 71.435], 11);
      instance = map;
      mapRef.current = map;
      map.attributionControl.setPrefix(false);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        className: "qala-basemap",
      })
        .on("tileerror", () => {
          if (!cancelled) setTileError(true);
        })
        .on("tileload", () => {
          if (!cancelled) setTileError(false);
        })
        .addTo(map);

      L.geoJSON(features, {
        style: { color: "#608477", weight: 1.5, fillColor: "#b7cbbb", fillOpacity: 0.32 },
        onEachFeature(feature, layer) {
          const id = feature.properties.id;
          layers.current.set(id, layer as Leaflet.Path);
          layer.on("click", () => onSelect(id));
        },
      }).addTo(map);
      for (const feature of features.features) {
        const { id, name, labelPosition } = feature.properties;
        const marker = L.marker(labelPosition, {
          icon: L.divIcon({
            className: "map-district-marker",
            html: "",
            iconSize: [108, 66],
            iconAnchor: [54, 33],
          }),
          title: name,
          keyboard: true,
          riseOnHover: true,
        })
          .addTo(map)
          .on("click", () => onSelect(id));
        marker.getElement()?.addEventListener("keydown", (event) => {
          if (event.key === " ") {
            event.preventDefault();
            onSelect(id);
          }
        });
        markers.current.set(id, marker);
      }
      let fitted = false;
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (cancelled || !host.current?.clientWidth || !host.current?.clientHeight) return;
          map.invalidateSize({ pan: false });
          if (!fitted) {
            map.fitBounds(CITY_VIEW, { padding: [20, 22], animate: false });
            fitted = true;
          }
        });
      });
      observer.observe(host.current);
      setReady(true);
    }
    start().catch(() => {
      if (!cancelled) setMapError(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      instance?.remove();
      mapRef.current = null;
      layers.current.clear();
      markers.current.clear();
    };
  }, [onSelect]);

  useEffect(() => {
    if (!ready || !leaflet.current) return;
    const L = leaflet.current;
    for (const district of districts) {
      const active = district.id === selected;
      const layer = layers.current.get(district.id);
      layer?.setStyle({
        fillColor: color(district.value),
        fillOpacity: 0.38,
        color: active ? "#245f49" : "#ffffff",
        weight: active ? 3 : 1.5,
        opacity: 0.95,
      });
      if (active) layer?.bringToFront();
      const label = document.createElement("div");
      label.className = `map-district-label${active ? " is-selected" : ""}`;
      const name = document.createElement("span");
      name.textContent = district.name;
      const value = document.createElement("strong");
      value.textContent = format(district.value, 1);
      label.append(name, value);
      if (Math.abs(district.delta) > 0.001) {
        const delta = document.createElement("em");
        delta.className = district.delta < 0 ? "negative-text" : "positive-text";
        delta.textContent = signed(district.delta);
        label.append(delta);
      }
      const marker = markers.current.get(district.id);
      marker?.setIcon(
        L.divIcon({
          className: "map-district-marker",
          html: label,
          iconSize: [108, 66],
          iconAnchor: [54, 33],
        }),
      );
      marker?.setZIndexOffset(active ? 500 : 0);
      const element = marker?.getElement();
      element?.setAttribute(
        "aria-label",
        `${district.name}: ${metricLabel} ${format(district.value)}`,
      );
      element?.setAttribute("aria-pressed", String(active));
    }
  }, [districts, selected, metricLabel, ready]);

  return (
    <div className="geographic-map-shell">
      <div
        className="geographic-map"
        ref={host}
        role="region"
        aria-label="Интерактивная карта Астаны"
      />
      {!ready && (
        <div className="geographic-map-loading" role="status">
          {mapError
            ? "Карта не загрузилась. Показатели районов доступны ниже."
            : "Загружаем карту Астаны…"}
        </div>
      )}
      <div className="geographic-map-controls" role="group" aria-label="Управление картой">
        <button
          type="button"
          disabled={!ready}
          aria-label="Приблизить карту"
          title="Приблизить"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-label="Отдалить карту"
          title="Отдалить"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-label="Вернуть обзор Астаны"
          title="Обзор Астаны"
          onClick={() =>
            mapRef.current?.fitBounds(CITY_VIEW, { padding: [20, 22], animate: false })
          }
        >
          <Crosshair size={18} />
        </button>
      </div>
      <div className="geographic-map-north" aria-hidden="true">
        <span>С</span>↑
      </div>
      {tileError && (
        <div className="map-tile-notice" role="status">
          Подложка недоступна. Районы и расчёты работают.
        </div>
      )}
      <div className="geographic-map-legend" role="group" aria-label="Цветовая шкала показателей">
        <span>Выше — лучше</span>
        {[
          { label: "< 40", value: 30 },
          { label: "40–49", value: 45 },
          { label: "50–59", value: 55 },
          { label: "60+", value: 70 },
        ].map((bin) => (
          <span key={bin.label}>
            <i style={{ background: color(bin.value) }} />
            {bin.label}
          </span>
        ))}
      </div>
      <div className="map-district-picker" role="group" aria-label="Выбрать район">
        {districts.map((district) => (
          <button
            type="button"
            key={district.id}
            aria-pressed={selected === district.id}
            onClick={() => onSelect(district.id)}
          >
            <span>{district.name}</span>
            <strong>{format(district.value, 1)}</strong>
          </button>
        ))}
      </div>
      <details className="map-source-note">
        <summary>География Астаны · 5 районов модели</summary>
        <p>
          Границы:{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap contributors, ODbL
          </a>
          . Для соответствия датасету территория Сарайшыка объединена с Алматы. Показатели учебные;
          карта не отражает актуальное административное деление. Фоновая карта загружается из
          интернета; границы сохранены в приложении.
        </p>
      </details>
    </div>
  );
}
