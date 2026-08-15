import { motion } from "framer-motion";
import { FileText, Upload, ArrowRight, TrendingUp, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useProfile } from "@/hooks/use-profile";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { GmailSyncSummary } from "@/components/GmailSyncSummary";
import { format } from "date-fns";

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const { data: profile } = useProfile();
  const { syncReport, syncReportAt, syncCounts, syncErrors, syncError, loading: gmailLoading, triggerSync } = useGmailImport(profile?.id ?? null);
  const recentWorkspaces = workspaces.slice(0, 3);

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="text-2xl font-semibold tracking-tight mb-0.5 text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-10">Your career command center</p>

        <GmailSyncSummary
          report={syncReport}
          counts={syncCounts}
          errors={syncErrors}
          syncedAt={syncReportAt}
          loading={gmailLoading}
          error={syncError}
          onRetry={() => triggerSync(false)}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <motion.button
            onClick={() => navigate("/dashboard/resume")}
            className="apple-card apple-card-interactive p-6 text-left group"
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/[0.06] flex items-center justify-center">
                <FileText className="w-6 h-6 text-foreground/70" />
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            <h3 className="font-semibold text-[15px] mb-1 text-foreground">Resume Profile</h3>
            <p className="text-sm text-muted-foreground">Upload or edit your master resume</p>
          </motion.button>

          <motion.button
            onClick={() => navigate("/dashboard/workspaces/new")}
            className="apple-card apple-card-interactive p-6 text-left group"
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl bg-accent/[0.06] flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent/70" />
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            <h3 className="font-semibold text-[15px] mb-1 text-foreground">New Job Workspace</h3>
            <p className="text-sm text-muted-foreground">Paste a JD and start tailoring</p>
          </motion.button>
        </div>

        {/* Workspaces */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold flex items-center gap-2 text-foreground">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            Job Workspaces
          </h2>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/dashboard/workspaces")}>
            View all
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-foreground/15 border-t-foreground/60 rounded-full animate-spin" />
          </div>
        ) : recentWorkspaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="apple-card p-12 text-center"
          >
            <Briefcase className="w-7 h-7 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No workspaces yet. Create one to start tailoring your resume.</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {recentWorkspaces.map((ws) => (
              <motion.button
                key={ws.id}
                variants={staggerItem}
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
                className="w-full apple-card apple-card-interactive p-5 text-left flex items-center gap-4"
                whileTap={{ scale: 0.995 }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[15px] truncate text-foreground">{ws.company}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium capitalize">
                      {ws.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ws.role_title}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <TrendingUp className={`w-3.5 h-3.5 ${ws.ats_score >= 80 ? 'text-success' : ws.ats_score >= 60 ? 'text-warning' : 'text-danger'}`} />
                      <span className={ws.ats_score >= 80 ? 'text-success' : ws.ats_score >= 60 ? 'text-warning' : 'text-danger'}>
                        {ws.ats_score}%
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{format(new Date(ws.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
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
