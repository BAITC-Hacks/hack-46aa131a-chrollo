import { type Decision, DISTRICTS, MEASURE_BY_ID, METRICS, MODEL_VERSION } from "./data";
import { BASELINE, attribute, decisionLabel, format, recommend, signed, simulate, type Alternative, type Simulation } from "./engine";

export interface Evidence { id: string; label: string; value: string }
export interface Insight { title: string; text: string; evidenceIds: string[] }
export interface Analysis { source: "openai" | "local"; model?: string; summary: string; strengths: Insight[]; risks: Insight[]; recommendation: string }

export function buildEvidence(decisions: Decision[], result: Simulation, alternative: Alternative | null): Evidence[] {
  const facts: Evidence[] = [
    { id: "score", label: "Итоговый Score", value: `${format(BASELINE.score)} → ${format(result.score)} (${signed(result.score - BASELINE.score)})` },
    { id: "budget", label: "Бюджет", value: `${result.cost} из 100; остаток ${100-result.cost}` },
    { id: "critical", label: "Критические показатели", value: `${BASELINE.critical.length} → ${result.critical.length}; ${result.critical.map(c=>`${c.districtName}: ${c.metricName} ${format(c.value)}`).join("; ") || "значений ниже 40 нет"}` },
    { id: "weakest", label: "Самый слабый район", value: `${result.weakest.name}: ${format(result.weakest.score)}` },
    { id: "average", label: "Средний балл города", value: `${format(BASELINE.average)} → ${format(result.average)}` },
  ];
  result.districts.forEach((d,i)=>facts.push({ id:`district_${d.id}`, label:d.name, value:`${format(BASELINE.districts[i].score)} → ${format(d.score)}; ${METRICS.filter(m=>d.indicators[m.id]!==DISTRICTS[i].indicators[m.id]).map(m=>`${m.name}: ${format(DISTRICTS[i].indicators[m.id])} → ${format(d.indicators[m.id])}`).join("; ") || "без изменений"}` }));
  attribute(decisions).forEach(a=>{const m=MEASURE_BY_ID[a.measureId];facts.push({id:`measure_${a.measureId}`,label:decisionLabel(a),value:`Вклад Шепли: ${signed(a.contribution)} балла; цена ${m.cost}; задержка ${m.lag} квартала; реализованная доля эффекта ${(8-m.lag)/8}; изменения показателей до сочетаний: ${Object.entries(m.effects).map(([k,v])=>`${k} ${signed(v*(8-m.lag)/8)}`).join(", ")}`});});
  result.synergies.forEach((s,i)=>facts.push({id:`synergy_${i}`,label:"Сочетание мер",value:`${s.name}; ${DISTRICTS.find(d=>d.id===s.districtId)?.name}; ${s.metricId} +${s.bonus}`}));
  if(alternative) facts.push({id:"alternative",label:"Проверенная замена",value:`${decisionLabel(alternative.removed)} → ${decisionLabel(alternative.added)}; Score ${format(alternative.result.score)}, прирост ${signed(alternative.gain)}, стоимость ${alternative.result.cost}`} );
  return facts;
}

export function localAnalysis(decisions: Decision[], result: Simulation, alternative: Alternative | null): Analysis {
  const top=attribute(decisions).sort((a,b)=>b.contribution-a.contribution)[0];
  const weakestName=result.weakest.name;
  const untouched=METRICS.filter(m=>result.districts.every((d,i)=>d.indicators[m.id]===DISTRICTS[i].indicators[m.id]));
  const strengths: Insight[]=[{title:"Изменения по модели",text:"Итог учитывает среднее качество городской среды, положение самого слабого района и критические дефициты.",evidenceIds:["score","average"]}];
  if(top) strengths.push({title:"Наибольший вклад",text:`«${MEASURE_BY_ID[top.measureId].name}» даёт наибольший вклад в изменение итоговой оценки с учётом сочетаний мер и порогов.`,evidenceIds:[`measure_${top.measureId}`]});
  if(result.critical.length<BASELINE.critical.length) strengths.push({title:"Меньше критических дефицитов",text:"Выбранные меры выводят часть проблемных показателей из критической зоны и уменьшают штраф.",evidenceIds:["critical"]});
  const risks: Insight[]=[{title:"Точка внимания",text:`${weakestName} остаётся районом с самой низкой итоговой оценкой. Его положение продолжает влиять на общий результат.`,evidenceIds:["weakest",`district_${result.weakest.id}`]}];
  if(untouched.length) risks.push({title:"Что осталось без изменений",text:untouched.map(m=>m.name).join(", ")+". В выбранном наборе нет мер, изменяющих эти показатели.",evidenceIds:["score"]});
  if(result.critical.length) risks.push({title:"Критические значения сохраняются",text:"Часть показателей остаётся ниже установленной границы. Даже при росте среднего балла они продолжают снижать итоговую оценку.",evidenceIds:["critical"]});
  return {source:"local",summary:"Расчётный разбор сценария. Все изменения получены из фиксированных правил синтетической модели.",strengths,risks,recommendation:alternative?"Найдена допустимая замена одного решения, повышающая итоговый балл. Перед применением сравните её влияние на районы.":"Среди допустимых замен одного решения улучшений не найдено. Более глубокая перестройка сценария может дать другой результат."};
}

export function makeReport(decisions: Decision[]) {
  const result=simulate(decisions);
  const alternative=recommend(decisions);
  return {version:MODEL_VERSION,decisions,result,alternative,evidence:buildEvidence(decisions,result,alternative),attribution:attribute(decisions),analysis:localAnalysis(decisions,result,alternative)};
}
