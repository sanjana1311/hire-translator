import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, CheckCircle, Edit3, Save, FileText, Trash2, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useResume, useUpsertResume } from "@/hooks/use-resume";
import {
  useUploadResumeFile,
  useDeleteResumeFile,
  getResumeSignedUrl,
  validateResumeFile,
} from "@/hooks/use-resume-file";

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const fmtDateRelative = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

const ResumeFileCard = ({ resume }: { resume: any }) => {
  const upload = useUploadResumeFile();
  const del = useDeleteResumeFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState<{ name: string; at: string; extracted: number } | null>(null);
  const filePath = resume?.file_path as string | null;
  const uploadedAt = fmtDate(resume?.file_uploaded_at);
  const uploadedAtRelative = fmtDateRelative(resume?.file_uploaded_at);
  const hasExtractedText = resume?.raw_text && (resume.raw_text as string).length > 100;

  const pick = (file?: File | null) => {
    if (!file) return;
    setErrorMsg(null);
    setJustUploaded(null);
    const err = validateResumeFile(file);
    if (err) { setErrorMsg(err); toast.error(err); return; }
    upload.mutate(
      { file },
      {
        onSuccess: (res) => {
          setJustUploaded({ name: res.fileName, at: res.uploadedAt, extracted: res.extracted });
          if (res.extracted > 100) {
            toast.success(`${res.fileName} uploaded — ready to score jobs`);
          } else {
            toast.warning(
              `${res.fileName} uploaded, but no text could be read${res.extractError ? ` (${res.extractError})` : ""}. Paste your resume text below so scoring works.`
            );
          }
        },
        onError: (e: any) => {
          const msg = e?.message || "Upload failed";
          setErrorMsg(msg);
          toast.error(msg);
        },
      }
    );
  };

  const view = async () => {
    try {
      const url = await getResumeSignedUrl(filePath!);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      const msg = e?.message || "Could not open file";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-8 shadow-card">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Resume file</h2>
          {filePath && !upload.isPending && (
            <Badge
              variant="secondary"
              className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] hover:bg-[hsl(var(--success-bg))]"
            >
              <CheckCircle className="w-3 h-3 mr-1" /> Saved
            </Badge>
          )}
        </div>
        {!upload.isPending && filePath && (
          <span className="text-xs text-muted-foreground">
            Updated {uploadedAtRelative || uploadedAt || "recently"}
          </span>
        )}
      </div>

      {upload.isPending ? (
        <div className="flex items-center gap-3 py-6">
          <div className="relative w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Uploading and reading your resume…</p>
            <p className="text-xs text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        </div>
      ) : filePath ? (
        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <div className="relative w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-foreground" />
            {hasExtractedText && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[hsl(var(--success))] text-white flex items-center justify-center border-2 border-card">
                <CheckCircle className="w-3 h-3" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">{resume.file_name || "resume.pdf"}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {resume.file_size ? (
                <span>{(resume.file_size / 1024).toFixed(0)} KB</span>
              ) : null}
              {uploadedAt ? (
                <span>Uploaded {uploadedAt}</span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                Private to you
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={view}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> View
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive"
              disabled={del.isPending}
              onClick={() => {
                setErrorMsg(null);
                del.mutate(resume.id, {
                  onSuccess: () => { setJustUploaded(null); toast.success("Resume file deleted"); },
                  onError: (e: any) => { setErrorMsg(e?.message || "Delete failed"); toast.error(e?.message || "Delete failed"); },
                });
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-secondary mx-auto flex items-center justify-center mb-3">
            <Upload className="w-6 h-6 text-foreground" />
          </div>
          <p className="text-sm font-medium mb-1 text-foreground">Upload your resume (PDF)</p>
          <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
            Stored privately in your account. Max 10MB. We automatically extract the text so job scoring works.
          </p>
          <Button size="sm" className="rounded-xl" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" /> Upload Resume
          </Button>
        </div>
      )}

      {justUploaded && !upload.isPending && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] p-4">
          <CheckCircle className="w-5 h-5 text-[hsl(var(--success))] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[hsl(var(--success))]">
              Upload complete — {justUploaded.name}
            </p>
            <p className="text-xs text-[hsl(var(--success))]/80 mt-0.5">
              Uploaded on {fmtDate(justUploaded.at)}
              {justUploaded.extracted > 100
                ? ` · ${justUploaded.extracted.toLocaleString()} characters saved. Job scoring is ready.`
                : " · No readable text found. Paste your resume text below so scoring works."}
            </p>
          </div>
        </div>
      )}

      {errorMsg && !upload.isPending && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive break-words">{errorMsg}</p>
        </div>
      )}
    </div>
  );
};

