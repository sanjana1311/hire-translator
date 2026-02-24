import { motion } from "framer-motion";
import { Briefcase, Plus, TrendingUp, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces, useDeleteWorkspace } from "@/hooks/use-workspaces";
import { format } from "date-fns";
import { toast } from "sonner";

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
            <h1 className="text-xl font-semibold tracking-tight text-foreground mb-1">Job Workspaces</h1>
            <p className="text-muted-foreground text-sm">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => navigate("/dashboard/workspaces/new")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Workspace
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No workspaces yet</p>
            <Button onClick={() => navigate("/dashboard/workspaces/new")}>
              <Plus className="w-4 h-4 mr-1.5" /> Create your first workspace
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws, i) => (
              <motion.button
                key={ws.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:bg-secondary/40 transition-colors flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
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
