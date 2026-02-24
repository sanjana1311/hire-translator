import jsPDF from "jspdf";
import type { ResumeData } from "@/hooks/use-resume";
import type { Workspace } from "@/hooks/use-workspaces";

interface ExportOptions {
  resume: ResumeData;
  workspace: Workspace;
  selectedProjects: any[];
}

const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 5;

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function generateResumePDF({ resume, workspace, selectedProjects }: ExportOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 20;

  // Name / Contact header
  const name = resume.summary ? resume.summary.split(".")[0] : "Resume";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(name.length > 60 ? name.slice(0, 60) + "..." : name, MARGIN_LEFT, y);
  y += 8;

  // --- SUMMARY ---
  if (resume.summary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("SUMMARY", MARGIN_LEFT, y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    y = addWrappedText(doc, resume.summary, MARGIN_LEFT, y, CONTENT_WIDTH, LINE_HEIGHT);
    y += 4;
  }

  // --- EXPERIENCE / PROJECTS ---
  const bullets = Array.isArray(workspace.rewritten_bullets) ? workspace.rewritten_bullets : [];
  const experiences = Array.isArray(resume.experience) ? resume.experience : [];

  if (experiences.length > 0 || bullets.length > 0 || selectedProjects.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("EXPERIENCE / PROJECTS", MARGIN_LEFT, y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    // Experience entries with rewritten bullets
    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      if (y > 265) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(exp.title || "Role", MARGIN_LEFT, y);

      if (exp.dates) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const datesWidth = doc.getTextWidth(exp.dates);
        doc.text(exp.dates, PAGE_WIDTH - MARGIN_RIGHT - datesWidth, y);
      }
      y += LINE_HEIGHT;

      if (exp.company) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(exp.company, MARGIN_LEFT, y);
        y += LINE_HEIGHT;
      }

      y += 1;

      // Use rewritten bullets if available, otherwise original
      const expBullets = exp.bullets || [];
      for (const bullet of expBullets) {
        // Check if there's a rewritten version
        const rewritten = bullets.find((b: any) => b.original === bullet);
        const text = rewritten?.rewritten || bullet;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        y = addWrappedText(doc, `• ${text}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 3, 4.5);
        y += 1;
      }

      // If no experience bullets but we have rewritten bullets, show them
      if (expBullets.length === 0 && i === 0) {
        for (const b of bullets) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          y = addWrappedText(doc, `• ${b.rewritten}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 3, 4.5);
          y += 1;
        }
      }

      y += 3;
    }

    // If no experiences but we have rewritten bullets
    if (experiences.length === 0 && bullets.length > 0) {
      for (const b of bullets) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        y = addWrappedText(doc, `• ${b.rewritten}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 3, 4.5);
        y += 1;
      }
      y += 3;
    }

    // Selected Projects subsection
    if (selectedProjects.length > 0) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text("Projects", MARGIN_LEFT + 2, y);
      y += LINE_HEIGHT + 1;

      for (const proj of selectedProjects) {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(proj.title, MARGIN_LEFT + 2, y);
        y += 4.5;

        for (const bullet of (proj.bullets || [])) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          y = addWrappedText(doc, `• ${bullet}`, MARGIN_LEFT + 5, y, CONTENT_WIDTH - 5, 4.5);
          y += 1;
        }
        y += 2;
      }
    }
  }

  // --- EDUCATION ---
  const education = Array.isArray(resume.education) ? resume.education : [];
  if (education.length > 0) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("EDUCATION", MARGIN_LEFT, y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    for (const edu of education) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const eduText = `${edu.degree || ""} — ${edu.school || ""}`.trim();
      doc.text(eduText || "Education", MARGIN_LEFT, y);
      if (edu.dates) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const dw = doc.getTextWidth(edu.dates);
        doc.text(edu.dates, PAGE_WIDTH - MARGIN_RIGHT - dw, y);
      }
      y += LINE_HEIGHT + 2;
    }
    y += 2;
  }

  // --- SKILLS ---
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  if (skills.length > 0) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("SKILLS", MARGIN_LEFT, y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    y = addWrappedText(doc, skills.join(" • "), MARGIN_LEFT, y, CONTENT_WIDTH, 4.5);
    y += 4;
  }

  // --- ACHIEVEMENTS ---
  const achievements = Array.isArray(resume.achievements) ? resume.achievements : [];
  if (achievements.length > 0) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("ACHIEVEMENTS", MARGIN_LEFT, y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    for (const a of achievements) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      y = addWrappedText(doc, `• ${a}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 3, 4.5);
      y += 1;
    }
  }

  // Save
  const filename = `${workspace.company}_${workspace.role_title}_Resume.pdf`
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
  doc.save(filename);
}

/**
 * Validates that all rewritten bullets have measurable metrics.
 * Returns indices of bullets missing metrics.
 */
export function validateBulletMetrics(bullets: any[]): number[] {
  const metricPattern = /(\d+[\d,.]*\s*(%|percent|million|billion|thousand|x\b)|\$[\d,.]+|\d+[\d,.]*\s*(hours?|days?|weeks?|months?|years?|minutes?)|reduced\s+by|increased\s+by|improved\s+by|saved\s+\$|grew\s+\d|cut\s+\d|\d+K\+?|\d+M\+?|\d+\+\s*(users?|customers?|clients?|teams?|markets?))/i;

  const missing: number[] = [];
  bullets.forEach((b: any, i: number) => {
    if (!b.hasMetric && !metricPattern.test(b.rewritten || "")) {
      missing.push(i);
    }
  });
  return missing;
}
