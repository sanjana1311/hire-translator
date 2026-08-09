import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META } from "@/data/seed";

export interface StatusEvent {
  id: string;
  status: string;
  source: string;
  entered_at: string | null;
  created_at: string;
}

const STATUS_ORDER = ["applied", "screening", "interview", "offer", "rejected"];

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export const useStatusEvents = (applicationId?: string) => {
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!applicationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("application_status_events")
      .select("id,status,source,entered_at,created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });
    setEvents((data as StatusEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    setEvents([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  return { events, loading, reload: load };
};

export const StatusTimeline = ({
  events,
  currentStatus,
}: {
  events: StatusEvent[];
  currentStatus: string;
}) => {
  const now = new Date().toISOString();

  // first event per status, in chronological order
  const firstByStatus = new Map<string, StatusEvent>();
  for (const e of events) if (!firstByStatus.has(e.status)) firstByStatus.set(e.status, e);

  const reached = events
    .filter((e) => firstByStatus.get(e.status)?.id === e.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const rows = [
    ...reached,
    ...STATUS_ORDER.filter((s) => !firstByStatus.has(s)).map((s) => ({ status: s } as Partial<StatusEvent> & { status: string })),
  ];

  return (
    <div className="apple-card p-4">
      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Status Timeline</div>
      <div className="flex flex-col">
        {rows.map((row, i) => {
          const meta = STATUS_META[row.status] || STATUS_META.applied;
          const ev = firstByStatus.get(row.status);
          const isCurrent = row.status === currentStatus;
          const start = ev ? ev.entered_at || ev.created_at : null;
          const nextEv = reached[reached.findIndex((r) => r.status === row.status) + 1];
          const end = isCurrent ? now : nextEv ? nextEv.entered_at || nextEv.created_at : now;
          const days = start ? daysBetween(start, end) : null;
          const last = i === rows.length - 1;

          return (
            <div key={row.status} className="grid" style={{ gridTemplateColumns: "16px 1fr", gap: 10 }}>
              <div className="flex flex-col items-center">
                <span
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: ev ? meta.dot : "hsl(var(--border))", boxShadow: isCurrent ? `0 0 0 3px ${meta.bg}` : undefined }}
                />
                {!last && <span className="w-px flex-1 my-1" style={{ background: "hsl(var(--border))" }} />}
              </div>
              <div className={last ? "pb-0" : "pb-4"}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-semibold ${ev ? "" : "text-muted-foreground"}`}>{meta.label}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-px" style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.text }}>
                      Current
                    </span>
                  )}
                </div>
                {ev ? (
                  <>
                    <div className="text-xs text-muted-foreground">{start ? fmtFull(start) : "Date unavailable"}</div>
                    <div className="text-xs text-muted-foreground">
                      {days === null ? "Duration unavailable" : `${days} day${days === 1 ? "" : "s"}`}
                      {ev.source ? ` · ${ev.source}` : ""}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Not reached</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
