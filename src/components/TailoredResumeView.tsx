import { AlertTriangle, CheckCircle2, ShieldAlert, Info } from "lucide-react";
import type { TailoredResume } from "@/lib/resume-guard";

const Chip = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) => {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground",
    good: "bg-[hsl(var(--success-bg))] text-success",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bad: "bg-destructive/10 text-destructive",
  } as const;
  return <span className={`text-[11px] font-medium rounded-md px-1.5 py-0.5 ${tones[tone]}`}>{children}</span>;
};

const TailoredResumeView = ({ resume }: { resume: TailoredResume }) => {
  const rejected = resume.experience?.flatMap((e) => e.bullets.filter((b) => b.rejected)) || [];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300 font-medium">
          Review all AI-generated changes before applying. Nothing here should claim experience you don't have.
        </p>
      </div>

      {resume.warnings?.length > 0 && (
        <div className="rounded-xl border border-border/60 p-3 space-y-1.5">
          {resume.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldAlert size={12} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}

      {resume.summary && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Summary</div>
          <p className="text-[11.5px] leading-[1.85] text-secondary-foreground">{resume.summary}</p>
        </section>
      )}

      {resume.experience?.length > 0 && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Experience</div>
          <div className="space-y-4">
            {resume.experience.map((e, i) => (
              <div key={i}>
                <p className="text-[12px] font-semibold text-foreground">{e.title}</p>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  {e.company}
                  {e.dates ? ` · ${e.dates}` : ""}
                </p>
                <ul className="space-y-1.5">
                  {e.bullets.map((b, j) => (
                    <li key={j} className={`text-[11.5px] leading-[1.7] ${b.rejected ? "opacity-60" : ""}`}>
                      <span className={b.rejected ? "line-through text-muted-foreground" : "text-secondary-foreground"}>
                        • {b.text}
                      </span>
                      {b.rejected ? (
                        <span className="ml-1.5">
                          <Chip tone="bad">Removed — {b.reason}</Chip>
                        </span>
                      ) : b.confidence === "low" ? (
                        <span className="ml-1.5">
                          <Chip tone="warn">Low confidence — verify</Chip>
                        </span>
                      ) : b.confidence === "medium" ? (
                        <span className="ml-1.5">
                          <Chip tone="warn">Reworded</Chip>
                        </span>
                      ) : null}
                      {b.note && !b.rejected && (
                        <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-start gap-1">
                          <Info size={10} className="mt-0.5 shrink-0" />
                          {b.note}
                        </p>
                      )}
                      {b.evidence && !b.rejected && (
                        <p className="text-[10.5px] text-muted-foreground/80 mt-0.5 pl-3 border-l border-border/60 italic">
                          Evidence: “{b.evidence}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.requirements && resume.requirements.length > 0 && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Requirement coverage
          </div>
          <ul className="space-y-1.5">
            {resume.requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <Chip tone={r.status === "verified" ? "good" : r.status === "transferable" ? "warn" : "bad"}>
                  {r.status === "verified" ? "Verified" : r.status === "transferable" ? "Transferable" : "Missing"}
                </Chip>
                <div className="min-w-0">
                  <p className="text-[11.5px] text-secondary-foreground leading-relaxed">{r.requirement}</p>
                  {r.evidence && (
                    <p className="text-[10.5px] text-muted-foreground/80 italic">Evidence: “{r.evidence}”</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}


      <div className="grid gap-3">
        {resume.verified_skills?.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
              <CheckCircle2 size={11} className="text-success" /> Verified skills
            </div>
            <div className="flex flex-wrap gap-1.5">
              {resume.verified_skills.map((s) => (
                <Chip key={s} tone="good">{s}</Chip>
              ))}
            </div>
          </div>
        )}
        {resume.transferable_skills?.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Transferable skills</div>
            <div className="flex flex-wrap gap-1.5">
              {resume.transferable_skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </div>
        )}
        {resume.missing_requirements?.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Missing requirements (Gap)</div>
            <div className="flex flex-wrap gap-1.5">
              {resume.missing_requirements.map((s) => (
                <Chip key={s} tone="bad">{s}</Chip>
              ))}
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-1.5">
              These are not added to your resume — close them with real work first.
            </p>
          </div>
        )}
      </div>

      {rejected.length > 0 && (
        <p className="text-[10.5px] text-muted-foreground">
          {rejected.length} generated claim{rejected.length > 1 ? "s were" : " was"} rejected by validation as unsupported by your uploaded resume.
        </p>
      )}

      {resume.changes_made?.length > 0 && (
        <section>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Changes made</div>
          <ul className="space-y-1">
            {resume.changes_made.map((c, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-relaxed">— {c}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default TailoredResumeView;
