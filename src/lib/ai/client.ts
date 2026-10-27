import type { z } from "zod";
import { getOpenAiConfig } from "@/lib/env";

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI is not configured. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL and OPENAI_MODEL).",
    );
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResponseError";
  }
}

export type ChatJsonParams<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T, unknown>;
  temperature?: number;
  signal?: AbortSignal;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/** Strip markdown code fences some providers wrap around JSON output. */
function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

export async function chatJson<T>({
  system,
  user,
  schema,
  temperature = 0.2,
  signal,
}: ChatJsonParams<T>): Promise<T> {
  const config = getOpenAiConfig();
  if (!config) throw new AiNotConfiguredError();

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          // json_object mode requires the word "JSON" to appear in the messages.
          { role: "system", content: `${system}\n\nRespond with a single valid JSON object only.` },
          { role: "user", content: user },
        ],
      }),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    throw new AiRequestError(
      `AI request failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }

  let body: ChatCompletionResponse | null = null;
  try {
    body = (await response.json()) as ChatCompletionResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new AiRequestError(
      `AI provider error (${response.status}): ${body?.error?.message ?? response.statusText}`,
      response.status,
    );
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new AiResponseError("AI provider returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch {
    throw new AiResponseError("AI response was not valid JSON.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new AiResponseError(`AI response did not match the expected format: ${issues}`);
  }
  return result.data;
}
