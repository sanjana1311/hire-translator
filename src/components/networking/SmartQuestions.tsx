import PrepSpinner from "@/components/prep/PrepSpinner";

export interface QuestionGroup {
  goal: string;
  questions: string[];
}

interface Props {
  data: QuestionGroup[] | null;
  loading: boolean;
}

const SmartQuestions = ({ data, loading }: Props) => {
  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Generating smart questions…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  const goalMeta: Record<string, { icon: string; color: string; bg: string; border: string }> = {
    "Understanding the Role": { icon: "🎯", color: "hsl(226 71% 48%)", bg: "hsl(214 100% 97%)", border: "hsl(213 93% 87%)" },
    "Understanding the Hiring Process": { icon: "📋", color: "hsl(25 84% 31%)", bg: "hsl(37 60% 97%)", border: "hsl(37 40% 80%)" },
    "Understanding the Team": { icon: "👥", color: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)", border: "hsl(152 34% 82%)" },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {data.map((group, i) => {
        const meta = goalMeta[group.goal] || Object.values(goalMeta)[i % 3];
        return (
          <div key={i} className="rounded-xl p-4" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span>{meta.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{group.goal}</span>
            </div>
            <div className="space-y-2">
              {group.questions.map((q, j) => (
                <div key={j} className="text-xs leading-relaxed">
                  <span className="font-semibold" style={{ color: meta.color }}>Q{j + 1}.</span> {q}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SmartQuestions;
