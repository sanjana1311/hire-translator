import { motion } from "framer-motion";
import { ArrowRight, Upload, FileText, Target, Download, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

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

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">H</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">HireOS</span>
          </motion.div>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="link-underline" onClick={() => navigate("/auth")}>
              Log in
            </Button>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-5" onClick={() => navigate("/auth")}>
                Get started
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </nav>

      {/* Hero with gradient background */}
      <section className="relative pt-16 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-hero opacity-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 1.2 }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,hsl(var(--background))_80%)]" />
        <div className="relative pt-20 pb-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 text-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                Stop guessing.
                <br />
                <span className="text-gradient-primary">Start matching.</span>
              </motion.h1>
              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                HireOS rewrites your resume for each job — using the exact keywords, phrases, and signals from the job description. Every bullet verified. Every metric real.
              </motion.p>
              <motion.div
                className="flex items-center justify-center gap-4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 h-13 text-base shadow-warm"
                    onClick={() => navigate("/auth")}
                  >
                    Start for free <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-foreground">Four steps to a perfect resume</h2>
            <p className="text-muted-foreground text-lg">Upload once. Tailor for every role.</p>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.label}
                variants={staggerItem}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-card rounded-2xl border border-border p-6 shadow-card hover:shadow-warm transition-shadow cursor-default"
              >
                <motion.div
                  className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4"
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <step.icon className="w-7 h-7 text-primary" />
                </motion.div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Step {i + 1}</div>
                <h3 className="font-semibold mb-1 text-foreground">{step.label}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-secondary/40">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Built for precision</h2>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={staggerItem}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-card rounded-2xl border border-border p-6 shadow-card hover:shadow-warm transition-shadow cursor-default"
              >
                <motion.div
                  className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4"
                  whileHover={{ rotate: -5, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <f.icon className="w-7 h-7 text-accent" />
                </motion.div>
                <h3 className="font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-foreground">
              Ready to land your next role?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of professionals who trust HireOS to tailor every application.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="lg"
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-full px-10 h-13 text-base shadow-warm"
                onClick={() => navigate("/auth")}
              >
                Get started — it's free <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
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
