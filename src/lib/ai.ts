import { supabase } from "@/integrations/supabase/client";

const AI_REQUEST_TIMEOUT_MS = 30_000;

export async function callAI(prompt: string, maxTokens: number, feature: string = "general"): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("AI request timed out. Please try again."));
    }, AI_REQUEST_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([
      supabase.functions.invoke("ai-chat", {
        body: { prompt, maxTokens, feature },
      }),
      timeout,
    ]);

    if (res.error) throw new Error(res.error.message || "AI call failed");
    // Check for rate limit error in response data
    if (res.data?.error) throw new Error(res.data.error);
    return (res.data?.text || "").replace(/\x60\x60\x60json|\x60\x60\x60/g, "").trim();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
