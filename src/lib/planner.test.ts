import { describe, expect, it } from "vitest";
import { EXAMPLE, MEASURES, DISTRICTS, type Decision } from "./data";
import { scenarioKey, simulate, validate } from "./engine";
import { solvePlans, type PlanConstraints } from "./planner";

const conditions = (locked: Decision[] = []): PlanConstraints => ({
  locked,
  excluded: [],
  goal: "score",
  districtId: null,
});

describe("complete constrained planner", () => {
  it("matches an independent two-slot oracle for weakest, critical and district goals", () => {
    const locked = EXAMPLE.slice(0, 3);
    const candidates: { decisions: Decision[]; result: ReturnType<typeof simulate> }[] = [];
    for (let i = 0; i < MEASURES.length; i++)
      for (let j = i + 1; j < MEASURES.length; j++) {
        const a = MEASURES[i],
          b = MEASURES[j];
        for (const da of a.scope === "city" ? [undefined] : DISTRICTS.map((d) => d.id))
          for (const db of b.scope === "city" ? [undefined] : DISTRICTS.map((d) => d.id)) {
            const decisions: Decision[] = [
              ...locked,
              da ? { measureId: a.id, districtId: da } : { measureId: a.id },
              db ? { measureId: b.id, districtId: db } : { measureId: b.id },
            ];
            if (validate(decisions).valid)
              candidates.push({ decisions, result: simulate(decisions) });
          }
      }
    for (const goal of ["weakest", "critical", "district"] as const) {
      const rank = (r: ReturnType<typeof simulate>) =>
        goal === "weakest"
          ? r.weakest.score
          : goal === "critical"
            ? -r.critical.length
            : r.districts[2].score;
      const ordered = [...candidates].sort(
        (a, b) =>
          rank(b.result) - rank(a.result) ||
          b.result.score - a.result.score ||
          a.result.cost - b.result.cost,
      );
      const answer = solvePlans({
        ...conditions(locked),
        goal,
        districtId: goal === "district" ? "saryarka" : null,
      });
      expect(answer.evaluated).toBe(candidates.length);
      expect(rank(answer.plans[0].result)).toBeCloseTo(rank(ordered[0].result), 9);
      expect(answer.plans[0].result.score).toBeCloseTo(ordered[0].result.score, 9);
    }
  });
  it("keeps every mandatory measure and district, matching an independent one-slot oracle", () => {
    const locked = EXAMPLE.slice(0, 4);
    const oracle: { decisions: Decision[]; score: number }[] = [];
    for (const m of MEASURES) {
      for (const districtId of m.scope === "city" ? [undefined] : DISTRICTS.map((d) => d.id)) {
        const decisions = [
          ...locked,
          districtId ? { measureId: m.id, districtId } : { measureId: m.id },
        ];
        if (validate(decisions).valid) oracle.push({ decisions, score: simulate(decisions).score });
      }
    }
    const answer = solvePlans(conditions(locked));
    expect(answer.evaluated).toBe(oracle.length);
    expect(answer.plans[0].result.score).toBeCloseTo(Math.max(...oracle.map((x) => x.score)), 9);
    for (const plan of answer.plans)
      for (const decision of locked) expect(plan.decisions).toContainEqual(decision);
  });

  it("finds a valid full plan from scratch and deduplicates objective winners", () => {
    const answer = solvePlans(conditions());
    expect(answer.evaluated).toBeGreaterThan(1000);
    expect(answer.plans.length).toBeGreaterThan(0);
    expect(answer.plans[0].result.score).toBeGreaterThanOrEqual(57.20556);
    expect(new Set(answer.plans.map((p) => scenarioKey(p.decisions))).size).toBe(
      answer.plans.length,
    );
    for (const p of answer.plans) {
      expect(validate(p.decisions).valid).toBe(true);
      expect(p.result).toEqual(simulate(p.decisions));
    }
  });

  it("reports contradictory locks without silently relaxing them", () => {
    const answer = solvePlans(
      conditions([
        { measureId: "M1", districtId: "nura" },
        { measureId: "M3", districtId: "esil" },
      ]),
    );
    expect(answer.plans).toHaveLength(0);
    expect(answer.reason).toMatch(/ЛРТ/);
  });

  it("never adds excluded measures and detects required-excluded contradictions", () => {
    const c = { ...conditions(EXAMPLE.slice(0, 3)), excluded: ["M3", "M12"] };
    for (const p of solvePlans(c).plans)
      expect(p.decisions.some((d) => c.excluded.includes(d.measureId))).toBe(false);
    const conflict = solvePlans({ ...conditions(EXAMPLE), excluded: ["M7"] });
    expect(conflict.plans).toHaveLength(0);
    expect(conflict.reason).toBeTruthy();
  });

  it("returns exactly the locked plan when all five decisions are fixed", () => {
    const result = solvePlans(conditions(EXAMPLE));
    expect(result.evaluated).toBe(1);
    expect(result.plans).toHaveLength(1);
    expect(scenarioKey(result.plans[0].decisions)).toBe(scenarioKey(EXAMPLE));
    expect(result.plans[0].result.score).toBeCloseTo(56.54307, 8);
  });
});
