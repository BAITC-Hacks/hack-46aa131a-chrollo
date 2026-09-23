export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4.1",
  });
}
