import { describe, expect, it } from "vitest";
import { BUDGET, CITY_EXAMPLE, DISTRICTS, EXAMPLE, MEASURES, METRICS, type Decision } from "./data";
import { BASELINE, attribute, clamp, evaluate, parseScenario, recommend, scenarioKey, simulate, summarize, validate } from "./engine";

describe("published dataset", () => {
  it("weights and population shares sum to one", () => {
    expect(METRICS.reduce((s, m) => s + m.weight, 0)).toBeCloseTo(1, 12);
    expect(DISTRICTS.reduce((s, d) => s + d.population, 0)).toBeCloseTo(1, 12);
    expect(MEASURES).toHaveLength(14);
  });
  it("reproduces the independently verified baseline", () => {
    expect(BASELINE.districts.map(d => +d.score.toFixed(2))).toEqual([62.99,57.06,54.65,56.63,49.18]);
    expect(BASELINE.average).toBeCloseTo(56.8624, 10);
    expect(BASELINE.score).toBeCloseTo(52.55768, 10);
    expect(BASELINE.critical.map(c => c.metricId)).toEqual(["S1", "S2"]);
  });
  it("reproduces the provided five-decision example", () => {
    const { result, validation } = evaluate(EXAMPLE);
    expect(validation.valid).toBe(true);
    expect(result?.cost).toBe(95);
    expect(result?.score).toBeCloseTo(56.54307, 10);
    expect(result?.average).toBeCloseTo(58.0776, 10);
    expect(result?.critical).toHaveLength(0);
    expect(result?.synergies).toHaveLength(1);
  });
  it("accepts the alternate preset and the cheapest published example", () => {
    expect(validate(CITY_EXAMPLE).valid).toBe(true);
    const cheap: Decision[] = [{measureId:"M9",districtId:"nura"},{measureId:"M11",districtId:"nura"},{measureId:"M10",districtId:"nura"},{measureId:"M12"},{measureId:"M4",districtId:"saryarka"}];
    expect(validate(cheap)).toEqual({valid:true, errors:[], cost:61});
  });
});

describe("rules", () => {
  it("rejects partial final scenarios but allows them while editing", () => {
    expect(evaluate(EXAMPLE.slice(0,4)).result).toBeNull();
    expect(validate(EXAMPLE.slice(0,4), false).valid).toBe(true);
    expect(validate([...EXAMPLE,{measureId:"M2"}], false).valid).toBe(false);
  });
  it("rejects repeated measures even in different districts", () => {
    expect(validate([{measureId:"M7",districtId:"nura"},{measureId:"M7",districtId:"esil"}],false).valid).toBe(false);
  });
  it("rejects over-budget combinations without returning a score", () => {
    const expensive = [{measureId:"M3",districtId:"nura"},{measureId:"M5",districtId:"saryarka"},{measureId:"M7",districtId:"nura"},{measureId:"M10",districtId:"esil"},{measureId:"M13",districtId:"almaty"}];
    expect(evaluate(expensive).result).toBeNull();
    expect(validate(expensive).errors.some(e => e.includes("Бюджет"))).toBe(true);
  });
  it("rejects all three conflicts and permits local measures in different districts", () => {
    for (const pair of [["M1","M3"],["M4","M7"],["M5","M13"]]) {
      expect(validate(pair.map(measureId=>({measureId,districtId:"nura"})),false).valid).toBe(false);
    }
    expect(validate([{measureId:"M1",districtId:"nura"},{measureId:"M3",districtId:"esil"}],false).valid).toBe(false);
    expect(validate([{measureId:"M4",districtId:"esil"},{measureId:"M7",districtId:"nura"}],false).valid).toBe(true);
    expect(validate([{measureId:"M5",districtId:"esil"},{measureId:"M13",districtId:"nura"}],false).valid).toBe(true);
  });
  it("requires valid districts and forbids a district for city measures", () => {
    for (const item of [{measureId:"M7"},{measureId:"M7",districtId:"fake"},{measureId:"M12",districtId:"nura"}]) expect(validate([item],false).valid).toBe(false);
  });
  it("rejects a third measure in the same direction", () => {
    expect(validate(["M7","M8","M9"].map(measureId=>({measureId,districtId:"nura"})),false).valid).toBe(false);
  });
  it("handles untrusted malformed input without crashing", () => {
    for (const input of [null, {}, [null], [3], [{measureId:"__proto__"}], [{measureId:"toString"}], [{measureId:[]}]]) expect(evaluate(input).result).toBeNull();
  });
});

