import {
  BUDGET,
  DECISIONS,
  DISTRICTS,
  HORIZON,
  MEASURES,
  MEASURE_BY_ID,
  METRICS,
  type Decision,
  type DistrictId,
  type Indicators,
  type MetricId,
} from "./data";

export interface Validation {
  valid: boolean;
  errors: string[];
  cost: number;
}
export function validate(input: unknown, complete = true): Validation {
  const errors: string[] = [];
  if (!Array.isArray(input))
    return { valid: false, errors: ["Решения должны быть списком."], cost: 0 };
  if (complete && input.length !== DECISIONS) errors.push("Выберите ровно 5 мероприятий.");
  if (!complete && input.length > DECISIONS) errors.push("Можно выбрать максимум 5 мероприятий.");
  const seen = new Set<string>();
  const categories: Record<string, number> = {};
  const decisions: Decision[] = [];
  let cost = 0;
  for (const item of input) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.measureId !== "string" ||
      !Object.hasOwn(MEASURE_BY_ID, item.measureId)
    ) {
      errors.push("Неизвестное мероприятие.");
      continue;
    }
    const measure = MEASURE_BY_ID[item.measureId];
    cost += measure.cost;
    if (seen.has(measure.id)) errors.push(`«${measure.name}» уже выбрано. Повторы запрещены.`);
    seen.add(measure.id);
    categories[measure.category] = (categories[measure.category] ?? 0) + 1;
    if (measure.scope === "district" && !DISTRICTS.some((d) => d.id === item.districtId))
      errors.push(`Укажите район для «${measure.name}».`);
    if (measure.scope === "city" && item.districtId !== undefined)
      errors.push(`«${measure.name}» действует на весь город. Район не указывается.`);
    decisions.push(item as Decision);
  }
  if (cost > BUDGET) errors.push(`Бюджет превышен на ${cost - BUDGET} ед.`);
  if (Object.values(categories).some((n) => n > 2))
    errors.push("Не более 2 мероприятий из одного направления.");
  const a = (id: string) => decisions.find((d) => d.measureId === id);
  if (a("M1") && a("M3"))
    errors.push("Автобусные полосы и ЛРТ нельзя выбирать вместе, даже в разных районах.");
  if (a("M4") && a("M7") && a("M4")!.districtId === a("M7")!.districtId)
    errors.push("Парк и школа не могут занимать один участок в одном районе.");
  if (a("M5") && a("M13") && a("M5")!.districtId === a("M13")!.districtId)
    errors.push("Чистое топливо и обновление сетей дублируют программу в одном районе.");
  return { valid: errors.length === 0, errors: [...new Set(errors)], cost };
}

export const clamp = (n: number) => Math.min(100, Math.max(0, n));
export function summarize(rows: Indicators[]) {
  const districts = DISTRICTS.map((d, i) => ({
    ...d,
    indicators: rows[i],
    score: METRICS.reduce((sum, m) => sum + m.weight * rows[i][m.id], 0),
  }));
  const average = districts.reduce((sum, d) => sum + d.population * d.score, 0);
  const weakest = districts.reduce((a, b) => (a.score <= b.score ? a : b));
  const critical = districts.flatMap((d) =>
    METRICS.filter((m) => d.indicators[m.id] < 40).map((m) => ({
      districtId: d.id,
      districtName: d.name,
      metricId: m.id,
      metricName: m.name,
      value: d.indicators[m.id],
    })),
  );
  return {
    districts,
    average,
    weakest,
    critical,
    score: 0.7 * average + 0.3 * weakest.score - critical.length,
  };
}
export type Simulation = ReturnType<typeof simulate>;

