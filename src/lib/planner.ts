import {
  CATEGORIES,
  DISTRICTS,
  MEASURES,
  METRICS,
  BUDGET,
  HORIZON,
  type Decision,
  type DistrictId,
} from "./data";
import { simulate, validate, scenarioKey, type Simulation } from "./engine";
export type PlanGoal = "score" | "weakest" | "critical" | "district";
export interface PlanConstraints {
  locked: Decision[];
  excluded: string[];
  goal: PlanGoal;
  districtId: DistrictId | null;
}
export interface CandidatePlan {
  decisions: Decision[];
  result: Simulation;
  goals: PlanGoal[];
}
export interface PlanSearch {
  plans: CandidatePlan[];
  evaluated: number;
  reason: string | null;
}
export const GOAL_LABELS: Record<PlanGoal, string> = {
  score: "Общий Score",
  weakest: "Самый слабый район",
  critical: "Устранение дефицитов",
  district: "Выбранный район",
};
export const DEFAULT_CONSTRAINTS: PlanConstraints = {
  locked: [],
  excluded: [],
  goal: "score",
  districtId: null,
};

const variants = MEASURES.map((m) =>
  (m.scope === "city" ? [-2] : DISTRICTS.map((_, i) => i)).map((target) => {
    const delta: [number, number][] = [];
    DISTRICTS.forEach((_, district) => {
      if (target !== -2 && district !== target) return;
      METRICS.forEach((metric, j) => {
        const effect = m.effects[metric.id];
        if (effect)
          delta.push([district * METRICS.length + j, (effect * (HORIZON - m.lag)) / HORIZON]);
      });
    });
    return { target, delta };
  }),
);

/** Enumerates every admissible set and district assignment. No beam/pruning by score. */
export function solvePlans(constraints: PlanConstraints): PlanSearch {
  const invalid = (reason: string): PlanSearch => ({ plans: [], evaluated: 0, reason });
  const validation = validate(constraints.locked, false);
  if (!validation.valid) return invalid(validation.errors.join(" "));
  if (constraints.excluded.some((id) => !MEASURES.some((m) => m.id === id)))
    return invalid("Неизвестное исключённое мероприятие.");
  if (constraints.locked.some((d) => constraints.excluded.includes(d.measureId)))
    return invalid("Одна и та же мера закреплена и исключена. Снимите одно из условий.");
  const focus = DISTRICTS.findIndex((d) => d.id === constraints.districtId);
  if (constraints.goal === "district" && focus < 0) return invalid("Укажите приоритетный район.");
  const locked = MEASURES.map((m) => constraints.locked.find((d) => d.measureId === m.id));
  const requiredAfter = MEASURES.map((_, i) => locked.slice(i).filter(Boolean).length);
  const categoryIndexes = MEASURES.map((m) => CATEGORIES.findIndex((c) => c.id === m.category));
  const counts = new Int8Array(CATEGORIES.length);
  const selected = new Int8Array(MEASURES.length).fill(-1);
  const values = Float64Array.from(
    DISTRICTS.flatMap((d) => METRICS.map((m) => d.indicators[m.id])),
  );
  const goals = [...new Set<PlanGoal>([constraints.goal, "score", "weakest", "critical"])].slice(
    0,
    3,
  );
  type Winner = { decisions: Decision[]; primary: number; score: number; cost: number };
  const winners = new Map<PlanGoal, Winner>();
  let evaluated = 0;

  function decisions(): Decision[] {
    return MEASURES.flatMap((m, i) =>
      selected[i] === -1
        ? []
        : selected[i] === -2
          ? [{ measureId: m.id }]
          : [{ measureId: m.id, districtId: DISTRICTS[selected[i]].id }],
    );
  }
  function evaluate(cost: number) {
    evaluated++;
    const synergy: number[] = [];
    if (selected[0] >= 0 && selected[1] !== -1) synergy.push(selected[0] * 10);
    if (selected[9] >= 0 && selected[11] !== -1) synergy.push(selected[9] * 10 + 6);
    if (selected[4] >= 0 && selected[5] !== -1) synergy.push(selected[4] * 10 + 3);
    for (const index of synergy) values[index] += 2;
    let average = 0,
      weakest = Infinity,
      critical = 0,
      focused = 0;
    for (let i = 0; i < DISTRICTS.length; i++) {
      let districtScore = 0;
      for (let j = 0; j < METRICS.length; j++) {
        const value = Math.min(100, Math.max(0, values[i * 10 + j]));
        districtScore += value * METRICS[j].weight;
        if (value < 40) critical++;
      }
      average += districtScore * DISTRICTS[i].population;
      weakest = Math.min(weakest, districtScore);
      if (i === focus) focused = districtScore;
    }
    for (const index of synergy) values[index] -= 2;
    const score = 0.7 * average + 0.3 * weakest - critical;
    const ranks = { score, weakest, critical: -critical, district: focused };
    for (const goal of goals) {
      const prior = winners.get(goal);
      const primary = ranks[goal];
      if (
        !prior ||
        primary > prior.primary + 1e-9 ||
        (Math.abs(primary - prior.primary) < 1e-9 &&
          (score > prior.score + 1e-9 ||
            (Math.abs(score - prior.score) < 1e-9 && cost < prior.cost)))
      ) {
        winners.set(goal, { decisions: decisions(), primary, score, cost });
      }
    }
  }
  function visit(index: number, chosen: number, cost: number) {
    if (chosen + (requiredAfter[index] ?? 0) > 5 || chosen + MEASURES.length - index < 5) return;
    if (chosen === 5) {
      evaluate(cost);
      return;
    }
    if (index === MEASURES.length) return;
    const m = MEASURES[index];
    const mandatory = locked[index];
    if (!mandatory) visit(index + 1, chosen, cost);
    if (
      constraints.excluded.includes(m.id) ||
      cost + m.cost > BUDGET ||
      counts[categoryIndexes[index]] >= 2
    )
      return;
    if (index === 2 && selected[0] !== -1) return;
    for (const variant of variants[index]) {
      if (
        mandatory &&
        (mandatory.districtId
          ? DISTRICTS[variant.target]?.id !== mandatory.districtId
          : variant.target !== -2)
      )
        continue;
      if (index === 6 && selected[3] >= 0 && selected[3] === variant.target) continue;
      if (index === 12 && selected[4] >= 0 && selected[4] === variant.target) continue;
      selected[index] = variant.target;
      counts[categoryIndexes[index]]++;
      for (const [slot, amount] of variant.delta) values[slot] += amount;
      visit(index + 1, chosen + 1, cost + m.cost);
      for (const [slot, amount] of variant.delta) values[slot] -= amount;
      counts[categoryIndexes[index]]--;
      selected[index] = -1;
    }
  }
  visit(0, 0, 0);
  const plans: CandidatePlan[] = [];
  for (const goal of goals) {
    const winner = winners.get(goal);
    if (!winner) continue;
    const existing = plans.find((p) => scenarioKey(p.decisions) === scenarioKey(winner.decisions));
    if (existing) existing.goals.push(goal);
    else
      plans.push({
        decisions: winner.decisions,
        result: simulate(winner.decisions),
        goals: [goal],
      });
  }
  return {
    plans,
    evaluated,
    reason: plans.length
      ? null
      : "При этих условиях невозможно собрать пять совместимых мер за 100 единиц. Снимите закрепление или исключение и повторите поиск.",
  };
}
