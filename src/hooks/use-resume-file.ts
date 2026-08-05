import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-profile";
import { extractPdfText } from "@/lib/pdf-extract";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB

export function validateResumeFile(file: File): string | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are supported";
  }
  if (file.size > MAX_RESUME_BYTES) return "File must be under 10MB";
  if (file.size === 0) return "File is empty";
  return null;
}

/** Uploads a PDF to the private `resumes` bucket under <auth_uid>/ and saves metadata + extracted text. */
export function useUploadResumeFile() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({ file, label }: { file: File; label?: string }) => {
      const err = validateResumeFile(file);
      if (err) throw new Error(err);
      if (!profile?.id) throw new Error("No profile found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      let rawText = "";
      try {
        rawText = await extractPdfText(file);
      } catch {
        rawText = "";
      }

      const meta: Record<string, any> = {
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/pdf",
        file_uploaded_at: new Date().toISOString(),
      };
      if (rawText.length > 100) meta.raw_text = rawText;
      if (label?.trim()) meta.label = label.trim();

      const { data: existing } = await supabase
        .from("resumes")
        .select("id, file_path")
        .eq("profile_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const oldPath = (existing as any).file_path as string | null;
        const { error } = await supabase.from("resumes").update(meta as any).eq("id", existing.id);
        if (error) throw error;
        if (oldPath && oldPath !== path) {
          await supabase.storage.from("resumes").remove([oldPath]);
        }
      } else {
        const { error } = await supabase
          .from("resumes")
          .insert({ ...meta, profile_id: profile.id } as any);
        if (error) throw error;
      }

      return { path, extracted: rawText.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume"] }),
  });
}

export function useDeleteResumeFile() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (resumeId: string) => {
      if (!profile?.id) throw new Error("No profile found");
      const { data: row } = await supabase
        .from("resumes")
        .select("id, file_path")
        .eq("id", resumeId)
        .maybeSingle();

      const path = (row as any)?.file_path as string | null;
      if (path) {
        const { error: rmErr } = await supabase.storage.from("resumes").remove([path]);
        if (rmErr) throw rmErr;
      }
      const { error } = await supabase
        .from("resumes")
        .update({
          file_path: null,
          file_name: null,
          file_size: null,
          file_type: null,
          file_uploaded_at: null,
        } as any)
        .eq("id", resumeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume"] }),
  });
}

/** Creates a short-lived signed URL for the user's private resume file. */
export async function getResumeSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
