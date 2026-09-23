"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Buildings, Bus, Check, CheckCircle, Clock, DownloadSimple, Heartbeat, Info, Leaf, LinkSimple, Plus, ShieldCheck, SlidersHorizontal, Sparkle, Trash, WarningCircle, Waves, X } from "@phosphor-icons/react";
import { BUDGET, CATEGORIES, DISTRICTS, EXAMPLE, MEASURES, MEASURE_BY_ID, METRICS, MODEL_VERSION, type CategoryId, type Decision, type DistrictId, type Measure } from "@/lib/data";
import { BASELINE, format, parseScenario, scenarioKey, signed, validate, type Simulation } from "@/lib/engine";
import { makeReport, type Analysis, type Evidence, type Insight } from "@/lib/report";

type View = "overview" | "builder" | "results";
const ICONS = { transport: Bus, ecology: Leaf, social: Heartbeat, safety: ShieldCheck, services: Waves };
const STORAGE = "qala.scenario.v1";
const SAVED = "qala.comparison.v1";
const districtName = (id?: DistrictId) => DISTRICTS.find(d=>d.id===id)?.name ?? "Весь город";

function CategoryIcon({id,size=20}:{id:CategoryId;size?:number}) { const Icon=ICONS[id]; return <Icon size={size} weight="regular" aria-hidden="true"/>; }

function CityDiagram({selected,onSelect}:{selected:DistrictId;onSelect:(id:DistrictId)=>void}) {
  const shapes = [
    {id:"saryarka",path:"M35 52 181 29 233 91 202 165 83 182 29 128",x:22,y:29},
    {id:"baikonur",path:"M198 29 337 44 379 109 285 161 220 161 252 91",x:53,y:27},
    {id:"almaty",path:"M394 112 508 83 557 175 495 255 385 221 298 177",x:78,y:47},
    {id:"esil",path:"M80 211 206 189 279 211 307 318 156 336 62 284",x:31,y:73},
    {id:"nura",path:"M300 211 371 243 487 278 469 329 338 345",x:66,y:81},
  ];
  return <div className="city-diagram">
    <svg viewBox="0 0 590 370" aria-hidden="true">
      <defs><pattern id="city-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#dfe7e3" strokeWidth=".7"/></pattern></defs>
      <rect width="590" height="370" fill="url(#city-grid)"/>
      <path d="M0 195C130 192 159 168 233 178S364 235 423 249 525 265 590 245" fill="none" stroke="#b7d2d6" strokeWidth="12"/>
      <path d="M0 195C130 192 159 168 233 178S364 235 423 249 525 265 590 245" fill="none" stroke="#d7e8e9" strokeWidth="5"/>
      {shapes.map(s=><path key={s.id} d={s.path} fill={selected===s.id?"#d7e8da":"#edf1ea"} stroke={selected===s.id?"#427960":"#c5d0c7"} strokeWidth={selected===s.id?2:1}/>) }
      <path d="M50 96 483 297M169 48 393 307M75 269 477 149M115 134 438 193" stroke="#fff" strokeWidth="3" fill="none" strokeDasharray="5 5" opacity=".8"/>
    </svg>
    {shapes.map(s=>{const d=BASELINE.districts.find(d=>d.id===s.id)!;return <button key={s.id} className={`map-label ${selected===s.id?"active":""}`} style={{left:`${s.x}%`,top:`${s.y}%`}} onClick={()=>onSelect(d.id)} aria-pressed={selected===s.id} aria-label={`Район ${d.name}, оценка ${format(d.score)}`}><span>{d.name}</span><b>{format(d.score,1)}</b>{s.id==="nura"?<i>Требует внимания</i>:null}</button>;})}
    <span className="map-north">С ↑</span><span className="map-note">Схема районов · условная геометрия</span>
  </div>;
}