describe("effects and fairness", () => {
  it("applies lag exactly, and district effects only locally", () => {
    const result = simulate([{measureId:"M7",districtId:"nura"}]);
    expect(result.districts[4].indicators.S1).toBe(48);
    expect(result.districts[0].indicators).toEqual(DISTRICTS[0].indicators);
  });
  it("charges city interventions once and applies them everywhere", () => {
    const result = simulate([{measureId:"M12"}]);
    expect(result.cost).toBe(14);
    result.districts.forEach((d,i)=>expect(d.indicators.C2-DISTRICTS[i].indicators.C2).toBe(4.375));
  });
  it.each([["M1","M2","T1",9.5],["M5","M6","E2",12.25],["M10","M12","B1",12.5]] as const)("applies %s + %s synergy without lag scaling", (a,b,k,delta)=>{
    const result=simulate([{measureId:a,districtId:"nura"},{measureId:b}]);
    expect(result.districts[4].indicators[k]-DISTRICTS[4].indicators[k]).toBe(delta);
  });
  it("includes negative tradeoffs", () => {
    expect(simulate([{measureId:"M11",districtId:"nura"}]).districts[4].indicators.T1).toBe(53.25);
  });
  it("counts strictly below 40 and recomputes the weakest district", () => {
    const rows = DISTRICTS.map(d=>({...d.indicators}));
    rows[4].S1=40; rows[4].S2=40;
    expect(summarize(rows).critical).toHaveLength(0);
    rows[4].S1=39.999;
    expect(summarize(rows).critical).toHaveLength(1);
    METRICS.forEach(m=>{rows[4][m.id]=100;});
    expect(summarize(rows).weakest.id).toBe("saryarka");
  });
  it("clips bounds", () => { expect(clamp(-5)).toBe(0); expect(clamp(107)).toBe(100); });
  it("is order independent and leaves the source dataset immutable", () => {
    const before=JSON.stringify(DISTRICTS);
    expect(simulate(EXAMPLE).score).toBeCloseTo(simulate([...EXAMPLE].reverse()).score,12);
    expect(JSON.stringify(DISTRICTS)).toBe(before);
  });
});

describe("explainability and recommendations", () => {
  it("allocates the whole score improvement using exact Shapley values", () => {
    const values=attribute(EXAMPLE);
    expect(values.reduce((s,v)=>s+v.contribution,0)).toBeCloseTo(simulate(EXAMPLE).score-BASELINE.score,10);
    const reversed=attribute([...EXAMPLE].reverse());
    values.forEach(v=>expect(reversed.find(r=>r.measureId===v.measureId)?.contribution).toBeCloseTo(v.contribution,10));
  });
  it("returns only a valid, affordable, strictly better single replacement", () => {
    const alt=recommend(EXAMPLE);
    expect(alt).not.toBeNull();
    expect(validate(alt!.decisions).valid).toBe(true);
    expect(alt!.result.cost).toBeLessThanOrEqual(BUDGET);
    expect(alt!.gain).toBeGreaterThan(0);
    expect(alt!.decisions.filter((d,i)=>JSON.stringify(d)!==JSON.stringify(EXAMPLE[i]))).toHaveLength(1);
    expect(alt!.result.score).toBeCloseTo(simulate(alt!.decisions).score,12);
  });
  it("rejects malformed shared scenarios and round-trips valid selections", () => {
    expect(parseScenario(scenarioKey(EXAMPLE))).toHaveLength(5);
    expect(simulate(parseScenario(scenarioKey(EXAMPLE))!).score).toBeCloseTo(simulate(EXAMPLE).score,12);
    for(const s of ["oops","M7:fake","M12:nura","M7:nura:extra","__proto__:city"]) expect(parseScenario(s)).toBeNull();
  });
});
