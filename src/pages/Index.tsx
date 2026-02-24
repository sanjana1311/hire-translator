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
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-xs font-bold text-background">H</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">HireOS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-medium text-primary mb-4 tracking-wide">
              AI-Powered Career Tools
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08] mb-5 text-foreground">
              Resumes that match.
              <br />
              <span className="text-muted-foreground">Careers that launch.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              HireOS rewrites your resume for each job — using exact keywords and signals from the job description. Every bullet verified. Every metric real.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                size="lg"
                className="h-12 px-8 text-base rounded-full"
                onClick={() => navigate("/auth")}
              >
                Start for free
                <ArrowRight className="ml-1.5 w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base rounded-full"
                onClick={() => navigate("/auth")}
              >
                Learn more
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2 text-foreground">How it works</h2>
            <p className="text-muted-foreground">Four steps to a perfectly tailored resume.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-2xl border border-border p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Step {i + 1}</p>
                <h3 className="font-medium text-foreground mb-1">{step.label}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-2xl border border-border p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 HireOS</span>
          <span className="text-xs">No fabricated metrics. Ever.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
