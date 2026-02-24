import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResumeProfile = () => {
  const [hasResume, setHasResume] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setHasResume(true);
      toast.success("Resume parsed and saved!");
    }, 2000);
  };

  if (!hasResume) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold mb-1">Resume Profile</h1>
          <p className="text-muted-foreground text-sm mb-8">Upload your master resume — we'll parse it into structured fields</p>

          <div
            className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-gradient-card"
            onClick={handleUpload}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing your resume...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium mb-1">Drop your resume here or click to upload</p>
                  <p className="text-sm text-muted-foreground">PDF, DOCX supported • Parsed into structured fields</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4">Or paste your resume text below:</p>
            <Textarea
              placeholder="Paste resume content here..."
              className="min-h-[200px] bg-secondary border-border font-mono text-sm"
            />
            <Button className="mt-4 bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={handleUpload}>
              Parse Resume
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

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
          <Button variant="outline" size="sm">
            <Edit3 className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>

        {/* Summary */}
        <Section title="Summary">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Experienced product leader with 8+ years driving AI-powered platforms from 0→1. Proven track record in cross-functional delivery, data strategy, and enterprise customer growth.
          </p>
        </Section>

        {/* Experience */}
        <Section title="Experience">
          <ExperienceEntry
            company="Acme Corp"
            title="Senior Product Manager"
            dates="2022 – Present"
            bullets={[
              "Led development of AI-powered analytics dashboard serving 50K+ enterprise users across 12 markets",
              "Drove 35% improvement in customer retention through personalized recommendation engine",
              "Managed cross-functional team of 8 engineers, 2 designers, and 3 data scientists",
            ]}
          />
          <ExperienceEntry
            company="StartupXYZ"
            title="Product Manager"
            dates="2019 – 2022"
            bullets={[
              "Launched automated onboarding workflow reducing time-to-value by 60%",
              "Built and scaled B2B SaaS platform from $0 to $2M ARR",
            ]}
          />
        </Section>

        {/* Education */}
        <Section title="Education">
          <div className="text-sm">
            <p className="font-medium">M.S. Computer Science — Stanford University</p>
            <p className="text-muted-foreground">2017 – 2019</p>
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {["Python", "SQL", "Tableau", "Product Analytics", "A/B Testing", "Agile", "Jira", "Figma", "TensorFlow", "AWS"].map(s => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                {s}
              </span>
            ))}
          </div>
        </Section>
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
      {bullets.map((b, i) => (
        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
          <span className="text-primary mt-1.5 shrink-0">•</span>
          {b}
        </li>
      ))}
    </ul>
  </div>
);

export default ResumeProfile;
