import { useState, useMemo } from "react";
import { classifyRole, getRoleFamilyLabel, ROLE_FAMILIES, type RoleFamilyKey } from "@/lib/role-classifier";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import { initials } from "@/data/seed";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
}

interface GroupedJobListProps<T extends Job> {
  jobs: T[];
  onSelect: (job: T) => void;
  /** Optional right-side content per job row */
  renderRight?: (job: T) => React.ReactNode;
  /** CTA label on the right, defaults to "View →" */
  ctaLabel?: string;
  /** Show location filter */
  showLocationFilter?: boolean;
}

export default function GroupedJobList<T extends Job>({
  jobs,
  onSelect,
  renderRight,
  ctaLabel = "View →",
  showLocationFilter = true,
}: GroupedJobListProps<T>) {
  const [filterFamily, setFilterFamily] = useState<RoleFamilyKey | "all">("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  const toggleFamily = (key: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const classifiedJobs = useMemo(() =>
    jobs.map(job => ({ ...job, roleFamily: classifyRole(job.title) })),
    [jobs]
  );

  const uniqueCompanies = useMemo(() => [...new Set(jobs.map(j => j.company))].sort(), [jobs]);
  const uniqueLocations = useMemo(() => [...new Set(jobs.map(j => j.location || "Remote"))].sort(), [jobs]);

  const filteredJobs = useMemo(() => {
    return classifiedJobs.filter(job => {
      if (filterFamily !== "all" && job.roleFamily !== filterFamily) return false;
      if (filterCompany !== "all" && job.company !== filterCompany) return false;
      if (filterLocation !== "all" && (job.location || "Remote") !== filterLocation) return false;
      return true;
    });
  }, [classifiedJobs, filterFamily, filterCompany, filterLocation]);

  const groupedData = useMemo(() => {
    const familyMap: Record<string, typeof filteredJobs> = {};
    for (const job of filteredJobs) {
      const key = job.roleFamily;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(job);
    }
    const familyOrder = [...ROLE_FAMILIES.map(f => f.key), "other"];
    const sortedFamilies = Object.keys(familyMap).sort(
      (a, b) => familyOrder.indexOf(a) - familyOrder.indexOf(b)
    );
    return sortedFamilies.map(familyKey => ({
      familyKey: familyKey as RoleFamilyKey,
      label: getRoleFamilyLabel(familyKey as RoleFamilyKey),
      jobs: familyMap[familyKey],
    }));
  }, [filteredJobs]);

  const activeFilterCount = [filterFamily, filterCompany, filterLocation].filter(v => v !== "all").length;

  const clearFilters = () => {
    setFilterFamily("all");
    setFilterCompany("all");
    setFilterLocation("all");
  };

  if (jobs.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-[9px] p-12 text-center">
        <p className="text-sm text-muted-foreground">No imported jobs yet. Sync your Gmail on the Roles page to get started.</p>
      </div>
    );
  }

  return (
    <div>
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
          <div className={`grid gap-2 bg-card border border-border rounded-[9px] p-3 animate-fade-up ${showLocationFilter ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
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
            {showLocationFilter && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Location</label>
                <select
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
                >
                  <option value="all">All Locations</option>
                  {uniqueLocations.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grouped list */}
      {filteredJobs.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[11px] p-10 text-center">
          <p className="text-sm text-muted-foreground">No roles match your filters.</p>
          <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedData.map(({ familyKey, label, jobs: familyJobs }) => {
            const isCollapsed = collapsedFamilies.has(familyKey);
            return (
              <div key={familyKey}>
                <button
                  onClick={() => toggleFamily(familyKey)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h2 className="font-serif text-[17px] font-normal">{label}</h2>
                  <span className="text-[11px] text-muted-foreground">({familyJobs.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-1.5 ml-5">
                    {familyJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => onSelect(job)}
                        className="bg-card border border-border rounded-[9px] p-4 flex items-center justify-between cursor-pointer hover:shadow-sm hover:-translate-y-px transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-[38px] h-[38px] bg-secondary border border-border rounded-lg flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-secondary-foreground">{initials(job.company)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{job.title}</div>
                            <div className="text-xs text-muted-foreground">{job.company} · {job.location || "Remote"}</div>
                          </div>
                        </div>
                        {renderRight ? renderRight(job) : (
                          <span className="text-xs text-muted-foreground shrink-0">{ctaLabel}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
