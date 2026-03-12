import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DAILY_LIMIT = 10;

export function useAIUsage(feature: string) {
  const [used, setUsed] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("ai_usage" as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("feature", feature)
      .gte("used_at", today.toISOString());

    if (!error) setUsed(count ?? 0);
  }, [feature]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    used,
    remaining: used !== null ? Math.max(0, DAILY_LIMIT - used) : null,
    limit: DAILY_LIMIT,
    refresh,
  };
}
