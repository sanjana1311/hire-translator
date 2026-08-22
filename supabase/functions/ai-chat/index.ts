import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 10;
const FUNCTION_NAME = "ai-chat";

// Set when OpenCode Go rejects us (bad key / no credits) so later calls skip it.
let opencodeDisabled = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redact(value: string) {
  return value
    .replace(/(bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/("?(?:api[_-]?key|token|authorization)"?\s*:\s*")[^"]+/gi, "$1[REDACTED]")
    .slice(0, 1200);
}

function failure(requestId: string, message: string, status: number, code = "RESUME_REWRITE_FAILED") {
  console.log(JSON.stringify({ requestId, function: FUNCTION_NAME, stage: "final", finalStatus: status, code }));
  return json({ ok: false, code, message, requestId }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const deployment = Deno.env.get("DENO_DEPLOYMENT_ID") || "unknown";
  console.log(JSON.stringify({ requestId, function: FUNCTION_NAME, deployment, stage: "started" }));

  try {
    // Diagnostic probe: checks provider reachability only. No user data, no secrets returned.
    const diagToken = Deno.env.get("AI_DIAG_TOKEN");
    const diagTokenV2 = Deno.env.get("AI_DIAG_TOKEN_V2");
    const sentDiag = req.headers.get("x-diag-token");
    if (sentDiag && ((diagToken && sentDiag === diagToken) || (diagTokenV2 && sentDiag === diagTokenV2))) {
      const results: Record<string, unknown> = {};

      const oc = Deno.env.get("OPENCODE_API_KEY") || Deno.env.get("OPENCODE_GO_API_KEY");
      const ocBase = Deno.env.get("OPENCODE_BASE_URL") || "https://opencode.ai/zen/v1";
      // Optional: probe a list of candidate models via header, e.g. "grok-build-0.1,glm-5.2"
      const probeModels = (req.headers.get("x-diag-models") || Deno.env.get("OPENCODE_MODEL") || "grok-4.5")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      const ocResults: unknown[] = [];
      if (oc) {
        for (const m of probeModels) {
          try {
            const r = await fetch(`${ocBase}/chat/completions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${oc}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
            });
            const body = await r.text();
            ocResults.push({ model: m, status: r.status, body: body.slice(0, 200) });
          } catch (e) {
            ocResults.push({ model: m, error: String(e).slice(0, 200) });
          }
        }
      }
      results.opencode = { configured: !!oc, baseUrl: ocBase, probes: ocResults };


      const lk = Deno.env.get("LOVABLE_API_KEY");
      results.lovable = { configured: !!lk };
      if (lk) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Lovable-API-Key": lk, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-3.6-flash", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
          });
          const body = await r.text();
          results.lovable = { configured: true, status: r.status, body: body.slice(0, 300) };
        } catch (e) {
          results.lovable = { configured: true, error: String(e).slice(0, 200) };
        }
      }

      const gq = Deno.env.get("GROQ_API_KEY");
      results.groq = { configured: !!gq };
      if (gq) {
        try {
          const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${gq}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
          });
          const body = await r.text();
          results.groq = { configured: true, status: r.status, body: body.slice(0, 300) };
        } catch (e) {
          results.groq = { configured: true, error: String(e).slice(0, 200) };
        }
      }

      return json({ diagnostic: true, providers: results });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return failure(requestId, "Please sign in and try again.", 401, "NOT_AUTHENTICATED");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error(JSON.stringify({ requestId, stage: "environment", supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey }));
      return failure(requestId, "The resume service is not configured. Please contact support.", 500, "BACKEND_NOT_CONFIGURED");
    }
    const anonClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return failure(requestId, "Your session expired. Please sign in again.", 401, "NOT_AUTHENTICATED");
    console.log(JSON.stringify({ requestId, stage: "authenticated", userId: user.id }));

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return failure(requestId, "The resume request was not valid JSON.", 400, "INVALID_REQUEST");
    }
    const { prompt, maxTokens, feature, context } = payload;
    if (!prompt || typeof prompt !== "string") return failure(requestId, "The resume rewrite prompt is missing.", 400, "INVALID_REQUEST");
    const feat = feature || "general";
    const isResumeRewrite = feat === "resume-rewrite";
    console.log(JSON.stringify({
      requestId,
      stage: "request_validation",
      valid: true,
      feature: feat,
      jobId: context?.jobId || null,
      resumeId: context?.resumeId || null,
      resumeTextLength: context?.resumeTextLength || 0,
      jobDescriptionLength: context?.jobDescriptionLength || 0,
    }));

    // Rate limit: 10 AI calls per day per user per feature
    const adminClient = createClient(supabaseUrl, serviceKey);
    if (isResumeRewrite) {
      const { data: profile } = await adminClient.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
      const { data: resume } = profile
        ? await adminClient.from("resumes").select("id,raw_text").eq("profile_id", profile.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
        : { data: null };
      const resumeLength = resume?.raw_text?.length || 0;
      const { data: job } = profile && context?.jobId
        ? await adminClient.from("imported_jobs").select("id,description,snippet").eq("id", context.jobId).eq("profile_id", profile.id).maybeSingle()
        : { data: null };
      console.log(JSON.stringify({ requestId, stage: "records", jobId: context?.jobId || null, jobFound: !!job, resumeFound: !!resume, resumeTextLength: resumeLength }));
      if (!resume || resumeLength === 0) return failure(requestId, "No resume text was found. Upload your resume again, then retry.", 422, "RESUME_TEXT_MISSING");
      if (!job) return failure(requestId, "The selected job could not be found for your account.", 404, "JOB_NOT_FOUND");
      if (!context?.resumeTextLength || !context?.jobDescriptionLength) return failure(requestId, "The job description or resume text was missing from the request.", 400, "INVALID_REQUEST");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count, error: countErr } = await adminClient
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("feature", feat)
      .gte("used_at", today.toISOString());
    if (countErr) console.error("Usage count error:", countErr);
    if ((count ?? 0) >= DAILY_LIMIT) {
      console.warn(JSON.stringify({ requestId, stage: "quota", feature: feat, used: count, limit: DAILY_LIMIT }));
      return failure(requestId, `Daily AI limit reached for ${feat} (${DAILY_LIMIT}/day). Try again tomorrow.`, 429, "AI_DAILY_LIMIT_REACHED");
    }

    const temperature = feat === "roles" ? 0.7 : 0.3;
    const messages = [{ role: "user", content: prompt }];
    // Gemini/GLM reasoning tokens are billed against max_tokens, so a 4k budget
    // can be consumed by thinking and return a JSON body that stops mid-string.
    // Resume rewrites get a much larger floor plus reasoning turned down.
    const requestedTokens = maxTokens || 1000;
    const maxOutputTokens = isResumeRewrite
      ? Math.min(16000, Math.max(requestedTokens, 8000))
      : requestedTokens;
    let text = "";
    let truncated = false;

    /** OpenAI-compatible finish_reason === "length" means the reply was cut off. */
    const wasTruncated = (data: any) => {
      const reason = data?.choices?.[0]?.finish_reason;
      return reason === "length" || reason === "MAX_TOKENS";
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const OPENCODE_API_KEY = Deno.env.get("OPENCODE_API_KEY") || Deno.env.get("OPENCODE_GO_API_KEY");
    const OPENCODE_BASE_URL = Deno.env.get("OPENCODE_BASE_URL") || "https://opencode.ai/zen/go/v1";
    // OPENCODE_MODEL_V2 wins: the Go router only serves a subset of Zen models.
    const OPENCODE_MODEL = Deno.env.get("OPENCODE_MODEL_V2") || Deno.env.get("OPENCODE_MODEL") || "glm-5.2";

    // Primary provider: OpenCode Go (OpenAI-compatible).
    // Skipped for the rest of this instance's life once it returns 401/402/403
    // (bad key or no balance) so we don't pay the latency on every call.
    if (OPENCODE_API_KEY && !opencodeDisabled) {
      try {
        console.log(JSON.stringify({ requestId, stage: "provider_request", provider: "opencode", model: OPENCODE_MODEL }));
        const res = await fetch(`${OPENCODE_BASE_URL}/chat/completions`, {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${OPENCODE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: OPENCODE_MODEL,
            temperature,
            max_tokens: maxOutputTokens,
            ...(isResumeRewrite ? { reasoning_effort: "low" } : {}),
            messages,
          }),
        });
        if (res.ok) {
          const responseBody = await res.text();
          console.log(JSON.stringify({ requestId, stage: "provider_response", provider: "opencode", model: OPENCODE_MODEL, status: res.status, body: redact(responseBody) }));
          const data = JSON.parse(responseBody);
          const candidate = data.choices?.[0]?.message?.content || "";
          if (candidate && wasTruncated(data)) {
            // Don't hand the client half a JSON object — let the next provider try.
            console.warn(JSON.stringify({ requestId, stage: "truncated", provider: "opencode", chars: candidate.length }));
            truncated = true;
          } else {
            text = candidate;
          }
        } else {
          const body = await res.text();
          console.error(JSON.stringify({ requestId, stage: "provider_response", provider: "opencode", model: OPENCODE_MODEL, status: res.status, body: redact(body) }));
          if ([401, 402, 403].includes(res.status)) {
            opencodeDisabled = true;
            console.error("OpenCode Go disabled for this instance (auth/credits). Using fallbacks.");
          }
        }
      } catch (e) {
        console.error("OpenCode Go request failed:", e);
      }
    }


    // Fallback 1: Lovable AI
    if (!text && LOVABLE_API_KEY) try {
      const lovableModel = "google/gemini-3.6-flash";
      console.log(JSON.stringify({ requestId, stage: "provider_request", provider: "lovable", model: lovableModel }));
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: {
          "Lovable-API-Key": LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: lovableModel,
          temperature,
          max_tokens: maxOutputTokens,
          ...(isResumeRewrite ? { reasoning_effort: "low" } : {}),
          messages,
        }),
      });

      const responseBody = await res.text();
      console.log(JSON.stringify({ requestId, stage: "provider_response", provider: "lovable", model: lovableModel, status: res.status, body: redact(responseBody) }));
      if (res.status === 429) console.error("Lovable AI rate limited");
      else if (res.status === 402) console.error("Lovable AI credits exhausted");
      else if (res.ok) {
        const data = JSON.parse(responseBody);
        const candidate = data.choices?.[0]?.message?.content || "";
        if (candidate && wasTruncated(data)) {
          console.warn(JSON.stringify({ requestId, stage: "truncated", provider: "lovable", chars: candidate.length }));
          truncated = true;
        } else {
          text = candidate;
        }
      } else {
        console.error("AI gateway error:", res.status);
      }
    } catch (e) {
      console.error(JSON.stringify({ requestId, stage: "provider_error", provider: "lovable", error: String(e).slice(0, 200) }));
    }

    // Fallback 2: Groq
    if (!text && GROQ_API_KEY) try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature,
          top_p: 0.9,
          max_tokens: maxOutputTokens,
          messages,
        }),
      });
      if (!res.ok) {
        console.error("Groq API error:", res.status, await res.text());
      } else {
        const data = await res.json();
        const candidate = data.choices?.[0]?.message?.content || "";
        if (candidate && wasTruncated(data)) {
          console.warn(JSON.stringify({ requestId, stage: "truncated", provider: "groq", chars: candidate.length }));
          truncated = true;
        } else {
          text = candidate;
        }
      }
    } catch (e) {
      console.error(JSON.stringify({ requestId, stage: "provider_error", provider: "groq", error: String(e).slice(0, 200) }));
    }

    if (!text && truncated) {
      return failure(
        requestId,
        "The tailored resume came back cut off mid-way. Retry — we'll ask for a shorter version.",
        503,
        "AI_RESPONSE_TRUNCATED",
      );
    }
    if (!text) return failure(requestId, "AI provider unavailable. Please try again.", 502);

    await adminClient.from("ai_usage").insert({ user_id: user.id, feature: feat });

    console.log(JSON.stringify({ requestId, function: FUNCTION_NAME, stage: "final", finalStatus: 200, textLength: text.length }));
    return json({ ok: true, text, requestId });
  } catch (err: any) {
    console.error(JSON.stringify({ requestId, stage: "unhandled", error: redact(err?.message || String(err)) }));
    return failure(requestId, "Resume rewriting failed unexpectedly. Please try again.", 500);
  }
});
