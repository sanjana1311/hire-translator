import { describe, it, expect } from "vitest";
import { assessJob, displayTitle } from "@/lib/job-review";
import { deriveRoleStatus } from "@/lib/role-status";

const valid = [
  { title: "Technical Program Manager, Infrastructure", company: "Anthropic", location: "New York, NY" },
  { title: "Program Manager, Human Data", company: "OpenAI", location: "San Francisco, CA" },
  { title: "Business Product Manager, Talent Studio", company: "Google", location: "Mountain View, CA" },
  { title: "Senior Inventory Planning Manager", company: "Zoox", location: "Hayward, CA" },
  { title: "AI Project Manager", company: "Fabletics", location: "" },
  { title: "Deployment Strategist", company: "Crossing Hurdles", location: "New York, NY" },
  { title: "Product & Strategy Intern (Fall 2026)", company: "Relay", location: "" },
  { title: "Staff Supply Chain Program Manager", company: "Zoox", location: "Foster City, CA" },
];

const malformed = [
  { title: "Billion in IPO", company: "a Potential", location: "" },
  { title: "ith other candidates Hi Sanjana, Thank you for your application to the Program Manager role", company: "Mercor", location: "" },
];

describe("assessJob", () => {
  it("accepts well-parsed roles", () => {
    for (const job of valid) expect(assessJob(job).needsReview, job.title).toBe(false);
  });

  it("flags malformed email fragments", () => {
    for (const job of malformed) expect(assessJob(job).needsReview, job.title).toBe(true);
  });

  it("counts 8 imported / 2 needs review for a mixed batch", () => {
    const batch = [...valid, ...malformed];
    const flagged = batch.filter((j) => assessJob(j).needsReview);
    expect(batch.length - flagged.length).toBe(8);
    expect(flagged.length).toBe(2);
  });

  it("never leaks malformed text as a title", () => {
    expect(displayTitle(malformed[0])).toBe("Title needs review");
    expect(displayTitle(valid[0])).toBe(valid[0].title);
  });

  it("clears review once confirmed", () => {
    expect(assessJob({ ...malformed[0], confirmed_at: new Date().toISOString() }).needsReview).toBe(false);
  });

  it("does not flag on missing location alone", () => {
    expect(assessJob({ title: "Product Manager", company: "Stripe", location: "" }).needsReview).toBe(false);
  });
});

describe("deriveRoleStatus", () => {
  it("maps each state to one unambiguous status", () => {
    expect(deriveRoleStatus({ needsReview: true, hasScore: false, hasTailoredResume: false })).toBe("needs_review");
    expect(deriveRoleStatus({ needsReview: false, hasScore: false, hasTailoredResume: false })).toBe("confirmed");
    expect(deriveRoleStatus({ needsReview: false, hasScore: true, hasTailoredResume: false })).toBe("scored");
    expect(deriveRoleStatus({ needsReview: false, hasScore: true, hasTailoredResume: true })).toBe("tailored");
    expect(deriveRoleStatus({ needsReview: false, hasScore: true, hasTailoredResume: true, applicationStatus: "applied" })).toBe("applied");
    expect(deriveRoleStatus({ needsReview: false, hasScore: true, hasTailoredResume: false, applicationStatus: "interview" })).toBe("interviewing");
    expect(deriveRoleStatus({ needsReview: false, hasScore: true, hasTailoredResume: false, applicationStatus: "rejected" })).toBe("rejected");
  });
});
