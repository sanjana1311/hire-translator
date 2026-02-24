import { motion } from "framer-motion";
import { Briefcase, Plus, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const mockWorkspaces = [
  { id: "1", company: "Stripe", role: "Senior Product Manager", status: "Ready", date: "Feb 20, 2026", score: 87 },
  { id: "2", company: "Notion", role: "Staff Engineer", status: "Draft", date: "Feb 18, 2026", score: 62 },
  { id: "3", company: "Linear", role: "Design Engineer", status: "Applied", date: "Feb 15, 2026", score: 91 },
  { id: "4", company: "Vercel", role: "Product Manager", status: "Draft", date: "Feb 12, 2026", score: 45 },
];

const statusColor: Record<string, string> = {
  Draft: "text-muted-foreground bg-muted",
  Ready: "text-success bg-success/10",
  Applied: "text-primary bg-primary/10",
};

const Workspaces = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Job Workspaces</h1>
            <p className="text-muted-foreground text-sm">{mockWorkspaces.length} workspaces</p>
          </div>
          <Button
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={() => navigate("/dashboard/workspaces/new")}
          >
            <Plus className="w-4 h-4 mr-2" /> New Workspace
          </Button>
        </div>

        <div className="space-y-2">
          {mockWorkspaces.map((ws, i) => (
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[ws.status]}`}>
                    {ws.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{ws.role}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-mono">
                    <TrendingUp className={`w-3 h-3 ${ws.score >= 80 ? 'text-score-high' : ws.score >= 60 ? 'text-score-mid' : 'text-score-low'}`} />
                    <span className={ws.score >= 80 ? 'text-score-high' : ws.score >= 60 ? 'text-score-mid' : 'text-score-low'}>
                      {ws.score}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ws.date}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Workspaces;
