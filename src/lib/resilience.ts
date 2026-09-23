import type { Decision } from "./data";
import { simulate, validate } from "./engine";
export function testDelays(decisions: Decision[], quarters: number) {
  if (!Number.isInteger(quarters) || quarters < 0 || quarters > 8)
    throw new Error("Задержка должна быть от 0 до 8 кварталов.");
  if (!validate(decisions).valid)
    throw new Error("Для проверки нужен допустимый план из пяти мер.");
  const baseline = simulate(decisions);
  const cases = decisions.map((d) => {
    const result = simulate(decisions, { measureId: d.measureId, quarters });
    return { ...d, result, loss: baseline.score - result.score };
  });
  return { baseline, cases, worst: cases.reduce((a, b) => (a.loss >= b.loss ? a : b)), quarters };
}
