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
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Hidden Signals</div>
          <ul className="space-y-1">{data.hiddenSignals.map((s, i) => <li key={i} className="text-xs text-secondary-foreground">💡 {s}</li>)}</ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(153 40% 30%)" }}>✓ Must Demonstrate</div>
          <ul className="space-y-1.5">{data.mustDemonstrate.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
        <div className="rounded-lg p-3" style={{ background: "hsl(37 60% 97%)", border: "1px solid hsl(37 40% 80%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(25 84% 31%)" }}>★ Nice To Demonstrate</div>
          <ul className="space-y-1.5">{data.niceToDemonstrate.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
        <div className="rounded-lg p-3" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(348 46% 28%)" }}>⚠ Red Flags</div>
          <ul className="space-y-1.5">{data.redFlags.map((s, i) => <li key={i} className="text-xs leading-relaxed">{s}</li>)}</ul>
        </div>
      </div>
    </div>
  );
};

export default HiringSignals;
