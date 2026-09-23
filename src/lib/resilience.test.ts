import { expect, it } from "vitest";
import { EXAMPLE } from "./data";
import { simulate } from "./engine";
import { testDelays } from "./resilience";

it("reveals the returning medical deficit when the clinic is three quarters late", () => {
  const report = testDelays(EXAMPLE, 3);
  const clinic = report.cases.find((c) => c.measureId === "M8")!;
  expect(clinic.result.districts.find((d) => d.id === "nura")!.indicators.S2).toBe(38.5);
  expect(clinic.result.critical).toHaveLength(1);
  expect(clinic.result.score).toBeCloseTo(55.30514, 7);
  expect(clinic.result.cost).toBe(95);
  expect(report.worst.result.score).toBe(Math.min(...report.cases.map((c) => c.result.score)));
  expect(report.baseline).toEqual(simulate(EXAMPLE));
});

it("does not alter nominal results or produce negative realization after the horizon", () => {
  const original = JSON.stringify(EXAMPLE);
  const zero = testDelays(EXAMPLE, 0);
  for (const c of zero.cases) expect(c.result).toEqual(zero.baseline);
  const absentClinic = testDelays(EXAMPLE, 8).cases.find((c) => c.measureId === "M8")!;
  expect(absentClinic.result.districts.find((d) => d.id === "nura")!.indicators.S2).toBe(35);
  expect(JSON.stringify(EXAMPLE)).toBe(original);
  expect(() => testDelays(EXAMPLE, -1)).toThrow();
});
