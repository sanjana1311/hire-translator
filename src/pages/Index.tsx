import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      <nav className="sticky top-0 z-50 bg-background border-b border-border h-[52px] px-7 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-[5px] flex items-center justify-center mr-1.5" style={{ background: 'linear-gradient(135deg, #E84393, #E74C3C)' }}>
            <span className="text-white text-[9px] font-bold">CC</span>
          </div>
          <span className="font-serif italic text-[15px] bg-gradient-to-r from-[#E84393] to-[#E74C3C] bg-clip-text text-transparent">Career Compass</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/auth")}>
            Log in
          </Button>
          <Button size="sm" className="text-xs rounded-[5px]" onClick={() => navigate("/auth")}>
            Get started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-7">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h1
            className="font-serif text-4xl md:text-5xl leading-[1.15] mb-4"
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button
              className="rounded-[5px] px-8 h-10 text-sm font-semibold"
              onClick={() => navigate("/auth")}
            >
              Start for free <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features grid */}
      <section className="pb-24 px-7">
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
              className="bg-card border border-border rounded-[9px] p-5"
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
