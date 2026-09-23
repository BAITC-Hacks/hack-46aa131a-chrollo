import { expect, it } from "vitest";
import { EXAMPLE } from "./data";
import { DEFAULT_CONSTRAINTS } from "./planner";
import { applyIntentChanges, type ConstraintChanges } from "./planning-intent";
const unchanged: ConstraintChanges = {
  addLocks: [],
  removeLocks: [],
  clearLocks: false,
  addExcluded: [],
  removeExcluded: [],
  clearExcluded: false,
  goal: null,
  districtId: null,
  releaseEvidence: null,
};
it("preserves unspecified locks and exclusions on a follow-up", () => {
  const before = { ...DEFAULT_CONSTRAINTS, locked: EXAMPLE.slice(0, 4), excluded: ["M1"] };
  expect(applyIntentChanges(before, unchanged, "Улучши план")).toEqual(before);
});
it("does not allow a model to release conditions without explicit user evidence", () => {
  expect(() =>
    applyIntentChanges(
      { ...DEFAULT_CONSTRAINTS, locked: EXAMPLE },
      { ...unchanged, clearLocks: true },
      "Улучши план",
    ),
  ).toThrow();
});
it("releases all locks on explicit request and distinguishes weakest from a named district", () => {
  const message = "Теперь сними все закрепления и помоги самому слабому району";
  const next = applyIntentChanges(
    { ...DEFAULT_CONSTRAINTS, locked: EXAMPLE },
    {
      ...unchanged,
      clearLocks: true,
      releaseEvidence: "сними все закрепления",
      goal: "district",
      districtId: "nura",
    },
    message,
  );
  expect(next.locked).toHaveLength(0);
  expect(next.goal).toBe("weakest");
  expect(next.districtId).toBeNull();
});
it("adds requested locks without replacing a prior locked district silently", () => {
  const before = { ...DEFAULT_CONSTRAINTS, locked: [EXAMPLE[0]] };
  expect(() =>
    applyIntentChanges(
      before,
      { ...unchanged, addLocks: [{ measureId: EXAMPLE[0].measureId, districtId: "esil" }] },
      "Улучши план",
    ),
  ).toThrow();
});
