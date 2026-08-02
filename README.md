# Career Compass

PROJECT TITLE

HireOS – AI-Powered Career Operating System

PROJECT OVERVIEW

Build a full-stack web application called HireOS.

HireOS helps any job seeker navigate modern hiring by:

- Taking a user’s resume (uploaded once, auto-saved)

- Taking a job description (saved per role)

- Analyzing the job description for keywords, key phrases, tools, responsibilities, and hiring-team signals

- Rewriting the user’s resume experience bullets line-by-line for that specific job

- Incorporating the EXACT keywords and key phrases from the job description into the rewritten bullets (when relevant)

- Enforcing a strict bullet structure: What I did → How I did it → Who/Scope → Impact

- Enforcing metrics: Use metrics from the original resume if present; if missing, ask the user for the metric inputs before generating the final PDF

- Suggesting 2–3 role-relevant AI projects, then prompting the user to pick which ones to add under the Projects section

- Exporting an ATS-friendly PDF ready to apply

THIS IS NOT a generic resume builder.

It is a hiring-intent translation engine with validation gates.

CORE RESUME STRUCTURE (MUST MATCH EXACTLY)

The generated resume (preview + PDF) must follow this exact section order:

1) Summary

2) Experience / Projects

3) Education

4) Skills

5) Achievements (only if provided; omit section if none)

IMPORTANT RESUME RULES

- Do NOT include any section title like “Strategic Alignment Recommendations” anywhere in the resume.

- Project suggestions must NOT appear on the resume unless the user explicitly selects them.

- Once projects are selected, add them under the Projects subsection within “Experience / Projects”.

- No fabricated achievements.

- No fabricated metrics.

- If metrics are missing, block PDF export until user provides them.

AUTHENTICATION

- User signup/login

- Each user has persistent storage

- Resume saved once per account (can be updated later)

- Each job description saved as a separate workspace item

DASHBOARD REQUIREMENTS

Create a clean dashboard with:

- Resume Profile (view/edit)

- Job Description Workspaces list (Company, Role Title, Date Added, Status: Draft / Ready / Applied)

- For each JD workspace: analysis, rewritten bullets, versions, and export

RESUME INGEST + STRUCTURING

When user uploads resume:

- Parse into structured fields:

  - Summary (text)

  - Experience entries (company, title, dates, bullets)

  - Projects entries (project name, bullets) if present

  - Education (school, degree, dates)

  - Skills (list)

  - Achievements (list) if present

- Store in database as structured JSON (NOT a plain text blob)

- Preserve original bullets and original metrics as “source-of-truth”

JOB DESCRIPTION INPUT + ANALYSIS

When user pastes a job description:

Extract and store structured JSON containing:

- Core responsibilities

- EXACT keywords and key phrases (extract verbatim phrases where possible)

- Tools/technologies mentioned

- Metrics mentioned (if any)

- Ownership level expected

- Hiring-team signals (AI platform, data analytics, automation, infra, ops, product, etc.)

- Themes from Role Overview

ATS QUICK SCORE (FAST SIGNAL)

Immediately show a quick ATS scan:

- Keyword match percentage

- Missing keyword clusters

- Overused weak verbs / filler terms

- Suggested high-signal verbs aligned to JD

This score is for the UI only (not included on the resume PDF).

BULLET REWRITE ENGINE (STRICT FORMAT)

For each experience bullet:

Rewrite into a single bullet that must include:

1) WHAT I DID: strong ownership verb + clear deliverable

2) HOW I DID IT: tools, methods, process (from resume + JD)

3) WHO/SCOPE: cross-functional stakeholders, users, scale, region, team (from resume; if missing, ask user later only if required)

4) IMPACT: metric required (use original resume metric if available; otherwise ask user)

Rewrite rules:

- Incorporate EXACT JD keywords and key phrases where relevant, without keyword stuffing.

- Do not invent facts, scope, or metrics.

- Keep ATS-friendly formatting (no tables, no icons, no columns).

- Keep bullets concise and readable.

METRIC ENFORCEMENT VALIDATION (HARD GATE BEFORE PDF)

Before allowing PDF export:

Run checks per bullet:

- Contains measurable impact metric (%, $, time saved, volume, scale)

- Contains clear action (what)

- Contains method (how)

- Contains scope (who/scale) where possible

- Includes relevant JD keyword/phrase mapping

If any bullet is missing a metric:

- Block PDF export

- Prompt user with a form for missing fields:

  - Impact metric type (choose: % improvement, time saved, cost saved, revenue, volume/throughput, adoption)

  - Metric value

  - Optional: baseline or context

Use user-provided metrics to finalize bullets.

PROJECT SUGGESTION + USER SELECTION (NOT AUTO-INSERTED)

Based on the hiring-team signals and JD content, generate 2–3 suggested projects (preferably AI-related when appropriate).

Each suggestion must include:

- Project title

- 2–3 bullet points (following WHAT-HOW-WHO-IMPACT format if possible)

- What hiring signal it supports (ex: “RAG pipeline for customer support”, “Agentic workflow automation”, “Monitoring dashboard with Prometheus/Grafana”)

Then prompt the user:

“Pick up to 2 projects to add under Projects.”

Only after user selection:

- Insert selected projects into the resume under “Experience / Projects” → Projects subsection

- Ensure formatting matches the rest of resume

- If project bullets contain metrics and user can’t provide them, keep them realistic but do NOT fabricate; ask for metric inputs if required before PDF export.

RESUME REBUILD + PREVIEW

Generate a resume preview that strictly follows:

1) Summary

2) Experience / Projects

3) Education

4) Skills

5) Achievements (omit if empty)

Inside “Experience / Projects”:

- Include Experience entries first

- Then include Projects subsection (only include user-selected projects or existing resume projects)

VERSIONING

For each JD workspace:

- Save each generated resume version (v1, v2, v3)

- Allow user to compare versions (diff view)

- Allow user to revert to prior version

PDF EXPORT

Allow user to download:

- Updated resume as a clean ATS-friendly PDF

- Only after passing validation (especially metrics)

PDF must be single-column, standard fonts, consistent spacing.

UI/UX DESIGN REQUIREMENTS

- Minimal, professional, high-trust UI

- Clean typography, neutral palette

- Dashboard-first experience

- Clear step progression:

  1) Upload Resume (once)

  2) Add Job Description

  3) View ATS quick score

  4) Review rewrites

  5) Provide missing metrics (if needed)

  6) Choose projects

  7) Preview + Export PDF

NON-NEGOTIABLES

- No hallucinated achievements

- No fabricated metrics

- Metric hard gate before PDF

- No “Strategic Alignment Recommendations” anywhere on the resume

- Project suggestions must be user-selected before insertion

SUCCESS CRITERIA

A user can:

- Upload resume once

- Paste a JD

- Get ATS quick score

- Get strict-format rewritten bullets with exact JD keyword alignment

- Provide missing metrics if needed

- Choose up to 2 projects to add under Projects

- Export an ATS-friendly PDF ready to apply

- Save versions per JD workspace

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hire-translator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8e867b45-08e6-4181-9c6e-45b234010067).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
