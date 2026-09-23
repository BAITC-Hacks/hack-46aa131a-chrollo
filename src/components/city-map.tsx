"use client";
import { useMemo, useState } from "react";
import { ArrowUpRight, MapTrifold } from "@phosphor-icons/react";
import { DISTRICTS, METRICS, type Decision, type DistrictId, type MetricId } from "@/lib/data";
import { GeographicMap } from "./geographic-map";
import { BASELINE, format, signed, simulate, validate } from "@/lib/engine";

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
      <GeographicMap
        selected={selected}
        onSelect={setSelected}
        metricLabel={metricLabel}
        districts={result.districts.map((d) => {
          const old = before.districts.find((r) => r.id === d.id)!;
          const value = metric === "score" ? d.score : d.indicators[metric];
          return {
            id: d.id,
            name: d.name,
            value,
            delta: value - (metric === "score" ? old.score : old.indicators[metric]),
          };
        })}
      />
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
