import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const mockAnalysis = {
  keywords: ["AI/ML", "product analytics", "cross-functional", "A/B testing", "data-driven", "stakeholder management", "OKRs", "roadmap"],
  missingKeywords: ["Kubernetes", "CI/CD", "MLOps"],
  weakVerbs: ["helped", "worked on", "responsible for"],
  suggestedVerbs: ["Orchestrated", "Spearheaded", "Architected", "Drove"],
  score: 74,
};

const mockBullets = [
  {
    original: "Led development of AI-powered analytics dashboard serving 50K+ enterprise users across 12 markets",
    rewritten: "Spearheaded development of an AI/ML-powered product analytics dashboard, leveraging A/B testing and data-driven insights, serving 50K+ enterprise users across 12 markets — driving a 35% improvement in customer retention",
    hasMetric: true,
    keywords: ["AI/ML", "product analytics", "A/B testing", "data-driven"],
  },
  {
    original: "Drove 35% improvement in customer retention through personalized recommendation engine",
    rewritten: "Drove 35% improvement in customer retention by architecting a cross-functional recommendation engine aligned with OKRs, collaborating with stakeholder management across 3 product teams",
    hasMetric: true,
    keywords: ["cross-functional", "OKRs", "stakeholder management"],
  },
  {
    original: "Managed cross-functional team of 8 engineers, 2 designers, and 3 data scientists",
    rewritten: "Orchestrated a cross-functional team of 13 (8 engineers, 2 designers, 3 data scientists) to deliver roadmap milestones on time, reducing sprint cycle time by [METRIC NEEDED]",
    hasMetric: false,
    keywords: ["cross-functional", "roadmap"],
  },
];

const mockProjects = [
  {
    title: "RAG Pipeline for Customer Support",
    bullets: ["Built retrieval-augmented generation pipeline using LangChain and Pinecone", "Reduced avg. support resolution time by 40%"],
    signal: "AI platform / ML infrastructure",
  },
  {
    title: "Agentic Workflow Automation",
    bullets: ["Designed multi-agent system for automated data quality checks", "Processed 1M+ records/day with 99.7% accuracy"],
    signal: "Automation / AI agents",
  },
  {
    title: "Product Analytics Dashboard v2",
    bullets: ["Rebuilt analytics pipeline with real-time streaming", "Increased daily active usage by 25% among PM stakeholders"],
    signal: "Data analytics / product insights",
  },
];

const JobWorkspace = () => {
  const [expandedBullet, setExpandedBullet] = useState<number | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);

  const toggleProject = (i: number) => {
    setSelectedProjects(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 2 ? [...prev, i] : prev
    );
  };

  const allMetrics = mockBullets.every(b => b.hasMetric);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Stripe — Senior Product Manager</h1>
            <p className="text-sm text-muted-foreground">Created Feb 20, 2026 • v1</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-success border-success/30">Ready</Badge>
            <Button
              disabled={!allMetrics}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={() => toast.success("PDF exported!")}
            >
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </div>

        {/* ATS Score */}
        <div className="bg-gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">ATS Quick Score</h2>
          </div>

          <div className="flex items-center gap-8 mb-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={mockAnalysis.score >= 80 ? "hsl(var(--score-high))" : mockAnalysis.score >= 60 ? "hsl(var(--score-mid))" : "hsl(var(--score-low))"}
                  strokeWidth="8"
                  strokeDasharray={`${mockAnalysis.score * 2.64} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold font-mono">{mockAnalysis.score}%</span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Matched Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {mockAnalysis.keywords.map(k => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Missing Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {mockAnalysis.missingKeywords.map(k => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Suggested Verbs</p>
                <div className="flex flex-wrap gap-1.5">
                  {mockAnalysis.suggestedVerbs.map(v => (
                    <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bullet Rewrites */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Bullet Rewrites</h2>
          </div>

          <div className="space-y-3">
            {mockBullets.map((b, i) => (
              <div key={i} className="bg-gradient-card border border-border rounded-xl shadow-card overflow-hidden">
                <button
                  onClick={() => setExpandedBullet(expandedBullet === i ? null : i)}
                  className="w-full p-4 text-left flex items-start gap-3"
                >
                  <div className="mt-0.5 shrink-0">
                    {b.hasMetric ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{b.rewritten}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {b.keywords.map(k => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {expandedBullet === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {expandedBullet === i && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Original bullet:</p>
                    <p className="text-sm text-muted-foreground italic">{b.original}</p>
                    {!b.hasMetric && (
                      <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <p className="text-xs text-warning font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> Metric required before PDF export
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Project Suggestions */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Suggested Projects</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Pick up to 2 projects to add under your Projects section</p>

          <div className="space-y-3">
            {mockProjects.map((p, i) => {
              const selected = selectedProjects.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleProject(i)}
                  className={`w-full text-left bg-gradient-card border rounded-xl p-4 shadow-card transition-colors ${
                    selected ? "border-primary shadow-glow" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{p.title}</h3>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selected && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </div>
                  <ul className="space-y-1 mb-2">
                    {p.bullets.map((b, j) => (
                      <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span> {b}
                      </li>
                    ))}
                  </ul>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                    {p.signal}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default JobWorkspace;
