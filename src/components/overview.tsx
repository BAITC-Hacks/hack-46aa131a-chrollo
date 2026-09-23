"use client";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Buildings, Info } from "@phosphor-icons/react";
import { CATEGORIES, METRICS, type DistrictId } from "@/lib/data";
import { BASELINE, format } from "@/lib/engine";
import { CategoryIcon } from "./shared";

function CityDiagram({
  selected,
  onSelect,
}: {
  selected: DistrictId;
  onSelect: (id: DistrictId) => void;
}) {
  const shapes = [
    { id: "saryarka", path: "M35 52 181 29 233 91 202 165 83 182 29 128", x: 22, y: 29 },
    { id: "baikonur", path: "M198 29 337 44 379 109 285 161 220 161 252 91", x: 53, y: 27 },
    { id: "almaty", path: "M394 112 508 83 557 175 495 255 385 221 298 177", x: 78, y: 47 },
    { id: "esil", path: "M80 211 206 189 279 211 307 318 156 336 62 284", x: 31, y: 73 },
    { id: "nura", path: "M300 211 371 243 487 278 469 329 338 345", x: 66, y: 81 },
  ];
  return (
    <div className="city-diagram">
      <svg viewBox="0 0 590 370" aria-hidden="true">
        <defs>
          <pattern id="city-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="#dfe7e3" strokeWidth=".7" />
          </pattern>
        </defs>
        <rect width="590" height="370" fill="url(#city-grid)" />
        <path
          d="M0 195C130 192 159 168 233 178S364 235 423 249 525 265 590 245"
          fill="none"
          stroke="#b7d2d6"
          strokeWidth="12"
        />
        <path
          d="M0 195C130 192 159 168 233 178S364 235 423 249 525 265 590 245"
          fill="none"
          stroke="#d7e8e9"
          strokeWidth="5"
        />
        {shapes.map((s) => (
          <path
            key={s.id}
            d={s.path}
            fill={selected === s.id ? "#d7e8da" : "#edf1ea"}
            stroke={selected === s.id ? "#427960" : "#c5d0c7"}
            strokeWidth={selected === s.id ? 2 : 1}
          />
        ))}
        <path
          d="M50 96 483 297M169 48 393 307M75 269 477 149M115 134 438 193"
          stroke="#fff"
          strokeWidth="3"
          fill="none"
          strokeDasharray="5 5"
          opacity=".8"
        />
      </svg>
      {shapes.map((s) => {
        const d = BASELINE.districts.find((d) => d.id === s.id)!;
        return (
          <button
            key={s.id}
            className={`map-label ${selected === s.id ? "active" : ""}`}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            onClick={() => onSelect(d.id)}
            aria-pressed={selected === s.id}
            aria-label={`Район ${d.name}, оценка ${format(d.score)}`}
          >
            <span>{d.name}</span>
            <b>{format(d.score, 1)}</b>
            {s.id === "nura" ? <i>Требует внимания</i> : null}
          </button>
        );
      })}
      <span className="map-north">С ↑</span>
      <span className="map-note">Схема районов · условная геометрия</span>
    </div>
  );
}

