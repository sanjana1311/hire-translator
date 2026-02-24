import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, CheckCircle, Edit3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useResume, useUpsertResume } from "@/hooks/use-resume";

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
    // Simple parse: save raw text and summary from first paragraph
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

  if (!resume) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold mb-1">Resume Profile</h1>
          <p className="text-muted-foreground text-sm mb-8">Upload your master resume — we'll parse it into structured fields</p>

          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center bg-gradient-card cursor-default">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium mb-1">File upload coming soon</p>
                <p className="text-sm text-muted-foreground">For now, paste your resume text below</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4">Paste your resume text below:</p>
            <Textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste resume content here..."
              className="min-h-[200px] bg-secondary border-border font-mono text-sm"
            />
            <Button
              className="mt-4 bg-gradient-primary text-primary-foreground hover:opacity-90"
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
            <h1 className="text-2xl font-bold">Edit Resume</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="bg-gradient-primary text-primary-foreground" onClick={handleSave} disabled={upsert.isPending}>
                <Save className="w-4 h-4 mr-2" /> {upsert.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <Label>Summary</Label>
              <Textarea value={summary} onChange={e => setSummary(e.target.value)} className="mt-1.5 bg-secondary border-border" />
            </div>
            <div>
              <Label>Skills (comma-separated)</Label>
              <Input value={skills} onChange={e => setSkills(e.target.value)} className="mt-1.5 bg-secondary border-border" />
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Resume Profile</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-success" /> Parsed and saved
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Edit3 className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>

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
                <p className="font-medium">{edu.degree} — {edu.school}</p>
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
    <div className="bg-gradient-card border border-border rounded-xl p-5 shadow-card">{children}</div>
  </div>
);

const ExperienceEntry = ({ company, title, dates, bullets }: { company: string; title: string; dates: string; bullets: string[] }) => (
  <div className="mb-5 last:mb-0">
    <div className="flex items-center justify-between mb-2">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{company}</p>
      </div>
      <span className="text-xs text-muted-foreground font-mono">{dates}</span>
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
