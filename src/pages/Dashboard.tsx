import { motion } from "framer-motion";
import { FileText, Briefcase, Upload, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { format } from "date-fns";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const recentWorkspaces = workspaces.slice(0, 3);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold mb-1 text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-8">Your career command center</p>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          <motion.button
            onClick={() => navigate("/dashboard/resume")}
            className="bg-card border border-border rounded-2xl p-6 text-left shadow-card group"
            whileHover={{ y: -3, boxShadow: "var(--shadow-warm)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <motion.div
                className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"
                whileHover={{ rotate: 5, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <FileText className="w-5 h-5 text-primary" />
              </motion.div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold mb-1 text-foreground">Resume Profile</h3>
            <p className="text-sm text-muted-foreground">Upload or edit your master resume</p>
          </motion.button>
          <motion.button
            onClick={() => navigate("/dashboard/workspaces/new")}
            className="bg-card border border-border rounded-2xl p-6 text-left shadow-card group"
            whileHover={{ y: -3, boxShadow: "var(--shadow-warm)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <motion.div
                className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center"
                whileHover={{ rotate: -5, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Upload className="w-5 h-5 text-accent" />
              </motion.div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold mb-1 text-foreground">New Job Workspace</h3>
            <p className="text-sm text-muted-foreground">Paste a JD and start tailoring</p>
          </motion.button>
        </div>

        {/* Workspaces */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Briefcase className="w-5 h-5 text-muted-foreground" />
            Job Workspaces
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/workspaces")}>
            View all
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : recentWorkspaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-10 text-center shadow-card"
          >
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No workspaces yet. Create one to start tailoring your resume.</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {recentWorkspaces.map((ws) => (
              <motion.button
                key={ws.id}
                variants={staggerItem}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full bg-card border border-border rounded-2xl p-5 text-left shadow-card flex items-center gap-4"
                whileHover={{ y: -2, boxShadow: "var(--shadow-warm)" }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2 }}
              >
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
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
