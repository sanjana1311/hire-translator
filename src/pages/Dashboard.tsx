import { motion } from "framer-motion";
import { FileText, Briefcase, Upload, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground bg-muted",
  ready: "text-success bg-success/10",
  applied: "text-primary bg-primary/10",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const recentWorkspaces = workspaces.slice(0, 3);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-8">Your career command center</p>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => navigate("/dashboard/resume")}
            className="bg-gradient-card border border-border rounded-xl p-5 text-left hover:border-primary/30 transition-colors shadow-card group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold mb-1">Resume Profile</h3>
            <p className="text-sm text-muted-foreground">Upload or edit your master resume</p>
          </button>
          <button
            onClick={() => navigate("/dashboard/workspaces/new")}
            className="bg-gradient-card border border-border rounded-xl p-5 text-left hover:border-primary/30 transition-colors shadow-card group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
            <h3 className="font-semibold mb-1">New Job Workspace</h3>
            <p className="text-sm text-muted-foreground">Paste a JD and start tailoring</p>
          </button>
        </div>

        {/* Workspaces */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-muted-foreground" />
            Job Workspaces
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/workspaces")}>
            View all
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentWorkspaces.length === 0 ? (
          <div className="bg-gradient-card border border-border rounded-xl p-8 text-center shadow-card">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No workspaces yet. Create one to start tailoring your resume.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkspaces.map((ws, i) => (
              <motion.button
                key={ws.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-gradient-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors shadow-card flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{ws.company}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[ws.status] || statusColor.draft}`}>
                      {ws.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ws.role_title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-mono">
                      <TrendingUp className={`w-3 h-3 ${ws.ats_score >= 80 ? 'text-score-high' : ws.ats_score >= 60 ? 'text-score-mid' : 'text-score-low'}`} />
                      <span className={ws.ats_score >= 80 ? 'text-score-high' : ws.ats_score >= 60 ? 'text-score-mid' : 'text-score-low'}>
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
