import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

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
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border items-center justify-center p-16">
        <div className="max-w-sm">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-foreground rounded-[5px] flex items-center justify-center">
              <span className="text-background text-[9px] font-bold">CC</span>
            </div>
            <span className="font-serif italic text-xl">Career Compass</span>
          </div>
          <h2 className="font-serif text-2xl mb-3">Your AI career mentor.</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Score every role, tailor your resume, track applications, prep for interviews — all powered by AI that understands your background.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-6 h-6 bg-foreground rounded-[5px] flex items-center justify-center">
              <span className="text-background text-[9px] font-bold">CC</span>
            </div>
            <span className="font-serif italic text-[15px]">Career Compass</span>
          </div>

          <h1 className="text-xl font-semibold mb-1">{isLogin ? "Welcome back" : "Create account"}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {isLogin ? "Sign in to continue" : "Start your AI-powered job search"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-[5px] h-10"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {isLogin ? "No account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-foreground hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
