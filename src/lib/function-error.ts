// supabase.functions.invoke() surfaces only "Edge Function returned a non-2xx
// status code" — the JSON body with the real reason is on error.context.
export async function readFunctionError(error: any, fallback: string): Promise<string> {
  const res: Response | undefined = error?.context;
  if (res && typeof res.text === "function") {
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) return String(parsed.error);
        } catch {
          return text.slice(0, 300);
        }
      }
    } catch {
      // fall through to the generic message
    }
  }
  const msg = error?.message || "";
  if (!msg || /non-2xx status code/i.test(msg)) return fallback;
  return msg;
}
