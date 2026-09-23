"use client";
import { useState } from "react";
import { ArrowRight, Buildings, Check, Clock, Plus, Trash, X } from "@phosphor-icons/react";
import {
  BUDGET,
  CATEGORIES,
  DISTRICTS,
  EXAMPLE,
  MEASURES,
  MEASURE_BY_ID,
  METRICS,
  type CategoryId,
  type Decision,
  type DistrictId,
  type Measure,
} from "@/lib/data";
import { signed, validate } from "@/lib/engine";
import { CategoryIcon, districtName } from "./shared";

function MeasureCard({
  measure,
  decisions,
  onChange,
  onNotice,
}: {
  measure: Measure;
  decisions: Decision[];
  onChange: (d: Decision[]) => void;
  onNotice: (s: string) => void;
}) {
  const selected = decisions.find((d) => d.measureId === measure.id);
  const [target, setTarget] = useState<DistrictId>("nura");
  const districtId = selected?.districtId ?? target;
  const decision: Decision =
    measure.scope === "city" ? { measureId: measure.id } : { measureId: measure.id, districtId };
  const candidate = [...decisions, decision];
  const check = validate(candidate, false);
  const color = CATEGORIES.find((c) => c.id === measure.category)!.color;
  function changeDistrict(id: DistrictId) {
    setTarget(id);
    if (selected) {
      const next = decisions.map((d) =>
        d.measureId === measure.id ? { measureId: measure.id, districtId: id } : d,
      );
      const v = validate(next, false);
      if (v.valid) onChange(next);
      else onNotice(v.errors[0]);
    }
  }
  return (
    <article className={`measure-card ${selected ? "selected" : ""}`}>
      <div className="measure-top">
        <span className="category-mark" style={{ color }}>
          <CategoryIcon id={measure.category} />
          {CATEGORIES.find((c) => c.id === measure.category)!.short}
        </span>
        <span className="measure-id">{measure.id}</span>
      </div>
      <h3>{measure.name}</h3>
      <p>{measure.description}</p>
      <div className="effect-tags">
        {Object.entries(measure.effects).map(([key, value]) => {
          const metric = METRICS.find((m) => m.id === key)!;
          const effect = (value * (8 - measure.lag)) / 8;
          return (
            <span
              key={key}
              className={effect < 0 ? "negative" : ""}
              title={`${metric.name}: полный эффект ${value}, после задержки ${effect}`}
            >
              <b>
                {key} {signed(effect)}
              </b>
              <span>{metric.name}</span>
            </span>
          );
        })}
      </div>
      <div className="measure-timing">
        <Clock size={14} />
        <span>Задержка {measure.lag} кв. · эффект за 2 года</span>
      </div>
      <div className="measure-controls">
        {measure.scope === "district" ? (
          <label className="select-wrap">
            <span className="sr-only">Район для {measure.name}</span>
            <select
              value={districtId}
              onChange={(e) => changeDistrict(e.target.value as DistrictId)}
            >
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="city-scope">
            <Buildings size={16} /> Весь город
          </span>
        )}
        <span className="cost">
          <b>{measure.cost}</b> ед.
        </span>
      </div>
      <button
        className={`measure-add ${selected ? "is-selected" : ""}`}
        onClick={() =>
          selected
            ? onChange(decisions.filter((d) => d.measureId !== measure.id))
            : onChange(candidate)
        }
        disabled={!selected && !check.valid}
      >
        {selected ? (
          <>
            <Check size={17} />В сценарии · убрать
          </>
        ) : (
          <>
            <Plus size={17} />
            Добавить решение
          </>
        )}
      </button>
      {!selected && !check.valid ? <p className="rule-hint">{check.errors[0]}</p> : null}
    </article>
  );
}

