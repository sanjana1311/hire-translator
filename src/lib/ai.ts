import { supabase } from "@/integrations/supabase/client";

const AI_REQUEST_TIMEOUT_MS = 115_000;

export interface AIRequestContext {
  jobId?: string;
  resumeId?: string;
  resumeTextLength?: number;
  jobDescriptionLength?: number;
}

export class AIRequestError extends Error {
  code: string;
  requestId?: string;

  constructor(message: string, code = "AI_REQUEST_FAILED", requestId?: string) {
    super(message);
    this.name = "AIRequestError";
    this.code = code;
    this.requestId = requestId;
  }
}

export async function callAI(
  prompt: string,
  maxTokens: number,
  feature: string = "general",
  context?: AIRequestContext,
): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("AI request timed out. Please try again."));
    }, AI_REQUEST_TIMEOUT_MS);
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new AIRequestError("Please sign in and try again.", "NOT_AUTHENTICATED");
    }

    const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
    const response = await Promise.race([
      fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, maxTokens, feature, context }),
      }),
      timeout,
    ]);

    const responseText = await response.text();
    let body: { ok?: boolean; text?: string; message?: string; code?: string; requestId?: string } = {};
    try {
      body = responseText ? JSON.parse(responseText) : {};
    } catch {
      if (!response.ok) {
        throw new AIRequestError(`AI request failed (${response.status}). Please try again.`);
      }
    }

    if (!response.ok || body.ok === false) {
      throw new AIRequestError(
        body.message || `AI request failed (${response.status}). Please try again.`,
        body.code,
        body.requestId,
      );
    }
    return (body.text || "").replace(/\x60\x60\x60json|\x60\x60\x60/g, "").trim();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
