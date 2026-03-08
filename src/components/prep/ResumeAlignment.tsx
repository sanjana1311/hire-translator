import PrepSpinner from "./PrepSpinner";

export interface AlignmentData {
  strongMatches: string[];
  weakAreas: string[];
  improvedBullets: { original: string; improved: string; why: string }[];
}

interface Props {
  data: AlignmentData | null;
  loading: boolean;
}

const ResumeAlignment = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Analyzing resume alignment…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg p-4" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(153 40% 30%)" }}>✓ Strong Matches</div>
          {data.strongMatches.map((s, i) => (
            <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed"><span className="font-bold shrink-0" style={{ color: "hsl(153 50% 35%)" }}>✓</span>{s}</div>
          ))}
        </div>
        <div className="rounded-lg p-4" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(348 46% 28%)" }}>→ Weak Areas</div>
          {data.weakAreas.map((s, i) => (
            <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed"><span className="font-bold shrink-0" style={{ color: "hsl(348 50% 35%)" }}>→</span>{s}</div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-3">Suggested Bullet Improvements</div>
        <div className="space-y-3">
          {data.improvedBullets.map((b, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Original</div>
                <p className="text-xs text-muted-foreground line-through leading-relaxed">{b.original}</p>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Improved</div>
                <p className="text-xs font-medium leading-relaxed">{b.improved}</p>
              </div>
              <p className="text-[11px] italic text-muted-foreground">Why: {b.why}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResumeAlignment;
