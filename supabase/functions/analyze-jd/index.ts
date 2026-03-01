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

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

  // Handle tool call responses
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return JSON.parse(toolCall.function.arguments);
  }

  // Handle plain text JSON responses
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(jsonStr);
}

// ─── Tool schemas for structured output ─────────────────────────────

const STAGE1_TOOL = {
  type: "function",
  function: {
    name: "extract_jd_signals",
    description: "Extract hiring signals from a job description.",
    parameters: {
      type: "object",
      properties: {
        company: { type: "string" },
        role_title: { type: "string" },
        mustHaveKeywords: { type: "array", items: { type: "string" } },
        niceToHaveKeywords: { type: "array", items: { type: "string" } },
        exactPhrases: { type: "array", items: { type: "string" } },
        mustIncludePhrases: { type: "array", items: { type: "string" } },
        keywordClusters: {
          type: "object",
          additionalProperties: { type: "array", items: { type: "string" } },
        },
        hiringSignals: { type: "array", items: { type: "string" } },
        senioritySignals: { type: "array", items: { type: "string" } },
      },
      required: ["mustHaveKeywords", "niceToHaveKeywords", "exactPhrases", "mustIncludePhrases", "keywordClusters", "hiringSignals", "senioritySignals", "company", "role_title"],
      additionalProperties: false,
    },
  },
};

const STAGE2_BULLET_TOOL = {
  type: "function",
  function: {
    name: "rewrite_bullet",
    description: "Rewrite a single resume bullet aligned to JD signals.",
    parameters: {
      type: "object",
      properties: {
        original: { type: "string" },
        rewritten: { type: "string" },
        insertedPhrases: { type: "array", items: { type: "string" } },
        matchedKeywords: { type: "array", items: { type: "string" } },
        ownershipVerb: { type: "string" },
        hasMetric: { type: "boolean" },
        suggestedMetricType: { type: "string" },
        metricPrompt: { type: "string" },
        truthfulnessFlags: { type: "array", items: { type: "string" } },
      },
      required: ["original", "rewritten", "insertedPhrases", "matchedKeywords", "ownershipVerb", "hasMetric", "suggestedMetricType", "metricPrompt", "truthfulnessFlags"],
      additionalProperties: false,
    },
  },
};

const STAGE3_METRIC_TOOL = {
  type: "function",
  function: {
    name: "generate_metric_questions",
    description: "Generate metric questions for bullets missing metrics.",
    parameters: {
      type: "object",
      properties: {
        metricQuestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bulletIndex: { type: "number" },
              questions: { type: "array", items: { type: "string" } },
              suggestedMetricFormats: { type: "array", items: { type: "string" } },
              suggestedMetricSources: { type: "array", items: { type: "string" } },
            },
            required: ["bulletIndex", "questions", "suggestedMetricFormats", "suggestedMetricSources"],
            additionalProperties: false,
          },
        },
      },
      required: ["metricQuestions"],
      additionalProperties: false,
    },
  },
};

const STAGE4_SCORE_TOOL = {
  type: "function",
  function: {
    name: "compute_scores",
    description: "Compute baseline and final alignment scores.",
    parameters: {
      type: "object",
      properties: {
        baselineScore: { type: "number" },
        finalScore: { type: "number" },
        delta: { type: "number" },
        breakdown: {
          type: "object",
          properties: {
            keywordCoverage: { type: "object", properties: { before: { type: "number" }, after: { type: "number" } }, required: ["before", "after"], additionalProperties: false },
            phraseCoverage: { type: "object", properties: { before: { type: "number" }, after: { type: "number" } }, required: ["before", "after"], additionalProperties: false },
            ownershipDensity: { type: "object", properties: { before: { type: "number" }, after: { type: "number" } }, required: ["before", "after"], additionalProperties: false },
            metricCoverage: { type: "object", properties: { before: { type: "number" }, after: { type: "number" } }, required: ["before", "after"], additionalProperties: false },
            clarity: { type: "object", properties: { before: { type: "number" }, after: { type: "number" } }, required: ["before", "after"], additionalProperties: false },
          },
          required: ["keywordCoverage", "phraseCoverage", "ownershipDensity", "metricCoverage", "clarity"],
          additionalProperties: false,
        },
        missingAfterRewrite: {
          type: "object",
          properties: {
            phrases: { type: "array", items: { type: "string" } },
            keywords: { type: "array", items: { type: "string" } },
          },
          required: ["phrases", "keywords"],
          additionalProperties: false,
        },
        stuffingWarnings: { type: "array", items: { type: "string" } },
      },
      required: ["baselineScore", "finalScore", "delta", "breakdown", "missingAfterRewrite", "stuffingWarnings"],
      additionalProperties: false,
    },
  },
};