/** Internal partial coalitions are required for attribution; public final scores use evaluate(). */
export function simulate(decisions: Decision[]) {
  const rows = DISTRICTS.map((d) => ({ ...d.indicators }));
  for (const decision of decisions) {
    const m = MEASURE_BY_ID[decision.measureId];
    if (!m) throw new Error("Unknown measure");
    DISTRICTS.forEach((d, i) => {
      if (m.scope === "district" && decision.districtId !== d.id) return;
      for (const [key, value] of Object.entries(m.effects))
        rows[i][key as MetricId] += (value * (HORIZON - m.lag)) / HORIZON;
    });
  }
  const synergies: { name: string; districtId: DistrictId; metricId: MetricId; bonus: number }[] =
    [];
  const pairs: [string, string, MetricId][] = [
    ["M1", "M2", "T1"],
    ["M10", "M12", "B1"],
    ["M5", "M6", "E2"],
  ];
  for (const [first, second, metricId] of pairs) {
    const districtId = decisions.find((d) => d.measureId === first)?.districtId;
    if (districtId && decisions.some((d) => d.measureId === second)) {
      const index = DISTRICTS.findIndex((d) => d.id === districtId);
      rows[index][metricId] += 2;
      synergies.push({
        name: `${MEASURE_BY_ID[first].name} + ${MEASURE_BY_ID[second].name}`,
        districtId,
        metricId,
        bonus: 2,
      });
    }
  }
  rows.forEach((row) =>
    METRICS.forEach((m) => {
      row[m.id] = clamp(row[m.id]);
    }),
  );
  return {
    ...summarize(rows),
    synergies,
    cost: decisions.reduce((sum, d) => sum + MEASURE_BY_ID[d.measureId].cost, 0),
  };
}
export const BASELINE = simulate([]);

export function evaluate(input: unknown): { validation: Validation; result: Simulation | null } {
  const validation = validate(input);
  return { validation, result: validation.valid ? simulate(input as Decision[]) : null };
}

/** Exact Shapley values across all 2^5 coalitions, including thresholds and interactions. */
export function attribute(decisions: Decision[]) {
  if (!validate(decisions).valid) return [];
  const n = decisions.length;
  const factorial = [1, 1, 2, 6, 24, 120];
  const scores = Array.from(
    { length: 1 << n },
    (_, mask) => simulate(decisions.filter((_, i) => mask & (1 << i))).score,
  );
  return decisions.map((decision, i) => {
    let contribution = 0;
    for (let mask = 0; mask < 1 << n; mask++) {
      if (mask & (1 << i)) continue;
      const size = mask.toString(2).replaceAll("0", "").length;
      const weight = (factorial[size] * factorial[n - size - 1]) / factorial[n];
      contribution += weight * (scores[mask | (1 << i)] - scores[mask]);
    }
    return { ...decision, contribution };
  });
}

export interface Alternative {
  decisions: Decision[];
  result: Simulation;
  gain: number;
  removed: Decision;
  added: Decision;
}
/** Exhaustive search of the one-replacement neighborhood, not a global optimizer. */
export function recommend(decisions: Decision[]): Alternative | null {
  if (!validate(decisions).valid) return null;
  const current = simulate(decisions);
  let best: Alternative | null = null;
  for (let i = 0; i < decisions.length; i++) {
    for (const m of MEASURES) {
      const targets = m.scope === "city" ? [undefined] : DISTRICTS.map((d) => d.id);
      for (const districtId of targets) {
        const added: Decision = districtId ? { measureId: m.id, districtId } : { measureId: m.id };
        const candidate = decisions.map((d, j) => (i === j ? added : d));
        if (!validate(candidate).valid) continue;
        const result = simulate(candidate);
        const gain = result.score - current.score;
        if (
          gain > 1e-9 &&
          (!best ||
            gain > best.gain + 1e-9 ||
            (Math.abs(gain - best.gain) < 1e-9 && result.cost < best.result.cost))
        ) {
          best = { decisions: candidate, result, gain, removed: decisions[i], added };
        }
      }
    }
  }
  return best;
}

export const format = (n: number, digits = 2) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
export const signed = (n: number) => `${n >= 0 ? "+" : "−"}${format(Math.abs(n))}`;
export const decisionLabel = (d: Decision) =>
  `${MEASURE_BY_ID[d.measureId].name} · ${DISTRICTS.find((r) => r.id === d.districtId)?.name ?? "Весь город"}`;
export const scenarioKey = (decisions: Decision[]) =>
  decisions
    .map((d) => `${d.measureId}:${d.districtId ?? "city"}`)
    .sort()
    .join(",");
export function parseScenario(text: string): Decision[] | null {
  if (text.length > 300) return null;
  const decisions = text
    ? text.split(",").map((entry) => {
        const parts = entry.split(":");
        if (parts.length !== 2) return { measureId: "invalid" };
        return parts[1] === "city"
          ? { measureId: parts[0] }
          : { measureId: parts[0], districtId: parts[1] as DistrictId };
      })
    : [];
  return validate(decisions, false).valid ? decisions : null;
}
