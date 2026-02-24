import { useState } from "react";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

const NewWorkspace = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!company || !role || !jd) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Workspace created! Analyzing JD...");
      navigate("/dashboard/workspaces/1");
    }, 1500);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1">New Job Workspace</h1>
        <p className="text-muted-foreground text-sm mb-8">Paste a job description — we'll extract every signal</p>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Company</Label>
              <Input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Stripe"
                className="mt-1.5 bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-sm">Role Title</Label>
              <Input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior Product Manager"
                className="mt-1.5 bg-secondary border-border"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Job Description</Label>
            <Textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder="Paste the full job description here..."
              className="mt-1.5 min-h-[300px] bg-secondary border-border text-sm"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 h-11 px-6"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </div>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze & Create Workspace
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NewWorkspace;
