import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker url import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
    );
  }
  return parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
}