function Overview({onStart,onExample}:{onStart:()=>void;onExample:()=>void}) {
  const [selected,setSelected]=useState<DistrictId>("nura");
  const district=BASELINE.districts.find(d=>d.id===selected)!;
  return <>
    <section className="intro">
      <div><p className="eyebrow">АСТАНА · ГОРОДСКАЯ ЛАБОРАТОРИЯ</p><h1>Пять решений.<br/><span>Один город.</span></h1><p className="intro-copy">Распределите бюджет и посмотрите, как ваши решения изменят жизнь районов через два условных года.</p><div className="intro-actions"><button className="button primary" onClick={onStart}>Создать сценарий <ArrowRight size={18}/></button><button className="text-button" onClick={onExample}>Посмотреть пример <ArrowUpRight size={17}/></button></div></div>
      <div className="brief-sheet"><span className="eyebrow">ВАШ МАНДАТ</span><div className="mandate-row"><strong>100<span>ед.</span></strong><p>Один бюджет.<br/>Вы выбираете приоритеты.</p></div><div className="mandate-row"><strong>5<span>мер</span></strong><p>Каждое решение<br/>имеет последствия.</p></div><div className="brief-footer"><span className="status-dot"/> Одинаковые условия для всех</div></div>
    </section>
    <section className="city-section" aria-labelledby="city-title"><div className="section-heading"><div><p className="eyebrow">ИСХОДНАЯ СИТУАЦИЯ</p><h2 id="city-title">Город в разрезе районов</h2></div><span className="pill">Синтетические данные</span></div>
      <div className="city-overview"><div className="map-panel"><div className="map-caption"><span><Buildings size={17}/> Пять районов Астаны</span><span>Выберите район</span></div><CityDiagram selected={selected} onSelect={setSelected}/><div className="map-legend"><span><i className="legend-dot green"/> Выбранный район</span><span>Показатели от 0 до 100 · больше = лучше</span></div></div>
      <div className="district-panel"><div className="district-panel-head"><div><p className="eyebrow">{Math.round(district.population*100)}% НАСЕЛЕНИЯ МОДЕЛИ</p><h3>{district.name}</h3></div><strong className="district-score">{format(district.score,1)}<small>/ 100</small></strong></div><p className="district-description">{district.description}</p><div className="category-bars">{CATEGORIES.map(c=>{const metrics=METRICS.filter(m=>m.category===c.id);const value=metrics.reduce((s,m)=>s+district.indicators[m.id]*m.weight,0)/metrics.reduce((s,m)=>s+m.weight,0);return <div className="category-bar" key={c.id}><div><span><CategoryIcon id={c.id} size={16}/>{c.short}</span><b>{format(value,1)}</b></div><div className="bar-track"><i style={{width:`${value}%`,background:c.color}}/></div></div>;})}</div><div className="district-footnote"><Info size={16}/><span>Оценка района учитывает веса всех десяти показателей.</span></div></div></div>
    </section>
    <section className="baseline-strip"><div><span>Astana Quality of Life Score</span><strong>{format(BASELINE.score)}<small>/100</small></strong></div><div><span>Средний балл города</span><strong>{format(BASELINE.average)}</strong></div><div><span>Самый слабый район</span><strong>Нура <small>{format(BASELINE.weakest.score)}</small></strong></div><div><span>Критические показатели</span><strong className="warning-text">2 <small>школы и медицина</small></strong></div></section>
    <details className="method-details"><summary><Info size={18}/> Как устроены данные и оценка?<span>Открыть методику</span></summary><div className="method-content"><p>Модель использует подготовленные данные хакатона. Они не описывают фактическое состояние районов Астаны. Все показатели находятся в диапазоне от 0 до 100.</p><p><strong>Score = 0,7 × средний балл города + 0,3 × балл слабейшего района − число критических показателей.</strong> Средний балл взвешен по доле населения; критическими считаются значения строго ниже 40.</p><p>Горизонт — 8 кварталов. Эффект меры умножается на (8 − задержка) / 8. Бонусы сочетаний фиксированы. Ровно 5 мер, не более 2 из одного направления, без повторов и запрещённых сочетаний.</p><p>Следуем подробным правилам датасета: охват всех пяти направлений не обязателен. В исходном общем условии эта формулировка неоднозначна.</p></div></details>
  </>;
}

