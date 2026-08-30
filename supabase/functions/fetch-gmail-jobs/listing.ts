// Shared listing extraction, validation and idempotency helpers for Gmail job sync.
// Kept dependency-free so it can be unit tested in isolation.

export type RawListing = {
  title?: unknown;
  company?: unknown;
  location?: unknown;
  salary?: unknown;
  url?: unknown;
  source?: unknown;
  snippet?: unknown;
};

export type ImportQuality = "valid" | "needs_review" | "invalid_import";

export type ValidatedListing = {
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  source: string | null;
  snippet: string | null;
  quality: ImportQuality;
  issues: string[];
};

const BOILERPLATE =
  /(see all jobs|view all jobs|jobs at a glance|install linkedin|stay updated|unsubscribe|manage alerts?|email preferences|top applicants?|early applicant|promoted|linkedin widgets|connections? you may know|and more$|^a glance$|^email alert$|^linkedin$|^indeed$)/i;

const APPLICATION_CONFIRMATION =
  /(your application (was|has been) (sent|submitted|received)|thank you for applying|application received|we received your application|application confirmation)/i;

/**
 * Social / networking / newsletter chrome that repeatedly leaked into imports as
 * fake roles: "38 connections", "1 company alum", "The Batch #53",
 * "This email was sent to ...".
 */
const SOCIAL_CHROME =
  /^(\d+\s*(?:\+)?\s*(?:connections?|followers?|company alums?|alumni|mutual(?: connections?)?|school alums?|new jobs?|people)\b|this email was sent to\b|sent to you because\b|you are receiving this\b|view (?:in browser|online)\b|add to (?:your )?address book\b|©|copyright\b)/i;