const ResumeProfile = () => {
  const { data: resume, isLoading } = useResume();
  const upsert = useUpsertResume();
  const [pasteText, setPasteText] = useState("");
  const [editing, setEditing] = useState(false);

  // Editable state
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState<any[]>([]);

  const startEdit = () => {
    if (resume) {
      setSummary(resume.summary || "");
      setSkills(Array.isArray(resume.skills) ? resume.skills.join(", ") : "");
      setExperience(Array.isArray(resume.experience) ? resume.experience : []);
    }
    setEditing(true);
  };

  const handleSave = () => {
    upsert.mutate(
      {
        summary,
        skills: skills.split(",").map(s => s.trim()).filter(Boolean),
        experience,
      },
      {
        onSuccess: () => {
          toast.success("Resume saved!");
          setEditing(false);
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) {
      toast.error("Please paste resume content");
      return;
    }
    const lines = pasteText.trim().split("\n").filter(Boolean);
    upsert.mutate(
      {
        raw_text: pasteText,
        summary: lines[0] || "",
        experience: [],
        education: [],
        skills: [],
        achievements: [],
        projects: [],
      },
      {
        onSuccess: () => {
          toast.success("Resume parsed and saved!");
          setPasteText("");
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const headerStatus = resume?.file_path
    ? "Resume file saved — ready to use"
    : resume
    ? "Resume profile saved — add a PDF for job scoring"
    : "Upload your resume to get started";

  if (!resume) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1 text-foreground">Resume Profile</h1>
            <p className="text-muted-foreground text-sm">{headerStatus}</p>
          </div>

          <ResumeFileCard resume={null} />

          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4">Paste your resume text below:</p>
            <Textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste resume content here..."
              className="min-h-[200px] text-sm"
            />
            <Button
              className="mt-4 bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-xl"
              onClick={handlePasteSubmit}
              disabled={upsert.isPending}
            >
              {upsert.isPending ? "Saving..." : "Parse Resume"}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-foreground">Edit Resume</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground rounded-xl" onClick={handleSave} disabled={upsert.isPending}>
                <Save className="w-4 h-4 mr-2" /> {upsert.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <Label>Summary</Label>
              <Textarea value={summary} onChange={e => setSummary(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Skills (comma-separated)</Label>
              <Input value={skills} onChange={e => setSkills(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const expEntries = Array.isArray(resume.experience) ? resume.experience : [];
  const skillList = Array.isArray(resume.skills) ? resume.skills : [];
  const eduEntries = Array.isArray(resume.education) ? resume.education : [];
  const achievementList = Array.isArray(resume.achievements) ? resume.achievements : [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1 text-foreground">Resume Profile</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {resume?.file_path ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                  {headerStatus}
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  Parsed and saved
                </>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={startEdit}>
            <Edit3 className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>

        <ResumeFileCard resume={resume} />

        <Section title="Summary">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {resume.summary || <span className="italic">No summary yet</span>}
          </p>
        </Section>

        {expEntries.length > 0 && (
          <Section title="Experience">
            {expEntries.map((exp: any, i: number) => (
              <ExperienceEntry key={i} company={exp.company} title={exp.title} dates={exp.dates} bullets={exp.bullets || []} />
            ))}
          </Section>
        )}

        {eduEntries.length > 0 && (
          <Section title="Education">
            {eduEntries.map((edu: any, i: number) => (
              <div key={i} className="text-sm mb-2">
                <p className="font-medium text-foreground">{edu.degree} — {edu.school}</p>
                <p className="text-muted-foreground">{edu.dates}</p>
              </div>
            ))}
          </Section>
        )}

        {skillList.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {skillList.map((s: string, i: number) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">{s}</span>
              ))}
            </div>
          </Section>
        )}

        {achievementList.length > 0 && (
          <Section title="Achievements">
            <ul className="space-y-1.5">
              {achievementList.map((a: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1.5 shrink-0">•</span> {a}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {resume.raw_text && !resume.summary && expEntries.length === 0 && (
          <Section title="Raw Text">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{resume.raw_text.slice(0, 2000)}</pre>
          </Section>
        )}
      </motion.div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">{title}</h2>
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">{children}</div>
  </div>
);

const ExperienceEntry = ({ company, title, dates, bullets }: { company: string; title: string; dates: string; bullets: string[] }) => (
  <div className="mb-5 last:mb-0">
    <div className="flex items-center justify-between mb-2">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{company}</p>
      </div>
      <span className="text-xs text-muted-foreground">{dates}</span>
    </div>
    <ul className="space-y-1.5">
      {bullets.map((b: string, i: number) => (
        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
          <span className="text-primary mt-1.5 shrink-0">•</span>
          {b}
        </li>
      ))}
    </ul>
  </div>
);

export default ResumeProfile;
