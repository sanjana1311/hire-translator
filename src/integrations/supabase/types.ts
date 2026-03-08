export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_date: string | null
          company: string
          created_at: string
          id: string
          imported_job_id: string | null
          job_seed_id: number | null
          last_email_date: string | null
          next_action: string | null
          notes: string | null
          profile_id: string
          recruiter_email: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          applied_date?: string | null
          company: string
          created_at?: string
          id?: string
          imported_job_id?: string | null
          job_seed_id?: number | null
          last_email_date?: string | null
          next_action?: string | null
          notes?: string | null
          profile_id: string
          recruiter_email?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          applied_date?: string | null
          company?: string
          created_at?: string
          id?: string
          imported_job_id?: string | null
          job_seed_id?: number | null
          last_email_date?: string | null
          next_action?: string | null
          notes?: string | null
          profile_id?: string
          recruiter_email?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_imported_job_id_fkey"
            columns: ["imported_job_id"]
            isOneToOne: false
            referencedRelation: "imported_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_sync_metadata: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_synced_at: string | null
          profile_id: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_synced_at?: string | null
          profile_id: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_synced_at?: string | null
          profile_id?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_sync_metadata_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_jobs: {
        Row: {
          company: string
          description: string | null
          description_fetched_at: string | null
          id: string
          imported_at: string
          location: string | null
          profile_id: string
          salary: string | null
          seen: boolean
          snippet: string | null
          source: string | null
          source_email_subject: string | null
          status: string
          title: string
          url: string | null
          url_verified: boolean
        }
        Insert: {
          company: string
          description?: string | null
          description_fetched_at?: string | null
          id?: string
          imported_at?: string
          location?: string | null
          profile_id: string
          salary?: string | null
          seen?: boolean
          snippet?: string | null
          source?: string | null
          source_email_subject?: string | null
          status?: string
          title: string
          url?: string | null
          url_verified?: boolean
        }
        Update: {
          company?: string
          description?: string | null
          description_fetched_at?: string | null
          id?: string
          imported_at?: string
          location?: string | null
          profile_id?: string
          salary?: string | null
          seen?: boolean
          snippet?: string | null
          source?: string | null
          source_email_subject?: string | null
          status?: string
          title?: string
          url?: string | null
          url_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "imported_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_workspaces: {
        Row: {
          ats_score: number | null
          baseline_score: number | null
          company: string
          created_at: string
          gap_analysis: Json | null
          id: string
          jd_analysis: Json | null
          job_description: string | null
          match_bucket: string
          profile_id: string
          rewritten_bullets: Json | null
          role_title: string
          score_delta: number | null
          selected_projects: Json | null
          status: string
          suggested_projects: Json | null
          tailored_resume: Json | null
          updated_at: string
        }
        Insert: {
          ats_score?: number | null
          baseline_score?: number | null
          company?: string
          created_at?: string
          gap_analysis?: Json | null
          id?: string
          jd_analysis?: Json | null
          job_description?: string | null
          match_bucket?: string
          profile_id: string
          rewritten_bullets?: Json | null
          role_title?: string
          score_delta?: number | null
          selected_projects?: Json | null
          status?: string
          suggested_projects?: Json | null
          tailored_resume?: Json | null
          updated_at?: string
        }
        Update: {
          ats_score?: number | null
          baseline_score?: number | null
          company?: string
          created_at?: string
          gap_analysis?: Json | null
          id?: string
          jd_analysis?: Json | null
          job_description?: string | null
          match_bucket?: string
          profile_id?: string
          rewritten_bullets?: Json | null
          role_title?: string
          score_delta?: number | null
          selected_projects?: Json | null
          status?: string
          suggested_projects?: Json | null
          tailored_resume?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_workspaces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          achievements: Json | null
          created_at: string
          education: Json | null
          experience: Json | null
          id: string
          profile_id: string
          projects: Json | null
          raw_text: string | null
          skills: Json | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          achievements?: Json | null
          created_at?: string
          education?: Json | null
          experience?: Json | null
          id?: string
          profile_id: string
          projects?: Json | null
          raw_text?: string | null
          skills?: Json | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          achievements?: Json | null
          created_at?: string
          education?: Json | null
          experience?: Json | null
          id?: string
          profile_id?: string
          projects?: Json | null
          raw_text?: string | null
          skills?: Json | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_versions: {
        Row: {
          created_at: string
          id: string
          label: string | null
          resume_snapshot: Json | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          resume_snapshot?: Json | null
          version_number?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          resume_snapshot?: Json | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "job_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_profile_owner: { Args: { p_profile_id: string }; Returns: boolean }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
