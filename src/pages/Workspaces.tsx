import { motion } from "framer-motion";
import { Briefcase, Plus, TrendingUp, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces, useDeleteWorkspace } from "@/hooks/use-workspaces";
import { format } from "date-fns";
import { toast } from "sonner";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1 text-foreground">Job Workspaces</h1>
            <p className="text-muted-foreground text-sm">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</p>
          </div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-xl"
              onClick={() => navigate("/dashboard/workspaces/new")}
            >
              <Plus className="w-4 h-4 mr-2" /> New Workspace
            </Button>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : workspaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-12 text-center shadow-card"
          >
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No workspaces yet</p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-xl" onClick={() => navigate("/dashboard/workspaces/new")}>
                <Plus className="w-4 h-4 mr-2" /> Create your first workspace
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {workspaces.map((ws) => (
              <motion.button
                key={ws.id}
                variants={staggerItem}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-card border border-border rounded-2xl p-5 text-left shadow-card flex items-center gap-4"
                whileHover={{ y: -2, boxShadow: "var(--shadow-warm)" }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0"
                  whileHover={{ rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate text-foreground">{ws.company}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium capitalize">
                      {ws.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ws.role_title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <TrendingUp className={`w-3.5 h-3.5 ${ws.ats_score >= 80 ? 'text-green-600' : ws.ats_score >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
                      <span className={ws.ats_score >= 80 ? 'text-green-600' : ws.ats_score >= 60 ? 'text-amber-500' : 'text-red-500'}>
                        {ws.ats_score}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(ws.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <motion.button
                    onClick={(e) => handleDelete(e, ws.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="w-6 h-6" />
                  </motion.button>
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Workspaces;
