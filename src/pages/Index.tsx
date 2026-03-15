import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      // Store in DB
      const { error: dbError } = await supabase.from("access_requests" as any).insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
      } as any);
      if (dbError) throw dbError;

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
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
            <span className="text-xs font-medium text-primary">🚀 Invite-only • Limited early access</span>
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
            Career Compass scores every role against your resume, drafts tailored resumes, tracks applications, and preps you for interviews — automatically.
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
                <h3 className="text-lg font-semibold mb-1">You're on the list! 🎉</h3>
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
                  onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                  maxLength={100}
                />
                <Input
                  type="email"
                  placeholder="Email *"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  maxLength={255}
                />
                <Input
                  placeholder="LinkedIn profile URL (optional)"
                  value={form.linkedin_url}
                  onChange={(e) => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  maxLength={500}
                />
                <Textarea
                  placeholder="Why are you interested? (optional)"
                  value={form.reason}
                  onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  maxLength={500}
                  className="resize-none"
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

      {/* Features grid */}
      <section className="pb-24 px-7 pt-16">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
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