/** Newsletter / course / event content that is never a job listing. */
const NEWSLETTER_CONTENT =
  /(\bthe batch\b|\bnewsletter\b|\bissue\s*#?\d+|\b#\d{1,4}\s*[:–—-]|\bwebinar\b|\bmasterclass\b|\bbootcamp\b|\bcohort\b|\benroll(?:ment)?\b|\bcurriculum\b|\bregister (?:now|today)\b|\bearly bird\b|\b\d{1,3}%\s*off\b|\bsale ends\b|\bfree trial\b|\bwatch the (?:replay|recording)\b|\bread more\b|\bin this issue\b)/i;

const TITLE_KEYWORDS =
  /(manager|engineer|analyst|developer|designer|scientist|architect|specialist|director|coordinator|consultant|lead|intern|internship|operations|product|program|project|technician|administrator|recruiter|account executive|associate|officer|supervisor|strategist|controller|accountant|nurse|attorney|counsel)/i;

const LOCATION_PATTERN =
  /^(remote|hybrid|on[- ]?site|anywhere|[A-Za-z .'\-]+,\s*(?:[A-Z]{2}|[A-Za-z .'\-]{3,})(?:\s*\((?:remote|hybrid|on[- ]?site)\))?|[A-Za-z .'\-]{2,40}\s*\((?:remote|hybrid|on[- ]?site)\))$/i;

const LOCATION_HINT = /(remote|hybrid|on[- ]?site|,\s*[A-Z]{2}\b|united states|india|canada|united kingdom)/i;

/**
 * A bare human name ("Priya Sharma", "John A. Smith") with no role vocabulary.
 * These come from LinkedIn networking blocks and must never become a job title.
 */
export function looksLikePersonName(value: string): boolean {
  const v = normalizeText(value);
  if (!v || TITLE_KEYWORDS.test(v)) return false;
  return /^[A-Z][a-z'’\-]{1,15}(?: [A-Z]\.?)? [A-Z][a-z'’\-]{1,20}(?: (?:Jr|Sr|II|III)\.?)?$/.test(v);
}


export function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u00a0]/g, " ")
    .replace(/[•▪●►]/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

function nullIfEmpty(value: string): string | null {
  return value.length > 0 ? value : null;
}

/** Strip fences / prose and return the JSON array substring, best effort. */
export function extractJsonArray(raw: string): string {
  let text = String(raw ?? "")
    .replace(/```(?:json)?/gi, "")
    .trim();

  const start = text.indexOf("[");
  if (start > 0) text = text.slice(start);
  if (!text.startsWith("[")) {
    const objStart = text.indexOf("{");
    if (objStart >= 0) text = "[" + text.slice(objStart);
  }

  const end = text.lastIndexOf("]");
  if (end > 0 && end === text.length - 1) return text;

  // Truncated response: cut back to the last complete object and close the array.
  const lastObj = text.lastIndexOf("}");
  if (lastObj > 0) {
    text = text.slice(0, lastObj + 1).replace(/,\s*$/, "") + "]";
  }
  return text;
}

/** Parse a model response into an array of raw listings. Never throws. */
export function parseListingsResponse(raw: string): { listings: RawListing[]; repaired: boolean } {
  const direct = String(raw ?? "").replace(/```(?:json)?/gi, "").trim();
  try {
    const parsed = JSON.parse(direct);
    if (Array.isArray(parsed)) return { listings: parsed as RawListing[], repaired: false };
  } catch {
    // fall through to repair
  }

  try {
    const parsed = JSON.parse(extractJsonArray(direct));
    if (Array.isArray(parsed)) return { listings: parsed as RawListing[], repaired: true };
  } catch {
    // unrecoverable
  }

  return { listings: [], repaired: false };
}

/**
 * Strict schema validation. Returns null when the listing must not be imported
 * at all; otherwise returns the cleaned listing with a quality label.
 */
export function validateListing(raw: RawListing): ValidatedListing | null {
  const issues: string[] = [];

  const title = normalizeText(raw.title);
  const company = normalizeText(raw.company);
  let location = normalizeText(raw.location);
  let url = normalizeText(raw.url);
  const salary = normalizeText(raw.salary);
  const source = normalizeText(raw.source);
  let snippet = normalizeText(raw.snippet);

  // ── Hard rejects ─────────────────────────────────────────────
  if (!title || !company) return null;
  if (title.length < 3 || title.length > 140) return null;
  if (company.length < 2 || company.length > 100) return null;
  if (/^https?:\/\//i.test(title) || /^https?:\/\//i.test(company)) return null;
  if (BOILERPLATE.test(title) || BOILERPLATE.test(company)) return null;
  if (APPLICATION_CONFIRMATION.test(title) || APPLICATION_CONFIRMATION.test(snippet)) return null;
  if (title.toLowerCase() === company.toLowerCase()) return null;
  if (!/[A-Za-z]/.test(title) || !/[A-Za-z]/.test(company)) return null;
  // A title that is really a location means the fields were shifted.
  if (LOCATION_PATTERN.test(title)) return null;
  // Social chrome and newsletter fragments are never roles.
  if (SOCIAL_CHROME.test(title) || SOCIAL_CHROME.test(company)) return null;
  if (NEWSLETTER_CONTENT.test(title)) return null;
  // A person's name in the title slot means a networking block was parsed.
  if (looksLikePersonName(title)) return null;
  // A title with no role vocabulary and no structure is not a job title.
  if (!TITLE_KEYWORDS.test(title) && !/[a-z]/.test(title)) return null;


  // ── Soft issues (import, but flag for review) ────────────────
  if (title.includes(" · ")) issues.push("Title contains a separator — fields may be mixed");
  if (!TITLE_KEYWORDS.test(title)) {
    issues.push("Title does not contain recognisable role vocabulary");
  }
  if (NEWSLETTER_CONTENT.test(company)) {
    issues.push("Company looks like newsletter or course content");
  }
  if (looksLikePersonName(company)) {
    issues.push("Company name looks like a person's name");
  }
  if (LOCATION_PATTERN.test(company)) {
    issues.push("Company name looks like a location");
  }
  if (company.includes(" · ")) issues.push("Company contains a separator — fields may be mixed");
  if (TITLE_KEYWORDS.test(company) && !/(inc|llc|ltd|corp|group|labs|technologies|systems|solutions|health|bank|university|studio|media|partners|holdings|\.com|\.io|\.ai)\b/i.test(company)) {
    issues.push("Company name looks like a job title");
  }

  if (location && !LOCATION_HINT.test(location) && !LOCATION_PATTERN.test(location)) {
    issues.push(`Dropped unrecognised location "${location}"`);
    location = "";
  }

  if (url && !/^https?:\/\//i.test(url)) {
    issues.push("Dropped malformed job URL");
    url = "";
  }
  if (url.length > 2000) {
    url = "";
    issues.push("Dropped oversized job URL");
  }

  if (snippet.length > 300) snippet = snippet.slice(0, 297) + "...";

  return {
    title,
    company,
    location: nullIfEmpty(location),
    salary: nullIfEmpty(salary),
    url: nullIfEmpty(url),
    source: nullIfEmpty(source),
    snippet: nullIfEmpty(snippet),
    quality: issues.length > 0 ? "needs_review" : "valid",
    issues,
  };
}

/** Stable idempotency key: same email + same listing slot => same hash. */
export async function listingHash(params: {
  sourceEmailId: string | null;
  listingIndex: number;
  title: string;
  company: string;
}): Promise<string> {
  const basis = [
    params.sourceEmailId ?? "no-email",
    String(params.listingIndex),
    params.title.toLowerCase().trim().replace(/\s+/g, " "),
    params.company.toLowerCase().trim().replace(/\s+/g, " "),
  ].join("|");

  const bytes = new TextEncoder().encode(basis);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────
// Block-based fallback parser
// ─────────────────────────────────────────────────────────────

export function looksLikeTitleLine(line: string): boolean {
  const l = normalizeText(line);
  if (!l || l.length < 4 || l.length > 140) return false;
  if (/https?:\/\//i.test(l)) return false;
  if (BOILERPLATE.test(l)) return false;
  if (LOCATION_PATTERN.test(l)) return false;
  if (l.includes(" · ")) return false;
  if (TITLE_KEYWORDS.test(l)) return true;
  return /^[A-Z][A-Za-z0-9&+\/'(),.\-–—\s]{3,140}$/.test(l) && l.split(" ").length >= 2;
}

export function parseCompanyLocationLine(line: string): { company: string; location: string | null } | null {
  const l = normalizeText(line);
  if (!l || l.length < 2 || l.length > 160) return null;
  if (/https?:\/\//i.test(l)) return null;

  const parts = l
    .split(/\s(?:·|\||–|—|-)\s/)
    .map((p) => normalizeText(p))
    .filter(Boolean);

  if (parts.length >= 2) {
    const company = parts[0];
    const location = parts.slice(1).join(" · ");
    if (company.length < 2 || BOILERPLATE.test(company)) return null;
    return { company, location: location || null };
  }

  if (parts.length === 1 && !BOILERPLATE.test(parts[0]) && !LOCATION_PATTERN.test(parts[0])) {
    return { company: parts[0], location: null };
  }

  return null;
}

/**
 * Split a digest email into isolated listing blocks and parse each block on its
 * own, so a field can never leak from one listing into the next.
 */
export function extractListingBlocks(bodyText: string): RawListing[] {
  const lines = bodyText
    .split("\n")
    .map(normalizeText)
    .filter((l) => l.length > 0);

  type Block = { title: string; lines: string[] };
  const blocks: Block[] = [];

  for (const line of lines) {
    if (looksLikeTitleLine(line)) {
      blocks.push({ title: line, lines: [] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(line);
    }
  }

  const listings: RawListing[] = [];
  for (const block of blocks) {
    // Only the first few lines after a title belong to that listing.
    const window = block.lines.slice(0, 4);
    let company: string | null = null;
    let location: string | null = null;

    for (const l of window) {
      const parsed = parseCompanyLocationLine(l);
      if (parsed) {
        company = parsed.company;
        location = parsed.location;
        break;
      }
    }

    if (!company) continue;

    const blockUrl = window
      .concat(block.title)
      .join(" ")
      .match(/https?:\/\/[^\s"'<>]+/i)?.[0]
      ?.replace(/[),.;]+$/, "") ?? null;

    listings.push({
      title: block.title,
      company,
      location,
      url: blockUrl,
      snippet: null,
      salary: null,
    });
  }

  return listings.slice(0, 25);
}
