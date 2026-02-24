import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { workspaceId } = await req.json();
    if (!workspaceId) throw new Error("workspaceId required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user owns workspace
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get workspace
    const { data: ws, error: wsErr } = await supabaseClient
      .from("job_workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();
    if (wsErr || !ws) throw new Error("Workspace not found");

    // Verify ownership via profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", ws.profile_id)
      .single();
    if (!profile) throw new Error("Not authorized");

    // Get resume
    const { data: resume } = await supabaseClient
      .from("resumes")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const resumeText = resume?.raw_text || "";
    const jobDescription = ws.job_description || "";

    if (!jobDescription.trim()) throw new Error("No job description to analyze");

    // Call AI to analyze JD against resume
    const systemPrompt = `You are an expert ATS resume analyst and career coach. You will analyze a job description against a candidate's resume and return structured JSON.

IMPORTANT: You MUST respond with ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{
  "company": "extracted company name or empty string",
  "role_title": "extracted role title or empty string",
  "keywords": ["matched keywords found in both JD and resume"],
  "missingKeywords": ["important JD keywords NOT in resume"],
  "clusters": ["keyword cluster themes like 'project management', 'AI/ML'"],
  "hiringSignals": ["specific signals about what the hiring team values"],
  "atsScore": 0-100 integer,
  "rewrittenBullets": [
    {
      "original": "original bullet from resume",
      "rewritten": "rewritten in WHAT-HOW-WHO-IMPACT format using JD keywords. If no metric exists, include [METRIC NEEDED] placeholder",
      "keywords": ["jd keywords used in rewrite"],
      "hasMetric": true/false,
      "suggestedMetricType": "percent|time|cost|revenue|volume|adoption - suggest the MOST appropriate metric type for this bullet based on what was done",
      "metricPrompt": "A specific, friendly question asking the user for the exact number, e.g. 'By what % did automation coverage improve?' or 'How many users adopted the platform?'"
    }
  ],
  "suggestedProjects": [
    {
      "title": "project title relevant to JD signals",
      "bullets": ["2-3 bullet descriptions"],
      "signal": "which JD hiring signal this addresses"
    }
  ]
}

Rules for bullet rewrites:
- Follow WHAT→HOW→WHO→IMPACT format strictly
- Use exact keywords and phrases from the JD
- Every bullet MUST have a measurable metric. If the original has one, keep it. If not, add [METRIC NEEDED]
- Rewrite ALL experience bullets from the resume

Rules for project suggestions:
- Suggest 2-3 projects that would strengthen the candidate for THIS specific role
- Each project should address a specific hiring signal from the JD
- Make projects realistic and relevant to the candidate's experience level

ATS Score calculation:
- Keyword match percentage (40% weight)
- Skills alignment (30% weight)  
- Experience relevance (30% weight)`;

    const userPrompt = `## Job Description:\n${jobDescription}\n\n## Candidate Resume:\n${resumeText}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse AI analysis");
    }

    // Update workspace with analysis results
    const { error: updateErr } = await supabaseClient
      .from("job_workspaces")
      .update({
        company: parsed.company || ws.company || "",
        role_title: parsed.role_title || ws.role_title || "",
        jd_analysis: {
          keywords: parsed.keywords || [],
          missingKeywords: parsed.missingKeywords || [],
          clusters: parsed.clusters || [],
          hiringSignals: parsed.hiringSignals || [],
        },
        ats_score: parsed.atsScore || 0,
        rewritten_bullets: parsed.rewrittenBullets || [],
        suggested_projects: parsed.suggestedProjects || [],
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
  } catch (e) {
    console.error("analyze-jd error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
