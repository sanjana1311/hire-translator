import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── AI helpers ───────────────────────────────────────────────────────

interface AICallOpts {
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  system: string;
  user: string;
  tools?: any[];
  toolChoice?: any;
}

const AI_TIMEOUT_MS = 110_000;

async function callAI(opts: AICallOpts): Promise<any> {
  const body: any = {
    model: opts.model,
    temperature: opts.temperature,
    top_p: opts.topP,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        // The gateway authenticates on this header — not `Authorization: Bearer`.
        "Lovable-API-Key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as any)?.name === "AbortError") {
      throw { status: 504, message: "The AI took too long to respond. Please try again." };
    }
    throw { status: 502, message: "Could not reach the AI service. Please try again." };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const status = res.status;
    const errText = await res.text();
    console.error("AI gateway error:", status, errText.slice(0, 800));
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits to continue." };
    if (status === 401 || status === 403) throw { status: 500, message: "AI service rejected our credentials. Please contact support." };
    if (status === 400) throw { status: 502, message: `The AI rejected the request (${status}). Please try again.` };
    throw { status: 502, message: `AI service error (${status}). Please try again.` };
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch (_e) {
      console.error("Tool argument parse failed:", String(toolCall.function.arguments).slice(0, 500));
      throw { status: 502, message: "The AI returned an incomplete response. Please try again." };
    }
  }
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  if (!jsonStr) throw { status: 502, message: "The AI returned an empty response. Please try again." };
  try {
    return JSON.parse(jsonStr);
  } catch (_e) {
    console.error("Content parse failed:", jsonStr.slice(0, 500));
    throw { status: 502, message: "The AI returned malformed output. Please try again." };
  }
}


// ─── Tool schemas ───────────────────────────────────────────────────

const STEP1_TOOL = {
  type: "function",
  function: {
    name: "extract_jd_signals",
    description: "Extract structured hiring signals from a job description.",
    parameters: {
      type: "object",
      properties: {
        job_title: { type: "string" },
        company: { type: "string" },
        seniority_level: { type: "string" },
        must_have_skills: { type: "array", items: { type: "string" } },
        nice_to_have_skills: { type: "array", items: { type: "string" } },
        tools_and_technologies: { type: "array", items: { type: "string" } },
        core_responsibilities: { type: "array", items: { type: "string" } },
        domain_signals: { type: "array", items: { type: "string" } },
        seniority_signals: {
          type: "object",
          properties: {
            years_experience_mentioned: { type: ["number", "null"] },
            ownership_level: { type: "string" },
            leadership_expected: { type: "boolean" },
          },
          required: ["years_experience_mentioned", "ownership_level", "leadership_expected"],
          additionalProperties: false,
        },
        red_flags: { type: "array", items: { type: "string" } },
        keywords_for_ats: { type: "array", items: { type: "string" } },
      },
      required: [
        "job_title", "company", "seniority_level", "must_have_skills",
        "nice_to_have_skills", "tools_and_technologies", "core_responsibilities",
        "domain_signals", "seniority_signals", "red_flags", "keywords_for_ats",
      ],
      additionalProperties: false,
    },
  },
};

const STEP2_TOOL = {
  type: "function",
  function: {
    name: "score_match",
    description: "Score the user's resume fit against JD signals.",
    parameters: {
      type: "object",
      properties: {
        overall_score: { type: "number" },
        bucket: { type: "string", enum: ["A", "B", "C", "D"] },
        must_have_coverage: {
          type: "object",
          properties: {
            matched: { type: "array", items: { type: "string" } },
            missing: { type: "array", items: { type: "string" } },
            partial: { type: "array", items: { type: "string" } },
          },
          required: ["matched", "missing", "partial"],
          additionalProperties: false,
        },
        tools_coverage: {
          type: "object",
          properties: {
            matched: { type: "array", items: { type: "string" } },
            missing: { type: "array", items: { type: "string" } },
          },
          required: ["matched", "missing"],
          additionalProperties: false,
        },
        dealbreaker_missing: { type: "array", items: { type: "string" } },
        top_strengths: { type: "array", items: { type: "string" } },
        top_gaps: { type: "array", items: { type: "string" } },
        recommendation: { type: "string" },
      },
      required: [
        "overall_score", "bucket", "must_have_coverage", "tools_coverage",
        "dealbreaker_missing", "top_strengths", "top_gaps", "recommendation",
      ],
      additionalProperties: false,
    },
  },
};

