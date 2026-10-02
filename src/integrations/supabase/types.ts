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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      phone_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_code: string
          id: string
          idempotency_key: string
          kind: string
          lock_token: string | null
          locked_at: string | null
          provider_ref: string
          salon_id: string
          state: string
          target: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string
          id?: string
          idempotency_key: string
          kind: string
          lock_token?: string | null
          locked_at?: string | null
          provider_ref?: string
          salon_id: string
          state?: string
          target?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string
          id?: string
          idempotency_key?: string
          kind?: string
          lock_token?: string | null
          locked_at?: string | null
          provider_ref?: string
          salon_id?: string
          state?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_jobs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_setups: {
        Row: {
          agent_error: string
          agent_status: string
          business_number: string
          created_at: string
          forwarding_status: string
          portability_status: string
          salon_id: string
          temp_number_error: string
          temp_number_status: string
          texting_status: string
          updated_at: string
          voice_status: string
        }
        Insert: {
          agent_error?: string
          agent_status?: string
          business_number?: string
          created_at?: string
          forwarding_status?: string
          portability_status?: string
          salon_id: string
          temp_number_error?: string
          temp_number_status?: string
          texting_status?: string
          updated_at?: string
          voice_status?: string
        }
        Update: {
          agent_error?: string
          agent_status?: string
          business_number?: string
          created_at?: string
          forwarding_status?: string
          portability_status?: string
          salon_id?: string
          temp_number_error?: string
          temp_number_status?: string
          texting_status?: string
          updated_at?: string
          voice_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_setups_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string
          agent_error: string
          agent_id: string
          agent_synced_version: number
          booking_app: string
          cancellation_policy: string
          config_version: number
          contact_name: string
          created_at: string
          deposit_policy: string
          has_receptionist: boolean | null
          hours: string
          id: string
          languages: string[]
          launched_at: string | null
          name: string
          owner_id: string
          paid_access_until: string | null
          phone: string
          phone_number: string
          phone_number_sid: string
          setup_completed: number[]
          setup_config: Json
          setup_draft: Json | null
          setup_method: string
          setup_revision: number
          status: string
          updated_at: string
          voice: string
          walk_ins: boolean
          website: string
        }
        Insert: {
          address?: string
          agent_error?: string
          agent_id?: string
          agent_synced_version?: number
          booking_app?: string
          cancellation_policy?: string
          config_version?: number
          contact_name?: string
          created_at?: string
          deposit_policy?: string
          has_receptionist?: boolean | null
          hours?: string
          id?: string
          languages?: string[]
          launched_at?: string | null
          name?: string
          owner_id: string
          paid_access_until?: string | null
          phone?: string
          phone_number?: string
          phone_number_sid?: string
          setup_completed?: number[]
          setup_config?: Json
          setup_draft?: Json | null
          setup_method?: string
          setup_revision?: number
          status?: string
          updated_at?: string
          voice?: string
          walk_ins?: boolean
          website?: string
        }
        Update: {
          address?: string
          agent_error?: string
          agent_id?: string
          agent_synced_version?: number
          booking_app?: string
          cancellation_policy?: string
          config_version?: number
          contact_name?: string
          created_at?: string
          deposit_policy?: string
          has_receptionist?: boolean | null
          hours?: string
          id?: string
          languages?: string[]
          launched_at?: string | null
          name?: string
          owner_id?: string
          paid_access_until?: string | null
          phone?: string
          phone_number?: string
          phone_number_sid?: string
          setup_completed?: number[]
          setup_config?: Json
          setup_draft?: Json | null
          setup_method?: string
          setup_revision?: number
          status?: string
          updated_at?: string
          voice?: string
          walk_ins?: boolean
          website?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_addon: boolean
          minutes: number
          name: string
          position: number
          price: number
          salon_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_addon?: boolean
          minutes?: number
          name: string
          position?: number
          price?: number
          salon_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_addon?: boolean
          minutes?: number
          name?: string
          position?: number
          price?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_phone_job: {
        Args: { j: Database["public"]["Tables"]["phone_jobs"]["Row"] }
        Returns: undefined
      }
      _begin_phone_job_unpaid_check: {
        Args: { p_key: string; p_kind: string; p_salon: string }
        Returns: {
          acquired: boolean
          error_code: string
          job_id: string
          job_state: string
          lock_token: string
          provider_ref: string
          target: string
        }[]
      }
      begin_phone_job: {
        Args: { p_key: string; p_kind: string; p_salon: string }
        Returns: {
          acquired: boolean
          error_code: string
          job_id: string
          job_state: string
          lock_token: string
          provider_ref: string
          target: string
        }[]
      }
      save_setup_draft: {
        Args: {
          p_draft: Json
          p_owner: string
          p_profile?: Json
          p_revision: number
          p_salon: string
          p_step?: number
        }
        Returns: number
      }
      set_phone_job_target: {
        Args: { p_job: string; p_target: string; p_token: string }
        Returns: boolean
      }
      transition_phone_job: {
        Args: {
          p_error: string
          p_job: string
          p_ref: string
          p_to: string
          p_token: string
        }
        Returns: boolean
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
