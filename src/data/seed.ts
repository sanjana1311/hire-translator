export const RESUME_TEXT = `Sanjana Ravikumar, PMP®, CSPO®
hrsanjana26@gmail.com | LinkedIn | (480)-913-9983 | AI Strategy Newsletter | AI PM Mentor

PMP® certified PM with 4+ years of experience building and launching technical, user-facing products from 0→1 and at scale. Proven ability to deeply understand users' insights and markets, define product strategy, partner and lead cross-functional teams (engineering, ML, UX, and business), and iterate quickly post-launch using data and A/B testing experimentation. Experienced in 0→1 in GenAI platforms, communication systems, and data-driven product strategy.

EXPERIENCE
TESLA — Program Manager, GenAI Communication Systems | March 2025 – Present
• Owned the full SDLC for a unified global communications platform across Voice, Live Chat, Email, SMS, and In-App channels.
• Led Voice AI Agents platform: PRDs, backlog, sprints, rollout — reducing operational overhead by ~30%.
• Delivered LLM-powered features: intent detection, real-time transcription, summarization.
• Launched Tesla's customer segmentation platform via user research, PRDs, A/B experimentation.
• Built compliant consent/preferences system ensuring opt-in compliance across global markets.

TESLA — Program Manager Intern (Tesla Assist LLM Platform) | Jan 2025 – March 2025
• Led 0→1 internal AI agent-assist platform — pilot adopted by support teams within one quarter.
• Improved knowledge retrieval accuracy by 35% and CSAT by 8 points through post-launch iteration.

INFINEON TECHNOLOGIES — Project Coordinator, Drone & Power Systems | May 2024 – Sept 2024
• Coordinated technical product roadmaps across hardware, firmware, and software teams — on-time delivery up 87%.

INTELLIPAAT — Technical Product Manager | Oct 2021 – May 2023
• Owned multi-channel messaging platform (email, SMS, WhatsApp, in-app) — lead engagement +25%, conversion +18%.
• Integrated CRM systems, reducing manual sales follow-up effort by 30%.

PORTFOLIO
• Aisthetica — 0→1 multimodal Vision AI + LLM product for fashion tech
• Topmate Mentorship — 345+ 1:1 AI PM mentoring sessions

EDUCATION
B.Tech Electrical Engineering, VTU — May 2022 | M.S. Engineering Management, ASU — May 2025

SKILLS
Product Management · 0→1 Development · AI/ML Products · SDLC · PRDs · A/B Testing · OKRs · Cross-functional Leadership · SQL · Jira · Confluence · Figma · Tableau`;

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  url: string;
  source: string;
  description: string;
}

export const INITIAL_JOBS: Job[] = [
  { id: 1, title: "Operations Program Manager, Compute and Storage", company: "Google", location: "Sunnyvale, CA", salary: "$147K–$216K", url: "https://www.linkedin.com/jobs/view/4370701639/", source: "email", description: "Lead and manage cross-functional programs related to compute and storage operations at scale. Define program scope, goals, deliverables, and success metrics. Identify risks, dependencies, and blockers. Drive alignment across engineering, finance, legal, and operations.\n\nMinimum: 5 years program management, cross-functional stakeholder management.\nPreferred: Data center operations, compute/storage infrastructure, vendor management." },
  { id: 2, title: "GTM Onboarding Program Manager", company: "OpenAI", location: "San Francisco, CA", salary: "$177K–$251K", url: "https://www.linkedin.com/jobs/view/4378538531/", source: "email", description: "Design, build, and scale onboarding programs for enterprise customers. Partner with Sales, Solutions Engineering, Customer Success, and Product. Define KPIs and success metrics.\n\n5+ years program/project management or GTM operations. 0→1 program experience. AI/ML products strongly preferred." },
  { id: 3, title: "Technical Program Manager, Enterprise Readiness", company: "Anthropic", location: "New York, NY", salary: null, url: "https://www.linkedin.com/jobs/view/4361954563/", source: "email", description: "Drive cross-functional programs to improve enterprise readiness — security, compliance, scalability. Partner with Engineering, Product, Legal, Sales.\n\n4+ years technical program management. Enterprise software (SSO, RBAC, compliance). AI/ML product experience. PMP preferred." },
  { id: 4, title: "AIML - Data Operations Program Manager", company: "Apple", location: "Cupertino, CA", salary: null, url: "https://www.linkedin.com/jobs/view/4379454636/", source: "email", description: "Manage end-to-end data operations programs supporting ML model training and evaluation. Coordinate across data engineering, annotation, and ML teams.\n\n3+ years program management. ML data operations. Agile/Scrum." },
  { id: 5, title: "Technology Program Manager", company: "Meta", location: "Sunnyvale, CA", salary: null, url: "https://www.linkedin.com/jobs/view/4378157717/", source: "email", description: "Lead large-scale cross-functional technology programs. Partner with engineering, product, design, business. Manage risks, communicate to senior leadership.\n\n5+ years technical program management. AI/ML infrastructure preferred. PMP preferred." },
  { id: 6, title: "Sr Project Manager, Technical Programs", company: "PayPal", location: "San Jose, CA", salary: null, url: "https://www.linkedin.com/jobs/view/4378537651/", source: "email", description: "Manage delivery of complex technical projects across engineering teams. Define scope, schedule, resources. Executive reporting.\n\n5+ years PM experience. PMP required. Payments/fintech preferred. Jira, Confluence." },
  { id: 7, title: "Product Manager, ML Efficiency", company: "Google", location: "Sunnyvale, CA", salary: null, url: "https://www.linkedin.com/jobs/view/4370673143/", source: "email", description: "Define product strategy for ML efficiency tools used by Google AI teams. Work with ML engineers, researchers, TPMs.\n\n5 years product management. ML infrastructure or developer tools." },
  { id: 8, title: "Program Manager II, Software Engineering, Payments", company: "Google", location: "Mountain View, CA", salary: null, url: "https://www.linkedin.com/jobs/view/4379478399/", source: "email", description: "Lead cross-functional programs for payments software. Partner with engineering leads on technical roadmaps.\n\n3 years program management in software engineering. Payments experience preferred." },
];

