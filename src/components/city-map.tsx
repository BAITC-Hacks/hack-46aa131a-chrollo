"use client";
import { useId, useMemo, useState } from "react";
import { ArrowUpRight, MapTrifold } from "@phosphor-icons/react";
import { DISTRICTS, METRICS, type Decision, type DistrictId, type MetricId } from "@/lib/data";
import { BASELINE, format, signed, simulate, validate } from "@/lib/engine";

// Deliberately schematic: the brief supplies indicators, not geographic boundaries.
const AREAS: { id: DistrictId; path: string; x: number; y: number }[] = [
  {
    id: "saryarka",
    path: "M48 74 142 38 260 48 302 102 280 183 228 230 138 236 54 200 30 135Z",
    x: 166,
    y: 132,
  },
  {
    id: "baikonur",
    path: "M270 48 400 32 487 68 518 137 471 194 392 218 290 180 312 100Z",
    x: 399,
    y: 124,
  },
  {
    id: "almaty",
    path: "M532 107 630 68 725 100 773 174 747 257 685 300 590 274 484 199 530 139Z",
    x: 640,
    y: 185,
  },
  {
    id: "esil",
    path: "M63 222 145 258 230 249 294 225 389 258 396 341 340 413 226 428 104 385 47 315Z",
    x: 221,
    y: 327,
  },
  {
    id: "nura",
    path: "M407 256 468 234 576 300 681 326 653 398 551 437 422 410 367 424 416 345Z",
    x: 521,
    y: 352,
  },
];

