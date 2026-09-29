import PrepSpinner from "./PrepSpinner";

export interface SignalsData {
  coreSkills: string[];
  hiddenSignals: string[];
  technologies: string[];
  leadershipExpectations: string[];
  crossFunctional: string[];
  mustDemonstrate: string[];
  niceToDemonstrate: string[];
  redFlags: string[];
}

interface Props {
  data: SignalsData | null;
  loading: boolean;
}

const TagList = ({ items, color }: { items: string[]; color: string }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((item, i) => (
      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: color, color }}>{item}</span>
    ))}
  </div>
);

const HiringSignals = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Analyzing hiring signals…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Core Skills</div>
          <ul className="space-y-1">{data.coreSkills.map((s, i) => <li key={i} className="text-xs">• {s}</li>)}</ul>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Technologies</div>
          <TagList items={data.technologies} color="hsl(226 71% 48%)" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-info">Hidden Signals</div>
          <ul className="space-y-1">{data.hiddenSignals.map((s, i) => <li key={i} className="text-xs text-secondary-foreground">💡 {s}</li>)}</ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--success))" }}>✓ Must Demonstrate</div>
          <ul className="space-y-1.5">{data.mustDemonstrate.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
        <div className="rounded-lg p-3" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--warning))" }}>★ Nice To Demonstrate</div>
          <ul className="space-y-1.5">{data.niceToDemonstrate.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
        <div className="rounded-lg p-3" style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--danger))" }}>⚠ Red Flags</div>
          <ul className="space-y-1.5">{data.redFlags.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
      </div>
    </div>
  );
};

export default HiringSignals;
