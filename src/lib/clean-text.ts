/**
 * Fix mojibake: UTF-8 bytes misinterpreted as Latin-1.
 * E.g. "Technical Program Manager â€"" → "Technical Program Manager –"
 */
export function cleanText(text: string): string {
  if (!text) return text;
  try {
    const bytes = new Uint8Array(text.length);
    let hasBadRange = false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes[i] = c & 0xff;
      if (c >= 0xc0 && c <= 0xff) hasBadRange = true;
    }
    if (!hasBadRange) return text;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Strip known mojibake artifacts
    return text
      .replace(/\u00c2(?=[\u0080-\u00bf])/g, "")
      .replace(/\u00c2/g, "");
  }
}
