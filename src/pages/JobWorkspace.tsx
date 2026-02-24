import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  ArrowLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/use-workspaces";
import { useResume } from "@/hooks/use-resume";
import { generateResumePDF, validateBulletMetrics } from "@/lib/pdf-export";
import { format } from "date-fns";

const METRIC_TYPES = [
  { value: "percent", label: "% improvement" },
  { value: "time", label: "Time saved" },
  { value: "cost", label: "Cost saved ($)" },
  { value: "revenue", label: "Revenue ($)" },
  { value: "volume", label: "Volume / throughput" },
  { value: "adoption", label: "Adoption / users" },
];

const JobWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: ws, isLoading } = useWorkspace(id);
  const { data: resume } = useResume();
  const updateWs = useUpdateWorkspace();
  const [expandedBullet, setExpandedBullet] = useState<number | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [metricModal, setMetricModal] = useState<number | null>(null);
  const [metricType, setMetricType] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricContext, setMetricContext] = useState("");
  const [exporting, setExporting] = useState(false);

  const toggleProject = (i: number) => {
    setSelectedProjects(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 2 ? [...prev, i] : prev
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ws) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground mb-4">Workspace not found</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/workspaces")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workspaces
        </Button>
      </div>
    );
  }

  const analysis = ws.jd_analysis as any || {};
  const bullets = Array.isArray(ws.rewritten_bullets) ? ws.rewritten_bullets : [];
  const projects = Array.isArray(ws.suggested_projects) ? ws.suggested_projects : [];
  const missingMetrics = validateBulletMetrics(bullets);
  const allMetricsValid = bullets.length > 0 && missingMetrics.length === 0;
  const hasAnalysis = analysis.keywords && analysis.keywords.length > 0;

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    applied: "Applied",
  };

  const handleAddMetric = () => {
    if (metricModal === null || !metricType || !metricValue) {
      toast.error("Please select a metric type and enter a value");
      return;
    }

    const bullet = bullets[metricModal];
    let metricText = "";
    switch (metricType) {
      case "percent": metricText = `${metricValue}%`; break;
      case "time": metricText = `${metricValue}`; break;
      case "cost": metricText = `$${metricValue}`; break;
      case "revenue": metricText = `$${metricValue}`; break;
      case "volume": metricText = `${metricValue}`; break;
      case "adoption": metricText = `${metricValue} users`; break;
      default: metricText = metricValue;
    }

    // Replace [METRIC NEEDED] or append metric to bullet
    let updatedText = bullet.rewritten;
    if (updatedText.includes("[METRIC NEEDED]")) {
      updatedText = updatedText.replace("[METRIC NEEDED]", metricText);
    } else {
      updatedText = updatedText.replace(/\s*$/, ` — achieving ${metricText}`);
    }
    if (metricContext) {
      updatedText += ` (${metricContext})`;
    }

    const updatedBullets = [...bullets];
    updatedBullets[metricModal] = {
      ...bullet,
      rewritten: updatedText,
      hasMetric: true,
    };

    updateWs.mutate(
      { id: ws.id, rewritten_bullets: updatedBullets as any },
      {
        onSuccess: () => {
          toast.success("Metric added!");
          setMetricModal(null);
          setMetricType("");
          setMetricValue("");
          setMetricContext("");
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleExport = () => {
    if (!allMetricsValid) {
      toast.error(`${missingMetrics.length} bullet(s) still need metrics before export`);
      return;
    }
    if (!resume) {
      toast.error("No resume found. Please upload your resume first.");
      return;
    }

    setExporting(true);
    try {
      const selProjects = selectedProjects.map(i => projects[i]).filter(Boolean);
      generateResumePDF({ resume, workspace: ws, selectedProjects: selProjects });
      toast.success("PDF exported!");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => navigate("/dashboard/workspaces")} className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Workspaces
            </button>
            <h1 className="text-2xl font-bold mb-1">{ws.company} — {ws.role_title}</h1>
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(ws.created_at), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`capitalize ${ws.status === 'ready' ? 'text-success border-success/30' : ws.status === 'applied' ? 'text-primary border-primary/30' : ''}`}>
              {statusLabel[ws.status] || ws.status}
            </Badge>
            <Button
              disabled={!allMetricsValid || exporting}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
              onClick={handleExport}
              title={!allMetricsValid ? `${missingMetrics.length} bullet(s) need metrics` : "Export PDF"}
            >
              {exporting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </div>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Metric Gate Banner */}
        {bullets.length > 0 && !allMetricsValid && (
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {missingMetrics.length} bullet{missingMetrics.length > 1 ? "s" : ""} missing metrics
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF export is blocked until every bullet has a measurable impact metric (%, $, time saved, volume, etc.). Click the warning icon on each bullet to add the missing metric.
                </p>
              </div>
            </div>
          </div>
        )}

        {bullets.length > 0 && allMetricsValid && (
          <div className="mb-6 p-4 rounded-xl border border-success/30 bg-success/5">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-success">All metrics verified — ready to export!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Every bullet has a verified metric. You can now export your ATS-friendly PDF.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Job Description */}
        {ws.job_description && (
          <div className="bg-gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Job Description
            </h2>
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
              {ws.job_description}
            </pre>
          </div>
        )}

        {/* ATS Score */}
        {hasAnalysis && (
          <div className="bg-gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">ATS Quick Score</h2>
            </div>
            <div className="flex items-center gap-8 mb-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={ws.ats_score >= 80 ? "hsl(var(--score-high))" : ws.ats_score >= 60 ? "hsl(var(--score-mid))" : "hsl(var(--score-low))"}
                    strokeWidth="8" strokeDasharray={`${ws.ats_score * 2.64} 264`} strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold font-mono">{ws.ats_score}%</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {analysis.keywords?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Matched Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.keywords.map((k: string) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.missingKeywords?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Missing Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.missingKeywords.map((k: string) => (
                        <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bullet Rewrites */}
        {bullets.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Bullet Rewrites</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {bullets.length - missingMetrics.length}/{bullets.length} verified
              </span>
            </div>

            <div className="space-y-3">
              {bullets.map((b: any, i: number) => {
                const isMissing = missingMetrics.includes(i);
                return (
                  <div key={i} className={`bg-gradient-card border rounded-xl shadow-card overflow-hidden ${isMissing ? "border-warning/40" : "border-border"}`}>
                    <button
                      onClick={() => setExpandedBullet(expandedBullet === i ? null : i)}
                      className="w-full p-4 text-left flex items-start gap-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        {!isMissing ? (
                          <CheckCircle className="w-4 h-4 text-success" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{b.rewritten}</p>
                        {b.keywords && b.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {b.keywords.map((k: string) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{k}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {expandedBullet === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {expandedBullet === i && (
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground mb-1">Original bullet:</p>
                        <p className="text-sm text-muted-foreground italic">{b.original}</p>
                        {isMissing && (
                          <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-warning font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" /> Metric required before PDF export
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-warning/30 text-warning hover:bg-warning/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMetricModal(i);
                                }}
                              >
                                Add Metric
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Project Suggestions */}
        {projects.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Suggested Projects</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Pick up to 2 projects to add under your Projects section</p>
            <div className="space-y-3">
              {projects.map((p: any, i: number) => {
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
                      {(p.bullets || []).map((b: string, j: number) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span> {b}
                        </li>
                      ))}
                    </ul>
                    {p.signal && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                        {p.signal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasAnalysis && bullets.length === 0 && (
          <div className="bg-gradient-card border border-border rounded-xl p-8 text-center shadow-card">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-1">No analysis yet</p>
            <p className="text-xs text-muted-foreground">AI analysis will appear here once you run it.</p>
          </div>
        )}
      </motion.div>

      {/* Metric Input Modal */}
      {metricModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-gradient-card border border-border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Missing Metric</h3>
              <button onClick={() => setMetricModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">Bullet:</p>
              <p className="text-sm leading-relaxed">{bullets[metricModal]?.rewritten}</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Impact metric type</Label>
                <Select value={metricType} onValueChange={setMetricType}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-border">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Metric value</Label>
                <Input
                  value={metricValue}
                  onChange={e => setMetricValue(e.target.value)}
                  placeholder={metricType === "percent" ? "e.g. 35" : metricType === "cost" || metricType === "revenue" ? "e.g. 500K" : "e.g. 2M+ records/day"}
                  className="mt-1.5 bg-secondary border-border"
                />
              </div>

              <div>
                <Label className="text-sm">Context (optional)</Label>
                <Input
                  value={metricContext}
                  onChange={e => setMetricContext(e.target.value)}
                  placeholder="e.g. YoY, across 12 markets"
                  className="mt-1.5 bg-secondary border-border"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMetricModal(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={handleAddMetric}
                  disabled={updateWs.isPending}
                >
                  {updateWs.isPending ? "Saving..." : "Add Metric"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default JobWorkspace;
