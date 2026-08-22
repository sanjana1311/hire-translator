export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderOptions = {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  requestId?: string;
};

export type ProviderResult = {
  text: string;
  provider: string;
  model: string;
};

const DEFAULT_TIMEOUT_MS = 120_000;

function env(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

function redact(value: string): string {
  return value.replace(/(bearer\s+)[^\s"']+/gi, "$1[REDACTED]").slice(0, 500);
}

function modelFor(provider: string, requested?: string): string {
  if (requested) return requested;
  if (provider === "opencode") return env("OPENCODE_MODEL_V2") || env("OPENCODE_MODEL") || "glm-5.2";
  if (provider === "groq") return env("GROQ_MODEL") || "llama-3.3-70b-versatile";
  return env("LOVABLE_MODEL") || "google/gemini-3.6-flash";
}

function parseContent(data: unknown): string {
  const root = data as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ function?: { arguments?: unknown } }>;
        content?: unknown;
      };
    }>;
  };
  const choice = root?.choices?.[0];
  const toolCall = choice?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return String(toolCall.function.arguments);
  return typeof choice?.message?.content === "string" ? choice.message.content : "";
}

async function callProvider(provider: string, opts: ProviderOptions): Promise<ProviderResult | null> {
  const key = provider === "opencode" ? (env("OPENCODE_API_KEY") || env("OPENCODE_GO_API_KEY"))
    : provider === "groq" ? env("GROQ_API_KEY")
    : env("LOVABLE_API_KEY");
  if (!key) return null;

  const model = modelFor(provider, opts.model);
  const baseUrl = provider === "opencode"
    ? (env("OPENCODE_BASE_URL") || "https://opencode.ai/zen/go/v1")
    : provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : "https://ai.gateway.lovable.dev/v1";
  const headers = provider === "lovable"
    ? { "Lovable-API-Key": key, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature ?? 0,
    top_p: opts.topP ?? 0.9,
    max_tokens: opts.maxTokens ?? 1200,
    messages: opts.messages,
  };
  // Tool calls are supported by Lovable/Groq. OpenCode models can vary, so the
  // caller can omit tools and request JSON in the prompt for maximum portability.
  if (opts.tools && provider !== "opencode") {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(provider === "opencode" ? 120_000 : DEFAULT_TIMEOUT_MS),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error(JSON.stringify({ requestId: opts.requestId, provider, model, status: response.status, body: redact(raw) }));
      return null;
    }
    const data = JSON.parse(raw);
    const text = parseContent(data);
    if (!text.trim()) return null;
    console.log(JSON.stringify({ requestId: opts.requestId, provider, model, status: response.status }));
    return { text, provider, model };
  } catch (error) {
    console.error(JSON.stringify({ requestId: opts.requestId, provider, model, error: String(error).slice(0, 300) }));
    return null;
  }
}

/** Try the configured providers in the same order used by the hosted beta. */
export async function callConfiguredAI(opts: ProviderOptions): Promise<ProviderResult | null> {
  for (const provider of ["opencode", "lovable", "groq"]) {
    const result = await callProvider(provider, opts);
    if (result) return result;
  }
  return null;
}
