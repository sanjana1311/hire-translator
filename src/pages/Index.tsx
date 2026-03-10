import { motion } from "framer-motion";
import { ArrowRight, Upload, FileText, Target, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const steps = [
  {
    icon: Upload,
    step: "STEP 1",
    title: "Upload Resume",
    desc: "Upload once. Structured for reuse.",
    color: "hsl(348, 60%, 52%)",
    bg: "hsl(348, 60%, 95%)",
  },
  {
    icon: FileText,
    step: "STEP 2",
    title: "Paste Job Description",
    desc: "We extract keywords, clusters, and hiring signals.",
    color: "hsl(348, 60%, 52%)",
    bg: "hsl(348, 60%, 95%)",
  },
  {
    icon: Target,
    step: "STEP 3",
    title: "ATS Score + Smart Rewrites",
    desc: "Bullet points rebuilt using exact JD language.",
    color: "hsl(348, 60%, 52%)",
    bg: "hsl(348, 60%, 95%)",
  },
  {
    icon: Download,
    step: "STEP 4",
    title: "Export PDF",
    desc: "ATS-safe formatting. Metrics validated.",
    color: "hsl(348, 60%, 52%)",
    bg: "hsl(348, 60%, 95%)",
  },
];

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-[52px] px-7 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center mr-1.5"
            style={{ background: 'linear-gradient(135deg, #9B59B6, #E84393)' }}
          >
            <span className="text-white text-[9px] font-bold tracking-tight">CC</span>
          </div>
          <div className="flex flex-col leading-none">
            <span
              className="font-serif italic text-[15px] font-semibold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #9B59B6, #E84393)' }}
            >
              Career Compass
            </span>
            <span className="text-[9px] text-muted-foreground tracking-wide">AI-native career platform</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/auth")}>
            Log in
          </Button>
          <Button
            size="sm"
            className="text-xs rounded-full px-5"
            onClick={() => navigate("/auth")}
          >
            Get started
          </Button>
        </div>
      </nav>

      {/* Hero with gradient background */}
      <section
        className="relative pt-20 pb-28 px-7 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(280 40% 92%) 0%, hsl(330 50% 90%) 35%, hsl(20 60% 93%) 70%, hsl(37 24% 95%) 100%)',
        }}
      >
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.h1
            className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-5 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Stop guessing.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #9B59B6, #E84393, #E74C3C)' }}
            >
              Start matching.
            </span>
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-base mb-10 max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            Career Compass rewrites your resume for each job — using the exact keywords, phrases, and signals from the job description. Every bullet verified. Every metric real.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button
              className="rounded-full px-8 h-12 text-sm font-semibold shadow-lg"
              onClick={() => navigate("/auth")}
            >
              Start for free <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-7">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <motion.span
            className="text-xs font-semibold tracking-widest uppercase bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #9B59B6, #E84393)' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            HOW IT WORKS
          </motion.span>
          <motion.h2
            className="font-serif text-2xl md:text-3xl mt-3 mb-2"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Four steps to a hiring-ready resume
          </motion.h2>
          <motion.p
            className="text-muted-foreground text-sm"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Tailor every application with precision.
          </motion.p>
        </div>

        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: s.bg }}
              >
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider">{s.step}</span>
              <h3 className="text-sm font-semibold leading-snug">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="pb-20 px-7">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <motion.span
              className="text-xs font-semibold tracking-widest uppercase bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #9B59B6, #E84393)' }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              FEATURES
            </motion.span>
            <motion.h2
              className="font-serif text-2xl md:text-3xl mt-3"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Everything you need to land interviews
            </motion.h2>
          </div>
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

      {/* Footer */}
      <footer className="py-8 px-7 border-t border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 Career Compass</span>
          <span>AI-powered job search dashboard</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
