import { Progress } from "@/components/ui/progress";

interface Props {
  companyLoaded: boolean;
  signalsLoaded: boolean;
  alignmentLoaded: boolean;
  behavioralAnswered: number;
  behavioralTotal: number;
  technicalAnswered: number;
  technicalTotal: number;
  mockCompleted: boolean;
}

const ReadinessScore = (props: Props) => {
  const checks = [
    { label: "Company research complete", done: props.companyLoaded },
    { label: "Hiring signals analyzed", done: props.signalsLoaded },
    { label: "Resume aligned to role", done: props.alignmentLoaded },
    { label: "Behavioral stories prepared", done: props.behavioralAnswered > 0 },
    { label: "Technical questions practiced", done: props.technicalAnswered > 0 },
    { label: "Mock interview completed", done: props.mockCompleted },
  ];

  const doneCount = checks.filter(c => c.done).length;
  const score = Math.round((doneCount / checks.length) * 100);

  const confidence = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
  const confColor = score >= 80 ? "hsl(153 40% 30%)" : score >= 50 ? "hsl(25 84% 31%)" : "hsl(348 46% 28%)";

  const weakAreas = checks.filter(c => !c.done).map(c => c.label);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="font-serif text-[48px] leading-none" style={{ color: confColor }}>{score}</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Readiness</div>
        </div>
        <div className="flex-1 space-y-2">
          <Progress value={score} className="h-3" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Preparation progress</span>
            <span className="font-semibold" style={{ color: confColor }}>Confidence: {confidence}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${c.done ? "bg-primary/5 border-primary/20" : "bg-secondary border-border"}`}>
            <span className={`text-sm ${c.done ? "text-primary" : "text-muted-foreground"}`}>{c.done ? "✓" : "○"}</span>
            <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>

      {weakAreas.length > 0 && (
        <div className="bg-secondary/50 border border-border rounded-lg p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Areas to Improve</div>
          <ul className="space-y-1">
            {weakAreas.map((a, i) => <li key={i} className="text-xs text-muted-foreground">→ {a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ReadinessScore;
