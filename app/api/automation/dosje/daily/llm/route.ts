import { NextResponse } from "next/server";
import { llmJSON } from "@/lib/llm";
import { authorised } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The fallback writer for the daily dossier run.
 *
 * The run drafts with GPT-6 Luna on the VPS, which shares one usage limit with
 * the hourly news writer. When Luna answers 429 the worker sends the same
 * prompt here and the rest of that run is written by Gemini — Gemini only, so
 * the email can say exactly which model wrote each moment. The output goes
 * through the same verification as Luna's.
 */
export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { system?: string; prompt?: string } | null;
  const system = String(body?.system ?? "").slice(0, 8_000);
  const prompt = String(body?.prompt ?? "").slice(0, 120_000);
  if (!prompt) return NextResponse.json({ ok: false, reason: "prompt_required" }, { status: 400 });
  const meta: { model?: string } = {};
  try {
    const json = await llmJSON<unknown>(system, prompt, { only: "gemini", maxTokens: 8192, temperature: 0.2, meta });
    return NextResponse.json({ ok: true, model: meta.model ?? "gemini", json });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: "llm_failed", detail: String(err).slice(0, 400) }, { status: 502 });
  }
}
