import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";

const NAV_ITEMS = [
  { key: "roles", label: "Roles", path: "/dashboard" },
  { key: "applications", label: "Applications", path: "/dashboard/applications" },
  { key: "networking", label: "Networking", path: "/dashboard/networking" },
  { key: "prep", label: "Interview Prep", path: "/dashboard/prep" },
  { key: "report", label: "Weekly Report", path: "/dashboard/report" },
  { key: "rejection", label: "Rejection Analysis", path: "/dashboard/rejection" },
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

      // Check if user has completed onboarding
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
        <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav - 52px */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border h-[52px] px-7 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* CC Logo */}
          <div className="w-6 h-6 rounded-[5px] flex items-center justify-center mr-1.5" style={{ background: 'linear-gradient(135deg, #E84393, #E74C3C)' }}>
            <span className="text-white text-[9px] font-bold">CC</span>
          </div>
          <span className="font-serif italic text-[15px] mr-3.5 bg-gradient-to-r from-[#E84393] to-[#E74C3C] bg-clip-text text-transparent">Career Compass</span>
          
          {/* Nav tabs */}
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`text-[12.5px] px-2.5 py-1 rounded-[5px] transition-colors relative ${
                  active 
                    ? "bg-secondary text-foreground font-semibold" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
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