// ─── Phrase assignment logic ────────────────────────────────────────
// Assigns mustIncludePhrases to bullets based on cluster affinity.
// Each phrase can be used at most 2 times across all bullets.

interface BulletWithContext {
  text: string;
  roleContext?: string;
  index: number;
}

function assignPhrasesToBullets(
  phrases: string[],
  clusters: Record<string, string[]>,
  bullets: BulletWithContext[]
): Map<number, string[]> {
  const assignment = new Map<number, string[]>();
  const phraseUsage = new Map<string, number>();

  // Build reverse map: keyword → cluster name
  const keywordToCluster = new Map<string, string>();
  for (const [cluster, keywords] of Object.entries(clusters)) {
    for (const kw of keywords) {
      keywordToCluster.set(kw.toLowerCase(), cluster.toLowerCase());
    }
  }

  // For each phrase, find which cluster it belongs to
  const phraseToCluster = new Map<string, string>();
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    for (const [cluster, keywords] of Object.entries(clusters)) {
      if (keywords.some(kw => phraseLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(phraseLower))) {
        phraseToCluster.set(phrase, cluster.toLowerCase());
        break;
      }
    }
  }

  // Score each bullet for each phrase by cluster match
  for (const phrase of phrases) {
    const phraseCluster = phraseToCluster.get(phrase);

    // Rank bullets by relevance to this phrase
    const scored = bullets.map(b => {
      let score = 0;
      const textLower = b.text.toLowerCase();
      // Direct text overlap
      if (textLower.includes(phrase.toLowerCase().split(" ")[0])) score += 2;
      // Cluster match
      if (phraseCluster) {
        for (const [cluster, keywords] of Object.entries(clusters)) {
          if (cluster.toLowerCase() === phraseCluster) {
            if (keywords.some(kw => textLower.includes(kw.toLowerCase()))) score += 3;
          }
        }
      }
      return { bullet: b, score };
    }).sort((a, b) => b.score - a.score);

    // Assign to best matching bullet(s), max 2 uses per phrase
    for (const { bullet } of scored) {
      const used = phraseUsage.get(phrase) || 0;
      if (used >= 2) break;

      const existing = assignment.get(bullet.index) || [];
      if (existing.length < 2) { // max 2 phrases per bullet too
        assignment.set(bullet.index, [...existing, phrase]);
        phraseUsage.set(phrase, used + 1);
      }
    }
  }

  return assignment;
}

// ─── Extract bullets from resume text ───────────────────────────────

function extractBullets(resumeText: string): BulletWithContext[] {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(l => l.length > 10);
  const bullets: BulletWithContext[] = [];
  let currentRole = "";

  for (const line of lines) {
    // Heuristic: lines starting with bullet chars or that look like achievements
    if (/^[-•▪◦*]/.test(line) || /^(Led|Built|Designed|Developed|Managed|Created|Implemented|Optimized|Drove|Launched|Reduced|Increased|Improved|Architected|Delivered|Spearheaded|Orchestrated)/i.test(line)) {
      const clean = line.replace(/^[-•▪◦*]\s*/, "").trim();
      if (clean.length > 15) {
        bullets.push({ text: clean, roleContext: currentRole, index: bullets.length });
      }
    } else if (line.length < 80 && !line.startsWith("-")) {
      // Could be a role/company header
      currentRole = line;
    }
  }

  return bullets;
}

// ─── Truthfulness filter ────────────────────────────────────────────
// Checks if rewrite introduced numbers/tools not in original context

