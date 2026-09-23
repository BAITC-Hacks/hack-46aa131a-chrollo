"use client";
import { useMemo } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  DownloadSimple,
  Info,
  LinkSimple,
  Plus,
  SlidersHorizontal,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { CATEGORIES, DISTRICTS, MEASURE_BY_ID, METRICS, type Decision } from "@/lib/data";
import { BASELINE, format, signed, type Simulation } from "@/lib/engine";
import { makeReport, type Analysis, type Evidence, type Insight } from "@/lib/report";
import { CategoryIcon, districtName } from "./shared";

function DistrictComparison({
  result,
  comparison,
}: {
  result: Simulation;
  comparison: Simulation | null;
}) {
  return (
    <section className="report-section">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">РАСПРЕДЕЛЕНИЕ ЭФФЕКТА</p>
          <h2>Что изменилось в районах</h2>
        </div>
      </div>
      <div className="comparison-legend">
        <span>
          <i className="legend-dot grey" />
          {comparison ? "Сохранённый сценарий" : "До решений"}
        </span>
        <span>
          <i className="legend-dot green" />
          Текущий сценарий
        </span>
      </div>
      <div className="district-comparison">
        {result.districts.map((d, i) => {
          const before = (comparison ?? BASELINE).districts[i].score;
          return (
            <div className="district-result" key={d.id}>
              <div className="district-result-name">
                <b>{d.name}</b>
                <span>{Math.round(d.population * 100)}% населения</span>
              </div>
              <div className="comparison-track">
                <span style={{ width: `${before}%` }} />
                <i style={{ width: `${d.score}%` }} />
              </div>
              <div className="district-result-number">
                <strong>{format(d.score)}</strong>
                <span className={d.score - before < 0 ? "negative-text" : "positive-text"}>
                  {signed(d.score - before)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InsightBlock({ insight, evidence }: { insight: Insight; evidence: Evidence[] }) {
  return (
    <article className="insight">
      <h4>{insight.title}</h4>
      <p>{insight.text}</p>
      <div className="evidence-list">
        {insight.evidenceIds.map((id) => {
          const e = evidence.find((e) => e.id === id);
          return e ? (
            <details key={id}>
              <summary>
                {e.label} <Info size={12} />
              </summary>
              <p>{e.value}</p>
            </details>
          ) : null;
        })}
      </div>
    </article>
  );
}

export function Results({
  decisions,
  analysis,
  notice,
  loading,
  onAnalyze,
  onEdit,
  onApply,
  comparison,
  onSave,
  onClearComparison,
  onExport,
  onShare,
}: {
  decisions: Decision[];
  analysis: Analysis | null;
  notice: string;
  loading: boolean;
  onAnalyze: () => void;
  onEdit: () => void;
  onApply: (d: Decision[]) => void;
  comparison: Decision[] | null;
  onSave: () => void;
  onClearComparison: () => void;
  onExport: () => void;
  onShare: () => void;
}) {
  const report = useMemo(() => makeReport(decisions), [decisions]);
  const comparisonReport = useMemo(
    () => (comparison ? makeReport(comparison) : null),
    [comparison],
  );
  const { result, alternative, attribution, evidence } = report;
  const ai = analysis ?? report.analysis;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ГОРИЗОНТ · 8 КВАРТАЛОВ</p>
          <h1>Решения становятся результатом.</h1>
          <p>Посмотрите, кому помог ваш сценарий и какие компромиссы он оставил.</p>
        </div>
        <button className="button secondary" onClick={onEdit}>
          <SlidersHorizontal size={17} /> Изменить решения
        </button>
      </div>
      <section className="result-summary">
        <div className="score-main">
          <span>ASTANA QUALITY OF LIFE SCORE</span>
          <div className="score-line">
            <strong data-testid="final-score">{format(result.score)}</strong>
            <span>/ 100</span>
            <b>
              {signed(result.score - BASELINE.score)}
              <ArrowUpRight size={18} />
            </b>
          </div>
          <p>Исходный балл {format(BASELINE.score)} · синтетическая модель</p>
        </div>
        <div className="result-stat">
          <span>Бюджет</span>
          <strong>
            {result.cost}
            <small>/100</small>
          </strong>
          <p>{100 - result.cost} ед. осталось</p>
        </div>
        <div className="result-stat">
          <span>Критические значения</span>
          <strong>
            {result.critical.length}
            <small>было 2</small>
          </strong>
          <p>{result.critical.length === 0 ? "Все показатели ≥ 40" : "Есть значения ниже 40"}</p>
        </div>
        <div className="result-stat">
          <span>Самый слабый район</span>
          <strong>{format(result.weakest.score, 1)}</strong>
          <p>{result.weakest.name}</p>
        </div>
      </section>
      <div className="report-toolbar">
        <div>
          <button className="text-button" onClick={onSave}>
            <Plus size={16} />
            Сохранить для сравнения
          </button>
          {comparison ? (
            <button className="text-button muted" onClick={onClearComparison}>
              <X size={14} />
              Убрать сравнение
            </button>
          ) : null}
        </div>
        <div>
          <button className="text-button" onClick={onShare}>
            <LinkSimple size={16} />
            Ссылка
          </button>
          <button className="text-button" onClick={onExport}>
            <DownloadSimple size={16} />
            Скачать JSON
          </button>
        </div>
      </div>
      {comparisonReport ? (
        <div className="comparison-banner">
          <span>
            Сравнение с сохранённым сценарием: <b>{format(comparisonReport.result.score)}</b>
          </span>
          <span>
            Разница Score <b>{signed(result.score - comparisonReport.result.score)}</b> · бюджета{" "}
            <b>{signed(result.cost - comparisonReport.result.cost)}</b>
          </span>
        </div>
      ) : null}
      <div className="results-layout">
        <div className="results-main">
          <DistrictComparison result={result} comparison={comparisonReport?.result ?? null} />
          <section className="report-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">ОБЪЯСНИМЫЙ РЕЗУЛЬТАТ</p>
                <h2>Вклад каждого решения</h2>
              </div>
            </div>
            <p className="section-description">
              Вклад учитывает сочетания мер, критические пороги и положение слабейшего района.
            </p>
            <div className="contribution-list">
              {[...attribution]
                .sort((a, b) => b.contribution - a.contribution)
                .map((a) => {
                  const m = MEASURE_BY_ID[a.measureId];
                  return (
                    <div key={a.measureId}>
                      <span
                        className="contribution-icon"
                        style={{ color: CATEGORIES.find((c) => c.id === m.category)!.color }}
                      >
                        <CategoryIcon id={m.category} />
                      </span>
                      <div>
                        <b>{m.name}</b>
                        <small>
                          {districtName(a.districtId)} · {m.cost} ед.
                        </small>
                      </div>
                      <strong className={a.contribution >= 0 ? "positive-text" : "negative-text"}>
                        {signed(a.contribution)}
                      </strong>
                    </div>
                  );
                })}
            </div>
            <details className="plain-details">
              <summary>Как посчитан вклад?</summary>
              <p>
                Точные значения Шепли: для каждой меры усредняем её прирост по всем порядкам
                добавления. Проверяются все 32 поднабора пяти мер. Вклад мер суммируется в общее
                изменение Score. Поднаборы используются только для объяснения, а не как допустимые
                финальные сценарии.
              </p>
            </details>
          </section>
          <section className="report-section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">ПРОВЕРЕННАЯ АЛЬТЕРНАТИВА</p>
                <h2>
                  {alternative ? "Одна замена — другой результат" : "Лучшая замена не найдена"}
                </h2>
              </div>
              {alternative ? (
                <span className="gain-badge">{signed(alternative.gain)} к Score</span>
              ) : null}
            </div>
            <p className="section-description">
              {alternative
                ? "Перебрали все допустимые замены одного решения, включая смену района. Предложение укладывается в бюджет."
                : "Ни одна допустимая замена одного решения не повышает Score. Это не означает глобальный оптимум: сочетание нескольких замен может быть лучше."}
            </p>
            {alternative ? (
              <>
                <div className="swap-row">
                  <div>
                    <span>Заменить</span>
                    <b>{MEASURE_BY_ID[alternative.removed.measureId].name}</b>
                    <small>{districtName(alternative.removed.districtId)}</small>
                  </div>
                  <ArrowRight size={20} />
                  <div>
                    <span>На</span>
                    <b>{MEASURE_BY_ID[alternative.added.measureId].name}</b>
                    <small>{districtName(alternative.added.districtId)}</small>
                  </div>
                </div>
                <div className="alternative-footer">
                  <span>
                    Score <b>{format(alternative.result.score)}</b> · бюджет{" "}
                    <b>{alternative.result.cost}/100</b>
                  </span>
                  <button
                    className="button secondary"
                    onClick={() => onApply(alternative.decisions)}
                  >
                    Применить замену <ArrowRight size={15} />
                  </button>
                </div>
                <p className="fine-print">
                  Изменения относительно текущего сценария:{" "}
                  {alternative.result.districts
                    .filter((d, i) => Math.abs(d.score - result.districts[i].score) > 1e-9)
                    .map(
                      (d) =>
                        `${d.name} ${signed(d.score - result.districts.find((r) => r.id === d.id)!.score)}`,
                    )
                    .join(" · ")}
                  . Более высокий Score может перераспределить пользу между районами.
                </p>
              </>
            ) : null}
          </section>
        </div>
        <aside className="analysis-panel" aria-label="Анализ сценария">
          <div className="analysis-heading">
            <span className="ai-icon">
              <Sparkle size={23} />
            </span>
            <div>
              <h2>Разбор сценария</h2>
              <span>
                {ai.source === "openai" ? `OpenAI · ${ai.model}` : "Объяснение по правилам модели"}
              </span>
            </div>
          </div>
          <p className="analysis-summary">{ai.summary}</p>
          <button className="button primary full" onClick={onAnalyze} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> Анализируем последствия…
              </>
            ) : (
              <>
                <Sparkle size={18} />
                {ai.source === "openai" ? "Повторить AI-анализ" : "Получить AI-анализ"}
              </>
            )}
          </button>
          {notice ? (
            <p className="api-notice" role="status">
              {notice}
            </p>
          ) : null}
          <div className="analysis-group">
            <h3>
              <CheckCircle size={17} />
              Сильные стороны
            </h3>
            {ai.strengths.map((s, i) => (
              <InsightBlock key={i} insight={s} evidence={evidence} />
            ))}
          </div>
          <div className="analysis-group risks">
            <h3>
              <WarningCircle size={17} />
              Риски и компромиссы
            </h3>
            {ai.risks.map((s, i) => (
              <InsightBlock key={i} insight={s} evidence={evidence} />
            ))}
          </div>
          <div className="analysis-recommendation">
            <span className="eyebrow">РЕКОМЕНДАЦИЯ</span>
            <p>{ai.recommendation}</p>
          </div>
          <p className="fine-print">
            AI объясняет расчёт, но не определяет балл. Проверяйте выводы по фактам под каждым
            тезисом.
          </p>
        </aside>
      </div>
      <section className="report-section indicators-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">ВСЕ ДАННЫЕ ОТКРЫТЫ</p>
            <h2>Показатели после решений</h2>
          </div>
          <span className="pill">Критический порог: &lt; 40</span>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Таблица показателей, прокручивается по горизонтали"
        >
          <table>
            <caption className="sr-only">
              Значения десяти показателей по районам после выбранных мер
            </caption>
            <thead>
              <tr>
                <th scope="col">Район</th>
                {METRICS.map((m) => (
                  <th scope="col" key={m.id} title={m.name}>
                    {m.id}
                    <small>{m.name}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.districts.map((d, i) => (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  {METRICS.map((m) => {
                    const delta = d.indicators[m.id] - DISTRICTS[i].indicators[m.id];
                    return (
                      <td key={m.id} className={d.indicators[m.id] < 40 ? "critical-cell" : ""}>
                        <b>{format(d.indicators[m.id], 1)}</b>
                        {delta !== 0 ? (
                          <small className={delta > 0 ? "positive-text" : "negative-text"}>
                            {signed(delta)}
                          </small>
                        ) : (
                          <small>—</small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
