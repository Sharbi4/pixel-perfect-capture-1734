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
      appointments: {
        Row: {
          call_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string
          price: number
          salon_id: string
          service_id: string | null
          service_name: string
          source: string
          staff_id: string | null
          starts_at: string
          status: string
          text_confirmed: boolean
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string
          price?: number
          salon_id: string
          service_id?: string | null
          service_name?: string
          source?: string
          staff_id?: string | null
          starts_at: string
          status?: string
          text_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string
          price?: number
          salon_id?: string
          service_id?: string | null
          service_name?: string
          source?: string
          staff_id?: string | null
          starts_at?: string
          status?: string
          text_confirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          processed_at: string | null
          purchase_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id: string
          processed_at?: string | null
          purchase_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          processed_at?: string | null
          purchase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "checkout_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      call_notes: {
        Row: {
          body: string
          call_id: string
          created_at: string
          id: string
          salon_id: string
          user_id: string
        }
        Insert: {
          body: string
          call_id: string
          created_at?: string
          id?: string
          salon_id: string
          user_id?: string
        }
        Update: {
          body?: string
          call_id?: string
          created_at?: string
          id?: string
          salon_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          created_at: string
          customer_phone: string
          direction: string
          duration_secs: number
          follow_up_at: string | null
          has_recording: boolean
          id: string
          outcome: string
          provider_ref: string
          resolved_at: string | null
          salon_id: string
          started_at: string
          status: string
          summary: string
          title: string
          transcript: Json
        }
        Insert: {
          created_at?: string
          customer_phone?: string
          direction?: string
          duration_secs?: number
          follow_up_at?: string | null
          has_recording?: boolean
          id?: string
          outcome?: string
          provider_ref: string
          resolved_at?: string | null
          salon_id: string
          started_at: string
          status?: string
          summary?: string
          title?: string
          transcript?: Json
        }
        Update: {
          created_at?: string
          customer_phone?: string
          direction?: string
          duration_secs?: number
          follow_up_at?: string | null
          has_recording?: boolean
          id?: string
          outcome?: string
          provider_ref?: string
          resolved_at?: string | null
          salon_id?: string
          started_at?: string
          status?: string
          summary?: string
          title?: string
          transcript?: Json
        }
        Relationships: [
          {
            foreignKeyName: "calls_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_purchases: {
        Row: {
          buyer: Json
          card_id: string
          consent_at: string
          created_at: string
          customer_id: string
          email: string
          environment: string
          error_code: string
          id: string
          invite_state: string
          location_id: string
          lock_token: string | null
          locked_at: string | null
          monthly_cents: number
          next_billing_date: string
          owner_id: string | null
          paid_through: string | null
          payment_id: string
          plan_id: string
          plan_name: string
          preview: Json
          secret_hash: string
          source_cipher: string
          source_hash: string
          state: string
          subscription_id: string
          timezone: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          buyer: Json
          card_id?: string
          consent_at: string
          created_at?: string
          customer_id?: string
          email: string
          environment: string
          error_code?: string
          id?: string
          invite_state?: string
          location_id: string
          lock_token?: string | null
          locked_at?: string | null
          monthly_cents: number
          next_billing_date: string
          owner_id?: string | null
          paid_through?: string | null
          payment_id?: string
          plan_id: string
          plan_name: string
          preview: Json
          secret_hash: string
          source_cipher?: string
          source_hash?: string
          state?: string
          subscription_id?: string
          timezone: string
          total_cents: number
          updated_at?: string
        }
        Update: {
          buyer?: Json
          card_id?: string
          consent_at?: string
          created_at?: string
          customer_id?: string
          email?: string
          environment?: string
          error_code?: string
          id?: string
          invite_state?: string
          location_id?: string
          lock_token?: string | null
          locked_at?: string | null
          monthly_cents?: number
          next_billing_date?: string
          owner_id?: string | null
          paid_through?: string | null
          payment_id?: string
          plan_id?: string
          plan_name?: string
          preview?: Json
          secret_hash?: string
          source_cipher?: string
          source_hash?: string
          state?: string
          subscription_id?: string
          timezone?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          customer_phone: string
          direction: string
          id: string
          provider_ref: string
          salon_id: string
          sender_user: string | null
          sent_at: string
          sent_by: string
          status: string
        }
        Insert: {
          body?: string
          created_at?: string
          customer_phone?: string
          direction: string
          id?: string
          provider_ref: string
          salon_id: string
          sender_user?: string | null
          sent_at: string
          sent_by?: string
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_phone?: string
          direction?: string
          id?: string
          provider_ref?: string
          salon_id?: string
          sender_user?: string | null
          sent_at?: string
          sent_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          checkout_url: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          salon_id: string
          square_order_id: string | null
          square_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind: string
          salon_id: string
          square_order_id?: string | null
          square_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          salon_id?: string
          square_order_id?: string | null
          square_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
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
      salon_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["salon_role"]
          salon_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["salon_role"]
          salon_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["salon_role"]
          salon_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
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
          buffer_min: number
          cancellation_policy: string
          config_version: number
          confirm_texts: boolean
          contact_name: string
          created_at: string
          deposit_policy: string
          has_receptionist: boolean | null
          horizon_days: number
          hours: string
          id: string
          languages: string[]
          launched_at: string | null
          lead_min: number
          name: string
          owner_id: string
          paid_access_until: string | null
          phone: string
          phone_number: string
          phone_number_sid: string
          plan_tier: string
          scheduling_addon: boolean
          setup_completed: number[]
          setup_config: Json
          setup_draft: Json | null
          setup_method: string
          setup_revision: number
          status: string
          timezone: string
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
          buffer_min?: number
          cancellation_policy?: string
          config_version?: number
          confirm_texts?: boolean
          contact_name?: string
          created_at?: string
          deposit_policy?: string
          has_receptionist?: boolean | null
          horizon_days?: number
          hours?: string
          id?: string
          languages?: string[]
          launched_at?: string | null
          lead_min?: number
          name?: string
          owner_id: string
          paid_access_until?: string | null
          phone?: string
          phone_number?: string
          phone_number_sid?: string
          plan_tier?: string
          scheduling_addon?: boolean
          setup_completed?: number[]
          setup_config?: Json
          setup_draft?: Json | null
          setup_method?: string
          setup_revision?: number
          status?: string
          timezone?: string
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
          buffer_min?: number
          cancellation_policy?: string
          config_version?: number
          confirm_texts?: boolean
          contact_name?: string
          created_at?: string
          deposit_policy?: string
          has_receptionist?: boolean | null
          horizon_days?: number
          hours?: string
          id?: string
          languages?: string[]
          launched_at?: string | null
          lead_min?: number
          name?: string
          owner_id?: string
          paid_access_until?: string | null
          phone?: string
          phone_number?: string
          phone_number_sid?: string
          plan_tier?: string
          scheduling_addon?: boolean
          setup_completed?: number[]
          setup_config?: Json
          setup_draft?: Json | null
          setup_method?: string
          setup_revision?: number
          status?: string
          timezone?: string
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
      sms_threads: {
        Row: {
          ai_enabled: boolean
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string
          salon_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          created_at?: string
          customer_name?: string
          customer_phone: string
          id?: string
          notes?: string
          salon_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string
          salon_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_threads_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          hours: Json
          id: string
          name: string
          position: number
          salon_id: string
          service_ids: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          hours?: Json
          id?: string
          name: string
          position?: number
          salon_id: string
          service_ids?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          hours?: Json
          id?: string
          name?: string
          position?: number
          salon_id?: string
          service_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "staff_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string
          salon_id: string
          staff_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string
          salon_id: string
          staff_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string
          salon_id?: string
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_off_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          client_name: string
          client_phone: string
          created_at: string
          id: string
          preferred: string
          salon_id: string
          service_name: string
          source: string
          staff_id: string | null
          status: string
        }
        Insert: {
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          preferred?: string
          salon_id: string
          service_name?: string
          source?: string
          staff_id?: string | null
          status?: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          preferred?: string
          salon_id?: string
          service_name?: string
          source?: string
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      acquire_checkout: {
        Args: {
          p_cipher?: string
          p_hash?: string
          p_id: string
          p_secret: string
        }
        Returns: Json
      }
      apply_checkout_access: {
        Args: { p_id: string; p_refunded: boolean; p_until: string }
        Returns: undefined
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
      claim_checkout: {
        Args: { p_draft: Json; p_email: string; p_owner: string }
        Returns: string
      }
      is_salon_member: {
        Args: { _salon: string; _user: string }
        Returns: boolean
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
      salon_role: "owner" | "manager" | "staff"
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
    Enums: {
      salon_role: ["owner", "manager", "staff"],
    },
  },
} as const
