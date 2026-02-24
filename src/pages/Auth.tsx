import { useState } from "react";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate("/dashboard");
        } else {
          toast.success("Check your email to confirm your account!");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel with gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero items-center justify-center p-16 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,transparent_30%,hsl(var(--background)/0.3)_100%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.div
          className="relative max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="flex items-center gap-2.5 mb-10">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <FileText className="w-6 h-6 text-primary-foreground" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-foreground leading-none">HireOS</span>
              <span className="text-xs font-medium text-muted-foreground tracking-wide">AI-native career platform</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-foreground">Your career deserves precision.</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Every bullet rewritten with exact JD keywords. Every metric verified. No hallucinations, no guesswork.
          </p>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-foreground leading-none">HireOS</span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide">AI-native career platform</span>
            </div>
          </div>

          <motion.h1
            className="text-2xl font-bold mb-1 text-foreground"
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isLogin ? "Welcome back" : "Create account"}
          </motion.h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isLogin ? "Sign in to continue" : "Start tailoring your resume"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1.5"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="mt-1.5"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background hover:bg-foreground/90 h-11 rounded-xl"
              >
                {loading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-background border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : isLogin ? "Sign in" : "Create account"}
              </Button>
            </motion.div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "No account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
