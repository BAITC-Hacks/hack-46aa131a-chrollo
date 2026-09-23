"use client";
import { useMemo, useState } from "react";
import { ClockCountdown } from "@phosphor-icons/react";
import { type Decision, MEASURE_BY_ID } from "@/lib/data";
import { decisionLabel, format, signed } from "@/lib/engine";
import { testDelays } from "@/lib/resilience";

export function ResiliencePanel({
  decisions,
  initialQuarters = 2,
  focusMeasureId = null,
  planLabel = "Текущий план",
  onExperimentChange,
}: {
  decisions: Decision[];
  initialQuarters?: number;
  focusMeasureId?: string | null;
  planLabel?: string;
  onExperimentChange?: (quarters: number, focus: string | null) => void;
}) {
  const [localQuarters, setQuarters] = useState(initialQuarters);
  const [localFocus, setFocus] = useState<string | null>(focusMeasureId);
  const quarters = onExperimentChange ? initialQuarters : localQuarters;
  const focus = onExperimentChange ? focusMeasureId : localFocus;
  const report = useMemo(() => testDelays(decisions, quarters), [decisions, quarters]);
  const selected = report.cases.find((c) => c.measureId === focus) ?? report.worst;
  const returned = selected.result.critical.filter(
    (c) =>
      !report.baseline.critical.some(
        (b) => b.districtId === c.districtId && b.metricId === c.metricId,
      ),
  );
  return (
    <section className="resilience-panel" aria-label="Проверка задержки реализации">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">ДОПОЛНИТЕЛЬНЫЙ ЭКСПЕРИМЕНТ</p>
          <h2>
            <ClockCountdown size={23} /> Если сроки сдвинутся
          </h2>
        </div>
        <span className="pill">Официальный Score сохранён</span>
      </div>
      <p className="muted">
        {planLabel}. Score без дополнительной задержки: {format(report.baseline.score)}. Проверяем
        задержку одной меры за раз.
      </p>
      <div className="delay-controls">
        <label>
          Дополнительная задержка
          <select
            value={quarters}
            onChange={(e) => {
              const next = Number(e.target.value);
              setQuarters(next);
              onExperimentChange?.(next, focus);
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((q) => (
              <option value={q} key={q}>
                {q} кварт. ({q * 3} мес.)
              </option>
            ))}
          </select>
        </label>
        <label>
          Мероприятие
          <select
            value={focus ?? "worst"}
            onChange={(e) => {
              const next = e.target.value === "worst" ? null : e.target.value;
              setFocus(next);
              onExperimentChange?.(quarters, next);
            }}
          >
            <option value="worst">Самая чувствительная мера</option>
            {decisions.map((d) => (
              <option value={d.measureId} key={d.measureId}>
                {decisionLabel(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="delay-outcome">
        <div>
          <span>Score при задержке</span>
          <strong>{format(selected.result.score)}</strong>
          <small>
            {signed(selected.result.score - report.baseline.score)} к плану без задержки
          </small>
        </div>
        <div>
          <b>{MEASURE_BY_ID[selected.measureId].name}</b>
          <p>
            {returned.length
              ? `Возвращается критический дефицит: ${returned.map((c) => `${c.districtName} — ${c.metricName} (${format(c.value)})`).join("; ")}.`
              : "Новых критических дефицитов при этой задержке не возникает."}
          </p>
        </div>
      </div>
      <details className="delay-details">
        <summary>Сравнить задержки всех пяти мер</summary>
        <ul>
          {report.cases.map((c) => (
            <li key={c.measureId}>
              <span>{decisionLabel(c)}</span>
              <b>{format(c.result.score)}</b>
              <small>{signed(-c.loss)}</small>
            </li>
          ))}
        </ul>
      </details>
      <p className="fine-print">
        Условие эксперимента: уменьшается только прямой эффект задержанной меры на горизонте 8
        кварталов. Бюджет, остальные меры и фиксированные бонусы сочетаний сохраняются. Это проверка
        сценария, не прогноз сроков.
      </p>
    </section>
  );
}