export function Builder({
  decisions,
  onChange,
  onCalculate,
  onNotice,
}: {
  decisions: Decision[];
  onChange: (d: Decision[]) => void;
  onCalculate: () => void;
  onNotice: (s: string) => void;
}) {
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const validation = validate(decisions);
  const remaining = BUDGET - validation.cost;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАШ СЦЕНАРИЙ</p>
          <h1>Выберите, что изменится.</h1>
          <p>Пять мероприятий. Не более двух из одного направления. Последствия — в деталях.</p>
        </div>
        <button className="button secondary" onClick={() => onChange(EXAMPLE)}>
          Загрузить пример
        </button>
      </div>
      <div className="builder-layout">
        <section className="catalog" aria-label="Каталог мероприятий">
          <h2 className="sr-only">Каталог мероприятий</h2>
          <div className="filter-tabs" role="group" aria-label="Направления">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
              aria-pressed={category === "all"}
            >
              Все меры <span>14</span>
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
              >
                <CategoryIcon id={c.id} size={16} />
                {c.short}
              </button>
            ))}
          </div>
          <div className="measure-grid">
            {MEASURES.filter((m) => category === "all" || m.category === category).map((m) => (
              <MeasureCard
                key={m.id}
                measure={m}
                decisions={decisions}
                onChange={onChange}
                onNotice={onNotice}
              />
            ))}
          </div>
        </section>
        <aside className="plan-panel" aria-label="Выбранные решения и бюджет">
          <div className="plan-top">
            <span className="eyebrow">БЮДЖЕТ СЦЕНАРИЯ</span>
            <span className="budget-value">
              {remaining}
              <small> / 100</small>
            </span>
            <span className="muted">условных единиц осталось</span>
            <div className="budget-track">
              {decisions.map((d) => {
                const m = MEASURE_BY_ID[d.measureId];
                return (
                  <span
                    key={d.measureId}
                    title={`${m.name}: ${m.cost}`}
                    style={{
                      width: `${m.cost}%`,
                      background: CATEGORIES.find((c) => c.id === m.category)!.color,
                    }}
                  />
                );
              })}
            </div>
            <div className="budget-caption">
              <span>Потрачено {validation.cost}</span>
              <span>Лимит 100</span>
            </div>
          </div>
          <div className="plan-title">
            <h2>Ваши решения</h2>
            <span>{decisions.length} / 5</span>
          </div>
          <ol className="decision-list">
            {Array.from({ length: 5 }, (_, i) => {
              const d = decisions[i];
              const m = d ? MEASURE_BY_ID[d.measureId] : null;
              return (
                <li key={i} className={d ? "filled" : "empty"}>
                  <span className="decision-number">{String(i + 1).padStart(2, "0")}</span>
                  {d && m ? (
                    <>
                      <div>
                        <b>{m.name}</b>
                        <small>
                          {districtName(d.districtId)} · {m.cost} ед.
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Убрать ${m.name}`}
                        onClick={() => onChange(decisions.filter((_, j) => i !== j))}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <span>Добавьте мероприятие</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="plan-directions">
            {CATEGORIES.map((c) => {
              const count = decisions.filter(
                (d) => MEASURE_BY_ID[d.measureId].category === c.id,
              ).length;
              return (
                <span
                  key={c.id}
                  className={count ? "covered" : ""}
                  title={`${c.name}: ${count} из 2`}
                >
                  <CategoryIcon id={c.id} size={17} />
                  {count}/2
                </span>
              );
            })}
          </div>
          <button
            className="button primary full"
            disabled={!validation.valid}
            onClick={onCalculate}
          >
            Рассчитать сценарий <ArrowRight size={18} />
          </button>
          <p className="plan-help">
            {validation.valid
              ? "Все ограничения соблюдены. Можно оценить результат."
              : decisions.length < 5
                ? `Добавьте ещё ${5 - decisions.length} ${5 - decisions.length === 1 ? "мероприятие" : "мероприятия"}.`
                : validation.errors[0]}
          </p>
          {decisions.length > 0 ? (
            <button className="text-button clear-plan" onClick={() => onChange([])}>
              <Trash size={15} /> Очистить сценарий
            </button>
          ) : null}
          <details className="plan-rules">
            <summary>Ограничения и сочетания</summary>
            <p>
              Полосы и ЛРТ несовместимы в любом районе. Парк и школа, а также чистое топливо и
              обновление сетей несовместимы в одном районе.
            </p>
            <p>
              Бонусы: полосы + светофоры → T1 +2; камеры + обращения → B1 +2; топливо + озеленение →
              E2 +2. Бонус действует в районе первой меры.
            </p>
            <p>Остаток бюджета не даёт бонусных баллов.</p>
          </details>
        </aside>
      </div>
    </>
  );
}
