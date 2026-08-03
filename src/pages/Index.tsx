import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  BarChart3,
  Mail,
  Search,
  Target,
  Zap,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "" });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast({
        title: "Please fill in your name and email",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://formspree.io/f/mpqyjpej", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.full_name.trim(),
          email: form.email.trim(),
        }),
      });
      if (!res.ok) throw new Error("Submission failed");

      await supabase.from("access_requests" as any).insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
      } as any);

      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-[52px] px-7 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center mr-1.5"
            style={{ background: "linear-gradient(135deg, #9B59B6, #E84393)" }}
          >
            <span className="text-white text-[9px] font-bold tracking-tight">hO</span>
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="font-serif italic text-[15px] font-semibold bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #9B59B6, #E84393)" }}
            >
              hireOS
            </span>
            <span className="text-[9px] text-muted-foreground tracking-wide">AI-native career platform</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/auth")}>
            Log in
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-7 overflow-hidden bg-gradient-hero">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            className="inline-block mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="text-xs font-medium text-primary">Invite-only beta</span>
          </motion.div>
          <motion.h1
            className="font-serif text-4xl md:text-5xl leading-[1.15] mb-4 text-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Your AI career mentor.
            <br />
            <span className="italic">Every single day.</span>
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-base mb-8 max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            hireOS scores every role against your resume, drafts tailored
            resumes, tracks applications, and preps you for interviews — automatically.
          </motion.p>

          {/* Waitlist Form */}
          <motion.div
            className="max-w-md mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {submitted ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">You're on the list!</h3>
                <p className="text-sm text-muted-foreground">
                  We'll reach out when your spot is ready. Keep an eye on your inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-3 text-left">
                <h3 className="text-sm font-semibold text-center mb-1">Request Early Access</h3>
                <p className="text-xs text-muted-foreground text-center mb-3">
                  We're onboarding users in small batches. Drop your info and we'll invite you soon.
                </p>
                <Input
                  placeholder="Full name *"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  maxLength={100}
                />
                <Input
                  type="email"
                  placeholder="Email *"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  maxLength={255}
                />
                <Button type="submit" className="w-full rounded-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Request Access <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-7 bg-background">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">The problem</span>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 text-foreground">
              Job seekers are flying blind.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Search,
                title: "Generic applications",
                desc: "Most people send the same resume to dozens of roles, hoping something sticks.",
              },
              {
                icon: BarChart3,
                title: "Opaque ATS filters",
                desc: "Applicant tracking systems screen for keywords and reject qualified candidates before a recruiter sees them.",
              },
              {
                icon: Users,
                title: "No feedback loop",
                desc: "There is no fast, personalized signal telling you why you didn't make the cut.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="bg-card border border-border rounded-xl p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-3">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-20 px-7 bg-secondary/30">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">The solution</span>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 text-foreground">
              One career OS for every job.
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
              hireOS turns your resume and a job description into a tailored application package in minutes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: FileText,
                title: "Resume parsing",
                desc: "Upload once. We structure experience, skills, education, and achievements into a living profile.",
              },
              {
                icon: Target,
                title: "JD analysis & scoring",
                desc: "AI extracts keywords, responsibilities, and hiring signals, then scores your fit for that role.",
              },
              {
                icon: Sparkles,
                title: "Tailored bullets",
                desc: "Every experience bullet is rewritten in strict WHAT-HOW-WHO-IMPACT format using exact JD keywords.",
              },
              {
                icon: Mail,
                title: "Gmail job import",
                desc: "Connect Gmail and automatically pull job opportunities from your inbox, ready to score.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="bg-card border border-border rounded-xl p-5 flex gap-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-7 bg-background">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">How it works</span>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 text-foreground">
              From job post to application-ready resume.
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                step: "01",
                title: "Upload your resume",
                desc: "One upload becomes your source-of-truth. Original metrics and bullets are preserved.",
              },
              {
                step: "02",
                title: "Add a job description",
                desc: "Paste any JD or import jobs from Gmail. hireOS parses the role's language and expectations.",
              },
              {
                step: "03",
                title: "Review your match score",
                desc: "See keyword coverage, missing clusters, and suggested strong verbs aligned to the role.",
              },
              {
                step: "04",
                title: "Export & apply",
                desc: "Get a tailored resume, optional project suggestions, and ATS-friendly PDF export.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="flex items-start gap-4 bg-card border border-border rounded-xl p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <span className="font-serif text-lg italic text-primary/80 shrink-0 w-10">{item.step}</span>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Traction */}
      <section className="py-20 px-7 bg-secondary/30">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">Traction & status</span>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 text-foreground">
              Built for the AI-native job search.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: ShieldCheck,
                title: "Secure, multi-user",
                desc: "Row-level security, waitlist gating, and password reset flow live.",
              },
              {
                icon: Zap,
                title: "AI pipeline deployed",
                desc: "End-to-end JD analysis, resume scoring, and bullet rewriting with real-time AI.",
              },
              {
                icon: TrendingUp,
                title: "Agent ready",
                desc: "MCP server integration lets external AI agents query and update your job data.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="bg-card border border-border rounded-xl p-5 text-center"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="pb-24 px-7 pt-16 bg-background">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-serif text-2xl md:text-3xl text-foreground">Everything in one place</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "ATS Scoring", desc: "Every role scored 0–100 against your resume in real time." },
              { title: "Tailored Resumes", desc: "AI rewrites your resume for each specific job description." },
              { title: "Application Tracker", desc: "Track status, detect recruiter replies, draft follow-ups." },
              { title: "Networking Intel", desc: "Who to find on LinkedIn, what to say, how to get noticed." },
              { title: "Interview Prep", desc: "Role-specific questions with hints and live AI feedback." },
              { title: "Mentor Reports", desc: "Weekly briefings that read like a real career mentor session." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="bg-card border border-border rounded-xl p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-7 bg-gradient-hero">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
              Ready to change how people get hired?
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Join the invite-only beta and get the first look at the AI-native career operating system.
            </p>
            <Button
              className="rounded-full px-6"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Request Early Access <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-7 border-t border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 hireOS</span>
          <span>AI-powered job search dashboard</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
