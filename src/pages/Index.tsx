import { motion } from "framer-motion";
import { ArrowRight, Upload, FileText, Target, Download, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const steps = [
  { icon: Upload, label: "Upload Resume", desc: "Parse once, reuse everywhere" },
  { icon: FileText, label: "Paste Job Description", desc: "We extract every signal" },
  { icon: Target, label: "ATS Score + Rewrites", desc: "Keyword-aligned bullets" },
  { icon: Download, label: "Export PDF", desc: "ATS-ready, metric-verified" },
];

const features = [
  { icon: Sparkles, title: "AI Bullet Rewrites", desc: "What → How → Who → Impact format with exact JD keyword alignment" },
  { icon: Target, title: "ATS Quick Score", desc: "Instant keyword match %, missing clusters, and high-signal verb suggestions" },
  { icon: Shield, title: "Metric Hard Gate", desc: "No fabricated numbers. Missing metrics? We ask before export." },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">HireOS</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log in
            </Button>
            <Button size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-xs text-muted-foreground mb-6">
              <Sparkles className="w-3 h-3 text-primary" />
              AI-Powered Career Operating System
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Stop guessing.
              <br />
              <span className="text-gradient-primary">Start matching.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              HireOS rewrites your resume for each job — using the exact keywords, phrases, and signals from the job description. Every bullet verified. Every metric real.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 px-8 h-12 text-base"
                onClick={() => navigate("/auth")}
              >
                Start for free <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold mb-3">Four steps to a perfect resume</h2>
            <p className="text-muted-foreground">Upload once. Tailor for every role.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-gradient-card rounded-xl border border-border p-6 shadow-card"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-xs font-mono text-muted-foreground mb-2">STEP {i + 1}</div>
                <h3 className="font-semibold mb-1">{step.label}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gradient-card rounded-xl border border-border p-6 shadow-card"
              >
                <f.icon className="w-6 h-6 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 HireOS</span>
          <span className="font-mono text-xs">No fabricated metrics. Ever.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
