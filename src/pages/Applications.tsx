import { useState, useEffect, useMemo } from "react";
import { callAI } from "@/lib/ai";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  INITIAL_APPLICATIONS, STATUS_META,
  initials, daysSince, fmtDate,
  type Application,
} from "@/data/seed";
import { classifyRole, getRoleFamilyLabel, ROLE_FAMILIES, type RoleFamilyKey } from "@/lib/role-classifier";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-border border-t-foreground rounded-full animate-spin" style={{ width: size, height: size }} />
);

const Tag = ({ children, color, bg, border }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) => (
  <span className="text-[11px] font-medium rounded px-1.5 py-0.5" style={{ color: color || undefined, background: bg || undefined, border: border ? `1px solid ${border}` : undefined }}>
    {children}
  </span>
);

interface DBApplication {
  id: string;
  job_seed_id: number | null;
  imported_job_id: string | null;
  title: string;
  company: string;
  applied_date: string | null;
  status: string;
  last_email_date: string | null;
  recruiter_email: string | null;
  next_action: string | null;
  notes: string | null;
  created_at: string;
}

const toApplication = (db: DBApplication): Application => ({
  jobId: db.job_seed_id || 0,
  title: db.title,
  company: db.company,
  appliedDate: db.applied_date || db.created_at.split("T")[0],
  status: db.status,
  lastEmail: db.last_email_date,
  recruiterName: null,
  recruiterEmail: db.recruiter_email,
  nextAction: db.next_action,
  notes: db.notes || "",
});

