export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  messages: AIMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  tools?: unknown[];
  toolChoice?: unknown;
};

type ChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{ function?: { arguments?: string } }>;
    };
    finish_reason?: string;
  }>;
};

const DEFAULT_OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_OPENCODE_MODEL = "kimi-k3";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function endpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

async function request(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<ChatCompletion> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    // Do not log response bodies: providers can include prompt data.
    throw new Error(`AI provider returned HTTP ${response.status}`);
  }

  return await response.json() as ChatCompletion;
}

/** Call configured self-hosted providers in order. */
export async function callAI(requestOptions: AIRequest): Promise<ChatCompletion> {
  const body: Record<string, unknown> = {
    model: Deno.env.get("OPENCODE_MODEL") ||
      Deno.env.get("OPENCODE_MODEL_V2") || DEFAULT_OPENCODE_MODEL,
    temperature: requestOptions.temperature ?? 0.2,
    top_p: requestOptions.topP ?? 0.9,
    max_tokens: requestOptions.maxTokens ?? 1200,
    messages: requestOptions.messages,
  };

  if (requestOptions.tools) body.tools = requestOptions.tools;
  if (requestOptions.toolChoice) body.tool_choice = requestOptions.toolChoice;

  const failures: string[] = [];
  const openCodeKey = Deno.env.get("OPENCODE_GO_API_KEY");
  if (openCodeKey) {
    try {
      return await request(
        endpoint(Deno.env.get("OPENCODE_BASE_URL") || DEFAULT_OPENCODE_BASE_URL),
        openCodeKey,
        body,
        30_000,
      );
    } catch (error) {
      failures.push(`OpenCode: ${error instanceof Error ? error.message : "failed"}`);
      console.warn("OpenCode provider failed; trying fallback");
    }
  } else {
    failures.push("OpenCode: missing OPENCODE_GO_API_KEY");
  }

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (groqKey) {
    try {
      return await request(
        "https://api.groq.com/openai/v1/chat/completions",
        groqKey,
        { ...body, model: DEFAULT_GROQ_MODEL },
        45_000,
      );
    } catch (error) {
      failures.push(`Groq: ${error instanceof Error ? error.message : "failed"}`);
      console.warn("Groq provider failed");
    }
  } else {
    failures.push("Groq: missing GROQ_API_KEY");
  }

  throw new Error(`No configured AI provider was available (${failures.join("; ")})`);
}
