import { useState } from "react";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCreateWorkspace } from "@/hooks/use-workspaces";

const NewWorkspace = () => {
  const navigate = useNavigate();
  const [jd, setJd] = useState("");
  const createWs = useCreateWorkspace();

  const handleCreate = () => {
    if (!jd) {
      toast.error("Please paste a job description");
      return;
    }
    createWs.mutate(
      { job_description: jd },
      {
        onSuccess: (data) => {
          toast.success("Workspace created!");
          navigate(`/dashboard/workspaces/${data.id}`);
        },
        onError: (err: any) => toast.error(err.message || "Failed to create workspace"),
      }
    );
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-1 text-foreground">New Job Workspace</h1>
        <p className="text-muted-foreground text-sm mb-8">Paste a job description — we'll extract every signal</p>

        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium">Job Description</Label>
            <Textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder="Paste the full job description here..."
              className="mt-1.5 min-h-[300px] text-sm"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={createWs.isPending}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 h-11 px-6 rounded-xl"
          >
            {createWs.isPending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Creating...
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
