import { describe, expect, it } from "vitest";
import { EXAMPLE } from "./data";
import { makeReport } from "./report";

describe("evidence available to AI", () => {
  it("includes the loss to Saryarka when the higher-scoring replacement moves funding", () => {
    const report = makeReport(EXAMPLE);
    const effect = report.evidence.find((fact) => fact.id === "alternative_effects");
    expect(effect).toBeDefined();
    expect(effect?.value).toContain("Сарыарка: −1,21");
    expect(effect?.value).toContain("Нура: +2,02");
  });
  it("provides direct evidence for metrics left unchanged by the scenario", () => {
    const report = makeReport(EXAMPLE);
    const unchanged = report.evidence.find((fact) => fact.id === "unchanged");
    expect(unchanged).toBeDefined();
    expect(unchanged?.value).toContain("Разгрузка дорог");
    expect(unchanged?.value).toContain("Озеленение");
    const insight = report.analysis.risks.find(
      (risk) => risk.title === "Что осталось без изменений",
    );
    expect(insight?.evidenceIds).toContain("unchanged");
  });
});