function MeasureCard({measure,decisions,onChange,onNotice}:{measure:Measure;decisions:Decision[];onChange:(d:Decision[])=>void;onNotice:(s:string)=>void}) {
  const selected=decisions.find(d=>d.measureId===measure.id);
  const [target,setTarget]=useState<DistrictId>("nura");
  const districtId=selected?.districtId ?? target;
  const decision: Decision=measure.scope==="city"?{measureId:measure.id}:{measureId:measure.id,districtId};
  const candidate=[...decisions,decision];
  const check=validate(candidate,false);
  const color=CATEGORIES.find(c=>c.id===measure.category)!.color;
  function changeDistrict(id:DistrictId){setTarget(id);if(selected){const next=decisions.map(d=>d.measureId===measure.id?{measureId:measure.id,districtId:id}:d);const v=validate(next,false);if(v.valid)onChange(next);else onNotice(v.errors[0]);}}
  return <article className={`measure-card ${selected?"selected":""}`}>
    <div className="measure-top"><span className="category-mark" style={{color}}><CategoryIcon id={measure.category}/>{CATEGORIES.find(c=>c.id===measure.category)!.short}</span><span className="measure-id">{measure.id}</span></div>
    <h3>{measure.name}</h3><p>{measure.description}</p>
    <div className="effect-tags">{Object.entries(measure.effects).map(([key,value])=>{const metric=METRICS.find(m=>m.id===key)!;const effect=value*(8-measure.lag)/8;return <span key={key} className={effect<0?"negative":""} title={`${metric.name}: полный эффект ${value}, после задержки ${effect}`}><b>{key} {signed(effect)}</b><span>{metric.name}</span></span>;})}</div>
    <div className="measure-timing"><Clock size={14}/><span>Задержка {measure.lag} кв. · эффект за 2 года</span></div>
    <div className="measure-controls">{measure.scope==="district"?<label className="select-wrap"><span className="sr-only">Район для {measure.name}</span><select value={districtId} onChange={e=>changeDistrict(e.target.value as DistrictId)}>{DISTRICTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>:<span className="city-scope"><Buildings size={16}/> Весь город</span>}<span className="cost"><b>{measure.cost}</b> ед.</span></div>
    <button className={`measure-add ${selected?"is-selected":""}`} onClick={()=>selected?onChange(decisions.filter(d=>d.measureId!==measure.id)):onChange(candidate)} disabled={!selected&&!check.valid}>{selected?<><Check size={17}/>В сценарии · убрать</>:<><Plus size={17}/>Добавить решение</>}</button>
    {!selected&&!check.valid?<p className="rule-hint">{check.errors[0]}</p>:null}
  </article>;
}

function Builder({decisions,onChange,onCalculate,onNotice}:{decisions:Decision[];onChange:(d:Decision[])=>void;onCalculate:()=>void;onNotice:(s:string)=>void}) {
  const [category,setCategory]=useState<CategoryId|"all">("all");
  const validation=validate(decisions);
  const remaining=BUDGET-validation.cost;
  return <>
    <div className="page-heading"><div><p className="eyebrow">ВАШ СЦЕНАРИЙ</p><h1>Выберите, что изменится.</h1><p>Пять мероприятий. Не более двух из одного направления. Последствия — в деталях.</p></div><button className="button secondary" onClick={()=>onChange(EXAMPLE)}>Загрузить пример</button></div>
    <div className="builder-layout"><section className="catalog" aria-label="Каталог мероприятий"><div className="filter-tabs" aria-label="Направления"><button className={category==="all"?"active":""} onClick={()=>setCategory("all")} aria-pressed={category==="all"}>Все меры <span>14</span></button>{CATEGORIES.map(c=><button key={c.id} className={category===c.id?"active":""} onClick={()=>setCategory(c.id)} aria-pressed={category===c.id}><CategoryIcon id={c.id} size={16}/>{c.short}</button>)}</div><div className="measure-grid">{MEASURES.filter(m=>category==="all"||m.category===category).map(m=><MeasureCard key={m.id} measure={m} decisions={decisions} onChange={onChange} onNotice={onNotice}/>)}</div></section>
    <aside className="plan-panel"><div className="plan-top"><span className="eyebrow">БЮДЖЕТ СЦЕНАРИЯ</span><span className="budget-value">{remaining}<small> / 100</small></span><span className="muted">условных единиц осталось</span><div className="budget-track">{decisions.map(d=>{const m=MEASURE_BY_ID[d.measureId];return <span key={d.measureId} title={`${m.name}: ${m.cost}`} style={{width:`${m.cost}%`,background:CATEGORIES.find(c=>c.id===m.category)!.color}}/>;})}</div><div className="budget-caption"><span>Потрачено {validation.cost}</span><span>Лимит 100</span></div></div>
      <div className="plan-title"><h2>Ваши решения</h2><span>{decisions.length} / 5</span></div><ol className="decision-list">{Array.from({length:5},(_,i)=>{const d=decisions[i];const m=d?MEASURE_BY_ID[d.measureId]:null;return <li key={i} className={d?"filled":"empty"}><span className="decision-number">{String(i+1).padStart(2,"0")}</span>{d&&m?<><div><b>{m.name}</b><small>{districtName(d.districtId)} · {m.cost} ед.</small></div><button className="icon-button" aria-label={`Убрать ${m.name}`} onClick={()=>onChange(decisions.filter((_,j)=>i!==j))}><X size={16}/></button></>:<span>Добавьте мероприятие</span>}</li>;})}</ol>
      <div className="plan-directions">{CATEGORIES.map(c=>{const count=decisions.filter(d=>MEASURE_BY_ID[d.measureId].category===c.id).length;return <span key={c.id} className={count?"covered":""} title={`${c.name}: ${count} из 2`}><CategoryIcon id={c.id} size={17}/>{count}/2</span>;})}</div>
      <button className="button primary full" disabled={!validation.valid} onClick={onCalculate}>Рассчитать сценарий <ArrowRight size={18}/></button><p className="plan-help">{validation.valid?"Все ограничения соблюдены. Можно оценить результат.":decisions.length<5?`Добавьте ещё ${5-decisions.length} ${5-decisions.length===1?"мероприятие":"мероприятия"}.`:validation.errors[0]}</p>
      {decisions.length>0?<button className="text-button clear-plan" onClick={()=>onChange([])}><Trash size={15}/> Очистить сценарий</button>:null}
      <details className="plan-rules"><summary>Ограничения и сочетания</summary><p>Полосы и ЛРТ несовместимы в любом районе. Парк и школа, а также чистое топливо и обновление сетей несовместимы в одном районе.</p><p>Бонусы: полосы + светофоры → T1 +2; камеры + обращения → B1 +2; топливо + озеленение → E2 +2. Бонус действует в районе первой меры.</p><p>Остаток бюджета не даёт бонусных баллов.</p></details>
    </aside></div>
  </>;
}

function DistrictComparison({result,comparison}:{result:Simulation;comparison:Simulation|null}) {
  return <section className="report-section"><div className="section-heading compact"><div><p className="eyebrow">РАСПРЕДЕЛЕНИЕ ЭФФЕКТА</p><h2>Что изменилось в районах</h2></div></div><div className="comparison-legend"><span><i className="legend-dot grey"/>{comparison?"Сохранённый сценарий":"До решений"}</span><span><i className="legend-dot green"/>Текущий сценарий</span></div><div className="district-comparison">{result.districts.map((d,i)=>{const before=(comparison??BASELINE).districts[i].score;return <div className="district-result" key={d.id}><div className="district-result-name"><b>{d.name}</b><span>{Math.round(d.population*100)}% населения</span></div><div className="comparison-track"><span style={{width:`${before}%`}}/><i style={{width:`${d.score}%`}}/></div><div className="district-result-number"><strong>{format(d.score)}</strong><span className={d.score-before<0?"negative-text":"positive-text"}>{signed(d.score-before)}</span></div></div>;})}</div></section>;
}

function InsightBlock({insight,evidence}:{insight:Insight;evidence:Evidence[]}){return <article className="insight"><h4>{insight.title}</h4><p>{insight.text}</p><div className="evidence-list">{insight.evidenceIds.map(id=>{const e=evidence.find(e=>e.id===id);return e?<details key={id}><summary>{e.label} <Info size={12}/></summary><p>{e.value}</p></details>:null;})}</div></article>;}

function Results({decisions,analysis,notice,loading,onAnalyze,onEdit,onApply,comparison,onSave,onClearComparison,onExport,onShare}:{decisions:Decision[];analysis:Analysis|null;notice:string;loading:boolean;onAnalyze:()=>void;onEdit:()=>void;onApply:(d:Decision[])=>void;comparison:Decision[]|null;onSave:()=>void;onClearComparison:()=>void;onExport:()=>void;onShare:()=>void}) {
  const report=useMemo(()=>makeReport(decisions),[decisions]);
  const comparisonReport=useMemo(()=>comparison?makeReport(comparison):null,[comparison]);
  const {result,alternative,attribution,evidence}=report;
  const ai=analysis??report.analysis;
  return <>
    <div className="page-heading"><div><p className="eyebrow">ГОРИЗОНТ · 8 КВАРТАЛОВ</p><h1>Решения становятся результатом.</h1><p>Посмотрите, кому помог ваш сценарий и какие компромиссы он оставил.</p></div><button className="button secondary" onClick={onEdit}><SlidersHorizontal size={17}/> Изменить решения</button></div>
    <section className="result-summary"><div className="score-main"><span>ASTANA QUALITY OF LIFE SCORE</span><div className="score-line"><strong data-testid="final-score">{format(result.score)}</strong><span>/ 100</span><b>{signed(result.score-BASELINE.score)}<ArrowUpRight size={18}/></b></div><p>Исходный балл {format(BASELINE.score)} · синтетическая модель</p></div><div className="result-stat"><span>Бюджет</span><strong>{result.cost}<small>/100</small></strong><p>{100-result.cost} ед. осталось</p></div><div className="result-stat"><span>Критические значения</span><strong>{result.critical.length}<small>было 2</small></strong><p>{result.critical.length===0?"Все показатели ≥ 40":"Есть значения ниже 40"}</p></div><div className="result-stat"><span>Самый слабый район</span><strong>{format(result.weakest.score,1)}</strong><p>{result.weakest.name}</p></div></section>
    <div className="report-toolbar"><div><button className="text-button" onClick={onSave}><Plus size={16}/>Сохранить для сравнения</button>{comparison?<button className="text-button muted" onClick={onClearComparison}><X size={14}/>Убрать сравнение</button>:null}</div><div><button className="text-button" onClick={onShare}><LinkSimple size={16}/>Ссылка</button><button className="text-button" onClick={onExport}><DownloadSimple size={16}/>Скачать JSON</button></div></div>
    {comparisonReport?<div className="comparison-banner"><span>Сравнение с сохранённым сценарием: <b>{format(comparisonReport.result.score)}</b></span><span>Разница Score <b>{signed(result.score-comparisonReport.result.score)}</b> · бюджета <b>{signed(result.cost-comparisonReport.result.cost)}</b></span></div>:null}
    <div className="results-layout"><div className="results-main"><DistrictComparison result={result} comparison={comparisonReport?.result??null}/>
    <section className="report-section"><div className="section-heading compact"><div><p className="eyebrow">ОБЪЯСНИМЫЙ РЕЗУЛЬТАТ</p><h2>Вклад каждого решения</h2></div></div><p className="section-description">Вклад учитывает сочетания мер, критические пороги и положение слабейшего района.</p><div className="contribution-list">{[...attribution].sort((a,b)=>b.contribution-a.contribution).map(a=>{const m=MEASURE_BY_ID[a.measureId];return <div key={a.measureId}><span className="contribution-icon" style={{color:CATEGORIES.find(c=>c.id===m.category)!.color}}><CategoryIcon id={m.category}/></span><div><b>{m.name}</b><small>{districtName(a.districtId)} · {m.cost} ед.</small></div><strong className={a.contribution>=0?"positive-text":"negative-text"}>{signed(a.contribution)}</strong></div>;})}</div><details className="plain-details"><summary>Как посчитан вклад?</summary><p>Точные значения Шепли: для каждой меры усредняем её прирост по всем порядкам добавления. Проверяются все 32 поднабора пяти мер. Вклад мер суммируется в общее изменение Score. Поднаборы используются только для объяснения, а не как допустимые финальные сценарии.</p></details></section>
    <section className="report-section"><div className="section-heading compact"><div><p className="eyebrow">ПРОВЕРЕННАЯ АЛЬТЕРНАТИВА</p><h2>{alternative?"Одна замена — другой результат":"Лучшая замена не найдена"}</h2></div>{alternative?<span className="gain-badge">{signed(alternative.gain)} к Score</span>:null}</div><p className="section-description">{alternative?"Перебрали все допустимые замены одного решения, включая смену района. Предложение укладывается в бюджет.":"Ни одна допустимая замена одного решения не повышает Score. Это не означает глобальный оптимум: сочетание нескольких замен может быть лучше."}</p>{alternative?<><div className="swap-row"><div><span>Заменить</span><b>{MEASURE_BY_ID[alternative.removed.measureId].name}</b><small>{districtName(alternative.removed.districtId)}</small></div><ArrowRight size={20}/><div><span>На</span><b>{MEASURE_BY_ID[alternative.added.measureId].name}</b><small>{districtName(alternative.added.districtId)}</small></div></div><div className="alternative-footer"><span>Score <b>{format(alternative.result.score)}</b> · бюджет <b>{alternative.result.cost}/100</b></span><button className="button secondary" onClick={()=>onApply(alternative.decisions)}>Применить замену <ArrowRight size={15}/></button></div><p className="fine-print">Улучшение целевой оценки может перераспределить пользу между районами. Сравните показатели перед выбором.</p></>:null}</section>
    </div><aside className="analysis-panel"><div className="analysis-heading"><span className="ai-icon"><Sparkle size={23}/></span><div><h2>Разбор сценария</h2><span>{ai.source==="openai"?`OpenAI · ${ai.model}`:"Объяснение по правилам модели"}</span></div></div><p className="analysis-summary">{ai.summary}</p><button className="button primary full" onClick={onAnalyze} disabled={loading}>{loading?<><span className="spinner"/> Анализируем последствия…</>:<><Sparkle size={18}/>{ai.source==="openai"?"Повторить AI-анализ":"Получить AI-анализ"}</>}</button>{notice?<p className="api-notice" role="status">{notice}</p>:null}<div className="analysis-group"><h3><CheckCircle size={17}/>Сильные стороны</h3>{ai.strengths.map((s,i)=><InsightBlock key={i} insight={s} evidence={evidence}/>)}</div><div className="analysis-group risks"><h3><WarningCircle size={17}/>Риски и компромиссы</h3>{ai.risks.map((s,i)=><InsightBlock key={i} insight={s} evidence={evidence}/>)}</div><div className="analysis-recommendation"><span className="eyebrow">РЕКОМЕНДАЦИЯ</span><p>{ai.recommendation}</p></div><p className="fine-print">AI объясняет расчёт, но не определяет балл. Проверяйте выводы по фактам под каждым тезисом.</p></aside></div>
    <section className="report-section indicators-section"><div className="section-heading compact"><div><p className="eyebrow">ВСЕ ДАННЫЕ ОТКРЫТЫ</p><h2>Показатели после решений</h2></div><span className="pill">Критический порог: &lt; 40</span></div><div className="table-scroll"><table><caption className="sr-only">Значения десяти показателей по районам после выбранных мер</caption><thead><tr><th scope="col">Район</th>{METRICS.map(m=><th scope="col" key={m.id} title={m.name}>{m.id}<small>{m.name}</small></th>)}</tr></thead><tbody>{result.districts.map((d,i)=><tr key={d.id}><th scope="row">{d.name}</th>{METRICS.map(m=>{const delta=d.indicators[m.id]-DISTRICTS[i].indicators[m.id];return <td key={m.id} className={d.indicators[m.id]<40?"critical-cell":""}><b>{format(d.indicators[m.id],1)}</b>{delta!==0?<small className={delta>0?"positive-text":"negative-text"}>{signed(delta)}</small>:<small>—</small>}</td>;})}</tr>)}</tbody></table></div></section>
  </>;
}

export function Simulator(){
  const [view,setView]=useState<View>("overview");
  const [decisions,setDecisions]=useState<Decision[]>([]);
  const [resultDecisions,setResultDecisions]=useState<Decision[]|null>(null);
  const [comparison,setComparison]=useState<Decision[]|null>(null);
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [apiNotice,setApiNotice]=useState("");
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState("");
  const [aiConfigured,setAiConfigured]=useState<boolean|null>(null);
  const [hydrated,setHydrated]=useState(false);
  const requestRef=useRef<AbortController|null>(null);
  const contentRef=useRef<HTMLElement>(null);

  useEffect(()=>{
    try{
      const shared=new URLSearchParams(location.search).get("scenario");
      const restored=shared!==null?parseScenario(shared):parseScenario(localStorage.getItem(STORAGE)??"");
      if(restored){setDecisions(restored);if(shared!==null){if(validate(restored).valid){setResultDecisions(restored);setView("results");}else setView("builder");}}
      else setToast("Сохранённый сценарий не прошёл проверку. Начните новый.");
      const saved=localStorage.getItem(SAVED);if(saved){const parsed=parseScenario(saved);if(parsed&&validate(parsed).valid)setComparison(parsed);}
    }catch{setToast("Локальное сохранение недоступно. Симулятор продолжит работать.");}
    setHydrated(true);
    const abort=new AbortController();fetch("/api/status",{signal:abort.signal}).then(r=>r.json()).then(d=>setAiConfigured(Boolean(d.aiConfigured))).catch(()=>{});
    return ()=>{abort.abort();requestRef.current?.abort();};
  },[]);
  useEffect(()=>{if(hydrated){try{localStorage.setItem(STORAGE,scenarioKey(decisions));}catch{ /* Private browsing may disallow storage. */ }}},[decisions,hydrated]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),5500);return ()=>clearTimeout(timer);},[toast]);

  function navigate(next:View){setView(next);window.scrollTo({top:0,behavior:"instant"});setTimeout(()=>contentRef.current?.focus({preventScroll:true}),0);}
  function resetAnalysis(){requestRef.current?.abort();requestRef.current=null;setAnalysis(null);setApiNotice("");setLoading(false);}
  function change(next:Decision[]){const v=validate(next,false);if(!v.valid){setToast(v.errors[0]);return;}resetAnalysis();setDecisions(next);setResultDecisions(null);if(location.search){history.replaceState(null,"",location.pathname);}}
  function calculate(next=decisions){if(!validate(next).valid){setToast(validate(next).errors[0]);return;}resetAnalysis();setDecisions(next);setResultDecisions(next);navigate("results");}
  function loadExample(){change(EXAMPLE);navigate("builder");}
  async function analyze(){
    if(!resultDecisions)return;
    requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;setLoading(true);setApiNotice("");
    try{const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decisions:resultDecisions}),signal:controller.signal});const data=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(data.error??"Не удалось получить анализ.");setAnalysis(data.analysis);setApiNotice(data.notice??"");}
    catch(e){if(!controller.signal.aborted)setApiNotice(e instanceof Error?e.message:"Ошибка соединения. Расчёт доступен, попробуйте ещё раз.");}
    finally{if(requestRef.current===controller)setLoading(false);}
  }
  function save(){if(!resultDecisions)return;setComparison(resultDecisions);try{localStorage.setItem(SAVED,scenarioKey(resultDecisions));setToast("Сценарий сохранён. Измените решения, чтобы сравнить результаты.");}catch{setToast("Сравнение доступно до закрытия страницы.");}}
  function clearComparison(){setComparison(null);try{localStorage.removeItem(SAVED);}catch{}}
  function exportResult(){if(!resultDecisions)return;const report=makeReport(resultDecisions);const blob=new Blob([JSON.stringify({...report,analysis:analysis??report.analysis},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`qala-scenario-${MODEL_VERSION}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast("Отчёт скачан в формате JSON.");}
  async function share(){if(!resultDecisions)return;const url=new URL(location.href);url.search="";url.searchParams.set("scenario",scenarioKey(resultDecisions));try{await navigator.clipboard.writeText(url.toString());setToast("Ссылка скопирована. Она откроет сценарий на том же сервере приложения.");}catch{history.replaceState(null,"",url);setToast("Ссылка на сценарий теперь в адресной строке — скопируйте её.");}}

  return <div className="app-shell"><a className="skip-link" href="#main">Перейти к содержимому</a><aside className="sidebar"><a className="brand" href="/" aria-label="QALA — главная"><span className="brand-symbol"><Buildings size={27} weight="light"/></span><span>qala<span className="brand-dot">.</span></span></a><div className="sidebar-project"><span className="eyebrow">ГОРОДСКОЙ СИМУЛЯТОР</span><strong>Аким на 5 часов</strong></div><nav aria-label="Основная навигация"><button className={view==="overview"?"active":""} onClick={()=>navigate("overview")} aria-current={view==="overview"?"page":undefined}><Buildings size={20}/><span>Обзор города</span></button><button className={view==="builder"?"active":""} onClick={()=>navigate("builder")} aria-current={view==="builder"?"page":undefined}><SlidersHorizontal size={20}/><span>Мой сценарий</span>{decisions.length>0?<b>{decisions.length}</b>:null}</button><button className={view==="results"?"active":""} onClick={()=>navigate("results")} disabled={!resultDecisions} aria-current={view==="results"?"page":undefined}><ArrowUpRight size={20}/><span>Результат</span></button></nav><div className="sidebar-note"><span className="tiny-city"><Buildings size={38} weight="thin"/></span><p>Хороший город —<br/>это сумма решений.</p><span>ASTANA INNOVATIONS<br/>HACKALEM AI</span></div><a className="repo-link" href="https://github.com/BAITC-Hacks/hack-46aa131a-chrollo" target="_blank" rel="noreferrer">Код и методика <ArrowUpRight size={14}/></a></aside>
    <div className="workspace"><header className="topbar"><div><span className="breadcrumb">QALA /</span><span>{view==="overview"?"Обзор города":view==="builder"?"Конструктор сценария":"Отчёт о решениях"}</span></div><div className="topbar-right"><span className={`ai-status ${aiConfigured?"connected":""}`}><span className="status-dot"/>{aiConfigured===null?"Проверка AI…":aiConfigured?"OpenAI подключён":"Расчётный режим"}</span><span className="model-label">МОДЕЛЬ 1.0</span></div></header>
      <main id="main" ref={contentRef} tabIndex={-1}>{view==="overview"?<Overview onStart={()=>navigate("builder")} onExample={loadExample}/>:view==="builder"?<Builder decisions={decisions} onChange={change} onCalculate={()=>calculate()} onNotice={setToast}/>:resultDecisions?<Results decisions={resultDecisions} analysis={analysis} notice={apiNotice} loading={loading} onAnalyze={analyze} onEdit={()=>navigate("builder")} onApply={next=>{setComparison(resultDecisions);try{localStorage.setItem(SAVED,scenarioKey(resultDecisions));}catch{}calculate(next);}} comparison={comparison} onSave={save} onClearComparison={clearComparison} onExport={exportResult} onShare={share}/>:null}
      <footer className="footer"><span>QALA · Astana Innovations</span><span>Учебная модель · синтетические данные · 2026</span></footer></main>
    </div>{toast?<div className="toast" role="status"><Info size={18}/><span>{toast}</span><button className="icon-button" onClick={()=>setToast("")} aria-label="Закрыть уведомление"><X size={16}/></button></div>:null}
  </div>;
}
