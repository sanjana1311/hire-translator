import { useState } from "react";
import { toast } from "sonner";
import { useLinkedIn } from "@/hooks/use-linkedin";

const LinkedInConnect = () => {
  const { status, loading, error, connect, disconnect } = useLinkedIn();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="apple-card p-4 text-xs text-muted-foreground animate-pulse">Checking LinkedIn connection…</div>
    );
  }

  if (error && error.code !== "LINKEDIN_NOT_CONFIGURED") {
    return (
      <div className="apple-card p-4 text-xs" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
        <span className="font-semibold">LinkedIn unavailable.</span> {error.message} Manual LinkedIn search links still work below.
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="apple-card p-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">LinkedIn (optional)</div>
        <p className="text-xs leading-relaxed text-secondary-foreground">
          <span className="font-semibold text-foreground">You don't need this.</span> Connecting LinkedIn would only let hireOS read your own
          profile (name and headline) so outreach drafts sound more like you. It never scrapes LinkedIn, never adds connections and never
          sends messages — that is why every contact below uses a <span className="font-semibold">Manual search</span> link that simply opens
          LinkedIn in a new tab so you send the request yourself.
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground mt-2">
          Sign-in isn't configured on this deployment. Self-hosting? Set <code className="font-mono">LINKEDIN_CLIENT_ID</code>,{" "}
          <code className="font-mono">LINKEDIN_CLIENT_SECRET</code> and <code className="font-mono">LINKEDIN_REDIRECT_URI</code> — see{" "}
          <span className="font-mono">docs/LINKEDIN_OAUTH.md</span>.
        </p>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="apple-card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">LinkedIn connected</div>
          <p className="text-xs text-secondary-foreground">
            {status.account?.member_name || "Your LinkedIn account"} · only data you authorized is stored. Disconnecting deletes it.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await disconnect();
            setBusy(false);
            if (ok) toast.success("LinkedIn disconnected and imported data deleted");
          }}
          className="shrink-0 bg-secondary border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-40"
        >
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="apple-card p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">LinkedIn (optional)</div>
        <p className="text-xs text-secondary-foreground">
          Optional. Connecting lets hireOS read your own LinkedIn name and headline so outreach drafts sound like you. It never scrapes
          LinkedIn, adds connections or sends messages — contact links below always open LinkedIn so you act yourself.
        </p>
      </div>
      <button
        onClick={() => void connect()}
        className="shrink-0 bg-foreground text-background rounded-lg px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 transition-opacity"
      >
        Connect LinkedIn
      </button>
    </div>
  );
};

export default LinkedInConnect;
