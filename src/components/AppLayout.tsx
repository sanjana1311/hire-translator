import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import Seo from "@/components/Seo";

const NAV_ITEMS = [
  { key: "roles", label: "Roles", path: "/dashboard" },
  { key: "applications", label: "Applications", path: "/dashboard/applications" },
  { key: "networking", label: "Networking", path: "/dashboard/networking" },
  { key: "prep", label: "Interview Prep", path: "/dashboard/prep" },
  { key: "report", label: "Weekly Report", path: "/dashboard/report" },
  { key: "rejection", label: "Rejection Analysis", path: "/dashboard/rejection" },
  { key: "resume", label: "Resume", path: "/dashboard/resume" },

];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async (session: any) => {
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile && !(profile as any).onboarded) {
        navigate("/onboarding", { replace: true });
        return;
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuth(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuth(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Dashboard — hireOS"
        description="Your hireOS workspace: scored roles, tailored resumes, applications, and interview prep."
        path="/dashboard"
        noindex
      />
      {/* Frosted glass nav */}
      <nav className="glass-nav sticky top-0 z-50 border-b border-border/60 h-[52px] px-6 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* hO Logo */}
          <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center mr-2" style={{ background: 'linear-gradient(135deg, #E84393, #E74C3C)' }}>
            <span className="text-white text-[9px] font-bold tracking-tight">hO</span>
          </div>
          <span className="font-serif italic text-[15px] mr-4 bg-gradient-to-r from-[#E84393] to-[#E74C3C] bg-clip-text text-transparent">hireOS</span>
          
          {/* Nav tabs with pill indicator */}
          <div className="flex items-center bg-secondary/60 rounded-lg p-0.5">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`text-[12px] px-3 py-1.5 rounded-md transition-all duration-200 font-medium ${
                    active 
                      ? "bg-card text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs px-2.5 py-1.5 rounded-lg hover:bg-secondary/80 transition-all duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
  );
};

export default AppLayout;
