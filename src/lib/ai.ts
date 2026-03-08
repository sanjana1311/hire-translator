import { supabase } from "@/integrations/supabase/client";

export async function callAI(prompt: string, maxTokens: number): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const res = await supabase.functions.invoke("ai-chat", {
    body: { prompt, maxTokens },
  });

  if (res.error) throw new Error(res.error.message || "AI call failed");
  return (res.data?.text || "").replace(/```json|```/g, "").trim();
}
