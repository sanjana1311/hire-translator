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
    const res = await Promise.race([
      supabase.functions.invoke("ai-chat", {
        body: { prompt, maxTokens, feature, context },
      }),
      timeout,
    ]);

    if (res.error) {
      const response: Response | undefined = (res.error as any)?.context;
      if (response && typeof response.text === "function") {
        try {
          const body = JSON.parse(await response.text());
          throw new AIRequestError(
            body?.message || "AI request failed. Please try again.",
            body?.code,
            body?.requestId,
          );
        } catch (error) {
          if (error instanceof AIRequestError) throw error;
        }
      }
      throw new AIRequestError(res.error.message || "AI request failed. Please try again.");
    }
    if (res.data?.ok === false) {
      throw new AIRequestError(res.data.message, res.data.code, res.data.requestId);
    }
    return (res.data?.text || "").replace(/\x60\x60\x60json|\x60\x60\x60/g, "").trim();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
