import { supabase } from "@/integrations/supabase/client";

export async function callAI(prompt: string, maxTokens: number, feature: string = "general"): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await supabase.functions.invoke("ai-chat", {
    body: { prompt, maxTokens, feature },
  });

  if (res.error) throw new Error(res.error.message || "AI call failed");
  // Check for rate limit error in response data
  if (res.data?.error) throw new Error(res.data.error);
  return (res.data?.text || "").replace(/```json|```/g, "").trim();
}
