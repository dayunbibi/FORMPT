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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          cancel_requested: boolean
          created_at: string
          duration_min: number
          id: string
          member_id: string
          member_note: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          trainer_id: string
        }
        Insert: {
          cancel_requested?: boolean
          created_at?: string
          duration_min?: number
          id?: string
          member_id: string
          member_note?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          trainer_id: string
        }
        Update: {
          cancel_requested?: boolean
          created_at?: string
          duration_min?: number
          id?: string
          member_id?: string
          member_note?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          trainer_id?: string
        }
        Relationships: []
      }
      credit_entries: {
        Row: {
          amount_paid: number | null
          booking_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          delta: number
          id: string
          kind: string
          member_id: string
          note: string | null
          trainer_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          delta: number
          id?: string
          kind?: string
          member_id: string
          note?: string | null
          trainer_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          delta?: number
          id?: string
          kind?: string
          member_id?: string
          note?: string | null
          trainer_id?: string | null
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          created_at: string
          id: string
          member_id: string
          message: string | null
          status: Database["public"]["Enums"]["request_status"]
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trainer_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string
          goal: string | null
          id: string
          injuries: string | null
          onboarded: boolean
          phone: string | null
          photo_path: string | null
          preferred_time: string | null
          renewal_dismissed_at: string | null
          suspended: boolean
          trainer_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          goal?: string | null
          id: string
          injuries?: string | null
          onboarded?: boolean
          phone?: string | null
          photo_path?: string | null
          preferred_time?: string | null
          renewal_dismissed_at?: string | null
          suspended?: boolean
          trainer_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string
          goal?: string | null
          id?: string
          injuries?: string | null
          onboarded?: boolean
          phone?: string | null
          photo_path?: string | null
          preferred_time?: string | null
          renewal_dismissed_at?: string | null
          suspended?: boolean
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_requests: {
        Row: {
          created_at: string
          id: string
          member_id: string
          member_note: string | null
          remaining_at_request: number
          resolved_at: string | null
          status: Database["public"]["Enums"]["renewal_status"]
          trainer_id: string
          trainer_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          member_note?: string | null
          remaining_at_request?: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["renewal_status"]
          trainer_id: string
          trainer_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          member_note?: string | null
          remaining_at_request?: number
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["renewal_status"]
          trainer_id?: string
          trainer_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trainer_invite_codes: {
        Row: {
          code: string
          created_at: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trainer_settings: {
        Row: {
          booking_cutoff_hours: number
          cancel_cutoff_hours: number
          close_hour: number
          closed_weekdays: number[]
          default_currency: Database["public"]["Enums"]["currency_code"]
          holidays: string[]
          open_hour: number
          session_minutes: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          booking_cutoff_hours?: number
          cancel_cutoff_hours?: number
          close_hour?: number
          closed_weekdays?: number[]
          default_currency?: Database["public"]["Enums"]["currency_code"]
          holidays?: string[]
          open_hour?: number
          session_minutes?: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          booking_cutoff_hours?: number
          cancel_cutoff_hours?: number
          close_hour?: number
          closed_weekdays?: number[]
          default_currency?: Database["public"]["Enums"]["currency_code"]
          holidays?: string[]
          open_hour?: number
          session_minutes?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_items: {
        Row: {
          exercise: string
          id: string
          log_id: string
          position: number
          reps: number | null
          sets: number | null
          weight_kg: number | null
        }
        Insert: {
          exercise: string
          id?: string
          log_id: string
          position?: number
          reps?: number | null
          sets?: number | null
          weight_kg?: number | null
        }
        Update: {
          exercise?: string
          id?: string
          log_id?: string
          position?: number
          reps?: number | null
          sets?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_items_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          log_date: string
          member_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          log_date?: string
          member_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          log_date?: string
          member_id?: string
          trainer_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_member: { Args: { _member_id: string }; Returns: boolean }
      list_trainers: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      my_invite_code: { Args: never; Returns: string }
      my_trainer_id: { Args: never; Returns: string }
      redeem_invite_code: {
        Args: { _code: string }
        Returns: {
          trainer_id: string
          trainer_name: string
        }[]
      }
      regenerate_invite_code: { Args: never; Returns: string }
      taken_slots: {
        Args: { _day: string; _trainer_id: string }
        Returns: {
          start_at: string
        }[]
      }
    }
    Enums: {
      app_role: "member" | "trainer"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      currency_code: "KRW" | "CAD"
      renewal_status: "requested" | "contacted" | "renewed" | "declined"
      request_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["member", "trainer"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      currency_code: ["KRW", "CAD"],
      renewal_status: ["requested", "contacted", "renewed", "declined"],
      request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