export interface Application {
  jobId: number;
  title: string;
  company: string;
  appliedDate: string;
  status: string;
  lastEmail: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  nextAction: string | null;
  notes: string;
}

export const INITIAL_APPLICATIONS: Application[] = [
  { jobId: 101, title: "Product Manager, Agentforce for Supply Chain", company: "Salesforce", appliedDate: "2026-01-07", status: "applied", lastEmail: "2026-02-06", recruiterName: null, recruiterEmail: "salesforce@myworkday.com", nextAction: "Status update received Feb 6 — follow up for next steps", notes: "Referred by Yatin Satija — flagged as a great fit" },
  { jobId: 102, title: "Product Manager II, Recommendations Platform", company: "Tinder", appliedDate: "2026-01-27", status: "rejected", lastEmail: "2026-01-27", recruiterName: null, recruiterEmail: "no-reply@hire.lever.co", nextAction: null, notes: "Same-day rejection" },
  { jobId: 103, title: "Product Owner, Sales Technology", company: "LinkedIn", appliedDate: "2026-01-14", status: "rejected", lastEmail: "2026-01-23", recruiterName: null, recruiterEmail: "notifications@smartrecruiters.com", nextAction: null, notes: "Rejected after 9 days" },
  { jobId: 104, title: "Sales Enablement Program Manager", company: "Postman", appliedDate: "2026-01-11", status: "rejected", lastEmail: "2026-01-14", recruiterName: null, recruiterEmail: "no-reply@us.greenhouse-mail.io", nextAction: null, notes: "Rejected after 3 days" },
  { jobId: 105, title: "Product Manager, AI Powered Messaging", company: "Jerry", appliedDate: "2026-01-07", status: "applied", lastEmail: null, recruiterName: null, recruiterEmail: null, nextAction: "No reply in 59 days — consider following up", notes: "" },
];

export const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  applied:   { label: "Applied",   dot: "hsl(30 5% 59%)",   bg: "hsl(33 12% 92%)",   border: "hsl(33 12% 85%)",   text: "hsl(30 5% 35%)" },
  screening: { label: "Screening", dot: "hsl(25 84% 31%)",  bg: "hsl(37 60% 97%)",   border: "hsl(37 40% 80%)",   text: "hsl(25 84% 31%)" },
  interview: { label: "Interview", dot: "hsl(226 71% 48%)", bg: "hsl(214 100% 97%)",  border: "hsl(213 93% 87%)",  text: "hsl(226 71% 48%)" },
  offer:     { label: "Offer 🎉",  dot: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)",   border: "hsl(152 34% 82%)",  text: "hsl(153 40% 30%)" },
  rejected:  { label: "Rejected",  dot: "hsl(348 46% 28%)", bg: "hsl(0 38% 97%)",     border: "hsl(348 28% 85%)",  text: "hsl(348 46% 28%)" },
};

export const BUCKET_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  must:  { label: "Must Apply",     dot: "hsl(153 40% 30%)", text: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)",  border: "hsl(152 34% 82%)" },
  tweak: { label: "Needs Tweaking", dot: "hsl(25 84% 31%)",  text: "hsl(25 84% 31%)",  bg: "hsl(37 60% 97%)",  border: "hsl(37 40% 80%)" },
  low:   { label: "Low Alignment",  dot: "hsl(348 46% 28%)", text: "hsl(348 46% 28%)", bg: "hsl(0 38% 97%)",   border: "hsl(348 28% 85%)" },
};

export function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function scoreColor(score: number) {
  return score >= 75 ? "hsl(153 40% 30%)" : score >= 40 ? "hsl(25 84% 31%)" : "hsl(348 46% 28%)";
}

export function scoreBg(score: number) {
  return score >= 75 ? "hsl(150 38% 96%)" : score >= 40 ? "hsl(37 60% 97%)" : "hsl(0 38% 97%)";
}

export function scoreBorder(score: number) {
  return score >= 75 ? "hsl(152 34% 82%)" : score >= 40 ? "hsl(37 40% 80%)" : "hsl(348 28% 85%)";
}
