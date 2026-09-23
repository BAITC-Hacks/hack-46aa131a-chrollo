import type { Decision, DistrictId } from "./data";
import type { PlanConstraints, PlanGoal } from "./planner";
export interface ConstraintChanges {
  addLocks: Decision[];
  removeLocks: string[];
  clearLocks: boolean;
  addExcluded: string[];
  removeExcluded: string[];
  clearExcluded: boolean;
  goal: PlanGoal | null;
  districtId: DistrictId | null;
  releaseEvidence: string | null;
}
export function applyIntentChanges(
  before: PlanConstraints,
  changes: ConstraintChanges,
  message: string,
): PlanConstraints {
  const releasing =
    changes.clearLocks ||
    changes.clearExcluded ||
    changes.removeLocks.length > 0 ||
    changes.removeExcluded.length > 0;
  if (releasing) {
    const evidence = changes.releaseEvidence?.trim().toLocaleLowerCase("ru");
    if (
      !evidence ||
      !message.toLocaleLowerCase("ru").includes(evidence) ||
      !/(сними|снять|убери|убрать|отмени|отменить|сброс|разблокир|разреш|можно\s+менять|не\s+закреп|unlock|release|remove|clear|reset)/iu.test(
        evidence,
      )
    )
      throw new Error(
        "Не удалось подтвердить снятие ограничений. Напишите явно, какие закрепления или исключения нужно снять, либо измените их справа.",
      );
    if (
      (changes.clearLocks || changes.clearExcluded) &&
      !/(все|всё|всех|полностью|all)/iu.test(evidence)
    )
      throw new Error("Уточните: снять все ограничения или только определённые?");
  }
  const locked = changes.clearLocks
    ? []
    : before.locked.filter((d) => !changes.removeLocks.includes(d.measureId));
  for (const d of changes.addLocks) {
    const existing = locked.find((l) => l.measureId === d.measureId);
    if (existing && existing.districtId !== d.districtId)
      throw new Error(
        "Эта мера уже закреплена в другом районе. Сначала явно снимите прежнее закрепление.",
      );
    if (!existing) locked.push(d);
  }
  const excluded = [
    ...new Set([
      ...(changes.clearExcluded
        ? []
        : before.excluded.filter((id) => !changes.removeExcluded.includes(id))),
      ...changes.addExcluded,
    ]),
  ];
  let goal = changes.goal ?? before.goal;
  let districtId = changes.goal === null ? before.districtId : changes.districtId;
  // A weakest-district objective is different from optimizing today's weakest named district.
  if (
    changes.goal &&
    /(слабейш|сам[а-яё]*\s+слаб)/iu.test(message) &&
    !/не\s+(?:сам[а-яё]*\s+)?слаб/iu.test(message)
  ) {
    goal = "weakest";
    districtId = null;
  }
  if (goal !== "district") districtId = null;
  return { locked, excluded, goal, districtId };
}
