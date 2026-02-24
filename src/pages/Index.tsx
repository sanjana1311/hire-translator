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
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">HireOS</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log in
            </Button>
            <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-5" onClick={() => navigate("/auth")}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero with gradient background */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,hsl(var(--background))_80%)]" />
        <div className="relative pt-20 pb-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground">
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
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-13 text-base shadow-warm"
                  onClick={() => navigate("/auth")}
                >
                  Start for free <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-foreground">Four steps to a perfect resume</h2>
            <p className="text-muted-foreground text-lg">Upload once. Tailor for every role.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border p-6 shadow-card hover:shadow-warm transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Step {i + 1}</div>
                <h3 className="font-semibold mb-1 text-foreground">{step.label}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-secondary/40">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Built for precision</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border p-6 shadow-card hover:shadow-warm transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-foreground">
              Ready to land your next role?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of professionals who trust HireOS to tailor every application.
            </p>
            <Button
              size="lg"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-full px-10 h-13 text-base shadow-warm"
              onClick={() => navigate("/auth")}
            >
              Get started — it's free <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 HireOS</span>
          <span className="text-xs">No fabricated metrics. Ever.</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
