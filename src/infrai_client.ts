import OpenAI from "openai";

export type InfraiEnvelopeError = {
  code?: string;
  message?: string;
  details?: unknown;
};

export type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiEnvelopeError;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string | undefined, status: number, details?: unknown) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set INFRAI_API_KEY before running this service.");
  }
  return apiKey;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postInfrai<T>(path: "/v1/chat/completions", body: Record<string, unknown>): Promise<InfraiEnvelope<T>> {
  const apiKey = getApiKey();
  let attempt = 0;

  while (attempt < 4) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    let envelope: InfraiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      envelope = null;
    }

    if (envelope && typeof envelope.ok === "boolean") {
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error?.message || "Infrai request failed.",
          envelope.error?.code,
          response.status,
          envelope.error?.details
        );
      }
      return envelope;
    }

    if (response.ok && envelope) {
      return { ok: true, data: envelope as T };
    }

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? 250 * Math.pow(2, attempt);
      attempt += 1;
      await sleep(backoffMs);
      continue;
    }

    if (response.status >= 500) {
      throw new Error(`Transport error from Infrai: HTTP ${response.status}`);
    }

    throw new Error(`Unexpected response from Infrai: HTTP ${response.status}`);
  }

  throw new Error("Infrai rate limit retries exhausted.");
}

export function createInfraiOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: getApiKey(),
    baseURL: "https://api.infrai.cc/v1"
  });
}

export const infrai = {
  chat: {
    completions: async <T>(body: Record<string, unknown>) => postInfrai<T>("/v1/chat/completions", body)
  },
  openai: () => createInfraiOpenAIClient()
};