const STEP3_TOOL = {
  type: "function",
  function: {
    name: "suggest_projects",
    description: "Suggest portfolio projects to close skill gaps.",
    parameters: {
      type: "object",
      properties: {
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              what_to_build: { type: "string" },
              tech_stack: { type: "array", items: { type: "string" } },
              resume_bullets_it_generates: { type: "array", items: { type: "string" } },
              difficulty: { type: "string", enum: ["S", "M", "L"] },
              estimated_hours: { type: "number" },
              closes_gap: { type: "string" },
              signal_it_addresses: { type: "string" },
            },
            required: [
              "title", "what_to_build", "tech_stack", "resume_bullets_it_generates",
              "difficulty", "estimated_hours", "closes_gap", "signal_it_addresses",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["projects"],
      additionalProperties: false,
    },
  },
};

const STEP4_TOOL = {
  type: "function",
  function: {
    name: "tailor_resume",
    description: "Produce a tailored resume draft optimized for a specific role.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              dates: { type: "string" },
              bullets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    original: { type: "string" },
                    evidence: { type: "string" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["text", "original", "evidence", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "company", "dates", "bullets"],
            additionalProperties: false,
          },
        },
        skills: { type: "array", items: { type: "string" } },
        verified_skills: { type: "array", items: { type: "string" } },
        transferable_skills: { type: "array", items: { type: "string" } },
        missing_requirements: { type: "array", items: { type: "string" } },
        requirements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              requirement: { type: "string" },
              status: { type: "string", enum: ["verified", "transferable", "missing"] },
              evidence: { type: "string" },
            },
            required: ["requirement", "status", "evidence"],
            additionalProperties: false,
          },
        },
        low_confidence_bullets: { type: "array", items: { type: "string" } },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              status: { type: "string" },
            },
            required: ["title", "bullets", "status"],
            additionalProperties: false,
          },
        },
        changes_made: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "experience", "skills", "verified_skills", "transferable_skills", "missing_requirements", "requirements", "low_confidence_bullets", "projects", "changes_made"],

      additionalProperties: false,
    },
  },
};

