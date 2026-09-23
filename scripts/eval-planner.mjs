import { writeFile } from "node:fs/promises";
import { format } from "prettier";

const base = process.env.EVAL_BASE_URL || "http://127.0.0.1:3003";
const example = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
];
const constraints = { locked: [], excluded: [], goal: "score", districtId: null };
const cases = [
  ["Найди план с максимальным общим Score", "score"],
  ["Помоги самому слабому району", "weakest"],
  ["Сведи к минимуму число критических показателей", "critical"],
  ["Подбери лучший план для Нуры", "district", "nura"],
  ["Найди лучший план для Алматы", "district", "almaty"],
  ["Улучши план, сохрани школу M7 в Нуре", "lock", "M7"],
  ["Подбери план без M1", "exclude", "M1"],
  ["Проверь задержку поликлиники M8 на три дополнительных квартала", "delay", 3],
  ["Проверь текущий план: задержи каждую меру по очереди на 2 квартала", "delay", 2],
  [
    "Найди план с наибольшим Score в худшем случае при задержке любой одной меры на два квартала",
    "unsupported",
  ],
  ["Подбери наиболее устойчивый план", "unsupported"],
  ["Find the best robust plan under delays", "unsupported"],
  [
    "Помоги слабейшему району, но ни один другой район не должен потерять баллы относительно моего плана",
    "unsupported",
  ],
  ["Найди лучший план с бюджетом не больше 70", "unsupported"],
  ["Выбери только три мероприятия вместо пяти", "unsupported"],
  ["Максимизируй S2 в Нуре", "unsupported"],
  ["Подбери план, чтобы T1 во всех районах был не ниже 60", "unsupported"],
  ["Задержи M7 и M8 одновременно на два квартала", "unsupported"],
  ["Найди лучший план на горизонте 12 кварталов", "unsupported"],
  ["Оптимизируй с весами: 80% экология, 20% транспорт", "unsupported"],
  ["Не оптимизируй устойчивость, просто максимизируй обычный Score", "score"],
  ["Не нужен робастный план, найди максимальный обычный Score", "score"],
  ["Найди лучший обычный Score; устойчивость не оптимизируй", "score"],
  [
    "Найди лучший план по обычному Score, затем проверь его устойчивость к задержке одной меры",
    "score",
  ],
  ["Найди лучший план с учётом штатных лагов", "score"],
  ["Закрепи школу M7 в Нуре и найди лучший Score", "lock", "M7"],
  ["Проверь устойчивость текущего плана к задержке одной меры на два квартала", "delay", 2],
  [
    "Сними все закрепления и найди лучший общий Score",
    "released",
    null,
    { ...constraints, locked: example.slice(0, 2) },
  ],
  ["Оставь все пять решений текущего плана и подбери лучший вариант", "all_locked"],
  [
    "Сними запрет на M1 и найди лучший план",
    "unexcluded",
    null,
    { ...constraints, excluded: ["M1"] },
  ],
];
const status = await (await fetch(`${base}/api/status`)).json();
if (!status.aiConfigured)
  throw new Error("Configure OPENAI_API_KEY on the server before live evaluation.");
const report = {
  date: new Date().toISOString(),
  base,
  modelLabel: status.model,
  cases: [],
};
const selectedCases = cases.filter(
  ([prompt]) => !process.env.EVAL_FILTER || prompt.includes(process.env.EVAL_FILTER),
);
for (const [prompt, expected, value, requestConstraints = constraints] of selectedCases) {
  let response;
  for (let retry = 0; retry < 3; retry++) {
    response = await fetch(`${base}/api/planner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "chat",
        decisions: example,
        appliedDecisions: example,
        constraints: requestConstraints,
        messages: [{ role: "user", content: prompt }],
        previousPlans: [],
      }),
      signal: AbortSignal.timeout(65000),
    });
    if (response.status !== 429) break;
    console.log("Rate limit: waiting 45s");
    await new Promise((resolve) => setTimeout(resolve, 45000));
  }
  const body = await response.json();
  let passed = response.ok;
  if (expected === "unsupported")
    passed &&=
      body.search === null &&
      body.stress === null &&
      JSON.stringify(body.constraints) === JSON.stringify(requestConstraints);
  else if (expected === "delay") passed &&= body.search === null && body.stress?.quarters === value;
  else if (expected === "lock")
    passed &&=
      !!body.search?.plans.length &&
      body.constraints.locked.some((d) => d.measureId === value && d.districtId === "nura");
  else if (expected === "exclude")
    passed &&= !!body.search?.plans.length && body.constraints.excluded.includes(value);
  else if (expected === "released")
    passed &&= !!body.search?.plans.length && body.constraints.locked.length === 0;
  else if (expected === "all_locked")
    passed &&=
      !!body.search?.plans.length &&
      example.every((d) =>
        body.constraints.locked.some(
          (l) => l.measureId === d.measureId && l.districtId === d.districtId,
        ),
      );
  else if (expected === "unexcluded")
    passed &&= !!body.search?.plans.length && !body.constraints.excluded.includes("M1");
  else
    passed &&=
      !!body.search?.plans.length &&
      body.constraints.goal === expected &&
      (expected !== "district" || body.constraints.districtId === value);
  report.cases.push({
    prompt,
    expected,
    requestConstraints,
    passed,
    status: response.status,
    source: body.source,
    constraints: body.constraints,
    message: body.message ?? body.error,
    searched: !!body.search,
    delayQuarters: body.stress?.quarters ?? null,
  });
  console.log(`${passed ? "PASS" : "FAIL"} [${expected}] ${prompt}`);
  await writeFile(
    process.env.EVAL_OUTPUT || "docs/planner-evaluation.json",
    await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  );
}
const passed = report.cases.filter((c) => c.passed).length;
console.log(`${passed}/${report.cases.length} passed`);
process.exitCode = passed === report.cases.length ? 0 : 1;
