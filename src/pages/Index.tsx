import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  BarChart3,
  Mail,
  Target,
  Users,
  Github,
  Terminal,
  Copy,
  Check,
  Scale,
  Database,
  Shield,
  GitBranch,
  Plug,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import Seo from "@/components/Seo";
import { useToast } from "@/hooks/use-toast";

// Update this once the public repository is created.
const GITHUB_URL = "https://github.com/sanjanaravikumar/hireos";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Self-host", href: "#self-host" },
  { label: "Architecture", href: "#architecture" },
  { label: "Roadmap", href: "#roadmap" },
];

const QUICKSTART = `# 1. Clone and install
git clone ${GITHUB_URL}.git
cd hireos && npm install

# 2. Configure your own backend
cp .env.example .env
#   VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID,
#   VITE_SUPABASE_PUBLISHABLE_KEY

# 3. Apply the database migrations
supabase db push

# 4. Set the server-side secrets
supabase secrets set \\
  SUPABASE_SERVICE_ROLE_KEY="..." \\
  OPENCODE_GO_API_KEY="..."

# 5. Run it
npm run dev`;

const CodeBlock = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="w-3.5 h-3.5" />
          <span>bash</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copy}>
          {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const SectionHeading = ({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) => (
  <motion.div
    className="text-center mb-12"
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
  >
    <span className="text-xs font-semibold text-primary tracking-wide uppercase">{eyebrow}</span>
    <h2 className="font-serif text-2xl md:text-3xl mt-2 text-foreground">{title}</h2>
    {sub && <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto leading-relaxed">{sub}</p>}
  </motion.div>
);

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
      toast({ title: "Please fill in your name and email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://formspree.io/f/mpqyjpej", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.full_name.trim(), email: form.email.trim() }),
      });
      if (!res.ok) throw new Error("Submission failed");

      await supabase.from("access_requests" as any).insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
      } as any);

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="hireOS — Open-Source AI Career Operating System"
        description="Open-source, self-hostable AI career OS: score jobs against your resume, rewrite bullets with real JD keywords, track applications, and prep interviews. MIT licensed."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "hireOS",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          license: "https://opensource.org/licenses/MIT",
          description:
            "Open-source, self-hostable AI career operating system for job scoring, resume tailoring, application tracking, and interview prep.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass-nav border-b border-border h-[52px] px-5 md:px-7 flex items-center justify-between">
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
            <span className="text-[9px] text-muted-foreground tracking-wide">Open-source career OS</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 rounded-full"
            asChild
          >
            <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
              <Github className="w-3.5 h-3.5 mr-1.5" /> GitHub
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/auth")}>
            Log in
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-7 overflow-hidden bg-gradient-hero">
        <div className="max-w-3xl mx-auto text-center">
          <motion.a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border border-border bg-card/70 hover:bg-card transition-colors"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Star className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Now open source under MIT</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
          </motion.a>

          <motion.h1
            className="font-serif text-4xl md:text-6xl leading-[1.1] mb-5 text-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            The open-source
            <br />
            <span className="italic">career operating system.</span>
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-base mb-8 max-w-xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            hireOS scores every job against your resume, rewrites bullets with real
            JD keywords, tracks applications, and preps you for interviews. Self-host it
            on your own infrastructure with your own AI keys — your resume never leaves your stack.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <Button className="rounded-full px-6" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
                <Github className="w-4 h-4 mr-2" /> Star on GitHub
              </a>
            </Button>
            <Button variant="outline" className="rounded-full px-6" asChild>
              <a href="#self-host">
                <Terminal className="w-4 h-4 mr-2" /> Self-host in 5 steps
              </a>
            </Button>
          </motion.div>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <span className="inline-flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> MIT licensed</span>
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Row-level security by default</span>
            <span className="inline-flex items-center gap-1.5"><Plug className="w-3.5 h-3.5" /> Bring your own AI provider</span>
          </motion.div>
        </div>
      </section>

      {/* Why open source */}
      <section className="py-20 px-7 bg-background">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="Why open source"
            title="Your job search data should be yours."
            sub="Resumes, salary history, rejection notes — the most sensitive career data you have. hireOS is built so you can read every line of code and run it yourself."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Shield,
                title: "Self-hostable by design",
                desc: "Own the Supabase project, the storage bucket, and the AI keys. No third-party sees your resume.",
              },
              {
                icon: Scale,
                title: "MIT, no strings",
                desc: "Fork it, rebrand it, ship it commercially. The license is permissive and the code is unobfuscated.",
              },
              {
                icon: GitBranch,
                title: "Built to be extended",
                desc: "Every AI module is a self-contained Edge Function. Add a new career module without touching the core.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="apple-card p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
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

      {/* Features */}
      <section id="features" className="py-20 px-7 bg-secondary/30 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="What's inside"
            title="Six AI modules, one workspace."
            sub="Everything ships in the repo — no paid tier gating the good parts."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: Target,
                title: "Job scoring engine",
                desc: "Every role scored 0–100 against your resume with keyword coverage, missing clusters, and an A/B/C/D fit bucket.",
              },
              {
                icon: Sparkles,
                title: "Resume rewriting",
                desc: "Bullets rewritten in strict WHAT-HOW-WHO-IMPACT format using exact JD phrasing. Never fabricates a metric.",
              },
              {
                icon: FileText,
                title: "Versioned workspaces",
                desc: "Each job gets a workspace with snapshots, diffs, revert, and ATS-friendly PDF export behind a metric gate.",
              },
              {
                icon: Mail,
                title: "Gmail job import",
                desc: "OAuth into your inbox, parse job alert emails, and auto-populate your pipeline on a background sync.",
              },
              {
                icon: Users,
                title: "Networking + interview prep",
                desc: "Connection angles, outreach templates, role-specific question banks, and a voice mock interview simulator.",
              },
              {
                icon: BarChart3,
                title: "Weekly mentor reports",
                desc: "A recurring briefing that reads your pipeline and tells you what to fix next — like a real career coach.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="apple-card p-5 flex gap-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
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
      <section id="how-it-works" className="py-20 px-7 bg-background scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="How it works"
            title="From job post to application-ready resume."
          />
          <div className="space-y-4">
            {[
              { step: "01", title: "Upload your resume", desc: "One private PDF upload becomes your source of truth. Original bullets and metrics are preserved verbatim." },
              { step: "02", title: "Add jobs", desc: "Paste a job description or import roles straight from your Gmail job alerts." },
              { step: "03", title: "Score on demand", desc: "Score any role individually. See keyword coverage, gaps, and the strong verbs that actually map to the JD." },
              { step: "04", title: "Rewrite and export", desc: "Generate a tailored resume, pick optional projects, and export an ATS-clean PDF once every bullet has a real metric." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="flex items-start gap-4 apple-card p-5"
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

      {/* Self-host */}
      <section id="self-host" className="py-20 px-7 bg-secondary/30 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="Self-host"
            title="Running your own copy takes minutes."
            sub="You need Node.js, a Supabase project, and one AI provider key. Everything else is in the repo."
          />
          <CodeBlock code={QUICKSTART} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {[
              { title: "Bring your own AI", desc: "OpenCode Go, Lovable AI, or Groq — configured as an ordered fallback chain." },
              { title: "Your database", desc: "Every table ships with RLS policies and explicit grants. No shared multi-tenant store." },
              { title: "Static deploy", desc: "npm run build outputs a plain dist/ folder you can host anywhere." },
            ].map((c) => (
              <div key={c.title} className="apple-card p-4">
                <h3 className="text-xs font-semibold mb-1">{c.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-20 px-7 bg-background scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="Architecture"
            title="A boring, readable stack."
            sub="No bespoke framework. If you know React and Postgres, you can contribute on day one."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: FileText,
                title: "Frontend",
                items: ["React 18 + Vite + TypeScript", "Tailwind CSS + shadcn/ui", "TanStack Query for data", "Client-side PDF parsing & export"],
              },
              {
                icon: Database,
                title: "Backend",
                items: ["Supabase Postgres with RLS", "Private storage bucket for resumes", "Deno Edge Functions per module", "SQL migrations checked into the repo"],
              },
              {
                icon: Sparkles,
                title: "AI layer",
                items: ["Provider-agnostic chat wrapper", "Ordered fallback + circuit breaker", "Per-user daily usage quota", "Structured tool-call extraction"],
              },
              {
                icon: Plug,
                title: "Integrations",
                items: ["Gmail OAuth job import", "MCP server for AI agents", "ElevenLabs voice interviews", "Resend transactional email"],
              },
            ].map((block, i) => (
              <motion.div
                key={block.title}
                className="apple-card p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                    <block.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">{block.title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {block.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[hsl(var(--success))]" />
                      {it}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap + contributing */}
      <section id="roadmap" className="py-20 px-7 bg-secondary/30 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="Roadmap"
            title="Where hireOS is going."
            sub="Issues tagged good first issue are the fastest way in."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                tag: "Shipped",
                tone: "success",
                items: ["Resume ingest + private storage", "Per-job AI scoring", "Interview prep & networking modules", "Gmail import + MCP agent server"],
              },
              {
                tag: "In progress",
                tone: "warning",
                items: ["One-click Docker self-host", "Provider plugin interface", "Public REST API", "Improved diff view for versions"],
              },
              {
                tag: "Planned",
                tone: "info",
                items: ["Local model support (Ollama)", "Chrome extension for job capture", "Team / bootcamp workspaces", "i18n"],
              },
            ].map((col, i) => (
              <motion.div
                key={col.tag}
                className="apple-card p-5"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <span
                  className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-3 border"
                  style={{
                    color: `hsl(var(--${col.tone}))`,
                    backgroundColor: `hsl(var(--${col.tone}-bg))`,
                    borderColor: `hsl(var(--${col.tone}-border))`,
                  }}
                >
                  {col.tag}
                </span>
                <ul className="space-y-1.5">
                  {col.items.map((it) => (
                    <li key={it} className="text-xs text-muted-foreground leading-relaxed">
                      {it}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="apple-card p-6 mt-6 text-center">
            <h3 className="font-serif text-xl mb-2">Contributing</h3>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed mb-4">
              Bug reports, provider adapters, and new career modules are all welcome. Open an
              issue before large changes so we can agree on the shape of it.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full text-xs" asChild>
                <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer noopener">
                  Browse issues
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full text-xs" asChild>
                <a href={`${GITHUB_URL}#local-setup`} target="_blank" rel="noreferrer noopener">
                  Read the setup guide
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full text-xs" asChild>
                <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener">
                  MIT license
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hosted beta / waitlist */}
      <section id="hosted" className="py-20 px-7 bg-gradient-hero scroll-mt-16">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
              Don't want to self-host?
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              The hosted beta is free for invited testers and runs the exact same code
              you see on GitHub. We onboard in small batches.
            </p>
          </motion.div>

          <motion.div
            className="max-w-md mx-auto"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {submitted ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-[hsl(var(--success))] mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">You're on the list!</h3>
                <p className="text-sm text-muted-foreground">
                  We'll reach out when your spot is ready. Keep an eye on your inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-3 text-left">
                <h3 className="text-sm font-semibold text-center mb-1">Request early access</h3>
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
                  Request access <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-7 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="col-span-2 md:col-span-1">
            <span
              className="font-serif italic text-[15px] font-semibold bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #9B59B6, #E84393)" }}
            >
              hireOS
            </span>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              An open-source AI career operating system.
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold mb-2">Product</h4>
            <ul className="space-y-1.5">
              {NAV_LINKS.slice(0, 3).map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold mb-2">Project</h4>
            <ul className="space-y-1.5">
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Source code
                </a>
              </li>
              <li>
                <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer noopener" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Issues
                </a>
              </li>
              <li>
                <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  MIT license
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold mb-2">Get started</h4>
            <ul className="space-y-1.5">
              <li>
                <a href="#self-host" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Self-host</a>
              </li>
              <li>
                <a href="#hosted" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Hosted beta</a>
              </li>
              <li>
                <button onClick={() => navigate("/auth")} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border pt-6">
          <span>© 2026 hireOS — released under the MIT License</span>
          <span>Maintained by Sanjana Ravikumar</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
