import { judgePrompt, readJudgement, readMomentJudgement } from "@/lib/dosje-judge.mjs";
import { llmJSON } from "@/lib/llm";

type Judgeable = Parameters<typeof judgePrompt>[0] & { claims: { sentences: unknown[] } };

/**
 * The second reader (lib/dosje-judge.mjs), called the same way everywhere:
 * the publish step, the admin "confirm sources" action, and the re-judge pass.
 *
 * A timeline moment must also be an event on its date and belong to its
 * dossier (`kind: "moment"`); the "Në pak fjalë" primer is an overview, so only
 * its claims are judged. Failing to get an answer is a refusal.
 */
export async function judgeMoment(
  milestone: Judgeable,
  opts: { kind: "moment" | "primer"; topic?: string }
): Promise<{ ok: boolean; problems: string[] }> {
  const { system, prompt } = judgePrompt({ ...milestone, topic: opts.topic });
  try {
    const json = await llmJSON<unknown>(system, prompt, { prefer: "gemini", maxTokens: 2048, temperature: 0, timeoutMs: 60_000 });
    const n = milestone.claims.sentences.length;
    return opts.kind === "moment" ? readMomentJudgement(json, n) : readJudgement(json, n);
  } catch (err) {
    return { ok: false, problems: [`judge unavailable: ${String(err).slice(0, 120)}`] };
  }
}
