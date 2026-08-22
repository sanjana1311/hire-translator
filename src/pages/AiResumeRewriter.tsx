import { Link } from "react-router-dom";
import { ArrowRight, Github, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import Seo from "@/components/Seo";

const GITHUB_URL = "https://github.com/sanjanaravikumar/hireos";

const STEPS = [
  {
    title: "WHAT",
    body: "The concrete deliverable you shipped, taken verbatim from your uploaded resume — never invented.",
  },
  {
    title: "HOW",
    body: "The tools, systems, and methods you actually used, matched against the keywords in the job description.",
  },
  {
    title: "WHO",
    body: "The team, users, or stakeholders the work served, so the bullet reads as real scope instead of a slogan.",
  },
  {
    title: "IMPACT",
    body: "The measurable outcome. If your resume has no number for it, the rewriter leaves the claim unquantified rather than fabricating one.",
  },
];

const AiResumeRewriter = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="AI Resume Rewriter — Open Source, Evidence-Based | hireOS"
        description="An open-source AI resume rewriter that tailors bullets to any job description using the WHAT-HOW-WHO-IMPACT format, with every line traced back to your real resume."
        path="/ai-resume-rewriter"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "hireOS AI Resume Rewriter",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          license: "https://opensource.org/licenses/MIT",
          description:
            "Open-source AI resume rewriter that tailors resume bullets to a job description using evidence quoted from your existing resume.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />

      <header className="border-b border-border/60">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            hireOS
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
                <Github className="w-4 h-4 mr-1.5" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
          An AI resume rewriter that can't make things up
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl">
          hireOS rewrites your resume for a specific job description, but every rewritten bullet has
          to cite a verbatim quote from the resume you uploaded. No invented tools, no invented
          metrics, no invented job titles. It is MIT licensed and fully self-hostable, so your
          career history stays in a database you control.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/auth">
              Try the rewriter
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
              Self-host it
            </a>
          </Button>
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">
            The WHAT-HOW-WHO-IMPACT bullet format
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Most AI resume tools optimise for keyword density and quietly invent achievements to get
            there. hireOS forces every bullet through four slots, and refuses to fill a slot your
            resume does not support.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.title} className="apple-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm tracking-wide">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Why open source matters here</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="apple-card p-5">
              <ShieldCheck className="w-4 h-4 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm mb-1">Your resume stays yours</h3>
              <p className="text-sm text-muted-foreground">
                Self-host the backend and the AI keys, and no third party stores your work history.
              </p>
            </div>
            <div className="apple-card p-5">
              <Quote className="w-4 h-4 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm mb-1">Auditable prompts</h3>
              <p className="text-sm text-muted-foreground">
                The truth-boundary rules that block hallucinated experience live in the repository,
                so you can read and change them.
              </p>
            </div>
            <div className="apple-card p-5">
              <Sparkles className="w-4 h-4 text-muted-foreground mb-2" />
              <h3 className="font-semibold text-sm mb-1">Bring your own model</h3>
              <p className="text-sm text-muted-foreground">
                Swap the provider in one file — the rewriter is not tied to a single vendor.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 apple-card p-8">
          <h2 className="text-xl font-semibold tracking-tight">Rewrite your first resume</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Upload your resume, paste a job description, and hireOS scores the match before it
            rewrites anything — so you know which roles are worth the effort.
          </p>
          <Button className="mt-5" asChild>
            <Link to="/auth">
              Get started
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
};

export default AiResumeRewriter;
