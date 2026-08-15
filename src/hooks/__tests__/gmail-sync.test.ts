import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { SyncReport, SyncResult } from "@/hooks/use-gmail-import";
import { countsFromReport, friendlyErrorMessage, useGmailImport } from "@/hooks/use-gmail-import";

// ── Supabase client mock ───────────────────────────────────────────────
const invoke = vi.fn();
const metaRow: any = { last_synced_at: null, last_sync_status: null, last_sync_summary: null, last_sync_completed_at: null, last_sync_error: null };

vi.mock("@/integrations/supabase/client", () => {
  const table = (name: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      order: () => Promise.resolve({ data: name === "imported_jobs" ? [] : null }),
      maybeSingle: () => Promise.resolve({ data: name === "gmail_sync_metadata" ? metaRow : null }),
      upsert: () => Promise.resolve({ error: null }),
      update: () => chain,
    };
    return chain;
  };
  return {
    supabase: {
      from: (name: string) => table(name),
      auth: {
        getSession: () => Promise.resolve({ data: { session: { provider_token: "tok", provider_refresh_token: null } } }),
        signOut: () => Promise.resolve({}),
      },
      functions: { invoke: (...args: any[]) => invoke(...args) },
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

function report(partial: Partial<SyncReport> = {}): SyncReport {
  return {
    emailsScanned: 0,
    jobAlertsDetected: 0,
    jobsImported: 0,
    duplicatesSkipped: 0,
    emailsRejected: 0,
    parseFailures: 0,
    applicationsMatched: 0,
    query: "q",
    emails: [],
    ...partial,
  };
}

function result(partial: Partial<SyncResult> = {}): SyncResult {
  const r = partial.report ?? report();
  return {
    success: true,
    requestId: "req-1234-5678",
    scanned: r.emailsScanned,
    imported: r.jobsImported,
    skipped: r.duplicatesSkipped + r.emailsRejected,
    failed: r.parseFailures,
    syncStartedAt: "2026-08-15T02:00:00.000Z",
    syncCompletedAt: "2026-08-15T02:00:30.000Z",
    errors: [],
    report: r,
    jobs: [],
    ...partial,
  };
}

beforeEach(() => {
  invoke.mockReset();
  metaRow.last_sync_summary = null;
  metaRow.last_sync_status = null;
  metaRow.last_sync_error = null;
  metaRow.last_sync_completed_at = null;
});

describe("count classification", () => {
  it("counts a successful sync", () => {
    expect(
      countsFromReport(report({ emailsScanned: 10, jobsImported: 4, duplicatesSkipped: 3, emailsRejected: 2, parseFailures: 1 }))
    ).toEqual({ scanned: 10, imported: 4, skipped: 5, failed: 1 });
  });

  it("treats duplicate emails as skipped, not imported", () => {
    const c = countsFromReport(report({ emailsScanned: 3, duplicatesSkipped: 3 }));
    expect(c.imported).toBe(0);
    expect(c.skipped).toBe(3);
  });

  it("treats irrelevant emails as skipped", () => {
    const c = countsFromReport(report({ emailsScanned: 5, emailsRejected: 5 }));
    expect(c).toEqual({ scanned: 5, imported: 0, skipped: 5, failed: 0 });
  });

  it("treats malformed job alerts as failed", () => {
    const c = countsFromReport(report({ emailsScanned: 2, parseFailures: 2 }));
    expect(c.failed).toBe(2);
    expect(c.skipped).toBe(0);
  });

  it("returns zeroes with no report", () => {
    expect(countsFromReport(null)).toEqual({ scanned: 0, imported: 0, skipped: 0, failed: 0 });
  });
});

describe("error messaging", () => {
  it("surfaces the structured backend error", () => {
    expect(
      friendlyErrorMessage(result({ success: false, errors: [{ stage: "token_refresh", code: "GOOGLE_TOKEN_EXPIRED", message: "Your Google connection has expired." }] }))
    ).toBe("Your Google connection has expired.");
  });

  it("falls back to the plain error field", () => {
    expect(friendlyErrorMessage({ success: false, errors: [], error: "Gmail rate limit reached (429)." } as any)).toBe("Gmail rate limit reached (429).");
  });

  it("returns null on success", () => {
    expect(friendlyErrorMessage(result())).toBeNull();
  });
});

describe("useGmailImport sync flow", () => {
  it("stores counts after a successful sync", async () => {
    invoke.mockResolvedValue({ data: result({ report: report({ emailsScanned: 6, jobsImported: 2, duplicatesSkipped: 1 }) }), error: null });
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncCounts).toEqual({ scanned: 6, imported: 2, skipped: 1, failed: 0 }));
    expect(hook.current.syncError).toBeNull();
    expect(hook.current.syncStatus).toBe("success");
  });

  it("exposes an expired Gmail token as a friendly error", async () => {
    invoke.mockResolvedValue({
      data: result({ success: false, report: null, tokenExpired: true, errors: [{ stage: "token_refresh", code: "GOOGLE_TOKEN_EXPIRED", message: "Your Google connection has expired. Please re-connect Gmail." }] }),
      error: null,
    });
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncError).toMatch(/expired/i));
    expect(hook.current.syncStatus).toBe("no_token");
  });

  it("exposes Gmail API failures with their stage and code", async () => {
    invoke.mockResolvedValue({
      data: result({ success: false, report: null, errors: [{ stage: "gmail_search", code: "GMAIL_RATE_LIMITED", message: "Gmail rate limit reached (429). Please try again in a few minutes." }] }),
      error: null,
    });
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncErrors[0].code).toBe("GMAIL_RATE_LIMITED"));
    expect(hook.current.syncError).toMatch(/429/);
  });

  it("exposes database failures instead of a generic message", async () => {
    invoke.mockResolvedValue({
      data: result({ success: false, report: null, errors: [{ stage: "persist", code: "DB_INSERT_FAILED", message: "Could not save the imported jobs to the database." }] }),
      error: null,
    });
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncError).toBe("Could not save the imported jobs to the database."));
    expect(hook.current.syncStatus).toBe("error");
  });

  it("does not show stale success data after a failed sync", async () => {
    invoke.mockResolvedValueOnce({ data: result({ report: report({ emailsScanned: 4, jobsImported: 2 }) }), error: null });
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncCounts?.imported).toBe(2));

    invoke.mockResolvedValueOnce({
      data: result({ success: false, report: null, errors: [{ stage: "gmail_search", code: "GMAIL_SERVER_ERROR", message: "Gmail is temporarily unavailable (503)." }] }),
      error: null,
    });
    await act(async () => { await hook.current.triggerSync(true); });
    await waitFor(() => expect(hook.current.syncError).toMatch(/unavailable/));
    expect(hook.current.syncCounts).toEqual({ scanned: 0, imported: 0, skipped: 0, failed: 0 });
  });

  it("restores the persisted summary from the database on load", async () => {
    metaRow.last_sync_status = "success";
    metaRow.last_sync_completed_at = "2026-08-15T02:00:30.000Z";
    metaRow.last_sync_summary = { scanned: 9, imported: 3, skipped: 5, failed: 1, errors: [], report: report({ emailsScanned: 9, jobsImported: 3 }) };
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await waitFor(() => expect(hook.current.syncCounts).toEqual({ scanned: 9, imported: 3, skipped: 5, failed: 1 }));
    expect(hook.current.syncReportAt).toBe("2026-08-15T02:00:30.000Z");
  });

  it("restores a persisted failure state", async () => {
    metaRow.last_sync_status = "error";
    metaRow.last_sync_error = "Gmail is not connected.";
    metaRow.last_sync_summary = { scanned: 0, imported: 0, skipped: 0, failed: 0, errors: [{ stage: "token", code: "GMAIL_NOT_CONNECTED", message: "Gmail is not connected." }], report: null };
    const { result: hook } = renderHook(() => useGmailImport("p1"));
    await waitFor(() => expect(hook.current.syncError).toBe("Gmail is not connected."));
    expect(hook.current.syncStatus).toBe("error");
  });
});
