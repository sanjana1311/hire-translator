import { motion } from "framer-motion";
import { Briefcase, Plus, TrendingUp, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces, useDeleteWorkspace } from "@/hooks/use-workspaces";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground bg-muted",
  ready: "text-success bg-success/10",
  applied: "text-primary bg-primary/10",
};

const Workspaces = () => {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const deleteWs = useDeleteWorkspace();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteWs.mutate(id, { onSuccess: () => toast.success("Workspace deleted") });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Job Workspaces</h1>
            <p className="text-muted-foreground text-sm">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</p>
          </div>
          <Button
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={() => navigate("/dashboard/workspaces/new")}
          >
            <Plus className="w-4 h-4 mr-2" /> New Workspace
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="bg-gradient-card border border-border rounded-xl p-12 text-center shadow-card">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No workspaces yet</p>
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90" onClick={() => navigate("/dashboard/workspaces/new")}>
              <Plus className="w-4 h-4 mr-2" /> Create your first workspace
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws, i) => (
              <motion.button
                key={ws.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-gradient-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors shadow-card flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
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
                  <button
                    onClick={(e) => handleDelete(e, ws.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

export default Workspaces;
