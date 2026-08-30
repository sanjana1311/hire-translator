import { describe, expect, it } from "vitest";
import {
  classifyEmail,
  looksLikePersonName,
  validateListing,
} from "../../../supabase/functions/fetch-gmail-jobs/listing";
import { canConfirmJob } from "../job-review";

const email = (subject: string, from = "notifications@linkedin.com", body = "") => ({ subject, from, body });

describe("classifyEmail — non-job email rejection", () => {
  it("rejects content newsletters", () => {
    const r = classifyEmail(email("The Batch #53: what matters in AI this week", "hello@deeplearning.ai"));
    expect(r.isJobAlert).toBe(false);
    expect(r.category).toBe("newsletter");
  });

  it("rejects networking notifications", () => {
    for (const s of [
      "People you may know at Tesla",
      "You have 3 new invitations",
      "Priya Sharma viewed your profile",
      "Congratulate Alex on the new position",
    ]) {
      expect(classifyEmail(email(s)).isJobAlert).toBe(false);
    }
  });

  it("rejects bootcamp and course promotions", () => {
    expect(classifyEmail(email("Enroll in our Data Science bootcamp — 40% off", "team@school.com")).category)
      .toBe("promotion");
  });

  it("rejects application confirmations", () => {
    expect(classifyEmail(email("Thank you for applying to Mercor", "no-reply@mercor.com")).category)
      .toBe("confirmation");
  });

  it("rejects unrelated mail with no job signals", () => {
    expect(classifyEmail(email("Your February statement is ready", "bank@example.com")).isJobAlert).toBe(false);
  });
});

describe("classifyEmail — genuine job alerts survive", () => {
  it("accepts an explicit job alert subject", () => {
    expect(classifyEmail(email("Job alert: 12 new Data Engineer jobs in Austin")).isJobAlert).toBe(true);
  });

  it("accepts a job-board sender with hiring language", () => {
    expect(
      classifyEmail(email("Your job matches", "jobalerts-noreply@linkedin.com", "New jobs for you this week")).isJobAlert,
    ).toBe(true);
  });

  it("accepts a company email with an apply link", () => {
    const body = "We're hiring a Thermal Engineer. Apply now: https://tesla.com/careers/12345";
    expect(classifyEmail(email("Open roles at Tesla", "careers@tesla.com", body)).isJobAlert).toBe(true);
  });

  it("does not let the newsletter filter eat a real digest of jobs", () => {
    expect(classifyEmail(email("Weekly digest: new jobs for you")).isJobAlert).toBe(true);
  });
});

describe("validateListing — social chrome and person names", () => {
  const base = { company: "Acme Corp", url: "https://acme.com/jobs/1", snippet: "" };

  it("rejects connection counts as titles", () => {
    expect(validateListing({ ...base, title: "38 connections" })).toBeNull();
    expect(validateListing({ ...base, title: "1 company alum" })).toBeNull();
  });

  it("rejects email footer text", () => {
    expect(validateListing({ ...base, title: "This email was sent to you@example.com" })).toBeNull();
  });

  it("rejects newsletter fragments", () => {
    expect(validateListing({ ...base, title: "The Batch #53" })).toBeNull();
  });

  it("rejects a person's name in the title slot", () => {
    expect(looksLikePersonName("Priya Sharma")).toBe(true);
    expect(looksLikePersonName("Data Engineer")).toBe(false);
    expect(validateListing({ ...base, title: "Priya Sharma" })).toBeNull();
  });

  it("still accepts a real listing", () => {
    const v = validateListing({ ...base, title: "Senior Data Engineer", location: "Austin, TX" });
    expect(v).not.toBeNull();
    expect(v!.title).toBe("Senior Data Engineer");
  });
});

describe("canConfirmJob", () => {
  it("blocks confirming a malformed role", () => {
    expect(canConfirmJob({ title: "Thank you for applying", company: "Acme" })).toBe(false);
    expect(canConfirmJob({ title: "Data Engineer", company: "Austin, TX" })).toBe(false);
  });

  it("allows confirming a clean role", () => {
    expect(canConfirmJob({ title: "Data Engineer", company: "Acme" })).toBe(true);
  });
});
