"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChatCircleDots,
  LockSimple,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  ClockCountdown,
} from "@phosphor-icons/react";
import { DISTRICTS, MEASURES, MEASURE_BY_ID, type Decision } from "@/lib/data";
import {
  DEFAULT_CONSTRAINTS,
  GOAL_LABELS,
  type PlanConstraints,
  type PlanSearch,
} from "@/lib/planner";
import { decisionLabel, format, scenarioKey, signed, simulate, validate } from "@/lib/engine";
import type { ChatMessage, PlannerReply, PlannerRequest } from "@/lib/planner-contract";
import { ResiliencePanel } from "./resilience-panel";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Каким должен стать город? Расскажите о приоритетах — я подберу допустимые планы, объясню разницу и помогу проверить риски. Можно закрепить важные решения, исключить нежелательные меры или задать вопрос о текущем сценарии.",
};

export function PlannerChat({
  decisions,
  onApply,
  aiConfigured,
}: {
  decisions: Decision[];
  onApply: (d: Decision[]) => void;
  aiConfigured: boolean | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [constraints, setConstraints] = useState<PlanConstraints>(DEFAULT_CONSTRAINTS);
  const [search, setSearch] = useState<PlanSearch | null>(null);
  const [stress, setStress] = useState<{
    decisions: Decision[];
    quarters: number;
    focus: string | null;
    label: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<"openai" | "local" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const key = scenarioKey(decisions);
  const complete = validate(decisions).valid;
  const current = useMemo(() => (complete ? simulate(decisions) : null), [decisions, complete]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, loading]);
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStress(null);
    return () => abortRef.current?.abort();
  }, [key]);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setPhase("Проверяю планы и готовлю объяснение…"), 7000);
    return () => clearTimeout(timer);
  }, [loading]);

  function updateConditions(next: PlanConstraints) {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setConstraints(next);
    setSearch(null);
    setStress(null);
    setError("");
  }
  function reset() {
    updateConditions(DEFAULT_CONSTRAINTS);
    setMessages([INITIAL_MESSAGE]);
    setDraft("");
    setSource(null);
  }
  async function send(text?: string, mode: "chat" | "search" = "chat") {
    const content = (text ?? draft).trim();
    if (loading || (mode === "chat" && !content)) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: mode === "search" ? "Подбери планы по условиям справа." : content },
    ];
    setMessages(next.slice(-40));
    setDraft("");
    setError("");
    setLoading(true);
    setPhase(mode === "chat" ? "Разбираюсь в ваших приоритетах…" : "Перебираю допустимые планы…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const body: PlannerRequest = {
        mode,
        messages: next.slice(-8).map((m) => ({ ...m, content: m.content.slice(0, 1500) })),
        constraints,
        decisions,
        previousPlans: search?.plans.map((p) => p.decisions) ?? [],
      };
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const reply: PlannerReply & { error?: string } = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(reply.error ?? "Не удалось получить ответ.");
      setMessages(
        (prev) =>
          [...prev, { role: "assistant", content: reply.message }].slice(-40) as ChatMessage[],
      );
      setConstraints(reply.constraints);
      if (reply.search) setSearch(reply.search);
      setStress(
        reply.stress
          ? {
              decisions: [...decisions],
              quarters: reply.stress.quarters,
              focus: reply.focusMeasureId,
              label: "Текущий план",
            }
          : null,
      );
      setSource(reply.source);
      if (reply.notice) setError(reply.notice);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Ошибка соединения.");
        if (mode === "chat") setDraft(content);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }
  function toggleLock(d: Decision) {
    const existing = constraints.locked.some(
      (l) => l.measureId === d.measureId && l.districtId === d.districtId,
    );
    updateConditions({
      ...constraints,
      locked: existing
        ? constraints.locked.filter((l) => l.measureId !== d.measureId)
        : [...constraints.locked.filter((l) => l.measureId !== d.measureId), d],
    });
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ОТ ПРИОРИТЕТОВ К РЕШЕНИЯМ</p>
          <h1>Обсудим будущее города.</h1>
          <p>Скажите, что важно сохранить. Вместе найдём выполнимый план.</p>
        </div>
        <button className="text-button" onClick={reset}>
          Новый диалог
        </button>
      </div>
      <div className="planning-layout">
        <section className="conversation-panel" aria-label="Диалог с городским помощником">
          <div className="conversation-header">
            <ChatCircleDots size={24} />
            <div>
              <h2>Городской помощник</h2>
              <span>
                {source === "local"
                  ? "Расчёт по условиям"
                  : aiConfigured
                    ? "OpenAI · контекст вашего сценария"
                    : "Ручной подбор доступен без OpenAI"}
              </span>
            </div>
          </div>
          <div
            className="conversation-log"
            role="log"
            aria-label="Сообщения диалога"
            ref={logRef}
            aria-live="polite"
            aria-relevant="additions"
            tabIndex={0}
          >
            {messages.map((m, i) => (
              <article key={i} className={`chat-message ${m.role}`}>
                <span className="chat-author">{m.role === "user" ? "Вы" : "QALA"}</span>
                <p>{m.content}</p>
              </article>
            ))}
            {loading && (
              <div className="chat-progress" role="status">
                <span className="status-dot" />
                {phase}
              </div>
            )}
          </div>
          {messages.length === 1 && (
            <div className="chat-starters">
              {[
                "Найди лучший план для города",
                "Помоги самому слабому району",
                ...(complete
                  ? [
                      "Сохрани школу и поликлинику, улучши остальное",
                      "Что если поликлиника задержится на 3 квартала?",
                    ]
                  : []),
              ].map((prompt) => (
                <button key={prompt} onClick={() => send(prompt)} disabled={loading}>
                  {prompt}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="planning-message">
              Сообщение помощнику
            </label>
            <textarea
              id="planning-message"
              value={draft}
              maxLength={1500}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Например: сохрани школу в Нуре…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div>
              <span>Enter — отправить · Shift + Enter — новая строка</span>
              {loading ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    abortRef.current?.abort();
                    abortRef.current = null;
                    setLoading(false);
                  }}
                >
                  Остановить
                </button>
              ) : (
                <button
                  type="submit"
                  className="chat-send"
                  disabled={!draft.trim()}
                  aria-label="Отправить сообщение"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          <p className="chat-footnote">
            AI может ошибиться в понимании. Проверьте условия поиска. План изменится только после
            нажатия «Применить».
          </p>
        </section>
        <div className="planning-workspace">
          <section className="planning-conditions" aria-label="Условия подбора">
            <div className="conditions-heading">
              <h2>
                <SlidersHorizontal size={20} /> Условия поиска
              </h2>
              <span className="pill">5 мер · до 100 ед.</span>
            </div>
            <div className="planning-goal">
              <label>
                Главная цель
                <select
                  value={constraints.goal}
                  onChange={(e) =>
                    updateConditions({
                      ...constraints,
                      goal: e.target.value as PlanConstraints["goal"],
                      districtId:
                        e.target.value === "district" ? (constraints.districtId ?? "nura") : null,
                    })
                  }
                >
                  {Object.entries(GOAL_LABELS).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {constraints.goal === "district" && (
                <label>
                  Приоритетный район
                  <select
                    value={constraints.districtId ?? "nura"}
                    onChange={(e) =>
                      updateConditions({
                        ...constraints,
                        districtId: e.target.value as PlanConstraints["districtId"],
                      })
                    }
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="conditions-caption">
              <LockSimple size={14} /> Закреплённые решения сохраняются во всех планах.
            </p>
            <div className="lock-options">
              {decisions.map((d) => {
                const locked = constraints.locked.some(
                  (l) => l.measureId === d.measureId && l.districtId === d.districtId,
                );
                return (
                  <button
                    key={d.measureId}
                    className={locked ? "locked" : ""}
                    aria-pressed={locked}
                    onClick={() => toggleLock(d)}
                  >
                    <LockSimple size={14} weight={locked ? "fill" : "regular"} />
                    {decisionLabel(d)}
                  </button>
                );
              })}
              {constraints.locked
                .filter(
                  (d) =>
                    !decisions.some(
                      (c) => c.measureId === d.measureId && c.districtId === d.districtId,
                    ),
                )
                .map((d) => (
                  <button
                    className="locked"
                    key={d.measureId}
                    aria-label={`Снять закрепление: ${decisionLabel(d)}`}
                    onClick={() => toggleLock(d)}
                  >
                    <LockSimple size={14} weight="fill" />
                    {decisionLabel(d)}
                    <X size={12} />
                  </button>
                ))}
            </div>
            {!decisions.length && !constraints.locked.length && (
              <p className="muted">Можно начать с нуля или назвать обязательные меры в чате.</p>
            )}
            <details className="exclude-options">
              <summary>
                Исключить мероприятия{" "}
                {constraints.excluded.length ? `(${constraints.excluded.length})` : ""}
              </summary>
              <div>
                {MEASURES.map((m) => (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      checked={constraints.excluded.includes(m.id)}
                      onChange={(e) =>
                        updateConditions({
                          ...constraints,
                          excluded: e.target.checked
                            ? [...constraints.excluded, m.id]
                            : constraints.excluded.filter((id) => id !== m.id),
                        })
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </details>
            {constraints.excluded.length > 0 && (
              <p className="conditions-caption">
                Исключены: {constraints.excluded.map((id) => MEASURE_BY_ID[id].name).join(", ")}
              </p>
            )}
            <button
              className="button primary"
              onClick={() => send(undefined, "search")}
              disabled={loading}
            >
              Подобрать планы <ArrowUpRight size={17} />
            </button>
          </section>
          {search ? (
            <section className="candidate-plans" aria-label="Подобранные планы">
              <div className="candidate-heading">
                <h2>Варианты решения</h2>
                <span>{search.evaluated.toLocaleString("ru-RU")} допустимых планов проверено</span>
              </div>
              {search.reason && (
                <p className="planning-empty" role="status">
                  {search.reason}
                </p>
              )}
              {search.plans.map((p, index) => (
                <article className="candidate-plan" key={scenarioKey(p.decisions)}>
                  <div className="candidate-title">
                    <span className="plan-number">0{index + 1}</span>
                    <div>
                      <h3>
                        {p.goals
                          .map((g) =>
                            g === "district"
                              ? `Приоритет: ${DISTRICTS.find((d) => d.id === constraints.districtId)?.name}`
                              : GOAL_LABELS[g],
                          )
                          .join(" · ")}
                      </h3>
                      <p>Лучший результат по цели при текущих условиях</p>
                    </div>
                    <strong>
                      {format(p.result.score)}
                      <small>Score</small>
                    </strong>
                  </div>
                  <div className="candidate-stats">
                    <span>
                      Бюджет <b>{p.result.cost}/100</b>
                    </span>
                    <span>
                      Дефициты <b>{p.result.critical.length}</b>
                    </span>
                    <span>
                      Слабейший <b>{format(p.result.weakest.score)}</b>
                    </span>
                  </div>
                  <ol className="candidate-measures">
                    {p.decisions.map((d) => (
                      <li key={d.measureId}>
                        <span>{decisionLabel(d)}</span>
                        {constraints.locked.some((l) => l.measureId === d.measureId) ? (
                          <LockSimple aria-label="Закреплено" size={13} />
                        ) : null}
                        <b>{MEASURE_BY_ID[d.measureId].cost}</b>
                      </li>
                    ))}
                  </ol>
                  {current && (
                    <div className="candidate-tradeoffs">
                      <p>
                        Относительно вашего плана:{" "}
                        <b>{signed(p.result.score - current.score)} Score</b>
                      </p>
                      <div>
                        {p.result.districts.map((d, i) => (
                          <span
                            key={d.id}
                            className={
                              d.score < current.districts[i].score
                                ? "negative-text"
                                : "positive-text"
                            }
                          >
                            {d.name} {signed(d.score - current.districts[i].score)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="candidate-actions">
                    <button className="button primary" onClick={() => onApply(p.decisions)}>
                      Применить план {index + 1}
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setStress({
                          decisions: p.decisions,
                          quarters: 2,
                          focus: null,
                          label: `Вариант ${index + 1} — проверка до применения`,
                        })
                      }
                    >
                      <ClockCountdown size={17} /> Проверить задержку
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="planning-empty">
              <ChatCircleDots size={32} weight="light" />
              <h2>Ваши приоритеты станут планом</h2>
              <p>
                Обсудите задачу в чате или задайте условия выше. Здесь появятся рассчитанные
                варианты с бюджетом, последствиями и компромиссами.
              </p>
            </div>
          )}
          {stress && (
            <ResiliencePanel
              key={`${scenarioKey(stress.decisions)}:${stress.quarters}:${stress.focus}`}
              decisions={stress.decisions}
              initialQuarters={stress.quarters}
              focusMeasureId={stress.focus}
              planLabel={stress.label}
            />
          )}
        </div>
      </div>
    </>
  );
}
