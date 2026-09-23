import { expect, it } from "vitest";
import { EXAMPLE } from "./data";
import { simulate } from "./engine";
import { DEFAULT_CONSTRAINTS, solvePlans } from "./planner";
import { testDelays } from "./resilience";

it("demo: the supplied plan scores 56.54307 and eliminates both critical deficits", () => {
  const result = simulate(EXAMPLE);
  expect(result.score).toBeCloseTo(56.54307, 8);
  expect(result.critical).toHaveLength(0);
});
it("demo: 694395 admissible plans reveal the tradeoff between official Score and the weakest district", () => {
  const result = solvePlans(DEFAULT_CONSTRAINTS);
  expect(result.evaluated).toBe(694395);
  expect(result.plans[0].result.score).toBeCloseTo(57.236735, 8);
  expect(result.plans[0].result.weakest.score).toBeCloseTo(54.09125, 8);
  const weakest = result.plans.find((p) => p.goals.includes("weakest"))!;
  expect(weakest.result.weakest.score).toBeCloseTo(55.2625, 8);
  expect(weakest.result.score).toBeCloseTo(55.43026, 8);
  expect(weakest.result.critical).toHaveLength(2);
});
it("demo: a three-quarter clinic delay returns a critical deficit and reduces the supplied plan to 55.30514", () => {
  const result = testDelays(EXAMPLE, 3).cases.find((c) => c.measureId === "M8")!;
  expect(result.result.score).toBeCloseTo(55.30514, 8);
  expect(result.result.critical).toHaveLength(1);
});
