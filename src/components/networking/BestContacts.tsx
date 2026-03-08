import PrepSpinner from "@/components/prep/PrepSpinner";

export interface ContactTarget {
  category: string;
  title: string;
  description: string;
  searchTip: string;
  outreachGoal: string;
}

interface Props {
  data: ContactTarget[] | null;
  loading: boolean;
}

const categoryMeta: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  "School Alumni": { icon: "🎓", color: "hsl(226 71% 48%)", bg: "hsl(214 100% 97%)", border: "hsl(213 93% 87%)" },
  "Previous Company Alumni": { icon: "🏢", color: "hsl(25 84% 31%)", bg: "hsl(37 60% 97%)", border: "hsl(37 40% 80%)" },
  "Role Holders": { icon: "👤", color: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)", border: "hsl(152 34% 82%)" },
  "Hiring Team": { icon: "⭐", color: "hsl(348 46% 28%)", bg: "hsl(0 38% 97%)", border: "hsl(348 28% 85%)" },
};

const BestContacts = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Identifying networking targets…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {data.map((t, i) => {
        const meta = categoryMeta[t.category] || categoryMeta["School Alumni"];
        return (
          <div key={i} className="rounded-xl p-4" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{meta.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{t.category}</span>
            </div>
            <div className="text-sm font-semibold mb-1">{t.title}</div>
            <p className="text-xs leading-relaxed text-secondary-foreground mb-2">{t.description}</p>
            <div className="space-y-1.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Search Tip: </span>
                <span className="text-[11px] text-secondary-foreground">{t.searchTip}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal: </span>
                <span className="text-[11px] text-secondary-foreground">{t.outreachGoal}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BestContacts;
