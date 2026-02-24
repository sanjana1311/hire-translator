import { motion } from "framer-motion";
import { FileText, Briefcase, Upload, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { format } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const recentWorkspaces = workspaces.slice(0, 3);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-semibold tracking-tight text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-8">Your career command center</p>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => navigate("/dashboard/resume")}
            className="bg-card border border-border rounded-2xl p-5 text-left hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Resume Profile</h3>
            <p className="text-sm text-muted-foreground">Upload or edit your master resume</p>
          </button>
          <button
            onClick={() => navigate("/dashboard/workspaces/new")}
            className="bg-card border border-border rounded-2xl p-5 text-left hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <h3 className="font-medium text-foreground mb-1">New Job Workspace</h3>
            <p className="text-sm text-muted-foreground">Paste a JD and start tailoring</p>
          </button>
        </div>

        {/* Workspaces */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            Job Workspaces
          </h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/dashboard/workspaces")}>
            View all
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentWorkspaces.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No workspaces yet. Create one to start tailoring your resume.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkspaces.map((ws, i) => (
              <motion.button
                key={ws.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:bg-secondary/40 transition-colors flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-foreground truncate">{ws.company}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {ws.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ws.role_title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-medium tabular-nums">
                      <TrendingUp className={`w-3 h-3 ${ws.ats_score >= 80 ? 'text-green-600' : ws.ats_score >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
                      <span className={ws.ats_score >= 80 ? 'text-green-600' : ws.ats_score >= 60 ? 'text-amber-500' : 'text-red-500'}>
                        {ws.ats_score}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(ws.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
