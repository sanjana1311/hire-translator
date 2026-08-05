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

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(`Auth check failed: ${authErr.message}`);
      if (!user) throw new Error("Not authenticated — please sign in again");

      // Resolve profile (fall back to a direct lookup if the cached one isn't ready)
      let profileId = profile?.id as string | undefined;
      if (!profileId) {
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (pErr) throw new Error(`Could not load your profile: ${pErr.message}`);
        if (!p?.id) throw new Error("No profile found for your account");
        profileId = p.id;
      }

      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      let rawText = "";
      let extractError: string | null = null;
      try {
        rawText = await extractPdfText(file);
      } catch (e: any) {
        extractError = e?.message || "Could not read text from this PDF";
        rawText = "";
      }

      const uploadedAt = new Date().toISOString();
      const meta: Record<string, any> = {
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/pdf",
        file_uploaded_at: uploadedAt,
      };
      if (rawText.length > 100) meta.raw_text = rawText;
      if (label?.trim()) meta.label = label.trim();

      const { data: existingRows, error: exErr } = await supabase
        .from("resumes")
        .select("id, file_path")
        .eq("profile_id", profileId)
        .order("updated_at", { ascending: false });
      if (exErr) throw new Error(`Could not read your resume record: ${exErr.message}`);
      const existing = existingRows?.find((r: any) => r.file_path) ?? existingRows?.[0];


      if (existing) {
        const oldPath = (existing as any).file_path as string | null;
        const { error } = await supabase.from("resumes").update(meta as any).eq("id", existing.id);
        if (error) {
          await supabase.storage.from("resumes").remove([path]);
          throw new Error(`Saving resume record failed: ${error.message}`);
        }
        if (oldPath && oldPath !== path) {
          await supabase.storage.from("resumes").remove([oldPath]);
        }
      } else {
        const { error } = await supabase
          .from("resumes")
          .insert({ ...meta, profile_id: profileId } as any);
        if (error) {
          await supabase.storage.from("resumes").remove([path]);
          throw new Error(`Creating resume record failed: ${error.message}`);
        }
      }

      return { path, extracted: rawText.length, fileName: file.name, uploadedAt, extractError };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resume"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
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