// ─── Main handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { workspaceId, step } = await req.json();
    if (!workspaceId) throw new Error("workspaceId required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: ws, error: wsErr } = await supabaseClient
      .from("job_workspaces").select("*").eq("id", workspaceId).single();
    if (wsErr || !ws) throw new Error("Workspace not found");

    const { data: profile } = await supabaseClient
      .from("profiles").select("id").eq("user_id", user.id).eq("id", ws.profile_id).single();
    if (!profile) throw new Error("Not authorized");

    const { data: resume } = await supabaseClient
      .from("resumes").select("*").eq("profile_id", profile.id).maybeSingle();

    const resumeText = resume?.raw_text || "";
    const jobDescription = ws.job_description || "";
    const MODEL = "google/gemini-3.6-flash";

    // Determine which step to run
    const requestedStep = step || "analyze"; // "analyze" = Steps 1+2 auto, "projects", "tailor"

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1 — JD Signal Mining
    // ═══════════════════════════════════════════════════════════════════
    if (requestedStep === "analyze") {
      if (!jobDescription.trim()) throw new Error("No job description to analyze");

      console.log("Step 1: JD Signal Mining...");
      const jdSignals = await callAI({
        apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.0, topP: 0.4,
        system: `You are a hiring manager signal extractor. Return ONLY valid JSON. No prose. Do not hallucinate.`,
        user: `Extract structured hiring signals from this Job Description.

Rules:
- Extract only what is explicitly stated or strongly implied in the JD
- Do not infer skills that are not present
- Red flags = unrealistic requirements, vague scope, contradictory signals
- ATS keywords = exact phrasing from the JD, not synonyms
- Normalize tool names (e.g., "AWS" not "Amazon Web Services (AWS)")
- seniority_level should be one of: IC3, IC4, Senior, Staff, Manager, or similar
- ownership_level should be one of: feature, product, org

Job Description:
${jobDescription}`,
        tools: [STEP1_TOOL],
        toolChoice: { type: "function", function: { name: "extract_jd_signals" } },
      });

      console.log("Step 1 complete:", JSON.stringify({
        mustHave: jdSignals.must_have_skills?.length,
        tools: jdSignals.tools_and_technologies?.length,
        atsKeywords: jdSignals.keywords_for_ats?.length,
      }));

      // Save JD signals + update company/role
      const { error: updateErr1 } = await supabaseClient.from("job_workspaces").update({
        company: jdSignals.company || ws.company || "",
        role_title: jdSignals.job_title || ws.role_title || "",
        jd_analysis: jdSignals,
        status: "analyzing",
      }).eq("id", workspaceId);
      if (updateErr1) {
        console.error("Step 1 DB update failed:", JSON.stringify(updateErr1));
        throw new Error("Failed to save JD signals: " + updateErr1.message);
      }

      // ═══════════════════════════════════════════════════════════════════
      // STEP 2 — Match Scoring (auto-runs after Step 1)
      // ═══════════════════════════════════════════════════════════════════
      if (!resumeText.trim()) {
        // No resume uploaded yet — save signals only
        const { error: sigErr } = await supabaseClient.from("job_workspaces").update({
          status: "signals_ready",
          gap_analysis: { message: "Upload your resume to get a match score" },
        }).eq("id", workspaceId);
        if (sigErr) console.error("Signals-only update failed:", JSON.stringify(sigErr));

        return new Response(JSON.stringify({ success: true, step: "signals_ready" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Step 2: Match Scoring...");
      const matchScore = await callAI({
        apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.0, topP: 0.4,
        system: `You are a deterministic resume-job match scoring engine. Be honest. Do not inflate scores. Return ONLY valid JSON.

Scoring rubric:
- A (80–100): Strong match, minor tweaks only
- B (60–79): Good match, resume needs reframing
- C (40–59): Gap exists, a project addition would close it
- D (<40): Significant mismatch, skip or major pivot needed

If score is D, say so clearly with specific reasons. Do not soften it.
Dealbreakers = must-have skills where zero evidence exists in resume.`,
        user: `Score the user's fit against the JD signals and explain the gaps.

JD Signal JSON:
${JSON.stringify(jdSignals)}

User's Base Resume Text:
${resumeText}`,
        tools: [STEP2_TOOL],
        toolChoice: { type: "function", function: { name: "score_match" } },
      });

      console.log(`Step 2 complete: score=${matchScore.overall_score}, bucket=${matchScore.bucket}`);

      // Determine status based on bucket
      const newStatus = matchScore.bucket === "D" ? "weak_match" : "scored";

      const { error: updateErr2 } = await supabaseClient.from("job_workspaces").update({
        ats_score: matchScore.overall_score || 0,
        baseline_score: matchScore.overall_score || 0,
        match_bucket: matchScore.bucket || "",
        gap_analysis: matchScore,
        status: newStatus,
      }).eq("id", workspaceId);
      if (updateErr2) {
        console.error("Step 2 DB update failed:", JSON.stringify(updateErr2));
        throw new Error("Failed to save match score: " + updateErr2.message);
      }

      return new Response(JSON.stringify({
        success: true,
        step: "scored",
        score: matchScore.overall_score,
        bucket: matchScore.bucket,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3 — Project Suggestions (user-triggered, bucket B & C)
    // ═══════════════════════════════════════════════════════════════════
    if (requestedStep === "projects") {
      const gapAnalysis = ws.gap_analysis as any;
      if (!gapAnalysis?.top_gaps?.length) {
        return new Response(JSON.stringify({ success: true, projects: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Step 3: Project Suggestions...");
      const jdSignals = ws.jd_analysis as any;

      const projectResult = await callAI({
        apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.6, topP: 0.9,
        system: `You are a portfolio project advisor for software engineers. Suggest realistic, completable projects.

Rules:
- Projects must be realistic and completable
- Resume bullets are hypothetical — label them as "Planned / In Progress" until user confirms completion
- Never suggest a project that fabricates past employment or credentials
- Tech stack must match what the JD actually requires
- Suggest 1-3 projects only`,
        user: `Suggest portfolio projects to close these skill gaps.

Top gaps from match scoring:
${JSON.stringify(gapAnalysis.top_gaps)}

Missing must-have skills:
${JSON.stringify(gapAnalysis.must_have_coverage?.missing || [])}

Missing tools:
${JSON.stringify(gapAnalysis.tools_coverage?.missing || [])}

JD signals for context:
${JSON.stringify({
  job_title: jdSignals?.job_title,
  tools_and_technologies: jdSignals?.tools_and_technologies,
  core_responsibilities: jdSignals?.core_responsibilities,
})}`,
        tools: [STEP3_TOOL],
        toolChoice: { type: "function", function: { name: "suggest_projects" } },
      });

      console.log(`Step 3 complete: ${projectResult.projects?.length || 0} projects suggested`);

      const { error: updateErr3 } = await supabaseClient.from("job_workspaces").update({
        suggested_projects: projectResult.projects || [],
      }).eq("id", workspaceId);
      if (updateErr3) {
        console.error("Step 3 DB update failed:", JSON.stringify(updateErr3));
        throw new Error("Failed to save projects: " + updateErr3.message);
      }

      return new Response(JSON.stringify({
        success: true,
        step: "projects",
        projects: projectResult.projects,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4 — Resume Tailoring (user-triggered)
    // ═══════════════════════════════════════════════════════════════════
    if (requestedStep === "tailor") {
      if (!resumeText.trim()) {
        throw { status: 400, message: "No resume text found. Upload your resume on the Resume page, then try again." };
      }
      if (!ws.jd_analysis) {
        throw { status: 400, message: "Run Analysis on this job before tailoring the resume." };
      }


      const jdSignals = ws.jd_analysis as any;
      const gapAnalysis = ws.gap_analysis as any;
      const selectedProjects = (ws.selected_projects as any[]) || [];

      console.log("Step 4: Resume Tailoring...");
      const tailored = await callAI({
        apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.3, topP: 0.85,
        system: `You are a precision resume tailoring engine. You operate under STRICT truth boundaries.

The base resume is canonical truth. You cannot expand it — only reshape it.

HARD RULES:
- Use ONLY facts, roles, dates, employers, skills, tools, and metrics present in the base resume.
- NEVER invent certifications, employers, projects, responsibilities, degrees, or achievements.
- A skill appearing in the JD does NOT mean the candidate has it. Never claim it.
- Preserve original job titles, company names, and employment dates EXACTLY.
- Rewrite a bullet only when the underlying evidence already exists.
- Keep every number/metric identical to the base resume. Never introduce a new number.
- If a JD requirement has no evidence, list it in missing_requirements (a "Gap") — never in the resume body.
- verified_skills = skills literally present in the base resume.
  transferable_skills = adjacent skills the evidence supports indirectly.
  missing_requirements = JD requirements with no evidence.
- low_confidence_bullets = every rewritten bullet whose wording changed substantially (copy the bullet text).
- requirements = EVERY JD requirement classified as "verified" (directly supported — cite a verbatim source snippet as evidence), "transferable" (related but not exact), or "missing" (no evidence). Missing requirements never enter the resume body.
ATS keywords must appear naturally — no keyword stuffing, and only when they accurately describe verified experience.

BULLET REWRITING (XYZ framework): "Accomplished X, measured by Y, by doing Z."
- Strong action verb, the task/problem, the method/tools/scope, and a measurable result ONLY if that metric already exists in the base resume.
- If no metric exists, do NOT invent one — write an accurate scope-based bullet instead,
  e.g. "Built ETL pipelines using Python, Spark, and Airflow to support large-scale data processing."
- Preserve the original bullet verbatim when evidence is insufficient to rewrite it.
- Each bullet object must include: text, original (the source bullet), evidence (a verbatim snippet from the base resume), confidence ("high" near-verbatim, "medium" reframed, "low" heavily reworded).

FORMATTING: ATS-safe only — single column, standard headings, plain text, consistent date formats, no tables, graphics, icons, or text boxes.
Summary must be 3–4 sentences max, role-specific, no generic filler, no new numbers.`,
        user: `Produce a tailored resume draft optimized for this specific role.

Base Resume Text:
${resumeText}

JD Signal JSON:
${JSON.stringify(jdSignals)}

Match Score & Gaps:
${JSON.stringify({
  score: gapAnalysis?.overall_score,
  bucket: gapAnalysis?.bucket,
  top_strengths: gapAnalysis?.top_strengths,
  top_gaps: gapAnalysis?.top_gaps,
  recommendation: gapAnalysis?.recommendation,
})}

User-confirmed projects to include (mark as "In Progress" or "Planned"):
${selectedProjects.length > 0 ? JSON.stringify(selectedProjects) : "None"}

Return the full tailored resume with:
- summary: rewritten for this role (3-4 sentences)
- experience: array of roles with rewritten bullets (only from base resume facts)
- skills: reordered and filtered to match JD keywords (only skills present in base resume)
- verified_skills / transferable_skills / missing_requirements as defined above
- requirements: every JD requirement classified verified/transferable/missing with evidence
- low_confidence_bullets: bullets whose wording changed substantially
- projects: only if user confirmed projects above
- changes_made: list of what was changed and why`,

        tools: [STEP4_TOOL],
        toolChoice: { type: "function", function: { name: "tailor_resume" } },
      });

      console.log(`Step 4 complete: ${tailored.experience?.length || 0} roles, ${tailored.changes_made?.length || 0} changes`);

      // Calculate final score delta
      const baselineScore = ws.baseline_score || ws.ats_score || 0;

      const { error: updateErr4 } = await supabaseClient.from("job_workspaces").update({
        tailored_resume: tailored,
        rewritten_bullets: tailored.experience?.flatMap((e: any) =>
          (e.bullets || []).map((b: any) => ({
            rewritten: typeof b === "string" ? b : b.text,
            original: typeof b === "string" ? "" : b.original || "",
            evidence: typeof b === "string" ? "" : b.evidence || "",
            confidence: typeof b === "string" ? "medium" : b.confidence || "medium",
            company: e.company,
            title: e.title,
          }))
        ) || [],
        status: "ready",
      }).eq("id", workspaceId);
      if (updateErr4) {
        console.error("Step 4 DB update failed:", JSON.stringify(updateErr4));
        throw new Error("Failed to save tailored resume: " + updateErr4.message);
      }

      return new Response(JSON.stringify({
        success: true,
        step: "tailored",
        changes: tailored.changes_made,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown step: ${requestedStep}`);

  } catch (e: any) {
    console.error("analyze-jd error:", e);
    const status = e?.status || 500;
    return new Response(
      JSON.stringify({ error: e?.message || (e instanceof Error ? e.message : "Unknown error") }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
