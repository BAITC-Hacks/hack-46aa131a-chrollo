"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Buildings,
  ChatCircleDots,
  Info,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { EXAMPLE, MODEL_VERSION, type Decision } from "@/lib/data";
import { parseScenario, scenarioKey, validate } from "@/lib/engine";
import { makeReport, type Analysis } from "@/lib/report";
import { Overview } from "./overview";
import { Builder } from "./builder";
import { Results } from "./results";
import { PlannerChat } from "./planner-chat";
type View = "overview" | "builder" | "results" | "planner";
const STORAGE = "qala.scenario.v1";
const SAVED = "qala.comparison.v1";

export function Simulator() {
  const [view, setView] = useState<View>("overview");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [resultDecisions, setResultDecisions] = useState<Decision[] | null>(null);
  const [comparison, setComparison] = useState<Decision[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [apiNotice, setApiNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const shared = new URLSearchParams(location.search).get("scenario");
      const restored =
        shared !== null
          ? parseScenario(shared)
          : parseScenario(localStorage.getItem(STORAGE) ?? "");
      if (restored) {
        setDecisions(restored);
        if (shared !== null) {
          if (validate(restored).valid) {
            setResultDecisions(restored);
            setView("results");
          } else setView("builder");
        }
      } else setToast("Сохранённый сценарий не прошёл проверку. Начните новый.");
      const saved = localStorage.getItem(SAVED);
      if (saved) {
        const parsed = parseScenario(saved);
        if (parsed && validate(parsed).valid) setComparison(parsed);
      }
    } catch {
      setToast("Локальное сохранение недоступно. Симулятор продолжит работать.");
    }
    setHydrated(true);
    const abort = new AbortController();
    fetch("/api/status", { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => setAiConfigured(Boolean(d.aiConfigured)))
      .catch(() => {});
    return () => {
      abort.abort();
      requestRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE, scenarioKey(decisions));
      } catch {
        /* Private browsing may disallow storage. */
      }
    }
  }, [decisions, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => contentRef.current?.focus({ preventScroll: true }), 0);
  }
  function resetAnalysis() {
    requestRef.current?.abort();
    requestRef.current = null;
    setAnalysis(null);
    setApiNotice("");
    setLoading(false);
  }
  function change(next: Decision[]) {
    const v = validate(next, false);
    if (!v.valid) {
      setToast(v.errors[0]);
      return;
    }
    resetAnalysis();
    setDecisions(next);
    setResultDecisions(null);
    if (location.search) {
      history.replaceState(null, "", location.pathname);
    }
  }
  function calculate(next = decisions) {
    if (!validate(next).valid) {
      setToast(validate(next).errors[0]);
      return;
    }
    resetAnalysis();
    setDecisions(next);
    setResultDecisions(next);
    if (location.search) {
      const url = new URL(location.href);
      url.searchParams.set("scenario", scenarioKey(next));
      history.replaceState(null, "", url);
    }
    navigate("results");
  }
  function loadExample() {
    change(EXAMPLE);
    navigate("builder");
  }
  async function analyze() {
    if (!resultDecisions) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setApiNotice("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: resultDecisions }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error ?? "Не удалось получить анализ.");
      setAnalysis(data.analysis);
      setApiNotice(data.notice ?? "");
    } catch (e) {
      if (!controller.signal.aborted)
        setApiNotice(
          e instanceof Error
            ? e.message
            : "Ошибка соединения. Расчёт доступен, попробуйте ещё раз.",
        );
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }
  function save() {
    if (!resultDecisions) return;
    setComparison(resultDecisions);
    try {
      localStorage.setItem(SAVED, scenarioKey(resultDecisions));
      setToast("Сценарий сохранён. Измените решения, чтобы сравнить результаты.");
    } catch {
      setToast("Сравнение доступно до закрытия страницы.");
    }
  }
  function clearComparison() {
    setComparison(null);
    try {
      localStorage.removeItem(SAVED);
    } catch {}
  }
  function exportResult() {
    if (!resultDecisions) return;
    const report = makeReport(resultDecisions);
    const blob = new Blob(
      [JSON.stringify({ ...report, analysis: analysis ?? report.analysis }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qala-scenario-${MODEL_VERSION}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Отчёт скачан в формате JSON.");
  }
  async function share() {
    if (!resultDecisions) return;
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("scenario", scenarioKey(resultDecisions));
    try {
      await navigator.clipboard.writeText(url.toString());
      setToast("Ссылка скопирована. Она откроет сценарий на том же сервере приложения.");
    } catch {
      history.replaceState(null, "", url);
      setToast("Ссылка на сценарий теперь в адресной строке — скопируйте её.");
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <aside className="sidebar" aria-label="Навигация по симулятору">
        <a className="brand" href="/" aria-label="QALA — главная">
          <span className="brand-symbol">
            <Buildings size={27} weight="light" />
          </span>
          <span>
            qala<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-project">
          <span className="eyebrow">ГОРОДСКОЙ СИМУЛЯТОР</span>
          <strong>Аким на 5 часов</strong>
        </div>
        <nav aria-label="Основная навигация">
          <button
            aria-label="AI-помощник"
            className={view === "planner" ? "active" : ""}
            onClick={() => navigate("planner")}
            aria-current={view === "planner" ? "page" : undefined}
          >
            <ChatCircleDots size={20} />
            <span>AI-помощник</span>
          </button>
          <button
            aria-label="Обзор города"
            className={view === "overview" ? "active" : ""}
            onClick={() => navigate("overview")}
            aria-current={view === "overview" ? "page" : undefined}
          >
            <Buildings size={20} />
            <span>Обзор города</span>
          </button>
          <button
            aria-label="Мой сценарий"
            className={view === "builder" ? "active" : ""}
            onClick={() => navigate("builder")}
            aria-current={view === "builder" ? "page" : undefined}
          >
            <SlidersHorizontal size={20} />
            <span>Мой сценарий</span>
            {decisions.length > 0 ? <b>{decisions.length}</b> : null}
          </button>
          <button
            aria-label="Результат"
            className={view === "results" ? "active" : ""}
            onClick={() => navigate("results")}
            disabled={!resultDecisions}
            aria-current={view === "results" ? "page" : undefined}
          >
            <ArrowUpRight size={20} />
            <span>Результат</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-city">
            <Buildings size={38} weight="thin" />
          </span>
          <p>
            Хороший город —<br />
            это сумма решений.
          </p>
          <span>
            ASTANA INNOVATIONS
            <br />
            HACKALEM AI
          </span>
        </div>
        <a
          className="repo-link"
          href="https://github.com/BAITC-Hacks/hack-46aa131a-chrollo"
          target="_blank"
          rel="noreferrer"
        >
          Код и методика <ArrowUpRight size={14} />
        </a>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="breadcrumb">QALA /</span>
            <span>
              {view === "overview"
                ? "Обзор города"
                : view === "builder"
                  ? "Конструктор сценария"
                  : view === "planner"
                    ? "Диалог и подбор планов"
                    : "Отчёт о решениях"}
            </span>
          </div>
          <div className="topbar-right">
            <span className={`ai-status ${aiConfigured ? "connected" : ""}`}>
              <span className="status-dot" />
              {aiConfigured === null
                ? "Проверка AI…"
                : aiConfigured
                  ? "OpenAI подключён"
                  : "Расчётный режим"}
            </span>
            <span className="model-label">МОДЕЛЬ 1.0</span>
          </div>
        </header>
        <main id="main" ref={contentRef} tabIndex={-1}>
          {view === "overview" ? (
            <Overview onStart={() => navigate("planner")} onExample={loadExample} />
          ) : view === "builder" ? (
            <Builder
              decisions={decisions}
              onChange={change}
              onCalculate={() => calculate()}
              onNotice={setToast}
            />
          ) : view === "results" && resultDecisions ? (
            <Results
              decisions={resultDecisions}
              analysis={analysis}
              notice={apiNotice}
              loading={loading}
              onAnalyze={analyze}
              onEdit={() => navigate("builder")}
              onDiscuss={() => navigate("planner")}
              onApply={(next) => {
                setComparison(resultDecisions);
                try {
                  localStorage.setItem(SAVED, scenarioKey(resultDecisions));
                } catch {}
                calculate(next);
              }}
              comparison={comparison}
              onSave={save}
              onClearComparison={clearComparison}
              onExport={exportResult}
              onShare={share}
            />
          ) : null}
          <div hidden={view !== "planner"}>
            <PlannerChat
              decisions={decisions}
              aiConfigured={aiConfigured}
              onApply={(next) => {
                if (validate(decisions).valid) {
                  setComparison(decisions);
                  try {
                    localStorage.setItem(SAVED, scenarioKey(decisions));
                  } catch {}
                }
                calculate(next);
              }}
            />
          </div>
          <footer className="footer">
            <span>QALA · Astana Innovations</span>
            <span>Учебная модель · синтетические данные · 2026</span>
          </footer>
        </main>
      </div>
      {toast ? (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Закрыть уведомление"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