export function Overview({ onStart, onExample }: { onStart: () => void; onExample: () => void }) {
  const [selected, setSelected] = useState<DistrictId>("nura");
  const district = BASELINE.districts.find((d) => d.id === selected)!;
  return (
    <>
      <section className="intro">
        <div>
          <p className="eyebrow">АСТАНА · ГОРОДСКАЯ ЛАБОРАТОРИЯ</p>
          <h1>
            Пять решений.
            <br />
            <span>Один город.</span>
          </h1>
          <p className="intro-copy">
            Распределите бюджет и посмотрите, как ваши решения изменят жизнь районов через два
            условных года.
          </p>
          <div className="intro-actions">
            <button className="button primary" onClick={onStart}>
              Создать сценарий <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={onExample}>
              Посмотреть пример <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
        <div className="brief-sheet">
          <span className="eyebrow">ВАШ МАНДАТ</span>
          <div className="mandate-row">
            <strong>
              100<span>ед.</span>
            </strong>
            <p>
              Один бюджет.
              <br />
              Вы выбираете приоритеты.
            </p>
          </div>
          <div className="mandate-row">
            <strong>
              5<span>мер</span>
            </strong>
            <p>
              Каждое решение
              <br />
              имеет последствия.
            </p>
          </div>
          <div className="brief-footer">
            <span className="status-dot" /> Одинаковые условия для всех
          </div>
        </div>
      </section>
      <section className="city-section" aria-labelledby="city-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ИСХОДНАЯ СИТУАЦИЯ</p>
            <h2 id="city-title">Город в разрезе районов</h2>
          </div>
          <span className="pill">Синтетические данные</span>
        </div>
        <div className="city-overview">
          <div className="map-panel">
            <div className="map-caption">
              <span>
                <Buildings size={17} /> Пять районов Астаны
              </span>
              <span>Выберите район</span>
            </div>
            <CityDiagram selected={selected} onSelect={setSelected} />
            <div className="map-legend">
              <span>
                <i className="legend-dot green" /> Выбранный район
              </span>
              <span>Показатели от 0 до 100 · больше = лучше</span>
            </div>
          </div>
          <div className="district-panel">
            <div className="district-panel-head">
              <div>
                <p className="eyebrow">{Math.round(district.population * 100)}% НАСЕЛЕНИЯ МОДЕЛИ</p>
                <h3>{district.name}</h3>
              </div>
              <strong className="district-score">
                {format(district.score, 1)}
                <small>/ 100</small>
              </strong>
            </div>
            <p className="district-description">{district.description}</p>
            <div className="category-bars">
              {CATEGORIES.map((c) => {
                const metrics = METRICS.filter((m) => m.category === c.id);
                const value =
                  metrics.reduce((s, m) => s + district.indicators[m.id] * m.weight, 0) /
                  metrics.reduce((s, m) => s + m.weight, 0);
                return (
                  <div className="category-bar" key={c.id}>
                    <div>
                      <span>
                        <CategoryIcon id={c.id} size={16} />
                        {c.short}
                      </span>
                      <b>{format(value, 1)}</b>
                    </div>
                    <div className="bar-track">
                      <i style={{ width: `${value}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="district-footnote">
              <Info size={16} />
              <span>Оценка района учитывает веса всех десяти показателей.</span>
            </div>
          </div>
        </div>
      </section>
      <section className="baseline-strip">
        <div>
          <span>Astana Quality of Life Score</span>
          <strong>
            {format(BASELINE.score)}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Средний балл города</span>
          <strong>{format(BASELINE.average)}</strong>
        </div>
        <div>
          <span>Самый слабый район</span>
          <strong>
            Нура <small>{format(BASELINE.weakest.score)}</small>
          </strong>
        </div>
        <div>
          <span>Критические показатели</span>
          <strong className="warning-text">
            2 <small>школы и медицина</small>
          </strong>
        </div>
      </section>
      <details className="method-details">
        <summary>
          <Info size={18} /> Как устроены данные и оценка?<span>Открыть методику</span>
        </summary>
        <div className="method-content">
          <p>
            Модель использует подготовленные данные хакатона. Они не описывают фактическое состояние
            районов Астаны. Все показатели находятся в диапазоне от 0 до 100.
          </p>
          <p>
            <strong>
              Score = 0,7 × средний балл города + 0,3 × балл слабейшего района − число критических
              показателей.
            </strong>{" "}
            Средний балл взвешен по доле населения; критическими считаются значения строго ниже 40.
          </p>
          <p>
            Горизонт — 8 кварталов. Эффект меры умножается на (8 − задержка) / 8. Бонусы сочетаний
            фиксированы. Ровно 5 мер, не более 2 из одного направления, без повторов и запрещённых
            сочетаний.
          </p>
          <p>
            Следуем подробным правилам датасета: охват всех пяти направлений не обязателен. В
            исходном общем условии эта формулировка неоднозначна.
          </p>
        </div>
      </details>
    </>
  );
}
