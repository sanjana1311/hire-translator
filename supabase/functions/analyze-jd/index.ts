import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, model: string, temperature: number, system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const status = res.status;
    const errText = await res.text();
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits to continue." };
    console.error("AI gateway error:", status, errText);
    throw new Error("AI call failed");
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(jsonStr);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { workspaceId } = await req.json();
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
    if (!jobDescription.trim()) throw new Error("No job description to analyze");

    const MODEL = "google/gemini-2.5-flash";

    // ═══════════════════════════════════════════════════
    // STAGE 1: Parse JD — Extract keywords, clusters, hiring signals
    // Temperature: 0.0 (deterministic extraction)
    // ═══════════════════════════════════════════════════
    console.log("Stage 1: Parsing JD...");
    const stage1 = await callAI(LOVABLE_API_KEY, MODEL, 0.0,
      `You are an expert ATS analyst. Extract structured data from a job description. Return ONLY valid JSON:
{
  "company": "extracted company name or empty string",
  "role_title": "extracted role title or empty string",
  "keywords": ["all important technical and domain keywords"],
  "clusters": ["keyword cluster themes like 'project management', 'AI/ML', 'cloud infrastructure'"],
  "hiringSignals": ["specific signals about what the hiring team values, e.g. 'values cross-functional leadership', 'needs hands-on IC work'"],
  "requirements": ["hard requirements and qualifications listed"]
}
Extract exhaustively. Do not summarize or omit keywords.`,
      `## Job Description:\n${jobDescription}`
    );
    console.log("Stage 1 complete:", JSON.stringify({ keywords: stage1.keywords?.length, clusters: stage1.clusters?.length }));

    // ═══════════════════════════════════════════════════
    // STAGE 2: Score Current Resume (Baseline)
    // Temperature: 0.0 (pure logic, no variation)
    // ═══════════════════════════════════════════════════
    console.log("Stage 2: Baseline scoring...");
    const stage2 = await callAI(LOVABLE_API_KEY, MODEL, 0.0,
      `You are an ATS scoring engine. Score a resume against extracted JD requirements. Return ONLY valid JSON:
{
  "baselineScore": 0-100 integer,
  "gapAnalysis": {
    "matchedKeywords": ["keywords found in resume"],
    "missingKeywords": ["important keywords NOT in resume"],
    "strongAreas": ["areas where resume is strong"],
    "weakAreas": ["areas needing improvement"],
    "missingClusters": ["keyword cluster themes the resume lacks"]
  }
}

Scoring weights:
- Keyword match percentage (40%)
- Skills alignment (30%)
- Experience relevance (30%)

Be strict and objective. A perfect keyword match alone should not yield >70 without skills and experience alignment.`,
      `## JD Keywords:\n${JSON.stringify(stage1.keywords)}\n\n## JD Clusters:\n${JSON.stringify(stage1.clusters)}\n\n## JD Requirements:\n${JSON.stringify(stage1.requirements)}\n\n## Candidate Resume:\n${resumeText}`
    );
    console.log("Stage 2 complete: baseline =", stage2.baselineScore);

    // Save intermediate results (baseline + gap analysis)
    await supabaseClient.from("job_workspaces").update({
      company: stage1.company || ws.company || "",
      role_title: stage1.role_title || ws.role_title || "",
      baseline_score: stage2.baselineScore || 0,
      gap_analysis: stage2.gapAnalysis || {},
      jd_analysis: {
        keywords: stage1.keywords || [],
        missingKeywords: stage2.gapAnalysis?.missingKeywords || [],
        clusters: stage1.clusters || [],
        hiringSignals: stage1.hiringSignals || [],
        requirements: stage1.requirements || [],
      },
      status: "analyzing",
    }).eq("id", workspaceId);

    // ═══════════════════════════════════════════════════
    // STAGE 3: Rewrite Bullets
    // Temperature: 0.3 (controlled clarity)
    // ═══════════════════════════════════════════════════
    console.log("Stage 3: Rewriting bullets...");
    const stage3 = await callAI(LOVABLE_API_KEY, MODEL, 0.3,
      `You are an expert resume writer. Rewrite resume bullets to close gaps identified in the gap analysis. Return ONLY valid JSON:
{
  "rewrittenBullets": [
    {
      "original": "original bullet from resume",
      "rewritten": "rewritten in WHAT-HOW-WHO-IMPACT format using JD keywords. If no metric exists, include [METRIC NEEDED] placeholder",
      "keywords": ["jd keywords naturally incorporated"],
      "hasMetric": true/false,
      "suggestedMetricType": "percent|time|cost|revenue|volume|adoption",
      "metricPrompt": "A specific question asking the user for the exact number"
    }
  ],
  "suggestedProjects": [
    {
      "title": "project title addressing a gap",
      "bullets": ["2-3 bullet descriptions"],
      "signal": "which hiring signal or gap this addresses"
    }
  ]
}

Rules for bullet rewrites:
- Follow WHAT→HOW→WHO→IMPACT format strictly
- Naturally incorporate relevant JD keywords — do NOT copy-paste JD phrases verbatim
- Keep the candidate's original voice and context
- Every bullet MUST have a measurable metric. If the original has one, keep it. If not, add [METRIC NEEDED]
- Do NOT add filler phrases — every word must convey specific, concrete information
- Rewrite ALL experience bullets from the resume
- Focus especially on closing the gaps identified in the gap analysis

Rules for project suggestions:
- Suggest 2-3 projects addressing missing clusters and weak areas
- Each project should address a specific hiring signal or gap
- Make projects realistic for the candidate's experience level`,
      `## Gap Analysis:\n${JSON.stringify(stage2.gapAnalysis)}\n\n## JD Keywords:\n${JSON.stringify(stage1.keywords)}\n\n## Hiring Signals:\n${JSON.stringify(stage1.hiringSignals)}\n\n## Candidate Resume:\n${resumeText}`
    );
    console.log("Stage 3 complete:", JSON.stringify({ bullets: stage3.rewrittenBullets?.length, projects: stage3.suggestedProjects?.length }));

    // ═══════════════════════════════════════════════════
    // STAGE 4: Re-Score Updated Resume
    // Temperature: 0.0 (pure logic, no variation)
    // ═══════════════════════════════════════════════════
    console.log("Stage 4: Re-scoring after rewrite...");
    const rewrittenText = stage3.rewrittenBullets?.map((b: any) => b.rewritten).join("\n") || "";
    const stage4 = await callAI(LOVABLE_API_KEY, MODEL, 0.0,
      `You are an ATS scoring engine. Score an UPDATED resume against JD requirements. Return ONLY valid JSON:
{
  "newScore": 0-100 integer,
  "improvementBreakdown": {
    "keywordMatchDelta": "+X points from keyword improvements",
    "skillsAlignmentDelta": "+X points from skills alignment improvements",
    "experienceRelevanceDelta": "+X points from experience relevance improvements"
  }
}

Scoring weights (same as baseline):
- Keyword match percentage (40%)
- Skills alignment (30%)
- Experience relevance (30%)

Be consistent with baseline scoring methodology. The score should reflect genuine improvement from the rewrites.`,
      `## JD Keywords:\n${JSON.stringify(stage1.keywords)}\n\n## JD Clusters:\n${JSON.stringify(stage1.clusters)}\n\n## JD Requirements:\n${JSON.stringify(stage1.requirements)}\n\n## Original Resume:\n${resumeText}\n\n## Rewritten Bullets:\n${rewrittenText}`
    );
    console.log("Stage 4 complete: newScore =", stage4.newScore, "baseline =", stage2.baselineScore);

    // Final update with all results
    const newScore = stage4.newScore || 0;
    const baselineScore = stage2.baselineScore || 0;
    const { error: updateErr } = await supabaseClient
      .from("job_workspaces")
      .update({
        ats_score: newScore,
        baseline_score: baselineScore,
        score_delta: newScore - baselineScore,
        gap_analysis: {
          ...stage2.gapAnalysis,
          improvementBreakdown: stage4.improvementBreakdown || {},
        },
        rewritten_bullets: stage3.rewrittenBullets || [],
        suggested_projects: stage3.suggestedProjects || [],
        status: "ready",
      })
      .eq("id", workspaceId);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error("Failed to save analysis");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-jd error:", e);
    const status = e?.status || 500;
    return new Response(
      JSON.stringify({ error: e?.message || (e instanceof Error ? e.message : "Unknown error") }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