function checkTruthfulness(original: string, rewritten: string, flags: string[]): string[] {
  const newFlags = [...flags];

  // Extract numbers from rewritten that aren't in original
  const origNumbers = new Set(original.match(/\d+[\d,.]*/g) || []);
  const rewriteNumbers = rewritten.match(/\d+[\d,.]*/g) || [];
  for (const num of rewriteNumbers) {
    if (!origNumbers.has(num) && !rewritten.includes("[METRIC NEEDED]")) {
      // Allow if it's a reasonable small number (like "3 microservices")
      const n = parseFloat(num.replace(/,/g, ""));
      if (n > 10 && !newFlags.includes("FABRICATED_NUMBER")) {
        newFlags.push("FABRICATED_NUMBER");
      }
    }
  }

  // Check for common tool names introduced that aren't in original
  const commonTools = ["kubernetes", "terraform", "docker", "kafka", "redis", "graphql", "mongodb", "postgresql", "dynamodb", "elasticsearch"];
  const origLower = original.toLowerCase();
  const rewriteLower = rewritten.toLowerCase();
  for (const tool of commonTools) {
    if (rewriteLower.includes(tool) && !origLower.includes(tool)) {
      if (!newFlags.includes("FABRICATED_TOOL")) {
        newFlags.push("FABRICATED_TOOL");
      }
    }
  }

  return newFlags;
}

