import PrepSpinner from "@/components/prep/PrepSpinner";

export interface StrategyTier {
  tier: string;
  objective: string;
  approach: string;
  expectedOutcome: string;
  priority: number;
}

interface Props {
  data: StrategyTier[] | null;
  loading: boolean;
}

const OutreachStrategy = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Building outreach strategy…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="space-y-3">
      {data.map((tier, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{tier.priority}</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold mb-0.5">{tier.tier}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Objective</div>
            <p className="text-xs leading-relaxed mb-2">{tier.objective}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Approach</div>
                <p className="text-xs leading-relaxed">{tier.approach}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Expected Outcome</div>
                <p className="text-xs leading-relaxed">{tier.expectedOutcome}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OutreachStrategy;