export function CityMap({
  decisions,
  comparison,
  label = "Исходный город",
  preview = false,
  delay,
}: {
  decisions: Decision[];
  comparison?: Decision[];
  label?: string;
  preview?: boolean;
  delay?: { measureId: string; quarters: number };
}) {
  const [selected, setSelected] = useState<DistrictId>("nura");
  const [metric, setMetric] = useState<MetricId | "score">("score");
  const uid = useId().replace(/:/g, "");
  const result = useMemo(() => simulate(decisions, delay), [decisions, delay]);
  const before = useMemo(() => (comparison ? simulate(comparison) : BASELINE), [comparison]);
  const district = result.districts.find((d) => d.id === selected)!;
  const original = before.districts.find((d) => d.id === selected)!;
  const metricLabel =
    metric === "score" ? "Качество жизни" : METRICS.find((m) => m.id === metric)!.name;
  const change = result.score - before.score;
  const canScore = decisions.length === 0 || validate(decisions).valid;
  return (
    <section
      className={`city-canvas ${preview ? "is-preview" : ""}`}
      aria-label="Карта показателей города"
    >
      <div className="city-toolbar">
        <div>
          <MapTrifold size={20} />
          <h2>
            Астана <span>/ 5 районов</span>
          </h2>
        </div>
        <label>
          <span className="sr-only">Показатель на карте</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
            <option value="score">Качество жизни</option>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="city-scoreboard" aria-live="polite">
        <div>
          <span>{label}</span>
          <strong>
            {canScore ? format(result.score) : "—"}
            <small>{canScore ? "Score" : "Черновик"}</small>
          </strong>
          <em className={change < 0 ? "negative-text" : "positive-text"}>
            {!canScore ? (
              `Выберите ещё ${5 - decisions.length} ${decisions.length === 4 ? "меру" : "меры"}`
            ) : (
              <>
                {signed(change)} к{" "}
                {delay
                  ? "плану без задержки"
                  : comparison
                    ? "текущему сценарию"
                    : "исходному городу"}
              </>
            )}
          </em>
        </div>
        <div>
          <span>Бюджет</span>
          <strong>
            {result.cost}
            <small>/ 100</small>
          </strong>
          <em>{decisions.length} из 5 мер</em>
        </div>
        <div>
          <span>Дефициты</span>
          <strong>
            {result.critical.length}
            <small>показателя</small>
          </strong>
          <em>значения ниже 40</em>
        </div>
      </div>
      <div className="city-map-surface">
        <svg viewBox="0 0 800 470" role="group" aria-label={`Схема районов: ${metricLabel}`}>
          <defs>
            <pattern
              id={`${uid}-blocks`}
              width="37"
              height="30"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-18)"
            >
              <rect
                x="3"
                y="3"
                width="30"
                height="23"
                rx="3"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.6"
                opacity=".42"
              />
            </pattern>
          </defs>
          <path
            className="map-river"
            d="M0 210C110 208 106 268 212 239S305 192 407 239 532 305 636 310 742 279 800 302"
            fill="none"
            stroke="#b4d0d2"
            strokeWidth="13"
          />
          {AREAS.map((area) => {
            const d = result.districts.find((r) => r.id === area.id)!;
            const old = before.districts.find((r) => r.id === area.id)!;
            const value = metric === "score" ? d.score : d.indicators[metric];
            const delta = value - (metric === "score" ? old.score : old.indicators[metric]);
            const active = selected === d.id;
            const fill =
              value < 40 ? "#edd4be" : value < 50 ? "#e7e2ce" : value < 60 ? "#d4e2cb" : "#b7d1ba";
            return (
              <g
                key={d.id}
                className={`district-shape ${active ? "selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={`${d.name}: ${metricLabel} ${format(value)}`}
                onClick={() => setSelected(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(d.id);
                  }
                }}
              >
                <path
                  className="district-outline"
                  d={area.path}
                  fill={fill}
                  stroke={active ? "#245f49" : "#aabfa9"}
                  strokeWidth={active ? 2.5 : 1}
                />
                <path d={area.path} fill={`url(#${uid}-blocks)`} pointerEvents="none" />
                <rect
                  x={area.x - 68}
                  y={area.y - 33}
                  width="136"
                  height={Math.abs(delta) > 0.001 ? 91 : 72}
                  rx="14"
                  fill={active ? "#245f49" : "#fffffff0"}
                />
                <text
                  x={area.x}
                  y={area.y - 9}
                  textAnchor="middle"
                  className={`district-name ${active ? "inverse" : ""}`}
                >
                  {d.name}
                </text>
                <text
                  x={area.x}
                  y={area.y + 20}
                  textAnchor="middle"
                  className={`district-value ${active ? "inverse" : ""}`}
                >
                  {format(value, 1)}
                </text>
                {Math.abs(delta) > 0.001 && (
                  <text
                    x={area.x}
                    y={area.y + 44}
                    textAnchor="middle"
                    className={`district-delta ${active ? "inverse" : ""}`}
                  >
                    {signed(delta)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="map-key">
          <span>
            <i className="low" />
            &lt; 40
          </span>
          <span>
            <i className="medium" />
            40–60
          </span>
          <span>
            <i className="high" />
            60+
          </span>
          <small>Выше — лучше</small>
        </div>
        <p className="map-disclaimer">Схема районов · условные границы</p>
      </div>
      <div className="district-inspector">
        <div className="district-inspector-heading">
          <div>
            <span className="eyebrow">В ФОКУСЕ</span>
            <h3>
              {district.name} <ArrowUpRight size={20} />
            </h3>
          </div>
          <span>{Math.round(district.population * 100)}% населения</span>
        </div>
        <p>
          {decisions.length > 0 ? "До принятия мер: " : ""}
          {DISTRICTS.find((d) => d.id === selected)!.description}
        </p>
        <div className="district-indicators">
          {METRICS.map((m) => {
            const value = district.indicators[m.id];
            const delta = value - original.indicators[m.id];
            return (
              <div key={m.id} className={value < 40 ? "critical-indicator" : ""}>
                <span>{m.name}</span>
                <b>{format(value, 1)}</b>
                {Math.abs(delta) > 0.001 && (
                  <em className={delta < 0 ? "negative-text" : "positive-text"}>{signed(delta)}</em>
                )}
                <div className="indicator-track">
                  <i style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
