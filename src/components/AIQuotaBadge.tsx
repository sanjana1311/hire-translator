import { useAIUsage } from "@/hooks/use-ai-usage";

export function AIQuotaBadge({ feature }: { feature: string }) {
  const { remaining, limit } = useAIUsage(feature);
  if (remaining === null) return null;
  return (
    <span className="text-muted-foreground/70">
      · {remaining}/{limit} AI calls left today
    </span>
  );
}
