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
it("ignores requests to clear conditions that do not exist", () => {
  const next = applyIntentChanges(
    DEFAULT_CONSTRAINTS,
    {
      ...unchanged,
      clearLocks: true,
      clearExcluded: true,
      removeLocks: ["M7"],
      goal: "district",
      districtId: "nura",
    },
    "Подбери лучший план для Нуры",
  );
  expect(next).toEqual({ ...DEFAULT_CONSTRAINTS, goal: "district", districtId: "nura" });
});
it("still requires evidence when an existing exclusion would be removed", () => {
  expect(() =>
    applyIntentChanges(
      { ...DEFAULT_CONSTRAINTS, excluded: ["M1"] },
      {
        ...unchanged,
        clearLocks: true,
        removeExcluded: ["M1"],
      },
      "Найди лучший план",
    ),
  ).toThrow();
});
it("accepts an explicit single-measure removal even when the model omits its quotation", () => {
  const before = { ...DEFAULT_CONSTRAINTS, excluded: ["M1", "M2"] };
  const next = applyIntentChanges(
    before,
    { ...unchanged, removeExcluded: ["M1"] },
    "Сними запрет на M1 и найди лучший план",
  );
  expect(next.excluded).toEqual(["M2"]);
});
it.each([
  ["Не снимай запрет на M1", "M1"],
  ["Сними запрет на M1 и найди лучший план", "M2"],
])("does not infer permission for an unrelated or negated removal: %s", (message, id) => {
  expect(() =>
    applyIntentChanges(
      { ...DEFAULT_CONSTRAINTS, excluded: ["M1", "M2"] },
      { ...unchanged, removeExcluded: [id] },
      message,
    ),
  ).toThrow();
});
