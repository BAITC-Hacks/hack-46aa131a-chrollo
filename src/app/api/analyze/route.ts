import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { validate, scenarioKey } from "@/lib/engine";
import { makeReport, type Analysis } from "@/lib/report";
import { type Decision } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 40;
const insight = z.object({ title: z.string(), text: z.string(), evidenceIds: z.array(z.string()) });
const outputSchema = z.object({
  summary: z.string(),
  strengths: z.array(insight),
  risks: z.array(insight),
  recommendation: z.string(),
});
const cache = new Map<string, { time: number; analysis: Analysis }>();
let inFlight = 0;
let requests: number[] = [];

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      const parsed = new URL(origin);
      sameHost =
        ["http:", "https:"].includes(parsed.protocol) &&
        parsed.host === (request.headers.get("host") ?? new URL(request.url).host);
    } catch {
      /* Invalid browser origin. */
    }
    if (!sameHost)
      return Response.json(
        { error: "Запрос должен поступать из этого приложения." },
        { status: 403 },
      );
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return Response.json({ error: "Слишком большой запрос." }, { status: 413 });
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Пустой запрос." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return Response.json({ error: "Слишком большой запрос." }, { status: 413 });
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return Response.json({ error: "Некорректный JSON." }, { status: 400 });
  }
  const input = body && typeof body === "object" && "decisions" in body ? body.decisions : null;
  const validation = validate(input);
  if (!validation.valid)
    return Response.json({ error: validation.errors.join(" ") }, { status: 400 });
  // Reconstruct from allowed fields. Never trust client-provided scores or prompt text.
  const decisions = (input as Decision[]).map((d) =>
    d.districtId
      ? { measureId: d.measureId, districtId: d.districtId }
      : { measureId: d.measureId },
  );
  const report = makeReport(decisions);
  if (!process.env.OPENAI_API_KEY)
    return Response.json({ ...report, notice: "OpenAI не подключён. Показан расчётный разбор." });
  const model = process.env.OPENAI_MODEL || "gpt-4.1";
  const key = model + ":" + scenarioKey(decisions);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 30 * 60 * 1000)
    return Response.json({ ...report, analysis: hit.analysis });
  requests = requests.filter((t) => Date.now() - t < 60_000);
  if (inFlight >= 2 || requests.length >= 6)
    return Response.json({
      ...report,
      notice: "Лимит AI-запросов на минуту достигнут. Расчёт доступен; повторите анализ позже.",
    });
  inFlight++;
  requests.push(Date.now());
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25_000,
      maxRetries: 0,
    });
    const response = await client.responses.parse({
      model,
      store: false,
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content:
            "Ты аналитик учебного симулятора управления городом QALA. Пиши по-русски, кратко и конкретно, без рекламных оценок и расплывчатых слов. Данные синтетические: говори о сценарии модели, не о реальной Астане. Все расчёты уже выполнены кодом. Используй только facts и rules. Не пересчитывай числа, не выводи новые проценты. В каждом strengths/risks укажи существующие evidenceIds, прямо подтверждающие текст. От 2 до 3 strengths и risks. Не приравнивай снятие критического штрафа к полному решению проблемы. Не сравнивай отдельный показатель со средним общим баллом: у них разный смысл. Не придумывай влияние на стабильность или безопасность, если факты этого не подтверждают. Не обсуждай финансовый резерв для дополнительных мер или событий: в модели их нет. Объясняй слабейший район, неизменённые направления и задержки из фактов. recommendation обсуждает только проверенную alternative и ОБЯЗАТЕЛЬНО называет проигрывающий район из alternative_effects, если такой есть. Перебраны ВСЕ допустимые замены одного решения; это НЕ поиск единственной возможной замены и НЕ глобальная оптимизация. Если alternative отсутствует, сообщи, что одна замена не даёт улучшения. Не предлагай новые меры или эффекты. summary: два предложения. Каждый title: до восьми слов. Каждый text: максимум два предложения.",
        },
        {
          role: "user",
          content: JSON.stringify({
            facts: report.evidence,
            alternative: report.alternative
              ? { removed: report.alternative.removed, added: report.alternative.added }
              : null,
            rules:
              "Exactly 5 distinct measures, budget at most 100, at most 2 measures per category, incompatibilities forbidden. Unspent budget earns no bonus and cannot buy a sixth measure. No random events or extra future funding in this model. Score=0.7*population_weighted_average+0.3*minimum_district_score-critical_count. Critical means strictly below 40. Effects include lag over 8 quarters. Shapley contributions share interactions fairly and sum to the total change. Alternatives exhaustively search all valid replacements of one measure including district changes, not global combinations.",
          }),
        },
      ],
      text: { format: zodTextFormat(outputSchema, "scenario_analysis") },
    });
    const parsed = response.output_parsed;
    const ids = new Set(report.evidence.map((e) => e.id));
    if (
      !parsed ||
      parsed.strengths.length < 1 ||
      parsed.risks.length < 1 ||
      [...parsed.strengths, ...parsed.risks].some(
        (i) => !i.evidenceIds.length || i.evidenceIds.some((id) => !ids.has(id)),
      )
    )
      throw new Error("Invalid grounded output");
    const analysis: Analysis = { ...parsed, source: "openai", model };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { time: Date.now(), analysis });
    return Response.json({ ...report, analysis });
  } catch {
    // Never expose SDK errors: they may contain request metadata or credentials.
    return Response.json({
      ...report,
      notice:
        "OpenAI сейчас недоступен. Расчёт сохранён; показан разбор по правилам модели. Можно повторить запрос.",
    });
  } finally {
    inFlight--;
  }
}