// ─── Main handler ───────────────────────────────────────────────────

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

    // ═══════════════════════════════════════════════════════════════════
    // PIPELINE 1 — JD Signal Mining (exact phrases + clusters)
    // Temp: 0.0 | top_p: 0.4
    // ═══════════════════════════════════════════════════════════════════
    console.log("Pipeline 1: JD Signal Mining...");
    const jdSignals = await callAI({
      apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.0, topP: 0.4,
      system: `You are a hiring manager signal extractor. Return ONLY valid JSON. No prose. Do not hallucinate.`,
      user: `Extract hiring signals from this Job Description.

Rules:
- Extract exact phrases verbatim from the JD (2–6 words each). No paraphrasing.
- Prefer phrases from Role Overview and Responsibilities.
- Provide mustIncludePhrases (8–12) that are the highest-signal phrases to mirror in a resume, if truthful.
- Extract keywords and group them into keywordClusters (themes).
- Normalize keywords (e.g., "AWS" not "Amazon Web Services (AWS)").
- Also extract company name and role_title from the JD.

Job Description:
${jobDescription}`,
      tools: [STAGE1_TOOL],
      toolChoice: { type: "function", function: { name: "extract_jd_signals" } },
    });
    console.log("Pipeline 1 complete:", JSON.stringify({
      mustHave: jdSignals.mustHaveKeywords?.length,
      phrases: jdSignals.mustIncludePhrases?.length,
      clusters: Object.keys(jdSignals.keywordClusters || {}).length,
    }));

    // Save intermediate: JD signals + status
    await supabaseClient.from("job_workspaces").update({
      company: jdSignals.company || ws.company || "",
      role_title: jdSignals.role_title || ws.role_title || "",
      jd_analysis: {
        mustHaveKeywords: jdSignals.mustHaveKeywords || [],
        niceToHaveKeywords: jdSignals.niceToHaveKeywords || [],
        exactPhrases: jdSignals.exactPhrases || [],
        mustIncludePhrases: jdSignals.mustIncludePhrases || [],
        keywordClusters: jdSignals.keywordClusters || {},
        hiringSignals: jdSignals.hiringSignals || [],
        senioritySignals: jdSignals.senioritySignals || [],
      },
      status: "analyzing",
    }).eq("id", workspaceId);

    // ═══════════════════════════════════════════════════════════════════
    // PIPELINE 2 — Bullet Rewrite (phrase-aware, per bullet)
    // Temp: 0.3 | top_p: 0.85
    // ═══════════════════════════════════════════════════════════════════
    console.log("Pipeline 2: Bullet Rewrite...");
    const bullets = extractBullets(resumeText);
    console.log(`Extracted ${bullets.length} bullets from resume`);

    // Pre-assign phrases to bullets by cluster affinity
    const phraseAssignments = assignPhrasesToBullets(
      jdSignals.mustIncludePhrases || [],
      jdSignals.keywordClusters || {},
      bullets
    );

    const rewrittenBullets: any[] = [];

    // Rewrite each bullet individually
    for (const bullet of bullets) {
      const assignedPhrases = phraseAssignments.get(bullet.index) || [];
      const jdSignalsForBullet = {
        ...jdSignals,
        mustIncludePhrases: assignedPhrases, // scoped to this bullet
      };

      try {
        const result = await callAI({
          apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.3, topP: 0.85,
          system: `You are a precision resume bullet rewriting engine. You MUST preserve factual accuracy.
Never invent numbers, team size, scope, tools, or outcomes that are not explicitly supported by the original bullet or provided context.
Return ONLY valid JSON.`,
          user: `Rewrite ONE resume bullet to align to the JD signals, using exact JD phrases safely.

Inputs:
Original bullet:
${bullet.text}

Role context (if provided):
${bullet.roleContext || "Not provided"}

JD signals:
${JSON.stringify(jdSignalsForBullet)}

Rules:
- Output must follow WHAT → HOW → WHO → IMPACT.
- Insert exactly 1 JD phrase verbatim from jdSignals.mustIncludePhrases if it fits truthfully.
- If none fit truthfully, insert 0 phrases and set truthfulnessFlags=["NO_PHRASE_FIT"].
- Also incorporate relevant keywords naturally (do not keyword-stuff, do not copy full JD sentences).
- Sentence count: Prefer 1 sentence. Use 2 sentences only if it makes the bullet significantly clearer and more truthful.
- Metrics: If the original bullet includes a metric, preserve it. If missing, include "[METRIC NEEDED]" and set hasMetric=false.
- Provide a specific metricPrompt question that a user can answer.
- Never add specific numbers (team size, counts, %, $) unless present in the original bullet or role context.`,
          tools: [STAGE2_BULLET_TOOL],
          toolChoice: { type: "function", function: { name: "rewrite_bullet" } },
        });

        // Truthfulness filter: check for fabricated content
        const flags = checkTruthfulness(bullet.text, result.rewritten, result.truthfulnessFlags || []);

        if (flags.includes("FABRICATED_NUMBER") || flags.includes("FABRICATED_TOOL")) {
          console.log(`Truthfulness issue on bullet ${bullet.index}, re-running with stricter prompt...`);
          // Re-run with stricter instruction
          const strictResult = await callAI({
            apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.1, topP: 0.5,
            system: `You are a precision resume bullet rewriting engine. STRICT MODE.
ABSOLUTELY DO NOT add any numbers, percentages, dollar amounts, team sizes, tool names, or technologies that are not EXPLICITLY present in the original bullet.
If the original says nothing about a tool, do NOT mention it.
If the original has no metric, use [METRIC NEEDED] — never fabricate.
Return ONLY valid JSON.`,
            user: `Rewrite ONE resume bullet. STRICT: preserve only facts from the original.

Original bullet:
${bullet.text}

Role context:
${bullet.roleContext || "Not provided"}

JD signals (use for keyword alignment ONLY, not for inventing facts):
${JSON.stringify(jdSignalsForBullet)}

Previous attempt had these issues: ${flags.join(", ")}
Fix them.`,
            tools: [STAGE2_BULLET_TOOL],
            toolChoice: { type: "function", function: { name: "rewrite_bullet" } },
          });
          strictResult.truthfulnessFlags = checkTruthfulness(bullet.text, strictResult.rewritten, strictResult.truthfulnessFlags || []);
          rewrittenBullets.push(strictResult);
        } else {
          result.truthfulnessFlags = flags;
          rewrittenBullets.push(result);
        }
      } catch (e) {
        console.error(`Failed to rewrite bullet ${bullet.index}:`, e);
        // Keep original if rewrite fails
        rewrittenBullets.push({
          original: bullet.text,
          rewritten: bullet.text,
          insertedPhrases: [],
          matchedKeywords: [],
          ownershipVerb: "",
          hasMetric: false,
          suggestedMetricType: "",
          metricPrompt: "",
          truthfulnessFlags: ["REWRITE_FAILED"],
        });
      }
    }
    console.log(`Pipeline 2 complete: ${rewrittenBullets.length} bullets rewritten`);

    // ═══════════════════════════════════════════════════════════════════
    // PIPELINE 3 — Metric Recovery (hard gate questions)
    // Temp: 0.25 | top_p: 0.8
    // ═══════════════════════════════════════════════════════════════════
    console.log("Pipeline 3: Metric Recovery...");
    const bulletsNeedingMetrics = rewrittenBullets.filter(b => !b.hasMetric);

    let metricQuestions: any[] = [];
    if (bulletsNeedingMetrics.length > 0) {
      const metricResult = await callAI({
        apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.25, topP: 0.8,
        system: `You are a metrics assistant for resumes. Do not fabricate numbers. Return ONLY valid JSON.`,
        user: `Generate metric questions for bullets missing metrics.

You will receive rewritten bullets where some contain "[METRIC NEEDED]".
For each bullet with hasMetric=false:
- Generate 2–4 high-quality questions that help the user recall real metrics.
- Suggest 2–3 metric formats (%, time saved, $, volume, error rate, conversion).
- Keep questions specific to the bullet content.

Input JSON:
${JSON.stringify(rewrittenBullets.map((b, i) => ({ index: i, ...b })))}`,
        tools: [STAGE3_METRIC_TOOL],
        toolChoice: { type: "function", function: { name: "generate_metric_questions" } },
      });
      metricQuestions = metricResult.metricQuestions || [];
    }
    console.log(`Pipeline 3 complete: ${metricQuestions.length} bullets need metrics`);

    // Merge metric questions back into bullets
    for (const mq of metricQuestions) {
      if (rewrittenBullets[mq.bulletIndex]) {
        rewrittenBullets[mq.bulletIndex].metricQuestions = mq.questions;
        rewrittenBullets[mq.bulletIndex].suggestedMetricFormats = mq.suggestedMetricFormats;
        rewrittenBullets[mq.bulletIndex].suggestedMetricSources = mq.suggestedMetricSources;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PIPELINE 4 — Final Score + Delta (baseline + post)
    // Temp: 0.0 | top_p: 0.3
    // ═══════════════════════════════════════════════════════════════════
    console.log("Pipeline 4: Scoring...");
    const baselineBullets = rewrittenBullets.map(b => b.original);
    const finalBullets = rewrittenBullets.map(b => b.rewritten);

    const scores = await callAI({
      apiKey: LOVABLE_API_KEY, model: MODEL, temperature: 0.0, topP: 0.3,
      system: `You are a deterministic scoring engine. Return ONLY valid JSON. No prose. No randomness.`,
      user: `Compute baseline and final alignment scores against the JD signals.

You will score:
A) Baseline resume bullets (original)
B) Final resume bullets (rewritten)

Scoring dimensions:
- keywordCoverage (0–1)
- phraseCoverage (0–1) based on mustIncludePhrases present verbatim
- ownershipDensity (0–1): strong ownership verbs + clear scope
- metricCoverage (0–1): bullets with real metrics (not [METRIC NEEDED])
- clarity (0–1): specificity, no fluff, readable

Rules:
- Penalize keyword stuffing and awkward phrase insertion (add stuffingWarnings).
- Phrase coverage counts only if phrase appears verbatim.
- Output scores must be stable across runs.
- baselineScore and finalScore should be 0–100 integers.

Inputs:
JD signals:
${JSON.stringify(jdSignals)}

Baseline bullets:
${JSON.stringify(baselineBullets)}

Final bullets:
${JSON.stringify(finalBullets)}`,
      tools: [STAGE4_SCORE_TOOL],
      toolChoice: { type: "function", function: { name: "compute_scores" } },
    });
    console.log(`Pipeline 4 complete: baseline=${scores.baselineScore}, final=${scores.finalScore}, delta=${scores.delta}`);

    // ═══════════════════════════════════════════════════════════════════
    // Final DB update
    // ═══════════════════════════════════════════════════════════════════
    const { error: updateErr } = await supabaseClient
      .from("job_workspaces")
      .update({
        ats_score: scores.finalScore || 0,
        baseline_score: scores.baselineScore || 0,
        score_delta: scores.delta || 0,
        gap_analysis: {
          breakdown: scores.breakdown || {},
          missingAfterRewrite: scores.missingAfterRewrite || { phrases: [], keywords: [] },
          stuffingWarnings: scores.stuffingWarnings || [],
          metricQuestions: metricQuestions,
        },
        rewritten_bullets: rewrittenBullets,
        suggested_projects: [], // projects separated out in future
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
