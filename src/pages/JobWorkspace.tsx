import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, FileText, Sparkles, AlertTriangle, CheckCircle, Download,
  ChevronDown, ChevronUp, ArrowLeft, X, History, Save, RotateCcw,
  GitCompare, Lightbulb, Wand2, BarChart3, Clock, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/use-workspaces";
import { useResume } from "@/hooks/use-resume";
import { generateResumePDF } from "@/lib/pdf-export";
import { validateTailoredResume } from "@/lib/resume-guard";
import { buildFormattedDocument } from "@/lib/resume-document";
import { downloadTailoredPdf } from "@/lib/resume-export";
import TailoredResumeDocument from "@/components/TailoredResumeDocument";

import { format } from "date-fns";
import {
  useWorkspaceVersions, useSaveVersion, useDeleteVersion, WorkspaceVersion,
} from "@/hooks/use-workspace-versions";

const BUCKET_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: "Strong Match", color: "text-success", desc: "Minor tweaks only" },
  B: { label: "Good Match", color: "text-primary", desc: "Resume needs reframing" },
  C: { label: "Gap Exists", color: "text-warning", desc: "A project could close it" },
  D: { label: "Weak Match", color: "text-destructive", desc: "Significant mismatch" },
};

const STEP_LABELS = [
  { num: 1, label: "Signal Mining", icon: Target },
  { num: 2, label: "Match Score", icon: BarChart3 },
  { num: 3, label: "Projects", icon: Lightbulb },
  { num: 4, label: "Tailor Resume", icon: Wand2 },
];

function getActiveStep(ws: any): number {
  const status = ws?.status || "draft";
  if (status === "draft") return 0;
  if (status === "analyzing" || status === "signals_ready") return 1;
  if (status === "scored" || status === "weak_match") return 2;
  if (status === "ready") return 4;
  return 2; // default to scored
}

const JobWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: ws, isLoading, refetch } = useWorkspace(id);
  const { data: resume } = useResume();
  const updateWs = useUpdateWorkspace();
  const { data: versions = [], isLoading: versionsLoading } = useWorkspaceVersions(id);
  const saveVersion = useSaveVersion();
  const deleteVersion = useDeleteVersion();
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAction, setCurrentAction] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [compareVersion, setCompareVersion] = useState<WorkspaceVersion | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const runStep = async (step: string, label: string) => {
    if (!ws) return;
    setAnalyzing(true);
    setCurrentAction(label);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-jd", {
        body: { workspaceId: ws.id, step },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${label} complete!`);
      await refetch();
    } catch (err: any) {
      toast.error(err.message || `${label} failed`);
    } finally {
      setAnalyzing(false);
      setCurrentAction("");
    }
  };

  const handleSaveSelectedProjects = async () => {
    if (!ws) return;
    const projects = (ws.suggested_projects as any[]) || [];
    const selected = selectedProjects.map(i => projects[i]).filter(Boolean);
    updateWs.mutate(
      { id: ws.id, selected_projects: selected as any },
      {
        onSuccess: () => toast.success("Projects saved!"),
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleExport = () => {
    if (!resume || !ws) return;
    setExporting(true);
    try {
      const raw = (ws.tailored_resume as any) || null;
      if (raw?.summary && resume.raw_text) {
        // Export mirrors the uploaded resume's structure — no analysis content.
        const { resume: validated } = validateTailoredResume(raw, resume.raw_text);
        const doc = buildFormattedDocument(validated, { layout: (resume as any).layout, rawText: resume.raw_text });
        downloadTailoredPdf(doc, `${ws.company}_${ws.role_title}_Resume`);
      } else {
        const selProjects = (ws.selected_projects as any[]) || [];
        generateResumePDF({ resume, workspace: ws, selectedProjects: selProjects });
      }
      toast.success("PDF exported!");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const handleSaveVersion = () => {
    if (!ws) return;
    const snapshot = {
      tailored_resume: ws.tailored_resume,
      jd_analysis: ws.jd_analysis,
      gap_analysis: ws.gap_analysis,
      ats_score: ws.ats_score,
      match_bucket: ws.match_bucket,
      suggested_projects: ws.suggested_projects,
      selected_projects: ws.selected_projects,
    };
    saveVersion.mutate(
      { workspaceId: ws.id, snapshot, label: versionLabel.trim() },
      {
        onSuccess: (v) => {
          toast.success(`Version ${v.version_number} saved`);
          setShowSaveModal(false);
          setVersionLabel("");
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleRevert = (version: WorkspaceVersion) => {
    if (!ws) return;
    const snap = version.resume_snapshot as any;
    if (!snap) { toast.error("Empty snapshot"); return; }
    updateWs.mutate(
      {
        id: ws.id,
        tailored_resume: snap.tailored_resume ?? {},
        jd_analysis: snap.jd_analysis ?? {},
        gap_analysis: snap.gap_analysis ?? {},
        ats_score: snap.ats_score ?? 0,
        suggested_projects: snap.suggested_projects ?? [],
        selected_projects: snap.selected_projects ?? [],
      },
      {
        onSuccess: () => {
          toast.success(`Reverted to version ${version.version_number}`);
          setCompareVersion(null);
          setShowVersions(false);
        },
        onError: (err: any) => toast.error(err.message),
      }
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

  const activeStep = getActiveStep(ws);
  const jdAnalysis = ws.jd_analysis as any || {};
  const gapAnalysis = ws.gap_analysis as any || {};
  const rawTailoredResume = ws.tailored_resume as any || {};
  const tailoredValidation = rawTailoredResume?.summary
    ? validateTailoredResume(rawTailoredResume as any, resume?.raw_text || "")
    : null;
  const tailoredResume: any = tailoredValidation
    ? { ...rawTailoredResume, ...tailoredValidation.resume }
    : rawTailoredResume;

  const suggestedProjects = Array.isArray(ws.suggested_projects) ? ws.suggested_projects : [];
  const bucket = ws.match_bucket || gapAnalysis?.bucket || "";
  const bucketConfig = BUCKET_CONFIG[bucket];
  const hasJdSignals = !!jdAnalysis?.must_have_skills?.length;
  const hasScore = !!gapAnalysis?.overall_score;
  const hasTailoredResume = !!tailoredResume?.summary;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => navigate("/dashboard/workspaces")} className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Workspaces
            </button>
            <h1 className="text-2xl font-bold mb-1">
              {ws.company || "New Workspace"} {ws.role_title ? `— ${ws.role_title}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(ws.created_at), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bucket && bucketConfig && (
              <Badge variant="outline" className={`${bucketConfig.color} border-current/30 font-mono`}>
                {bucket} — {bucketConfig.label}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowSaveModal(true)} disabled={saveVersion.isPending}>
              <Save className="w-4 h-4 mr-1.5" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowVersions(!showVersions)}>
              <History className="w-4 h-4 mr-1.5" /> History{versions.length > 0 && ` (${versions.length})`}
            </Button>
            {hasTailoredResume && (
              <Button
                className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="w-4 h-4 mr-1.5" /> {exporting ? "Exporting..." : "Export PDF"}
              </Button>
            )}
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-2 mb-8 bg-card border border-border rounded-2xl p-4 shadow-card">
          {STEP_LABELS.map((s, i) => {
            const Icon = s.icon;
            const completed = activeStep > s.num;
            const active = activeStep === s.num;
            return (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  completed ? "bg-success/10 text-success" :
                  active ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {completed ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-px ${completed ? "bg-success/30" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Job Description */}
        {ws.job_description && (
          <div className="bg-card border border-border rounded-2xl shadow-card mb-6 overflow-hidden">
            <button
              className="w-full p-5 text-left flex items-center justify-between"
              onClick={() => setExpandedSection(expandedSection === "jd" ? null : "jd")}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">Job Description</span>
              </div>
              {expandedSection === "jd" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expandedSection === "jd" && (
              <div className="px-5 pb-5 border-t border-border pt-3">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                  {ws.job_description}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 1+2: Analyze (empty state) ═══ */}
        {activeStep === 0 && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-card mb-6">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-1">Ready to analyze</p>
            <p className="text-xs text-muted-foreground mb-4">
              AI will mine the JD for signals and score your resume fit.
            </p>
            <Button
              onClick={() => runStep("analyze", "Analysis")}
              disabled={analyzing || !ws.job_description}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              {analyzing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  {currentAction}... (this may take ~30s)
                </div>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Run Analysis</>
              )}
            </Button>
          </div>
        )}

        {/* ═══ JD Signals (after Step 1) ═══ */}
        {hasJdSignals && (
          <div className="bg-card border border-border rounded-2xl shadow-card mb-6 overflow-hidden">
            <button
              className="w-full p-5 text-left flex items-center justify-between"
              onClick={() => setExpandedSection(expandedSection === "signals" ? null : "signals")}
            >
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">JD Signals</span>
                <Badge variant="outline" className="text-xs ml-2">
                  {jdAnalysis.must_have_skills?.length || 0} must-haves
                </Badge>
              </div>
              {expandedSection === "signals" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expandedSection === "signals" && (
              <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                {jdAnalysis.seniority_level && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">{jdAnalysis.seniority_level}</Badge>
                    {jdAnalysis.seniority_signals?.leadership_expected && (
                      <Badge variant="outline" className="text-xs">Leadership expected</Badge>
                    )}
                    {jdAnalysis.seniority_signals?.years_experience_mentioned && (
                      <Badge variant="outline" className="text-xs">{jdAnalysis.seniority_signals.years_experience_mentioned}+ years</Badge>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Must-Have Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(jdAnalysis.must_have_skills || []).map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Nice-to-Have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(jdAnalysis.nice_to_have_skills || []).map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tools & Technologies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(jdAnalysis.tools_and_technologies || []).map((t: string) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
                    ))}
                  </div>
                </div>
                {jdAnalysis.red_flags?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">🚩 Red Flags</p>
                    <ul className="space-y-1">
                      {jdAnalysis.red_flags.map((f: string, i: number) => (
                        <li key={i} className="text-xs text-destructive">{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">ATS Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(jdAnalysis.keywords_for_ats || []).map((k: string) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Match Score (after Step 2) ═══ */}
        {hasScore && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-card mb-6">
            <div className="flex items-start gap-6">
              {/* Score Circle */}
              <div className="text-center shrink-0">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none"
                      stroke={gapAnalysis.overall_score >= 80 ? "hsl(var(--score-high))" :
                              gapAnalysis.overall_score >= 60 ? "hsl(var(--score-mid))" :
                              gapAnalysis.overall_score >= 40 ? "hsl(var(--warning))" : "hsl(var(--score-low))"}
                      strokeWidth="8"
                      strokeDasharray={`${(gapAnalysis.overall_score || 0) * 2.64} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold font-mono">{gapAnalysis.overall_score}</span>
                  </div>
                </div>
                {bucketConfig && (
                  <p className={`text-xs font-medium mt-2 ${bucketConfig.color}`}>{bucketConfig.desc}</p>
                )}
              </div>

              {/* Coverage Details */}
              <div className="flex-1 space-y-3">
                {/* Strengths */}
                {gapAnalysis.top_strengths?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Top Strengths</p>
                    <ul className="space-y-0.5">
                      {gapAnalysis.top_strengths.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-success flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {gapAnalysis.top_gaps?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Top Gaps</p>
                    <ul className="space-y-0.5">
                      {gapAnalysis.top_gaps.map((g: string, i: number) => (
                        <li key={i} className="text-xs text-warning flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dealbreakers */}
                {gapAnalysis.dealbreaker_missing?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">⚠️ Dealbreakers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {gapAnalysis.dealbreaker_missing.map((d: string) => (
                        <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Coverage */}
                <div className="grid grid-cols-2 gap-3">
                  {gapAnalysis.must_have_coverage?.matched?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Skills Matched</p>
                      <div className="flex flex-wrap gap-1">
                        {gapAnalysis.must_have_coverage.matched.map((s: string) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gapAnalysis.must_have_coverage?.missing?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Skills Missing</p>
                      <div className="flex flex-wrap gap-1">
                        {gapAnalysis.must_have_coverage.missing.map((s: string) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommendation */}
                {gapAnalysis.recommendation && (
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                    <p className="text-xs text-foreground leading-relaxed">{gapAnalysis.recommendation}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons after scoring */}
            {activeStep === 2 && (
              <div className="flex gap-2 mt-5 pt-4 border-t border-border">
                {(bucket === "B" || bucket === "C") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runStep("projects", "Project Suggestions")}
                    disabled={analyzing}
                  >
                    {analyzing && currentAction === "Project Suggestions" ? (
                      <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" /> Suggesting...</>
                    ) : (
                      <><Lightbulb className="w-4 h-4 mr-1.5" /> Suggest Projects</>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={() => runStep("tailor", "Resume Tailoring")}
                  disabled={analyzing}
                >
                  {analyzing && currentAction === "Resume Tailoring" ? (
                    <><div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" /> Tailoring...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-1.5" /> Tailor Resume</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Project Suggestions (after Step 3) ═══ */}
        {suggestedProjects.length > 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-card mb-6 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">Suggested Projects</span>
                </div>
                <p className="text-xs text-muted-foreground">Select projects to include, then tailor</p>
              </div>

              <div className="space-y-3">
                {suggestedProjects.map((p: any, i: number) => {
                  const selected = selectedProjects.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedProjects(prev =>
                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                      )}
                      className={`w-full text-left border rounded-xl p-4 transition-all ${
                        selected ? "border-primary bg-primary/5 shadow-warm" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{p.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="w-3 h-3 mr-1" /> {p.estimated_hours}h
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{p.difficulty}</Badge>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selected ? "border-primary bg-primary" : "border-muted-foreground"
                          }`}>
                            {selected && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{p.what_to_build}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(p.tech_stack || []).map((t: string) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-success">
                        <Zap className="w-3 h-3 inline mr-0.5" /> Closes: {p.closes_gap}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4">
                {selectedProjects.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSaveSelectedProjects} disabled={updateWs.isPending}>
                    Save {selectedProjects.length} project(s)
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={() => runStep("tailor", "Resume Tailoring")}
                  disabled={analyzing}
                >
                  {analyzing && currentAction === "Resume Tailoring" ? (
                    <><div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" /> Tailoring...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-1.5" /> Tailor Resume</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Tailored Resume Preview (after Step 4) ═══ */}
        {hasTailoredResume && (
          <div className="bg-card border border-border rounded-2xl shadow-card mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">Tailored Resume</span>
                </div>
                <Badge className="bg-success/10 text-success border-success/30 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" /> Ready to export
                </Badge>
              </div>

              {/* Truth-boundary warning */}
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                  Review all AI-generated changes before applying. Only claims supported by your uploaded resume are kept.
                </p>
                {tailoredValidation && tailoredValidation.rejectedCount > 0 && (
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                    {tailoredValidation.rejectedCount} unsupported claim{tailoredValidation.rejectedCount > 1 ? "s" : ""} removed by validation.
                  </p>
                )}
                {tailoredResume.warnings?.map((w: string, i: number) => (
                  <p key={i} className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">{w}</p>
                ))}
              </div>

              {/* Export copy — mirrors the uploaded resume's own sections and order */}
              {resume?.raw_text && (
                <div className="mb-6">
                  <TailoredResumeDocument
                    resume={tailoredResume}
                    sourceResumeText={resume.raw_text}
                    sourceLayout={(resume as any).layout}
                    fileBase={`${ws.company}_${ws.role_title}_Resume`}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Analysis</p>



              {/* Summary */}
              <div className="mb-5">
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Summary</p>
                <p className="text-sm leading-relaxed text-foreground">{tailoredResume.summary}</p>
              </div>

              {/* Experience */}
              {tailoredResume.experience?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Experience</p>
                  <div className="space-y-4">
                    {tailoredResume.experience.map((exp: any, i: number) => (
                      <div key={i} className="border-l-2 border-primary/20 pl-4">
                        <div className="flex items-baseline justify-between mb-1">
                          <h4 className="text-sm font-semibold">{exp.title}</h4>
                          <span className="text-xs text-muted-foreground">{exp.dates}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{exp.company}</p>
                        <ul className="space-y-1.5">
                          {(exp.bullets || []).map((b: any, j: number) => (
                            <li key={j} className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                              <span className="text-primary mt-1 shrink-0">•</span>
                              <span className={b.rejected ? "line-through text-muted-foreground" : ""}>
                                {b.text}
                                {b.rejected ? (
                                  <Badge variant="outline" className="ml-2 text-[10px] text-destructive border-destructive/40">
                                    Removed — {b.reason}
                                  </Badge>
                                ) : b.confidence === "low" ? (
                                  <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-500/40">Low confidence — verify</Badge>
                                ) : b.confidence === "medium" ? (
                                  <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">Reworded</Badge>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {(exp.bullets || []).some((b: any) => b.evidence && !b.rejected) && (
                          <div className="mt-1.5 space-y-0.5">
                            {(exp.bullets || [])
                              .filter((b: any) => b.evidence && !b.rejected)
                              .map((b: any, k: number) => (
                                <p key={k} className="text-[11px] text-muted-foreground/80 italic pl-3 border-l border-border">
                                  Evidence: “{b.evidence}”
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirement coverage */}
              {Array.isArray(tailoredResume.requirements) && tailoredResume.requirements.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Requirement coverage</p>
                  <ul className="space-y-1.5">
                    {tailoredResume.requirements.map((r: any, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            r.status === "verified"
                              ? "bg-success/10 text-success"
                              : r.status === "transferable"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {r.status === "verified" ? "Verified" : r.status === "transferable" ? "Transferable" : "Missing"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-foreground leading-relaxed">{r.requirement}</p>
                          {r.evidence && <p className="text-[11px] text-muted-foreground/80 italic">Evidence: “{r.evidence}”</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Verified skills */}
              {tailoredResume.verified_skills?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Verified skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoredResume.verified_skills.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transferable skills */}
              {tailoredResume.transferable_skills?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Transferable skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoredResume.transferable_skills.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing requirements */}
              {tailoredResume.missing_requirements?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Missing requirements (Gap)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoredResume.missing_requirements.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{s}</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Not added to your resume — these stay listed as gaps.</p>
                </div>
              )}

              {/* Other skills from base resume */}
              {tailoredResume.skills?.length > 0 && !tailoredResume.verified_skills?.length && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoredResume.skills.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}


              {/* Projects */}
              {tailoredResume.projects?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Projects</p>
                  <div className="space-y-3">
                    {tailoredResume.projects.map((p: any, i: number) => (
                      <div key={i} className="border-l-2 border-accent/20 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold">{p.title}</h4>
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </div>
                        <ul className="space-y-1">
                          {(p.bullets || []).map((b: string, j: number) => (
                            <li key={j} className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                              <span className="text-accent mt-1 shrink-0">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Changes Made */}
              {tailoredResume.changes_made?.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <button
                    className="w-full text-left flex items-center justify-between"
                    onClick={() => setExpandedSection(expandedSection === "changes" ? null : "changes")}
                  >
                    <p className="text-xs text-muted-foreground font-medium">
                      {tailoredResume.changes_made.length} changes made
                    </p>
                    {expandedSection === "changes" ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  {expandedSection === "changes" && (
                    <ul className="mt-2 space-y-1">
                      {tailoredResume.changes_made.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">→</span> {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Re-analyze button if already analyzed */}
        {activeStep > 0 && activeStep < 4 && !analyzing && (
          <div className="flex justify-center mb-6">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
              onClick={() => runStep("analyze", "Re-analysis")}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Re-analyze
            </Button>
          </div>
        )}
      </motion.div>

      {/* Version History Panel */}
      <AnimatePresence>
        {showVersions && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-96 bg-background border-l border-border shadow-2xl z-40 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> Version History
                </h3>
                <button onClick={() => setShowVersions(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {versionsLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!versionsLoading && versions.length === 0 && (
                <div className="text-center py-8">
                  <History className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No versions saved yet</p>
                </div>
              )}

              <div className="space-y-3">
                {versions.map((v) => {
                  const snap = v.resume_snapshot as any;
                  return (
                    <div key={v.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium">v{v.version_number}</span>
                          {v.label && <p className="text-xs font-medium text-primary truncate max-w-[180px]">{v.label}</p>}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(v.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        {snap?.match_bucket && (
                          <Badge variant="outline" className="text-xs font-mono">{snap.match_bucket}</Badge>
                        )}
                      </div>
                      {snap?.ats_score !== undefined && (
                        <p className="text-xs text-muted-foreground mb-3">Score: {snap.ats_score}</p>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs h-7"
                          onClick={() => setCompareVersion(v)}
                        >
                          <GitCompare className="w-3 h-3 mr-1" /> Compare
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs h-7"
                          onClick={() => handleRevert(v)}
                          disabled={updateWs.isPending}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Revert
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Version Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Save className="w-5 h-5 text-primary" /> Save Version
              </h3>
              <button onClick={() => { setShowSaveModal(false); setVersionLabel(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <Label className="text-sm">Version label (optional)</Label>
              <Input
                value={versionLabel}
                onChange={e => setVersionLabel(e.target.value)}
                placeholder="e.g. Final draft"
                className="mt-1.5 bg-secondary border-border"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveVersion()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowSaveModal(false); setVersionLabel(""); }}>Cancel</Button>
              <Button className="flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90"
                onClick={handleSaveVersion} disabled={saveVersion.isPending}
              >
                {saveVersion.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Compare Modal */}
      {compareVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-card border border-border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                Compare: Current vs v{compareVersion.version_number}
              </h3>
              <button onClick={() => setCompareVersion(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-3 text-primary">Current</h4>
                {hasTailoredResume ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{tailoredResume.summary}</p>
                    {tailoredResume.experience?.map((e: any, i: number) => (
                      <div key={i}>
                        <p className="text-xs font-medium">{e.title} — {e.company}</p>
                        {e.bullets?.map((b: any, j: number) => (
                          <p key={j} className="text-xs text-muted-foreground pl-2">• {typeof b === "string" ? b : b.text}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No tailored resume yet</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">v{compareVersion.version_number}</h4>
                {(() => {
                  const snap = compareVersion.resume_snapshot as any;
                  const snapResume = snap?.tailored_resume;
                  if (!snapResume?.summary) return <p className="text-xs text-muted-foreground">No data</p>;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{snapResume.summary}</p>
                      {snapResume.experience?.map((e: any, i: number) => (
                        <div key={i}>
                          <p className="text-xs font-medium">{e.title} — {e.company}</p>
                          {e.bullets?.map((b: any, j: number) => (
                            <p key={j} className="text-xs text-muted-foreground pl-2">• {typeof b === "string" ? b : b.text}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setCompareVersion(null)}>Close</Button>
              <Button onClick={() => handleRevert(compareVersion)} disabled={updateWs.isPending}
                className="bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Revert to v{compareVersion.version_number}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default JobWorkspace;