const Applications = () => {
  const { data: profile } = useProfile();
  const [applications, setApps] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [dbApps, setDbApps] = useState<DBApplication[]>([]);
  const [selApp, setSelApp] = useState<Application | null>(null);
  const [fuLoading, setFUL] = useState<number | null>(null);
  const [fuDrafts, setFUD] = useState<Record<number, string>>({});
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filters
  const [filterFamily, setFilterFamily] = useState<RoleFamilyKey | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  const toggleFamily = (key: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });
      if (data) {
        setDbApps(data as DBApplication[]);
        const dbConverted = (data as DBApplication[]).map(toApplication);
        const dbJobIds = new Set(dbConverted.map(a => a.jobId));
        const seedOnly = INITIAL_APPLICATIONS.filter(a => !dbJobIds.has(a.jobId));
        setApps([...dbConverted, ...seedOnly]);
      }
    };
    load();
  }, [profile?.id]);

  const needsFollowUp = applications.filter(a => a.status === "applied" && daysSince(a.appliedDate) >= 7);
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const draftFollowUp = async (app: Application) => {
    setFUL(app.jobId);
    try {
      const draft = await callAI(`Career coach writing a follow-up email. Short, human, confident. 3-4 sentences. No sycophancy. No placeholders.
Candidate: Sanjana Ravikumar, PM at Tesla working on GenAI communication systems.
Applied for: ${app.title} at ${app.company}
Applied: ${fmtDate(app.appliedDate)} (${daysSince(app.appliedDate)} days ago)
Notes: ${app.notes || "none"}
Write email body only:`, 350);
      setFUD(prev => ({ ...prev, [app.jobId]: draft }));
    } catch { setFUD(prev => ({ ...prev, [app.jobId]: "Could not generate — retry." })); }
    setFUL(null);
  };

  // Classify and group
  const classifiedApps = useMemo(() =>
    applications.map(app => ({ ...app, roleFamily: classifyRole(app.title) })),
    [applications]
  );

  const uniqueCompanies = useMemo(() => [...new Set(applications.map(a => a.company))].sort(), [applications]);

  const filteredApps = useMemo(() => {
    return classifiedApps.filter(app => {
      if (filterFamily !== "all" && app.roleFamily !== filterFamily) return false;
      if (filterStatus !== "all" && app.status !== filterStatus) return false;
      if (filterCompany !== "all" && app.company !== filterCompany) return false;
      return true;
    });
  }, [classifiedApps, filterFamily, filterStatus, filterCompany]);

  const groupedData = useMemo(() => {
    const familyMap: Record<string, typeof filteredApps> = {};
    for (const app of filteredApps) {
      const key = app.roleFamily;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(app);
    }
    const familyOrder = [...ROLE_FAMILIES.map(f => f.key), "other"];
    const sortedFamilies = Object.keys(familyMap).sort(
      (a, b) => familyOrder.indexOf(a) - familyOrder.indexOf(b)
    );
    return sortedFamilies.map(familyKey => ({
      familyKey: familyKey as RoleFamilyKey,
      label: getRoleFamilyLabel(familyKey as RoleFamilyKey),
      apps: familyMap[familyKey],
    }));
  }, [filteredApps]);

  const activeFilterCount = [filterFamily, filterStatus, filterCompany].filter(v => v !== "all").length;

  const clearFilters = () => {
    setFilterFamily("all");
    setFilterStatus("all");
    setFilterCompany("all");
  };

  if (selApp) {
    const sm = STATUS_META[selApp.status] || STATUS_META.applied;
    return (
      <div className="max-w-[720px] mx-auto p-7 animate-fade-up">
        <button onClick={() => setSelApp(null)} className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors">
          ← All applications
        </button>
        <div className="flex flex-col gap-3">
          <div className="bg-card border border-border rounded-[11px] p-5">
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-background text-[11px] font-bold">{initials(selApp.company)}</span>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{selApp.company}</div>
                  <h2 className="font-serif text-[19px] font-normal mb-0.5">{selApp.title}</h2>
                  <div className="text-xs text-muted-foreground">Applied {fmtDate(selApp.appliedDate)} · {daysSince(selApp.appliedDate)} days ago</div>
                </div>
              </div>
              <select
                value={selApp.status}
                onChange={e => { const u = { ...selApp, status: e.target.value }; setSelApp(u); setApps(prev => prev.map(a => a.jobId === selApp.jobId ? u : a)); }}
                className="text-xs border border-border rounded-[6px] px-2 py-1 bg-card cursor-pointer"
              >
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-card border border-border rounded-[11px] p-4">
            <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2.5">Email Activity</div>
            {selApp.lastEmail ? (
              <div className="text-xs text-secondary-foreground">Reply detected from {selApp.recruiterEmail} on {fmtDate(selApp.lastEmail)}</div>
            ) : (
              <div className="text-xs text-muted-foreground">No recruiter emails yet · inbox is monitored</div>
            )}
          </div>

          <div className="bg-card border border-border rounded-[11px] p-4">
            <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2">Notes</div>
            <textarea
              value={selApp.notes}
              onChange={e => { const u = { ...selApp, notes: e.target.value }; setSelApp(u); setApps(prev => prev.map(a => a.jobId === selApp.jobId ? u : a)); }}
              placeholder="Add notes…"
              className="w-full bg-secondary border border-border rounded-[6px] p-2.5 text-xs text-secondary-foreground min-h-[70px] outline-none resize-y"
            />
          </div>

          {selApp.status !== "rejected" && (
            <div className="bg-card border border-border rounded-[11px] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide">Follow-up Email</div>
                  {daysSince(selApp.appliedDate) >= 7 && !selApp.lastEmail && (
                    <div className="text-[11.5px] mt-0.5" style={{ color: "hsl(var(--warning))" }}>{daysSince(selApp.appliedDate)} days since application</div>
                  )}
                </div>
                {!fuDrafts[selApp.jobId] && (
                  <button
                    onClick={() => draftFollowUp(selApp)}
                    disabled={fuLoading === selApp.jobId}
                    className="bg-foreground text-background rounded-[6px] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    {fuLoading === selApp.jobId ? "Drafting…" : "Draft follow-up"}
                  </button>
                )}
              </div>
              {fuLoading === selApp.jobId && (
                <div className="flex gap-2 items-center text-muted-foreground text-xs">
                  <Spinner size={13} /><span className="animate-pulse-dot">Writing…</span>
                </div>
              )}
              {fuDrafts[selApp.jobId] && (
                <div className="animate-fade-up">
                  <textarea
                    value={fuDrafts[selApp.jobId]}
                    onChange={e => setFUD(prev => ({ ...prev, [selApp.jobId]: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-[6px] p-2.5 text-xs text-secondary-foreground min-h-[130px] outline-none resize-y leading-relaxed"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => { await new Promise(r => setTimeout(r, 1200)); setEmailSent(true); setTimeout(() => setEmailSent(false), 2500); }}
                      className={`rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-colors ${emailSent ? "bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))]" : "bg-foreground text-background"}`}
                    >
                      {emailSent ? "Sent ✓" : "Send via Gmail"}
                    </button>
                    <button onClick={() => copy(fuDrafts[selApp.jobId])} className="bg-secondary border border-border text-secondary-foreground rounded-[6px] px-3 py-1.5 text-xs">Copy</button>
                    <button onClick={() => setFUD(prev => { const n = { ...prev }; delete n[selApp.jobId]; return n; })} className="text-muted-foreground text-xs hover:text-foreground">Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto p-7 pt-9">
      <h1 className="font-serif text-[26px] font-normal mb-1">Applications</h1>
      <p className="text-xs text-muted-foreground mb-5">
        {applications.length} tracked · {needsFollowUp.length > 0 ? `${needsFollowUp.length} follow-up${needsFollowUp.length > 1 ? "s" : ""} overdue` : "all follow-ups current"}
      </p>

      {needsFollowUp.length > 0 && (
        <div className="rounded-[9px] p-3 px-4 mb-4 flex items-center gap-2" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
          <span>⏰</span>
          <span className="text-xs font-medium" style={{ color: "hsl(var(--warning))" }}>
            {needsFollowUp.length} application{needsFollowUp.length > 1 ? "s" : ""} past 7 days with no reply
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 mb-5">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const count = applications.filter(a => a.status === key).length;
          return (
            <div key={key} className="bg-card border border-border rounded-[9px] p-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                <span className="text-[10.5px] font-semibold" style={{ color: meta.text }}>{meta.label}</span>
              </div>
              <div className="font-serif text-[26px]">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[6px] border transition-colors ${
              activeFilterCount > 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-2 bg-card border border-border rounded-[9px] p-3 animate-fade-up">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Role Family</label>
              <select
                value={filterFamily}
                onChange={e => setFilterFamily(e.target.value as any)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Families</option>
                {ROLE_FAMILIES.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Company</label>
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Companies</option>
                {uniqueCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Grouped application list */}
      {filteredApps.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[11px] p-10 text-center">
          <p className="text-sm text-muted-foreground">No applications match your filters.</p>
          <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedData.map(({ familyKey, label, apps: familyApps }) => {
            const isCollapsed = collapsedFamilies.has(familyKey);
            return (
              <div key={familyKey}>
                <button
                  onClick={() => toggleFamily(familyKey)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h2 className="font-serif text-[17px] font-normal">{label}</h2>
                  <span className="text-[11px] text-muted-foreground">({familyApps.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-1.5 ml-5">
                    {familyApps.map((app, i) => {
                      const sm = STATUS_META[app.status] || STATUS_META.applied;
                      const overdue = app.status === "applied" && daysSince(app.appliedDate) >= 7;
                      return (
                        <div
                          key={`${app.jobId}-${i}`}
                          onClick={() => setSelApp(app)}
                          className="animate-fade-up bg-card border rounded-[9px] p-4 grid cursor-pointer hover:shadow-sm hover:-translate-y-px transition-all"
                          style={{
                            gridTemplateColumns: "38px 1fr auto",
                            gap: 12,
                            alignItems: "center",
                            borderColor: overdue ? "hsl(var(--warning-border))" : undefined,
                            animationDelay: `${i * 0.04}s`,
                          }}
                        >
                          <div className="w-[38px] h-[38px] bg-secondary border border-border rounded-lg flex items-center justify-center">
                            <span className="text-[10px] font-bold text-secondary-foreground">{initials(app.company)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold">{app.title}</span>
                              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold" style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.text }}>
                                <span className="w-1 h-1 rounded-full inline-block" style={{ background: sm.dot }} />{sm.label}
                              </span>
                              {overdue && <Tag color={`hsl(var(--warning))`} bg={`hsl(var(--warning-bg))`} border={`hsl(var(--warning-border))`}>Follow up overdue</Tag>}
                            </div>
                            <div className="text-xs text-muted-foreground">{app.company} · Applied {fmtDate(app.appliedDate)} ({daysSince(app.appliedDate)}d ago)</div>
                            {app.nextAction && <div className="text-[11.5px] text-secondary-foreground mt-1">→ {app.nextAction}</div>}
                          </div>
                          <span className="text-xs text-muted-foreground">View →</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Applications;
