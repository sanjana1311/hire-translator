import { describe, expect, it } from "vitest";
import {
  extractListingBlocks,
  parseListingsResponse,
  validateListing,
} from "../../../supabase/functions/fetch-gmail-jobs/listing";

describe("parseListingsResponse", () => {
  it("parses clean JSON", () => {
    const { listings, repaired } = parseListingsResponse('[{"title":"Data Engineer","company":"Acme"}]');
    expect(listings).toHaveLength(1);
    expect(repaired).toBe(false);
  });

  it("repairs fenced and truncated JSON", () => {
    const raw = '```json\n[{"title":"Data Engineer","company":"Acme"},{"title":"Prod';
    const { listings, repaired } = parseListingsResponse(raw);
    expect(repaired).toBe(true);
    expect(listings).toHaveLength(1);
  });

  it("never throws on garbage", () => {
    expect(parseListingsResponse("sorry, I cannot help").listings).toEqual([]);
  });
});

describe("validateListing", () => {
  it("accepts a well-formed listing", () => {
    const v = validateListing({
      title: "Senior Data Engineer",
      company: "Acme Technologies",
      location: "Austin, TX",
      url: "https://boards.greenhouse.io/acme/jobs/1",
    });
    expect(v?.quality).toBe("valid");
  });

  it("rejects a location parked in the title field", () => {
    expect(validateListing({ title: "San Jose, CA", company: "Supermicro" })).toBeNull();
  });

  it("rejects application confirmation emails", () => {
    expect(
      validateListing({ title: "Your application was sent to Tesla", company: "Tesla" })
    ).toBeNull();
  });

  it("rejects boilerplate rows", () => {
    expect(validateListing({ title: "See all jobs", company: "LinkedIn" })).toBeNull();
  });

  it("flags a company that is really a job title", () => {
    const v = validateListing({ title: "Program Manager", company: "Construction Internship" });
    expect(v?.quality).toBe("needs_review");
  });

  it("drops an unrecognised location instead of importing it", () => {
    const v = validateListing({
      title: "Product Manager",
      company: "Rogers Communications",
      location: "Apply now",
    });
    expect(v?.location).toBeNull();
    expect(v?.quality).toBe("needs_review");
  });

  it("drops a malformed url", () => {
    const v = validateListing({ title: "Product Manager", company: "Acme Inc", url: "click here" });
    expect(v?.url).toBeNull();
  });
});

describe("extractListingBlocks", () => {
  it("keeps fields inside their own listing block", () => {
    const body = [
      "Your job alert for product manager",
      "Product Manager",
      "Optimum · Bethpage, NY",
      "Actively recruiting",
      "Data Engineer",
      "Supermicro · San Jose, CA",
      "See all jobs",
    ].join("\n");

    const blocks = extractListingBlocks(body);
    const pm = blocks.find((b) => b.title === "Product Manager");
    const de = blocks.find((b) => b.title === "Data Engineer");

    expect(pm?.company).toBe("Optimum");
    expect(pm?.location).toBe("Bethpage, NY");
    expect(de?.company).toBe("Supermicro");
    expect(de?.location).toBe("San Jose, CA");
  });
});
