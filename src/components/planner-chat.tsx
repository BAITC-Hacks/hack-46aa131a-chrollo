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
import { CityMap } from "./city-map";
import { MarkdownMessage } from "./markdown-message";
import { testDelays } from "@/lib/resilience";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "**Что изменим в городе?**\n\nРасскажите о приоритетах. Я найду подходящие планы, сравню последствия и проверю задержки. Результат сразу появится на карте.\n\nЗакрепляйте важные решения и задавайте вопросы. **Применять план будете вы.**",
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
  const [preview, setPreview] = useState<Decision[] | null>(null);
  const [appliedNotice, setAppliedNotice] = useState("");
  const [mobilePane, setMobilePane] = useState<"city" | "chat">("city");
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
  const inspected = preview ?? decisions;
  const inspectedComplete = validate(inspected).valid;
  const previewIndex =
    search?.plans.findIndex((p) => scenarioKey(p.decisions) === scenarioKey(inspected)) ?? -1;
  const checks = useMemo(
    () => search?.plans.map((p) => testDelays(p.decisions, 2)) ?? [],
    [search],
  );
  const activeDelay = useMemo(() => {
    if (!stress) return undefined;
    const report = testDelays(stress.decisions, stress.quarters);
    return { measureId: stress.focus ?? report.worst.measureId, quarters: stress.quarters };
  }, [stress]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, loading]);
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStress(null);
    setPreview(null);
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
    setPreview(null);
    setAppliedNotice("");
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
      {
        role: "user",
        content: mode === "search" ? "Подбери планы по заданным условиям." : content,
      },
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
        decisions: inspected,
        appliedDecisions: decisions,
        scenarioContext: preview ? "preview" : "applied",
        experiment: activeDelay,
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
      if (reply.search) {
        setSearch(reply.search);
        setPreview(reply.search.plans[0]?.decisions ?? null);
        setAppliedNotice("");
      }
      if (reply.stress || reply.search)
        setStress(
          reply.stress
            ? {
                decisions: [...inspected],
                quarters: reply.stress.quarters,
                focus: reply.focusMeasureId,
                label: preview ? `Предпросмотр варианта ${previewIndex + 1}` : "Принятый план",
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
  function apply(next: Decision[]) {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    onApply(next);
    setPreview(null);
    setAppliedNotice("План принят. Карта показывает его результат; можно продолжить обсуждение.");
  }
  function inspect(next: Decision[] | null) {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setPreview(next);
    setStress(null);
    setAppliedNotice("");
  }

  return (
    <>
      <div className="page-heading studio-heading">
        <div>
          <p className="eyebrow">ГОРОДСКАЯ ЛАБОРАТОРИЯ / 8 КВАРТАЛОВ</p>
          <h1>Решения, которые меняют город.</h1>
          <p>Обсуждайте приоритеты. Сравнивайте последствия. Выбирайте план.</p>
        </div>
        <button className="text-button" onClick={reset}>
          Новый диалог
        </button>
      </div>
      <div className="studio-mobile-tabs" role="group" aria-label="Раздел рабочего экрана">
        <button aria-pressed={mobilePane === "city"} onClick={() => setMobilePane("city")}>
          Город{preview ? " · предпросмотр" : ""}
        </button>
        <button aria-pressed={mobilePane === "chat"} onClick={() => setMobilePane("chat")}>
          AI-помощник{loading ? " · работает" : ""}
        </button>
      </div>
      <div className="planning-layout" data-mobile-pane={mobilePane}>
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
                {m.role === "assistant" ? (
                  <MarkdownMessage content={m.content} />
                ) : (
                  <p>{m.content}</p>
                )}
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
                ...(inspectedComplete
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
          {search?.plans.length && messages.length > 1 && !loading ? (
            <div className="chat-followups">
              <button
                onClick={() =>
                  send("Сравни варианты в компактной таблице: Score, слабейший район и дефициты")
                }
              >
                Сравнить варианты
              </button>
              <button onClick={() => send("Проверь задержку каждой меры на 2 квартала")}>
                Проверить задержки
              </button>
            </div>
          ) : null}
          <div className="chat-context">
            <span className={preview ? "preview-dot" : "status-dot"} />
            Обсуждаем:{" "}
            {stress
              ? "эксперимент задержки"
              : preview
                ? `предпросмотр варианта ${previewIndex + 1}`
                : complete
                  ? "принятый план"
                  : decisions.length
                    ? "черновик сценария"
                    : "исходный город"}
          </div>
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
          <div className="scenario-switchbar">
            <div>
              <span className={preview ? "preview-dot" : "status-dot"} />
              <strong>
                {preview
                  ? `Вариант ${previewIndex + 1} · предпросмотр`
                  : complete
                    ? "Принятый план"
                    : decisions.length
                      ? "Черновик сценария"
                      : "Исходный город"}
              </strong>
              <span>{preview ? "Ещё не применён" : ""}</span>
            </div>
            {preview && !stress && (
              <div>
                <button className="text-button" onClick={() => inspect(null)}>
                  {complete ? "К принятому" : "К исходному"}
                </button>
                <button className="button primary" onClick={() => apply(preview)}>
                  Применить план <ArrowUpRight size={16} />
                </button>
              </div>
            )}
          </div>
          {appliedNotice && (
            <p className="applied-notice" role="status">
              {appliedNotice}
            </p>
          )}
          {!!search?.plans.length && (
            <div className="variant-tabs" role="group" aria-label="Сравнить варианты на карте">
              {search.plans.map((p, index) => (
                <button
                  key={scenarioKey(p.decisions)}
                  aria-pressed={!!preview && previewIndex === index}
                  onClick={() => inspect(p.decisions)}
                >
                  <span>
                    Вариант {index + 1} · {p.goals.map((g) => GOAL_LABELS[g]).join(" / ")}
                  </span>
                  <strong>
                    {format(p.result.score)} <small>Score</small>
                  </strong>
                  <span>Задержка: −{format(checks[index].worst.loss)} Score*</span>
                </button>
              ))}
            </div>
          )}
          {!!search?.plans.length && (
            <p className="variant-risk-note">
              * Худшая отдельная задержка на 2 квартала. Условный эксперимент.
            </p>
          )}
          {stress && activeDelay && (
            <div className="experiment-banner">
              <div>
                <strong>Эксперимент · +{stress.quarters} кварт.</strong>
                <span>{MEASURE_BY_ID[activeDelay.measureId].name}. План не изменяется.</span>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  abortRef.current?.abort();
                  abortRef.current = null;
                  setLoading(false);
                  setStress(null);
                }}
              >
                Без задержки
              </button>
            </div>
          )}
          <CityMap
            decisions={stress?.decisions ?? inspected}
            comparison={stress ? stress.decisions : preview && complete ? decisions : undefined}
            label={
              stress
                ? "С задержкой"
                : preview
                  ? "Предпросмотр"
                  : complete
                    ? "Принятый план"
                    : decisions.length
                      ? "Черновик"
                      : "Исходный город"
            }
            preview={!!preview || !!stress}
            delay={activeDelay}
          />
          {stress && (
            <ResiliencePanel
              key={scenarioKey(stress.decisions)}
              decisions={stress.decisions}
              initialQuarters={stress.quarters}
              focusMeasureId={stress.focus}
              planLabel={stress.label}
              onExperimentChange={(quarters, focus) => {
                abortRef.current?.abort();
                abortRef.current = null;
                setLoading(false);
                setStress({ ...stress, quarters, focus });
              }}
            />
          )}
          {search && search.plans.length > 0 && (
            <div className="search-evidence" role="status">
              <span>✓ {search.evaluated.toLocaleString("ru-RU")} допустимых планов</span>
              <span>✓ Бюджет и ограничения</span>
              <span>✓ {checks.length * 5} проверок задержки</span>
            </div>
          )}
          <details className="planning-conditions" open={!aiConfigured || undefined}>
            <summary className="conditions-summary">
              <SlidersHorizontal size={18} />
              <strong>Условия поиска</strong>
              <span>
                {GOAL_LABELS[constraints.goal]} · закреплено {constraints.locked.length} · исключено{" "}
                {constraints.excluded.length}
              </span>
            </summary>
            <div className="conditions-body">
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
                {inspected.map((d) => {
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
                      !inspected.some(
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
              {!inspected.length && !constraints.locked.length && (
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
            </div>
          </details>
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
                <article
                  className={`candidate-plan ${preview && previewIndex === index ? "candidate-selected" : ""}`}
                  key={scenarioKey(p.decisions)}
                >
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
                    <button
                      className="button primary"
                      aria-pressed={!!preview && previewIndex === index}
                      onClick={() => {
                        inspect(p.decisions);
                        document.querySelector(".scenario-switchbar")?.scrollIntoView({
                          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                            ? "instant"
                            : "smooth",
                          block: "start",
                        });
                      }}
                    >
                      {preview && previewIndex === index
                        ? "На карте"
                        : `На карту · вариант ${index + 1}`}
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        inspect(p.decisions);
                        setStress({
                          decisions: p.decisions,
                          quarters: 2,
                          focus: null,
                          label: `Вариант ${index + 1} — проверка до применения`,
                        });
                        requestAnimationFrame(() =>
                          document
                            .querySelector(".experiment-banner")
                            ?.scrollIntoView({ block: "start" }),
                        );
                      }}
                    >
                      <ClockCountdown size={17} /> Проверить задержку
                    </button>
                  </div>
                  <p className="candidate-risk">
                    Проверено автоматически: задержка каждой меры на 2 квартала. Наибольшее снижение
                    Score — <b>{format(checks[index].worst.loss)}</b> при задержке «
                    {MEASURE_BY_ID[checks[index].worst.measureId].name}».
                  </p>
                </article>
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
