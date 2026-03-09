import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

interface ResumeEntry {
  label: string;
  text: string;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Auth gate + already-onboarded redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (!profileLoading && profile && (profile as any).onboarded) {
      navigate("/dashboard", { replace: true });
    }
  }, [profile, profileLoading, navigate]);

  const [targetRoles, setTargetRoles] = useState<string[]>([""]);
  const [resumes, setResumes] = useState<ResumeEntry[]>([{ label: "", text: "" }]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canSubmit =
    targetRoles.some((r) => r.trim().length >= 3) &&
    resumes.some((r) => r.text.trim().length >= 150);

  const updateRole = (idx: number, value: string) => {
    setTargetRoles((prev) => prev.map((r, i) => (i === idx ? value : r)));
    if (errors[`role_${idx}`]) {
      setErrors((prev) => { const next = { ...prev }; delete next[`role_${idx}`]; return next; });
    }
  };

  const addRole = () => {
    if (targetRoles.length >= 5) return;
    setTargetRoles([...targetRoles, ""]);
  };

  const removeRole = (idx: number) => {
    setTargetRoles(targetRoles.filter((_, i) => i !== idx));
    setErrors((prev) => { const next = { ...prev }; delete next[`role_${idx}`]; return next; });
  };

  const showAddRoleButton = targetRoles.length < 5 && targetRoles[0].trim().length > 0;

  const addResume = () => {
    if (resumes.length >= 3) return;
    setResumes([...resumes, { label: "", text: "" }]);
  };

  const removeResume = (idx: number) => {
    setResumes(resumes.filter((_, i) => i !== idx));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`resume_${idx}`];
      return next;
    });
  };

  const updateResume = (idx: number, field: "label" | "text", value: string) => {
    setResumes((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
    // Clear error on edit
    if (field === "text" && errors[`resume_${idx}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`resume_${idx}`];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!targetRoles.trim()) {
      newErrors.targetRoles = "Please enter at least one target role.";
    }
    resumes.forEach((r, i) => {
      if (r.text.trim().length > 0 && r.text.trim().length < 150) {
        newErrors[`resume_${i}`] = "Paste your full resume — this looks too short";
      }
    });
    if (!resumes.some((r) => r.text.trim().length >= 150)) {
      // Find the first empty or short one
      const idx = resumes.findIndex((r) => r.text.trim().length < 150);
      if (idx >= 0 && !newErrors[`resume_${idx}`]) {
        newErrors[`resume_${idx}`] = "Paste your full resume — this looks too short";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !profile?.id) return;
    setSaving(true);

    try {
      // 1. Update profile with target_roles and onboarded flag
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          target_roles: targetRoles.trim(),
          onboarded: true,
        } as any)
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // 2. Insert resume(s)
      const validResumes = resumes.filter((r) => r.text.trim().length >= 150);
      const resumeRows = validResumes.map((r, i) => ({
        profile_id: profile.id,
        label: r.label.trim() || `Resume ${i + 1}`,
        raw_text: r.text.trim(),
      }));

      const { error: resumeError } = await supabase
        .from("resumes")
        .insert(resumeRows as any);

      if (resumeError) throw resumeError;

      // 3. Navigate to dashboard immediately
      navigate("/dashboard", { replace: true });

      // 4. Trigger Gmail sync in background (fire-and-forget)
      supabase.functions
        .invoke("fetch-gmail-jobs", {
          body: { useRefreshToken: true },
        })
        .then(({ error }) => {
          if (error) console.warn("[Onboarding] Background Gmail sync failed:", error);
        });

      toast.success("You're all set!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const showAddButton = resumes.length < 3 && resumes[0].text.trim().length > 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 bg-foreground rounded-[5px] flex items-center justify-center">
            <span className="text-background text-[9px] font-bold">CC</span>
          </div>
          <span className="font-serif italic text-lg">Career Compass</span>
        </div>

        <h1 className="font-serif text-[28px] leading-tight mb-1.5">
          Welcome. Two things and you're in.
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          This takes about 20 seconds.
        </p>

        {/* Section 1 — Target Roles */}
        <div className="mb-8">
          <label className="text-sm font-medium block mb-1.5">
            What roles are you targeting?
          </label>
          <input
            type="text"
            value={targetRoles}
            onChange={(e) => {
              setTargetRoles(e.target.value);
              if (errors.targetRoles) setErrors((p) => ({ ...p, targetRoles: "" }));
            }}
            placeholder="e.g. Software Engineer, Data Analyst, Product Manager, Marketing Manager"
            className="w-full bg-card border border-border rounded-[8px] px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            We use this to filter and analyze relevant job alerts.
          </p>
          {errors.targetRoles && (
            <p className="text-[12px] text-destructive mt-1">{errors.targetRoles}</p>
          )}
        </div>

        {/* Section 2 — Resume(s) */}
        <div className="mb-8">
          <label className="text-sm font-medium block mb-3">Your resume</label>

          {resumes.map((resume, idx) => (
            <div
              key={idx}
              className="mb-4 bg-card border border-border rounded-[10px] p-4"
            >
              <div className="flex items-center justify-between mb-2.5">
                <input
                  type="text"
                  value={resume.label}
                  onChange={(e) => updateResume(idx, "label", e.target.value)}
                  placeholder={`e.g. General Resume`}
                  className="bg-transparent border-none text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none flex-1 min-w-0"
                />
                {idx > 0 && (
                  <button
                    onClick={() => removeResume(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
                  >
                    × Remove
                  </button>
                )}
              </div>
              <textarea
                value={resume.text}
                onChange={(e) => updateResume(idx, "text", e.target.value)}
                placeholder="Paste your resume text here"
                rows={10}
                className="w-full bg-secondary/50 border border-border rounded-[7px] px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none transition-shadow"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Paste the text version of your resume. Formatting doesn't matter.
              </p>
              {errors[`resume_${idx}`] && (
                <p className="text-[12px] text-destructive mt-1">
                  {errors[`resume_${idx}`]}
                </p>
              )}
            </div>
          ))}

          {showAddButton && (
            <button
              onClick={addResume}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add another resume version
            </button>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="w-full bg-foreground text-background rounded-[8px] h-11 text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            "Let's go →"
          )}
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          You can always update these later.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
